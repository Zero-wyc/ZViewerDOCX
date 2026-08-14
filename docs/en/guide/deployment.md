# Deployment

ZViewer offers three deployment forms: source code version, single-file exe, and Docker, with a built-in auto-update mechanism.

## One-click Startup Script Reference

The source code version (`start-prod.*`) and the single-file version (`start.bat` / `start.sh`) are functionally identical, both providing an interactive menu and command-line mode.

### Interactive Menu

```
========================================
  ZViewer Service Management
========================================
  1) Start Service (HTTP)
  2) Start Backend Only (HTTP / HTTPS optional)
  3) Stop Service
  4) Restart Service
  5) View Status
  6) View Logs
  7) One-click SSL Certificate Issuance
  8) HTTPS Start (Auto-issue Certificate)
  9) Build Frontend and Backend (Source Code Version)
  0) Exit
```

### Command-line Usage

| Command | Description |
|---|---|
| `start` | Start service (HTTP frontend + backend; add `-Https` for HTTPS single-process mode) |
| `backend` | Start backend only (HTTP/HTTPS optional) |
| `cert [host]` | Issue SSL certificate; if host is omitted, interactively select the type |
| `https [host]` | Issue certificate and start with HTTPS (backend only; backend serves frontend pages) |
| `stop` / `restart` | Stop / restart service |
| `status` | View running status (PID, port listening, certificate status) |
| `logs [backend\|frontend]` | View logs (default: backend) |
| `build` | Build frontend and backend (source code version) |
| `help` / `menu` | Help / interactive menu |

## Docker Deployment

The Docker image starts in HTTP mode, with the backend serving frontend static files. It does not auto-issue certificates. For HTTPS, it is recommended to place a reverse proxy (Nginx / Caddy) in front of Docker.

### docker run

```bash
docker run -d \
  --name zviewer \
  -p 3333:3333 \
  -p 3334:3334 \
  -v zviewer-data:/app/config \
  zerowyc0721/zviewer:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
services:
  zviewer:
    image: zerowyc0721/zviewer:latest
    ports:
      - "3333:3333"   # Backend unified entry (API + WebSocket + frontend pages)
      - "3334:3334"   # RTMP streaming (OBS)
    volumes:
      - zviewer-data:/app/config
    restart: unless-stopped

volumes:
  zviewer-data:
```

### Building Yourself

The project includes `Dockerfile.linux-single` and `docker-compose.linux-single.yml` (using `build` instead of `image`):

```bash
docker build -t zviewer -f Dockerfile.linux-single .
docker compose -f docker-compose.linux-single.yml up -d
```

### Data Persistence

Mount a volume to the `/app/config` directory, which contains:

| Path | Content |
|---|---|
| `/app/config/dev.sqlite` | Database |
| `/app/config/ssl/` | SSL certificates |
| `/app/config/uploads/` | User-uploaded files |
| `/app/config/media/` | NMS streaming media segments |

## Intranet Penetration and Virtual LAN

When ZViewer is deployed on an intranet server, external users cannot access it directly. The following three mainstream solutions are described below; choose based on your network environment.

### FRP (Recommended)

[FRP](https://github.com/fatedier/frp) is a high-performance reverse proxy application supporting TCP, UDP, HTTP, and HTTPS protocols. It is suitable for exposing intranet ZViewer services to a public VPS.

#### Architecture

```
Public users -> frps (public VPS, port 3333) -> frpc (intranet server) -> ZViewer (127.0.0.1:3333)
```

#### Server Configuration (Public VPS)

```ini
# frps.toml
bindPort = 7000                # FRP control port
vhostHTTPPort = 80             # HTTP port (optional, for Let's Encrypt verification)
vhostHTTPSPort = 443           # HTTPS port (optional)
```

#### Client Configuration (Intranet ZViewer Server)

```ini
# frpc.toml
serverAddr = "YOUR_PUBLIC_VPS_IP"
serverPort = 7000

[[proxies]]
name = "zviewer-backend"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3333
remotePort = 3333

[[proxies]]
name = "zviewer-rtmp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3334
remotePort = 3334
```

#### Access

After configuration, external users can access ZViewer at `http://PUBLIC_VPS_IP:3333`.

> The public VPS must have the corresponding ports (3333, 3334) opened in its firewall/security group rules.

#### Configuring HTTPS (FRP Forwarding)

If the public VPS has a domain name, you can configure FRP's HTTPS forwarding, or use Nginx to reverse proxy the FRP port and then apply for a Let's Encrypt certificate.

---

### Intranet Penetration (Using Sakura Frp as an Example)

[Sakura Frp](https://www.natfrp.com/) is a free and easy-to-use intranet penetration service. No public VPS is needed; just register an account to use it.

#### Registration and Installation

1. Visit the [Sakura Frp website](https://www.natfrp.com/) and register an account.
2. Download the client for your operating system from the "Software Download" page.
3. Log in, go to "Management Panel" -> "Tunnels" -> "Create Tunnel", and set the local port to `3333`.
4. In ZViewer's "Custom Backend Address" field, enter the tunnel address assigned by Sakura Frp to access it from the external network.

> The free plan has traffic limits (usually 1-2 GB/month), suitable for light use. The paid plan offers unlimited traffic.

---

### Virtual LAN (Using ZeroTier as an Example)

[ZeroTier](https://www.zerotier.com/) is a software-defined networking (SDN) tool that connects devices on different networks into a virtual LAN. Devices can communicate directly without a public IP.

#### Architecture

```
External users (install ZeroTier) <-> ZeroTier Virtual Network <-> Intranet ZViewer Server (install ZeroTier)
```

#### Registration and Network Creation

1. Visit [ZeroTier Central](https://my.zerotier.com/) and register an account.
2. Click **Create A Network** to create a network.
3. Note down the generated **Network ID** (e.g., `8056c2e21c000001`).

#### Installing ZeroTier

**Linux (Intranet Server)**:

```bash
curl -s https://install.zerotier.com | sudo bash
sudo zerotier-cli join <Network ID>
sudo zerotier-cli set <Network ID> allowManaged=1
```

**Windows/macOS (External Users)**:

1. Download and install the client from the [ZeroTier website](https://www.zerotier.com/download/).
2. Click the system tray icon -> **Join Network** -> Enter the Network ID.
3. Check **Allow Managed IP**.

#### Authorizing Devices

In the network management page on [ZeroTier Central](https://my.zerotier.com/), check the checkbox next to the connected devices to authorize them on the network.

#### Access

After authorization, ZeroTier assigns a virtual IP to each device (e.g., `10.147.20.1`). External users access the intranet ZViewer service through this IP:

```
http://10.147.20.1:3333
```

> ZeroTier's free plan supports up to 25 devices, suitable for team use. Device communication is P2P direct, not passing through a central server, with speed depending on the bandwidth at both ends.

---

### Solution Comparison

| Solution | Public VPS Required | Speed | Configuration Difficulty | Use Case |
|---|---|---|---|---|
| **FRP** | Yes (needs a public VPS) | Limited by VPS bandwidth, relayed traffic | Medium | Scenarios with a public VPS requiring stable service |
| **Sakura Frp** | No (uses provider nodes) | Limited by free node bandwidth | Easy | Quick testing, temporary sharing, scenarios without a public VPS |
| **ZeroTier** | No (P2P direct) | Depends on both ends' bandwidth, fastest with direct connection | Easy | Multi-device networking, long-term use, scenarios requiring high-speed transfer |

#### Selection Suggestions

- **Already have a public VPS** -> Use FRP, stable and controllable.
- **No public VPS, occasional external access** -> Use Sakura Frp, free and quick.
- **Need long-term stable high-speed access with many devices** -> Use ZeroTier, P2P direct with no speed limit.

## Update Mechanism

The system supports automatic detection and application of updates from GitHub Releases, as well as manual upload of archive updates (zip / tar.gz, up to 500 MB). Admins can manage updates in the "Version Update" tab of the admin panel and control whether to accept pre-release (main branch auto-build) updates.

Related APIs:

- `GET /api/system/update/check`: Check for updates (can include pre-releases).
- `POST /api/system/update/apply`: Download and apply an update.
- `POST /api/system/update/upload`: Upload an archive and apply it.