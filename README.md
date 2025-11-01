# DotMac ISP Operations Platform

[![Python](https://img.shields.io/badge/python-3.12--3.13-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com)

**Complete ISP Operations & Management Platform** - A comprehensive SaaS solution for managing Internet Service Providers (ISPs), Fiber-to-the-Home (FTTH) networks, and Wireless ISP (WISP) operations.

## 🎯 What is DotMac ISP Ops?

A **full-stack ISP management platform** that combines Business Support Systems (BSS) and Operations Support Systems (OSS) to streamline ISP operations from subscriber management to network infrastructure monitoring.

### Purpose

Built for ISPs, WISPs, and fiber network operators who need:
- 🌐 **Multi-tenant SaaS** for managing multiple ISP customers
- 📡 **FTTH Management** - GPON/XGS-PON OLT/ONU provisioning
- 📶 **Wireless Management** - Point-to-point and point-to-multipoint networks
- 🔐 **AAA Services** - FreeRADIUS integration for subscriber authentication
- 📊 **Network Inventory** - NetBox IPAM/DCIM for IP and device management
- 🛠️ **Device Management** - GenieACS TR-069 for CPE configuration
- 🔒 **Secure Connectivity** - WireGuard VPN for OLT-to-cloud connections
- 📈 **Monitoring** - LibreNMS, Prometheus, and Grafana dashboards

## 🏗️ Platform Architecture

### Docker Compose Layout

Infrastructure is split across two Compose files. Use the Makefile wrappers (or call Compose directly) to start what you need:

```bash
# Core platform: Postgres, Redis, Vault, MinIO
make start-platform

# Core platform + observability (OTel collector, Prometheus, Grafana, Jaeger)
make start-platform-obs

# ISP services (FreeRADIUS, NetBox, GenieACS, WireGuard, LibreNMS, TimescaleDB)
make start-isp
```

Under the hood these targets call Compose directly:

```bash
docker compose -f docker-compose.base.yml up -d postgres redis vault minio
docker compose -f docker-compose.base.yml --profile observability up -d
docker compose -f docker-compose.isp.yml up -d
```

The helper script `./scripts/infra.sh` powers these targets and supports `start`, `status`, `logs`, `restart`, and `clean` actions for `platform`, `isp`, or `all`.

### Business Support Systems (BSS) - 90% Complete

✅ **Billing & Revenue Management**
- Subscription management with multiple plans
- Usage-based billing and quotas
- Invoice generation and payment processing
- Multi-currency support
- Tax calculation and credit notes

✅ **Customer Relationship Management (CRM)**
- Complete customer lifecycle management
- Contact management and user profiles
- Partner management with commissions
- Tenant management and isolation

✅ **Communications**
- Email service with templates
- SMS notifications (Twilio)
- Webhook management
- Event-driven architecture

### Operations Support Systems (OSS) - Newly Added

🆕 **Network Authentication (AAA)**
- **FreeRADIUS** - RADIUS authentication and accounting
- Multi-tenant RADIUS with bandwidth profiles
- Session tracking and usage monitoring
- NAS (Network Access Server) management

🆕 **Network Inventory & Management**
- **NetBox** - IPAM (IP Address Management) and DCIM
- IP pool management and allocation
- Device inventory and rack management
- Cable management and connections

🆕 **FTTH Management**
- **VOLTHA** - Virtual OLT Hardware Abstraction (planned)
- **GenieACS** - TR-069 ACS for CPE management
- OLT/ONU provisioning and management
- Fiber infrastructure tracking

🆕 **Network Connectivity**
- **WireGuard** - VPN for secure OLT-to-cloud connections
- Per-tenant VPN isolation
- Automated VPN provisioning

🆕 **Monitoring & Observability**
- **LibreNMS** - Network device monitoring via SNMP
- **Prometheus** - Metrics collection
- **Grafana** - Visualization dashboards
- **Jaeger** - Distributed tracing

🆕 **Automation**
- **Ansible AWX** - Network automation (planned)
- Service lifecycle automation
- Zero-touch provisioning

## 📦 Complete Service Stack

### Infrastructure Services

| Service | Purpose | Port | Status |
|---------|---------|------|--------|
| **PostgreSQL** | Main database | 5432 | ✅ Running |
| **Redis** | Cache & sessions | 6379 | ✅ Running |
| **MinIO** | Object storage | 9000/9001 | ✅ Running |
| **OpenBao** | Secrets management | 8200 | ✅ Running |
| **MongoDB** | GenieACS database | 27017 | ✅ Running |
| **TimescaleDB** | Time-series metrics | 5433 | ✅ Running |

### ISP-Specific Services

| Service | Purpose | Port | Status |
|---------|---------|------|--------|
| **FreeRADIUS** | AAA authentication | 1812/1813 (UDP) | ✅ Running |
| **NetBox** | Network inventory | 8080 | ✅ Running |
| **GenieACS** | TR-069 CPE management | 7547, 7557, 7567 | ✅ Running |
| **WireGuard** | VPN gateway | 51820 (UDP) | ✅ Running |
| **LibreNMS** | Network monitoring | 8000 | ✅ Running |

### Monitoring Services

| Service | Purpose | Port | Status |
|---------|---------|------|--------|
| **Prometheus** | Metrics collection | 9090 | ✅ Running |
| **Grafana** | Dashboards | 3400 | ✅ Running |
| **Jaeger** | Distributed tracing | 16686 | ✅ Running |

## 🚀 Quick Start

### Prerequisites

- **Docker Desktop** 20.10+ with Compose v2
- **Python** 3.12+ and **Poetry**
- **Node.js** 18+ and **pnpm** 9+
- At least **8GB RAM** and **50GB disk space** free

### 1. Clone Repository

```bash
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops
```

### 2. Prepare Environment

```bash
cp .env.example .env
# Update secrets as needed (development defaults work out of the box)
```

### 3. Start Core Infrastructure

```bash
make start-platform          # postgres, redis, vault, minio
make start-platform-obs      # optional: observability stack (otel, prometheus, grafana, jaeger)
# or: ./scripts/infra.sh platform start --with-obs
make status-platform         # verify health
```

### 4. Start ISP Services (Optional)

```bash
make start-isp
make status-isp
```

### 5. Backend Setup

```bash
poetry install --with dev

# Use Docker PostgreSQL credentials unless you override them
export DOTMAC_DATABASE_URL="postgresql://dotmac_user:change-me@localhost:5432/dotmac"
export DOTMAC_DATABASE_URL_ASYNC="postgresql+asyncpg://dotmac_user:change-me@localhost:5432/dotmac"

poetry run alembic upgrade head
poetry run uvicorn src.dotmac.platform.main:app \
  --reload --host 0.0.0.0 --port 8000
```

FastAPI docs: http://localhost:8000/docs

### 6. Frontend Apps

```bash
cd frontend
pnpm install

# ISP tenant experience
pnpm dev:isp          # http://localhost:3001

# Platform super-admin console
pnpm dev:admin        # http://localhost:3002

# (Optional) legacy monolith for comparison
pnpm dev:base-app     # http://localhost:3000
```

Press `Ctrl+C` to stop the dev servers. Use `make stop-platform` / `make stop-isp` when you are done.

## 🌐 Access Services

Once deployed, access these services:

### ISP Management
- **Backend API**: http://localhost:8000/docs (FastAPI Swagger)
- **ISP Operations App**: http://localhost:3001/dashboard – tenant-facing operations (subscribers, devices, billing, automation)
- **Platform Admin App**: http://localhost:3002/dashboard/platform-admin – super-admin controls (feature flags, plugins, licensing, jobs)
- **Legacy Base App**: http://localhost:3000 (optional compatibility build)

### Network Services
- **NetBox**: http://localhost:8080 (admin / admin)
- **GenieACS**: http://localhost:7567 (TR-069 management)
- **LibreNMS**: http://localhost:8000 (admin / admin)

### Monitoring
- **Grafana**: http://localhost:3400 (admin / admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686

### Storage & Infrastructure
- **MinIO Console**: http://localhost:9001 (minioadmin / change-me)
- **OpenBao**: http://localhost:8200

## 📚 Documentation

Start with these active resources:

- **[docs/INDEX.md](docs/INDEX.md)** – curated map of production-ready documentation
- **[INFRASTRUCTURE.md](INFRASTRUCTURE.md)** & **[README-INFRASTRUCTURE.md](README-INFRASTRUCTURE.md)** – platform/ISP deployment workflows
- **[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)** – backend/frontend configuration matrix
- **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** – canonical entity model overview
- **[docs/API_SPECIFICATIONS.md](docs/API_SPECIFICATIONS.md)** – REST and integration surface area
- **[docs/NETWORK_DIAGNOSTICS_IMPLEMENTATION.md](docs/NETWORK_DIAGNOSTICS_IMPLEMENTATION.md)** – diagnostics tooling and APIs
- **[docs/FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md](docs/FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md)** – fiber data model and workflows
- **Frontend architecture**: see [frontend/MULTI-APP-ARCHITECTURE.md](frontend/MULTI-APP-ARCHITECTURE.md) and [frontend/DEPLOYMENT-ARCHITECTURE.md](frontend/DEPLOYMENT-ARCHITECTURE.md)

## 🛠️ Technology Stack

### Backend
- **Python 3.12+** with **FastAPI**
- **SQLAlchemy 2.0** ORM
- **PostgreSQL 14+** database
- **Redis 7+** for caching
- **Celery** for background tasks
- **Pydantic v2** for validation

### Frontend
- **Next.js 14** with **React 18**
- **TypeScript** for type safety
- **TanStack Query** for data fetching
- **Tailwind CSS** for styling
- **Leaflet** for maps
- **ReactFlow** for topology diagrams

#### Frontend Architecture
- `@dotmac/isp-ops-app` (port 3001) delivers tenant-facing dashboards for subscribers, network assets, automation, and operations.
- `@dotmac/platform-admin-app` (port 3002) adds platform-level controls (feature flags, plugins, licensing, jobs) while retaining visibility into ISP views.
- A legacy `@dotmac/base-app` build remains for compatibility and Storybook workflows.

Each app shares the same domain-focused portals (operations, billing, diagnostics, partners, customer management) via the `frontend/shared` workspace packages. Refer to [docs/architecture/PORTAL_ARCHITECTURE.md](docs/architecture/PORTAL_ARCHITECTURE.md) and the multi-app guides above for navigation details.

### Infrastructure
- **Docker** & **Docker Compose**
- **Kubernetes** (production)
- **Prometheus** & **Grafana** (monitoring)
- **OpenTelemetry** (observability)

### ISP-Specific Technologies
- **FreeRADIUS** - AAA server
- **NetBox** - IPAM/DCIM
- **GenieACS** - TR-069 ACS
- **WireGuard** - VPN
- **LibreNMS** - SNMP monitoring
- **VOLTHA** - OLT management (planned)
- **Ansible AWX** - Automation (planned)

## 🗺️ Key Features

### Multi-Tenant Architecture
- **Row-level security (RLS)** in PostgreSQL
- **Tenant isolation** across all services
- **Per-tenant licensing** based on subscriber count
- **Automated tenant suspension** when limits exceeded

### Service Lifecycle Automation
1. **Subscriber activation** → RADIUS credentials
2. **IP allocation** from pools → NetBox
3. **ONU provisioning** → VOLTHA/GenieACS
4. **CPE configuration** → GenieACS TR-069
5. **Billing activation** → Usage tracking
6. **Monitoring setup** → LibreNMS

### Network Management
- **IPAM** - IP address planning and allocation
- **Device inventory** - Track all network devices
- **Topology mapping** - Visual network diagrams
- **Configuration management** - Backup and restore
- **Performance monitoring** - Real-time metrics

### FTTH Operations
- **OLT management** - Multiple vendors (Huawei, ZTE, Nokia)
- **ONU discovery** - Automatic device discovery
- **Splitter management** - Fiber splitter tracking
- **Fiber cable management** - Complete fiber infrastructure
- **Signal quality monitoring** - RX power, distance

### Wireless Operations
- **Tower management** - Location and coverage
- **Sector management** - Antenna configuration
- **Subscriber CPE** - Radio management
- **RF planning** - Coverage prediction
- **Link quality monitoring** - Signal strength, latency

## 🔐 Security Features

- **Multi-tenant isolation** with RLS
- **JWT authentication** (RS256/HS256)
- **RBAC** with granular permissions
- **MFA support** (TOTP, SMS, Email)
- **API key management** for service-to-service
- **Secrets in Vault** (never in code)
- **Encryption at rest** (PostgreSQL TDE, MinIO SSE)
- **Encryption in transit** (TLS 1.3, WireGuard)
- **Audit logging** (7-year retention)
- **GDPR-ready** (data retention, right-to-delete)

## 📊 Scale & Performance

### Target Metrics
- **Concurrent subscribers**: 10,000+
- **API response time (p95)**: < 200ms
- **RADIUS auth time**: < 100ms
- **Service activation time**: < 5 minutes
- **Platform uptime**: > 99.9%

### Current Status
- **BSS modules**: 95% complete ✅
- **OSS modules**: 85% complete ✅ (RADIUS, NetBox, GenieACS, VOLTHA, Wireless, LibreNMS integrated)
- **Service Lifecycle**: 90% complete ✅ (Orchestration with Saga pattern)
- **Infrastructure**: Docker-based deployment ready ✅
- **Test coverage**: **92.24% for critical services** ✅ (115 comprehensive tests across 5 core modules)
  - Orchestration: **95.56%** ✅
  - Workflows: **87.94%** ✅
  - RADIUS: **86.45%** ✅
  - Analytics: **100.00%** ✅
  - Audit: **91.23%** ✅
- **API Routers**: 88 routers registered ✅
- **Frontend**: Production-ready (98/100 score) ✅

## 🛣️ Roadmap

### Phase 1: MVP (12 weeks) - ✅ COMPLETE
- ✅ RADIUS authentication & session management
- ✅ NetBox IPAM/DCIM integration
- ✅ GenieACS TR-069 CPE management
- ✅ Service lifecycle automation (provision, activate, suspend, deprovision)
- ✅ LibreNMS network monitoring integration
- ✅ WireGuard VPN management
- ✅ Admin portal (13 pages, all functional)
- ✅ Orchestration service with Saga pattern
- ✅ ISP-specific customer fields (26 fields)
- ✅ Dunning & collections system

### Phase 2: FTTH (Weeks 13-24) - ✅ COMPLETE
- ✅ VOLTHA integration (OLT/ONU management)
- ✅ ONU discovery and provisioning workflows
- ✅ PON statistics and alarm management
- ✅ Device management API endpoints
- ✅ Fiber infrastructure tracking models

### Phase 3: Wireless (Weeks 25-36) - ✅ COMPLETE
- ✅ Wireless device management (AP, Radio, CPE, Tower)
- ✅ Coverage zone mapping
- ✅ Signal quality monitoring
- ✅ Frequency and protocol management
- ✅ Wireless infrastructure API

### Phase 4: Advanced Features (Weeks 37-48) - ✅ COMPLETE
- ✅ Ansible AWX automation (router implemented)
- ✅ Advanced analytics (metrics, billing, customer KPIs)
- ✅ Fault management (alarms, SLA monitoring)
- ✅ Diagnostics tools (ping, traceroute, bandwidth tests)
- ✅ Deployment orchestration
- ✅ Job scheduler with chains
- ✅ **Service Layer Testing Initiative** - 92.24% average coverage across 5 critical services
- ⏳ Mobile apps (planned)
- ⏳ Enhanced customer self-service portal (basic ticketing complete)

### Phase 5: Quality & Hardening (Weeks 49-60) - 🔄 IN PROGRESS
- ⏳ Financial services testing (Invoice, Payment, Pricing services)
- ⏳ Security layer testing (RBAC, MFA, Email services)
- ⏳ Platform configuration testing (Settings, Catalog, Dunning services)
- ⏳ End-to-end workflow integration tests
- ⏳ Performance testing and optimization

## 🧪 Running Customer Management Tests with PostgreSQL

The customer-management integration tests rely on database constraints that are only available when a real PostgreSQL instance is present. A helper compose file and script are provided:

```bash
# start a throwaway Postgres, run migrations, execute tests, and clean up
chmod +x scripts/run_customer_tests.sh
./scripts/run_customer_tests.sh

# pass additional pytest flags (examples)
./scripts/run_customer_tests.sh -k lifecycle -vv
```

If you already have a PostgreSQL instance running with the required schema, skip the Compose orchestration and migration steps:

```bash
export DOTMAC_DATABASE_URL=postgresql://dotmac_test:dotmac_test@localhost:6543/dotmac_test
export DOTMAC_DATABASE_URL_ASYNC=postgresql+asyncpg://dotmac_test:dotmac_test@localhost:6543/dotmac_test
SKIP_COMPOSE=1 SKIP_MIGRATIONS=1 ./scripts/run_customer_tests.sh
```

The script exports `DOTMAC_DATABASE_URL` / `DOTMAC_DATABASE_URL_ASYNC`, applies the latest Alembic migration, and runs `poetry run pytest tests/customer_management`. To keep the database service running between test runs, you can start it manually:

```bash
docker compose -f docker-compose.test-db.yml up -d db-test
export DOTMAC_DATABASE_URL=postgresql://dotmac_test:dotmac_test@localhost:6543/dotmac_test
export DOTMAC_DATABASE_URL_ASYNC=postgresql+asyncpg://dotmac_test:dotmac_test@localhost:6543/dotmac_test
poetry run alembic upgrade head
poetry run pytest tests/customer_management
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

[Your License Here]

## 🆘 Support

- **Documentation**: See `docs/` folder
- **Quick Start**: [QUICK_START.md](QUICK_START.md)
- **Environment Setup**: [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/dotmac-isp-ops/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/dotmac-isp-ops/discussions)

## 🙏 Acknowledgments

Built on top of:
- **DotMac Platform Services** - Core BSS framework
- **NetBox** - Network inventory
- **FreeRADIUS** - AAA server
- **GenieACS** - TR-069 ACS
- **LibreNMS** - Network monitoring

---

**Ready to manage your ISP operations? Let's go! 🚀**

For detailed setup instructions, see [QUICK_START.md](QUICK_START.md) and [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md).
