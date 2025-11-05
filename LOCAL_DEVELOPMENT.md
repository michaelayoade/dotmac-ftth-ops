# Local Development Guide

**For running the backend directly on your host machine (not in Docker)**

---

## Quick Start

### Option 1: Automated (Recommended)

```bash
# One command to start backend with proper configuration
./scripts/dev-backend.sh
```

This script will:
1. Create `.env.local` if it doesn't exist
2. Check that required services (PostgreSQL, Redis, MinIO) are running
3. Configure environment for host-based development
4. Start the backend

---

### Option 2: Manual Setup

```bash
# 1. Copy environment template
cp .env.local.example .env.local

# 2. Load environment
source .env.local

# 3. Start backend (delegates to scripts/quick-backend-start.sh)
cd frontend && pnpm dev:backend
```

---

## Why This Matters

When running via `pnpm dev:backend`, the backend runs **on your host** (not in a container). This requires different configuration than containerized deployment:

### Container vs Host Configuration

| Service | Container Default | Host Default | Why Different? |
|---------|------------------|--------------|----------------|
| PostgreSQL | `host.docker.internal:5432` | `localhost:5432` | Already on host |
| Redis | `host.docker.internal:6379` | `localhost:6379` | Already on host |
| MinIO | `http://host.docker.internal:9000` | `http://localhost:9000` | Already on host |
| OTEL | `http://host.docker.internal:4318` | `http://localhost:4318` | Already on host |
| Alertmanager | `http://localhost:9093` | `<disabled>` | Optional for dev |

**Key Point**: Inside a container, `localhost` means the container itself. On the host, `localhost` means the host machine.

---

## Required Services

The backend needs these services running on localhost:

1. **PostgreSQL** (port 5432) - Database
2. **Redis** (port 6379) - Caching, sessions, Celery broker
3. **MinIO** (port 9000) - Object storage

### Quick Start Commands

```bash
# PostgreSQL
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=dotmac \
  -e POSTGRES_USER=dotmac_user \
  -e POSTGRES_PASSWORD=change-me \
  postgres:16

# Redis
docker run -d --name redis -p 6379:6379 redis:7-alpine

# MinIO
docker run -d --name minio -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  minio/minio server /data --console-address ":9001"
```

---

## Optional Services

These services enhance development but aren't required:

### OTEL Collector (port 4318/4317)

For distributed tracing. If not running, traces are disabled automatically.

```bash
# Start via docker-compose
docker compose --profile monitoring up -d otel-collector
```

### Alertmanager (port 9093)

For alert management. Can be disabled in local dev:

```bash
# In .env.local
export OBSERVABILITY__ALERTMANAGER_BASE_URL=
```

---

## Avoiding "Degraded Mode" Warnings

When you see this in startup logs:

```
Alertmanager health check failed: [Errno 61] Connection refused
Required services unavailable: observability, alertmanager
Running in degraded mode
```

**This is expected behavior** for local development. The backend is healthy - it's just warning that optional observability services aren't available.

### To Eliminate the Warning

**Option 1**: Disable Alertmanager check (recommended for local dev)

```bash
# In .env.local
export OBSERVABILITY__ALERTMANAGER_BASE_URL=
```

**Option 2**: Start Alertmanager

```bash
docker compose --profile monitoring up -d alertmanager
```

**Option 3**: Configure OTEL endpoint correctly

```bash
# In .env.local
# NOTE: Base URL only - health check appends /v1/traces automatically
export OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
```

---

## Configuration Reference

### Key Environment Variables for Local Development

```bash
# Observability (prevent degraded mode)
# NOTE: Base URL only - health check appends /v1/traces automatically
export OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OBSERVABILITY__ALERTMANAGER_BASE_URL=  # Empty = disabled

# Database (defaults work for localhost)
export DATABASE__HOST=localhost
export DATABASE__PORT=5432
export DATABASE__DATABASE=dotmac
export DATABASE__USERNAME=dotmac_user
export DATABASE__PASSWORD=change-me

# Redis (defaults work for localhost)
export REDIS__HOST=localhost
export REDIS__PORT=6379
export REDIS__DB=0

# MinIO (defaults work for localhost)
export STORAGE__ENDPOINT=http://localhost:9000
export STORAGE__ACCESS_KEY=minioadmin
export STORAGE__SECRET_KEY=minioadmin123
export STORAGE__BUCKET=isp-platform

# Celery (defaults work for localhost)
export CELERY__BROKER_URL=redis://localhost:6379/2
export CELERY__RESULT_BACKEND=redis://localhost:6379/3

# Development settings
export ENVIRONMENT=development
export LOG_LEVEL=debug
export REQUIRE_REDIS_SESSIONS=false
```

---

## Verification

After starting the backend, you should see:

```
======================================================================
Infrastructure Health Check Report
======================================================================

Total Services: 10
✅ Healthy: 10
❌ Unhealthy: 0
⚠️  Unknown: 0

✅ HEALTHY SERVICES:
   • PostgreSQL                TCP connection successful
   • Redis                     TCP connection successful
   • MinIO                     HTTP 200
   • Vault/OpenBao             HTTP 200
   • OTEL Collector            HTTP 200
   • Prometheus                HTTP 200
   • Celery Broker (Redis)     TCP connection successful
   • Jaeger UI                 HTTP 200
   • Grafana                   HTTP 200
   • Flower (Celery Monitor)   HTTP 200

======================================================================
```

**No "Running in degraded mode" message** = Perfect configuration!

---

## Troubleshooting

### Backend fails to start with database connection error

**Cause**: PostgreSQL not running

**Fix**:
```bash
docker ps | grep postgres  # Check if running
docker start postgres      # If stopped
# Or start fresh (see "Required Services" above)
```

---

### "Running in degraded mode" warning

**Cause**: OTEL or Alertmanager not configured correctly

**Fix**: See "Avoiding Degraded Mode Warnings" section above

---

### MinIO bucket not found errors

**Cause**: Bucket not created

**Fix**:
```bash
# Access MinIO Console
open http://localhost:9001

# Login: minioadmin / minioadmin123
# Create bucket: isp-platform
```

---

### Redis connection refused

**Cause**: Redis not running

**Fix**:
```bash
docker ps | grep redis  # Check if running
docker start redis      # If stopped
# Or start fresh (see "Required Services" above)
```

---

## Files

| File | Purpose |
|------|---------|
| `.env.local.example` | Template with all configuration options |
| `.env.local` | Your local configuration (gitignored) |
| `scripts/dev-backend.sh` | Automated startup script |
| `LOCAL_DEVELOPMENT.md` | This guide |

---

## Related Documentation

- **Docker Compose**: `QUICK_START.md`, `DOCKER_COMPOSE_PORT_CORRECTIONS.md`
- **Linux Compatibility**: `DOCKER_COMPOSE_LINUX_COMPATIBILITY.md`
- **Production Deployment**: `FINAL_IMPLEMENTATION_SUMMARY.md`

---

## Summary

**Local Development Workflow**:

```bash
# 1. Ensure required services running
docker ps | grep -E "postgres|redis|minio"

# 2. Start backend
./scripts/dev-backend.sh

# 3. In another terminal, start frontend
cd frontend
pnpm dev:admin  # or pnpm dev:isp

# 4. Access
# Backend API: http://localhost:8000
# Frontend: http://localhost:3000
```

---

**Last Updated**: 2025-11-04
**Status**: ✅ Complete
**Author**: Claude (Anthropic)
