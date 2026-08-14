# Environment Variables

ZViewer is configured through environment variables. You can set them in a `.env` file (copy from `.env.example`) or via system environment variables.

---

## Backend Environment Variables

### Basic Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `PORT` | Backend service port | `3333` | `PORT=3333` |
| `HOST` | Listen address | Empty (dual-stack) | `HOST=0.0.0.0` |
| `NODE_ENV` | Runtime environment | `production` | `NODE_ENV=development` |

### Storage Paths

When all paths are left empty, the defaults under `<project-root>/config/` are used.

| Variable | Description | Default |
|----------|-------------|---------|
| `CONFIG_DIR` | Data root directory | `<project-root>/config` |
| `DATABASE_URL` | Database connection | `<config>/dev.sqlite` |
| `UPLOADS_DIR` | Uploaded files directory | `<config>/uploads` |
| `AVATARS_DIR` | Avatars directory | `<config>/avatars` |
| `MEDIA_DIR` | NMS streaming temporary directory | `<config>/media` |

> PostgreSQL example: `DATABASE_URL=postgresql://user:password@localhost:5432/zviewer` (requires synchronizing changes in `data-source.ts`)

### CORS Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CORS_ORIGIN` | Allowed CORS origins, comma-separated | `*` |

For production, it is recommended to set this to the specific frontend domain, e.g., `CORS_ORIGIN=https://example.com`.

### JWT Authentication (must change in production)

| Variable | Description | Default | Recommendation |
|----------|-------------|---------|----------------|
| `JWT_ACCESS_SECRET` | Access Token secret | Auto-generated | 32+ character random string |
| `JWT_REFRESH_SECRET` | Refresh Token secret | Auto-generated | 32+ character random string, different from the above |
| `JWT_ACCESS_EXPIRES_IN` | Access Token validity | `15m` | `15m` or `30m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh Token validity | `7d` | `7d` or `14d` |

### Streaming Ports

| Variable | Description | Default |
|----------|-------------|---------|
| `RTMP_PORT` | RTMP streaming port | `3334` |
| `HTTP_FLV_PORT` | HTTP-FLV pull stream port | `3335` |

### Additional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `HTTPS` | Enable HTTPS mode | `HTTPS=true` |
| `SSL_CERT_PATH` | Certificate path | `config/ssl/cert.pem` |
| `SSL_KEY_PATH` | Private key path | `config/ssl/key.pem` |
| `SERVER_HOST` | Hostname preferred for RTMP address | `SERVER_HOST=example.com` |

---

## Frontend Build Environment Variables

Used when building the frontend, not at runtime.

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | API/Socket.IO base URL | Empty (uses `window.location.origin`) |
| `VITE_FLV_BASE_URL` | HTTP-FLV pull stream base URL | Empty (uses same-origin address) |

---

## Configuration Examples

### Minimal Configuration (Development)

```ini
PORT=3333
NODE_ENV=development
```

### Recommended Production Configuration

```ini
PORT=3333
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
JWT_ACCESS_SECRET=<32+ character random string>
JWT_REFRESH_SECRET=<another 32+ character random string>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Generating Random Keys

```bash
# Linux / macOS
openssl rand -base64 32

# or Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```