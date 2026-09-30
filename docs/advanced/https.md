# HTTPS 证书

HTTPS 模式由后端单进程直接提供（`HTTPS=true`），证书由配套工具 `zviewer-cert` 签发。本页先讲签发与启动的使用方式，再讲工具与后端侧的实现。

---

## 签发方式选择

证书工具按地址类型自动选择签发方式：

| 地址类型 | 证书 | 说明 |
|---|---|---|
| `localhost` | 自签 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名 | Let's Encrypt | 内置 ACME 客户端自动申请，浏览器无警告 |
| 公网 IP | Let's Encrypt | 支持 IP 证书（含 IPv6） |
| 内网 IP | 自签 | SAN 写入 IP 条目 |

判定由工具自动完成（`identifierType` 为 `dns` / `ip` 自动检测），需要覆盖时用 `--selfsigned` 强制自签。

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

1. 域名已解析到本机公网 IP（或公网 IP 直接指向本机）。
2. 本机 **80 端口**空闲且防火墙放行（HTTP-01 验证）。
3. 正式环境每域名每周限 5 张证书，调试加 `--staging` 使用测试环境。

## 证书文件

输出在 `config/ssl/`：

| 文件 | 内容 |
|---|---|
| `cert.pem` | 证书（CA 模式写入完整证书链 fullchain） |
| `key.pem` | 私钥 |
| `acme-account.key` | ACME 账号密钥（CA 模式自动生成并复用，避免每次签发重建账号） |

---

## 实现说明

### 工具与构建

| 组成 | 位置 | 说明 |
|---|---|---|
| 签发入口 | `scripts/generate-cert.js` | 自签 / 可信 CA 双模式；用 `node-forge` 生成 X.509，**不依赖 openssl 或任何系统工具** |
| ACME 客户端 | `scripts/acme-client.js` | ACME v2（RFC 8555）HTTP-01 客户端，纯 Node 内置模块 + node-forge 实现 |
| 产物 | `zviewer-cert` / `zviewer-cert.exe` | 由 `build-all.js` 单独打包（entry 为 `scripts/generate-cert.js`），随单文件发行包分发 |
| 调用方 | `packaging/start-win.ps1`、`packaging/start-linux.sh` | 一键启动脚本的 `cert` / `https` 子命令转调该产物 |

打包后 `__dirname` 指向虚拟文件系统，因此工具改用 `process.cwd()` 定位 `config/ssl`——即**证书目录跟随可执行文件所在目录**。

### 自签流程

`node-forge` 现场生成密钥对与 X.509 证书，SAN 按地址类型填充（`localhost` 同时写入 `localhost` / `127.0.0.1` / `::1`，内网 IP 写入 IP 条目），有效期 10 年。

### ACME 流程（Let's Encrypt）

```
directory → newNonce → newAccount → newOrder
  → http-01 challenge（本地起 HTTP 服务器响应验证，默认 80 端口）
  → finalize(CSR) → 轮询订单 → 下载证书链（写入 cert.pem 为 fullchain）
```

- 目录端点：正式 `https://acme-v02.api.letsencrypt.org/directory`，`--staging` 切到 `https://acme-staging-v02.api.letsencrypt.org/directory`（无速率限制，用于调试）。
- 请求超时 30s，订单轮询间隔 3s；UA 为 `zviewer-cert/1.0`。
- 账号密钥持久化在 `acme-account.key`，后续签发复用同一账号。

### 命令行选项

| 选项 | 作用 |
|---|---|
| `--force` / `-f` | 强制重新生成，不检查证书是否已存在 |
| `--selfsigned` | 强制自签（即使指定的是域名或公网 IP） |
| `--staging` | 使用 Let's Encrypt 测试环境 |
| `--email <邮箱>` | ACME 账号邮箱（可选） |
| `--directory <url>` | 自定义 ACME 目录 URL（高级选项） |

### 后端启用

`backend/src/index.ts` 的 HTTPS 分支：

```ts
const useHttps = process.env.HTTPS === 'true';
const certPath = process.env.SSL_CERT_PATH || path.join(sslDir, 'cert.pem');
const keyPath  = process.env.SSL_KEY_PATH  || path.join(sslDir, 'key.pem');
// 证书文件缺失 → 打印提示并 process.exit(1)
```

即：`HTTPS=true` 时用 `https.createServer` 承载同一个 Express 应用；证书路径可用 `SSL_CERT_PATH` / `SSL_KEY_PATH` 覆盖，缺省为 `config/ssl/cert.pem` 与 `config/ssl/key.pem`。HTTP 与 HTTPS 是**二选一**，不存在双端口并存。环境变量清单见[环境变量](/advanced/env)。

启用的连带影响：`req.secure` 为真后，认证 cookie 会带 `secure` 属性并由 httpOnly cookie 通道下发（而不是 HTTP 下的 Bearer 回退），详见[鉴权与权限模型](/advanced/auth)。单文件发行版的启动脚本会用 `-Https` / `https` 子命令自动带上该变量。

---

## HTTPS 模式

`start.bat https` 启动后，后端统一提供前端页面和 API：`https://localhost:3333`。WebRTC（屏幕共享、语音）在浏览器中要求 HTTPS 环境。

## 自签证书提示"不安全"

`localhost` 与内网 IP 的自签证书会被浏览器标记不受信任，二选一：

- 将 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」；
- 使用域名或公网 IP 走 Let's Encrypt。

Docker 部署不自动签发证书，HTTPS 建议前置 Nginx / Caddy 反代。IPv6 直连场景注意证书 SAN 需包含对应地址（Let's Encrypt 支持公网 IPv6）。
