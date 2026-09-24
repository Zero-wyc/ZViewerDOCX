# API 参考

> 本文档面向开发者。除特别标注外，接口均返回 JSON `{ success: true, ... }`，管理接口需 `admin`/`root` 角色。

---

## 调用约定

### 鉴权三通道

`extractAccessToken` 按 **query `token` → cookie `access_token` → `Authorization: Bearer`** 顺序取 token（详见[鉴权模型](/advanced/auth)）：

- 浏览器 REST：`credentials: 'include'`，HTTPS 走 httpOnly cookie，HTTP 走本地缓存的 Bearer（无需额外处理，前端 `apiFetch` 已封装）；
- 媒体地址（`<video>` / `<audio>` / MSE / hls.js）：无法带自定义头，前端对本域 `/api/` URL 自动附加 `?token=`；
- 脚本/第三方调用：建议 `Authorization: Bearer <access>`，过期后 `POST /api/auth/refresh`（cookie 或 body）换发 access。

### 响应与流式

- 成功 `{ "success": true, "data": { ... } }`；错误 `{ "success": false, "error": { "message": "...", "code": "ERROR_CODE" } }`。
- 流式接口（B站视频解析、B站下载、server-files 上传进度）返回 **NDJSON**（`application/x-ndjson`），逐行 JSON，需按行解析：

```
{"status":"parsing","step":"playurl","message":"获取播放地址..."}
{"success":true,"status":"done","videoUrl":"...","format":"dash","currentQn":80}
```

```
{"status":"downloading","phase":"video","received":123456,"total":987654,"percent":12}
{"status":"error","message":"解析失败","code":"NO_PERMISSION"}
```

### 限流

登录 15 分钟 20 次/IP；改密 1 分钟 3 次/用户；登录失败锁定（可选开启）5 次锁 15 分钟。代理类接口需登录，防带宽滥用。

---

## 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/register` | 注册新用户（approval 模式下为 pending） | 开放 |
| POST | `/login` | 登录，HTTPS 下写 httpOnly Cookie | 开放 |
| POST | `/refresh` | 刷新 Access Token（不轮换 refresh） | 登录 |
| POST | `/logout` | 登出 | 登录 |
| GET | `/registration-mode` | 当前注册模式 | 开放 |
| GET | `/public-settings` | 公开设置（注册模式、建房模式、功能开关、权限矩阵） | 开放 |
| GET | `/me` | 当前用户信息 | 登录 |
| PATCH | `/password` | 修改密码（触发 token 全局吊销） | 登录 |
| PATCH | `/username` | 修改用户名 | root |
| POST | `/avatar` | 上传头像 | 登录 |
| DELETE | `/avatar` | 删除头像 | 登录 |
| POST | `/guest` | 获取游客令牌（userId=0） | 开放 |

## 房间 `/api/rooms`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/` | 活跃房间列表 | 登录 |
| PUT | `/:roomId/name` | 修改房间名称 | 房主/root |
| GET | `/:roomId/movies` | 影片列表 | 房间成员 |
| POST | `/:roomId/movies` | 新增影片 | 房主 |
| POST | `/:roomId/movies/reorder` | 重排序 | 房主 |
| PUT | `/:roomId/movies/:movieId` | 更新影片 | 房主 |
| DELETE | `/:roomId/movies/:movieId` | 删除影片 | 房主 |

## 流媒体 `/api/stream`

### B站相关

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/proxy-image` | B站图片代理（免认证，1 小时缓存） | 开放 |
| GET | `/bilibili/qr` | 扫码登录二维码 | 登录 |
| GET | `/bilibili/qr/poll` | 轮询扫码状态 | 登录 |
| GET | `/bilibili/login-status` | 登录状态 | 登录 |
| POST | `/bilibili/logout` | 登出 | 登录 |
| GET | `/bilibili/user-info` | 用户信息（含会员状态） | 登录 |
| GET | `/bilibili/following-bangumi` | 关注的番剧 | 登录 |
| GET | `/bilibili/bangumi-episodes` | 番剧集数 | 登录 |
| GET | `/resolve-bilibili` | 视频解析（NDJSON 流式） | 登录 |
| GET | `/bilibili/danmaku` | B站弹幕（cid 或 bvid） | 登录 |
| GET | `/bilibili/ai-subtitle` | AI 字幕（须带 `duration` 做带内校验） | 登录 |
| GET | `/bilibili/related` | 相关推荐（自动连播使用） | 登录 |
| GET | `/proxy` | CDN 媒体代理（域名白名单 + 防盗链头） | 登录 |

### 弹幕 `/api/stream/danmaku`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/sources` | 弹幕源列表（B站 / 巴哈姆特 / 弹弹play） | 登录 |
| GET | `/search` | 搜索弹幕（繁简变体并行） | 登录 |
| GET | `/episodes` | 剧集列表 | 登录 |
| POST | `/fetch` | 拉取弹幕（`playbackParams` 须原样回传） | 登录 |

### 番剧源

`/anime`、`/anisubs`、`/kazumi` 三组结构一致：

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/proxy` | 媒体代理 | 登录 |
| GET | `/sources` | 数据源列表 | 登录 |
| GET | `/search` | 搜索番剧 | 登录 |
| GET | `/episodes` | 剧集列表 | 登录 |
| POST | `/resolve` | 解析播放地址 | 登录 |

## 挂载点 `/api/webdav`、`/api/ftp`、`/api/openlist`、`/api/emby`、`/api/jellyfin`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/mounts` | 挂载点列表 | 登录 |
| POST | `/mounts/test` | 测试连接（直链模式同步做 https 活性探测） | 登录 |
| POST | `/mounts` | 新增挂载点 | 登录 |
| PUT | `/mounts/:id` | 更新挂载点 | 登录 |
| DELETE | `/mounts/:id` | 删除挂载点 | 登录 |
| GET | `/mounts/:id/browse` | 浏览目录 | 登录 |
| GET | `/resolve` | 解析文件（直链或代理 URL） | 登录 |
| GET | `/proxy` | 代理播放 | 登录 |
| GET | `/embedded-tracks` | 内嵌字幕轨列表（emby/jellyfin） | 登录 |
| GET | `/embedded-extract` | 内嵌字幕提取（emby/jellyfin） | 登录 |

- ftp 无直链模式，`/resolve` 恒返回代理 URL。
- emby/jellyfin 音轨不兼容时自动切服务端转码 HLS（代理超时放宽到 90s）。

## 直链实时解析 `/api/direct-resolve`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/movie?movieId=` | 播放时取新鲜直链（5 分钟 TTL + 单飞去重 + https 活性自愈） | 登录 |

## 字幕 `/api/subtitles`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/search?movieId=` | 同目录同名前缀字幕（webdav/openlist/ftp/server-files） | 登录 |
| GET | `/browse` | 浏览字幕目录 | 登录 |
| GET | `/load?movieId=&path=` | 加载字幕内容（非 URL，上限 2MB） | 登录 |

## 一起听音乐 `/api/music`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET/POST | `/ncm/*` | 网易云接口通用转发（注入用户 Cookie） | 可选鉴权 |
| GET | `/stream?songId=&level=&roomId=&direct=` | 音频流（降级链 + 凭证回退 + SSRF 防护） | 可选鉴权 |
| GET | `/song-quality?songId=` | 音质元数据（15 分钟缓存） | 登录 |
| GET | `/login/status` | 网易云登录态（含会员判定） | 登录 |
| POST | `/logout` | 清除网易云凭证 | 登录 |
| POST | `/cloud/upload` | 云盘上传（流式转发） | 登录 |

## CLI 代理 `/api/cli`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/resolve` | 用请求头自带 Cookie 解析（供 CLI 高画质） | 登录 |

## 服务器文件 `/api/server-files`（仅 root）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/roots` | 根目录列表 |
| POST | `/roots` | 添加根目录 |
| DELETE | `/roots/:id` | 删除根目录 |
| GET | `/browse` | 浏览目录 |
| GET | `/browse-system` | 浏览全盘 |
| POST | `/upload` | 上传文件（上限 10GB） |
| POST | `/folder` | 新建文件夹 |
| POST | `/rename` | 重命名 |
| DELETE | `/file` | 删除文件/文件夹 |
| GET | `/resolve` | 解析播放 URL |
| GET | `/proxy` | 代理播放（1MB 读块） |
| POST | `/bilibili-download` | B站下载（仅 MP4 最高 720P，NDJSON 进度） |

## 管理后台 `/api/admin`

### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/users` | 用户列表 | admin/root |
| PATCH | `/users/:id/role` | 修改角色（仅 admin/user，root 不可改） | root |
| POST | `/users/:id/approve` | 审核注册 | root |
| DELETE | `/users/:id` | 删除用户（触发 token 吊销） | root |

### 房间管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/rooms` | 全量房间列表 | admin/root |
| DELETE | `/rooms/:roomId` | 强制关闭房间（先广播再断连） | admin/root |
| POST | `/rooms/batch-delete` | 批量删除 | root |
| POST | `/rooms/delete-all` | 清空所有房间 | root |
| POST | `/rooms/cleanup-unused` | 清理无人房间 | admin/root |

### 系统设置

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/settings` | 获取设置（注册模式、建房模式、权限矩阵、功能开关、自动清理） | admin/root |
| PUT | `/settings` | 更新设置 | root |

## 系统更新 `/api/system/update`（仅 root）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/check` | 检查更新（可关预发布接收） |
| POST | `/apply` | 下载并应用更新（进度流式） |
| POST | `/upload` | 上传压缩包更新 |

## 其他

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/stream-push/obs-config/:roomId` | 下载 OBS 场景配置 | 房主 |
| POST | `/api/client-logs` | 上报前端日志 | 开放 |
| GET | `/health` | 健康检查 | 开放 |

---

## 错误码汇总

| code | HTTP | 含义 |
|---|---|---|
| `NCM_UNAVAILABLE` | 503 | 内嵌网易云服务未启动 |
| `VIP_REQUIRED` | 403 | 音质/清晰度需 VIP（含 B站下载会员档强校验） |
| `NO_COPYRIGHT` | 404 | 无版权（`/check/music` 判定） |
| `RESOLVE_FAILED` | 502 | 地址解析全链失败 |
| `UPSTREAM_ERROR` | 502 | 上游返回非预期内容 |
| `NOT_FOUND` / `AUTH_FAILED` | 404 / 401 | 挂载点或文件缺失 / 凭证失效（直链解析） |
| `INTERNAL_NETWORK_FORBIDDEN` | 400 | 拒绝解析内网地址（SSRF 防护） |
| `ALREADY_IN_ROOM` | — | 重复加入房间（socket ack） |
| `RESOLVE_FAILED` / `NO_PERMISSION` / `CDN_UNREACHABLE` / `DASH_NOT_AVAILABLE` 等 | — | B站解析 NDJSON 错误行 |

## Socket.IO 事件

房间同步、音乐、投屏信令等实时能力不走 REST，事件清单见[房间同步逻辑](/advanced/sync)与[一起听音乐管线](/advanced/music-pipeline)。REST 与 WebSocket 共用同一套 JWT 身份。
