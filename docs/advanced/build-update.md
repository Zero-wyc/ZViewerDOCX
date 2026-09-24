# 构建与更新机制

## 构建

`build-all.js` 将前后端编译为平台单文件（esbuild 打包 + 资源内联）：后端打包成可执行二进制（含 wasm sql.js、内嵌 NCM 服务依赖），前端静态资源随后端分发，运行时由同一个进程同时提供 HTTP、WebSocket 与静态托管。

| 平台 | 产物 |
|---|---|
| Linux | `zviewer-backend`、`zviewer-cert`、`start.sh` → `zviewer-linux-x64.tar.gz` |
| Windows | `zviewer-backend.exe`、`zviewer-cert.exe`、`start.bat` → `zviewer-windows-x64.zip` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像） |

`zviewer-cert` 是配套的证书工具（自签 HTTPS 证书生成/安装），见基础教程的 HTTPS 章节。

## CI（GitHub Actions）

| 触发 | 版本号 | 产物 |
|---|---|---|
| push `main` | `0.0.0-dev.<sha>`（预发布） | 双平台 artifact + Docker Hub |
| tag `v*` | 正式版 | GitHub Release（双平台压缩包 + Docker） |
| 手动触发 | `0.0.0-manual` | artifact |

## 自动更新

1. 后端定期调 GitHub Releases API 检查新版本（管理后台可关预发布接收）。
2. 检测到新版 → 下载（带进度与阶段提示，支持 CDN 加速）→ 校验。
3. 替换程序文件后在容器 / 进程内直接重启后端，**不重启整个容器**。保留 `--restart unless-stopped` 应对异常退出。
4. `config/` 目录（数据库、证书、上传、切片、JWT 密钥文件）更新全程不覆盖——备份这一个目录即可完整迁移实例。
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

校验命令（改动后建议跑一遍）：

```bash
cd frontend && npx tsc --noEmit      # 类型检查
cd frontend && npx eslint <改动文件>  # 改动文件 0 错 0 警
```

## 项目结构

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

CLI 客户端在独立仓库 [ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)（Go），协议见 [ZViewerCLI 代理协议](/advanced/cli-protocol)。
