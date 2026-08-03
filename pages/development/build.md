---
title: 构建与发布
description: 本地开发、单文件 exe 打包、CI 发布流程
---

# 构建与发布

## 本地开发

项目使用 npm workspaces，根目录统一安装依赖。

```bash
# 安装全部依赖
npm install

# 同时启动前后端开发服务
npm run dev

# 或分别启动
npm run dev:backend
npm run dev:frontend
```

开发端口：

- 前端：`http://localhost:5174`
- 后端：`http://localhost:3333`

前端开发时默认通过 Vite 代理连接后端，无需额外配置 `VITE_API_URL`。

## 构建脚本

| 脚本 | 说明 |
| --- | --- |
| `build-all.js` | 一键编译（交互菜单 / `--win` / `--linux` / `--all` / `--skip-build`）：tsc → vite → pkg 打包 → 原生模块复制 → 压缩，产物进 `dist/` |
| `scripts/build-exe.js` | 后端 pkg 打包为 `dist/zviewer-backend.exe`（@yao-pkg/pkg，node22-win-x64，`--public`） |
| `scripts/build-frontend-exe.js` | 前端静态服务打包为 `zviewer-frontend.exe` |
| `scripts/generate-cert.js` | 证书签发工具（`zviewer-cert`：localhost/IP 自签 + 域名走内置 ACME 申请 Let's Encrypt） |

> `build-all.bat` 是 Windows 下的批处理入口；`prepare-cli-build.ps1` 用于准备 CLI 构建。

## 单文件 exe 构成

| 平台 | 压缩包 | 内容 |
| --- | --- | --- |
| Windows | `zviewer-windows-x64.zip` | `zviewer-backend.exe` + `zviewer-frontend.exe` + `zviewer-cert.exe` + `start.bat` |
| Linux | `zviewer-linux-x64.tar.gz` | `zviewer-backend` + `zviewer-frontend` + `zviewer-cert` + `start.sh` |

- sql.js wasm 通过根 `package.json` 的 `pkg.assets` 打进快照。
- exe 运行时 `PROJECT_ROOT = process.cwd()`，数据仍在 `config/`。
- 前端静态服务（`frontend-server/server.js`）零外部依赖，含 `/api`、`/socket.io`、`/live` 反向代理。

## 启动脚本模板

- `packaging/start-win.ps1` / `start-linux.sh`：单文件版服务管理（启动/停止/状态/日志/证书）。
- `start-prod.ps1` / `.bat` / `.sh`：源码版服务管理（额外支持 `build`）。
- 两者功能一致，提供交互菜单与命令行两种模式（见 [快速开始](/guide/quickstart)）。

## GitHub Actions（CI/CD）

`.github/workflows/build.yml` 在 push 到 `main` 或打 tag（`v*`）时自动：

1. 构建 Linux 单文件版 → artifact + 推送 Docker Hub（`zerowyc0721/zviewer`）。
2. 构建 Windows 单文件版 → artifact。
3. 打 tag 时创建 GitHub Release（含两个平台压缩包）。

### 版本号注入

| 触发方式 | 版本号 | 示例 |
| --- | --- | --- |
| 推送 tag `v1.0.0` | 正式版 | `1.0.0` |
| 推送 `main` 分支 | 开发版（预发布） | `0.0.0-dev.a1b2c3d` |
| 手动触发 | 手动构建 | `0.0.0-manual` |

## 发布检查清单

1. `npm run build` 全量构建通过。
2. `build-all.js --all` 产出双平台压缩包并验证可运行。
3. push tag `v1.0.0` 触发 CI，确认 Release 与 Docker 镜像发布成功。
4. 验证 `start.bat start` / `./start.sh start` 单文件版可正常启动。
