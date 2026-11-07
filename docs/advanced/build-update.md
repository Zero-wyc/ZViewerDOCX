# 构建与更新机制

编译打包、CI 发布与自动更新的实现，末尾附本地开发命令与目录结构。

## 构建

`npm run build` 分两步：`build-backend` 把 Go 后端交叉编译到 `dist/zviewer-backend`（`CGO_ENABLED=0`、`-trimpath`、`-s -w`），`build-frontend` 用 Vite 产出静态资源，由后端一起托管。

分发包由 `node build-all.js` 完成（`--win` / `--linux` / `--all`），输出到 `dist/win`、`dist/linux`。

| 平台 | 产物 |
|---|---|
| Windows | `zviewer-windows-x64-GUI.zip`（桌面版）、`zviewer-windows-x64.zip`（单文件） |
| Linux | `zviewer-linux-x64.tar.gz` |
| Docker | `zerowyc0721/zviewer:latest`（Linux 单文件镜像） |

桌面壳单独构建：`npm --prefix desktop run shell:build` / `shell:dist` / `package`。

证书签发是后端的一个子命令（`zviewer-backend --gen-cert <host>`），不再单独出二进制；`start.bat` / `start.sh` 的菜单 7、8 就是调它。

## CI（GitHub Actions）

| 触发 | 版本号 | 产物 |
|---|---|---|
| 手动触发，版本号留空 | `latest` 预发布 | 双平台包 + Windows GUI + Docker `dev` |
| 手动触发，填 `vX.Y.Z` | 正式版，自动打 tag | Release + `ZviewerRelease` 产物仓库 + GitCode 镜像 |
| push `v*` tag | 同上 | 同上 |

正式版的发布链路：

```
prepare → build / build-gui → release（GitHub Release）
                            → publish-branch（产物仓库 main：GitHub + GitCode）
                            → sync-gitcode（代码与 tag → GitCode 主仓库）
```

- `latest` 只跟随版本号最高的正式版，旧分支补丁发版不会把镜像拽回去；跟随 `main` 的开发镜像用 `dev`。
- **产物仓库** `ZviewerRelease`：三个包 + `latest.json` + `README.md`，每次发版用孤儿提交整体替换 `main`，旧包随旧提交消失；GitCode 是它的只读镜像。
- **桌面组件**（cloudflared、EasyTier、frpc）不随包，放在 `ZviewerRelease` 的 `components` 分支，客户端首次用到时下载。
- 补发历史产物不必重新构建：`Actions → Publish Release Repo` 填原 `run_id` + `tag` + `version`。

## 自动更新

1. 后端定期读产物仓库清单检查新版本（管理后台可关闭预发布接收）。
2. 检测到新版本后下载（带进度与阶段提示）并做结构校验。
3. 替换程序文件后重启后端进程，**不重启容器**；保留 `--restart unless-stopped` 应对异常退出。
4. `config/`（数据库、证书、上传、切片）全程不覆盖，备份这一个目录即可完整迁移。
5. 更新源默认走大陆镜像（GitCode raw），网页端与桌面端都有开关。**没有自动回退**：选了镜像就只走镜像，失败会明确报错，避免「以为在用镜像、其实在连 GitHub」。
6. 桌面启动台托管时（`ZVIEWER_DESKTOP=1`），网页端更新接口一律 409，更新在启动台里做。

## 本地开发

项目使用 npm workspaces，依赖统一在根目录安装；后端是 Go 模块，前端由 Vite 提供 HMR。

```bash
npm install
npm run db:init        # 空库初始化（创建 root / root）
npm run dev            # 前后端同时启动；后端改完自动重编译换进程
npm run dev:backend:once   # 只编译一次，不监听
npm run dev:frontend       # 仅前端（5174）
```

提交前运行：

```bash
npm run lint:go && npm run test:go && npm test -w frontend
npm run test:regression    # 13 个纯 Go 验收脚本，约 2 分钟
```

Vite 会把 `/api`、`/socket.io`、`/signal`、`/live` 代理到后端，无需配置 `VITE_API_URL`。

## 项目结构

```
ZViewer/
├── backend-go/       # Go 后端
│   ├── cmd/zviewer-server/   # 纯装配入口
│   └── internal/             # api / room / bilibili / proxy / share / piik / ncm / nms / db …
├── frontend/         # React + Vite，modules/ 按域划分
├── desktop/          # Wails v2 桌面壳（Go）+ ui/
├── scripts/          # 热重载、产物编译、启动器
├── packaging/        # 启动脚本模板
├── docker/           # 容器入口脚本
└── build-all.js      # 分发包编译
```

CLI 客户端在独立仓库 [ZViewer CLI](https://github.com/Zero-wyc/ZViewerCLI)（Go），协议见 [CLI 代理协议](/advanced/cli-protocol)。
