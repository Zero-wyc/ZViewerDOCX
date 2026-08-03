# 屏幕共享与推流

ZViewer 提供两条推流路径：

## WebRTC 屏幕共享

- 基于 WebRTC 的屏幕共享，分享端可共享屏幕或视频画面。
- 观众通过房间内 P2P / TURN 中继观看。
- 要求 HTTPS 访问（`getUserMedia` 限制）。

## OBS RTMP 推流

配合 Node Media Server（NMS）提供直播能力：

| 端口 | 用途 |
|---|---|
| 3334 | RTMP 推流（OBS 推流地址 `rtmp://localhost:3334/live`） |
| 3335 | HTTP-FLV 拉流（直播流播放） |

工作流程：

1. 房主在房间内选择 OBS 推流模式（`stream-push`），生成流密钥（`stream-key`）。
2. 下载 OBS 场景集合配置文件（`/api/stream-push/obs-config/:roomId`），内含 RTMP 地址与流密钥，一键导入 OBS。
3. OBS 推流到 NMS，观众通过 HTTP-FLV 播放。

相关后端模块：

- `stream-push/nms.service`：Node-Media-Server 生命周期管理（RTMP 3334 / HTTP-FLV 3335）
- `stream-push/stream-push.handler`：`update-share-method` 等 Socket 事件
- `stream-push/router`：OBS 配置下载接口
- `stream-push/stream-key.util`：流密钥生成

## 生产环境注意

- HTTP-FLV 端口（3335）生产环境不建议直接暴露，建议经 Nginx 反向代理 `/live` 路径（配合 `VITE_FLV_BASE_URL` 留空使用同源地址）。
- 严格 NAT 环境下 WebRTC 可能需要部署 TURN 服务器（如 coturn）。
