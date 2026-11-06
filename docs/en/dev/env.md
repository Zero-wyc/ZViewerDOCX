# Environment Variables

ZViewer is configured through environment variables at startup, plus settings stored in the database and edited in the admin panel.

---

## Backend

### Basic Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend service port | `3333` |
| `HOST` | Listen address | Empty (dual-stack) |
| `CONFIG_DIR` | Data root directory | `<project-root>/config` |
| `DATABASE_URL` | SQLite file path | `<config>/dev.sqlite` |
| `CORS_ORIGIN` | Allowed CORS origins, comma-separated | `*` |
| `TRUSTED_PROXY_CIDRS` | Trusted reverse-proxy ranges (for forwarded headers) | Empty |

### JWT Authentication

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_ACCESS_SECRET` | Access token secret | Generated and stored in `config/jwt-secrets.json` |
| `JWT_REFRESH_SECRET` | Refresh token secret | Same file |
| `JWT_ACCESS_EXPIRES_IN` | Access token validity | `24h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token validity | `30d` (guests: `1h` / `7d`) |

Set both secrets explicitly in production so restarting does not invalidate sessions.

### Voice and Sharing Media

Voice and screen sharing are peer-to-peer; the server carries signaling only. These ports belong to the built-in media plane and are used by the legacy voice path.

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARE_MEDIA_PORT` | Media UDP port | `3333` |
| `SHARE_MEDIA_TCP_PORT` | Media TCP port. **Must not equal `PORT`** | `3337` |
| `SHARE_MEDIA_PUBLIC_IP` | Public IP under NAT 1:1 (cloud / FRP) | Auto |

### Streaming Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `RTMP_PORT` | RTMP streaming port | `3334` |
| `STREAM_PUSH_ENABLED` | `0` disables streaming entirely | Enabled |
| `STREAM_PUSH_OFFLINE_GRACE_SECONDS` | Offline grace after the publisher stops | `60` |
| `NMS_EMBEDDED` | `0` disables the built-in media service | Embedded |
| `NMS_BIND` | Built-in RTMP listen address | `0.0.0.0` |
| `NMS_HTTP_FLV_URL` | External FLV upstream; when set, `/live` proxies instead | Empty (in-process) |
| `HTTP_FLV_PORT` | Probe port for external mode only | `3335` |
| `SERVER_HOST` | Hostname used in the generated RTMP address | Request `Host` |

### Certificates and Updates

| Variable | Description | Default |
|----------|-------------|---------|
| `HTTPS` | Start with HTTPS | Off |
| `SSL_CERT_PATH` / `SSL_KEY_PATH` | Certificate and key path | `config/ssl/cert.pem` / `key.pem` |
| `ZVIEWER_CERT_CHALLENGE_PORT` | ACME HTTP-01 challenge port | `80` |
| `ZVIEWER_UPDATE_SOURCE` | Update source: `github` / `gitcode` | Mirror |
| `ZVIEWER_UPDATE_API_BASE` | Custom manifest URL | Empty |
| `ZVIEWER_DESKTOP` | Set by the desktop shell; web update endpoints return 409 | Empty |

---

## Frontend Build Environment Variables

Build-time only; they end up in the bundle.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API base URL | Empty (`window.location.origin`) |
| `VITE_SOCKET_URL` | Socket.IO base URL | Empty (same) |
| `VITE_FLV_BASE_URL` | FLV playback base URL | `/live` |
| `VITE_RTMP_PORT` | RTMP port hint | `3334` |

During development Vite proxies `/api`, `/socket.io`, `/signal` and `/live` to the backend, so no configuration is needed.

---

## Runtime Settings (Admin Panel)

Stored in the database and edited in the admin panel: registration mode, room creation mode, permission matrix, feature switches (`dashDisabled` / `playsvideoEnabled` / `betaFeaturesEnabled`), inactive-room cleanup, update source, room floating entries and default parse modes. Changed through `/api/admin/settings`; the frontend reads public ones from `/api/auth/public-settings`.

### Generating Random Keys

```bash
openssl rand -base64 32
```
