# 鉴权与权限模型

## Token 体系

JWT 双 token：

| Token | 有效期 | 通道 |
|---|---|---|
| Access | 15 分钟（`JWT_ACCESS_EXPIRES_IN`） | httpOnly Cookie + Authorization Bearer 双通道 |
| Refresh | 7 天（`JWT_REFRESH_EXPIRES_IN`） | httpOnly Cookie |

- 双通道的原因：REST 请求可用 Bearer 头，`<video>` / `<audio>` 等媒体标签与 Socket.IO 无法带自定义头，走 Cookie（媒体 URL 附加 token 参数兜底）。
- 鉴权 Cookie 判定含 Origin scheme 兜底，兼容内网穿透（HTTP 反代 HTTPS 等）场景下无法登录的问题。
- 游客（guest）通过 `/api/auth/guest` 获取临时令牌，无需注册即可加入房间观看。

## 页面生命周期与登录态

持久化的登录状态只用于**预热**（如提前建立 Socket.IO 连接）；鉴权路由只信本次页面加载完成的认证终态。直接拿持久化状态做重定向判定，会在登出残留场景把未认证首访弹去登录页（"房间链接要输两次"类问题的根因）。

## 角色模型

| 角色 | 权限 |
|---|---|
| `root` | 全部房间控制 / 删除、用户审核、角色管理、系统设置、更新 |
| `admin` | 创建并完全控制自己的房间，不能删除他人房间 |
| `user` | 加入房间观看、评论弹幕（注册审核通过） |
| `guest` | 同 user（未登录或 pending 状态） |

房主（房间维度）是运行时角色：创建房间的人默认成为该房房主，可任命房管（上限 10 名）分担管理。控制权模型见[房间同步逻辑](/advanced/sync)。

## 接口权限

REST 接口按路由组鉴权，管理组（`/api/admin/*`）要求 admin / root，用户管理细化到 root 的部分在 [API 参考](/advanced/api) 中逐条标注。媒体代理类接口要求登录（防白嫖带宽），B站图片代理与健康检查开放。
