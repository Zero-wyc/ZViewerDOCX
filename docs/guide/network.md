# 网络连接与内网穿透

ZViewer 部署在内网服务器时，外网用户无法直接访问。取决于你的网络环境，可以从**内网穿透**、**虚拟局域网**、**IPv6 直连**三种方案中选择合适的。

### 内网穿透（推荐新手,以樱花为例）

[Sakura Frp](https://www.natfrp.com/) 是一个免费易用的内网穿透服务，无需自备公网 VPS，注册账号即可使用。

#### 注册与安装

1. 访问 [Sakura Frp 官网](https://www.natfrp.com/) 注册账号。
2. 在「软件下载」页面下载对应系统的客户端。
3. 登录后进入「管理面板」→「隧道」→「创建隧道」，配置本地端口为 `3333`。
4. 在 ZViewer 的「自定义后端地址」中填入樱花分配的隧道地址，即可在外网使用。
5. 建议直接在设置中使用域名访问并启用强制HTTPS，以直接实现项目全部功能

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

## 虚拟局域网

### 以 ZeroTier 为例

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

## 方案对比

| 方案 | 是否需要公网 VPS | 速度 | 配置难度 | 适用场景 |
|------|-----------------|------|---------|---------|
| **FRP** | 是（需一台公网 VPS） | 受 VPS 带宽限制，中转流量 | 中等 | 有公网 VPS 且需要稳定服务的场景 |
| **Sakura Frp** | 否（使用服务商节点） | 受免费节点带宽限制 | 简单 | 快速测试、临时分享、无公网 VPS 的场景 |
| **ZeroTier** | 否（P2P 直连） | 取决于两端带宽，直连最快 | 简单 | 多设备组网、长期使用、需要高速传输的场景 |
| **IPv6 直连** | 否 | 不限速（直连） | 简单 | 服务器与客户端均有可达 IPv6 的场景 |

### 选择建议

- **已有公网 VPS** → 使用 FRP，稳定可控。
- **无公网 VPS，偶尔外网访问** → 使用 Sakura Frp，免费快速。
- **需要长期稳定高速访问，且设备较多** → 使用 ZeroTier，P2P 直连不限速。
- **服务器与客户端都有可达 IPv6** → 直接 IPv6 直连，无需任何穿透。

## IPv6 连接

如果服务器和客户端都拥有**公网（可路由）的 IPv6 地址**，可以直接通过 IPv6 直连，无需内网穿透。ZViewer 后端**默认同时监听 IPv4 与 IPv6（双栈）**，因此服务器获得公网 IPv6 后，客户端即可直接访问。

### 前提条件

- 服务器分配到可路由的公网 IPv6 地址，且防火墙放行 `3333`、`3334` 端口。
- 客户端所在网络能访问 IPv6（大多数现代宽带与蜂窝网络已支持双栈）。

### 访问方式

外网用户通过服务器的公网 IPv6 地址访问（IPv6 地址需用方括号包裹）：

```
http://[公网IPv6地址]:3333
```

### 获取公网 IPv6 地址

- **家庭宽带**：在光猫/路由器上开启 IPv6（如 PPPoE Dial-Out），为内网设备分配公网 IPv6，并放行 `3333`、`3334` 端口。
- **VPS**：通常在控制台或运营商侧直接分配公网 IPv6。

### 注意事项

- 家庭宽带 IPv6 前缀通常随拨号变化，如需稳定访问，可结合 **IPv6 DDNS** 将动态地址解析到域名。
- 用 IPv6 访问时若配置了 SSL 证书，证书的 SAN 需包含该 IPv6 地址（`localhost` 自签证书的 SAN 含 `::1`；Let's Encrypt 签发支持公网 IP，含 IPv6）。详见 [开发 - HTTPS 与证书](/dev/https)。
- 若客户端仅为 IPv4，无法直接访问 IPv6，仍需内网穿透或虚拟局域网方案。
