---
title: ZViewerCLI 本地代理
description: 使用本地 Cookie 解锁 Bilibili 大会员画质
---

# ZViewerCLI 本地代理

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI) 是一个**可选**的本地代理客户端（Go 单二进制），用于解决浏览器端无法直接使用用户 Bilibili Cookie 与高画质地址的问题：

- 使用**用户本地 Cookie** 解析 Bilibili 视频，获取大会员等高画质地址。
- 在**本地代理**视频流请求，注入正确的 Referer / Origin / User-Agent，绕过 CDN 防盗链与 CORS 限制。
- 通过 WebSocket 向房间注册，**前端自动检测并使用**本地代理。

## 工作原理

```
浏览器 ──▶ ZViewerCLI (127.0.0.1:9333) ──▶ Bilibili CDN
   │              ▲
   └── Socket.IO (agent: zcontrol-cli) 注册到房间
```

1. ZViewerCLI 以 `agent: 'zcontrol-cli'` 身份连接后端 Socket.IO（免 token）。
2. 发送 `cli-register { roomId, proxyUrl }` 注册到当前房间。
3. 后端向房间广播 `cli-agent-available`，前端检测到代理可用。
4. 播放器解析与媒体流请求改走本地代理（`http://127.0.0.1:9333`，后端强制归一化为 127.0.0.1）。

## 本地 HTTP 接口

| 接口 | 说明 |
| --- | --- |
| `GET /health` | 健康检查 |
| `GET /api/config` | 获取配置 |
| `GET /api/connect` | 连接后端 |
| `GET /resolve?bvid&cid&qn` | 解析视频，返回代理后的 `videoUrl` / `audioUrl` |

默认端口 **9333**。

## 使用步骤

1. 下载并运行 [ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)。
2. 在 CLI 配置页中登录 Bilibili（使用本地 Cookie / 扫码）。
3. 启动 ZViewer，进入房间。
4. 前端自动检测到本地代理后，播放 Bilibili 视频即可获得大会员画质。

## 服务端支持

- 后端 `POST /api/cli/resolve` 作为 CLI 的解析接口（`routes/cli.ts`）。
- CLI 代理相关事件：`cli-register`、`cli-list-agents`、`cli-agent-available` / `cli-agent-unavailable` / `cli-agents` / `cli-registered` / `cli-error`。

## 常见问题

- **未检测到代理**：确认 ZViewerCLI 与后端在同一网络可达，且房间内已触发注册。
- **仍无法播放高画质**：确认 Cookie 有效（未过期、账号有大会员权限）。
