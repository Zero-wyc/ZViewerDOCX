# 一起听音乐管线

一起听让房间成员同步播放同一首歌、同一段进度。本页说明服务拓扑、网易云登录态转发、音频流代理的降级与防护、房间同步算法、B站音乐特有逻辑与歌词处理。

## 服务拓扑

音频请求由主后端代理到内嵌的网易云 API 服务，再转发上游：

```
前端 <audio>
   │  /api/music/stream?songId=&level=&roomId=
   ▼
主后端 /api/music/*     callNcmApi()（附加 timestamp 绕内部服务 apicache）
   ▼
内部 NCM 服务 127.0.0.1:36530~36535   （@neteasecloudmusicapienhanced/api）
   ▼
网易云上游
```

内嵌 NCM 服务由主进程启动（`ncm-api.service.ts`）：绑定 `127.0.0.1`（必须显式传 host，包内 fallback 会读 `process.env.PORT/HOST` 与主服务冲突），基准端口 **36530** 被占用时 +1 重试，最多 5 次；启动探测总限 15s。启动失败不阻塞主服务，此时 `/api/music/*` 返回 503 `NCM_UNAVAILABLE`。

`callNcmApi()` 每次请求附加 `timestamp=Date.now()`：内部服务挂了 2 分钟 apicache，而缓存 key 不含 Cookie，不同登录态的相同 URL 会命中同一份缓存，匿名结果可能被 VIP 用户取到。

## 路由与登录态（`/api/music/ncm/*`）

- **通用转发**：只放行 GET / POST。自动注入当前用户持久化的网易云 Cookie（`NcmCredential` 表按 userId 隔离，游客不落库），并**剥离 query / body 中的 `cookie` / `noCookie` 参数**，防止客户端伪造登录态。
- **扫码登录**（`/login/qr/key|create|check`）**不注入旧凭据**：网易云以请求携带的 cookie 判定登录态，带上过期 MUSIC_U 会让二维码轮询异常（800 循环）。check 成功（803）的 Set-Cookie 正常持久化，并解析 profile（昵称 / 头像 / vipType）。
- **Cookie 登录**（`/api/music/ncm-cookie-login`）：个人中心可直接粘贴 Cookie 登录，提交时先校验 MUSIC_U 是否对应有效登录态，再持久化并同步昵称 / 头像缓存；过期或错误返回 400。`GET /api/music/ncm-cookie` 返回 `MUSIC_U=xxx; __csrf=yyy` 格式串，供「复制 Cookie」迁移登录态。
- Cookie 持久化判定：Set-Cookie 含 `music_u`，或名称含 `csrf`；按 cookie 名去重合并，新值覆盖旧值。
- VIP 归一：`/vip/info` 兜底后 10 为 VIP、11 为 SVIP；黑胶、音乐包、PLUS 三档会员对象也参与有效期判定。
- 上游 3xx 不跟随，改以 `{ code: 'REDIRECT', location }` 回传前端。

## 音频流代理 `/api/music/stream`

### 音质降级链

```
lossless → exhigh → higher → standard
```

从请求档位（默认 `exhigh`）在链中的位置开始逐档尝试 `/song/url/v1`。只有 `data.url` 非空且 **`freeTrialInfo == null`** 才算可用（试听片段视同不可用）。全链失败且过程中出现过试听片段时返回 403 `VIP_REQUIRED`。

### 回退与防护

- **v1 → 老接口回退**：`/song/url/v1` 返回 404（内部服务依赖残缺）时回退 `/song/url`。level→br 映射：lossless 999000 / exhigh 320000 / higher 192000 / standard 128000。
- **凭证回退链**：当前用户 Cookie → 房主 Cookie（请求带 `roomId` 时反查 `Room.ownerUserId`），房主登录 VIP 后全房间可用。`<audio>` 无法携带 Authorization 头，token 从 query 读取。
- **SSRF 防护**：解析出的直链域名必须匹配 `*.music.126.net`，否则拒绝转发。
- **direct=1 模式**：用 302 把 CDN 直链交给 `<audio>` 直连，减少服务器带宽。直链缓存 **15 分钟**（签名有效期 20~30 分钟），key 含实际生效凭证的归属，VIP 直链只会发给同一凭证链的请求。`http:` 直链统一改写为 `https:`。
- 代理流模式透传 Range（上游 206 必须转发），1MB 高水位读块，断连时 abort 上游并销毁流。
- 错误码：403 `VIP_REQUIRED` / 404 `NO_COPYRIGHT`（`/check/music` 判定）/ 502 `RESOLVE_FAILED` / 503 `NCM_UNAVAILABLE`。

## 房间内同步

### 队列模型：单表双源 + 视图过滤

队列持久化在 `MusicQueueItem` 单表，用 `source` 区分 ncm / bili。前端用**视图过滤**实现「双源独立列表」（`activeQueueOf`）：当前曲目 key 以 `bili:` 开头时显示 B站列表，否则显示网易云列表；切歌与洗牌都在活动列表内推进。

- 权威 key：`ncm:<songId>` 与 `bili:<bvid>:<cid>`（BV 号用 `^BV[0-9A-Za-z]{10}$` 校验）。
- **封面防盗链兜底**：hdslb.com 直链在应用内会 403，`setQueue` 统一入口把 B站封面改写为 `/api/stream/proxy-image`。新增 B站数据源时不要存原始直链。
- 队列操作（upsert / remove / reorder / clear）走 ack + `music:queue-changed` 完整广播。`afterCurrent: true` 表示插到当前曲目之后并右移后续 order；删除后 order 压实为 1..n。

### 同步事件与进度对齐

| 事件 | 说明 |
|---|---|
| `music:sync-state` | 房主→全员：`{trackSongId, trackKey, isPlaying, positionSec, playMode, updatedAt}` |
| `music:host-heartbeat` | 房主每 **2s**；`visibilitychange` 回前台立即补发 |
| `music:control-request` / `music:control-response` | 观众申请 `pause/play/next/prev/addQueue/seek/playItem`；`from/username` 由服务端 socket 身份注入防伪造；seek 上限 86400s |
| `music:sync-ack` | 观众切歌同步成功回执（房主「xx 已同步」提示） |
| `music:get-state` | 进房拉取 `{queue, syncState}`；失败退避重试 500ms×2（上限 3s）直到入房成功 |

- 观众离线判定：**7s** 未收到心跳（3.5 倍间隔）；页面 hidden 时跳过判定。
- 进度对齐：相差 **>2s** 才 seek；延迟补偿为 `positionSec + (Date.now()-updatedAt)/1000`，上限 **10s**，时钟不同源时回退原值。
- **同步状态只存内存 Map**：房主离线即失效，观众随之进入自主控制（`canControl = isHost || hostOffline`）；队列持久化，房间删除时清内存态。
- `addQueue` 申请不走审批弹窗：房主开启「自动通过」时直接代理入队，否则返回拒绝回执。

## B站音乐特有逻辑

### 搜索分页（200 虚拟页）

B站单排序最多 50 页、`numResults` 封顶 1000。后端把 **4 个排序分片**（综合 / 最多点击 / 最多弹幕 / 最多收藏，「最新发布」因时间线跳变不参与）各 50 页合并为 **200 虚拟页**（`SEARCH_MAX_PAGES = 200`，前后端同值），按 `虚拟页 → (order 分片, 真实页码)` 线性映射。随机模式从 1..200 抽页，再对当页做 Fisher-Yates 打乱。

### 自动连播（`biliAutoContinue`，默认开启）

只由用户主动点「下一首」触发；自然播完不触发，order 模式到末尾自然停止。链路：`/api/stream/bilibili/related` 拉推荐 → 去重已有队列 → 取前 3 条 → **倒序逐条以 `afterCurrent: true` 入队**（最终顺序与推荐一致）→ 标记 `recommended: true` → 续播第一条。拉取失败则回落为自然停止。

### 视频背景解析链（`useMusicVideoBackground.ts`）

| 前提 | 链路 | 清晰度 |
|---|---|---|
| CLI 开启且本地代理已连接 | CLI DASH 双轨 | 按分辨率选择指定档；`qn=0` 跟随账号默认（非大会员选了会员档时自动回落） |
| CLI 开启但代理未连接 | 服务器 MP4 直链（`preferMp4`，不回退 DASH） | 固定 720P |
| CLI 关闭 | 由「服务器 DASH 解析模式」决定走服务器 DASH 双轨或 MP4 直链 | DASH 同上；MP4 固定 720P |

分辨率选择（qn）对 CLI DASH 与服务器 DASH 均生效，MP4 直链忽略该设置。B站音频直链缓存 **2 小时**（直链本身 1~4 小时过期）。

- **可见性门控**：视频元素要等到 `canplay/playing`（首帧可播）才淡入，未就绪期间透出封面模糊背景——URL 就绪不等于画面就绪。
- **进度同步**：1s interval 命令式驱动。漂移 >1.5s 时先去抖（350ms）再 seek，并进入追赶模式（`rate = 1 + drift/4`，夹在 0.6~1.5，误差 ≤0.35s 后恢复原速）；`readyState < 3` 时跳过校正，防止 DASH 连续 seek 造成缓冲风暴。DASH 时长必须显式传给引擎（容器为 mvvh 时读出来是 0，缺失会让进度同步全部失效）。

## 歌词

- 网易云：`/api/music/ncm/lyric` 做三轨合并（原文 / 翻译 / 音译）；B站：走 AI 字幕接口，必须传 `&duration=`，带内校验见[视频管线](/advanced/video-pipeline)。
- 单行偏移：右键菜单提前或延后（步长 0.5s），按 `songKey → lineKey` 持久化。显示时间 = 原时间 − 偏移，并强制单调递增，防止行序错乱。
