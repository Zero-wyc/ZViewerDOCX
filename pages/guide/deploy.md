---
title: 部署
description: 源码、Docker、GitHub Actions 自动构建等部署方式
---

# 部署

## 端口说明

| 服务 | 端口 | 说明 |
| --- | --- | --- |
| 后端 REST API + WebSocket | 3333 | HTTP / HTTPS API 及 Socket.IO 实时通信 |
| 前端静态文件服务 | 4173 | HTTP 模式下的前端页面，含 API 反向代理 |
| RTMP 推流 | 3334 | OBS 推流端口 |
| HTTP-FLV 拉流 | 3335 | 直播流播放（Node Media Server） |

HTTP 模式下，用户通过 `http://localhost:4173` 访问前端页面，前端通过反向代理将 `/api`、`/socket.io`、`/live` 请求转发到后端，无需单独配置跨域。

## Docker 部署

Docker 镜像使用 HTTP 模式启动，分别运行后端和前端两个进程，**不自动签发证书**。如需 HTTPS，建议在 Docker 前加一层反向代理（Nginx / Caddy）。

### docker run

```bash
docker run -d \
  --name zviewer \
  -p 4173:4173 \
  -p 3333:3333 \
  -p 3334:3334 \
  -p 3335:3335 \
  -v zviewer-data:/app/config \
  zerowyc0721/zviewer:latest
```

### Docker Compose

创建 `docker-compose.yml`：

```yaml
services:
  zviewer:
    image: zerowyc0721/zviewer:latest
    ports:
      - "3333:3333"   # 后端 API + WebSocket
      - "4173:4173"   # 前端页面
      - "3334:3334"   # RTMP 推流 (OBS)
      - "3335:3335"   # HTTP-FLV 拉流
    volumes:
      - zviewer-data:/app/config
    restart: unless-stopped

volumes:
  zviewer-data:
```

启动：

```bash
docker compose up -d
```

### 自行构建镜像

项目已包含 `Dockerfile.linux-single` 和 `docker-compose.linux-single.yml`（使用 `build` 而非 `image`）：

```bash
docker build -t zviewer -f Dockerfile.linux-single .
docker compose -f docker-compose.linux-single.yml up -d
```

### 访问

用户通过浏览器访问 `http://localhost:4173` 即可使用全部功能。OBS 推流直连 `rtmp://localhost:3334/live`。

### 数据持久化

`/app/config` 目录挂载 volume，包含：

| 路径 | 内容 |
| --- | --- |
| `/app/config/dev.sqlite` | 数据库 |
| `/app/config/ssl/` | SSL 证书 |
| `/app/config/uploads/` | 用户上传文件 |
| `/app/config/media/` | NMS 推流媒体切片 |

> 升级时只需保留 `config/` 目录即可完成数据迁移，详见 [数据目录与数据库](/config/data)。

## GitHub Actions 自动构建

每次 push 到 `main` 分支或打 tag（`v*`）时，自动完成：

1. **构建 Linux 单文件版** → 上传 artifact + 推送到 Docker Hub（`zerowyc0721/zviewer`）。
2. **构建 Windows 单文件版** → 上传 artifact。
3. 打 tag 时自动创建 GitHub Release，包含两个平台的压缩包。

### 版本管理

| 触发方式 | 版本号 | 示例 |
| --- | --- | --- |
| 推送 tag `v1.0.0` | 正式版 | `1.0.0` |
| 推送 `main` 分支 | 开发版（预发布） | `0.0.0-dev.a1b2c3d` |
| 手动触发 | 手动构建 | `0.0.0-manual` |

管理员可在管理后台通过开关控制是否接收预发布版本更新。

### 构建产物

| 平台 | 压缩包 | 说明 |
| --- | --- | --- |
| Linux | `zviewer-linux-x64.tar.gz` | 含 `zviewer-backend`、`zviewer-frontend`、`zviewer-cert`、`start.sh` |
| Windows | `zviewer-windows-x64.zip` | 含 `zviewer-backend.exe`、`zviewer-frontend.exe`、`zviewer-cert.exe`、`start.bat` |
| Docker | `zerowyc0721/zviewer:latest` | Linux 单文件版的 Docker 镜像，自动推送到 Docker Hub |

## 反向代理注意事项

通过 Nginx / Caddy 等反向代理时，需为 WebSocket 正确配置升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

缺少上述配置会导致 Socket.IO 实时同步（房间状态、弹幕、语音信令）失效。
