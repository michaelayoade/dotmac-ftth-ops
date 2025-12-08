"""
Authentication Router for FastAPI.

This is the main auth router that aggregates all sub-routers:
- public_router: Login, logout, token refresh, password reset
- profile_router: User profile management (/me endpoints)
- mfa_router: Two-factor authentication (2FA)
- verification_router: Email and phone verification

The router is organized into modular sub-routers for better maintainability.
"""

from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.email_service import get_auth_email_service
from dotmac.platform.auth.exceptions import AuthError, get_http_status
from dotmac.platform.auth.core import session_manager
from dotmac.platform.db import get_session_dependency

# Import sub-routers
from dotmac.platform.auth.mfa_router import mfa_router
from dotmac.platform.auth.profile_router import profile_router
from dotmac.platform.auth.public_router import (
    clear_auth_cookies,
    get_auth_session,
    get_token_from_cookie,
    public_router,
    set_auth_cookies,
)
from dotmac.platform.auth.verification_router import verification_router

logger = structlog.get_logger(__name__)

# Create main auth router
auth_router = APIRouter(
    prefix="/auth",
)

# Alias used by external imports/tests that expect `router`
router = auth_router


# ========================================
# Include Sub-Routers
# ========================================

# Public routes (login, logout, token refresh, password reset)
auth_router.include_router(public_router)

# Profile routes (/me endpoints)
auth_router.include_router(profile_router)

# MFA routes (2FA management)
auth_router.include_router(mfa_router)

# Verification routes (email/phone verification)
auth_router.include_router(verification_router)


# ========================================
# Exception Handler
# ========================================


async def _auth_exception_handler(request, exc: AuthError) -> JSONResponse:
    """Convert AuthError exceptions to HTTP responses for router-only apps."""
    return JSONResponse(status_code=get_http_status(exc), content=exc.to_dict())


# Register handler when running inside router-only applications
try:
    exception_handlers = getattr(auth_router, "exception_handlers", None)
    if isinstance(exception_handlers, dict):
        exception_handlers[AuthError] = _auth_exception_handler
except Exception:  # pragma: no cover - defensive
    pass


# ========================================
# Legacy Dependency Wrappers
# ========================================
# These are kept for backwards compatibility with tests that patch these symbols


async def get_async_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    """Backwards compatibility adapter for tests that patch this symbol."""
    async for session in get_auth_session():
        yield session


# ========================================
# Exported Symbols
# ========================================

__all__ = [
    # Main router
    "auth_router",
    "router",
    # Sub-routers (for direct access if needed)
    "public_router",
    "profile_router",
    "mfa_router",
    "verification_router",
    # Helper functions (re-exported for backwards compatibility)
    "set_auth_cookies",
    "clear_auth_cookies",
    "get_token_from_cookie",
    "get_auth_session",
    "get_async_session",
    "get_auth_email_service",
    "session_manager",
]
