---
title: 实时互动
description: 弹幕、评论、画面标注与语音聊天
---

# 实时互动

## 评论

- 房间内的观众可发送文字评论，实时广播给所有人（`send-comment` → `new-comment`）。
- 历史评论可通过 `comment-history` 拉取。

## 弹幕

支持多条弹幕轨道：

| 来源 | 说明 |
| --- | --- |
| Bilibili 官方弹幕 | 通过后端解析对应视频的官方弹幕 |
| DandanPlay 弹幕 | 第三方弹幕源（`dandanplay` provider） |
| 自定义弹幕轨道 | 用户自建弹幕，可自定义样式与轨道 |

弹幕实时发送与同步（`send-danmaku` → `danmaku`），并支持样式配置（前端 `danmakuStore`）。

## 画面标注

- 房主/观众可在画面上进行**画笔标注**（`annotation-stroke`），所有人实时可见。
- 可一键清空标注（`clear-annotations`）。

## 语音聊天

- 基于 WebRTC 的语音聊天，观众可实时收听/发言。
- 房主可配置语音**比特率**：32 / 96 / 128 / 192 kbps（`voice-set-bitrate`，默认 32 kbps）。
- 语音通过信令事件建立连接：`voice-join` / `voice-leave`、`voice-offer` / `voice-answer` / `voice-ice-candidate`。

### 语音使用前提

- 需要 **HTTPS** 环境（`getUserMedia` 限制）。
- 浏览器需授权麦克风权限。

## 观众申请控制

- 观众可申请跳转进度或暂停（`seek-request` / `pause-request` 等）。
- 房主在播放器左上角收到通知，确认（`seek-response` / `pause-response`）后执行。

## 相关事件一览

| 类型 | 事件 |
| --- | --- |
| 评论 | `send-comment` / `comment-history` / `new-comment` |
| 弹幕 | `send-danmaku` / `danmaku` |
| 标注 | `annotation-stroke` / `clear-annotations` |
| 语音 | `voice-join` / `voice-leave` / `voice-set-bitrate` / `voice-offer` / `voice-answer` / `voice-ice-candidate` |

完整事件表见 [后端文档](/development/backend)。
