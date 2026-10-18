# 环境变量

配置分两类：启动时读取的环境变量，以及运行时可改、存在数据库里的设置。

## 后端

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址 | 空（IPv4/IPv6 双栈） |
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | SQLite 文件路径或 PostgreSQL 连接串 | `<config>/dev.sqlite` |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `CORS_ORIGIN` | CORS 允许来源，逗号分隔 | `*` |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产宜显式设置） | 自动生成并写入 `config/jwt-secrets.json` |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产宜显式设置） | 同上 |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `30d`（guest 恒为 1h / 7d） |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口（内部，经 `/live` 反代） | `3335` |
| `STREAM_PUSH_ENABLED` | 设为 `0` 时完全不启动推流服务，不监听 3334/3335 | 开启 |
| `SERVER_HOST` | 生成 OBS 推流地址时使用的主机名 | 空（取请求 Host 去端口） |
| `ENABLE_LOGIN_LOCK` | 登录失败锁定（5 次锁 15 分钟） | 关闭 |

单文件版的配置写在 `config/` 下的环境文件；Docker 用 `-e` 或 compose `environment` 注入。

**JWT 密钥自举**：未设环境变量时读 `config/jwt-secrets.json`（长度 ≥32 才采信），仍无则自动生成 64 位 hex 写回。生产环境固定密钥可避免重启后登录态失效。

## 语音聊天（LiveKit）

语音由内嵌 LiveKit 承载，默认无需配置：信令经 `/rtc` 反代，媒体走 `3333/udp`，公网 IP 经 STUN 自动发现。以下变量用于特殊网络环境。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `LIVEKIT_API_KEY` | 接入凭证签名密钥 | `devkey` |
| `LIVEKIT_API_SECRET` | 接入凭证签名密钥 | `zviewer-dev-secret` |
| `LIVEKIT_API_HOST` | 服务端 API 与 `/rtc` 反代的上游地址 | `http://127.0.0.1:3336` |
| `LIVEKIT_URL` | 客户端连接地址；留空按请求头推导，跟随页面域名与协议 | 空（自动推导） |
| `LIVEKIT_EXTERNAL` | 设为 `1` 跳过内嵌服务，连接外置 LiveKit | `0` |
| `LIVEKIT_BIND` | 内嵌服务监听地址 | `::`（双栈） |
| `LIVEKIT_NODE_IP` | ICE 广播地址；留空时自动 STUN 发现（需可出网），NAT 复杂环境可手动指定公网 IP | 空（自动） |
| `LIVEKIT_RTC_TCP_PORT` | TCP 传输模式的 ICE/TCP 端口（模式在管理端「基础设置 → 语音传输模式」切换） | `3337` |
| `LIVEKIT_TURN_DOMAIN` | TURN/TLS 域名，与下面两项同时设置时启用 5349 兜底中继 | — |
| `LIVEKIT_TURN_CERT` | TURN TLS 证书路径（必须正式证书） | — |
| `LIVEKIT_TURN_KEY` | TURN TLS 私钥路径 | — |

UDP 直连与 TURN 中继并行尝试，TURN 只作兜底，不影响直连延迟。完整关系见[语音聊天链路](/advanced/voice)。

## 前端构建

构建期变量在打包时写进产物，运行时改不了。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API / Socket.IO 基础地址 | 空（`window.location.origin`） |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流地址 | `/live`（后端反代到 NMS） |
| `VITE_RTMP_PORT` | OBS 推流端口提示 | `3334` |

开发模式下 Vite 会把 `/api`、`/socket.io`、`/live` 代理到后端，无需配置 `VITE_API_URL`。运行时可在顶栏「自定义后端地址」覆盖，值存于 localStorage：`zviewer-custom-api-url`、`zviewer-custom-socket-url`、`zviewer-custom-flv-base-url`、`zviewer-custom-rtmp-port`。

## 数据库切换

```
# SQLite（默认，文件路径）
<config>/dev.sqlite

# PostgreSQL（连接串）
postgres://user:password@host:5432/zviewer
```

切换后首次启动自动建表。SQLite 数据需手动迁移（标准格式，可用常规工具导出导入）；驱动 sql.js 为 wasm 实现，无需原生编译。

## 运行时可调项（管理后台）

这些设置存库、经管理后台修改：注册模式、建房模式、权限矩阵、功能开关（`dashDisabled` / `playsvideoEnabled` / `betaFeaturesEnabled`）、无人房间自动清理（`autoDeleteInactiveRooms` + `autoDeleteAfterHours`，默认 24 小时）、预发布更新接收。通过 `/api/admin/settings` 修改，前端启动时经 `/api/auth/public-settings` 拉取。
