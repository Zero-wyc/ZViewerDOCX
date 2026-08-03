# 本地开发

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

## 开发端口

| 服务 | 地址 |
|---|---|
| 前端 | `http://localhost:5174` |
| 后端 | `http://localhost:3333` |

前端开发时默认通过 Vite 代理连接后端，无需额外配置 `VITE_API_URL`。

## 构建

```bash
npm run build          # 构建前后端
npm run build:all      # 单文件编译（生成 dist/ 下的可执行文件）
npm run lint           # 代码检查
```

## 常用脚本（package.json）

| 脚本 | 说明 |
|---|---|
| `dev` | 并行启动前后端开发服务 |
| `dev:backend` / `dev:frontend` | 单独启动后端 / 前端 |
| `build` | 构建全部 workspace |
| `build:exe` | 后端编译为单文件 exe |
| `build:backend-exe` | 仅编译后端 exe |
| `build:frontend-exe` | 仅打包前端静态服务 exe |
| `build:all` | 全量单文件编译 |
| `start` | 跨平台启动（转发到 `start-prod.*` 脚本） |

## scripts/ 目录工具

| 文件 | 用途 |
|---|---|
| `generate-cert.js` | SSL 证书生成（自签 / Let's Encrypt） |
| `acme-client.js` | ACME v2 (RFC 8555) HTTP-01 客户端 |
| `build-exe.js` | 后端单文件编译（@yao-pkg/pkg） |
| `build-frontend-exe.js` | 前端静态服务打包为 exe |
| `start.js` | 跨平台启动转发 |
