# Quick Start Guide

## TL;DR - Get Everything Running

```bash
# 1. Rebuild FreeRADIUS for Apple Silicon
docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .

# 2. Start base infrastructure
docker compose -f docker-compose.base.yml up -d postgres redis

# 3. Wait 30 seconds for postgres to initialize databases
sleep 30

# 4. Start ISP services
docker compose -f docker-compose.isp.yml up -d

# 5. Check status
docker ps
```

## What Was Fixed

### ✅ Issue 1: AWX Database Not Found
**Problem**: AWX containers crashed with "database awx does not exist"

**Solution**:
- Created `database/init/02-create-databases.sql` to auto-create awx, netbox, librenms databases
- Mounted init scripts in docker-compose.base.yml:15
- Created AWX settings file at `config/awx/settings.py`
- Mounted settings file in both awx-web and awx-task containers

### ✅ Issue 2: FreeRADIUS Restart Loop on Apple Silicon
**Problem**: FreeRADIUS container restarting continuously on M-series Macs

**Solution**:
- Added `platform: linux/amd64` to docker-compose.isp.yml:9
- Updated Dockerfile.freeradius:6 with `FROM --platform=linux/amd64`
- Requires rebuilding image: `docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .`

### ✅ Issue 3: Network Isolation
**Problem**: ISP services couldn't reach postgres/redis (Name or service not known)

**Solution**:
- Mapped external network in docker-compose.isp.yml:358
- Changed from `external: true` to `external: true; name: dotmac-ftth-ops-network`
- All services now on same network

## Files Changed

```
Modified:
  ✏️ docker-compose.base.yml (line 15)
  ✏️ docker-compose.isp.yml (lines 9, 263, 293, 358)
  ✏️ Dockerfile.freeradius (line 6)

Created:
  ➕ database/init/02-create-databases.sql
  ➕ config/awx/settings.py
  ➕ DEPLOYMENT_GUIDE.md
  ➕ QUICK_START.md (this file)
```

## Verify Everything Works

```bash
# Should show all containers running (not restarting)
docker ps --format "table {{.Names}}\t{{.Status}}"

# Expected running services:
# ✅ isp-awx-web          (Up X seconds)
# ✅ isp-awx-task         (Up X minutes)
# ✅ isp-freeradius       (Up X minutes)
# ✅ isp-netbox           (Up X minutes, healthy)
# ✅ isp-netbox-worker    (Up X minutes)
# ✅ isp-genieacs         (Up X minutes, healthy)
# ✅ isp-mongodb          (Up X minutes, healthy)
# ✅ isp-timescaledb      (Up X minutes, healthy)
# ✅ isp-librenms         (Up X minutes)
# ✅ isp-wireguard        (Up X minutes)
# ✅ dotmac-postgres-1    (Up X minutes, healthy)
# ✅ dotmac-redis-1       (Up X minutes, healthy)
```

## Quick Health Checks

```bash
# Test database connectivity
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d awx -c "SELECT 1"

# Test FreeRADIUS
docker logs isp-freeradius | tail -20

# Test AWX
curl -I http://localhost:8052

# Test NetBox
curl -I http://localhost:8080
```

## Access Services

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| AWX | http://localhost:8052 | admin / changeme_awx_admin |
| NetBox | http://localhost:8080 | admin / admin |
| GenieACS | http://localhost:7567 | (created on first access) |
| LibreNMS | http://localhost:8000 | (setup wizard) |
| MinIO | http://localhost:9001 | minioadmin / minioadmin123 |

## Still Having Issues?

```bash
# Check logs for specific service
docker logs <container_name> --tail 50

# Restart a service
docker compose -f docker-compose.isp.yml restart <service_name>

# Complete reset (WARNING: deletes all data)
docker compose -f docker-compose.isp.yml down -v
docker compose -f docker-compose.base.yml down -v
# Then start from Step 1 above
```

## Next Steps

1. Change default passwords in `.env` file
2. Run AWX database migrations: `docker exec -it isp-awx-web awx-manage migrate`
3. Configure RADIUS clients in `./config/radius/clients.conf`
4. Set up NetBox network inventory
5. Configure GenieACS for your CPE devices

See `DEPLOYMENT_GUIDE.md` for detailed documentation.
