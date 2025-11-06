# Documentation Index

**Last Updated:** October 31, 2025

This repository now ships a lean documentation set. Everything you are likely to reference lives in one of the sections below.

---

## Core References

- [README.md](../README.md) — project overview and high-level architecture.
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md) — end-to-end environment setup (dev/staging/prod).
- [../QUICK_START.md](../QUICK_START.md) — infrastructure quick start (scripted workflow).
- [quick_start.md](quick_start.md) — platform module entry points (auth, secrets, observability).
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) — configuration knobs with defaults.
- [DEVELOPMENT_DATABASE.md](DEVELOPMENT_DATABASE.md) — local database setup, migrations, and troubleshooting.
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — canonical entity model and relationships.
- [../frontend/QUICK_START.md](../frontend/QUICK_START.md) — frontend workspace layout, dev scripts, and tooling.

---

## Feature Guides & Runbooks

- [DYNAMIC_ALERTING_SETUP.md](DYNAMIC_ALERTING_SETUP.md) — alert routing, Prometheus/Alertmanager configuration, and CLI helpers.
- [FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md](FIBER_INFRASTRUCTURE_IMPLEMENTATION_OVERVIEW.md) — data model, migrations, and APIs for fiber plant management.
- [WEBSOCKET_JOB_CAMPAIGN_CONTROLS.md](WEBSOCKET_JOB_CAMPAIGN_CONTROLS.md) — controlling long-running jobs over WebSockets.
- [WIREGUARD_VPN_IMPLEMENTATION_BLUEPRINT.md](WIREGUARD_VPN_IMPLEMENTATION_BLUEPRINT.md) — provisioning model and backend workflows for WireGuard.
- [TENANT_ONBOARDING_IMPLEMENTATION.md](TENANT_ONBOARDING_IMPLEMENTATION.md) — tenant enrollment, RBAC, and setup flows.
- [VAULT_SECRETS_MIGRATION.md](VAULT_SECRETS_MIGRATION.md) — secret management rollout plan.
- [ALARM_ARCHIVAL.md](ALARM_ARCHIVAL.md) & [ALARM_NOTIFICATION_TESTS.md](ALARM_NOTIFICATION_TESTS.md) — alarm retention and alert-testing guidance.

---

## Frontend GraphQL & UI Infrastructure

> Start here when migrating pages to the new TanStack Query + mutation helpers stack.

- [GRAPHQL_MIGRATION_HELPERS.md](../frontend/docs/GRAPHQL_MIGRATION_HELPERS.md) — overview of query helpers, when to use each pattern, and end-to-end workflow.
- [NORMALIZATION_HELPERS_REFERENCE.md](../frontend/docs/NORMALIZATION_HELPERS_REFERENCE.md) — recipes for normalizing custom hooks (dashboard/list/detail) into `QueryBoundary`.
- [MUTATION_HELPERS_REFERENCE.md](../frontend/docs/MUTATION_HELPERS_REFERENCE.md) — mutation utilities: `useMutationWithToast`, optimistic updates, invalidation helpers, and form integration.
- [SKELETON_COMPONENTS.md](../frontend/docs/SKELETON_COMPONENTS.md) — reusable loading components (table, card grid, dashboard) used across refactors.
- Migration examples:
  - [MIGRATION_EXAMPLE_CUSTOMERS.md](../frontend/docs/MIGRATION_EXAMPLE_CUSTOMERS.md) — customer dashboard refactor (query helpers + normalization).
- [MIGRATION_EXAMPLE_CUSTOMER_EDIT.md](../frontend/docs/MIGRATION_EXAMPLE_CUSTOMER_EDIT.md) — customer edit modal refactor (mutation helpers + forms).
- [GRAPHQL_MIGRATION_ROADMAP.md](../frontend/docs/GRAPHQL_MIGRATION_ROADMAP.md) — project-level migration tracker and prioritised backlog.

---

## API & Integration Resources

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — REST surface area summary.
- [API_SPECIFICATIONS.md](API_SPECIFICATIONS.md) — protocol-level expectations by service.
- [API_EXAMPLES.md](API_EXAMPLES.md) — request/response samples for common flows.
- [EMAIL_TEMPLATES_SETUP.md](EMAIL_TEMPLATES_SETUP.md) — transactional email configuration.

---

## Operations & Troubleshooting

- [EXCEPTION_HANDLING_GUIDE.md](EXCEPTION_HANDLING_GUIDE.md) — structured logging patterns and FastAPI error handling.
- [TROUBLESHOOTING_PLAYBOOKS.md](TROUBLESHOOTING_PLAYBOOKS.md) — production incident runbooks.
- [REALTIME_STREAMS.md](REALTIME_STREAMS.md) — SSE endpoints, curl examples, and troubleshooting tips.
- SQL migration files:  
  - [DEPLOYMENT_MIGRATION.sql](DEPLOYMENT_MIGRATION.sql)  
  - [SALES_MIGRATION.sql](SALES_MIGRATION.sql)
- [../E2E-TESTS-QUICK-START.md](../E2E-TESTS-QUICK-START.md) — Playwright end-to-end testing workflow.
- [REMOTE_SERVER_DEPLOYMENT_GUIDE.md](../REMOTE_SERVER_DEPLOYMENT_GUIDE.md) — complete server provisioning and Docker deployment checklist for production hosts.

---

## Architecture Documentation

- [PORTAL_ARCHITECTURE.md](architecture/PORTAL_ARCHITECTURE.md) — comprehensive portal architecture with 6 portals, authentication flows, user journeys, and deployment modes.
- [FRONTEND_SITEMAP.md](architecture/FRONTEND_SITEMAP.md) — complete route hierarchy and navigation structure for all portals.
- External: `frontend/ARCHITECTURE_OVERVIEW.md` & `frontend/MULTI_APP_ARCHITECTURE.md` — latest multi-app context and ownership.

---

## Directories of Note

- `architecture/` — system diagrams, domain models, DDD notes, and portal architecture.
- `api/` — per-service API references.
- `guides/` — developer setup, testing, and deployment guides.
- `plugins/` — plugin contract documentation.
- `webhooks/` — webhook payloads, retry logic, and onboarding.
