# 常见问题

## 自签证书浏览器提示"不安全"

`localhost` 与公网 IP 使用自签证书，浏览器会提示"证书颁发机构不受信任"。解决方法：

- 将 `config/ssl/cert.pem` 导入客户端"受信任的根证书颁发机构"；或
- 使用域名并通过 Let's Encrypt 申请可信证书，详见 [HTTPS 与证书](/dev/https)。

## WebSocket 连接失败

确认反向代理（Nginx 等）已正确配置 WebSocket 升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## WebRTC 无法建立连接

WebRTC 的 `getUserMedia` 要求 HTTPS 访问。生产环境请配置 SSL 证书。若双方处于严格 NAT 之后，可能需要部署 TURN 服务器（如 coturn）。

## 数据库说明

后端使用 TypeORM + sql.js（wasm 版 SQLite）持久化，纯 JS 实现、无原生模块——单文件 exe 版可在任意平台直接运行，无需编译。数据库文件为标准 SQLite 格式（`config/dev.sqlite`），可用常规 SQLite 工具查看。

支持可选 PostgreSQL，配置方式见[环境变量](/dev/env)。

## Bilibili 解析失败

- 检查后端是否正确携带 Referer 等请求头。
- 封面与视频地址通过后端代理获取，避免 CORS 与防盗链问题。
- 大会员专享内容需在后台配置有效的 Bilibili 登录凭证，或使用 [ZViewerCLI 本地代理](/features/video-sources#zviewercli-本地代理)。

## 房主离线后房间会怎样

房主短暂断线后，由服务器继续广播当前播放状态，观众无需中断观看（播放记忆功能）；房主离线超时 10 分钟自动关房，期间观众可自由控制。

## 如何更改默认的 root 密码

使用 `root` / `root` 登录后，进入个人资料页修改密码；管理员也可在管理后台用户管理中对用户进行管理。

## 更新机制

系统支持从 GitHub Releases 自动检测并应用更新，也支持手动上传压缩包更新。管理员可在管理后台控制是否接收预发布版（main 分支自动构建）的更新，详见[部署方式](/guide/deployment#更新机制)。
