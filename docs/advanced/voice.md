# 语音聊天链路

语音不参与播放同步，因此不走 Socket.IO，而是独立的实时音频链路。功能说明见[功能说明](/basic/features)，端口映射见[安装与部署](/basic/install)，变量清单见[环境变量](/advanced/env)。

## 音频由独立服务承载

实时音频交给 LiveKit（开源 WebRTC 实时通信服务），媒体形态为 SFU：每个客户端上传一份音频，服务端只转发不混流。

主后端不参与音频流转，只做三件事：签发接入凭证、执行禁言与踢出、代理信令。

```
浏览器 ── POST /api/voice/token ──▶ 后端（3333）── 签发 AccessToken
   │
   ├─ 信令 wss://页面域名/rtc ──▶ 后端 /rtc 反代 ──▶ livekit-server（3336）
   └─ 媒体 RTP over UDP 3333 ──────────────▶ livekit-server
                  （UDP 被拦截时：ICE/TCP 3337 直连，或 TURN/TLS 3338 中继）
```

| 端口 | 协议 | 用途 |
|---|---|---|
| 3333 | TCP | 页面、REST API、Socket.IO，以及 `/rtc` 信令反代 |
| 3333 | UDP | 语音媒体（RTP） |
| 3337 | TCP | ICE/TCP 媒体直连（与 UDP 同时发布） |
| 3336 | TCP | livekit-server 的 HTTP 与信令端口，仅内部使用 |
| 3338 | TCP | TURN/TLS 中继，UDP 被拦截时的兜底，需显式配置 |

livekit-server 是独立的 Go 二进制（压缩后约 18 MB），不能编进主程序，因此以伴生进程随主进程启停。

| 部署形态 | 二进制来源 |
|---|---|
| Windows 安装包 | **不随包**。第一次点「语音聊天」时下载到可执行文件旁，装好后立即拉起，不用重启 |
| Linux 包 / Docker 镜像 | 随包内嵌（离线环境没有可靠的下载时机） |
| 源码开发 | 缺失时自动下载到 `backend-go/dev-bin/` |

Windows 端的下载源与桌面端可选组件一致：产物仓库 `ZviewerRelease` 的 `components` 分支，顺序为 GitCode 直链 → GitHub raw → 官方 Release。接口 `GET /api/voice/status` 报告可用性与进度，`POST /api/voice/install` 触发下载（需登录，服务端单飞去重）。组件未下载时 `/api/voice/token` 返回 503 并提示下载，前端在语音面板里把「加入语音」换成「下载语音聊天组件」。

## 接入凭证

加入语音前先换令牌，接口 `POST /api/voice/token`（请求体带 `roomId` 与 `username`，需登录），这是连接 LiveKit 的唯一凭证。

ZViewer 房间映射为 LiveKit 房间，名为 `voice:<roomId>`，不同房间彼此隔离。令牌 grant 授予接入、发布、订阅与数据通道四项权限。

| 身份 | 生成规则 | 重连行为 |
|---|---|---|
| 登录用户 | `user:<userId>` | 身份稳定，重连后顶替自己上一条麦克风轨 |
| 游客 | `guest:<时间戳36进制><4位随机>` | 每次加入都是新身份，不顶替他人 |

游客身份不落库，反复进出会在 LiveKit 侧留下多条记录直到房间销毁。令牌由 `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` 签名，未配置时接口返回 503，前端提示语音未就绪。

**客户端连接地址按三级优先级确定**：管理端「基础设置 → 自定义 LiveKit 服务器地址」（如 `wss://livekit.example.com`，需与该服务器使用相同 API Key/Secret）→ 环境变量 `LIVEKIT_URL` → 从 `x-forwarded-host` / `x-forwarded-proto` 或 `Host` 头推导（HTTPS 页面自动得到 `wss://`，反代与 CDN 无需额外配置）。自动推导可避开容器 / 多网卡环境下探测到 Docker bridge 网段（`172.24.x.x`）的错误结果。

> 新版 SDK 的 `token.toJwt()` 返回 Promise，必须 `await`；直接取同步值会序列化成 `[object Object]`，LiveKit 侧一律 401。

## 采集与发布

麦克风经 `getUserMedia` 采集，开启回声消除、降噪与自动增益，强制单声道，处理全在浏览器完成。音频进入 48kHz 的 `AudioContext` 节点链，`micGain` 控制输入音量，之后分流三路：

```
麦克风 ──▶ micGain ──┬──▶ produceDest ──▶ 发布轨（送往 LiveKit）
                     ├──▶ monitorGain ──▶ ctx.destination（耳机反送）
                     └──▶ analyser（电平可视化）
```

音频上下文**不强制指定采样率**：声卡硬件速率不同（蓝牙 HFP 常见 44.1kHz），强转 48kHz 会形成两级重采样，反送与发布出现周期性卡顿；LiveKit 对采集速率无要求。

| 发布参数 | 取值 | 原因 |
|---|---|---|
| `audioPreset` | `music` | 默认语音会议档约 24~32kbps 听感发闷；`music` 档为 48kbps 全带宽 Opus |
| `dtx` | `false` | 关闭静默段传输，避免切换时音质劣化 |
| `red` | `true` | 保留 RED 冗余编码抵抗丢包 |

**自闭麦**只把发布轨 `enabled` 置 false，不发服务端请求；管理员禁言是另一套机制，见下文。

## 收听与成员状态

远端音频轨由每个成员一个隐藏 `<audio>` 元素承载。成员列表在连接、断开、metadata 变更时刷新；每个成员另挂 `AnalyserNode`（`fftSize` 256、平滑系数 0.6）仅用于电平可视化。

音量分两层：全局音量 × 单成员音量，结果写入该成员 `<audio>.volume`。

反送按浏览器分别处理：Chrome 走媒体元素路径；Firefox 播放实时 `MediaStream` 有缓冲积压缺陷，改走 `AudioContext` 直连输出。反送默认关闭。

## 禁言与踢出

管理动作走 REST，权限在服务端校验。禁言双通道强制，客户端无法绕过：

1. **服务器侧静音**：调用 `mutePublishedTrack` 静音目标成员已发布的所有音频轨。
2. **metadata 标记**：参与者 metadata 写为 `{"adminMuted": true}`，成员列表据此渲染 UI；被禁言端收到 `ParticipantMetadataChanged` 后锁定麦克风并提示，解禁自动恢复。

踢出直接调用 `removeParticipant`，被踢端收到 `Disconnected` 后复位界面。

三处权限口径与房间管理一致：root、本人为主房主的 admin、房主、房管（`Room.moderators` 含该用户）。

| 接口 | 动作 | 权限 |
|---|---|---|
| `POST /api/voice/token` | 签发接入凭证 | 登录 |
| `POST /api/voice/mute` | 禁言 / 解禁对方麦克风 | root / 房主 / 房管 |
| `POST /api/voice/kick` | 踢出语音 | root / 房主 / 房管 |

## 信令反代

两条通道都要代理，否则浏览器连不上：

- **HTTP**：连接前先 `GET /rtc/v1/validate` 校验令牌，HTTPS 页面下不经代理会被混合内容策略拦截。
- **WebSocket**：后续信令帧经 `/rtc` 的 HTTP Upgrade 升级，升级后是不透明字节流，主后端只做裸 TCP 双向管道。

`upgrade` 处理器只放行两类路径：`/socket.io` 交给 Socket.IO，`/rtc` 隧道到 livekit-server，其余一律销毁。上游地址每次升级时从 `LIVEKIT_API_HOST` 解析（裸机 `127.0.0.1:3336`，compose 为 `livekit:3336`）。

## 伴生服务的启动与降级

启动在数据库初始化之后触发，以 fire-and-forget 拉起子进程，不阻塞主服务。二进制缺失且下载失败期间 `/api/voice/token` 返回 503。

启动参数：

```
livekit-server --dev --bind :: --port 3336 --udp-port 3333 --keys "<key>: <secret>"
```

ICE/TCP 端口由环境变量 `LIVEKIT_RTC_TCP_PORT`（默认 3337）下发，与 UDP 同时发布，不需要切模式。

- `--bind ::` 双栈监听 IPv4 与 IPv6；绑 `0.0.0.0` 只会收到 IPv4，公网 IPv6 用户的媒体流无法建立。若环境无 IPv6 协议栈导致绑定 `::` 失败，自动回退 `0.0.0.0` 重试一次。
- `--keys` 冒号后必须带空格，缺空格时 livekit-server 直接退出。启动后轮询 3336 等待就绪，超时 15s 判定失败。
- 子进程注册 `exit`、`SIGINT`、`SIGTERM` 钩子，主进程退出时一并终止。

启动时还有**外网可达性自检**：本机网卡全为私网地址（RFC1918 / 回环 / CGNAT）且未配置 `LIVEKIT_NODE_IP` 与 TURN 时，日志显式告警。典型场景是「局域网语音正常、外网连不上」——页面与信令经 CDN / 反代正常，但 WebRTC 媒体不经七层代理，属静默失败。日志给出三条路径：部署到有公网 IP 的主机并放行 3333/udp；用 frp 映射 3333/udp 并设 `LIVEKIT_NODE_IP`；或配置 TURN/TLS 三项并映射 3338/tcp。云服务器 EIP 场景网卡是私网但 STUN 可探测公网 IP，警告可忽略。

| 变量 | 缺省值 | 作用 |
|---|---|---|
| `LIVEKIT_API_KEY` | `devkey` | 令牌签名密钥 |
| `LIVEKIT_API_SECRET` | `zviewer-dev-secret` | 令牌签名密钥 |
| `LIVEKIT_API_HOST` | `http://127.0.0.1:3336` | 服务端 API 与信令反代的上游 |
| `LIVEKIT_BIND` | `::` | 伴生服务监听地址 |
| `LIVEKIT_RTC_TCP_PORT` | `3337` | ICE/TCP 端口，`0` 关闭该通道 |
| `LIVEKIT_TURN_TLS_PORT` | `3338` | TURN/TLS 端口，配齐域名与证书后启用 |
| `LIVEKIT_EXTERNAL` | 未设置 | 设为 `1` 跳过伴生服务，改用外置 LiveKit |

发行包不联网下载二进制，找不到伴生文件时只打印告警并给出重建指引，语音随之不可用。

## UDP 与 TCP 同时发布

服务端同时发布 `3333/udp` 与 `3337/tcp`，浏览器 ICE 自动择优：UDP 直连 > TCP 直连 > TURN 中继。UDP 通道始终开启（LiveKit 不支持禁用 UDP 候选），TCP 是加开的直连通道，管理端没有开关；要彻底关掉需显式写 `LIVEKIT_RTC_TCP_PORT=0`。

TCP 直连与 TURN/TLS 中继解决同一类问题（UDP 被拦截），机制不同：

| | ICE/TCP 3337 | TURN/TLS 3338 |
|---|---|---|
| 连接形态 | 浏览器与服务器**直连** | 经 TURN 服务器**中继** |
| 部署要求 | 无需域名与证书 | 需域名与正式证书（自签不被 WebRTC 信任） |
| 启用方式 | 默认开启，端口置 `0` 关闭 | 配置 `LIVEKIT_TURN_DOMAIN` / `CERT` / `KEY` |
| 穿透能力 | 受限于网络是否放行 3337/tcp | 更强（TLS 流量伪装为普通 HTTPS） |

二者可同时部署，客户端按连通性自动选择。语音面板实时显示当前协议徽标：前端周期轮询 `RTCPeerConnection.getStats()` 解析 ICE 实际选中的候选线路，跟随真实路径而非设置值。

## 故障排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 提示语音未就绪 | 伴生服务仍在下载 / 启动，或 API Key / Secret 未注入 | 查看日志 `[voice]` 段；Windows 包点房间里「下载语音聊天组件」，Linux 版确认包内有 `livekit-server` |
| 听不到别人声音 | 3333/udp 未放行 | 放行 UDP 3333；或放行 TCP 3337、配置 TURN/TLS |
| HTTPS 下报混合内容 | `/rtc` 未反代 | 确认反代把 `/rtc` 转发到 3333 |
| 连接后立刻断开 | 令牌序列化错误 | 检查是否 `await` 了 `token.toJwt()` |
| 只有 IPv6 用户连不上 | 监听绑到了 `0.0.0.0` | 确认 `LIVEKIT_BIND` 为 `::` |
| 局域网正常、外网连不上 | 网卡全私网且未配 `LIVEKIT_NODE_IP` 与 TURN | 按启动日志三条路径处理 |
| 管理员禁言无效 | 目标已不在语音房间 | 接口在参与者列表中找不到目标时返回 404 |

## 常量速查

| 常量 | 值 |
|---|---|
| LiveKit 版本（开发模式自动下载） | v1.13.7 |
| 信令 / 媒体端口 | 3336 / 3333 |
| ICE/TCP 端口 | 3337 |
| TURN/TLS 端口 | 3338 |
| 就绪等待超时 | 15s |
| 发布编码档 | `music`（48kbps Opus），`dtx: false`，`red: true` |
| 电平分析 fftSize / 平滑系数 | 256 / 0.6 |
