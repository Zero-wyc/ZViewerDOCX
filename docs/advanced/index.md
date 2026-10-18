# 架构总览

本页说明整体架构：进程与端口划分、实时事件注册、房间状态分层，以及贯穿全局的设计取舍。各子系统细节见文末分区导航。

## 进程与端口

单进程架构：一个 Node.js 进程同时承担 API、前端静态资源与实时通信。

```
浏览器（React SPA）
   │  HTTP REST + Socket.IO WebSocket
   ▼
后端（Express，端口 3333，统一入口）
   ├── REST 路由        /api/*        鉴权、房间、挂载、解析、音乐…
   ├── Socket.IO        /socket.io    房间实时同步（maxHttpBufferSize 20MB）
   ├── 静态托管          frontend/dist + SPA 回退
   ├── /live 反代       → Node Media Server（内部 3335）
   ├── /rtc 反代        → livekit-server（内部 3336，语音信令）
   └── 内嵌 NCM 服务     127.0.0.1:36530~36535（一起听音乐）
RTMP 3334 → Node Media Server → FLV 3335（仅容器/本机内部）
媒体 3333/udp → livekit-server（语音；TCP 模式另开 3337/tcp）
```

- **单端口 3333**：生产模式所有流量走 3333（HTTP 或 HTTPS），API、静态资源、WebSocket、`/live` 与 `/rtc` 反代统一在此，无跨域问题。
- **RTMP 3334 独立**：RTMP 无法与 HTTP 复用端口。拉流走内部 3335，由 `/live` 反代对外，NMS 端口无需暴露。
- **内嵌 NCM 服务**：一起听依赖的网易云 API，随主进程内嵌启动并绑定 `127.0.0.1`；端口被占用时 +1 重试，最多 5 次。见[一起听音乐管线](/advanced/music-pipeline)。
- **livekit-server 伴生进程**：语音媒体由独立 LiveKit 承载，主后端只签发凭证与执行管理动作。媒体走 3333/udp，信令经 `/rtc` 反代；传输模式（UDP/TCP）可在管理端切换并热重启语音服务。见[语音聊天链路](/advanced/voice)。

## Socket.IO 事件注册模型

所有实时事件经 `SocketRegistry`（`backend/src/modules/socket/event-handler.interface.ts`）注册：`io.on('connection')` 中依次调用 20 个 handler 的 `register(socket, io)`（`backend/src/index.ts`），每个 handler 只挂自己的事件名。ack 统一由 `safeAck` 包裹为 `{ success, message?, code?, data? }`。新增实时能力只需实现该接口，无需改连接入口。

连接鉴权在 `io.use` 中间件完成，JWT 取用分两种：

- `handshake.auth.agent === 'zcontrol-cli'` 直接放行并标记 `isCliAgent`，见 [CLI 代理协议](/advanced/cli-protocol)。
- 其余按 **cookie 头 → `handshake.auth.token` → `handshake.query.token`** 顺序校验，失败拒绝握手。

## 状态分层：内存权威副本 + 数据库节流落盘

读写分离：读永远命中内存，写库按节流压缩。

| 层 | 载体 | 特点 |
|---|---|---|
| 运行时权威副本 | `RoomRuntimeState`（内存 Map，`room-state.service.ts`） | 影片列表、当前影片、播放状态、字幕缓存；**读永远走内存** |
| 播放记忆 | `PlaybackMemoryService`（内存 + `PlaybackState` 表） | 状态写入节流 2s、心跳落盘节流 10s；退出前 `flushAllDirty()`，最多丢 2s |
| 持久化 | Room / Movie / PlaybackState / MusicQueueItem 等表 | 重启后 `initFromDb()` 恢复 |

播放进度靠一条推算公式（`PlaybackState` 实体注释）：

```
actualCurrentTime = currentTime + (Date.now() - lastUpdatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
```

超过 duration 时收敛为 `currentTime = duration, isPlaying = false`。房主短暂断线时服务器凭此继续推算，观众不中断；房主重连后取回状态继续担任同步源。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + TypeScript + Socket.IO |
| 数据库 | TypeORM + sql.js（wasm SQLite，无原生模块），可选 PostgreSQL |
| 流媒体 | Node Media Server（RTMP / HTTP-FLV） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端分发） |
| 语音 | LiveKit（livekit-server 伴生进程，WebRTC） |
| 音乐 | @neteasecloudmusicapienhanced/api（内嵌 HTTP 服务） |
| CLI | Go（独立仓库 ZViewer CLI） |

## 设计取舍

- **无原生模块**：sql.js 为 wasm 实现，单文件版任意平台可直接运行；服务器端 FFmpeg 已移除，转码全部前置到浏览器。
- **配置集中**：数据库、证书、上传、切片、JWT 密钥文件都在 `config/`，更新不覆盖，备份这一个目录即可。
- **计算放浏览器**：字幕提取、容器重封装、音轨转码均在浏览器完成，服务器只做转发与解析。
- **JWT 密钥自举**：按「环境变量 → `config/jwt-secrets.json` → 自动生成 64 位 hex 写回」三级回退（`middleware/auth.ts` `loadOrCreateSecret`），首次启动无需配置。
- **代理统一出口**：媒体代理、`/live` 反代、音频代理共用 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`），统一处理 Range 分片、条件请求、断连销毁与流量日志。

## 分区导航

[房间同步](/advanced/sync) · [语音链路](/advanced/voice) · [视频源与 API](/advanced/video-pipeline) · [音乐管线](/advanced/music-pipeline) · [CLI 代理协议](/advanced/cli-protocol) · [主题系统](/advanced/theme-system) · [HTTPS 证书](/advanced/https) · [鉴权与权限](/advanced/auth) · [REST API](/advanced/api) · [环境变量](/advanced/env) · [构建与更新](/advanced/build-update)
