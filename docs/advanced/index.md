# 架构总览

本页说明整体架构：进程与端口划分、实时事件注册、房间状态分层，以及贯穿全局的设计取舍。各子系统细节见文末分区导航。

## 进程与端口

单进程架构：一个 Go 程序同时承担 API、前端静态资源、实时通信、共享信令与媒体面。

```
浏览器（React SPA）
   │  HTTP REST + Socket.IO WebSocket
   ▼
后端（Go，端口 3333，统一入口）
   ├── REST 路由        /api/*       鉴权、房间、挂载、解析、音乐…
   ├── Socket.IO        /socket.io   房间实时同步
   ├── 共享 / 语音信令    /signal     Piik 协议（房主 token / 观众 grant）
   ├── 静态托管          frontend/dist + SPA 回退
   ├── /live            HTTP-FLV 直出（进程内 NMS）
   └── 一起听           网易云接口进程内直调
RTMP 3334 → 进程内 NMS → /live
媒体 3333/udp + 3337/tcp → 语音与共享中继
```

- **单端口 3333**：生产模式所有流量走 3333（HTTP 或 HTTPS），API、静态资源、WebSocket、`/signal` 与 `/live` 统一在此，无跨域问题。
- **RTMP 3334 独立**：RTMP 无法与 HTTP 复用端口。拉流不占端口：`/live` 校验票据后由进程内媒体服务直出 FLV。
- **媒体面**：语音与屏幕共享默认是成员之间直连（房主为树根），服务器只承载信令。`3333/udp` 与 `3337/tcp` 属于自建媒体面，仅在旧语音链路上生效；媒体 TCP 必须与网页端口分开，同号会把网页端口抢走。
- **一起听**：网易云接口在进程内实现（`backend-go/internal/ncm`），没有外部服务与回环端口。见[一起听音乐管线](/advanced/music-pipeline)。

## 实时事件注册模型

实时事件按域注册（`backend-go/internal/realtime` + 各业务包），每个 handler 只挂自己的事件名，ack 统一为 `{ success, message?, code?, data? }`。新增实时能力只需在对应域注册，不改连接入口。

连接鉴权分两种：

- `handshake.auth.agent === 'zcontrol-cli'` 直接放行并标记 `isCliAgent`，见 [CLI 代理协议](/advanced/cli-protocol)。
- 其余按 **cookie 头 → `handshake.auth.token` → `handshake.query.token`** 顺序校验，失败拒绝握手。

## 状态分层：内存权威副本 + 数据库节流落盘

读写分离：读永远命中内存，写库按节流压缩。

| 层 | 载体 | 特点 |
|---|---|---|
| 运行时权威副本 | 房间内存态 | 影片列表、当前影片、播放状态、字幕缓存；**读永远走内存** |
| 播放记忆 | 内存 + `playback_states` 表 | 状态写入节流 2s、心跳落盘节流 10s；退出前刷盘，最多丢 2s |
| 持久化 | room / movie / playback_states / music_queue_item 等表 | 重启后恢复 |

播放进度靠一条推算公式：

```
actualCurrentTime = currentTime + (Date.now() - lastUpdatedAt) / 1000 × playbackRate × (isPlaying ? 1 : 0)
```

超过 duration 时收敛为 `currentTime = duration, isPlaying = false`。房主短暂断线时服务器凭此继续推算，观众不中断；房主重连后取回状态继续担任同步源。

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| 后端 | Go 1.26 + 标准库 `net/http` + 自研 Socket.IO 协议层 |
| 数据库 | SQLite（`modernc.org/sqlite`，纯 Go，默认 WAL） |
| 流媒体 | 进程内 NMS（RTMP / HTTP-FLV） |
| 语音 / 共享 | Piik 信令（客户端树形直连，服务端中继可选） |
| 音视频 | 浏览器端重封装 / 转码（playsvideo，随前端分发） |
| 音乐 | 进程内网易云接口（`internal/ncm`） |
| CLI | Go（独立仓库 ZViewer CLI） |

## 设计取舍

- **无 cgo**：SQLite 驱动为纯 Go 实现，单文件版任意平台可直接运行；服务器端 FFmpeg 已移除，转码全部前置到浏览器。
- **配置集中**：数据库、证书、上传、切片、JWT 密钥文件都在 `config/`，更新不覆盖，备份这一个目录即可。
- **计算放浏览器**：字幕提取、容器重封装、音轨转码均在浏览器完成，服务器只做转发与解析。
- **JWT 密钥自举**：按「环境变量 → `config/jwt-secrets.json` → 自动生成」三级回退，首次启动无需配置。
- **代理统一出口**：媒体代理、`/live` 直出、防盗链代理共用同一套 Range / 条件请求 / 断连处理。

## 分区导航

[房间同步](/advanced/sync) · [语音链路](/advanced/voice) · [视频源与 API](/advanced/video-pipeline) · [音乐管线](/advanced/music-pipeline) · [CLI 代理协议](/advanced/cli-protocol) · [主题系统](/advanced/theme-system) · [HTTPS 证书](/advanced/https) · [鉴权与权限](/advanced/auth) · [REST API](/advanced/api) · [环境变量](/advanced/env) · [构建与更新](/advanced/build-update)
