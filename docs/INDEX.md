# Documentation Index

**Last Updated:** October 19, 2025

This repository now ships a lean documentation set. Everything you are likely to reference lives in one of the sections below.

---

## Core References

- [README.md](../README.md) — project overview and high-level architecture.
- [README_ISP_PLATFORM.md](README_ISP_PLATFORM.md) — ISP-specific workflows and terminology.
- [quick_start.md](quick_start.md) — fastest path to running the stack locally.
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) — configuration knobs with defaults.
- [DEVELOPMENT_DATABASE.md](DEVELOPMENT_DATABASE.md) — local database setup, migrations, and troubleshooting.
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — canonical entity model and relationships.

---

## Feature Guides & Runbooks

- [NETWORK_DIAGNOSTICS_IMPLEMENTATION.md](NETWORK_DIAGNOSTICS_IMPLEMENTATION.md) — RADIUS session control, ping, and traceroute tooling.
- [DYNAMIC_ALERTING_SETUP.md](DYNAMIC_ALERTING_SETUP.md) — alert routing, Prometheus/Alertmanager configuration, and CLI helpers.
- [FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md](FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md) — data model, migrations, and APIs for fiber plant management.
- [SUBSCRIBER_BULK_OPERATIONS_IMPLEMENTATION.md](SUBSCRIBER_BULK_OPERATIONS_IMPLEMENTATION.md) — bulk suspend/activate/delete flows in the subscriber UI.
- [FRONTEND_BACKEND_ALIGNMENT_FIX.md](FRONTEND_BACKEND_ALIGNMENT_FIX.md) — current API contract for RADIUS disconnect actions.
- [WEBSOCKET_JOB_CAMPAIGN_CONTROLS.md](WEBSOCKET_JOB_CAMPAIGN_CONTROLS.md) — controlling long-running jobs over WebSockets.
- [WIREGUARD_FRONTEND_IMPLEMENTATION.md](WIREGUARD_FRONTEND_IMPLEMENTATION.md) & [WIREGUARD_VPN_IMPLEMENTATION_BLUEPRINT.md](WIREGUARD_VPN_IMPLEMENTATION_BLUEPRINT.md) — provisioning and UI notes for WireGuard.
- [TENANT_ONBOARDING_IMPLEMENTATION.md](TENANT_ONBOARDING_IMPLEMENTATION.md) — tenant enrollment, RBAC, and setup flows.
- [VAULT_SECRETS_MIGRATION.md](VAULT_SECRETS_MIGRATION.md) — secret management rollout plan.
- [ALARM_ARCHIVAL.md](ALARM_ARCHIVAL.md) & [ALARM_NOTIFICATION_TESTS.md](ALARM_NOTIFICATION_TESTS.md) — alarm retention and alert-testing guidance.

---

## API & Integration Resources

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — REST surface area summary.
- [API_SPECIFICATIONS.md](API_SPECIFICATIONS.md) — protocol-level expectations by service.
- [API_EXAMPLES.md](API_EXAMPLES.md) — request/response samples for common flows.
- [EMAIL_TEMPLATES_SETUP.md](EMAIL_TEMPLATES_SETUP.md) — transactional email configuration.
- [CODE_IMPROVEMENTS_2025_01_15.md](CODE_IMPROVEMENTS_2025_01_15.md) — code-quality improvements and follow-up checklist.

---

## Operations & Troubleshooting

- [EXCEPTION_HANDLING_GUIDE.md](EXCEPTION_HANDLING_GUIDE.md) — structured logging patterns and FastAPI error handling.
- [TROUBLESHOOTING_PLAYBOOKS.md](TROUBLESHOOTING_PLAYBOOKS.md) — production incident runbooks.
- SQL migration files:  
  - [DEPLOYMENT_MIGRATION.sql](DEPLOYMENT_MIGRATION.sql)  
  - [SALES_MIGRATION.sql](SALES_MIGRATION.sql)

---

## Architecture Documentation

- [PORTAL_ARCHITECTURE.md](architecture/PORTAL_ARCHITECTURE.md) — comprehensive portal architecture with 6 portals, authentication flows, user journeys, and deployment modes.
- [FRONTEND_SITEMAP.md](architecture/FRONTEND_SITEMAP.md) — complete route hierarchy and navigation structure for all portals.

---

## Directories of Note

- `architecture/` — system diagrams, domain models, DDD notes, and portal architecture.
- `api/` — per-service API references.
- `guides/` — developer setup, testing, and deployment guides.
- `plugins/` — plugin contract documentation.
- `sessions/` — detailed historical dev session logs (still available for audit).
- `webhooks/` — webhook payloads, retry logic, and onboarding.
