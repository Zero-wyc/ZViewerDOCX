---
title: 架构总览
description: ZViewer 整体架构、技术栈与目录结构
---

# 架构总览

## 总体架构

```
┌─────────────────────────────────────────────────────────┐
│                        浏览器（前端）                      │
│   React 应用 · 播放器引擎 · WebRTC · Socket.IO 客户端       │
└──────────────┬────────────────────┬──────────────────────┘
               │ HTTP /api           │ Socket.IO + WebRTC 信令
┌──────────────▼────────────────────▼──────────────────────┐
│                       后端（3333）                        │
│   Express REST API · Socket.IO · 业务模块 · TypeORM       │
│   Bilibili/WebDAV/FTP/OpenList 解析 · 代理 · NMS 推流      │
└──────┬───────────────┬───────────────────┬───────────────┘
       │               │                   │
   ┌───▼───┐      ┌────▼────┐         ┌────▼─────┐
   │ SQLite │      │ 文件系统 │         │ Node Media│
   │ sql.js │      │ config/ │         │ Server   │
   └───────┘      └─────────┘         │ RTMP 3334 │
                                      │ FLV 3335  │
                                      └──────────┘
```

- **HTTP 模式**下，前端静态服务（4173）将 `/api`、`/socket.io`、`/live` 反向代理到后端与 NMS。
- **HTTPS 模式**下，后端（3333）直接提供前端页面。
- **ZViewerCLI**（可选）作为本地代理，在浏览器与 Bilibili CDN 之间转发高画质媒体流。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 后端 | Express · TypeScript · TypeORM · sql.js（wasm SQLite）· Socket.IO · Node Media Server |
| 前端 | React · Vite · Tailwind CSS · Zustand · ArtPlayer · WebRTC |
| 打包 | npm workspaces · tsc · vite · @yao-pkg/pkg（单文件 exe） |
| 部署 | start-prod 脚本 · Docker · GitHub Actions |

## 目录结构

```
ZViewer/
├── backend/              # Express 后端（TypeScript + TypeORM + sql.js）
│   └── src/
│       ├── routes/       # REST API 路由
│       ├── services/     # 业务逻辑（B站解析、代理、更新等）
│       ├── modules/      # 模块化架构（房间、观众、同步等）
│       ├── entities/     # TypeORM 实体
│       ├── middleware/   # 鉴权中间件
│       └── index.ts      # 应用入口
├── frontend/             # React 前端（Vite + Tailwind CSS）
│   └── src/
│       ├── pages/        # 页面组件
│       ├── components/   # 通用 UI 组件
│       ├── modules/      # 功能模块（房间、播放器、视频源等）
│       ├── store/        # Zustand 状态管理
│       └── lib/          # 通用工具（API 封装等）
├── frontend-server/      # 前端静态文件服务（零外部依赖）
├── docker/               # Docker 入口脚本
├── packaging/            # 启动脚本模板
├── scripts/              # 构建与证书工具（build-exe / generate-cert）
└── build-all.js          # 单文件编译脚本
```

## 关键设计

### 模块化后端

后端采用**模块化 Socket 架构**：`backend/src/modules/` 下每个功能一个目录（`room`、`viewer`、`movie`、`sync-playback`、`playback-memory`、`comment`、`cli`、`stream-push` 等），通过 `SocketRegistry` 统一注册事件处理器。

### 实时同步

- 播放状态（播放/暂停/跳转/倍速）通过 Socket.IO 实时广播。
- 房主断线后由**服务器接管广播**（播放记忆机制），观众不中断。

### 多引擎播放器

前端播放器按视频源选择引擎：MSE（DASH）、FLV、HLS、直链，支持缓冲管理（IndexedDB）与 P2P 统计。

### 无原生依赖

后端使用 sql.js（wasm 版 SQLite），全链路纯 JS——单文件 exe 可在任意平台直接运行。

## 阅读顺序

- [后端](/development/backend)：REST 路由、模块、Socket 事件表
- [前端](/development/frontend)：路由、组件、播放器
- [API 参考](/development/api)：REST 端点清单
- [构建与发布](/development/build)：打包、单文件 exe、CI
