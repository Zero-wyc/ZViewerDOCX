---
title: 常见问题
description: 部署与使用中常见问题的排查方法
---

# 常见问题

## 自签证书浏览器提示「不安全」

`localhost` 与公网 IP 使用自签证书，浏览器会提示「证书颁发机构不受信任」。解决方法：

- 将 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」；或
- 使用域名并通过 Let's Encrypt 申请可信证书（见 [HTTPS 与证书](/guide/https)）。

## WebSocket 连接失败

确认反向代理（Nginx 等）已正确配置 WebSocket 升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

若使用自定义后端地址，请确认前端已通过 `VITE_API_URL` / 本地存储的后端地址正确指向后端（见 [环境变量](/config/environment)）。

## WebRTC 无法建立连接

- WebRTC 的 `getUserMedia` 要求 **HTTPS** 访问，生产环境请配置 SSL 证书。
- 若双方处于严格 NAT 之后，可能需要部署 TURN 服务器（如 coturn）。

## 数据库说明

后端使用 TypeORM + sql.js（wasm 版 SQLite）持久化，纯 JS 实现、无原生模块——单文件 exe 版可在任意平台直接运行，无需编译。数据库文件为标准 SQLite 格式（`config/dev.sqlite`），可用常规 SQLite 工具查看。

## Bilibili 解析失败

- 检查后端是否正确携带 Referer 等请求头。
- 封面与视频地址通过后端代理获取，避免 CORS 与防盗链问题。
- 大会员专享内容需在后台配置有效的 Bilibili 登录凭证，或使用 [ZViewerCLI 本地代理](/usage/zviewercli)。

## 更新机制

系统支持从 GitHub Releases 自动检测并应用更新，也支持手动上传压缩包更新。管理员可在管理后台控制是否接收预发布版（`main` 分支自动构建）的更新，详见 [升级与更新](/guide/upgrade)。

## 忘记 root 密码

当前版本未提供密码找回功能。若为源码部署，可停止服务后删除 `config/dev.sqlite` 数据库重启（会清空全部数据，请谨慎操作），系统将重新创建默认账号 `root` / `root`。

## 更多帮助

- 项目仓库：[Zero-wyc/ZViewer](https://github.com/Zero-wyc/ZViewer)（Issues / Discussions）
- Telegram：[t.me/Zero_251](https://t.me/Zero_251)
