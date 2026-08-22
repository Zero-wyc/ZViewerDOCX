# 部署方式

ZViewer 提供源码版、单文件 exe、Docker 三种部署形态，且内置自动更新机制。

## 一键启动脚本详解

源码版（`start-prod.*`）与单文件版（`start.bat` / `start.sh`）功能一致，均提供交互菜单与命令行两种模式。

### 交互菜单

```
========================================
  ZViewer 服务管理
========================================
  1) 启动服务 (HTTP)
  2) 仅启动后端（可选 HTTP / HTTPS）
  3) 停止服务
  4) 重启服务
  5) 查看状态
  6) 查看日志
  7) 一键签发 SSL 证书
  8) HTTPS 启动（自动签发证书）
  9) 构建前后端（源码版）
  0) 退出
```

### 命令行用法

| 命令 | 说明 |
|---|---|
| `start` | 启动服务（HTTP 前后端；加 `-Https` 使用 HTTPS 单进程模式） |
| `backend` | 仅启动后端（可选 HTTP/HTTPS） |
| `cert [host]` | 签发 SSL 证书，host 缺省时交互选择类型 |
| `https [host]` | 签发证书后以 HTTPS 启动（仅后端，后端统一提供前端页面） |
| `stop` / `restart` | 停止 / 重启服务 |
| `status` | 查看运行状态（PID、端口监听、证书状态） |
| `logs [backend\|frontend]` | 查看日志（默认 backend） |
| `build` | 构建前后端（源码版） |
| `help` / `menu` | 帮助 / 交互菜单 |

## Docker 部署

Docker 镜像使用 HTTP 模式启动，后端统一托管前端静态文件，不自动签发证书。如需 HTTPS，建议在 Docker 前加一层反向代理（Nginx / Caddy）。

### docker run

```bash
docker run -d \
  --name zviewer \
  -p 3333:3333 \
  -p 3334:3334 \
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
      - "3333:3333"   # 后端统一入口（API + WebSocket + 前端页面）
      - "3334:3334"   # RTMP 推流 (OBS)
    volumes:
      - zviewer-data:/app/config
    restart: unless-stopped

volumes:
  zviewer-data:
```

### 自行构建

项目已包含 `Dockerfile.linux-single` 和 `docker-compose.linux-single.yml`（使用 `build` 而非 `image`）：

```bash
docker build -t zviewer -f Dockerfile.linux-single .
docker compose -f docker-compose.linux-single.yml up -d
```

### 数据持久化

`/app/config` 目录挂载 volume，包含：

| 路径 | 内容 |
|---|---|
| `/app/config/dev.sqlite` | 数据库 |
| `/app/config/ssl/` | SSL 证书 |
| `/app/config/uploads/` | 用户上传文件 |
| `/app/config/media/` | NMS 推流媒体切片 |

## 内网穿透与虚拟局域网

> 内网部署后如何让外网用户访问（FRP / 樱花 / ZeroTier 组网，以及 IPv6 直连），已在专文中展开，见 **[网络连接与内网穿透](/guide/network)**。

## 更新机制

系统支持从 GitHub Releases 自动检测并应用更新，也支持手动上传压缩包更新（zip / tar.gz，≤500MB）。管理员可在管理后台「版本更新」Tab 中操作，并控制是否接收预发布版（main 分支自动构建）的更新。

相关 API：

- `GET /api/system/update/check`：检查更新（可含预发布）
- `POST /api/system/update/apply`：下载并应用更新
- `POST /api/system/update/upload`：上传压缩包并应用