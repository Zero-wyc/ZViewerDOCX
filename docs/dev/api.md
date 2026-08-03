# API 参考

> 除特别标注外，接口均返回 `{ success, ... }` JSON；管理接口需要 `admin`/`root` 角色。

## 认证 `/api/auth`

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/register` | 注册（按 registrationMode：open 直接激活 / approval 待审核 / closed 拒绝） |
| POST | `/login` | 登录，写 httpOnly cookie |
| POST | `/refresh` | 刷新 access token |
| POST | `/logout` | 登出并清空 cookie |
| GET | `/registration-mode` | 公开：当前注册模式 |
| GET | `/public-settings` | 公开：注册模式 / 房间创建模式 / Beta 开关 |
| GET | `/me` | 当前用户信息（需登录） |
| PATCH | `/password` | 修改密码 |
| PATCH | `/username` | 修改用户名（仅 root） |
| POST | `/avatar` | 上传头像（multipart，≤5MB，jpg/png/gif/webp） |
| DELETE | `/avatar` | 删除头像 |
| POST | `/guest` | 获取匿名 guest 令牌 |

## 房间 `/api/rooms`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/` | 活跃房间列表（含观众数、分享端在线状态） |
| PUT | `/:roomId/name` | 修改房间名称（root 或房间创建者） |
| GET | `/:roomId/movies` | 影片列表 |
| POST | `/:roomId/movies` | 新增影片（url/title 必填） |
| POST | `/:roomId/movies/reorder` | 批量重排序 |
| PUT | `/:roomId/movies/:movieId` | 更新影片 |
| DELETE | `/:roomId/movies/:movieId` | 删除影片 |

## 流媒体 `/api/stream`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/proxy-image` | 免认证 B站图片代理（限 bilibili/hdslb/bilivideo/biliimg 域名） |
| GET | `/bilibili/qr`、`/bilibili/qr/poll` | B站扫码登录二维码 / 轮询状态 |
| GET | `/bilibili/login-status` | B站登录状态 |
| POST | `/bilibili/logout` | B站登出 |
| GET | `/bilibili/user-info` | B站用户信息 |
| GET | `/bilibili/following-bangumi` | 关注的番剧 |
| GET | `/bilibili/bangumi-episodes` | 番剧集数列表 |
| GET | `/resolve-bilibili` | B站视频解析（NDJSON 流式返回进度） |
| GET | `/bilibili/danmaku` | B站弹幕 |
| GET | `/proxy` | B站 CDN 媒体代理（支持 Range 断点续传） |
| GET | `/resolve-ftp`、`/proxy-ftp` | FTP 直连参数解析 / 代理 |
| GET | `/resolve-webdav`、`/proxy-webdav`、`/resolve-openlist`、`/proxy-openlist` | 旧路径 301 兼容重定向 |

### 弹幕 `/api/stream/danmaku`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/sources` | 可用弹幕源列表 |
| GET | `/search` | 搜索（含 B站 WBI 登录态支持） |
| GET | `/episodes` | 集数列表 |
| POST | `/fetch` | 拉取弹幕（XML → 前端格式） |

### 番剧源 `/api/stream/anime`、`/api/stream/anisubs`、`/api/stream/kazumi`

三组结构一致：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/proxy` | 通用媒体代理（可自定义 referer/UA/origin/cookie） |
| GET | `/sources` | 数据源列表 |
| GET | `/search` | 搜索番剧 |
| GET | `/episodes` | 集数列表 |
| POST | `/resolve` | 解析播放地址 |

## 挂载点 `/api/webdav`、`/api/ftp`、`/api/openlist`

三组结构一致（`openlist` 复用 WebDAV 客户端）：

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/mounts` | 挂载点列表（剔除密码字段） |
| POST | `/mounts/test` | 测试连接 |
| POST | `/mounts` | 新增挂载点 |
| PUT | `/mounts/:id` | 更新挂载点 |
| DELETE | `/mounts/:id` | 删除挂载点 |
| GET | `/mounts/:id/browse` | 浏览远端目录 |
| GET | `/resolve` | 解析文件路径 |
| GET | `/proxy` | 流式代理播放 |

## 服务器文件 `/api/server-files`（仅 root）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/roots` | 列出可用根目录（uploads + 自定义） |
| POST | `/roots` | 添加自定义根目录 |
| DELETE | `/roots/:id` | 删除自定义根 |
| GET | `/browse` | 浏览目录 |
| GET | `/browse-system` | 浏览服务器全盘（仅目录） |
| POST | `/upload` | 上传文件（multipart，≤50 个） |
| POST | `/folder` | 新建文件夹 |
| POST | `/rename` | 重命名文件/文件夹 |
| DELETE | `/file` | 删除文件/文件夹 |
| GET | `/resolve` | 解析文件 → 代理播放 URL + 格式 |
| GET | `/proxy` | 流式代理播放（支持 Range） |
| GET | `/ffmpeg-status`、POST `/ffmpeg-install` | ffmpeg 状态检查 / 安装 |
| POST | `/bilibili-download` | B站视频下载 |

## CLI 代理 `/api/cli`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/resolve` | 用用户自己的 B站 Cookie 解析高画质视频流 |

## 管理 `/api/admin`

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/users` | 用户列表 |
| PATCH | `/users/:id/role` | 修改角色（仅 root） |
| POST | `/users/:id/approve` | 审核注册（仅 root） |
| DELETE | `/users/:id` | 删除用户（仅 root） |
| GET | `/rooms` | 全量房间列表 |
| DELETE | `/rooms/:roomId` | 强制关闭房间 |
| POST | `/rooms/batch-delete` | 批量删除（仅 root） |
| POST | `/rooms/delete-all` | 清空所有房间（仅 root） |
| POST | `/rooms/cleanup-unused` | 清理无人在线的房间 |
| GET / PUT | `/settings` | 系统设置 |

## 系统更新 `/api/system/update`（仅 root）

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/check` | 检查 GitHub Releases 更新（可含预发布） |
| POST | `/apply` | 下载并应用更新 |
| POST | `/upload` | 上传 zip/gzip 压缩包并应用（raw body，≤500MB） |

## 其他

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/stream-push/obs-config/:roomId` | 下载 OBS 场景集合配置文件 |
| POST | `/api/client-logs` | 浏览器控制台日志批量上报（免鉴权） |
| GET | `/health` | 健康检查（含 startedAt / restartCount） |
