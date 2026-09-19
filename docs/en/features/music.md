# Listen Together Music

## Overview

**Listen Together** is the room-based music module of ZViewer. Join a room with friends — the host controls playback and everyone listens in sync. It supports NetEase Cloud Music and Bilibili as dual audio sources, a full-featured lyric player page, and the CLI local proxy for high-quality streaming.

Core capabilities:

- **Dual sources**: NetEase Cloud Music (playlists / daily recommendations / FM / search) + Bilibili (music regions / search / favorites).
- **Room sync**: The host switches songs, pauses and seeks; viewers follow in real time with transmission delay compensation.
- **Viewer control requests**: Adding songs, switching songs, pause/resume and seeking can all be requested from the host, with one-click auto-approval.
- **Lyric player page**: A Hydrogen-style layout — real-time audio spectrum visualization, line-by-line lyrics, translation / Romaji, quality badge, comments and danmaku.
- **CLI local proxy**: With ZViewerCLI connected, Bilibili videos are resolved with your own VIP cookie for high-quality backgrounds.

---

## I. Dual Audio Sources

| Source | Content |
|--------|---------|
| **NetEase Cloud Music** | My playlists, daily recommendations, personal FM, search, liked songs, song comments |
| **Bilibili** | Music region browsing, search, favorites, AI subtitle lyrics, danmaku, comments |

The playlist keeps two independent queues (NetEase / Bilibili) that sync across the room in real time; you can switch between sources freely.

### Bilibili Music Region

- **Custom tabs**: Top tabs can be added and edited — drag to reorder on desktop, arrow buttons on touch devices; the order persists instantly.
- **Region sorting**: The left-hand region list supports the same editing; the selected region and order survive page refreshes.
- **Keyword filtering**: Region content can be filtered by blocked words; pagination automatically skips ahead to avoid empty pages.

---

## II. Playback Control & Sync

### Host controls

- Switch song / pause / resume / seek / play mode (**in order** / repeat one / shuffle / repeat all).
- The default play mode is **in order** (no looping — Bilibili auto-continue only works in this mode).

### Viewer control requests

| Action | Description |
|--------|-------------|
| Add song | Add a song to the room playlist |
| Play song | Request to play a song from the playlist |
| Pause / resume | Pause or resume playback for everyone |
| Seek | Drag the progress bar to request a position change |

- The host sees a drop-in **approval bar** at the top-left corner with Approve / Reject buttons.
- With **auto-approval** enabled, all of the above actions take effect immediately without review.
- After an action succeeds, the viewer sees an "xx synced" receipt at the top-left corner.

### Sync mechanism

- **Delay compensation**: Viewers align playback position based on network latency.
- **Instant state sync**: The playlist is fetched immediately on first join (with automatic retry on failure); reconnects re-pull the room state.
- **Clearing the playlist stops audio instantly**: The current song stops together with the queue for every member — playback is always room-unified, with no local interludes.

---

## III. Bilibili Auto-Continue

In "in order" mode, when you press **Next** at the end of the queue, ZViewer automatically fetches 3 related Bilibili videos, appends them to the queue and plays the first one:

- **Trigger conditions**: ① Play mode is "in order" (repeat-all wraps back to the queue head instead); ② The current song is a Bilibili item (NetEase playlists don't support this); ③ "Bilibili auto-continue" is enabled in settings.
- Letting the song finish naturally does NOT append recommendations — the queue simply stops at the end.
- Auto-continue can be toggled off in settings at any time.

---

## IV. Lyric Player Page

The lyric player page replicates the Hydrogen Music layout:

| Area | Capabilities |
|------|--------------|
| **Left player card** | Cover corner-bracket animation, real-time audio spectrum, quality badge (actual sample rate / bitrate), UI opacity slider |
| **Right panel** | Line-by-line lyrics, translation / Romaji, NetEase & Bilibili comment sections (comment-count badge preloaded) |
| **Background** | Cover blur slider (0–100px); Bilibili items resolve their video as background with a video blur slider and cross-fade on song switch |
| **Toolbar** | Hover to reveal (always visible on touch); black/white toggle, fullscreen, danmaku toggle, play queue (click to expand / collapse), settings |

### UI opacity (frost-layer scheme)

The "UI opacity" slider uses a **frost layer + UI layer** structure: the bottom layer keeps full-strength frosted-glass blur at all times, while the top layer (tint and text) fades out as a whole — the blur never degrades at any opacity, unlike the old either-or approach.

### Bilibili danmaku

Danmaku can be enabled for Bilibili items: layer switching (above / below UI), a danmaku settings panel (style / speed / blocked words / track settings), and persistent danmaku tracks.

---

## V. CLI Local Proxy Mode

Once [ZViewerCLI](/en/cli/) is connected, a CLI panel appears in the lyric page settings:

- **High-quality video background**: Bilibili videos are resolved with your local VIP cookie, including VIP-only content.
- **Resolution picker**: Auto / 4K / 1080P60 / 1080P+ / 1080P / 720P60 / 720P / 480P / 360P, filtered by your Bilibili VIP status — **non-VIP accounts see up to 1080P**, and a saved VIP tier falls back automatically.
- **Progress sync**: The background video stays precisely in sync with the audio; switching songs or resolutions no longer stutters.
- **Auto-reconnect**: After a page refresh the CLI reconnects automatically — no need to toggle the setting again.

---

## VI. Favorites & Search

- **Bilibili heart**: One-click favorite to a chosen folder from the lyric page or the play bar; click again to un-favorite. The collected state is restored across sessions via Bilibili's official aggregated query (lit if the video is in any folder).
- **Folder picker**: Add a Bilibili video to any of your favorite folders.
- **Search on NetEase**: Extract the song title from a playing Bilibili video and search NetEase Cloud Music in one click — with local preview and one-click "like" to your liked-songs list (already-liked songs show a red heart).

---

## VII. Mobile

- **Fully responsive**: Player card / lyric panel adapt to the screen, the toolbar reflows in portrait, and popups degrade into bottom sheets.
- **Touch friendly**: Controls stay visible without hover; sliders don't scroll the page while dragging.
- **Voice optimization**: Mobile voice chat uses Opus 40ms frames + inband FEC for smoother audio on weak networks.

---

## FAQ

### Why doesn't auto-continue trigger?

Three conditions must all hold: ① Play mode is "in order"; ② The current song is a Bilibili item; ③ "Bilibili auto-continue" is enabled in settings.

### Why can't I see 4K / 1080P60 in the CLI resolution picker?

Resolution tiers are filtered by your Bilibili VIP status; non-VIP accounts see up to 1080P. Make sure the CLI uses a VIP account's cookie, then reopen the settings panel to refresh the tiers.

### Can viewers seek?

Yes. Dragging the progress bar sends a request to the host: with auto-approval it takes effect immediately; otherwise the host must click Approve on the top-left bar.

### Does the song keep playing after the playlist is cleared?

No. Clearing the playlist stops the current song instantly for every member — playback is always controlled by the room.
