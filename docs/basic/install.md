# 安装与部署

## 单文件版

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载压缩包解压即用，不装运行时不装依赖。包内附带 LiveKit 伴生程序（语音服务），首次使用语音时自动拉起。

Windows 另有桌面版（`zviewer-windows-x64-GUI.zip`）：只有一个 `ZViewerDesktop.exe`，带托盘与端口配置，负责启动、停止与更新内置服务；装好后从窗口操作即可，不需要命令行。

启动方式：

- **Windows 桌面版**：双击 `ZViewerDesktop.exe`
- **Windows 单文件版**：双击 `start.bat`，进入交互菜单
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

需要 Node.js 22+ 与 Go 1.26+（后端用 Go 编译，前端用 Vite 打包）。

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
npm install
cp .env.example .env   # 按需改端口与密钥
npm run db:init        # 建表，并打印初始管理员 root / root

npm run dev                  # 开发模式：前端 5174 / 后端 3333
npm run build && npm start   # 生产构建并启动

./start-prod.sh start        # 或脚本一键完成装依赖、构建、启动（Windows 用 .\start-prod.bat）
```

`config/` 不入库，新克隆的仓库没有数据库，必须先跑 `db:init`（对非空库会拒绝执行）。

## Docker

```bash
docker run -d \
  --name zviewer \
  --restart unless-stopped \
  -p 3333:3333 \
  -p 3333:3333/udp \
  -p 3334:3334 \
  -p 3337:3337 \
  -p 3338:3338 \
  -v /opt/zviewer/config:/app/config \
  zerowyc0721/zviewer:latest
```

docker compose：

```yaml
services:
  zviewer:
    image: zerowyc0721/zviewer:latest
    ports:
      - "3333:3333"      # 页面、API、WebSocket、/live 拉流、/rtc 语音信令
      - "3333:3333/udp"  # 语音媒体传输
      - "3334:3334"      # RTMP 推流
      - "3337:3337"      # 语音 ICE/TCP 直连
      - "3338:3338"      # 语音 TURN/TLS 中继（可选，需配齐证书三项）
    volumes:
      - ./zviewer-config:/app/config
    restart: unless-stopped
```

- `volumes` 把容器内 `/app/config` 挂到宿主机（`docker run` 示例用 `/opt/zviewer/config`，需绝对路径）。数据库、证书、上传文件都在这里，换镜像不丢数据。
- 镜像标签：`latest` / `X.Y` 只在发正式版时更新，`X.Y.Z` 固定版本，`dev` 跟随测试构建。
- `-p 3333:3333/udp` 与 `3337:3337` 承载语音媒体，缺少时语音无法互通：浏览器在 UDP 直连、TCP 直连之间自动择优，不需要开开关。
- 镜像以 HTTP 模式启动，不自动签发证书；HTTPS 宜前置 Nginx / Caddy 反代。
- 容器内更新只替换程序文件并重启后端进程，不重启容器。

## 数据持久化

状态集中在 `config/`（容器内 `/app/config`），更新不覆盖：

| 路径 | 内容 |
|---|---|
| `config/dev.sqlite` | 数据库（标准 SQLite，WAL） |
| `config/ssl/` | SSL 证书与 ACME 账号 |
| `config/uploads/` | 用户上传文件 |
| `config/media/` | 预留目录，推流不落盘 |

## 首次启动检查

1. 访问 `http://localhost:3333`，页面底部显示 🟢 已连接。
2. 用 `root` / `root` 登录并改密。
3. 生产环境设置 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（见[环境变量](/advanced/env)）。

## 从 4.x 升级

首次启动会自动清理旧版遗留文件（`zviewer-frontend.exe`、`zviewer-cert`、`node_modules/`、`backend/`、`config/media` 里的推流切片），日志打印 `[cleanup] 已清理 v4 遗留文件 …`。`config/` 下的数据库、证书、上传文件不受影响；4.3.6 以下用 Docker 部署的，建议按上面的 compose 重新部署一次。

## 反向代理配置

WebSocket 与语音信令（`/rtc`）都需要升级头，同一个 upstream 即可覆盖：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

内网部署的穿透方案见[网络连接与内网穿透](/basic/network)。
