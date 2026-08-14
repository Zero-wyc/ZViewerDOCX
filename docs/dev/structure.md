# 项目结构

## 目录概览

```
ZViewer/
├── backend/              # Express 后端（TypeScript + TypeORM + sql.js）
├── frontend/             # React 前端（Vite + Tailwind CSS）
├── scripts/              # 构建 / 证书 / 启动工具脚本
├── docker/               # Docker 入口脚本
├── packaging/            # 启动脚本模板
├── dist/                 # 构建产物（单文件可执行程序）
├── config/               # 运行时配置（自动生成）
├── log/                  # 运行时日志
├── package.json          # 根 package.json（workspaces 配置）
├── build-all.js          # 全量编译脚本
├── start-prod.bat        # 启动脚本（Windows）
└── start-prod.sh         # 启动脚本（Linux/macOS）
```

---

## 后端（backend/）

### 技术栈
- **运行时**：Node.js + TypeScript
- **Web 框架**：Express
- **数据库 ORM**：TypeORM
- **数据库驱动**：sql.js（SQLite wasm 实现）
- **实时通信**：Socket.IO
- **认证**：JWT

### 目录结构

```
backend/src/
├── index.ts               # 应用入口
├── data-source.ts         # 数据库配置
├── routes/                # REST API 路由
│   ├── auth.ts            # 认证
│   ├── admin.ts           # 管理后台
│   ├── rooms.ts           # 房间
│   ├── stream/            # 流媒体代理
│   ├── danmaku.ts         # 弹幕
│   ├── serverFiles.ts     # 服务器文件
│   ├── updater.ts         # 系统更新
│   ├── cli.ts             # CLI 代理
│   ├── webdav.ts, ftp.ts, openlist.ts  # 挂载点管理
│   └── ...
├── modules/               # 模块化架构（核心）
│   ├── room/              # 房间
│   ├── viewer/            # 观众管理
│   ├── movie/             # 影片管理
│   ├── sync-playback/     # 同步播放
│   ├── playback-memory/   # 播放记忆
│   ├── comment/           # 评论批注
│   ├── cli/               # CLI 代理
│   ├── stream-push/       # OBS 推流
│   ├── socket/            # Socket 注册中心
│   └── shared/            # 共享 DTO
├── services/              # 业务逻辑（B站/更新/WebRTC）
├── entities/              # 数据实体
│   ├── User.ts, Room.ts, Session.ts, Movie.ts
│   ├── Comment.ts, PlaybackState.ts
│   ├── SystemSettings.ts, UserMount.ts
│   └── BilibiliCredential.ts
└── middleware/             # 中间件（JWT 鉴权等）
```

---

## 前端（frontend/）

### 技术栈
- **框架**：React 18
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **状态管理**：Zustand
- **路由**：React Router
- **播放器**：ArtPlayer
- **弹幕**：danmaku.js

### 目录结构

```
frontend/src/
├── App.tsx                # 路由定义
├── pages/                 # 页面组件
│   ├── HomePage.tsx       # 首页
│   ├── LoginPage.tsx      # 登录/注册
│   ├── RoomsListPage.tsx  # 房间列表
│   ├── ProfilePage.tsx    # 个人资料
│   └── AdminPage.tsx      # 管理后台
├── components/            # 通用 UI 组件
│   ├── ui/                # 基础组件（Button/Input/Modal 等）
│   ├── Header.tsx         # 顶部导航栏
│   ├── Layout.tsx         # 页面布局
│   ├── CommentPanel.tsx   # 评论/弹幕面板
│   └── ...
├── modules/               # 功能模块
│   ├── room/              # 房间主界面
│   ├── screen-sharing/    # 屏幕共享
│   ├── sync-playback/     # 同步播放
│   ├── player/            # 播放器引擎
│   ├── voice-chat/        # 语音聊天
│   ├── bilibili/          # B站集成
│   ├── mounts/            # 挂载点管理
│   └── ...
├── store/                 # Zustand 状态管理
│   ├── authStore.ts       # 用户认证
│   ├── roomStore.ts       # 房间状态
│   ├── themeStore.ts      # 主题设置
│   └── ...
```

### 页面路由

| 路由 | 页面 | 守卫 |
|------|------|------|
| `/` | 首页 | 无 |
| `/login` | 登录/注册 | 无 |
| `/room/:roomId?` | 房间主界面 | 需登录 |
| `/admin` | 管理后台 | 需 admin/root |
| `/profile` | 个人资料 | 需登录 |
| `/rooms` | 房间列表 | 需登录 |
| `/join` | 输入房间号 | 需登录 |

---

## 数据库

| 表 | 实体 | 说明 |
|----|------|------|
| `users` | User | 用户账号 |
| `rooms` | Room | 房间 |
| `sessions` | Session | 会话历史 |
| `movies` | Movie | 影片 |
| `comments` | Comment | 评论 |
| `playback_states` | PlaybackState | 播放记忆 |
| `system_settings` | SystemSettings | 系统设置 |
| `user_mounts` | UserMount | 用户挂载点 |
| `bilibili_credentials` | BilibiliCredential | B站凭据 |