# 快速开始

## 第一步：下载 ZViewer

### 方式一：单文件版（推荐）

解压后目录结构如下：

```
zviewer-windows-x64/
├── zviewer-backend.exe     # 后端服务（统一托管前端页面）
├── zviewer-cert.exe        # SSL 证书工具
├── start.bat               # 启动脚本（Windows）
└── start.sh                # 启动脚本（Linux）
```

### 启动后访问

- **HTTP 模式**：`http://localhost:3333`
- **HTTPS 模式**：`https://localhost:3333`

## 第三步：登录系统

1. 打开浏览器访问 `http://localhost:3333`

## 端口说明

| 服务 | 端口 | 说明 |
|---|---|---|
| 后端服务（统一入口） | 3333 | HTTP / HTTPS API、WebSocket、前端静态文件、SPA 回退 |
| RTMP 推流 | 3334 | OBS 推流端口（独立端口，RTMP 为 TCP 二进制协议，无法与 HTTP 复用） |
| HTTP-FLV 拉流 | 3335 | 直播流播放（Node Media Server，通过后端 `/live` 代理转发） |

HTTP 模式下，用户通过 `http://localhost:3333` 访问所有功能。