# 开发教程

> 本文面向二次开发者：从整体分层设计讲到目录结构、模块职责、依赖协作，再顺着启动初始化与几条关键执行链路看数据如何在模块间流转。读完之后，你应该能独立定位任意一处功能的代码位置，并按既有约定新增模块、路由、事件与播放引擎。
>
> 功能使用见[基础教程](/basic/)，程序运行逻辑与接口细节见[拓展教程](/advanced/)。本文不重复二者的结论，只讲「代码长什么样、为什么这样组织」。

---

## 一、项目定位与选型

ZViewer 是一个**前后端同仓、单进程单端口**的多人同步观影平台：房主控制播放，观众实时跟随；同一套房间模型下还承载了投屏（WebRTC / OBS 推流）与一起听音乐两种模式。

| 层 | 技术 | 备注 |
|---|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand | 播放器基座 ArtPlayer，另含 Video.js 10 / dash.js 5.2 执行层 |
| 后端 | Node.js + Express 5 + TypeScript + Socket.IO | 单进程同时提供 REST、WebSocket、静态托管与 `/live` 反代 |
| 数据库 | TypeORM + **sql.js**（wasm SQLite） | 无原生模块，可选切 PostgreSQL |
| 流媒体 | Node Media Server（RTMP / HTTP-FLV） | 独立 TCP 端口，由后端反代对外 |
| 音视频 | 浏览器端重封装 / 转码（playsvideo + 内置 mediabunny fork） | 服务端不再依赖 FFmpeg |
| 音乐 | `@neteasecloudmusicapienhanced/api` 内嵌 HTTP 服务 | 仅监听 `127.0.0.1` |
| 工程 | npm workspaces（`frontend` + `backend`）+ `pkg` 单文件打包 | 根目录统一装依赖 |

四条贯穿全局的设计基调，理解它们能解释绝大多数「为什么这样写」：

1. **无原生模块**：sql.js 是 wasm 实现、音视频处理前置到浏览器，因此单文件版可在任意平台直接运行，不需要编译环境。
2. **单进程单端口**：生产模式下前后端共用 3333，后端统一处理 API、静态资源、WebSocket 与 `/live`，天然无跨域问题。
3. **浏览器承担计算**：字幕提取（MKV 流式 demux）、容器重封装、音轨转码都在浏览器完成，服务器只做转发与解析。
4. **配置集中**：所有运行时状态（数据库、证书、上传、推流切片、JWT 密钥文件）收敛在 `config/` 目录，更新不覆盖。

---

## 二、整体分层设计

前后端采用**对称的领域分层**：表现层只关心渲染，状态层只关心状态，领域模块层承载业务，服务层承载可复用的技术能力，数据层只负责持久化。依赖方向严格单向向下。

```
┌──────────────────────────── 前端（浏览器） ────────────────────────────┐
│  表现层   pages/ · components/ · modules/*/components/                 │
│            只管渲染与交互，不直接发请求                                │
│     ↓                                                                  │
│  状态层   store/*（Zustand）                                           │
│            单一数据源：房间 / 鉴权 / 主题 / 弹幕 / 系统设置 / CLI       │
│     ↓                                                                  │
│  领域层   modules/*（room / player / sync-playback / music / …）       │
│            业务编排：hooks 组合 + services 纯函数 + engines 抽象        │
│     ↓                                                                  │
│  基础设施 lib/*（apiFetch / authTransport / mkv / monet / clientLogger）│
│  传输     REST(apiFetch)  ·  Socket.IO(useSocket 全局单例)              │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │ HTTP REST + Socket.IO（同一套 JWT 身份）
┌────────────────────────────────┴───────────────────────────────────────┐
│  装配层   backend/src/index.ts（bootstrap：中间件 → 路由 → Socket → 静态）│
│     ↓                                                                  │
│  接口层   routes/*（REST）· modules/*/handlers/*（Socket 事件）         │
│            只做参数校验、权限判定、编排调用，不含重逻辑                 │
│     ↓                                                                  │
│  领域层   modules/*（room / viewer / movie / sync-playback / …）        │
│            单例 Service 持有运行时状态，Handler 承载实时协议            │
│     ↓                                                                  │
│  服务层   services/*（bilibili / proxy / openlist / danmaku / updater） │
│            技术能力与第三方对接，纯函数或轻状态                         │
│     ↓                                                                  │
│  数据层   entities/* + data-source.ts（TypeORM / sql.js）               │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 依赖规则

架构约束靠三条约定维持，改动时请勿破坏：

| 约定 | 说明 | 代码位置 |
|---|---|---|
| **路由/处理器不写重逻辑** | 路由只做 `参数校验 → 权限判定 → 调 Service → 响应`；跨模块编排收敛到 Service | `routes/*.ts`、`modules/*/handlers/*.ts` |
| **模块间通过共享 Service 协作，不直接耦合** | 模块只 import 对方的单例 Service，不 import 对方的 handler；`SocketRegistry` 的存在即为消除「多个 `io.on('connection')` 注册点分裂」 | `modules/socket/event-handler.interface.ts` 头注释 |
| **循环依赖用动态 `import()` 打断** | 典型：`PlaybackMemoryService.getCurrentMovieId()` 动态导入 `roomStateService`，避免 playback-memory ↔ room 互相静态引用 | `modules/playback-memory/playback-memory.service.ts` |

另外两条前端约定：

- **store 不做业务编排**：`roomStore` 只提供状态与 CRUD 薄封装（`fetchMovies` / `addMovie` …），真正的编排在 `useWatchTogether` 等 hook 中；写操作成功后**不直接改本地 state**，等后端 `movie-list` 广播回来刷新，保证多端一致（见 `roomStore.ts` 注释）。
- **模块出口统一走 `index.ts`（barrel export）**：`player/index.ts`、`sync-playback/index.ts`、`modules/room/index.ts` 等只导出公共 API，内部文件（`constants.ts` / `types.ts` / `services/`）通过 index 按需 re-export，外部不要深链到内部实现文件。

---

## 三、目录结构总览

### 3.1 仓库根目录

```
ZViewer/
├── backend/               # Express 后端（TypeScript + TypeORM + sql.js）
├── frontend/              # React 前端（Vite + Tailwind + Zustand）
├── scripts/               # 辅助脚本：start.js（启动入口）、build-exe.js（pkg 打包）
├── packaging/             # 启动脚本模板（start.sh / start.bat）
├── docker/                # Docker 入口脚本
├── config/                # 运行时数据（数据库 / 证书 / 上传 / 切片 / jwt-secrets.json）
├── log/                   # 运行日志（含前端控制台上报）
├── dist/                  # 单文件编译产物（build-all.js 输出）
├── build-all.js           # 单文件编译脚本（esbuild 打包 + 资源内联）
├── start-prod.sh / .bat   # 源码版一键启动：装依赖 → 构建 → 启动
├── Dockerfile.linux-single
└── package.json           # workspaces 根：frontend + backend
```

根 `package.json` 的关键脚本：

| 命令 | 行为 |
|---|---|
| `npm run dev` | `concurrently` 同时起 `dev -w backend` 与 `dev -w frontend`（`--kill-others`） |
| `npm run dev:backend` / `dev:frontend` | 单独起后端 / 前端 |
| `npm run build` | `npm run build -ws` → 前端 `tsc && vite build`，后端 `node scripts/clean-dist.js && tsc` |
| `npm start` | `node scripts/start.js`，转发到 `start-prod.sh` / `start-prod.bat` |
| `npm run build:all` | `node build-all.js`，产出平台单文件 |

### 3.2 后端 `backend/src/`

```
backend/src/
├── index.ts            # 应用入口：bootstrap 全量装配（唯一 io.on('connection') 注册点）
├── data-source.ts      # TypeORM DataSource（sqljs 驱动 + 原子写回 + synchronize）
├── entities/           # 15 个 TypeORM 实体
├── middleware/         # auth.ts（JWT 签发/校验/吊销/角色）、rate-limit.ts（限流）
├── routes/             # REST 路由（按业务域分文件 + stream/ 子聚合）
├── modules/            # 13 个领域模块（见 4.3）
├── services/           # 技术能力与第三方对接（B站、代理、挂载源、弹幕、更新…）
├── types/              # 全局类型声明
└── utils/              # 通用工具
```

| 目录 | 职责 | 代表文件 |
|---|---|---|
| `entities/` | 持久化模型 | `Room.ts`、`Movie.ts`、`PlaybackState.ts`、`Session.ts`、`User.ts` |
| `middleware/` | 请求级横切 | `auth.ts`（`authenticateToken` / `adminOnly` / `requireRoot` / `verifyAccessToken`） |
| `routes/` | REST 端点定义与挂载 | `auth.ts`、`rooms.ts`、`admin.ts`、`stream/`、`music.ts`、`subtitles.ts` |
| `modules/` | 领域逻辑与实时协议 | `room/`、`sync-playback/`、`playback-memory/`、`movie/` |
| `services/` | 技术能力（无 HTTP 语义） | `bilibili/`、`proxy/http-proxy.ts`、`paths.ts`、`db-persistence.ts`、`system-settings.ts` |

### 3.3 前端 `frontend/src/`

```
frontend/src/
├── main.tsx            # 挂载入口：日志上报、媒体探针、Router + ThemeProvider
├── App.tsx             # 路由表 + AuthInitializer（鉴权引导）
├── index.css           # Tailwind 入口与玻璃拟态变量
├── pages/              # 页面级组件（HomePage / LoginPage / AdminPage / ProfilePage …）
├── components/         # 跨模块通用 UI（Layout / Header / ThemeProvider / RequireAuth…）
├── hooks/              # 全局 hooks（useSocket / useBackendHealth / useSubtitles…）
├── lib/                # 基础设施库（api / authTransport / mkv / monet / api 封装…）
├── modules/            # 23 个功能模块（见 5.4）
├── store/              # Zustand 状态（7 个 store）
└── types/ utils/       # 类型与零散工具
```

顶层 `vite.config.ts` 有三处需要知晓的定制：

| 定制 | 原因 |
|---|---|
| `dashjs-5-2-0-null-guard` 插件（dev 走 esbuild `onLoad`，build 走 rollup `transform`） | dash.js destroy 后残留回调读 `getStreamInfo().id` 抛错，改写为可选链；dev 下 dashjs 被内联进预构建产物，常规 transform 不经过 |
| `resolve.alias` 把 `mediabunny` 指向 `./vendor/mediabunny` | playsvideo 依赖 kzahel/mediabunny 的 integration fork，npm 上无对应发布版，vendored 后 dev/build 行为一致 |
| `optimizeDeps.exclude: ['playsvideo']` | esbuild 预打包会保留 `new Worker(new URL('./worker.js', import.meta.url))` 却不产出 worker 文件，dev 下 404 → “Playback worker crashed” |

### 3.4 开发环境与端口

```bash
npm install
npm run dev            # 前端 5174（HMR）+ 后端 3333（ts-node-dev --respawn）
```

Vite 代理（`vite.config.ts` → `server.proxy`）把 `/api`、`/uploads`、`/socket.io`（`ws: true`）转发到 3333，`/live` 转发到 3335，因此开发时**无需配置 `VITE_API_URL`**。

改动后的校验命令：

```bash
cd frontend && npx tsc --noEmit        # 类型检查
cd frontend && npx eslint <改动文件>    # 要求 0 错 0 警
cd backend  && npx tsc --noEmit        # 后端类型检查（等价 npm run lint -w backend）
```

---

## 四、后端架构

### 4.1 应用入口与装配顺序

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

### 4.2 Socket.IO 事件注册模型

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

### 4.3 领域模块清单

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

#### 三层状态模型

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

### 4.4 服务层 `services/`

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

### 4.5 REST 路由层

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

### 4.6 数据层

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

---

## 五、前端架构

### 5.1 应用入口与 Provider 树

```tsx
// frontend/src/main.tsx
initClientLogger({ minLevel: 'debug' })   // 拦截 console / 未捕获异常，批量上报后端
installMediaDebugProbe()                  // localStorage.zviewer-media-debug === '1' 才启用
createRoot(#root).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider><App /></ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
```

`App.tsx` 承担三件事：路由表、鉴权引导（`AuthInitializer`）、全局副作用（`useBackendHealth` 检测后端自动重启、启动时拉 `/api/auth/public-settings`）。

路由与守卫：

| 路径 | 组件 | 守卫 |
|---|---|---|
| `/`、`/login` | `HomePage`、`LoginPage` | 无 |
| `/room/:roomId?` | `modules/room/RoomPage` | `RequireAuth` |
| `/share/:roomId?`、`/watch/:roomId?` | 重定向到 `/room/:roomId` | — |
| `/admin` | `AdminPage` | `RequireAuth adminOnly` |
| `/profile` | `ProfilePage` | `RequireAuth forbiddenRoles={['guest']}` |
| `/rooms`、`/join` | `RoomsListPage`、`JoinByRoomIdPage` | `RequireAuth` |

### 5.2 鉴权引导边界（前端最容易踩坑处）

`AuthInitializer`（`App.tsx`）与 `RequireAuth`（`components/RequireAuth.tsx`）的配合有一组硬约定：

- `validate()` 先打 `GET /api/auth/me`（`apiFetch` 内部会在 401 时自动 refresh 后重试一次）；**网络错误最多重试 8 次、间隔 2s**。
- 校验失败且用户 ID 未变（排除「验证期间手动登录」竞态）→ `expireSession()` → `fetchGuestToken()`：**最多 3 次尝试，退避 `1.5s × attempt`，仅对 429 / 5xx / 网络错误重试**。
- 终态必置 `markAuthResolved()`；`authResolved` **不持久化**，代表「本次页面加载的鉴权引导终态」。`RequireAuth` 只看它：未 resolved 原地渲染 `null` 等待（不重定向），resolved 且未认证才跳 `/login`。
- `autoLoginStatus` 虽持久化，**只代表上一次页面生命周期**，唯一用途是让 `useSocket` 决定能否提前建连。

这些细节直接对应「房间链接要输两次地址」类问题，排查前先读 `auth.md`。

### 5.3 Socket 连接：全局单例 + 三级降级

`hooks/useSocket.ts` 维护两个模块级单例：

| 单例 | 用途 | 传输 |
|---|---|---|
| `globalSocket` | 业务消息（同步、弹幕、成员、投屏信令…） | `['websocket', 'polling']` |
| `globalMediaSocket` | 仅语音帧（独立连接，避免大消息的 TCP 队头阻塞波及 20ms 音频帧） | `['websocket']` |

要点：

- **引用计数 + 100ms 延迟断开**：多个组件同时 `useSocket()`，refCount 归零后延迟 100ms 再 disconnect，避免页面切换时的抖动。
- **建连时机**：`autoLoginStatus === 'done'` 才创建（避免匿名状态建连被拒）。
- **`connect_error` 三级降级**：消息命中鉴权类关键词 → ① `POST /api/auth/refresh` 成功后 `reconnectSocket()`；② refresh 失败 → `POST /api/auth/guest` 降级为游客身份；③ guest 也失败 → `logout()`。网络异常不登出，交给 socket.io 自动重试。并发用 `isRefreshingRef` 防重入。
- **`reconnectSocket()`** 采用 `disconnect()` + 50ms 微任务延迟后 `connect()`：socket.io 4.x 不会重建底层实例但会重新走握手，从而重新携带最新 cookie。

### 5.4 状态层 `store/`

| store | 内容 |
|---|---|
| `roomStore.ts` | 房间态：模式、成员、影片列表、`watchTogether` 镜像、弹幕/预览/重载请求队列、流量相关 UI 态 + 影片 CRUD 薄封装 |
| `authStore.ts` | 用户、`isAuthenticated`、`autoLoginStatus`、`authResolved`（持久化 key `zcontrol-auth-storage`，**token 不持久化**） |
| `themeStore.ts` / `systemSettingsStore.ts` / `danmakuStore.ts` / `cliAgentStore.ts` / `useAppStore.ts` | 主题、公开系统设置（含权限矩阵镜像 `canRoomViewerPerform`）、弹幕轨道与元数据、CLI 代理状态、零散 UI |

`roomStore` 的两条设计细节值得单独记住：

- **`exitRoom()` vs `reset()`**：前者用于用户明确退出（清 `activeRoomId`），后者用于切换房间；二者都会联动 `useMusicStore.getState().reset()`。`RoomPage` 卸载时**不清状态**——这是「离开房间保持运行 / 右上角回到房间」功能的基础。
- **写操作后不本地改 state**：`addMovie` / `updateMovie` / `removeMovie` / `reorderMovies` 都只发请求，等后端 `movie-list` 广播回来刷新；只有「删除的是当前播放影片」这一种情况本地清理 `currentMovieId`（因为 REST 删除不会广播 `current-movie`）。

### 5.5 模块清单 `modules/`

| 模块 | 职责 |
|---|---|
| `room/` | 房间页外壳：`RoomPage.tsx` + 布局/面板组件 + `watch-together/`（一起看业务核心） |
| `player/` | 播放引擎抽象：`PlayerEngine` 接口、`engine-selector.ts`、`engines/`、`hooks/usePlayerSource.ts`、`services/` |
| `sync-playback/` | 前后端同步协议的前端实现：房主广播 / 观众对齐 / seek 策略 / 事件常量 |
| `playback-memory/` | 观众侧「请求初始状态」与「订阅服务器心跳」 |
| `art-player/` | ArtPlayer 集成、覆盖层与只读守卫（`art-shared.ts`） |
| `music/` | 一起听：`MusicAppShell` 整页底板、歌词页、队列、双源播放 |
| `screen-sharing/` | 投屏：WebRTC 信令、OBS 推流拉流、连接统计 |
| `voice-chat/` | 语音面板与语音帧处理 |
| `bilibili/` / `danmaku/` | B站解析参数与 API、弹幕 API |
| `subtitles/` | MKV 内嵌字幕提取桥接 |
| `mounts/` `webdav/` `ftp/` `openlist/` `emby/` `jellyfin/` `server-files/` | 各类内容源的浏览/挂载 UI 与 API |
| `anisubs/` `kazumi/` `direct-link/` | 番剧源与直链 |
| `p2p/` `admin/` | P2P 隧道试点、管理后台组件 |

`modules/` 内部统一形态（以 `player/` 为例）：

```
player/
├── types.ts               引擎接口（PlayerEngine / PlayerSource / PlayerController）+ 源数据结构
├── utils.ts               video 元素工具（resetVideoElement / waitForMetadata）
├── engine-selector.ts     selectEngine(source) 决策中心
├── engines/               各引擎实现（hls / flv / direct / playsvideo / videojs10 / videojs10-dash）
├── services/              url-proxy（代理路由决策）、buffer-mode、pause-intent…
├── hooks/usePlayerSource.ts  引擎无关的「把源应用到 video」Hook
└── index.ts               公共 API 出口
```

### 5.6 播放引擎抽象

引擎层是前端最清晰的一处抽象：`usePlayerSource` 是**引擎无关**的（不关心房主/观众，也不依赖 `WatchTogetherState`），调用方只需传入 `PlayerSource`。

```ts
// frontend/src/modules/player/types.ts
export interface PlayerEngine {
  readonly type: EngineType;                       // 'hls' | 'flv' | 'direct' | 'playsvideo' | 'videojs10' | 'videojs10-dash'
  attach(video: HTMLVideoElement, source: PlayerSource): Promise<EngineAttachResult>;
}
```

`selectEngine(source)`（`engine-selector.ts`）的决策顺序：

| 条件 | 引擎 |
|---|---|
| `format === 'dash'` 或存在 `audioUrl` | `videojs10-dash`（自研 MPD 构建 + v10 状态层 + dash.js 5.2 执行层） |
| `format === 'hls'` | `hls` |
| `format === 'flv'` | `flv` |
| `shouldUsePlaysVideo(source)` | `playsvideo`（容器重封装 / 音轨转码） |
| 其他 | `videojs10`（直链试点）；`localStorage['zviewer-vjs10-engine'] === '0'` 时回落 `direct` |

`shouldUsePlaysVideo` 的门控语义（`engine-selector.ts` 注释）值得原文记住：

- **唯一门控是影片级开关** `playsvideoEnabled === false` → 强制原生直连，失败也不回退。
- `avi / ts / wmv` 浏览器无法原生打开 → 必走 playsvideo；`mkv` 一律走 playsvideo（原生只支持 H.264/AAC 组合，且 DTS/AC3 需转码）；`mp4 / webm / mov` 仅当 `audioCodec` 明确不被支持时才介入。
- 该函数**同时被 `usePlayerSource` 的格式预检复用**，避免「预检放行」与「引擎选择」两处判定漂移。

`usePlayerSource` 的两个工程质量点：

- **全量操作串行化**：`attach` / `forceReload` 进同一条 Promise 队列，天然消除并发 attach 互相 abort（替代了旧的 `isAttaching` / `isReloading` 双锁 + 5s 等待循环）。
- **错误提示分工**：attach 期失败 `throw` 由调用方 catch；播放期失败由本 Hook 的 `video error` 监听经 `options.onPlaybackError` 上抛——错误知情权在引擎层（它才知道回退是否可用）。

更深的内容（引擎内 MPD 构建、缓冲模式、代理路由决策）见[视频源与 API 获取逻辑](/advanced/video-pipeline)。

---

## 六、运行流程

### 6.1 后端启动与初始化

| 阶段 | 行为 | 代码位置 |
|---|---|---|
| 环境准备 | `dotenv.config()` 装载 `.env` | `index.ts` 顶部 |
| 数据迁移 | `migrateLegacyDataIfNeeded()`：`backend/dev.sqlite`、`backend/uploads/` → `config/`；失败仅告警不阻断 | `services/paths.ts` |
| 目录与文件 | `ensureDataDirs()` 建 `config/`、`uploads/`、`avatars/`、`media/`；`ensureDatabaseFile()` 滚动备份 + 全零/损坏自愈 | `services/paths.ts`、`services/db-persistence.ts` |
| 数据库 | `AppDataSource.initialize()`（sqljs 驱动，`synchronize: true` 自动建表） | `data-source.ts` |
| 种子数据 | `seedRootAdmin()`：按 **role** 查找而非 username，避免 root 改名后重启又建一个超管 | `index.ts` |
| 状态恢复 | `roomStateService.initFromDb()` 遍历 `status='active'` 房间：恢复 movies、从 `PlaybackState` 恢复 `currentMovieId`、`playbackMemoryService.refreshCache()` | `modules/room/room-state.service.ts` |
| HTTP 装配 | `trust proxy` → `cors`（`credentials: true`）→ `express.json({ limit: '1mb' })` → `cookieParser` → 流量日志（`res.on('finish')` 记录 `/api/` 状态码与字节数）→ 路由 → 静态资源 | `index.ts` |
| 内嵌服务 | `startNcmApiService()`（绑 `127.0.0.1`，失败仅告警，音乐接口 503 降级）；`nmsService.start(io)`（RTMP/FLV） | `modules/music/ncm-api.service.ts`、`modules/stream-push/nms.service.ts` |
| 实时层 | 创建 `SocketIOServer`（`maxHttpBufferSize: 20MB`，大字幕同步必需）→ 注入 io → 注册 20 个 handler → 挂 `io.on('connection')` | `index.ts` |
| 后台任务 | 无人房间清理（1h 周期 + 启动立即一次）；`playbackBroadcasterService.start(io)`（2s 服务器心跳 + 30s 陈旧缓存清理） | `index.ts`、`modules/playback-memory/playback-broadcaster.service.ts` |
| 监听 | `httpServer.listen({ port, host? })`，`EADDRINUSE` 明确提示后 `exit(1)` | `index.ts` |
| 优雅退出 | `SIGTERM`/`SIGINT` → `playbackMemoryService.flushAllDirty()`（最多丢 2s 脏数据）→ `stopNms()` → `stopNcmApiService()` → `exit(0)` | `index.ts` |

### 6.2 前端启动与初始化

```
main.tsx
 ├─ initClientLogger()                # 控制台/异常上报通道
 ├─ installMediaDebugProbe()          # 可选媒体探针
 └─ render(<BrowserRouter><ThemeProvider><App/></ThemeProvider></BrowserRouter>)
      └─ App.tsx
           ├─ useBackendHealth()      # 重连后对比 /health.startedAt，检测后端自动重启
           ├─ fetchSettings()         # GET /api/auth/public-settings
           ├─ <AuthInitializer/>      # 鉴权引导（见 5.2）
           └─ <Routes/> → RequireAuth → RoomPage
                └─ useSocket()        # autoLoginStatus==='done' 才建连（全局单例）
```

`RoomPage` 挂载后的动作顺序（`modules/room/RoomPage.tsx`）：

1. `roomId` 变化 → 重置 `roomStore`、弹幕 store；切换房间且旧房间是本人为房主时先 `emit('host-leave')`；设置 `activeRoomId`、`clientLoggerRoomId`；`loadDanmakuTracks()` + `loadDanmakuMeta()`。
2. 注册 `room-closed` 与 `disconnect` 兜底：收到 `room-closed` → `dispatchRoomMediaTeardown(true)` 停掉本机全部媒体流并退回 `/room`；`disconnect` → 仅暂停媒体（重连后由同步流程恢复）。
3. 注册 `danmaku-tracks-updated`、`danmaku-meta-updated`、`room-name-updated` 监听。
4. 若 `isHostOfRoom(roomId)`（`sessionStorage['zcontrol-host-room']` 标记）→ `emit('register-host', { roomId }, cb)`；回调完成后 `setHostRegistered(true)`，此时才渲染 `WatchTogetherPanel`，确保 `useWatchTogether` 挂载时 `initialPlayback` 已就绪。
5. 观众则渲染 `WatchPage`（`modules/screen-sharing`），由它完成加入与模式切换。

### 6.3 链路一：创建房间 → 房主注册

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

返回的 `data` 走标准 `AckResponse` 结构，业务字段在 `data` 内——前端 `register-host` 回调解析时同样按此约定取值。

### 6.4 链路二：观众加入房间

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
  │    ├─ viewerListService.sendExistingViewers()     → 给新人补发其他在线观众
  │    └─ viewerListService.sendModerators()          → 推送房管列表（权限 UI 初始化）
  └─ 未批准：io.to(sharer.socketId).emit('join-request', { viewerSocketId })
     房主端 approve-join / reject-join → 批准后 userId 写入 approvedViewers 永久免审批
```

数据流转要点：**运行时状态（`roomStateService`）是唯一读取源**，影片列表与当前影片都从内存副本直接读，不查库；`sentCachedSubtitle` 的存在解释了「观众中途加入也能看到字幕」。

### 6.5 链路三：播放同步（房主 → 服务器 → 观众）

这是整个项目最核心的数据流，完整链路分四段：

**① 房主侧采集与广播**（`frontend/src/modules/sync-playback/hooks/`）

| Hook | 职责 | 关键参数 |
|---|---|---|
| `useVideoEventBindings` | 绑定 `play/pause`（防抖 100ms）、`seeked`（防抖 300ms）、`ratechange`（立即）；**`timeupdate` 不广播** | `constants.ts` |
| `useHostBroadcast` | 与上次状态浅比较 → `computeStateDiff` → `emit('watch-together-state', { state, diff, seq })`；`sendControl()` 发 `watch-together-control` | `currentTime` 差 ≤ 2s 视为等价跳过 |
| `useHostHeartbeat` | 每 5s 发 `host-heartbeat`；事件抑制期发 `suppressed: true` 的存活心跳 | 抑制为计数式租约（5 分钟过期） |
| `useHostStateRequest` | 响应观众的 `watch-together-request-state` | — |
| `useHostSync` | 组合以上四个，对外暴露 `broadcastState / sendControl / forceSync` | — |

**② 服务器侧处理**（`backend/src/modules/playback-memory/`）

```
PlaybackMemoryHandler.register()          playback-memory.handler.ts
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

> 注意 `state` 与 `control` 的持久化时序**故意相反**：state 是权威快照必须落盘，control 是低延迟离散操作优先广播。改这两处前请先读 handler 注释。

**③ 观众侧对齐**（`frontend/src/modules/sync-playback/hooks/`）

`useViewerSync` 组合三个子 hook，职责分离是设计核心：

- `useViewerStateSync` **只管离散字段**：`sourceUrl` 变化才重建播放流（以 `state.currentTime` 为起点）、`isPlaying` 变化才 play/pause、`playbackRate` 变化才设倍速——**`currentTime` 永远不随状态事件设置**。seq 跳号（`payload.seq > lastSeq + 1`）触发丢弃增量并请求全量自愈。
- `useViewerHeartbeat` **驱动进度**，两阶段策略（`services/seek-strategy.ts`）：差值 ≤ `max(3s, rate × 0.5)` 忽略；≤ 6s 软同步（倍速提到 `baseRate + 0.1`，封顶 2.0）；> 6s 硬 seek。
- `usePlaybackStateRequest`（`modules/playback-memory`）观众加入时从服务器拿推算后的初始状态，**不依赖房主响应**；完成后写 `lastAppliedSourceUrlRef`，避免后续同源 state 重复 attach 覆盖已缓冲的 blob 源。

seek 统一入口为 `services/seek-service.ts` 的 `executeSeek`：目标在缓冲区内或缺口 ≤ 10s 走普通 seek，否则 MSE Range seek（不重建 MediaSource），结束后补发合成 `seeked` 事件保证外推基线新鲜。

**④ 房主离线后服务器接管**（`modules/playback-memory/playback-broadcaster.service.ts`）

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

`isHostOnline()` 的双条件（`hostSocketId` 非空 **且** `io.sockets.sockets.has(...)`）是这里的正确性前提。

### 6.6 链路四：添加影片（REST 写 → Socket 广播）

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

这条链路是「**DB 为真源 → 内存副本同步 → 广播 → 前端镜像**」的标准范式，新增任何列表类数据（弹幕轨道、房管列表、音乐队列）都建议照此实现。

### 6.7 链路五：视频源解析与播放

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

### 6.8 房间生命周期与清理

| 阶段 | 触发 | 行为 | 代码位置 |
|---|---|---|---|
| 房主暂离 | `host-leave` | 结束 sharer session、`updateHostSocket(roomId, null)`、广播 `host-disconnected`、启动 10 分钟重连定时器、socket leave（不断连） | `room-lifecycle.handler.ts` |
| 重连 | `register-host` | 复用 session、`socket.join`、恢复 `hostSocketId`、返回推算后的 playback | `room-session.service.ts` |
| 超时关房 | 重连定时器（10 分钟） | `closeRoomAndNotify()`：`status='closed'` → 结束 sessions → 失效权限缓存 → 广播 `room-closed` → 清运行时状态与播放记忆 → 踢出其他 socket | `room-state.service.ts` |
| 主动关房 | `close-room` / `admin-close-room` | 同上，且房主 socket 自己 leave | `room-lifecycle.handler.ts` |
| 无人清理 | 每 1h | `cleanupInactiveRooms()` → `deleteRoomAndRelations()`（**删除顺序有外键约束**：PlaybackState 必须先于 Room 删除） | `index.ts` |
| 陈旧缓存 | 每 30s | `cleanupStaleCache()` + `cleanupStaleStates()`（房主离线且超 10 分钟） | `playback-broadcaster.service.ts` |

`closeRoomAndNotify` 与 `deleteRoomAndRelations` 都遵循同一条兜底原则：**先广播 `room-closed` 再断开 socket**。若只断连不广播，客户端会自动重连并继续播放，浏览器持续请求媒体分片，服务端相应持续代理上游流量——房间已删但流量仍在跑。

---

## 七、数据流转总览

把上面几条链路压缩成一张表，便于形成整体直觉：

| 数据 | 写入路径 | 权威读取源 | 广播事件 | 持久化 |
|---|---|---|---|---|
| 影片列表 | REST（SQLite 直写） | 内存副本 → 广播 | `movie-list` | `Movie` 表 |
| 当前影片 | Socket / REST | 内存副本 + `PlaybackState.currentMovieId` | `current-movie` | `PlaybackState` |
| 播放状态 | Socket（房主 state/control） | `PlaybackMemoryService` 内存（推算） | `watch-together-state` / `watch-together-control` | `PlaybackState`（2s 节流） |
| 播放进度基线 | Socket 心跳（5s） | 同上（10s 节流落盘） | `host-heartbeat` / `sync-heartbeat` | `PlaybackState.lastUpdatedAt` |
| 房主离线进度 | 服务器推算（2s） | `PlaybackMemoryService` | `server-heartbeat` / `sync-heartbeat(source:'server')` | 无（仅内存推算） |
| 字幕轨道 | Socket（房主广播） | `RoomRuntimeState.subtitle` 缓存 | `subtitle-update` | 不落盘（观众补发用） |
| 弹幕轨道 | REST + Socket | `DanmakuTrack` 表 | `danmaku-tracks-updated` | `DanmakuTrack` |
| 弹幕辅助数据 | REST + Socket | `RoomDanmakuMeta` 表 | `danmaku-meta-updated` | `RoomDanmakuMeta` |
| 成员 / 房管 | Socket | `Session` 表 + `Room.moderators` | `viewer-joined` / `viewer-left` / `moderators-changed` | `Session` / `Room` |
| 音乐队列 | Socket + REST | `MusicQueueItem` 表（单表双源） | 音乐同步事件组 | `MusicQueueItem` |

一条通用规律：**广播的数据一律来自后端权威副本（内存或 DB），前端 store 只是镜像**。这样多端天然一致，也让「房主刷新 / 观众中途加入 / 服务器重启」三个场景都有确定的恢复路径。

---

## 八、二次开发指南

### 8.1 新增一个 Socket 事件处理器

1. 在对应模块下建 `handlers/xxx.handler.ts`，实现 `SocketEventHandler`：

```ts
import { type SocketEventHandler, type AckCallback, safeAck } from '../../socket';
import type { Server as SocketIOServer, Socket } from 'socket.io';

export class XxxHandler implements SocketEventHandler {
  readonly name = 'xxx';
  register(socket: Socket, io: SocketIOServer): void {
    socket.on('xxx-event', async (payload: XxxPayload, callback?: AckCallback) => {
      try {
        // 1. 权限校验（复用 roomPermissionService）
        // 2. 调 Service 落库 / 更新内存
        // 3. io.to(roomId).emit(...) / socket.to(roomId).emit(...)
        safeAck(callback, { success: true, data: { … } });
      } catch (err) {
        console.error('[xxx] error:', err);
        safeAck(callback, { success: false, message: '操作失败' });
      }
    });
  }
}
```

2. 在模块 `index.ts` 中导出。
3. 在 `backend/src/index.ts` 的 `socketRegistry.add(...)` 链上追加一行。
4. 前端在 `modules/sync-playback/constants.ts` 的 `SOCKET_EVENT` 中登记事件名（若属于同步协议），否则在对应模块内定义常量。

**不需要**改动 `io.on('connection')`、不需要新增注册点——这正是 `SocketRegistry` 的设计目的。

### 8.2 新增一个 REST 接口

1. 判断归属：跨域通用能力放 `routes/`，领域内能力放 `modules/<domain>/<domain>.routes.ts`。
2. 鉴权：全局挂 `router.use(authenticateToken)`；管理端点加 `adminOnly` / `requireRoot`。
3. 逻辑：**不在路由里写重逻辑**，下沉到 Service。
4. 若改动了会被其他端感知的数据，调用对应的 Broadcaster（如 `movieBroadcasterService.broadcastMovieList`）。
5. 响应格式：成功 `{ success: true, data? / <具名字段> }`，失败 `{ success: false, message }`；流式接口用 NDJSON（参考 `routes/stream/resolve.ts` 的 `NdjsonWriter`）。

### 8.3 新增一个播放引擎

1. 在 `frontend/src/modules/player/engines/` 下实现 `PlayerEngine`：

```ts
export const myEngine: PlayerEngine = {
  type: 'xxx' as EngineType,
  async attach(video, source) {
    resetVideoElement(video);
    // …设置 src / 挂 MediaSource…
    return { cleanup: () => { /* 释放实例 / revokeObjectURL */ } };
  },
};
```

2. 在 `types.ts` 的 `EngineType` 联合类型中登记。
3. 在 `engine-selector.ts` 的 `ENGINES` 表中注册，并在 `selectEngine()` 中给出选择条件（顺序有意义）。
4. 若引擎需要对外暴露 seek 能力，实现 `PlayerController` 接口并在 `attach` 结果的 `player` 字段返回。
5. 在 `player/index.ts` 视需要导出；更新[视频源与 API 获取逻辑](/advanced/video-pipeline)的引擎选择表。

### 8.4 新增前端功能模块

```
modules/<feature>/
├── api.ts         # REST 调用（统一走 @/lib/api 的 apiFetch）
├── types.ts       # 类型
├── components/    # UI（只渲染，不直接发请求）
├── hooks/         # 业务编排
└── index.ts       # 公共 API 出口
```

状态优先放 `store/`，或用模块内 hook 局部持有；跨模块共享的状态才上升到 store。

### 8.5 常见陷阱

| 陷阱 | 表现 | 规避 |
|---|---|---|
| **破坏依赖方向** | 从子模块 import 根 `index.ts` → 循环依赖、启动报 `undefined` | 共享 Service 下沉到 `services/`（`system-settings.ts` 就是这么抽出来的）；必须引时用动态 `import()` |
| **广播与持久化时序搞反** | 观众看到状态回跳 / seek 后暂停抖动 | `state` 先持久化后广播，`control` 先广播后持久化（见 6.5-②） |
| **删除顺序不当** | SQLite 抛 `FOREIGN KEY constraint failed` | `PlaybackState` 必须先于 `Room` 删除（`deleteRoomAndRelations` 注释） |
| **只断连不广播** | 房间已删但服务器仍在代理流量 | 关房一律先 `emit('room-closed')` 再 `disconnect` |
| **本地改 state** | 多端列表不一致 | 写操作后等广播刷新（`roomStore` 约定） |
| **依赖 isHostOnline 的旧 socket id** | 后端重启后服务器心跳永不接管 | 必须走 `playbackMemoryService.setIo(io)` + 双条件判定 |
| **新增 handler 忘了注册** | 事件静默无响应 | 检查 `socketRegistry.add(...)` 链 |
| **dev 下新增依赖触发 worker 404** | `Playback worker crashed` | 需要独立 worker 的包加入 `optimizeDeps.exclude` |

### 8.6 调试手段

- **前端**：`window.__debugSocket` 暴露全局 socket 实例；`localStorage.zviewer-media-debug = '1'` 启用媒体探针（`__mediaDump()` 导出）。
- **日志**：前端 console 与未捕获异常自动上报到后端 `log/frontend-console.log`（`initClientLogger`）；后端对 `/api/` 请求打印 `[req] METHOD STATUS SIZE ELAPSEDms PATH`，可直接区分代理流量与解析流量。
- **健康检查**：`GET /health` 返回 `startedAt` / `restartCount`，前端 `useBackendHealth` 据此提示后端自动重启。
- **数据库**：`config/dev.sqlite` 是标准 SQLite 文件，可用任意 SQLite 工具直接打开查看。

---

## 九、延伸阅读

- [架构总览](/advanced/) — 进程模型、端口、状态分层、设计要点
- [房间同步逻辑](/advanced/sync) — 事件清单、房主同步模型、观众对齐算法、控制权申请
- [视频源与 API 获取逻辑](/advanced/video-pipeline) — B站解析链、代理层、播放引擎、字幕与弹幕
- [一起听音乐管线](/advanced/music-pipeline) — NCM 内嵌服务、音质降级链、队列模型
- [ZViewerCLI 代理协议](/advanced/cli-protocol) — 全局注册、归属过滤、代理链路
- [主题系统实现](/advanced/theme-system) — Monet 色板、对比度算法、玻璃拟态变量
- [鉴权与权限模型](/advanced/auth) — JWT 双 token、角色叠加、登录态边界
- [REST API 参考](/advanced/api) / [环境变量](/advanced/env) / [构建与更新机制](/advanced/build-update)
