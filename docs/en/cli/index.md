# ZViewerCLI Local Proxy

## Overview

ZViewerCLI is a lightweight proxy program that runs on your local machine, designed to solve the problem that browsers cannot directly use your Bilibili Cookie to obtain high-quality video streams.

In short: **Install the CLI, and you can watch Bilibili premium member quality videos in ZViewer.**

---

## Why ZViewerCLI is Needed

When resolving Bilibili videos directly in ZViewer, there are three limitations:

1. **Cookie Security**: Browsers cannot safely send your Bilibili Cookie to the server (Cookie should stay on your machine)
2. **CORS and Hotlink Protection**: Bilibili CDN has strict requirements on request headers (Referer, Origin, User-Agent), and direct browser requests are easily blocked
3. **Quality Restrictions**: The Bilibili Cookie configured on the server may not be a premium member, preventing access to 1080P+ / 4K and other high-quality streams

ZViewerCLI's solution: **Cookie stays only on your local machine, video resolution and stream requests are handled locally**, then forwarded to the browser, perfectly bypassing the above limitations.

## Features

- **Local Cookie Resolution**: Uses your own Bilibili Cookie to resolve videos, supporting premium member high quality
- **Video Stream Proxy**: Proxies Bilibili CDN video/audio streams, injecting correct request headers to bypass CORS and hotlink protection
- **Automatic CDN Switching**: When a single CDN connection fails, automatically tries backup CDN addresses
- **WebSocket Room Registration**: Automatically registers with the ZViewer room, enabling automatic discovery and activation by the frontend
- **QR Code Login**: Built-in Bilibili QR code login page, no need to manually copy Cookie
- **Local Configuration Page**: Automatically opens a browser configuration page on startup, just fill in the backend address, room ID, and Cookie to connect
- **Auto-Reconnect on Disconnect**: Uses exponential backoff strategy to automatically reconnect when disconnected from the ZViewer backend

---

## How It Works

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   ZViewer Backend │  ◄──────────────►  │  ZViewerCLI     │
│  (Room State Sync)│                     │  (Your Machine)  │
└─────────────────┘                     └────────┬────────┘
       ▲                                         │
       │ Socket.IO Sync Playback State            │ Local Resolution/Proxy
       │                                         ▼
┌──────┴──────────┐                    ┌─────────────────┐
│   Your Browser   │  ◄─ Local Proxy URL─│  Bilibili CDN   │
│  (ZViewer Frontend)│    (Bypasses CORS)  │  (Video/Audio Streams)│
└─────────────────┘                    └─────────────────┘
```

Core flow:

1. You start ZViewerCLI locally, configure the ZViewer backend address, room ID, and Bilibili Cookie
2. ZViewerCLI connects to the ZViewer backend via WebSocket and registers its proxy address with the room
3. When the frontend detects a CLI proxy available in the room, it preferentially sends Bilibili video resolution requests to the local CLI
4. CLI uses your local Cookie to resolve the video and returns proxied video/audio URLs
5. The browser requests the local proxy address, and CLI requests the real data from the upstream Bilibili CDN and forwards it to the browser

---

## Quick Start

### Step 1: Download

Download the version corresponding to your operating system from [ZViewerCLI Releases](https://github.com/Zero-wyc/ZViewerCLI/releases):

| Operating System | Download File |
|------------------|---------------|
| Windows amd64 | `zviewer-cli-windows-amd64.exe` |
| macOS Apple Silicon | `zviewer-cli-darwin-arm64` |
| Linux amd64 | `zviewer-cli-linux-amd64` |
| Linux arm64 | `zviewer-cli-linux-arm64` |

### Step 2: Start

**Windows**: Double-click `zviewer-cli-windows-amd64.exe`, or run in a terminal:

```powershell
.\zviewer-cli-windows-amd64.exe
```

**macOS / Linux**:

```bash
chmod +x zviewer-cli-darwin-arm64
./zviewer-cli-darwin-arm64
```

After starting, manually visit `http://127.0.0.1:9333` to access the configuration page.

### Step 3: Configure and Connect

Fill in the following on the configuration page:

1. **ZViewer Backend URL**: e.g., `http://localhost:3333` or `https://your-domain.com`
2. **Room ID**: The room number you want to join
3. **Bilibili Cookie**: Can be obtained automatically via QR code login, or pasted manually

Click the "Connect" button; CLI will verify the Cookie and register with the room.

### Step 4: Enable in the Room

1. Enter the ZViewer room
2. When adding a Bilibili video, open "Bilibili Resolution Settings"
3. Toggle the **"CLI Local High-Quality Proxy"** switch on
4. The player will now load videos through the local CLI, enjoying premium member quality

> If no CLI proxy is detected in the room, the switch will appear disabled. Make sure the CLI has successfully connected.

---

## Relationship with ZViewer

ZViewerCLI is an **optional companion component** of ZViewer. You can use ZViewer's basic resolution functionality without installing the CLI.

| Scenario | Without CLI | With CLI |
|----------|-------------|----------|
| Regular Bilibili videos | Yes, plays normally | Yes, plays normally |
| Premium member exclusive videos | No, cannot play | Yes, can play |
| High quality (1080P+/4K) | Depends on server configuration | Yes, your personal premium member benefits |
| Video stream stability | Limited by CORS | Yes, local proxy, stable and reliable |

The main ZViewer project handles room state synchronization, user management, and playback control; ZViewerCLI handles localized Bilibili resolution and stream proxy. The two collaborate via WebSocket and local HTTP API.

---

## Next Steps

- See the [Usage Guide](/en/cli/guide) -- command-line arguments, build methods, frequently asked questions