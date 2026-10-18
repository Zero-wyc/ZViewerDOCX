# 鉴权与权限模型

身份如何确认、权限如何分配，以及前端在登录态未确定时如何取舍。

## Token 体系

两个 JWT 做身份认证，实现在 `middleware/auth.ts`。

| Token | 默认有效期 | 环境变量 | 通道 |
|---|---|---|---|
| Access（正式用户） | **1 小时** | `JWT_ACCESS_EXPIRES_IN` | httpOnly Cookie + Bearer 头 + query `token` |
| Refresh（正式用户） | **30 天** | `JWT_REFRESH_EXPIRES_IN` | httpOnly Cookie（`POST /refresh` 也接受 body） |
| Access（guest） | 1 小时 | — | 同上 |
| Refresh（guest） | 7 天 | — | 同上 |

- payload 为 `{ userId, role, username?, iat }`。
- **三种传递方式各对应一类场景**：`extractAccessToken` 依次查 query `token`、cookie `access_token`、`Authorization: Bearer`。REST 能自由设头，用 Bearer；`<video>` / `<audio>` / MSE / hls.js 加不了自定义头，只能在媒体 URL 挂 `?token=`；Socket.IO 读不到 URL 之外的信息，从 cookie 或 `handshake.auth.token` 取。前端 `appendAuthToken()` 只对本站 `/api/` 路径附加 token，处理 HTTP 下没有 auth cookie 的场景。
- **密钥自举**：`loadOrCreateSecret` 按「环境变量 → `config/jwt-secrets.json`（长度 ≥32 才采信）→ 自动生成 64 位 hex 写回」三级回退。首次启动无需配置，生产建议显式设置。
- **refresh 不轮换**：`/refresh` 只重签 access token 并重写 cookie。
- **令牌吊销**：`User.tokenInvalidBefore` 早于该时间戳的令牌一律失效（`iat*1000 < invalidBefore` 返回 401）。改密、删用户后调用 `invalidateUserTokens()` 写库并刷新内存缓存（TTL 60s，改密路径主动写缓存）。游客（userId=0）无 User 行，跳过检查。

### Cookie 属性与内网穿透兜底

| 场景 | 结果 |
|---|---|
| 同站 / 任意协议 | `sameSite: 'lax'`（HTTPS 时加 `secure`） |
| 跨站 + HTTPS | `sameSite: 'none', secure: true` |
| 跨站 + HTTP | **无解**（SameSite=None 必须 Secure），需同站反代或升级 HTTPS |
| HTTP 请求 | **不下发 cookie**，统一走 Bearer |

`isRequestSecure` 依次用三个线索判断：`req.secure`、`X-Forwarded-Proto` 第一段是否为 `https`、`Origin` 是否以 `https://` 开头。最后一条是给内网穿透和 HTTP 反代 HTTPS 的兜底；伪造 `Origin` 只会导致对 http 连接下发 Secure cookie，浏览器直接丢弃。跨站判定按 schemeful same-site 规则并忽略端口，兼容端口映射。

## 注册模式与游客

- **注册模式**：`open` 注册即激活；`approval`（默认）注册后为 pending 需审核；`closed` 关闭注册。
- **用户名与密码**：用户名匹配 `/^[\u4e00-\u9fa5A-Za-z0-9_\- ]{2,24}$/`，密码至少 4 位。`approval` 模式下 pending 用户登录与 refresh 均返回 403「账号正在审核中」；root 审核通过后置为 active，原角色为 guest 则提升为 user。
- **游客**：`POST /api/auth/guest` 无需鉴权，直接签发 `userId=0, role='guest'`，`/auth/me` 返回虚拟用户而不查库。游客 refresh 7d 短于正式用户 30d，在无凭证可吊销的场景下压低滥用面。
- **默认密码检测**：登录响应带 `mustChangePassword`，由 bcrypt 比对 `'root'` 得出。
- **限流**：登录每 IP 15 分钟 20 次；连续失败 5 次锁 15 分钟（`ENABLE_LOGIN_LOCK=true` 开启，默认关闭）；改密每用户 1 分钟 3 次。

## 角色模型

两层叠加：全局角色决定账号身份，房间运行时角色决定在某个房间里能做什么。

### 全局角色

| 角色 | 权限 |
|---|---|
| `root` | 全部房间控制 / 删除、用户审核与角色管理、系统设置、更新、服务器文件 |
| `admin` | 创建并完全控制自己的房间；管理后台只读（不能删他人房间） |
| `user` | 加入房间观看、评论弹幕（审核通过后） |
| `guest` | 同 user（未登录或 pending） |

HTTP 侧管理路由统一挂 `authenticateToken + adminOnly`（root 与 admin 放行），root-only 端点用 `requireRoot`。改角色只允许在 `admin` 与 `user` 之间，root 不可改；root 判定同时看 `role==='root'` 或 `username==='root'`。

### 房间运行时角色（叠加）

房主不是持久化角色，而是运行时角色：Session 表中 `role: 'sharer' && endedAt IS NULL` 的会话即当前房主。`canViewerPerform` 按固定顺序判定：

```
房主（短路 true） → root（true） → 房管（查矩阵 moderator）
→ admin（查矩阵 admin） → user（查矩阵 user） → guest（false）
```

- **权限矩阵**：系统设置里的矩阵覆盖 `addMovie / manageMovie / musicQueue / kickViewer / muteViewer` 五个动作与 `moderator / admin / user` 三列，缺省为房管与 admin 允许、user 拒绝。前端镜像同一份矩阵做 UI 门控（`systemSettingsStore.canRoomViewerPerform`）。
- **房管（上限 10 名）**：目标须为登录用户、非房主本人、当前在房间内；名单以 JSON 数组存在 `Room.moderators`。防篡权规则 `canModeratorActOn`：不能操作房主、其他房管与 root。
- **权限校验缓存**：5 秒 TTL（容量 1000），踢出、转交、会话结束时主动失效。
- **Socket 侧身份**：角色取自握手写入的 `socket.data.userId / role / username`，不可伪造；控制申请事件里的 `from` 由服务端注入。
- **建房权限**：guest 恒否；root / admin 恒是；user 取决于 `roomCreationMode === 'all-users'`（默认 admin-only）。

## 前端登录态：预热与判定的边界

- `authStore` 持久化 key 为 **`zcontrol-auth-storage`**，字段含 `user / isAuthenticated / hasLoggedOut / autoLoginStatus`。**token 不持久化**，cookie 才是令牌载体。
- `autoLoginStatus` 虽持久化，但只代表上一次页面生命周期，唯一用途是让 `useSocket` 判断能否提前建连。
- `authResolved` **不持久化**，代表本次加载的鉴权引导终态。`RequireAuth` 只看它：未 resolved 时渲染 `null` 等待、不重定向；resolved 且未认证才跳 `/login`。别用持久化的 `done` 判断跳转——登出后该字段可能仍停在 `done`，首次访问者会被直接弹去登录页。
- 登出与会话失效统一走 `expireSession()`：清 user 并把 `autoLoginStatus` 重置回 `idle`，不可置 `done`。
- **启动流程（AuthInitializer）**：`GET /auth/me`（网络错误最多重试 8 次，间隔 2s）→ 失效则 `expireSession()` → 领取游客令牌（最多 3 次，退避 1.5s×n，仅 429 / 5xx / 网络错误重试）→ `reconnectSocket()`。终态必须置为 resolved。

## 连接降级与 401 拦截

- **Socket 三级降级**（由 `connect_error` 触发）：错误命中鉴权类关键词时 `POST /auth/refresh`，成功重连（并发安全）→ refresh 失败则 `POST /auth/guest` 降级游客 → 游客也失败才 `logout()`。网络异常不登出，交给 socket.io 自动重试。
- **HTTP 401/403 拦截**（`apiFetch`）：自动 `refreshAccessToken()` 后带 `_retried` 标记重试一次；并发刷新复用同一 in-flight Promise；refresh 明确失败后置 `sessionExpired` 阻止级联重试，登录或领游客成功后重置。
- 媒体请求不走 `apiFetch`，播放引擎在 401/403 时单独触发刷新重试，见[视频管线](/advanced/video-pipeline)。

## 接口权限分级

- **公开**：健康检查、注册模式与公开设置、注册与登录、游客令牌、B站图片代理；其余代理需登录，防带宽滥用。
- **登录即可**：挂载点、解析、代理、音乐、房间加入。
- **房主 / root**：房间删除、改名等房间级写操作。
- **admin / root**：管理后台读取；root-only 含用户审核、改角色、删用户、系统设置、更新、服务器文件。

逐条标注见 [REST API 参考](/advanced/api)。
