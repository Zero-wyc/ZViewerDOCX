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
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产必须修改） | — |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产必须修改） | — |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `7d` |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口（内部） | `3335` |

单文件版的配置写入 `config/` 目录下的环境文件；Docker 通过 `-e` 或 compose `environment` 注入。

## 前端构建

| 变量 | 说明 | 默认值 |
|---|---|---|
| `VITE_API_URL` | API / Socket.IO 基础地址 | 空（`window.location.origin`） |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流基础地址 | — |

前端构建期变量在 `npm run build` 时固化，运行时不可改；开发模式经 Vite 代理转发无需配置。

## 数据库切换

`DATABASE_URL` 支持两种形态：

```
# SQLite（默认，文件路径）
<config>/dev.sqlite

# PostgreSQL（连接串）
postgres://user:password@host:5432/zviewer
```

切换后首次启动自动建表；SQLite 数据需自行迁移（`config/dev.sqlite` 为标准 SQLite 格式，可用常规工具导出导入）。
