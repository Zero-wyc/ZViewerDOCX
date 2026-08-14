# Real-time Interaction

## Feature Overview

In a ZViewer room, you and your friends can not only watch videos synchronously but also interact in real time -- send danmaku, chat, use voice, and even draw annotations on the screen with a pen.

---

## 1. Comments and Chat

The comment panel is located on the **right panel** (CommentPanel) of the room interface, containing three tabs.

### How to Send a Comment
1. Make sure you are on the **"Comments" tab**
2. Type your message in the input box at the bottom
3. Press Enter or click the send button
4. The comment appears immediately, visible to everyone in the room

## 2. Viewer Request for Control

As a viewer, if you want to fast-forward/rewind or pause, you can send a request to the host.

1. Click pause or seek on the player
2. The system prompts "A request has been sent to the host. Please wait for confirmation."
3. A notification appears at the top-left of the host's player
4. The host clicks approve or deny

If the host has enabled **"Auto-approve control requests"**, the request takes effect automatically.

## 3. Voice Chat

The voice chat panel (VoiceChatPanel) is permanently located at the **bottom-right corner** of the page.

### Host Enabling Voice
1. Click the voice panel at the bottom-right corner
2. Enable voice
3. Set the bitrate: 32 / 96 / 128 / 192 kbps (default 128 kbps)
4. Once enabled, viewers can listen in

> Voice uses **server relay mode** (rather than P2P) to address the issue of P2P being blocked in current NAT environments, which would otherwise prevent voice chat. In relay mode, audio streams are forwarded through the server, offering better compatibility without NAT type restrictions.

### Viewers Listening
The voice panel displays a member list, and you can adjust the speaker volume.

## 4. Screen Annotations

In Screen Share mode, the host can use the pen tool to draw highlights on the screen, which all viewers can see in real time.

## 5. Playback State Synchronization

When you join a room as a viewer, everything syncs automatically:
- Host plays/pauses/seeks/changes speed -- you follow automatically
- If the host disconnects, the server takes over broadcasting, watching continues uninterrupted
- If the host is offline for more than 10 minutes, the room closes automatically

## Frequently Asked Questions

### Can't hear voice?
Make sure the host has enabled voice, check your speakers, check microphone permissions, and try accessing via HTTPS.

### The host didn't respond to my request?
The host may not be present. Wait a moment. If auto-approve is enabled, the request takes effect automatically.