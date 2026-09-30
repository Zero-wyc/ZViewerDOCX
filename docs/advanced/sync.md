# 房间同步逻辑

房间的实时同步全部走 Socket.IO（服务端与浏览器之间的双向实时通道）。连接建立时先经 JWT（JSON Web Token，登录后签发的身份令牌）鉴权中间件 `io.use`，token 无效直接拒绝握手，因此 WebSocket 与 REST 共用同一套身份体系。客户端只维持一个全局单例连接（`transports: ['websocket','polling']`、`withCredentials: true`），引用计数归零后延迟 100ms 断开。

## 房间数据结构与权威副本

服务器自己持有一份房间状态的权威副本，房主和观众都从它取值。这份副本分三层，与[架构总览](/advanced/index)中的状态分层对应。

- **运行时副本** `RoomRuntimeState`（内存 Map）：存放影片列表、当前影片、播放状态，以及房主最近一次 `subtitle-update` 的字幕缓存。字幕缓存只用于给中途加入的观众补发，不写库。
- **播放记忆** `PlaybackMemoryService`：内存缓存加 `PlaybackState` 表节流落盘（状态写入节流 2s、心跳落盘节流 10s）。房主刷新页面后，凭 `currentMovieId` 匹配到同一影片即可恢复播放。每 30s 清理一次陈旧缓存，规则是房主离线且最后更新超过 10 分钟。
- **持久化实体**：`Room` 与一对一关联的 `PlaybackState`。`Room` 的字段包括 roomId（8 位 nanoid，随机短 ID）、密码（bcrypt cost 10 哈希）、`mode`、`shareMethod`、`streamKey`、审批开关、禁言与房管的 JSON 数组，以及 `lastAccessedAt`。

房主是否在线由两个条件一起判定：`hostSocketId` 不为空，并且这个 id 还存在于 `io.sockets.sockets` 中（`isHostOnline()`）。只看前者会出问题——后端重启后旧 socket id 仍留在数据库里，服务器会误以为房主在线。

## 关键事件清单

下表汇总房间同步用到的事件，以及每个事件的方向和用途。标注 ack 的事件，客户端会等待一个回调结果。

| 事件 | 方向 | 说明 |
|---|---|---|
| `create-room` / `close-room` / `host-leave` | C→S (ack) | 房间生命周期。`host-leave` 表示暂离，不关房 |
| `register-host` | C→S (ack) | 房主注册或重连，返回 mode、shareMethod、streamKey 以及推算后的 playback |
| `request-join` | C→S (ack) | 用 `bcrypt.compare` 校验密码（root 免密），并校验人数上限 |
| `join-request` / `approve-join` / `reject-join` | 审批流 | 房间需审批时把请求转发给房主；批准后 userId 写入 `approvedViewers` 白名单，此后永久免审批 |
| `play-movie` / `movie-list` / `current-movie` | 影片 | 权限由 `manageMovie` 矩阵控制；切换影片立即广播 |
| `watch-together-state` | 房主→S→成员 | 完整同步状态 `{state, diff, seq}`；先持久化再广播 |
| `watch-together-control` | 房主→S→成员 | `play/pause/seek/rate` 离散操作；**先广播（亚 500ms）后持久化** |
| `host-heartbeat` | 房主→S→成员 | 每 5s 一次心跳 `{currentTime, isPlaying, playbackRate}` |
| `sync-heartbeat` | S→成员 | 统一心跳，用 `source: 'host' \| 'server'` 区分来源 |
| `seek-request` / `pause-request` / `play-request` (+`*-response`) | 控制权申请 | 流程见「控制权申请」一节 |
| `subtitle-update` / `subtitle-request` / `track-change` | 字幕/轨道 | 转发完整的 tracks 与 cues 并缓存；轨道类型分 `danmaku` 和 `subtitle` |
| `send-danmaku` / `send-comment` / `annotation-stroke` | 弹幕/评论/批注 | 持久化后广播；发送前校验在房状态与禁言状态 |

事件处理器统一注册在 `SocketRegistry`（20 个 handler，`backend/src/modules/*/handlers/`），ack（客户端回调，服务端用它回传结果）统一为 `{ success, message?, code?, data? }`。

`watch-together-state` 与 `watch-together-control` 的落盘和广播顺序是反过来的，而且有意如此。`watch-together-state` 携带完整快照，属于权威数据，所以先写数据库再广播；`watch-together-control` 只是暂停、跳转这类离散操作，观众的即时感受更重要，所以先广播（一般 500 毫秒内到达）再写库。改这两处之前，先看 handler 里的注释。

## 房主同步模型

房主是唯一的同步源，观众看到的进度一律以房主的播放器为准。整条链路是「房主 video 事件 → 防抖/节流 → 差分广播 → 服务器持久化并转发 → 观众对齐」，四个环节依次说明。

1. **事件绑定**（`useVideoEventBindings.ts`）：`play/pause` 防抖 100ms、`seeked` 防抖 300ms、`ratechange` 立即触发。`timeupdate` 不广播，进度完全走心跳。
2. **差分广播**（`useHostBroadcast.ts` + `state-merge.ts`）：先与上次状态做浅比较，`currentTime` 相差 ≤2s 视为等价、直接跳过；否则由 `computeStateDiff` 生成增量，再 `emit('watch-together-state', {state, diff, seq})`，seq 在房主侧自增。
3. **心跳**（`useHostHeartbeat.ts`）：每 **5s** 发一次 `host-heartbeat`。处于事件抑制期时（观众 seek 会回灌房主 video 事件），改发带 `suppressed: true` 的存活心跳，观众收到后只重置离线计时、不校正进度。抑制用计数式租约管理，5 分钟自动过期，防止悬挂。
4. **服务端处理**：先校验 isRoomHost 与房间模式，再写播放记忆（节流落盘），最后转发。`watch-together-control` 有三条处理规则：pause 时把 `currentTime` 凝固为推算值；seek 只改时间、不改 `isPlaying`，避免观众端 seek 后出现暂停抖动；rate 先推算当前进度，再改倍速。

## 观众端对齐算法

观众端把状态事件和心跳分成两条职责不同的通路，各管各的，避免互相打架。

- **状态事件**（`useViewerStateSync.ts`）只管离散字段：`sourceUrl` 变了才重建播放流（以 `state.currentTime` 为起点）；`isPlaying` 变了才 play/pause；`playbackRate` 变了才设倍速。`currentTime` 不随状态事件设置。seq 跳号检测（`payload.seq > lastSeq + 1`）一旦命中，就丢弃增量并请求全量自愈。
- **心跳驱动进度**（`useViewerHeartbeat.ts`），采用两阶段策略（`seek-strategy.ts`）。下表给出不同进度差对应的行为。

| 进度差 | 行为 |
|---|---|
| ≤ 阈值 `max(3s, rate × 0.5)`（自适应跟随阈值） | 忽略（收敛区） |
| 阈值 < diff ≤ **6s**（硬 seek 阈值） | 软同步：播放倍速提到 `baseRate + 0.1`（封顶 2.0）渐进追赶 |
| > 6s | 硬 seek 直接对齐 |

seek 本身统一走 `executeSeek`（`seek-service.ts`）。目标落在缓冲区内、或缺口不超过 10s 时走普通 seek；否则走 MSE Range seek（MSE 即 Media Source Extensions，浏览器提供的把媒体分片喂给 `<video>` 的接口；这条路径不重建 MediaSource，而是在锁内挂 `pendingSeekTargets` 接续）。seek 结束后补发一个合成 `seeked` 事件，保证外推基线保持新鲜。

### 房主离线时由服务器接管

房主掉线后进度不能停，改由服务器接手推进。`PlaybackBroadcasterService` 每 **2s** 遍历一次房间，仅当房主离线且房间内仍有 socket 时，按推算公式广播 `sync-heartbeat {source:'server'}`。观众端同时做 URL 过期检测，把 B站直链的过期签名去重后重新解析。房主重连时还有一个过渡期（`sharer-ready` 后的首个心跳）：进度差 > 10s 时提示「2 秒后自动同步」并延迟硬 seek，≤10s 走软同步，避免重连瞬间画面跳变。

## 控制权申请

一起看模式下观众不能直接操作播放器，想暂停、播放或跳转时要发申请给房主审批。流程如下。

1. 观众发起 `seek-request {roomId, time}` / `pause-request` / `play-request`，服务端校验在房且房主在线后转发。
2. 房主端弹出审批卡，12s 未处理自动关闭。开启**自动通过**时跳过弹窗，直接执行并应答。
3. 房主同意后操作本地 video，走与普通操作相同的事件通道广播。申请者 pending 15s 未响应则自动清除。
4. 优化项：5s 窗口内，同目标 seek、同类 pause 或 play 的申请**合并为一条**（`viewerSocketIds` 数组），批量应答。

有一处顺序不能颠倒：房主同意 pause/play 时必须先操作本地 video，再应答。否则房主 video 已经处于目标态、不会再触发事件，观众端的按钮状态就不会更新。

## 自主控制模式

房主离线后，观众需要能自己操作进度，这就是自主控制模式。它用一个判定开关加一套本地控制逻辑实现。

- 判定：观众收到 `host-disconnected` 视为房主离线，收到 `sharer-ready` 视为恢复。
- 效果：`canControl = isHost || hostOffline`。离线期间观众直接控制**本地播放器**（方向键 ±5s 等），不经过服务器广播，避免多个观众同时操作互相冲突。服务器心跳在本地被屏蔽，不会覆盖观众的操作。
- 音乐侧对应：观众 7s 未收到 `music:host-heartbeat` 即判定房主离线，同样进入自主控制。详见[一起听音乐管线](/advanced/music-pipeline)。

## 房间生命周期

房间从建立到销毁，各阶段的时限与触发条件如下表。

| 阶段 | 参数 | 行为 |
|---|---|---|
| 房主断线宽限期 | **10 分钟**（`HOST_RECONNECT_GRACE_MS`） | 服务器维持最后状态继续外推，观众不中断；到期自动关房并广播 `room-closed` |
| 房主离线后加入宽限 | **5 分钟** | `getRecentSharer(roomId, 5min)` 允许观众进房；需审批的房间则要求房主在线 |
| 无人自动清理 | 每 1 小时扫描，阈值 24 小时（可配） | 受系统设置 `autoDeleteInactiveRooms` / `autoDeleteAfterHours` 控制，触发条件是 `lastAccessedAt` 超时 |
| 密码 / 审批 | bcrypt(cost 10) / `requireApproval` | root 免密；批准过的用户进白名单，永久免审批 |

权限校验带 5s TTL 缓存（容量 1000，`room-permission.service.ts`），踢出、转交、会话结束时主动失效。管理员强制关房（HTTP 侧）时，先广播 `room-closed`，再 disconnect 房间内的 socket——否则客户端会自动重连，继续拉流。

## 观众端只读化与资源清理

一起看模式下观众的控制权全部上交给房主，同时影片切换时必须及时掐断上一部影片的资源。这一节说明这两件事如何实现。

- **只读守卫**（`art-shared.ts` `installViewerGuards`，仅观众安装）：在 capture 阶段阻断 video click、大播放按钮 click，以及进度条的 pointerdown/mousedown/touchstart/click，让 ArtPlayer 的本地控制全部失效。双击全屏由 `onVideoDblClick` 接管，它对 `.zart-stage` 容器请求全屏；如果对 video 全屏，会遮挡控制栏和弹幕层。iOS 上降级为网页全屏。进度条的点击会被转成 seek 申请。
- **内嵌字幕提取取消**：字幕提取是一条独立于播放引擎的 Range 拉流。影片切换的 cleanup 中无条件执行 `clearTimeout` 和 `cancelEmbeddedExtraction()`，否则旧影片的提取流会继续经服务器中转，产生持续的无用流量。观众端同样本地提取内嵌字幕，因此 seek 后字幕秒级可用，不依赖房主广播。

## 投屏 / 推流模式的对齐差异

`mode` 有三个取值：`screen-share`、`watch-together`、`listen-together`。投屏模式（`screen-share`）下还有子模式 `shareMethod`，取值为 `webrtc` 或 `stream-push`。两种子模式的同步机制完全不同。

- **WebRTC**：信令 `signal-offer/answer/ice-candidate` 定向转发，配合 `viewer-ready`/`sharer-ready` 握手。每个观众一条独立链路，天然互不影响。
- **OBS 推流（stream-push）**：纯直播，没有逐观众的进度同步。「对齐」由 flv.js 的**追帧**实现：`liveBufferLatencyChasing: true`，最大延迟 1.5s、目标延迟 0.5s，多个观众会自动收敛到近实时。断流后指数退避重连（1s→16s，最多 5 次）。卡死检测（buffered 前沿停滞超过 0.5s）时 seek 到 `bufferedEnd - 0.3`。推流码校验在 `postPublish` 阶段完成，要求房间 active、投屏模式、stream-push 子模式三者同时满足，不合法则 `session.reject()`。

## 常量查看

下表汇总同步逻辑中最常用的常量，取值可对照 `sync-playback/constants.ts` 等文件。

| 常量 | 值 |
|---|---|
| 房主心跳间隔 / 超时判离线 | 5s / 15s（3 倍） |
| 服务器心跳间隔 | 2s |
| 进度广播等价阈值 / 软同步上限 / 跟随阈值 | 2s / 6s / max(3s, rate×0.5) |
| 软同步追赶 | +0.1 倍速，封顶 2.0 |
| 房主断线宽限 / 观众加入宽限 | 10min / 5min |
| 无人清理 | 1h 周期 / 24h 阈值（可配） |
| 权限缓存 TTL | 5s |
| 音乐心跳 / 离线判定 / 对齐阈值 | 2s / 7s / 2s |
