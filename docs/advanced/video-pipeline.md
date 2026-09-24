# 视频源与 API 获取逻辑

## Bilibili 解析

### 请求链路

1. 前端提交 BV / AV 号、视频链接或 b23.tv 短链。短链展开仅信任 `b23.tv` / `bili2233.cn` 两个域名（精确匹配），GET 跟随重定向、8s 超时，成功后立即取消响应体释放连接。
2. 正则 `/BV[0-9A-Za-z]{10}/` 提取 BV 号（失败再试 av 号）；URL `?p=N` 与 `page` 参数解析分 P，`cid` 从视频信息 `pages` 反查。
3. **匿名会话预热**：无 Cookie 时先调 `x/frontend/finger/spi` 取 buvid3/buvid4（30 分钟 TTL）——B站匿名接口需要设备指纹，否则部分请求被风控。
4. **VIP 状态与视频信息并行请求**（省 1 个 RTT），VIP 判定缓存 5 分钟、视频信息缓存 2 分钟。
5. playurl 请求优先 WBI 签名端点（key 缓存 30 分钟），失败且非权限错误时降级未签名端点。
6. 结果以 **NDJSON 流式响应**逐行输出，前端逐行读取渲染进度。

### NDJSON 流式协议

响应头 `Content-Type: application/x-ndjson`、`X-Accel-Buffering: no`（不设 `Connection`/`Transfer-Encoding`——hop-by-hop 头经反代会冲突），每行写后立即 `flush()`：

```
{"status":"parsing","step":"info","message":"正在解析视频信息..."}
{"status":"parsing","step":"playurl","message":"获取播放地址..."}
{"success":true,"status":"done","videoUrl":"...","audioUrl":"...","format":"dash","currentQn":80,...}
{"success":false,"status":"error","message":"...","code":"NO_PERMISSION"}
```

- 进度 step：`vip` → `info` → `playurl` → `quality` → `cdn` → `fallback` → `finish`。
- 错误码集合：`RESOLVE_FAILED / VIDEO_NOT_FOUND / NOT_LOGGED_IN / NO_PERMISSION / INFO_FAILED / INVALID_INPUT / MP4_NOT_AVAILABLE / CDN_UNREACHABLE / DASH_NOT_AVAILABLE / NO_PLAYURL`。
- 前端整体 30s 超时（AbortController）；先全量 `res.text()` 再逐行 JSON.parse，规避部分浏览器对流式响应的 `net::ERR_ABORTED`；兼容旧版纯 JSON 响应。

### 清晰度与大会员

| 身份 | 默认清晰度 | 上限 |
|---|---|---|
| 未登录 | 480P（qn=32） | 480P |
| 登录非会员 | 1080P（qn=80） | 1080P（VIP 专属档被过滤） |
| 大会员 | 4K（qn=120） | 8K（qn=127，fnval 追加 2048） |

- `VIP_ONLY_QNS = [112, 116, 120, 125, 126, 127]`（1080P+ / 1080P60 / 4K / HDR / 杜比 / 8K）。
- 权限不足时自动降级重试：qn 降到 32/16；请求 qn 不在 acceptQuality 时回退最高可用档重新请求。
- **MP4 模式（fnval=1 + platform=html5）最高仅 720P 是 B站服务端硬限制**，与是否会员无关；1080P+ 以上全部依赖 DASH 分离流。MP4 降级参数带 `try_look=1`（参考 synctv），返回无防盗链直链。

### CDN 健康检查

对 baseUrl + backupUrl 并行发起 HEAD + `Range: bytes=0-0` 竞速，接受 `ok || 405`，单条超时 3.5s，整体兜底 4s 强制返回。部分 CDN 对 HEAD 返回 403 但 GET 正常，此时回退原始 URL。`.mcdn.bilivideo.cn:8082` 的 P2P CDN 地址会被移除端口改走 443，提升连通率。

B站 API 公共请求封装：Chrome 120 UA + `Referer/Origin: https://www.bilibili.com`、单请求 10s 超时、**412 风控自动重试 3 次（1~2s 随机退避）**。

## 代理层 `/api/stream/proxy*`

统一实现 `proxyHttpUpstream`（`services/proxy/http-proxy.ts`）：

- **域名白名单**：媒体代理仅放行 `bilibili.com / bilivideo.com / hdslb.com / biliimg.com / bstatic.com` 等后缀匹配 + akamaized 精确项（共享 CDN 不能按后缀放行，否则会给第三方域名错误注入 B站 Referer）；图片代理仅放行 4 个 B站图床域名。
- **防盗链头**：B站 URL 注入 `Referer/Origin: https://www.bilibili.com` + Chrome UA；非 B站 URL 不注入（错误的 Referer 反被源站拒绝）。
- **Range 有界分片**：开放式 `bytes=0-` / 超长区间被截断为有界分片，suffix（`bytes=-N`）与多段原样透传；上游 206 必须转发；透传 `content-length/content-range/accept-ranges/etag/last-modified`，无条件补 `Accept-Ranges: bytes`；支持 `If-None-Match`/`If-Range` 走 304。
- **断连销毁**：客户端 `res.on('close')` 时 abort 上游 fetch 并**显式 destroy 流**——Node 的 pipe 不会自动销毁源流，这是「用户下线后服务器流量仍在跑」的经典根因。
- 上游 30s 超时只覆盖「连接+等响应头」，body 传输不中断；响应补 `X-Accel-Buffering: no` 禁用反代缓冲。
- **前端路由决策中心**（`url-proxy.ts` `resolveMediaRoute`）：本站/blob/相对路径直连；B站 DASH（`.m4s`）强制走服务器代理（防盗链 + 无 CORS）；B站 MP4 直链先直连、失败回退代理一次；HTTPS 页面下的 http 跨域源走代理（混合内容防护，挂载直链模式跳过）；CLI 代理（127.0.0.1）属浏览器信任源，https 页面直连不受限。

## 直链实时解析 `/api/direct-resolve/*`

影片记录的 url 是**添加时刻的快照**（AList 签名会过期、源站协议可能变化），播放时实时取新鲜直链，固化 URL 仅作兜底：

- **5 分钟 TTL 缓存**（LRU，上限 500），缓存键 `type|serverUrl|path` 跨影片/跨房间共享。
- **单飞去重**：并发同 key 共享同一个 Promise，完成才写缓存，避免冷启动时重复解析打挂源站。
- 解析优先走 AList API（很多用户把 AList 以 WebDAV 类型挂载，API 签名直链更可靠）；webdav 失败回退直链拼接（Basic Auth 内嵌），openlist 失败直接报错不回退。ftp 无直链模式，固定走服务器代理。
- **HTTPS 活性校验与自愈**（`mount-utils.ts`）：缓存记录「该源支持 https 直链」是一次性探测结果，源站事后撤掉 TLS 时缓存直链永久不可达。下发前对 https 端点现场再探测（HEAD，5s 超时，2xx~5xx 均算成功），失败即把 `httpsDirect` 改写为 false 并**持久化回写数据库**（自愈），本次返回 http 直链。前端另有兜底：http 页面加载 https 直链失败时降级 http 重试一次。
- Emby / Jellyfin：`/resolve` 实时取 MediaSources，音轨不在浏览器支持白名单（aac/mp3/flac/opus/vorbis）时自动切服务端转码 HLS（`main.m3u8?AudioCodec=aac...`，转码代理超时放宽到 90s——转码冷启动 30s 默认超时会误杀）。

## 播放引擎

### 引擎选择（`engine-selector.ts`）

优先级：`format==='dash' || audioUrl` → **dash 引擎**（dash.js 动态生成 MPD 包装 m4s）→ `hls` → `flv` → `shouldUsePlaysVideo` → **direct**。

| 场景 | 引擎 | 判定 |
|---|---|---|
| MP4 / WebM / MOV | direct | 原生可播，30s metadata 超时 |
| AVI / TS / WMV | playsvideo | 浏览器完全无法原生打开，必须重封装 |
| MKV | 视 `mkvFastPath` | 编解码原生友好时先直连，失败回退管线 |
| DTS / AC3 / EAC3 / TrueHD 音轨 | playsvideo | `needsBrowserTranscode` 判定，浏览器端转 AAC |

- **playsvideo 管线**：mediabunny 流式 demux（Range 随机读取）→ 关键帧对齐分段计划 → 视频直通重封装 / 音频按需转码（AC3/EAC3/DTS/FLAC/MP3/Opus → AAC）→ fMP4 分段 + m3u8 → hls.js 按取段。取流 URL **必须同源**（跨域一律包装 `/api/stream/proxy?url=`，否则带不了防盗链头也过不了 CORS）；准备超时 60s。
- **服务器零依赖**：转码核心随前端资源分发（专用 ffmpeg 构建 ~1.9MB），服务器不需要 FFmpeg。
- **attach 互斥与世代模型**（`usePlayerSource.ts`）：attach 串行队列 + `attachEpochRef` 世代计数——attach 在 await 期间被新加载取代时静默退出，不报错不走回退链（消除前序会话被打断后的假超时）；另有 video 级会话登记表（WeakMap，后发起者赢），终结跨实例并发 attach 到同一 video 导致的双声。鉴权失效（401/403）自动 `refreshAccessToken()` 后重试一次。

## 字幕

### 内嵌字幕提取（MKV）

前端自研 `MatroskaDemuxer` 流式解复用（`lib/mkv/`），不用 ffmpeg.wasm（须整文件载入、上限 ~2GB）：

- 头部 4MB Range 预取收齐 Tracks 元素；≤512MB 全量顺序扫描，更大文件走**稀疏提取**——Cues 锚点分段 + 元素 size 链前进 + 音视频负载字节算术跳过，5GB 级片源仅传输约 10% 字节；稀疏窗口 64KB（12 并发实测会打挂代理，限制 2 并发）、worker 按「距当前播放位置最近」优先级选锚点（seek 感知）。
- 支持文本轨 SRT/ASS/SSA/WEBVTT；PGS/VOBSUB 位图轨标记不支持。
- Emby/Jellyfin 的内嵌字幕走后端 `/embedded-tracks` + `/embedded-extract`（按扩展名路由转封装）；外挂字幕搜索覆盖 webdav/openlist/ftp/server-files 四源（文件上限 2MB）。

### B站 AI 字幕

`x/player/v2` 服务端不稳定：同一 (bvid, cid) 会**随机返回其他视频的字幕文件**，且字幕 JSON 内无任何视频标识可校验。后端 `/api/stream/bilibili/ai-subtitle` 做三重防线：

1. **带外校验**：subtitle_url 的 `oid` 参数必须等于 aid。
2. **带内校验**：字幕时间轴终点须 ≈ 视频时长，容差 `max(10s, 时长 × 8%)`；前端须传 `&duration=`（秒），非法时服务端用官方时长兜底。
3. **一致性投票**：最多 6 次尝试（间隔 180ms），按内容指纹（`len:首行:末行to`）投票，两次一致即确认；全部不达标**返回空而不是可疑字幕**。成功缓存 10 分钟、失败负缓存 60s。

## 弹幕

- **B站官方 XML**：`x/v1/dm/list.so?oid=<cid>`，正则解析 `<d p="...">` 属性段（time/mode/size/color...），XML 实体手动反转义；前端按 mode 映射滚动/顶部/底部轨道。
- **第三方聚合**：provider 注册表（bilibili-video / bilibili-bangumi / 巴哈姆特 / 弹弹play），搜索时关键词生成「原文+繁体+简体」三变体并行请求、去重排序；`/fetch` 的 `playbackParams` 必须原样回传（弹弹play 缺 episodeId 会报错）。
- **渲染**（`danmakuEngine.ts`，基于 danmaku 库）：字号 = 用户基准 × B站 size 比例 × 屏幕比例（0.5~1.5 自适应）；屏蔽含关键词、类型（滚动/固定/高级/彩色）双维度，屏蔽/样式变更后清空重载；实时弹幕与屏蔽词经 Socket 跨端同步（`RoomDanmakuMeta` 实体）。

## OBS 推流与 B站下载

- **Node Media Server**：RTMP 3334（`chunk_size: 60000, gop_cache: true, ping: 30`）、HTTP-FLV 3335（由主端口 `/live` 反代）。推流校验在 `postPublish` 业务层：`/live/<streamKey>` 且房间 active + 投屏模式 + stream-push 子模式。推流/断流事件广播 `stream-status {live|offline}`（活跃会话 Map 兜底，DB 查询失败也不漏广播）。
- **OBS 配置一键下载**：`GET /api/stream-push/obs-config/:roomId` 生成 OBS 场景集合 JSON（rtmp_custom），无 streamKey 时自动生成。
- **server-files B站下载**（仅 root）：`preferMp4 + skipCdnCheck`——DASH 分离流需服务器 FFmpeg 合并（已随服务器端 FFmpeg 移除），而 B站 MP4 接口本身硬限 720P，故「仅 MP4 最高 720P」；高画质下载走 CLI 模式。NDJSON 进度（每 2% 或 512KB 回调），失败自动清理不完整文件，VIP 档位做服务端强校验防绕过。

## 关键常量速查

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
