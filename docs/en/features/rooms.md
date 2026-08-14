# Room Features · Beginner's Guide

> Watch videos and share screens with friends, starting from this page.

---

## 1. Feature Overview

**Room** is the core of ZViewer's multi-user interaction. You can create a room, invite friends to join, and watch videos synchronously, share screens, or chat via voice in real time.

Core capabilities:

- **Synchronized Watching**: When the host plays, pauses, or seeks, everyone's画面 stays in sync.
- **Screen Sharing**: The sharer streams their screen or application window in real time.
- **Audience Management**: The host can kick, mute, approve join requests, and transfer host privileges.
- **Danmaku and Comments**: Chat while watching, with support for Bilibili-style danmaku and pen annotations.
- **Disconnect Protection**: If the host briefly disconnects, the room does not close immediately and viewers continue watching.

---

## 2. Room Mode Comparison

| Item | Watch Together | Screen Share |
|------|----------------|--------------|
| **What it does** | Everyone watches the same video link synchronously | The sharer broadcasts their screen/window in real time |
| **Best for** | Watching series and movies together | Demonstrations, remote collaboration, game streaming |
| **Playback control** | Host has full control; viewers can request control | The sharer controls their own stream |
| **Video source** | Paste an online video link or add from the room list | Local screen/window capture by the sharer |
| **Network requirements** | mp4 mode carries minimal sync data traffic; dash mode relays through the server, requiring higher server bandwidth | Higher |
| **Latency** | Low (sync playback, transmission delay) | Medium (WebRTC real-time transmission) |
| **Viewer count** | Almost unlimited | Limited by the sharer's upstream bandwidth |

> There is also an **OBS stream-push mode** for professional live streaming scenarios. See [Screen Sharing and Streaming](/en/features/screenshare).

---

## 3. Creating a Room

Creating a room takes just three steps:

1. **Open the homepage** and click the **"Start Sharing"** button in the center of the page, or the **"Create Room"** button in the top-right corner.
2. **Select a mode**: In the popup, choose **"Watch Together"** or **"Screen Share"**.
3. **Enter the room automatically**: The system instantly creates the room, and you become the **Host** and enter the room interface.

> **Tip**: You do not need to register an account to create a room. The first time you use it, the system will prompt you to set a **nickname** so your friends can recognize you.

---

## 4. Room Interface Overview

Once inside the room, you will see four main areas:

### Top Bar

- **Room Name**: Displays the current room name. Click to edit.
- **Room ID**: A numeric ID that you can share with friends for them to join.
- **Online Count**: Shows the current number of online viewers.
- **"Invite" Button**: Click to show sharing options.
- **"Settings" Button**: A gear icon that opens the room settings panel.
- **"Leave Room" Button**: Exit and close the room (only the host can close it).

### Player Area (Watch Together Mode)

The central main area is the video player, supporting:

- **Play/Pause**: Click the video or press the spacebar.
- **Progress Bar**: Drag to seek.
- **Volume Control**: Hover to adjust.
- **Playback Speed**: Supports 0.5x to 2x speed.
- **Fullscreen**: Click the fullscreen icon in the bottom-right corner.

> In Screen Share mode, the central area displays the sharer's real-time stream.

### Bottom Three Cards

Below the player, there are three cards that expand when clicked:

| Card | Content |
|------|---------|
| **Video List** | All videos added to the current room; can switch, reorder, and add new ones |
| **Chat** | Real-time comments — supports text messages, danmaku mode, and pen annotations |
| **Viewer List** | Online viewers, showing nicknames and roles (host/viewer) |

### Right Panel (Room Info)

Click the **">"** arrow on the right edge to expand the room info panel, which contains three tabs.

---

## 5. Room Info Panel (Three Tabs)

### Info Tab

- **Room ID**: Copy and send to friends. They can enter it on the homepage to join.
- **Share Link**: Copy the link directly and send it to friends. They can click it to join.
- **Room Name**: The host can change the room's display name.
- **Current Mode**: Shows "Watch Together" or "Screen Share".

### Permissions Tab

The host can configure room access control:

| Setting | Description |
|---------|-------------|
| **Room Password** | When enabled, joiners must enter a password to enter |
| **Max Members** | Limits the maximum number of viewers in the room (including the host) |
| **Join Approval** | When enabled, new viewers require the host to click "Approve" or "Deny" in a notification |
| **Auto Approve** | When approval is enabled, whitelisted or followed users are automatically approved without manual confirmation |

---

## 6. Three Ways to Invite Friends

### Method 1: Room ID

Copy the **Room ID** from the room info panel and send it to your friends. On the homepage, they click **"Join Room"** and enter the Room ID.

### Method 2: Share Link

Click the **"Invite"** button on the top bar, select **"Copy Link"**, and send the link to your friends. They click the link to enter the room directly (if a password is set, they will be prompted to enter it).

### Method 3: Room List

Friends can browse the **"Public Rooms"** list on the homepage, find your room, and click the **"Join"** button. The host can set the room to "Public" or "Unlisted" in the permissions settings.

---

## 7. Joining a Room — Scenarios

Depending on the host's settings, joining a room works differently:

### No Password + No Approval

Click the link or enter the Room ID to **enter the room directly** and start watching.

### Password Protected

A **password input** dialog appears before entering. Enter the correct password to proceed. The password is set by the host in the Permissions tab.

### Requires Approval

The host has enabled "Join Approval". When you click join, the page shows **"Waiting for host approval"**. The host receives a notification and clicks "Approve" for you to enter.

### Room Full

If the room has reached the "Max Members" limit, you will see a **"Room is full"** message and cannot join.

---

## 8. Host Disconnect Protection

ZViewer has a robust disconnect protection mechanism to prevent the room from crashing if the host temporarily disconnects:

| Phase | Behavior |
|-------|----------|
| **Disconnected (0-10 seconds)** | The server takes over playback state and continues broadcasting the current progress to viewers. Viewers experience **no interruption** |
| **Disconnected (10 seconds - 10 minutes)** | Viewers can freely control playback (pause/seek). The room runs normally |
| **Timeout close (after 10 minutes)** | If the host has not reconnected, the room automatically closes and all viewers are removed |
| **Host reconnects** | If the host reconnects within 10 minutes, control is automatically restored and playback state syncs to the latest position |

> **Tip**: If it is just a network fluctuation, there is no need to worry — the room will wait for you.

---

## 9. Frequently Asked Questions

### Q: What is the maximum number of people who can watch together?

A: There is no hard limit, but it is recommended to keep it under 10 people for the best experience, depending on the host's network bandwidth and server load.

### Q: Do I need to register an account to join a room?

A: No. However, registering allows you to keep your avatar and nickname settings.

### Q: Why can't I see the video?

A: Check the following:
- Is the video link valid (publicly accessible)?
- Is it being blocked by a browser ad blocker (try disabling the extension or using incognito mode)?
- Are you in approval-pending state and have not yet been approved by the host?

### Q: In Screen Share mode, can the other person see my entire screen?

A: You can choose to share your **entire screen**, a **specific application window**, or a **browser tab**. It is recommended to share only the window you need to protect your privacy.

### Q: What happens when the host leaves?

A: When the host leaves, the room automatically closes and all viewers are removed. If it is just a disconnect, there is a 10-minute protection window (see Section 8).

### Q: How do I change the room password?

A: The host goes to the **"Permissions" tab** in the right panel, finds the "Room Password" setting, clicks **"Change"** and enters the new password.

### Q: Can I join a room from a mobile device?

A: Yes. ZViewer is a web application. Open the link in your mobile browser to join, supporting basic playback sync and chat functions.

---

> More questions? See the [FAQ](/en/guide/faq) or contact the administrator.