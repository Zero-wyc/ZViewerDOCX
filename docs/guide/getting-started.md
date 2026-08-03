# 快速开始

ZViewer 系统首次启动时自动创建超级管理员账号：用户名 `root`，密码 `root`。生产环境部署后请立即修改默认密码。

## 源码版一键启动（推荐）

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

启动后访问：

- HTTP 模式：`http://localhost:4173`
- HTTPS 模式：`https://localhost:3333`

## 单文件 exe 版

无需安装 Node.js / npm，直接下载 [Releases](https://github.com/Zero-wyc/ZViewer/releases) 中的压缩包，解压后运行：

```bash
# Windows
start.bat              # 交互菜单
start.bat start        # 启动服务

# Linux
./start.sh             # 交互菜单
./start.sh start       # 启动服务
```

## 端口说明

| 服务 | 端口 | 说明 |
|---|---|---|
| 后端 REST API + WebSocket | 3333 | HTTP / HTTPS API 及 Socket.IO 实时通信 |
| 前端静态文件服务 | 4173 | HTTP 模式下的前端页面，含 API 反向代理 |
| RTMP 推流 | 3334 | OBS 推流端口 |
| HTTP-FLV 拉流 | 3335 | 直播流播放（Node Media Server） |

HTTP 模式下，用户通过 `http://localhost:4173` 访问前端页面，前端通过反向代理将 `/api`、`/socket.io`、`/live` 请求转发到后端，无需单独配置跨域。

## 首次使用

1. 使用 `root` / `root` 登录，进入管理后台**立即修改默认密码**。
2. 在「基础设置」中确认注册模式、房间创建权限等配置。
3. 回到首页创建房间，或通过房间号加入他人的房间。
4. 在挂载点管理中配置 WebDAV / FTP / OpenList 等视频源。

> 新用户注册后角色为 `guest`、状态为 `pending`，需由 `root` 在管理后台审核通过后才能正常使用，详见[权限模型](/admin/permissions)。
