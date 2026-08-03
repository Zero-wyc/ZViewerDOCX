---
title: 升级与更新
description: 系统更新机制、预发布版控制与数据迁移
---

# 升级与更新

## 更新机制

系统支持两种更新方式，均需 `root` 权限，入口在管理后台：

1. **自动检测**：从 GitHub Releases 自动检测新版本并应用。
2. **手动上传**：上传官方压缩包（Linux / Windows 单文件版）更新。

管理员可在管理后台控制是否接收**预发布版**更新（由 `main` 分支自动构建的版本）。

### 更新接口

| 操作 | 接口 | 说明 |
| --- | --- | --- |
| 检查更新 | `GET /api/system/update/check` | 检测 GitHub Releases 最新版本 |
| 应用更新 | `POST /api/system/update/apply` | 下载并应用更新 |
| 上传更新 | `POST /api/system/update/upload` | 手动上传压缩包 |

仅 `root` 角色可访问，详见 [API 参考](/development/api)。

## 版本号规则

| 触发方式 | 版本号 | 示例 |
| --- | --- | --- |
| 推送 tag `v1.0.0` | 正式版 | `1.0.0` |
| 推送 `main` 分支 | 开发版（预发布） | `0.0.0-dev.a1b2c3d` |
| 手动触发 | 手动构建 | `0.0.0-manual` |

## 数据迁移

**升级只需保留 `config/` 目录**，其中包含数据库（`dev.sqlite`）、证书、上传文件与推流切片：

```
config/
├── dev.sqlite     # 数据库（标准 SQLite 格式）
├── ssl/           # SSL 证书
├── uploads/       # 用户上传文件（含头像）
└── media/         # NMS 推流媒体切片
```

源码版项目若存在旧版 `backend/dev.sqlite`，启动时会自动迁移到 `config/` 下（详见 [数据目录与数据库](/config/data)）。

## 源码版升级

```bash
# 拉取最新代码
git pull

# 重新安装依赖并构建（start-prod 脚本会自动完成）
./start-prod.sh build
./start-prod.sh start
```

或直接重新运行 `start-prod` 交互菜单中的「构建前后端」选项。

## 常见问题

- 更新失败或启动异常？建议先备份 `config/` 目录再升级。
- 更新后功能未生效？检查前后端版本是否一致（`status` 命令查看版本信息）。
