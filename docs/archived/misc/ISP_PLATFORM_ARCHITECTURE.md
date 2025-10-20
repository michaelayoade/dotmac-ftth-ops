# ISP Operations Platform - Complete Architecture

**Version:** 1.0
**Date:** 2025-10-14
**Status:** Planning Phase

## Executive Summary

This document outlines the complete architecture for transforming the DotMac Platform Services into a comprehensive ISP Operations Platform supporting FTTH (Fiber-to-the-Home), WISP (Wireless ISP), and traditional broadband operations.

The platform combines **OSS (Operations Support Systems)** and **BSS (Business Support Systems)** into a unified multi-tenant SaaS solution for ISP management.

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Current State Assessment](#current-state-assessment)
3. [Target Architecture](#target-architecture)
4. [Technology Stack](#technology-stack)
5. [System Components](#system-components)
6. [Integration Points](#integration-points)
7. [Data Flow](#data-flow)
8. [Security Architecture](#security-architecture)
9. [Scalability & Performance](#scalability--performance)
10. [Disaster Recovery](#disaster-recovery)

---

## Platform Overview

### Business Objectives

- **Multi-Tenant ISP Management**: Enable multiple ISPs to manage their operations on a single platform
- **End-to-End Automation**: From service activation to billing and support
- **Multi-Access Support**: FTTH (GPON/XGS-PON), Wireless (PtP/PtMP), and traditional broadband
- **Unified OSS/BSS**: Eliminate data silos between operations and billing
- **White-Label Capable**: Partners can rebrand and resell the platform

### Key Stakeholders

- **ISP Operators** (Tenants): Primary platform users managing their networks
- **End Subscribers**: Internet service customers
- **Field Technicians**: Installation and maintenance crews
- **Partners/Resellers**: Wholesale/retail ISP partners
- **Network Engineers**: NOC and infrastructure teams
- **Support Teams**: Customer service representatives

---

## Current State Assessment

### ✅ Existing Platform Strengths (90% BSS Complete)

The DotMac Platform already provides a robust **Business Support Systems** foundation:

| Component | Status | Module Path |
|-----------|--------|-------------|
| **Billing Engine** | ✅ Complete | `src/dotmac/platform/billing/` |
| **Subscription Management** | ✅ Complete | `billing/subscriptions/` |
| **Invoice Generation** | ✅ Complete | `billing/invoicing/` |
| **Payment Processing** | ✅ Complete | `billing/payments/` |
| **Multi-Currency Support** | ✅ Complete | `billing/currency/` |
| **Tax Calculation** | ✅ Complete | `billing/tax/` |
| **Credit Notes/Refunds** | ✅ Complete | `billing/credit_notes/` |
| **Payment Reconciliation** | ✅ Complete | `billing/reconciliation_*` |
| **Usage-Based Billing** | ✅ Complete | `billing/catalog/` |
| **CRM Foundation** | ✅ Complete | `customer_management/`, `contacts/` |
| **Communications** | ✅ Complete | `communications/` (Email, SMS) |
| **Analytics/Reporting** | ✅ Complete | `analytics/`, `graphql/` |
| **Partner Management** | ✅ Complete | `partner_management/` |
| **Multi-Tenancy** | ✅ Complete | `tenant/` |
| **RBAC & Auth** | ✅ Complete | `auth/` |
| **Audit Logging** | ✅ Complete | `audit/` |
| **File Storage** | ✅ Complete | `file_storage/` (MinIO/S3) |
| **Webhooks** | ✅ Complete | `webhooks/` |
| **Feature Flags** | ✅ Complete | `feature_flags/` |
| **Secrets Management** | ✅ Complete | `secrets/` (Vault) |
| **Ticketing** | ✅ Basic | `ticketing/` |

### ✅ Operations Support Systems (85% Complete)

**OSS modules successfully implemented:**

| Component | Status | Module Path |
|-----------|--------|-------------|
| **FreeRADIUS (AAA)** | ✅ Complete | `radius/` |
| **Service Lifecycle Automation** | ✅ Complete | `orchestration/`, `services/` |
| **Network Inventory (NetBox)** | ✅ Complete | `netbox/` |
| **VPN Management (WireGuard)** | ✅ Complete | `wireguard/` |
| **LibreNMS Monitoring** | ✅ Complete | `network_monitoring/` |
| **VOLTHA Integration** | ✅ Complete | `voltha/` |
| **GenieACS (TR-069)** | ✅ Complete | `genieacs/` |
| **Wireless Management** | ✅ Complete | `wireless/` |
| **Fault Management** | ✅ Complete | `fault_management/` |
| **Diagnostics Tools** | ✅ Complete | `diagnostics/` |
| **Job Scheduler** | ✅ Complete | `jobs/` |
| **Deployment Orchestration** | ✅ Complete | `deployment/` |
| **Ansible AWX Integration** | ✅ Complete | `ansible/` |
| **Internet Service Plans** | ✅ Complete | `services/internet_plans/` |
| **Notifications** | ✅ Complete | `notifications/` |

### 🔄 In Progress / Planned

| Component | Status | Priority |
|-----------|--------|----------|
| Leaflet Maps (Frontend) | ⏳ Planned | 🟠 High |
| ReactFlow Topology (Frontend) | ⏳ Planned | 🟠 High |
| NOC Real-time Dashboard | ⏳ In Progress | 🟠 High |
| Advanced Capacity Planning | ⏳ Planned | 🟡 Medium |
| Enhanced Subscriber Portal | ⏳ Partial | 🟡 Medium |
| Mobile Apps | ⏳ Planned | 🟢 Low |

---

## Target Architecture

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ Admin Portal │  │  Subscriber  │  │   Partner    │            │
│  │  (Next.js)   │  │   Portal     │  │   Portal     │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │NOC Dashboard │  │  Field Tech  │  │  Sales App   │            │
│  │ (Real-time)  │  │ Mobile App   │  │   (Mobile)   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/WSS
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY LAYER                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  REST API          GraphQL API        WebSocket          gRPC      │
│  /api/v1/*        /api/v1/graphql    /ws/realtime    (Internal)   │
│                                                                     │
│  - Authentication (JWT)                                             │
│  - Authorization (RBAC)                                             │
│  - Rate Limiting                                                    │
│  - Request Validation                                               │
│  - Tenant Isolation                                                 │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                       APPLICATION LAYER (FastAPI)                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────── BSS MODULES ────────────────────┐          │
│  │                                                       │          │
│  │  billing/          customer_management/              │          │
│  │  invoicing/        communications/                   │          │
│  │  payments/         partner_management/               │          │
│  │  subscriptions/    analytics/                        │          │
│  │  tenant/           user_management/                  │          │
│  │  contracts/        dunning/                          │          │
│  │                                                       │          │
│  └───────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌──────────────────── OSS MODULES ────────────────────┐          │
│  │                                                       │          │
│  │  radius/              orchestration/                 │          │
│  │  services/            voltha/                        │          │
│  │  wireguard/           genieacs/                      │          │
│  │  network_monitoring/  netbox/                        │          │
│  │  wireless/            ansible/                       │          │
│  │  fault_management/    diagnostics/                   │          │
│  │  deployment/          jobs/                          │          │
│  │  notifications/       crm/                           │          │
│  │                                                       │          │
│  └───────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌─────────────── SHARED SERVICES ──────────────────┐             │
│  │                                                    │             │
│  │  auth/          core/          monitoring/        │             │
│  │  audit/         events/        observability/     │             │
│  │  webhooks/      file_storage/  secrets/           │             │
│  │  search/        feature_flags/ resilience/        │             │
│  │                                                    │             │
│  └────────────────────────────────────────────────────┘             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND PROCESSING LAYER                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                  │
│  │   Celery   │  │  Celery    │  │   Celery   │                  │
│  │  Workers   │  │   Beat     │  │   Flower   │                  │
│  │            │  │ (Scheduler) │  │ (Monitor)  │                  │
│  └────────────┘  └────────────┘  └────────────┘                  │
│                                                                     │
│  Tasks:                                                             │
│  - RADIUS accounting sync                                           │
│  - Usage billing aggregation                                        │
│  - Device monitoring polls                                          │
│  - Config backups                                                   │
│  - Alarm processing                                                 │
│  - Email/SMS sending                                                │
│  - Report generation                                                │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS LAYER                      │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ FreeRADIUS  │  │   NetBox    │  │   VOLTHA    │               │
│  │   (AAA)     │  │  (Inventory) │  │ (OLT Mgmt)  │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  GenieACS   │  │  WireGuard  │  │  LibreNMS   │               │
│  │  (TR-069)   │  │    (VPN)    │  │ (Monitoring) │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │   Ansible   │  │   Stripe    │  │   Twilio    │               │
│  │    AWX      │  │  (Payments)  │  │    (SMS)    │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                 │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │ PostgreSQL  │  │    Redis    │  │  MongoDB    │               │
│  │  (Primary)  │  │   (Cache)   │  │ (GenieACS)  │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │TimescaleDB  │  │    MinIO    │  │Elasticsearch│               │
│  │ (Metrics)   │  │  (Storage)  │  │   (Logs)    │               │
│  └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                             │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────┐       │
│  │              Kubernetes / Docker Swarm                  │       │
│  │                   Container Orchestration                │       │
│  └────────────────────────────────────────────────────────┘       │
│                                                                     │
│  ┌────────────────────────────────────────────────────────┐       │
│  │              Monitoring & Observability                 │       │
│  │  - Prometheus (Metrics)                                 │       │
│  │  - Jaeger (Distributed Tracing)                         │       │
│  │  - Grafana (Dashboards)                                 │       │
│  │  - ELK Stack (Logging)                                  │       │
│  └────────────────────────────────────────────────────────┘       │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Runtime** | Python | 3.12+ | Application runtime |
| **Web Framework** | FastAPI | 0.109+ | REST/GraphQL APIs |
| **ORM** | SQLAlchemy | 2.0+ | Database abstraction |
| **Validation** | Pydantic | 2.0+ | Data validation |
| **Database** | PostgreSQL | 14+ | Primary datastore |
| **Cache** | Redis | 6+ | Caching, sessions |
| **Task Queue** | Celery | 5.3+ | Background jobs |
| **Message Broker** | Redis | 6+ | Celery broker |
| **Object Storage** | MinIO | Latest | File storage (S3-compatible) |
| **Search** | Elasticsearch | 8+ | Full-text search |
| **Time-Series** | TimescaleDB | Latest | Metrics storage |
| **Document DB** | MongoDB | 6+ | GenieACS backend |
| **Secrets** | HashiCorp Vault | Latest | Secret management |

### Network Management

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **AAA Server** | FreeRADIUS | Authentication/Authorization/Accounting |
| **Network Inventory** | NetBox | IPAM, DCIM, circuit management |
| **OLT Management** | VOLTHA | Open OLT adapter |
| **TR-069 ACS** | GenieACS | CPE/ONT management |
| **VPN** | WireGuard | Secure OLT connectivity |
| **Monitoring** | LibreNMS | Network monitoring |
| **Automation** | Ansible AWX | Configuration management |

### Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Next.js | 14+ | React framework |
| **UI Library** | React | 18.3+ | Component library |
| **State Management** | TanStack Query | 5+ | Server state |
| **Styling** | Tailwind CSS | 3.4+ | Utility-first CSS |
| **Forms** | React Hook Form | 7+ | Form management |
| **Validation** | Zod | 3+ | Schema validation |
| **Charts** | Recharts | 2.10+ | Data visualization |
| **Maps** | Leaflet | 1.9+ | Geographic maps |
| **Topology** | ReactFlow | 11+ | Network diagrams |

### DevOps & Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Containerization** | Docker | Application packaging |
| **Orchestration** | Kubernetes / Docker Swarm | Container orchestration |
| **CI/CD** | GitHub Actions | Continuous integration |
| **Monitoring** | Prometheus + Grafana | Metrics & dashboards |
| **Tracing** | Jaeger / OpenTelemetry | Distributed tracing |
| **Logging** | ELK Stack | Log aggregation |
| **Load Balancer** | Nginx | Reverse proxy |

---

## System Components

### BSS (Business Support Systems)

#### 1. Billing Module (`billing/`)
**Status:** ✅ Complete
**Owner Team:** Billing Team

**Capabilities:**
- Subscription lifecycle management
- Invoice generation (PDF, email)
- Payment processing (Stripe, manual)
- Multi-currency support
- Tax calculation
- Credit notes and refunds
- Usage-based billing
- Overage tracking
- Payment reconciliation

**Key Models:**
- `BillingSubscriptionTable`
- `BillingSubscriptionPlanTable`
- `Invoice`
- `InvoiceLineItem`
- `Payment`

**API Endpoints:**
- `POST /api/v1/billing/subscriptions` - Create subscription
- `GET /api/v1/billing/invoices/{id}` - Get invoice
- `POST /api/v1/billing/payments` - Process payment
- `GET /api/v1/billing/subscriptions/{id}/usage` - Get usage

#### 2. Customer Management (`customer_management/`)
**Status:** ✅ Complete
**Owner Team:** CRM Team

**Capabilities:**
- Customer lifecycle management
- Contact information
- Customer notes and history
- Segmentation and tagging
- Integration with billing

**Enhancements Needed for ISP:**
- Add subscriber-specific fields (service address, installation status)
- Link to network devices (ONU, CPE)
- Service history tracking

#### 3. Communications (`communications/`)
**Status:** ✅ Complete
**Owner Team:** Platform Team

**Capabilities:**
- Email service (SendGrid/SMTP)
- SMS notifications (Twilio)
- Template management
- Bulk messaging
- Delivery tracking
- Event-driven notifications

#### 4. Tenant Management (`tenant/`)
**Status:** ✅ Complete (Needs Enhancement)
**Owner Team:** Platform Team

**Current Capabilities:**
- Multi-tenant isolation
- Tenant settings
- Usage tracking
- Feature flags
- Subscription plans

**Enhancements Needed:**
- License management (max subscribers, max OLTs)
- Auto-suspension on overage
- Grace period management
- Per-tenant VPN isolation

### OSS (Operations Support Systems)

#### 1. RADIUS Module (`radius/`) - NEW
**Status:** ❌ To Be Built
**Owner Team:** Network Authentication Team
**Priority:** 🔴 Critical
**Estimated Effort:** 2 weeks

**Components:**
```
radius/
├── freeradius/
│   ├── radius_manager.py       # FreeRADIUS API wrapper
│   ├── sql_integration.py      # PostgreSQL radacct sync
│   ├── nas_management.py       # Network Access Servers
│   └── attribute_builder.py    # RADIUS attributes
├── accounting/
│   ├── session_tracker.py      # Active sessions
│   ├── usage_collector.py      # Data usage aggregation
│   ├── billing_sync.py         # Sync to billing module
│   └── realtime_monitor.py     # Live monitoring
├── subscriber_auth/
│   ├── credential_manager.py   # PPPoE credentials
│   ├── mac_auth.py             # MAC authentication
│   ├── voucher_auth.py         # Prepaid vouchers
│   └── social_login.py         # Hotspot social login
├── bandwidth_management/
│   ├── profile_manager.py      # Speed profiles
│   ├── dynamic_shaping.py      # Time-based throttling
│   ├── fup_enforcer.py         # Fair Usage Policy
│   └── burst_control.py        # Burst configs
├── models.py
├── schemas.py
└── api/
    └── routes.py
```

**Database Tables:**
- `radcheck` - Authentication credentials
- `radreply` - Authorization attributes
- `radacct` - Accounting sessions
- `nas` - Network Access Servers
- `bandwidth_profiles` - Speed plans

**API Endpoints:**
- `POST /api/v1/radius/subscribers` - Create RADIUS user
- `PUT /api/v1/radius/subscribers/{id}/suspend` - Suspend user
- `PUT /api/v1/radius/subscribers/{id}/bandwidth` - Change speed
- `GET /api/v1/radius/sessions` - Active sessions
- `GET /api/v1/radius/usage/{subscriber_id}` - Usage stats

**Integration Points:**
- FreeRADIUS PostgreSQL backend
- Billing module (usage sync)
- Service lifecycle (activation/suspension)
- Router management (NAS registration)

**Dependencies:**
- FreeRADIUS server deployment
- PostgreSQL RADIUS schema
- Celery workers for usage sync

#### 2. Service Lifecycle Module (`service_lifecycle/`) - NEW
**Status:** ❌ To Be Built
**Owner Team:** Automation Team
**Priority:** 🔴 Critical
**Estimated Effort:** 3 weeks

**Components:**
```
service_lifecycle/
├── workflows/
│   ├── activation.py           # New service activation
│   ├── suspension.py           # Service suspension
│   ├── termination.py          # Service cancellation
│   ├── upgrade.py              # Plan upgrade
│   └── downgrade.py            # Plan downgrade
├── orchestration/
│   ├── workflow_engine.py      # Workflow orchestrator
│   ├── step_executor.py        # Execute workflow steps
│   ├── rollback_handler.py     # Handle failures
│   └── notification_manager.py # Send notifications
├── provisioning/
│   ├── radius_provisioner.py   # Create RADIUS account
│   ├── onu_provisioner.py      # Provision ONU
│   ├── cpe_provisioner.py      # Configure CPE
│   └── ip_allocator.py         # Assign IP address
├── models.py
├── schemas.py
└── api/
    └── routes.py
```

**Workflow Example - Activation:**
1. Validate subscriber eligibility
2. Create RADIUS credentials
3. Provision ONU (VOLTHA)
4. Configure CPE (GenieACS)
5. Assign IP address (IPAM)
6. Add to router (PPPoE server)
7. Activate billing subscription
8. Send welcome email with credentials
9. Schedule installation appointment

**API Endpoints:**
- `POST /api/v1/service-lifecycle/activate` - Activate service
- `POST /api/v1/service-lifecycle/suspend` - Suspend service
- `POST /api/v1/service-lifecycle/terminate` - Terminate service
- `POST /api/v1/service-lifecycle/upgrade` - Upgrade plan
- `GET /api/v1/service-lifecycle/status/{subscriber_id}` - Get status

**Dependencies:**
- RADIUS module
- VOLTHA integration
- GenieACS integration
- Billing module
- Communications module

#### 3. VPN Management Module (`vpn_management/`) - NEW
**Status:** ❌ To Be Built
**Owner Team:** Network Infrastructure Team
**Priority:** 🔴 Critical
**Estimated Effort:** 2 weeks

**Components:**
```
vpn_management/
├── wireguard/
│   ├── server_manager.py       # WireGuard server config
│   ├── peer_config.py          # Peer configuration
│   ├── key_management.py       # Public/private keys
│   └── network_pool.py         # VPN IP allocation
├── olt_connectivity/
│   ├── tunnel_monitor.py       # Monitor tunnels
│   ├── connection_service.py   # Track connections
│   ├── failover.py             # Handle failures
│   └── health_check.py         # Tunnel health
├── models.py
├── schemas.py
└── api/
    └── routes.py
```

**Database Tables:**
- `vpn_tunnels` - VPN tunnel configurations
- `vpn_peers` - OLT peer connections
- `vpn_ip_pools` - IP address pools per tenant

**API Endpoints:**
- `POST /api/v1/vpn/tunnels` - Create VPN tunnel
- `GET /api/v1/vpn/config/{olt_id}` - Get WireGuard config
- `GET /api/v1/vpn/status/{tunnel_id}` - Tunnel status
- `DELETE /api/v1/vpn/tunnels/{id}` - Delete tunnel

**Integration Points:**
- Network management (OLT registration)
- Monitoring (tunnel health)
- Secrets vault (private keys)

#### 4. Network Management Module (`network_management/`) - NEW
**Status:** ❌ To Be Built
**Owner Team:** Network Operations Team
**Priority:** 🔴 Critical
**Estimated Effort:** 3 weeks

**Components:**
```
network_management/
├── netbox/
│   ├── client.py               # NetBox API client
│   ├── sync_service.py         # Sync NetBox ↔ Platform
│   ├── device_manager.py       # Device CRUD
│   └── webhook_handler.py      # NetBox webhooks
├── ipam/
│   ├── ip_pool_service.py      # IP pool management
│   ├── allocation_service.py   # IP allocation
│   ├── vlan_service.py         # VLAN management
│   └── ipv6_service.py         # IPv6 support
├── dcim/
│   ├── device_service.py       # Device inventory
│   ├── rack_service.py         # Rack management
│   └── cable_service.py        # Cable plant
├── circuits/
│   ├── circuit_service.py      # Circuit management
│   └── provider_service.py     # Provider tracking
├── models.py
├── schemas.py
└── api/
    └── routes.py
```

**Database Tables:**
- `devices` - Network devices (synced from NetBox)
- `ip_addresses` - IP allocations
- `vlans` - VLAN configurations
- `circuits` - Fiber circuits

**API Endpoints:**
- `GET /api/v1/network/devices` - List devices
- `POST /api/v1/network/devices` - Create device
- `GET /api/v1/network/ipam/pools` - IP pools
- `POST /api/v1/network/ipam/allocate` - Allocate IP

**Integration Points:**
- NetBox (primary inventory source)
- VOLTHA (OLT devices)
- Router management (routers/switches)
- Wireless management (APs, towers)

#### 5. Device Protocols Module (`device_protocols/`) - NEW
**Status:** ❌ To Be Built
**Owner Team:** Device Management Team
**Priority:** 🔴 Critical
**Estimated Effort:** 2 weeks

**Components:**
```
device_protocols/
├── snmp/
│   ├── manager.py              # SNMP manager
│   ├── mib_parser.py           # MIB parsing
│   ├── trap_receiver.py        # SNMP traps
│   ├── metrics_collector.py    # Metrics polling
│   └── alarm_monitor.py        # Alarm processing
├── ssh/
│   ├── connection_pool.py      # SSH connection pool
│   ├── command_executor.py     # Execute commands
│   ├── config_backup.py        # Config backups
│   └── firmware_updater.py     # Firmware updates
├── telnet/
│   ├── client.py               # Telnet client
│   └── legacy_manager.py       # Legacy devices
├── models.py
├── schemas.py
└── api/
    └── routes.py
```

**API Endpoints:**
- `POST /api/v1/devices/{id}/snmp/poll` - Poll SNMP
- `POST /api/v1/devices/{id}/ssh/execute` - Execute SSH command
- `POST /api/v1/devices/{id}/backup` - Backup config
- `GET /api/v1/devices/{id}/metrics` - Get device metrics

**Integration Points:**
- Network management (device inventory)
- Monitoring (metrics collection)
- Fault management (alarms)
- Secrets vault (credentials)

---

## Integration Points

### Inter-Module Communication

```
┌─────────────────────────────────────────────────────────────┐
│                 Integration Flow Example:                    │
│              New Subscriber Activation                       │
└─────────────────────────────────────────────────────────────┘

1. Customer Management
   └─> Creates new subscriber record
       │
       ▼
2. Service Lifecycle (Activation Workflow)
   ├─> RADIUS Module
   │   └─> Creates PPPoE credentials
   │
   ├─> Network Management
   │   └─> Allocates IP address from pool
   │
   ├─> VOLTHA Integration
   │   └─> Provisions ONU on OLT
   │
   ├─> GenieACS Integration
   │   └─> Configures CPE WiFi settings
   │
   ├─> Router Management
   │   └─> Adds user to PPPoE server
   │
   ├─> Billing Module
   │   └─> Activates subscription
   │
   └─> Communications Module
       └─> Sends welcome email
```

### Event-Driven Architecture

The platform uses an event bus for decoupled communication:

```python
# Event Types
class ServiceActivatedEvent:
    subscriber_id: str
    service_type: str
    plan_id: str
    activation_date: datetime

# Publishers
await event_bus.publish(
    "service.activated",
    ServiceActivatedEvent(...)
)

# Subscribers
@event_handler("service.activated")
async def on_service_activated(event: ServiceActivatedEvent):
    # Billing module listens and starts charging
    # Analytics module tracks activation
    # NOC dashboard updates status
```

### External System Integration

| External System | Protocol | Integration Type | Purpose |
|----------------|----------|------------------|---------|
| **FreeRADIUS** | PostgreSQL | Database | Shared database for RADIUS |
| **NetBox** | REST API | API Client | Network inventory sync |
| **VOLTHA** | gRPC | gRPC Client | OLT management |
| **GenieACS** | REST API | API Client | TR-069 CPE management |
| **WireGuard** | CLI/Config | Direct | VPN tunnel management |
| **LibreNMS** | MySQL/API | Database + API | Monitoring data |
| **Ansible AWX** | REST API | API Client | Automation jobs |
| **Stripe** | REST API | API Client | Payment processing |
| **Twilio** | REST API | API Client | SMS notifications |
| **SendGrid** | REST API | API Client | Email delivery |

---

## Data Flow

### Subscriber Usage Billing Flow

```
1. Subscriber connects (PPPoE)
   │
   ▼
2. FreeRADIUS authenticates
   └─> Writes to radacct table (session start)
   │
   ▼
3. Subscriber uses internet
   │
   ▼
4. Router sends RADIUS accounting updates
   └─> Updates radacct (bytes transferred)
   │
   ▼
5. Celery Worker (hourly)
   ├─> Reads radacct table
   ├─> Aggregates usage per subscriber
   └─> Calls Billing Module API
       │
       ▼
6. Billing Module
   ├─> Records usage against subscription
   ├─> Calculates overages
   ├─> Generates invoice line items
   └─> Triggers FUP if limit exceeded
       │
       ▼
7. FUP Enforcement
   └─> RADIUS Module updates bandwidth profile
       └─> FreeRADIUS throttles subscriber
```

### Service Activation Flow

```
1. Admin creates subscriber in portal
   │
   ▼
2. API: POST /api/v1/subscribers
   │
   ▼
3. Service Lifecycle Module
   │
   ├─> Step 1: Validate eligibility
   │   └─> Check coverage, capacity
   │
   ├─> Step 2: RADIUS provisioning
   │   └─> Create credentials in radcheck
   │
   ├─> Step 3: IP allocation
   │   └─> Allocate IP from pool
   │
   ├─> Step 4: ONU provisioning (FTTH)
   │   └─> VOLTHA: Activate ONU
   │
   ├─> Step 5: CPE configuration (if TR-069)
   │   └─> GenieACS: Set WiFi SSID/password
   │
   ├─> Step 6: Router provisioning
   │   └─> MikroTik: Add PPPoE secret
   │
   ├─> Step 7: Billing activation
   │   └─> Create subscription, start charging
   │
   └─> Step 8: Notifications
       ├─> Email: Welcome + credentials
       └─> SMS: Installation confirmation
   │
   ▼
4. Return activation status
```

### Fault Detection & Resolution Flow

```
1. Device sends SNMP trap (alarm)
   │
   ▼
2. Device Protocols Module
   └─> Trap receiver processes alarm
   │
   ▼
3. Fault Management Module
   ├─> Correlate with other alarms
   ├─> Determine severity
   └─> Create incident ticket
   │
   ▼
4. Ticketing Module
   ├─> Assign to NOC engineer
   └─> Trigger notifications
       ├─> Slack alert
       └─> SMS to on-call
   │
   ▼
5. NOC Dashboard
   └─> Shows incident in real-time
   │
   ▼
6. Engineer investigates
   └─> Uses device protocols to SSH into device
   │
   ▼
7. Resolution
   ├─> Execute fix (manual or Ansible playbook)
   └─> Close ticket
   │
   ▼
8. Analytics Module
   └─> Records MTTR, downtime
```

---

## Security Architecture

### Multi-Tenant Isolation

**Database Level:**
- All tables have `tenant_id` column
- Row-Level Security (RLS) policies enforce isolation
- Foreign keys reference tenant-scoped records

**Application Level:**
```python
# Every request extracts tenant from JWT
@router.get("/api/v1/subscribers")
async def get_subscribers(tenant: Tenant = Depends(get_current_tenant)):
    # Query automatically filtered by tenant_id
    subscribers = await subscriber_service.get_all(tenant_id=tenant.id)
    return subscribers
```

**VPN Isolation:**
- Each tenant gets dedicated VPN IP range (e.g., 10.200.0.0/24, 10.201.0.0/24)
- WireGuard enforces allowed IPs per peer
- Cannot cross-communicate between tenants

### Authentication & Authorization

**Authentication:**
- JWT tokens (RS256 algorithm)
- Refresh token rotation
- MFA support (TOTP, SMS)
- API keys for service-to-service

**Authorization (RBAC):**
```python
# Role hierarchy
- platform_admin (super admin, all tenants)
- tenant_admin (full access to own tenant)
- noc_engineer (network operations)
- support_agent (read-only, create tickets)
- field_tech (mobile app access)
- subscriber (self-service portal)

# Permission checks
@require_permission("subscribers:write")
async def create_subscriber(...):
    ...
```

### Secrets Management

All sensitive credentials stored in HashiCorp Vault:
- Database passwords
- API keys (Stripe, Twilio, etc.)
- RADIUS shared secrets
- Device SSH/SNMP credentials
- Encryption keys
- JWT signing keys

### Network Security

**OLT Connectivity:**
- VPN required (WireGuard)
- No direct internet exposure
- Certificate-based authentication

**API Security:**
- Rate limiting (per tenant)
- DDoS protection (Cloudflare)
- API key rotation
- IP whitelisting (optional)

### Data Encryption

**At Rest:**
- PostgreSQL: Transparent Data Encryption (TDE)
- MinIO: Server-Side Encryption (SSE)
- Backups: AES-256 encryption

**In Transit:**
- HTTPS/TLS 1.3 for all web traffic
- WireGuard for VPN
- PostgreSQL SSL connections

### Compliance

**Data Retention:**
- RADIUS accounting: 2 years (configurable)
- Audit logs: 7 years
- Customer data: Per GDPR/local regulations

**PII Protection:**
- Encryption of sensitive fields
- Data anonymization for analytics
- GDPR right-to-delete support

---

## Scalability & Performance

### Horizontal Scaling

**Stateless Services:**
- FastAPI workers (scale to N instances)
- Celery workers (scale per queue)
- Frontend (CDN + edge caching)

**Load Balancing:**
```
                    ┌──────────────┐
                    │  Nginx LB    │
                    └──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌──────────┐      ┌──────────┐      ┌──────────┐
  │ FastAPI  │      │ FastAPI  │      │ FastAPI  │
  │ Worker 1 │      │ Worker 2 │      │ Worker N │
  └──────────┘      └──────────┘      └──────────┘
```

### Database Scaling

**Read Replicas:**
- PostgreSQL streaming replication
- Read-heavy queries → replicas
- Write queries → primary

**Connection Pooling:**
- PgBouncer for connection pooling
- Max 100 connections per worker

**Partitioning:**
```sql
-- Partition radacct by month
CREATE TABLE radacct_2025_01 PARTITION OF radacct
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### Caching Strategy

**Redis Caching:**
- Subscriber profile: 15 min TTL
- Bandwidth profiles: 1 hour TTL
- Device status: 5 min TTL
- API rate limits: sliding window

**CDN:**
- Static assets (JS, CSS, images)
- Geographic distribution

### Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| API Response Time (p95) | < 200ms | Prometheus |
| RADIUS Auth Response | < 100ms | FreeRADIUS stats |
| Service Activation Time | < 5 min | Workflow logs |
| Dashboard Load Time | < 2s | Frontend metrics |
| Database Query Time (p95) | < 50ms | pg_stat_statements |
| Throughput | 10,000 req/sec | Load testing |

### Monitoring & Alerts

**Metrics:**
- Prometheus scrapes metrics every 15s
- Grafana dashboards
- Alert rules in Alertmanager

**Key Alerts:**
- API error rate > 1%
- Database connection pool > 80%
- Celery queue depth > 1000
- Disk usage > 85%
- RADIUS auth failures > 5%

---

## Disaster Recovery

### Backup Strategy

**PostgreSQL:**
- Daily full backups (pgBackRest)
- Continuous WAL archiving
- Retention: 30 days
- Offsite storage (S3)

**MinIO (Object Storage):**
- Cross-region replication
- Versioning enabled
- Retention: 90 days

**Redis:**
- RDB snapshots every 6 hours
- AOF append-only file

**NetBox:**
- Database backup daily
- Configuration export

### Recovery Time Objectives

| System | RTO | RPO | Priority |
|--------|-----|-----|----------|
| API Services | 15 min | 5 min | Critical |
| Database | 30 min | 15 min | Critical |
| FreeRADIUS | 15 min | 1 hour | Critical |
| Monitoring | 1 hour | 1 hour | High |
| Reporting | 4 hours | 24 hours | Medium |

### Disaster Scenarios

**1. Database Failure:**
- Promote read replica to primary
- Update connection strings
- Verify data integrity

**2. API Service Outage:**
- Auto-restart via Kubernetes
- Roll back if caused by deployment
- Scale up additional workers

**3. FreeRADIUS Failure:**
- Secondary RADIUS server takes over (failover)
- Routers automatically try secondary
- Restore primary, resync accounting data

**4. Complete Data Center Loss:**
- Failover to secondary region
- Restore from S3 backups
- DNS update to new region

### High Availability

**Active-Active:**
- Multiple API workers
- Redis Sentinel (HA)
- PostgreSQL streaming replication

**Active-Passive:**
- FreeRADIUS (active + standby)
- NetBox (primary + backup)

---

## Next Steps

1. **Review & Approval**: Stakeholder sign-off on architecture
2. **Team Formation**: Assign teams to modules (see [TEAM_ASSIGNMENTS.md](TEAM_ASSIGNMENTS.md))
3. **Infrastructure Setup**: Deploy baseline infrastructure (see [INFRASTRUCTURE_SETUP.md](INFRASTRUCTURE_SETUP.md))
4. **Sprint Planning**: Break down into 2-week sprints (see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md))
5. **API Design**: Define API contracts (see [API_SPECIFICATIONS.md](API_SPECIFICATIONS.md))
6. **Database Schema**: Design schemas and migrations (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md))

---

## Document References

- [Team Assignments](TEAM_ASSIGNMENTS.md) - Team structure and responsibilities
- [Infrastructure Setup Guide](INFRASTRUCTURE_SETUP.md) - DevOps setup instructions
- [Implementation Plan](IMPLEMENTATION_PLAN.md) - Detailed timeline and milestones
- [API Specifications](API_SPECIFICATIONS.md) - Complete API documentation
- [Database Schema](DATABASE_SCHEMA.md) - Database design and ERD
- [Frontend Architecture](FRONTEND_ARCHITECTURE.md) - Frontend design patterns
- [Testing Strategy](TESTING_STRATEGY.md) - QA and testing approach
- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Production deployment procedures

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-14 | Architecture Team | Initial architecture document |

