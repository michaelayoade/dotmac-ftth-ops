# Makefile Enhancement - Development Stack Commands

## Summary

Added comprehensive development commands to the Makefile for starting backend and frontend with intelligent infrastructure management.

---

## New Commands

### 🚀 Quick Start (Recommended)

```bash
make dev
```

**What it does:**
1. ✅ Checks if infrastructure is already running
2. 🚀 Starts all services if needed (or skips if already running)
3. 🔍 Waits for services to be healthy
4. 🎯 Starts backend on port 8000
5. 🌐 Starts frontend on port 3000

**No conflicts** - intelligently detects running services and skips starting them!

---

## All Available Commands

### Development Stack

| Command | Description |
|---------|-------------|
| `make dev` | Start full stack (infra + backend + frontend) |
| `make dev-all` | Start backend + frontend (requires infra running) |
| `make dev-backend` | Start backend only on port 8000 |
| `make dev-frontend` | Start frontend only on port 3000 |

### Infrastructure Management

| Command | Description |
|---------|-------------|
| `make start-all` | Start ALL infrastructure services |
| `make stop-all` | Stop all infrastructure services |
| `make status-all` | Check infrastructure health |

---

## Infrastructure Services Started

### Core Services (Always)
- ✅ **PostgreSQL** - Database (port 5432)
- ✅ **Redis** - Cache & sessions (port 6379)
- ✅ **OpenBao/Vault** - Secrets (port 8200)
- ✅ **MinIO** - S3 storage (ports 9000, 9001)

### Additional Services (With Profiles)
- ✅ **Jaeger** - Distributed tracing (port 16686)
- ✅ **Celery Workers** - Background tasks
- ✅ **Flower** - Celery monitoring (port 5555)

**All services are started by default** - no manual profile activation needed!

---

## Smart Infrastructure Detection

The new `scripts/check_infra.sh` script provides:

### ✅ Detects Running Services
```bash
$ make dev
🔍 Checking infrastructure services...

  ✓ dotmac-postgres (running)
  ✓ dotmac-redis (running)
  ✓ dotmac-openbao (running)
  ✓ dotmac-minio (running)
  ✓ dotmac-jaeger (running)

✅ All services already running!
```

### 🚀 Starts Missing Services
```bash
$ make dev
🔍 Checking infrastructure services...

  ✗ dotmac-postgres (not running)
  ✗ dotmac-redis (not running)

Starting services: dotmac-postgres dotmac-redis ...
Waiting for services to be ready...
  Waiting for dotmac-postgres to be healthy ✓
  Waiting for dotmac-redis to be healthy ✓

✅ All services started successfully!
```

### ⚠️ Detects Port Conflicts
```bash
$ make dev
🔍 Checking infrastructure services...

  ⚠ Port 5432 in use (container not running, possible conflict)
```

---

## Usage Examples

### Scenario 1: First Time Setup
```bash
# Install dependencies
make install

# Start everything
make dev
```

**Output:**
```
🚀 Starting full development stack...

🔍 Checking infrastructure services...
Starting services: dotmac-postgres dotmac-redis dotmac-openbao dotmac-minio dotmac-jaeger
Waiting for services to be ready...
  Waiting for dotmac-postgres to be healthy ✓
  Waiting for dotmac-redis to be healthy ✓
  Waiting for dotmac-openbao to be healthy ✓
  Waiting for dotmac-minio to be healthy ✓

✨ Full stack ready!

  📦 Infrastructure:
    PostgreSQL:  localhost:5432
    Redis:       localhost:6379
    Vault:       localhost:8200
    MinIO API:   localhost:9000
    MinIO UI:    localhost:9001
    Jaeger UI:   http://localhost:16686
    Flower UI:   http://localhost:5555

  🚀 Application:
    Backend:     http://localhost:8000
    Frontend:    http://localhost:3000
    API Docs:    http://localhost:8000/docs

Starting backend + frontend...
🚀 Starting backend on http://localhost:8000
   API docs: http://localhost:8000/docs
🚀 Starting frontend on http://localhost:3000
```

### Scenario 2: Already Running
```bash
# Infrastructure already up from yesterday
make dev
```

**Output:**
```
🚀 Starting full development stack...

🔍 Checking infrastructure services...

  ✓ dotmac-postgres (running)
  ✓ dotmac-redis (running)
  ✓ dotmac-openbao (running)
  ✓ dotmac-minio (running)
  ✓ dotmac-jaeger (running)

✅ All services already running!

✨ Full stack ready!
[same as above...]
```

### Scenario 3: Backend Only
```bash
# Just need backend for API testing
make start-all
make dev-backend
```

### Scenario 4: Frontend Only
```bash
# Just need a portal for UI work
cd frontend
pnpm dev:isp   # or pnpm dev:admin
```

---

## Files Modified

### 1. `Makefile`
**New targets added:**
- `dev` - Full development stack
- `dev-all` - Backend + frontend only
- `dev-backend` - Backend only
- `dev-frontend` - Frontend only

**Updated targets:**
- `start-all` - Now uses smart check script
- `stop-all` - Now uses check script
- `status-all` - Now uses check script

### 2. `scripts/check_infra.sh` (NEW)
**Features:**
- Checks if containers are running
- Checks for port conflicts
- Starts missing services
- Waits for health checks
- Shows status table

**Modes:**
- `up` - Start infrastructure
- `dev` - Start for development (same as up)
- `status` - Show running services
- `down` - Stop all services

---

## Docker Compose Profiles Used

The `make start-all` and `make dev` commands start services with these profiles:

```bash
docker-compose up -d postgres redis openbao minio \
    --profile storage \
    --profile observability \
    --profile celery
```

This ensures **all services** are started, not just the core ones.

---

## Benefits

### ✅ No Conflicts
- Checks if services are already running
- Skips starting services that are up
- Warns about port conflicts

### ✅ No Manual Steps
- One command starts everything
- Automatically waits for health checks
- Shows all URLs when ready

### ✅ Smart & Fast
- Parallel backend + frontend startup (`-j2`)
- Reuses running infrastructure
- Clear status messages

### ✅ Developer Friendly
- Shows all URLs and ports
- Clear error messages
- Easy troubleshooting

---

## Comparison

### Before
```bash
# Manual steps required:
docker-compose up -d postgres redis openbao
docker-compose --profile storage up -d
docker-compose --profile observability up -d
docker-compose --profile celery up -d
sleep 10  # Hope it's ready?

# Terminal 1
./scripts/quick-backend-start.sh  # or ./scripts/dev-backend.sh

# Terminal 2
cd frontend && pnpm dev:isp
```

### After
```bash
make dev  # That's it! ✨
```

---

## Troubleshooting

### Infrastructure won't start
```bash
# Check what's running
make status-all

# View logs
docker logs dotmac-postgres
docker logs dotmac-redis

# Restart everything
make stop-all
make start-all
```

### Port already in use
```bash
# Find what's using the port
lsof -i :5432
lsof -i :8000

# Kill the process or change port
```

### Service unhealthy
```bash
# Check health
make status-all

# Restart specific service
docker restart dotmac-postgres
```

---

## Quick Reference Card

```bash
# Start everything (infrastructure + backend + frontend)
make dev

# Check what's running
make status-all

# Stop everything
make stop-all

# Backend only
make dev-backend

# Frontend only
make dev-frontend

# Run tests
make test

# Format code
make format
```

---

## Environment URLs

When `make dev` completes, you'll have:

### Infrastructure
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- Vault: `http://localhost:8200`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`
- Jaeger UI: `http://localhost:16686`
- Flower UI: `http://localhost:5555`

### Application
- Backend API: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`
- Frontend: `http://localhost:3000`

---

## Related Documentation

- **Full Guide**: See `DEV_SETUP_GUIDE.md` for comprehensive setup instructions
- **Backend Config**: See `.env` for backend configuration
- **Frontend Config**: See `frontend/apps/isp-ops-app/.env.local` and `frontend/apps/platform-admin-app/.env.local`
- **MinIO Fix**: See `SESSION_SUMMARY.md` for MinIO configuration fixes

---

**Status**: ✅ Complete and tested
**Files Modified**: 2 (Makefile + check_infra.sh)
**Files Created**: 2 (check_infra.sh + DEV_SETUP_GUIDE.md)
**Breaking Changes**: None (all new commands)
