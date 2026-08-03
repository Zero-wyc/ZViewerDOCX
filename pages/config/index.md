---
title: 配置参考
description: 环境变量、端口、数据目录与数据库配置说明
---

# 配置参考

本章为 ZViewer 的配置项参考，面向部署与维护人员。

| 章节 | 内容 |
| --- | --- |
| [环境变量](/config/environment) | 后端与前端构建的全部环境变量 |
| [端口说明](/config/ports) | 各服务端口与访问方式 |
| [数据目录与数据库](/config/data) | config/ 结构、数据表、迁移与备份 |

## 快速指引

- **修改端口**：后端 `PORT`、推流 `RTMP_PORT` / `HTTP_FLV_PORT`（见 [环境变量](/config/environment)）。
- **数据迁移 / 升级**：保留 `config/` 目录即可（见 [数据目录与数据库](/config/data)）。
- **公网部署**：放行对应端口并配置 HTTPS（见 [HTTPS 与证书](/guide/https)）。
