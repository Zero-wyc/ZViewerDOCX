# 前端架构

前端是一个 React 18 SPA：入口薄（`main.tsx` 只做日志与 Provider 挂载），路由与鉴权引导集中在 `App.tsx`，业务逻辑全部下沉到 `modules/`。本页按「入口 → 鉴权 → 连接 → 状态 → 模块 → 播放」的顺序展开。

---

## 应用入口与 Provider 树

```tsx
// frontend/src/main.tsx
initClientLogger({ minLevel: 'debug' })   // 拦截 console / 未捕获异常，批量上报后端
installMediaDebugProbe()                  // localStorage.zviewer-media-debug === '1' 才启用
createRoot(#root).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider><App /></ThemeProvider>
    </BrowserRouter>
  </StrictMode>
)
```

`App.tsx` 承担三件事：路由表、鉴权引导（`AuthInitializer`）、全局副作用（`useBackendHealth` 检测后端自动重启、启动时拉 `/api/auth/public-settings`）。

路由与守卫：

| 路径 | 组件 | 守卫 |
|---|---|---|
| `/`、`/login` | `HomePage`、`LoginPage` | 无 |
| `/room/:roomId?` | `modules/room/RoomPage` | `RequireAuth` |
| `/share/:roomId?`、`/watch/:roomId?` | 重定向到 `/room/:roomId` | — |
| `/admin` | `AdminPage` | `RequireAuth adminOnly` |
| `/profile` | `ProfilePage` | `RequireAuth forbiddenRoles={['guest']}` |
| `/rooms`、`/join` | `RoomsListPage`、`JoinByRoomIdPage` | `RequireAuth` |

---

## 鉴权引导边界（前端最容易踩坑处）

`AuthInitializer`（`App.tsx`）与 `RequireAuth`（`components/RequireAuth.tsx`）的配合有一组硬约定：

- `validate()` 先打 `GET /api/auth/me`（`apiFetch` 内部会在 401 时自动 refresh 后重试一次）；**网络错误最多重试 8 次、间隔 2s**。
- 校验失败且用户 ID 未变（排除「验证期间手动登录」竞态）→ `expireSession()` → `fetchGuestToken()`：**最多 3 次尝试，退避 `1.5s × attempt`，仅对 429 / 5xx / 网络错误重试**。
- 终态必置 `markAuthResolved()`；`authResolved` **不持久化**，代表「本次页面加载的鉴权引导终态」。`RequireAuth` 只看它：未 resolved 原地渲染 `null` 等待（不重定向），resolved 且未认证才跳 `/login`。
- `autoLoginStatus` 虽持久化，**只代表上一次页面生命周期**，唯一用途是让 `useSocket` 决定能否提前建连。

这些细节直接对应「房间链接要输两次地址」类问题，Token 体系与角色模型的完整说明见[鉴权与权限模型](/advanced/auth)。

---

## Socket 连接：全局单例 + 三级降级

`hooks/useSocket.ts` 维护两个模块级单例：

| 单例 | 用途 | 传输 |
|---|---|---|
| `globalSocket` | 业务消息（同步、弹幕、成员、投屏信令…） | `['websocket', 'polling']` |
| `globalMediaSocket` | 仅语音帧（独立连接，避免大消息的 TCP 队头阻塞波及 20ms 音频帧） | `['websocket']` |

要点：

- **引用计数 + 100ms 延迟断开**：多个组件同时 `useSocket()`，refCount 归零后延迟 100ms 再 disconnect，避免页面切换时的抖动。
- **建连时机**：`autoLoginStatus === 'done'` 才创建（避免匿名状态建连被拒）。
- **`connect_error` 三级降级**：消息命中鉴权类关键词 → ① `POST /api/auth/refresh` 成功后 `reconnectSocket()`；② refresh 失败 → `POST /api/auth/guest` 降级为游客身份；③ guest 也失败 → `logout()`。网络异常不登出，交给 socket.io 自动重试。并发用 `isRefreshingRef` 防重入。
- **`reconnectSocket()`** 采用 `disconnect()` + 50ms 微任务延迟后 `connect()`：socket.io 4.x 不会重建底层实例但会重新走握手，从而重新携带最新 cookie。

REST 侧对应的是 `lib/api.ts` 的 `apiFetch`：自动 `credentials: 'include'` + `buildAuthHeaders()`；401/403 时 `refreshAccessToken()` 后带 `_retried` 重试一次；并发刷新复用同一个 in-flight Promise；refresh 明确失败后置 `sessionExpired` 阻止级联重试。

---

## 状态层 `store/`

| store | 内容 |
|---|---|
| `roomStore.ts` | 房间态：模式、成员、影片列表、`watchTogether` 镜像、弹幕/预览/重载请求队列、流量相关 UI 态 + 影片 CRUD 薄封装 |
| `authStore.ts` | 用户、`isAuthenticated`、`autoLoginStatus`、`authResolved`（持久化 key `zcontrol-auth-storage`，**token 不持久化**） |
| `themeStore.ts` / `systemSettingsStore.ts` / `danmakuStore.ts` / `cliAgentStore.ts` / `useAppStore.ts` | 主题、公开系统设置（含权限矩阵镜像 `canRoomViewerPerform`）、弹幕轨道与元数据、CLI 代理状态、零散 UI |

`roomStore` 的两条设计细节值得单独记住：

- **`exitRoom()` vs `reset()`**：前者用于用户明确退出（清 `activeRoomId`），后者用于切换房间；二者都会联动 `useMusicStore.getState().reset()`。`RoomPage` 卸载时**不清状态**——这是「离开房间保持运行 / 右上角回到房间」功能的基础。
- **写操作后不本地改 state**：`addMovie` / `updateMovie` / `removeMovie` / `reorderMovies` 都只发请求，等后端 `movie-list` 广播回来刷新；只有「删除的是当前播放影片」这一种情况本地清理 `currentMovieId`（因为 REST 删除不会广播 `current-movie`）。

主题系统的完整实现在[主题系统实现](/advanced/theme-system)。

---

## 模块清单 `modules/`

| 模块 | 职责 |
|---|---|
| `room/` | 房间页外壳：`RoomPage.tsx` + 布局/面板组件 + `watch-together/`（一起看业务核心） |
| `player/` | 播放引擎抽象：`PlayerEngine` 接口、`engine-selector.ts`、`engines/`、`hooks/usePlayerSource.ts`、`services/` |
| `sync-playback/` | 前后端同步协议的前端实现：房主广播 / 观众对齐 / seek 策略 / 事件常量 |
| `playback-memory/` | 观众侧「请求初始状态」与「订阅服务器心跳」 |
| `art-player/` | ArtPlayer 集成、覆盖层与只读守卫（`art-shared.ts`） |
| `music/` | 一起听：`MusicAppShell` 整页底板、歌词页、队列、双源播放 |
| `screen-sharing/` | 投屏：WebRTC 信令、OBS 推流拉流、连接统计 |
| `voice-chat/` | 语音面板与语音帧处理 |
| `bilibili/` / `danmaku/` | B站解析参数与 API、弹幕 API |
| `subtitles/` | MKV 内嵌字幕提取桥接 |
| `mounts/` `webdav/` `ftp/` `openlist/` `emby/` `jellyfin/` `server-files/` | 各类内容源的浏览/挂载 UI 与 API |
| `anisubs/` `kazumi/` `direct-link/` | 番剧源与直链 |
| `p2p/` `admin/` | P2P 隧道试点、管理后台组件 |

`modules/` 内部统一形态（以 `player/` 为例）：

```
player/
├── types.ts               引擎接口（PlayerEngine / PlayerSource / PlayerController）+ 源数据结构
├── utils.ts               video 元素工具（resetVideoElement / waitForMetadata）
├── engine-selector.ts     selectEngine(source) 决策中心
├── engines/               各引擎实现（hls / flv / direct / playsvideo / videojs10 / videojs10-dash）
├── services/              url-proxy（代理路由决策）、buffer-mode、pause-intent…
├── hooks/usePlayerSource.ts  引擎无关的「把源应用到 video」Hook
└── index.ts               公共 API 出口
```

---

## 播放引擎抽象

引擎层是前端最清晰的一处抽象：`usePlayerSource` 是**引擎无关**的（不关心房主/观众，也不依赖 `WatchTogetherState`），调用方只需传入 `PlayerSource`。

```ts
// frontend/src/modules/player/types.ts
export interface PlayerEngine {
  readonly type: EngineType;                       // 'hls' | 'flv' | 'direct' | 'playsvideo' | 'videojs10' | 'videojs10-dash'
  attach(video: HTMLVideoElement, source: PlayerSource): Promise<EngineAttachResult>;
}
```

`selectEngine(source)`（`engine-selector.ts`）的决策顺序：

| 条件 | 引擎 |
|---|---|
| `format === 'dash'` 或存在 `audioUrl` | `videojs10-dash`（自研 MPD 构建 + v10 状态层 + dash.js 5.2 执行层） |
| `format === 'hls'` | `hls` |
| `format === 'flv'` | `flv` |
| `shouldUsePlaysVideo(source)` | `playsvideo`（容器重封装 / 音轨转码） |
| 其他 | `videojs10`（直链试点）；`localStorage['zviewer-vjs10-engine'] === '0'` 时回落 `direct` |

`shouldUsePlaysVideo` 的门控语义（`engine-selector.ts` 注释）值得原文记住：

- **唯一门控是影片级开关** `playsvideoEnabled === false` → 强制原生直连，失败也不回退。
- `avi / ts / wmv` 浏览器无法原生打开 → 必走 playsvideo；`mkv` 一律走 playsvideo（原生只支持 H.264/AAC 组合，且 DTS/AC3 需转码）；`mp4 / webm / mov` 仅当 `audioCodec` 明确不被支持时才介入。
- 该函数**同时被 `usePlayerSource` 的格式预检复用**，避免「预检放行」与「引擎选择」两处判定漂移。

`usePlayerSource` 的两个工程质量点：

- **全量操作串行化**：`attach` / `forceReload` 进同一条 Promise 队列，天然消除并发 attach 互相 abort（替代了旧的 `isAttaching` / `isReloading` 双锁 + 5s 等待循环）。
- **错误提示分工**：attach 期失败 `throw` 由调用方 catch；播放期失败由本 Hook 的 `video error` 监听经 `options.onPlaybackError` 上抛——错误知情权在引擎层（它才知道回退是否可用）。

更深的内容（引擎内 MPD 构建、缓冲模式、代理路由决策）见[视频源与 API 获取逻辑](/advanced/video-pipeline)，引擎注册步骤见[二次开发指南 · 新增一个播放引擎](/dev/guide#新增一个播放引擎)。

下一步 → [运行流程](/dev/runtime)
