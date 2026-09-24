# 环境变量

## 后端

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址 | 空（IPv4/IPv6 双栈） |
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | SQLite 文件路径或 PostgreSQL 连接串 | `<config>/dev.sqlite` |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `CORS_ORIGIN` | CORS 允许来源，多个逗号分隔 | `*` |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产建议显式设置） | 自动生成并写入 `config/jwt-secrets.json` |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产建议显式设置） | 同上 |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `30d`（guest 恒为 1h / 7d） |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口（内部，经 `/live` 反代） | `3335` |
| `SERVER_HOST` | 生成 OBS 推流地址时使用的主机名 | 空（取请求 Host 去端口） |
| `ENABLE_LOGIN_LOCK` | 启用登录失败锁定（5 次锁 15 分钟） | 关闭 |

单文件版的配置写入 `config/` 目录下的环境文件；Docker 通过 `-e` 或 compose `environment` 注入。

**JWT 密钥自举**：未设环境变量时读 `config/jwt-secrets.json`（长度 ≥32 才采信），仍无则自动生成 64 位 hex 写回文件——首次启动零配置可用，但生产环境固定密钥可避免重启后登录态失效。

## 前端构建

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API / Socket.IO 基础地址 | 空（`window.location.origin`） |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流基础地址 | `/live`（后端反代到 NMS） |
| `VITE_RTMP_PORT` | OBS 推流端口提示 | `3334` |

前端构建期变量在 `npm run build` 时固化，运行时不可改；开发模式经 Vite 代理转发 `/api`、`/socket.io`、`/live` 到后端，无需配置 `VITE_API_URL`。

运行时可在顶栏「自定义后端地址」覆盖，存于 localStorage：`zviewer-custom-api-url`、`zviewer-custom-socket-url`、`zviewer-custom-flv-base-url`、`zviewer-custom-rtmp-port`。

## 数据库切换

`DATABASE_URL` 支持两种形态：

```
# SQLite（默认，文件路径）
<config>/dev.sqlite

# PostgreSQL（连接串）
postgres://user:password@host:5432/zviewer
```

切换后首次启动自动建表；SQLite 数据需自行迁移（`config/dev.sqlite` 为标准 SQLite 格式，可用常规工具导出导入）。sql.js 是 wasm 实现，无需原生编译。

## 运行时可调项（管理后台，非环境变量）

注册模式、建房模式、权限矩阵、功能开关（`dashDisabled` / `playsvideoEnabled` / `betaFeaturesEnabled`）、无人房间自动清理（`autoDeleteInactiveRooms` + `autoDeleteAfterHours`，默认 24 小时）、预发布更新接收等，均存库并通过 `/api/admin/settings` 修改，前端启动时经 `/api/auth/public-settings` 拉取。
