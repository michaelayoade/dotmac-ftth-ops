# DotMac Infrastructure - Quick Reference

## Three Deployment Modes

### 1. Platform Mode (Core Infrastructure)
Base services needed for the DotMac application:
- PostgreSQL, Redis, Vault, MinIO, Observability

```bash
make start-platform     # Start core infrastructure
make status-platform    # Check status
make logs-platform      # View logs
make stop-platform      # Stop services
```

### 2. ISP Mode (ISP Services)
ISP-specific services for managing networks:
- FreeRADIUS, NetBox, GenieACS, AWX, LibreNMS, WireGuard, TimescaleDB

```bash
make start-isp          # Start ISP services (auto-starts platform if needed)
make status-isp         # Check status  
make logs-isp           # View logs
make stop-isp           # Stop services
```

### 3. All Mode (Complete Stack)
Everything together:

```bash
make start-all          # Start platform + ISP
make status-all         # Check all status
make stop-all           # Stop everything
```

## Quick Start

```bash
# 1. Start infrastructure
make start-platform

# 2. Run database migrations  
make db-migrate

# 3. Start application
make dev                # Backend on http://localhost:8000

# 4. (Optional) Start ISP services
make start-isp
```

## Service Access

### Platform Services
- **API**: http://localhost:8000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Jaeger**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000

### ISP Services  
- **AWX**: http://localhost:8052
- **NetBox**: http://localhost:8080
- **GenieACS**: http://localhost:7567
- **LibreNMS**: http://localhost:8000
- **FreeRADIUS**: UDP 1812-1813

## Common Tasks

```bash
# View status
make status-all

# View logs for specific service
./scripts/infra.sh platform logs postgres
./scripts/infra.sh isp logs freeradius

# Restart services
make restart-platform
make restart-isp
make restart-all

# Clean restart (removes containers/volumes - DESTRUCTIVE!)
make clean-all
make start-all
```

## Full Documentation

- **Complete Guide**: `INFRASTRUCTURE.md`
- **Deployment**: `DEPLOYMENT_GUIDE.md`
- **Quick Start**: `QUICK_START.md`
- **Success Summary**: `DEPLOYMENT_SUCCESS.md`

## Help

```bash
make help               # Show all make commands
./scripts/infra.sh      # Show infrastructure script usage
```
