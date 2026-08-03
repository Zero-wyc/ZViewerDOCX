# 环境变量

## 后端

| 变量 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址（`::` 表示双栈） | 空（双栈监听） |
| `NODE_ENV` | 运行环境 | `production` |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `DATABASE_URL` | SQLite 文件路径或 PostgreSQL 连接串 | `<config>/dev.sqlite` |
| `UPLOADS_DIR` | 上传文件目录 | `<config>/uploads` |
| `AVATARS_DIR` | 头像目录 | `<config>/avatars` |
| `MEDIA_DIR` | NMS 推流媒体临时目录 | `<config>/media` |
| `CORS_ORIGIN` | CORS 允许来源，多个用逗号分隔（`false` 关闭） | `*` |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产必须修改） | — |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产必须修改） | — |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `7d` |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口 | `3335` |

### 代码中使用的额外变量

| 变量 | 说明 |
|---|---|
| `HTTPS=true` | 启用 HTTPS 模式，并顺带托管前端静态文件 |
| `SSL_CERT_PATH` / `SSL_KEY_PATH` | 证书 / 私钥路径 |
| `RESTART_COUNT` | supervisor 传入，用于前端判断后端是否自动重启 |
| `SERVER_HOST` | 生成 RTMP 地址时优先使用的主机名 |

## 前端构建

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API / Socket.IO 基础地址，留空时使用 `window.location.origin` | — |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流基础地址 | — |

生产环境若经 Nginx 反代 `/live` 路径，`VITE_FLV_BASE_URL` 留空使用同源地址即可。

## PostgreSQL（可选）

如需切换 PostgreSQL，配置以下变量并同步修改 `backend/src/data-source.ts`：

- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT`
- `DATABASE_URL`（PostgreSQL 连接串）

> 默认 SQLite 方案（sql.js）为纯 JS 实现、无原生模块，单文件 exe 无需编译即可跨平台运行。
