# ZViewerCLI 代理协议

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI) 是一个 Go 编写的独立仓库。它通过 Socket.IO（一种在 WebSocket 之上实现实时双向通信的库）与服务器通信，为浏览器提供两样能力：使用本机 Bilibili Cookie，以及把媒体流经本机代理转发。Cookie 只保存在用户本机，不经过服务器。

## 注册流程（v0.2.0 去房间化）

CLI 启动后要先向服务器登记自己，服务器才知道有一个可用的本机代理。注册分五步。

1. CLI 启动时携带 Engine.IO 握手参数 `{"agent":"zcontrol-cli"}` 建立 WebSocket。服务器的 `io.use` 中间件（Socket.IO 在建立连接前执行的钩子）看到这个参数就直接放行并标记 `isCliAgent`，绕过通用的 access_token 校验。

2. 连接建立后，CLI 发送 `cli-register` 事件，payload 如下：

```json
{
  "proxyUrl": "http://127.0.0.1:9333",
  "agent": "zviewer-cli",
  "version": "0.2.0",
  "user": "用户名"
}
```

3. 服务端只校验必填的 `proxyUrl`，**忽略任何房间号**（`roomId` 只是为兼容旧版保留的字段）。同时用 `normalizeLocalCliProxyUrl` 把 hostname **强制改写为 `127.0.0.1`**（端口和路径保持不变）。这样做是为了防止旧版 CLI 误报页面 host，导致前端 CORS（跨域资源共享，浏览器判断能否跨域请求的规则）失败。

4. 服务端把 CLI 记入专用房间 `__cli-agents__`，这只为聚合查询方便，语义上等于全局注册。随后回 `cli-registered`，并 `io.emit('cli-agent-available', agentInfo)` **全局广播**。连接没有 `isCliAgent` 标记或缺少 proxyUrl 时，回 `cli-error`。

5. CLI 断连时，服务器全局广播 `cli-agent-unavailable {socketId}`。`cli-list-agents`（参数可以省略）经 `io.in('__cli-agents__').fetchSockets()` 聚合后返回。

## 代理的作用范围与可用性

一个 CLI 注册进来之后，谁能用它、它能撑多久、什么时候算可用，都有明确的规则。

- **一个 CLI 对服务器上所有房间都可用。** 房间里的 CLI 功能开关（音乐视频高画质 `musicVideoCli` / `cliEnabled`）打开后会自动使用它，不存在「每个房间各连一个 CLI」的概念。

- **按 user 过滤归属。** 前端的 `useCliAgent()` 不带参数调用，内部按 `authStore` 里的登录用户名过滤，只保留满足 `!a.user || a.user === username` 的代理。不带 `user` 字段的旧版 CLI 视为公共代理，所有人可见。过滤完成后才写入 cliAgentStore，所以 store 里只有当前用户的代理，`getActiveCliProxyUrl` 直接取 `agents[0].proxyUrl` 即可。

- **配置只存在内存里。** CLI 重启后，`serverUrl` 和 `user` 都会丢失，只有 Cookie 持久化在 `~/.zviewer/config.json`，需要从网页端配置页重新带入。

- **可用性只看有没有代理注册进来。** 判定条件是 `available = agents.length > 0`，不强制要求本地健康检查通过，因为健康检查可能因 CORS 失败，而实际的 HTTP 服务仍然可用。健康检查只在 http 本地页面执行，每 5s 轮询一次 `/health`；https 页面直接跳过。

## 本地代理与解析

CLI 在本机启动一个 HTTP 服务，浏览器通过它取到带 Cookie 的媒体流。服务默认绑定 `127.0.0.1:9333`（可用 `-port` 改端口），提供这些路由：`/health`、`/api/config`、`/api/qr`、`/api/qr/poll`（B站扫码登录）、`/api/connect`、`/api/disconnect`、`/api/bili-info`、`/api/dash-mpd`、`/resolve`、`/proxy`。

```
浏览器 <video>/<audio>
   │  http://127.0.0.1:9333/proxy?url=...
   ▼
ZViewerCLI 本地 HTTP 代理
   │  注入本地 Bilibili Cookie + Referer / Origin / User-Agent
   ▼
Bilibili CDN（up to 大会员档位）
```

- **优先使用 DASH。** DASH（一种把音视频拆成分片、按需拉取的流式协议）在已连接 CLI 的高画质模式下会强制 `forceDash`，禁用 MP4 降级，音视频以 m4s 分离。`/resolve` 同时返回两种地址：原始 CDN URL（供 `/api/dash-mpd` 生成 MPD 喂给 MSE）和重写为本地代理的 URL。

- **主地址失败时切换备用 CDN。** `/proxy` 请求主 URL 失败后，按解析期缓存下来的 `backupUrl` 候选依次重试；同时透传 Range（分段请求头，用于拖动进度）；B站 CDN 偶尔返回 `application/json` 的视频数据，此时纠正为 `video/mp4`；上游超时 60s，连接池配置为 `MaxIdleConns=100 / PerHost=20`。

- **清晰度档位。** `qn` 是 B站表示清晰度的档位号，取值 127(8K)/126(杜比)/125(HDR)/120(4K)/116/112/80/74/64/32/16。请求参数为 `fnval = 16 | (VIP ? 128 : 0)`，qn=127 时再追加 8K 标志位；会员档白名单是 `[112,116,120,125,126,127]`。MP4 直链最高支持 1080P（`mp4MaxQn=80`）。

- **服务端的 `/api/cli/resolve`。** 这个接口用 CLI 请求头里自带的 B站 Cookie 做解析（Cookie 需含 SESSDATA），并设置 `skipCdnCheck: true`。实际视频流由用户本机浏览器经 CLI 拉取，服务器不需要校验 CDN 可达性，这样可以避免远程网络差异造成的错误降级。

- **非会员的档位保护。** 前端开启 CLI 且代理在线时会查询会员状态。如果用户不是会员却选了会员档（qn > 80），会自动回落到 0，也就是跟随账号默认档位。

解析结果有缓存：音频直链 TTL（生存时间，即缓存多久后失效）为 2 小时；VIP 状态缓存 5 分钟。

## 前端接入点

前端在几个位置接入了 CLI，各自的行为如下表。

| 场景 | 行为 |
|---|---|
| 音乐视频背景 | `useMusicVideoBackground`：CLI 在线 → CLI 高画质 DASH；否则回退服务器 720P MP4 |
| 音乐音源 | `resolveBiliAudio`：CLI 开启且在线 → CLI DASH 音轨；否则服务器代理 MP4 |
| 一起看影片 | 房间开关 `cliEnabled` 打开时可用；`hostCliEnabled` 会经同步状态广播给观众（强制走 MP4 路径） |
| 配置页入口 | `openCliSetup()` 打开 `http://127.0.0.1:9333/?server=<api>&user=<username>`；CLI 侧读取参数预填，连接时用 POST `/api/connect` 上报 |

## 断线重连与心跳

网络会抖动，服务器也可能短暂不可达，所以 CLI 侧和前端侧各有一套保活机制。

- **CLI 侧**由服务器主导 ping/pong 心跳。`lastActivityAt` 超过 `pingInterval + pingTimeout`（下限 45s）时强制重连；`reconnectLoop` 采用指数退避，base 2s / max 60s，并叠加 ±25% 抖动（在算出的间隔上加一点随机偏移，避免大量客户端同时重连）。

- **前端侧**每 3s 轮询一次 `cli-list-agents`，同时监听 `cli-agent-available/unavailable/cli-agents` 事件实时刷新。

## 故障排查

遇到问题可以按下表逐项检查。

| 现象 | 检查 |
|---|---|
| 配置页无法连接 | 服务器地址是否可达；CLI 是否保持运行（注册是内存态）；`-port` 是否被占用 |
| 代理列表为空 | CLI 的 `user` 与网页登录用户名是否一致；CLI 是否已完成 `cli-register` |
| 高画质仍失败 | Cookie 是否有效（网页端能看对应清晰度）；会员档是否被非会员保护回落；CLI 版本 ≥ 0.2.0 |
| 播放报 CORS | 代理 URL host 是否被规范为 127.0.0.1（旧版 CLI 会误报页面 host） |
