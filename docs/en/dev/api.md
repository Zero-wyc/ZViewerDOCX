# API Reference

> This document is intended for developers. Unless otherwise noted, all endpoints return JSON `{ success: true, ... }`. Admin endpoints require the `admin`/`root` role.

---

## Authentication `/api/auth`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/register` | Register a new user | Open |
| POST | `/login` | Log in, writes httpOnly Cookie | Open |
| POST | `/refresh` | Refresh Access Token | Logged in |
| POST | `/logout` | Log out | Logged in |
| GET | `/registration-mode` | Current registration mode | Open |
| GET | `/public-settings` | Public settings | Open |
| GET | `/me` | Current user info | Logged in |
| PATCH | `/password` | Change password | Logged in |
| PATCH | `/username` | Change username | root |
| POST | `/avatar` | Upload avatar | Logged in |
| DELETE | `/avatar` | Delete avatar | Logged in |
| POST | `/guest` | Get guest token | Open |

## Rooms `/api/rooms`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/` | Active room list | Logged in |
| PUT | `/:roomId/name` | Change room name | Owner/root |
| GET | `/:roomId/movies` | Movie list | Room member |
| POST | `/:roomId/movies` | Add movie | Owner |
| POST | `/:roomId/movies/reorder` | Reorder movies | Owner |
| PUT | `/:roomId/movies/:movieId` | Update movie | Owner |
| DELETE | `/:roomId/movies/:movieId` | Delete movie | Owner |

## Streaming `/api/stream`

### Bilibili Related

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/proxy-image` | Bilibili image proxy (no auth) | Open |
| GET | `/bilibili/qr` | QR code for login | Logged in |
| GET | `/bilibili/qr/poll` | Poll QR code status | Logged in |
| GET | `/bilibili/login-status` | Login status | Logged in |
| POST | `/bilibili/logout` | Log out | Logged in |
| GET | `/bilibili/user-info` | User info | Logged in |
| GET | `/bilibili/following-bangumi` | Followed anime | Logged in |
| GET | `/bilibili/bangumi-episodes` | Anime episodes | Logged in |
| GET | `/resolve-bilibili` | Video resolution (NDJSON stream) | Logged in |
| GET | `/bilibili/danmaku` | Bilibili danmaku | Logged in |
| GET | `/proxy` | CDN media proxy | Logged in |

### Danmaku `/api/stream/danmaku`

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/sources` | Danmaku source list | Logged in |
| GET | `/search` | Search danmaku | Logged in |
| GET | `/episodes` | Episode list | Logged in |
| POST | `/fetch` | Fetch danmaku | Logged in |

### Anime Sources

`/anime`, `/anisubs`, `/kazumi` -- three groups with identical structure:

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/proxy` | Media proxy | Logged in |
| GET | `/sources` | Data source list | Logged in |
| GET | `/search` | Search anime | Logged in |
| GET | `/episodes` | Episode list | Logged in |
| POST | `/resolve` | Resolve playback URL | Logged in |

## Mount Points `/api/webdav`, `/api/ftp`, `/api/openlist`

Three groups with identical structure:

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/mounts` | Mount point list | Logged in |
| POST | `/mounts/test` | Test connection | Logged in |
| POST | `/mounts` | Add mount point | Logged in |
| PUT | `/mounts/:id` | Update mount point | Logged in |
| DELETE | `/mounts/:id` | Delete mount point | Logged in |
| GET | `/mounts/:id/browse` | Browse directory | Logged in |
| GET | `/resolve` | Resolve file | Logged in |
| GET | `/proxy` | Proxy playback | Logged in |

## Server Files `/api/server-files` (root only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/roots` | Root directory list |
| POST | `/roots` | Add root directory |
| DELETE | `/roots/:id` | Delete root directory |
| GET | `/browse` | Browse directory |
| GET | `/browse-system` | Browse entire disk |
| POST | `/upload` | Upload file |
| POST | `/folder` | Create folder |
| POST | `/rename` | Rename |
| DELETE | `/file` | Delete file/folder |
| GET | `/resolve` | Resolve playback URL |
| GET | `/proxy` | Proxy playback |
| POST | `/bilibili-download` | Bilibili download (MP4 only, up to 720P) |

## Admin Panel `/api/admin`

### User Management

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/users` | User list | admin/root |
| PATCH | `/users/:id/role` | Change role | root |
| POST | `/users/:id/approve` | Approve registration | root |
| DELETE | `/users/:id` | Delete user | root |

### Room Management

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/rooms` | Full room list | admin/root |
| DELETE | `/rooms/:roomId` | Force close room | admin/root |
| POST | `/rooms/batch-delete` | Batch delete | root |
| POST | `/rooms/delete-all` | Clear all rooms | root |
| POST | `/rooms/cleanup-unused` | Clean up unused rooms | admin/root |

### System Settings

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/settings` | Get settings | admin/root |
| PUT | `/settings` | Update settings | root |

## System Updates `/api/system/update` (root only)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/check` | Check for updates |
| POST | `/apply` | Download and apply update |
| POST | `/upload` | Upload archive update |

## Other

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/api/stream-push/obs-config/:roomId` | Download OBS config | Owner |
| POST | `/api/client-logs` | Report frontend logs | Open |
| GET | `/health` | Health check | Open |

## Response Format

### Success
```json
{ "success": true, "data": { ... } }
```

### Error
```json
{ "success": false, "error": { "message": "Error description", "code": "ERROR_CODE" } }
```

### Stream Response (Bilibili Resolution)
```
{"type":"progress","message":"Resolving..."}
{"type":"result","data":{...}}
{"type":"error","message":"Resolution failed"}
```