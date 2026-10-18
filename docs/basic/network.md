# 网络连接与内网穿透

ZViewer 部署在内网时外网用户无法直接访问。按网络环境在 IPv6 直连、内网穿透、虚拟局域网三种方案中选择。

## 方案对比

| 方案 | 需要公网 VPS | 速度 | 难度 | 适用场景 |
|------|------|------|------|---------|
| **Sakura Frp** | 否（用服务商节点） | 受免费节点带宽限制 | 简单 | 快速测试、临时分享 |
| **FRP** | 是 | 受 VPS 带宽限制（中转） | 中等 | 有公网 VPS、需要稳定服务 |
| **ZeroTier** | 否（P2P 直连） | 取决于两端带宽，直连最快 | 简单 | 多设备组网、长期高速 |
| **IPv6 直连** | 否 | 不限速 | 简单 | 两端均有可达 IPv6 |

## 内网穿透（以 Sakura Frp 为例）

[Sakura Frp](https://www.natfrp.com/) 是免费穿透服务，注册即可用，无需自备公网 VPS。

1. 访问官网注册账号，在「软件下载」下载对应系统客户端。
2. 登录「管理面板」→「隧道」→「创建隧道」，本地端口填 `3333`。
3. 用樱花提供的域名访问 ZViewer。
4. 在设置中启用强制 HTTPS，即可覆盖项目全部功能。

## FRP

[FRP](https://github.com/fatedier/frp) 支持 TCP / UDP / HTTP / HTTPS，把内网服务暴露到公网 VPS。

```
公网用户 → frps（公网 VPS:3333）→ frpc（内网服务器）→ ZViewer（127.0.0.1:3333）
```

服务端 `frps.toml`：

```ini
bindPort = 7000                # frp 控制端口
vhostHTTPPort = 80             # 可选，用于 Let's Encrypt 验证
vhostHTTPSPort = 443           # 可选
```

客户端 `frpc.toml`：

```ini
serverAddr = "公网VPS_IP"
serverPort = 7000

[[proxies]]
name = "zviewer-backend"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3333
remotePort = 3333

[[proxies]]
name = "zviewer-voice"
type = "udp"
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

配置完成后外网通过 `http://公网VPS_IP:3333` 访问。

> VPS 需放行 3333（TCP + UDP）与 3334。缺少 UDP 转发时页面可用，但语音无法互通；此时除补 UDP 转发外，也可把管理端「语音传输模式」切为 TCP，同步放行 3337/tcp 并在隧道中增加该端口。

VPS 有域名时，可配置 FRP 的 HTTPS 转发，或用 Nginx 反代 FRP 端口后申请 Let's Encrypt 证书。

## 虚拟局域网（以 ZeroTier 为例）

[ZeroTier](https://www.zerotier.com/) 把不同网络的设备组成虚拟局域网，设备间直接通信，无需公网 IP。

```
外网用户（装 ZeroTier）←→ ZeroTier 虚拟网络 ←→ 内网 ZViewer 服务器（装 ZeroTier）
```

1. 访问 [ZeroTier Central](https://my.zerotier.com/) 注册，**Create A Network** 创建网络，记下 **Network ID**。
2. 内网服务器（Linux）：

```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <Network ID>
sudo zerotier-cli set <Network ID> allowManaged=1
```

3. 外网设备：从[官网](https://www.zerotier.com/download/)下载客户端，托盘图标 → **Join Network** 输入 Network ID，勾选 **Allow Managed IP**。
4. 在 ZeroTier Central 勾选设备复选框授权入网。
5. 通过分配的虚拟 IP 访问：`http://10.147.20.1:3333`。

> 免费版上限 25 台设备；设备间为 P2P 直连，速度取决于两端带宽。

## IPv6 直连

服务器与客户端都有可路由的公网 IPv6 时可直连，无需穿透。后端默认双栈监听。

- 前提：服务器分配到公网 IPv6，防火墙放行 `3333`（TCP + UDP）与 `3334`；客户端网络支持 IPv6。
- 访问：`http://[公网IPv6地址]:3333`（地址需方括号）。
- 获取：家庭宽带在光猫 / 路由器开启 IPv6（如 PPPoE Dial-Out）并为内网设备分配；VPS 通常在控制台直接分配。
- 注意：家庭宽带前缀随拨号变化，稳定访问可结合 IPv6 DDNS；证书 SAN 需包含该 IPv6 地址（`localhost` 自签含 `::1`，Let's Encrypt 支持公网 IP）；纯 IPv4 客户端仍需穿透或虚拟局域网。
