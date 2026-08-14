# Project Structure

## Directory Overview

```
ZViewer/
├── backend/              # Express backend (TypeScript + TypeORM + sql.js)
├── frontend/             # React frontend (Vite + Tailwind CSS)
├── scripts/              # Build / certificate / startup utility scripts
├── docker/               # Docker entry scripts
├── packaging/            # Startup script templates
├── dist/                 # Build output (single-file executable program)
├── config/               # Runtime configuration (auto-generated)
├── log/                  # Runtime logs
├── package.json          # Root package.json (workspaces configuration)
├── build-all.js          # Full compilation script
├── start-prod.bat        # Startup script (Windows)
└── start-prod.sh         # Startup script (Linux/macOS)
```

---

## Backend (backend/)

### Tech Stack
- **Runtime**: Node.js + TypeScript
- **Web Framework**: Express
- **Database ORM**: TypeORM
- **Database Driver**: sql.js (SQLite wasm implementation)
- **Real-time Communication**: Socket.IO
- **Authentication**: JWT

### Directory Structure

```
backend/src/
├── index.ts               # Application entry point
├── data-source.ts         # Database configuration
├── routes/                # REST API routes
│   ├── auth.ts            # Authentication
│   ├── admin.ts           # Admin panel
│   ├── rooms.ts           # Rooms
│   ├── stream/            # Media streaming proxy
│   ├── danmaku.ts         # Danmaku (弹幕)
│   ├── serverFiles.ts     # Server files
│   ├── updater.ts         # System updates
│   ├── cli.ts             # CLI proxy
│   ├── webdav.ts, ftp.ts, openlist.ts  # Mount point management
│   └── ...
├── modules/               # Modular architecture (core)
│   ├── room/              # Room
│   ├── viewer/            # Viewer management
│   ├── movie/             # Movie management
│   ├── sync-playback/     # Synchronized playback
│   ├── playback-memory/   # Playback memory
│   ├── comment/           # Comments and annotations
│   ├── cli/               # CLI proxy
│   ├── stream-push/       # OBS streaming
│   ├── socket/            # Socket registry
│   └── shared/            # Shared DTOs
├── services/              # Business logic (Bilibili/updates/WebRTC)
├── entities/              # Data entities
│   ├── User.ts, Room.ts, Session.ts, Movie.ts
│   ├── Comment.ts, PlaybackState.ts
│   ├── SystemSettings.ts, UserMount.ts
│   └── BilibiliCredential.ts
└── middleware/             # Middleware (JWT authentication, etc.)
```

---

## Frontend (frontend/)

### Tech Stack
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Routing**: React Router
- **Player**: ArtPlayer
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

| Table | Entity | Description |
|-------|--------|-------------|
| `users` | User | User accounts |
| `rooms` | Room | Rooms |
| `sessions` | Session | Session history |
| `movies` | Movie | Movies |
| `comments` | Comment | Comments |
| `playback_states` | PlaybackState | Playback memory |
| `system_settings` | SystemSettings | System settings |
| `user_mounts` | UserMount | User mount points |
| `bilibili_credentials` | BilibiliCredential | Bilibili credentials |