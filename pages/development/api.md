---
title: API 参考
description: 后端 REST API 端点一览
---

# API 参考

后端 REST API 基地址：HTTP 模式 `http://localhost:3333`（经前端 4173 反向代理 `/api`），HTTPS 模式 `https://localhost:3333`。

> 事件型接口（房间同步、弹幕、语音等）走 Socket.IO，见 [后端文档](/development/backend) 的事件表。

## 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 注册（模式由系统设置决定） | 公开 |
| POST | `/api/auth/login` | 登录 | 公开 |
| POST | `/api/auth/refresh` | 刷新 Token | 公开 |
| POST | `/api/auth/logout` | 登出 | 登录 |
| POST | `/api/auth/guest` | 游客登录 | 公开 |
| GET | `/api/auth/registration-mode` | 查询注册模式 | 公开 |
| GET | `/api/auth/public-settings` | 公开设置 | 公开 |
| GET | `/api/auth/me` | 当前用户信息 | 登录 |
| PATCH | `/api/auth/password` | 修改密码 | 登录 |
| PATCH | `/api/auth/username` | 修改用户名（root） | root |
| POST | `/api/auth/avatar` | 上传头像 | 登录 |
| DELETE | `/api/auth/avatar` | 删除头像 | 登录 |

## 管理 `/api/admin`

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/admin/users` | 用户列表 | admin+ |
| PATCH | `/api/admin/users/:id/role` | 修改角色 | **root** |
| POST | `/api/admin/users/:id/approve` | 审核通过 | **root** |
| PATCH / DELETE | `/api/admin/users/:id` | 更新 / 删除用户 | admin+ |
| GET | `/api/admin/rooms` | 房间列表 | admin+ |
| DELETE | `/api/admin/rooms/:roomId` | 强制关闭房间 | admin+ |
| POST | `/api/admin/rooms/batch-delete` | 批量删除房间 | admin+ |
| POST | `/api/admin/rooms/delete-all` | 删除全部房间 | admin+ |
| POST | `/api/admin/rooms/cleanup-unused` | 清理无用房间 | admin+ |
| GET / PUT | `/api/admin/settings` | 系统设置 | **root** |

## 流媒体 `/api/stream`

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/api/stream/proxy-image` | 图片代理（封面等） | 公开 |
| GET | `/api/stream/proxy` | B站 CDN 媒体代理 | 公开 |
| GET | `/api/stream/resolve-bilibili` | 解析 B站视频（NDJSON 流式进度） | 登录 |
| GET | `/api/stream/bilibili/danmaku` | 获取 B站弹幕 | 登录 |
| POST/GET | `/api/stream/bilibili/qr` 等 | B站扫码登录（qr / qr/poll / login-status / logout / user-info / following-bangumi / bangumi-episodes） | 登录 |
| GET | `/api/stream/resolve-ftp` | FTP 解析 | 登录 |
| GET | `/api/stream/proxy-ftp` | FTP 代理 | 登录 |

### 弹幕 `/api/stream/danmaku`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stream/danmaku/sources` | 弹幕源列表 |
| GET | `/api/stream/danmaku/search` | 搜索弹幕 |
| GET | `/api/stream/danmaku/episodes` | 剧集列表 |
| GET | `/api/stream/danmaku/fetch` | 拉取弹幕 |

### 番剧聚合源

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stream/anime/proxy` | Anime 源代理 |
| GET | `/api/stream/anime/sources` / `search` / `episodes` / `resolve` | Anime 源搜索与解析 |
| GET | `/api/stream/anisubs/*` | anisubs 订阅源（同结构） |
| GET | `/api/stream/kazumi/*` | Kazumi 规则源（同结构） |

## 服务器文件 `/api/server-files`（仅 root）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| CRUD | `/api/server-files/roots` | 根目录管理 |
| GET | `/api/server-files/browse` | 浏览目录 |
| GET | `/api/server-files/browse-system` | 浏览系统目录 |
| POST | `/api/server-files/upload` | 上传（上限 10GB） |
| POST | `/api/server-files/folder` / `rename` | 新建文件夹 / 重命名 |
| DELETE | `/api/server-files/file` | 删除文件 |
| GET | `/api/server-files/resolve` | 解析视频 |
| GET | `/api/server-files/proxy` | 代理播放（Range 支持） |
| GET | `/api/server-files/ffmpeg-status` / `ffmpeg-install` | ffmpeg 状态 / 安装 |
| GET | `/api/server-files/bilibili-download` | 下载 B站视频（需 ffmpeg 合并） |

## 挂载源

| 方法 | 路径（webdav / ftp / openlist 三组同构） | 说明 |
| --- | --- | --- |
| GET | `/api/{webdav\|ftp\|openlist}/mounts` | 挂载点列表 |
| POST | `/api/{webdav\|ftp\|openlist}/mounts` | 新建挂载点 |
| POST | `/api/{webdav\|ftp\|openlist}/mounts/test` | 测试连接 |
| GET | `/api/{webdav\|ftp\|openlist}/mounts/:id/browse` | 浏览目录 |
| PUT / DELETE | `/api/{webdav\|ftp\|openlist}/mounts/:id` | 更新 / 删除 |
| POST | `/api/{webdav\|ftp\|openlist}/resolve` | 解析视频 |
| GET | `/api/{webdav\|ftp\|openlist}/proxy` | 代理播放 |

## 房间 `/api/rooms`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/rooms` | 房间列表 |
| PUT | `/api/rooms/:roomId/name` | 修改房间名 |
| CRUD | `/api/rooms/:roomId/movies` | 影片列表管理（增删改排序） |
| 其余 | `/api/rooms/...` | 房间实时操作主要走 Socket.IO |

## 系统更新 `/api/system/update`（仅 root）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/system/update/check` | 检查更新 |
| POST | `/api/system/update/apply` | 应用更新 |
| POST | `/api/system/update/upload` | 手动上传更新包 |

## 推流 `/api/stream-push`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/stream-push/obs-config/:roomId` | 下载 OBS 场景配置 JSON |

## CLI 代理 `/api/cli`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/cli/resolve` | 用用户 Cookie 解析高画质（ZViewerCLI 使用） |

## 其他

| 方法 | 路径 | 说明 | 权限 |
| --- | --- | --- | --- |
| GET | `/health` | 健康检查 | 公开 |
| POST | `/api/client-logs` | 浏览器日志上报 | 公开 |

## 认证方式

- 登录后 JWT 存放于 **httpOnly cookie**。
- 受保护接口由后端中间件校验（`authenticateToken` / `requireRoot` / `adminOnly`）。
- 开发调试可通过 `Authorization: Bearer <token>` 携带 Access Token（见 `middleware/auth.ts`）。

## 约定

- 媒体代理端点支持 HTTP `Range` 头（拖动进度条、断点续传）。
- B站解析接口返回 **NDJSON 流式**进度（`resolve-bilibili`）。
- 旧版挂载解析端点（如 `/resolve-webdav`）已 301 重定向到新版路径。
