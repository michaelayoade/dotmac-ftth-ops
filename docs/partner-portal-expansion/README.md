# Partner Portal Expansion - Multi-Account Management

**Project Status**: Phase 1 Complete ✅
**Last Updated**: 2025-11-07

---

## Overview

This project extends the partner portal to support multi-account management, enabling MSPs and enterprise headquarters to manage multiple customer tenants from a single unified interface.

> **Current State:** Partner tooling lives inside the ISP Operations app (`/dashboard/partners/*` in `isp-ops-app`). Phase 1 keeps that in-app workspace and layers the data model/RBAC needed for multi-tenant control. Future phases may add a stand-alone partner login, but it will reuse these components.

**Business Value**:
- MSPs can manage 20-50 ISP tenant accounts without switching logins
- Enterprise HQs can oversee subsidiary ISPs with consolidated reporting
- Auditors get read-only access across multiple tenants for compliance

---

## Project Phases

### ✅ Phase 1 - Discovery & Design (Complete)
**Duration**: 1-2 weeks
**Status**: Complete (2025-11-07)

**Deliverables**:
1. [Data Model Design](./PHASE1_DATA_MODEL_DESIGN.md) - PartnerTenantLink schema
2. [RBAC Design](./PHASE1_RBAC_DESIGN.md) - Permission extensions
3. [API Contracts](./PHASE1_API_CONTRACTS.md) - REST endpoint specifications
4. [Summary Report](./PHASE1_SUMMARY.md) - Comprehensive overview

---

### 🔄 Phase 2 - Backend Foundations (Next)
**Duration**: 2-3 sprints (6-8 weeks)
**Status**: Pending Phase 1 approval

**Planned Work**:

**Sprint 1-2: Data Layer**
- Implement `PartnerTenantLink` model
- Create Alembic migration
- Add partner permissions to seeder
- Write unit tests for models

**Sprint 3-4: Auth Layer**
- Build `PartnerTenantContextMiddleware`
- Extend `PermissionChecker` for partner context
- Implement token enrichment logic
- Add audit logging extensions

**Sprint 5-6: API Layer**
- Consolidated billing endpoints (`GET /partner/billing/summary`, etc.)
- Multi-tenant support endpoints (`GET /partner/support/tickets`, etc.)
- Reporting endpoints (`GET /partner/reports/usage`, etc.)
- Integration tests

---

### 📅 Phase 3 - UI Enhancements (Future)
**Duration**: 2 sprints (4 weeks)
**Status**: Pending Phase 2 completion

**Planned Work**:
- Partner portal dashboard redesign
- Tenant selector component (header dropdown)
- Consolidated billing workspace
- Multi-tenant ticket board
- Usage/SLA charts (aggregated)

---

### 📅 Phase 4 - Alerts & Automation (Future)
**Duration**: 1 sprint (2 weeks)
**Status**: Pending Phase 3 completion

**Planned Work**:
- SLA breach alert integration
- Billing threshold notifications
- Webhook subscriptions for partner events
- Email digest for daily summaries

---

### 📅 Phase 5 - Documentation & Enablement (Future)
**Duration**: 1 sprint (2 weeks)
**Status**: Pending Phase 4 completion

**Planned Work**:
- Partner portal user documentation
- API documentation updates
- MSP/enterprise playbooks
- Training videos
- Migration guide for existing partners

---

## Quick Start

### For Reviewers

**Read these in order**:
1. Start with [PHASE1_SUMMARY.md](./PHASE1_SUMMARY.md) for executive overview
2. Review [PHASE1_DATA_MODEL_DESIGN.md](./PHASE1_DATA_MODEL_DESIGN.md) for database changes
3. Check [PHASE1_RBAC_DESIGN.md](./PHASE1_RBAC_DESIGN.md) for security model
4. Reference [PHASE1_API_CONTRACTS.md](./PHASE1_API_CONTRACTS.md) for endpoint specs

**Estimated Review Time**: 45-60 minutes

---

### For Implementers (Phase 2)

**Prerequisites**:
- Phase 1 design approved
- Sprint planning completed
- Development environment set up

**Implementation Order**:
1. Database migration (PartnerTenantLink table)
2. Model and service layer
3. Permission seeder updates
4. RBAC extensions (middleware, permission checker)
5. API endpoints (billing → support → reports)
6. Integration tests
7. Documentation updates

---

## Key Concepts

### Multi-Tenant Access Model

```
┌──────────────┐
│ Partner Org  │  (MSP operating as Tenant A)
│ (Tenant A)   │
└──────┬───────┘
       │
       │ PartnerTenantLink (access_role: MSP_FULL)
       │
       ▼
┌──────────────┐
│ Managed      │  (ISP being managed)
│ Tenant B     │
└──────────────┘
```

**Authentication Flow**:
1. Partner user logs in to Tenant A
2. Receives JWT token with `partner_id` and `managed_tenant_ids`
3. Sends request with `X-Active-Tenant-Id: B` header
4. Middleware validates partner has link to Tenant B
5. Request proceeds with Tenant B's data scope
6. Action logged to audit trail

---

### Permission Model

**Hierarchy**:
```
partner.*                           # All partner permissions
├── partner.tenants.*               # Tenant management
│   ├── partner.tenants.list
│   └── partner.tenants.switch_context
├── partner.billing.*               # Billing operations
│   ├── partner.billing.read
│   ├── partner.billing.invoices.read
│   └── partner.billing.invoices.export
├── partner.support.*               # Support operations
│   ├── partner.support.tickets.list
│   ├── partner.support.tickets.create
│   └── partner.support.tickets.update
└── partner.reports.*               # Reporting
    ├── partner.reports.usage.read
    └── partner.reports.sla.read
```

---

## Architecture Diagrams

### Data Model

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Partner   │◄────────│ PartnerTenantLink│────────►│   Tenant    │
│             │ 1     * │                  │ *     1 │             │
│ (MSP Org)   │         │ access_role      │         │ (ISP Org)   │
│ partner_id  │         │ custom_perms     │         │ tenant_id   │
└─────────────┘         │ sla_config       │         └─────────────┘
                        │ alert_config     │
                        └──────────────────┘

COEXISTS WITH:

┌─────────────┐         ┌──────────────────┐         ┌─────────────┐
│   Partner   │◄────────│  PartnerAccount  │────────►│  Customer   │
│             │ 1     * │                  │ *     1 │             │
│             │         │ engagement_type  │         │ (Subscriber)│
└─────────────┘         └──────────────────┘         └─────────────┘
```

---

### Request Flow

```
┌──────────┐      ┌─────────────┐      ┌──────────────┐      ┌──────────┐
│ Partner  │─────►│  Middleware │─────►│  Permission  │─────►│   API    │
│  User    │  1   │  (Context   │  2   │   Checker    │  3   │ Endpoint │
│          │      │   Switch)   │      │              │      │          │
└──────────┘      └─────────────┘      └──────────────┘      └──────────┘
                         │                     │                    │
                         │ Validate            │ Check              │ Fetch
                         │ Link Active         │ Permissions        │ Data
                         ▼                     ▼                    ▼
                  ┌─────────────┐      ┌──────────────┐    ┌──────────┐
                  │PartnerTenant│      │     RBAC     │    │ Tenant B │
                  │    Link     │      │   Service    │    │   Data   │
                  └─────────────┘      └──────────────┘    └──────────┘
```

---

## Security Considerations

### Access Control
- ✅ Partner can only access explicitly linked tenants
- ✅ Links can be time-bounded (start_date, end_date)
- ✅ Links can be immediately revoked (is_active = false)
- ✅ Custom permissions override default role permissions

### Audit Trail
- ✅ All cross-tenant actions logged
- ✅ Logs include partner ID, managed tenant ID, action, timestamp
- ✅ Searchable by partner, tenant, or action type

### Rate Limiting
- ✅ Cross-tenant requests have stricter limits
- ✅ Per-partner quotas prevent API abuse
- ✅ Per-tenant quotas prevent overwhelming managed tenant

---

## API Examples

### List Managed Tenants

```bash
curl -X GET "https://api.dotmac.io/api/v1/partner/customers" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json"
```

### Get Billing Summary

```bash
curl -X GET "https://api.dotmac.io/api/v1/partner/billing/summary?from_date=2025-10-01&status=overdue" \
  -H "Authorization: Bearer {jwt_token}"
```

### Create Ticket on Behalf of Tenant

```bash
curl -X POST "https://api.dotmac.io/api/v1/partner/support/tickets" \
  -H "Authorization: Bearer {jwt_token}" \
  -H "X-Active-Tenant-Id: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Service outage",
    "description": "Fiber cut at Mile 42",
    "priority": "urgent"
  }'
```

---

## Testing Strategy

### Unit Tests
- Model validation (PartnerTenantLink constraints)
- Permission checking logic
- Token enrichment
- Link expiry validation

### Integration Tests
- Full authentication flow
- Context switching
- API endpoint responses
- Error handling

### Security Tests
- Invalid context switch attempts
- Expired link handling
- Permission escalation prevention
- Audit log verification

---

## Rollout Plan

### Beta Phase (2-3 MSP Partners)
1. Manually create `PartnerTenantLink` for beta partners
2. Grant `partner_msp_full` role
3. Monitor usage patterns, errors, performance
4. Gather feedback from partner users

### General Availability
1. Build self-service link request UI
2. Add tenant approval workflow
3. Enable API for programmatic link creation
4. Public documentation and training materials

---

## Support Resources

### For Developers
- [Data Model Design](./PHASE1_DATA_MODEL_DESIGN.md) - Schema reference
- [RBAC Design](./PHASE1_RBAC_DESIGN.md) - Permission system
- [API Contracts](./PHASE1_API_CONTRACTS.md) - Endpoint specs

### For Partners
- (Phase 5) Partner portal user guide
- (Phase 5) API documentation
- (Phase 5) MSP playbooks

### For Operations
- (Phase 4) Monitoring dashboard setup
- (Phase 4) Alert configuration
- (Phase 5) Troubleshooting guide

---

## Frequently Asked Questions

**Q: What's the difference between PartnerAccount and PartnerTenantLink?**
A: `PartnerAccount` links partners to individual *subscribers* (Customers). `PartnerTenantLink` links partners to entire *ISP organizations* (Tenants). Different use cases.

**Q: Can a partner manage both tenants and customers?**
A: Yes! A partner can have `PartnerTenantLink` relationships (manage ISP tenants) AND `PartnerAccount` relationships (manage individual subscribers within their own tenant).

**Q: How does billing work for partner actions?**
A: (To be determined in Phase 1 review) - Likely partner is billed for API usage, but managed tenant is billed for provisioned services.

**Q: Can a tenant have multiple partners managing them?**
A: Yes! Multiple partners can have links to the same tenant with different roles (e.g., one MSP for billing, another for support).

**Q: How to revoke partner access immediately?**
A: Set `PartnerTenantLink.is_active = false`. Partner will lose access on next API request (after token cache expires, typically <5 minutes).

---

## Contact & Governance

**Project Owner**: Platform Engineering Team
**Product Sponsor**: Partner Success Team
**Security Review**: Security Team
**Compliance Review**: Legal/Compliance Team

**Slack Channels**:
- `#proj-partner-portal-expansion` - Project updates
- `#team-platform-eng` - Technical questions
- `#partner-success` - Business/product questions

**Meeting Cadence**:
- Weekly sprint standups (Tuesdays 10am)
- Bi-weekly stakeholder reviews (Thursdays 2pm)
- Monthly security/compliance check-ins

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-07 | Platform Team | Phase 1 completion |

---

**Next Review**: Phase 1 stakeholder approval meeting (to be scheduled)
**Next Milestone**: Phase 2 Sprint 1 kickoff (pending approval)
