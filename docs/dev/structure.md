# 目录结构

仓库分为三层目录：仓库根（工程与产物）、`backend/src`、`frontend/src`。三层内部划分对应[整体分层设计](/dev/#整体分层设计)中的装配层 / 接口层 / 领域层 / 服务层 / 数据层，以及前端的表现层 / 状态层 / 领域层 / 基础设施层。

---

## 仓库根目录

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

根 `package.json` 的脚本：

| 命令 | 行为 |
|---|---|
| `npm run dev` | `concurrently` 同时起 `dev -w backend` 与 `dev -w frontend`（`--kill-others`） |
| `npm run dev:backend` / `dev:frontend` | 单独起后端 / 前端 |
| `npm run build` | `npm run build -ws` → 前端 `tsc && vite build`，后端 `node scripts/clean-dist.js && tsc` |
| `npm start` | `node scripts/start.js`，转发到 `start-prod.sh` / `start-prod.bat` |
| `npm run build:all` | `node build-all.js`，产出平台单文件 |

`config/` 为唯一需要备份的目录。目录布局与旧版数据迁移逻辑见 `backend/src/services/paths.ts`；部署侧说明见[安装与部署](/basic/install)。

---

## 后端 `backend/src/`

```
backend/src/
├── index.ts            # 应用入口：bootstrap 全量装配（唯一 io.on('connection') 注册点）
├── data-source.ts      # TypeORM DataSource（sqljs 驱动 + 原子写回 + synchronize）
├── entities/           # 15 个 TypeORM 实体
├── middleware/         # auth.ts（JWT 签发/校验/吊销/角色）、rate-limit.ts（限流）
├── routes/             # REST 路由（按业务域分文件 + stream/ 子聚合）
├── modules/            # 13 个领域模块（见「后端架构」）
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

各目录内部的职责划分见[后端架构](/dev/backend)。

---

## 前端 `frontend/src/`

```
frontend/src/
├── main.tsx            # 挂载入口：日志上报、媒体探针、Router + ThemeProvider
├── App.tsx             # 路由表 + AuthInitializer（鉴权引导）
├── index.css           # Tailwind 入口与玻璃拟态变量
├── pages/              # 页面级组件（HomePage / LoginPage / AdminPage / ProfilePage …）
├── components/         # 跨模块通用 UI（Layout / Header / ThemeProvider / RequireAuth…）
├── hooks/              # 全局 hooks（useSocket / useBackendHealth / useSubtitles…）
├── lib/                # 基础设施库（api / authTransport / mkv / monet / api 封装…）
├── modules/            # 23 个功能模块（见「前端架构」）
├── store/              # Zustand 状态（7 个 store）
└── types/ utils/       # 类型与零散工具
```

`vite.config.ts` 有三处非默认配置：

| 配置 | 原因 |
|---|---|
| `dashjs-5-2-0-null-guard` 插件（dev 走 esbuild `onLoad`，build 走 rollup `transform`） | dash.js destroy 后残留回调读取 `getStreamInfo().id` 抛错，改写为可选链；dev 下 dashjs 被内联进预构建产物，常规 transform 不经过 |
| `resolve.alias` 将 `mediabunny` 指向 `./vendor/mediabunny` | playsvideo 依赖 kzahel/mediabunny 的 integration fork，npm 上无对应发布版；vendored 后 dev/build 行为一致 |
| `optimizeDeps.exclude: ['playsvideo']` | esbuild 预打包保留 `new Worker(new URL('./worker.js', import.meta.url))` 但不产出 worker 文件，dev 下 404 报 `Playback worker crashed` |

各目录与模块的职责划分见[前端架构](/dev/frontend)。

---

## 开发环境与端口

```bash
npm install
npm run dev            # 前端 5174（HMR）+ 后端 3333（ts-node-dev --respawn）
```

Vite 代理（`vite.config.ts` → `server.proxy`）将 `/api`、`/uploads`、`/socket.io`（`ws: true`）转发到 3333，`/live` 转发到 3335。开发模式不需要配置 `VITE_API_URL`。

校验命令：

```bash
cd frontend && npx tsc --noEmit        # 类型检查
cd frontend && npx eslint <改动文件>    # 要求 0 错 0 警
cd backend  && npx tsc --noEmit        # 后端类型检查（等价 npm run lint -w backend）
```

环境变量完整清单见[环境变量](/advanced/env)，构建与单文件打包见[构建与更新机制](/advanced/build-update)。

相关页面：[后端架构](/dev/backend)
