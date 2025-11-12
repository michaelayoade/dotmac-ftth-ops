# RBAC vs. Team Models

This note captures the contract between the authorization layer, user-oriented
teams, and field-service teams so future migrations do not collide on naming or
responsibilities.

## 1. RBAC (Roles & Permissions)

- Stored in `permissions`, `roles`, and the join tables.
- Enforces **access control** only — it does not express org charts or crews.
- New field-service scopes have been added (e.g. `field_service.project.manage`,
  `field_service.technician.location.update`) and are now required by the
  project-management and field-service routers.
- Seeder: `ensure_field_service_rbac()` creates permissions plus helper roles
  (`field_service_dispatcher`, `field_service_technician`) and is executed during
  app startup alongside the existing ISP/Billing/Partner seeders.

## 2. User Teams (Tenant Org Structure)

- Backed by `user_management.Team` / `TeamMember`.
- Represents business-facing groups (Sales, Support, NOC) that live close to the
  identity surface and can be referenced by ticket routing, analytics, etc.
- CRUD endpoints continue to use the legacy `team.*` permissions.
- These teams should stay lightweight: name/slug/lead + UI metadata.

## 3. Field-Service Teams (Operational Crews)

- Backed by `field_service_teams`, `technician_team_memberships`, and
  `project_teams` in the project-management module.
- Express dispatch-ready information: skills, coverage radius, capacity,
  supervisor, telemetry stats.
- These entities are tied directly to work execution (projects/tasks/time
  tracking) and now require the `field_service.team.*`, `field_service.project.*`,
  and related scopes.

## Decision Matrix

| Concern                        | RBAC Layer                                 | User Teams                                 | Field-Service Teams                               |
| ------------------------------ | ------------------------------------------ | ------------------------------------------- | ------------------------------------------------- |
| Primary responsibility         | Who is allowed to perform an action        | How people are grouped inside a tenant      | How crews are organized for jobs/dispatch         |
| Data stored                    | Roles, permissions, partner overrides      | Team name/slug, UI metadata, lead, members  | Skills, coverage, KPIs, assignments, resources    |
| Typical consumers              | Every router via FastAPI dependencies      | CRM/Ticketing/Analytics surfaces            | Project mgmt, scheduling, geofencing, time entry  |
| Backing tables                 | `permissions`, `roles`, `user_roles`       | `teams`, `team_members`                     | `field_service_teams`, `technician_team_members`  |
| Permission namespace           | `team.*`, `billing.*`, `partner.*`, etc.   | `team.*`                                    | `field_service.*`                                 |
| Scope enforcement              | FastAPI dependency (`require_*`)           | Same (`team.*`)                             | New dependencies (`require_field_service_*`)       |

## Relationship Diagram

```
┌────────────────────┐      grants        ┌──────────────────────┐
│   Roles & Perms    │ ───────────────▶   │   UserInfo (JWT)     │
│ (RBAC namespace)   │                   │  tenant + permissions │
└────────────────────┘                   └────────┬─────────────┘
                                                 │effective tenant
                               ┌─────────────────┴─────────────────┐
                               │                                   │
                 governs CRUD  │                                   │ governs dispatch ops
                               │                                   │
                          ┌────▼───────┐                      ┌────▼──────────┐
                          │ User Teams │                      │ Field-Service │
                          │ (Tenant Org│                      │ Teams/Crews   │
                          │  Structure)│                      │ (Projects)    │
                          └────────────┘                      └──────────────┘
```

**Guidance**

1. When adding new operational capabilities, extend the `field_service.*`
   permission set instead of recycling `team.*`.
2. Avoid naming new tables `teams` / `team_members`; prefer domain-specific
   prefixes (e.g. `field_service_teams`) to prevent Alembic conflicts.
3. If a feature needs to link user teams and field crews (for reporting), do it
   via separate join tables or views — never collapse the schemas.

