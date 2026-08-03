---
title: 系统设置
description: 注册模式、房间创建模式、番剧源配置与 Beta 开关
---

# 系统设置

管理后台「设置」标签页（`GET/PUT /api/admin/settings`，仅 root）提供以下配置：

## 注册模式

| 模式 | 说明 |
| --- | --- |
| `open` | 开放注册，任何人可注册 |
| `approval` | 注册后需 `root` 审核通过（默认） |
| `closed` | 关闭注册 |

## 房间创建模式

| 模式 | 说明 |
| --- | --- |
| `admin-only` | 仅 `root` / `admin` 可创建房间 |
| `all-users` | 所有用户均可创建房间 |

## 自动清理闲置房间

开启后系统自动清理长时间无活动的房间，避免资源占用。后端提供 `POST /api/admin/rooms/cleanup-unused` 手动清理接口。

## 番剧源配置（dataSourceConfig）

配置番剧聚合源的启用状态与数据源：

| 源 | 说明 |
| --- | --- |
| `anime` | 内置番剧聚合源（Bilibili Bangumi / RSS / 第三方） |
| `anisubs` | 订阅 JSON 源 |
| `kazumi` | Kazumi 规则源 |

配置保存在 `SystemSettings.dataSourceConfig`，前端在房间内通过「番剧」入口搜索播放。

## Beta 开关

控制实验性功能是否对普通用户开放。

## Bilibili 凭证

- 在房间内使用 **Bilibili 扫码登录**（`/api/stream/bilibili/qr` + 轮询）保存登录凭证（`BilibiliCredential`）。
- 凭证用于获取大会员清晰度与番剧资源。
- 也可通过 [ZViewerCLI 本地代理](/usage/zviewercli) 使用用户本地 Cookie 替代。

## 相关设置项一览

| 设置 | 存储 | 说明 |
| --- | --- | --- |
| 注册模式 | `SystemSettings` | open / approval / closed |
| 房间创建模式 | `SystemSettings` | admin-only / all-users |
| 自动清理闲置房间 | `SystemSettings` | 布尔开关 |
| 番剧源配置 | `SystemSettings.dataSourceConfig` | anime / anisubs / kazumi |
| Bilibili 凭证 | `BilibiliCredential` | 扫码登录保存 |
