# ISP Operations Platform - Documentation Index

**Project:** DotMac ISP Operations Platform
**Version:** 1.0
**Date:** 2025-10-14
**Status:** Historical reference (superseded by current implementation)

---

## 🎯 Project Overview

> **Note:** This document captures the original planning assumptions from October 2025. Many OSS components are now implemented; keep using it for historical context only.

Transform the DotMac Platform Services into a comprehensive **ISP Operations Platform** supporting:
- **FTTH (Fiber-to-the-Home)** - GPON/XGS-PON networks
- **WISP (Wireless ISP)** - Point-to-Point and Point-to-Multipoint
- **Traditional Broadband** - DSL, Cable, Fixed Wireless
- **OSS/BSS Integration** - Complete Operations and Business Support Systems

**Target Market:** Multi-tenant SaaS platform for ISPs, WISPs, and fiber network operators.

---

## 📚 Documentation Structure

### Core Documents

#### 1. ISP Platform Architecture (archived)
**Purpose:** Complete system architecture and design
**Audience:** All teams, stakeholders, architects

**Contents:**
- Platform overview
- Current state assessment (BSS/OSS gaps)
- Target architecture diagrams
- Technology stack
- System components (BSS/OSS modules)
- Integration points
- Data flow diagrams
- Security architecture
- Scalability & performance
- Disaster recovery

**Key Sections:**
- ✅ **BSS Modules**: 90% complete (billing, CRM, communications)
- ❌ **OSS Modules**: 80% to be built (RADIUS, FTTH, network mgmt)
- 🏗️ **Infrastructure**: Docker-based deployment
- 🔐 **Security**: Multi-tenant isolation, encryption, RBAC

> _This content now lives across_ [`docs/architecture/PORTAL_ARCHITECTURE.md`](architecture/PORTAL_ARCHITECTURE.md), [`docs/architecture/INFRASTRUCTURE.md`](architecture/INFRASTRUCTURE.md), _and the root infrastructure guides._

---

#### 2. Team Assignments & Responsibilities (archived)
**Purpose:** Team structure, module ownership, dependencies
**Audience:** Engineering managers, team leads, developers

**Contents:**
- Team structure (11 teams, 38-48 people)
- Platform teams (Core, DevOps, Data & Analytics)
- BSS teams (Billing, CRM, Communications)
- OSS teams (RADIUS, FTTH, Network Mgmt, Wireless, Service Lifecycle)
- Frontend teams (Admin Portal, Maps, NOC Dashboard, Mobile)
- Team dependencies matrix
- Critical path analysis
- Skills matrix
- Onboarding plan
- Success metrics

**Key Teams:**
- **Team O1 (RADIUS)**: 🔴 CRITICAL PATH - Blocks many teams
- **Team O2 (Service Lifecycle)**: Core automation
- **Team O3 (FTTH)**: VOLTHA, GenieACS, device protocols
- **Team O4 (Network Mgmt)**: NetBox, routers, VPN
- **Team O5 (Wireless)**: WISP, monitoring, fault management
- **Team F2 (Maps)**: Leaflet, ReactFlow visualization

> _Planning worksheets referenced here have been superseded by iterative tracking tools and are intentionally omitted from the codebase._

---

#### 3. Infrastructure Setup Guide
**Purpose:** Complete infrastructure deployment instructions (consolidated)
**Audience:** DevOps team, infrastructure engineers

**Contents:**
- Prerequisites (hardware, software)
- **Docker images** for all services:
  - FreeRADIUS (AAA)
  - NetBox (network inventory)
  - VOLTHA (OLT management)
  - GenieACS (TR-069 ACS)
  - WireGuard (VPN)
  - LibreNMS (monitoring)
  - Ansible AWX (automation)
  - MongoDB, PostgreSQL, Redis, etc.
- Development setup (Docker Compose)
- Production setup (Kubernetes)
- Service configuration
- Monitoring & observability
- Backup & disaster recovery
- Troubleshooting

**Quick Start:**
```bash
# Start core services (postgres, redis, vault, minio)
make start-platform

# Start optional observability stack (otel collector, prometheus, grafana, jaeger)
make start-platform-obs

# Start ISP services (FreeRADIUS, NetBox, GenieACS, AWX, LibreNMS, WireGuard, TimescaleDB)
make start-isp
```

---

#### 4. Implementation Plan & Timeline (archived)
**Purpose:** Complete project timeline with milestones
**Audience:** Project managers, team leads, stakeholders

**Contents:**
- **MVP Timeline**: 12 weeks (3 months) - Functional ISP platform
- **Full Timeline**: 48 weeks (12 months) - Complete feature set
- Week-by-week breakdown
- Team allocation over time
- Milestones & deliverables
- Risk management
- Success metrics
- Go/No-Go decision points

**MVP Delivers (12 weeks):**
- ✅ RADIUS authentication
- ✅ Service activation/suspension automation
- ✅ Usage-based billing
- ✅ Basic network management
- ✅ Admin portal
- ✅ NOC dashboard

**Full Platform (48 weeks):**
- Everything in MVP, plus:
- FTTH management (VOLTHA, GenieACS)
- Wireless management (WISP)
- Router/switch management
- Maps & topology visualization
- Subscriber portal & mobile apps
- Advanced monitoring & analytics

> _Milestone tracking has moved to external project management tooling. The historical outline is retained here for context only._

---

## 🚀 Quick Start Guides

### For Project Managers
**Read First:**
1. [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md) - Executive Summary
2. [Implementation Plan](IMPLEMENTATION_PLAN.md) - MVP Timeline
3. [Team Assignments](TEAM_ASSIGNMENTS.md) - Team Structure

**Next Steps:**
1. Review & approve architecture
2. Approve budget and timeline
3. Begin team formation
4. Schedule kickoff meeting

---

### For Engineering Managers
**Read First:**
1. [Team Assignments](TEAM_ASSIGNMENTS.md) - Complete document
2. [Implementation Plan](IMPLEMENTATION_PLAN.md) - Phases 1-2
3. [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md) - System Components

**Next Steps:**
1. Assign team leads
2. Review dependencies matrix
3. Setup weekly syncs
4. Begin hiring/staffing

---

### For Team Leads
**Read First:**
1. [Team Assignments](TEAM_ASSIGNMENTS.md) - Your team's section
2. [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md) - Your module's architecture
3. [Implementation Plan](IMPLEMENTATION_PLAN.md) - Your team's timeline

**Next Steps:**
1. Review module specifications
2. Identify dependencies
3. Plan sprints
4. Setup team meetings

---

### For Developers
**Read First:**
1. [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md) - Technology Stack
2. [Infrastructure Setup](INFRASTRUCTURE_SETUP.md) - Development Setup
3. [Team Assignments](TEAM_ASSIGNMENTS.md) - Your team's responsibilities

**Next Steps:**
1. Setup development environment
2. Clone repository
3. Run Docker Compose setup
4. Review existing codebase
5. Pick up first ticket

---

### For DevOps Engineers
**Read First:**
1. [Infrastructure Setup](INFRASTRUCTURE_SETUP.md) - Complete document
2. [ISP Platform Architecture](ISP_PLATFORM_ARCHITECTURE.md) - Infrastructure Layer
3. [Implementation Plan](IMPLEMENTATION_PLAN.md) - Phase 0-1

**Next Steps:**
1. Provision infrastructure (Week 1-2)
2. Deploy all Docker services
3. Setup CI/CD pipelines
4. Configure monitoring
5. Document runbooks

---

## 📊 Project Metrics

### Current State

| Category | Status | Completion |
|----------|--------|------------|
| **BSS (Business Support Systems)** | ✅ Mostly Complete | 90% |
| **OSS (Operations Support Systems)** | ❌ To Be Built | 20% |
| **Frontend** | ⚠️ Partial | 40% |
| **Infrastructure** | ⚠️ Design Phase | 0% |
| **Documentation** | ✅ Architecture Complete | 80% |

### Target Metrics (Post-Launch)

| Metric | Target | Priority |
|--------|--------|----------|
| **Concurrent Subscribers** | 10,000+ | Critical |
| **API Response Time (p95)** | < 200ms | Critical |
| **RADIUS Auth Time** | < 100ms | Critical |
| **Service Activation Time** | < 5 min | High |
| **Platform Uptime** | > 99.9% | Critical |
| **Test Coverage** | > 80% | High |

---

## 🏗️ Technology Stack Summary

### Backend
- **Language:** Python 3.12+
- **Framework:** FastAPI
- **ORM:** SQLAlchemy 2.0
- **Database:** PostgreSQL 14+
- **Cache:** Redis 7+
- **Task Queue:** Celery
- **Secrets:** HashiCorp Vault

### Network Management
- **AAA:** FreeRADIUS
- **Inventory:** NetBox
- **OLT:** VOLTHA
- **TR-069:** GenieACS
- **VPN:** WireGuard
- **Monitoring:** LibreNMS
- **Automation:** Ansible AWX

### Frontend
- **Framework:** Next.js 14
- **UI:** React 18.3
- **State:** TanStack Query
- **Styling:** Tailwind CSS
- **Maps:** Leaflet
- **Topology:** ReactFlow

### Infrastructure
- **Containers:** Docker
- **Orchestration:** Kubernetes
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana
- **Tracing:** Jaeger

---

## 🎯 Critical Path

The project has a critical path that **MUST** be completed first:

### Phase 1 (Weeks 3-8) - BLOCKING
1. **FreeRADIUS Integration** (Team O1)
   - Blocks: Service Lifecycle, Billing Integration, Router Management
   - Must complete Week 4

2. **Service Lifecycle Core** (Team O2)
   - Depends on: RADIUS
   - Blocks: All provisioning features
   - Must complete Week 6

3. **NetBox Integration** (Team O4)
   - Blocks: Device Management, Maps, Topology
   - Must complete Week 8

**If Phase 1 delays:** Entire project timeline shifts.

---

## 📋 Module Reference

### BSS Modules (90% Complete)

| Module | Path | Status | Owner Team |
|--------|------|--------|------------|
| Billing | `src/dotmac/platform/billing/` | ✅ Complete | Team B1 |
| Customer Management | `src/dotmac/platform/customer_management/` | ✅ Complete | Team B2 |
| Communications | `src/dotmac/platform/communications/` | ✅ Complete | Team B3 |
| Tenant Management | `src/dotmac/platform/tenant/` | ⚠️ Needs Enhancement | Team P1 |
| Partner Management | `src/dotmac/platform/partner_management/` | ✅ Complete | Team B2 |

### OSS Modules (To Be Built)

| Module | Path | Priority | Owner Team |
|--------|------|----------|------------|
| **RADIUS** | `src/dotmac/platform/radius/` | 🔴 Critical | Team O1 |
| **Service Lifecycle** | `src/dotmac/platform/service_lifecycle/` | 🔴 Critical | Team O2 |
| **Network Management** | `src/dotmac/platform/network_management/` | 🔴 Critical | Team O4 |
| **VPN Management** | `src/dotmac/platform/vpn_management/` | 🔴 Critical | Team O4 |
| **Device Protocols** | `src/dotmac/platform/device_protocols/` | 🔴 Critical | Team O3 |
| VOLTHA | `src/dotmac/platform/voltha/` | 🟠 High | Team O3 |
| TR-069 (GenieACS) | `src/dotmac/platform/tr069_management/` | 🟠 High | Team O3 |
| Router Management | `src/dotmac/platform/router_management/` | 🟠 High | Team O4 |
| Wireless Management | `src/dotmac/platform/wireless_management/` | 🟠 High | Team O5 |
| Fault Management | `src/dotmac/platform/fault_management/` | 🟡 Medium | Team O5 |
| Performance Monitoring | `src/dotmac/platform/performance_monitoring/` | 🟡 Medium | Team O5 |
| Automation (Ansible) | `src/dotmac/platform/automation/` | 🟠 High | Team O2 |

### Frontend Apps

| App | Path | Priority | Owner Team |
|-----|------|----------|------------|
| Admin Portal | `frontend/apps/base-app/` | 🟠 High | Team F1 |
| NOC Dashboard | `frontend/apps/noc-dashboard/` | 🟠 High | Team F3 |
| Subscriber Portal | `frontend/apps/subscriber-portal/` | 🟡 Medium | Team F4 |
| Mobile Apps | `mobile/` | 🟢 Low | Team F4 |

---

## 🔒 Security Highlights

### Multi-Tenant Isolation
- Database row-level security (RLS)
- Tenant-scoped API queries
- VPN network isolation per tenant
- Separate Redis namespaces

### Authentication & Authorization
- JWT tokens (RS256)
- RBAC with granular permissions
- MFA support (TOTP, SMS)
- API keys for service-to-service

### Data Protection
- Encryption at rest (PostgreSQL TDE, MinIO SSE)
- Encryption in transit (TLS 1.3, WireGuard)
- Secrets in Vault (never in code)
- PII encryption

### Compliance
- GDPR-ready (data retention, right-to-delete)
- Audit logging (7-year retention)
- RADIUS accounting (2-year retention)
- Lawful intercept support (optional)

---

## 📞 Communication Channels

### Slack Channels
- `#isp-platform-dev` - General development
- `#team-bss` - BSS teams coordination
- `#team-oss` - OSS teams coordination
- `#team-frontend` - Frontend teams
- `#platform-alerts` - Critical alerts
- `#platform-releases` - Release announcements

### Meetings
- **Daily Standup:** Per team (15 min)
- **Cross-Team Sync:** Mon/Wed/Fri (30 min)
- **All-Hands:** Friday (1 hour) - Demo & planning
- **Architecture Review:** Bi-weekly (As needed)

### Tools
- **Project Management:** Jira
- **Code Repository:** GitHub
- **Documentation:** Confluence / GitHub Wiki
- **Design:** Figma
- **API Docs:** Swagger/OpenAPI

---

## 📖 Additional Documentation (To Be Created)

The following documents are referenced but not yet created:

1. **DATABASE_SCHEMA.md** - Complete database design, ERD diagrams, migrations
2. **API_SPECIFICATIONS.md** - Complete API contracts, OpenAPI specs
3. **FRONTEND_ARCHITECTURE.md** - Frontend patterns, component library
4. **TESTING_STRATEGY.md** - QA approach, test plans
5. **DEPLOYMENT_GUIDE.md** - Production deployment procedures
6. **MONITORING_GUIDE.md** - Observability setup, dashboards
7. **SECURITY_GUIDE.md** - Security policies, pen-test results
8. **USER_MANUAL.md** - End-user documentation
9. **OPERATIONS_RUNBOOK.md** - Incident response, troubleshooting

---

## 🎓 Training & Onboarding

### Week 1: Platform Orientation
- Platform overview presentation
- Architecture walkthrough
- Development environment setup
- Access provisioning (GitHub, Jira, Slack, etc.)

### Week 2: Module Deep-Dive
- Team-specific training
- Code walkthrough (existing platform)
- API documentation review
- Database schema review

### Week 3: Integration Training
- Cross-team dependencies
- Integration testing
- First feature (paired programming)

### Week 4+: Independent Work
- Sprint participation
- Code reviews
- Feature development

---

## 🚀 Getting Started (Developers)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/dotmac-isp-ops.git
cd dotmac-isp-ops
```

### 2. Setup Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env with your credentials
nano .env

# Create Docker network
docker network create isp-network
```

### 3. Start Infrastructure
```bash
# Start core stack
docker compose up -d

# ISP services (optional)
docker compose -f docker-compose.isp.yml up -d

# Observability stack (optional)
docker compose -f docker-compose.observability.yml up -d

# Check status
docker compose ps
```

### 4. Setup Backend
```bash
# Install Python dependencies
cd backend
poetry install --with dev

# Run migrations
poetry run alembic upgrade head

# Seed database (optional)
poetry run python scripts/seed_data.py

# Start development server
poetry run uvicorn dotmac.platform.api.main:app --reload
```

### 5. Setup Frontend
```bash
# Install Node dependencies
cd frontend
pnpm install

# Start development server
pnpm --filter @dotmac/base-app dev
```

### 6. Verify Setup
- Backend API: http://localhost:8000/docs
- Frontend: http://localhost:3000
- NetBox: http://localhost:8080
- Grafana: http://localhost:3000

---

## ✅ Project Status

**Current Phase:** Planning & Design ✅
**Next Phase:** Infrastructure Setup (Week 1-2)
**Target MVP Date:** Week 12 (3 months from start)
**Target Full Launch:** Week 48 (12 months from start)

### Approvals Required
- [ ] Architecture Review - Technical Lead
- [ ] Budget Approval - Finance
- [ ] Timeline Approval - Project Sponsor
- [ ] Team Allocation - Engineering Manager
- [ ] Security Review - CISO

---

## 📞 Contact

**Technical Lead:** [Name]
**Product Manager:** [Name]
**Engineering Manager:** [Name]
**DevOps Lead:** [Name]

**Project Email:** isp-platform@yourdomain.com
**Slack:** #isp-platform-dev

---

## 📝 Document Updates

| Document | Last Updated | Next Review |
|----------|--------------|-------------|
| Architecture | 2025-10-14 | Weekly (during Phase 0-1) |
| Team Assignments | 2025-10-14 | Bi-weekly |
| Infrastructure Setup | 2025-10-14 | As needed |
| Implementation Plan | 2025-10-14 | Weekly (sprint planning) |

---

**Ready to get started? Begin with [Infrastructure Setup](INFRASTRUCTURE_SETUP.md) or contact the DevOps team!**
