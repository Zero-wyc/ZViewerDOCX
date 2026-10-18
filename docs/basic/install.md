# 安装与部署

## 单文件版

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载压缩包解压即用，无需 Node.js / npm。包内附带 LiveKit 伴生程序（语音服务），首次使用语音时自动拉起，无需手动配置。

```bash
# Windows
start.bat start         # 启动（HTTP）
start.bat https         # 签发证书 + HTTPS 启动
start.bat               # 交互菜单

# Linux
./start.sh start
./start.sh              # 交互菜单
```

完整命令：`start` / `backend` / `stop` / `restart` / `status` / `logs [backend|frontend]` / `build` / `cert [host]` / `https [host]` / `help`。

## 源码版

需要 Node.js 18+。

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
npm install

npm run dev             # 开发模式：前端 5174 / 后端 3333
npm run build && npm start   # 生产构建并启动

./start-prod.sh start   # 或脚本一键完成装依赖、构建、启动（Windows 用 .\start-prod.bat）
```

## Docker

```bash
docker run -d \
  --name zviewer \
  --restart unless-stopped \
  -p 3333:3333 \
  -p 3333:3333/udp \
  -p 3334:3334 \
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
      - "3337:3337"      # 语音 TCP 模式：管理端切换「语音传输模式 = TCP」时取消注释
    volumes:
      - ./zviewer-config:/app/config
    restart: unless-stopped
```

- `volumes` 把容器内 `/app/config` 挂到宿主机（`docker run` 示例用 `/opt/zviewer/config`，需绝对路径）。数据库、证书、上传文件与推流切片都在这里，换镜像不丢数据。
- `-p 3333:3333/udp` 承载语音 WebRTC 媒体，缺少时语音无法互通；旧版本升级的用户需补上这条映射。
- 语音开箱即用：公网 IP 经 LiveKit 内置 STUN 自动发现，信令地址按页面域名推导。UDP 被运营商或企业防火墙拦截时，在管理端「基础设置 → 语音传输模式」切到 TCP，额外放行 `3337/tcp` 并取消 compose 中该映射的注释。
- 镜像以 HTTP 模式启动，不自动签发证书；HTTPS 宜前置 Nginx / Caddy 反代。
- 容器内更新只替换程序文件并重启后端进程，不重启容器；跨大版本升级语音功能需更换镜像。

## 数据持久化

状态集中在 `config/`（容器内 `/app/config`），更新不覆盖：

| 路径 | 内容 |
|---|---|
| `config/dev.sqlite` | 数据库（标准 SQLite） |
| `config/ssl/` | SSL 证书与 ACME 账号 |
| `config/uploads/` | 用户上传文件 |
| `config/media/` | NMS 推流切片 |

## 首次启动检查

1. 访问 `http://localhost:3333`，页面底部显示 🟢 已连接。
2. 用 `root` / `root` 登录并改密。
3. 生产环境设置 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（见[环境变量](/advanced/env)）。

## 反向代理配置

WebSocket 与语音信令（`/rtc`）都需要升级头，同一个 upstream 即可覆盖：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

内网部署的穿透方案见[网络连接与内网穿透](/basic/network)。
