# Subtitle System

## Overview

Subtitles complete your viewing experience. ZViewer provides a native subtitle system that **no longer converts to WebVTT**. Instead, it directly parses each subtitle format and renders them using HTML/CSS for higher style fidelity.

Both **external subtitles** and **embedded (muxed) subtitles** are supported, and the subtitle the host selects is automatically synced to every viewer in the room.

## Supported Subtitle Formats

| Format | Description |
|--------|-------------|
| SRT | The most common text subtitle |
| ASS / SSA | Supports advanced styles (positioning, color, font), preserved when rendering |
| VTT | WebVTT subtitles |
| SMI | SAMI subtitles |
| SUB | MicroDVD subtitles |

## External Subtitles

External subtitles are subtitle files that exist independently (e.g. `movie.srt`, `movie.ass`). They can be loaded in the following ways.

### Auto-detect

When playing movies from WebDAV / FTP / OpenList / Server-Files sources, ZViewer **automatically searches for subtitle files with the same name or prefix in the movie's directory** and loads them. You can see them in the subtitle settings.

### Directory Browse

In the subtitle settings, click **"Browse Directory"** to browse the movie's directory and pick a subtitle file to load.

### URL / File Upload

In the subtitle settings, paste a subtitle file link directly, or upload a local subtitle file.

## Embedded Subtitles

Embedded (muxed) subtitles are **subtitle tracks inside the video container**. ZViewer can parse the video container (MKV) **directly in the browser** and extract text subtitle tracks — **no server-side FFmpeg required**.

Click the **"Embedded Subtitle Tracks"** button to list the text subtitle tracks inside the container; pick one to extract and play. Extraction runs entirely in the browser (custom MKV demux + sparse scanning), **skipping audio/video payload** to read only subtitle bytes, so even multi-gigabyte files list tracks quickly and produce subtitles in seconds.

> Only text subtitle tracks (SRT / ASS / SSA / WebVTT) can be extracted in the browser; bitmap subtitle tracks (PGS / VOBSUB) cannot.

Support by video source:

| Video source | Embedded subtitles availability |
|--------------|----------------------------------|
| Server-Files | ✅ Extracted directly in the browser (MKV demux) |
| WebDAV / OpenList | ✅ Both relay and direct-link (browser reads source bytes directly) |
| Emby / Jellyfin | ✅ Uses their own subtitle API |
| MP4 direct link / Bilibili | ❌ Not supported (non-MKV container) |

### Steps

1. Open the player **Settings**, switch to the **Subtitles** tab.
2. Click **"Embedded Subtitle Tracks"** and wait for the text subtitle tracks inside the container to be listed.
3. Pick a track in the list; click it to extract and enable subtitles.

> When you seek to any position during playback, extraction **prioritizes the segment near the playback point**, filling it in quickly so subtitles are not missing for long after seeking.

## Viewer Sync

Within a room, **subtitles are controlled uniformly by the host**. When the host loads or switches a subtitle track, all viewers automatically sync to the same configuration — no extra setup.

## FAQ

### Embedded subtitle tracks not listed?

Confirm the video is an MKV container and has **text** subtitle tracks (SRT / ASS, etc.); bitmap tracks (PGS / VOBSUB) cannot be extracted in the browser. If using a direct link and the source server does not allow CORS Range access, extraction may fail — switch to the server relay instead.

### Style loss?

ASS / SSA embedded subtitles keep their styles; if the source is plain text (e.g. SRT) there is no style information.