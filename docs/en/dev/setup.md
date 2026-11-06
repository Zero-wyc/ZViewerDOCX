# Local Development

This document is intended for developers who want to set up a local ZViewer development environment.

---

## Environment Requirements

| Tool | Minimum Version | Notes |
|------|---------------|-------|
| Go | 1.26 | Backend and desktop shell |
| Node.js | 22.x LTS | Frontend build and scripts |
| npm | 10.x | Installed with Node.js |
| Git | -- | Used for cloning the project code |

On Windows, Git Bash is needed to run `backend-go/scripts/*.sh`.

## Step 1: Clone and Install

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
npm install          # npm workspaces, installed from the root
npm run db:init      # create an empty database with root / root
```

## Step 2: Start Development

```bash
npm run dev              # backend (hot reload) + frontend together
npm run dev:backend      # backend only; rebuilds and swaps the process on change
npm run dev:backend:once # compile once, no watcher
npm run dev:frontend     # frontend only, http://localhost:5174
```

Vite proxies `/api`, `/socket.io`, `/signal` and `/live` to `localhost:3333`, so no `VITE_API_URL` configuration is needed.

## Development Ports

| Service | Address | Description |
|---------|---------|-------------|
| Frontend Dev Server | `http://localhost:5174` | Vite dev server with HMR |
| Backend Dev Server | `http://localhost:3333` | Go backend |
| RTMP Push Stream | 3334 | OBS streaming port |
| Media UDP / TCP | 3333/udp, 3337 | Voice and sharing media |

## Common Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both ends |
| `npm run build` | Build backend and frontend |
| `npm run build:all` | Distribution build (`dist/win`, `dist/linux`) |
| `npm run db:init` / `db:upgrade` / `db:backup` | Create / migrate / hot-backup the database |
| `npm run lint:go` / `test:go` | `gofmt -l` + `go vet` / `go test ./...` |
| `npm run lint` / `npm test -w frontend` | eslint / frontend unit tests |
| `npm run test:regression` | Full Go regression suite |
| `npm run start` | Start the production build |

## Project Structure Overview

```
ZViewer/
├── backend-go/       # Go backend
│   ├── cmd/zviewer-server/   # assembly entry point
│   └── internal/             # api / room / bilibili / proxy / share / piik / ncm / nms / db
├── frontend/         # React frontend (Vite + Tailwind CSS)
├── desktop/          # Wails v2 desktop shell + ui/
├── scripts/          # hot reload, artifact build, launchers
├── packaging/        # startup script templates
├── docker/           # Docker entry point
├── build-all.js      # distribution build
└── dist/             # build output
```

## Database

- **One engine**: SQLite (`config/dev.sqlite`), pure Go driver, WAL by default.
- **Schema source of truth**: `backend-go/internal/db/schema.sql`, applied by `--init-db` only; the startup path verifies the schema and never creates tables.
- **Backups**: `--backup-db` (`VACUUM INTO`). With WAL on, copying the main file alone loses the latest transactions.

## Utility Scripts

| Script | Description |
|--------|-------------|
| `scripts/build-backend.js` | Compile the Go backend into `dist/` (single entry point) |
| `scripts/dev-backend.js` | Development hot reload |
| `scripts/start.js` | Cross-platform start forwarding |
| `packaging/start-*.ps1|sh` | Startup menu, certificate issuance, HTTPS start |
