---
title: 后端
description: 后端结构、路由、模块、实体与 Socket.IO 事件
---

# 后端

技术栈：**Express + TypeScript + TypeORM + sql.js（wasm SQLite）+ Socket.IO + Node Media Server**。入口为 `backend/src/index.ts`（引导 Express/Socket.IO、播种 root 账号、HTTPS 支持、NMS 启动）。

## 目录结构

```
backend/src/
├── index.ts        # 应用入口（路由挂载、Socket 鉴权、NMS 启动）
├── routes/         # REST API 路由
│   ├── auth.ts     # 认证
│   ├── admin.ts    # 管理后台
│   ├── rooms.ts    # 房间
│   ├── stream/     # 流媒体（proxy / resolve / bilibili-auth / ftp）
│   ├── danmaku.ts  # 弹幕源
│   ├── animeSources.ts / anisubs.ts / kazumi.ts  # 番剧聚合源
│   ├── webdav.ts / ftp.ts / openlist.ts          # 挂载源
│   ├── serverFiles.ts  # 服务器文件（root）
│   ├── updater.ts      # 系统更新（root）
│   ├── cli.ts          # ZViewerCLI 解析接口
│   └── client-logs.ts  # 客户端日志上报
├── services/       # 业务逻辑
│   ├── bilibili/   # B站解析（resolver/playurl/wbi/permission/cdn/video/bangumi/danmaku）
│   ├── danmaku/    # 弹幕 provider（bilibili / bahamut / dandanplay）
│   ├── anime/ anisubs/ kazumi/   # 番剧聚合源
│   ├── webdav.ts / ftp.ts / openlist.ts
│   ├── proxy/      # 媒体代理（http-proxy / range-stream / mount-proxy）
│   ├── ffmpeg/     # ffmpeg 检测/下载/合并
│   ├── screen-sharing/  # WebRTC 信令 + 语音
│   ├── stream-push/     # NMS 生命周期
│   └── updater/ paths/ system-settings/ 等
├── modules/        # 模块化 Socket 架构
│   ├── room/           # 房间生命周期/设置/断线
│   ├── viewer/         # 观众加入/管理
│   ├── movie/          # 影片列表/预览 + 路由
│   ├── sync-playback/  # 播放同步（心跳/跳转审批）
│   ├── playback-memory/# 播放记忆 + 服务器接管广播
│   ├── comment/        # 评论/弹幕/标注
│   ├── cli/            # CLI 代理注册
│   ├── stream-push/    # NMS 推流
│   ├── socket/         # SocketRegistry 统一注册
│   └── shared/dto/     # 共享 DTO
├── entities/       # TypeORM 实体（User/Room/Session/Movie/PlaybackState/Comment/...）
└── middleware/     # 鉴权（authenticateToken / requireRoot）
```

## 鉴权

- `authenticateToken`：解析 JWT（httpOnly cookie），校验 Access Token；支持刷新。
- `requireRoot`：root 专属接口。
- 管理路由：`adminOnly`（root/admin）+ `rootOnly`（root）。
- Socket.IO 连接鉴权：cookie 解析 token；`zcontrol-cli` agent 免 token 放行。
- 房间控制权：`canControlRoom`（root 或房主）。

## Socket.IO 事件

### 客户端 → 服务端（接收）

**房间生命周期**

| 事件 | 说明 |
| --- | --- |
| `create-room` | 创建房间 |
| `register-host` | 注册为房主 |
| `request-join` / `approve-join` / `reject-join` | 加入审批 |
| `kick-viewer` / `mute-viewer` / `unmute-viewer` | 观众管理 |
| `transfer-host` | 移交房主 |
| `admin-close-room` / `close-room` | 关闭房间 |
| `update-room-name` / `update-room-mode` / `update-room-settings` | 房间配置 |
| `p2p-mode-change` / `viewer-ready` / `sharer-ready` / `host-heartbeat` | 状态 |
| `disconnect` | 断开 |

**播放同步**

| 事件 | 说明 |
| --- | --- |
| `watch-together-state` / `watch-together-request-state` / `watch-together-control` | 一起看状态 |
| `track-change` | 切换音轨 |
| `seek-request` / `seek-response` | 跳转申请/确认 |
| `pause-request` / `pause-response` | 暂停申请/确认 |
| `play-request` / `play-response` | 播放申请/确认 |

**影片**

| 事件 | 说明 |
| --- | --- |
| `add-movie` / `remove-movie` / `play-movie` | 影片管理 |
| `request-movie-list` / `request-current-movie` | 列表/当前影片 |
| `play-preview-source` | 播放预览源 |

**互动**

| 事件 | 说明 |
| --- | --- |
| `send-comment` / `comment-history` | 评论 |
| `send-danmaku` | 弹幕 |
| `annotation-stroke` / `clear-annotations` | 画面标注 |

**WebRTC 屏幕共享 / 语音**

| 事件 | 说明 |
| --- | --- |
| `signal-offer` / `signal-answer` / `signal-ice-candidate` | 屏幕共享信令 |
| `voice-join` / `voice-leave` / `voice-set-bitrate` | 语音加入/离开/比特率 |
| `voice-offer` / `voice-answer` / `voice-ice-candidate` | 语音信令 |

**推流 / CLI**

| 事件 | 说明 |
| --- | --- |
| `update-share-method` | 切换共享方式 |
| `query-stream-push-availability` | 查询推流可用性 |
| `cli-register` / `cli-list-agents` | CLI 代理注册 |

### 服务端 → 客户端（广播）

| 事件 | 说明 |
| --- | --- |
| `new-comment` / `danmaku` | 新评论/弹幕 |
| `movie-list` / `current-movie` / `preview-source` | 影片更新 |
| `room-closed` / `room-name-updated` / `room-mode-changed` / `room-settings-updated` | 房间变更 |
| `host-disconnected` | 房主断线 |
| `server-heartbeat` | 服务器代播（播放记忆接管） |
| `viewer-joined` / `viewer-left` / `join-approved` / `join-rejected` | 观众事件 |
| `viewer-muted` / `viewer-kicked` / `host-transferred` | 观众管理广播 |
| `stream-status`（live/offline） / `share-method-changed` | 推流状态 |
| `cli-agent-available` / `cli-agent-unavailable` / `cli-agents` / `cli-registered` / `cli-error` | CLI 代理 |
| `voice-user-left` / `sharer-ready` / `track-change` | 其他 |

## 数据模型

见 [数据目录与数据库](/config/data) 的实体表。`Movie.password` 使用 AES 加密存储（`MOVIE_SECRET_KEY`）。

## 扩展开发

- 新增功能模块：在 `modules/` 下建目录，通过 `SocketRegistry` 注册事件。
- 新增 REST 路由：在 `routes/` 下创建，并在 `index.ts` 挂载。
