---
title: 更新管理
description: 自动更新、预发布控制与手动上传更新
---

# 更新管理

系统更新功能（`/api/system/update`，**仅 root**）支持从 GitHub Releases 自动检测并应用更新，或手动上传官方压缩包。

## 更新方式

| 方式 | 接口 | 说明 |
| --- | --- | --- |
| 检查更新 | `GET /api/system/update/check` | 检测 GitHub Releases 最新版本 |
| 应用更新 | `POST /api/system/update/apply` | 自动下载并应用更新 |
| 手动上传 | `POST /api/system/update/upload` | 上传官方压缩包（Linux / Windows 单文件版） |

## 预发布版控制

- `main` 分支自动构建的版本为**预发布版**（如 `0.0.0-dev.a1b2c3d`）。
- 管理员可在管理后台开关**是否接收预发布版更新**。
- 正式版（tag `v*` 构建）始终可接收。

## 版本号规则

| 触发方式 | 版本号 | 示例 |
| --- | --- | --- |
| 推送 tag `v1.0.0` | 正式版 | `1.0.0` |
| 推送 `main` 分支 | 开发版（预发布） | `0.0.0-dev.a1b2c3d` |
| 手动触发 | 手动构建 | `0.0.0-manual` |

## 更新建议

1. 更新前**备份 `config/` 目录**（数据库、证书、上传文件）。
2. 检查更新后确认版本号与来源（正式版 / 预发布）。
3. 应用更新后通过 `status` 命令确认服务恢复。

详见 [升级与更新](/guide/upgrade)。
