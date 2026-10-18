# 构建与更新机制

编译打包、CI 发布与自动更新的实现，末尾附本地开发命令与目录结构。

## 构建

由 `build-all.js` 完成：用 esbuild 打包（pkg 目标 node26）并把资源内联，后端打成单个可执行二进制（内含 wasm sql.js 与内嵌 NCM 服务依赖），前端静态资源随后端分发。构建时下载 LiveKit 伴生二进制随包分发。运行时同一进程提供 HTTP、WebSocket 与静态托管，并按需拉起 livekit-server 子进程。

| 平台 | 产物 |
|---|---|
| Linux | `zviewer-backend`、`zviewer-cert`、`livekit-server`、`start.sh` → `zviewer-linux-x64.tar.gz` |
| Windows | `zviewer-backend.exe`、`zviewer-cert.exe`、`livekit-server.exe`、`start.bat` → `zviewer-windows-x64.zip` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像，内嵌 LiveKit） |

`zviewer-cert` 是证书工具，详见 [HTTPS 证书](/advanced/https)。

## CI（GitHub Actions）

| 触发 | 版本号 | 产物 |
|---|---|---|
| push `main` | `0.0.0-dev.<sha>`（预发布） | 双平台 artifact + Docker Hub |
| tag `v*` | 正式版 | GitHub Release（双平台压缩包 + Docker） |
| 手动触发 | `0.0.0-manual` | artifact |

CI 下 LiveKit 下载失败会硬失败，保证产物都含完整语音能力。

## 自动更新

1. 后端定期调用 GitHub Releases API 检查新版本（管理后台可关闭预发布接收）。
2. 检测到新版本后下载（带进度与阶段提示，支持 CDN 加速）并校验。
3. 替换程序文件后重启后端进程，**不重启容器**；保留 `--restart unless-stopped` 应对异常退出。
4. `config/`（数据库、证书、上传、切片、JWT 密钥）全程不覆盖，备份这一个目录即可完整迁移。
5. 也可在管理后台上传压缩包手动更新。解压不依赖系统 unzip：Linux 分支用 adm-zip 纯 Node 实现（精简容器镜像里调用系统命令会失败）。

## 本地开发

项目使用 npm workspaces，依赖统一在根目录安装。

```bash
npm install
npm run dev            # 前后端同时启动
npm run dev:backend    # 仅后端（3333，热重载）
npm run dev:frontend   # 仅前端（5174，HMR）
```

Vite 会把 `/api`、`/socket.io`、`/live` 代理到后端，无需配置 `VITE_API_URL`。

提交前运行：

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
│       ├── modules/         # 音乐 / 房间 / 一起看 / 播放器 / 字幕 / 弹幕
│       ├── store/           # Zustand 状态（themeStore / authStore / roomStore …）
│       └── lib/             # Monet 派生、对比度、鉴权通道、MKV demux 等
├── packaging/        # 启动脚本模板
├── docker/           # Docker 入口脚本
└── build-all.js      # 单文件编译脚本
```

CLI 客户端在独立仓库 [ZViewer CLI](https://github.com/Zero-wyc/ZViewerCLI)（Go），协议见 [CLI 代理协议](/advanced/cli-protocol)。
