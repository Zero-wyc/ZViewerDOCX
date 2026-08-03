---
title: 数据目录与数据库
description: config/ 目录结构、数据库与数据迁移
---

# 数据目录与数据库

## config/ 目录结构

所有持久化数据统一存放在项目根目录的 `config/` 文件夹下（Docker 中为 `/app/config`）：

```
config/
├── dev.sqlite     # 数据库（标准 SQLite 格式）
├── ssl/           # SSL 证书（cert.pem / key.pem / acme-account.key）
├── uploads/       # 用户上传文件
│   └── avatars/   # 用户头像
└── media/         # NMS 推流媒体切片
```

> **升级只需保留 `config/` 目录**即可保留全部数据。

## 数据库

- 后端使用 **TypeORM + sql.js**（wasm 版 SQLite）持久化，纯 JS 实现、无原生模块。
- 单文件 exe 版可在任意平台直接运行，**无需编译原生依赖**。
- 数据库文件为**标准 SQLite 格式**（`config/dev.sqlite`），可用常规 SQLite 工具（如 DB Browser for SQLite）查看。
- `synchronize: true` 自动建表，升级后数据库结构自动同步。
- 也可通过 `DATABASE_URL` 切换到 **PostgreSQL**（见 [环境变量](/config/environment)）。

### 数据表（TypeORM 实体）

| 实体 | 表 | 说明 |
| --- | --- | --- |
| `User` | users | 用户（角色 root/admin/user/guest，状态 active/pending） |
| `Room` | rooms | 房间（模式、共享方式、streamKey） |
| `Session` | sessions | 会话（分享端/观看端） |
| `Movie` | movies | 影片（含 AES 加密的 password 字段） |
| `PlaybackState` | playback_states | 播放记忆（服务器推算播放进度） |
| `Comment` | comments | 评论 |
| `BilibiliCredential` | bilibili_credentials | Bilibili 登录凭证 |
| `UserMount` | user_mounts | 挂载点（webdav / ftp / openlist） |
| `SystemSettings` | system_settings | 系统设置 |
| `ServerFolder` | server_folders | 服务器文件根目录 |

## 旧版数据迁移

- 源码版旧版本数据位于 `backend/dev.sqlite`，启动时自动迁移到 `config/` 下（`backend/src/services/paths.ts` 处理）。
- 迁移后旧文件保留，确认数据无误后可手动删除。

## 备份建议

- 定期备份 `config/` 目录（或其中 `dev.sqlite`）。
- 更新系统前务必先备份（见 [升级与更新](/guide/upgrade)）。
