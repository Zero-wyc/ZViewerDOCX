# 管理后台

前端 `/admin` 页面（`AdminPage.tsx`）以 Tab 形式组织管理功能，后端全部接口挂载在 `/api/admin` 下（需管理员权限，部分仅 root）。

## 用户管理

- `GET /api/admin/users`：用户列表
- `PATCH /api/admin/users/:id/role`：修改角色（仅 root）
- `POST /api/admin/users/:id/approve`：审核注册（仅 root）
- `DELETE /api/admin/users/:id`：删除用户（仅 root）

## 房间管理

- `GET /api/admin/rooms`：全量房间列表（含观众数与房主）
- `DELETE /api/admin/rooms/:roomId`：强制关闭房间
- `POST /api/admin/rooms/batch-delete`：批量删除（仅 root）
- `POST /api/admin/rooms/delete-all`：清空所有房间（仅 root）
- `POST /api/admin/rooms/cleanup-unused`：清理无人在线的房间

## 基础设置

`GET / PUT /api/admin/settings` 管理全局 `SystemSettings`：

| 设置 | 说明 |
|---|---|
| 自动清理开关与时长 | `autoDeleteInactiveRooms` / `autoDeleteAfterHours`，自动清理无人房间 |
| 注册模式 | `open` / `approval` / `closed` |
| 房间创建权限 | `admin-only` / `all-users` |
| 数据源配置 | `dataSourceConfig`（Kazumi 规则源等，修改时清空动漫源缓存） |
| Beta 功能开关 | Kazumi / AniSubs 番剧源、Bilibili 下载 |

## 版本更新

- `GET /api/system/update/check`：检查 GitHub Releases 更新（可含预发布）
- `POST /api/system/update/apply`：一键下载并应用更新
- `POST /api/system/update/upload`：手动上传 zip / tar.gz 压缩包（≤500MB）并应用
- 控制是否接收预发布版（main 分支自动构建）更新

## 服务器文件管理

`/api/server-files`（仅 root）：

- `GET /roots`、`POST /roots`、`DELETE /roots/:id`：管理文件根目录（uploads + 自定义）
- `GET /browse`、`GET /browse-system`：浏览目录 / 全盘
- `POST /upload`、`POST /folder`、`POST /rename`、`DELETE /file`：文件操作
- `GET /resolve`、`GET /proxy`：解析并代理播放
- `GET /ffmpeg-status`、`POST /ffmpeg-install`：ffmpeg 状态 / 安装
- `POST /bilibili-download`：B站视频下载

## 其他管理相关接口

- `GET /api/stream-push/obs-config/:roomId`：下载 OBS 场景配置
- `POST /api/client-logs`：前端控制台日志上报（免鉴权，写入 `log/frontend-console.log`）
- `GET /health`：健康检查（含 `startedAt` / `restartCount`）
