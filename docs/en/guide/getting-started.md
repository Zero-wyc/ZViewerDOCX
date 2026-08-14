# Quick Start

Welcome to ZViewer! This tutorial will guide you through the complete process from scratch: downloading, starting, logging in, creating a room, adding videos, and inviting friends to watch together.

---

## Step 1: Download ZViewer

ZViewer offers two ways to run: **single-file version** and **source code version**.

### Option 1: Single-file Version (Recommended)

No need to install Node.js or npm. Just download and extract to run.

1. Go to the [ZViewer Releases page](https://github.com/Zero-wyc/ZViewer/releases)
2. Download the appropriate archive for your operating system:
   - **Windows**: Download `zviewer-windows-x64.zip`
   - **Linux**: Download `zviewer-linux-x64.tar.gz`
3. Extract to any folder (e.g., `D:\ZViewer` or `~/ZViewer`)

The extracted directory structure is as follows:

```
zviewer-windows-x64/
├── zviewer-backend.exe     # Backend service (unified hosting of frontend pages)
├── zviewer-cert.exe        # SSL certificate tool
├── start.bat               # Startup script (Windows)
└── start.sh                # Startup script (Linux)
```

### Option 2: Source Code Version

Suitable for users with Node.js development experience.

```bash
# Clone the project
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer

# Install dependencies
npm install
```

---

## Step 2: Start the Service

### Single-file Version Startup

**Windows**: Double-click `start.bat`, or open a terminal and run:

```powershell
# Interactive menu mode
start.bat

# Or start directly
start.bat start
```

**Linux**:

```bash
./start.sh start
```

After starting, the terminal will display an interactive menu:

```
========================================
  ZViewer Service Management
========================================
  1) Start Service (HTTP)
  2) Start Backend Only (HTTP / HTTPS optional)
  3) Stop Service
  4) Restart Service
  5) View Status
  6) View Logs
  7) One-click SSL Certificate Issuance
  8) HTTPS Start (Auto-issue Certificate)
  9) Build Frontend and Backend (Source Code Version)
  0) Exit
```

For first-time use, select **1) Start Service (HTTP)**.

### Source Code Version Startup

```bash
.\start-prod.bat start      # Windows
./start-prod.sh start       # Linux / macOS
```

### Access After Starting

Once the service is running, open a browser and visit:

- **HTTP Mode**: `http://localhost:3333`
- **HTTPS Mode**: `https://localhost:3333`

---

## Step 3: Log In

When the service starts for the first time, a super admin account is automatically created:

| Username | Password |
|----------|----------|
| `root`   | `root`   |

1. Open your browser and visit `http://localhost:3333`
2. You will see the home page. The green **Connected** indicator at the bottom shows the service is running normally.
3. Click the user avatar area in the top-right corner to log in.
4. Enter the username `root` and password `root`, then click "Log In".

> Unauthenticated users are automatically assigned a **guest** identity. Guests can join rooms to watch, but cannot create rooms.

---

## Step 4: Change the Default Password (Important!)

**You must change the default password immediately** after deploying to production, otherwise others can log into your admin panel.

1. After logging in, click the user menu in the top-right corner (showing your username) and select "Profile".
2. On the profile page, click the "Edit Info" button.
3. In the editing window that appears, find "Change Password" in the **right column**.
4. Enter the current password `root`, a new password (at least 4 characters), and confirm the new password.
5. Click "Confirm Change".

> It is also recommended to change the JWT secrets (`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`). See [Environment Variables](/en/dev/env).

---

## Step 5: Create a Room

1. After changing the password, return to the home page (click the ZViewer icon in the top-left or the navigation bar).
2. Click the **"Start Sharing"** button.
3. You will enter the room page. Since there is no room ID yet, the **room creation panel** will be displayed.
4. Select a room mode:
   - **Watch Together**: Everyone watches the same video synchronously.
   - **Screen Share**: The sharer broadcasts their screen.
5. After creation, the page automatically enters the room.

> If the "Start Sharing" button is disabled, it means the admin has set "Only admins can create rooms". Contact the admin or log in with the `root` account.

---

## Step 6: Get to Know the Room Interface

After entering the room, you will see the following layout:

### Top Area
- **Back Button**: Exit the room.
- **Room Name**: Displays the current room name. The host can click to edit it.
- **Mode Switch**: Switch between `Watch Together` / `Screen Share` (available to the host).

### Middle Area
- **Player**: The video playback area, occupying most of the screen.

### Bottom Control Card (Three-column Grid)
- **Room Info** (Left): Displays the room number, share link, viewer list, and permission settings.
- **Video List** (Middle): Videos added to the current room.
- **Add Video** (Right): Add videos from various sources.

### Right Panel
- **Comments / Danmaku / Chat**: Real-time interaction with viewers.

---

## Step 7: Invite Friends

After creating your room, share the room number with your friends:

1. In the room, locate the **Room Info Panel** at the bottom-left.
2. Switch to the "Info" tab.
3. You will see:
   - **Room Number**: A numeric ID (e.g., `123456`).
   - **Share Link**: A complete link you can copy and send to friends.
4. Click the copy button next to the room number or link and send it to your friends.

Friends can join using the following methods:

**Method 1: By Room Number**
1. On the home page, click the "Join Room" button.
2. Enter the room number and click "Join".

**Method 2: Via Room List**
1. On the home page, click the "Room List" button.
2. Find your room in the list and click "Join Room".

**Method 3: Via Share Link**
1. Open the shared link directly.

> If the room has a password set, friends will need to enter it when joining. If "Approval Required" is enabled, the host will receive a join request notification and must click "Accept".

---

## Step 8: Add a Video

After creating the room, you need to add a video to start watching.

1. In the room interface, find the **"Add Video" Panel** at the bottom-right.
2. Select your desired video source:

### Using a Bilibili Video (Most Common)

1. In the "Add Video" panel, select the **Bilibili** tab.
2. Paste a Bilibili video link, BV number, or AV number.
   - Example: `https://www.bilibili.com/video/BV1GJ411x7o` or `BV1GJ411x7o`
3. Click the parse button and wait for parsing to complete.
4. Once parsed successfully, the video will be automatically added to the video list.

### Using a Direct MP4 Link

1. Select the **Direct Link** tab.
2. Enter the direct URL of the video file (e.g., `https://example.com/video.mp4`).
3. Click "Add".

### Using WebDAV / FTP Mounts

1. First configure the mount points in your profile page or admin panel.
2. In the "Add Video" panel, select the corresponding mount tab.
3. Browse the directory, find the video file, and click to play.

---

## Step 9: Start Watching

After adding the video, everything is ready!

- **Host**: Click a video in the list to start playback. Playback controls (play, pause, seek, speed) are synced to all viewers in real time.
- **Viewers**: After joining the room, the player automatically syncs to the host's playback progress without any action needed.
- **Danmaku**: Send danmaku from the right panel, or load official Bilibili danmaku.
- **Comments**: Chat in the comments section to communicate with friends in real time.
- **Subtitles**: The video supports native subtitle rendering, with auto-detection, auto-adding, or manual loading of subtitle files (supports SRT, ASS, and other formats).

---

## Port Reference

| Service | Port | Description |
|---|---|---|
| Backend Service (Unified Entry) | 3333 | HTTP / HTTPS API, WebSocket, frontend static files, SPA fallback |
| RTMP Streaming | 3334 | OBS streaming port (separate port; RTMP is a TCP binary protocol and cannot be multiplexed with HTTP) |
| HTTP-FLV Playback | 3335 | Live stream playback (Node Media Server, proxied through the backend `/live` endpoint) |

In HTTP mode, users access all features at `http://localhost:3333`.

---

## Next Steps

- Learn about [detailed room settings](/en/features/rooms) -- passwords, viewer permissions, approval, etc.
- Explore [more video sources](/en/features/video-sources) -- Bilibili premium, WebDAV, FTP, etc.
- Configure [HTTPS and certificates](/en/guide/https) -- so the browser no longer says "Not Secure".
- Read the [admin panel documentation](/en/admin/admin-panel) -- user management, room management, system settings.