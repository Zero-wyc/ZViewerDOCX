---
title: 简介
description: ZViewer 是什么，以及本 wiki 的组织方式
---

# ZViewer 简介

> 多人同步观影、追番与远程共享平台。

ZViewer 让一群人在不同地点也能像坐在一起一样看番、看电影。**房主控制播放进度，观众实时跟随**；支持 Bilibili、WebDAV、FTP、OpenList、MP4 直链等多种视频源，并内置屏幕共享、弹幕、评论、语音聊天等互动能力。

## 核心特性

### 一起看房间

- 创建或加入房间，与好友同步观看。
- 房主拥有播放控制权：播放、暂停、跳转、倍速；观众可申请控制，房主确认后执行。
- **播放记忆**：房主短暂断线后，由服务器继续广播当前状态，观众无需中断观看。
- 房主离线超时自动关房（10 分钟），期间观众可自由控制。

### 多源视频解析

| 来源 | 说明 |
| --- | --- |
| **Bilibili** | 解析 BV 号或视频链接，支持 DASH 音视频合并、清晰度切换、大会员凭证 |
| **MP4 直链** | 直接播放可访问的 MP4 视频地址 |
| **WebDAV** | 挂载 WebDAV 服务器，浏览并播放其中的视频文件 |
| **FTP** | 挂载 FTP 服务器，浏览并播放其中的视频文件 |
| **OpenList** | 挂载 OpenList 服务，浏览并播放其中的视频文件 |

### 实时互动

- 评论面板与弹幕系统：支持 Bilibili 官方弹幕、DandanPlay 弹幕、自定义弹幕轨道。
- 播放状态同步：房主操作实时同步给所有观众。
- 观众申请：观众可申请跳转进度或暂停，房主在播放器左上角查看通知。
- 语音聊天：房主可配置语音比特率（32/96/128/192 kbps），观众实时收听。

### 屏幕共享与推流

- 基于 WebRTC 的屏幕共享，分享端可共享屏幕或视频画面。
- OBS RTMP 推流支持，配合 Node Media Server 提供 HTTP-FLV 拉流。

### 主题系统

- Material You (Monet) 动态主题，从壁纸提取色彩生成完整色板。
- 明暗主题切换、自定义背景、玻璃拟态 UI、精简动画模式。

## 技术栈

- **后端**：Express + TypeScript + TypeORM + sql.js（wasm 版 SQLite，纯 JS 无原生依赖）
- **前端**：React + Vite + Tailwind CSS + Zustand
- **实时通信**：Socket.IO；屏幕共享/语音基于 WebRTC
- **部署**：单文件 exe（pkg 打包） / 源码脚本 / Docker

## 本 wiki 导航

| 栏目 | 内容 |
| --- | --- |
| [指南](/guide/) | 快速开始、部署、HTTPS 证书、升级更新、常见问题 |
| [使用](/usage/) | 房间、视频源、互动、屏幕共享与推流、ZViewerCLI 代理 |
| [管理](/admin/) | 用户与权限、系统设置、挂载点、服务器文件、更新管理 |
| [配置](/config/) | 环境变量、端口、数据目录与数据库 |
| [开发](/development/) | 架构总览、后端、前端、API 参考、构建与发布 |

## 相关项目

- [ZViewer](https://github.com/Zero-wyc/ZViewer) —— 主仓库（GPL-3.0 License）
- [ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI) —— 可选本地代理客户端，解锁 Bilibili 大会员画质

如果还没有开始，请从 [快速开始](/guide/quickstart) 出发。
