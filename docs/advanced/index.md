# 架构总览

## 进程与端口

```
浏览器（React SPA）
   │  HTTP REST + Socket.IO WebSocket
   ▼
后端（Express，端口 3333，统一入口）
   ├── REST 路由        /api/*        鉴权、房间、挂载、解析、音乐…
   ├── Socket.IO        /socket.io    房间实时同步（maxHttpBufferSize 20MB）
   ├── 静态托管          frontend/dist + SPA 回退
   ├── /live 反代       → Node Media Server（内部 3335）
   └── 内嵌 NCM 服务     127.0.0.1:36530~36535（一起听音乐）
RTMP 3334 → Node Media Server → FLV 3335（仅容器/本机内部）
```

- **单进程单端口**：生产模式所有流量走 3333（HTTP 与 HTTPS 二选一），后端统一处理 API、前端静态资源、WebSocket 与 `/live` 反代，无跨域问题。
- **RTMP 3334 独立端口**：RTMP 是 TCP 二进制协议，无法与 HTTP 复用端口；拉流走内部 3335，由后端 `/live` 路径反代对外，NMS 端口无需暴露。
- **内嵌 NCM 服务**：一起听音乐的网易云 API 服务由主后端进程内嵌启动，绑定 `127.0.0.1`（端口占用时 +1 重试，最多 5 次），见[一起听音乐管线](/advanced/music-pipeline)。

## Socket.IO 事件注册模型

后端所有实时事件经 `SocketRegistry`（`backend/src/modules/socket/event-handler.interface.ts`）统一注册：`io.on('connection')` 中依次调用 17 个事件 handler 的 `register(socket, io)`（`backend/src/index.ts`），每个 handler 只挂自己的事件名，ack 统一走 `safeAck` 包裹为 `{ success, message?, code?, data? }` 结构。新增实时能力时实现该接口即可，无需改动连接入口。

连接鉴权在 `io.use` 中间件完成（`backend/src/index.ts`）：

- `handshake.auth.agent === 'zcontrol-cli'` 直接放行并标记 `isCliAgent`（CLI 代理见 [ZViewerCLI 代理协议](/advanced/cli-protocol)）；
- 其余连接按 **cookie 头 → `handshake.auth.token` → `handshake.query.token`** 顺序取 JWT 校验，失败拒绝握手——WebSocket 与 REST 共用同一套身份体系。

## 状态分层：内存权威副本 + 数据库节流落盘

房间运行状态采用三层设计，这是理解同步行为的关键：

| 层 | 载体 | 特点 |
|---|---|---|
| 运行时权威副本 | `RoomRuntimeState`（内存 Map，`room-state.service.ts`） | 影片列表、当前影片、播放状态、字幕缓存；**读永远走这里** |
| 播放记忆 | `PlaybackMemoryService`（内存 + `PlaybackState` 表） | 状态写入节流 2s、心跳落盘节流 10s，进程退出前 `flushAllDirty()` 最多丢 2s |
| 持久化 | Room / Movie / PlaybackState / MusicQueueItem 等表 | 后端重启后 `initFromDb()` 恢复 |

推算公式贯穿全链路（`PlaybackState` 实体注释）：

```
actualCurrentTime = currentTime + (Date.now() - lastUpdatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
```

超过 duration 时收敛为 `currentTime = duration, isPlaying = false`。房主短暂断线时服务器凭这条公式继续外推状态，观众不中断；房主重连后从服务器取回状态继续担任同步源。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + TypeScript + Socket.IO |
| 数据库 | TypeORM + sql.js（wasm SQLite，无原生模块），可选 PostgreSQL |
| 流媒体 | Node Media Server（RTMP / HTTP-FLV） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端资源分发） |
| 音乐 | @neteasecloudmusicapienhanced/api（内嵌 HTTP 服务） |
| CLI | Go（独立仓库 ZViewerCLI） |

## 设计要点

- **无原生模块**：sql.js 是 wasm 实现，单文件版可在任意平台直接运行，不需要编译环境；服务器端 FFmpeg 已整体移除，音视频转码全部前置到浏览器。
- **配置集中**：全部状态（数据库、证书、上传、推流切片、JWT 密钥文件）在 `config/` 目录，更新不覆盖，备份这一个目录即可。
- **浏览器承担计算**：字幕提取（MKV 流式 demux）、容器重封装、音轨转码都在浏览器端完成，服务器只做转发与解析，带宽和 CPU 压力集中在必要的流上。
- **JWT 密钥自举**：环境变量 → `config/jwt-secrets.json` → 自动生成 64 位 hex 写回文件，三级兜底（`middleware/auth.ts` `loadOrCreateSecret`），首次启动零配置可用。
- **代理统一出口**：媒体代理、`/live` 反代、音频代理共用 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`），统一处理 Range 有界分片、条件请求、断连销毁与流量日志。

## 分区导航

- [房间同步逻辑](/advanced/sync)
- [视频源与 API 获取逻辑](/advanced/video-pipeline)
- [一起听音乐管线](/advanced/music-pipeline)
- [ZViewerCLI 代理协议](/advanced/cli-protocol)
- [主题系统实现](/advanced/theme-system)
- [鉴权与权限模型](/advanced/auth)
- [REST API 参考](/advanced/api)
- [环境变量](/advanced/env)
- [构建与更新机制](/advanced/build-update)
