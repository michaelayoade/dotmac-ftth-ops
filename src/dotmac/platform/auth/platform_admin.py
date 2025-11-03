"""
Platform Admin Module - Cross-tenant access and system administration.

Provides capabilities for SaaS platform administrators to:
- Access and manage ALL tenants
- Perform system-wide operations
- Impersonate tenants for support
- Generate cross-tenant reports
"""

from collections.abc import Awaitable, Callable
from typing import Any

import structlog
from fastapi import Depends, HTTPException, Request, status

from .core import UserInfo, get_current_user

logger = structlog.get_logger(__name__)

# ============================================
# Platform Admin Constants
# ============================================

# Platform admin permission - grants access to everything
PLATFORM_ADMIN_PERMISSION = "platform:admin"

# Specific platform permissions
PLATFORM_PERMISSIONS = {
    "platform:admin": "Full platform administration access",
    "platform:tenants:read": "View all tenants",
    "platform:tenants:write": "Manage all tenants",
    "platform:users:read": "View all users across tenants",
    "platform:users:write": "Manage all users across tenants",
    "platform:billing:read": "View all billing data",
    "platform:billing:write": "Manage all billing",
    "platform:analytics": "Access cross-tenant analytics",
    "platform:audit": "Access all audit logs",
    "platform:support": "Customer support access",
    "platform:impersonate": "Impersonate tenants",
}

# Header for tenant impersonation
TARGET_TENANT_HEADER = "X-Target-Tenant-ID"

# ============================================
# Platform Admin Checks
# ============================================


def is_platform_admin(user: UserInfo) -> bool:
    """Check if user is a platform administrator.

    Args:
        user: User information from auth

    Returns:
        True if user has platform admin access

    Example:
        >>> if is_platform_admin(current_user):
        >>>     # User can access all tenants
        >>>     pass
    """
    # Check explicit flag
    if user.is_platform_admin:
        return True

    permissions = set(user.permissions or [])

    # Check for platform admin permission
    if PLATFORM_ADMIN_PERMISSION in permissions:
        return True

    # Treat global or platform-wide wildcards as platform admin access
    if "*" in permissions or "platform:*" in permissions:
        return True

    return False


def has_platform_permission(user: UserInfo, permission: str) -> bool:
    """Check if user has a specific platform permission.

    Args:
        user: User information
        permission: Permission to check (e.g., "platform:tenants:read")

    Returns:
        True if user has the permission

    Example:
        >>> if has_platform_permission(current_user, "platform:tenants:read"):
        >>>     tenants = await get_all_tenants()
    """
    # Platform admins have all permissions
    if is_platform_admin(user):
        return True

    permissions = set(user.permissions or [])

    # Check specific permission
    if permission in permissions:
        return True

    # Global wildcard grants all permissions (including platform-scoped)
    if "*" in permissions:
        return True

    # Check hierarchical wildcard permissions (e.g., platform:tenants:*)
    parts = permission.split(":")
    for i in range(len(parts), 0, -1):
        wildcard = ":".join(parts[:i]) + ":*"
        if wildcard in permissions:
            return True

    return False


def get_target_tenant_id(request: Request, user: UserInfo) -> str | None:
    """Get target tenant ID for platform admin operations.

    Platform admins can specify a target tenant via header for impersonation.
    Regular users always use their assigned tenant_id.

    Args:
        request: FastAPI request object
        user: Current user information

    Returns:
        Tenant ID to use for the operation, or None for cross-tenant operations

    Example:
        >>> # Platform admin sets header: X-Target-Tenant-ID: tenant-123
        >>> tenant_id = get_target_tenant_id(request, current_user)
        >>> # Returns: "tenant-123"
    """
    # Regular users always use their assigned tenant
    if not is_platform_admin(user):
        return user.tenant_id

    # Platform admins can override tenant via header
    target_tenant = request.headers.get(TARGET_TENANT_HEADER)

    if target_tenant:
        # Log tenant impersonation for audit
        logger.warning(
            "Platform admin tenant impersonation",
            user_id=user.user_id,
            target_tenant=target_tenant,
            user_tenant=user.tenant_id,
        )
        return target_tenant

    # If no header provided, platform admin operates in cross-tenant mode (None)
    return None


# ============================================
# FastAPI Dependencies
# ============================================


async def require_platform_admin(
    current_user: UserInfo = Depends(get_current_user),
) -> UserInfo:
    """Dependency to require platform admin access.

    Raises:
        HTTPException: 403 if user is not a platform admin

    Returns:
        UserInfo if user is platform admin

    Example:
        >>> @router.get("/admin/tenants")
        >>> async def list_all_tenants(
        >>>     admin: UserInfo = Depends(require_platform_admin)
        >>> ):
        >>>     # Only platform admins can access this endpoint
        >>>     pass
    """
    if not is_platform_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform administrator access required",
        )

    return current_user


def require_platform_permission(permission: str) -> Callable[..., Awaitable[UserInfo]]:
    """Dependency factory to require specific platform permission.

    Args:
        permission: Required platform permission

    Returns:
        Dependency function that checks the permission

    Example:
        >>> @router.get("/admin/billing")
        >>> async def view_all_billing(
        >>>     user: UserInfo = Depends(require_platform_permission("platform:billing:read"))
        >>> ):
        >>>     pass
    """

    async def check_permission(
        current_user: UserInfo = Depends(get_current_user),
    ) -> UserInfo:
        if not has_platform_permission(current_user, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Platform permission required: {permission}",
            )
        return current_user

    return check_permission


async def get_effective_tenant_id(
    request: Request,
    current_user: UserInfo = Depends(get_current_user),
) -> str | None:
    """Get the effective tenant ID for the current request.

    For regular users, returns their assigned tenant_id.
    For platform admins, returns the target tenant from header or None.

    This dependency should be used in endpoints that support both
    tenant-scoped and cross-tenant operations.

    Returns:
        Tenant ID to use, or None for cross-tenant operations

    Example:
        >>> @router.get("/customers")
        >>> async def list_customers(
        >>>     tenant_id: Optional[str] = Depends(get_effective_tenant_id),
        >>> ):
        >>>     if tenant_id:
        >>>         # Tenant-scoped query
        >>>         return await get_customers(tenant_id=tenant_id)
        >>>     else:
        >>>         # Cross-tenant query (platform admin only)
        >>>         return await get_all_customers()
    """
    return get_target_tenant_id(request, current_user)


# ============================================
# Audit Logging
# ============================================


class PlatformAdminAuditLogger:
    """Audit logger for platform admin actions."""

    @staticmethod
    async def log_action(
        user: UserInfo,
        action: str,
        target_tenant: str | None = None,
        resource_type: str | None = None,
        resource_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """Log platform admin action for compliance.

        Args:
            user: Platform admin user
            action: Action performed (e.g., "view_tenant_data", "modify_billing")
            target_tenant: Target tenant ID if impersonating
            resource_type: Type of resource accessed
            resource_id: ID of specific resource
            details: Additional details for audit trail
        """
        log_entry = {
            "user_id": user.user_id,
            "user_email": user.email,
            "action": action,
            "is_cross_tenant": target_tenant is not None,
            "target_tenant": target_tenant,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "details": details or {},
        }

        # Use structured logging - "Platform admin action" becomes the event
        logger.warning("Platform admin action", **log_entry)

        # Write to dedicated audit table for compliance
        # Platform admin actions are automatically captured via audit middleware
        # which logs all API requests. For additional compliance tracking,
        # consider enabling the audit.ActivityLog table writes:
        #
        # from dotmac.platform.audit import log_user_activity, ActivityType, ActivitySeverity
        # await log_user_activity(
        #     user_id=admin_id,
        #     activity_type=ActivityType.PLATFORM_ADMIN,
        #     severity=ActivitySeverity.HIGH,
        #     description=f"Platform admin: {action}",
        #     metadata=log_entry,
        #     ip_address=ip_address,
        #     user_agent=user_agent,
        # )
        #
        # Note: The audit.ActivityLog table already captures these actions through
        # the audit middleware. This additional logging is only needed if you require
        # platform admin actions to be separately queryable from regular user activities.


platform_audit = PlatformAdminAuditLogger()


# ============================================
# Helper Functions
# ============================================


def create_platform_admin_token(
    user_id: str,
    email: str,
    permissions: list[str] | None = None,
) -> str:
    """Create JWT token for platform administrator.

    Args:
        user_id: User ID
        email: User email
        permissions: Additional permissions (platform:admin is always included)

    Returns:
        JWT access token with platform admin flag

    Example:
        >>> token = create_platform_admin_token(
        >>>     user_id="admin-001",
        >>>     email="admin@platform.com",
        >>> )
    """
    from .core import jwt_service

    all_permissions = permissions or []
    if PLATFORM_ADMIN_PERMISSION not in all_permissions:
        all_permissions.append(PLATFORM_ADMIN_PERMISSION)

    claims = {
        "email": email,
        "roles": ["platform_admin"],
        "permissions": all_permissions,
        "tenant_id": None,  # Platform admins don't belong to a tenant
        "is_platform_admin": True,
    }

    return jwt_service.create_access_token(user_id, additional_claims=claims)


__all__ = [
    "PLATFORM_ADMIN_PERMISSION",
    "PLATFORM_PERMISSIONS",
    "TARGET_TENANT_HEADER",
    "is_platform_admin",
    "has_platform_permission",
    "get_target_tenant_id",
    "require_platform_admin",
    "require_platform_permission",
    "get_effective_tenant_id",
    "platform_audit",
    "create_platform_admin_token",
]
