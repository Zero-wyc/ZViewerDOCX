# 房间同步逻辑

房间实时同步全部走 Socket.IO。连接建立时经 JWT 鉴权中间件（`io.use`），token 无效直接拒绝握手，因此 WebSocket 与 REST 共用同一套身份体系。客户端为全局单例连接（`transports: ['websocket','polling']`、`withCredentials: true`），引用计数归零后 100ms 延迟断开。

## 房间数据结构与权威副本

服务器持有房间状态的**权威副本**，分三层（详见[架构总览](/advanced/index)）：

- **运行时副本** `RoomRuntimeState`（内存 Map）：影片列表、当前影片、播放状态、房主最近一次 `subtitle-update` 的字幕缓存（观众中途加入补发，不写库）。
- **播放记忆** `PlaybackMemoryService`：内存缓存 + `PlaybackState` 表节流落盘（状态写入 2s 节流、心跳落盘 10s 节流），房主刷新后凭 `currentMovieId` 匹配同一影片恢复播放；每 30s 清理一次陈旧缓存（房主离线且最后更新超 10 分钟即删除）。
- **持久化实体**：`Room`（roomId 为 8 位 nanoid、密码 bcrypt cost 10、`mode`、`shareMethod`、`streamKey`、审批开关、禁言/房管 JSON 数组、`lastAccessedAt`）与一对一的 `PlaybackState`。

房主是否在线的判定是**双条件**：`hostSocketId` 非空 **且** `io.sockets.sockets.has(hostSocketId)`（`isHostOnline()`）——防止后端重启后旧 socket id 造成的误判。

## 关键事件清单

| 事件 | 方向 | 说明 |
|---|---|---|
| `create-room` / `close-room` / `host-leave` | C→S (ack) | 生命周期；`host-leave` 为暂离不关房 |
| `register-host` | C→S (ack) | 房主注册/重连，返回 mode、shareMethod、streamKey、推算后的 playback |
| `request-join` | C→S (ack) | 密码 `bcrypt.compare` 校验（root 免密）、人数上限校验 |
| `join-request` / `approve-join` / `reject-join` | 审批流 | 需审批时转发房主；批准后 userId 写入 `approvedViewers` 白名单永久免审批 |
| `play-movie` / `movie-list` / `current-movie` | 影片 | 权限矩阵 `manageMovie`；切换即广播 |
| `watch-together-state` | 房主→S→成员 | 完整同步状态 `{state, diff, seq}`；先持久化再广播 |
| `watch-together-control` | 房主→S→成员 | `play/pause/seek/rate` 离散操作；**先广播（亚 500ms）后持久化** |
| `host-heartbeat` | 房主→S→成员 | 每 5s 心跳 `{currentTime, isPlaying, playbackRate}` |
| `sync-heartbeat` | S→成员 | 统一心跳，`source: 'host' \| 'server'` 区分来源 |
| `seek-request` / `pause-request` / `play-request` (+`*-response`) | 控制权申请 | 见下文 |
| `subtitle-update` / `subtitle-request` / `track-change` | 字幕/轨道 | 完整 tracks+cues 转发 + 缓存；轨道类型 `danmaku`/`subtitle` |
| `send-danmaku` / `send-comment` / `annotation-stroke` | 弹幕/评论/批注 | 持久化 + 广播；发送前校验在房与禁言状态 |

事件处理器统一注册在 `SocketRegistry`（17 个 handler，`backend/src/modules/*/handlers/`），ack 统一为 `{ success, message?, code?, data? }`。

## 房主同步模型

房主是唯一的同步源，链路为「房主 video 事件 → 防抖/节流 → 差分广播 → 服务器持久化+转发 → 观众对齐」：

1. **事件绑定**（`useVideoEventBindings.ts`）：`play/pause` 防抖 100ms、`seeked` 防抖 300ms、`ratechange` 立即；`timeupdate` 不广播（进度完全走心跳）。
2. **差分广播**（`useHostBroadcast.ts` + `state-merge.ts`）：与上次状态浅比较，`currentTime` 差 ≤2s 视为等价跳过；否则 `computeStateDiff` 生成增量，`emit('watch-together-state', {state, diff, seq})`，seq 自房主侧递增。
3. **心跳**（`useHostHeartbeat.ts`）：每 **5s** 发 `host-heartbeat`；事件抑制期（观众 seek 会回灌房主 video 事件）发 `suppressed: true` 的存活心跳，观众只重置离线计时、不校正进度。抑制采用计数式租约（5 分钟自动过期防悬挂）。
4. **服务端处理**：校验 isRoomHost + 房间模式 → 写播放记忆（节流落盘）→ 转发。`watch-together-control` 的处理有讲究：pause 时把 currentTime 凝固为推算值；seek 只改时间不改 isPlaying（避免观众端 seek 后暂停抖动）；rate 先推算当前进度再改倍速。

## 观众端对齐算法

观众端把「状态事件」与「心跳」职责分离：

- **状态事件**（`useViewerStateSync.ts`）只负责离散字段：`sourceUrl` 变化才重建播放流（以 `state.currentTime` 为起点）、`isPlaying` 变化才 play/pause、`playbackRate` 变化才设倍速——**currentTime 永远不随状态事件设置**。seq 跳号检测（`payload.seq > lastSeq + 1`）触发丢弃增量、请求全量自愈。
- **心跳驱动进度**（`useViewerHeartbeat.ts`），两阶段策略（`seek-strategy.ts`）：

| 进度差 | 行为 |
|---|---|
| ≤ 阈值 `max(3s, rate × 0.5)`（自适应跟随阈值） | 忽略（收敛区） |
| 阈值 < diff ≤ **6s**（硬 seek 阈值） | 软同步：播放倍速提到 `baseRate + 0.1`（封顶 2.0）渐进追赶 |
| > 6s | 硬 seek 直接对齐 |

seek 本身走统一入口 `executeSeek`（`seek-service.ts`）：目标在缓冲区内或缺口 ≤10s 时普通 seek；否则 MSE Range seek（不重建 MediaSource，锁内挂 `pendingSeekTargets` 接续），结束后补发合成 `seeked` 事件保证外推基线新鲜。

### 服务器接管（房主离线）

`PlaybackBroadcasterService` 每 **2s** 遍历房间，仅当房主离线且房间仍有 socket 时，按推算公式广播 `sync-heartbeat {source:'server'}`。观众端同时做 URL 过期检测（B站直链过期签名去重后重新解析）。房主重连过渡（`sharer-ready` 后首个心跳）：diff > 10s 时提示「2 秒后自动同步」并延迟硬 seek，≤10s 走软同步，避免重连瞬间的跳变。

## 控制权申请

1. 观众发起 `seek-request {roomId, time}` / `pause-request` / `play-request`，服务端校验在房 + 房主在线后转发。
2. 房主端弹审批卡（12s 自动关闭）；**自动通过**开启时跳过弹窗直接执行并应答。
3. 同意后房主操作本地 video → 走与普通操作相同的事件通道广播；申请者 pending 15s 未响应自动清除。
4. 优化：5s 窗口内同目标 seek / 同类 pause / play 申请**合并为一条**（`viewerSocketIds` 数组），批量应答。

注意实现细节：房主同意 pause/play 时会**主动操作本地 video 再应答**——否则房主 video 已是目标态、不再触发事件，观众端按钮状态不会更新。

## 自主控制模式

- 判定：观众收到 `host-disconnected` → 房主离线；收到 `sharer-ready` → 恢复。
- 效果：`canControl = isHost || hostOffline`——离线期间观众直接控制**本地播放器**（方向键 ±5s 等），不经过服务器广播（避免多观众互相打架）；服务器心跳在本地被屏蔽，不覆盖观众操作。
- 音乐侧对应：观众 7s 未收到 `music:host-heartbeat` 判定离线，同样进入自主控制（见[一起听音乐管线](/advanced/music-pipeline)）。

## 房间生命周期

| 阶段 | 参数 | 行为 |
|---|---|---|
| 房主断线宽限期 | **10 分钟**（`HOST_RECONNECT_GRACE_MS`） | 服务器维持最后状态继续外推，观众不中断；到期自动关房广播 `room-closed` |
| 房主离线后加入宽限 | **5 分钟** | `getRecentSharer(roomId, 5min)` 允许观众进房；需审批房间则房主必须在线 |
| 无人自动清理 | 每 1 小时扫描，阈值 24 小时（可配） | 受系统设置 `autoDeleteInactiveRooms` / `autoDeleteAfterHours` 控制，条件 `lastAccessedAt` 超时 |
| 密码 / 审批 | bcrypt(cost 10) / `requireApproval` | root 免密；批准过的用户进白名单永久免审批 |

权限校验带 5s TTL 缓存（容量 1000，`room-permission.service.ts`），踢出/转交/会话结束时主动失效。管理员强制关房（HTTP 侧）先广播 `room-closed` 再 disconnect 房间内 socket——防止客户端自动重连后继续拉流。

## 观众端只读化与资源清理（一起看）

- **只读守卫**（`art-shared.ts` `installViewerGuards`，仅观众安装）：capture 阶段阻断 video click、大播放按钮 click、进度条 pointerdown/mousedown/touchstart/click——ArtPlayer 的本地控制全部失效，双击全屏由 `onVideoDblClick` 接管（对 `.zart-stage` 容器请求全屏，对 video 全屏会遮挡控制栏/弹幕层；iOS 降级网页全屏）。进度条点击被转为 seek 申请。
- **内嵌字幕提取取消**：提取是独立于播放引擎的 Range 拉流，影片切换的 cleanup 中无条件 `clearTimeout` + `cancelEmbeddedExtraction()`——否则旧影片的提取流会继续经服务器中转，产生持续的无用流量。观众端同样本地提取内嵌字幕（seek 后字幕秒级可用，不依赖房主广播）。

## 投屏 / 推流模式的对齐差异

`mode ∈ {screen-share, watch-together, listen-together}`；投屏模式子模式 `shareMethod ∈ {webrtc, stream-push}`：

- **WebRTC**：信令 `signal-offer/answer/ice-candidate` 定向转发 + `viewer-ready`/`sharer-ready` 握手，逐观众链路天然独立。
- **OBS 推流（stream-push）**：纯直播、无逐观众进度同步。「对齐」由 flv.js **追帧**实现：`liveBufferLatencyChasing: true`，最大延迟 1.5s、目标延迟 0.5s，多观众自动收敛到近实时；断流指数退避重连（1s→16s，最多 5 次），卡死检测（buffered 前沿停滞超 0.5s）时 seek 到 `bufferedEnd - 0.3`。推流码校验（`postPublish`）要求房间 active + 投屏模式 + stream-push 子模式，非法 `session.reject()`。

## 常量速查（`sync-playback/constants.ts` 等）

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
