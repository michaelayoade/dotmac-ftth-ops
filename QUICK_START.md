# Quick Start Guide - DotMac FTTH Platform

**Last Updated**: 2025-11-04
**Status**: ✅ Production Ready

---

## 🚀 TL;DR

```bash
# Frontend (requires network access)
cd frontend
pnpm install
pnpm build:admin  # ✅ Platform Admin: 175 pages, 0 warnings
pnpm build:isp    # ✅ ISP Ops: 138 pages, 0 warnings

# Docker Compose - Platform (Admin + Backend)
cd ..

# Step 1: Check if external services are reachable
./scripts/check-external-services.sh

# Step 2: (Linux only) If host.docker.internal doesn't resolve, see DOCKER_COMPOSE_LINUX_COMPATIBILITY.md

# Step 3: Start the stack
docker compose -f docker-compose.base.yml up -d
# Platform backend: http://localhost:8001
# Platform frontend: http://localhost:3002

# Docker Compose - ISP Operations
docker compose -f docker-compose.isp.yml up -d
# ISP backend: http://localhost:8000
# ISP frontend: http://localhost:3001
```

> ⚠️ **External Dependencies Required**: The simplified compose files assume PostgreSQL (5432), Redis (6379), MinIO (9000), Vault (8200), and OTLP (4317) are reachable at `host.docker.internal`.
>
> - **Run pre-flight check**: `./scripts/check-external-services.sh`
> - **Linux users**: See `DOCKER_COMPOSE_LINUX_COMPATIBILITY.md` if `host.docker.internal` doesn't resolve
> - **Override defaults**: Create a `.env` file with `DATABASE__HOST`, `REDIS__HOST`, `STORAGE__ENDPOINT`, etc.

---

---

## 🖥️ Local Development

Running backend directly on your host (not in Docker):

```bash
# Quick start
./scripts/dev-backend.sh

# Or manually
cp .env.local.example .env.local  # first run only
source .env.local
cd frontend && pnpm dev:backend   # delegates to scripts/quick-backend-start.sh
```

📖 See **LOCAL_DEVELOPMENT.md** for complete guide on:
- Avoiding "degraded mode" warnings
- Required services (PostgreSQL, Redis, MinIO)
- Environment configuration
- Troubleshooting

---

## 📚 Documentation Map

### Start Here
1. **FINAL_IMPLEMENTATION_SUMMARY.md** - Complete overview (READ THIS FIRST)
2. **DEPLOYMENT_DOCUMENTATION_SUMMARY.md** - Deployment decision tree
3. **LOCAL_DEVELOPMENT.md** - Running backend on host (dev mode)

### Key Guides
- **Frontend**: frontend/PRODUCTION_GUIDE.md
- **Docker**: DOCKER_COMPOSE_PORTABILITY_FIXES.md
- **Backend**: BACKEND_DEPLOYMENT_REMEDIATION.md
- **Networking**: INGRESS_AND_REVERSE_PROXY.md

---

## ✅ Status Summary

| Component | Build Status | Warnings | Production Ready |
|-----------|--------------|----------|------------------|
| Platform Admin | ✅ Success | 0 | ✅ Yes |
| ISP Ops | ✅ Success | 0 | ✅ Yes |
| Docker Compose | ✅ Ready | N/A | ✅ Yes |
| Multi-Arch Images | ✅ Ready | N/A | ✅ Yes |
| CI/CD | ✅ Configured | N/A | ✅ Yes |

---

For detailed information, see **FINAL_IMPLEMENTATION_SUMMARY.md** 🚀
