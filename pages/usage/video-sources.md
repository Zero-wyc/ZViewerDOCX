---
title: 视频源
description: Bilibili、MP4 直链、WebDAV、FTP、OpenList 的使用方法
---

# 视频源

ZViewer 支持多种视频来源，可在房间内添加影片后统一播放。

## Bilibili

- 输入 **BV 号**或视频链接即可解析播放。
- 支持 **DASH 音视频合并**播放与清晰度切换（最高可达大会员画质，取决于凭证）。
- 支持 Bilibili 官方弹幕。
- 大会员专享内容需要：
  - 在管理后台/房间内使用 **Bilibili 扫码登录**配置凭证（见 [系统设置](/admin/settings)）；或
  - 使用 [ZViewerCLI 本地代理](/usage/zviewercli) 以本地 Cookie 获取高画质地址。

### 清晰度说明

- **DASH 模式**：音视频分离，支持 1080P+（大会员）等多档清晰度。
- **MP4 模式**：合并单文件，最高 **720P**（B 站限制）。

### 番剧与聚合源

- 支持解析番剧（Bangumi），可通过 [Anime 聚合源](/admin/settings)（anime / anisubs / kazumi）搜索并播放番剧源。
- 弹幕支持 Bilibili 官方、DandanPlay 等多个 provider（见 [实时互动](/usage/interaction)）。

## MP4 直链

直接输入可访问的 MP4 视频地址即可播放。支持两种方式：

- **直链播放**：浏览器直接访问视频 URL。
- **代理播放**：通过后端 `/api/stream/proxy` 代理，可注入 Referer/Origin/User-Agent 以绕过防盗链与 CORS。

## WebDAV / FTP / OpenList

这三类为「挂载式」视频源，需先在**挂载点管理**中保存连接配置（见 [挂载点管理](/admin/mounts)）：

| 来源 | 特点 |
| --- | --- |
| **WebDAV** | 通用 WebDAV 服务器，浏览并播放其中视频文件 |
| **FTP** | 支持 FTP / FTPS（`basic-ftp`），浏览并播放 |
| **OpenList** | 复用 WebDAV 客户端，自动补 `/dav` 端点 |

配置完成后，在房间内从挂载点浏览目录选择视频即可播放。播放时后端通过代理（支持 HTTP Range 断点续传）转发媒体流，避免 CORS 问题。

## 服务器文件

`root` 管理员可将服务器本机目录注册为视频源（`server-files`），支持浏览系统目录、上传文件、重命名与直连/代理播放，详见 [服务器文件与下载](/admin/server-files)。

## 快速对比

| 视频源 | 创建方式 | 画质上限 | 备注 |
| --- | --- | --- | --- |
| Bilibili | 输入 BV 号/链接 | 大会员画质（DASH） | 需凭证或 CLI 代理 |
| MP4 直链 | 输入 URL | 取决于源 | 可走代理防防盗链 |
| WebDAV | 挂载点配置 | 取决于源 | 目录浏览 |
| FTP | 挂载点配置 | 取决于源 | 目录浏览 |
| OpenList | 挂载点配置 | 取决于源 | 目录浏览 |
| 服务器文件 | root 配置根目录 | 取决于源 | 本机文件 |
