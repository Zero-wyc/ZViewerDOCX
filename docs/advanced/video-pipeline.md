# 视频源与 API 获取逻辑

从「拿到 BV 号或直链」到「浏览器里播出来」的完整链路：B站解析、代理层、直链实时解析、播放引擎、字幕、弹幕、推流与下载。参数集中在文末常量表。

## Bilibili 解析

### 请求链路

前端输入先规整成 BV 号，再依次补齐会话、权限与播放地址：

1. 提交 BV / AV 号、视频链接或 b23.tv 短链。短链只信任 `b23.tv` / `bili2233.cn`（精确匹配），GET 跟随重定向、8s 超时，成功后立即取消响应体释放连接。
2. 用 `/BV[0-9A-Za-z]{10}/` 提取 BV 号，失败再试 av 号。`?p=N` 与 `page` 参数解析分 P，`cid` 从 `pages` 反查。
3. **匿名会话预热**：无 Cookie 时先调 `x/frontend/finger/spi` 取 buvid3 / buvid4（设备指纹，30 分钟 TTL），否则部分匿名请求会被风控。
4. **VIP 状态与视频信息并行请求**，省 1 个 RTT。VIP 判定缓存 5 分钟，视频信息缓存 2 分钟。
5. playurl 优先走 WBI 签名端点（签名 key 缓存 30 分钟）；失败且不属权限错误时降级到未签名端点。
6. 结果以 **NDJSON 流式响应**逐行输出，前端边收边渲染进度。

### NDJSON 流式协议

响应头为 `Content-Type: application/x-ndjson` 与 `X-Accel-Buffering: no`；不设 `Connection` / `Transfer-Encoding`（hop-by-hop 头经反代会冲突）。每行写完立即 `flush()`。

```
{"status":"parsing","step":"info","message":"正在解析视频信息..."}
{"status":"parsing","step":"playurl","message":"获取播放地址..."}
{"success":true,"status":"done","videoUrl":"...","audioUrl":"...","format":"dash","currentQn":80,...}
{"success":false,"status":"error","message":"...","code":"NO_PERMISSION"}
```

- 进度 step 依次为 `vip` → `info` → `playurl` → `quality` → `cdn` → `fallback` → `finish`。
- 错误码：`RESOLVE_FAILED / VIDEO_NOT_FOUND / NOT_LOGGED_IN / NO_PERMISSION / INFO_FAILED / INVALID_INPUT / MP4_NOT_AVAILABLE / CDN_UNREACHABLE / DASH_NOT_AVAILABLE / NO_PLAYURL`。
- 前端整体 30s 超时（AbortController），先全量 `res.text()` 再逐行 parse，以规避部分浏览器对流式响应报 `net::ERR_ABORTED`；同时兼容旧版纯 JSON。

### 清晰度与大会员

| 身份 | 默认清晰度 | 上限 |
|---|---|---|
| 未登录 | 480P（qn=32） | 480P |
| 登录非会员 | 1080P（qn=80） | 1080P（VIP 专属档被过滤） |
| 大会员 | 4K（qn=120） | 8K（qn=127，fnval 追加 2048） |

取不到目标档位时的降级规则：

- `VIP_ONLY_QNS = [112, 116, 120, 125, 126, 127]`，对应 1080P+ / 1080P60 / 4K / HDR / 杜比 / 8K。
- 权限不足时 qn 降到 32 / 16 重试；请求的 qn 不在 acceptQuality 中时回退到最高可用档重新请求。
- MP4 模式（fnval=1 + platform=html5）最高 720P，这是 B站服务端硬限制，与会员状态无关；1080P 以上全部依赖 DASH 分离流。MP4 降级参数带 `try_look=1`，返回无防盗链直链。

### CDN 健康检查

取到地址后先探活：对 baseUrl + backupUrl 并行发起 HEAD + `Range: bytes=0-0` 竞速，接受 `ok || 405`，单条超时 3.5s、整体兜底 4s。部分 CDN 对 HEAD 返回 403 但 GET 正常，此时回退原始 URL。`.mcdn.bilivideo.cn:8082` 的 P2P CDN 地址会移除端口改走 443。

B站 API 公共封装：Chrome 120 UA、`Referer/Origin: https://www.bilibili.com`、单请求 10s 超时，**412 风控自动重试 3 次（1~2s 随机退避）**。

### 番剧与影视（PGC）

ep / ss 链接走独立解析管线：

- **链接识别**：`/bangumi/play/ep829609`、`/bangumi/play/ss45612` 显式路径直接命中；裸 `ep123` / `ss456` 仅在无 BV / av 上下文且紧邻字符不是字母数字时认定（避免 `step1`、`sleep2` 误匹配），BV / av 优先。
- **整季分集**：ep 号先换整季信息（`pgc/view/web/season`），返回全部分集的 ep_id、cid、badge 与权威时长；badge（`会员` / `限免` / 空）用于标注会员专享集；仅 status=2（已上线）可选。
- **播放地址**：走 `pgc/player/web/playurl`（SESSDATA 鉴权，无 WBI 签名）。dash / durl 结构与普通视频一致，仅载荷在顶层 `result`（普通视频在 `data`），归一化后共用下游处理。
- **试看判定不依赖 timelength**：会员集对非会员返回试看 MP4，且 API 把 timelength 虚报为完整时长，因此由解析结果显式标记，不做时长比对。
- **错误归一**：-403（付费 / 大会员）、-404（下架）、-10403（地区限制）统一转为解析错误码。
- **防盗链**：PGC 的 MP4 直链强制 B站 Referer，由服务器代理转发，不走浏览器直连。

### 解析身份与默认模式

- **锚定房主 Cookie**：服务器侧解析默认以影片所属房间**房主的 B站 Cookie 身份**执行，房主为大会员时会员内容全房间可拿完整地址，观众身份不参与服务器解析（见 [CLI 代理协议](/advanced/cli-protocol)）。多 P 视频切分 P 后解析显式携带 page，缓存 key 含 page 维度。
- **影片级「仅允许CLI模式」**：番剧 / 影视可开启 cliOnly——成员必须连接本机 ZViewer CLI 观看，媒体流不经服务器，服务器仅承担同步信令；CLI 未连接时给出安装引导，不回退服务器转发。解析请求本身仍走服务器。
- **默认解析参数**（管理端基础设置）：普通视频 `bilibiliDefaultParseMode`（默认 mp4）；番剧影视 `bilibiliPgcDefaultMode`（默认 mp4）。影片未显式配置时按此回落。

## 代理层 `/api/stream/proxy*`

浏览器直连 B站媒体会被防盗链与 CORS 挡住，代理层由 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`）统一实现：

- **域名白名单**：媒体代理只放行 `bilibili.com / bilivideo.com / hdslb.com / biliimg.com / bstatic.com` 等后缀匹配，加 akamaized 精确项（共享 CDN 不能按后缀放行，否则会给第三方域名错误注入 B站 Referer）；图片代理只放行 4 个 B站图床域名。
- **防盗链头**：B站 URL 注入 `Referer/Origin` 加 Chrome UA；非 B站 URL 不注入。
- **Range 有界分片**：开放式 `bytes=0-` 与超长区间截断为有界分片；suffix（`bytes=-N`）与多段原样透传。上游 206 必须转发，透传 `content-length/content-range/accept-ranges/etag/last-modified` 并无条件补 `Accept-Ranges: bytes`；支持 `If-None-Match` / `If-Range` 走 304。
- **断连销毁**：客户端 `res.on('close')` 时 abort 上游 fetch 并显式 destroy 流（Node 的 pipe 不会自动销毁源流）。
- 上游 30s 超时只覆盖「连接 + 等响应头」，body 传输不中断；响应补 `X-Accel-Buffering: no` 禁用反代缓冲。
- **前端路由决策中心**（`url-proxy.ts` `resolveMediaRoute`）：本站 / blob / 相对路径直连；B站 DASH（`.m4s`）强制走服务器代理；B站 MP4 直链先直连、失败回退代理一次；HTTPS 页面下的 http 跨域源走代理（挂载直链模式跳过）；CLI 代理（127.0.0.1）属浏览器信任源，https 页面可直连。

## 直链实时解析 `/api/direct-resolve/*`

影片记录里的 url 只是添加时刻的快照，AList 签名会过期、源站协议也可能变化，因此播放时实时取一次新鲜直链，固化 URL 仅作兜底：

- **5 分钟 TTL 缓存**（LRU，上限 500），key 为 `type|serverUrl|path`，可跨影片、跨房间共享。
- **单飞去重**：并发同 key 请求共享同一个 Promise，完成才写缓存，避免冷启动重复解析压垮源站。
- 优先走 AList API（许多用户把 AList 以 WebDAV 类型挂载，API 签名直链更可靠）；webdav 失败回退直链拼接（Basic Auth 内嵌）；openlist 失败直接报错不回退；ftp 无直链模式，固定走服务器代理。
- **HTTPS 活性校验与自愈**（`mount-utils.ts`）：缓存里的「该源支持 https 直链」是一次性探测结果，源站撤掉 TLS 后缓存地址永久不可达。因此下发前对 https 端点现场再探测（HEAD，5s 超时，2xx~5xx 均算成功），失败即把 `httpsDirect` 改写为 false 并**持久化回写数据库**，本次返回 http 直链。前端另有兜底：http 页面加载 https 直链失败时降级 http 重试一次。
- Emby / Jellyfin：从 `/resolve` 实时取 MediaSources。音轨不在浏览器支持白名单（aac/mp3/flac/opus/vorbis）时自动切服务端转码 HLS（`main.m3u8?AudioCodec=aac...`），这类代理超时放宽到 90s（转码冷启动 30s 会被默认超时误杀）。

## 播放引擎

### 引擎选择（`engine-selector.ts`）

优先级：`format==='dash' || audioUrl` → **videojs10-dash**（video.js 10 作状态层，dash.js 5.2.0 作执行层，自研 MPD 构建包装 m4s）→ `hls` → `flv` → `shouldUsePlaysVideo()` 为真时用 **playsvideo** → 否则 **videojs10**（直链引擎，`selectDirectEngine()`；localStorage 设 `zviewer-vjs10-engine = '0'` 可回落经典 direct 引擎）。

| 场景 | 引擎 | 判定 |
|---|---|---|
| MP4 / WebM / MOV | videojs10 | 原生可播，30s metadata 超时 |
| AVI / TS / WMV | playsvideo | 浏览器无法原生打开，必须重封装 |
| MKV | playsvideo | 原生支持仅限 H.264/AAC，DTS/AC3 音轨需转码 |
| DTS / AC3 / EAC3 / TrueHD 音轨 | playsvideo | `needsBrowserTranscode` 判定，浏览器端转 AAC |

playsvideo 的唯一门控是影片级「浏览器转码引擎」开关（`playsvideoEnabled`）：关闭即强制原生直连，原生失败不回退；未设置时只要浏览器具备 MSE + Worker 即按上表生效。

- **playsvideo 管线**：mediabunny 流式 demux（Range 随机读取）→ 关键帧对齐分段 → 视频直通重封装或音频按需转码（AC3/EAC3/DTS/FLAC/MP3/Opus → AAC）→ fMP4 分段 + m3u8 → hls.js 按段拉取。取流 URL **必须同源**，跨域一律包装 `/api/stream/proxy?url=`。准备超时 60s。
- **服务器零依赖**：转码核心随前端资源分发（专用 ffmpeg 构建约 1.9MB）。
- **attach 互斥与世代模型**（`usePlayerSource.ts`）：attach 走串行队列，用 `attachEpochRef` 做世代计数；一次 attach 在 await 期间被新加载取代时静默退出，消除假超时。另有 video 级会话登记表（WeakMap，后发起者赢），避免跨实例并发 attach 到同一 video 造成双声。401/403 时自动 `refreshAccessToken()` 后重试一次。

## 字幕

### 内嵌字幕提取（MKV）

自研 `MatroskaDemuxer` 做流式解复用（`lib/mkv/`），未使用 ffmpeg.wasm（需整文件载入，上限约 2GB）。

- 先做头部 4MB Range 预取收齐 Tracks。≤512MB 全量顺序扫描；更大文件走**稀疏提取**：Cues 锚点分段、按元素 size 链前进、音视频负载按字节算术跳过，5GB 级片源只需传约 10% 字节。稀疏窗口 64KB（12 并发会使代理失效，限 2 并发），worker 按「距当前播放位置最近」选锚点（seek 感知）。
- 支持文本轨 SRT/ASS/SSA/WEBVTT；PGS 位图轨由 `pgs-decoder.ts` 解码调色板 RLE 位图后按时间轴渲染为图片；VOBSUB 仍不支持。
- Emby/Jellyfin 内嵌字幕走后端 `/embedded-tracks` + `/embedded-extract`。外挂字幕搜索覆盖 webdav/openlist/ftp/server-files，文件上限 2MB。

### B站 AI 字幕

`x/player/v2` 不稳定：同一 (bvid, cid) 会**随机返回其他视频的字幕**，且字幕 JSON 内没有视频标识。后端 `/api/stream/bilibili/ai-subtitle` 设了三重防线：

1. **带外校验**：subtitle_url 的 `oid` 必须等于 aid。
2. **带内校验**：时间轴终点须约等于时长，容差 `max(10s, 时长 × 8%)`。前端必须传 `&duration=`（秒），非法时用官方时长兜底。
3. **一致性投票**：最多 6 次（间隔 180ms），按内容指纹（`len:首行:末行to`）投票，两次一致即确认；全部不达标返回空。成功缓存 10 分钟，失败负缓存 60s。

## 弹幕

- **B站官方 XML**：`x/v1/dm/list.so?oid=<cid>`，正则解析 `<d p="...">` 属性段（time/mode/size/color…），XML 实体手动反转义；前端按 mode 映射滚动 / 顶部 / 底部轨道。
- **第三方聚合**：provider 注册表含 bilibili-video / bilibili-bangumi / 巴哈姆特 / 弹弹play。搜索时把关键词生成「原文 + 繁体 + 简体」三变体并行请求再去重排序；`/fetch` 的 `playbackParams` 必须原样回传（弹弹play 缺 episodeId 会报错）。
- **渲染**（`danmakuEngine.ts`，基于 danmaku 库）：字号 = 用户基准 × B站 size 比例 × 屏幕比例（0.5~1.5 自适应）。屏蔽支持关键词与类型（滚动 / 固定 / 高级 / 彩色）两个维度，变更后清空重载。实时弹幕与屏蔽词经 Socket 跨端同步（`RoomDanmakuMeta`）。
- **本地导入**（`localImport.ts`，纯前端解析）：支持 B站 XML / B站 JSON / dandanplay JSON，解析结果作为独立弹幕轨道挂载，不经服务器。

## OBS 推流与 B站下载

- **Node Media Server**：RTMP 监听 3334（`chunk_size: 60000, gop_cache: true, ping: 30`），HTTP-FLV 监听 3335，由 `/live` 反代。`STREAM_PUSH_ENABLED=0` 时完全不启动，3334/3335 不监听。推流码在 `postPublish` 校验：路径为 `/live/<streamKey>`，且房间 active、投屏模式、stream-push 子模式。推流与断流广播 `stream-status {live|offline}`，DB 查询失败也不漏广播（活跃会话 Map 兜底）。
- **OBS 配置一键下载**：`GET /api/stream-push/obs-config/:roomId` 生成场景集合 JSON（rtmp_custom），无 streamKey 时自动生成。
- **server-files B站下载**（仅 root）：走 `preferMp4 + skipCdnCheck`。DASH 分离流需服务器 FFmpeg 合并，而 FFmpeg 已移除；B站 MP4 接口硬限 720P，因此高画质下载需走 CLI 模式。进度以 NDJSON 输出（每 2% 或 512KB），失败自动清理不完整文件，VIP 档位做服务端强校验。

## 关键常量速查

| 常量 | 值 |
|---|---|
| MP4 直链清晰度上限 | 720P（qn=64，B站硬限制） |
| B站单请求超时 / 412 重试 | 10s / 3 次（1~2s 退避） |
| CDN 健康检查 | 3.5s 单条 / 4s 兜底 |
| 直链解析缓存 / https 探测 | 5min（LRU 500）/ 5s |
| 代理上游超时 | 30s（仅连接 + 响应头阶段） |
| direct 引擎 metadata / playsvideo 准备超时 | 30s / 60s |
| MKV 提取 | 头部 4MB / 全量 ≤512MB / 稀疏窗口 64KB / 并发 2 |
| AI 字幕 | 6 次尝试 / 容差 max(10s, 8%) / 成功缓存 10min |
| FLV 追帧 | max 1.5s / target 0.5s |
