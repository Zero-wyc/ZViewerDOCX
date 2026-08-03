---
title: 屏幕共享与推流
description: WebRTC 屏幕共享与 OBS RTMP 推流
---

# 屏幕共享与推流

房间支持两种共享方式（`Room.mode`）：

- **watch-together**（一起看）：播放视频，房主控制进度。
- **screen-share**（屏幕共享）：分享端共享屏幕或视频画面。

分享方法（`shareMethod`）：

- **webrtc**：基于 WebRTC 的屏幕共享。
- **stream-push**：OBS RTMP 推流。

## WebRTC 屏幕共享

- 分享端可共享**屏幕**或**视频画面**。
- 通过信令事件建立点对点连接：`signal-offer` / `signal-answer` / `signal-ice-candidate`。
- 观众端直接观看分享画面。

### 前提条件

- **HTTPS** 环境（`getUserMedia` 限制）。
- 严格 NAT 之后可能需要部署 TURN 服务器（如 coturn）。

## OBS 推流（stream-push）

房间可切换为推流模式，配合 Node Media Server（NMS）提供直播流：

| 端口 | 用途 |
| --- | --- |
| 3334 | RTMP 推流（OBS） |
| 3335 | HTTP-FLV 拉流（播放） |

### 推流步骤

1. 房间内切换共享方式为「OBS 推流」。
2. 获取房间的推流地址与流密钥：
   - 房间界面展示 `rtmp://<host>:3334/live` + 房间专属 `streamKey`；或
   - 下载 OBS 场景配置：`GET /api/stream-push/obs-config/:roomId`（可直接导入 OBS）。
3. 在 OBS 中设置服务器与流密钥，开始推流。
4. 观众通过 HTTP-FLV 拉流观看（`/live/<streamKey>`），播放器实时展示直播状态（`stream-status` 事件，live/offline）。

### 说明

- 流名 `/live/<streamKey>` 由业务层校验，防止未授权推流。
- 推流媒体切片保存在 `config/media/`。
- 推流可用性可通过 `query-stream-push-availability` 查询。

## 相关事件

| 事件 | 说明 |
| --- | --- |
| `update-share-method` | 切换共享方式 |
| `signal-offer` / `signal-answer` / `signal-ice-candidate` | WebRTC 信令 |
| `stream-status` | 推流状态（live / offline） |
| `share-method-changed` | 共享方式已变更广播 |

完整事件表见 [后端文档](/development/backend)。
