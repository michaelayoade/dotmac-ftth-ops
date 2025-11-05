# Environment Setup Guide

Complete instructions for bringing up the DotMac platform across **local development**, **staging**, and **production** environments.

---

## Environment Matrix

| Target | Purpose | Infra Command | Frontend Apps | Data Prep | Notes |
|--------|---------|---------------|---------------|-----------|-------|
| Local Development | Feature work, debugging | `make start-platform`, `make start-isp` | `pnpm dev:isp`, `pnpm dev:admin` | `make db-seed` (optional) | Hot reload enabled, seeded accounts available |
| Staging (Docker host) | Shared validation, QA | `ENVIRONMENT=staging make start-all` | `pnpm --filter <app> build && pnpm --filter <app> start` | `make db-seed` or curated fixtures | Run on a remote host/VM; adjust domains and ports |
| Production | Customer traffic | Hardened Compose run (`docker compose ... up -d`) | Pre-built Next.js apps served via `next start`/reverse proxy | Live data only | Enable TLS, external secrets, observability, systemd services |

---

## Shared Prerequisites

- **Docker Desktop / Docker Engine 24+ with Compose v2**
- **Python 3.12+** with [Poetry](https://python-poetry.org/docs/)
- **Node.js 18+** with [pnpm 9+](https://pnpm.io/installation)
- **GNU Make** (already used by the repo Makefile)
- At least **8 GB RAM / 50 GB free disk space** for the full stack

Clone the repository and create environment files that match your target:

```bash
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops
cp .env.example .env                 # Local dev defaults
cp .env.example .env.staging         # Staging overrides (edit credentials)
cp .env.example .env.production      # Production (harden secrets, disable dev flags)
```

> Use different secrets per environment. Never reuse the development defaults in staging or production.

---

## Baseline Infrastructure Workflow

All environments ultimately rely on two Compose definitions:

- `docker-compose.base.yml` — platform backend API + admin frontend
- `docker-compose.isp.yml` — ISP backend API + ISP operations frontend
- `scripts/infra.sh` — wrapper script used by the Makefile targets

Common commands:

```bash
make start-platform        # platform backend + admin UI
make start-isp             # ISP backend + operations UI
make status-all            # health summary
make logs-isp              # follow ISP service logs
make clean-all             # teardown (removes volumes!) – use with caution
```

You can call the wrapper directly for finer control:

```bash
./scripts/infra.sh platform start
./scripts/infra.sh isp status
./scripts/infra.sh all restart
```

---

## Backend Application Workflow

Install dependencies and run database migrations:

```bash
poetry install --with dev
poetry run alembic upgrade head
```

Start the API (Docker app service):

```bash
make dev              # foreground
# or
docker compose -f docker-compose.base.yml up platform-backend
```

For production/staging, bake the image and run it via Docker Compose (see `docker-compose.base.yml`) or your orchestrator.

> Need bare-metal debugging? `make dev-host` now routes through `scripts/quick-backend-start.sh`.
> Create `.env.local` from `.env.local.example` first so the script can apply the host defaults
> (`OBSERVABILITY__OTEL_ENDPOINT=http://localhost:4318`, etc.) before starting the API.

---

## Frontend Applications

All Next.js apps live under `frontend/apps/` and share the pnpm workspace.

### Local development

```bash
cd frontend
pnpm install
pnpm dev:isp                 # ISP operations portal (port 3001)
pnpm dev:admin               # platform admin portal (port 3002)
```

Each command runs `next dev` with hot reloading. Ensure `NEXT_PUBLIC_API_BASE_URL` points at your running API (defaults to `http://localhost:8000`).

### Staging & production builds

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm --filter @dotmac/isp-ops-app build
pnpm --filter @dotmac/platform-admin-app build

# Serve with a process manager/reverse proxy (after `pnpm install --frozen-lockfile`)
pnpm --filter @dotmac/isp-ops-app start -- -p 3001
pnpm --filter @dotmac/platform-admin-app start  # uses port 3002
```

Place these behind nginx/traefik and enable TLS for staging/production traffic.

---

## Environment Playbooks

### Local Development

1. **Clone & configure**: `.env` with dev defaults.
2. **Start infrastructure**:  
   ```bash
   make start-platform
   make start-isp               # optional
   ```
3. **Install & migrate**: `poetry install --with dev`, `poetry run alembic upgrade head`.
4. **Seed data (optional)**: `make db-seed`.
5. **Run API**: `make dev` (or `docker compose -f docker-compose.base.yml up -d platform-backend`).
6. **Run frontends**: `pnpm dev:isp`, `pnpm dev:admin`.
7. **Verify**: visit http://localhost:8000/docs, http://localhost:8001/docs (if ISP stack running), http://localhost:3001, http://localhost:3002.
8. **Troubleshoot**: `make status-all`, `docker logs <container> --tail 50`, `make clean-*` if rebuild needed.

### Staging

1. **Prepare host**: Install Docker Engine + Compose, pnpm, Poetry (or bake into an image).
2. **Copy repo & env**: check out the branch, create `.env.staging` with staging secrets/URLs.
3. **Run infrastructure** (typically on a single host or VM):
   ```bash
   export ENVIRONMENT=staging
   make start-all
   ```
   Alternatively: `./scripts/infra.sh all start`.
4. **Run migrations**:
   ```bash
   poetry install
   ENVIRONMENT=staging poetry run alembic upgrade head
   ```
5. **Seed sample data** (optional): `ENVIRONMENT=staging make db-seed`.
6. **Build frontends**: run the pnpm build commands, then serve with `next start` or containerize them.
7. **Expose services** via reverse proxy and HTTPS. Map staging domains to the relevant ports (3000/3001/3002, 8000, etc.) or publish Docker ingress.
8. **Monitoring**: point observability targets at your external stack or disable related health checks.

### Production

1. **Harden configuration**:
   - Generate unique secrets for `.env.production`.
   - Point database/Redis URLs at managed services (or use external Postgres/Redis hosts).
   - Set `VAULT__ENABLED=true` and supply real OpenBao/Vault credentials.
2. **Build images**:
   ```bash
   docker buildx build --platform linux/amd64 \
     -t registry.example.com/dotmac/api:$(git rev-parse --short HEAD) .
   docker buildx build --platform linux/amd64 \
     -f Dockerfile.freeradius \
     -t registry.example.com/dotmac/freeradius:$(git rev-parse --short HEAD) .
   ```
   Push to your container registry and update Compose image tags.
3. **Deploy infrastructure**:
   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.base.yml up -d platform-backend platform-frontend

   docker compose --env-file .env.production \
     -f docker-compose.isp.yml up -d isp-backend isp-frontend
   ```
   Scale services or split them across nodes as required.
4. **Run migrations** with the production settings:
   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.base.yml exec -T platform-backend \
     poetry run alembic upgrade head
   ```
5. **Frontends**: build once, serve via `next start` behind nginx/Envoy or export static builds if using ISR.
6. **Background workers**: use the provided systemd units (`deployment/systemd/dotmac-control-workers.service`) and customize the `.env` file for the host.
7. **Security & monitoring**:
   - Terminate TLS at a load balancer or reverse proxy.
   - Configure Vault/OpenBao with production policies.
   - Enable backups for Postgres/TimescaleDB and MinIO.
   - Hook Grafana/Alertmanager into your paging system.
8. **Smoke tests**: run API pings, frontend health checks, and synthetic auth flows before opening traffic.

---

## Seed Data & Accounts

- `make db-seed` populates demo tenants, subscribers, billing data, and default operator accounts.
- E2E credentials (from `E2E-TESTS-QUICK-START.md`):
  - `superadmin / admin123`
  - Additional role-based users are created by the seed script; check `scripts/seed_data.py`.
- Rotate or disable these users in staging/production.

---

## Verification Checklist

| Service | URL (default) | What to verify |
|---------|---------------|----------------|
| Platform API | http://localhost:8000/health | 200 OK health response |
| ISP API | http://localhost:8001/health | 200 OK health response (ISP stack) |
| FastAPI docs | http://localhost:8000/docs | OpenAPI renders |
| ISP Ops App | http://localhost:3001 | Can log in with seeded credentials |
| Platform Admin App | http://localhost:3002 | Navigation, tenant switcher |
| AWX | http://localhost:8052 | Web UI accessible |
| NetBox | http://localhost:8080 | Authentication works |
| Prometheus | http://localhost:9090 | Targets are `UP` |
| Grafana | http://localhost:3400 | Default admin login works (change immediately) |

---

## Tear Down & Troubleshooting

- Stop services: `make stop-platform`, `make stop-isp`, `make stop-all`.
- Remove containers/volumes: `make clean-platform`, `make clean-isp`, `make clean-all` (destructive).
- Reset database (dev only): `make db-reset`.
- Inspect logs: `make logs-platform`, `make logs-isp`, or `docker logs <container>`.
- Health checks:
  ```bash
  docker ps --format "table {{.Names}}\t{{.Status}}"
  docker compose -f docker-compose.base.yml ps
  docker compose -f docker-compose.isp.yml ps
  ```

For advanced debugging, refer to `docs/TROUBLESHOOTING_PLAYBOOKS.md`.
