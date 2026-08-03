---
title: 环境变量
description: 后端与前端构建的全部环境变量参考
---

# 环境变量

## 后端

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 后端服务端口 | `3333` |
| `HOST` | 监听地址 | `::`（双栈监听） |
| `NODE_ENV` | 运行环境 | `production` |
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config/` |
| `DATABASE_URL` | SQLite 文件路径或 PostgreSQL 连接串 | `<CONFIG_DIR>/dev.sqlite` |
| `UPLOADS_DIR` | 用户上传文件根目录 | `<CONFIG_DIR>/uploads/` |
| `AVATARS_DIR` | 用户头像存储目录 | `<CONFIG_DIR>/uploads/avatars/` |
| `MEDIA_DIR` | NMS 推流媒体临时目录 | `<CONFIG_DIR>/media/` |
| `CORS_ORIGIN` | CORS 允许来源，多个用逗号分隔 | `*` |
| `JWT_ACCESS_SECRET` | Access Token 密钥（生产必须修改） | `dev-access-secret-change-in-production` |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥（生产必须修改） | `dev-refresh-secret-change-in-production` |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `1h`（代码回退值；`.env.example` 预置 `15m`） |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `30d`（代码回退值；`.env.example` 预置 `7d`） |
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口 | `3335` |
| `HTTPS` | 以 HTTPS 模式启动 | — |
| `SSL_CERT_PATH` | 证书链路径 | `config/ssl/cert.pem` |
| `SSL_KEY_PATH` | 私钥路径 | `config/ssl/key.pem` |
| `MOVIE_SECRET_KEY` | 影片密码字段 AES 加密密钥 | — |
| `SERVER_HOST` | 服务器对外地址（推流配置用） | — |
| `PROJECT_ROOT` | 项目根目录（单文件版为运行目录） | 自动检测 |
| `RESTART_COUNT` | 内部重启计数 | — |

> 安全提示：生产环境务必修改 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`，并使用强随机字符串，切勿使用默认 dev secret。

## 前端（构建时）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_API_URL` | API / Socket.IO 基础地址，留空时使用 `window.location.origin` | — |
| `VITE_FLV_BASE_URL` | OBS 推流模式 HTTP-FLV 拉流基础地址 | — |
| `VITE_SOCKET_URL` | Socket.IO 地址（覆盖 `VITE_API_URL` 的 socket 部分） | — |
| `VITE_RTMP_PORT` | RTMP 推流端口 | `3334` |

> 前端这些地址也可以在运行时通过本地存储覆盖（如自定义后端地址），便于对接独立部署的后端。

## PostgreSQL 支持

`DATABASE_URL` 支持 PostgreSQL 连接串（如 `postgresql://postgres:change_me@db:5432/zviewer`），默认使用 SQLite（sql.js）。

## Docker 中的环境变量

Docker 部署时通过 `docker-compose.yml` 的 `environment` 传入上述变量，数据目录 `/app/config` 挂载 volume 持久化（见 [部署](/guide/deploy)）。
