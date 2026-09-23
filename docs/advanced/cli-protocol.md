# ZViewerCLI 代理协议

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI)（Go，独立仓库）通过 Socket.IO 与服务器通信，为浏览器补上本地 Bilibili Cookie 与流代理能力。

## 注册流程（v0.2.0 去房间化）

1. CLI 启动后携带 Engine.IO 握手参数 `{"agent":"zcontrol-cli"}` 建立 WebSocket（绕过通用 access_token 中间件）。
2. 发送 `cli-register` 事件，payload：

```json
{
  "proxyUrl": "http://127.0.0.1:9333",
  "agent": "zviewer-cli",
  "version": "0.2.0",
  "user": "用户名"
}
```

3. 服务端只校验 `proxyUrl`，**忽略任何房间号**。CLI 被记入专用房间 `__cli-agents__`（仅为后续聚合查询便利，语义上是全局注册）。
4. 上下线通过 `cli-agent-available` / `cli-agent-unavailable` **全局广播**（`io.emit`），所有已连接的网页端实时感知。

## 关键语义

- **一个 CLI 对服务器上所有房间可用**。房间内的 CLI 功能开关（音乐视频高画质 / cliEnabled）打开即自动使用，没有"逐房间连接"的概念。
- **user 归属过滤**：payload 携带 `user` 时，前端按登录用户名过滤代理列表——每个用户只看到自己的 CLI。不带 `user` 的旧版 CLI 视为公共代理，全员可见。
- **配置是内存态**：CLI 重启后 `serverUrl` / `user` / `cookie` 丢失，需从网页端配置页重新带入（入口自动携带 `?server=&user=` 参数）。

## 代理链路

```
浏览器 <video>/<audio>
   │  http://127.0.0.1:9333/...
   ▼
ZViewerCLI 本地 HTTP 代理
   │  注入本地 Bilibili Cookie + Referer / Origin / User-Agent
   ▼
Bilibili CDN（up to 大会员档位）
```

前端检测到可用 CLI 后，把媒体请求从服务器代理切换到本地代理，实现：
- 大会员高画质（Cookie 只存在用户本机，不经服务器）；
- 防盗链头注入，绕过 CDN 校验；
- 歌词页背景视频的分辨率档位按 B站 大会员状态过滤（普通账号最高 1080P）。

## 排查

| 现象 | 检查 |
|---|---|
| 配置页连不上 | 服务器地址是否可达；CLI 是否保持运行（注册是内存态） |
| 代理列表为空 | CLI 的 `user` 与网页登录用户名是否一致 |
| 高画质仍失败 | Cookie 是否有效（网页端能看对应清晰度）；CLI 版本 ≥ 0.2.0 |
