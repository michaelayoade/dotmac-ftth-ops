# Docker Compose Linux Compatibility Guide

**Issue**: `host.docker.internal` resolution on Linux without Docker Desktop

**Date**: 2025-11-04

---

## Overview

The simplified Docker Compose files (`docker-compose.base.yml`, `docker-compose.isp.yml`) use `host.docker.internal` as the default host for external services (PostgreSQL, Redis, MinIO, Vault, OTLP).

**On macOS and Windows (Docker Desktop)**: `host.docker.internal` works out of the box.

**On Linux (without Docker Desktop)**: `host.docker.internal` doesn't resolve by default and requires manual configuration.

---

## Detection

Check if `host.docker.internal` resolves:

```bash
getent hosts host.docker.internal
```

**If it resolves**: You're good to go ✅

**If it doesn't resolve**: Apply one of the fixes below ⚠️

---

## Solution 1: Use extra_hosts (Recommended)

Add `extra_hosts` to each service in the compose files. Docker Compose v2.10+ supports the `host-gateway` special value:

### docker-compose.base.yml

```yaml
services:
  platform-backend:
    build:
      context: .
      dockerfile: ${PLATFORM_BACKEND_DOCKERFILE:-Dockerfile}
    command: ${PLATFORM_BACKEND_COMMAND:-uvicorn dotmac.platform.main:app --host 0.0.0.0 --port 8000}
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"  # ← Add this line
    environment:
      # ... rest of environment variables
```

### docker-compose.isp.yml

```yaml
services:
  isp-backend:
    build:
      context: .
      dockerfile: ${ISP_BACKEND_DOCKERFILE:-Dockerfile}
    command: ${ISP_BACKEND_COMMAND:-uvicorn dotmac.platform.main:app --host 0.0.0.0 --port 8000}
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"  # ← Add this line
    environment:
      # ... rest of environment variables
```

**What `host-gateway` does**: Maps to the host's gateway IP (typically the Docker bridge gateway), allowing containers to reach services on the host.

---

## Solution 2: Use docker-compose.override.yml (Cleaner)

Create a `docker-compose.override.yml` file (automatically merged by Docker Compose):

```yaml
# docker-compose.override.yml
services:
  platform-backend:
    extra_hosts:
      - "host.docker.internal:host-gateway"

  isp-backend:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**Advantages**:
- Doesn't modify the main compose files
- Automatically applied when running `docker compose up`
- Can be gitignored (platform-specific)

**Usage**:
```bash
# No special flags needed, override is auto-merged
docker compose -f docker-compose.base.yml up -d
docker compose -f docker-compose.isp.yml up -d
```

---

## Solution 3: Use --add-host flag

Pass the `--add-host` flag when running containers:

```bash
docker compose -f docker-compose.base.yml up -d \
  --add-host host.docker.internal:host-gateway
```

**Disadvantage**: Must remember to add the flag every time.

---

## Solution 4: Override with Environment Variables (Alternative)

If `host.docker.internal` doesn't work, use specific IPs in a `.env` file:

```bash
# .env
DATABASE__HOST=172.17.0.1         # Docker bridge IP on Linux
REDIS__HOST=172.17.0.1
STORAGE__ENDPOINT=http://172.17.0.1:9000
VAULT__URL=http://172.17.0.1:8200
CELERY__BROKER_URL=redis://172.17.0.1:6379/2
CELERY__RESULT_BACKEND=redis://172.17.0.1:6379/3
OTEL_EXPORTER_OTLP_ENDPOINT=http://172.17.0.1:4317

# ISP-specific overrides
ISP_DATABASE__HOST=172.17.0.1
ISP_REDIS__HOST=172.17.0.1
ISP_STORAGE__ENDPOINT=http://172.17.0.1:9000
ISP_VAULT__URL=http://172.17.0.1:8200
ISP_CELERY__BROKER_URL=redis://172.17.0.1:6379/2
ISP_CELERY__RESULT_BACKEND=redis://172.17.0.1:6379/3
```

**Find your Docker bridge IP**:
```bash
docker network inspect bridge | grep Gateway
# Usually: 172.17.0.1
```

**Disadvantage**: Less portable, hard-coded IP address.

---

## Verification

After applying a fix, verify it works:

```bash
# Run the pre-flight check script
./scripts/check-external-services.sh

# Or test manually from a container
docker run --rm \
  --add-host host.docker.internal:host-gateway \
  alpine \
  ping -c 1 host.docker.internal
```

Expected output: `1 packets transmitted, 1 packets received`

---

## Recommended Approach by Environment

| Environment | Recommended Solution | Why |
|-------------|---------------------|-----|
| **macOS** | No changes needed ✅ | Docker Desktop includes `host.docker.internal` |
| **Windows** | No changes needed ✅ | Docker Desktop includes `host.docker.internal` |
| **Linux + Docker Desktop** | No changes needed ✅ | Docker Desktop includes `host.docker.internal` |
| **Linux (bare Docker Engine)** | Solution 2: `docker-compose.override.yml` | Clean, automatic, gitignoreable |
| **CI/CD** | Solution 1: `extra_hosts` in main files | Explicit, no external dependencies |

---

## Pre-Flight Check Script

Use the provided script to verify external services before launching:

```bash
./scripts/check-external-services.sh
```

**What it checks**:
1. ✅ `host.docker.internal` resolution
2. ✅ PostgreSQL (port 5432)
3. ✅ Redis (port 6379)
4. ✅ MinIO (port 9000)
5. ⚠️  Vault (port 8200) - optional
6. ⚠️  OTLP Collector (port 4317) - optional

**Sample output**:
```
========================================
External Services Pre-Flight Check
========================================

1. Checking host.docker.internal resolution...
   ✓ Resolves to: 172.17.0.1

2. Checking required services...
Checking PostgreSQL (host.docker.internal:5432)... ✓ Reachable
Checking Redis (host.docker.internal:6379)... ✓ Reachable
Checking MinIO (host.docker.internal:9000)... ✓ Reachable

3. Checking optional services...
Checking Vault (host.docker.internal:8200)... ⚠ Not reachable (optional)
Checking OTLP Collector (host.docker.internal:4317)... ⚠ Not reachable (optional)

========================================
Summary
========================================
✓ All required services are reachable

Pre-flight check PASSED
Ready to run: docker compose -f docker-compose.base.yml up -d
```

---

## Troubleshooting

### Issue: "Unknown host host.docker.internal"

**Cause**: Missing `extra_hosts` configuration on Linux.

**Fix**: Apply Solution 1 or 2 above.

---

### Issue: Services connect to container localhost instead of host

**Cause**: `localhost` resolves to the container's loopback, not the host.

**Fix**: Ensure environment variables use `host.docker.internal`, not `localhost`.

---

### Issue: Connection refused even with correct host

**Cause**: Firewall blocking container-to-host connections.

**Fix (Linux)**:
```bash
# Allow Docker containers to reach host services
sudo ufw allow from 172.17.0.0/16 to any port 5432 comment 'Docker PostgreSQL'
sudo ufw allow from 172.17.0.0/16 to any port 6379 comment 'Docker Redis'
sudo ufw allow from 172.17.0.0/16 to any port 9000 comment 'Docker MinIO'
```

Or bind services to `0.0.0.0` instead of `127.0.0.1`:
```bash
# PostgreSQL: Edit postgresql.conf
listen_addresses = '*'

# Redis: Edit redis.conf
bind 0.0.0.0
```

---

### Issue: "host-gateway not supported"

**Cause**: Docker Compose version < 2.10.

**Fix**: Upgrade Docker Compose:
```bash
# Check version
docker compose version

# Upgrade (Ubuntu/Debian)
sudo apt update && sudo apt install docker-compose-plugin

# Or use direct IP (Solution 4)
```

---

## Example: Complete docker-compose.override.yml for Linux

```yaml
# docker-compose.override.yml
# Linux-specific overrides for host.docker.internal resolution
# Place this file in the project root (same directory as docker-compose.base.yml)
# Docker Compose automatically merges this with the main compose file

services:
  platform-backend:
    extra_hosts:
      - "host.docker.internal:host-gateway"
    # Optional: Bind to specific network if needed
    # networks:
    #   - default

  platform-frontend:
    extra_hosts:
      - "host.docker.internal:host-gateway"

  isp-backend:
    extra_hosts:
      - "host.docker.internal:host-gateway"

  isp-frontend:
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

**Usage**:
```bash
# Automatically applied, no special flags needed
docker compose -f docker-compose.base.yml up -d
docker compose -f docker-compose.isp.yml up -d

# To explicitly specify override file (optional)
docker compose -f docker-compose.base.yml -f docker-compose.override.yml up -d
```

---

## Testing

After configuration, test the full stack:

```bash
# 1. Run pre-flight check
./scripts/check-external-services.sh

# 2. Start external services (if not already running)
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=dotmac \
  -e POSTGRES_USER=dotmac_user \
  -e POSTGRES_PASSWORD=change-me \
  postgres:16

docker run -d --name redis -p 6379:6379 redis:7-alpine

docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"

# 3. Start the application stack
docker compose -f docker-compose.base.yml up -d

# 4. Check logs for connection issues
docker compose -f docker-compose.base.yml logs platform-backend

# 5. Verify health check
curl http://localhost:8001/health
```

---

## Related Documentation

- **QUICK_START.md** - Quick start guide with external dependency warning
- **DOCKER_COMPOSE_PORT_CORRECTIONS.md** - Port mapping documentation
- **scripts/check-external-services.sh** - Pre-flight check script
- **DOCKER_COMPOSE_PORTABILITY_FIXES.md** - Original portability work

---

## Summary

**macOS/Windows (Docker Desktop)**: ✅ No changes needed

**Linux (Docker Engine)**:
1. ✅ Recommended: Create `docker-compose.override.yml` with `extra_hosts`
2. ✅ Alternative: Use environment variables with Docker bridge IP
3. ✅ Always: Run `./scripts/check-external-services.sh` before deployment

---

**Last Updated**: 2025-11-04
**Status**: ✅ Complete
**Author**: Claude (Anthropic)
