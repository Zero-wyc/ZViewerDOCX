# Local Development

This document is intended for developers who want to set up a local ZViewer development environment.

---

## Environment Requirements

| Tool | Minimum Version | Notes |
|------|---------------|-------|
| Node.js | 18.x | 20.x or 22.x LTS recommended |
| npm | 9.x | Installed with Node.js |
| Git | -- | Used for cloning the project code |

## Step 1: Clone the Project

```bash
git clone https://github.com/Zero-wyc/ZViewer.git
cd ZViewer
```

## Step 2: Install Dependencies

The project uses npm workspaces. Install all dependencies from the root directory:

```bash
npm install
```

This will automatically install all dependencies for the `backend/` and `frontend/` workspaces.

## Step 3: Start the Development Servers

### Start Both Frontend and Backend Simultaneously (Recommended)

```bash
npm run dev
```

This uses `concurrently` to start both the frontend and backend development servers at the same time.

### Start Separately

```bash
npm run dev:backend    # Backend http://localhost:3333
npm run dev:frontend   # Frontend http://localhost:5174
```

When developing the frontend, Vite proxies requests to the backend by default (requests to `/api`, `/socket.io`, `/live` are automatically forwarded to `localhost:3333`), so no additional `VITE_API_URL` configuration is needed.

## Development Ports

| Service | Address | Description |
|---------|---------|-------------|
| Frontend Dev Server | `http://localhost:5174` | Vite dev server with HMR hot reload |
| Backend Dev Server | `http://localhost:3333` | Express + TypeScript with hot reload |
| RTMP Push Stream | 3334 | OBS streaming port |
| HTTP-FLV Pull Stream | 3335 | Live stream playback |

## Common Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both frontend and backend dev services in parallel |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run build` | Build both frontend and backend |
| `npm run build:all` | Full single-file compilation (generates dist/ executable) |
| `npm run lint` | Run code linting |
| `npm run start` | Cross-platform start (forwards to start-prod.* script) |

## Project Structure Overview

```
ZViewer/
├── backend/          # Express backend (TypeScript + TypeORM + sql.js)
├── frontend/         # React frontend (Vite + Tailwind CSS)
├── scripts/          # Utility scripts (certificates/build/start)
├── docker/           # Docker entry point
├── packaging/        # Startup script templates
└── dist/             # Build output
```

## Database

- **Default**: SQLite (`config/dev.sqlite`), sql.js wasm implementation
- **Optional**: PostgreSQL (requires `DATABASE_URL` configuration)

## Utility Scripts

| Script | Description |
|--------|-------------|
| `scripts/generate-cert.js` | SSL certificate generation (self-signed / Let's Encrypt) |
| `scripts/acme-client.js` | ACME v2 HTTP-01 client |
| `scripts/build-exe.js` | Backend single-file compilation |
| `scripts/start.js` | Cross-platform start forwarding |