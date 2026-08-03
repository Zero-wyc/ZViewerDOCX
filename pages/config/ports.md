---
title: 端口说明
description: 各服务端口与访问方式
---

# 端口说明

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| 后端 REST API + WebSocket | 3333 | HTTP / HTTPS API 及 Socket.IO 实时通信 |
| 前端静态文件服务 | 4173 | HTTP 模式下的前端页面，含 API 反向代理 |
| RTMP 推流 | 3334 | OBS 推流端口 |
| HTTP-FLV 拉流 | 3335 | 直播流播放（Node Media Server） |

## HTTP 模式

- 用户通过 `http://localhost:4173` 访问前端页面。
- 前端通过反向代理将 `/api`、`/socket.io`、`/live` 请求转发到后端（3333）与 NMS（3335），**无需单独配置跨域**。

## HTTPS 模式

- 后端（3333）同时提供前端静态页面，访问 `https://localhost:3333`。
- 前端反向代理逻辑在 HTTPS 模式下由后端接管。

## 开发模式

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| 前端开发服务器 | 5174 | Vite dev server，默认代理后端 |
| 后端 | 3333 | 与生产一致 |

## 端口调整

- 后端端口：环境变量 `PORT`（见 [环境变量](/config/environment)）。
- RTMP / HTTP-FLV：`RTMP_PORT` / `HTTP_FLV_PORT`。
- 前端端口：由前端静态服务器配置决定（`frontend-server`）。

## 防火墙与安全组

公网部署时需放行以下端口：

- HTTP 模式：`4173`（对外）、`3333`、`3334`、`3335`（按需）
- HTTPS 模式：`3333`（对外，含 TLS）
- ACME 证书签发：`80`（Let's Encrypt HTTP-01 验证，见 [HTTPS 与证书](/guide/https)）

> 建议通过反向代理（Nginx / Caddy）仅暴露 443/80，内部端口不直接对外。
