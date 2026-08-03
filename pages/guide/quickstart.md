---
title: 快速开始
description: 从零启动 ZViewer 并创建你的第一个房间
---

# 快速开始

::: warning 首次登录请立即修改默认密码
系统首次启动时自动创建超级管理员账号：用户名 `root`，密码 `root`。生产环境部署后请**立即修改默认密码**。
:::

## 方式一：源码版一键启动（推荐）

项目根目录的 `start-prod` 脚本会自动检测并安装依赖、按需构建、启动服务。

**Windows**：

```powershell
.\start-prod.bat              # 交互菜单
.\start-prod.bat start        # 启动（HTTP 前后端）
.\start-prod.bat stop         # 停止服务
.\start-prod.bat status       # 查看状态
.\start-prod.bat cert         # 签发 SSL 证书
.\start-prod.bat https        # 签发证书 + HTTPS 启动
```

**Linux / macOS**：

```bash
./start-prod.sh               # 交互菜单
./start-prod.sh start
./start-prod.sh stop
./start-prod.sh status
```

启动后访问 `http://localhost:4173`（HTTP 模式）或 `https://localhost:3333`（HTTPS 模式）。

## 方式二：单文件 exe 版

无需安装 Node.js / npm，直接下载 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 中的压缩包，解压后运行：

```bash
# Windows
start.bat              # 交互菜单
start.bat start        # 启动服务

# Linux
./start.sh             # 交互菜单
./start.sh start       # 启动服务
```

## 一键启动脚本详解

源码版（`start-prod.*`）与单文件版（`start.bat` / `start.sh`）功能一致，均提供交互菜单与命令行两种模式。

### 交互菜单

```
========================================
  ZViewer 服务管理
========================================
  1) 启动服务 (HTTP)
  2) 仅启动后端（可选 HTTP / HTTPS）
  3) 停止服务
  4) 重启服务
  5) 查看状态
  6) 查看日志
  7) 一键签发 SSL 证书
  8) HTTPS 启动（自动签发证书）
  9) 构建前后端（源码版）
  0) 退出
```

### 命令行用法

| 命令 | 说明 |
| --- | --- |
| `start` | 启动服务（HTTP 前后端；加 `-Https` 使用 HTTPS 单进程模式） |
| `backend` | 仅启动后端（可选 HTTP/HTTPS） |
| `cert [host]` | 签发 SSL 证书，host 缺省时交互选择类型 |
| `https [host]` | 签发证书后以 HTTPS 启动（仅后端，后端统一提供前端页面） |
| `stop` / `restart` | 停止 / 重启服务 |
| `status` | 查看运行状态（PID、端口监听、证书状态） |
| `logs [backend\|frontend]` | 查看日志（默认 backend） |
| `build` | 构建前后端（源码版） |
| `help` / `menu` | 帮助 / 交互菜单 |

## 首次使用流程

1. 打开 `http://localhost:4173`，使用 `root` / `root` 登录。
2. 进入「开始共享」或创建房间：房主创建房间后获得控制权。
3. 在房间内添加视频：输入 Bilibili BV 号 / MP4 直链，或从 WebDAV、FTP、OpenList 挂载点中浏览选择。
4. 把房间号或链接分享给好友，对方登录后加入即可同步观看。
5. 在播放器设置中可开启弹幕、语音，或切换到屏幕共享 / OBS 推流模式。

> 需要局域网 / 公网访问时，请参照 [部署](/guide/deploy) 与 [HTTPS 与证书](/guide/https) 配置。

## 常见问题

- 浏览器提示证书不安全？→ 见 [HTTPS 与证书](/guide/https)
- 无法连接 WebSocket / WebRTC？→ 见 [常见问题](/guide/faq)
- 想了解更多功能？→ 见 [使用指南](/usage/)
