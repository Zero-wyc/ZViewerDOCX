# 基础教程

ZViewer —— 多人同步观影、追番与远程共享平台。本分区覆盖安装部署与全部功能的使用说明；程序运行逻辑与接口细节见[拓展教程](/advanced/)。

## 快速上手

### 1. 下载

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载对应系统的压缩包（Windows `zviewer-windows-x64.zip` / Linux `zviewer-linux-x64.tar.gz`），解压即可，无需安装 Node.js。

### 2. 启动

```bash
# Windows
start.bat start

# Linux
./start.sh start
```

### 3. 登录

访问 `http://localhost:3333`。首次启动自动创建超级管理员：

| 用户名 | 密码 |
|---|---|
| `root` | `root` |

**生产环境部署后立即修改默认密码**（右上角用户菜单 → 个人资料 → 编辑信息 → 修改密码）。

### 4. 创建房间

点击「开始共享」→ 选择模式（一起看 / 投屏）→ 进入房间。把房间信息面板里的房间号或分享链接发给好友，对方通过房间号、房间列表或链接加入。

### 5. 添加影片

在「添加影片」面板选来源：B站（粘贴 BV 号或链接解析）、直链（MP4 等地址）、WebDAV / FTP / OpenList 挂载（先在个人资料页或后台配置）。点击影片开始播放，进度实时同步给所有人。

## 端口

| 端口 | 用途 | 对外 |
|---|---|---|
| 3333 | 统一入口：API、WebSocket、前端页面、`/live` FLV 代理 | 是 |
| 3334 | RTMP 推流（OBS） | 是 |
| 3335 | HTTP-FLV 拉流（内部） | 否 |

## 浏览器要求

使用 Chrome / Edge 等内核 130+ 的 Chromium 浏览器。Safari 与 Firefox 对 MSE / MKV 解码支持不完整，可能卡顿、无法解码、字幕异常。

## 本分区目录

- [安装与部署](/basic/install) — 单文件 / 源码 / Docker / 数据持久化
- [功能说明](/basic/features) — 全部功能的使用说明
- [ZViewerCLI](/basic/cli) — 本地代理客户端安装与使用
- [管理后台](/basic/admin) — 用户审核、房间管理、系统设置
- [HTTPS 证书](/basic/https) — 证书签发与 HTTPS 启动
- [网络连接与内网穿透](/basic/network) — FRP / ZeroTier / IPv6
- [常见问题](/basic/faq)

深入了解程序运行逻辑与接口设计 → [拓展教程](/advanced/)
