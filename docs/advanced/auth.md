# 鉴权与权限模型

这一页说明 ZViewer 怎样确认一个人的身份、怎样给他分配权限，以及前端在登录态还没确定时如何取舍。

## Token 体系

ZViewer 用两个 JWT 做身份认证，实现在 `middleware/auth.ts`。JWT（JSON Web Token，一种把用户身份签名后放进令牌的机制）由服务器签发一次，客户端每次请求带上它，服务器验签通过就认可身份，不必查会话表。两种令牌的分工如下表。

| Token | 默认有效期 | 环境变量 | 通道 |
|---|---|---|---|
| Access（正式用户） | **1 小时** | `JWT_ACCESS_EXPIRES_IN` | httpOnly Cookie + Bearer 头 + query `token` |
| Refresh（正式用户） | **30 天** | `JWT_REFRESH_EXPIRES_IN` | httpOnly Cookie（`POST /refresh` 也接受 body） |
| Access（guest） | 1 小时 | — | 同上 |
| Refresh（guest） | 7 天 | — | 同上 |

- **payload**（令牌里携带的数据）为 `{ userId, role, username?, iat }`。

- **同一套令牌要支持三种传递方式，是因为三种场景各有各的限制。** `extractAccessToken` 依次查找 query `token`、cookie `access_token` 和 `Authorization: Bearer`。普通的 REST 请求能自由设置请求头，所以用 Bearer 最省事；`<video>` / `<audio>` 这类媒体元素由浏览器自己发起请求，MSE 和 hls.js 也一样加不了自定义头，只能在媒体 URL 上挂一个 `?token=`；Socket.IO 读不到 URL 之外的信息，直接从 cookie 或 `handshake.auth.token` 里取。前端的 `appendAuthToken()` 只对本站 `/api/` 路径附加 token，专门处理 HTTP 下没有 auth cookie 的场景。

- **密钥自举。** `loadOrCreateSecret` 按顺序找密钥：先看环境变量，再看 `config/jwt-secrets.json`（内容长度 ≥32 才采信），都没有就自动生成一个 64 位 hex 密钥写回该文件。首次启动因此不需要任何配置，生产环境建议显式设置环境变量。

- **refresh 不轮换。** `/refresh` 只重新签发 access token 并重写 cookie，refresh token 本身长期不变。

- **令牌吊销。** `User.tokenInvalidBefore` 是一个时间戳，早于它的令牌一律失效。`authenticateToken` 中只要满足 `iat*1000 < invalidBefore` 就返回 401。改密码、删除用户后会调用 `invalidateUserTokens()` 写库并刷新内存缓存（缓存 TTL 60s，改密路径主动写缓存，保证立即生效）。游客（userId=0）没有 User 行，跳过这项检查。

### Cookie 属性与内网穿透兜底

Cookie 能不能下发、带什么属性，取决于请求是同站还是跨站，以及走的是 HTTP 还是 HTTPS。几种组合的结果见下表。

| 场景 | 结果 |
|---|---|
| 同站 / 任意协议 | `sameSite: 'lax'`（HTTPS 时加 `secure`） |
| 跨站 + HTTPS | `sameSite: 'none', secure: true` |
| 跨站 + HTTP | **无解**（SameSite=None 必须 Secure），需同站反代或升级 HTTPS |
| HTTP 请求 | **不下发 cookie**（`isRequestSecure` 为 false 直接 return），统一走 Bearer |

`isRequestSecure`（判断当前请求是否走 HTTPS 的函数）依次用三个线索判断，前一个不成立才看下一个：Express 自己解析出的 `req.secure`；反向代理写入的 `X-Forwarded-Proto`（反向代理用来告知原始协议的头）第一段是否为 `https`；以及 `Origin` 请求头是否以 `https://` 开头。最后这条是给内网穿透和 HTTP 反代 HTTPS 准备的兜底；伪造 `Origin` 的影响仅限于对 http 连接下发 Secure cookie，浏览器会直接丢弃，不构成安全恶化。跨站判定按 schemeful same-site 规则（把协议也算进比较的 same-site 判定），并忽略端口，以兼容端口映射。

## 注册模式与游客

服务器提供三种注册模式，另外给未登录的人留了一条游客通道。

- **注册模式**有三种：`open` 注册即激活；`approval` 注册后需要审核，这是默认值，注册后状态为 pending；`closed` 直接关闭注册。

- **用户名与密码规则。** 用户名必须匹配正则 `/^[\u4e00-\u9fa5A-Za-z0-9_\- ]{2,24}$/`，密码至少 4 位。在 `approval` 模式下，注册后状态为 pending，此时登录与 refresh 都返回 403「账号正在审核中」；root 审核通过后状态置为 active，如果原角色是 guest 就提升为 user。

- **游客（guest）。** `POST /api/auth/guest` 不需要鉴权，直接签发 `userId=0, role='guest'` 的令牌，`/auth/me` 返回一个虚拟用户而不查库，所以未登录的人也能加入房间观看。游客的有效期比正式用户短（refresh 7d 对 30d），这样在没有凭证可吊销的场景下能压低滥用面。

- **默认密码检测。** 登录响应会带上 `mustChangePassword`，由 bcrypt（一种专门做密码哈希的算法）比对 `'root'` 得出。

- **限流。** 登录为每 IP 15 分钟 20 次；连续失败 5 次锁 15 分钟（该功能默认关闭，设置 `ENABLE_LOGIN_LOCK=true` 开启）；改密为每用户 1 分钟 3 次。

## 角色模型

ZViewer 的角色分两层：全局角色决定账号在整个系统里的身份，房间运行时角色决定这个人在某个房间里能做什么。两层叠加后才得出最终权限。

### 全局角色

全局角色有四种，权限范围依次收窄，具体能力见下表。

| 角色 | 权限 |
|---|---|
| `root` | 全部房间控制/删除、用户审核与角色管理、系统设置、更新、服务器文件 |
| `admin` | 创建并完全控制自己的房间；管理后台只读（不能删除他人房间） |
| `user` | 加入房间观看、评论弹幕（审核通过后） |
| `guest` | 同 user（未登录或 pending） |

在 HTTP 侧，管理路由统一挂载 `authenticateToken + adminOnly`（root 和 admin 都放行），root-only 端点则单独导出 `requireRoot` 来保护。修改角色只允许在 `admin` 和 `user` 之间进行，root 账户不可改。root 的判定同时看两个条件：`role==='root'` 或 `username==='root'`。

### 房间运行时角色（叠加）

房主不是持久化的全局角色，而是运行时角色：Session 表中持有 `role: 'sharer' && endedAt IS NULL` 的那个会话就是当前房主。`canViewerPerform` 按固定顺序叠加判定：

```
房主（短路 true） → root（true） → 房管（查矩阵 moderator）
→ admin（查矩阵 admin） → user（查矩阵 user） → guest（false）
```

- **权限矩阵。** 系统设置里的矩阵覆盖 `addMovie / manageMovie / musicQueue / kickViewer / muteViewer` 五个动作和 `moderator / admin / user` 三列。缺省兼容值为房管与 admin 允许、user 拒绝。前端镜像同一份矩阵做 UI 门控（`systemSettingsStore.canRoomViewerPerform`）。

- **房管（上限 10 名）。** 房管的目标必须是登录用户、非房主本人、且当前在房间内；名单以 JSON 数组持久化在 `Room.moderators`。房管有防篡权规则 `canModeratorActOn`：不能操作房主、其他房管和 root。

- **权限校验缓存。** 校验结果带 5 秒 TTL 缓存（容量 1000 条），踢出、转交、会话结束时主动失效。

- **Socket 侧的身份来源。** 角色取自握手时写入的 `socket.data.userId / role / username`，身份不可伪造；控制申请类事件里的 `from` 由服务端注入。

- **建房权限。** guest 恒为否；root/admin 恒为是；user 取决于 `roomCreationMode === 'all-users'`，默认为 admin-only。

## 前端登录态：预热与判定的边界

这一节的约定用来处理「房间链接需要输入两次地址」这类问题。

- `authStore` 的持久化 key 是 **`zcontrol-auth-storage`**，持久化的字段有 `user / isAuthenticated / hasLoggedOut / autoLoginStatus`。**token 不持久化**，cookie 才是令牌的存储介质。

- `autoLoginStatus` 虽然持久化，但**它只代表上一次页面生命周期**。它唯一的用途是让 `useSocket` 判断能不能提前建连，避免以匿名状态建连被拒。

- `authResolved` **不持久化**，它代表本次页面加载的鉴权引导终态。`RequireAuth` 只看这一个值：没有 resolved 时原地渲染 `null` 等待，不做重定向；已经 resolved 且未认证才跳转 `/login`。别用持久化下来的 `done` 判断要不要跳转登录页，那是上一次页面生命周期留下的残留值。登出后虽然会清掉用户信息，但这个字段可能还停在 `done`，结果第一次访问的人还没经过鉴权就被直接弹去登录页。

- 登出和会话失效统一走 `expireSession()`：清掉 user，并把 `autoLoginStatus` 重置回 `idle`，不可置为 `done`。

- **启动流程（AuthInitializer）。** 先 `GET /auth/me`，网络错误最多重试 8 次，间隔 2s；确认失效就调用 `expireSession()`；然后自动领游客令牌，最多 3 次，退避采用 1.5s×n，只在 429、5xx 和网络错误时重试；最后 `reconnectSocket()`。无论结果如何，终态都必须置为 resolved。

## 连接降级与 401 拦截

断网、令牌过期、服务器重启都会让连接或请求失败，这一节说明系统如何逐级退让，以及如何避免刷屏式的重复重试。

- **Socket 三级降级**，由 `connect_error` 触发：第一步，错误消息命中鉴权类关键词时调用 `POST /auth/refresh`，成功后重连，并发安全；第二步，refresh 失败则调用 `POST /auth/guest`，降级为游客身份；第三步，游客也失败才 `logout()`。网络异常不会导致登出，交给 socket.io 自动重试。

- **HTTP 401/403 拦截**，由 `apiFetch` 处理：收到状态码后自动调用 `refreshAccessToken()`，再带上 `_retried` 标记重试一次。并发刷新复用同一个 in-flight Promise；refresh 明确失败后置 `sessionExpired` 阻止级联重试，登录或领取游客身份成功后重置该标记。

- 媒体请求不走 `apiFetch`，播放引擎在 401/403 时单独触发刷新重试，见[视频管线](/advanced/video-pipeline)。

## 接口权限查看

按权限等级可以把接口大致分成几组，先看整体轮廓。

- 公开：健康检查、注册模式与公开设置、注册与登录、游客令牌，以及 B站图片代理；其余代理需要登录，防止带宽滥用。

- 登录即可：挂载点、解析、代理、音乐、房间加入。

- 房主/root：房间删除、改名等房间级写操作。

- admin/root：管理后台读取；root-only 则包含用户审核、角色修改、删除用户、系统设置修改、更新、服务器文件。

- 逐条标注见 [REST API 参考](/advanced/api)。
