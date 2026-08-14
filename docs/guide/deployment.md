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

## GitHub Actions 自动构建

每次 push 到 `main` 分支或打 tag（`v*`）时，自动完成：

1. **构建 Linux 单文件版** → 上传 artifact + 推送到 Docker Hub（`zerowyc0721/zviewer`）。
2. **构建 Windows 单文件版** → 上传 artifact。
3. 打 tag 时自动创建 GitHub Release，包含两个平台的压缩包。

### 版本管理

| 触发方式 | 版本号 | 示例 |
|---|---|---|
| 推送 tag `v1.0.0` | 正式版 | `1.0.0` |
| 推送 `main` 分支 | 开发版（预发布） | `0.0.0-dev.a1b2c3d` |
| 手动触发 | 手动构建 | `0.0.0-manual` |

管理员可在管理后台通过开关控制是否接收预发布版本更新。

### 构建产物

| 平台 | 压缩包 | 说明 |
|---|---|---|
| Linux | `zviewer-linux-x64.tar.gz` | 含 `zviewer-backend`、`zviewer-cert`、`start.sh` |
| Windows | `zviewer-windows-x64.zip` | 含 `zviewer-backend.exe`、`zviewer-cert.exe`、`start.bat` |
| Docker | `zerowyc0721/zviewer:latest` | Linux 单文件版的 Docker 镜像，自动推送到 Docker Hub |

## 内网穿透与虚拟局域网

ZViewer 部署在内网服务器时，外网用户无法直接访问。以下介绍三种主流方案，可根据你的网络环境选择。

### FRP（推荐）

[FRP](https://github.com/fatedier/frp) 是一款高性能的反向代理应用，支持 TCP、UDP、HTTP、HTTPS 协议，适合将内网 ZViewer 服务暴露到公网 VPS。

#### 架构

```
公网用户 → frps（公网 VPS，端口 3333）→ frpc（内网服务器）→ ZViewer（127.0.0.1:3333）
```

#### 服务端配置（公网 VPS）

```ini
# frps.toml
bindPort = 7000                # frp 控制端口
vhostHTTPPort = 80             # HTTP 端口（可选，用于 Let's Encrypt 验证）
vhostHTTPSPort = 443           # HTTPS 端口（可选）
```

#### 客户端配置（内网 ZViewer 服务器）

```ini
# frpc.toml
serverAddr = "你的公网VPS_IP"
serverPort = 7000

[[proxies]]
name = "zviewer-backend"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3333
remotePort = 3333

[[proxies]]
name = "zviewer-rtmp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3334
remotePort = 3334
```

#### 访问

配置完成后，外网用户通过 `http://公网VPS_IP:3333` 访问 ZViewer。

> 公网 VPS 需开放对应端口（3333、3334）的防火墙/安全组规则。

#### 配置 HTTPS（FRP 转发）

如果公网 VPS 有域名，可配置 FRP 的 HTTPS 转发，或使用 Nginx 反代 FRP 端口后申请 Let's Encrypt 证书。

---

### 内网穿透（以樱花为例）

[Sakura Frp](https://www.natfrp.com/) 是一个免费易用的内网穿透服务，无需自备公网 VPS，注册账号即可使用。

#### 注册与安装

1. 访问 [Sakura Frp 官网](https://www.natfrp.com/) 注册账号。
2. 在「软件下载」页面下载对应系统的客户端。
3. 登录后进入「管理面板」→「隧道」→「创建隧道」，配置本地端口为 `3333`。
4. 在 ZViewer 的「自定义后端地址」中填入樱花分配的隧道地址，即可在外网使用。

> 免费版有流量限制（通常 1-2GB/月），适合轻度使用。付费版不限流量。

---

### 虚拟局域网（以 ZeroTier 为例）

[ZeroTier](https://www.zerotier.com/) 是一款软件定义网络（SDN）工具，将分布在不同网络的设备组成一个虚拟局域网，设备间可直接通信，无需公网 IP。

#### 架构

```
外网用户（安装 ZeroTier）←→ ZeroTier 虚拟网络 ←→ 内网 ZViewer 服务器（安装 ZeroTier）
```

#### 注册与创建网络

1. 访问 [ZeroTier Central](https://my.zerotier.com/) 注册账号。
2. 点击 **Create A Network** 创建一个网络。
3. 记下生成的 **Network ID**（如 `8056c2e21c000001`）。

#### 安装 ZeroTier

**Linux（内网服务器）**：

```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <Network ID>
sudo zerotier-cli set <Network ID> allowManaged=1
```

**Windows/macOS（外网用户）**：

1. 从 [ZeroTier 官网](https://www.zerotier.com/download/) 下载客户端安装。
2. 点击系统托盘图标 → **Join Network** → 输入 Network ID。
3. 勾选 **Allow Managed IP**。

#### 授权设备

在 [ZeroTier Central](https://my.zerotier.com/) 的网络管理页面中，勾选已连接设备旁边的复选框以授权入网。

#### 访问

授权后，ZeroTier 会为每台设备分配一个虚拟 IP（如 `10.147.20.1`）。外网用户通过该 IP 访问内网 ZViewer 服务：

```
http://10.147.20.1:3333
```

> ZeroTier 的免费版支持最多 25 台设备，适合团队使用。设备间通信为 P2P 直连，不经过中心服务器，速度取决于两端带宽。

---

### 方案对比

| 方案 | 是否需要公网 VPS | 速度 | 配置难度 | 适用场景 |
|------|-----------------|------|---------|---------|
| **FRP** | 是（需一台公网 VPS） | 受 VPS 带宽限制，中转流量 | 中等 | 有公网 VPS 且需要稳定服务的场景 |
| **Sakura Frp** | 否（使用服务商节点） | 受免费节点带宽限制 | 简单 | 快速测试、临时分享、无公网 VPS 的场景 |
| **ZeroTier** | 否（P2P 直连） | 取决于两端带宽，直连最快 | 简单 | 多设备组网、长期使用、需要高速传输的场景 |

#### 选择建议

- **已有公网 VPS** → 使用 FRP，稳定可控。
- **无公网 VPS，偶尔外网访问** → 使用 Sakura Frp，免费快速。
- **需要长期稳定高速访问，且设备较多** → 使用 ZeroTier，P2P 直连不限速。

## 更新机制

系统支持从 GitHub Releases 自动检测并应用更新，也支持手动上传压缩包更新（zip / tar.gz，≤500MB）。管理员可在管理后台「版本更新」Tab 中操作，并控制是否接收预发布版（main 分支自动构建）的更新。

相关 API：

- `GET /api/system/update/check`：检查更新（可含预发布）
- `POST /api/system/update/apply`：下载并应用更新
- `POST /api/system/update/upload`：上传压缩包并应用