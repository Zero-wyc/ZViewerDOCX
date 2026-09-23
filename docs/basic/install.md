# 安装与部署

## 单文件版（推荐）

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载压缩包，解压后运行。无需安装 Node.js / npm。

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
      - "3333:3333"   # 统一入口
      - "3334:3334"   # RTMP 推流
    volumes:
      - zviewer-data:/app/config
    restart: unless-stopped

volumes:
  zviewer-data:
```

- 镜像以 HTTP 模式启动，不自动签发证书；HTTPS 建议前置 Nginx / Caddy 反代。
- 容器内更新是替换程序文件后直接重启后端进程，不重启容器。

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
2. 用 `root` / `root` 登录，立即改密码。
3. 生产环境修改 `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`（见[环境变量](/advanced/env)）。

## 反向代理注意

WebSocket 需要升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

内网部署的穿透方案见[网络连接与内网穿透](/basic/network)。
