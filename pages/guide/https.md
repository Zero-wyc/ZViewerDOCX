---
title: HTTPS 与证书
description: 自签证书与 Let's Encrypt 证书的签发方式
---

# HTTPS 与证书

WebRTC（屏幕共享、语音）的 `getUserMedia` 要求 HTTPS 访问，生产环境建议配置 SSL 证书。

## 签发类型

证书工具（`zviewer-cert`，源码为 `scripts/generate-cert.js`）按地址类型自动选择签发方式：

| 地址类型 | 证书 | 说明 |
| --- | --- | --- |
| `localhost` | 自签证书 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名（如 `example.com`） | **Let's Encrypt 可信 CA 证书** | 通过内置 ACME 客户端自动申请，浏览器不报警告 |
| 公网 IP（如 `1.2.3.4`） | 自签证书 | SAN 写入 IP 条目 |

## 命令行签发

```bash
# 域名 → 自动申请 Let's Encrypt 可信证书
start.bat cert example.com
./start.sh cert example.com

# 公网 IP → 自签证书
start.bat cert 1.2.3.4

# 强制重新签发
start.bat cert example.com --force
```

HTTPS 模式下后端同时提供前端静态页面，访问 `https://localhost:3333`。

源码版使用 `start-prod.bat cert` / `start-prod.sh cert`（或交互菜单第 7、8 项）执行相同功能。

## 域名申请 Let's Encrypt 证书的前置条件

1. 域名已解析到本机公网 IP。
2. 本机 **80 端口**空闲且防火墙/安全组放行（ACME HTTP-01 验证）。
3. 正式环境有速率限制（每域名每周 5 张），调试可用 `--staging` 测试环境。

## 证书文件

证书文件位于 `config/ssl/`：

| 文件 | 内容 |
| --- | --- |
| `cert.pem` | 证书链 |
| `key.pem` | 私钥 |
| `acme-account.key` | ACME 账号 |

## 相关环境变量

| 变量 | 说明 |
| --- | --- |
| `HTTPS` | 以 HTTPS 模式启动（配合证书文件） |
| `SSL_CERT_PATH` | 证书链路径 |
| `SSL_KEY_PATH` | 私钥路径 |

详见 [环境变量](/config/environment)。

## 浏览器提示「不安全」怎么办

`localhost` 与公网 IP 使用自签证书，浏览器会提示「证书颁发机构不受信任」。解决方法：

- 将 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」；或
- 使用域名并通过 Let's Encrypt 申请可信证书。

## Docker 部署的 HTTPS

Docker 镜像默认 HTTP 模式，不自动签发证书。建议在 Docker 前加一层反向代理（Nginx / Caddy）终结 TLS，详见 [部署](/guide/deploy)。
