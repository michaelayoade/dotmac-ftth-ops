"""
Authentication dependencies for FastAPI routes.

These can be used to protect endpoints that require authentication.
"""

from typing import Any

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

from dotmac.platform.auth.core import UserInfo, get_current_user, get_current_user_optional

logger = structlog.get_logger(__name__)

# Security scheme for bearer token
security = HTTPBearer(auto_error=False)


async def require_auth(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Require authentication."""
    return user


async def require_user(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Backward-compatible alias for authenticated user requirement."""
    return user


def require_admin(user: UserInfo = Depends(get_current_user)) -> UserInfo:
    """Require admin role."""
    if "admin" not in user.roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_scopes(*scopes: str) -> Any:
    """Require specific scopes/permissions."""

    def check_scopes(user: UserInfo = Depends(get_current_user)) -> UserInfo:
        if not any(scope in user.permissions for scope in scopes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
            )
        return user

    return check_scopes


def require_roles(*roles: str) -> Any:
    """Require specific roles."""

    def check_roles(user: UserInfo = Depends(get_current_user)) -> UserInfo:
        if not any(role in user.roles for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role permissions"
            )
        return user

    return check_roles


# Alias for backward compatibility
CurrentUser = UserInfo

__all__ = [
    "require_auth",
    "require_user",
    "require_admin",
    "require_scopes",
    "require_roles",
    "get_current_user",
    "get_current_user_optional",
    "security",
    "CurrentUser",
    "UserInfo",
]
