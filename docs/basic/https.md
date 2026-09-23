# HTTPS 证书

证书工具（`zviewer-cert`）按地址类型自动选择签发方式：

| 地址类型 | 证书 | 说明 |
|---|---|---|
| `localhost` | 自签 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名 | Let's Encrypt | 内置 ACME 客户端自动申请，浏览器无警告 |
| 公网 IP | Let's Encrypt | 支持 IP 证书（含 IPv6） |
| 内网 IP | 自签 | SAN 写入 IP 条目 |

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

输出在 `config/ssl/`：`cert.pem`（证书链）、`key.pem`（私钥）、`acme-account.key`（ACME 账号密钥）。

## HTTPS 模式

`start.bat https` 启动后，后端统一提供前端页面和 API：`https://localhost:3333`。WebRTC（屏幕共享、语音）在浏览器中要求 HTTPS 环境。

## 自签证书提示"不安全"

`localhost` 与内网 IP 的自签证书会被浏览器标记不受信任，二选一：

- 将 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」；
- 使用域名或公网 IP 走 Let's Encrypt。

Docker 部署不自动签发证书，HTTPS 建议前置 Nginx / Caddy 反代。IPv6 直连场景注意证书 SAN 需包含对应地址（Let's Encrypt 支持公网 IPv6）。
