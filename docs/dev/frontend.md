# 前端架构

前端是一个 React 18 SPA（单页应用，整个界面加载一次，切换视图时不刷新页面）。入口文件只做两件事：初始化日志、挂载 Provider（把全局能力逐层注入组件树的包装组件）。路由和鉴权引导集中在 `App.tsx`，业务逻辑按功能拆进 `modules/` 目录。本页按入口 → 鉴权 → 连接 → 状态 → 模块 → 播放的顺序讲解。

---

## 应用入口的挂载顺序

`main.tsx` 是前端唯一的入口文件。它在渲染根组件之前先装好日志通道和调试探针，然后才把 `App` 挂进 Provider 树。

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

`App.tsx` 负责三部分：路由表、鉴权引导（`AuthInitializer`）、全局副作用。全局副作用有两项，一是用 `useBackendHealth` 检测后端是否自动重启，二是在启动时拉取 `/api/auth/public-settings`。

`App.tsx` 里注册的路由和对应守卫如下。

| 路径 | 组件 | 守卫 |
|---|---|---|
| `/`、`/login` | `HomePage`、`LoginPage` | 无 |
| `/room/:roomId?` | `modules/room/RoomPage` | `RequireAuth` |
| `/share/:roomId?`、`/watch/:roomId?` | 重定向到 `/room/:roomId` | — |
| `/admin` | `AdminPage` | `RequireAuth adminOnly` |
| `/profile` | `ProfilePage` | `RequireAuth forbiddenRoles={['guest']}` |
| `/rooms`、`/join` | `RoomsListPage`、`JoinByRoomIdPage` | `RequireAuth` |

---

## 鉴权引导的职责边界

鉴权引导要解决的问题是：页面刚加载时，前端还不知道当前用户是谁，这段时间该做什么。`AuthInitializer`（`App.tsx` 中负责确认登录态的组件）和 `RequireAuth`（`components/RequireAuth.tsx` 中包在受保护路由外面的组件）通过以下几条约定配合。

- 校验阶段调用 `validate()`，它先请求 `GET /api/auth/me`。`apiFetch` 收到 401 时会自动刷新 token 并重试一次。如果是网络错误，最多重试 8 次，每次间隔 2s。
- 校验失败，并且用户 ID 没有变化时，才进入降级流程。检查用户 ID 是为了排除「校验期间用户手动登录」这类竞态。降级流程依次调用 `expireSession()` 和 `fetchGuestToken()`。后者最多尝试 3 次，退避时间为 `1.5s × attempt`，只有 429、5xx 和网络错误才重试。
- 无论走哪条分支，流程结束都必须调用 `markAuthResolved()`。`authResolved` 不写入持久化存储，它只表示本次页面加载的鉴权引导已经结束。`RequireAuth` 只读这一个标记：还没 resolved 时渲染 `null` 继续等待，不做重定向；resolved 且未认证才跳转到 `/login`。
- `autoLoginStatus` 会持久化，但它只描述上一次页面生命周期。它唯一的用途是让 `useSocket` 判断能否提前建连。

上述约定对应「房间链接需输入两次地址」一类问题。Token 体系与角色模型见[鉴权与权限模型](/advanced/auth)。

---

## Socket 连接的复用与降级

`hooks/useSocket.ts` 维护两个模块级单例。「模块级单例」指整个前端只创建一份实例，所有组件共用，不随某个组件卸载而销毁。两个单例的分工如下。

| 单例 | 用途 | 传输 |
|---|---|---|
| `globalSocket` | 业务消息（同步、弹幕、成员、投屏信令…） | `['websocket', 'polling']` |
| `globalMediaSocket` | 仅语音帧（独立连接，避免大消息的 TCP 队头阻塞波及 20ms 音频帧） | `['websocket']` |

建连和断连的过程有四处需要注意。

- **引用计数 + 100ms 延迟断开**：多个组件会同时调用 `useSocket()`。引用计数归零后不立即断开，而是延迟 100ms 再 disconnect，避免页面切换时反复建连断连造成抖动。
- **建连时机**：只有 `autoLoginStatus === 'done'` 时才创建连接。匿名状态下建连会被服务端拒绝。
- **`connect_error` 三级降级**：先看错误消息是否含鉴权类关键词。命中后依次尝试：① 调用 `POST /api/auth/refresh`，成功后执行 `reconnectSocket()`；② refresh 失败，就调用 `POST /api/auth/guest` 降级为游客身份；③ guest 也失败，才执行 `logout()`。网络类异常不触发登出，交给 socket.io 自己重试。并发调用时用 `isRefreshingRef` 防止重入。
- **`reconnectSocket()`** 先 `disconnect()`，隔 50ms 再 `connect()`。socket.io 4.x 不会重建底层实例，但会重新走一次握手，从而带上最新的 cookie。

REST 侧由 `lib/api.ts` 的 `apiFetch` 负责。它自动加上 `credentials: 'include'` 和 `buildAuthHeaders()`；收到 401 或 403 时先调用 `refreshAccessToken()`，再带 `_retried` 重试一次；多个请求同时需要刷新时复用同一个 in-flight Promise（尚未完成的 Promise）；刷新失败后置 `sessionExpired`，阻止后续请求继续级联重试。

---

## 状态层 `store/`

全局状态集中在 `store/` 目录，每个文件导出一份可被任意组件订阅的状态。各 store 的内容如下。

| store | 内容 |
|---|---|
| `roomStore.ts` | 房间态：模式、成员、影片列表、`watchTogether` 镜像、弹幕/预览/重载请求队列、流量相关 UI 态；影片 CRUD 薄封装 |
| `authStore.ts` | 用户、`isAuthenticated`、`autoLoginStatus`、`authResolved`（持久化 key `zcontrol-auth-storage`，token 不持久化） |
| `themeStore.ts` / `systemSettingsStore.ts` / `danmakuStore.ts` / `cliAgentStore.ts` / `useAppStore.ts` | 主题、公开系统设置（含权限矩阵镜像 `canRoomViewerPerform`）、弹幕轨道与元数据、CLI 代理状态、零散 UI |

`roomStore` 还有两条容易被忽略的约定。

- **`exitRoom()` 与 `reset()` 用途不同**：前者用于明确退出，会清掉 `activeRoomId`；后者用于切换房间。两者都会联动调用 `useMusicStore.getState().reset()`。`RoomPage` 卸载时不清状态，这是「离开房间保持运行 / 右上角回到房间」功能的基础。
- **写操作后不本地改 state**：`addMovie`、`updateMovie`、`removeMovie`、`reorderMovies` 只发请求，等后端把 `movie-list` 广播回来再刷新列表。只有一种情况例外：「删除的是当前播放影片」时本地清理 `currentMovieId`，因为这条 REST 删除不会广播 `current-movie`。

主题系统实现见[主题系统实现](/advanced/theme-system)。

---

## 模块划分 `modules/`

前端业务代码按功能拆进 `modules/`，每个目录对应一块相对独立的功能。各模块的职责如下。

| 模块 | 职责 |
|---|---|
| `room/` | 房间页外壳：`RoomPage.tsx` + 布局/面板组件 + `watch-together/`（一起看业务核心） |
| `player/` | 播放引擎抽象：`PlayerEngine` 接口、`engine-selector.ts`、`engines/`、`hooks/usePlayerSource.ts`、`services/` |
| `sync-playback/` | 同步协议前端实现：房主广播、观众对齐、seek 策略、事件常量 |
| `playback-memory/` | 观众侧请求初始状态与订阅服务器心跳 |
| `art-player/` | ArtPlayer 集成、覆盖层与只读守卫（`art-shared.ts`） |
| `music/` | 一起听：`MusicAppShell` 整页底板、歌词页、队列、双源播放 |
| `screen-sharing/` | 投屏：WebRTC 信令、OBS 推流拉流、连接统计 |
| `voice-chat/` | 语音面板与语音帧处理 |
| `bilibili/` / `danmaku/` | B站解析参数与 API、弹幕 API |
| `subtitles/` | MKV 内嵌字幕提取桥接 |
| `mounts/` `webdav/` `ftp/` `openlist/` `emby/` `jellyfin/` `server-files/` | 各类内容源的浏览/挂载 UI 与 API |
| `anisubs/` `kazumi/` `direct-link/` | 番剧源与直链 |
| `p2p/` `admin/` | P2P 隧道试点、管理后台组件 |

各模块内部的目录结构是一致的。以 `player/` 为例：

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

播放引擎负责把一个视频源真正接到 `<video>` 元素上。这一层被抽成统一的 `PlayerEngine` 接口，不同格式和不同播放方式各对应一个实现。

`usePlayerSource` 与引擎无关：它不区分房主和观众，也不依赖 `WatchTogetherState`，调用方只要传入 `PlayerSource`。

```ts
// frontend/src/modules/player/types.ts
export interface PlayerEngine {
  readonly type: EngineType;                       // 'hls' | 'flv' | 'direct' | 'playsvideo' | 'videojs10' | 'videojs10-dash'
  attach(video: HTMLVideoElement, source: PlayerSource): Promise<EngineAttachResult>;
}
```

`selectEngine(source)`（`engine-selector.ts`）按以下顺序判定，条件命中即返回。

| 条件 | 引擎 |
|---|---|
| `format === 'dash'` 或存在 `audioUrl` | `videojs10-dash`（自研 MPD 构建 + v10 状态层 + dash.js 5.2 执行层） |
| `format === 'hls'` | `hls` |
| `format === 'flv'` | `flv` |
| `shouldUsePlaysVideo(source)` | `playsvideo`（容器重封装 / 音轨转码） |
| 其他 | `videojs10`（直链试点）；`localStorage['zviewer-vjs10-engine'] === '0'` 时回落 `direct` |

`shouldUsePlaysVideo` 用一个门控决定是否启用 playsvideo 引擎。门控（gate）就是「判断某个功能是否启用」的条件，具体语义见 `engine-selector.ts` 的注释。

- 唯一的门控是影片级开关：`playsvideoEnabled === false` 时强制走原生直连，失败也不回退到 playsvideo。
- `avi / ts / wmv` 浏览器无法原生打开，必须走 playsvideo；`mkv` 一律走 playsvideo，因为原生播放只支持 H.264/AAC 组合，而 DTS/AC3 音轨需要转码；`mp4 / webm / mov` 只在 `audioCodec` 明确不被支持时才介入。
- 该函数同时被 `usePlayerSource` 的格式预检复用，这样「预检放行」和「引擎选择」不会出现两套判定结果不一致的情况。

`usePlayerSource` 有两处实现约束，改动时需要注意。

- **全量操作串行化**：`attach` 和 `forceReload` 排进同一条 Promise 队列，依次执行。这样可以消除并发 attach 互相 abort 的问题（替代了旧的 `isAttaching` / `isReloading` 双锁方案加 5s 等待循环）。
- **错误提示分工**：attach 阶段失败时由本 Hook `throw`，交给调用方捕获；播放阶段失败则由本 Hook 监听 `video error`，经 `options.onPlaybackError` 上报。之所以分开处理，是因为回退方案是否可用只有引擎层才知道。

引擎内部实现（MPD 构建、缓冲模式、代理路由决策）见[视频源与 API 获取逻辑](/advanced/video-pipeline)；引擎注册步骤见[二次开发指南](/dev/guide#新增一个播放引擎)。

相关页面：[运行流程](/dev/runtime)（后端启动顺序与五条主要链路的执行过程）
