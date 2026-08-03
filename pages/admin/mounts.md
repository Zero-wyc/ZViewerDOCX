---
title: 挂载点管理
description: WebDAV、FTP、OpenList 视频源的连接配置
---

# 挂载点管理

WebDAV / FTP / OpenList 三类视频源需要通过**挂载点**保存连接配置（`UserMount` 实体），配置后可在房间内浏览并播放其中的视频文件。

## 支持的挂载类型

| 类型 | 后端实现 | 特点 |
| --- | --- | --- |
| `webdav` | `services/webdav.ts` | 通用 WebDAV 服务器，基于 `webdav-client` 库 |
| `ftp` | `services/ftp.ts` | 支持 FTP / FTPS（`basic-ftp` 库） |
| `openlist` | `services/openlist.ts` | 复用 WebDAV 客户端，自动补 `/dav` 端点 |

## 挂载点管理

前端使用统一的挂载管理界面（`MountManager` / `MountBrowserBase` / `MountFormModal`），入口在房间内的挂载面板。

### 操作

| 操作 | 接口 | 说明 |
| --- | --- | --- |
| 列出挂载点 | `GET /api/{webdav\|ftp\|openlist}/mounts` | 当前用户的挂载点列表 |
| 新建挂载点 | `POST /api/{webdav\|ftp\|openlist}/mounts` | 保存连接配置 |
| 测试连接 | `POST /api/{webdav\|ftp\|openlist}/mounts/test` | 验证配置可用性 |
| 浏览目录 | `GET /api/{webdav\|ftp\|openlist}/mounts/:id/browse` | 列出目录内容 |
| 更新/删除 | `PUT / DELETE /api/{webdav\|ftp\|openlist}/mounts/:id` | 管理挂载点 |
| 解析视频 | `POST /api/{webdav\|ftp\|openlist}/resolve` | 解析媒体地址 |
| 代理播放 | `GET /api/{webdav\|ftp\|openlist}/proxy` | 代理媒体流（支持 Range 断点续传） |

## 在房间内使用

1. 打开房间内的挂载面板，选择挂载类型（WebDAV / FTP / OpenList）。
2. 新建或选择已有挂载点（可先「测试连接」）。
3. 浏览目录找到视频文件，点击添加为影片。
4. 播放时媒体流经后端代理转发，避免 CORS 与防盗链问题。

## 说明

- 挂载点按用户隔离（`UserMount` 关联用户）。
- FTP 支持加密模式（FTPS）；OpenList 需服务端开启 WebDAV 兼容端点。
- 媒体代理支持 HTTP Range（拖动进度条）与断点续传。
