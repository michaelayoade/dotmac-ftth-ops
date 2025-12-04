# Phase 1: Partner Portal Expansion - RBAC Extensions

**Version:** 1.0
**Date:** 2025-11-07
**Status:** Draft - Design Review

## Executive Summary

This document defines the RBAC (Role-Based Access Control) extensions required to support multi-tenant partner access. The design enables partners to access multiple managed tenants with scoped permissions based on their role and relationship.

## Current RBAC Architecture

### Existing Components

**Permission Model**:
- Permissions stored in `permissions` table
- Hierarchical permission strings (e.g., `billing.invoices.read`)
- Wildcard support (`billing.*`, `*`)
- Explicit denies override allows

**Role Model**:
- Roles defined in `roles` table
- Many-to-many: Roles → Permissions
- Many-to-many: Users → Roles

**Permission Checking**:
- `PermissionChecker` dependency for endpoint protection
- `PermissionSnapshot` for efficient permission evaluation
- Caching layer for performance

**Current Scope**:
- Tenant-isolated (users can only access their own tenant)
- No cross-tenant access mechanism

## Gap Analysis

**Missing Capabilities for Multi-Tenant Partner Access:**

1. **Cross-Tenant Context Switching**: No mechanism to authenticate as Partner A but access Tenant B's data
2. **Scoped Permission Grants**: Permissions are tenant-wide, not scoped to specific managed tenants
3. **Partner-Specific Permission Namespaces**: No partner-specific permission categories
4. **Audit Trail for Cross-Tenant Actions**: No clear audit of which partner accessed which tenant

## Proposed RBAC Extensions

### 1. Partner Permission Namespace

Add new permission categories for partner operations:

```python
# New permissions added to seeder

PARTNER_PERMISSIONS = [
    # Managed Tenant Access
    "partner.tenants.list",              # List managed tenants
    "partner.tenants.switch_context",    # Switch active tenant context

    # Billing Operations
    "partner.billing.read",              # Read billing data across managed tenants
    "partner.billing.invoices.read",     # Read invoices
    "partner.billing.invoices.export",   # Export consolidated billing
    "partner.billing.payments.read",     # View payment history
    "partner.billing.summary.read",      # Access AR summary

    # Support Operations
    "partner.support.tickets.list",      # List tickets across tenants
    "partner.support.tickets.read",      # Read ticket details
    "partner.support.tickets.create",    # Create tickets on behalf of tenants
    "partner.support.tickets.update",    # Update ticket status
    "partner.support.tickets.comment",   # Comment on tickets

    # Provisioning Operations
    "partner.provisioning.subscribers.list",   # List subscribers
    "partner.provisioning.subscribers.activate", # Activate service
    "partner.provisioning.subscribers.suspend",  # Suspend service
    "partner.provisioning.subscribers.read",     # View subscriber details

    # Reporting
    "partner.reports.usage.read",        # Usage reports
    "partner.reports.sla.read",          # SLA compliance reports
    "partner.reports.revenue.read",      # Revenue reports

    # Alerts
    "partner.alerts.sla.read",           # SLA breach alerts
    "partner.alerts.billing.read",       # Billing threshold alerts
]
```

### 2. Enhanced UserInfo Context

Extend `UserInfo` to include partner context:

```python
@dataclass
class UserInfo:
    """Extended user information with partner context."""

    user_id: UUID
    username: str
    email: str
    tenant_id: str | None
    roles: list[str]
    permissions: set[str]

    # New partner fields
    partner_id: UUID | None = None
    active_managed_tenant_id: str | None = None
    managed_tenant_ids: list[str] = field(default_factory=list)
    partner_access_role: str | None = None

    @property
    def is_partner_user(self) -> bool:
        """Check if user is a partner user."""
        return self.partner_id is not None

    @property
    def is_cross_tenant_context(self) -> bool:
        """Check if user is accessing a managed tenant (not their own)."""
        return (
            self.is_partner_user
            and self.active_managed_tenant_id is not None
            and self.active_managed_tenant_id != self.tenant_id
        )

    def get_effective_tenant_id(self) -> str | None:
        """Get the tenant ID for current operation scope."""
        if self.is_cross_tenant_context:
            return self.active_managed_tenant_id
        return self.tenant_id
```

### 3. Context Switching Middleware

Add middleware to handle partner tenant context switching:

```python
class PartnerTenantContextMiddleware:
    """
    Middleware to manage partner cross-tenant access.

    Reads X-Active-Tenant-Id header and validates partner access.
    """

    async def __call__(self, request: Request, call_next):
        # Get current user from auth
        user = request.state.user  # type: UserInfo

        # Check if partner is switching context
        active_tenant = request.headers.get("X-Active-Tenant-Id")

        if active_tenant and user.is_partner_user:
            # Validate partner has access to this tenant
            if active_tenant in user.managed_tenant_ids:
                user.active_managed_tenant_id = active_tenant
            else:
                raise HTTPException(
                    status_code=403,
                    detail=f"Partner does not have access to tenant {active_tenant}"
                )

        request.state.user = user
        response = await call_next(request)
        return response
```

### 4. Permission Checker Extensions

Extend `PermissionChecker` to support partner permissions:

```python
class PartnerPermissionChecker(PermissionChecker):
    """
    Enhanced permission checker with partner-tenant awareness.
    """

    async def __call__(
        self,
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        # Check base permissions
        user = await super().__call__(current_user, db)

        # If accessing a managed tenant, validate partner link
        if user.is_cross_tenant_context:
            await self._validate_partner_tenant_access(
                user.partner_id,
                user.active_managed_tenant_id,
                db
            )

        return user

    async def _validate_partner_tenant_access(
        self,
        partner_id: UUID,
        tenant_id: str,
        db: AsyncSession
    ) -> None:
        """Validate active partner-tenant link."""
        from dotmac.platform.partner_management.models import PartnerTenantLink

        stmt = select(PartnerTenantLink).where(
            PartnerTenantLink.partner_id == partner_id,
            PartnerTenantLink.managed_tenant_id == tenant_id,
            PartnerTenantLink.is_active == True,
        )

        result = await db.execute(stmt)
        link = result.scalar_one_or_none()

        if not link:
            raise AuthorizationError(
                f"Partner {partner_id} does not have active access to tenant {tenant_id}"
            )

        # Validate link is not expired
        if link.end_date and link.end_date < datetime.now(UTC):
            raise AuthorizationError(
                f"Partner access to tenant {tenant_id} has expired"
            )
```

### 5. Token Enrichment

Update `get_current_user` to enrich tokens with partner context:

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_async_session),
) -> UserInfo:
    """
    Decode JWT and enrich with partner context if applicable.
    """
    # Decode token (existing logic)
    payload = decode_jwt(token)
    user_id = UUID(payload["sub"])

    # Fetch user permissions (existing logic)
    permissions = await get_user_permissions(user_id, db)

    # NEW: Check if user is a partner user
    partner_user = await get_partner_user_by_auth_user_id(user_id, db)

    if partner_user:
        # Fetch managed tenants for this partner
        managed_tenants = await get_partner_managed_tenants(
            partner_user.partner_id,
            db
        )

        return UserInfo(
            user_id=user_id,
            username=payload["username"],
            email=payload["email"],
            tenant_id=payload["tenant_id"],
            roles=payload.get("roles", []),
            permissions=permissions,
            partner_id=partner_user.partner_id,
            managed_tenant_ids=[link.managed_tenant_id for link in managed_tenants],
            partner_access_role=None,  # Set when context switched
        )

    # Regular user (non-partner)
    return UserInfo(
        user_id=user_id,
        username=payload["username"],
        email=payload["email"],
        tenant_id=payload["tenant_id"],
        roles=payload.get("roles", []),
        permissions=permissions,
    )
```

### 6. Audit Logging Extensions

Enhance audit logs to track cross-tenant access:

```python
async def log_partner_action(
    action: str,
    partner_id: UUID,
    partner_tenant_id: str,
    managed_tenant_id: str,
    resource_type: str,
    resource_id: str | None,
    details: dict[str, Any],
) -> None:
    """
    Log partner actions on managed tenants.
    """
    audit_entry = {
        "timestamp": datetime.now(UTC).isoformat(),
        "action": action,
        "actor": {
            "type": "partner",
            "partner_id": str(partner_id),
            "partner_tenant_id": partner_tenant_id,
        },
        "target": {
            "managed_tenant_id": managed_tenant_id,
            "resource_type": resource_type,
            "resource_id": resource_id,
        },
        "details": details,
    }

    # Store in audit log table
    await store_audit_log(audit_entry)

    # Also emit event for webhook/notification
    await emit_audit_event("partner.action", audit_entry)
```

## Permission Resolution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User authenticates (JWT token with user_id, tenant_id)      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Token enrichment:                                            │
│    - Fetch user permissions from RBAC                           │
│    - Check if user is partner user (PartnerUser.user_id match) │
│    - If partner, fetch managed_tenant_ids from PartnerTenantLink│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Request received with X-Active-Tenant-Id header             │
│    (Partner wants to access managed tenant B)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. PartnerTenantContextMiddleware validates:                   │
│    - Is X-Active-Tenant-Id in user.managed_tenant_ids?         │
│    - Is PartnerTenantLink active and not expired?              │
│    - Set user.active_managed_tenant_id = X-Active-Tenant-Id    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Permission check:                                            │
│    - Does user have 'partner.billing.read' permission?          │
│    - Does PartnerTenantLink.access_role allow billing access?  │
│    - Apply custom_permissions overrides                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Data access:                                                 │
│    - Fetch data scoped to user.active_managed_tenant_id         │
│    - Log action to audit trail                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Role-to-Permission Mapping

```python
# Seed data for partner roles

PARTNER_ROLES = {
    "partner_msp_full": {
        "description": "Full MSP access to managed tenants",
        "permissions": [
            "partner.tenants.*",
            "partner.billing.*",
            "partner.support.*",
            "partner.provisioning.*",
            "partner.reports.*",
            "partner.alerts.*",
        ]
    },
    "partner_msp_billing": {
        "description": "Billing-only MSP access",
        "permissions": [
            "partner.tenants.list",
            "partner.tenants.switch_context",
            "partner.billing.*",
            "partner.reports.revenue.read",
            "partner.alerts.billing.read",
        ]
    },
    "partner_msp_support": {
        "description": "Support-only MSP access",
        "permissions": [
            "partner.tenants.list",
            "partner.tenants.switch_context",
            "partner.support.*",
            "partner.reports.usage.read",
            "partner.reports.sla.read",
            "partner.alerts.sla.read",
        ]
    },
    "partner_auditor": {
        "description": "Read-only auditor access",
        "permissions": [
            "partner.tenants.list",
            "partner.tenants.switch_context",
            "partner.billing.read",
            "partner.support.tickets.list",
            "partner.support.tickets.read",
            "partner.reports.*",
            "partner.alerts.*",
        ]
    },
}
```

## Security Considerations

### 1. Prevent Privilege Escalation
- Partner users can only access tenants explicitly linked via `PartnerTenantLink`
- Cannot modify their own `managed_tenant_ids` list
- Middleware validates every cross-tenant request

### 2. Audit Everything
- All partner actions on managed tenants are audited
- Audit log includes both partner's tenant and managed tenant
- Searchable by partner, managed tenant, or action type

### 3. Token Security
- Managed tenant list embedded in JWT requires re-login after link changes
- Consider refresh token mechanism for link updates
- Token expiry aligned with link expiry

### 4. Rate Limiting
- Cross-tenant requests should have stricter rate limits
- Prevent partner from overwhelming managed tenant's APIs
- Per-partner quotas configurable in `PartnerTenantLink.metadata`

## Migration Strategy

### Phase 1: Add Permissions
```sql
-- Seed new partner permissions
INSERT INTO permissions (name, category, description) VALUES
('partner.tenants.list', 'PARTNER', 'List managed tenants'),
('partner.tenants.switch_context', 'PARTNER', 'Switch active tenant context'),
-- ... (all partner permissions)
```

### Phase 2: Create Roles
```sql
-- Create partner roles
INSERT INTO roles (name, description) VALUES
('partner_msp_full', 'Full MSP access to managed tenants'),
-- ... (all partner roles)
```

### Phase 3: Link Roles to Permissions
```sql
-- Grant permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'partner_msp_full' AND p.name LIKE 'partner.%';
```

### Phase 4: Update Middleware
- Deploy `PartnerTenantContextMiddleware` to production
- Initially in "log-only" mode (don't enforce)
- Monitor audit logs for unexpected behavior
- Enable enforcement after validation

## Testing Requirements

### Unit Tests
- [ ] Permission checking with partner context
- [ ] UserInfo enrichment logic
- [ ] Context switching validation

### Integration Tests
- [ ] Full partner login → context switch → API call flow
- [ ] Invalid context switch rejection
- [ ] Expired link handling

### Security Tests
- [ ] Attempt to access non-linked tenant (should fail)
- [ ] Privilege escalation attempts
- [ ] Token manipulation tests

## Open Questions

1. **Session Management**: Should context switches require new session, or can user maintain multiple active contexts?
2. **Caching**: How to invalidate permission cache when `PartnerTenantLink` is modified?
3. **UI Indicators**: How to show users they're in cross-tenant mode?
4. **Impersonation Logs**: Should partner actions appear as "Partner X on behalf of Tenant Y" in tenant's audit logs?
5. **Emergency Access Revocation**: How to immediately revoke partner access in emergency?

---
**Document Owner**: Security Team, Platform Engineering
**Reviewers**: Product, Compliance, Operations
