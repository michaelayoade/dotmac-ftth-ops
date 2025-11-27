# Platform Admin App Scope

The platform admin app is the control plane for running the SaaS itself. It is **not** the ISP operations console.

## In scope

- Tenant and partner onboarding, licensing, quotas, entitlements, and lifecycle.
- Platform governance: audit, compliance, cross-tenant search, system health.
- Platform-facing configuration: feature flags, plugins/marketplace, integrations, OSS backplane (e.g., NetBox), security/identity (users, roles, permissions, API keys, tokens, secrets).
- Tenant/partner self-service portals and reseller journeys.
- Platform-facing ticketing/CRM only when tied to tenant/partner incidents or prospecting (no end-subscriber/device workflows).

## Out of scope

- ISP network/device/subscriber operations (PON/FTTH, RADIUS, wireless, infrastructure DCIM/IPAM, diagnostics).
- ISP billing/revenue operations (AR/AP, dunning, reconciliation, subscriber plans/payments) beyond licensing/subscription state needed for entitlements.
- Subscriber/device diagnostics and raw data plumbing used by ISP ops.
- ISP sales order entry and partner revenue ops unless explicitly tied to platform reseller contracts.

Routes that match the out-of-scope areas are blocked in `middleware.ts` to keep platform access bounded. Update this doc and middleware together when scope changes.\*\*\*
