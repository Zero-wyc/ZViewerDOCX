# 使用指南

本文详细介绍 ZViewerCLI 的命令行参数、配置方式、本地 HTTP API 以及如何自行编译。

---

## 命令行参数

```text
zviewer-cli [选项]

选项:
  -port int        本地 HTTP 服务端口 (默认 9333)
  -server string   ZViewer 后端地址
  -room string     房间 ID
  -cookie string   Bilibili Cookie
  -setup           启动本地配置页面 (默认 true)
  -no-open         不自动打开浏览器
  -help            显示帮助
```

### 示例

```bash
# 仅启动本地配置页（手动访问 http://127.0.0.1:9333）
./zviewer-cli

# 启动并自动连接指定房间
./zviewer-cli -server http://localhost:3333 -room abc123 -cookie "SESSDATA=xxx"

# 指定端口，不自动打开浏览器
./zviewer-cli -port 8080 -no-open
```

---

## 本地配置页面

CLI 启动后，访问 `http://127.0.0.1:9333` 进入配置页面。

### 配置项

| 字段 | 说明 |
|------|------|
| ZViewer 后端地址 | 你的 ZViewer 后端地址，例如 `http://localhost:3333` |
| 房间 ID | 要加入的房间号 |
| Bilibili Cookie | 你的 Bilibili 登录凭证 |

### 二维码登录

配置页面内置了 Bilibili 二维码登录功能：

1. 点击「扫码登录」按钮
2. 用 Bilibili App 扫描二维码
3. 登录成功后，Cookie 会自动填入并保存
4. 这种方式获取的 Cookie 最稳定，推荐使用

### 配置持久化

Cookie 和用户信息会自动保存到 `~/.zviewer/config.json` 文件中，下次启动时自动加载，无需重复配置。

---

## 本地 HTTP API

CLI 启动后在本地监听 HTTP 请求，以下是主要接口。

### 健康检查

```http
GET /health
```

### 获取当前配置与连接状态

```http
GET /api/config
```

### 配置并连接

```http
POST /api/connect
Content-Type: application/json

{
  "serverUrl": "http://localhost:3333",
  "roomId": "abc123",
  "cookie": "SESSDATA=xxx"
}
```

### 解析 Bilibili 视频

```http
GET /resolve?bvid=BVxxx&cid=123456&qn=120&preferMp4=false&forceDash=true
```

返回包含代理后的 `videoUrl` / `audioUrl` 以及原始 CDN 地址。

### 代理视频流

```http
GET /proxy?url=<url-encoded-bilibili-cdn-url>
```

支持 `Range` 请求头，适合 DASH 分段加载。

### 获取 Bilibili 视频信息

```http
GET /api/bili-info?bvid=BVxxx
```

### 生成 DASH MPD

```http
GET /api/dash-mpd?bvid=BVxxx&cid=123456&qn=120
```

### 二维码登录

```http
GET /api/qr
GET /api/qr/poll?qrcode_key=xxx
```

---

## 自行编译

### 环境要求

- Go 1.22.5 或更高版本
- （可选）[UPX](https://upx.github.io/)——用于压缩可执行文件，减小体积

### 快速编译

```bash
cd ZViewerCLI
go build -o zviewer-cli .
```

### 优化编译（推荐）

移除调试信息，显著减小体积：

```bash
go build -ldflags="-s -w" -trimpath -o zviewer-cli .
```

### 使用 UPX 压缩

[UPX](https://upx.github.io/) 能将二进制体积压缩至原来的 30% 左右。

**安装 UPX**：

```bash
# macOS
brew install upx

# Ubuntu/Debian
sudo apt install upx

# Arch Linux
sudo pacman -S upx
```

**压缩命令**：

```bash
# 基本压缩
upx --lzma zviewer-cli

# 极限压缩（推荐 Windows 使用）
upx --best --lzma zviewer-cli.exe
```

### 交叉编译

为其他平台编译：

```bash
# Windows amd64
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o zviewer-cli-windows-amd64.exe .

# Linux amd64
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o zviewer-cli-linux-amd64 .

# Linux arm64
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o zviewer-cli-linux-arm64 .

# macOS Apple Silicon
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build -ldflags="-s -w" -trimpath -o zviewer-cli-darwin-arm64 .
```

### 一键编译脚本

项目提供了 `build.ps1` 脚本，自动完成所有平台的交叉编译与压缩：

```powershell
.\build.ps1
```

编译产物输出到 `%TEMP%\zviewer-cli-dist\` 目录。

| 平台 | 压缩方式 | 预期大小 |
|------|---------|---------|
| Windows amd64 | UPX 极限压缩 | ~2.4 MB |
| Linux amd64 | UPX 正常压缩 | ~2.3 MB |
| Linux arm64 | UPX 正常压缩 | ~2.0 MB |
| macOS arm64 | 跳过 UPX | ~7.0 MB |

---

## 常见问题

### 启动后浏览器未自动打开？

默认不自动打开浏览器，请手动访问 `http://127.0.0.1:9333`。如需自动打开，启动时添加 `-no-open=false`。

### Cookie 验证失败？

- 确认 Cookie 包含有效的 `SESSDATA`
- 二维码登录获取的 Cookie 通常最稳定
- 使用 `-cookie` 参数时注意 Shell 对特殊字符的转义

### 已连接但前端未使用 CLI 代理？

- 确认房间内「CLI 本地高画质代理」开关已开启
- 确认前端与 CLI 连接的是同一个房间
- 检查浏览器控制台是否有 CORS 或网络错误

### 视频流加载卡顿？

- CLI 会自动在主 CDN 失败时切换到备用 CDN
- 检查本地网络到 Bilibili CDN 的连通性
- 尝试降低清晰度（qn）再试