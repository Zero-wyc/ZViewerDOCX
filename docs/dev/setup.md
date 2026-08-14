# 本地开发

本文面向希望在本地搭建 ZViewer 开发环境的开发者。

---

## 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Node.js | 18.x | 推荐使用 20.x 或 22.x LTS |
| npm | 9.x | 随 Node.js 一起安装 |
| Git | — | 用于克隆项目代码 |

## 第一步：克隆项目

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
```

## 第二步：安装依赖

项目使用 npm workspaces，根目录统一安装所有依赖：

```bash
npm install
```

这会自动安装 `backend/` 和 `frontend/` 两个 workspace 的所有依赖。

## 第三步：启动开发服务

### 同时启动前后端（推荐）

```bash
npm run dev
```

这会用 `concurrently` 同时启动前端和后端开发服务器。

### 分别启动

```bash
npm run dev:backend    # 后端 http://localhost:3333
npm run dev:frontend   # 前端 http://localhost:5174
```

前端开发时默认通过 Vite 代理连接后端（`/api`、`/socket.io`、`/live` 请求自动转发到 `localhost:3333`），无需额外配置 `VITE_API_URL`。

## 开发端口

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端开发服务器 | `http://localhost:5174` | Vite 开发服务器，HMR 热更新 |
| 后端开发服务器 | `http://localhost:3333` | Express + TypeScript，热重载 |
| RTMP 推流 | 3334 | OBS 推流端口 |
| HTTP-FLV 拉流 | 3335 | 直播流播放 |

## 常用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并行启动前后端开发服务 |
| `npm run dev:backend` | 单独启动后端 |
| `npm run dev:frontend` | 单独启动前端 |
| `npm run build` | 构建前后端 |
| `npm run build:all` | 全量单文件编译（生成 dist/ 可执行文件） |
| `npm run lint` | 代码检查 |
| `npm run start` | 跨平台启动（转发到 start-prod.* 脚本） |

## 项目结构简览

```
ZViewer/
├── backend/          # Express 后端（TypeScript + TypeORM + sql.js）
├── frontend/         # React 前端（Vite + Tailwind CSS）
├── scripts/          # 工具脚本（证书/构建/启动）
├── docker/           # Docker 入口
├── packaging/        # 启动脚本模板
└── dist/             # 构建产物
```

## 数据库

- **默认**：SQLite（`config/dev.sqlite`），sql.js wasm 实现
- **可选**：PostgreSQL（需配置 `DATABASE_URL`）

## 工具脚本

| 脚本 | 说明 |
|------|------|
| `scripts/generate-cert.js` | SSL 证书生成（自签 / Let's Encrypt） |
| `scripts/acme-client.js` | ACME v2 HTTP-01 客户端 |
| `scripts/build-exe.js` | 后端单文件编译 |
| `scripts/start.js` | 跨平台启动转发 |