"""
Enhanced FastAPI dependencies for RBAC authorization
"""

import inspect
import logging
from collections.abc import Awaitable, Callable
from enum import Enum
from functools import cache, wraps
from typing import Any, ParamSpec, TypeVar, cast

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac
from dotmac.platform.db import get_async_session
from dotmac.platform.user_management.models import User

logger = logging.getLogger(__name__)


def _is_async_session_like(value: Any) -> bool:
    """Check if object behaves like AsyncSession (allows AsyncMock in tests)."""
    return isinstance(value, AsyncSession) or hasattr(value, "execute")


security = HTTPBearer(auto_error=False)

P = ParamSpec("P")
R = TypeVar("R")


class PermissionMode(str, Enum):
    """How to evaluate multiple permissions"""

    ALL = "all"  # UserInfo must have ALL permissions
    ANY = "any"  # UserInfo must have ANY of the permissions


class PermissionChecker:
    """
    Dependency class for checking permissions.
    Can be used as a FastAPI dependency.
    """

    def __init__(
        self,
        permissions: list[str],
        mode: PermissionMode = PermissionMode.ALL,
        error_message: str | None = None,
    ):
        self.permissions = permissions
        self.mode = mode
        self.error_message = error_message or f"Permission denied. Required: {permissions}"

    async def __call__(
        self,
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        """Check if current user has required permissions"""
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        rbac_service = RBACService(db)

        if self.mode == PermissionMode.ALL:
            has_permission = await rbac_service.user_has_all_permissions(
                current_user.user_id, self.permissions
            )
        else:  # ANY
            has_permission = await rbac_service.user_has_any_permission(
                current_user.user_id, self.permissions
            )

        if not has_permission:
            logger.warning(
                f"Permission denied for user {current_user.user_id}. "
                f"Required {self.mode.value} of: {self.permissions}"
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=self.error_message)

        return current_user


class RoleChecker:
    """
    Dependency class for checking roles.
    """

    def __init__(
        self,
        roles: list[str],
        mode: PermissionMode = PermissionMode.ANY,
        error_message: str | None = None,
    ):
        self.roles = roles
        self.mode = mode
        self.error_message = error_message or f"Role required: {roles}"

    async def __call__(
        self,
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        """Check if current user has required roles"""
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        rbac_service = RBACService(db)
        user_roles = await rbac_service.get_user_roles(current_user.user_id)
        user_role_names = {role.name for role in user_roles}

        if self.mode == PermissionMode.ALL:
            has_role = all(role in user_role_names for role in self.roles)
        else:  # ANY
            has_role = any(role in user_role_names for role in self.roles)

        if not has_role:
            logger.warning(
                f"Role check failed for user {current_user.user_id}. "
                f"Required {self.mode.value} of: {self.roles}, Has: {user_role_names}"
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=self.error_message)

        return current_user


class PartnerPermissionChecker(PermissionChecker):
    """
    Extended PermissionChecker for partner multi-tenant access.

    Validates:
    1. Partner permissions (from partner.* namespace)
    2. Active partner-tenant link if in cross-tenant context
    3. Link expiry and validity
    4. Custom permission overrides from PartnerTenantLink
    """

    def __init__(
        self,
        permissions: list[str],
        mode: PermissionMode = PermissionMode.ALL,
        error_message: str | None = None,
        require_active_link: bool = True,
    ):
        super().__init__(permissions, mode, error_message)
        self.require_active_link = require_active_link

    async def __call__(
        self,
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> UserInfo:
        """Check partner permissions and validate tenant link if applicable"""
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        # Check if this is a cross-tenant access
        if current_user.is_cross_tenant_access and self.require_active_link:
            await self._validate_partner_link(current_user, db)

        # Check standard permissions
        return await super().__call__(current_user, db)

    async def _validate_partner_link(self, current_user: UserInfo, db: AsyncSession) -> None:
        """Validate active partner-tenant link with custom permissions."""
        from sqlalchemy import select

        from dotmac.platform.partner_management.models import PartnerTenantLink

        # Query for active link
        result = await db.execute(
            select(PartnerTenantLink).where(
                PartnerTenantLink.partner_id == current_user.partner_id,
                PartnerTenantLink.managed_tenant_id == current_user.active_managed_tenant_id,
                PartnerTenantLink.is_active == True,  # noqa: E712
            )
        )
        link = result.scalars().first()

        if not link:
            logger.warning(
                "No active partner-tenant link found",
                user_id=current_user.user_id,
                partner_id=current_user.partner_id,
                managed_tenant_id=current_user.active_managed_tenant_id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No active partner-tenant link found",
            )

        # Check if link is expired
        if link.is_expired:
            logger.warning(
                "Partner-tenant link is expired",
                user_id=current_user.user_id,
                partner_id=current_user.partner_id,
                managed_tenant_id=current_user.active_managed_tenant_id,
                end_date=link.end_date,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Partner-tenant link has expired",
            )

        # Check custom permission overrides (denials take precedence)
        if link.custom_permissions:
            for perm in self.permissions:
                override = link.custom_permissions.get(perm)
                if override is False:  # Explicit denial
                    logger.warning(
                        "Permission denied by custom override",
                        user_id=current_user.user_id,
                        partner_id=current_user.partner_id,
                        permission=perm,
                        managed_tenant_id=current_user.active_managed_tenant_id,
                    )
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission {perm} denied by partner link configuration",
                    )


async def get_current_active_user(
    current_user: User = Depends(get_current_user_with_rbac),
) -> User:
    """Backward-compatible dependency returning the full User model."""
    return current_user


# ==================== Convenience Functions ====================


@cache
def _cached_permission_checker(
    permissions: tuple[str, ...],
    mode: PermissionMode,
    error_message: str | None,
) -> PermissionChecker:
    return PermissionChecker(
        permissions=list(permissions),
        mode=mode,
        error_message=error_message,
    )


@cache
def _cached_role_checker(
    roles: tuple[str, ...],
    mode: PermissionMode,
    error_message: str | None,
) -> RoleChecker:
    return RoleChecker(
        roles=list(roles),
        mode=mode,
        error_message=error_message,
    )


def require_permission(permission: str, error_message: str | None = None) -> PermissionChecker:
    """Require a single permission"""
    return _cached_permission_checker((permission,), PermissionMode.ALL, error_message)


def require_permissions(*permissions: str, error_message: str | None = None) -> PermissionChecker:
    """Require all specified permissions"""
    return _cached_permission_checker(tuple(permissions), PermissionMode.ALL, error_message)


def require_any_permission(
    *permissions: str, error_message: str | None = None
) -> PermissionChecker:
    """Require any of the specified permissions"""
    return _cached_permission_checker(tuple(permissions), PermissionMode.ANY, error_message)


def require_role(role: str, error_message: str | None = None) -> RoleChecker:
    """Require a single role"""
    return _cached_role_checker((role,), PermissionMode.ALL, error_message)


def require_any_role(*roles: str, error_message: str | None = None) -> RoleChecker:
    """Require any of the specified roles"""
    return _cached_role_checker(tuple(roles), PermissionMode.ANY, error_message)


# ==================== Resource-based Permission Checks ====================


class ResourcePermissionChecker:
    """
    Check permissions for a specific resource.
    Useful for checking ownership or team membership.
    """

    def __init__(
        self,
        permission: str,
        resource_getter: Callable[[AsyncSession, str], Awaitable[Any]],
        ownership_checker: Callable[[UserInfo, Any], Awaitable[bool] | bool] | None = None,
    ):
        self.permission = permission
        self.resource_getter = resource_getter
        self.ownership_checker = ownership_checker

    async def __call__(
        self,
        resource_id: str,
        current_user: UserInfo = Depends(get_current_user),
        db: AsyncSession = Depends(get_async_session),
    ) -> tuple[UserInfo, Any]:
        """Check permission for a specific resource"""
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        # Get the resource
        resource = await self.resource_getter(db, resource_id)
        if not resource:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")

        rbac_service = RBACService(db)

        # Check general permission
        has_permission = await rbac_service.user_has_permission(
            current_user.user_id, self.permission
        )

        # If no general permission, check ownership
        if not has_permission and self.ownership_checker:
            ownership_result = self.ownership_checker(current_user, resource)
            if inspect.isawaitable(ownership_result):
                is_owner = await ownership_result
            else:
                is_owner = bool(ownership_result)
            if is_owner:
                # Check if user has the "own" version of the permission
                own_permission = self.permission.replace(".all", ".own")
                has_permission = await rbac_service.user_has_permission(
                    current_user.user_id, own_permission
                )

        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied for resource"
            )

        return current_user, resource


# ==================== Specific Permission Checks ====================

# Customer Management
require_customer_read = require_permission("customer.read")
require_customer_create = require_permission("customer.create")
require_customer_update = require_permission("customer.update")
require_customer_delete = require_permission("customer.delete")
require_customer_export = require_permission("customer.export")
require_customer_import = require_permission("customer.import")
require_customer_impersonate = require_permission("customer.impersonate")
require_customer_manage_status = require_permission("customer.manage_status")
require_customer_reset_password = require_permission("customer.reset_password")

# Ticket Management
require_ticket_read = require_any_permission(
    "ticket.read.all", "ticket.read.assigned", "ticket.read.own"
)
require_ticket_create = require_permission("ticket.create")
require_ticket_update = require_any_permission(
    "ticket.update.all", "ticket.update.assigned", "ticket.update.own"
)
require_ticket_assign = require_permission("ticket.assign")
require_ticket_escalate = require_permission("ticket.escalate")
require_ticket_close = require_permission("ticket.close")
require_ticket_delete = require_permission("ticket.delete")

# Billing Management
require_billing_read = require_permission("billing.read")
require_billing_invoice_create = require_permission("billing.invoice.create")
require_billing_invoice_update = require_permission("billing.invoice.update")
require_billing_payment_process = require_permission("billing.payment.process")
require_billing_refund = require_permission("billing.payment.refund")
require_billing_export = require_permission("billing.export")

# Billing Reconciliation
require_billing_reconciliation_create = require_permission("billing.reconciliation.create")
require_billing_reconciliation_read = require_permission("billing.reconciliation.read")
require_billing_reconciliation_update = require_permission("billing.reconciliation.update")
require_billing_reconciliation_approve = require_permission("billing.reconciliation.approve")
require_billing_payment_retry = require_permission("billing.payment.retry")
require_billing_admin = require_permission("billing.admin")

# Team Management
require_team_read = require_permission("team.read")
require_team_create = require_permission("team.create")
require_team_update = require_permission("team.update")
require_team_delete = require_permission("team.delete")
require_team_manage_members = require_permission("team.manage_members")

# Field Service & Project Management
require_field_service_project_read = require_permission("field_service.project.read")
require_field_service_project_manage = require_permission("field_service.project.manage")
require_field_service_task_read = require_permission("field_service.task.read")
require_field_service_task_manage = require_permission("field_service.task.manage")
require_field_service_team_read = require_permission("field_service.team.read")
require_field_service_team_manage = require_permission("field_service.team.manage")
require_field_service_technician_read = require_permission("field_service.technician.read")
require_field_service_technician_manage = require_permission("field_service.technician.manage")
require_field_service_technician_location = require_permission(
    "field_service.technician.location.update"
)
require_field_service_geofence_read = require_permission("field_service.geofence.read")
require_field_service_time_read = require_permission("field_service.time_entry.read")
require_field_service_time_manage = require_permission("field_service.time_entry.manage")
require_field_service_resource_read = require_permission("field_service.resource.read")
require_field_service_resource_manage = require_permission("field_service.resource.manage")

# Security Management
require_security_secret_read = require_permission("security.secret.read")
require_security_secret_write = require_permission("security.secret.write")
require_security_secret_delete = require_permission("security.secret.delete")
require_security_audit_read = require_permission("security.audit.read")

# Tenant Domain Management
require_tenant_domain_verify = require_permission("tenant.domain.verify")
require_tenant_domain_read = require_permission("tenant.domain.read")
require_tenant_domain_delete = require_permission("tenant.domain.delete")

# Admin Management
require_admin = require_role("admin")
require_admin_user_manage = require_permissions(
    "admin.user.create", "admin.user.update", "admin.user.delete"
)
require_admin_settings = require_permission("admin.settings.update")


# ==================== Decorator Version for Non-FastAPI Functions ====================


def check_permission(
    permission: str,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """Decorator to check permission for regular functions"""

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Extract user from kwargs or context
            user = kwargs.get("current_user")
            db = kwargs.get("db")

            if not isinstance(user, UserInfo) or not _is_async_session_like(db):
                raise AuthorizationError("Unable to verify permissions")

            rbac_service = RBACService(cast(AsyncSession, db))
            has_permission = await rbac_service.user_has_permission(user.user_id, permission)

            if not has_permission:
                raise AuthorizationError(f"Permission required: {permission}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def check_any_permission(
    *permissions: str,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """Decorator to check if user has any of the permissions"""

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            user = kwargs.get("current_user")
            db = kwargs.get("db")

            if not isinstance(user, UserInfo) or not _is_async_session_like(db):
                raise AuthorizationError("Unable to verify permissions")

            rbac_service = RBACService(cast(AsyncSession, db))
            has_permission = await rbac_service.user_has_any_permission(
                user.user_id, list(permissions)
            )

            if not has_permission:
                raise AuthorizationError(f"Permission required: any of {permissions}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator
