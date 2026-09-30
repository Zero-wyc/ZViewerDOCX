# 后端架构

后端是一个 Express + Socket.IO 单进程应用：装配只发生在一处（`index.ts` 的 `bootstrap()`），实时能力通过注册中心统一挂载，业务逻辑分散在领域模块与服务层。本页按「装配 → 实时层 → 领域层 → 服务层 → 接口层 → 数据层」的顺序展开。

---

## 应用入口与装配顺序

后端只有一个装配点：`backend/src/index.ts` 的 `bootstrap()`。它按**严格顺序**完成初始化，顺序本身有语义，调整前请先读懂注释。

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

几个容易踩的顺序约束：

- **①② 必须在 `AppDataSource.initialize()` 之前**。否则 sql.js 会在旧路径创建空库，迁移逻辑会误判「已有数据」；而加载损坏文件会直接抛 `file is not a database`。
- **静态资源与 SPA 回退必须在所有 API 路由之后**。`/live` 反代也必须在 SPA 回退之前注册，否则 `/live` 会被回退成 `index.html`。SPA 回退对 `/api/` 前缀单独返回 404 JSON，避免前端 `JSON.parse` 一个 HTML 页面。
- **`/api/rooms` 被挂载两次**（`createRoomsRouter` 与 `createMovieRouter`），二者路径不重叠：前者管房间列表 / 改名 / 弹幕轨道 / 弹幕元数据，后者管 `/:roomId/movies` 影片 CRUD。
- **`playbackMemoryService.setIo(io)` 不可省**：`hostSocketId` 非空只代表「曾经注册过」，后端重启后从 DB 恢复的是失效的旧 socket id，必须再校验 `io.sockets.sockets.has(id)` 才判在线。

逐阶段的行为与代码位置对照见[运行流程 · 后端启动与初始化](/dev/runtime#后端启动与初始化)。

---

## Socket.IO 事件注册模型

所有实时能力经 `SocketRegistry` 统一注册，这是后端最核心的一条骨架。

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

连接入口只有一处（`index.ts`）：

```ts
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  socketRegistry.registerAll(socket, io);
});
```

握手鉴权在 `io.use()` 中完成（`index.ts`）：

- `handshake.auth.agent === 'zcontrol-cli'` 直接放行并标记 `socket.data.isCliAgent`（CLI 全局注册，后由 `CliHandler` 按 user 归属过滤，见 [ZViewerCLI 代理协议](/advanced/cli-protocol)）。
- 其余连接按 **cookie `access_token` → `handshake.auth.token` → `handshake.query.token`** 取 JWT 校验，成功后把 `userId / role / username` **写进 `socket.data`**——这是所有 handler 判定身份的唯一来源，客户端无法伪造。

协议约定：**所有需要应答的事件都走 ack 回调，统一用 `safeAck(callback, { success, message?, code?, data? })` 包裹**。`safeAck` 内部 try/catch，客户端已断开时静默忽略。业务数据一律放在 `data` 字段内。

`SocketBroadcaster`（同文件）封装了 `toRoom / toRoomOthers / toSocket / toRoomExcept / getRoomSockets`，新模块优先用它而不是裸写 `io.to().emit()`。

---

## 领域模块清单

`backend/src/modules/` 共 13 个模块，每个模块内部惯例为：`index.ts`（公共出口）+ `*.service.ts`（单例服务，持状态）+ `handlers/*.handler.ts`（Socket 事件）+ `*.routes.ts`（该模块的 REST，可选）。

| 模块 | 职责 | 核心文件 |
|---|---|---|
| `socket/` | 事件注册中心与广播工具（无业务） | `event-handler.interface.ts` |
| `room/` | 房间运行时状态、权限、会话、生命周期事件 | `room-state.service.ts`、`room-permission.service.ts`、`room-session.service.ts`、`handlers/room-lifecycle.handler.ts` |
| `viewer/` | 观众加入 / 审批 / 管理（禁言、踢出）/ 在线列表 | `handlers/viewer-join.handler.ts`、`handlers/viewer-management.handler.ts`、`viewer-list.service.ts` |
| `movie/` | 影片 CRUD、预览源、列表广播 | `movie.routes.ts`、`movie.service.ts`、`movie-broadcaster.service.ts` |
| `sync-playback/` | 同步协议编排：心跳、轨道、字幕、seek 审批 | `heartbeat.handler.ts`、`track-sync.handler.ts`、`subtitle-sync.handler.ts`、`seek-approval.handler.ts` |
| `playback-memory/` | 播放记忆持久化与「房主离线后服务器接管」 | `playback-memory.service.ts`、`playback-memory.handler.ts`、`playback-broadcaster.service.ts` |
| `comment/` | 评论、批注、弹幕持久化与弹幕元数据 | `comment.service.ts`、`danmaku-meta.service.ts`、`handlers/comment.handler.ts` |
| `cli/` | CLI 代理（zcontrol-cli）全局注册与归属过滤 | `cli.handler.ts` |
| `stream-push/` | OBS 推流：NMS 启停、推流码校验、状态广播 | `nms.service.ts`、`stream-push.handler.ts`、`stream-key.util.ts`、`router.ts` |
| `webrtc-signaling/` | 投屏信令定向转发与观众就绪握手 | `signaling.handler.ts`、`viewer-events.handler.ts` |
| `voice-chat/` | 语音聊天服务器中转 | `voice-chat.handler.ts` |
| `music/` | 一起听音乐：NCM 内嵌服务与房间同步 | `ncm-api.service.ts`、`MusicSyncHandler.ts` |
| `shared/` | 跨模块 DTO 与工具（`MovieDto` / `SyncStateDto` / `mount-utils`） | `dto/*.ts` |

### 三层状态模型

这是理解同步行为的关键，也是后端唯一需要「背下来」的东西（详见[架构总览](/advanced/)与[房间同步逻辑](/advanced/sync)）：

| 层 | 载体 | 位置 | 特点 |
|---|---|---|---|
| 运行时权威副本 | `RoomStateService.states: Map<roomId, RoomRuntimeState>` | `modules/room/room-state.service.ts` | 影片列表、`currentMovieId`、房主 playback、字幕缓存；**读永远走这里** |
| 播放记忆 | `PlaybackMemoryService.cache: Map<roomId, CachedPlayback>` | `modules/playback-memory/playback-memory.service.ts` | 内存恒最新 + 脏标记；DB 写入节流（状态 2s、心跳 10s） |
| 持久化 | `Room` / `Movie` / `PlaybackState` / `Session` / `MusicQueueItem` … | `entities/` | 重启后由 `roomStateService.initFromDb()` 恢复 |

两个 Service 都预留了 `setStorageAdapter()` 写穿透钩子（`services/storage`），为未来多实例（Redis）共享状态留出扩展点，当前为内存实现。

时间推算公式贯穿全链路（`playback-memory.service.ts` → `advanceState()`）：

```
actualCurrentTime = currentTime + (Date.now() - updatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
// 超过 duration 时收敛为 { currentTime: duration, isPlaying: false }
```

---

## 服务层 `services/`

服务层不感知 HTTP 与 Socket，只提供可复用的能力。按用途分四类：

| 类别 | 文件 | 说明 |
|---|---|---|
| **运行时基础设施** | `paths.ts` | 所有数据路径的唯一来源（`PROJECT_ROOT` / `CONFIG_DIR` / `DATABASE_PATH` / `UPLOADS_DIR` / `MEDIA_DIR`），含 `ensureDataDirs()` 与旧版数据迁移 |
| | `db-persistence.ts` | `ensureDatabaseFile()` 健康检查 + `atomicSaveDatabase()` 原子写回（tmp + rename，替代驱动的非原子直写） |
| | `system-settings.ts` | 系统设置的读写与缓存（抽出来是为了避免子模块从根 `index.ts` 导入造成循环依赖） |
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

`routes/` 下每个业务域一个文件，聚合关系见 `routes/stream/index.ts`。挂载点与权限速查：

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

逐条端点与错误码见 [REST API 参考](/advanced/api)，鉴权细节见[鉴权与权限模型](/advanced/auth)。

---

## 数据层

`data-source.ts` 是唯一的 DataSource 定义，几个关键决策：

```ts
type: 'sqljs',                                    // wasm SQLite，无原生模块
location: DATABASE_PATH,                          // 统一落在 config/
autoSave: true,
autoSaveCallback: (db) => atomicSaveDatabase(db), // 原子写回，防全零文件
synchronize: true,                                // 自动建表（开发友好，无 migration）
entities: [ /* 15 个实体 */ ],
```

实体职责一览：

| 实体 | 说明 |
|---|---|
| `Room` | 房间主体：`roomId`（8 位 nanoid）、密码哈希、`mode`、`shareMethod`、`streamKey`、`requireApproval`、`approvedViewers` / `mutedViewers` / `moderators`（JSON 数组）、`ownerUserId`、`lastAccessedAt` |
| `Session` | 房间会话：`role: 'sharer' \| 'viewer'`、`socketId`、`endedAt`（房主是运行时角色，由 sharer + `endedAt IS NULL` 判定） |
| `Movie` | 影片记录（url 是**添加时刻的快照**，播放时实时取新鲜直链） |
| `PlaybackState` | 播放记忆（`roomId` 为主键，`lastUpdatedAt` 是推算基线，`hostSocketId` 用于在线判定） |
| `User` | 账号：`role`（root/admin/user/guest）、`status`、`tokenInvalidBefore`（token 吊销时间戳） |
| `SystemSettings` | 运行时配置（注册/建房模式、权限矩阵、功能开关、自动清理） |
| `Comment` / `DanmakuTrack` / `RoomDanmakuMeta` | 评论、弹幕轨道、弹幕辅助数据（屏蔽词 / 已删除 / 实时记录） |
| `MusicQueueItem` | 一起听队列（单表双源） |
| `BilibiliCredential` / `NcmCredential` | 第三方登录凭证 |
| `UserMount` | 挂载点（webdav / ftp / openlist / emby / jellyfin） |
| `ServerFolder` | 服务器文件根目录 |
| `AuditLog` | 审计日志 |

数据库切换（SQLite / PostgreSQL）见[环境变量](/advanced/env)。

下一步 → [前端架构](/dev/frontend)
