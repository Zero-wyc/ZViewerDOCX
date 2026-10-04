# 语音聊天链路

语音聊天不承担播放同步的职责，因此它不经过 Socket.IO，而是走一条独立的实时音频链路。本页说明这条链路的构成：谁处理音频、连接怎么建立、管理动作如何生效，以及部署时哪些环节会退化。功能层面的说明见[功能说明](/basic/features)，端口映射与变量清单见[安装与部署](/basic/install)与[环境变量](/advanced/env)。

## 音频由独立服务承载

实时音频交给 LiveKit 处理。LiveKit 是开源的 WebRTC 实时通信服务，媒体形态为 SFU（Selective Forwarding Unit，选择性转发单元）：每个客户端把自己的音频上传一份，服务端只做转发不做混流，因此上行带宽随人数线性增长而不会互相干扰。

主后端不参与音频流转，只负责三件事：签发接入凭证、执行禁言与踢出、代理信令。整体拓扑如下。

```
浏览器 ── POST /api/voice/token ──▶ 后端（3333）── 签发 AccessToken
   │
   ├─ 信令 wss://页面域名/rtc ──▶ 后端 /rtc 反代 ──▶ livekit-server（3336）
   └─ 媒体 RTP over UDP 3333 ──────────────▶ livekit-server
                  （UDP 被拦截时：ICE/TCP 3337 直连，或 TURN/TLS 5349 中继）
```

各端口的职责如下表。

| 端口 | 协议 | 用途 |
|---|---|---|
| 3333 | TCP | 页面、REST API、Socket.IO，以及 `/rtc` 信令反代 |
| 3333 | UDP | 语音媒体（RTP），与页面同号不同协议 |
| 3337 | TCP | ICE/TCP 媒体直连，管理端把语音传输模式切到 TCP 时启用（按需） |
| 3336 | TCP | livekit-server 的 HTTP 与信令端口，仅内部使用 |
| 5349 | TCP | TURN/TLS 中继，UDP 被拦截时的兜底通道，需显式配置 |

livekit-server 是独立的 Go 二进制，无法嵌入 pkg 打包出的单文件产物，因此以伴生进程的形式随主进程启停：单文件版由 `build-all.js` 把二进制分发到可执行文件旁边，容器版内嵌在镜像里。开发模式下若二进制缺失，程序会自动从 GitHub Releases 下载到 `backend/dev-bin/`。

## 接入凭证

浏览器加入语音前先向后端换一个令牌，这个令牌是客户端连接 LiveKit 的唯一凭证。接口为 `POST /api/voice/token`，请求体带 `roomId` 与 `username`，需要登录态。

服务端把 ZViewer 房间映射为 LiveKit 房间，房间名固定为 `voice:<roomId>` 前缀，不同 ZViewer 房间之间彼此隔离。签发的令牌声明一份 grant（授权范围），授予接入、发布、订阅与数据通道四项权限。

参与者的身份（identity）按登录态分两种规则，重连时的行为不同。

| 身份 | 生成规则 | 重连行为 |
|---|---|---|
| 登录用户 | `user:<userId>` | 身份稳定，重连后顶替自己上一条麦克风轨 |
| 游客 | `guest:<时间戳36进制><4位随机>` | 每次加入都是新身份，不顶替他人 |

游客身份不落库，因此同一游客反复进出房间会在 LiveKit 侧留下多条记录，直到房间销毁。令牌本身由 `LIVEKIT_API_KEY` 与 `LIVEKIT_API_SECRET` 签名，未配置这两个变量时接口返回 503，前端提示语音未就绪。

**客户端地址按请求头推导**，不写在服务端配置里。优先取 `LIVEKIT_URL`；未配置时从 `x-forwarded-host` / `x-forwarded-proto` 或 `Host` 头推导协议与域名，HTTPS 页面自动得到 `wss://`，反代与 CDN 场景因此无需额外配置。这样做是为了避开在容器或多网卡环境探测本机 IP——探测结果通常是 Docker bridge 网段（`172.24.x.x`），浏览器根本不可达。

> 一个容易踩的坑：新版 SDK 的 `token.toJwt()` 返回 Promise，必须 `await`。直接取同步值会序列化成 `[object Object]`，LiveKit 侧一律返回 401。

## 采集与发布

麦克风采集使用 `getUserMedia`，开启回声消除、降噪与自动增益，并强制单声道。这三项处理由浏览器完成，不占用服务器算力。

采集到的音频流进入一条 48kHz 的 `AudioContext` 节点链，`micGain` 负责输入音量，之后分流到三个终点。

```
麦克风 ──▶ micGain ──┬──▶ produceDest ──▶ 发布轨（送往 LiveKit）
                     ├──▶ monitorGain ──▶ ctx.destination（耳机反送）
                     └──▶ analyser（电平可视化）
```

音频上下文**不强制指定采样率**。声卡硬件速率不尽相同（蓝牙 HFP 常见 44.1kHz），强行重采样到 48kHz 会形成采集与上下文两级的双重转换，反送与发布会出现周期性卡顿。LiveKit 对采集速率没有要求，用硬件默认值即可。

发布时指定编码档位，参数直接决定听感。

| 参数 | 取值 | 原因 |
|---|---|---|
| `audioPreset` | `music` | SDK 默认按语音会议档编码（约 24~32kbps），听感发闷；`music` 档为 48kbps 全带宽 Opus |
| `dtx` | `false` | 关闭静默段 discontinuous transmission，避免静音段落切换时的音质劣化 |
| `red` | `true` | 保留 RED 冗余编码抵抗丢包 |

**自闭麦**（本地静音）只需把发布轨的 `enabled` 置为 false，不发任何服务端请求。管理员禁言则是另一套机制，见「禁言与踢出」一节。

## 收听与成员状态

远端音频轨不直接出声，而是为每个成员创建一个隐藏的 `<audio>` 元素承载。成员列表在参与者连接、断开、metadata 变更时刷新；每个成员还挂一个 `AnalyserNode`（`fftSize` 为 256、平滑系数 0.6）仅用于电平可视化，不参与发声。

音量分两层：全局音量乘以单成员音量，两者相乘后写入该成员的 `<audio>.volume`。

反送（自己听见自己）按浏览器分别处理。Chrome 走媒体元素路径；Firefox 播放实时 `MediaStream` 有缓冲积压缺陷会卡顿，改走 `AudioContext` 直连输出。反送默认关闭。

## 禁言与踢出

管理动作通过 REST 接口执行，权限在服务端校验。禁言采用双通道强制，客户端无法绕过。

1. **服务器侧静音**：服务端调用 `mutePublishedTrack` 把目标成员已发布的所有音频轨静音。这是服务端操作，与客户端状态无关。
2. **metadata 标记**：服务端把参与者 metadata 写为 `{"adminMuted": true}`。成员列表据此渲染 UI，被禁言者的客户端收到 `ParticipantMetadataChanged` 事件后锁定麦克风并提示，解禁时自动恢复。

禁言期间该成员无法自行开麦。踢出则直接调用 `removeParticipant`，被踢者的客户端收到 `Disconnected` 事件后复位界面。

三处权限判定的口径与房间管理一致：root、本人为主房主的 admin、房主、房管（`Room.moderators` 数组中包含该用户）。

| 接口 | 动作 | 权限 |
|---|---|---|
| `POST /api/voice/token` | 签发接入凭证 | 登录 |
| `POST /api/voice/mute` | 禁言 / 解禁对方麦克风 | root / 房主 / 房管 |
| `POST /api/voice/kick` | 踢出语音 | root / 房主 / 房管 |

## 信令反代

LiveKit 的信令走两条通道，主后端都要代理，否则浏览器连不上。

- **HTTP 通道**：客户端连接前先发 `GET /rtc/v1/validate` 校验令牌，这是普通 HTTP 请求。HTTPS 页面下若不经代理，混合内容策略会直接拦截。
- **WebSocket 通道**：后续信令帧通过 `/rtc` 的 HTTP Upgrade 升级为 WebSocket。升级后的帧是不透明字节流，主后端只做裸 TCP 双向管道，不解析协议。

`upgrade` 事件处理器只放行两类路径：以 `/socket.io` 开头的交给 Socket.IO 自行处理，以 `/rtc` 开头的隧道到 livekit-server，其余连接一律销毁。上游地址每次升级时从 `LIVEKIT_API_HOST` 解析（裸机为 `127.0.0.1:3336`，compose 部署为 `livekit:3336`），以兼容运行时注入的环境变量。

## 内嵌服务的启动与降级

启动流程在数据库初始化之后触发：先从系统设置读取语音传输模式（udp/tcp），再以 fire-and-forget 方式拉起子进程，不阻塞主服务。下载二进制期间 `/api/voice/token` 返回 503，前端提示语音未就绪。

livekit-server 的启动参数如下（UDP 模式，默认）。

```
livekit-server --dev --bind :: --port 3336 --udp-port 3333 --keys "<key>: <secret>"
```

管理端把语音传输模式切换为 TCP 时，参数追加 `--tcp-port 3337`（详见「语音传输模式」一节）。

`--bind ::` 以双栈监听，同时收 IPv4 与 IPv6（IPv4 连接以 v4-mapped 形式进入）。绑定 `0.0.0.0` 只会收到 IPv4，公网 IPv6 用户的媒体流将无法建立。若所在环境没有 IPv6 协议栈导致绑定 `::` 失败，程序自动回退 `0.0.0.0` 重试一次，代价是 IPv6 媒体不可用但语音整体可用。

`--keys` 的格式要求冒号后必须带一个空格，缺空格时 livekit-server 会直接退出。启动后轮询 3336 端口等待就绪，超时 15s 判定失败。

程序为子进程注册 `exit`、`SIGINT`、`SIGTERM` 三个钩子，主进程退出时一并终止。

各项配置的缺省值如下表，显式配置优先于缺省值。

| 变量 | 缺省值 | 作用 |
|---|---|---|
| `LIVEKIT_API_KEY` | `devkey` | 令牌签名密钥 |
| `LIVEKIT_API_SECRET` | `zviewer-dev-secret` | 令牌签名密钥 |
| `LIVEKIT_API_HOST` | `http://127.0.0.1:3336` | 服务端 API 与信令反代的上游地址 |
| `LIVEKIT_BIND` | `::` | 内嵌服务监听地址 |
| `LIVEKIT_RTC_TCP_PORT` | `3337` | ICE/TCP 端口（语音传输模式为 TCP 时开启） |
| `LIVEKIT_EXTERNAL` | 未设置 | 设为 `1` 时跳过内嵌服务，改用外置 LiveKit |

生产包（pkg 单文件）不会联网下载二进制。找不到伴生二进制时只打印告警并给出重建指引，语音功能随之不可用。

## 语音传输模式（UDP / TCP）

管理端「基础设置 → 语音传输模式」控制语音媒体的通道构成，保存后后端自动热重启 livekit-server 子进程，进行中的语音会短暂中断并自动重连。

| 模式 | livekit-server 启动参数 | 部署侧要求 |
|---|---|---|
| UDP（默认） | `--udp-port 3333` | 放行 3333/udp |
| TCP | `--udp-port 3333` + `--tcp-port 3337` | 额外放行 3337/tcp（Docker 需补端口映射） |

TCP 模式开启 LiveKit 原生 ICE/TCP 直连：服务器同时广播 UDP 与 TCP 两路候选，由浏览器 ICE 自动选路——UDP 可用时走低延迟直连，被运营商或企业防火墙拦截时自动经 3337/tcp 连接媒体。UDP 通道始终开启（LiveKit 不支持禁用 UDP 候选），因此 TCP 模式是「加开兜底」而非「替换」；端口号可用环境变量 `LIVEKIT_RTC_TCP_PORT` 覆盖。

TCP 直连与 TURN/TLS 中继解决的是同一类问题（UDP 被拦截），机制不同：

| | ICE/TCP 3337 | TURN/TLS 5349 |
|---|---|---|
| 连接形态 | 浏览器与服务器**直连** | 经 TURN 服务器**中继** |
| 部署要求 | 无需域名与证书 | 需域名与正式证书（自签不被 WebRTC 信任） |
| 启用方式 | 管理端设置即时切换 | 配置 `LIVEKIT_TURN_DOMAIN` / `CERT` / `KEY` 三项 |
| 穿透能力 | 受限于网络是否放行 3337/tcp | 更强（TLS 流量伪装为普通 HTTPS） |

二者可以同时部署，客户端按连通性自动选择。

## 故障排查

下表按现象列出常见原因与处理方式。

| 现象 | 原因 | 处理 |
|---|---|---|
| 前端提示语音未就绪 | 内嵌服务仍在下载或启动，或 `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` 未注入 | 查看服务端日志的 `[voice]` 段；单文件版确认包内含 `livekit-server` |
| 接入后听不到别人声音 | 3333/udp 未放行，媒体无法直连 | 放行 UDP 3333；运营商或企业防火墙拦 UDP 时，改用 TCP 传输模式（3337/tcp）或配置 TURN/TLS 三项 |
| 页面在 HTTPS 下报混合内容 | `/rtc` 信令未反代 | 确认反代把 `/rtc` 转发到主端口 3333 |
| 连接后立刻被断开 | 令牌序列化错误 | 检查是否 `await` 了 `token.toJwt()` |
| 只有 IPv6 用户连不上 | 监听地址绑到了 `0.0.0.0` | 确认 `LIVEKIT_BIND` 保持 `::` |
| 管理员禁言无效 | 目标已不在语音房间 | 禁言接口在参与者列表中找不到目标时返回 404 |

## 常量速查

下表汇总本页涉及的固定取值。

| 常量 | 值 |
|---|---|
| LiveKit 版本（开发模式自动下载） | v1.13.7 |
| 信令 / 媒体端口 | 3336 / 3333 |
| ICE/TCP 端口（TCP 模式） | 3337 |
| TURN/TLS 端口 | 5349 |
| 就绪等待超时 | 15s |
| 发布编码档 | `music`（48kbps Opus），`dtx: false`，`red: true` |
| 电平分析 fftSize / 平滑系数 | 256 / 0.6 |
