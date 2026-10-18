# 基础教程

ZViewer 是多人同步观影、追番与远程共享平台。日常安装与使用看这一章即可；实现细节见[拓展教程](/advanced/)。

## 快速上手

### 1. 下载

从 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 下载对应系统的压缩包（Windows `zviewer-windows-x64.zip` / Linux `zviewer-linux-x64.tar.gz`），解压。

### 2. 启动

```bash
# Windows：双击 start.bat 进入交互菜单，选 1 启动
start.bat start

# Linux
./start.sh start
```

### 3. 登录

访问 `http://localhost:3333`。首次启动自动创建超级管理员 `root` / `root`，登录后请立即改密：右上角用户菜单 → 个人资料 → 编辑信息 → 修改密码。

### 4. 创建房间

「开始共享」→ 选择模式（一起看 / 投屏）→ 进入房间。把房间号或分享链接发给他人，对方可通过房间号、房间列表或链接加入。

### 5. 添加影片

「添加影片」面板选择来源：B站（BV 号或链接解析）、直链（MP4 等）、WebDAV / FTP / OpenList 挂载（需先在个人资料页或后台配置）。点击影片即开始播放，进度实时同步给所有成员。

## 端口

| 端口 | 用途 | 对外 |
|---|---|---|
| 3333 | 统一入口：API、WebSocket、前端页面、`/live` FLV 代理 | 是 |
| 3334 | RTMP 推流（OBS） | 是 |
| 3335 | HTTP-FLV 拉流（内部） | 否 |

## 浏览器要求

需 Chromium 内核 130+（Chrome / Edge 等）。Safari 与 Firefox 对 MSE / MKV 解码支持不完整，可能出现卡顿、无法解码或字幕异常。

## 本分区目录

| 页面 | 内容 |
|---|---|
| [安装与部署](/basic/install) | 单文件 / 源码 / Docker / 数据持久化 |
| [功能说明](/basic/features) | 全部功能的使用说明 |
| [手机端 App](/basic/mobile) | Android / HarmonyOS 客户端与平台差异 |
| [ZViewer CLI](/basic/cli) | 本地代理客户端安装与使用 |
| [管理后台](/basic/admin) | 用户审核、房间管理、系统设置 |
| [网络连接与内网穿透](/basic/network) | FRP / ZeroTier / IPv6 |
| [常见问题](/basic/faq) | 证书、WebSocket、数据库等 |

需要 HTTPS 时用一键脚本签发并启动：`start.bat https` / `./start.sh https`，机制见 [HTTPS 证书](/advanced/https)。新手用内网穿透自带的自动 HTTPS，或用自签证书即可——自签只会弹一次警告，不影响使用。
