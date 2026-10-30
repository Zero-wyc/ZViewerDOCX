# 构建与更新机制

编译打包、CI 发布与自动更新，末尾附本地开发命令与目录结构。

## 构建

后端是 Go 程序（`backend-go/`），前端是 Vite 打包的 SPA，两者分别编译，产物放在同一目录：前端静态资源由后端进程托管，语音所需的 livekit-server 作为伴生文件随包分发。

```bash
npm run build           # 后端 → dist/zviewer-backend(.exe)，前端 → dist/
npm run build:backend   # 只编后端
npm run build:frontend  # 只编前端
npm run build:all       # 交互式选平台，产出 dist/win 或 dist/linux
```

| 平台 | 产物 |
| --- | --- |
| Linux | `zviewer-backend`、`livekit-server`、`start.sh` → `zviewer-linux-x64.tar.gz` |
| Windows | `zviewer-backend.exe`、`livekit-server.exe`、`start.bat` → `zviewer-windows-x64.zip` |
| Windows 桌面版 | `ZViewerDesktop.exe`（带托盘与进程托管）→ `zviewer-windows-x64-GUI.zip` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像，内嵌 LiveKit） |

证书签发是后端的一个子命令（`zviewer-backend --gen-cert <host>`），不再单独出二进制；`start.bat` / `start.sh` 的菜单 7、8 就是调它。

## CI（GitHub Actions）

`build.yml` 不随 `main` 自动构建，只认手动触发与 tag：填了版本号才出正式版，留空只出测试包。

| 触发 | 版本号 | 产物 |
| --- | --- | --- |
| 手动触发（填 `vX.Y.Z`） | 正式版 | 建 tag + GitHub Release + 更新产物仓库 + 同步 GitCode |
| tag `v*` | 正式版 | 同上 |
| 手动触发（留空） | `latest` 预发布 | GitHub 预发布 + Docker `dev` |

正式版的发布链路：

```
prepare → build / build-gui → release（GitHub Release）
                            → publish-branch（产物仓库 main：GitHub + GitCode）
                            → sync-gitcode（代码与 tag → GitCode 主仓库）
```

- **产物仓库** `ZviewerRelease`：三个包 + `latest.json` + `README.md`，每次发版用孤儿提交整体替换 `main`，旧包随旧提交消失。
- **GitCode**：产物仓库与主仓库各推一次；GitCode 没有「立即同步」接口，不推就停在旧版本。
- **桌面组件**（cloudflared、EasyTier）不随包，放在 `ZviewerRelease` 的 `components` 分支，客户端首次用到时下载。

补发历史产物不必重新构建：`Actions → 补发产物仓库` 填原 `run_id` + `tag` + `version`。

## 自动更新

1. 后端定期检查新版本：默认读 GitCode 镜像上的 `latest.json`（国内直连），也可关掉镜像改走 GitHub Releases。
2. 检测到新版本后下载（带进度与阶段提示）并校验。
3. 替换程序文件后重启后端进程，**不重启容器**；`--restart unless-stopped` 只用于应对异常退出。
4. `config/`（数据库、证书、上传）全程不覆盖，备份这一个目录即可完整迁移。
5. 也可在管理后台上传压缩包手动更新；解压走内置实现，不依赖系统 `unzip`。

镜像源不可用时不会自动换回 GitHub——配置成什么就用什么，失败直接报错，避免两套清单互相打架。桌面端由 GUI 自己检查更新，网页端在托管模式下不提供更新入口。

## 本地开发

Node.js 22+、Go 1.26+，依赖统一在根目录安装。

```bash
npm install
cp .env.example .env   # 按需改端口与密钥
npm run db:init        # 建表并打印初始管理员 root / root
npm run dev            # 前端 5174 / 后端 3333
```

Vite 会把 `/api`、`/socket.io`、`/live` 代理到后端，无需配置 `VITE_API_URL`。提交前：

```bash
npm run lint:go                    # gofmt -l + go vet
npm run test:go                    # go test ./...
cd frontend && npx tsc --noEmit    # 类型检查
```

## 项目结构

```
ZViewer/
├── backend-go/            # Go 后端（模块 zviewer/backend）
│   ├── cmd/zviewer-server # 入口：HTTP、--init-db、--gen-cert
│   └── internal/
│       ├── api/           # REST 路由
│       ├── <域>/          # room / bilibili / music / ncm / livekit / nms / emby …
│       ├── realtime/      # Socket.IO 协议与事件广播
│       ├── store/         # SQL 读写
│       └── db/            # 打开、结构校验、索引、备份
├── frontend/              # React SPA（Vite + Tailwind + Zustand）
│   └── src/
│       ├── pages/         # 页面
│       ├── components/    # 通用 UI
│       ├── modules/       # 房间 / 同步播放 / 音乐 / 弹幕 / 字幕
│       └── store/         # Zustand 状态
├── desktop/               # Windows 桌面壳（Go + Wails）
├── packaging/             # 启动脚本模板
├── docker/                # 容器入口脚本
└── scripts/               # 开发与编译脚本
```

CLI 客户端在独立仓库 [ZViewer CLI](https://github.com/Zero-wyc/ZViewerCLI)（Go），协议见 [CLI 代理协议](/advanced/cli-protocol)。
