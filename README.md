# ZViewer 文档

ZViewer —— 多人同步观影、追番与远程共享平台。

让一群人在不同地点也能像坐在一起一样看番、看电影。房主控制播放进度，观众实时跟随。

## 最新功能变更

| 变更 | 说明 |
|------|------|
| 🎙️ 语音聊天改为服务器中转 | 从 P2P 改为服务器中转模式，解决 NAT 时代 P2P 封锁导致的无法语音聊天问题，默认音频码率 128kbps |
| 📝 字幕系统重写 | 不再转换为 WebVTT，原生解析各格式并直接用 HTML/CSS 渲染，支持自动识别与手动添加 |
| 🎬 FFmpeg 集成 | 内置 FFmpeg 自动下载，初步支持 DTS 音频流播放 |
| 🔐 Bilibili Cookie 登录 | 新增 Bilibili Cookie 登录方式，方便绑定大会员账号 |
| 📦 弹幕轨道持久化 | 弹幕轨道逻辑重写，支持屏蔽词、已删除弹幕持久化，跨房间同步 |
| 🔗 WebDAV/OpenList 重构 | 直链与代理模式重构，修复挂载问题 |
| 🖥️ OBS 推流控制栏 | OBS 推流添加控制栏，屏幕共享添加自动显隐 |
| 🔒 Let's Encrypt IP 证书 | 一键签发 SSL 证书支持 IP 地址 |
| 🚀 一键 HTTPS 启动 | 启动脚本支持 HTTPS 模式，自动签发证书 |
| ⬇️ 自动更新系统 | 版本更新添加下载进度条与阶段提示，支持 CDN 加速 |

## 技术栈

- **前端**：React + TypeScript + Vite
- **后端**：Node.js + Express + Socket.IO
- **数据库**：SQLite（内置，无需额外安装）
- **流媒体**：Node Media Server（RTMP/HTTP-FLV）
- **其他**：WebRTC（屏幕共享）、WebSocket（实时通信）

## 文档站点

本文档站基于 VitePress 构建，主要内容：

- [快速开始](/guide/getting-started) — 从零开始搭建 ZViewer
- [功能特性](/features/rooms) — 一起看房间、视频源、弹幕、互动、屏幕共享等
- [部署指南](/guide/deployment) — 单文件、Docker、源码部署
- [管理后台](/admin/permissions) — 用户管理、权限模型
- [开发指南](/dev/setup) — 本地开发、项目结构、API 参考

## 许可

本项目遵循 [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en) 许可。