# HTTPS 证书

HTTPS 由后端在同进程提供（`HTTPS=true`），证书由配套工具 `zviewer-cert` 签发。

## 签发方式选择

| 地址类型 | 证书 | 说明 |
|---|---|---|
| `localhost` | 自签 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名 | Let's Encrypt | 内置 ACME 客户端自动申请，浏览器无警告 |
| 公网 IP | Let's Encrypt | 支持 IP 证书（含 IPv6） |
| 内网 IP | 自签 | SAN 写入 IP 条目 |

工具会自行判断域名 / IP（`identifierType` 的 `dns` 与 `ip`）再选签发方式；`--selfsigned` 可强制自签。

> **正式环境不建议用命令行自动签发正式证书**：菜单里的 Let's Encrypt 签发适合测试，续期与验证失败排查都要自己盯。生产建议把域名交给 Cloudflare、阿里云 ESA、腾讯 EdgeOne 等支持自动签发的边缘服务，或用宝塔、1Panel 等面板统一申请续期，再反代到 3333 端口。

## 签发命令

```bash
start.bat cert example.com      # 域名 → Let's Encrypt
start.bat cert 1.2.3.4          # 公网 IP → Let's Encrypt
start.bat cert 192.168.1.1      # 内网 IP → 自签
start.bat cert example.com --force    # 强制重新签发
start.bat https example.com     # 签发证书 + HTTPS 启动
```

Linux 下把 `start.bat` 换成 `./start.sh`。

## Let's Encrypt 前置条件

1. 域名解析到本机公网 IP，或公网 IP 直接指向本机。
2. 本机 **80 端口**空闲且防火墙放行（HTTP-01 验证需要）。
3. 正式环境每个域名每周限签 5 张；调试加 `--staging` 用测试环境。

## 证书文件

输出在 `config/ssl/`：

| 文件 | 内容 |
|---|---|
| `cert.pem` | 证书（CA 模式写入完整 fullchain） |
| `key.pem` | 私钥 |
| `acme-account.key` | ACME 账号密钥（自动生成并复用，避免每次重建账号） |

## 证书工具的实现

| 组成 | 位置 | 说明 |
|---|---|---|
| 签发入口 | `scripts/generate-cert.js` | 自签 / 可信 CA 双模式；用 `node-forge` 生成 X.509，不依赖 openssl |
| ACME 客户端 | `scripts/acme-client.js` | ACME v2（RFC 8555）HTTP-01 客户端，纯 Node 内置模块 + node-forge |
| 产物 | `zviewer-cert` / `zviewer-cert.exe` | 由 `build-all.js` 单独打包，随单文件发行包分发 |
| 调用方 | `packaging/start-win.ps1`、`packaging/start-linux.sh` | `cert` / `https` 子命令转调该产物 |

打包后 `__dirname` 指向虚拟文件系统，工具改用 `process.cwd()` 定位 `config/ssl`，即证书目录跟随可执行文件所在目录。

### 自签流程

不联网、不依赖 openssl。`node-forge` 现场生成密钥对与 X.509 证书，SAN 按地址类型填充（`localhost` 写入 `localhost` / `127.0.0.1` / `::1`，内网 IP 写入 IP 条目），有效期 10 年。

### ACME 流程

```
directory → newNonce → newAccount → newOrder
  → http-01 challenge（本地起 HTTP 服务器响应验证，默认 80 端口）
  → finalize(CSR) → 轮询订单 → 下载证书链（写入 cert.pem 为 fullchain）
```

- 目录端点：正式 `https://acme-v02.api.letsencrypt.org/directory`，`--staging` 切到 `acme-staging-v02`（无速率限制）。
- 请求超时 30s，订单轮询间隔 3s，UA 为 `zviewer-cert/1.0`。
- 账号密钥持久化在 `acme-account.key`，后续复用同一账号。

### 命令行选项

| 选项 | 作用 |
|---|---|
| `--force` / `-f` | 强制重新生成，不检查是否已存在 |
| `--selfsigned` | 强制自签（即使指定了域名或公网 IP） |
| `--staging` | 使用 Let's Encrypt 测试环境 |
| `--email <邮箱>` | ACME 账号邮箱（可选） |
| `--directory <url>` | 自定义 ACME 目录 URL（高级） |

### 后端启用

```ts
const useHttps = process.env.HTTPS === 'true';
const certPath = process.env.SSL_CERT_PATH || path.join(sslDir, 'cert.pem');
const keyPath  = process.env.SSL_KEY_PATH  || path.join(sslDir, 'key.pem');
// 证书文件缺失 → 打印提示并 process.exit(1)
```

`HTTPS=true` 时用 `https.createServer` 承载同一个 Express 应用；证书路径可用 `SSL_CERT_PATH` / `SSL_KEY_PATH` 覆盖。HTTP 与 HTTPS 二选一，不存在双端口并存。

启用 HTTPS 后 `req.secure` 为真，认证 cookie 会带 `secure` 属性并经 httpOnly cookie 下发，而不是 HTTP 下的 Bearer 回退，见[鉴权与权限模型](/advanced/auth)。单文件版启动脚本的 `https` 子命令会自动带上该变量。

## HTTPS 模式与自签提示

`start.bat https` 之后，页面与 API 统一在 `https://localhost:3333`，WebRTC（屏幕共享与语音）要求 HTTPS 环境。

`localhost` 与内网 IP 的自签证书不被浏览器信任，会看到安全警告：把 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」，或改用域名 / 公网 IP 走 Let's Encrypt。

Docker 部署不自动签发证书，HTTPS 宜前置 Nginx / Caddy 反代。IPv6 直连时证书 SAN 需包含该地址（Let's Encrypt 支持公网 IPv6）。
