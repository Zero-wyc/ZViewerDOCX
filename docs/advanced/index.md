# 架构总览

本页说明进程与端口划分、实时事件注册、房间状态分层与全局取舍。各子系统细节见文末导航。

## 进程与端口

一个 Go 后端进程承担 API、前端静态资源与实时通信，另有一个 LiveKit 伴生进程负责语音媒体。

```
浏览器（React SPA）
   │  HTTP REST + Socket.IO
   ▼
zviewer-backend（Go，:3333，统一入口）
   ├── REST /api/*            鉴权、房间、挂载、解析、音乐…
   ├── Socket.IO /socket.io   房间实时同步
   ├── 静态托管                frontend/dist + SPA 回退
   ├── 内置媒体服务            RTMP 3334 → HTTP-FLV 3335（进程内）
   ├── /live 反代              → 3335
   ├── /rtc 反代               → livekit-server 信令 3336
   └── 网易云接口              进程内实现，不监听端口
媒体 3333/udp、3337/tcp → livekit-server；TURN/TLS 3338
```

| 端口 | 用途 |
| --- | --- |
| 3333/tcp | 页面、API、WebSocket、`/live` 与 `/rtc` 反代 |
| 3333/udp | 语音媒体 |
| 3334/tcp | OBS RTMP 推流 |
| 3335/tcp | HTTP-FLV 拉流（内部，经 `/live` 对外） |
| 3336/tcp | LiveKit 信令（内部） |
| 3337/tcp | 语音 ICE/TCP |
| 3338/tcp | 语音 TURN/TLS（可选） |

- **单端口 3333**：生产模式所有页面流量走 3333（HTTP 或 HTTPS），无跨域问题。
- **RTMP 3334 独立**：RTMP 无法与 HTTP 复用端口；拉流走内部 3335，由 `/live` 反代，3335 无需暴露。
- **内置媒体服务**：RTMP / FLV 由后端进程内的 Go 实现承担，不依赖外部媒体服务器；`STREAM_PUSH_ENABLED=0` 时 3334/3335 都不监听。
- **网易云接口**：一起听所需接口在进程内实现，没有独立服务地址，也不存在「音乐服务未启动」这种状态。
- **livekit-server 伴生进程**：语音媒体由独立 LiveKit 承载，后端只签发凭证与执行管理动作。见[语音聊天链路](/advanced/voice)。

## 实时事件注册

实时层由 `internal/sio`（Socket.IO 协议的自实现）与 `internal/realtime`（事件总线与广播）组成，业务事件在各域的 `*_handlers.go` 里用 `sc.On(事件名, …)` 注册，每个文件只挂自己的事件名。ack 统一为 `{ success, message?, code?, data? }`。

连接鉴权在握手阶段完成，JWT 取用分两种：

- `handshake.auth.agent === 'zcontrol-cli'` 直接放行并标记为 CLI 代理，见 [CLI 代理协议](/advanced/cli-protocol)。
- 其余按 **cookie → `handshake.auth.token` → `handshake.query.token`** 顺序校验，失败拒绝握手。

## 状态分层：内存权威副本 + 节流落盘

| 层 | 载体 | 特点 |
| --- | --- | --- |
| 运行时权威副本 | 内存中的房间状态 | 影片列表、当前影片、播放状态、字幕缓存；读永远走内存 |
| 播放记忆 | 内存 + `PlaybackState` 表 | 状态写入节流 2s、心跳兜底 10s；退出前冲刷，最多丢 2s |
| 持久化 | Room / Movie / PlaybackState / MusicQueueItem 等表 | 重启后从库里恢复 |

播放进度靠一条推算公式：

```
actualCurrentTime = currentTime + (Date.now() - lastUpdatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
```

超过 duration 时收敛为 `currentTime = duration, isPlaying = false`。房主短暂断线时服务器凭此继续推算，观众不中断；房主重连后取回状态继续担任同步源。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Go 1.26，`net/http` + 自实现的 Socket.IO 协议 |
| 桌面壳 | Go + Wails（Windows，`desktop/`） |
| 数据库 | SQLite（纯 Go 驱动、WAL），SQL 手写，无 ORM |
| 流媒体 | 内置媒体服务（RTMP / HTTP-FLV，进程内） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端分发） |
| 语音 | LiveKit（伴生进程，WebRTC） |
| 音乐 | 进程内网易云接口实现 |
| CLI | Go（独立仓库 ZViewer CLI） |

## 设计取舍

- **零外部依赖**：媒体服务、网易云接口、Socket.IO 协议都在进程内，单文件版丢到任意机器即可运行；服务器端不转码，容器里不需要 FFmpeg。
- **配置集中**：数据库、证书、上传都在 `config/`，更新不覆盖，备份这一个目录即可。
- **计算放浏览器**：字幕提取、容器重封装、音轨转码均在浏览器完成，服务器只做转发与解析。
- **一份数据库口径**：结构只由 `schema.sql` 定义，启动时只校验不建表，缺表直接退出。

## 分区导航

[房间同步](/advanced/sync) · [语音链路](/advanced/voice) · [视频源与 API](/advanced/video-pipeline) · [音乐管线](/advanced/music-pipeline) · [CLI 代理协议](/advanced/cli-protocol) · [主题系统](/advanced/theme-system) · [HTTPS 证书](/advanced/https) · [鉴权与权限](/advanced/auth) · [REST API](/advanced/api) · [环境变量](/advanced/env) · [构建与更新](/advanced/build-update)
