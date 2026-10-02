# 架构总览

本页说明 ZViewer 的整体架构：进程与端口怎么划分、实时事件怎么注册、房间状态怎么分层存放，以及架构上做了哪些取舍。各子系统的实现细节，见本页末尾的「分区导航」一节。

## 进程与端口

ZViewer 采用单进程架构，一个 Node.js 进程同时承担 API、前端静态资源和实时通信。浏览器、主后端与各内部服务之间的连接关系见第一个代码块。

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

三处端口的职责划分如下。

- **单进程单端口**：生产模式所有流量走 3333（HTTP 与 HTTPS 二选一）。后端统一处理 API、前端静态资源、WebSocket 与 `/live` 反代，因此没有跨域问题。
- **RTMP 3334 独立端口**：RTMP（Real-Time Messaging Protocol，推流用的 TCP 二进制协议）无法与 HTTP 复用端口，只能单独占用一个。拉流走内部 3335，由后端 `/live` 路径反代对外，Node Media Server 的端口无需暴露。
- **内嵌 NCM 服务**：一起听音乐依赖的网易云 API 服务，由主后端进程内嵌启动，绑定 `127.0.0.1`；端口被占用时端口号 +1 重试，最多 5 次。详见[一起听音乐管线](/advanced/music-pipeline)。

## Socket.IO 事件注册模型

Socket.IO 是服务端与浏览器之间的双向实时通道，房间同步的绝大多数事件都经它传输。这一节说明事件在哪里注册，以及连接建立时如何鉴权。

后端所有实时事件经 `SocketRegistry`（`backend/src/modules/socket/event-handler.interface.ts`）统一注册。`io.on('connection')` 中依次调用 20 个事件 handler 的 `register(socket, io)`（`backend/src/index.ts`），每个 handler 只挂自己的事件名。ack（客户端发起请求时传入的回调函数，服务端用它回传执行结果）统一由 `safeAck` 包裹为 `{ success, message?, code?, data? }` 结构。要新增实时能力，实现该接口即可，无需改动连接入口。

连接鉴权在 `io.use` 中间件完成（`backend/src/index.ts`），JWT（JSON Web Token，登录后签发的身份令牌）的取用分两种情况：

- `handshake.auth.agent === 'zcontrol-cli'` 的连接直接放行，并标记 `isCliAgent`。CLI 代理的角色见 [ZViewerCLI 代理协议](/advanced/cli-protocol)。
- 其余连接按 **cookie 头 → `handshake.auth.token` → `handshake.query.token`** 的顺序取 JWT 校验，失败则拒绝握手。WebSocket 与 REST 共用同一套身份体系。

## 状态分层：内存权威副本 + 数据库节流落盘

房间运行状态并不全部放在数据库里，而是分三层：内存里保留一份权威副本，数据库只做节流落盘。这样安排是为了让读操作永远命中内存，同时把写库次数压到最低。三层各自的载体与特点如下表。

| 层 | 载体 | 特点 |
|---|---|---|
| 运行时权威副本 | `RoomRuntimeState`（内存 Map，`room-state.service.ts`） | 影片列表、当前影片、播放状态、字幕缓存；**读永远走内存副本** |
| 播放记忆 | `PlaybackMemoryService`（内存 + `PlaybackState` 表） | 状态写入节流 2s、心跳落盘节流 10s，进程退出前 `flushAllDirty()` 最多丢 2s |
| 持久化 | Room / Movie / PlaybackState / MusicQueueItem 等表 | 后端重启后 `initFromDb()` 恢复 |

这套分层能成立，靠的是一条贯穿全链路的推算公式（`PlaybackState` 实体注释）：

```
actualCurrentTime = currentTime + (Date.now() - lastUpdatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
```

超过 duration 时收敛为 `currentTime = duration, isPlaying = false`。房主短暂断线时，服务器凭这条公式继续推算播放进度，观众端不中断；房主重连后从服务器取回状态，继续担任同步源。

## 技术栈

下表列出各层使用的技术。

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + TypeScript + Socket.IO |
| 数据库 | TypeORM + sql.js（wasm SQLite，无原生模块），可选 PostgreSQL |
| 流媒体 | Node Media Server（RTMP / HTTP-FLV） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端资源分发） |
| 音乐 | @neteasecloudmusicapienhanced/api（内嵌 HTTP 服务） |
| CLI | Go（独立仓库 ZViewerCLI） |

## 贯穿全局的设计取舍

以下几项取舍贯穿整个项目。它们不是某一处的局部实现，而是决定了很多具体做法为什么长成现在这样。

- **无原生模块**：sql.js 是 wasm（WebAssembly，可以脱离原生编译环境运行的字节码）实现，单文件版在任意平台都能直接运行，不需要编译环境。服务器端 FFmpeg 已整体移除，音视频转码全部前置到浏览器。
- **配置集中**：数据库、证书、上传、推流切片、JWT 密钥文件全部放在 `config/` 目录；更新不覆盖，备份这一个目录即可。
- **浏览器承担计算**：字幕提取（MKV 流式 demux，即分离容器中的音视频与字幕轨道）、容器重封装、音轨转码都在浏览器端完成。服务器只做转发与解析，带宽和 CPU 压力集中在必要的流上。
- **JWT 密钥自举**：密钥按「环境变量 → `config/jwt-secrets.json` → 自动生成 64 位 hex 写回文件」三级回退获取（`middleware/auth.ts` `loadOrCreateSecret`），首次启动无需配置。
- **代理统一出口**：媒体代理、`/live` 反代、音频代理共用 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`），统一处理 Range 有界分片、条件请求、断连销毁与流量日志。

## 分区导航

以下页面按子系统展开各自的实现细节。

- [房间同步逻辑](/advanced/sync)
- [视频源与 API 获取逻辑](/advanced/video-pipeline)
- [一起听音乐管线](/advanced/music-pipeline)
- [ZViewerCLI 代理协议](/advanced/cli-protocol)
- [主题系统实现](/advanced/theme-system)
- [HTTPS 证书](/advanced/https)
- [鉴权与权限模型](/advanced/auth)
- [REST API 参考](/advanced/api)
- [环境变量](/advanced/env)
- [构建与更新机制](/advanced/build-update)
