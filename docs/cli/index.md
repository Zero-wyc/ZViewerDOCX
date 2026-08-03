# ZViewerCLI 本地代理

## 功能概述

ZViewerCLI 是一个运行在你本地的轻量级代理程序，用于解决浏览器无法直接使用你的 Bilibili Cookie 获取高画质视频的问题。

简单来说：**装上 CLI，你就能在 ZViewer 中观看 Bilibili 大会员画质的视频了。**

---

## 为什么需要 ZViewerCLI？

在 ZViewer 中直接解析 Bilibili 视频时，存在三个限制：

1. **Cookie 安全**：浏览器无法安全地将你的 Bilibili Cookie 发送到服务端（Cookie 应该留在你的电脑上）
2. **CORS 与防盗链**：Bilibili CDN 对请求头（Referer、Origin、User-Agent）有严格要求，浏览器直接请求容易被拦截
3. **画质限制**：服务端配置的 Bilibili Cookie 可能不是大会员，无法获取 1080P+ / 4K 等高画质

ZViewerCLI 的解决方案：**Cookie 只留在你的本机，视频解析和流请求都在本地完成**，再转发给浏览器，完美绕过以上限制。

## 功能特性

- **本地 Cookie 解析**：使用你自己的 Bilibili Cookie 解析视频，支持大会员高画质
- **视频流代理**：代理 Bilibili CDN 视频/音频流，注入正确的请求头，绕过 CORS 与防盗链
- **CDN 自动切换**：单个 CDN 连接失败时，自动尝试备用 CDN 地址
- **WebSocket 房间注册**：自动向 ZViewer 房间注册，前端可自动发现并启用
- **二维码登录**：内置 Bilibili 二维码登录页面，无需手动复制 Cookie
- **本地配置页面**：启动后自动打开浏览器配置页，填写后端地址、房间 ID、Cookie 即可连接
- **断线自动重连**：与 ZViewer 后端断开后，使用指数退避策略自动重连

---

## 工作原理

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   ZViewer 后端   │  ◄──────────────►  │  ZViewerCLI     │
│  (房间状态同步)  │                     │  (你的电脑上)    │
└─────────────────┘                     └────────┬────────┘
       ▲                                         │
       │ Socket.IO 同步播放状态                    │ 本地解析/代理
       │                                         ▼
┌──────┴──────────┐                    ┌─────────────────┐
│   你的浏览器      │  ◄─ 本地代理 URL ──│  Bilibili CDN   │
│  (ZViewer 前端)   │    (绕过 CORS)    │  (视频/音频流)   │
└─────────────────┘                    └─────────────────┘
```

核心流程：

1. 你在本地启动 ZViewerCLI，配置 ZViewer 后端地址、房间 ID 和 Bilibili Cookie
2. ZViewerCLI 通过 WebSocket 连接到 ZViewer 后端，向房间注册自己的代理地址
3. 当前端检测到房间内有 CLI 代理可用时，优先将 Bilibili 视频解析请求发送给本地 CLI
4. CLI 使用你的本地 Cookie 解析视频，返回代理后的视频/音频 URL
5. 浏览器请求本地代理地址，CLI 再向上游 Bilibili CDN 请求真实数据并转发给浏览器

---

## 快速开始

### 第一步：下载

从 [ZViewerCLI Releases](https://github.com/Zero-wyc/ZViewerCLI/releases) 下载对应你操作系统的版本：

| 操作系统 | 下载文件 |
|----------|---------|
| Windows amd64 | `zviewer-cli-windows-amd64.exe` |
| macOS Apple Silicon | `zviewer-cli-darwin-arm64` |
| Linux amd64 | `zviewer-cli-linux-amd64` |
| Linux arm64 | `zviewer-cli-linux-arm64` |

### 第二步：启动

**Windows**：双击 `zviewer-cli-windows-amd64.exe`，或在终端中运行：

```powershell
.\zviewer-cli-windows-amd64.exe
```

**macOS / Linux**：

```bash
chmod +x zviewer-cli-darwin-arm64
./zviewer-cli-darwin-arm64
```

启动后，手动访问 `http://127.0.0.1:9333` 进入配置页面。

### 第三步：配置并连接

在配置页面填写：

1. **ZViewer 后端地址**：例如 `http://localhost:3333` 或 `https://your-domain.com`
2. **房间 ID**：你想加入的房间号
3. **Bilibili Cookie**：可通过二维码登录自动获取，或手动粘贴

点击「连接」按钮，CLI 会验证 Cookie 并注册到房间。

### 第四步：在房间中启用

1. 进入 ZViewer 房间
2. 在添加 Bilibili 视频时，打开「Bilibili 解析设置」
3. 开启 **「CLI 本地高画质代理」** 开关
4. 此时播放器会通过本地 CLI 加载视频，享受大会员画质

> 如果房间内没有检测到 CLI 代理，开关会显示为不可用状态。请确认 CLI 已成功连接。

---

## 与 ZViewer 的关系

ZViewerCLI 是 ZViewer 的**可选配套组件**。不装 CLI 也能正常使用 ZViewer 的基础解析功能。

| 场景 | 无 CLI | 有 CLI |
|------|--------|--------|
| 普通 B 站视频 | ✅ 正常播放 | ✅ 正常播放 |
| 大会员专享视频 | ❌ 无法播放 | ✅ 可播放 |
| 高画质（1080P+/4K） | 取决于服务端配置 | ✅ 你的个人大会员权益 |
| 视频流稳定性 | 受 CORS 限制 | ✅ 本地代理，稳定可靠 |

ZViewer 主项目负责房间状态同步、用户管理、播放控制；ZViewerCLI 负责本地化的 Bilibili 解析与流代理。两者通过 WebSocket 和本地 HTTP API 协作。

---

## 下一步

- 查看[使用指南](/cli/guide)——命令行参数、构建方法、常见问题