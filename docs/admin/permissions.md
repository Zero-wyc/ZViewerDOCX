# 权限模型

系统采用四层权限模型：

| 角色 | 说明 | 权限 |
|---|---|---|
| `root` | 超级管理员 | 创建/控制/删除任意房间，审核用户，修改角色，管理后台 |
| `admin` | 管理员 | 创建房间并完全控制自己的房间，不能删除他人房间 |
| `user` | 普通用户 | 加入房间观看、发送评论与弹幕，无法创建房间 |
| `guest` | 游客 | 加入房间观看、发送评论与弹幕，无法创建房间 |

## 注册与审核

新用户注册后角色为 `guest`，状态为 `pending`。仅 `root` 可在管理后台审核通过用户，通过后升级为 `user`。

注册模式由管理后台控制：

| 模式 | 行为 |
|---|---|
| `open` | 注册后直接激活 |
| `approval` | 注册后进入待审核，需 root 审核通过 |
| `closed` | 禁止注册 |

同时支持游客令牌：`POST /api/auth/guest` 获取匿名 guest 令牌，免注册加入房间。

## 房间创建权限

管理后台可设置房间创建权限：

- `admin-only`：仅管理员可创建房间
- `all-users`：所有用户可创建房间

## 鉴权实现

- 登录后通过 httpOnly cookie 保存令牌；access token 与 refresh token 双令牌机制（`JWT_ACCESS_EXPIRES_IN` 默认 15m、`JWT_REFRESH_EXPIRES_IN` 默认 7d）。
- 后端通过 `authenticateToken` 中间件校验身份，`adminOnly` 中间件限制管理接口。
- 相关 API：`/api/auth/register`、`/api/auth/login`、`/api/auth/refresh`、`/api/auth/logout`、`/api/auth/me` 等。

## 数据模型（entities）

| 实体 | 说明 |
|---|---|
| `User` | 用户：username（唯一）、passwordHash、role、status（active/pending）、avatar |
| `Room` | 房间：roomId、name、password、maxViewers、mode、shareMethod、streamKey、requireApproval、ownerUserId |
| `Session` | 房间会话：role（sharer/viewer）、joinedAt/endedAt |
| `Comment` | 评论批注 |
| `PlaybackState` | 播放记忆 |
| `SystemSettings` | 全局设置（注册模式、房间创建权限、Beta 开关等） |
| `UserMount` | 用户挂载点（webdav/ftp/openlist） |
| `BilibiliCredential` | B站登录凭据 |
