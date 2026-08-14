# Usage Guide

This document provides a detailed introduction to ZViewerCLI's command-line arguments, configuration methods, local HTTP API, and how to compile it yourself.

---

## Command-Line Arguments

```text
zviewer-cli [options]

Options:
  -port int        Local HTTP service port (default 9333)
  -server string   ZViewer backend address
  -room string     Room ID
  -cookie string   Bilibili Cookie
  -setup           Launch local configuration page (default true)
  -no-open         Do not automatically open the browser
  -help            Show help
```

### Examples

```bash
# Start only the local configuration page (manually visit http://127.0.0.1:9333)
./zviewer-cli

# Start and automatically connect to a specified room
./zviewer-cli -server http://localhost:3333 -room abc123 -cookie "SESSDATA=xxx"

# Specify a port, do not automatically open the browser
./zviewer-cli -port 8080 -no-open
```

---

## Local Configuration Page

After starting the CLI, visit `http://127.0.0.1:9333` to access the configuration page.

### Configuration Fields

| Field | Description |
|-------|-------------|
| ZViewer Backend URL | Your ZViewer backend address, e.g., `http://localhost:3333` |
| Room ID | The room number to join |
| Bilibili Cookie | Your Bilibili login credentials |

### QR Code Login

The configuration page has a built-in Bilibili QR code login feature:

1. Click the "QR Code Login" button
2. Scan the QR code with the Bilibili App
3. After successful login, the Cookie will be automatically filled in and saved
4. Cookies obtained this way are the most stable and are recommended

### Configuration Persistence

The Cookie and user information are automatically saved to the `~/.zviewer/config.json` file and will be loaded automatically on the next startup, so no repeated configuration is needed.

---

## Local HTTP API

After starting, the CLI listens for HTTP requests locally. Below are the main endpoints.

### Health Check

```http
GET /health
```

### Get Current Configuration and Connection Status

```http
GET /api/config
```

### Configure and Connect

```http
POST /api/connect
Content-Type: application/json

{
  "serverUrl": "http://localhost:3333",
  "roomId": "abc123",
  "cookie": "SESSDATA=xxx"
}
```

### Resolve Bilibili Video

```http
GET /resolve?bvid=BVxxx&cid=123456&qn=120&preferMp4=false&forceDash=true
```

Returns the proxied `videoUrl` / `audioUrl` along with the original CDN addresses.

### Proxy Video Stream

```http
GET /proxy?url=<url-encoded-bilibili-cdn-url>
```

Supports the `Range` request header, suitable for DASH segmented loading.

### Get Bilibili Video Info

```http
GET /api/bili-info?bvid=BVxxx
```

### Generate DASH MPD

```http
GET /api/dash-mpd?bvid=BVxxx&cid=123456&qn=120
```

### QR Code Login

```http
GET /api/qr
GET /api/qr/poll?qrcode_key=xxx
```

---

## Building from Source

### Environment Requirements

- Go 1.22.5 or higher
- (Optional) [UPX](https://upx.github.io/) -- for compressing the executable to reduce file size

### Quick Build

```bash
cd ZViewerCLI
go build -o zviewer-cli .
```

### Optimized Build (Recommended)

Remove debug information to significantly reduce file size:

```bash
go build -ldflags="-s -w" -trimpath -o zviewer-cli .
```

### Using UPX Compression

[UPX](https://upx.github.io/) can compress the binary to about 30% of its original size.

**Installing UPX**:

```bash
# macOS
brew install upx

# Ubuntu/Debian
sudo apt install upx

# Arch Linux
sudo pacman -S upx
```

**Compression Commands**:

```bash
# Basic compression
upx --lzma zviewer-cli

# Maximum compression (recommended for Windows)
upx --best --lzma zviewer-cli.exe
```

### Cross-Compilation

Build for other platforms:

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

### One-Click Build Script

The project provides a `build.ps1` script that automates cross-compilation and compression for all platforms:

```powershell
.\build.ps1
```

Build artifacts are output to the `%TEMP%\zviewer-cli-dist\` directory.

| Platform | Compression Method | Expected Size |
|----------|-------------------|---------------|
| Windows amd64 | UPX maximum compression | ~2.4 MB |
| Linux amd64 | UPX normal compression | ~2.3 MB |
| Linux arm64 | UPX normal compression | ~2.0 MB |
| macOS arm64 | Skip UPX | ~7.0 MB |

---

## Frequently Asked Questions

### Browser did not open automatically after starting?

By default, the browser does not open automatically. Please manually visit `http://127.0.0.1:9333`. If you want it to open automatically, add `-no-open=false` when starting.

### Cookie validation failed?

- Make sure the Cookie contains a valid `SESSDATA`
- Cookies obtained via QR code login are usually the most stable
- When using the `-cookie` parameter, be aware of shell escaping for special characters

### Connected but the frontend is not using the CLI proxy?

- Make sure the "CLI Local High-Quality Proxy" switch is turned on in the room
- Confirm that the frontend and CLI are connected to the same room
- Check the browser console for CORS or network errors

### Video stream loading is slow or stuttering?

- CLI will automatically switch to a backup CDN when the primary CDN fails
- Check the network connectivity between your local machine and the Bilibili CDN
- Try lowering the quality (qn) and try again