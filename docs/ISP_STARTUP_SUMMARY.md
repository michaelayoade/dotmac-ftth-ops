# ISP & Platform Services — Complete 3WH Runbook

This document is a comprehensive, novice-friendly reference listing every service used by the DotMac ISP/FTTH platform. For each service you will find:

- Why: The role and motivation for the service. What problem it solves.
- Where: Where the service appears in this repository or stack (compose service name, key files, and code paths).
- When: Lifecycle and timing — when the service needs to be running or used.
- How: Practical operation notes — how to start it locally, key environment variables, example commands, and common troubleshooting tips.

Use this as a living runbook. Each section is written so that someone unfamiliar with the platform can follow the basic commands and see where to dig deeper.

## Contents
- Platform backend (FastAPI)
- ISP backend (tenant variant)
- Platform frontend (Next.js)
- ISP frontend (Next.js)
- PostgreSQL
- Redis
- MinIO (S3-compatible)
- MeiliSearch
- Elasticsearch (optional)
- Celery + Flower (background tasks)
- RabbitMQ (optional broker)
- OpenTelemetry / Jaeger / OTEL collector
- Prometheus
- Grafana
- Loki (logs)
- FreeRADIUS
- GenieACS + MongoDB (TR-069)
- VOLTHA integration
- WireGuard management
- NetBox (IPAM/DCIM)
- OpenBao (dev vault) / Vault patterns
- Ansible / AWX (provisioning)
- Nginx / TLS (Certbot)
- Webhooks & Integrations
- Realtime (WebSocket / SSE)
- Notifications / Push / Communications
- File storage & Data import/export
- Services catalog & Billing integrations
- Orchestration, Jobs & Scheduling
- AI endpoints (assistant features)
- Licensing & Feature Flags
- Monitoring sub-services (metrics, traces, alerts)
- Developer tooling and seed scripts

---

## Platform backend (FastAPI)
- **Why:** Main API server for business logic, authentication, tenant isolation, database access, and background work. Exposes REST and GraphQL endpoints.
- **Where:** `src/dotmac/platform/`, service name `platform-backend` in `docker-compose.base.yml`, entrypoint `uvicorn dotmac.platform.main:app`.
- **When:** Must be running for all platform operations (dev, staging, prod, CI).
- **How:**
  - Local: `poetry install && poetry run uvicorn dotmac.platform.main:app --reload --port 8000`
  - Docker: `docker compose -f docker-compose.base.yml up -d platform-backend`
  - Migrations: `poetry run alembic upgrade head`
  - Env: `DATABASE_URL`, `REDIS__HOST`, `AUTH__JWT_SECRET_KEY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `VAULT__ENABLED`

## ISP backend (tenant variant)
- **Why:** Tenant-scoped backend for ISP-specific stacks (dedicated DB, Redis, ports).
- **Where:** `docker-compose.isp.yml`, Ansible playbooks for per-tenant configs.
- **When:** Used for tenant environments (hosted or customer-hosted).
- **How:**
  - Compose: `docker compose -f docker-compose.isp.yml up -d isp-backend`
  - Ansible sets tenant-specific envs and ports.

## Platform frontend (Next.js admin)
- **Why:** Admin UI for platform operators (manage tenants, plugins, billing, settings).
- **Where:** `frontend/apps/platform-admin-app/`, service `platform-frontend`.
- **When:** Run in dev for UI work, in prod for admin access.
- **How:**
  - Dev: `cd frontend && pnpm install && pnpm --filter @dotmac/platform-admin-app dev`
  - Prod: `pnpm --filter @dotmac/platform-admin-app build && docker compose -f docker-compose.base.yml up -d platform-frontend`
  - Env: `NEXT_PUBLIC_API_BASE_URL`, `BETTER_AUTH_SECRET`, `JWT_SECRET`

## ISP frontend (Next.js tenant app)
- **Why:** Tenant-facing UI for ISP operators (subscribers, devices, field workflows).
- **Where:** `frontend/apps/isp-ops-app/`, service `isp-frontend`.
- **When:** Run for tenant UI (dev, staging, prod).
- **How:**
  - Dev: `cd frontend && pnpm --filter @dotmac/isp-ops-app dev`
  - Env: `NEXT_PUBLIC_API_BASE_URL`, `BETTER_AUTH_SECRET`

## PostgreSQL
- **Why:** Main relational DB for tenants, users, billing, RADIUS, etc.
- **Where:** `dotmac-postgres` in `docker-compose.infra.yml`.
- **When:** Must be up before backend, RADIUS, NetBox.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-postgres`
  - Migrate: `poetry run alembic upgrade head`
  - Env: `DATABASE_URL`

## Redis
- **Why:** Sessions, cache, rate-limiting, Celery broker/result backend.
- **Where:** `dotmac-redis` in `docker-compose.infra.yml`.
- **When:** Needed for sessions, background tasks.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-redis`
  - Env: `SESSION_REDIS_URL`, `CELERY__BROKER_URL`

## MinIO (S3-compatible)
- **Why:** Stores uploaded files, exports, binary assets (dev/on-prem).
- **Where:** `dotmac-minio` in infra compose.
- **When:** Needed for file storage.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-minio`
  - Web UI: `http://localhost:9001`
  - Env: `STORAGE__ENDPOINT`, `STORAGE__ACCESS_KEY`, `STORAGE__SECRET_KEY`

## MeiliSearch
- **Why:** Fast full-text search for UI features.
- **Where:** `dotmac-meilisearch` in infra compose.
- **When:** Needed for search features.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-meilisearch`
  - Env: `MEILI_MASTER_KEY`

## Elasticsearch (optional)
- **Why:** Heavier search/analytics (optional).
- **Where:** Client support in `pyproject.toml`.
- **When:** Deploy if needed.
- **How:** Provision cluster, set envs.

## Celery + Flower (background jobs)
- **Why:** Background tasks (billing, emails, imports, provisioning).
- **Where:** Worker images/services in compose/playbooks.
- **When:** Workers must run for background jobs.
- **How:**
  - Start: `docker compose -f docker-compose.base.yml up -d platform-worker`
  - Local: `poetry run celery -A dotmac.platform.tasks worker --loglevel=info`
  - Env: `CELERY__BROKER_URL`

## RabbitMQ (optional broker)
- **Why:** Alternative Celery broker (AMQP).
- **Where:** Optional, extras in `pyproject.toml`.
- **When:** Use if AMQP needed.
- **How:** Provision RabbitMQ, set `CELERY__BROKER_URL`.

## OpenTelemetry / Jaeger / OTEL collector
- **Why:** Distributed traces for debugging.
- **Where:** Backend uses OTel libs, exports to Jaeger/OTEL collector.
- **When:** Enable in dev/staging/prod.
- **How:**
  - Env: `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OBSERVABILITY__OTEL_ENDPOINT`
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-jaeger`

## Prometheus
- **Why:** Metrics scraping and alerting.
- **Where:** `prometheus.yml`, service `dotmac-prometheus`.
- **When:** Needed for metrics/alerts.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-prometheus`
  - UI: `http://localhost:9090`

## Grafana
- **Why:** Dashboards and alert visualization.
- **Where:** `dotmac-grafana` in infra compose.
- **When:** Used by operators.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-grafana`
  - UI: `http://localhost:3000` (default `admin/admin`)

## Loki (logs)
- **Why:** Centralized logs for Grafana.
- **Where:** `dotmac-loki` in infra compose.
- **When:** Useful for log queries.
- **How:** Push logs to Loki, query in Grafana.

## FreeRADIUS
- **Why:** RADIUS server for subscriber authentication/accounting.
- **Where:** `dotmac-freeradius` in infra compose, Ansible templates for configs.
- **When:** Needed for network AAA.
- **How:**
  - Ports: UDP 1812 (auth), 1813 (acct)
  - Troubleshoot: check `radiusd` logs, client secrets

## GenieACS + MongoDB (TR-069)
- **Why:** Device management for TR-069/CWMP devices.
- **Where:** `dotmac-genieacs`, `dotmac-mongodb` in infra compose.
- **When:** Needed for device management/provisioning.
- **How:**
  - Start: `docker compose -f docker-compose.infra.yml up -d dotmac-genieacs dotmac-mongodb`
  - Env: `GENIEACS_MONGODB_CONNECTION_URL`

## VOLTHA integration
- **Why:** Manage PON access devices (OLTs, ONUs) in FTTH stacks.
- **Where:** `src/dotmac/platform/voltha/router.py`.
- **When:** Used for fiber device onboarding/provisioning.
- **How:** Env: `VOLTHA_HOST`, `VOLTHA_PORT`

## WireGuard management
- **Why:** Manage VPN peers for secure connections.
- **Where:** `src/dotmac/platform/wireguard/router.py`.
- **When:** When VPN tunnels are created/rotated.
- **How:** Uses system tools or controller API.

## NetBox (IPAM/DCIM)
- **Why:** IP address/device inventory management.
- **Where:** `dotmac-netbox` in infra compose, `src/dotmac/platform/netbox/router.py`.
- **When:** Used for network provisioning/reconciliation.
- **How:** UI: `http://localhost:8080`, Env: `NETBOX_URL`, `NETBOX_TOKEN`

## OpenBao (dev vault) / Vault patterns
- **Why:** Dev secret store for local development.
- **Where:** `dotmac-openbao` in infra compose, backend uses `hvac`.
- **When:** Used in dev, replace in prod.
- **How:** Env: `BAO_DEV_ROOT_TOKEN_ID`, `BAO_ADDR`, `VAULT__ENABLED`

## Ansible / AWX (provisioning)
- **Why:** Automate tenant onboarding, upgrades, decommissioning.
- **Where:** `ansible/` playbooks, AWX for orchestration.
- **When:** Run for tenant lifecycle operations.
- **How:**
  - `ansible-playbook ansible/playbooks/provision_tenant.yml -e tenant_id=isp-001 -e deployment_mode=customer_hosted`

## Nginx / TLS (Certbot)
- **Why:** HTTP reverse proxy, WebSocket proxy, TLS termination.
- **Where:** Ansible templates, Nginx service in compose/systemd.
- **When:** Needed for public exposure with TLS.
- **How:** Certbot provisions/renews certificates.

## Webhooks & Integrations
- **Why:** Receive/send events to external systems (payments, carriers, SMS, monitoring).
- **Where:** `src/dotmac/platform/webhooks/router.py`, `integrations/router.py`.
- **When:** When external systems push events or platform dispatches outbound events.
- **How:** Ensure webhook URL is reachable, secrets in Vault/OpenBao.

## Realtime (WebSocket / SSE)
- **Why:** Push live updates to UIs (provisioning, field tech, logs, notifications).
- **Where:** `src/dotmac/platform/realtime/router.py`.
- **When:** During sessions needing live updates.
- **How:** Frontends connect to WS endpoint (`NEXT_PUBLIC_WS_URL`), backend uses pub/sub.

## Notifications / Push / Communications
- **Why:** Transactional messages (email, SMS), push notifications, templated communications.
- **Where:** `src/dotmac/platform/notifications/router.py`, `push/router.py`, `communications/router.py`.
- **When:** On user events, scheduled messages, alerts.
- **How:** Env: SMTP, SMS provider, VAPID keys, Vault.

## File storage & Data import/export
- **Why:** Upload/process files (CSV, Excel, PDF), export reports, large data transfers.
- **Where:** `file_storage/router.py`, `data_import/router.py`, `data_transfer/router.py`.
- **When:** For user imports/exports, automated jobs.
- **How:** Uses MinIO, imports via Celery tasks.

## Services catalog & Billing integrations
- **Why:** Products, plans, add-ons, lifecycle, billing cycles.
- **Where:** `services/`, `billing/` router modules.
- **When:** Customer purchases, billing runs, provisioning.
- **How:** Billing triggers Celery jobs, invoices, webhooks for payments.

## Orchestration, Jobs & Scheduling
- **Why:** Run long workflows (provisioning, scheduled jobs, batch imports).
- **Where:** `orchestration/router.py`, `jobs/router.py`.
- **When:** When admins trigger workflows or scheduled tasks run.
- **How:** Queue Celery tasks, call AWX/Ansible APIs.

## AI endpoints (assistant features)
- **Why:** Assistant features, automated summarization, ML helpers.
- **Where:** `ai/router.py`.
- **When:** On-demand when AI features enabled.
- **How:** Calls external model APIs, env: `OPENAI_API_KEY`.

## Licensing & Feature Flags
- **Why:** Manage tenant licensing, feature availability.
- **Where:** `licensing/`, `feature_flags/router.py`.
- **When:** Checked during feature access/runtime.
- **How:** Licensing endpoints for CRUD/validation, feature flags gate behavior.

## Monitoring sub-services (metrics, traces, alerts)
- **Why:** Specialized endpoints for metrics, logs, traces, alerts (scrapable metrics, alert webhooks, dual-stack metrics).
- **Where:** `monitoring/` (`metrics_router.py`, `traces_router.py`, `logs_router.py`, `alert_router.py`, `dual_stack_metrics_router.py`, `infrastructure_router.py`).
- **When:** Always available when monitoring enabled.
- **How:** Prometheus scrapes metrics endpoints, OTEL exporter for traces.

## Developer tooling and seed scripts
- **Why:** Set up local environments with demo tenants, admin users, sample data for testing/E2E.
- **Where:** `scripts/seed_test_users.py`, `scripts/seed_data.py`, `scripts/run_customer_tests.sh`.
- **When:** After DB up and migrations applied.
- **How:**
  - `chmod +x scripts/run_customer_tests.sh && ./scripts/run_customer_tests.sh`
  - Or run seed scripts with Python in project env.

---

## Final notes for novices
- Start core infra (Postgres, Redis, MinIO), apply migrations, start backend/frontend:

```bash
docker compose -f docker-compose.infra.yml up -d dotmac-postgres dotmac-redis dotmac-minio
docker compose -f docker-compose.base.yml up -d platform-backend platform-frontend
poetry run alembic upgrade head
```

- Use service hostnames (e.g. `dotmac-postgres`, `dotmac-redis`, `dotmac-minio`) in containers, not `localhost`.
- For a table mapping each router to its prefix and required infra, ask for `docs/ROUTERS_3WH.md`.
- This file is a living runbook. Expand or refine as needed for your team.
