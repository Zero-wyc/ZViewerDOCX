# 开发教程

> 本分区面向二次开发者：从整体分层设计讲到目录结构、模块职责、依赖协作，再顺着启动初始化与几条关键执行链路看数据如何在模块间流转。读完之后，你应该能独立定位任意一处功能的代码位置，并按既有约定新增模块、路由、事件与播放引擎。
>
> 功能使用见[基础教程](/basic/)，程序运行逻辑与接口细节见[拓展教程](/advanced/)。本分区不重复二者的结论，只讲「代码长什么样、为什么这样组织」。

---

## 项目定位与选型

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

## 整体分层设计

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

### 依赖规则

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

## 本分区目录

- [目录结构](/dev/structure) — 仓库根、`backend/src`、`frontend/src` 三层目录职责，以及开发环境与端口
- [后端架构](/dev/backend) — 装配入口与顺序约束、Socket 事件注册模型、13 个领域模块与三层状态模型、服务层、路由层、数据层
- [前端架构](/dev/frontend) — Provider 树与路由守卫、鉴权引导边界、Socket 单例与降级、Zustand 状态分层、23 个功能模块、播放引擎抽象
- [运行流程](/dev/runtime) — 后端与前端启动初始化，创建房间 / 观众加入 / 播放同步 / 添加影片 / 源解析播放五条关键链路，房间生命周期与数据流转总览
- [二次开发指南](/dev/guide) — 新增 Socket 事件、REST 接口、播放引擎、前端模块的标准步骤，常见陷阱与调试手段

从「代码放在哪」开始读 → [目录结构](/dev/structure)
