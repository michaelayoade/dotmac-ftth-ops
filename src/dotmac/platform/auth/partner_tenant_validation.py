"""
Partner Multi-Tenant Access Validation

Validates that partner users only access tenants they manage.
"""

from fastapi import HTTPException, Request
from fastapi.param_functions import Depends

from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac as get_current_user
from dotmac.platform.tenant import get_current_tenant_id
from dotmac.platform.user_management.models import User


async def validate_partner_tenant_access(
    request: Request,
    current_user: User = Depends(get_current_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
) -> str:
    """
    Validate that the current user has permission to access the specified tenant.

    This function ensures:
    1. Platform admins can access any tenant
    2. Partner users can only access their managed tenants
    3. Regular users can only access their own tenant

    Args:
        request: FastAPI request object
        current_user: Currently authenticated user
        tenant_id: Target tenant ID from headers or default

    Returns:
        Validated tenant_id that the user is allowed to access

    Raises:
        HTTPException(403): If user doesn't have permission to access the tenant
        HTTPException(400): If tenant_id is missing when required
    """
    # If no tenant specified, use user's own tenant
    if not tenant_id:
        if not current_user.tenant_id:
            raise HTTPException(
                status_code=400,
                detail="Tenant ID is required but not specified",
            )
        return current_user.tenant_id

    # SECURITY: Platform administrators can access ANY tenant
    # Check for platform admin permission
    if current_user.permissions and "platform.admin" in current_user.permissions:
        return tenant_id

    # SECURITY: Partner users can access their managed tenants
    if hasattr(current_user, "partner_id") and current_user.partner_id:
        # Get managed tenant IDs from user
        managed_tenant_ids = getattr(current_user, "managed_tenant_ids", []) or []

        # Partners can access their own tenant
        if tenant_id == current_user.tenant_id:
            return tenant_id

        # Partners can access managed tenants
        if tenant_id in managed_tenant_ids:
            return tenant_id

        # Access denied - partner trying to access non-managed tenant
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. Partner can only access managed tenants. "
            f"Your managed tenants: {', '.join(managed_tenant_ids) if managed_tenant_ids else 'none'}",
        )

    # SECURITY: Regular users can only access their own tenant
    if tenant_id != current_user.tenant_id:
        raise HTTPException(
            status_code=403,
            detail=f"Access denied. You can only access your own tenant ({current_user.tenant_id})",
        )

    return tenant_id


async def get_validated_tenant_id(
    request: Request,
    current_user: User = Depends(get_current_user),
    tenant_id: str | None = Depends(get_current_tenant_id),
) -> str:
    """
    Convenience dependency that returns validated tenant_id.

    Use this in route handlers that need multi-tenant access validation:

    ```python
    @router.get("/api/v1/subscribers")
    async def get_subscribers(
        tenant_id: str = Depends(get_validated_tenant_id)
    ):
        # tenant_id is now validated
        return await subscriber_service.get_all(tenant_id)
    ```
    """
    return await validate_partner_tenant_access(request, current_user, tenant_id)


# Export main functions
__all__ = [
    "validate_partner_tenant_access",
    "get_validated_tenant_id",
]
