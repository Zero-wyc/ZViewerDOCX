# 二次开发指南

本页给出新增代码时的标准动作与踩坑清单。前置阅读：[整体分层设计](/dev/#整体分层设计)、[后端架构](/dev/backend)、[前端架构](/dev/frontend)。

---

## 新增一个 Socket 事件处理器

1. 在对应模块下建 `handlers/xxx.handler.ts`，实现 `SocketEventHandler`：

```ts
import { type SocketEventHandler, type AckCallback, safeAck } from '../../socket';
import type { Server as SocketIOServer, Socket } from 'socket.io';

export class XxxHandler implements SocketEventHandler {
  readonly name = 'xxx';
  register(socket: Socket, io: SocketIOServer): void {
    socket.on('xxx-event', async (payload: XxxPayload, callback?: AckCallback) => {
      try {
        // 1. 权限校验（复用 roomPermissionService）
        // 2. 调 Service 落库 / 更新内存
        // 3. io.to(roomId).emit(...) / socket.to(roomId).emit(...)
        safeAck(callback, { success: true, data: { … } });
      } catch (err) {
        console.error('[xxx] error:', err);
        safeAck(callback, { success: false, message: '操作失败' });
      }
    });
  }
}
```

2. 在模块 `index.ts` 中导出。
3. 在 `backend/src/index.ts` 的 `socketRegistry.add(...)` 链上追加一行。
4. 前端在 `modules/sync-playback/constants.ts` 的 `SOCKET_EVENT` 中登记事件名（若属于同步协议），否则在对应模块内定义常量。

**不需要**改动 `io.on('connection')`、不需要新增注册点——这正是 `SocketRegistry` 的设计目的。

---

## 新增一个 REST 接口

1. 判断归属：跨域通用能力放 `routes/`，领域内能力放 `modules/<domain>/<domain>.routes.ts`。
2. 鉴权：全局挂 `router.use(authenticateToken)`；管理端点加 `adminOnly` / `requireRoot`。
3. 逻辑：**不在路由里写重逻辑**，下沉到 Service。
4. 若改动了会被其他端感知的数据，调用对应的 Broadcaster（如 `movieBroadcasterService.broadcastMovieList`）。
5. 响应格式：成功 `{ success: true, data? / <具名字段> }`，失败 `{ success: false, message }`；流式接口用 NDJSON（参考 `routes/stream/resolve.ts` 的 `NdjsonWriter`）。

---

## 新增一个播放引擎

1. 在 `frontend/src/modules/player/engines/` 下实现 `PlayerEngine`：

```ts
export const myEngine: PlayerEngine = {
  type: 'xxx' as EngineType,
  async attach(video, source) {
    resetVideoElement(video);
    // …设置 src / 挂 MediaSource…
    return { cleanup: () => { /* 释放实例 / revokeObjectURL */ } };
  },
};
```

2. 在 `types.ts` 的 `EngineType` 联合类型中登记。
3. 在 `engine-selector.ts` 的 `ENGINES` 表中注册，并在 `selectEngine()` 中给出选择条件（顺序有意义）。
4. 若引擎需要对外暴露 seek 能力，实现 `PlayerController` 接口并在 `attach` 结果的 `player` 字段返回。
5. 在 `player/index.ts` 视需要导出；更新[视频源与 API 获取逻辑](/advanced/video-pipeline)的引擎选择表。

---

## 新增前端功能模块

```
modules/<feature>/
├── api.ts         # REST 调用（统一走 @/lib/api 的 apiFetch）
├── types.ts       # 类型
├── components/    # UI（只渲染，不直接发请求）
├── hooks/         # 业务编排
└── index.ts        # 公共 API 出口
```

状态优先放 `store/`，或用模块内 hook 局部持有；跨模块共享的状态才上升到 store。

---

## 常见陷阱

| 陷阱 | 表现 | 规避 |
|---|---|---|
| **破坏依赖方向** | 从子模块 import 根 `index.ts` → 循环依赖、启动报 `undefined` | 共享 Service 下沉到 `services/`（`system-settings.ts` 就是这么抽出来的）；必须引时用动态 `import()` |
| **广播与持久化时序搞反** | 观众看到状态回跳 / seek 后暂停抖动 | `state` 先持久化后广播，`control` 先广播后持久化（见[运行流程 · 链路三](/dev/runtime)） |
| **删除顺序不当** | SQLite 抛 `FOREIGN KEY constraint failed` | `PlaybackState` 必须先于 `Room` 删除（`deleteRoomAndRelations` 注释） |
| **只断连不广播** | 房间已删但服务器仍在代理流量 | 关房一律先 `emit('room-closed')` 再 `disconnect` |
| **本地改 state** | 多端列表不一致 | 写操作后等广播刷新（`roomStore` 约定） |
| **依赖 isHostOnline 的旧 socket id** | 后端重启后服务器心跳永不接管 | 必须走 `playbackMemoryService.setIo(io)` + 双条件判定 |
| **新增 handler 忘了注册** | 事件静默无响应 | 检查 `socketRegistry.add(...)` 链 |
| **dev 下新增依赖触发 worker 404** | `Playback worker crashed` | 需要独立 worker 的包加入 `optimizeDeps.exclude` |

---

## 调试手段

- **前端**：`window.__debugSocket` 暴露全局 socket 实例；`localStorage.zviewer-media-debug = '1'` 启用媒体探针（`__mediaDump()` 导出）。
- **日志**：前端 console 与未捕获异常自动上报到后端 `log/frontend-console.log`（`initClientLogger`）；后端对 `/api/` 请求打印 `[req] METHOD STATUS SIZE ELAPSEDms PATH`，可直接区分代理流量与解析流量。
- **健康检查**：`GET /health` 返回 `startedAt` / `restartCount`，前端 `useBackendHealth` 据此提示后端自动重启。
- **数据库**：`config/dev.sqlite` 是标准 SQLite 文件，可用任意 SQLite 工具直接打开查看。

---

## 延伸阅读

- [架构总览](/advanced/) — 进程模型、端口、状态分层、设计要点
- [房间同步逻辑](/advanced/sync) — 事件清单、房主同步模型、观众对齐算法、控制权申请
- [视频源与 API 获取逻辑](/advanced/video-pipeline) — B站解析链、代理层、播放引擎、字幕与弹幕
- [一起听音乐管线](/advanced/music-pipeline) — NCM 内嵌服务、音质降级链、队列模型
- [ZViewerCLI 代理协议](/advanced/cli-protocol) — 全局注册、归属过滤、代理链路
- [主题系统实现](/advanced/theme-system) — Monet 色板、对比度算法、玻璃拟态变量
- [HTTPS 证书](/advanced/https) — 签发方式选择、ACME 流程、后端 HTTPS 启用
- [鉴权与权限模型](/advanced/auth) — JWT 双 token、角色叠加、登录态边界
- [REST API 参考](/advanced/api) / [环境变量](/advanced/env) / [构建与更新机制](/advanced/build-update)
