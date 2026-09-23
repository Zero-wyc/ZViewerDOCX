# 构建与更新机制

## 构建

`build-all.js` 将前后端编译为平台单文件（esbuild 打包 + 资源内联）：

| 平台 | 产物 |
|---|---|
| Linux | `zviewer-backend`、`zviewer-cert`、`start.sh` → `zviewer-linux-x64.tar.gz` |
| Windows | `zviewer-backend.exe`、`zviewer-cert.exe`、`start.bat` → `zviewer-windows-x64.zip` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像） |

## CI（GitHub Actions）

| 触发 | 版本号 | 产物 |
|---|---|---|
| push `main` | `0.0.0-dev.<sha>`（预发布） | 双平台 artifact + Docker Hub |
| tag `v*` | 正式版 | GitHub Release（双平台压缩包 + Docker） |
| 手动触发 | `0.0.0-manual` | artifact |

## 自动更新

1. 后端定期调 GitHub Releases API 检查新版本（管理后台可关预发布接收）。
2. 检测到新版 → 下载（带进度条与阶段提示，支持 CDN 加速）→ 校验。
3. 替换程序文件后在容器 / 进程内直接重启后端，**不重启整个容器**。保留 `--restart unless-stopped` 应对异常退出。
4. `config/` 目录（数据库、证书、上传、切片）更新全程不覆盖。
5. 也支持管理后台上传压缩包手动更新。

## 本地开发

npm workspaces，根目录统一装依赖：

```bash
npm install
npm run dev            # 前后端同时启动
npm run dev:backend    # 仅后端（3333，热重载）
npm run dev:frontend   # 仅前端（5174，HMR）
```

前端经 Vite 代理转发 `/api`、`/socket.io`、`/live` 到后端，无需配置 `VITE_API_URL`。

## 项目结构

```
ZViewer/
├── backend/          # Express 后端（TypeScript + TypeORM + sql.js）
│   └── src/
│       ├── routes/          # REST API 路由
│       ├── services/        # B站解析、代理、证书、更新
│       ├── modules/         # 房间、观众、同步、音乐、CLI
│       ├── entities/        # TypeORM 实体
│       └── middleware/      # 鉴权中间件
├── frontend/         # React 前端（Vite + Tailwind + Zustand）
│   └── src/
│       ├── pages/           # 页面
│       ├── components/      # 通用 UI
│       ├── modules/         # 音乐 / 房间 / 一起看等功能模块
│       └── store/           # Zustand 状态
├── packaging/        # 启动脚本模板
├── docker/           # Docker 入口脚本
└── build-all.js      # 单文件编译脚本
```

CLI 客户端在独立仓库 [ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)（Go）。
