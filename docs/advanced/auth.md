# 鉴权与权限模型

## Token 体系

JWT 双 token（`middleware/auth.ts`）：

| Token | 默认有效期 | 环境变量 | 通道 |
|---|---|---|---|
| Access（正式用户） | **1 小时** | `JWT_ACCESS_EXPIRES_IN` | httpOnly Cookie + Bearer 头 + query `token` |
| Refresh（正式用户） | **30 天** | `JWT_REFRESH_EXPIRES_IN` | httpOnly Cookie（`POST /refresh` 也接受 body） |
| Access（guest） | 1 小时 | — | 同上 |
| Refresh（guest） | 7 天 | — | 同上 |

- payload：`{ userId, role, username?, iat }`。
- **三通道鉴权顺序** `extractAccessToken`：**query `token` → cookie `access_token` → `Authorization: Bearer`**。三通道并存的现实原因：REST 可用 Bearer 头；`<video>` / `<audio>` / MSE / hls.js 无法自定义头，媒体 URL 附加 query token；Socket.IO 走 cookie 或 `handshake.auth.token`。前端 `appendAuthToken()` 只对本站 `/api/` 路径附加 token（HTTP 无 auth cookie 场景）。
- **密钥自举** `loadOrCreateSecret`：环境变量 → `config/jwt-secrets.json`（长度 ≥32 才采信）→ 自动生成 64 位 hex 写回文件。首次启动零配置可用，生产建议显式设环境变量。
- **refresh 不轮换**：`/refresh` 只重新签发 access token 并重写 cookie，refresh token 本身长期不变。
- **吊销机制**：`User.tokenInvalidBefore` 时间戳——`authenticateToken` 中 `iat*1000 < invalidBefore` 即 401；改密、删除用户后调用 `invalidateUserTokens()` 写库 + 刷内存缓存（缓存 TTL 60s，改密路径主动写缓存保证立即生效）。游客（userId=0）无 User 行跳过检查。

### Cookie 属性与内网穿透兜底

| 场景 | 结果 |
|---|---|
| 同站 / 任意协议 | `sameSite: 'lax'`（HTTPS 时加 `secure`） |
| 跨站 + HTTPS | `sameSite: 'none', secure: true` |
| 跨站 + HTTP | **无解**（SameSite=None 必须 Secure），需同站反代或升级 HTTPS |
| HTTP 请求 | **不下发 cookie**（`isRequestSecure` 为 false 直接 return），统一走 Bearer |

`isRequestSecure` 三级判定：`req.secure` → `X-Forwarded-Proto` 首段为 https → **Origin 头以 `https://` 开头即视为 secure**（内网穿透 / HTTP 反代 HTTPS 的兜底；伪造 Origin 的后果仅是对 http 连接下发 Secure cookie，浏览器会丢弃，无安全恶化）。跨站判定按 schemeful same-site 规则并**忽略端口**（兼容端口映射）。

## 注册模式与游客

- 模式：`open`（注册即激活）/ `approval`（默认，pending 待审核）/ `closed`（关闭注册）。
- 用户名正则 `/^[\u4e00-\u9fa5A-Za-z0-9_\- ]{2,24}$/`，密码 ≥4 位；`approval` 下注册后状态 pending，登录与 refresh 均 403「账号正在审核中」，root 审核通过后置 active（若 role 为 guest 则提升为 user）。
- **游客**（guest）：`POST /api/auth/guest` 无鉴权签发 `userId=0, role='guest'` 的令牌，`/auth/me` 直接返回虚拟用户（不查库），未登录即可加入房间观看。guest 有效期比正式用户短（refresh 7d vs 30d），降低无凭证可吊销场景的滥用面。
- 默认密码检测：登录响应 `mustChangePassword`（bcrypt 比对 `'root'`）。
- 限流：登录 15 分钟 20 次/IP；失败锁定 5 次锁 15 分钟（默认关闭，`ENABLE_LOGIN_LOCK=true` 开启）；改密 1 分钟 3 次/用户。

## 角色模型

### 全局角色

| 角色 | 权限 |
|---|---|
| `root` | 全部房间控制/删除、用户审核与角色管理、系统设置、更新、服务器文件 |
| `admin` | 创建并完全控制自己的房间；管理后台只读（不能删除他人房间） |
| `user` | 加入房间观看、评论弹幕（审核通过后） |
| `guest` | 同 user（未登录或 pending） |

HTTP 侧：管理路由统一挂载 `authenticateToken + adminOnly`（root 或 admin）；`requireRoot` 单独导出用于 root-only 端点。修改角色仅允许在 `admin` / `user` 之间，root 账户不可改（root 判定绑定「role==='root' 或 username==='root'」）。

### 房间运行时角色（叠加）

房主是**运行时角色**（Session 表 `role: 'sharer' && endedAt IS NULL`），与全局角色按下述顺序叠加判定 `canViewerPerform`：

```
房主（短路 true） → root（true） → 房管（查矩阵 moderator）
→ admin（查矩阵 admin） → user（查矩阵 user） → guest（false）
```

- 权限矩阵（系统设置）覆盖 `addMovie / manageMovie / musicQueue / kickViewer / muteViewer` 五个动作 × `moderator / admin / user` 三列；缺省兼容值：房管与 admin 允许、user 拒绝。前端镜像同一份矩阵做 UI 门控（`systemSettingsStore.canRoomViewerPerform`）。
- **房管**（上限 10 名）：目标是登录用户、非房主本人、当前在房间内；`Room.moderators` 为 JSON 数组持久化。房管防篡权 `canModeratorActOn`：不可操作房主、其他房管、root。
- 权限校验带 5s TTL 缓存（容量 1000），踢出 / 转交 / 会话结束时主动失效。
- Socket 侧角色来自握手时写入的 `socket.data.userId / role / username`，身份不可伪造（控制申请类事件的 `from` 由服务端注入）。
- 建房权限：guest 恒否；root/admin 恒是；user 取决于 `roomCreationMode === 'all-users'`（默认 admin-only）。

## 前端登录态：预热与判定的边界

这是「房间链接要输两次地址」类问题的根因所在，约定如下：

- `authStore` 持久化 key **`zcontrol-auth-storage`**，持久化 `user / isAuthenticated / hasLoggedOut / autoLoginStatus`；**token 不持久化**（cookie 是存储介质）。
- `autoLoginStatus` 虽持久化，但**只代表上一次页面生命周期**——它的唯一用途是让 `useSocket` 决定能否提前建连（避免匿名状态建连被拒）。
- `authResolved` **不持久化**，代表本次页面加载的鉴权引导终态；`RequireAuth` 只看它：未 resolved 时原地渲染 `null` 等待（不重定向），resolved 且未认证才跳 `/login`。拿持久化的 `done`（登出残留）判重定向会把未认证首访弹去登录页。
- 登出 / 会话失效用 `expireSession()`：清 user 且把 `autoLoginStatus` 重回 `idle`（绝不能置 `done`）。
- 启动流程（AuthInitializer）：`GET /auth/me`（网络错误最多重试 8 次，间隔 2s）→ 失效则 `expireSession()` → 自动领游客令牌（最多 3 次，退避 1.5s×n，仅 429/5xx/网络错误重试）→ `reconnectSocket()`；终态必置 resolved。

## 连接降级与 401 拦截

- **Socket 三级降级**（`connect_error`）：① 消息命中鉴权类关键词 → `POST /auth/refresh` 成功后重连（并发安全）；② refresh 失败 → `POST /auth/guest` 降级为游客身份；③ guest 也失败 → `logout()`。网络异常不登出，交给 socket.io 自动重试。
- **HTTP 401/403 拦截**（`apiFetch`）：自动 `refreshAccessToken()` 后带 `_retried` 重试一次；并发刷新复用同一个 in-flight Promise；refresh 明确失败后置 `sessionExpired` 阻止级联重试，登录 / 游客成功后重置。
- 媒体请求不走 apiFetch，播放引擎在 401/403 时单独触发刷新重试（见[视频管线](/advanced/video-pipeline)）。

## 接口权限速览

- 公开：健康检查、注册模式/公开设置、注册与登录、游客令牌、B站图片代理（其余代理需登录，防白嫖带宽）。
- 登录即可：挂载点、解析、代理、音乐、房间加入。
- 房主/root：房间删除、改名等房间级写操作。
- admin/root：管理后台读；root-only：用户审核/角色/删除、系统设置修改、更新、服务器文件。
- 逐条标注见 [REST API 参考](/advanced/api)。
