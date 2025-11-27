# Stack Placement Guide

**Last Updated:** November 26, 2025
**Status:** Production
**Version:** 1.0

---

## Overview

This document defines which services and modules belong to which deployment stack in the DotMac platform. Understanding stack placement is critical for:

- Correct infrastructure provisioning
- Security isolation
- Resource allocation
- Operational procedures

---

## Stack Definitions

### Platform Stack (Control Plane)

**Compose File:** `docker-compose.infra.yml`
**Kubernetes Namespace:** `platform-admin`
**Purpose:** Shared infrastructure and platform administration

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Primary database (shared) |
| Redis | 6379 | Cache and session store |
| MinIO | 9000/9001 | Object storage |
| NetBox | 8080 | IPAM/DCIM (shared or per-tenant) |
| Meilisearch | 7700 | Full-text search |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards |
| Loki | 3100 | Log aggregation |
| Jaeger | 16686 | Distributed tracing |
| OpenBao/Vault | 8200 | Secrets management |
| Alertmanager | 9093 | Alert routing |

**Key Points:**
- Single instance globally
- Shared by all tenants (multi-tenant aware)
- Does NOT include RADIUS, GenieACS, or tenant-specific network services

---

### ISP Stack (Tenant Data Plane)

**Compose File:** `docker-compose.isp.yml`
**Kubernetes Namespace:** `tenant-{slug}`
**Purpose:** Per-tenant ISP operations

| Service | Port | Description |
|---------|------|-------------|
| isp-backend | 8000 | FastAPI tenant backend |
| isp-frontend | 3001 | Next.js ISP operations UI |
| FreeRADIUS | 1812/1813/3799 | RADIUS AAA (ISP-only) |
| MongoDB | 27017 | GenieACS database |
| GenieACS | 7547/7557/7567/7577 | TR-069 ACS (ISP-only) |

**Key Points:**
- One instance per ISP tenant
- Isolated from other tenants
- RADIUS and GenieACS are ISP-only services

---

## Module Stack Placement

### ISP-Only Modules (Tenant Stack)

These modules are deployed ONLY in the ISP tenant stack. They should NOT be included in the platform admin stack.

| Module | Path | Reason |
|--------|------|--------|
| **RADIUS** | `src/dotmac/platform/radius/` | Subscriber AAA - tenant-specific |
| **GenieACS** | `src/dotmac/platform/genieacs/` | CPE management - tenant-specific |
| **VOLTHA** | `src/dotmac/platform/voltha/` | PON management - tenant-specific |
| **Access** | `src/dotmac/platform/access/` | OLT drivers - tenant-specific |
| **Network Monitoring** | `src/dotmac/platform/network_monitoring/` | SNMP/telemetry - tenant-specific |
| **Wireless** | `src/dotmac/platform/wireless/` | AP management - tenant-specific |
| **WireGuard** | `src/dotmac/platform/wireguard/` | VPN tunnels - tenant-specific |
| **Subscribers** | `src/dotmac/platform/subscribers/` | Customer data - tenant-specific |
| **Billing** (Customer) | `src/dotmac/platform/billing/` | Invoice customers - tenant-specific |

### Shared Modules (Both Stacks)

These modules are used by both platform admin and ISP stacks.

| Module | Path | Notes |
|--------|------|-------|
| **Auth** | `src/dotmac/platform/auth/` | Authentication (scoped by deployment) |
| **Feature Flags** | `src/dotmac/platform/feature_flags/` | Configuration |
| **Notifications** | `src/dotmac/platform/notifications/` | In-app notifications |
| **Webhooks** | `src/dotmac/platform/webhooks/` | Event delivery |
| **File Storage** | `src/dotmac/platform/file_storage/` | MinIO integration |
| **Secrets** | `src/dotmac/platform/secrets/` | Vault integration |
| **Analytics** | `src/dotmac/platform/analytics/` | Usage metrics |
| **Audit** | `src/dotmac/platform/audit/` | Audit logging |

### Platform-Only Modules (Control Plane)

These modules are deployed ONLY in the platform admin stack.

| Module | Path | Reason |
|--------|------|--------|
| **Platform Admin** | `src/dotmac/platform/platform_admin/` | Cross-tenant management |
| **Licensing** | `src/dotmac/platform/licensing/` | License management |
| **Tenant** | `src/dotmac/platform/tenant/` | Tenant lifecycle |

---

## Docker Compose Reference

### Starting Platform Stack Only

```bash
# Infrastructure services (no ISP-specific services)
docker compose -f docker-compose.infra.yml up -d
```

### Starting ISP Stack Only

```bash
# Requires infra stack running
docker compose -f docker-compose.isp.yml up -d
```

### Full Development Stack

```bash
# Both stacks for local development
docker compose -f docker-compose.infra.yml -f docker-compose.isp.yml up -d
```

---

## Service Dependencies

```
Platform Stack                    ISP Stack
==============                    =========
PostgreSQL ──────────────────────► isp-backend
Redis ───────────────────────────► isp-backend
MinIO ───────────────────────────► isp-backend
OpenBao ─────────────────────────► isp-backend
                                      │
                                      ├──► FreeRADIUS (RADIUS tables)
                                      │
                                      └──► GenieACS ──► MongoDB
```

---

## Healthcheck Configuration

### RADIUS (ISP Stack)

```yaml
# FreeRADIUS healthcheck - verify radiusd is responding
healthcheck:
  test: ["CMD", "radtest", "healthcheck", "healthcheck", "localhost", "0", "testing123"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### GenieACS (ISP Stack)

```yaml
# GenieACS NBI healthcheck
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:7557/devices?limit=1"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### MongoDB (ISP Stack)

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

## Environment Variable Defaults

### ISP Stack Defaults

```bash
# RADIUS
RADIUS_SERVER_HOST=localhost
RADIUS_COA_PORT=3799
RADIUS_COA_USE_HTTP=false

# GenieACS
GENIEACS_URL=http://genieacs:7557
GENIEACS_MONGODB_URL=mongodb://mongodb:27017/genieacs

# Backend connection to ISP services
ISP_RADIUS_ENABLED=true
ISP_GENIEACS_ENABLED=true
```

### Platform Stack Defaults

```bash
# No RADIUS or GenieACS in platform stack
ISP_RADIUS_ENABLED=false
ISP_GENIEACS_ENABLED=false
```

---

## Kubernetes Deployment Notes

### ISP Namespace Template

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: tenant-{{ tenant_slug }}
  labels:
    stack: isp
    dotmac.io/tenant-id: "{{ tenant_id }}"
```

### Service Placement

```yaml
# ISP-only services must specify namespace
apiVersion: apps/v1
kind: Deployment
metadata:
  name: freeradius
  namespace: tenant-{{ tenant_slug }}  # ISP namespace ONLY
  labels:
    stack: isp
    component: radius
```

---

## Maturity Notes

| Module | Maturity | Notes |
|--------|----------|-------|
| RADIUS | Production (~85%) | Multi-vendor support (Mikrotik, Cisco, Huawei, Juniper), CoA, analytics |
| GenieACS | Production (~85%) | DB-backed job persistence, Celery workers, full TR-069 support |
| VOLTHA | Beta (~80%) | ONU discovery/provisioning, VLAN flows, alarms, backup/restore |
| Access | Beta (~70%) | Huawei + Mikrotik + VOLTHA drivers, feature-flagged alarm actions |
| Network Monitoring | Beta (~75%) | NetBox + VOLTHA + GenieACS + Prometheus integration |
| Wireless | Beta (~65%) | Full CRUD, coverage zones, signal measurements; needs controller integration |

### Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `pon_alarm_actions_enabled` | Enable alarm ack/clear in Access/VOLTHA | `false` |
| `network_monitoring_enabled` | Enable network monitoring APIs | `true` |
| `genieacs_enabled` | Enable GenieACS integration | `true` |

---

## Frontend Bundle Analysis

Bundle analysis commands are available for both apps:

```bash
# ISP Operations App
cd frontend
pnpm --filter @dotmac/isp-ops-app analyze

# Platform Admin App
pnpm --filter @dotmac/platform-admin-app analyze

# Specific analysis targets
pnpm --filter @dotmac/isp-ops-app analyze:browser
pnpm --filter @dotmac/platform-admin-app analyze:server
```

### Recommended Bundle Budgets

| App | Target (gzipped) | Current Status |
|-----|------------------|----------------|
| ISP Ops (First Load JS) | < 200KB | Monitor |
| Admin (First Load JS) | < 200KB | Monitor |
| Shared packages | < 100KB | Monitor |

### Key Optimization Areas

1. **Code splitting** - Use dynamic imports for large dashboard sections
2. **Tree shaking** - Ensure Radix UI and Recharts are properly tree-shaken
3. **Font optimization** - Use next/font for optimal loading
4. **Image optimization** - Use next/image for automatic optimization

---

## Environment Configuration

### Frontend Dev Defaults (Non-Docker)

```bash
# .env.local.example defaults
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Docker Internal URLs

When running in Docker, services communicate via internal hostnames:
- `isp-backend:8000` (not localhost)
- `dotmac-postgres:5432` (not localhost)
- `dotmac-redis:6379` (not localhost)

---

## Related Documentation

- [DEPLOYMENT_MODEL.md](./DEPLOYMENT_MODEL.md) - Full deployment architecture
- [docker-compose.infra.yml](../../docker-compose.infra.yml) - Platform compose file
- [docker-compose.isp.yml](../../docker-compose.isp.yml) - ISP compose file
