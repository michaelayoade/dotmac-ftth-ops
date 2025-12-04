"""
Clean Auth Module for DotMac Platform Services.

Provides authentication and authorization using JWT tokens and sessions.

Usage:
    from dotmac.platform.auth import get_current_user, UserInfo

    @app.get("/protected")
    async def protected(user: UserInfo = Depends(get_current_user)):
        return {"message": f"Hello {user.username}"}
"""

from .core import (  # Services; Service instances; Models; Dependencies; Utilities
    APIKeyService,
    JWTService,
    SessionManager,
    TokenData,
    TokenType,
    UserInfo,
    api_key_service,
    configure_auth,
    create_access_token,
    create_refresh_token,
    get_current_user,
    get_current_user_optional,
    hash_password,
    jwt_service,
    session_manager,
    verify_password,
)
from .dependencies import (
    require_admin,
    require_auth,
    require_roles,
    require_scopes,
    security,
)
from .exceptions import (
    AuthenticationError,
    AuthError,
    InvalidToken,
    TokenExpired,
    get_http_status,
)

__all__ = [
    # Services
    "JWTService",
    "SessionManager",
    "APIKeyService",
    "jwt_service",
    "session_manager",
    "api_key_service",
    # Models
    "UserInfo",
    "TokenData",
    "TokenType",
    # Dependencies
    "get_current_user",
    "get_current_user_optional",
    "require_auth",
    "require_admin",
    "require_scopes",
    "require_roles",
    "security",
    # Utils
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "configure_auth",
    # Exceptions
    "AuthError",
    "AuthenticationError",
    "TokenExpired",
    "InvalidToken",
    "get_http_status",
]
