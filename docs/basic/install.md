# 安装与部署

## Windows 桌面版

下载 `zviewer-windows-x64-GUI.zip`，解压后运行 `ZViewerDesktop.exe`。启动台负责启停后端与 ZViewerCLI，并提供 IPv6 直连、FRP、EasyTier 组网、Cloudflare Tunnel 等外网接入方式；Cloudflared / frpc / EasyTier 首次使用时按需下载，不随包分发。

## 单文件版

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载压缩包解压即用，无需 Node.js / npm。语音、屏幕共享与 OBS 推流都不需要额外的伴生程序。

启动方式：

- **Windows**：双击 `start.bat`，进入交互菜单
- **Linux**：执行 `./start.sh`（不带参数），进入交互菜单

在菜单中选 `1` 启动服务，完成后访问 `http://localhost:3333`。

也可跳过菜单直接带参数执行，如 `start.bat start` / `./start.sh start`；完整命令见 `start.bat help`（`start` / `backend` / `stop` / `restart` / `status` / `logs` / `cert` / `https` / `help`）。

### 交互菜单

```text
  1) 启动服务              2) 仅启动后端
  3) 停止服务              4) 重启服务
  5) 查看状态              6) 查看日志
  7) 一键签发 SSL 证书     8) HTTPS 启动（自动签发证书）
  0) 退出
```

| 编号 | 功能 | 说明 |
|---|---|---|
| 1 | 启动服务 | HTTP 启动，端口取 `.env` 的 `PORT`（默认 3333） |
| 2 | 仅启动后端 | 先选 HTTP / HTTPS；跳过前端产物校验，适合前后端分离调试 |
| 3 | 停止服务 | 按记录的 PID 停止，端口被占用时兜底清理 |
| 4 | 重启服务 | 停止后重新启动 |
| 5 | 查看状态 | 端口监听、进程 PID、程序与证书是否齐全 |
| 6 | 查看日志 | 输出 `log/backend.log` 末 50 行 |
| 7 | 签发 SSL 证书 | 选 `localhost` 自签，或公网域名 / IP 申请 Let's Encrypt（需已解析且 80 端口可达；内网 IP 自动回退自签） |
| 8 | HTTPS 启动 | 签发证书后以 HTTPS 启动 |
| 0 | 退出 | 只关闭菜单窗口，后台服务继续运行；需要停止请选 `3` |

每次操作结束后按回车返回菜单。正式证书不建议用菜单 `7` / `8` 自动签发，详见 [HTTPS 证书](/advanced/https)。

## 源码版

需要 Go 1.26+ 与 Node.js 22+。

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
npm install
npm run db:init         # 初始化空库，创建 root / root

npm run dev             # 开发模式：前端 5174 / 后端 3333
npm run build && npm start   # 生产构建并启动

./start-prod.sh start   # 或脚本一键完成装依赖、构建、启动（Windows 用 .\start-prod.bat）
```

从 4.x 升级上来的旧库先跑 `npm run db:upgrade`：它会用 `VACUUM INTO` 备份，再在单个事务里补表补列。

## Docker

```bash
docker run -d \
  --name zviewer \
  --restart unless-stopped \
  -p 3333:3333 \
  -p 3333:3333/udp \
  -p 3334:3334 \
  -p 3337:3337 \
  -v /opt/zviewer/config:/app/config \
  zerowyc0721/zviewer:latest
```

docker compose：

```yaml
services:
  zviewer:
    image: zerowyc0721/zviewer:latest
    ports:
      - "3333:3333"      # 页面、API、WebSocket、/live 拉流、/signal 共享与语音信令
      - "3333:3333/udp"  # 语音 / 共享媒体（UDP）
      - "3334:3334"      # RTMP 推流
      - "3337:3337"      # 语音 / 共享媒体（TCP，UDP 受限时自动切换）
    volumes:
      - ./zviewer-config:/app/config
    restart: unless-stopped
```

- `volumes` 把容器内 `/app/config` 挂到宿主机（`docker run` 示例用 `/opt/zviewer/config`，需绝对路径）。数据库、证书、上传文件与推流切片都在这里，换镜像不丢数据。
- 语音与屏幕共享是成员之间直连，服务器只承载信令，媒体不经过服务器；`3333/udp` 与 `3337` 是自建媒体面的端口，仅旧语音链路会用到。
- 镜像以 HTTP 模式启动，不自动签发证书；HTTPS 宜前置 Nginx / Caddy 反代。
- 容器内更新只替换程序文件并重启后端进程，不重启容器；跨大版本升级需更换镜像。

## 数据持久化

状态集中在 `config/`（容器内 `/app/config`），更新不覆盖：

| 路径 | 内容 |
|---|---|
| `config/dev.sqlite` | 数据库（SQLite，默认 WAL，另有 `-wal` / `-shm` 旁文件） |
| `config/piik-rooms.sqlite` | 共享与语音的房间映射（Piik 房间码） |
| `config/ssl/` | SSL 证书与 ACME 账号 |
| `config/uploads/` | 用户上传文件 |
| `config/media/` | 推流切片 |

WAL 模式下不能直接复制 `.sqlite` 主文件，备份用 `--backup-db`（`VACUUM INTO` 一致性快照）或 `npm run db:backup`。

## 首次启动检查

1. 访问 `http://localhost:3333`，页面底部显示 🟢 已连接。
2. 用 `root` / `root` 登录并改密。
3. 生产环境设置 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（见[环境变量](/advanced/env)）。

4.x 的旧库不会被自动改造：分发包建议重装，源码部署跑 `npm run db:upgrade`。

## 反向代理配置

WebSocket 与共享 / 语音信令（`/socket.io`、`/signal`）都需要升级头，同一个 upstream 即可覆盖：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

内网部署的穿透方案见[网络连接与内网穿透](/basic/network)。
