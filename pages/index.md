---
layout: home

hero:
  name: ZViewerDOCX
  text: ZViewerDOCX 多人同步观影、追番与远程共享平台
  tagline: 房主控制播放进度，观众实时跟随。支持 Bilibili、WebDAV、FTP、OpenList、MP4 直链等多种视频源，内置屏幕共享、弹幕、评论、语音聊天等互动能力。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quickstart
    - theme: alt
      text: 查看 GitHub
      link: https://github.com/Zero-wyc/ZViewer

features:
  - icon: 🎥
    title: 一起看房间
    details: 创建或加入房间同步观看，房主控制播放进度，观众可申请控制。房主断线时服务器自动接管广播，播放不中断。
  - icon: 📺
    title: 多源视频解析
    details: 支持 Bilibili（DASH 音视频合并、清晰度切换）、MP4 直链、WebDAV、FTP、OpenList 等视频源，开箱即用。
  - icon: 💬
    title: 实时互动
    details: 弹幕、评论、画面标注、语音聊天（32~192 kbps 可配置），播放状态毫秒级同步。
  - icon: 🖥️
    title: 屏幕共享与推流
    details: 基于 WebRTC 的屏幕共享，支持 OBS RTMP 推流与 HTTP-FLV 拉流。
  - icon: 🚀
    title: 一键部署
    details: 单文件 exe、源码脚本、Docker 三种部署方式，自动签发 HTTPS 证书，支持 GitHub Actions 自动构建发布。
  - icon: 🔧
    title: 开放与可扩展
    details: npm workspaces 全 TypeScript 前后端，模块化 Socket 架构，ZViewerCLI 本地代理解锁大会员画质。
---