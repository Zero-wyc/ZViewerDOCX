# Video Sources · Beginner's Guide

> From Bilibili series to your own NAS, this article covers all ZViewer video sources.

---

## 1. Feature Overview

ZViewer supports **9 video sources**, covering online video platforms, direct links, self-hosted storage, and third-party anime sources. In the room's **"Add Video"** panel, you can switch between video sources at any time based on your needs.

| Source | Use Case | Additional Configuration Required |
|--------|----------|----------------------------------|
| **Bilibili** | Parse Bilibili video links / BV IDs, supports premium member quality | Optional (bind account for premium quality) |
| **MP4 Direct Link** | Play any publicly accessible MP4 video URL directly | None |
| **WebDAV** | Mount self-hosted NAS, Synology, NextCloud, and other WebDAV services | Requires mount point configuration in profile |
| **FTP** | Mount FTP file server | Requires mount point configuration in profile |
| **OpenList** | Mount OpenList directory listing service | Requires mount point configuration in profile |
| **Emby** | Mount Emby media server, browse media libraries to select videos | Requires mount point configuration in profile |
| **Jellyfin** | Mount Jellyfin media server, browse media libraries to select videos | Requires mount point configuration in profile |
| **Anime Sources (Beta)** | Kazumi / AniSubs and other third-party anime data sources | Requires enabling in the admin panel |
| **Server Files** | Browse video file directories on the server | Only available to `root` users; requires root directory configuration |

> The first five (Bilibili / MP4 Direct Link / Mounts / Emby / Jellyfin) are the most commonly used video sources. It is recommended that beginners master these first.

---

## 2. Bilibili

Bilibili is the most commonly used video source in ZViewer. You can paste a Bilibili video link or BV ID directly, and it will be parsed for playback.

### 2.1 Adding a Bilibili Video

1. Enter a room and find the **"Add Video"** panel at the bottom.
2. Switch to the **"Bilibili"** tab.
3. Paste a Bilibili video link, **BV ID**, or **AV ID**, for example:
   - Full link: `https://www.bilibili.com/video/BV1GJ411x7o`
   - BV ID only: `BV1GJ411x7o`
   - AV ID only: `av123456`
4. Click the **"Parse"** button and wait for parsing to complete.
5. Once parsed successfully, the video is automatically added to the video list. Click to play.

### 2.2 Switching Quality

After parsing, the video defaults to the highest available quality. You can click the **"Quality"** button in the player to switch quality.

> When not logged into a Bilibili account, the available quality is limited to **Bilibili's public quality**, typically 1080P and below.

### 2.3 Binding a Bilibili Account (for Premium Member Quality)

If you have a Bilibili premium membership, you can bind your account to unlock **1080P High Bitrate**, **4K**, and other premium-only quality options.

ZViewer offers two binding methods:

**Method 1: QR Code Login**
1. On the ZViewer homepage, click the **user menu** (showing your username) in the top-right corner and select **"Profile"**.
2. On the profile page, find the **"Bilibili Binding"** section.
3. Click **"Bind Bilibili Account"**; a QR code will be displayed on the page.
4. Open the Bilibili mobile app, use the scan feature to scan the QR code, and confirm login.
5. After successful binding, the profile page will show your Bilibili username and avatar.

**Method 2: Cookie Login**
1. On the profile page, in the "Bilibili Binding" section, select **Cookie Login**.
2. Paste your Bilibili login cookie string.
3. Click confirm; the system validates the cookie and completes the binding.

> After binding, all subsequently parsed Bilibili videos will attempt to use premium quality. If the premium membership expires, the system automatically falls back to public quality.

### 2.4 Danmaku Support

ZViewer supports loading Bilibili's official danmaku. When playing a Bilibili video, click the **"Danmaku"** button in the player to load and display danmaku.

---

## 3. MP4 Direct Link

If you have a direct HTTP link to a video file (ending with `.mp4` or another playable format), you can add it directly to the room for playback.

### Adding Steps

1. In the **"Add Video"** panel, switch to the **"Direct Link"** tab.
2. Paste the direct URL of the video file in the input box, for example:
   - `https://example.com/videos/my-movie.mp4`
   - `https://cdn.example.com/stream/abc123.mp4`
3. Click the **"Add"** button.
4. The video is immediately added to the video list. Click to play.

> Make sure the link is publicly accessible and the server has no hotlink protection (Referer restrictions). If playback fails, try pasting the link into your browser's address bar to test if it is accessible.

### Subtitle Support

ZViewer provides a native subtitle system that **no longer converts to WebVTT**. Instead, it directly parses each subtitle format and renders them using HTML/CSS:

- Supports common subtitle formats (SRT, ASS, etc.), with native parsing for better style fidelity.
- Supports three subtitle loading methods: **auto-detect**, **auto-add**, and **manual add**.
- Built-in browser-side ffmpeg.wasm audio transcode: **browser-incompatible tracks such as DTS/AC3** are transcoded to AAC in real time in the browser (requires enabling "Allow browser-side audio transcode" in the admin panel as a global permission and checking the corresponding engine when adding a movie; otherwise the incompatible audio is pushed directly and may be silent).

---

## 4. WebDAV / FTP / OpenList

These three video sources require you to first configure a **mount point** in your profile, after which you can browse the mounted directory from within a room to select videos.

### 4.1 Configuring a Mount Point

1. Click the **user menu** in the top-right corner → **"Profile"**.
2. On the profile page, find the **"Mount Point Management"** section.
3. Depending on your server type, click the corresponding **"Add"** button (WebDAV / FTP / OpenList).
4. Fill in the connection information in the form that appears:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Give this mount point a name for easy identification | `My NAS` / `Office FTP` |
| **Server Address** | Server IP or domain name | `192.168.1.100` or `nas.example.com` |
| **Port** | Service port number | WebDAV defaults to `443` (HTTPS) or `80` (HTTP), FTP defaults to `21` |
| **Username** | Login username | `admin` |
| **Password** | Login password | `********` |
| **Path** | Optional, specifies the starting directory | `/video` (leave empty to start from root) |

5. After filling in, click the **"Test Connection"** button to confirm the connection is successful.
6. Once the test passes, click **"Save"**.

> If the connection test fails, check whether the server address, port, username, and password are correct, and whether the server allows external access.
>
> **OpenList Notice**: Make sure your OpenList site and account have been granted **offline download permission** (supports direct link playback) and **WebDAV permission**; otherwise, mounting will not work.

### 4.2 Using a Mount Point in a Room

1. Return to the room. In the **"Add Video"** panel, switch to the corresponding mount tab (**"WebDAV"** / **"FTP"** / **"OpenList"**).
2. The panel lists all mount points configured in your profile.
3. Click a mount point to enter directory browsing mode.
4. Browse folders to find video files (supports `.mp4`, `.mkv`, `.webm`, and other formats).
5. Click a video file to add it to the video list and play it.

### 4.3 Managing Mount Points

In the **"Mount Point Management"** section of your profile, you can:

- **Edit**: Click the **"Edit"** icon next to a mount point to modify connection information.
- **Delete**: Click the **"Delete"** icon to remove an unused mount point.
- **Test**: Click **"Test Connection"** at any time to check if a mount point is available.

---

## 5. Emby / Jellyfin

Emby and Jellyfin are popular home media servers. ZViewer supports mounting both as video sources, allowing you to browse media libraries (movies, series, seasons, episodes) and select videos to add to the room for playback.

### 5.1 Configuring a Mount Point

1. Click the **user menu** in the top-right corner → **"Profile"**.
2. On the profile page, find the **"Mount Point Management"** section.
3. Click the **"Add"** button and select **Emby** or **Jellyfin**.
4. Fill in the connection information in the form that appears:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Give this mount point a name | `My Emby` / `Home Jellyfin` |
| **Server Address** | Emby/Jellyfin server address (include protocol) | `http://192.168.1.100:8096` |
| **API Key** | Emby/Jellyfin API key (recommended) | `xxxxxxxxxxxxxxxx` |
| **Username / Password** | Account credentials (alternative to API Key) | `admin` / `********` |

> **Use either API Key or account credentials.** It is recommended to use an API Key (generated in Emby/Jellyfin admin panel under "Advanced" → "API Keys"), which is more secure and less affected by password policies.

5. After filling in, click the **"Test Connection"** button to confirm the connection is successful and the logged-in user is displayed.
6. Once the test passes, click **"Save"**.

### 5.2 Using Emby / Jellyfin in a Room

1. Return to the room. In the **"Add Video"** panel, switch to the **"Emby"** or **"Jellyfin"** tab.
2. The panel lists the Emby/Jellyfin mount points you have configured.
3. Click a mount point to enter media library browsing mode (two-column layout, same as WebDAV/OpenList).
4. Browse hierarchically: **Media Library** → **Movies / Series** → **Season** → **Episode**.
5. Click a video (or select multiple) to batch add them to the video list and play.

### 5.3 Playback Mode

When adding a video, you can choose a playback mode via the **"Playback Mode"** dropdown:

| Mode | Description | Use Case |
|------|-------------|----------|
| **Server Relay** | The addresses in the playlist point to ZViewer backend relay endpoints, which carry Emby/Jellyfin credentials to request media streams | Default mode, for scenarios where the browser cannot set Referer/Authorization headers |
| **Direct Link** | The player directly accesses the media stream URL issued by the Emby/Jellyfin server | Suitable when the media server and viewers are on the same network with no cross-origin restrictions, reducing server relay traffic |

> **Tip**: Emby and Jellyfin have highly compatible APIs. ZViewer uses the same client implementation, so their functionality is identical.

### 5.4 Managing Mount Points

In the **"Mount Point Management"** section of your profile, you can perform **edit**, **delete**, and **test connection** operations on Emby/Jellyfin mount points, the same as for WebDAV/FTP/OpenList.

---

## 6. Anime Sources (Kazumi / AniSubs, Beta)

Anime sources are a Beta feature of ZViewer, supporting search and playback of anime through Kazumi, AniSubs, or other third-party data sources.

### 6.1 Enabling Anime Sources

1. Log in to ZViewer with a `root` account.
2. Go to the **Admin Panel** (click the user menu in the top-right corner → **"Admin Panel"**).
3. Find **"Basic Settings"** in the left menu.
4. Locate the **"Data Source Configuration"** (`dataSourceConfig`) section.
5. Enable the toggle for anime sources (Kazumi / AniSubs).
6. Save the settings.

> Anime sources are a Beta feature. Search results may be incomplete. It is recommended to use them alongside Bilibili anime.

### 6.2 Searching and Playing Anime

1. After enabling anime sources, return to the room's **"Add Video"** panel.
2. Switch to the **"Anime"** tab.
3. Enter an anime name in the search box (e.g., `Spy x Family`, `Frieren: Beyond Journey's End`).
4. Click the **"Search"** button.
5. The search results list matching anime. Click the one you want.
6. The system loads the episode list for that anime. Select an episode to play.

> Loading the anime list for the first time may take a few seconds. Please be patient.

---

## 7. Server Files (root only)

The **Server Files** feature allows `root` users to directly access local video directories on the server without setting up additional file services.

### 7.1 Configuring the Root Directory

1. Log in with a `root` account.
2. Go to **Admin Panel** → **"Basic Settings"**.
3. Find the **"Server File Root Directory"** configuration item.
4. Enter one or more directory paths on the server (comma-separated), for example:
   - `/mnt/videos`
   - `/data/media`
5. Save the settings.

> Ensure that the ZViewer backend process has **read permission** for these directories. The directory paths are absolute paths on the server, not paths on the browser machine.

### 7.2 Browsing and Managing Files

1. In the room's **"Add Video"** panel, switch to the **"Server Files"** tab.
2. You will see the list of configured root directories.
3. Click a directory to enter browsing mode, where you can:
   - **Browse folders**: Navigate through directories to find video files.
   - **Upload files**: Click the **"Upload"** button to select local files and upload them to the current directory (supports batch upload, up to 50 files).
   - **Create folder**: Click **"New Folder"** to create a subdirectory.
   - **Rename/Delete**: Rename or delete files or folders.
4. Click a video file to add it to the video list for playback.

> Server file playback is proxied through the ZViewer backend, supporting Range request resume, making seeking very smooth.

---

## 8. ZViewerCLI Local Proxy

ZViewerCLI is an optional but **strongly recommended** local proxy client, primarily addressing two issues:

- **Premium Member High Quality**: Uses your local browser's Bilibili cookies to resolve premium quality video URLs.
- **CORS and Hotlink Protection**: Some CDNs restrict cross-origin requests or validate Referer headers. ZViewerCLI proxies and forwards requests locally, automatically injecting the correct headers.

### 8.1 Installing ZViewerCLI

1. Open the [ZViewerCLI Releases page](https://github.com/Zero-wyc/ZViewerCLI/releases).
2. Download the appropriate version for your operating system:
   - **Windows**: Download `zviewer-cli-windows-x64.zip`
   - **Linux**: Download `zviewer-cli-linux-x64.tar.gz`
3. Extract to any folder.

### 8.2 Starting ZViewerCLI

**Windows**: Double-click `zviewer-cli.exe`, or run it in a terminal:

```powershell
zviewer-cli.exe
```

**Linux**:

```bash
./zviewer-cli
```

Once started, ZViewerCLI automatically registers with the ZViewer server via WebSocket. The frontend **auto-detects** the local proxy and will prioritize using it to resolve video streams.

### 8.3 Verification

After ZViewerCLI starts, when playing a Bilibili video in ZViewer, if you see previously unavailable high-quality options (such as **1080P High Bitrate**, **4K**) in the quality menu, the proxy is active.

> ZViewerCLI only needs to run on the **viewer's** local machine, not on the server. If multiple people are watching, each person can run ZViewerCLI on their own machine for the best quality.

---

## 9. Frequently Asked Questions

### Q: Why does my Bilibili video fail to parse?

A: Possible reasons:
- The BV ID or link format is incorrect. Check that it was copied completely.
- The video is not publicly accessible on Bilibili (e.g., a private upload).
- The server cannot reach the Bilibili API.
- If ZViewerCLI is enabled, verify that it is running.

### Q: An MP4 direct link was added but won't play?

A: Check the following:
- Does the link start with `https://` or `http://`?
- Can the link be opened directly in a browser?
- Does the target server have hotlink protection (Referer restrictions)?
- Is the video format supported by the browser (`.mp4` is recommended)?

### Q: WebDAV / FTP connection test fails?

A: Common causes:
- Incorrect server address or port.
- Incorrect username or password.
- The server firewall is blocking external connections.
- The WebDAV server does not have HTTPS enabled (some browsers restrict HTTPS pages from accessing HTTP resources).
- If using a self-hosted NAS, check that the corresponding service is enabled.

### Q: Anime source search returns no results?

A: Anime sources are a Beta feature. Possible reasons:
- The anime source toggle is not enabled in the admin panel.
- The data source configuration is empty or invalid.
- The anime name is not accurate. Try using the original Japanese name or the Chinese translation.
- The data source server is temporarily unavailable.

### Q: Emby / Jellyfin connection test fails?

A: Common causes:
- Incorrect server address format. The protocol must be included (e.g., `http://192.168.1.100:8096`).
- Incorrect API Key or username/password.
- The Emby/Jellyfin server does not have external access enabled.
- The server firewall is blocking the connection.

### Q: Emby / Jellyfin playback is choppy or shows a black screen?

A: Try switching the playback mode:
- If currently on **Direct Link**, switch to **Server Relay** (browser hotlink protection).
- If currently on **Server Relay**, switch to **Direct Link** if network conditions allow, to reduce relay overhead.

### Q: ZViewerCLI has no effect after starting?

A: Check the following:
- Did ZViewerCLI start successfully (any error messages in the terminal)?
- Is it running on the **viewer's** local machine (not on the server)?
- Is the firewall blocking ZViewerCLI's network connection?
- Try restarting ZViewerCLI and refreshing the ZViewer page.

### Q: How do I see which video sources I have bound?

A: On the profile page, you can see:
- **Bilibili Binding Status**: Shows the bound username.
- **Mount Point List**: Shows all configured WebDAV / FTP / OpenList mount points.

### Q: Why can't I see the Server Files feature?

A: The Server Files feature is only visible to users with the **`root` role**. If you are logged in with a regular user account, this tab will not be displayed. Contact the administrator or log in with a `root` account.

---

> More questions? See the [FAQ](/en/guide/faq) or contact the administrator.