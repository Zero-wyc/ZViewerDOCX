# 安装与部署

## 单文件版

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载压缩包，解压后运行。无需安装 Node.js / npm。

压缩包内附带 LiveKit 伴生程序（语音聊天的实时通信服务）。首次启动语音功能时，程序会自动拉起该伴生服务，无需手动配置。

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

# 开发模式
npm run dev             # 前后端同时启动（前端 5174 / 后端 3333）

# 生产构建并启动
npm run build
npm start

# 或用 start-prod 脚本（自动装依赖、构建、启动）
./start-prod.sh start   # Linux / macOS
.\start-prod.bat start  # Windows
```

## Docker

```bash
docker run -d \
  --name zviewer \
  --restart unless-stopped \
  -p 3333:3333 \
  -p 3333:3333/udp \
  -p 3334:3334 \
  -v zviewer-data:/app/config \
  zerowyc0721/zviewer:latest
```

docker compose：

```yaml
services:
  zviewer:
    image: zerowyc0721/zviewer:latest
    ports:
      - "3333:3333"      # 统一入口：页面、API、WebSocket、/live 拉流、/rtc 语音信令
      - "3333:3333/udp"  # 语音聊天媒体传输（与页面同号，协议不同）
      - "3334:3334"      # RTMP 推流
      # - "3337:3337"    # 语音 TCP 传输模式的 ICE/TCP 直连：管理端切换「语音传输模式 = TCP」时取消注释
    volumes:
      - zviewer-data:/app/config
    restart: unless-stopped

volumes:
  zviewer-data:
```

- `-p 3333:3333/udp` 承载语音聊天的 WebRTC 媒体流，缺少这条映射时语音无法互通。从旧版本升级的用户需在 compose 文件里补上这条映射。
- 语音功能开箱即用：公网 IP 经 LiveKit（语音聊天的实时通信服务，内嵌于镜像）的 STUN 机制自动发现，信令地址按页面域名自动推导，无需任何配置。UDP 被运营商或企业防火墙拦截时，可在管理端「基础设置 → 语音传输模式」切换为 TCP——额外开启 `3337/tcp` 直连兜底，需放行该端口并在 compose 文件里取消 `3337` 映射的注释。
- 镜像以 HTTP 模式启动，不自动签发证书；HTTPS 宜前置 Nginx / Caddy 反代。
- 容器内更新是替换程序文件后直接重启后端进程，不重启容器。旧版本镜像升级语音功能时，需整容器更换镜像才能生效。

## 数据持久化

所有状态集中在 `config/` 目录（容器内 `/app/config`），更新不覆盖：

| 路径 | 内容 |
|---|---|
| `config/dev.sqlite` | 数据库（标准 SQLite 格式） |
| `config/ssl/` | SSL 证书与 ACME 账号 |
| `config/uploads/` | 用户上传文件 |
| `config/media/` | NMS 推流切片 |

## 首次启动检查

1. 访问 `http://localhost:3333`，页面底部显示 🟢 已连接。
2. 用 `root` / `root` 登录并修改密码。
3. 生产环境设置 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（见[环境变量](/advanced/env)）。

## 反向代理配置

WebSocket 与语音信令（`/rtc` 路径）都需要升级头，同一个 upstream 即可同时覆盖：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

内网部署的穿透方案见[网络连接与内网穿透](/basic/network)。
