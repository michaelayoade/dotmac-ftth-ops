# RBAC Migration Guide

## How to Update Existing Endpoints to Use RBAC

This guide shows how to migrate from simple admin checks to granular RBAC permissions.

## 1. Customer Management Example

### Before (Simple Admin Check)
```python
from dotmac.platform.auth.dependencies import require_admin

@router.get("/customers")
async def list_customers(
    current_user: User = Depends(require_admin)
):
    # Only admins can access
    return customers
```

### After (Granular RBAC)
```python
from dotmac.platform.auth.rbac_dependencies import require_permission

@router.get("/customers")
async def list_customers(
    current_user: User = Depends(require_permission("customer.read"))
):
    # Anyone with customer.read permission
    return customers

@router.post("/customers")
async def create_customer(
    current_user: User = Depends(require_permission("customer.create"))
):
    # Requires customer.create permission
    pass

@router.delete("/customers/{id}")
async def delete_customer(
    current_user: User = Depends(require_permission("customer.delete"))
):
    # Requires customer.delete permission
    pass
```

## 2. Billing Management Example

### Before
```python
@router.post("/invoices/{id}/refund")
async def refund_invoice(
    invoice_id: str,
    current_user: User = Depends(require_admin)
):
    # Only admins can refund
    pass
```

### After
```python
from dotmac.platform.auth.rbac_dependencies import (
    require_permission,
    require_any_permission
)

@router.get("/invoices")
async def list_invoices(
    current_user: User = Depends(require_permission("billing.read"))
):
    # Billing read access
    pass

@router.post("/invoices/{id}/refund")
async def refund_invoice(
    invoice_id: str,
    current_user: User = Depends(require_permission("billing.payment.refund"))
):
    # Specific refund permission
    pass

@router.post("/invoices/{id}/void")
async def void_invoice(
    invoice_id: str,
    current_user: User = Depends(
        require_any_permission("billing.invoice.void", "admin")
    )
):
    # Either void permission OR admin role
    pass
```

## 3. Secret Management Example

### Before
```python
@router.get("/secrets/{path}")
async def get_secret(
    path: str,
    current_user: User = Depends(get_current_user)
):
    # Any authenticated user
    pass
```

### After
```python
@router.get("/secrets/{path}")
async def get_secret(
    path: str,
    current_user: User = Depends(require_permission("security.secret.read"))
):
    pass

@router.post("/secrets/{path}")
async def create_secret(
    path: str,
    current_user: User = Depends(require_permission("security.secret.write"))
):
    pass

@router.post("/secrets/{path}/rotate")
async def rotate_secret(
    path: str,
    current_user: User = Depends(require_permission("security.secret.rotate"))
):
    pass
```

## 4. Resource-Based Permissions

For checking ownership or team membership:

```python
from dotmac.platform.auth.rbac_dependencies import ResourcePermissionChecker

# Define resource getter
async def get_customer(db: Session, customer_id: str):
    return db.query(Customer).filter_by(id=customer_id).first()

# Define ownership checker
async def is_customer_owner(user: User, customer: Customer) -> bool:
    return customer.created_by_id == user.id

# Create dependency
check_customer_access = ResourcePermissionChecker(
    permission="customer.update.all",
    resource_getter=get_customer,
    ownership_checker=is_customer_owner
)

@router.patch("/customers/{customer_id}")
async def update_customer(
    customer_id: str,
    user_and_customer = Depends(check_customer_access)
):
    user, customer = user_and_customer
    # User either has customer.update.all permission
    # OR owns the customer and has customer.update.own permission
    pass
```

## 5. Multiple Permission Requirements

```python
from dotmac.platform.auth.rbac_dependencies import (
    require_permissions,  # ALL permissions required
    require_any_permission,  # ANY permission required
    require_role,
    require_any_role
)

# Require ALL permissions
@router.post("/billing/export")
async def export_billing(
    current_user: User = Depends(
        require_permissions("billing.read", "billing.export")
    )
):
    pass

# Require ANY permission
@router.get("/dashboard")
async def view_dashboard(
    current_user: User = Depends(
        require_any_permission(
            "analytics.dashboard.view",
            "admin"
        )
    )
):
    pass

# Require specific role
@router.post("/system/reset")
async def system_reset(
    current_user: User = Depends(require_role("superadmin"))
):
    pass

# Require any of these roles
@router.get("/support/tickets")
async def list_tickets(
    current_user: User = Depends(
        require_any_role("support_agent", "support_lead", "support_manager")
    )
):
    pass
```

## 6. Custom Permission Logic

For complex permission logic:

```python
from dotmac.platform.auth.rbac_service import RBACService

@router.post("/complex-operation")
async def complex_operation(
    current_user: User = Depends(get_current_user),
    rbac_service: RBACService = Depends(get_rbac_service),
    db: Session = Depends(get_db)
):
    # Check multiple conditions
    can_read = await rbac_service.user_has_permission(
        current_user.id, "resource.read"
    )

    can_write = await rbac_service.user_has_permission(
        current_user.id, "resource.write"
    )

    is_owner = check_ownership(current_user, resource)

    if can_write or (can_read and is_owner):
        # Allow operation
        pass
    else:
        raise HTTPException(403, "Permission denied")
```

## 7. Migration Checklist

### Phase 1: Preparation
- [ ] Run RBAC migration: `alembic upgrade head`
- [ ] Seed permissions and roles: `python scripts/seed_rbac.py`
- [ ] Test RBAC service functionality

### Phase 2: Router Updates
- [ ] Customer management routes
- [ ] Billing routes
- [ ] User management routes
- [ ] Secret management routes
- [ ] Analytics routes
- [ ] Admin settings routes

### Phase 3: Token Updates
- [ ] Update login endpoint to use `RBACTokenService`
- [ ] Update refresh endpoint to include permissions
- [ ] Update user context to include permissions

### Phase 4: Frontend Updates
- [ ] Update API client to handle permission errors
- [ ] Add permission checking in UI components
- [ ] Hide/disable features based on permissions

### Phase 5: Testing
- [ ] Test each role's access
- [ ] Test permission inheritance
- [ ] Test permission expiration
- [ ] Test audit logging

## 8. Common Patterns

### Admin Override
```python
# Admin can always access
require_any_permission("specific.permission", "admin")
```

### Tiered Access
```python
# Different levels of access
if await rbac_service.user_has_permission(user_id, "data.read.all"):
    # Can read all data
    query = db.query(Model)
elif await rbac_service.user_has_permission(user_id, "data.read.team"):
    # Can read team data
    query = db.query(Model).filter_by(team_id=user.team_id)
elif await rbac_service.user_has_permission(user_id, "data.read.own"):
    # Can read own data
    query = db.query(Model).filter_by(user_id=user.id)
else:
    # No access
    raise PermissionDenied()
```

### Feature Flags
```python
# Combine with feature flags
if feature_enabled("new_billing") and has_permission("billing.v2.access"):
    # Use new billing system
    pass
```

## 9. Troubleshooting

### Permission Denied Errors
1. Check user's roles: `GET /api/v1/rbac/users/{user_id}/permissions`
2. Verify permission exists: `GET /api/v1/rbac/permissions`
3. Check token claims contain permissions
4. Verify permission spelling in dependency

### Performance Issues
1. Enable permission caching (5-minute TTL by default)
2. Use `require_any_permission` instead of multiple checks
3. Batch permission checks when possible

### Debugging
```python
import logging
logging.getLogger("dotmac.platform.auth.rbac_service").setLevel(logging.DEBUG)
```

## 10. Best Practices

1. **Use Specific Permissions**: Prefer `customer.delete` over generic `admin`
2. **Document Requirements**: Add docstrings stating required permissions
3. **Test Thoroughly**: Write tests for each permission scenario
4. **Audit Changes**: All permission grants/revokes are logged
5. **Plan Rollback**: Keep old admin checks during transition
6. **Gradual Migration**: Migrate one module at a time
7. **Monitor Usage**: Track which permissions are actually used