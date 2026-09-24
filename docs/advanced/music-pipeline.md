# 一起听音乐管线

## 服务拓扑

```
前端 <audio>
   │  /api/music/stream?songId=&level=&roomId=
   ▼
主后端 /api/music/*
   │  callNcmApi()（附加 timestamp 绕内部服务 apicache）
   ▼
内部 NCM 服务 127.0.0.1:36530~36535
   │  @neteasecloudmusicapienhanced/api（serveNcmApi）
   ▼
网易云上游
```

内嵌 NCM 服务由主后端进程内嵌启动（`ncm-api.service.ts`）：绑定 `127.0.0.1`（安全底线，必须显式传 host——包内 fallback 会读 `process.env.PORT/HOST` 与主服务冲突），基准端口 **36530** 占用时 +1 重试最多 5 次，启动探测（HTTP 轮询就绪）总限 15s。启动失败不阻塞主服务，`/api/music/*` 据此返回 503 `NCM_UNAVAILABLE`。

`callNcmApi()` 每次请求附加 `timestamp=Date.now()`：内部服务挂有 2 分钟 apicache 中间件，**缓存 key 不含 Cookie**，不同登录态的相同 URL 会命中同一缓存串味（匿名结果被 VIP 用户拿到）——用唯一 URL 绕过。

## 路由与登录态（`/api/music/ncm/*`）

- **通用转发**：仅 GET/POST；自动注入当前用户持久化的网易云 Cookie（`NcmCredential` 表按 userId 隔离，游客不落库）；**剥离 query/body 中的 `cookie` / `noCookie` 参数**，防止客户端伪造登录态。
- **扫码登录路径**（`/login/qr/key|create|check`）**不注入旧凭据**——网易云以请求携带的 cookie 判定登录态，带过期 MUSIC_U 会让二维码轮询异常（800 循环）导致扫码无效；check 成功（803）响应的 Set-Cookie 正常持久化并解析 profile（昵称/头像/vipType）。
- Cookie 持久化判定：Set-Cookie 含 `music_u` 或名含 `csrf`；按 cookie 名去重合并（新覆盖旧）。
- VIP 归一：`/vip/info` 兜底后 10=VIP / 11=SVIP（黑胶/音乐包/PLUS 三档会员对象判定有效期）。
- 上游 3xx 不跟随，以 `{ code: 'REDIRECT', location }` 回传。

## 音频流代理 `/api/music/stream`

### 音质降级链

```
lossless → exhigh → higher → standard
```

从请求档位（默认 `exhigh`）在链中的位置开始逐档尝试 `/song/url/v1`；`data.url` 非空且 **`freeTrialInfo == null`** 才可用（试听片段与不可用同等对待）。全链失败且出现过试听片段 → 403 `VIP_REQUIRED`。

### 回退与防护

- **v1 → 老接口回退**：`/song/url/v1` 路由 404（内部服务依赖残缺）时回退 `/song/url`，level→br 映射：lossless 999000 / exhigh 320000 / higher 192000 / standard 128000；老接口模块依赖更少，依赖残缺时仍可用。
- **凭证回退链**：当前用户 Cookie → 房主 Cookie（请求带 `roomId` 时反查 `Room.ownerUserId`）——「房主登录 VIP，全房间可听」。`<audio>` 无法带 Authorization 头，token 从 query 读取。
- **SSRF 防护**：解析出的直链域名必须匹配 `*.music.126.net`，否则拒绝转发。
- **direct=1 模式**：以 **302 重定向**把 CDN 直链交给 `<audio>` 直连（省服务器带宽），直链缓存 **15 分钟**（签名实际有效期 20~30 分钟），缓存 key 含实际生效凭证归属——VIP 直链只发给同一凭证链解析的请求；`http:` 直链统一改写 `https:` 防 mixed content。
- 代理流模式透传 Range（上游 206 必须转发）、1MB 高水位读块、客户端断连时 abort 上游并显式销毁流。
- 错误码：403 `VIP_REQUIRED` / 404 `NO_COPYRIGHT`（`/check/music` 判定）/ 502 `RESOLVE_FAILED` / 503 `NCM_UNAVAILABLE`。

## 房间内同步

### 队列模型：单表双源 + 视图过滤

队列持久化于 `MusicQueueItem` 表（单一队列，`source` 字段区分 ncm/bili），前端用**视图过滤**实现「双源独立播放列表」语义（`activeQueueOf`）：当前曲目 key 以 `bili:` 开头时显示 B站列表，否则显示网易云列表；切歌/洗牌均在活动列表内推进。

- 权威 key：`ncm:<songId>` / `bili:<bvid>:<cid>`（BV 号正则 `^BV[0-9A-Za-z]{10}$` 校验）。
- **封面防盗链兜底**：hdslb.com 直链应用内 403，`setQueue` 统一入口把 B站封面改写为 `/api/stream/proxy-image` 代理——新增 B站 数据源不要存原始直链。
- 队列操作（upsert/remove/reorder/clear）全部走 ack + `music:queue-changed` 完整队列广播；`afterCurrent: true` 插到当前曲目后并右移后续 order；删除后 order 压实 1..n。

### Socket 事件与对齐数学

| 事件 | 说明 |
|---|---|
| `music:sync-state` | 房主→全员：`{trackSongId, trackKey, isPlaying, positionSec, playMode, updatedAt}` |
| `music:host-heartbeat` | 房主每 **2s**；`visibilitychange` 回前台立即补发（后台 timer 节流兜底） |
| `music:control-request` / `music:control-response` | 观众申请 `pause/play/next/prev/addQueue/seek/playItem`；`from/username` 由服务端 socket 身份注入防伪造；seek 上限 86400s |
| `music:sync-ack` | 观众切歌同步成功回执（房主「xx 已同步」提示） |
| `music:get-state` | 加入房间时拉取 `{queue, syncState}`；失败退避重试 500ms×2（上限 3s）直到入房成功 |

- 观众离线判定：**7s** 未收到心跳（3.5 倍间隔，容忍抖动），页面 hidden 期间跳过判定。
- 进度对齐：差 **>2s** 才 seek；传输延迟补偿 `positionSec + (Date.now()-updatedAt)/1000`，补偿上限 **10s**（时钟不同源回退原值）。
- **同步状态只存内存 Map**：房主离线即失效（观众自动进入自主控制 `canControl = isHost || hostOffline`），队列则持久化——房间删除时清空内存态。
- `addQueue` 申请不走审批弹窗：房主开「自动通过」时代理入队并应答，否则直接拒绝回执。

## B站音乐特有逻辑

### 搜索分页（200 虚拟页）

B站单排序最多 50 页、`numResults` 封顶 1000。后端把 **4 个排序分片**（综合/最多点击/最多弹幕/最多收藏；「最新发布」因时间线跳变不参与）各 50 页合并为 **200 虚拟页**（`SEARCH_MAX_PAGES = 200`，前后端同值）：`虚拟页 → (order 分片, 真实页码)` 线性映射。随机模式从 1..200 池子随机抽页 + 当页 Fisher-Yates 打乱。

### 自动连播（`biliAutoContinue`，默认开启）

- **仅用户主动点「下一首」触发**，曲目自然播完不触发（order 模式末尾自然停止，不回绕）。
- 链路：`/api/stream/bilibili/related` 拉推荐 → 去重已有队列 → 取前 3 条 → **倒序逐条 `afterCurrent: true` 入队**（最终顺序与推荐一致）→ 条目带 `recommended: true` 标记 → 续播第一条。拉取失败回落自然停止。

### 视频背景解析链（`useMusicVideoBackground.ts`）

- CLI 开启且代理在线 → CLI 高画质 DASH（qn=0 表示跟随账号默认，非大会员已选会员档自动回落）；否则回退服务器 720P MP4（`preferMp4: true`）。
- B站音频直链缓存 **2 小时**（直链 1~4 小时过期）。
- **可见性门控**：视频元素等 `canplay/playing`（首帧可播）才淡入，未就绪期间透出封面模糊背景——「URL 就绪 ≠ 画面就绪」。
- **进度同步**：1s interval 命令式驱动；漂移 >1.5s 去抖（350ms）后 seek 并进入追赶模式（`rate = 1 + drift/4`，夹在 0.6~1.5，误差 ≤0.35s 恢复原速）；`readyState < 3` 时跳过校正（防 DASH 连续 seek 缓冲风暴）。DASH 时长必须显式传给引擎（容器 mvvh 时长为 0，缺失时 `video.duration` 无效、进度同步全失效）。

## 歌词

- 网易云：`/api/music/ncm/lyric` 三轨合并（原文/翻译/音译）；B站：AI 字幕接口（须传 `&duration=`，见[视频管线](/advanced/video-pipeline)的带内校验）。
- 单行偏移：右键菜单提前/延后（步长 0.5s），按 `songKey → lineKey` 持久化，显示时间 = 原时间 − 偏移并强制单调递增防行序倒乱。
