# API 参考

> 本文档面向开发者。除特别标注外，接口均返回 JSON `{ success: true, ... }`，管理接口需 `admin`/`root` 角色。

---

## 认证 `/api/auth`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/register` | 注册新用户 | 开放 |
| POST | `/login` | 登录，写 httpOnly Cookie | 开放 |
| POST | `/refresh` | 刷新 Access Token | 登录 |
| POST | `/logout` | 登出 | 登录 |
| GET | `/registration-mode` | 当前注册模式 | 开放 |
| GET | `/public-settings` | 公开设置 | 开放 |
| GET | `/me` | 当前用户信息 | 登录 |
| PATCH | `/password` | 修改密码 | 登录 |
| PATCH | `/username` | 修改用户名 | root |
| POST | `/avatar` | 上传头像 | 登录 |
| DELETE | `/avatar` | 删除头像 | 登录 |
| POST | `/guest` | 获取游客令牌 | 开放 |

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
| GET | `/proxy-image` | B站图片代理（免认证） | 开放 |
| GET | `/bilibili/qr` | 扫码登录二维码 | 登录 |
| GET | `/bilibili/qr/poll` | 轮询扫码状态 | 登录 |
| GET | `/bilibili/login-status` | 登录状态 | 登录 |
| POST | `/bilibili/logout` | 登出 | 登录 |
| GET | `/bilibili/user-info` | 用户信息 | 登录 |
| GET | `/bilibili/following-bangumi` | 关注的番剧 | 登录 |
| GET | `/bilibili/bangumi-episodes` | 番剧集数 | 登录 |
| GET | `/resolve-bilibili` | 视频解析（NDJSON 流式） | 登录 |
| GET | `/bilibili/danmaku` | B站弹幕 | 登录 |
| GET | `/proxy` | CDN 媒体代理 | 登录 |

### 弹幕 `/api/stream/danmaku`

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/sources` | 弹幕源列表 | 登录 |
| GET | `/search` | 搜索弹幕 | 登录 |
| GET | `/episodes` | 剧集列表 | 登录 |
| POST | `/fetch` | 拉取弹幕 | 登录 |

### 番剧源

`/anime`、`/anisubs`、`/kazumi` 三组结构一致：

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/proxy` | 媒体代理 | 登录 |
| GET | `/sources` | 数据源列表 | 登录 |
| GET | `/search` | 搜索番剧 | 登录 |
| GET | `/episodes` | 剧集列表 | 登录 |
| POST | `/resolve` | 解析播放地址 | 登录 |

## 挂载点 `/api/webdav`、`/api/ftp`、`/api/openlist`

三组结构一致：

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/mounts` | 挂载点列表 | 登录 |
| POST | `/mounts/test` | 测试连接 | 登录 |
| POST | `/mounts` | 新增挂载点 | 登录 |
| PUT | `/mounts/:id` | 更新挂载点 | 登录 |
| DELETE | `/mounts/:id` | 删除挂载点 | 登录 |
| GET | `/mounts/:id/browse` | 浏览目录 | 登录 |
| GET | `/resolve` | 解析文件 | 登录 |
| GET | `/proxy` | 代理播放 | 登录 |

## 服务器文件 `/api/server-files`（仅 root）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/roots` | 根目录列表 |
| POST | `/roots` | 添加根目录 |
| DELETE | `/roots/:id` | 删除根目录 |
| GET | `/browse` | 浏览目录 |
| GET | `/browse-system` | 浏览全盘 |
| POST | `/upload` | 上传文件 |
| POST | `/folder` | 新建文件夹 |
| POST | `/rename` | 重命名 |
| DELETE | `/file` | 删除文件/文件夹 |
| GET | `/resolve` | 解析播放 URL |
| GET | `/proxy` | 代理播放 |
| POST | `/bilibili-download` | B站下载（仅 MP4，最高 720P） |

## 管理后台 `/api/admin`

### 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/users` | 用户列表 | admin/root |
| PATCH | `/users/:id/role` | 修改角色 | root |
| POST | `/users/:id/approve` | 审核注册 | root |
| DELETE | `/users/:id` | 删除用户 | root |

### 房间管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/rooms` | 全量房间列表 | admin/root |
| DELETE | `/rooms/:roomId` | 强制关闭房间 | admin/root |
| POST | `/rooms/batch-delete` | 批量删除 | root |
| POST | `/rooms/delete-all` | 清空所有房间 | root |
| POST | `/rooms/cleanup-unused` | 清理无人房间 | admin/root |

### 系统设置

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/settings` | 获取设置 | admin/root |
| PUT | `/settings` | 更新设置 | root |

## 系统更新 `/api/system/update`（仅 root）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/check` | 检查更新 |
| POST | `/apply` | 下载并应用更新 |
| POST | `/upload` | 上传压缩包更新 |

## 其他

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/stream-push/obs-config/:roomId` | 下载 OBS 配置 | 房主 |
| POST | `/api/client-logs` | 上报前端日志 | 开放 |
| GET | `/health` | 健康检查 | 开放 |

## 响应格式

### 成功
```json
{ "success": true, "data": { ... } }
```

### 错误
```json
{ "success": false, "error": { "message": "错误描述", "code": "ERROR_CODE" } }
```

### 流式响应（B站解析）
```
{"type":"progress","message":"正在解析..."}
{"type":"result","data":{...}}
{"type":"error","message":"解析失败"}
```