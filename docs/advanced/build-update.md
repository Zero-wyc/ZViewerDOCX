# 构建与更新机制

本页说明 ZViewer 如何编译打包、CI 如何发布版本，以及程序怎样自动更新到新版本。末尾还附上本地开发命令与项目目录结构。

## 构建

构建由 `build-all.js` 完成，它把前后端编译成单个平台可执行文件。

`build-all.js` 使用 esbuild 打包并把资源内联：后端被打包成一个可执行二进制（内含 wasm sql.js 与内嵌的 NCM 服务依赖），前端静态资源随后端一起分发。运行时由同一个进程同时提供 HTTP、WebSocket 与静态托管。

各平台的产物如下。

| 平台 | 产物 |
|---|---|
| Linux | `zviewer-backend`、`zviewer-cert`、`start.sh` → `zviewer-linux-x64.tar.gz` |
| Windows | `zviewer-backend.exe`、`zviewer-cert.exe`、`start.bat` → `zviewer-windows-x64.zip` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像） |

`zviewer-cert` 是配套的证书工具（用于生成和安装自签 HTTPS 证书），详见 [HTTPS 证书](/advanced/https)。

## CI（GitHub Actions）

持续集成由 GitHub Actions 承担，不同的触发方式对应不同的版本号与产物。

| 触发 | 版本号 | 产物 |
|---|---|---|
| push `main` | `0.0.0-dev.<sha>`（预发布） | 双平台 artifact + Docker Hub |
| tag `v*` | 正式版 | GitHub Release（双平台压缩包 + Docker） |
| 手动触发 | `0.0.0-manual` | artifact |

## 自动更新

自动更新由后端处理，全程不需要重启整个容器。

1. 后端定期调用 GitHub Releases API 检查新版本（管理后台可以关闭预发布接收）。
2. 检测到新版本后，先下载（带进度与阶段提示，支持 CDN 加速），再校验。
3. 替换程序文件后，直接在容器或进程内重启后端，**不重启整个容器**。保留 `--restart unless-stopped` 以应对异常退出。
4. `config/` 目录（数据库、证书、上传、切片、JWT 密钥文件）在更新全程不会被覆盖——只要备份这一个目录，就能完整迁移实例。
5. 也可以在管理后台上传压缩包手动更新。

## 本地开发

项目使用 npm workspaces，依赖统一在根目录安装。

```bash
npm install
npm run dev            # 前后端同时启动
npm run dev:backend    # 仅后端（3333，热重载）
npm run dev:frontend   # 仅前端（5174，HMR）
```

前端通过 Vite 代理把 `/api`、`/socket.io`、`/live` 转发到后端，因此不需要配置 `VITE_API_URL`。

提交前请运行以下校验命令。

```bash
cd frontend && npx tsc --noEmit      # 类型检查
cd frontend && npx eslint <改动文件>  # 改动文件 0 错 0 警
```

## 项目结构

项目的目录结构如下。

```
ZViewer/
├── backend/          # Express 后端（TypeScript + TypeORM + sql.js）
│   └── src/
│       ├── routes/          # REST API 路由（auth / rooms / stream / music / admin …）
│       ├── services/        # B站解析与客户端、代理、挂载源、字幕、证书、更新
│       ├── modules/         # 房间 / 观众 / 影片 / 播放记忆 / 同步 / 音乐 / CLI / 推流
│       │   └── */handlers/  # Socket.IO 事件处理器（统一注册到 SocketRegistry）
│       ├── entities/        # TypeORM 实体（Room / Movie / PlaybackState / User …）
│       └── middleware/      # 鉴权（JWT、角色、限流）
├── frontend/         # React 前端（Vite + Tailwind + Zustand）
│   └── src/
│       ├── pages/           # 页面
│       ├── components/      # 通用 UI（Header / Layout / ThemeProvider …）
│       ├── modules/         # 音乐 / 房间 / 一起看 / 播放器 / 字幕 / 弹幕 等功能模块
│       ├── store/           # Zustand 状态（themeStore / authStore / roomStore …）
│       └── lib/             # Monet 派生、对比度、鉴权通道、MKV demux 等基础库
├── packaging/        # 启动脚本模板
├── docker/           # Docker 入口脚本
└── build-all.js      # 单文件编译脚本
```

CLI 客户端在独立仓库 [ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)（Go 编写），协议见 [ZViewerCLI 代理协议](/advanced/cli-protocol)。
