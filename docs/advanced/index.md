# 架构总览

## 进程与端口

```
浏览器（React SPA）
   │  HTTP REST + Socket.IO WebSocket
   ▼
后端（Express，端口 3333，统一入口）
   ├── REST 路由        /api/*        鉴权、房间、挂载、解析、音乐…
   ├── Socket.IO        /socket.io    房间实时同步
   ├── 静态托管          frontend/dist + SPA 回退
   ├── /live 反代       → Node Media Server（内部 3335）
   └── 内嵌 NCM 服务     127.0.0.1:36530（一起听音乐）
RTMP 3334 → Node Media Server → FLV 3335（仅容器/本机内部）
```

- **单进程单端口**：生产模式所有流量走 3333（HTTP 与 HTTPS 二选一），后端统一处理 API、前端静态资源、WebSocket 与 `/live` 反代，无跨域问题。
- **RTMP 3334 独立端口**：RTMP 是 TCP 二进制协议，无法与 HTTP 复用端口；拉流走内部 3335，由后端 `/live` 路径代理对外。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Node.js + Express + TypeScript + Socket.IO |
| 数据库 | TypeORM + sql.js（wasm SQLite，无原生模块），可选 PostgreSQL |
| 流媒体 | Node Media Server（RTMP / HTTP-FLV） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端资源分发） |
| 音乐 | @neteasecloudmusicapienhanced/api（内嵌 HTTP 服务） |
| CLI | Go（独立仓库 ZViewerCLI） |

## 设计要点

- **无原生模块**：sql.js 是 wasm 实现，单文件版可在任意平台直接运行，不需要编译环境。
- **配置集中**：全部状态（数据库、证书、上传、推流切片）在 `config/` 目录，更新不覆盖，备份这一一个目录即可。
- **浏览器承担计算**：字幕提取、MKV 重封装、音轨转码都在浏览器端完成，服务器只做转发与解析，带宽和 CPU 压力集中在必要的流上。

## 分区导航

- [房间同步逻辑](/advanced/sync)
- [视频源与 API 获取逻辑](/advanced/video-pipeline)
- [一起听音乐管线](/advanced/music-pipeline)
- [ZViewerCLI 代理协议](/advanced/cli-protocol)
- [主题系统实现](/advanced/theme-system)
- [鉴权与权限模型](/advanced/auth)
- [REST API 参考](/advanced/api)
- [环境变量](/advanced/env)
- [构建与更新机制](/advanced/build-update)
