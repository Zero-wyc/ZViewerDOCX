# Screen Sharing and Streaming

ZViewer offers two screen sharing and streaming methods to meet different needs, from simple sharing to professional live streaming.

| Feature | WebRTC Screen Share (Simple) | OBS RTMP Streaming (Professional) |
|---------|------------------------------|-----------------------------------|
| Ease of use | Very low, one-click in-browser operation | Moderate, requires installing OBS Studio |
| Latency | Low (hundreds of milliseconds) | Relatively low (seconds) |
| Quality | Browser-encoded, basic quality | OBS-encoded, customizable parameters |
| Audio support | Supported (optional) | Supported (controlled by OBS) |
| Annotation tools | Built-in pen, color, thickness | Not available, must overlay in OBS |
| Use case | Quick demos, ad-hoc meetings | Live streaming, recording, multi-scene switching |
| Viewer count | Suitable for small scale (P2P/TURN) | Suitable for large scale (HTTP-FLV distribution) |

---

## WebRTC Screen Share (Simplest)

No additional software required, done entirely within the browser. **Requires HTTPS access** (browser security policy restriction).

### Host Steps

#### 1. Create a Room and Select "Screen Share" Mode

1. Click the **"Create Room"** button on the homepage.
2. In the popup, select **"Screen Share"** mode.
3. Click **"Confirm"** to enter the room.

#### 2. Choose to Share Screen or Window

1. After entering the room, click the **"Share Screen"** button in the bottom toolbar.
2. The browser displays a system sharing dialog. Choose:
   - **Entire Screen** -- Share all monitor displays.
   - **Application Window** -- Share only a specific program window.
   - **Browser Tab** -- Share only a specific tab (with audio option).
3. Click **"Share"** to start sharing.

#### 3. Set Frame Rate and Bitrate (Optional)

Click the **"Quality"** button next to the share preview to adjust:

- **Frame Rate**: Default 15 fps, options 10 / 15 / 30 fps (some bugs present)
- **Bitrate**: Default 1000 kbps, can be adjusted via slider or manual input.

> Higher frame rate and bitrate improve quality but also increase network load. Choose based on your upstream bandwidth. (Current frame rate selection has some issues and may be limited to 15 fps.)

#### 4. Share Audio (Optional)

In the system sharing dialog, check **"Share Audio"** (only supported by some browsers/tab sharing).

#### 5. Pause and Resume Sharing

- Click the **"Pause Sharing"** button to freeze the viewer's画面.
- Click **"Resume Sharing"** to continue streaming.
- The sharing control bar supports **auto-hide** -- it appears when the mouse enters and hides when the mouse leaves, so it does not block the画面.

#### 6. Using Annotation Tools

During sharing, click the **"Pen"** button to open the annotation toolbar:

- **Pen toggle**: Click to activate/deactivate the pen.
- **Color picker**: Select an annotation color from the preset palette.
- **Thickness adjustment**: Slider or buttons to adjust line thickness.
- **Clear annotations**: Remove all annotations with one click.

> Annotations are overlaid on the shared画面 only and do not affect the original content.

### Viewer Steps

- **Picture-in-Picture (PiP)**: Click the **"PiP"** button to float the shared画面 in a corner of the window, making it easy to multitask.
- **Fullscreen**: Click the **"Fullscreen"** button to enlarge the view.
- **Mute**: Click the **"Mute"** toggle to control audio playback.
- **Screenshot**: Click the **"Screenshot"** button to save the current画面 (browser downloads it automatically).

> Viewers do not need to install any software. They can watch by opening the room link in a browser.

---

## OBS RTMP Streaming (Professional)

Suitable for scenarios requiring higher quality, multi-scene switching, or simultaneous streaming to multiple platforms.

### Prerequisites

- Install [OBS Studio](https://obsproject.com/) (free and open source, supports Windows / macOS / Linux).
- Ensure the ZViewer server is deployed and running.

### Steps

#### 1. Switch to "Stream" Mode

1. The host enters the room and clicks the **"Stream"** button in the bottom toolbar.
2. In the popup, select the **"OBS Stream"** sub-mode.

#### 2. Get a Stream Key

1. Click the **"Generate Stream Key"** button. The system generates a unique stream key.
2. Copy the displayed stream key string (e.g., `zviewer_abc123`).

#### 3. Download OBS Configuration File (Recommended, One-click Import)

1. Click the **"Download OBS Config"** button to download a `.json` configuration file.
2. Open OBS Studio.
3. Click the menu bar **"Scene Collection"** → **"Import"**, and select the downloaded configuration file.
4. After import, the scene collection is automatically switched, and the stream URL and stream key are pre-filled.

#### 4. Or Configure OBS Manually

If you prefer not to use the configuration file, you can set it up manually:

| Parameter | Value |
|-----------|-------|
| Server | `rtmp://server-ip:3334/live` |
| Stream Key | The stream key copied from the ZViewer room |

1. Open OBS Studio → **"Settings"** → **"Stream"**.
2. **"Service"** select **"Custom..."**.
3. **"Server"** enter the RTMP address above.
4. **"Stream Key"** enter the copied stream key.
5. Click **"OK"** to save.

#### 5. Start Streaming

1. Click the **"Start Streaming"** button in OBS.
2. Return to the ZViewer room and confirm that the status shows **"Streaming"**.
3. During streaming, the room provides a **stream control bar** to view stream status and control start/stop.

#### 6. Viewers Watching

Viewers do not need to do anything extra -- they watch directly through the browser:

- The viewer side automatically pulls and plays the stream via the HTTP-FLV protocol.
- They can also directly access `http://server-ip:3335/live/stream-key.flv` in a browser or media player to watch.

> Streaming ports: **3334** (RTMP ingest) / **3335** (HTTP-FLV playback). Make sure your firewall allows traffic on these two ports.

---

## Production Environment Considerations

### HTTPS Required

The WebRTC `getUserMedia` API requires a secure context. HTTPS must be configured in production.

> You can use `localhost` in development, but a valid SSL certificate is required in production.

### Nginx Reverse Proxy for HTTP-FLV

The HTTP-FLV port (3335) **should not be exposed** directly to the public internet. It should be reverse-proxied through Nginx under the `/live` path.

Modify the Nginx configuration to proxy `http://server-ip:3335/live/` under the same origin, and set `VITE_FLV_BASE_URL` to an empty string to use the same-origin address.

### NAT Traversal -- TURN Server

In strict NAT environments, WebRTC P2P connections may fail. A TURN server (such as [coturn](https://github.com/coturn/coturn)) needs to be deployed for relay forwarding.

### Example Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Force redirect to HTTPS (recommended)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Main application
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # HTTP-FLV media stream (reverse proxy port 3335)
    location /live/ {
        proxy_pass http://127.0.0.1:3335/live/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

> Replace `your-domain.com` with your actual domain name and configure a valid SSL certificate.

---

## Frequently Asked Questions

### Viewers cannot see the画面

- **Check HTTPS**: ZViewer must be accessed over HTTPS (WebRTC requirement).
- **Check browser permissions**: Make sure the browser has granted camera/screen sharing permissions.
- **Check browser console**: Press F12 to open developer tools and check for errors.
- **NAT environment**: A TURN server must be deployed in strict NAT environments, otherwise P2P connections may fail.

### OBS streaming fails

- **Check server status**: Confirm that the ZViewer backend and Node-Media-Server are running.
- **Check firewall**: Make sure port 3334 (RTMP) is not blocked by the firewall.
- **Check stream key**: Confirm the stream key matches the one generated in the room, with no extra spaces.
- **Check OBS logs**: OBS menu **"Help"** → **"Log Files"** → **"View Current Log"** to find error messages.
- **Server address format**: Confirm the RTMP address format is `rtmp://IP:3334/live` with no trailing slash.

###画面 stuttering or high latency

- **Lower frame rate/bitrate**: In the share quality settings, reduce the frame rate to 15 fps and bitrate to 500-800 kbps.
- **Check upstream bandwidth**: Use a speed test tool to confirm upstream bandwidth is at least 1 Mbps.
- **Switch network**: Prefer a wired connection over Wi-Fi.
- **Close other bandwidth-intensive applications**: Such as online video streaming, large file downloads, etc.
- **When using OBS streaming**: Reduce the output resolution (e.g., 720p) or use a hardware encoder in OBS settings.