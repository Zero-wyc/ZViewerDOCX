# 视频源

ZViewer 支持多种视频来源，涵盖在线视频平台与自建存储。

| 来源 | 说明 |
|---|---|
| **Bilibili** | 解析 BV 号或视频链接，支持 DASH 音视频合并、清晰度切换、大会员凭证 |
| **MP4 直链** | 直接播放可访问的 MP4 视频地址 |
| **WebDAV** | 挂载 WebDAV 服务器，浏览并播放其中的视频文件 |
| **FTP** | 挂载 FTP 服务器，浏览并播放其中的视频文件 |
| **OpenList** | 挂载 OpenList 服务，浏览并播放其中的视频文件 |
| **番剧源** | Kazumi / AniSubs 等第三方番剧数据源（可在管理后台启用，Beta 功能） |
| **服务器文件** | 由 root 配置的服务器本地目录，可上传、浏览并播放（仅 root 可用） |

## Bilibili

解析 BV 号或视频链接，支持 DASH 音视频合并播放、清晰度切换、大会员专享内容。可在管理后台配置 Bilibili 登录凭证（扫码登录）以获取大会员清晰度。

媒体代理机制：

- 封面与视频地址通过后端代理获取（`/api/stream/proxy-image`、`/api/stream/proxy`），避免 CORS 与防盗链问题。
- 代理支持 Range 断点续传。
- 弹幕通过 `/api/stream/bilibili/danmaku` 获取。

## 直链与挂载

- **MP4 直链**：直接输入可访问的 MP4 视频地址播放。
- **WebDAV / FTP / OpenList**：在挂载点管理中保存连接配置（服务器地址、端口、用户名、密码），浏览远端目录并播放视频文件。OpenList 复用 WebDAV 客户端实现。

## 服务器文件

仅 `root` 角色可用（`/api/server-files`）：

- 列出可用根目录（`uploads` + 自定义目录）
- 浏览服务器目录、新建文件夹、重命名、删除
- 上传文件（multipart，≤50 个）
- 解析文件为代理播放 URL，流式代理播放（支持 Range）
- ffmpeg 状态检查 / 安装
- Bilibili 视频下载

## ZViewerCLI 本地代理

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI) 是一个可选的本地代理客户端，用于解决浏览器端无法直接使用用户 Bilibili Cookie 与高画质地址的问题：

- 使用用户本地 Cookie 解析 Bilibili 视频，获取大会员等高画质地址。
- 在本地代理视频流请求，注入正确的 Referer/Origin/User-Agent，绕过 CDN 防盗链与 CORS 限制。
- 通过 WebSocket 向房间注册，前端自动检测并使用本地代理（后端模块 `cli`，校验 `roomId` 与 `proxyUrl`）。

## 数据源配置

管理后台「基础设置」中的 `dataSourceConfig` 用于配置番剧数据源（Kazumi 规则源等），修改时会清空动漫源缓存。Beta 功能开关（Kazumi / AniSubs 番剧源 / Bilibili 下载）也在管理后台控制。

## 相关 API

挂载点管理（WebDAV / FTP / OpenList 三组结构一致，`/api/webdav`、`/api/ftp`、`/api/openlist`）：

- `GET /mounts`：挂载点列表（剔除密码字段）
- `POST /mounts/test`：测试连接
- `POST /mounts`：新增挂载点
- `PUT /mounts/:id`：更新挂载点
- `DELETE /mounts/:id`：删除挂载点
- `GET /mounts/:id/browse`：浏览远端目录
- `GET /resolve`：解析文件路径
- `GET /proxy`：流式代理播放

Bilibili 相关（`/api/stream`）：

- `GET /bilibili/qr`、`GET /bilibili/qr/poll`：扫码登录
- `GET /bilibili/login-status`、`GET /bilibili/user-info`：登录状态与用户信息
- `GET /bilibili/following-bangumi`：关注的番剧
- `GET /bilibili/bangumi-episodes`：番剧集数列表
- `GET /resolve-bilibili`：视频解析（NDJSON 流式返回进度）
- `GET /proxy`：B站 CDN 媒体代理（支持 Range）
