# 网络连接与内网穿透

ZViewer 部署在内网时外网用户无法直接访问。按网络环境在 IPv6 直连、内网穿透、虚拟局域网三种方案中选择。

## 方案对比

| 方案 | 需要公网 VPS | 速度 | 难度 | 适用场景 |
|------|------|------|------|---------|
| **Sakura Frp** | 否（用服务商节点） | 受免费节点带宽限制 | 简单 | 快速测试、临时分享 |
| **FRP** | 是 | 受 VPS 带宽限制（中转） | 中等 | 有公网 VPS、需要稳定服务 |
| **EasyTier 组网** | 否（P2P 直连） | 取决于两端带宽，直连最快 | 简单（桌面端内置） | 多设备组网、长期高速 |
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

> VPS 需放行 3333（TCP）与 3334。语音与屏幕共享是成员之间直连，服务器只走信令，不占用 VPS 的媒体端口。

VPS 有域名时，可配置 FRP 的 HTTPS 转发，或用 Nginx 反代 FRP 端口后申请 Let's Encrypt 证书。

## 虚拟局域网（EasyTier）

[EasyTier](https://github.com/EasyTier/EasyTier) 把不同网络的设备组成虚拟局域网，设备间直连，无需公网 IP。Windows 桌面版内置组网：高级 → EasyTier 虚拟组网，填网络名与密码即可，免 TUN、免管理员权限。

- 官方公共对端（`public.easytier.cn` / `.top`）已停服，不要手动填；桌面端「公共对端」卡片可测速并一键填入最快的节点。
- 只有本节点时不会分配虚拟 IP，等有对端接入后才分配，属正常中间态。
- 组网监听端口与网页端口是两回事，界面里分开配置。
- 通过分配的虚拟 IP 访问：`http://10.x.x.x:3333`。
- 免费公共节点带宽有限，长期使用建议自建对端。

## IPv6 直连

服务器与客户端都有可路由的公网 IPv6 时可直连，无需穿透。后端默认双栈监听；桌面版「连接方式」页会探测本机公网 IPv6 并给出带端口的完整地址。

- 前提：服务器分配到公网 IPv6，防火墙放行 `3333`；客户端网络支持 IPv6。
- 访问：`http://[公网IPv6地址]:3333`（地址需方括号）。
- 获取：家庭宽带在光猫 / 路由器开启 IPv6（如 PPPoE Dial-Out）并为内网设备分配；VPS 通常在控制台直接分配。
- 注意：家庭宽带前缀随拨号变化，稳定访问可结合 IPv6 DDNS；证书 SAN 需包含该 IPv6 地址（`localhost` 自签含 `::1`，Let's Encrypt 支持公网 IP）；纯 IPv4 客户端仍需穿透或虚拟局域网。
