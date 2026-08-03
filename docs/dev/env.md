# 环境变量

ZViewer 通过环境变量配置。你可以在 `.env` 文件中设置（从 `.env.example` 复制），或通过系统环境变量设置。

---

## 后端环境变量

### 基础配置

| 变量 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `PORT` | 后端服务端口 | `3333` | `PORT=3333` |
| `HOST` | 监听地址 | 空（双栈） | `HOST=0.0.0.0` |
| `NODE_ENV` | 运行环境 | `production` | `NODE_ENV=development` |

### 存储路径

所有路径留空时使用 `<project-root>/config/` 下的默认值。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CONFIG_DIR` | 数据根目录 | `<project-root>/config` |
| `DATABASE_URL` | 数据库连接 | `<config>/dev.sqlite` |
| `UPLOADS_DIR` | 上传文件目录 | `<config>/uploads` |
| `AVATARS_DIR` | 头像目录 | `<config>/avatars` |
| `MEDIA_DIR` | NMS 推流临时目录 | `<config>/media` |

> PostgreSQL 示例：`DATABASE_URL=postgresql://user:password@localhost:5432/zviewer`（需同步修改 `data-source.ts`）

### 跨域配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `CORS_ORIGIN` | 允许跨域来源，多个用逗号分隔 | `*` |

生产环境建议设置为具体的前端域名，例如 `CORS_ORIGIN=https://example.com`。

### JWT 认证（生产必须修改）

| 变量 | 说明 | 默认值 | 建议 |
|------|------|--------|------|
| `JWT_ACCESS_SECRET` | Access Token 密钥 | 自动生成 | 32+ 字符随机串 |
| `JWT_REFRESH_SECRET` | Refresh Token 密钥 | 自动生成 | 32+ 字符随机串，不与上面相同 |
| `JWT_ACCESS_EXPIRES_IN` | Access Token 有效期 | `15m` | `15m` 或 `30m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token 有效期 | `7d` | `7d` 或 `14d` |

### 推流端口

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `RTMP_PORT` | RTMP 推流端口 | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV 拉流端口 | `3335` |

### 额外变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `HTTPS` | 启用 HTTPS 模式 | `HTTPS=true` |
| `SSL_CERT_PATH` | 证书路径 | `config/ssl/cert.pem` |
| `SSL_KEY_PATH` | 私钥路径 | `config/ssl/key.pem` |
| `SERVER_HOST` | RTMP 地址优先使用的主机名 | `SERVER_HOST=example.com` |

---

## 前端构建环境变量

在构建前端时使用，不用于运行时。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `VITE_API_URL` | API/Socket.IO 基础地址 | 空（使用 `window.location.origin`） |
| `VITE_FLV_BASE_URL` | HTTP-FLV 拉流基础地址 | 空（使用同源地址） |

---

## 配置示例

### 最小配置（开发环境）

```ini
PORT=3333
NODE_ENV=development
```

### 生产环境推荐配置

```ini
PORT=3333
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
JWT_ACCESS_SECRET=<32+ 字符随机串>
JWT_REFRESH_SECRET=<另一个 32+ 字符随机串>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### 生成随机密钥

```bash
# Linux / macOS
openssl rand -base64 32

# 或 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```