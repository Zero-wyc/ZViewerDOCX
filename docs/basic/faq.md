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

语音媒体默认走 `3333/udp`，服务器防火墙需放行；同时放行 `3337/tcp` 可让 UDP 被拦的客户端改走直连。仍不通时可配置 TURN/TLS 中继（`3338/tcp`）兜底，见[环境变量](/advanced/env)中的 `LIVEKIT_TURN_*` 三项。

## WebRTC 无法建立连接

`getUserMedia` 要求 HTTPS 访问，生产环境需配置 SSL 证书。

## 数据库

后端用 Go 的纯 Go SQLite 驱动持久化，标准 SQLite 格式（`config/dev.sqlite`），可用常规工具查看；WAL 模式下同目录还会有 `-wal` / `-shm` 旁文件，属正常现象，别手删。

备份用 `npm run db:backup -- <目标路径>`（内部 `VACUUM INTO`），直接 `cp` 主文件会丢最近事务。只有 SQLite，不支持 PostgreSQL。

## Bilibili 解析失败

- 确认后端正确携带 Referer 等请求头（封面与视频地址经后端代理，规避 CORS 与防盗链）。
- 大会员内容需配置有效的 Bilibili 登录凭证，或使用 [ZViewer CLI 本地代理](/basic/cli)。

## 房主离线后房间会怎样

服务器继续广播当前播放状态，观众不中断；离线超时 10 分钟自动关房，期间观众可自主控制。

## 如何修改默认 root 密码

用 `root` / `root` 登录后进入个人资料页修改；管理员也可在后台用户管理中处理。

## 更新机制

默认从 GitCode 镜像（国内直连）检查并一键更新，也可在后台关掉镜像改走 GitHub Releases，或手动上传压缩包。管理员可控制是否接收预发布版，见[构建与更新](/advanced/build-update)。
