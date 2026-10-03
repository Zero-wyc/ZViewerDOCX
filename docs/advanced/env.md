# 环境变量

ZViewer 的配置分两类：启动时读取的环境变量，以及运行时可改、存在数据库里的设置。这一页先列后端和前端的变量，再说明数据库切换与运行时可调项。

## 后端

后端在启动时读取这些变量。未设置时，服务会采用第三列的默认值。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址 | 空（IPv4/IPv6 双栈） |
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | SQLite 文件路径或 PostgreSQL 连接串 | `<config>/dev.sqlite` |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `CORS_ORIGIN` | CORS 允许来源，多个逗号分隔 | `*` |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产环境宜显式设置） | 自动生成并写入 `config/jwt-secrets.json` |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产环境宜显式设置） | 同上 |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `30d`（guest 恒为 1h / 7d） |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口（内部，经 `/live` 反代） | `3335` |
| `STREAM_PUSH_ENABLED` | 设为 `0` 时完全不启动推流服务（NMS），不监听 3334/3335 | 开启 |
| `SERVER_HOST` | 生成 OBS 推流地址时使用的主机名 | 空（取请求 Host 去端口） |
| `ENABLE_LOGIN_LOCK` | 启用登录失败锁定（5 次锁 15 分钟） | 关闭 |

单文件版的配置写入 `config/` 目录下的环境文件；Docker 通过 `-e` 或 compose `environment` 注入。

**JWT 密钥自举**：未设环境变量时读 `config/jwt-secrets.json`（长度 ≥32 才采信），仍无则自动生成 64 位 hex 写回文件。首次启动无需配置；生产环境固定密钥可避免重启后登录态失效。

## 语音聊天（LiveKit）

语音聊天由内嵌的 LiveKit 服务承载（LiveKit 是开源的 WebRTC 实时通信服务）。默认无需任何配置：信令经主端口的 `/rtc` 路径反代，媒体流走 `3333/udp`，公网 IP 经 LiveKit 原生 STUN（一种通过向外部服务查询来自动发现自身公网地址的机制）自动发现。以下变量用于特殊网络环境的调整。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `LIVEKIT_EXTERNAL` | 设为 `1` 时跳过内嵌服务，连接外置 LiveKit | `0` |
| `LIVEKIT_BIND` | 内嵌服务的监听地址 | `::`（双栈） |
| `LIVEKIT_NODE_IP` | ICE 广播地址（告知客户端向哪个地址建立媒体连接）。留空时自动启用 STUN 外部 IP 发现（要求服务器可出网）；NAT 复杂环境可手动指定公网 IP | 空（自动） |
| `LIVEKIT_TURN_DOMAIN` | TURN/TLS 域名。与下面两项证书同时设置时，启用 TCP 5349 兜底中继，供 UDP 被拦截的网络使用；域名寻址不依赖公网 IP | — |
| `LIVEKIT_TURN_CERT` | TURN TLS 证书路径（必须正式证书，自签证书不被浏览器 WebRTC 信任） | — |
| `LIVEKIT_TURN_KEY` | TURN TLS 私钥路径 | — |

UDP 直连与 TURN 中继并行尝试：TURN 只作兜底，不影响直连成功时的低延迟。

## 前端构建

前端构建期的变量在打包时被写进产物，运行时就改不了了。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API / Socket.IO 基础地址 | 空（`window.location.origin`） |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流基础地址 | `/live`（后端反代到 NMS） |
| `VITE_RTMP_PORT` | OBS 推流端口提示 | `3334` |

这些变量在 `npm run build` 时固化，运行时不可改。开发模式下 Vite 会把 `/api`、`/socket.io`、`/live` 代理转发到后端，所以不需要配置 `VITE_API_URL`。

运行时若要改后端地址，可以在顶栏「自定义后端地址」里覆盖，值存于 localStorage：`zviewer-custom-api-url`、`zviewer-custom-socket-url`、`zviewer-custom-flv-base-url`、`zviewer-custom-rtmp-port`。

## 数据库切换

`DATABASE_URL` 接受两种形态，写法见下例。

```
# SQLite（默认，文件路径）
<config>/dev.sqlite

# PostgreSQL（连接串）
postgres://user:password@host:5432/zviewer
```

切换后首次启动会自动建表。SQLite 的数据需要手动迁移（`config/dev.sqlite` 是标准 SQLite 格式，可用常规工具导出导入）。数据库驱动 sql.js 是 wasm 实现，无需原生编译。

## 运行时可调项（管理后台，非环境变量）

这些设置不在环境变量里，而是存在数据库中，通过管理后台修改。注册模式、建房模式、权限矩阵、功能开关（`dashDisabled` / `playsvideoEnabled` / `betaFeaturesEnabled`）、无人房间自动清理（`autoDeleteInactiveRooms` + `autoDeleteAfterHours`，默认 24 小时）、预发布更新接收等，均存库并通过 `/api/admin/settings` 修改，前端启动时经 `/api/auth/public-settings` 拉取。
