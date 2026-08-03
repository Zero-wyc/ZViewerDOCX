---
title: 服务器文件与下载
description: 服务器本机目录管理、上传与 Bilibili 视频下载
---

# 服务器文件与下载

服务器文件功能（`/api/server-files`，**仅 root**）允许管理员将服务器本机目录注册为视频源，并支持上传、下载 Bilibili 视频等操作。

## 目录根（ServerFolder）

管理员可配置一个或多个服务器本机目录作为根：

| 操作 | 接口 | 说明 |
| --- | --- | --- |
| 根目录 CRUD | `POST/GET/PUT/DELETE /api/server-files/roots` | 注册/查看/更新/删除根目录 |
| 浏览目录 | `GET /api/server-files/browse` | 列出目录内容 |
| 浏览系统目录 | `GET /api/server-files/browse-system` | 浏览服务器任意目录（选择根时用） |

## 文件操作

| 操作 | 接口 | 说明 |
| --- | --- | --- |
| 上传文件 | `POST /api/server-files/upload` | 上传到服务器，上限 **10GB** |
| 新建文件夹 | `POST /api/server-files/folder` | 在服务器创建文件夹 |
| 重命名 | `POST /api/server-files/rename` | 重命名文件/文件夹 |
| 删除文件 | `DELETE /api/server-files/file` | 删除文件 |
| 解析视频 | `GET /api/server-files/resolve` | 解析为可播放地址 |
| 代理播放 | `GET /api/server-files/proxy` | 代理媒体流，支持 Range |

## Bilibili 视频下载

`GET /api/server-files/bilibili-download` —— 在服务器直接下载 Bilibili 视频（音视频合并需要 ffmpeg）。

### ffmpeg 管理

| 操作 | 接口 | 说明 |
| --- | --- | --- |
| 查看状态 | `GET /api/server-files/ffmpeg-status` | 检测服务器 ffmpeg 是否可用 |
| 安装 | `GET /api/server-files/ffmpeg-install` | 自动下载安装 ffmpeg |

## 使用场景

- 将服务器磁盘中的视频目录注册为根，房间内直接播放。
- 使用「Bilibili 下载」将番剧保存到服务器，供全房间随时点播。
- 配合上传功能，将本地视频上传后作为视频源。

## 安全提示

- 本功能仅 `root` 可访问，请勿向他人泄露管理员权限。
- 上传上限 10GB，注意服务器磁盘空间。
