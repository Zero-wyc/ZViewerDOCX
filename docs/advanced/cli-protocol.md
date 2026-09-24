# ZViewerCLI 代理协议

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)（Go，独立仓库）通过 Socket.IO 与服务器通信，为浏览器补上**本地 Bilibili Cookie** 与流代理能力——Cookie 只存在用户本机，不经服务器。

## 注册流程（v0.2.0 去房间化）

1. CLI 启动后携带 Engine.IO 握手参数 `{"agent":"zcontrol-cli"}` 建立 WebSocket。`io.use` 中间件据此直接放行并标记 `isCliAgent`，绕过通用 access_token 校验。
2. 发送 `cli-register` 事件，payload：

```json
{
  "proxyUrl": "http://127.0.0.1:9333",
  "agent": "zviewer-cli",
  "version": "0.2.0",
  "user": "用户名"
}
```

3. 服务端只校验必填的 `proxyUrl`，**忽略任何房间号**（`roomId` 仅作旧版兼容字段保留）；同时用 `normalizeLocalCliProxyUrl` 把 hostname **强制改写为 `127.0.0.1`**（保留端口/路径），防止旧版 CLI 误报页面 host 导致前端 CORS 失败。
4. CLI 被记入专用房间 `__cli-agents__`（仅为聚合查询便利，语义上是全局注册），回 `cli-registered`，并 `io.emit('cli-agent-available', agentInfo)` **全局广播**；未持 `isCliAgent` 或缺少 proxyUrl 时回 `cli-error`。
5. 断连时全局广播 `cli-agent-unavailable {socketId}`；`cli-list-agents`（参数可省）经 `io.in('__cli-agents__').fetchSockets()` 聚合返回。

## 关键语义

- **一个 CLI 对服务器上所有房间可用**。房间内的 CLI 功能开关（音乐视频高画质 `musicVideoCli` / `cliEnabled`）打开即自动使用，没有"逐房间连接"的概念。
- **user 归属过滤**：前端 `useCliAgent()` 无参调用，内部按 `authStore` 的登录用户名过滤——仅保留 `!a.user || a.user === username`（不带 `user` 的旧版 CLI 视为公共代理，全员可见），过滤后才写入 cliAgentStore，因此 store 里只有"我的"代理，`getActiveCliProxyUrl` 直接取 `agents[0].proxyUrl`。
- **配置是内存态**：CLI 重启后 `serverUrl` / `user` 丢失（仅 Cookie 持久化在 `~/.zviewer/config.json`），需从网页端配置页重新带入。
- 可用性判定 `available = agents.length > 0`——**不再强制要求本地健康检查通过**（健康检查可能因 CORS 失败但实际 HTTP 服务可用）。健康检查仅在 http 本地页面执行（5s 轮询 `/health`），https 页面跳过。

## 本地代理与解析

CLI 本地 HTTP 服务默认绑定 `127.0.0.1:9333`（`-port` 可改），路由：`/health`、`/api/config`、`/api/qr`、`/api/qr/poll`（B站扫码登录）、`/api/connect`、`/api/disconnect`、`/api/bili-info`、`/api/dash-mpd`、`/resolve`、`/proxy`。

```
浏览器 <video>/<audio>
   │  http://127.0.0.1:9333/proxy?url=...
   ▼
ZViewerCLI 本地 HTTP 代理
   │  注入本地 Bilibili Cookie + Referer / Origin / User-Agent
   ▼
Bilibili CDN（up to 大会员档位）
```

- **DASH 优先**：已连接 CLI 的高画质模式强制 `forceDash`（禁用 MP4 降级），音视频 m4s 分离；`/resolve` 同时返回原始 CDN URL（供 `/api/dash-mpd` 生成 MPD 喂 MSE）与重写为本地代理的 URL。
- **CDN 兜底重试**：`/proxy` 主 URL 失败时按解析期缓存的 `backupUrl` 候选依次重试；透传 Range；B站 CDN 偶发返回 `application/json` 的视频数据时纠正为 `video/mp4`；上游超时 60s，连接池 `MaxIdleConns=100 / PerHost=20`。
- **清晰度**：qn 档位 127(8K)/126(杜比)/125(HDR)/120(4K)/116/112/80/74/64/32/16；`fnval = 16 | (VIP ? 128 : 0)`，qn=127 追加 8K 标志位；会员档白名单 `[112,116,120,125,126,127]`。MP4 直链上限 1080P（`mp4MaxQn=80`）。
- **后端侧 `/api/cli/resolve`**：供 CLI 用**用户请求头自带的 B站 Cookie** 解析（需含 SESSDATA），`skipCdnCheck: true`——实际视频流由用户本机浏览器→CLI 拉取，服务器无需校验 CDN 可达性，避免远程网络差异导致错误降级。
- **非会员保护**：前端开启 CLI 且代理在线时查询会员状态，非会员且已选会员档（qn > 80）自动回落 0（跟随账号默认）。
- 解析结果缓存：音频直链 2 小时 TTL；VIP 状态缓存 5 分钟。

## 前端接入点

| 场景 | 行为 |
|---|---|
| 音乐视频背景 | `useMusicVideoBackground`：CLI 在线 → CLI 高画质 DASH；否则回退服务器 720P MP4 |
| 音乐音源 | `resolveBiliAudio`：CLI 开启且在线 → CLI DASH 音轨；否则服务器代理 MP4 |
| 一起看影片 | 房间开关 `cliEnabled` 打开时可用；`hostCliEnabled` 会经同步状态广播给观众（强制走 MP4 路径） |
| 配置页入口 | `openCliSetup()` 打开 `http://127.0.0.1:9333/?server=<api>&user=<username>`；CLI 侧读取参数预填，连接时用 POST `/api/connect` 上报 |

## 断线重连与心跳

- CLI 侧：服务器主导 ping/pong；`lastActivityAt` 超过 `pingInterval + pingTimeout`（下限 45s）强制重连；`reconnectLoop` 指数退避 base 2s / max 60s + ±25% 抖动。
- 前端侧：3s 轮询 `cli-list-agents` + 监听 `cli-agent-available/unavailable/cli-agents` 事件实时刷新。

## 排查

| 现象 | 检查 |
|---|---|
| 配置页连不上 | 服务器地址是否可达；CLI 是否保持运行（注册是内存态）；`-port` 是否被占用 |
| 代理列表为空 | CLI 的 `user` 与网页登录用户名是否一致；CLI 是否已完成 `cli-register` |
| 高画质仍失败 | Cookie 是否有效（网页端能看对应清晰度）；会员档是否被非会员保护回落；CLI 版本 ≥ 0.2.0 |
| 播放报 CORS | 代理 URL host 是否被规范为 127.0.0.1（旧版 CLI 会误报页面 host） |
