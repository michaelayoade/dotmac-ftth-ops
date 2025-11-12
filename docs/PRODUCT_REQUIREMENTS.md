# DotMac FTTH Operations Platform — Product Requirements Document

**Date:** 2025-11-04  
**Status:** Platform features implemented; quality hardening in progress (Phase 5)  
**Audience:** Product, engineering, network operations, go-to-market teams

---

## 1. Vision & Context

### Product Vision
Deliver a per-tenant, carrier-grade ISP operations framework that unifies Business Support Systems (BSS) and Operations Support Systems (OSS) for fiber and wireless providers. DotMac must stamp out isolated ISP stacks (whether DotMac-hosted or customer-hosted) in hours, empower ISP ops teams to run subscriber lifecycle end-to-end, give partners a monetizable channel, and keep observability/security built in.

### Problems We Solve
- Fragmented tooling for billing, network inventory, provisioning, and support.
- Slow customer activation because AAA, IPAM/DCIM, ACS, and billing stacks are not unified.
- Limited visibility into FTTH and wireless assets, resulting in SLA breaches.
- Manual partner management and inconsistent customer self-service experiences.
- Hard-to-scale deployments for multi-tenant SaaS providers supporting many ISPs.

### Guiding Principles
1. **Per-tenant isolation as the default** — every ISP gets its own runtime (API, DB schema/instance, Redis, RADIUS, ingress) even when DotMac hosts it.
2. **Service lifecycle automation** — AWX/Terraform/Helm jobs orchestrate provisioning-to-monitoring workflows with repeatable jobs.
3. **Open integrations** — rely on standards (REST, GraphQL, TR-069, RADIUS, SNMP, OpenTelemetry) so ISPs can extend.
4. **Operational observability** — health metrics, alerting, and tracing flow into a shared control plane with per-tenant labels.
5. **Portal clarity & framework mindset** — targeted experiences across six portals while exposing hooks for ISP-specific payment gateways, OSS/BSS add-ons, and branding.

---

## 2. Objectives & Success Metrics

| Goal | Success Metric | Current State |
|------|----------------|---------------|
| Fast ISP onboarding | Provision tenant stack < 2 hours | ✅ Automated tenant onboarding scripts + AWX playbooks |
| Subscriber activation speed | End-to-end activation < 5 minutes | ✅ Saga workflow triggers AAA, IPAM/DCIM, ACS |
| Network reliability | Platform uptime ≥ 99.9%, RADIUS auth p95 < 100 ms | ✅ Observability stack + SNMP telemetry + metrics backend |
| Revenue accuracy | 0 invoice reconciliation gaps per billing cycle | ✅ Automated invoice generation, dunning, credit notes |
| Partner/channel growth | Support reseller + referral programs from day one | ✅ Partner portals live with commission tracking |
| Compliance & security | MFA + RBAC for 100% admin actions, audit retention 7 years | ✅ Security layer implemented |

---

## 3. Personas & Portal Coverage

| Persona | Portal(s) | Primary Needs | Key Capabilities |
|---------|-----------|---------------|------------------|
| DotMac Platform Admin | `/dashboard/platform-admin/*` | Manage tenants, monitor cross-tenant health | Tenant CRUD, audit search, system config, analytics |
| ISP Operations Lead | `/dashboard/*` | Run daily ops, provisioning, support | Subscriber CRM, tickets, diagnostics, automation, network |
| ISP Finance/Billing | `/dashboard/billing-*`, `/tenant/billing/*` | Monetize services, manage payments | Plan catalog, invoices, payments, dunning, revenue analytics |
| Network Engineer / Field Tech | `/dashboard/infrastructure`, `/dashboard/network`, `/dashboard/pon`, `/dashboard/radius` | Provision FTTH/wireless assets, monitor health | IPAM/DCIM workspace, OLT controller + ACS flows, VPN overlay, monitoring dashboards |
| Tenant Administrator | `/tenant/*` | Manage DotMac subscription, staff, integrations | Plan upgrades, credit notes, user management, API keys, webhook config |
| End Subscriber | `/customer-portal/*` | Self-service billing/support | Pay bills, view usage, submit tickets, check service status |
| Referral Partner | `/portal/*` | Track referrals and commissions | Referral submissions, earnings dashboards, payout history |
| Reseller / MSP | `/partner/*`, `/dashboard` (with MSP roles) | Manage multiple ISP tenants, white-label | Tenant list, wholesale billing, enablement resources |

---

## 4. Feature Inventory (Delivered Scope)

### 4.1 Multi-Tenant Core
- **Tenant isolation** via PostgreSQL RLS, tenant-scoped services, and secret segmentation.
- **Licensing engine** calculates subscriber-based tiers, suspends tenants when overage > grace thresholds.
- **Tenant onboarding** workflows (scripted + UI) handle provisioning, RBAC seeds, and observability endpoints.
- **Per-tenant VPN overlay** tunnels secure device-to-cloud traffic.

### 4.2 Business Support System (BSS) Features

| Module | Capabilities | Notes |
|--------|-------------|-------|
| Billing & Revenue | Subscription catalog, usage-based billing/quotas, invoices, credit notes, multi-currency/tax, dunning/collections, revenue analytics | 95% complete |
| CRM | Customer lifecycle mgmt, contacts, partner attribution, tickets, lifecycle automations | Integrated with subscriber activation flows |
| Catalog & Pricing | Plan templates (FTTH, wireless, enterprise), add-ons, discounts, bundle builder | Backed by service catalog APIs |
| Payments | Payment methods vaulting, webhook retries, ledger reconciliation | Works with tenant portal for self-serve updates |
| Communications | Email templates (transactions + alerts), SMS via messaging gateway, webhook dispatchers, notification policies | Event bus triggers |
| Partner Management | Referral + reseller programs, commission models (revenue share, flat, tiered, hybrid), partner health dashboards | Surfaces in partner portals |
| Analytics | Business KPIs, churn metrics, ARPU, subscriber growth, usage heatmaps | Backed by TimescaleDB/Prometheus |

### 4.3 Operations Support System (OSS) Features

- **AAA / RADIUS service**
  - Multi-tenant RADIUS realms, bandwidth profiles, accounting.
  - Session tracking, usage, NAS inventory, policy enforcement.
- **Network Inventory (IPAM/DCIM platform)**
  - IPAM pools, rack/device inventory, cable management, cross-connect tracking.
  - Automated IP allocation during provisioning.
- **FTTH Management**
  - OLT controller for OLT/ONU control.
  - TR-069 ACS for CPE config, OTDR test ingestion, splitter/cable modeling, fiber health metrics.
  - Fiber infrastructure data models + REST/GraphQL endpoints (`FiberCable`, `SplicePoint`, `DistributionPoint`, `ServiceArea`, `FiberHealthMetric`, `OTDRTestResult`).
- **Wireless Operations**
  - Tower/sector/radio inventory, coverage zone maps, link quality monitoring, frequency/protocol controls.
- **Device & Service Lifecycle Automation**
  - Saga-based orchestration for provisioning, suspension, deprovision.
  - Job scheduler with chains, automation controller hooks, webhook callbacks.
- **Connectivity & Security**
  - Per-tenant VPN overlay provisioning, health monitoring, tunnel secrets in Vault/OpenBao.
- **Monitoring & Observability**
  - SNMP monitoring stack, metrics backend, dashboard toolkit, tracing, and alert routing.
  - Diagnostics toolkit (ping, traceroute, bandwidth tests) within ISP dashboard.

### 4.4 Portals & Frontend
- 313 statically generated pages across ISP Ops (138) and Platform Admin (175) apps, plus tenant, customer, partner portals.
- Shared component system (Tailwind + shadcn) with RBAC hooks, TanStack Query data layer, multi-app Next.js workspace.
- Portal architecture with six route trees as documented in `docs/architecture/PORTAL_ARCHITECTURE.md`.

### 4.5 Security & Compliance
- JWT auth (RS256/HS256), MFA (TOTP/SMS/Email), RBAC, audit logging (7-year retention).
- Secrets stored in Vault/OpenBao; encryption at rest/in transit, VPN overlay for device links.
- API key management, GDPR readiness (data retention + right-to-delete flows).

### 4.6 Deployment & Tooling
- Docker Compose stacks (`start-platform`, `start-isp`), Dockerfile variants (prod, AAA service, app updates).
- Multi-arch builds, config templating, pre-flight checks, remote deployment guide.
- Externalized infra dependencies (PostgreSQL, Redis, MinIO, Vault, MongoDB, TimescaleDB).
- Makefile + scripts for developer experience, integration/e2e test harnesses.

---

## 5. User Journeys & Stories (Delivered)

### Journey A — Platform Admin Onboards a New ISP Tenant
1. Admin authenticates in Platform Admin portal.
2. Creates tenant record, assigns subscription tier/licensing limits.
3. Provisioning workflow triggers: tenant secrets in Vault, VPN overlay, IPAM/DCIM namespace, RADIUS realm.
4. Admin invites ISP staff; RBAC mappings applied.
5. Health panel confirms backend/frontends + observability endpoints reachable.
**Outcome:** ISP can log into tenant portal within 2 hours without manual infra work.

### Journey B — ISP Activates a Subscriber Service
1. CSR locates lead in CRM and converts to subscriber.
2. Activation wizard assigns service plan, triggers IP allocation in IPAM/DCIM and RADIUS credential creation.
3. OLT controller + ACS provisioning handles ONU + CPE config; VPN keys issued if required.
4. Billing service emits invoice, communications engine sends welcome email/SMS.
5. Monitoring stack ingests telemetry; alerts routed if KPIs degrade.
**Stories Covered:** As an ISP operator, I can activate fiber or wireless subscribers in <5 minutes; as finance, I can ensure billing starts with the activation event.

### Journey C — Fiber Build-Out & Maintenance
1. Network engineer defines service areas, distribution points, and fiber cables via `/dashboard/pon` + APIs.
2. Field data (splice points, OTDR tests, power levels) ingested into fiber service.
3. Dashboard renders fiber map with health metrics; degraded segments auto-create tickets.
4. Engineer schedules automation controller job for zero-touch provisioning or remediation.
**Stories Covered:** As a fiber planner, I can model plant assets; as a support engineer, I can pinpoint degraded runs and dispatch crews.

### Journey D — Wireless Network Operations
1. Wireless lead maintains tower/sector inventory and RF parameters.
2. CPE provisioning binds subscriber packages to radios; coverage map updates with heat overlays.
3. Signal quality monitors trigger alerts; diagnostics tools validate latency.
**Stories Covered:** As a wireless operator, I can ensure coverage SLAs and adjust sectors proactively.

### Journey E — Billing Cycle & Revenue Assurance
1. Billing manager reviews revenue dashboard, upcoming invoices, and delinquent accounts.
2. Dunning workflows (email/SMS) trigger automatically for overdue balances.
3. Tenant portal exposes subscription usage; ISP admins adjust plans/add-ons with proration preview.
4. Reconciled payments sync to accounting exports; credit notes available for SLA breaches.
**Stories Covered:** As finance, I can close billing cycles without manual spreadsheets; as tenant admin, I can self-manage my platform subscription.

### Journey F — Incident Response & Diagnostics
1. Alertmanager detects RADIUS latency spike; routed to on-call.
2. Ops staff uses `/dashboard/infrastructure` to inspect Prometheus metrics and Jaeger traces.
3. Diagnostics panel runs remote ping/bandwidth test; AWX script rolls back config if needed.
4. Incident timeline captured in audit log; customer communications issued via templates.
**Stories Covered:** As NOC staff, I can triage and resolve incidents quickly with observability + automation integrated.

### Journey G — Customer Self-Service
1. Subscriber logs into `/customer-portal`, views usage + balance.
2. Pays invoice via saved payment method; receipt emailed automatically.
3. Opens support ticket with attachment; CRM auto-links to subscriber record.
**Stories Covered:** As an end customer, I can self-serve billing/support without calling; as ISP ops, I receive structured tickets tied to service data.

### Journey H — Partner Referral & Reseller Management
1. Referral partner logs into `/portal`, submits new leads, tracks conversions, views commission payouts.
2. MSP reseller uses `/partner` to manage multiple tenant accounts, track wholesale billing, download enablement resources.
**Stories Covered:** As a partner, I can see earnings and pipeline; as DotMac, I can grow channels with visibility.

---

## 6. Functional Requirements by Portal

| Portal | Must-Have Views | Critical Interactions | Status |
|--------|-----------------|-----------------------|--------|
| ISP Dashboard | Operations/customers, billing-revenue, infrastructure, analytics, automation, security-access, partners | Create/edit subscribers, launch diagnostics, run automation jobs, manage device inventory, trigger billing events | ✅ Implemented |
| Platform Admin | Tenants, search, audit, system, metrics | Tenant lifecycle, cross-tenant search, audit export, global config, feature flags | ✅ Implemented |
| Tenant Portal | Billing (subscription/add-ons/payment methods/credit-notes/usage), users, integrations, support | Upgrade/downgrade plan, manage payment instruments, configure webhooks/API keys, view usage quotas | ✅ Implemented |
| Customer Portal | Dashboard, service, billing, usage, support, settings | Pay bills, monitor usage, submit tickets, change contact info | ✅ Implemented |
| Referral Portal | Dashboard, referrals, commissions, customers, performance, settings | Submit leads, view statuses, track earnings, download assets | ✅ Implemented |
| Reseller Portal | Overview, tenants, billing, resources, support | Manage MSP tenant roster, initiate tenant support tickets, download enablement kits | ✅ Implemented |

---

## 7. Non-Functional Requirements

- **Performance:** API p95 < 200 ms, RADIUS auth < 100 ms, activation < 5 min, target 10k concurrent subscribers.
- **Availability:** 99.9% uptime, multi-zone deployment guidance, health checks wired into infra script.
- **Scalability:** Horizontal scaling of FastAPI workers, Celery task queues, Redis clusters, multi-arch container builds.
- **Security:** MFA support, RBAC enforcement, audit logging with retention, encryption at rest/in transit, Vault secrets, per-tenant VPN tunnels.
- **Compliance:** GDPR-ready data retention tooling, right-to-delete workflows, PII masking in logs.
- **Observability:** OpenTelemetry tracing, metrics backend, dashboard tooling, SNMP polling, alert routing.
- **Quality:** 92.24% coverage on critical services, integration + e2e harnesses, lint/type zero warnings, documented troubleshooting playbooks.

---

## 8. Integrations & Dependencies

| Integration | Purpose |
|-------------|---------|
| PostgreSQL | Core transactional store with RLS |
| Redis | Cache + session store + Celery broker |
| MinIO / Object Storage | File assets, OTDR uploads |
| Vault/OpenBao | Secrets + certificate storage |
| MongoDB (ACS stack) | TR-069 state |
| TimescaleDB | Time-series metrics |
| RADIUS AAA service | Authentication & accounting |
| IPAM/DCIM platform | Network inventory |
| TR-069 ACS | CPE management |
| OLT controller | OLT abstraction |
| VPN gateway | Encrypted network connectivity |
| SNMP monitoring stack | Network telemetry |
| Prometheus / Grafana / Jaeger | Observability stack |
| SMS / Email provider | Notifications |

---

## 9. Testing & Acceptance

- **Service coverage:** Orchestration 95.56%, Workflows 87.94%, RADIUS 86.45%, Analytics 100%, Audit 91.23%.
- **Test suites:** Unit, integration, customer-management PostgreSQL tests, Playwright e2e, smoke tests for portals.
- **Acceptance Checklist:**
  1. Tenant onboarding script completes with clean health check.
  2. Subscriber activation runbook passes (RADIUS + IPAM/DCIM + ACS + billing + monitoring).
  3. Billing cycle closes with zero manual adjustments.
  4. Portal RBAC verified for each persona (permission guard + route guard).
  5. Observability alerts verified via DYNAMIC_ALERTING_SETUP.

---

## 10. Risks & Follow-Ups

- **Ongoing Phase 5 Work:** Financial services regression tests, security layer tests (RBAC, MFA), platform configuration test suite, E2E workflow coverage, performance benchmarking.
- **Backlog Items:** Mobile apps, enhanced customer self-service portal, Geo indexes/PostGIS for fiber routing, expanded automation playbooks, additional tenant analytics.
- **Mitigations:** Track in Phase 5 program board, keep automated regression pipeline (CI multi-arch builds + Trivy scans), maintain documentation index to avoid drift.

---

**This PRD captures the product we have delivered to date, the personas it serves, and the journeys that are already live in the DotMac FTTH Operations Platform.**
