---
title: 使用指南
description: 房间、视频源、互动、屏幕共享与推流、ZViewerCLI 使用说明
---

# 使用指南

本章介绍 ZViewer 的日常使用方式，面向房主、观众与普通用户。

| 章节 | 内容 |
| --- | --- |
| [一起看房间](/usage/rooms) | 创建/加入房间、播放控制、观众申请、播放记忆与断线接管 |
| [视频源](/usage/video-sources) | Bilibili、MP4 直链、WebDAV、FTP、OpenList 的使用方法 |
| [实时互动](/usage/interaction) | 弹幕、评论、画面标注、语音聊天 |
| [屏幕共享与推流](/usage/screen-sharing) | WebRTC 屏幕共享、OBS RTMP 推流、HTTP-FLV 拉流 |
| [ZViewerCLI 本地代理](/usage/zviewercli) | 用本地 Cookie 解锁 Bilibili 大会员画质 |

## 角色速览

| 角色 | 主要能力 |
| --- | --- |
| `root` / `admin` | 可创建房间并拥有播放控制权，可管理后台 |
| `user` / `guest` | 加入房间观看、发送评论与弹幕，无法创建房间 |

> 新用户注册后角色为 `guest` 且状态为 `pending`，需管理员审核通过后方可正常使用（见 [用户与权限](/admin/users)）。
