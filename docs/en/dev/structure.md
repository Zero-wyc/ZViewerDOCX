# Project Structure

## Directory Overview

```
ZViewer/
├── backend-go/           # Go backend
├── desktop/              # Wails v2 desktop shell (Go) + ui/
├── frontend/             # React frontend (Vite + Tailwind CSS)
├── scripts/              # Build / hot reload / startup utility scripts
├── docker/               # Docker entry scripts
├── packaging/            # Startup script templates
├── dist/                 # Build output (backend binary + web assets)
├── config/               # Runtime configuration (auto-generated)
├── log/                  # Runtime logs
├── package.json          # Root package.json (workspaces configuration)
├── build-all.js          # Distribution build
├── start-prod.bat        # Startup script (Windows)
└── start-prod.sh         # Startup script (Linux/macOS)
```

---

## Backend (backend-go/)

### Tech Stack
- **Runtime**: Go 1.26 (no cgo)
- **HTTP**: standard library `net/http`
- **Database**: SQLite via `modernc.org/sqlite`, WAL by default
- **Real-time**: in-house Socket.IO protocol layer (`internal/sio`), Piik signaling on `/signal`
- **Media**: `internal/nms` (RTMP / HTTP-FLV), `internal/share` + `internal/piik` (sharing and voice)
- **Authentication**: JWT

### Directory Structure

```
backend-go/
├── cmd/zviewer-server/     # assembly entry point (main.go has no business logic)
├── internal/
│   ├── api/                # HTTP layer; registration order is the contract
│   ├── room/               # rooms, sync playback, comments, voice control
│   ├── realtime/           # Socket.IO event hub
│   ├── bilibili/           # Bilibili parsing, credentials, permissions
│   ├── proxy/              # media / anti-leech proxy, Range handling
│   ├── share/              # sharing sessions, SFU, Piik bridge
│   ├── piik/               # vendored Piik server packages (protocol / signal / route)
│   ├── voicertc/           # voice control plane (fallback SFU)
│   ├── ncm/                # NetEase Cloud Music client
│   ├── nms/                # built-in RTMP / HTTP-FLV service
│   ├── anime/, anisubs/, kazumi/, cms/   # aggregated anime sources
│   ├── db/                 # open, schema verify, indexes, backup, upgrade
│   └── store/              # SQL for every domain
└── scripts/                # smoke / regression scripts
```

---

## Frontend (frontend/)

### Tech Stack
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router
- **Player**: videojs10-dash (video.js 10 + dash.js), playsvideo for re-encode
- **Danmaku**: danmaku.js

### Directory Structure

```
frontend/src/
├── App.tsx                # Route definitions
├── pages/                 # Page components
│   ├── HomePage.tsx       # Homepage
│   ├── LoginPage.tsx      # Login/Register
│   ├── RoomsListPage.tsx  # Room list
│   ├── ProfilePage.tsx    # Profile
│   └── AdminPage.tsx      # Admin panel
├── components/            # Shared UI components
│   ├── ui/                # Base components (Button/Input/Modal, etc.)
│   ├── Header.tsx         # Top navigation bar
│   ├── Layout.tsx         # Page layout
│   ├── CommentPanel.tsx   # Comment/danmaku panel
│   └── ...
├── modules/               # Feature modules
│   ├── room/              # Room main interface
│   ├── screen-sharing/    # Screen sharing
│   ├── sync-playback/     # Synchronized playback
│   ├── player/            # Player engine
│   ├── voice-chat/        # Voice chat
│   ├── bilibili/          # Bilibili integration
│   ├── mounts/            # Mount point management
│   └── ...
├── store/                 # Zustand state management
│   ├── authStore.ts       # User authentication
│   ├── roomStore.ts       # Room state
│   ├── themeStore.ts      # Theme settings
│   └── ...
```

### Page Routes

| Route | Page | Guard |
|-------|------|-------|
| `/` | Homepage | None |
| `/login` | Login/Register | None |
| `/room/:roomId?` | Room main interface | Login required |
| `/admin` | Admin panel | admin/root required |
| `/profile` | Profile | Login required |
| `/rooms` | Room list | Login required |
| `/join` | Enter room ID | Login required |

---

## Database

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `rooms` | Rooms |
| `sessions` | Session history |
| `movies` | Movies |
| `comments` | Comments |
| `playback_states` | Playback memory |
| `system_settings` | System settings |
| `user_mounts` | User mount points |
| `bilibili_credentials` | Bilibili credentials |

The schema has a single source of truth: `backend-go/internal/db/schema.sql`.