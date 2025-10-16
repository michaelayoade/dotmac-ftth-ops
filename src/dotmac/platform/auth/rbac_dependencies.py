"""
Enhanced FastAPI dependencies for RBAC authorization
"""

import inspect
import logging
from collections.abc import Awaitable, Callable
from enum import Enum
from functools import cache, wraps
from typing import Any, ParamSpec, TypeVar

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.exceptions import AuthorizationError
from dotmac.platform.auth.rbac_service import RBACService
from dotmac.platform.db import get_async_session

logger = logging.getLogger(__name__)

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


def require_permission(permission: str, error_message: str | None = None) -> Any:
    """Require a single permission"""
    return _cached_permission_checker((permission,), PermissionMode.ALL, error_message)


def require_permissions(*permissions: str, error_message: str | None = None) -> Any:
    """Require all specified permissions"""
    return _cached_permission_checker(tuple(permissions), PermissionMode.ALL, error_message)


def require_any_permission(*permissions: str, error_message: str | None = None) -> Any:
    """Require any of the specified permissions"""
    return _cached_permission_checker(tuple(permissions), PermissionMode.ANY, error_message)


def require_role(role: str, error_message: str | None = None) -> Any:
    """Require a single role"""
    return _cached_role_checker((role,), PermissionMode.ALL, error_message)


def require_any_role(*roles: str, error_message: str | None = None) -> Any:
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

            if not isinstance(user, UserInfo) or not isinstance(db, AsyncSession):
                raise AuthorizationError("Unable to verify permissions")

            rbac_service = RBACService(db)
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

            if not isinstance(user, UserInfo) or not isinstance(db, AsyncSession):
                raise AuthorizationError("Unable to verify permissions")

            rbac_service = RBACService(db)
            has_permission = await rbac_service.user_has_any_permission(
                user.user_id, list(permissions)
            )

            if not has_permission:
                raise AuthorizationError(f"Permission required: any of {permissions}")

            return await func(*args, **kwargs)

        return wrapper

    return decorator
