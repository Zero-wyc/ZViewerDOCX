# ZViewer 文档

ZViewer —— 多人同步观影、追番与远程共享平台。房主控制播放进度，观众实时跟随，异地也能像坐在一起看片。

## 特点

- **一起看** —— 房主控制播放 / 暂停 / 跳转 / 倍速，观众实时跟随；房主断线由服务器继续广播，房主离开后房间保留宽限期
- **一起听** —— 网易云 + B 站双音源同步，歌词页含频谱可视化、翻译 / 罗马音、评论与弹幕，可叠加 PV 视频背景
- **多源接入** —— B 站（含 b23.tv 短链）、MP4 直链、WebDAV、FTP、OpenList、Emby / Jellyfin、服务器文件
- **格式兼容** —— 浏览器端将 MKV / AVI / TS / WMV 重封装为 fMP4，DTS / AC3 / EAC3 实时转 AAC，无需服务端 FFmpeg
- **弹幕与字幕** —— B 站 / DandanPlay 弹幕多轨叠加，字幕原生解析渲染，支持自动识别与手动添加
- **互动** —— 评论面板、观众申请控制（可自动通过）、语音聊天与语音禁言、OBS 推流与 WebRTC 屏幕共享
- **角色权限** —— 房主 / 房管 / 观众三级，房管上限 10 名，可管理影片、禁言与移除成员
- **主题** —— Material You 壁纸取色、明暗切换、玻璃拟态与透明度分层
- **部署运维** —— 单文件 exe、源码、Docker、自动构建；一键 HTTPS、房间流量统计、带进度提示的自动更新
- **客户端** —— 手机端 App（Android / HarmonyOS）与 ZViewerCLI 本地代理

## 技术栈

前端 React + TypeScript + Vite；后端 Node.js + Express + Socket.IO；数据库 SQLite（内置，免安装）；流媒体 Node Media Server（RTMP / HTTP-FLV）；WebRTC 屏幕共享。

## 文档

本文档站基于 VitePress 构建，另提供[英文版](/en/)。

**基础教程** — [快速上手](/basic/) · [安装部署](/basic/install) · [功能说明](/basic/features) · [手机端](/basic/mobile) · [ZViewerCLI](/basic/cli) · [管理后台](/basic/admin) · [内网穿透](/basic/network) · [常见问题](/basic/faq)

**拓展教程** — [架构总览](/advanced/) · [房间同步](/advanced/sync) · [视频源](/advanced/video-pipeline) · [音乐管线](/advanced/music-pipeline) · [代理协议](/advanced/cli-protocol) · [主题系统](/advanced/theme-system) · [HTTPS 证书](/advanced/https) · [鉴权与权限](/advanced/auth) · [REST API](/advanced/api) · [环境变量](/advanced/env) · [构建与更新](/advanced/build-update)

## 许可

本项目遵循 [CC BY-NC-SA](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.en) 许可。
