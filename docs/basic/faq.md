# 常见问题

## 自签证书提示不受信任

`localhost` 与公网 IP 使用自签证书时，浏览器会提示颁发机构不受信任。处理方式：把 `config/ssl/cert.pem` 导入客户端「受信任的根证书颁发机构」，或改用域名走 Let's Encrypt，见 [HTTPS 证书](/advanced/https)。

## WebSocket 连接失败

确认反向代理已配置 WebSocket 升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## 语音聊天连不上

语音媒体默认走 `3333/udp`，服务器防火墙需放行。UDP 被拦截时可配置内置 TURN/TLS 中继（TCP 5349）兜底，见[环境变量](/advanced/env)中的 `LIVEKIT_TURN_*` 三项。

## WebRTC 无法建立连接

`getUserMedia` 要求 HTTPS 访问，生产环境需配置 SSL 证书。

## 数据库

后端用 TypeORM + sql.js（wasm 版 SQLite）持久化，纯 JS 实现、无原生模块，单文件版可在任意平台直接运行。数据库为标准 SQLite 格式（`config/dev.sqlite`），可用常规工具查看。

写入采用原子写回（先写临时文件再替换），启动时自动滚动备份，文件损坏可用备份自愈。也支持 PostgreSQL，见[环境变量](/advanced/env)。

## Bilibili 解析失败

- 确认后端正确携带 Referer 等请求头（封面与视频地址经后端代理，规避 CORS 与防盗链）。
- 大会员内容需配置有效的 Bilibili 登录凭证，或使用 [ZViewer CLI 本地代理](/basic/cli)。

## 房主离线后房间会怎样

服务器继续广播当前播放状态，观众不中断；离线超时 10 分钟自动关房，期间观众可自主控制。

## 如何修改默认 root 密码

用 `root` / `root` 登录后进入个人资料页修改；管理员也可在后台用户管理中处理。

## 更新机制

支持从 GitHub Releases 自动检测并应用更新，也可手动上传压缩包。管理员可控制是否接收预发布版，见[构建与更新](/advanced/build-update)。
