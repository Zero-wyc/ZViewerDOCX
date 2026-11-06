# HTTPS and Certificates

## Issuance Types

Certificate issuance is a built-in subcommand of the backend (`--gen-cert`) and selects the method based on the address type:

| Address Type | Certificate | Description |
|---|---|---|
| `localhost` | Self-signed certificate | SAN includes `localhost`, `127.0.0.1`, `::1`, valid for 10 years |
| Domain (e.g., `example.com`) | **Let's Encrypt trusted CA certificate** | Automatically applied via the built-in ACME client; no browser warnings |
| Public IP (e.g., `1.2.3.4`) | **Let's Encrypt trusted CA certificate** | Supports issuing Let's Encrypt trusted certificates for public IPs |

> Issuance runs inside the backend (Go standard library, no openssl): self-signed keys and X.509 are generated locally, Let's Encrypt uses the built-in ACME v2 (RFC 8555) HTTP-01 client, and the account key in `acme-account.key` is reused.

## Command-line Issuance

```bash
# Domain -> automatically apply for a Let's Encrypt trusted certificate
start.bat cert example.com
./start.sh cert example.com

# Public IP -> automatically apply for a Let's Encrypt trusted certificate (IP supported)
start.bat cert 1.2.3.4

# Force re-issuance
start.bat cert example.com --force
```

In HTTPS mode, the backend also serves frontend static pages. Visit `https://localhost:3333`.

## Prerequisites for Domain Let's Encrypt Certificate

1. The domain must be resolved to the machine's public IP.
2. Port **80** on the machine must be available and allowed through the firewall/security group (ACME HTTP-01 verification).
3. The production environment has rate limits (5 certificates per domain per week). Use `--staging` for testing.

## Certificate File Location

Certificate files are located in `config/ssl/`:

| File | Content |
|---|---|
| `cert.pem` | Certificate chain |
| `key.pem` | Private key |
| `acme-account.key` | ACME account key |

## Related Environment Variables

| Variable | Description |
|---|---|
| `HTTPS=true` | Enable HTTPS mode and serve frontend static files |
| `SSL_CERT_PATH` | Certificate path |
| `SSL_KEY_PATH` | Private key path |

## FAQ

### Self-signed Certificate Shows "Not Secure" in Browser

`localhost` and public IPs use self-signed certificates, causing browsers to warn "The certificate authority is not trusted". Solutions:

- Import `config/ssl/cert.pem` into the client's "Trusted Root Certification Authorities"; or
- Use a domain name and apply for a trusted certificate via Let's Encrypt.

### Reverse Proxy Scenario

If using Nginx / Caddy or another reverse proxy to terminate TLS, keep the backend in HTTP mode. There is no need to issue certificates within ZViewer. Make sure to configure WebSocket upgrade headers correctly (see [FAQ](/en/guide/faq#websocket-connection-failure)).