"""
Tenant identity and middleware utilities for DotMac platform.
Configurable for both single-tenant and multi-tenant deployments.
"""

from .config import (
    TenantConfiguration,
    TenantMode,
    get_tenant_config,
    set_tenant_config,
)
from .tenant import TenantIdentityResolver, TenantMiddleware

__all__ = [
    "TenantIdentityResolver",
    "TenantMiddleware",
    "TenantConfiguration",
    "TenantMode",
    "get_tenant_config",
    "set_tenant_config",
]

import contextvars
from enum import Enum
from typing import Any

# Context variable to store the current tenant ID
_tenant_context: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "tenant_id", default=None
)


class TenantIsolationLevel(str, Enum):
    SCHEMA = "schema"
    DATABASE = "database"
    NONE = "none"
    LOGICAL = "logical"


class TenantResolutionStrategy(str, Enum):
    HEADER = "header"
    JWT_CLAIM = "jwt_claim"
    SUBDOMAIN = "subdomain"
    PATH = "path"
    QUERY_PARAM = "query_param"


def get_tenant_context() -> Any:
    """Compatibility helper expected by imports tests."""
    return _tenant_context.get()


def get_current_tenant_id() -> str | None:
    """Get current tenant ID from request context.

    Returns the tenant ID from the context variable, which is set by
    the TenantMiddleware or audit middleware based on the request.
    """
    tenant_id = _tenant_context.get()
    if tenant_id:
        return tenant_id

    # Fallback to default tenant in single-tenant mode
    from .config import get_tenant_config

    config = get_tenant_config()
    if config.is_single_tenant:
        return config.default_tenant_id

    return None


def set_current_tenant_id(tenant_id: str | None) -> None:
    """Set the current tenant ID in the context.

    This should be called by middleware after resolving the tenant.
    """
    _tenant_context.set(tenant_id)


__all__ += [
    "TenantIsolationLevel",
    "TenantResolutionStrategy",
    "get_tenant_context",
    "get_current_tenant_id",
    "set_current_tenant_id",
]
