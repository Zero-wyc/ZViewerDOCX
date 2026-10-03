# 视频源与 API 获取逻辑

本页说明影片从「拿到一个 BV 号或直链」到「在浏览器里播出来」之间经过的每一段处理：B站解析、代理层、直链实时解析、播放引擎选择、字幕提取、弹幕加载，以及推流与下载。各段的参数统一收在末尾的常量表里。

## Bilibili 解析

ZViewer 负责把 B站视频还原成可播放的媒体地址，整个过程对前端是流式可见的。这一节按请求链路、流式协议、清晰度档位和 CDN 可用性四部分说明。

### 请求链路

前端提交的输入先被规整成 BV 号，再依次补齐会话、权限和播放地址。完整步骤如下。

1. 前端提交 BV / AV 号、视频链接或 b23.tv 短链。短链展开只信任 `b23.tv` / `bili2233.cn` 两个域名（精确匹配），GET 跟随重定向、8s 超时，成功后立即取消响应体释放连接。
2. 用正则 `/BV[0-9A-Za-z]{10}/` 提取 BV 号，失败再试 av 号。URL 的 `?p=N` 与 `page` 参数解析分 P，`cid` 从视频信息的 `pages` 反查。
3. **匿名会话预热**：没有 Cookie 时先调 `x/frontend/finger/spi` 取 buvid3/buvid4（设备指纹，30 分钟 TTL）。B站匿名接口需要设备指纹，否则部分请求会被风控。
4. **VIP 状态与视频信息并行请求**，省下 1 个 RTT（一次网络往返）。VIP 判定缓存 5 分钟，视频信息缓存 2 分钟。
5. playurl 请求优先走 WBI 签名端点（B站给请求加的防篡改签名，缺了会被拒；签名 key 缓存 30 分钟）。请求失败且不属于权限错误时，降级到未签名端点。
6. 结果以 **NDJSON 流式响应**逐行输出，前端逐行读取并渲染进度。

### NDJSON 流式协议

NDJSON（Newline Delimited JSON，每行一个独立 JSON 对象）让前端能边收边渲染进度，不必等整个响应结束。响应头为 `Content-Type: application/x-ndjson` 和 `X-Accel-Buffering: no`；不设 `Connection`/`Transfer-Encoding`，因为这两类是 hop-by-hop 头，经反代会冲突。每行写完后立即 `flush()`。

```
{"status":"parsing","step":"info","message":"正在解析视频信息..."}
{"status":"parsing","step":"playurl","message":"获取播放地址..."}
{"success":true,"status":"done","videoUrl":"...","audioUrl":"...","format":"dash","currentQn":80,...}
{"success":false,"status":"error","message":"...","code":"NO_PERMISSION"}
```

- 进度 step 依次为 `vip` → `info` → `playurl` → `quality` → `cdn` → `fallback` → `finish`。
- 错误码集合：`RESOLVE_FAILED / VIDEO_NOT_FOUND / NOT_LOGGED_IN / NO_PERMISSION / INFO_FAILED / INVALID_INPUT / MP4_NOT_AVAILABLE / CDN_UNREACHABLE / DASH_NOT_AVAILABLE / NO_PLAYURL`。
- 前端整体 30s 超时（AbortController）。它会先全量 `res.text()` 再逐行 JSON.parse，以规避部分浏览器对流式响应报 `net::ERR_ABORTED`；同时兼容旧版纯 JSON 响应。

### 清晰度与大会员

B站允许的清晰度取决于账号身份。下表列出三种身份各自的默认档位与上限。

| 身份 | 默认清晰度 | 上限 |
|---|---|---|
| 未登录 | 480P（qn=32） | 480P |
| 登录非会员 | 1080P（qn=80） | 1080P（VIP 专属档被过滤） |
| 大会员 | 4K（qn=120） | 8K（qn=127，fnval 追加 2048） |

取不到目标档位时，解析器按以下规则降级。

- `VIP_ONLY_QNS = [112, 116, 120, 125, 126, 127]`，依次对应 1080P+ / 1080P60 / 4K / HDR / 杜比 / 8K。
- 权限不足时自动降级重试：qn（清晰度档位编号）降到 32/16；请求的 qn 不在 acceptQuality 中时，回退到最高可用档重新请求。
- MP4 模式（fnval=1 + platform=html5，fnval 是 B站用于开关返回格式的参数）最高只有 720P。这是 B站服务端的硬限制，与会员状态无关，1080P 以上全部依赖 DASH 分离流（音视频分成两条流分别提供）。MP4 降级参数带 `try_look=1`（参考 synctv），返回无防盗链的直链。

### CDN 健康检查

直链所在的 CDN 节点未必可用，所以取到地址后还要先探活。后端对 baseUrl + backupUrl 并行发起 HEAD + `Range: bytes=0-0` 竞速，接受 `ok || 405`，单条超时 3.5s，整体兜底 4s 强制返回。部分 CDN 对 HEAD 返回 403 但 GET 正常，此时回退原始 URL。`.mcdn.bilivideo.cn:8082` 的 P2P CDN 地址会被移除端口改走 443，以提高连通率。

B站 API 的公共请求封装为：Chrome 120 UA、`Referer/Origin: https://www.bilibili.com`、单请求 10s 超时，遇到 **412 风控自动重试 3 次（1~2s 随机退避）**。

## 代理层 `/api/stream/proxy*`

浏览器直接请求 B站媒体会被防盗链和 CORS 挡住，代理层就是为了绕开这两点。它统一由 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`）实现，规则如下。

- **域名白名单**：媒体代理只放行 `bilibili.com / bilivideo.com / hdslb.com / biliimg.com / bstatic.com` 等后缀匹配，加上 akamaized 精确项。共享 CDN 不能按后缀放行，否则会给第三方域名错误注入 B站 Referer。图片代理只放行 4 个 B站图床域名。
- **防盗链头**：B站 URL 注入 `Referer/Origin: https://www.bilibili.com` 加 Chrome UA；非 B站 URL 不注入，错误的 Referer 反而会被源站拒绝。
- **Range 有界分片**：开放式 `bytes=0-` 和超长区间会被截断为有界分片；suffix（`bytes=-N`）与多段原样透传。上游 206 必须转发。透传 `content-length/content-range/accept-ranges/etag/last-modified`，并无条件补 `Accept-Ranges: bytes`。支持 `If-None-Match`/`If-Range` 走 304。
- **断连销毁**：客户端 `res.on('close')` 时 abort 上游 fetch 并显式 destroy 流。Node 的 pipe 不会自动销毁源流，这正是「用户下线后服务器流量仍在运行」的原因。
- 上游 30s 超时只覆盖「连接 + 等响应头」，body 传输不中断。响应补 `X-Accel-Buffering: no` 以禁用反代缓冲。
- **前端路由决策中心**（`url-proxy.ts` `resolveMediaRoute`）：本站/blob/相对路径直连；B站 DASH（`.m4s`）强制走服务器代理（防盗链 + 无 CORS）；B站 MP4 直链先直连、失败回退代理一次；HTTPS 页面下的 http 跨域源走代理（混合内容防护，挂载直链模式跳过）；CLI 代理（127.0.0.1）属于浏览器信任源，https 页面直连不受限。

## 直链实时解析 `/api/direct-resolve/*`

影片记录里的 url 只是**添加时刻的快照**，而 AList 签名会过期、源站协议也可能变化，所以播放时要实时取一次新鲜直链，固化 URL 仅作兜底。取值过程遵循这些约定。

- **5 分钟 TTL 缓存**（LRU，即容量满时淘汰最久未用项，上限 500），缓存键为 `type|serverUrl|path`，可跨影片、跨房间共享。
- **单飞去重**：并发的同 key 请求共享同一个 Promise，完成才写缓存，避免冷启动时重复解析压垮源站。
- 解析优先走 AList API（很多用户把 AList 以 WebDAV 类型挂载，API 签名直链更可靠）；webdav 失败回退直链拼接（Basic Auth 内嵌）；openlist 失败直接报错，不回退。ftp 没有直链模式，固定走服务器代理。
- **HTTPS 活性校验与自愈**（`mount-utils.ts`）：缓存里记录的「该源支持 https 直链」是一次性探测结果，源站事后撤掉 TLS 时，缓存直链会永久不可达。因此下发前会对 https 端点现场再探测一次（HEAD，5s 超时，2xx~5xx 均算成功），失败即把 `httpsDirect` 改写为 false 并**持久化回写数据库**（自愈），本次返回 http 直链。前端另有兜底：http 页面加载 https 直链失败时降级 http 重试一次。
- Emby / Jellyfin：从 `/resolve` 实时取 MediaSources。音轨不在浏览器支持白名单（aac/mp3/flac/opus/vorbis）时，自动切服务端转码 HLS（`main.m3u8?AudioCodec=aac...`）。这类转码代理的超时放宽到 90s，因为转码冷启动 30s 会在默认超时下被误杀。

## 播放引擎

拿到可播地址后，前端还要按容器格式和音视频编码挑一个引擎。这一节说明选择的优先级，以及每种场景落到哪个引擎。

### 引擎选择（`engine-selector.ts`）

引擎按固定优先级挑选：`format==='dash' || audioUrl` → **videojs10-dash**（video.js 10 当状态层，dash.js 5.2.0 当执行层，自研 MPD 构建包装 m4s）→ `hls` → `flv` → `shouldUsePlaysVideo()` 为真时用 **playsvideo** → 否则用 **videojs10**（直链引擎，`selectDirectEngine()`；v10 headless store 接管播放状态层，加载路径复用 direct 管线。localStorage 设 `zviewer-vjs10-engine = '0'` 可回落经典 direct 引擎）。下表给出各典型场景的判定依据。

| 场景 | 引擎 | 判定 |
|---|---|---|
| MP4 / WebM / MOV | videojs10 | 原生可播，30s metadata 超时 |
| AVI / TS / WMV | playsvideo | 浏览器完全无法原生打开，必须重封装 |
| MKV | playsvideo | 一律交给 playsvideo：浏览器对 MKV 的原生支持仅限 H.264/AAC 组合，且 DTS/AC3 等音轨需要转码 |
| DTS / AC3 / EAC3 / TrueHD 音轨 | playsvideo | `needsBrowserTranscode` 判定，浏览器端转 AAC |

playsvideo 的唯一门控是影片级「浏览器转码引擎」开关（添加影片时的 `playsvideoEnabled`）。开关关闭即强制原生直连播放，原生失败不回退管线；开关未设置或缺省时，只要浏览器具备运行条件（MSE + Worker）即按上表生效。

- **playsvideo 管线**：mediabunny 流式 demux（Range 随机读取）→ 关键帧对齐分段计划 → 视频直通重封装或音频按需转码（AC3/EAC3/DTS/FLAC/MP3/Opus → AAC）→ fMP4 分段加 m3u8 → hls.js 按取段。取流 URL **必须同源**，跨域一律包装 `/api/stream/proxy?url=`，否则既带不了防盗链头，也过不了 CORS。准备超时 60s。
- **服务器零依赖**：转码核心随前端资源分发（专用 ffmpeg 构建约 1.9MB），服务器不需要 FFmpeg。
- **attach 互斥与世代模型**（`usePlayerSource.ts`）：attach 走串行队列，并用 `attachEpochRef` 做世代计数。一次 attach 在 await 期间被新的加载取代时，它会静默退出，不报错也不走回退链，从而消除前序会话被打断后的假超时。另有 video 级会话登记表（WeakMap，后发起者赢），终结跨实例并发 attach 到同一个 video 导致的双声。鉴权失效（401/403）时自动 `refreshAccessToken()` 后重试一次。

## 字幕

字幕有两条来源：影片容器里内嵌的轨道，以及从外部搜索来的外挂字幕。这一节说明这两条路怎么走。

### 内嵌字幕提取（MKV）

前端自研了 `MatroskaDemuxer` 做流式解复用（`lib/mkv/`），没有用 ffmpeg.wasm——后者必须整文件载入，且上限约 2GB。

- 先做头部 4MB Range 预取，收齐 Tracks 元素。≤512MB 的文件全量顺序扫描；更大的文件走**稀疏提取**：Cues 锚点分段、按元素 size 链前进、音视频负载按字节算术跳过，5GB 级片源只需传输约 10% 的字节。稀疏窗口 64KB（实测 12 并发会使代理失效，因此限制为 2 并发），worker 按「距当前播放位置最近」的优先级选锚点，即 seek 感知。
- 支持文本轨 SRT/ASS/SSA/WEBVTT；PGS 位图轨（HDMV PGS，Blu-ray 常用的图形字幕）由自研 `pgs-decoder.ts` 解码调色板 RLE 位图后按时间轴渲染为图片；VOBSUB 位图轨仍不支持。
- Emby/Jellyfin 的内嵌字幕走后端 `/embedded-tracks` + `/embedded-extract`（按扩展名路由转封装）。外挂字幕搜索覆盖 webdav/openlist/ftp/server-files 四个源，文件上限 2MB。

### B站 AI 字幕

`x/player/v2` 这个服务端接口不稳定：同一个 (bvid, cid) 会**随机返回其他视频的字幕文件**，而字幕 JSON 内没有任何视频标识可供校验。后端 `/api/stream/bilibili/ai-subtitle` 因此设了三重防线。

1. **带外校验**：subtitle_url 的 `oid` 参数必须等于 aid。
2. **带内校验**：字幕时间轴终点须约等于视频时长，容差为 `max(10s, 时长 × 8%)`。前端必须传 `&duration=`（秒），非法时服务端用官方时长兜底。
3. **一致性投票**：最多尝试 6 次（间隔 180ms），按内容指纹（`len:首行:末行to`）投票，两次一致即确认。全部不达标时返回空，不返回可疑字幕。成功缓存 10 分钟，失败负缓存 60s。

## 弹幕

弹幕数据来自 B站官方接口或第三方聚合源，取回后由前端渲染成轨道。三个环节分别说明。

- **B站官方 XML**：`x/v1/dm/list.so?oid=<cid>`，用正则解析 `<d p="...">` 属性段（time/mode/size/color...），XML 实体手动反转义。前端按 mode 映射到滚动、顶部、底部轨道。
- **第三方聚合**：provider 注册表包含 bilibili-video / bilibili-bangumi / 巴哈姆特 / 弹弹play。搜索时把关键词生成「原文 + 繁体 + 简体」三个变体并行请求，再去重排序。`/fetch` 的 `playbackParams` 必须原样回传，弹弹play 缺 episodeId 会报错。
- **渲染**（`danmakuEngine.ts`，基于 danmaku 库）：字号 = 用户基准 × B站 size 比例 × 屏幕比例（0.5~1.5 自适应）。屏蔽支持关键词、类型（滚动/固定/高级/彩色）两个维度，屏蔽或样式变更后清空重载。实时弹幕与屏蔽词经 Socket 跨端同步（`RoomDanmakuMeta` 实体）。
- **本地导入**（`localImport.ts`，纯前端解析）：弹幕轨道卡片支持导入本地文件，格式为 B站 XML / B站 JSON / dandanplay JSON，解析结果作为一条独立弹幕轨道挂载，不经过服务器。

## OBS 推流与 B站下载

投屏的推流入口和 B站下载都建立在 Node Media Server 与同一套推流校验之上。本节按推流服务、OBS 配置、B站下载三部分说明。

- **Node Media Server**：RTMP 监听 3334（`chunk_size: 60000, gop_cache: true, ping: 30`），HTTP-FLV 监听 3335，由主端口 `/live` 反代。环境变量 `STREAM_PUSH_ENABLED=0` 时完全不启动 NMS，3334/3335 不监听，不用推流模式的部署可借此减少端口暴露。推流校验在 `postPublish` 业务层完成，要求路径为 `/live/<streamKey>`，且房间 active、投屏模式、stream-push 子模式。推流和断流事件广播 `stream-status {live|offline}`；即使 DB 查询失败也不漏广播，靠活跃会话 Map 兜底。
- **OBS 配置一键下载**：`GET /api/stream-push/obs-config/:roomId` 生成 OBS 场景集合 JSON（rtmp_custom）。没有 streamKey 时会自动生成。
- **server-files B站下载**（仅 root）：走 `preferMp4 + skipCdnCheck`。DASH 分离流需要服务器 FFmpeg 合并，而服务器端 FFmpeg 已经移除；B站 MP4 接口本身又硬限 720P。因此 MP4 模式最高只有 720P，高画质下载要走 CLI 模式。进度以 NDJSON 输出（每 2% 或 512KB 回调一次），失败自动清理不完整文件，VIP 档位做服务端强校验以防绕过。

## 关键常量速查

下表汇总本页涉及的默认值与阈值。

| 常量 | 值 |
|---|---|
| MP4 直链清晰度上限 | 720P（qn=64，B站硬限制） |
| B站单请求超时 / 412 重试 | 10s / 3 次（1~2s 退避） |
| CDN 健康检查 | 3.5s 单条 / 4s 兜底 |
| 直链解析缓存 / https 探测 | 5min（LRU 500）/ 5s |
| 代理上游超时 | 30s（仅连接+响应头阶段） |
| direct 引擎 metadata 超时 / playsvideo 准备超时 | 30s / 60s |
| MKV 提取 | 头部 4MB / 全量 ≤512MB / 稀疏窗口 64KB / 并发 2 |
| AI 字幕 | 6 次尝试 / 容差 max(10s, 8%) / 成功缓存 10min |
| FLV 追帧 | max 1.5s / target 0.5s |
