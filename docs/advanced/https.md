# HTTPS 证书

HTTPS 由后端在进程内提供（`HTTPS=true`），证书签发是后端自带的一个子命令，不再分发独立的证书工具。

## 签发方式选择

| 地址类型 | 证书 | 说明 |
|---|---|---|
| `localhost` | 自签 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名 | Let's Encrypt | 内置 ACME 客户端自动申请，浏览器无警告 |
| 公网 IP | Let's Encrypt | 支持 IP 证书（含 IPv6） |
| 内网 IP | 自签 | SAN 写入该 IP 条目 |

工具按地址自行判断：含点的域名与公网 IP 走 Let's Encrypt，`localhost`、内网 IP 与单标签主机名走自签；`--selfsigned` 可强制自签。

> **正式环境不建议用命令行自动签发正式证书**：菜单里的 Let's Encrypt 签发适合测试，续期与验证失败排查都要自己盯。生产建议把域名交给 Cloudflare、阿里云 ESA、腾讯 EdgeOne 等支持自动签发的边缘服务，或用宝塔、1Panel 等面板统一申请续期，再反代到 3333 端口。

## 签发命令

```bash
start.bat cert example.com      # 域名 → Let's Encrypt
start.bat cert 1.2.3.4          # 公网 IP → Let's Encrypt
start.bat cert 192.168.1.1      # 内网 IP → 自签
start.bat cert example.com --force    # 强制重新签发
start.bat https example.com     # 签发证书 + HTTPS 启动
```

Linux 下把 `start.bat` 换成 `./start.sh`；直接调用等价于 `zviewer-backend --gen-cert <host> [--force]`。

## Let's Encrypt 前置条件

1. 域名解析到本机公网 IP，或公网 IP 直接指向本机。
2. 本机 **80 端口**空闲且防火墙放行（HTTP-01 验证需要，可用 `ZVIEWER_CERT_CHALLENGE_PORT` 改端口）。
3. 正式环境每个域名每周限签 5 张；调试加 `--staging` 用测试环境。

## 证书文件

输出在 `config/ssl/`：

| 文件 | 内容 |
|---|---|
| `cert.pem` | 证书（CA 模式写入完整 fullchain） |
| `key.pem` | 私钥 |
| `acme-account.key` | ACME 账号密钥（自动生成并复用，避免每次重建账号） |

## 实现

| 组成 | 位置 | 说明 |
|---|---|---|
| 签发入口 | `backend-go/internal/ssl`（后端 `--gen-cert`） | 签完即退出，不连库、不起服务 |
| 自签 | Go 标准库生成密钥与 X.509 | 不依赖 openssl，SAN 按地址类型填充，10 年有效 |
| ACME | 同包内的 ACME v2 客户端 | HTTP-01 验证，账号密钥持久化复用 |

### 命令行选项

| 选项 | 作用 |
|---|---|
| `--force` / `-f` | 强制重新生成，不检查是否已存在 |
| `--selfsigned` | 强制自签（即使指定了域名或公网 IP） |
| `--staging` | 使用 Let's Encrypt 测试环境 |
| `--email <邮箱>` | ACME 账号邮箱（可选） |
| `--directory <url>` | 自定义 ACME 目录 URL（高级） |

### 后端启用

`HTTPS=true` 时同一个服务同时提供页面与 API，证书路径可用 `SSL_CERT_PATH` / `SSL_KEY_PATH` 覆盖，文件缺失时启动即失败。HTTP 与 HTTPS 二选一，不存在双端口并存。

启用 HTTPS 后请求被视为安全上下文，认证 cookie 带 `secure` 属性并经 httpOnly cookie 下发，而不是 HTTP 下的 Bearer 回退，见[鉴权与权限模型](/advanced/auth)。单文件版启动脚本的 `https` 子命令会自动带上该变量。

## HTTPS 模式与自签提示

`start.bat https` 之后，页面与 API 统一在 `https://localhost:3333`，WebRTC（屏幕共享与语音）要求 HTTPS 环境。

`localhost` 与内网 IP 的自签证书不被浏览器信任，会看到安全警告：手动放行一次即可，或改用域名 / 公网 IP 走 Let's Encrypt。桌面版不再安装系统级 CA 信任，只提供「导出公开 CA」。

Docker 部署不自动签发证书，HTTPS 宜前置 Nginx / Caddy 反代。IPv6 直连时证书 SAN 需包含该地址（Let's Encrypt 支持公网 IPv6）。
