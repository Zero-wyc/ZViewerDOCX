# ZViewer CLI 代理协议

[ZViewer CLI](https://github.com/Zero-wyc/ZViewerCLI) 是 Go 编写的独立仓库，通过 Socket.IO 与服务器通信，为浏览器提供两项能力：使用本机 Bilibili Cookie，以及经本机代理转发媒体流。Cookie 只保存在用户本机，不经过服务器。

## 注册流程（v0.2.0 去房间化）

1. CLI 启动时携带 Engine.IO 握手参数 `{"agent":"zcontrol-cli"}` 建立 WebSocket。`io.use` 中间件看到该参数直接放行并标记 `isCliAgent`，绕过通用 access_token 校验。
2. 连接后发送 `cli-register`：

```json
{
  "proxyUrl": "http://127.0.0.1:9333",
  "agent": "zviewer-cli",
  "version": "0.2.0",
  "user": "用户名"
}
```

3. 服务端只校验必填的 `proxyUrl`，**忽略任何房间号**（`roomId` 仅为兼容旧版保留）。同时用 `normalizeLocalCliProxyUrl` 把 hostname **强制改写为 `127.0.0.1`**（端口与路径不变），避免旧版 CLI 误报页面 host 导致前端 CORS 失败。
4. CLI 记入专用房间 `__cli-agents__`（仅为聚合查询方便，语义上等于全局注册），回 `cli-registered` 并 `io.emit('cli-agent-available', agentInfo)` 全局广播。缺少 `isCliAgent` 标记或 proxyUrl 时回 `cli-error`。
5. 断连时全局广播 `cli-agent-unavailable {socketId}`。`cli-list-agents`（参数可省略）经 `io.in('__cli-agents__').fetchSockets()` 聚合返回。

## 作用范围与可用性

- **一个 CLI 对所有房间可用**：房间开关（`musicVideoCli` / `cliEnabled`）打开后自动使用，不存在「每房间各连一个 CLI」。
- **按 user 过滤归属**：`useCliAgent()` 内部按 `authStore` 中的登录用户名过滤，只保留 `!a.user || a.user === username` 的代理；不带 `user` 的旧版 CLI 视为公共代理。过滤后才写入 `cliAgentStore`，`getActiveCliProxyUrl` 直接取 `agents[0].proxyUrl`。
- **配置只在内存**：CLI 重启后 `serverUrl` 与 `user` 丢失，只有 Cookie 持久化在 `~/.zviewer/config.json`，需从网页端配置页重新带入。
- **可用性只看是否有代理注册**：`available = agents.length > 0`，不强制本地健康检查通过（健康检查可能因 CORS 失败而实际服务可用）。健康检查仅在 http 本地页面每 5s 轮询 `/health`，https 页面跳过。

## 本地代理与解析

CLI 在本机启动 HTTP 服务，默认 `127.0.0.1:9333`（`-port` 可改），路由：`/health`、`/api/config`、`/api/qr`、`/api/qr/poll`、`/api/connect`、`/api/disconnect`、`/api/bili-info`、`/api/dash-mpd`、`/resolve`、`/proxy`。

```
浏览器 <video>/<audio>
   │  http://127.0.0.1:9333/proxy?url=...
   ▼
ZViewer CLI 本地 HTTP 代理   注入本地 Cookie + Referer / Origin / User-Agent
   ▼
Bilibili CDN（最高大会员档位）
```

- **优先 DASH**：已连接的高画质模式强制 `forceDash`，禁用 MP4 降级，音视频以 m4s 分离。`/resolve` 同时返回原始 CDN URL（供 `/api/dash-mpd` 生成 MPD 喂给 MSE）与重写为本地代理的 URL。
- **主地址失败切备用 CDN**：`/proxy` 请求主 URL 失败后按解析期缓存的 `backupUrl` 依次重试；透传 Range；B站 CDN 偶尔返回 `application/json` 的视频数据，纠正为 `video/mp4`；上游超时 60s，连接池 `MaxIdleConns=100 / PerHost=20`。
- **清晰度档位**：`qn` 取值 127(8K) / 126(杜比) / 125(HDR) / 120(4K) / 116 / 112 / 80 / 74 / 64 / 32 / 16。请求参数 `fnval = 16 | (VIP ? 128 : 0)`，qn=127 时追加 8K 标志位；会员档白名单 `[112,116,120,125,126,127]`。MP4 直链最高 1080P（`mp4MaxQn=80`）。
- **服务端 `/api/cli/resolve`**：用 CLI 请求头自带的 B站 Cookie 解析（需含 SESSDATA），设 `skipCdnCheck: true`——实际媒体由本机浏览器经 CLI 拉取，无需服务端校验 CDN 可达性，避免远程网络差异造成错误降级。
- **服务器解析锚定房主 Cookie**：所有服务器侧解析（含观众 CLI 未连接时的 MP4 兜底）默认以影片所属房间**房主的 B站 Cookie 身份**执行，房主为大会员时会员内容全房间可拿完整地址；`useHostCookie: false` 可退回请求者身份。成员走本地 CLI 时不受影响，CLI 始终用观众自己的 Cookie。
- **非会员档位保护**：CLI 在线时查询会员状态，非会员选了会员档（qn > 80）自动回落到 0（跟随账号默认档）。

缓存：音频直链 TTL 2 小时，VIP 状态 5 分钟。

## 前端接入点

| 场景 | 行为 |
|---|---|
| 音乐视频背景 | `useMusicVideoBackground`：CLI 在线 → CLI 高画质 DASH；否则服务器 720P MP4 |
| 音乐音源 | `resolveBiliAudio`：CLI 开启且在线 → CLI DASH 音轨；否则服务器代理 MP4 |
| 一起看影片 | 房间开关 `cliEnabled` 打开时可用；`hostCliEnabled` 经同步状态广播给观众（强制走 MP4 路径） |
| 配置页入口 | `openCliSetup()` 打开 `http://127.0.0.1:9333/?server=<api>&user=<username>`，CLI 读取参数预填，连接时 POST `/api/connect` 上报 |

## 断线重连与心跳

- **CLI 侧**由服务器主导 ping/pong：`lastActivityAt` 超过 `pingInterval + pingTimeout`（下限 45s）时强制重连；`reconnectLoop` 指数退避，base 2s / max 60s，叠加 ±25% 抖动。
- **前端侧**每 3s 轮询 `cli-list-agents`，同时监听 `cli-agent-available/unavailable/cli-agents` 实时刷新。

## 故障排查

| 现象 | 检查 |
|---|---|
| 配置页无法连接 | 服务器地址可达性；CLI 是否仍运行（注册是内存态）；`-port` 是否被占用 |
| 代理列表为空 | CLI 的 `user` 与网页登录用户名是否一致；是否完成 `cli-register` |
| 高画质仍失败 | Cookie 是否有效；会员档是否被非会员保护回落；CLI 版本 ≥ 0.2.0 |
| 播放报 CORS | 代理 URL host 是否规范为 127.0.0.1（旧版 CLI 会误报页面 host） |
