---
title: 前端
description: 前端路由、目录结构、状态管理与播放器架构
---

# 前端

技术栈：**React + Vite + Tailwind CSS + Zustand**。入口为 `frontend/src/App.tsx`（路由定义）。

## 路由

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | HomePage | 首页：加入房间 / 房间列表 / 开始共享 |
| `/login` | LoginPage | 登录 / 注册 |
| `/room/:roomId?` | RoomPage | 房间（需登录） |
| `/admin` | AdminPage | 管理后台（adminOnly） |
| `/profile` | ProfilePage | 个人资料（禁 guest） |
| `/rooms` | RoomsListPage | 房间列表 |
| `/join` | JoinByRoomIdPage | 按房间号加入 |
| `/share/:roomId`、`/watch/:roomId` | 重定向 | 旧链接兼容 |

## 目录结构

```
frontend/src/
├── App.tsx           # 路由定义
├── pages/            # 页面组件（Home/Login/Room/Admin/Profile/Rooms/Join）
├── components/       # 通用组件
│   ├── Header/       # 导航 + 设置
│   ├── CommentPanel/ # 评论面板
│   ├── DanmakuLayer/ # 弹幕层
│   ├── AnnotationLayer/ # 画面标注层
│   ├── VideoPlayer/  # 播放器 + 设置面板
│   ├── VideoControls/  # 控制栏
│   ├── ui/           # 基础组件（Modal/Select/Slider/Switch 等）
│   ├── RequireAuth   # 前端角色守卫
│   ├── ThemeProvider # Material You (Monet) 主题
│   └── BackgroundSettingsPanel
├── modules/          # 功能模块（每功能一个目录）
│   ├── room/         # 房间页、影院布局、影片列表、一起看核心
│   ├── player/       # 播放器引擎与工具
│   ├── bilibili/     # B站 API、CLI 代理、清晰度
│   ├── danmaku/      # 弹幕引擎
│   ├── mounts/       # 挂载通用组件（浏览器/表单/管理）
│   ├── webdav/ ftp/ openlist/ direct-link/  # 视频源面板
│   ├── server-files/ # 服务器文件管理 + B站下载
│   ├── sync-playback/ / playback-memory/    # 同步与记忆 hooks
│   ├── voice-chat/   # 语音聊天 hook
│   ├── screen-sharing/ # WebRTC 屏幕共享
│   ├── art-player/   # ArtPlayer 封装
│   └── admin/        # 管理组件
├── store/            # Zustand stores
│   ├── authStore          # 用户/登录态
│   ├── roomStore          # 房间设置/观众/播放状态
│   ├── danmakuStore       # 弹幕轨道+样式
│   ├── themeStore         # 主题
│   ├── systemSettingsStore # 系统设置
│   └── cliAgentStore      # CLI 代理列表
├── hooks/            # useSocket / useCliAgent / useP2PTunnel 等
└── lib/              # api.ts（fetch 封装：401 自动刷新重试、自定义后端地址）
```

## 播放器架构

多引擎播放（`modules/player/engines/`）：

| 引擎 | 用途 |
| --- | --- |
| `dash`（MSE） | Bilibili DASH 音视频合并播放（含 mp4-box-parser） |
| `mse` | 通用 MSE |
| `direct` | MP4 直链播放 |
| `flv` | HTTP-FLV 直播流 |
| `hls` | HLS 流 |

辅助能力（`services/`）：缓冲管理（`buffer-manager`，支持 IndexedDB 缓冲模式）、`mp4-parser`、P2P 统计、URL 代理、Bilibili 下载器。

## 状态管理（Zustand）

- `authStore`：用户信息、登录状态（token 由 httpOnly cookie 管理，不落前端）。
- `roomStore`：房间设置、观众列表、播放状态。
- `danmakuStore`：弹幕轨道与样式。
- `themeStore`：明暗主题、Material You 色板。
- `systemSettingsStore`：系统设置缓存。
- `cliAgentStore`：可用 CLI 代理列表。

## API 层

`lib/api.ts` 统一封装 fetch：

- 401 自动刷新 token 并重试。
- 自定义后端地址存 localStorage（支持 `VITE_API_URL` / `VITE_SOCKET_URL` / `VITE_RTMP_PORT` 覆盖）。
- 前后端分离部署无需额外 CORS 配置（HTTP 模式下经 4173 反向代理）。

## 相关文档

- REST 端点：见 [API 参考](/development/api)
- 环境变量：见 [环境变量](/config/environment)
