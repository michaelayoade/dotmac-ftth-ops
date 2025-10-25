# DotMac Platform Infrastructure Guide

## Overview

The DotMac platform supports three deployment modes:

1. **Platform Mode** - Base infrastructure (postgres, redis, vault, minio, observability)
2. **ISP Mode** - ISP-specific services (FreeRADIUS, NetBox, GenieACS, AWX, LibreNMS, etc.)
3. **All Mode** - Complete stack (platform + ISP services)

## Quick Start

### Prerequisites

- Docker Desktop running
- Make installed
- Python 3.12+ (for local development)
- Poetry (for dependency management)

### Start Platform Infrastructure

```bash
# Start core infrastructure
make start-platform

# Or with observability stack (Jaeger, Prometheus, Grafana)
make start-platform-obs

# Check status
make status-platform
```

### Start ISP Services

```bash
# Start ISP services (will auto-start platform if needed)
make start-isp

# Check status
make status-isp
```

### Start Everything

```bash
# Start complete stack
make start-all

# Check status
make status-all
```

## Infrastructure Components

### Platform Services (docker-compose.base.yml)

| Service | Port | Description | Required |
|---------|------|-------------|----------|
| **PostgreSQL** | 5432 | Main database | ✅ Yes |
| **Redis** | 6379 | Cache & message broker | ✅ Yes |
| **Vault** | 8200 | Secrets management | ⚪ Optional |
| **MinIO** | 9000, 9001 | S3-compatible storage | ⚪ Optional |

### Observability Stack (Optional)

| Service | Port | Description |
|---------|------|-------------|
| **OTEL Collector** | 4317, 4318 | Telemetry ingestion |
| **Jaeger** | 16686 | Distributed tracing UI |
| **Prometheus** | 9090 | Metrics storage |
| **Grafana** | 3000 | Dashboards |

### ISP Services (docker-compose.isp.yml)

| Service | Port | Description |
|---------|------|-------------|
| **FreeRADIUS** | 1812-1813 (UDP) | AAA server for authentication |
| **NetBox** | 8080 | Network inventory & IPAM |
| **NetBox Worker** | - | Background task processor |
| **GenieACS** | 7547, 7557, 7567, 7577 | TR-069 ACS for CPE management |
| **MongoDB** | 27017 | Database for GenieACS |
| **AWX Web** | 8052 | Ansible automation web UI |
| **AWX Task** | - | Ansible automation task runner |
| **LibreNMS** | 8000 | Network monitoring |
| **WireGuard** | 51820 (UDP) | VPN gateway |
| **TimescaleDB** | 5433 | Time-series metrics database |

## Common Commands

### Infrastructure Management

```bash
# Platform
make start-platform          # Start platform infrastructure
make stop-platform           # Stop platform infrastructure
make restart-platform        # Restart platform infrastructure
make status-platform         # Check platform status
make logs-platform           # View platform logs

# ISP Services
make start-isp               # Start ISP services
make stop-isp                # Stop ISP services
make restart-isp             # Restart ISP services
make status-isp              # Check ISP status
make logs-isp                # View ISP logs

# All Services
make start-all               # Start everything
make stop-all                # Stop everything
make restart-all             # Restart everything
make status-all              # Check all status
```

### Development

```bash
# Start backend API
make dev                     # http://localhost:8000

# Start backend with auto-reload
make dev-backend             # http://localhost:8000/docs

# Start frontend
make dev-frontend            # http://localhost:3000
```

### Database

```bash
# Run migrations
make db-migrate

# Create new migration
make db-migrate-create

# Seed database with test data
make db-seed

# Reset database (DESTRUCTIVE!)
make db-reset
```

### Testing

```bash
# Run all tests
make test

# Run fast tests (no coverage)
make test-fast

# Run integration tests
make test-integration

# Lint code
make lint
```

### Cleanup (DESTRUCTIVE!)

```bash
# Remove platform containers/volumes
make clean-platform

# Remove ISP containers/volumes
make clean-isp

# Remove ALL containers/volumes
make clean-all
```

## Advanced Usage

### Using the Infrastructure Script Directly

```bash
# Platform
./scripts/infra.sh platform start              # Start platform
./scripts/infra.sh platform start --with-obs   # Start with observability
./scripts/infra.sh platform status             # Check status
./scripts/infra.sh platform logs postgres      # View postgres logs

# ISP Services
./scripts/infra.sh isp start                   # Start ISP services
./scripts/infra.sh isp status                  # Check status
./scripts/infra.sh isp logs freeradius         # View FreeRADIUS logs

# All Services
./scripts/infra.sh all start                   # Start everything
./scripts/infra.sh all start --with-obs        # Start with observability
./scripts/infra.sh all status                  # Check status
```

### Docker Compose Direct Access

```bash
# Platform
docker compose -f docker-compose.base.yml up -d postgres redis
docker compose -f docker-compose.base.yml --profile observability up -d

# ISP
docker compose -f docker-compose.isp.yml up -d
docker compose -f docker-compose.isp.yml logs -f freeradius

# View containers
docker ps
```

## Service Configuration

### Platform Infrastructure

- **PostgreSQL**: Database initialized with extensions and performance tuning
  - Databases: `dotmac`, `awx`, `netbox`, `librenms`
  - Init scripts: `database/init/01-init.sql`, `02-create-databases.sql`

- **Redis**: Default configuration, no authentication for development

- **Vault**: Dev mode with root token `dev-token-12345`

- **MinIO**: Admin credentials `minioadmin` / `minioadmin123`

### ISP Services

- **FreeRADIUS**:
  - Config: `config/radius/`
  - Custom dictionary, clients, SQL integration
  - Apple Silicon: Runs via platform emulation (`linux/amd64`)

- **NetBox**:
  - Admin user created from env vars
  - Connected to PostgreSQL `netbox` database

- **AWX**:
  - Settings: `config/awx/settings.py`
  - Admin credentials from env vars
  - Connected to PostgreSQL `awx` database

- **GenieACS**:
  - Web UI: http://localhost:7567
  - API: http://localhost:7557
  - Connected to MongoDB

## Environment Variables

Create a `.env` file in the project root:

```bash
# PostgreSQL
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=dotmac
POSTGRES_USER=dotmac_user

# AWX
AWX_ADMIN_USER=admin
AWX_ADMIN_PASSWORD=your_awx_password
AWX_SECRET_KEY=your_secret_key_min_50_chars

# NetBox
NETBOX_SECRET_KEY=your_netbox_secret_key_min_50_chars
NETBOX_ADMIN_USER=admin
NETBOX_ADMIN_PASSWORD=your_netbox_password

# MongoDB
MONGO_USER=admin
MONGO_PASSWORD=your_mongo_password

# TimescaleDB
TIMESCALE_PASSWORD=your_timescale_password
```

## Troubleshooting

### Services Won't Start

```bash
# Check Docker is running
docker info

# Check service status
make status-all

# View logs
make logs-platform
make logs-isp
```

### Database Connection Errors

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check database exists
docker exec dotmac-ftth-ops-postgres-1 psql -U dotmac_user -d postgres -c "\l"

# Run migrations
make db-migrate
```

### FreeRADIUS Restart Loop (Apple Silicon)

```bash
# Rebuild image with correct platform
make build-freeradius

# Or manually
docker build --platform linux/amd64 -f Dockerfile.freeradius -t freeradius-postgresql:latest .
```

### Port Conflicts

If ports are already in use, you can modify them in the compose files or stop conflicting services.

Common conflicts:
- Port 8000: LibreNMS vs. local app (change one via env vars)
- Port 3000: Grafana vs. frontend (change Grafana: `GRAFANA_PORT=3400`)

### Clean Start

```bash
# Stop everything
make stop-all

# Remove all containers and volumes (DESTRUCTIVE!)
make clean-all

# Start fresh
make start-all
```

## Development Workflow

### Typical Development Session

```bash
# 1. Start infrastructure
make start-platform

# 2. Run migrations
make db-migrate

# 3. (Optional) Seed database
make db-seed

# 4. Start backend
make dev

# 5. In another terminal, start frontend
make dev-frontend

# 6. Make changes, tests auto-reload

# 7. When done, stop infrastructure
make stop-platform
```

### Working with ISP Services

```bash
# 1. Start platform + ISP
make start-all

# 2. Access services
# - AWX: http://localhost:8052
# - NetBox: http://localhost:8080
# - GenieACS: http://localhost:7567
# - LibreNMS: http://localhost:8000

# 3. View specific service logs
./scripts/infra.sh isp logs awx-web

# 4. Restart a service
docker compose -f docker-compose.isp.yml restart awx-web
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DotMac Platform                          │
├─────────────────────────────────────────────────────────────┤
│  Backend API (FastAPI)                                      │
│  - REST API endpoints                                       │
│  - GraphQL API                                              │
│  - WebSocket support                                        │
│  - Authentication & Authorization                           │
└─────────────┬───────────────────────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼───────────────┐ ┌─▼──────────────────────────┐
│ Platform Services │ │ ISP Services               │
├───────────────────┤ ├────────────────────────────┤
│ • PostgreSQL      │ │ • FreeRADIUS (AAA)        │
│ • Redis           │ │ • NetBox (IPAM)           │
│ • Vault           │ │ • GenieACS (TR-069)       │
│ • MinIO           │ │ • AWX (Automation)        │
│ • Observability   │ │ • LibreNMS (Monitoring)   │
│   - Jaeger        │ │ • WireGuard (VPN)         │
│   - Prometheus    │ │ • TimescaleDB (Metrics)   │
│   - Grafana       │ │ • MongoDB (GenieACS DB)   │
└───────────────────┘ └────────────────────────────┘
```

## Service Dependencies

```
Platform Infrastructure (Required for all)
  ├── PostgreSQL (Required)
  │   ├── dotmac database (Platform app)
  │   ├── awx database (AWX)
  │   ├── netbox database (NetBox)
  │   └── librenms database (LibreNMS)
  ├── Redis (Required for cache/queues)
  ├── Vault (Optional for secrets)
  └── MinIO (Optional for object storage)

ISP Services (Independent deployment)
  ├── FreeRADIUS → PostgreSQL (dotmac)
  ├── NetBox → PostgreSQL (netbox) + Redis
  ├── NetBox Worker → PostgreSQL (netbox)
  ├── GenieACS → MongoDB
  ├── AWX Web → PostgreSQL (awx) + Redis
  ├── AWX Task → PostgreSQL (awx) + Redis
  ├── LibreNMS → PostgreSQL (librenms)
  ├── WireGuard (Standalone)
  └── TimescaleDB (Standalone)

Observability Stack (Optional)
  ├── OTEL Collector
  ├── Jaeger
  ├── Prometheus
  └── Grafana
```

## Files & Directories

```
dotmac-ftth-ops/
├── docker-compose.base.yml          # Platform infrastructure
├── docker-compose.isp.yml           # ISP services
├── Dockerfile.freeradius            # FreeRADIUS custom image
├── Makefile                         # Simplified make commands
├── scripts/
│   ├── infra.sh                     # Infrastructure management script
│   └── check_infra.sh               # Legacy script (use infra.sh)
├── config/
│   ├── awx/settings.py              # AWX Django settings
│   ├── radius/                      # FreeRADIUS configuration
│   └── freeradius/                  # FreeRADIUS CoA config
├── database/
│   └── init/                        # PostgreSQL init scripts
│       ├── 01-init.sql              # Extensions & tuning
│       └── 02-create-databases.sql  # Create ISP databases
└── docker-compose-archive/          # Archived/unused compose files
```

## Support & Documentation

- **Main Documentation**: See project `/docs` directory
- **API Documentation**: http://localhost:8000/docs (when running)
- **GraphQL Playground**: http://localhost:8000/api/v1/graphql
- **Quick Start**: `QUICK_START.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`

## Production Considerations

Before deploying to production:

1. **Change all default passwords** in `.env`
2. **Use strong secret keys** (minimum 50 characters)
3. **Enable SSL/TLS** for all web services
4. **Configure firewall** rules
5. **Set up backups** for all databases
6. **Enable monitoring** and alerting
7. **Review security settings** in all services
8. **Use production compose files** (not dev configs)

For production deployment, see `DEPLOYMENT_GUIDE.md`.
