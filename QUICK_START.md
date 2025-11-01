# Quick Start Guide

Use this checklist to get the DotMac platform and ISP services running locally in minutes. It mirrors the infrastructure scripts and defaults in `INFRASTRUCTURE.md`.

## Prerequisites

- Docker Desktop 20.10+ with Compose v2
- Python 3.12+ with Poetry
- Node.js 18+ with pnpm 9+
- ≥ 8 GB RAM / 50 GB free disk space

## Step 1: Clone and prepare the project

```bash
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops
cp .env.example .env   # update secrets as needed
```

## Step 2: Start core infrastructure

```bash
make start-platform        # postgres, redis, vault, minio
make start-platform-obs    # optional observability stack
```

Behind the scenes these commands invoke `./scripts/infra.sh`. You can inspect service health at any time:

```bash
make status-platform
make logs-platform
```

## Step 3: Start ISP services (optional)

```bash
make start-isp
make status-isp
```

This composes FreeRADIUS, NetBox, GenieACS, LibreNMS, WireGuard, TimescaleDB, and supporting workers.

### Apple Silicon tip

The FreeRADIUS container targets `linux/amd64`. On M-series Macs rebuild before first start:

```bash
docker build --platform linux/amd64 \
  -f Dockerfile.freeradius \
  -t freeradius-postgresql:latest .
```

## Step 4: Install dependencies and run services

```bash
poetry install --with dev
poetry run alembic upgrade head
poetry run uvicorn src.dotmac.platform.main:app \
  --reload --host 0.0.0.0 --port 8000
```

Frontend apps live in `frontend/`. For the base app:

```bash
cd frontend
pnpm install
pnpm dev:base-app   # see frontend/QUICK-START-MULTI-APP.md for all portals
```

## Step 5: Smoke checks

```bash
# Compose status
docker ps --format "table {{.Names}}\t{{.Status}}"

# Database connectivity
docker exec dotmac-ftth-ops-postgres-1 \
  psql -U dotmac_user -d dotmac -c "SELECT 1"

# Service probes
curl -I http://localhost:8000/health
curl -I http://localhost:8052   # AWX
curl -I http://localhost:8080   # NetBox
```

## Service URLs

| Service | URL | Default Credentials |
|---------|-----|---------------------|
| API | http://localhost:8000/docs | n/a |
| ISP Operations App | http://localhost:3001 | seeded accounts (`make db-seed`) |
| Platform Admin App | http://localhost:3002 | seeded accounts (`make db-seed`) |
| AWX | http://localhost:8052 | admin / changeme_awx_admin |
| NetBox | http://localhost:8080 | admin / admin |
| GenieACS | http://localhost:7567 | generated on first visit |
| LibreNMS | http://localhost:8000 | setup wizard |
| MinIO | http://localhost:9001 | minioadmin / minioadmin123 |

## Troubleshooting

```bash
# Tail logs
docker logs <container> --tail 50

# Restart single service
docker compose -f docker-compose.isp.yml restart <service>

# Clean restart (DESTRUCTIVE)
make clean-platform
make clean-isp
make start-platform
make start-isp
```

Need more context? Start with `INFRASTRUCTURE.md`, `README-INFRASTRUCTURE.md`, the full documentation index at `docs/INDEX.md`, or the environment playbook in `docs/ENVIRONMENT_SETUP.md`.
