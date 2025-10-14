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

- **Docker** (20.10+) and **Docker Compose** (v2.0+)
- **Python** 3.12+ (for backend development)
- **Node.js** 18+ and **pnpm** (for frontend development)
- **8GB+ RAM** and **50GB+ disk space**

### 1. Clone Repository

```bash
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops
```

### 2. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional for development)
# nano .env
```

### 3. Start Infrastructure

```bash
# Start all ISP services (takes ~5 minutes)
./scripts/init-infrastructure.sh
```

This will start:
- Core services (PostgreSQL, Redis, MinIO, OpenBao)
- ISP services (FreeRADIUS, NetBox, GenieACS, WireGuard, LibreNMS)
- Monitoring services (Prometheus, Grafana, Jaeger)

### 4. Initialize RADIUS Database

```bash
# Create RADIUS tables
./scripts/init-radius-db.sh
```

### 5. Start Backend API

```bash
cd backend
poetry install --with dev
poetry run alembic upgrade head
poetry run uvicorn dotmac.platform.api.main:app --reload
```

Backend API will be available at: http://localhost:8000/docs

### 6. Start Frontend

```bash
cd frontend
pnpm install
pnpm --filter @dotmac/base-app dev
```

Frontend will be available at: http://localhost:3000

## 🌐 Access Services

Once deployed, access these services:

### ISP Management
- **Backend API**: http://localhost:8000/docs (FastAPI Swagger)
- **Frontend**: http://localhost:3000 (Next.js admin portal)

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

Complete documentation is available in the `docs/` folder:

### Core Documentation
- **[README_ISP_PLATFORM.md](docs/README_ISP_PLATFORM.md)** - Platform overview and navigation
- **[ISP_PLATFORM_ARCHITECTURE.md](docs/ISP_PLATFORM_ARCHITECTURE.md)** - Complete system architecture
- **[INFRASTRUCTURE_SETUP.md](docs/INFRASTRUCTURE_SETUP.md)** - Detailed deployment guide
- **[INFRASTRUCTURE_QUICKSTART.md](INFRASTRUCTURE_QUICKSTART.md)** - 5-minute quick start

### Planning & Implementation
- **[TEAM_ASSIGNMENTS.md](docs/TEAM_ASSIGNMENTS.md)** - Team structure (11 teams, 38-48 people)
- **[IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)** - Timeline (MVP: 12 weeks, Full: 48 weeks)
- **[DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** - Complete database design (140+ tables)
- **[API_SPECIFICATIONS.md](docs/API_SPECIFICATIONS.md)** - REST API documentation

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
- **BSS modules**: 90% complete
- **OSS modules**: 20% complete (RADIUS, NetBox integrated)
- **Infrastructure**: Docker-based deployment ready
- **Test coverage**: 85%+ (6,146 tests)

## 🛣️ Roadmap

### Phase 1: MVP (12 weeks) - In Progress
- ✅ RADIUS authentication
- ✅ NetBox integration
- ✅ GenieACS TR-069
- ⏳ Service lifecycle automation
- ⏳ Basic network management
- ⏳ Admin portal

### Phase 2: FTTH (Weeks 13-24)
- VOLTHA integration
- OLT/ONU provisioning
- Fiber infrastructure management
- Maps visualization

### Phase 3: Wireless (Weeks 25-36)
- Tower and sector management
- RF planning tools
- Wireless subscriber management

### Phase 4: Advanced Features (Weeks 37-48)
- Ansible AWX automation
- Advanced analytics
- Mobile apps
- Customer portal

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📝 License

[Your License Here]

## 🆘 Support

- **Documentation**: See `docs/` folder
- **Quick Start**: [INFRASTRUCTURE_QUICKSTART.md](INFRASTRUCTURE_QUICKSTART.md)
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

For detailed setup instructions, see [INFRASTRUCTURE_QUICKSTART.md](INFRASTRUCTURE_QUICKSTART.md)
