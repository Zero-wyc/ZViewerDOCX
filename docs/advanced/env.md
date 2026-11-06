# 环境变量

配置分两类：启动时读取的环境变量，以及运行时可改、存在数据库里的设置。

## 后端

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址 | 空（IPv4/IPv6 双栈） |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `DATABASE_URL` | SQLite 文件路径 | `<config>/dev.sqlite` |
| `CORS_ORIGIN` | CORS 允许来源，逗号分隔 | `*` |
| `TRUSTED_PROXY_CIDRS` | 信任的反代网段，用于按转发头推导地址 | 空 |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产宜显式设置） | 自动生成并写入 `config/jwt-secrets.json` |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产宜显式设置） | 同上 |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `24h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `30d`（guest 恒为 1h / 7d） |
| `SQLITE_WAL` | 设为 `0` 退回 `journal_mode=delete` | WAL |

**JWT 密钥自举**：未设环境变量时读 `config/jwt-secrets.json`，仍无则自动生成写回。生产环境固定密钥可避免重启后登录态失效。

单文件版的配置写在 `config/` 下的环境文件；Docker 用 `-e` 或 compose `environment` 注入。

## 语音与共享媒体

语音与屏幕共享默认是成员之间直连，服务器只承载信令；下列端口由后端的自建媒体面占用，仅在旧语音链路上生效。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `SHARE_MEDIA_PORT` | 媒体 UDP 端口 | `3333` |
| `SHARE_MEDIA_TCP_PORT` | 媒体 TCP 端口。**不能与 `PORT` 同号**（会抢走网页端口）；留空用 3337 | `3337` |
| `SHARE_MEDIA_PUBLIC_IP` | NAT 1:1 下的公网地址（云主机 / FRP 场景必填） | 自动 |

## 推流（OBS）

| 变量 | 说明 | 默认值 |
|---|---|---|
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `STREAM_PUSH_ENABLED` | 设为 `0` 时完全不启动推流服务，不监听 3334 | 开启 |
| `STREAM_PUSH_OFFLINE_GRACE_SECONDS` | 停流后的离线宽限 | `60` |
| `NMS_EMBEDDED` | 设为 `0` 时不内嵌媒体服务（调试外部服务） | 内嵌 |
| `NMS_BIND` | 内嵌 RTMP 的监听地址 | `0.0.0.0` |
| `NMS_HTTP_FLV_URL` | 指定外部媒体服务的 FLV 上游；有值时 `/live` 走反代 | 空（进程内直出） |
| `HTTP_FLV_PORT` | 外部模式的探测端口，仅在无 `NMS_HTTP_FLV_URL` 时生效 | `3335` |
| `SERVER_HOST` | 生成 OBS 推流地址时使用的主机名 | 空（取请求 Host 去端口） |
| `EMBY_CLIENT_NAME` | 访问 Emby 时使用的客户端标识 | 内置默认 |

## 证书与 HTTPS

| 变量 | 说明 | 默认值 |
|---|---|---|
| `HTTPS` | 设为 `true` 以 HTTPS 启动 | 关闭 |
| `SSL_CERT_PATH` / `SSL_KEY_PATH` | 证书与私钥路径 | `config/ssl/cert.pem` / `key.pem` |
| `ZVIEWER_CERT_CHALLENGE_PORT` | ACME HTTP-01 验证端口 | `80` |

证书签发由后端 `--gen-cert` 完成，详见 [HTTPS 证书](/advanced/https)。

## 更新

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ZVIEWER_UPDATE_SOURCE` | 更新源：`github` / `gitcode`（镜像产物仓库） | 镜像 |
| `ZVIEWER_UPDATE_API_BASE` | 自定义清单地址，覆盖内置更新源 | 空 |
| `ZVIEWER_DESKTOP` | 桌面启动台托管标识；为 `true` 时网页端更新接口全部 409 | 空 |

## 前端构建

构建期变量在打包时写进产物，运行时改不了。

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API 基础地址 | 空（`window.location.origin`） |
| `VITE_SOCKET_URL` | Socket.IO 基础地址 | 空（同上） |
| `VITE_FLV_BASE_URL` | OBS 推流模式 FLV 拉流地址 | `/live` |
| `VITE_RTMP_PORT` | OBS 推流端口提示 | `3334` |

开发模式下 Vite 会把 `/api`、`/socket.io`、`/signal`、`/live` 代理到后端，无需配置 `VITE_API_URL`。运行时可在顶栏「自定义后端地址」覆盖，值存于 localStorage。

## 运行时可调项（管理后台）

这些设置存库、经管理后台修改：注册模式、建房模式、权限矩阵、功能开关（`dashDisabled` / `playsvideoEnabled` / `betaFeaturesEnabled`）、无人房间自动清理（`autoDeleteInactiveRooms` + `autoDeleteAfterHours`，默认 24 小时）、更新源、房间界面悬浮入口、默认解析模式。通过 `/api/admin/settings` 修改，前端启动时经 `/api/auth/public-settings` 拉取。
