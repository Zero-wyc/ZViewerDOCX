# 项目结构

```
ZViewer/
├── backend/          # Express 后端（TypeScript + TypeORM + sql.js）
│   └── src/
│       ├── index.ts           # 应用入口（bootstrap、路由注册）
│       ├── routes/            # REST API 路由（auth / admin / rooms / stream / ...）
│       ├── services/          # 业务逻辑（B站解析、代理、更新等）
│       ├── modules/           # 模块化架构（房间、观众、同步、弹幕等）
│       ├── entities/          # TypeORM 实体
│       ├── middleware/        # 鉴权中间件（authenticateToken、adminOnly）
│       └── data-source.ts     # 数据源配置（SQLite / PostgreSQL）
├── frontend/         # React 前端（Vite + Tailwind CSS）
│   └── src/
│       ├── App.tsx            # 路由表
│       ├── pages/             # 页面组件
│       ├── components/        # 通用 UI 组件
│       ├── modules/           # 功能模块（房间主界面、共享、观看等）
│       └── store/             # Zustand 状态管理
├── frontend-server/  # 前端静态文件服务（零外部依赖）
├── docker/           # Docker 入口脚本
├── packaging/        # 启动脚本模板
├── scripts/          # 构建 / 证书 / 启动工具脚本
├── dist/             # 构建产物（单文件 exe）
└── build-all.js      # 单文件编译脚本
```

## 后端模块架构

`backend/src/modules/` 采用模块化设计，取代了传统单一 `io.on('connection')` 架构，全部 Socket 事件由 `SocketRegistry` 统一注册：

| 模块 | 职责 |
|---|---|
| `room` | 房间领域核心：状态（Map）、权限校验、会话管理、生命周期 |
| `viewer` | 观众管理：踢出、禁言、审批、转移房主 |
| `movie` | 影片 CRUD、列表广播、预览 |
| `sync-playback` | 同步播放：心跳、轨道同步、进度审批 |
| `playback-memory` | 播放记忆：房主断线后服务端续播 |
| `comment` | 评论 / 批注（含画笔数据） |
| `cli` | ZViewerCLI 本地代理接入 |
| `stream-push` | OBS 推流模式（NMS 生命周期、流密钥、OBS 配置） |
| `socket` | SocketRegistry 统一事件注册 |
| `shared` | 共享 DTO（movie、sync-state） |

## 前端页面

| 路由 | 页面 | 功能 |
|---|---|---|
| `/` | HomePage | 首页仪表盘：开始共享 / 观看入口、连接状态、主题设置 |
| `/login` | LoginPage | 登录 / 注册 |
| `/join` | JoinByRoomIdPage | 输入房间号加入 |
| `/rooms` | RoomsListPage | 浏览并加入可用房间 |
| `/profile` | ProfilePage | 个人资料、B站登录、视频下载 |
| `/admin` | AdminPage | 管理后台 |
| `/share/:roomId?` / `/watch/:roomId?` | — | 房间主界面（ShareRedirect / WatchRedirect 重定向） |
| — | DirectSharePage / DirectWatchPage | P2P 直连共享 / 观看端（手动交换直连码） |

## 数据存储

默认 SQLite（`config/dev.sqlite`，sql.js wasm 实现，标准 SQLite 格式），可选 PostgreSQL。表由 TypeORM 实体生成，核心表：`users`、`rooms`、`sessions`、`movies`、`comments`、`playback_states`、`system_settings`、`user_mounts`、`bilibili_credentials` 等。
