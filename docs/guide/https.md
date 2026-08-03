# HTTPS 与证书

## 签发类型

证书工具（`zviewer-cert`，源码为 `scripts/generate-cert.js`）按地址类型自动选择签发方式：

| 地址类型 | 证书 | 说明 |
|---|---|---|
| `localhost` | 自签证书 | SAN 含 `localhost`、`127.0.0.1`、`::1`，10 年有效 |
| 域名（如 `example.com`） | **Let's Encrypt 可信 CA 证书** | 通过内置 ACME 客户端自动申请，浏览器不报警告 |
| 公网 IP（如 `1.2.3.4`） | 自签证书 | SAN 写入 IP 条目 |

> 证书签发为纯 Node 实现（无需 openssl），基于内置 ACME v2 (RFC 8555) HTTP-01 客户端，仅依赖 `node-forge`。

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

## 域名申请 Let's Encrypt 证书的前置条件

1. 域名已解析到本机公网 IP。
2. 本机 **80 端口**空闲且防火墙/安全组放行（ACME HTTP-01 验证）。
3. 正式环境有速率限制（每域名每周 5 张），调试可用 `--staging` 测试环境。

## 证书文件位置

证书文件位于 `config/ssl/`：

| 文件 | 内容 |
|---|---|
| `cert.pem` | 证书链 |
| `key.pem` | 私钥 |
| `acme-account.key` | ACME 账号 |

## 相关环境变量

| 变量 | 说明 |
|---|---|
| `HTTPS=true` | 启用 HTTPS 模式并顺带托管前端静态文件 |
| `SSL_CERT_PATH` | 证书路径 |
| `SSL_KEY_PATH` | 私钥路径 |

## 常见问题

### 自签证书浏览器提示"不安全"

`localhost` 与公网 IP 使用自签证书，浏览器会提示"证书颁发机构不受信任"。解决方法：

- 将 `config/ssl/cert.pem` 导入客户端"受信任的根证书颁发机构"；或
- 使用域名并通过 Let's Encrypt 申请可信证书。

### 反向代理场景

若使用 Nginx / Caddy 等反向代理终止 TLS，后端保持 HTTP 模式即可，无需在 ZViewer 内签发证书。注意正确配置 WebSocket 升级头（见[常见问题](/guide/faq#websocket-连接失败)）。
