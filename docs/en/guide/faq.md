# FAQ

## Self-signed Certificate Shows "Not Secure" in Browser

`localhost` and public IPs use self-signed certificates, causing browsers to warn "The certificate authority is not trusted". Solutions:

- Import `config/ssl/cert.pem` into the client's "Trusted Root Certification Authorities"; or
- Use a domain name and apply for a trusted certificate via Let's Encrypt. See [HTTPS and Certificates](/en/guide/https).

## WebSocket Connection Failure

Make sure the reverse proxy (Nginx, etc.) has correctly configured WebSocket upgrade headers:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## WebRTC Cannot Establish Connection

WebRTC's `getUserMedia` requires HTTPS access. Configure SSL certificates in production. Voice and screen sharing are peer-to-peer, so no separate TURN server is needed; make sure the reverse proxy passes `/signal` too.

## Database Notes

The backend is Go with SQLite (`config/dev.sqlite`, WAL by default). The file is standard SQLite and can be inspected with any standard SQLite tool.

The startup path only verifies the schema — it never creates tables or columns. Use `--init-db` for an empty database, `--upgrade-db` for a 4.x database, and `--backup-db` (`VACUUM INTO`) for backups; never copy the main file while WAL is on.

## Bilibili Parsing Failure

- Check that the backend is sending the correct Referer and other request headers.
- Thumbnails and video URLs are fetched through the backend proxy to avoid CORS and hotlink protection issues.
- Premium member-only content requires valid Bilibili login credentials configured in the admin panel, or use [ZViewerCLI Local Proxy](/en/features/video-sources#zviewercli-local-proxy).

## What Happens When the Host Goes Offline

If the host disconnects briefly, the server continues broadcasting the current playback state, so viewers do not need to interrupt their watching (playback memory feature). If the host is offline for more than 10 minutes, the room is automatically closed. During this period, viewers can control playback freely.

## How to Change the Default root Password

Log in with `root` / `root`, then go to the profile page to change the password. Admins can also manage users in the admin panel's user management section.

## Update Mechanism

The system supports automatic detection and application of updates from GitHub Releases, as well as manual upload of archive updates. Admins can control whether to accept pre-release (main branch auto-build) updates in the admin panel. See [Deployment](/en/guide/deployment#update-mechanism).