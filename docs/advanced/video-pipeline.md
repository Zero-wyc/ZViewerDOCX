# 视频源与 API 获取逻辑

## Bilibili

1. 前端提交 BV / AV 号、视频链接或 b23.tv 短链（后端自动展开并解析分 P 参数）。
2. 后端向 B站 API 发起请求，注入后台配置的登录凭证（大会员可拿高清晰度）。
3. 视频流与封面经后端代理转发（`/api/stream/proxy*`），注入 Referer / Origin / User-Agent 绕过 CDN 防盗链；封面代理做域名白名单校验。
4. 解析接口为 **NDJSON 流式响应**，前端逐行读取进度并渲染：

```
{"type":"progress","message":"正在解析..."}
{"type":"result","data":{...}}
{"type":"error","message":"解析失败"}
```

5. AI 字幕走 `x/player/v2`。该接口不稳定：同一视频可能随机返回其他视频的字幕文件。后端以视频时长做带内校验（正确字幕的 `max(to)` ≈ 视频时长，容差 max(10s, 8%)），不匹配则重试，最多 4 次。仍失败属上游问题。
6. 弹幕：Bilibili 官方 XML，前端解析渲染；跨房间同步屏蔽与删除状态。

## 挂载源（WebDAV / FTP / OpenList / Emby / Jellyfin）

- 挂载配置保存在后端，目录浏览由后端代发，前端只拿文件列表。
- **直链实时解析**：AList 等源的签名直链会过期。播放时前端调 `/api/direct-resolve/movie`，后端按影片记录反查挂载源取新鲜直链（5 分钟 TTL 缓存 + 单飞去重防并发重复解析），失败回退固化 URL 保持旧行为。
- **HTTPS 直链活性校验**：源站事后撤掉 TLS 时，缓存的 https 直链永久不可达。下发前对 https 端点现场活性校验，失败即把缓存自愈为 false 返回 http 直链（openlist / webdav / emby / jellyfin 四路由统一）。
- **混合内容处理**：HTTPS 页面 + HTTP 直链受浏览器混合内容硬限制，前端加载失败自动降级走服务器代理；`127.0.0.1` / `localhost` 信任源保持直连。

## 播放引擎

| 场景 | 引擎 | 行为 |
|---|---|---|
| MP4 / WebM 等原生格式 | direct 引擎 | 直接 `video.src`，30s 超时 |
| MKV / AVI / TS / WMV | playsvideo 引擎 | 浏览器端解析容器重封装为 fMP4 喂 MSE |
| DTS / AC3 / EAC3 音轨 | playsvideo 引擎 | 浏览器端实时转码 AAC |

- 转码核心随前端资源分发，**服务器零依赖**（不需要 FFmpeg）。
- 跨域源统一包装为 `/api/stream/proxy?url=` 走后端中转；同源相对路径直接附带鉴权 token。
- 引擎会话按 video 元素登记互斥；attach 被新加载取代时静默退出，消除跨实例并发导致的偶发双声与假超时。
- 直链模式下若源站协议变化（反代拆除、DDNS 重指向），播放时实时重新解析替代固化的历史地址。
