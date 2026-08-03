# 一起看房间

## 核心体验

- 创建或加入房间，与好友同步观看。
- 房主拥有播放控制权：播放、暂停、跳转、倍速。观众可申请控制，房主确认后执行。
- 播放记忆：房主短暂断线后，由服务器继续广播当前状态，观众无需中断观看。
- 房主离线超时自动关房（10 分钟），期间观众可自由控制。

## 房间模式

房间有两种核心模式：

| 模式 | 说明 |
|---|---|
| `watch-together` | 一起看：所有人同步观看同一影片 |
| `screen-share` | 屏幕共享：分享端共享屏幕或视频画面（WebRTC） |

房间还支持 OBS 推流模式（`stream-push`），配合 Node Media Server 提供直播流，详见[屏幕共享与推流](/features/screenshare)。

## 观众管理

房主可以在房间内管理观众：

- 查看在线观众信息
- 踢出观众（`kick-viewer`）
- 禁言 / 解禁（`mute-viewer` / `unmute-viewer`）
- 申请加入审批（`request-join` / `approve-join` / `reject-join`）
- 转移房主（`transfer-host`）

## 加入方式

- 在首页 / 房间列表浏览并加入可用房间（列表 / 平铺视图）。
- 通过房间号直达：`/join` 页面输入房间号跳转加入。
- 密码房间需要输入密码；开启审批的房间需要房主确认。
- P2P 直连模式：不经过服务器，手动交换直连码建立一对一连接（直连共享端 / 直连观看端）。

## 房间生命周期（服务端）

| 阶段 | 行为 |
|---|---|
| 创建 | 生成唯一 `roomId`，记录房主与房间设置（密码、人数上限、审批开关、模式等） |
| 运行中 | 维护运行时状态（`room-state`）、会话（`room-session`）、观众（`viewer`）、影片列表（`movie`） |
| 房主断线 | 播放记忆模块接管，服务端推算并广播播放状态 |
| 房主离线超时 | 10 分钟后自动关房；管理员也可强制关闭或清理无人在线的房间 |

## 相关 API

- `GET /api/rooms`：活跃房间列表（含观众数、分享端在线状态）
- `PUT /api/rooms/:roomId/name`：修改房间名称（root 或房间创建者）
- `GET /api/rooms/:roomId/movies`：影片列表
- `POST /api/rooms/:roomId/movies`：新增影片
- `POST /api/rooms/:roomId/movies/reorder`：批量重排序
- `PUT /api/rooms/:roomId/movies/:movieId`：更新影片
- `DELETE /api/rooms/:roomId/movies/:movieId`：删除影片

Socket.IO 事件由 `SocketRegistry` 统一注册，覆盖房间生命周期、观众管理、影片操作、同步播放、评论批注等。
