# 后端架构

后端是一个 Express + Socket.IO 应用，只运行一个进程。Express 提供 HTTP 接口，Socket.IO 提供浏览器与服务器之间的双向实时通信。装配集中在一处，即 `index.ts` 的 `bootstrap()`；实时能力通过注册中心挂载；业务逻辑分散在领域模块与服务层。本页按装配 → 实时层 → 领域层 → 服务层 → 接口层 → 数据层的顺序展开。

---

## 应用入口与装配顺序

后端只有一个装配点：`backend/src/index.ts` 的 `bootstrap()`。这些步骤之间存在顺序依赖，代码注释里标注了原因。

```ts
// backend/src/index.ts — bootstrap()
migrateLegacyDataIfNeeded();   // ① 旧版数据迁移
ensureDataDirs();              //    ④ 建 config/、uploads/、avatars/、media/
ensureDatabaseFile();          // ② DB 文件健康检查（滚动备份 + 全零/损坏自愈）
await AppDataSource.initialize();
await seedRootAdmin();         // ③ 首次启动创建 root / root
ensureUploadsRoot();
await roomStateService.initFromDb();   // ⑤ 从 DB 恢复活跃房间运行时状态

const app = express();         // ⑥ 中间件：trust proxy → cors → json → cookieParser → 流量日志
// ⑦ 挂载 REST 路由（client-logs / avatars 静态 / auth / admin / stream/* / music / …）
await startNcmApiService();    // ⑧ 内嵌网易云 API（失败不阻塞，音乐接口降级 503）
app.get('/health', …);
// ⑨ 前端静态资源（frontend/dist）+ /ffmpeg 强缓存
// ⑩ 创建 HTTP 或 HTTPS server（HTTPS=true 时读 config/ssl/）
const io = new SocketIOServer(httpServer, { … maxHttpBufferSize: 20MB });
playbackMemoryService.setIo(io);       // ⑪ 注入 io，用于校验 hostSocketId 真实在线
app.set('io', io);                     //    HTTP 侧关房时需要广播 room-closed
app.use('/api/rooms', createRoomsRouter(io));
setInterval(cleanupInactiveRooms, 1h); // ⑫ 定时清理无人房间（并立即跑一次）
io.use(…);                             // ⑬ 握手鉴权中间件
const stopNms = nmsService.start(io);  // ⑭ Node Media Server（RTMP/FLV）
socketRegistry.add(…)×20;              // ⑮ 注册 20 个 SocketEventHandler
app.use('/api/rooms', createMovieRouter(io));
app.use('/live', …);                   // ⑯ NMS HTTP-FLV 反代
// ⑰ SPA 回退（/api/ 未匹配返回 404 JSON，其余返回 index.html）
playbackBroadcasterService.start(io);  // ⑱ 服务器心跳接力广播（2s）
io.on('connection', …)                 // ⑲ 唯一连接入口 → socketRegistry.registerAll
httpServer.listen(…);                  // ⑳ 监听（默认双栈）
process.on('SIGTERM' | 'SIGINT', gracefulShutdown);  // ㉑ flushAllDirty → stopNms → stopNcm
```

改动步骤顺序之前，先看这四条约束。

- **①② 必须位于 `AppDataSource.initialize()` 之前**。否则 sql.js 会在旧路径创建空库，导致迁移逻辑误判「已有数据」；加载损坏的文件时，还会直接抛 `file is not a database`。
- **静态资源与 SPA 回退必须位于所有 API 路由之后**。SPA 回退指把未匹配的路径统一返回 `index.html`；`/live` 反代也必须先于它注册，否则 `/live` 会被回退成 `index.html`。SPA 回退对 `/api/` 前缀单独返回 404 JSON，避免前端 `JSON.parse` 解析到 HTML。
- **`/api/rooms` 会被挂载两次**（`createRoomsRouter` 与 `createMovieRouter`），两次挂载的路径不重叠。前者负责房间列表、改名、弹幕轨道与弹幕元数据，后者负责 `/:roomId/movies` 下的影片 CRUD。
- **`playbackMemoryService.setIo(io)` 不能省**。判断房主是否在线要同时满足两个条件：`hostSocketId` 不为空，并且这个 id 仍然存在于 `io.sockets.sockets` 中。只看前者会出问题——后端重启后，从数据库恢复出来的是失效的旧 socket id，服务器会误以为房主在线。

每个阶段具体做了什么、代码在哪里，见[运行流程 · 后端启动与初始化](/dev/runtime#后端启动与初始化)。

---

## Socket.IO 事件注册模型

实时能力统一通过 `SocketRegistry` 注册。`SocketRegistry` 是事件处理器的注册中心，它把散落在各模块的注册点合并成一个入口。

```ts
// backend/src/modules/socket/event-handler.interface.ts
export interface SocketEventHandler {
  readonly name: string;
  register(socket: Socket, io: SocketIOServer): void;
}

export class SocketRegistry {
  add(handler: SocketEventHandler): this { … }
  registerAll(socket: Socket, io: SocketIOServer): void { … }  // 逐个 try/catch，单模块失败不影响其他
}
```

连接入口只有 `index.ts` 里的一处。

```ts
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socketRegistry.registerAll(socket, io);
});
```

握手阶段的鉴权在 `io.use()` 中完成，这段代码同样位于 `index.ts`。

- `handshake.auth.agent === 'zcontrol-cli'` 的连接直接放行，并标记 `socket.data.isCliAgent`。这类连接来自 CLI（即 `zcontrol-cli` 命令行客户端），采用全局注册，由 `CliHandler` 按 user 归属过滤，详见 [ZViewerCLI 代理协议](/advanced/cli-protocol)。
- 其余连接按 **cookie `access_token` → `handshake.auth.token` → `handshake.query.token`** 的顺序取出 JWT（登录后签发的身份令牌）校验。校验通过后，把 `userId / role / username` 写入 `socket.data`，该字段是 handler 判定身份的唯一来源。

需要应答的事件一律使用 ack 回调，并用 `safeAck` 统一包装返回结构。`safeAck` 是一个小工具，它把回调统一包装成 `{ success, message?, code?, data? }` 结构，前端不必各自判断返回格式；内部带 try/catch，客户端已断开时静默忽略。业务数据放在 `data` 字段。

`SocketBroadcaster`（定义在同一文件）封装了广播目标的选择方法，包括 `toRoom / toRoomOthers / toSocket / toRoomExcept / getRoomSockets`。新模块请使用这个类，不要直接写 `io.to().emit()`。

---

## 领域模块清单

`backend/src/modules/` 下共有 13 个模块，每个模块负责一个业务域。模块内部遵循同一套惯例：`index.ts` 是公共出口，`*.service.ts` 是持有状态的单例服务，`handlers/*.handler.ts` 处理 Socket 事件，`*.routes.ts` 提供该模块自己的 REST 接口（可选）。

| 模块 | 职责 | 核心文件 |
|---|---|---|
| `socket/` | 事件注册中心与广播工具（无业务） | `event-handler.interface.ts` |
| `room/` | 房间运行时状态、权限、会话、生命周期事件 | `room-state.service.ts`、`room-permission.service.ts`、`room-session.service.ts`、`handlers/room-lifecycle.handler.ts` |
| `viewer/` | 观众加入 / 审批 / 管理（禁言、踢出）/ 在线列表 | `handlers/viewer-join.handler.ts`、`handlers/viewer-management.handler.ts`、`viewer-list.service.ts` |
| `movie/` | 影片 CRUD、预览源、列表广播 | `movie.routes.ts`、`movie.service.ts`、`movie-broadcaster.service.ts` |
| `sync-playback/` | 同步协议编排：心跳、轨道、字幕、seek 审批 | `heartbeat.handler.ts`、`track-sync.handler.ts`、`subtitle-sync.handler.ts`、`seek-approval.handler.ts` |
| `playback-memory/` | 播放记忆持久化与房主离线期间服务器接管 | `playback-memory.service.ts`、`playback-memory.handler.ts`、`playback-broadcaster.service.ts` |
| `comment/` | 评论、批注、弹幕持久化与弹幕元数据 | `comment.service.ts`、`danmaku-meta.service.ts`、`handlers/comment.handler.ts` |
| `cli/` | CLI 代理（zcontrol-cli）全局注册与归属过滤 | `cli.handler.ts` |
| `stream-push/` | OBS 推流：NMS 启停、推流码校验、状态广播 | `nms.service.ts`、`stream-push.handler.ts`、`stream-key.util.ts`、`router.ts` |
| `webrtc-signaling/` | 投屏信令定向转发与观众就绪握手 | `signaling.handler.ts`、`viewer-events.handler.ts` |
| `voice-chat/` | 语音聊天服务器中转 | `voice-chat.handler.ts` |
| `music/` | 一起听音乐：NCM 内嵌服务与房间同步 | `ncm-api.service.ts`、`MusicSyncHandler.ts` |
| `shared/` | 跨模块 DTO 与工具（`MovieDto` / `SyncStateDto` / `mount-utils`） | `dto/*.ts` |

### 状态为什么分三层

房间状态分成三层保存。读取一律走第一层；第三层不参与日常读取，只在进程重启后用来恢复状态。

| 层 | 载体 | 位置 | 特点 |
|---|---|---|---|
| 运行时权威副本 | `RoomStateService.states: Map<roomId, RoomRuntimeState>` | `modules/room/room-state.service.ts` | 影片列表、`currentMovieId`、房主 playback、字幕缓存；所有读取都走这一层 |
| 播放记忆 | `PlaybackMemoryService.cache: Map<roomId, CachedPlayback>` | `modules/playback-memory/playback-memory.service.ts` | 内存里始终是最新值 + 脏标记；写数据库做了节流，状态最多每 2 秒写一次，心跳最多每 10 秒写一次 |
| 持久化 | `Room` / `Movie` / `PlaybackState` / `Session` / `MusicQueueItem` … | `entities/` | 重启后由 `roomStateService.initFromDb()` 恢复 |

两个 Service 都提供 `setStorageAdapter()` 写穿透钩子，定义在 `services/storage`。写穿透指每次写操作都同时写向外部存储，目的是让多个实例通过 Redis 共享状态。当前实现仍然是内存版。

时间推算公式贯穿整条链路，它定义在 `playback-memory.service.ts` 的 `advanceState()` 中。

```
actualCurrentTime = currentTime + (Date.now() - updatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
// 超过 duration 时收敛为 { currentTime: duration, isPlaying: false }
```

同步协议的事件清单与常量见[房间同步逻辑](/advanced/sync)。

---

## 服务层 `services/`

服务层不感知 HTTP 与 Socket，只提供可复用的能力。这些能力按用途分成四类。

| 类别 | 文件 | 说明 |
|---|---|---|
| **运行时基础设施** | `paths.ts` | 数据路径唯一来源（`PROJECT_ROOT` / `CONFIG_DIR` / `DATABASE_PATH` / `UPLOADS_DIR` / `MEDIA_DIR`），含 `ensureDataDirs()` 与旧版数据迁移 |
| | `db-persistence.ts` | `ensureDatabaseFile()` 健康检查 + `atomicSaveDatabase()` 原子写回（tmp + rename） |
| | `system-settings.ts` | 系统设置读写与缓存（独立成文件以避免子模块从根 `index.ts` 导入造成循环依赖） |
| | `proxy/http-proxy.ts` | 统一代理出口 `proxyHttpUpstream`：Range 有界分片、条件请求、断连销毁、流量日志 |
| | `traffic.ts`、`client-logger.ts`、`audit.ts` | 流量统计、前端日志落盘、审计 |
| **内容源对接** | `bilibili/*`（13 个文件） | `resolver.ts` 解析编排、`playurl.ts`、`wbi.ts` 签名、`credential.ts` 凭证、`cdn.ts` 健康检查、`vip.ts`、`danmaku.ts`、`subtitle.ts`、`bangumi.ts`、`cache.ts` |
| | `openlist*.ts`、`webdav.ts`、`ftp.ts`、`emby-client.ts`、`jellyfin-client.ts` | 挂载类源客户端 |
| | `anime/`、`anisubs/`、`kazumi/`、`danmaku/` | 番剧源与弹幕源适配 |
| **媒体处理** | `movie-direct-resolver.ts` | 直链实时解析（5 分钟 TTL + 单飞去重 + https 活性自愈） |
| | `mediaFormat.ts`、`network-utils.ts`、`openlist-errors.ts` | 格式判定、SSRF / 内网地址判定、错误归一化 |
| **运维能力** | `updater/`、`server-files/`、`screen-sharing/`（信令辅助）、`storage/` | 自动更新、服务器文件管理、存储适配器接口 |

---

## REST 路由层

`routes/` 下每个业务域一个文件。多个子路由之间的聚合关系见 `routes/stream/index.ts`。

| 挂载点 | 文件 | 鉴权 |
|---|---|---|
| `/api/auth` | `auth.ts` | 混合（部分开放） |
| `/api/admin` | `admin.ts` | `authenticateToken + adminOnly`（root-only 端点单挂 `requireRoot`） |
| `/api/rooms` | `rooms.ts` + `modules/movie/movie.routes.ts` | `authenticateToken` + 房间 owner / root 判定 |
| `/api/stream` | `stream/index.ts` 聚合 | `/proxy-image` 免认证，其余 `authenticateToken` |
| `/api/music` | `music.ts` | 可选鉴权（游客可匿名） |
| `/api/server-files` | `serverFiles.ts` | 仅 root |
| `/api/cli` | `cli.ts` | `authenticateToken` |
| `/api/direct-resolve`、`/api/subtitles`、`/api/webdav|ftp|openlist|emby|jellyfin` | 各自文件 | `authenticateToken` |
| `/api/system/update` | `updater.ts` | 仅 root |
| `/api/client-logs`、`/health` | `client-logs.ts` / `index.ts` | 开放 |

每个端点的定义与错误码见 [REST API 参考](/advanced/api)，鉴权细节见[鉴权与权限模型](/advanced/auth)。

---

## 数据层

`data-source.ts` 是整个后端唯一的 DataSource（TypeORM 的数据库连接与实体映射配置）定义。关键配置涉及驱动类型、存储位置和自动保存策略。

```ts
type: 'sqljs',                                    // wasm SQLite，无原生模块
location: DATABASE_PATH,                          // 统一落在 config/
autoSave: true,
autoSaveCallback: (db) => atomicSaveDatabase(db), // 原子写回，防全零文件
synchronize: true,                                // 自动建表（无 migration）
entities: [ /* 15 个实体 */ ],
```

实体各自负责一块数据。

| 实体 | 说明 |
|---|---|
| `Room` | 房间主体：`roomId`（8 位 nanoid）、密码哈希、`mode`、`shareMethod`、`streamKey`、`requireApproval`、`approvedViewers` / `mutedViewers` / `moderators`（JSON 数组）、`ownerUserId`、`lastAccessedAt` |
| `Session` | 房间会话：`role: 'sharer' \| 'viewer'`、`socketId`、`endedAt`（房主为运行时角色，由 sharer + `endedAt IS NULL` 判定） |
| `Movie` | 影片记录（url 为添加时刻的快照，播放时实时取新鲜直链） |
| `PlaybackState` | 播放记忆（`roomId` 为主键，`lastUpdatedAt` 为推算基线，`hostSocketId` 用于在线判定） |
| `User` | 账号：`role`（root/admin/user/guest）、`status`、`tokenInvalidBefore`（token 吊销时间戳） |
| `SystemSettings` | 运行时配置（注册/建房模式、权限矩阵、功能开关、自动清理） |
| `Comment` / `DanmakuTrack` / `RoomDanmakuMeta` | 评论、弹幕轨道、弹幕辅助数据（屏蔽词 / 已删除 / 实时记录） |
| `MusicQueueItem` | 一起听队列（单表双源） |
| `BilibiliCredential` / `NcmCredential` | 第三方登录凭证 |
| `UserMount` | 挂载点（webdav / ftp / openlist / emby / jellyfin） |
| `ServerFolder` | 服务器文件根目录 |
| `AuditLog` | 审计日志 |

数据库在 SQLite 与 PostgreSQL 之间切换的方法见[环境变量](/advanced/env)。

后端之外的部分见[前端架构](/dev/frontend)。
