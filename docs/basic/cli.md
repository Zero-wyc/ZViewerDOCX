# ZViewerCLI 本地代理

[ZViewerCLI](https://github.com/Zero-wyc/ZViewerCLI) 是可选的本地代理客户端（Go 编写），用于解决浏览器无法使用本地 Bilibili Cookie 获取高画质地址的问题。

## 功能

- 使用本地 Bilibili Cookie 解析视频，获取大会员等高画质地址。
- 本地代理视频流，注入 Referer / Origin / User-Agent，处理 CDN 防盗链与 CORS。
- 一起听模块的歌词页背景视频高画质。

## 安装

从 [ZViewerCLI Releases](https://github.com/Zero-wyc/ZViewerCLI/releases) 下载对应平台二进制（如 `zviewer-cli-windows-amd64.exe`），放到任意目录运行。

## 配置（v0.2.0+）

运行后打开终端显示的本地配置页，需填写两项：

| 配置 | 说明 |
|---|---|
| 服务器地址 | ZViewer 后端地址，如 `https://zviewer.example.com` |
| Cookie | Bilibili 登录 Cookie（网页端 F12 → Application → Cookies 复制） |

可选填用户名。保存后 CLI 注册到服务器，对所有房间可用，无需房间号。

也可从 ZViewer 网页端进入：一起听 / B站相关设置页的 CLI 配置入口会自动带上服务器地址与当前用户名。

## 使用

1. 双击启动CLI，并填入服务器地址
2. 在房间设置里打开对应功能开关，即可自动使用本地代理，无需逐房间连接。
3. 前端按登录用户名过滤代理列表，可用列表中只包含当前用户自己的 CLI。

运行原理与协议细节见[拓展教程 · ZViewerCLI 代理协议](/advanced/cli-protocol)。
