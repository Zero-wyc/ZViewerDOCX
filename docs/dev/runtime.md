# 运行流程

本页先讲后端和前端的启动顺序，再逐一走一遍五条主要链路。文中标注的代码位置精确到文件。

---

## 后端启动与初始化

后端从进程启动到开始监听端口，依次经过下表这些阶段。这些阶段有固定顺序，每一步都依赖前一步的结果。各阶段的行为与代码位置如下。

| 阶段 | 行为 | 代码位置 |
|---|---|---|
| 环境准备 | `dotenv.config()` 装载 `.env` | `index.ts` 顶部 |
| 数据迁移 | `migrateLegacyDataIfNeeded()`：`backend/dev.sqlite`、`backend/uploads/` → `config/`；失败仅告警，不阻断启动 | `services/paths.ts` |
| 目录与文件 | `ensureDataDirs()` 建 `config/`、`uploads/`、`avatars/`、`media/`；`ensureDatabaseFile()` 滚动备份 + 全零/损坏自愈 | `services/paths.ts`、`services/db-persistence.ts` |
| 数据库 | `AppDataSource.initialize()`（sqljs 驱动，`synchronize: true` 自动建表） | `data-source.ts` |
| 种子数据 | `seedRootAdmin()`：按 role 查找而非 username，避免 root 改名后重启又建一个超管 | `index.ts` |
| 状态恢复 | `roomStateService.initFromDb()` 遍历 `status='active'` 房间：恢复 movies、从 `PlaybackState` 恢复 `currentMovieId`、`playbackMemoryService.refreshCache()` | `modules/room/room-state.service.ts` |
| HTTP 装配 | `trust proxy` → `cors`（`credentials: true`）→ `express.json({ limit: '1mb' })` → `cookieParser` → 流量日志（`res.on('finish')` 记录 `/api/` 状态码与字节数）→ 路由 → 静态资源 | `index.ts` |
| 内嵌服务 | `startNcmApiService()`（绑 `127.0.0.1`，失败仅告警，音乐接口走 503 降级）；`nmsService.start(io)`（RTMP/FLV） | `modules/music/ncm-api.service.ts`、`modules/stream-push/nms.service.ts` |
| 实时层 | 创建 `SocketIOServer`（`maxHttpBufferSize: 20MB`，大字幕同步所需）→ 注入 io → 注册 20 个 handler → 挂 `io.on('connection')` | `index.ts` |
| 后台任务 | 无人房间清理（1h 周期 + 启动立即一次）；`playbackBroadcasterService.start(io)`（2s 服务器心跳 + 30s 陈旧缓存清理） | `index.ts`、`modules/playback-memory/playback-broadcaster.service.ts` |
| 监听 | `httpServer.listen({ port, host? })`，`EADDRINUSE` 明确提示后 `exit(1)` | `index.ts` |
| 优雅退出 | `SIGTERM`/`SIGINT` → `playbackMemoryService.flushAllDirty()`（最多丢 2s 脏数据）→ `stopNms()` → `stopNcmApiService()` → `exit(0)` | `index.ts` |

各步骤的先后顺序及其顺序约束见[后端架构 · 应用入口与装配顺序](/dev/backend#应用入口与装配顺序)。

---

## 前端启动与初始化

前端启动链路比后端短。`main.tsx` 先装日志和调试探针，再渲染根组件；`App.tsx` 接着做健康检查、拉取公开设置、启动鉴权引导，最后把控制权交给路由。

```
main.tsx
 ├─ initClientLogger()                # 控制台/异常上报通道
 ├─ installMediaDebugProbe()          # 可选媒体探针
 └─ render(<BrowserRouter><ThemeProvider><App/></ThemeProvider></BrowserRouter>)
      └─ App.tsx
           ├─ useBackendHealth()      # 重连后对比 /health.startedAt，检测后端自动重启
           ├─ fetchSettings()         # GET /api/auth/public-settings
           ├─ <AuthInitializer/>      # 鉴权引导（见「前端架构」）
           └─ <Routes/> → RequireAuth → RoomPage
                └─ useSocket()        # autoLoginStatus==='done' 才建连（全局单例）
```

`RoomPage` 挂载后按固定顺序做以下几件事（`modules/room/RoomPage.tsx`）。

1. `roomId` 变化时重置 `roomStore` 和弹幕 store。如果切换房间且旧房间的房主是本人，先 `emit('host-leave')`。然后设置 `activeRoomId` 和 `clientLoggerRoomId`，执行 `loadDanmakuTracks()` 与 `loadDanmakuMeta()`。
2. 注册 `room-closed` 和 `disconnect` 两个兜底监听。收到 `room-closed` 时调用 `dispatchRoomMediaTeardown(true)`，停止本机全部媒体流并退回 `/room`；收到 `disconnect` 时只暂停媒体，等重连后由同步流程恢复。
3. 注册 `danmaku-tracks-updated`、`danmaku-meta-updated`、`room-name-updated` 三个监听。
4. 先判断 `isHostOfRoom(roomId)`（依据 `sessionStorage['zcontrol-host-room']` 标记）。为真时调用 `emit('register-host', { roomId }, cb)`。回调完成后才 `setHostRegistered(true)`，这时才开始渲染 `WatchTogetherPanel`，确保 `useWatchTogether` 挂载时 `initialPlayback` 已经就绪。
5. 观众渲染 `WatchPage`（`modules/screen-sharing`），由它完成加入房间和模式切换。

---

## 链路一：创建房间 → 房主注册

房主在 `RoomPanel` 选择共享方案后，创建请求经 Socket 打到后端。后端建库、注册房主会话，前端再把房间号写进 `sessionStorage` 并跳转到房间页。

```
RoomPanel（选择共享方案）
  │ socket.emit('create-room', { name?, password?, maxViewers?, requireApproval?, mode? }, ack)
  ▼
RoomLifecycleHandler.register()            modules/room/handlers/room-lifecycle.handler.ts
  ├─ roomPermissionService.canCreateRoom(role, settings)   ← 依据系统设置 roomCreationMode
  ├─ 若当前 socket 已是其他房间的 sharer：结束旧 session + leave + 失效权限缓存
  ├─ 生成唯一 8 位 roomId（nanoid）+ bcrypt(cost 10) 加密密码
  ├─ roomRepo.save(Room)  →  lastAccessedAt = now
  ├─ roomSessionService.registerHost(socket, roomId, userId)
  │    ├─ socket.join(roomId)
  │    ├─ 复用或创建 Session{ role: 'sharer' }
  │    └─ playbackMemoryService.updateHostSocket(roomId, socket.id)
  └─ safeAck(callback, { success: true, data: { roomId, mode } })
  ▼
前端写入 sessionStorage['zcontrol-host-room'] = roomId → navigate(`/room/${roomId}`)
```

回调里所有 ack 都走 `AckResponse` 这一层统一结构，业务字段一律放在 `data` 里。前端 `register-host` 回调解析时按同一约定取值。

---

## 链路二：观众加入房间

观众发出 `request-join` 后，后端要做一连串校验，全部通过才让人进房间。需要房主审批的房间则先把申请转给房主，等房主决定。

```
观众 socket.emit('request-join', { roomId, password? }, ack)
  ▼
ViewerJoinHandler.register()               modules/viewer/handlers/viewer-join.handler.ts
  ├─ 房间存在且 status==='active'
  ├─ 重复加入检测（guest 跳过；「多页面同时登录」设置开启时跳过）
  ├─ 房主身份自恢复：ownerUserId === userId 或房间无 owner → registerHost 并广播 sharer-ready
  ├─ 密码校验 bcrypt.compare（root 免密）
  ├─ 人数上限校验 getViewerCount() >= maxViewers
  ├─ 房主在线校验：需审批房间要求房主在线；免审批房间允许房主离线 5 分钟内加入
  ├─ 免审批 / 已在 approvedViewers 白名单
  │    ├─ roomSessionService.admitViewer()（创建 viewer session + join room）
  │    ├─ 定向下发 join-approved / movie-list / current-movie
  │    ├─ sendCachedSubtitle()                    ← 补发房主最近一次 subtitle-update
  │    ├─ viewerListService.broadcastViewerJoined()   → 广播 viewer-joined
  │    ├─ viewerListService.sendExistingViewers()     → 给新观众补发其他在线观众
  │    └─ viewerListService.sendModerators()          → 推送房管列表（权限 UI 初始化）
  └─ 未批准：io.to(sharer.socketId).emit('join-request', { viewerSocketId })
     房主端 approve-join / reject-join → 批准后 userId 写入 approvedViewers 永久免审批
```

运行时状态（`roomStateService`）是唯一的读取源：影片列表与当前影片都直接从内存副本读取，不查数据库。`sendCachedSubtitle` 负责给中途加入的观众补发字幕。

---

## 链路三：播放同步（房主 → 服务器 → 观众）

播放同步链路分四段：房主采集并广播、服务器处理、观众对齐、房主离线后由服务器接管。

### ① 房主侧采集与广播

房主侧的同步逻辑拆成五个 Hook（React 里复用逻辑的函数，名字以 `use` 开头），都放在 `frontend/src/modules/sync-playback/hooks/`。

| Hook | 职责 | 关键参数 |
|---|---|---|
| `useVideoEventBindings` | 绑定 `play/pause`（防抖 100ms）、`seeked`（防抖 300ms）、`ratechange`（立即）；`timeupdate` 不广播 | `constants.ts` |
| `useHostBroadcast` | 与上次状态浅比较 → `computeStateDiff` → `emit('watch-together-state', { state, diff, seq })`；`sendControl()` 发 `watch-together-control` | `currentTime` 差 ≤ 2s 视为等价跳过 |
| `useHostHeartbeat` | 每 5s 发 `host-heartbeat`；事件抑制期发 `suppressed: true` 的存活心跳 | 抑制为计数式租约（5 分钟过期） |
| `useHostStateRequest` | 响应观众的 `watch-together-request-state` | — |
| `useHostSync` | 组合以上四个，对外暴露 `broadcastState / sendControl / forceSync` | — |

### ② 服务器侧处理

服务器由 `PlaybackMemoryHandler` 统一注册三个同步事件的处理函数。示意图中的注释标出了每一步的代码位置。

```
PlaybackMemoryHandler.register()          backend/src/modules/playback-memory/playback-memory.handler.ts
  watch-together-state
    ├─ roomPermissionService.isRoomHost(socket, roomId)      ← 校验活跃 sharer
    ├─ roomPermissionService.isWatchTogetherRoom(roomId)     ← 校验房间模式
    ├─ playbackMemoryService.setPlayback(roomId, state, socket.id)   ← 先持久化
    └─ socket.to(roomId).emit('watch-together-state', { state, diff, seq })  ← 再广播
  watch-together-control
    ├─ 权限 / 模式校验
    ├─ socket.to(roomId).emit('watch-together-control', { action, value })   ← 先广播（亚 500ms）
    └─ applyControlToPlayback()  ← 再持久化
         pause → 把 currentTime 凝固为推算值
         seek  → 只改时间，不改 isPlaying（否则观众端 seek 后暂停抖动）
         rate  → 先推算当前进度，再改倍速
  watch-together-request-state
    ├─ getAdvancedPlayback(roomId) → safeAck(callback, { success: true, data: { state } })
    └─ 无状态时 socket.to(roomId).emit('watch-together-request-state') 让房主主动同步
```

`watch-together-state` 和 `watch-together-control` 的落盘与广播顺序是反过来的，而且有意如此。`watch-together-state` 携带完整快照，属于权威数据，所以先写数据库再广播；`watch-together-control` 只是暂停、跳转这类离散操作，观众的即时感受更重要，所以先广播（一般 500 毫秒内到达）再写库。改这两处之前，先看 handler 里的注释。

### ③ 观众侧对齐

`useViewerSync` 组合三个子 Hook：一个只管离散字段，一个驱动进度心跳，一个负责首次拉取状态。三者的职责划分如下。

- `useViewerStateSync` 只处理离散字段。`sourceUrl` 变化才重建播放流，并以 `state.currentTime` 为起点；`isPlaying` 变化才 play/pause；`playbackRate` 变化才设倍速；`currentTime` 不随状态事件设置。seq 跳号（`payload.seq > lastSeq + 1`）时丢弃增量，改为请求全量自愈。
- `useViewerHeartbeat` 驱动进度，采用两阶段策略（`services/seek-strategy.ts`）：差值 ≤ `max(3s, rate × 0.5)` 直接忽略；≤ 6s 走软同步，把倍速提到 `baseRate + 0.1`，封顶 2.0；> 6s 走硬 seek。
- `usePlaybackStateRequest`（`modules/playback-memory`）在观众加入时从服务器取推算后的初始状态，不依赖房主响应。取到后写入 `lastAppliedSourceUrlRef`，避免后续同源 state 重复 attach，覆盖已经缓冲的 blob 源。

seek 的统一入口是 `services/seek-service.ts` 的 `executeSeek`。目标在缓冲区内或缺口 ≤ 10s 时走普通 seek，否则走 MSE Range seek（MSE 即 Media Source Extensions，用分段请求的方式跳转，不重建 MediaSource）。结束后补发一个合成的 `seeked` 事件，保证外推基线保持新鲜。

### ④ 房主离线后服务器接管

房主掉线后，服务器用两组定时器接管进度广播：每 2 秒广播一次，每 30 秒清理一次陈旧缓存。

```
setInterval(2s) → broadcastAll()
  for roomId of playbackMemoryService.getActiveRoomIds():
    if (playbackMemoryService.isHostOnline(roomId)) continue   ← 房主在线则跳过
    if (房间内无 socket) continue
    state = await playbackMemoryService.getAdvancedPlayback(roomId)
    io.to(roomId).emit('server-heartbeat',   { roomId, state })
    io.to(roomId).emit('sync-heartbeat',     { source: 'server', state })   ← 统一心跳协议

setInterval(30s) → cleanupStaleCache() + roomStateService.cleanupStaleStates()
```

`isHostOnline()` 用两个条件一起判断，缺一不可：`hostSocketId` 不为空，并且这个 id 还存在于 `io.sockets.sockets` 中。只看前者会出问题——后端重启后旧 socket id 仍留在数据库里，服务器会误以为房主在线，于是永远不接管心跳。

前后端同步协议的完整事件清单与常量表见[房间同步逻辑](/advanced/sync)。

---

## 链路四：添加影片（REST 写 → Socket 广播）

添加影片先走 REST 写库，再通过 Socket 把新列表广播给房间内的所有人。

```
MoviePushPanel → roomStore.addMovie()
  │ POST /api/rooms/:roomId/movies   （apiFetch，自动带 cookie / Bearer）
  ▼
createMovieRouter()                       modules/movie/movie.routes.ts
  ├─ authenticateToken
  ├─ canControlRoom(req, room)：root 或 room.ownerUserId === userId
  ├─ webdav / openlist：从 UserMount 按 userId + serverUrl 自动补全凭证（前端拿不到密码）
  ├─ 内网地址判定：isInternalOpenListServer() 命中则强制 directLink = false
  ├─ movieService.createMovie(roomId, data)
  └─ movieBroadcasterService.broadcastMovieList(io, roomId)
       ├─ movieService.listMovies(roomId)          ← 查 DB
       ├─ roomStateService.setMovies(roomId, …)    ← 同步内存副本
       ├─ 当前影片已不在列表 → setCurrentMovie(null) + emit('current-movie', { movieId: null })
       └─ io.to(roomId).emit('movie-list', { movies })
  ▼
前端 useWatchTogether 监听 SOCKET_EVENT.MOVIE_LIST → store.setMovies()
  （roomStore.addMovie 只把新影片返回给调用方用于持久化解析偏好，不改列表）
```

这条链路的模式是「DB 为真源 → 同步内存副本 → 广播 → 前端镜像」。新增其他列表类数据（弹幕轨道、房管列表、音乐队列）时，按同一模式实现即可。

---

## 链路五：视频源解析与播放

房主点选影片后，前端要先解析出可播放的视频源，再交给播放引擎。观众侧收到房主广播的状态后，走同一套引擎选择和附加流程。

```
房主点选影片 → useWatchTogether.loadMovie()
  ├─ 按 sourceType 解析：B站走 NDJSON 流式解析（/api/stream/resolve-bilibili）
  │     ResolveProgress → { videoUrl, audioUrl, format, videoCodec, audioCodec, currentQn, acceptQuality }
  ├─ 得到 WatchTogetherState（含 sourceUrl / audioUrl / format / codecs）
  ▼
useVideoSource（sync-playback）→ usePlayerSource（player）
  ├─ selectEngine(source) → 引擎实例
  ├─ engine.attach(video, source) → EngineAttachResult { cleanup, blobUrl?, player? }
  └─ 播放期错误 → options.onPlaybackError；401/403 且源在本站 /api/ → refresh 后重试
  ▼
useHostBroadcast 把新 state 广播 → 观众 useViewerStateSync 收到 sourceUrl 变化 → 同样走 selectEngine + attach
```

解析链的完整细节（WBI 签名、清晰度矩阵、CDN 竞速、代理白名单）见[视频源与 API 获取逻辑](/advanced/video-pipeline)。

---

## 房间生命周期与清理

一个房间从创建到被删除，会经历房主暂离、重连、超时关房、主动关房等阶段。各阶段的触发条件、行为与代码位置如下。

| 阶段 | 触发 | 行为 | 代码位置 |
|---|---|---|---|
| 房主暂离 | `host-leave` | 结束 sharer session、`updateHostSocket(roomId, null)`、广播 `host-disconnected`、启动 10 分钟重连定时器、socket leave（不断连） | `modules/room/handlers/room-lifecycle.handler.ts` |
| 重连 | `register-host` | 复用 session、`socket.join`、恢复 `hostSocketId`、返回推算后的 playback | `modules/room/room-session.service.ts` |
| 超时关房 | 重连定时器（10 分钟） | `closeRoomAndNotify()`：`status='closed'` → 结束 sessions → 失效权限缓存 → 广播 `room-closed` → 清运行时状态与播放记忆 → 踢出其他 socket | `modules/room/room-state.service.ts` |
| 主动关房 | `close-room` / `admin-close-room` | 同上，且房主 socket 自身 leave | `modules/room/handlers/room-lifecycle.handler.ts` |
| 无人清理 | 每 1h | `cleanupInactiveRooms()` → `deleteRoomAndRelations()`（删除顺序受外键约束：`PlaybackState` 必须先于 `Room` 删除） | `backend/src/index.ts` |
| 陈旧缓存 | 每 30s | `cleanupStaleCache()` + `cleanupStaleStates()`（房主离线且超 10 分钟） | `modules/playback-memory/playback-broadcaster.service.ts` |

`closeRoomAndNotify` 和 `deleteRoomAndRelations` 遵循同一条约束：先广播 `room-closed`，再断开 socket。如果只断连不广播，客户端会自动重连并继续播放，浏览器持续请求媒体分片，服务端持续代理上游流量，结果就是房间已经删除但流量仍在运行。

---

## 数据流转总览

下表汇总每条链路的数据来源、权威读取源、广播事件和持久化位置。

| 数据 | 写入路径 | 权威读取源 | 广播事件 | 持久化 |
|---|---|---|---|---|
| 影片列表 | REST（SQLite 直写） | 内存副本 → 广播 | `movie-list` | `Movie` 表 |
| 当前影片 | Socket / REST | 内存副本 + `PlaybackState.currentMovieId` | `current-movie` | `PlaybackState` |
| 播放状态 | Socket（房主 state/control） | `PlaybackMemoryService` 内存（推算） | `watch-together-state` / `watch-together-control` | `PlaybackState`（最多每 2 秒写一次） |
| 播放进度基线 | Socket 心跳（5s） | 同上（最多每 10 秒落盘一次） | `host-heartbeat` / `sync-heartbeat` | `PlaybackState.lastUpdatedAt` |
| 房主离线进度 | 服务器推算（2s） | `PlaybackMemoryService` | `server-heartbeat` / `sync-heartbeat(source:'server')` | 无（仅内存推算） |
| 字幕轨道 | Socket（房主广播） | `RoomRuntimeState.subtitle` 缓存 | `subtitle-update` | 不落盘（供观众补发） |
| 弹幕轨道 | REST + Socket | `DanmakuTrack` 表 | `danmaku-tracks-updated` | `DanmakuTrack` |
| 弹幕辅助数据 | REST + Socket | `RoomDanmakuMeta` 表 | `danmaku-meta-updated` | `RoomDanmakuMeta` |
| 成员 / 房管 | Socket | `Session` 表 + `Room.moderators` | `viewer-joined` / `viewer-left` / `moderators-changed` | `Session` / `Room` |
| 音乐队列 | Socket + REST | `MusicQueueItem` 表（单表双源） | 音乐同步事件组 | `MusicQueueItem` |

有一条通用约束：广播的数据一律来自后端权威副本（内存或数据库），前端的 store 只是镜像。多端一致性由这条约束保证，房主刷新、观众中途加入、服务器重启三个场景都有确定的恢复路径。

相关页面：[二次开发指南](/dev/guide)（新增代码的标准动作与常见错误）
