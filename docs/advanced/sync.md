# 房间同步逻辑

房间实时同步全部走 Socket.IO。连接建立前经 JWT 鉴权中间件 `io.use`，token 无效直接拒绝握手，WebSocket 与 REST 共用同一套身份。客户端只维持一个全局单例连接（`transports: ['websocket','polling']`、`withCredentials: true`），引用计数归零后延迟 100ms 断开。

## 房间数据结构与权威副本

服务器持有房间状态的权威副本，房主和观众都从它取值，分层与[架构总览](/advanced/index)一致。

- **运行时副本** `RoomRuntimeState`（内存 Map）：影片列表、当前影片、播放状态，以及房主最近一次 `subtitle-update` 的字幕缓存。字幕缓存只用于给中途加入的观众补发，不写库。
- **播放记忆** `PlaybackMemoryService`：内存缓存 + `PlaybackState` 表节流落盘（状态 2s、心跳 10s）。房主刷新后凭 `currentMovieId` 匹配同一影片恢复播放。每 30s 清理陈旧缓存（房主离线且最后更新超 10 分钟）。
- **持久化实体**：`Room` 与一对一关联的 `PlaybackState`。`Room` 字段含 roomId（8 位 nanoid）、密码（bcrypt cost 10）、`mode`、`shareMethod`、`streamKey`、审批开关、禁言与房管的 JSON 数组，以及 `lastAccessedAt`。

房主在线需同时满足：`hostSocketId` 不为空，且该 id 仍在 `io.sockets.sockets` 中（`isHostOnline()`）。只看前者会在后端重启后误判——旧 socket id 仍留在数据库里。

## 关键事件

标注 ack 的事件由客户端等待回调结果。

| 事件 | 方向 | 说明 |
|---|---|---|
| `create-room` / `close-room` / `host-leave` | C→S (ack) | 房间生命周期。`host-leave` 为暂离，不关房 |
| `register-host` | C→S (ack) | 房主注册或重连，返回 mode、shareMethod、streamKey 与推算后的 playback |
| `request-join` | C→S (ack) | `bcrypt.compare` 校验密码（root 免密）与人数上限 |
| `join-request` / `approve-join` / `reject-join` | 审批流 | 需审批时转发给房主；批准后 userId 写入 `approvedViewers`，此后永久免审批 |
| `play-movie` / `movie-list` / `current-movie` | 影片 | 权限由 `manageMovie` 矩阵控制；切换立即广播 |
| `watch-together-state` | 房主→S→成员 | 完整状态 `{state, diff, seq}`；先持久化再广播 |
| `watch-together-control` | 房主→S→成员 | `play/pause/seek/rate` 离散操作；**先广播（亚 500ms）后持久化** |
| `host-heartbeat` | 房主→S→成员 | 每 5s 一次 `{currentTime, isPlaying, playbackRate}` |
| `sync-heartbeat` | S→成员 | 统一心跳，`source: 'host' \| 'server'` 区分来源 |
| `seek-request` / `pause-request` / `play-request` (+`*-response`) | 控制权申请 | 见「控制权申请」 |
| `subtitle-update` / `subtitle-request` / `track-change` | 字幕/轨道 | 转发完整 tracks 与 cues 并缓存；类型分 `danmaku` / `subtitle` |
| `send-danmaku` / `send-comment` / `annotation-stroke` | 弹幕/评论/批注 | 持久化后广播；发送前校验在房与禁言状态 |

处理器统一注册在 `SocketRegistry`（20 个 handler，`backend/src/modules/*/handlers/`），ack 统一为 `{ success, message?, code?, data? }`。

两个 watch-together 事件的落盘与广播顺序相反，且是有意如此：`watch-together-state` 携带完整快照属权威数据，先写库再广播；`watch-together-control` 只是暂停、跳转这类离散操作，先广播保证即时性，再写库。改这两处前先看 handler 注释。

## 房主同步模型

房主是唯一同步源，观众进度一律以房主播放器为准。链路为「video 事件 → 防抖/节流 → 差分广播 → 服务器持久化并转发 → 观众对齐」：

1. **事件绑定**（`useVideoEventBindings.ts`）：`play/pause` 防抖 100ms、`seeked` 防抖 300ms、`ratechange` 立即触发。`timeupdate` 不广播，进度全走心跳。
2. **差分广播**（`useHostBroadcast.ts` + `state-merge.ts`）：先与上次状态浅比较，`currentTime` 相差 ≤2s 视为等价直接跳过；否则 `computeStateDiff` 生成增量并 `emit('watch-together-state', {state, diff, seq})`，seq 房主侧自增。
3. **心跳**（`useHostHeartbeat.ts`）：每 **5s** 一次 `host-heartbeat`。事件抑制期内（观众 seek 会回灌房主 video 事件）改发带 `suppressed: true` 的存活心跳，观众只重置离线计时、不校正进度。抑制用计数式租约管理，5 分钟自动过期。
4. **服务端处理**：校验 isRoomHost 与房间模式 → 写播放记忆 → 转发。`watch-together-control` 三条规则：pause 把 `currentTime` 凝固为推算值；seek 只改时间不改 `isPlaying`（避免 seek 后暂停抖动）；rate 先推算当前进度再改倍速。

## 观众端对齐算法

状态事件与心跳分两条通路，互不干扰。

- **状态事件**（`useViewerStateSync.ts`）只管离散字段：`sourceUrl` 变了才重建播放流（以 `state.currentTime` 为起点）；`isPlaying` 变了才 play/pause；`playbackRate` 变了才设倍速。`currentTime` 不随状态事件设置。seq 跳号（`payload.seq > lastSeq + 1`）即丢弃增量并请求全量自愈。
- **心跳驱动进度**（`useViewerHeartbeat.ts`），两阶段策略（`seek-strategy.ts`）：

| 进度差 | 行为 |
|---|---|
| ≤ 阈值 `max(3s, rate × 0.5)` | 忽略（收敛区） |
| 阈值 < diff ≤ **6s** | 软同步：倍速提到 `baseRate + 0.1`（封顶 2.0）渐进追赶 |
| > 6s | 硬 seek 直接对齐 |

seek 统一走 `executeSeek`（`seek-service.ts`）：目标落在缓冲区内或缺口不超过 10s 时走普通 seek；否则走 MSE Range seek（不重建 MediaSource，而是在锁内挂 `pendingSeekTargets` 接续）。seek 结束后补发合成 `seeked` 事件，保证外推基线新鲜。

### 房主离线时由服务器接管

`PlaybackBroadcasterService` 每 **2s** 遍历房间，仅当房主离线且房间内仍有 socket 时，按推算公式广播 `sync-heartbeat {source:'server'}`。观众端同时做 URL 过期检测，把 B站直链的过期签名去重后重新解析。房主重连有过渡期（`sharer-ready` 后首个心跳）：进度差 > 10s 时提示「2 秒后自动同步」并延迟硬 seek，≤10s 走软同步，避免画面跳变。

## 控制权申请

一起看模式下观众不能直接操作播放器，需申请审批：

1. 观众发起 `seek-request {roomId, time}` / `pause-request` / `play-request`，服务端校验在房且房主在线后转发。
2. 房主端弹审批卡，12s 未处理自动关闭。开启**自动通过**时跳过弹窗直接执行。
3. 房主同意后操作本地 video，走与普通操作相同的事件通道广播。申请者 pending 15s 未响应自动清除。
4. 5s 窗口内，同目标 seek、同类 pause / play 的申请合并为一条（`viewerSocketIds` 数组）批量应答。

顺序不可颠倒：房主同意 pause/play 时必须先操作本地 video 再应答，否则 video 已处于目标态、不再触发事件，观众端按钮状态不会更新。

## 自主控制模式

- 判定：收到 `host-disconnected` 视为房主离线，`sharer-ready` 视为恢复。
- 效果：`canControl = isHost || hostOffline`。离线期间观众直接控制**本地播放器**（方向键 ±5s 等），不经服务器广播，避免多人操作冲突；服务器心跳在本地被屏蔽。
- 音乐侧：观众 7s 未收到 `music:host-heartbeat` 即判定房主离线，同样进入自主控制，见[音乐管线](/advanced/music-pipeline)。

## 房间生命周期

| 阶段 | 参数 | 行为 |
|---|---|---|
| 房主断线宽限期 | **10 分钟**（`HOST_RECONNECT_GRACE_MS`） | 服务器维持最后状态继续外推，观众不中断；到期自动关房并广播 `room-closed` |
| 房主离线后加入宽限 | **5 分钟** | `getRecentSharer(roomId, 5min)` 允许观众进房；需审批的房间要求房主在线 |
| 无人自动清理 | 每 1 小时扫描，阈值 24 小时（可配） | 受 `autoDeleteInactiveRooms` / `autoDeleteAfterHours` 控制，触发条件是 `lastAccessedAt` 超时 |
| 密码 / 审批 | bcrypt(cost 10) / `requireApproval` | root 免密；批准过的用户进白名单，永久免审批 |

权限校验带 5s TTL 缓存（容量 1000，`room-permission.service.ts`），踢出、转交、会话结束时主动失效。管理员强制关房（HTTP 侧）时先广播 `room-closed` 再 disconnect 房间 socket，否则客户端会自动重连继续拉流。

## 不走 Socket.IO 的实时能力

- **语音聊天**：由独立 LiveKit 承载，主后端只签发凭证并执行禁言、踢出，见[语音聊天链路](/advanced/voice)。
- **OBS 推流**：由 Node Media Server 处理，播放端走 HTTP-FLV，不占 Socket.IO 通道。

## 观众端只读化与资源清理

- **只读守卫**（`art-shared.ts` `installViewerGuards`，仅观众安装）：capture 阶段阻断 video click、大播放按钮 click，以及进度条的 pointerdown / mousedown / touchstart / click，使 ArtPlayer 本地控制失效。双击全屏由 `onVideoDblClick` 接管，对 `.zart-stage` 容器请求全屏（对 video 全屏会遮挡控制栏与弹幕层），iOS 降级为网页全屏。进度条点击转成 seek 申请。
- **内嵌字幕提取取消**：提取是一条独立于播放引擎的 Range 拉流。影片切换的 cleanup 中无条件 `clearTimeout` 与 `cancelEmbeddedExtraction()`，否则旧影片的提取流会继续经服务器中转。观众端同样本地提取内嵌字幕，seek 后字幕秒级可用，不依赖房主广播。

## 投屏 / 推流模式的对齐差异

`mode` 取值 `screen-share` / `watch-together` / `listen-together`。投屏模式下的 `shareMethod` 为 `webrtc` 或 `stream-push`，同步机制完全不同：

- **WebRTC**：信令 `signal-offer/answer/ice-candidate` 定向转发，配合 `viewer-ready` / `sharer-ready` 握手，每个观众一条独立链路。
- **OBS 推流**：纯直播，无逐观众进度同步。「对齐」由 flv.js 追帧实现（`liveBufferLatencyChasing: true`，最大延迟 1.5s、目标 0.5s），多观众自动收敛到近实时。断流后指数退避重连（1s→16s，最多 5 次）；卡死检测（buffered 前沿停滞超 0.5s）时 seek 到 `bufferedEnd - 0.3`。推流码在 `postPublish` 校验：房间 active、投屏模式、stream-push 子模式三者需同时满足，否则 `session.reject()`。

## 常量速查

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

取值对照 `sync-playback/constants.ts` 等文件。
