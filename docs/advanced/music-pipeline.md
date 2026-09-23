# 一起听音乐管线

## 服务拓扑

```
前端 <audio>
   │  /api/music/stream?songId=&level=&roomId=
   ▼
主后端 /api/music/*
   │  callNcmApi()（附加 timestamp 绕内部服务 apicache）
   ▼
内部 NCM 服务 127.0.0.1:36530
   │  @neteasecloudmusicapienhanced/api（serveNcmApi）
   ▼
网易云上游
```

内部 NCM 服务由主后端进程内嵌启动（端口占用时 +1 重试，最多 5 次）。主后端经 `callNcmApi()` 转发，每次请求附加 `timestamp` 参数绕过内部服务的 2 分钟 apicache——缓存 key 不含 Cookie，不同登录态的相同请求会互相串味。

## 路由与登录态

- **`/api/music/ncm/*`**：通用转发，自动注入当前用户持久化的网易云 Cookie；剥离 query / body 中的 `cookie` / `noCookie` 参数，防止客户端伪造登录态。
- **扫码登录**：`/login/qr/*` 路径不注入旧凭据——带过期 MUSIC_U 的请求会让二维码轮询异常（800 循环）导致扫码无效；check 成功（803）响应的 Set-Cookie 正常持久化。
- 登录态按用户隔离存库，房间内共享的是"解析直链时使用的凭证"，不是登录态本身。

## 音频流代理 `/api/music/stream`

1. **音质降级链** `lossless → exhigh → higher → standard`：从请求档位开始依次尝试 `/song/url/v1`，`freeTrialInfo` 非空（试听片段）视为不可用。
2. **v1 失败回退**：`/song/url/v1` 路由 404 或网络抛错时，回退老接口 `/song/url`（level → br 映射：lossless 999000 / exhigh 320000 / higher 192000 / standard 128000）。老接口模块依赖更少，在线上依赖残缺时仍可用。`/song-quality` 端点同构处理。
3. **凭证回退链**：当前用户 Cookie → 房主 Cookie（请求带 `roomId` 时反查房间归属），实现"房主登录 VIP，全房间可听"。
4. **SSRF 防护**：解析出的直链域名必须匹配 `*.music.126.net`，否则拒绝转发。
5. **direct=1 模式**：302 重定向 CDN 直链给 `<audio>` 直连（省服务器带宽），直链缓存 15 分钟；`http:` 直链统一改写 `https:` 避免 mixed content。

## 错误分类

| 状态码 | code | 含义 |
|---|---|---|
| 403 | `VIP_REQUIRED` | 各档位均只返回试听片段，需要 VIP |
| 404 | `NO_COPYRIGHT` | `/check/music` 判定无版权 |
| 502 | `RESOLVE_FAILED` | 降级链全失败且非上述原因 |
| 503 | `NCM_UNAVAILABLE` | 内部 NCM 服务未启动 |

## 房间内同步

歌单、当前歌曲、播放进度经 Socket.IO 在房间内同步；清空列表立即停声。观众申请切歌 / 调进度 / 添加歌曲走与影片相同的申请控制通道（可开自动通过）。
