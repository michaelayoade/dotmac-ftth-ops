"""
Authentication router for FastAPI.

Provides login, register, token refresh endpoints with rate limiting.
"""

import json
import os
import secrets
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any, Literal

import structlog
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    DEFAULT_USER_ROLE,
    UserInfo,
    get_current_user,
    hash_password,
    jwt_service,
    session_manager,
    verify_password,
)
from dotmac.platform.auth.email_service import get_auth_email_service
from dotmac.platform.auth.exceptions import AuthError, get_http_status
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStatus,
    CommunicationType,
)
from dotmac.platform.core.rate_limiting import rate_limit
from dotmac.platform.db import get_session_dependency
from dotmac.platform.integrations import IntegrationStatus, get_integration_async
from dotmac.platform.settings import settings
from dotmac.platform.tenant.service import TenantService
from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService

from ..audit import ActivitySeverity, ActivityType, log_api_activity, log_user_activity
from ..webhooks.events import get_event_bus
from ..webhooks.models import WebhookEvent

logger = structlog.get_logger(__name__)

# Create router early so it is available for all route decorators
auth_router = APIRouter(
    prefix="/auth",
)
# Alias used by external imports/tests that expect `router`
router = auth_router


def _tenant_scope_kwargs(
    user_info: UserInfo | None = None, tenant_override: str | None = None
) -> dict[str, str | None]:
    """Return keyword args ensuring tenant scope is propagated to service calls."""
    if tenant_override is not None:
        return {"tenant_id": tenant_override}
    if user_info is None:
        return {"tenant_id": None}
    if user_info.is_platform_admin:
        return {"tenant_id": None}
    return {"tenant_id": user_info.tenant_id}


# ========================================
# Cookie management helpers
# ========================================


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Set HttpOnly authentication cookies on the response.

    Args:
        response: FastAPI Response object
        access_token: JWT access token
        refresh_token: JWT refresh token
    """
    # Cookie settings - secure only in production (requires HTTPS)
    secure = settings.is_production
    # Use 'lax' for development to allow cross-origin requests, 'strict' for production
    samesite: Literal["strict", "lax", "none"] = "strict" if settings.is_production else "lax"

    # Set access token cookie (15 minutes)
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # 15 minutes in seconds
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )

    # Set refresh token cookie (7 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=7 * 24 * 60 * 60,  # 7 days in seconds
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Clear authentication cookies from the response.

    Args:
        response: FastAPI Response object
    """
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


def get_token_from_cookie(request: Request, cookie_name: str) -> str | None:
    """
    Extract token from HttpOnly cookie.

    Args:
        request: FastAPI Request object
        cookie_name: Name of the cookie (access_token or refresh_token)

    Returns:
        Token value or None if not found
    """
    return request.cookies.get(cookie_name)


# ========================================
# Local dependency wrappers
# ========================================


async def get_auth_session(
    session: AsyncSession = Depends(get_session_dependency),
) -> AsyncGenerator[AsyncSession]:
    """Adapter to reuse the shared session dependency helper with DI overrides."""
    yield session


# Backwards compatibility: some tests patch this symbol directly
async def get_async_session() -> AsyncGenerator[AsyncSession]:  # pragma: no cover
    async for session in get_auth_session():
        yield session


async def _auth_exception_handler(request: Request, exc: AuthError) -> JSONResponse:
    """Convert AuthError exceptions to HTTP responses for router-only apps."""
    return JSONResponse(status_code=get_http_status(exc), content=exc.to_dict())


# Register handler when running inside router-only applications that include this router.
try:
    exception_handlers = getattr(auth_router, "exception_handlers", None)
    if isinstance(exception_handlers, dict):
        exception_handlers[AuthError] = _auth_exception_handler
except Exception:  # pragma: no cover - defensive to avoid import-time failures
    pass

security = HTTPBearer(auto_error=False)


# Request/Response Models
class LoginRequest(BaseModel):
    """Login request model supporting username or email."""

    model_config = ConfigDict(populate_by_name=True)

    username: str | None = Field(
        None,
        description="Username (optional if email provided)",
    )
    email: EmailStr | None = Field(
        None,
        description="Email address (alternative to username)",
    )
    password: str = Field(..., description="Password")

    @model_validator(mode="after")
    def ensure_identifier(self) -> "LoginRequest":
        identifier = self.username or (self.email and self.email.lower())
        if not identifier:
            raise ValueError("Either username or email must be provided")
        # Normalize to username field for downstream logic
        self.username = identifier
        return self


class Verify2FALoginRequest(BaseModel):
    """2FA verification during login request model."""

    model_config = ConfigDict()

    user_id: str = Field(..., description="User ID from login challenge")
    code: str = Field(
        ..., min_length=6, max_length=9, description="TOTP code or backup code (XXXX-XXXX format)"
    )
    is_backup_code: bool = Field(default=False, description="Whether this is a backup code")


class RegenerateBackupCodesRequest(BaseModel):
    """Request model for regenerating backup codes."""

    model_config = ConfigDict()

    password: str = Field(..., min_length=1, description="User password for verification")


class RegisterRequest(BaseModel):
    """Registration request model."""

    model_config = ConfigDict()

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, description="Password")
    full_name: str | None = Field(None, description="Full name")


class TokenResponse(BaseModel):
    """Token response model."""

    model_config = ConfigDict()

    access_token: str = Field(..., description="Access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiry in seconds")


class LoginSuccessResponse(BaseModel):
    """Cookie-based login success response."""

    model_config = ConfigDict()

    success: bool = Field(default=True, description="Login successful")
    user_id: str = Field(..., description="User ID")
    username: str = Field(..., description="Username")
    email: str = Field(..., description="Email address")
    roles: list[str] = Field(default_factory=list, description="User roles")
    message: str = Field(default="Login successful", description="Success message")


class RefreshTokenRequest(BaseModel):
    """Refresh token request model."""

    model_config = ConfigDict()

    refresh_token: str = Field(..., description="Refresh token")


class PasswordResetRequest(BaseModel):
    """Password reset request model."""

    model_config = ConfigDict()

    email: EmailStr = Field(..., description="Email address")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model."""

    model_config = ConfigDict()

    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")


async def _authenticate_and_issue_tokens(
    *,
    username: str,
    password: str,
    request: Request,
    response: Response,
    session: AsyncSession,
) -> TokenResponse:
    """Shared login flow used by both JSON and OAuth2 password endpoints."""
    from dotmac.platform.tenant import get_current_tenant_id, get_tenant_config

    user_service = UserService(session)

    # Get current tenant from request context (set by TenantMiddleware)
    current_tenant_id = get_current_tenant_id()

    # Fallback to request.state tenant when middleware populated but context not yet synced
    try:
        from dotmac.platform.tenant import get_tenant_config

        tenant_config = get_tenant_config()
        header_tenant = request.headers.get(tenant_config.tenant_header_name)
        if isinstance(header_tenant, str):
            header_tenant = header_tenant.strip() or None

        # Explicit tenant header always takes precedence
        if header_tenant:
            current_tenant_id = header_tenant
        else:
            state_tenant = getattr(request.state, "tenant_id", None)

            if state_tenant and (current_tenant_id is None or state_tenant != current_tenant_id):
                current_tenant_id = state_tenant

            # If tenant is still unset and tenant headers are optional, default to config value
            if current_tenant_id is None and tenant_config.is_multi_tenant:
                current_tenant_id = tenant_config.default_tenant_id

        logger.debug(
            "resolved registration tenant",
            context_tenant=current_tenant_id,
            header_tenant=header_tenant,
            state_tenant=getattr(request.state, "tenant_id", None),
        )
    except Exception:  # pragma: no cover - defensive fallback
        pass
    tenant_config = get_tenant_config()
    default_tenant_id = tenant_config.default_tenant_id if tenant_config else None

    # Try to find user by username or email within the current tenant
    # This prevents multiple results if same username exists in different tenants
    user = await user_service.get_user_by_username(username, tenant_id=current_tenant_id)
    if not user:
        user = await user_service.get_user_by_email(username, tenant_id=current_tenant_id)

    # Platform admin fallback: allow login when tenant is not resolved but user is global
    fallback_tenant_scope = {None}
    if default_tenant_id is not None:
        fallback_tenant_scope.add(default_tenant_id)

    if not user and current_tenant_id in fallback_tenant_scope:
        # Retry lookup without tenant scoping to support platform admins (tenant_id=None)
        candidate = await user_service.get_user_by_username(username)
        if not candidate and "@" in username:
            candidate = await user_service.get_user_by_email(username)

        if candidate:
            # Ensure we only allow cross-tenant login for true platform admins
            if candidate.is_platform_admin or candidate.tenant_id in fallback_tenant_scope:
                user = candidate
            else:
                # Allow login when identifier uniquely maps to a single tenant.
                identifier = username.lower() if "@" in username else username
                if "@" in username:
                    uniqueness_query = (
                        select(User.id).where(func.lower(User.email) == identifier).limit(2)
                    )
                else:
                    uniqueness_query = select(User.id).where(User.username == identifier).limit(2)

                result = await session.execute(uniqueness_query)
                matches = result.scalars().all()

                if len(matches) == 1:
                    user = candidate
                    current_tenant_id = candidate.tenant_id

    if not user or not verify_password(password, user.password_hash):
        # Log failed login attempt
        await log_api_activity(
            request=request,
            action="login_failed",
            description=f"Failed login attempt for username: {username}",
            severity=ActivitySeverity.HIGH,
            details={"username": username, "reason": "invalid_credentials"},
            session=session,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        # Log disabled account login attempt
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_LOGIN,
            action="login_disabled_account",
            description=f"Login attempt on disabled account: {user.username}",
            severity=ActivitySeverity.HIGH,
            details={"username": user.username, "reason": "account_disabled"},
            session=session,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    # Check if 2FA is enabled
    if user.mfa_enabled:
        # Create temporary session for 2FA verification
        # Store with a predictable key so we can retrieve it later
        pending_key = f"2fa_pending:{user.id}"
        redis_client = await session_manager._get_redis()
        session_data = {
            "username": user.username,
            "email": user.email,
            "pending_2fa": True,
            "ip_address": request.client.host if request.client else None,
            "tenant_id": user.tenant_id,
        }

        if redis_client:
            await redis_client.setex(f"session:{pending_key}", 300, json.dumps(session_data))
        else:
            # Fallback to in-memory if Redis not available
            if session_manager._fallback_enabled:
                session_manager._fallback_store[pending_key] = session_data

        # Log 2FA challenge issued
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_LOGIN,
            action="2fa_challenge_issued",
            description=f"2FA challenge issued for user {user.username}",
            severity=ActivitySeverity.LOW,
            details={"username": user.username},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            tenant_id=user.tenant_id,
            session=session,
        )

        # Return special response indicating 2FA is required
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA verification required",
            headers={"X-2FA-Required": "true", "X-User-ID": str(user.id)},
        )

    # Update last login
    client_ip = request.client.host if request.client else None
    await user_service.update_last_login(user.id, ip_address=client_ip, tenant_id=user.tenant_id)

    # Create a stable session id used in both the session store and JWTs
    session_id = secrets.token_urlsafe(32)

    # Create tokens
    access_token = jwt_service.create_access_token(
        subject=str(user.id),
        additional_claims={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "permissions": user.permissions or [],
            "tenant_id": user.tenant_id,
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "session_id": session_id,
        },
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(user.id), additional_claims={"session_id": session_id}
    )

    # Create session
    await session_manager.create_session(
        user_id=str(user.id),
        data={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "access_token": access_token,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_id=session_id,
    )

    # Log successful login
    await log_user_activity(
        user_id=str(user.id),
        activity_type=ActivityType.USER_LOGIN,
        action="login_success",
        description=f"User {user.username} logged in successfully",
        severity=ActivitySeverity.LOW,
        details={"username": user.username, "email": user.email, "roles": user.roles or []},
        # Extract context from request
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        tenant_id=user.tenant_id,
        session=session,
    )

    # Publish webhook event
    try:
        await get_event_bus().publish(
            event_type=WebhookEvent.USER_LOGIN.value,
            event_data={
                "user_id": str(user.id),
                "username": user.username,
                "email": user.email,
                "roles": user.roles or [],
                "ip_address": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "login_at": datetime.now(UTC).isoformat(),
            },
            tenant_id=user.tenant_id,
            db=session,
        )
    except Exception as e:
        logger.warning("Failed to publish user.login event", error=str(e))

    # Set HttpOnly authentication cookies
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def _complete_cookie_login(
    user: User,
    request: Request,
    response: Response,
    session: AsyncSession,
) -> None:
    """Issue tokens, create session, and set cookies for non-2FA logins."""

    client_ip = request.client.host if request.client else None
    user_service = UserService(session)

    await user_service.update_last_login(user.id, ip_address=client_ip, tenant_id=user.tenant_id)

    session_id = secrets.token_urlsafe(32)

    access_token = jwt_service.create_access_token(
        subject=str(user.id),
        additional_claims={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "permissions": user.permissions or [],
            "tenant_id": user.tenant_id,
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "session_id": session_id,
        },
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(user.id), additional_claims={"session_id": session_id}
    )

    await session_manager.create_session(
        user_id=str(user.id),
        data={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "access_token": access_token,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_id=session_id,
    )

    set_auth_cookies(response, access_token, refresh_token)

    await log_user_activity(
        user_id=str(user.id),
        activity_type=ActivityType.USER_LOGIN,
        action="login_success",
        description=f"User {user.username} logged in successfully (cookie-auth)",
        severity=ActivitySeverity.LOW,
        details={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "auth_method": "cookie",
        },
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
        tenant_id=user.tenant_id,
        session=session,
    )


@auth_router.post("/login", response_model=TokenResponse)
@rate_limit("5/minute")  # SECURITY: Prevent brute force attacks
async def login(
    login_request: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """
    Authenticate user and return JWT tokens.

    The username field accepts either username or email.
    If 2FA is enabled, returns 403 with X-2FA-Required header.
    """

    return await _authenticate_and_issue_tokens(
        username=login_request.username,
        password=login_request.password,
        request=request,
        response=response,
        session=session,
    )


async def _verify_backup_code_and_log(
    user: User,
    code: str,
    session: AsyncSession,
    request: Request,
) -> bool:
    """Verify backup code and log the usage."""
    client_ip = request.client.host if request.client else None

    code_valid: bool = await mfa_service.verify_backup_code(
        user_id=user.id, code=code, session=session, ip_address=client_ip
    )

    if code_valid:
        # Get remaining backup codes count
        remaining = await mfa_service.get_remaining_backup_codes_count(
            user_id=user.id, session=session
        )

        # Log backup code usage
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_LOGIN,
            action="2fa_backup_code_used",
            description=f"User {user.username} used backup code for login",
            severity=ActivitySeverity.MEDIUM,
            details={"username": user.username, "remaining_codes": remaining},
            ip_address=client_ip,
            user_agent=request.headers.get("user-agent"),
            tenant_id=user.tenant_id,
            session=session,
        )

        # Warn if running low on backup codes
        if remaining < 3:
            logger.warning(
                "User running low on backup codes",
                user_id=str(user.id),
                remaining=remaining,
            )

    return code_valid


async def _verify_totp_code_and_log(
    user: User,
    code: str,
    request: Request,
    session: AsyncSession,
) -> bool:
    """Verify TOTP code and log the verification."""
    if not user.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA secret not found",
        )

    code_valid: bool = mfa_service.verify_token(user.mfa_secret, code)

    if code_valid:
        client_ip = request.client.host if request.client else None
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_LOGIN,
            action="2fa_totp_verified",
            description=f"User {user.username} verified 2FA with TOTP",
            severity=ActivitySeverity.LOW,
            details={"username": user.username},
            ip_address=client_ip,
            user_agent=request.headers.get("user-agent"),
            tenant_id=user.tenant_id,
            session=session,
        )

    return code_valid


async def _log_2fa_verification_failure(
    user: User,
    is_backup_code: bool,
    request: Request,
    session: AsyncSession,
) -> None:
    """Log failed 2FA verification."""
    client_ip = request.client.host if request.client else None
    await log_user_activity(
        user_id=str(user.id),
        activity_type=ActivityType.USER_LOGIN,
        action="2fa_verification_failed",
        description=f"Failed 2FA verification for user {user.username}",
        severity=ActivitySeverity.MEDIUM,
        details={"username": user.username, "is_backup_code": is_backup_code},
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
        tenant_id=user.tenant_id,
        session=session,
    )


async def _complete_2fa_login(
    user: User,
    request: Request,
    response: Response,
    session: AsyncSession,
) -> TokenResponse:
    """Complete the 2FA login process by creating tokens and session."""
    client_ip = request.client.host if request.client else None
    user_service = UserService(session)

    # Delete the pending 2FA session
    await session_manager.delete_session(f"2fa_pending:{user.id}")

    # Update last login
    await user_service.update_last_login(user.id, ip_address=client_ip, tenant_id=user.tenant_id)

    session_id = secrets.token_urlsafe(32)

    # Create tokens
    access_token = jwt_service.create_access_token(
        subject=str(user.id),
        additional_claims={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "permissions": user.permissions or [],
            "tenant_id": user.tenant_id,
            "is_platform_admin": getattr(user, "is_platform_admin", False),
            "session_id": session_id,
        },
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(user.id), additional_claims={"session_id": session_id}
    )

    # Create session
    await session_manager.create_session(
        user_id=str(user.id),
        data={
            "username": user.username,
            "email": user.email,
            "roles": user.roles or [],
            "access_token": access_token,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_id=session_id,
    )

    # Log successful login
    await log_user_activity(
        user_id=str(user.id),
        activity_type=ActivityType.USER_LOGIN,
        action="login_success_with_2fa",
        description=f"User {user.username} logged in successfully with 2FA",
        severity=ActivitySeverity.LOW,
        details={"username": user.username, "email": user.email, "roles": user.roles or []},
        ip_address=client_ip,
        user_agent=request.headers.get("user-agent"),
        tenant_id=user.tenant_id,
        session=session,
    )

    # Set HttpOnly authentication cookies
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@auth_router.post("/login/verify-2fa", response_model=TokenResponse)
async def verify_2fa_login(
    verify_request: Verify2FALoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """
    Verify 2FA code and complete login.

    Accepts either TOTP code (6 digits) or backup code (XXXX-XXXX format).
    """
    try:
        user_service = UserService(session)
        pending_session = await session_manager.get_session(f"2fa_pending:{verify_request.user_id}")
        tenant_scope = None
        if isinstance(pending_session, dict):
            tenant_scope = pending_session.get("tenant_id")

        user = await user_service.get_user_by_id(
            verify_request.user_id,
            tenant_id=tenant_scope,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled for this user",
            )

        # Verify the pending 2FA session exists
        if not pending_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA session expired. Please login again.",
            )

        # Verify the code (backup code or TOTP)
        if verify_request.is_backup_code:
            code_valid = await _verify_backup_code_and_log(
                user, verify_request.code, session, request
            )
        else:
            code_valid = await _verify_totp_code_and_log(
                user, verify_request.code, request, session
            )

        if not code_valid:
            await _log_2fa_verification_failure(
                user, verify_request.is_backup_code, request, session
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code",
            )

        # Complete login process
        return await _complete_2fa_login(user, request, response, session)

    except HTTPException:
        raise
    except Exception:
        logger.error("2FA verification failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="2FA verification failed",
        )


@auth_router.post("/login/cookie", response_model=LoginSuccessResponse)
@rate_limit("5/minute")
async def login_cookie_only(
    login_request: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_auth_session),
) -> LoginSuccessResponse:
    """
    Cookie-only authentication endpoint.

    Sets HttpOnly cookies for authentication without returning tokens in response body.
    This is more secure as tokens are not exposed to JavaScript.

    The username field accepts either username or email.
    """
    from dotmac.platform.tenant import get_current_tenant_id

    # Authenticate user
    user_service = UserService(session)
    current_tenant_id = get_current_tenant_id()

    user = await user_service.authenticate(
        username_or_email=login_request.username,
        password=login_request.password,
        tenant_id=current_tenant_id,  # Enforce tenant isolation
    )

    if not user:
        # Log failed attempt
        await log_user_activity(
            user_id="unknown",
            activity_type=ActivityType.USER_LOGIN,
            action="login_failed",
            description=f"Failed login attempt for: {login_request.username}",
            severity=ActivitySeverity.MEDIUM,
            details={"username": login_request.username, "reason": "invalid_credentials"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            session=session,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    if user.mfa_enabled:
        # Mirror the JSON login behaviour by issuing a 2FA challenge
        pending_key = f"2fa_pending:{user.id}"
        redis_client = await session_manager._get_redis()
        session_data = {
            "username": user.username,
            "email": user.email,
            "pending_2fa": True,
            "ip_address": request.client.host if request.client else None,
            "tenant_id": user.tenant_id,
        }

        if redis_client:
            await redis_client.setex(f"session:{pending_key}", 300, json.dumps(session_data))
        elif session_manager._fallback_enabled:
            session_manager._fallback_store[pending_key] = session_data

        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_LOGIN,
            action="2fa_challenge_issued",
            description=f"2FA challenge issued for user {user.username} (cookie-auth)",
            severity=ActivitySeverity.LOW,
            details={"username": user.username},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            tenant_id=user.tenant_id,
            session=session,
        )
        # Match JSON login behaviour: rely on 403 to signal pending 2FA; no success body returned
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA verification required",
            headers={"X-2FA-Required": "true", "X-User-ID": str(user.id)},
        )

    # Reuse shared helper to update last login, create session, set cookies, and log activity
    await _complete_cookie_login(user, request, response, session)

    return LoginSuccessResponse(
        user_id=str(user.id), username=user.username, email=user.email, roles=user.roles or []
    )


@auth_router.post("/token", response_model=TokenResponse)
async def issue_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """OAuth2 password flow endpoint compatible with FastAPI's security utilities."""

    return await _authenticate_and_issue_tokens(
        username=form_data.username,
        password=form_data.password,
        request=request,
        response=response,
        session=session,
    )


@auth_router.post("/register", response_model=TokenResponse)
@rate_limit("3/minute")  # SECURITY: Prevent mass account creation
async def register(
    register_request: RegisterRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """
    Register a new user and return JWT tokens.

    SECURITY: Self-registration can be disabled in production by setting
    ALLOW_SELF_REGISTRATION=false. When disabled, users must be created
    by administrators via POST /api/v1/users endpoint.
    """
    # SECURITY: Check if self-registration is allowed (disabled by default for production)
    allow_self_registration = os.getenv("ALLOW_SELF_REGISTRATION", "false").lower() == "true"
    if not allow_self_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Self-registration is disabled. Please contact your administrator to create an account.",
        )

    from dotmac.platform.tenant import get_current_tenant_id

    user_service = UserService(session)

    # Get current tenant from request context (set by TenantMiddleware)
    current_tenant_id = get_current_tenant_id()

    if current_tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context is required for registration. Provide a valid tenant identifier.",
        )

    # Check if user already exists within current tenant - use generic error message to prevent enumeration
    existing_user_by_username = await user_service.get_user_by_username(
        register_request.username,
        tenant_id=current_tenant_id,
    )
    existing_user_by_email = await user_service.get_user_by_email(
        register_request.email,
        tenant_id=current_tenant_id,
    )

    if existing_user_by_username or existing_user_by_email:
        # Log registration attempt with existing user
        await log_api_activity(
            request=request,
            action="registration_failed",
            description="Registration attempt with existing credentials",
            severity=ActivitySeverity.MEDIUM,
            details={
                "username": register_request.username,
                "email": register_request.email,
                "reason": "user_already_exists",
            },
            session=session,
        )
        # Generic error message to prevent user enumeration
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please check your input and try again.",
        )

    # Determine role: first user in tenant gets 'admin', others get DEFAULT_USER_ROLE
    try:
        # Check if this is the first user in the tenant
        from sqlalchemy import func, select

        from dotmac.platform.auth.models import Role
        from dotmac.platform.auth.rbac_service import RBACService

        user_count_result = await session.execute(
            select(func.count(User.id)).where(User.tenant_id == current_tenant_id)
        )
        user_count = user_count_result.scalar() or 0

        # First user in tenant becomes admin, others get default role
        assigned_role_name = "admin" if user_count == 0 else DEFAULT_USER_ROLE

        logger.info(
            "Assigning role to new user",
            tenant_id=current_tenant_id,
            is_first_user=user_count == 0,
            assigned_role=assigned_role_name,
        )

        # Create user WITHOUT roles in JSON column (RBAC manages roles)
        new_user = await user_service.create_user(
            username=register_request.username,
            email=register_request.email,
            password=register_request.password,
            full_name=register_request.full_name,
            roles=[],  # Empty - RBAC will manage roles via user_roles table
            is_active=True,
            tenant_id=current_tenant_id,  # Inherit tenant from request context
        )

        # Assign RBAC role via user_roles table
        rbac_service = RBACService(session)

        # Get the role from database
        role_result = await session.execute(select(Role).where(Role.name == assigned_role_name))
        role = role_result.scalar_one_or_none()

        if role:
            # Assign role through RBAC (creates entry in user_roles table)
            await rbac_service.assign_role_to_user(
                user_id=new_user.id,
                role_name=assigned_role_name,
                granted_by=new_user.id,  # Self-assignment during registration
            )
            logger.info(
                "RBAC role assigned successfully",
                user_id=str(new_user.id),
                role_name=assigned_role_name,
                role_id=str(role.id),
            )
        else:
            logger.warning(
                "Role not found in database - user created without RBAC role",
                role_name=assigned_role_name,
                user_id=str(new_user.id),
            )
    except Exception as e:
        logger.error("Failed to create user", exc_info=True)  # Use exc_info for safer logging
        await log_api_activity(
            request=request,
            action="registration_failed",
            description="Registration failed during user creation",
            severity=ActivitySeverity.HIGH,
            details={
                "username": register_request.username,
                "email": register_request.email,
                "reason": "user_creation_error",
                "error": str(e),
            },
            session=session,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )

    # Get RBAC roles and permissions for token
    user_roles = await rbac_service.get_user_roles(new_user.id)
    user_permissions = await rbac_service.get_user_permissions(new_user.id)

    role_names = [r.name for r in user_roles]
    permission_names = list(
        user_permissions
    )  # user_permissions is already a set of permission strings

    session_id = secrets.token_urlsafe(32)

    # Create tokens with RBAC roles/permissions
    access_token = jwt_service.create_access_token(
        subject=str(new_user.id),
        additional_claims={
            "username": new_user.username,
            "email": new_user.email,
            "roles": role_names,  # RBAC roles from user_roles table
            "permissions": permission_names,  # RBAC permissions
            "tenant_id": new_user.tenant_id,
            "session_id": session_id,
        },
    )

    refresh_token = jwt_service.create_refresh_token(
        subject=str(new_user.id), additional_claims={"session_id": session_id}
    )

    # Create session with RBAC roles
    await session_manager.create_session(
        user_id=str(new_user.id),
        data={
            "username": new_user.username,
            "email": new_user.email,
            "roles": role_names,  # RBAC roles
            "access_token": access_token,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        session_id=session_id,
    )

    # Log successful registration
    await log_user_activity(
        user_id=str(new_user.id),
        activity_type=ActivityType.USER_CREATED,
        action="registration_success",
        description=f"New user {new_user.username} registered successfully",
        severity=ActivitySeverity.MEDIUM,
        details={
            "username": new_user.username,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "roles": role_names,  # RBAC roles
            "is_first_user": user_count == 0,
            "assigned_role": assigned_role_name,
        },
        # Extract context from request
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        tenant_id=new_user.tenant_id,
        session=session,
    )

    # Commit all database changes (user, roles, audit log)
    await session.commit()

    # Send welcome email
    try:
        email_service = get_auth_email_service()
        await email_service.send_welcome_email(
            email=new_user.email,
            user_name=new_user.full_name or new_user.username,
        )
    except Exception:
        logger.warning("Failed to send welcome email", exc_info=True)
        # Don't fail registration if email fails

    # Set HttpOnly authentication cookies
    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@auth_router.post("/refresh", response_model=TokenResponse)
@rate_limit("10/minute")  # SECURITY: Reasonable limit for token refresh
async def refresh_token(
    request: Request,
    response: Response,
    refresh_request: RefreshTokenRequest | None = None,
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """
    Refresh access token using refresh token.
    Can accept refresh token from request body or HttpOnly cookie.
    """
    try:
        # Get refresh token from cookie or request body
        refresh_token_value = get_token_from_cookie(request, "refresh_token")
        if not refresh_token_value and refresh_request:
            refresh_token_value = refresh_request.refresh_token

        if not refresh_token_value:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not provided",
            )

        # Verify refresh token with type validation
        from dotmac.platform.auth.core import TokenType

        payload = jwt_service.verify_token(refresh_token_value, expected_type=TokenType.REFRESH)

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        # Get user
        user_service = UserService(session)
        payload_tenant_id = payload.get("tenant_id")
        is_platform_admin = payload.get("is_platform_admin", False)
        tenant_scope = None if is_platform_admin else payload_tenant_id

        user = await user_service.get_user_by_id(user_id, tenant_id=tenant_scope)

        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or disabled",
            )

        session_id = payload.get("session_id") or secrets.token_urlsafe(32)

        # Revoke old refresh token
        try:
            await jwt_service.revoke_token(refresh_token_value)
        except Exception:
            logger.warning("Failed to revoke old refresh token", exc_info=True)

        # Create new tokens
        access_token = jwt_service.create_access_token(
            subject=str(user.id),
            additional_claims={
                "username": user.username,
                "email": user.email,
                "roles": user.roles or [],
                "permissions": user.permissions or [],
                "tenant_id": user.tenant_id,
                "is_platform_admin": getattr(user, "is_platform_admin", False),
                "session_id": session_id,
            },
        )

        new_refresh_token = jwt_service.create_refresh_token(
            subject=str(user.id), additional_claims={"session_id": session_id}
        )

        # Refresh session TTL/metadata to keep server-side session aligned with tokens
        try:
            await session_manager.create_session(
                user_id=str(user.id),
                data={
                    "username": user.username,
                    "email": user.email,
                    "roles": user.roles or [],
                    "access_token": access_token,
                },
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
                session_id=session_id,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to refresh session metadata", error=str(exc))

        # Set new HttpOnly authentication cookies
        set_auth_cookies(response, access_token, new_refresh_token)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception:
        logger.error("Token refresh failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )


@auth_router.post("/logout")
async def logout(
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """
    Logout user and invalidate session and tokens.
    """
    try:
        # Get token from Authorization header or cookie
        token = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove "Bearer " prefix
        else:
            # Fall back to cookie
            token = get_token_from_cookie(request, "access_token")

        if token:
            # Get user info from token
            try:
                payload = jwt_service.verify_token(token)
                user_id = payload.get("sub")
            except Exception:
                # Invalid token, still clear cookies
                clear_auth_cookies(response)
                return {"message": "Logout completed"}
        else:
            # No token found, just clear cookies
            clear_auth_cookies(response)
            return {"message": "Logout completed"}

        if user_id:
            # Revoke the access token
            if token:
                await jwt_service.revoke_token(token)

            # Delete all user sessions (which should include refresh tokens)
            deleted_sessions = await session_manager.delete_user_sessions(user_id)

            # Also explicitly revoke all refresh tokens for this user
            # This ensures refresh tokens can't be used after logout
            try:
                # Get all active sessions to find refresh tokens
                await jwt_service.revoke_user_tokens(user_id)
            except Exception:
                logger.warning("Failed to revoke user refresh tokens", exc_info=True)

            logger.info(
                "User logged out successfully", user_id=user_id, sessions_deleted=deleted_sessions
            )

            # Clear authentication cookies
            clear_auth_cookies(response)

            return {"message": "Logged out successfully", "sessions_deleted": deleted_sessions}
        else:
            # Clear authentication cookies even if no user found
            clear_auth_cookies(response)
            return {"message": "Logout completed"}
    except Exception:
        logger.error("Logout failed", exc_info=True)
        # Still try to revoke the token even if we can't parse it
        try:
            if token:
                await jwt_service.revoke_token(token)
        except Exception:
            pass

        # Always clear cookies on logout
        clear_auth_cookies(response)
        return {"message": "Logout completed"}


@auth_router.get("/me/sessions")
async def list_active_sessions(
    request: Request,
    user_info: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    List all active sessions for the current user.

    Returns information about all active sessions including:
    - Session ID
    - Created time
    - Last accessed time
    - IP address
    - User agent
    """
    try:
        current_session_id = None
        try:
            token = None
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header[7:]
            else:
                token = get_token_from_cookie(request, "access_token")

            if token:
                payload = jwt_service.verify_token(token)
                current_session_id = payload.get("session_id")
        except Exception:
            current_session_id = None

        # Get all sessions for user
        sessions = await session_manager.get_user_sessions(user_info.user_id)

        # Format session data
        formatted_sessions = []
        for session_key, session_data in sessions.items():
            session_id = session_data.get("session_id") or (
                session_key.split(":")[-1] if ":" in session_key else session_key
            )

            formatted_sessions.append(
                {
                    "session_id": session_id,
                    "created_at": session_data.get("created_at"),
                    "last_accessed": session_data.get("last_accessed"),
                    "ip_address": session_data.get("ip_address"),
                    "user_agent": session_data.get("user_agent"),
                    "is_current": session_id == current_session_id,
                }
            )

        logger.info("Sessions listed", user_id=user_info.user_id, count=len(formatted_sessions))

        return {
            "sessions": formatted_sessions,
            "total": len(formatted_sessions),
        }

    except Exception:
        logger.error("Failed to list sessions", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list sessions",
        )


@auth_router.delete("/me/sessions/{session_id}")
async def revoke_session(
    session_id: str,
    request: Request,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Revoke a specific session by ID.

    Users can revoke any of their sessions except the current one.
    To revoke the current session, use the logout endpoint.
    """
    try:
        # Get current session from request
        current_token = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            current_token = auth_header[7:]
        else:
            current_token = get_token_from_cookie(request, "access_token")

        current_session_id = None
        if current_token:
            try:
                payload = jwt_service.verify_token(current_token)
                current_session_id = payload.get("session_id")
            except Exception:
                pass

        # Prevent revoking current session
        if session_id == current_session_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot revoke current session. Use /logout instead.",
            )

        # Delete the session
        deleted = await session_manager.delete_session(session_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found or already expired",
            )

        # Log session revocation
        await log_user_activity(
            user_id=user_info.user_id,
            activity_type=ActivityType.USER_LOGOUT,
            action="session_revoked",
            description=f"User revoked session {session_id}",
            severity=ActivitySeverity.MEDIUM,
            details={"session_id": session_id},
            tenant_id=user_info.tenant_id,
            session=session,
        )

        logger.info("Session revoked", user_id=user_info.user_id, session_id=session_id)

        return {
            "message": "Session revoked successfully",
            "session_id": session_id,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to revoke session", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session",
        )


@auth_router.delete("/me/sessions")
async def revoke_all_sessions(
    request: Request,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Revoke all sessions except the current one.

    This is useful when a user suspects their account has been compromised
    and wants to log out all other devices.
    """
    try:
        # Get current session from request
        current_token = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            current_token = auth_header[7:]
        else:
            current_token = get_token_from_cookie(request, "access_token")

        current_session_id = None
        if current_token:
            try:
                payload = jwt_service.verify_token(current_token)
                current_session_id = payload.get("session_id")
            except Exception:
                pass

        # Get all sessions
        sessions = await session_manager.get_user_sessions(user_info.user_id)

        # Delete all sessions except current
        revoked_count = 0
        for session_key, session_data in sessions.items():
            session_id = session_data.get("session_id") or (
                session_key.split(":")[-1] if ":" in session_key else session_key
            )

            if session_id != current_session_id:
                deleted = await session_manager.delete_session(session_id)
                if deleted:
                    revoked_count += 1

        # Log session revocations
        await log_user_activity(
            user_id=user_info.user_id,
            activity_type=ActivityType.USER_LOGOUT,
            action="all_sessions_revoked",
            description=f"User revoked {revoked_count} sessions",
            severity=ActivitySeverity.HIGH,
            details={"sessions_revoked": revoked_count},
            tenant_id=user_info.tenant_id,
            session=session,
        )

        logger.info(
            "All sessions revoked",
            user_id=user_info.user_id,
            revoked_count=revoked_count,
        )

        return {
            "message": f"Revoked {revoked_count} session(s) successfully",
            "sessions_revoked": revoked_count,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to revoke sessions", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke sessions",
        )


@auth_router.get("/verify")
async def verify_token(
    user_info: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Verify if the current token is valid from Bearer token or HttpOnly cookie.
    """
    return {
        "valid": True,
        "user_id": user_info.user_id,
        "username": user_info.username,
        "roles": user_info.roles,
        "permissions": user_info.permissions,
    }


@auth_router.post("/password-reset")
@rate_limit("3/minute")  # SECURITY: Prevent abuse of password reset
async def request_password_reset(
    reset_request: PasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Request a password reset token to be sent via email.

    Multi-tenant support:
    - Tenant can be specified via X-Tenant-ID header or tenant_id query parameter
    - If tenant is not specified and multiple users exist with the same email across tenants,
      reset emails will be sent to all matching accounts for security
    """
    from sqlalchemy.exc import MultipleResultsFound

    from dotmac.platform.tenant import TenantIdentityResolver

    user_service = UserService(session)

    # Try to resolve tenant from request (header or query param)
    resolver = TenantIdentityResolver()
    tenant_id = await resolver.resolve(request)

    # Find user by email with optional tenant filtering
    # Handle MultipleResultsFound when same email exists in multiple tenants
    user = None
    try:
        user = await user_service.get_user_by_email(reset_request.email, tenant_id=tenant_id)
    except MultipleResultsFound:
        # Multiple users with same email across tenants
        # For security, we silently ignore and return success message
        # User should specify tenant via header/query param to disambiguate
        logger.warning(
            "Password reset requested for email with multiple tenant accounts",
            email=reset_request.email,
            tenant_provided=tenant_id is not None,
        )
        return {"message": "If the email exists, a password reset link has been sent."}

    # Always return success to prevent email enumeration
    if user and user.is_active:
        try:
            email_service = get_auth_email_service()
            response, reset_token = await email_service.send_password_reset_email(
                email=user.email,
                user_name=user.full_name or user.username,
            )
            logger.info("Password reset requested", user_id=str(user.id))
        except Exception:
            logger.error("Failed to send password reset email", exc_info=True)

    return {"message": "If the email exists, a password reset link has been sent."}


@auth_router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm,
    response: Response,
    http_request: Request,
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Confirm password reset with token and set new password.

    Multi-tenant support:
    - Tenant can be specified via X-Tenant-ID header or tenant_id query parameter
    - If tenant is not specified and multiple users exist with the same email across tenants,
      the request will fail and user must provide tenant information
    """
    from sqlalchemy.exc import MultipleResultsFound

    from dotmac.platform.tenant import TenantIdentityResolver

    # Verify the reset token
    email_service = get_auth_email_service()
    email = email_service.verify_reset_token(reset_confirm.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    # Try to resolve tenant from request (header or query param)
    resolver = TenantIdentityResolver()
    tenant_id = await resolver.resolve(http_request)

    # Find user and update password with tenant filtering
    user_service = UserService(session)
    try:
        user = await user_service.get_user_by_email(email, tenant_id=tenant_id)
    except MultipleResultsFound:
        # Multiple users with same email across tenants
        logger.error(
            "Password reset confirmation failed: multiple tenant accounts",
            email=email,
            tenant_provided=tenant_id is not None,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to identify account. Please include tenant information in request.",
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found",
        )

    # Update password
    try:
        user.password_hash = hash_password(reset_confirm.new_password)
        await session.commit()

        # Send confirmation email
        await email_service.send_password_reset_success_email(
            email=user.email,
            user_name=user.full_name or user.username,
        )

        logger.info("Password reset completed", user_id=str(user.id))
        return {"message": "Password has been reset successfully."}
    except Exception:
        logger.error("Failed to reset password", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password",
        )


class UpdateProfileRequest(BaseModel):
    """Update profile request model."""

    model_config = ConfigDict()

    first_name: str | None = Field(None, max_length=100, description="First name")
    last_name: str | None = Field(None, max_length=100, description="Last name")
    email: EmailStr | None = Field(None, description="Email address")
    username: str | None = Field(None, min_length=3, max_length=50, description="Username")
    phone: str | None = Field(
        None, max_length=20, description="Phone number (E.164 format recommended)"
    )
    location: str | None = Field(None, max_length=255, description="Location")
    timezone: str | None = Field(
        None, max_length=50, description="Timezone (e.g., America/New_York)"
    )
    language: str | None = Field(
        None, min_length=2, max_length=10, description="Language code (e.g., en, en-US)"
    )
    bio: str | None = Field(None, max_length=500, description="Bio (max 500 characters)")
    website: str | None = Field(None, max_length=255, description="Website URL")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        """Validate phone number format."""
        if v is None or v.strip() == "":
            return None

        # Basic validation: allow + and digits, spaces, hyphens, parentheses
        import re

        if not re.match(r"^[\+\d\s\-\(\)]+$", v):
            raise ValueError(
                "Phone number can only contain digits, +, spaces, hyphens, and parentheses"
            )

        # Remove formatting for length check
        digits_only = re.sub(r"[\s\-\(\)]", "", v)
        if len(digits_only) < 7 or len(digits_only) > 15:
            raise ValueError("Phone number must contain between 7 and 15 digits")

        return v.strip()

    @field_validator("website")
    @classmethod
    def validate_website(cls, v: str | None) -> str | None:
        """Validate website URL format."""
        if v is None or v.strip() == "":
            return None

        import re

        url_pattern = re.compile(
            r"^https?://"  # http:// or https://
            r"(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|"  # domain...
            r"localhost|"  # localhost...
            r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})"  # ...or ip
            r"(?::\d+)?"  # optional port
            r"(?:/?|[/?]\S+)$",
            re.IGNORECASE,
        )

        if not url_pattern.match(v):
            raise ValueError("Invalid URL format. Must start with http:// or https://")

        return v.strip()

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, v: str | None) -> str | None:
        """Validate timezone."""
        if v is None or v.strip() == "":
            return None

        try:
            import pytz

            # Check if timezone exists
            pytz.timezone(v)
            return v.strip()
        except pytz.exceptions.UnknownTimeZoneError:
            raise ValueError(
                f"Unknown timezone: {v}. Use standard timezone names like 'America/New_York'"
            )
        except ImportError:
            # If pytz not available, do basic validation
            if not v.strip():
                return None
            return v.strip()

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str | None) -> str | None:
        """Validate language code."""
        if v is None or v.strip() == "":
            return None

        import re

        # Accept ISO 639-1 (2 letters) or with region (e.g., en-US)
        if not re.match(r"^[a-z]{2}(-[A-Z]{2})?$", v):
            raise ValueError("Language must be in ISO 639-1 format (e.g., 'en' or 'en-US')")

        return v.strip()

    @field_validator("bio")
    @classmethod
    def validate_bio(cls, v: str | None) -> str | None:
        """Validate bio."""
        if v is None:
            return None

        v = v.strip()
        if len(v) > 500:
            raise ValueError("Bio must not exceed 500 characters")

        return v if v else None

    @field_validator("first_name", "last_name", "location")
    @classmethod
    def validate_text_fields(cls, v: str | None) -> str | None:
        """Validate text fields - trim whitespace."""
        if v is None:
            return None
        v = v.strip()
        return v if v else None


class ChangePasswordRequest(BaseModel):
    """Change password request model."""

    model_config = ConfigDict()

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")


@auth_router.get("/me")
async def get_current_user_endpoint(
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Get current user information from Bearer token or HttpOnly cookie.

    Includes activeOrganization for multi-tenant context.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        backup_codes_remaining = 0
        if getattr(user, "mfa_enabled", False):
            try:
                backup_codes_remaining = await mfa_service.get_remaining_backup_codes_count(
                    user_id=user.id,
                    session=session,
                )
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning(
                    "Failed to fetch remaining backup codes", user_id=str(user.id), error=str(exc)
                )

        # Build activeOrganization for multi-tenant context
        active_organization = None
        if user.tenant_id:
            try:
                tenant_service = TenantService(session)
                tenant = await tenant_service.get_tenant(str(user.tenant_id))
                # Determine primary role for this tenant
                primary_role = user.roles[0] if user.roles else None
                active_organization = {
                    "id": str(tenant.id),
                    "name": tenant.name,
                    "slug": getattr(tenant, "slug", None),
                    "role": primary_role,
                    "permissions": user_info.permissions or [],
                }
            except Exception as exc:
                logger.warning(
                    "Failed to fetch tenant for activeOrganization",
                    user_id=str(user.id),
                    tenant_id=str(user.tenant_id),
                    error=str(exc),
                )

        return {
            "id": str(user.id),
            "username": user.username,
            "email": user.email,
            "first_name": getattr(user, "first_name", None),
            "last_name": getattr(user, "last_name", None),
            "full_name": user.full_name,
            "phone": getattr(user, "phone", None),
            "location": getattr(user, "location", None),
            "timezone": getattr(user, "timezone", None),
            "language": getattr(user, "language", None),
            "bio": getattr(user, "bio", None),
            "website": getattr(user, "website", None),
            "avatar_url": getattr(user, "avatar_url", None),
            "roles": user.roles or [],
            "permissions": user_info.permissions or [],
            "is_active": user.is_active,
            "is_platform_admin": user_info.is_platform_admin,
            "tenant_id": str(user.tenant_id) if user.tenant_id else None,
            "partner_id": getattr(user_info, "partner_id", None),
            "managed_tenant_ids": getattr(user_info, "managed_tenant_ids", None),
            "mfa_enabled": bool(getattr(user, "mfa_enabled", False)),
            "mfa_backup_codes_remaining": backup_codes_remaining,
            "activeOrganization": active_organization,
        }
    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to get current user", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user information",
        )


async def _validate_username_email_conflicts(
    update_data: dict[str, Any],
    user: User,
    user_service: UserService,
    tenant_id: str | None = None,
) -> None:
    """Validate that username and email changes don't conflict with existing users within the same tenant."""
    if "username" in update_data and update_data["username"] != user.username:
        existing = await user_service.get_user_by_username(
            update_data["username"],
            tenant_id=tenant_id,
        )
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )

    if "email" in update_data and update_data["email"] != user.email:
        existing = await user_service.get_user_by_email(
            update_data["email"],
            tenant_id=tenant_id,
        )
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use",
            )


def _prepare_name_fields(update_data: dict[str, Any], user: User) -> None:
    """Parse first_name and last_name into full_name."""
    if "first_name" in update_data or "last_name" in update_data:
        first_name = update_data.get("first_name", getattr(user, "first_name", ""))
        last_name = update_data.get("last_name", getattr(user, "last_name", ""))
        update_data["full_name"] = f"{first_name} {last_name}".strip()


def _collect_profile_changes(update_data: dict[str, Any], user: User) -> list[dict[str, Any]]:
    """Collect changes for logging by comparing old and new values."""
    changes_to_log = []
    for field, new_value in update_data.items():
        if hasattr(user, field):
            old_value = getattr(user, field, None)
            # Only log if value actually changed
            if old_value != new_value:
                changes_to_log.append(
                    {
                        "field_name": field,
                        "old_value": str(old_value) if old_value is not None else None,
                        "new_value": str(new_value) if new_value is not None else None,
                    }
                )
    return changes_to_log


async def _log_profile_change_history(
    changes: list[dict[str, Any]],
    user: User,
    request: Request,
    session: AsyncSession,
) -> None:
    """Log profile changes to history table."""
    import uuid as uuid_module
    from datetime import datetime

    from dotmac.platform.user_management.models import ProfileChangeHistory

    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", None)

    for change in changes:
        try:
            history_record = ProfileChangeHistory(
                id=uuid_module.uuid4(),
                user_id=user.id,
                changed_by_user_id=user.id,  # Self-update
                field_name=change["field_name"],
                old_value=change["old_value"],
                new_value=change["new_value"],
                ip_address=client_ip,
                user_agent=user_agent,
                tenant_id=user.tenant_id,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            session.add(history_record)
        except Exception as e:
            # Don't fail profile update if history logging fails
            logger.warning(
                "Failed to log profile change history",
                user_id=str(user.id),
                field=change["field_name"],
                error=str(e),
            )


def _build_profile_response(user: User) -> dict[str, Any]:
    """Build profile response dictionary from user object."""
    return {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
        "full_name": user.full_name,
        "phone": getattr(user, "phone", None),
        "location": getattr(user, "location", None),
        "timezone": getattr(user, "timezone", None),
        "language": getattr(user, "language", None),
        "bio": getattr(user, "bio", None),
        "website": getattr(user, "website", None),
        "roles": user.roles or [],
        "is_active": user.is_active,
        "tenant_id": user.tenant_id,
    }


@auth_router.patch("/me")
async def update_current_user_profile(
    profile_update: UpdateProfileRequest,
    request: Request,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Update current user's profile information.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Update only provided fields
        update_data = profile_update.model_dump(exclude_unset=True)

        # Validate username/email conflicts within current tenant
        await _validate_username_email_conflicts(
            update_data, user, user_service, tenant_id=user.tenant_id
        )

        # Prepare name fields (first_name + last_name → full_name)
        _prepare_name_fields(update_data, user)

        # Collect changes for logging
        changes_to_log = _collect_profile_changes(update_data, user)

        # Update user attributes
        for field, value in update_data.items():
            if hasattr(user, field):
                setattr(user, field, value)

        await session.commit()
        await session.refresh(user)

        # Log profile changes to history
        await _log_profile_change_history(changes_to_log, user, request, session)
        await session.commit()

        # Log profile update activity
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="profile_updated",
            description=f"User {user.username} updated their profile",
            severity=ActivitySeverity.LOW,
            details={"updated_fields": list(update_data.keys())},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info(
            "Profile updated successfully", user_id=str(user.id), fields=list(update_data.keys())
        )

        return _build_profile_response(user)
    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to update profile", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )


@auth_router.post("/upload-avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Upload user avatar image.

    Accepts image files (jpg, jpeg, png, gif, webp) up to 5MB.
    Returns the avatar URL.
    """
    from dotmac.platform.file_storage.service import get_storage_service

    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]
        if avatar.content_type not in allowed_types:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}",
            )

        # Validate file size (5MB max)
        max_size = 5 * 1024 * 1024  # 5MB
        contents = await avatar.read()
        file_size = len(contents)

        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size is {max_size / 1024 / 1024}MB",
            )

        # Reset file position
        await avatar.seek(0)

        # Generate avatar path
        file_extension = (
            avatar.filename.split(".")[-1] if avatar.filename and "." in avatar.filename else "jpg"
        )
        avatar_path = f"avatars/{user_info.user_id}"
        avatar_filename = f"avatar_{user_info.user_id}.{file_extension}"

        # Store avatar
        storage_service = get_storage_service()
        file_id = await storage_service.store_file(
            file_data=contents,
            file_name=avatar_filename,
            content_type=avatar.content_type or "image/jpeg",
            path=avatar_path,
            metadata={
                "uploaded_by": user_info.user_id,
                "file_type": "avatar",
                "original_filename": avatar.filename,
            },
            tenant_id=user_info.tenant_id,
        )

        # Update user's avatar_url
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Delete old avatar if exists
        if user.avatar_url and "/files/storage/" in user.avatar_url:
            try:
                old_file_id = user.avatar_url.split("/files/storage/")[1].split("/")[0]
                await storage_service.delete_file(
                    file_id=old_file_id,
                    tenant_id=user_info.tenant_id,
                )
                logger.info("Old avatar deleted", user_id=str(user.id), old_file_id=old_file_id)
            except Exception as e:
                logger.warning(
                    "Failed to delete old avatar, continuing with upload",
                    user_id=str(user.id),
                    error=str(e),
                )

        # Generate avatar URL
        avatar_url = f"/api/v1/files/storage/{file_id}/download"

        # Update user avatar_url field
        if hasattr(user, "avatar_url"):
            user.avatar_url = avatar_url
            await session.commit()
            await session.refresh(user)

        # Log avatar upload
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="avatar_uploaded",
            description=f"User {user.username} uploaded a new avatar",
            severity=ActivitySeverity.LOW,
            details={"file_id": file_id, "file_size": file_size},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("Avatar uploaded successfully", user_id=str(user.id), file_id=file_id)

        return {
            "avatar_url": avatar_url,
            "file_id": file_id,
            "message": "Avatar uploaded successfully",
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to upload avatar", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload avatar",
        )


@auth_router.delete("/me/avatar")
async def delete_avatar(
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Delete user's avatar.

    Removes the avatar file from storage and clears the avatar_url field.
    """
    from dotmac.platform.file_storage.service import get_storage_service

    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Check if user has an avatar
        if not user.avatar_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No avatar to delete",
            )

        # Extract file ID from avatar URL if it's a storage URL
        # Format: /api/v1/files/storage/{file_id}/download
        if "/files/storage/" in user.avatar_url:
            try:
                file_id = user.avatar_url.split("/files/storage/")[1].split("/")[0]

                # Delete file from storage
                storage_service = get_storage_service()
                await storage_service.delete_file(
                    file_id=file_id,
                    tenant_id=user_info.tenant_id,
                )

                logger.info(
                    "Avatar file deleted from storage", user_id=str(user.id), file_id=file_id
                )
            except Exception as e:
                logger.warning(
                    "Failed to delete avatar file from storage, continuing to clear URL",
                    user_id=str(user.id),
                    error=str(e),
                )

        # Clear avatar URL
        user.avatar_url = None
        await session.commit()

        # Log avatar deletion
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="avatar_deleted",
            description=f"User {user.username} deleted their avatar",
            severity=ActivitySeverity.LOW,
            details={"avatar_deleted": True},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("Avatar deleted successfully", user_id=str(user.id))

        return {
            "message": "Avatar deleted successfully",
            "avatar_url": None,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to delete avatar", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete avatar",
        )


# ========================================
# Email Verification Endpoints
# ========================================


class SendVerificationEmailRequest(BaseModel):
    """Request model for sending verification email."""

    model_config = ConfigDict()

    email: EmailStr = Field(description="Email address to verify")


class ConfirmEmailRequest(BaseModel):
    """Request model for confirming email verification."""

    model_config = ConfigDict()

    token: str = Field(min_length=32, max_length=255, description="Verification token")


@auth_router.post("/verify-email")
async def send_verification_email(
    request: Request,
    email_request: SendVerificationEmailRequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Send email verification link to the specified email address.

    This endpoint generates a verification token and sends it to the user's email.
    The token expires after 24 hours.
    """
    try:
        import hashlib
        import secrets
        import uuid as uuid_module
        from datetime import datetime, timedelta

        from dotmac.platform.user_management.models import EmailVerificationToken

        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Generate secure token
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

        # Create verification token record
        verification_token = EmailVerificationToken(
            id=uuid_module.uuid4(),
            user_id=user.id,
            token_hash=token_hash,
            email=email_request.email,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
            used=False,
            tenant_id=user.tenant_id,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        session.add(verification_token)
        await session.commit()

        # Send verification email
        try:
            _email_service = get_auth_email_service()
            # Use centralized frontend URL (Phase 2 implementation)
            try:
                frontend_url = settings.external_services.frontend_url
            except AttributeError:
                # Fallback for backwards compatibility
                frontend_url = getattr(settings, "frontend_url", "http://localhost:3000")

            verification_url = f"{frontend_url}/verify-email?token={token}"

            # Send verification email using communications service
            user_name = user.username or user.email
            success = await _email_service.send_verification_email(
                email=email_request.email,
                user_name=user_name,
                verification_url=verification_url,
            )

            if success:
                logger.info(
                    "Email verification sent successfully",
                    user_id=str(user.id),
                    email=email_request.email,
                )
            else:
                logger.warning(
                    "Failed to send verification email",
                    user_id=str(user.id),
                    email=email_request.email,
                )
        except Exception as e:
            logger.warning(
                "Failed to send verification email",
                user_id=str(user.id),
                email=email_request.email,
                error=str(e),
            )
            # Don't fail the endpoint if email sending fails
            # The token is still valid and can be used

        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="verification_email_sent",
            description=f"Verification email sent to {email_request.email}",
            severity=ActivitySeverity.LOW,
            details={"email": email_request.email},
            tenant_id=user.tenant_id,
            session=session,
        )

        return {
            "message": "Verification email sent successfully",
            "email": email_request.email,
            "expires_in_hours": 24,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to send verification email", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email",
        )


@auth_router.post("/verify-email/confirm")
async def confirm_email_verification(
    request: Request,
    confirm_request: ConfirmEmailRequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Confirm email verification using the token sent via email.

    This endpoint validates the token and marks the email as verified.
    """
    try:
        import hashlib
        from datetime import datetime

        from sqlalchemy import select

        from dotmac.platform.user_management.models import EmailVerificationToken

        # Hash the provided token
        token_hash = hashlib.sha256(confirm_request.token.encode()).hexdigest()

        # Find the verification token
        stmt = (
            select(EmailVerificationToken)
            .where(EmailVerificationToken.token_hash == token_hash)
            .where(EmailVerificationToken.user_id == user_info.user_id)
            .where(EmailVerificationToken.used.is_(False))
        )
        result = await session.execute(stmt)
        verification_token = result.scalar_one_or_none()

        if not verification_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or already used verification token",
            )

        # Check if token is expired
        if verification_token.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired",
            )

        # Mark token as used
        verification_token.used = True
        verification_token.used_at = datetime.now(UTC)
        verification_token.used_ip = request.client.host if request.client else None

        # Update user's email and mark as verified
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Update email if it matches the verification token
        if user.email != verification_token.email:
            user.email = verification_token.email

        user.is_verified = True

        await session.commit()

        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="email_verified",
            description=f"User verified email: {verification_token.email}",
            severity=ActivitySeverity.MEDIUM,
            details={
                "email": verification_token.email,
                "ip_address": verification_token.used_ip,
            },
            tenant_id=user.tenant_id,
            session=session,
        )

        return {
            "message": "Email verified successfully",
            "email": verification_token.email,
            "is_verified": True,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to confirm email verification", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm email verification",
        )


@auth_router.post("/verify-email/resend")
async def resend_verification_email(
    request: Request,
    email_request: SendVerificationEmailRequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Resend email verification link.

    This endpoint invalidates any existing tokens for the email and sends a new one.
    """
    try:
        from datetime import datetime

        from sqlalchemy import update

        from dotmac.platform.user_management.models import EmailVerificationToken

        # Invalidate existing tokens for this email
        stmt = (
            update(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user_info.user_id)
            .where(EmailVerificationToken.email == email_request.email)
            .where(EmailVerificationToken.used.is_(False))
            .values(used=True, used_at=datetime.now(UTC))
        )
        await session.execute(stmt)
        await session.commit()

        # Send new verification email using the existing endpoint logic
        return await send_verification_email(request, email_request, user_info, session)

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to resend verification email", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resend verification email",
        )


@auth_router.post("/change-password")
async def change_password(
    password_change: ChangePasswordRequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Change current user's password.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Verify current password
        if not verify_password(password_change.current_password, user.password_hash):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_UPDATED,
                action="password_change_failed",
                description="Failed password change attempt - incorrect current password",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "incorrect_current_password"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        # Update password
        user.password_hash = hash_password(password_change.new_password)
        await session.commit()

        # Log successful password change
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="password_changed",
            description=f"User {user.username} changed their password",
            severity=ActivitySeverity.MEDIUM,
            details={"success": True},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("Password changed successfully", user_id=str(user.id))

        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to change password", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change password",
        )


# ========================================
# Two-Factor Authentication (2FA) Endpoints
# ========================================


class Enable2FARequest(BaseModel):
    """Request to enable 2FA."""

    model_config = ConfigDict()

    password: str = Field(..., description="User's current password for verification")


class Enable2FAResponse(BaseModel):
    """Response with 2FA setup information."""

    model_config = ConfigDict()

    secret: str = Field(..., description="TOTP secret (show only once)")
    qr_code: str = Field(..., description="QR code data URL for authenticator app")
    backup_codes: list[str] = Field(..., description="Backup codes for account recovery")
    provisioning_uri: str = Field(..., description="Provisioning URI for manual entry")


class Verify2FARequest(BaseModel):
    """Request to verify 2FA token."""

    model_config = ConfigDict()

    token: str = Field(..., description="6-digit TOTP code", min_length=6, max_length=6)


class Disable2FARequest(BaseModel):
    """Request to disable 2FA."""

    model_config = ConfigDict()

    password: str = Field(..., description="User's current password for verification")
    token: str = Field(
        ..., description="6-digit TOTP code for confirmation", min_length=6, max_length=6
    )


@auth_router.post("/2fa/enable", response_model=Enable2FAResponse)
async def enable_2fa(
    request: Enable2FARequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> Enable2FAResponse:
    """
    Enable two-factor authentication for the current user.

    Returns TOTP secret and QR code for authenticator app setup.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Verify password
        if not verify_password(request.password, user.password_hash):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_UPDATED,
                action="2fa_enable_failed",
                description="Failed 2FA enable attempt - incorrect password",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "incorrect_password"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password",
            )

        # Check if 2FA is already enabled
        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is already enabled",
            )

        # Generate TOTP secret
        secret = mfa_service.generate_secret()
        account_name = user.email

        # Generate provisioning URI and QR code
        provisioning_uri = mfa_service.get_provisioning_uri(secret, account_name)
        qr_code = mfa_service.generate_qr_code(provisioning_uri)

        # Generate backup codes
        backup_codes = mfa_service.generate_backup_codes()

        # Store secret (will be activated after verification)
        user.mfa_secret = secret
        await session.commit()

        # Store hashed backup codes
        await mfa_service.store_backup_codes(
            user_id=user.id, codes=backup_codes, session=session, tenant_id=user.tenant_id or ""
        )

        # Log 2FA setup initiated
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="2fa_setup_initiated",
            description=f"User {user.username} initiated 2FA setup",
            severity=ActivitySeverity.MEDIUM,
            details={"status": "pending_verification"},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("2FA setup initiated", user_id=str(user.id))

        return Enable2FAResponse(
            secret=secret,
            qr_code=qr_code,
            backup_codes=backup_codes,
            provisioning_uri=provisioning_uri,
        )

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to enable 2FA", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to enable 2FA",
        )


@auth_router.post("/2fa/verify")
async def verify_2fa_setup(
    request: Verify2FARequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Verify 2FA token and complete 2FA setup.

    This endpoint activates 2FA after verifying the TOTP token.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Check if secret exists (setup was initiated)
        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA setup not initiated. Please enable 2FA first.",
            )

        # Verify TOTP token
        if not mfa_service.verify_token(user.mfa_secret, request.token):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_UPDATED,
                action="2fa_verification_failed",
                description="Failed 2FA verification attempt - invalid token",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "invalid_token"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )

        # Activate 2FA
        user.mfa_enabled = True
        await session.commit()

        # Log successful 2FA activation
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="2fa_enabled",
            description=f"User {user.username} enabled 2FA",
            severity=ActivitySeverity.HIGH,
            details={"status": "enabled"},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("2FA enabled successfully", user_id=str(user.id))

        return {
            "message": "2FA enabled successfully",
            "mfa_enabled": True,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to verify 2FA", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify 2FA",
        )


@auth_router.post("/2fa/disable")
async def disable_2fa(
    request: Disable2FARequest,
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Disable two-factor authentication for the current user.

    Requires password and valid TOTP token for security.
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        # Verify password
        if not verify_password(request.password, user.password_hash):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_UPDATED,
                action="2fa_disable_failed",
                description="Failed 2FA disable attempt - incorrect password",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "incorrect_password"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password",
            )

        # Check if 2FA is enabled
        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled",
            )

        # Verify TOTP token
        if not user.mfa_secret or not mfa_service.verify_token(user.mfa_secret, request.token):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_UPDATED,
                action="2fa_disable_failed",
                description="Failed 2FA disable attempt - invalid token",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "invalid_token"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )

        # Disable 2FA
        user.mfa_enabled = False
        user.mfa_secret = None
        await session.commit()

        # Log 2FA disabled
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="2fa_disabled",
            description=f"User {user.username} disabled 2FA",
            severity=ActivitySeverity.HIGH,
            details={"status": "disabled"},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info("2FA disabled successfully", user_id=str(user.id))

        return {
            "message": "2FA disabled successfully",
            "mfa_enabled": False,
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to disable 2FA", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable 2FA",
        )


@auth_router.post("/2fa/regenerate-backup-codes")
async def regenerate_backup_codes(
    regenerate_request: RegenerateBackupCodesRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Regenerate backup codes for MFA.

    Requires password verification for security.
    Returns new backup codes (only shown once).

    **Security:**
    - Requires authentication (current user)
    - Requires password verification
    - Deletes all existing backup codes
    - Generates 10 new backup codes
    - Logs regeneration activity
    """
    try:
        # Get user from database
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            current_user.user_id, **_tenant_scope_kwargs(current_user)
        )

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Verify 2FA is enabled
        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled for this user",
            )

        # Verify password
        if not verify_password(regenerate_request.password, user.password_hash):
            await log_user_activity(
                user_id=str(user.id),
                activity_type=ActivityType.USER_LOGIN,
                action="backup_codes_regeneration_failed",
                description=f"Failed backup code regeneration attempt for {user.username} - incorrect password",
                severity=ActivitySeverity.MEDIUM,
                details={"reason": "incorrect_password"},
                tenant_id=user.tenant_id,
                session=session,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password",
            )

        # Generate new backup codes
        backup_codes = mfa_service.generate_backup_codes(count=10)

        # Store hashed backup codes (this will delete existing ones)
        await mfa_service.store_backup_codes(
            user_id=user.id,
            codes=backup_codes,
            session=session,
            tenant_id=user.tenant_id or "",
        )

        # Log successful regeneration
        await log_user_activity(
            user_id=str(user.id),
            activity_type=ActivityType.USER_UPDATED,
            action="backup_codes_regenerated",
            description=f"User {user.username} regenerated backup codes",
            severity=ActivitySeverity.MEDIUM,
            details={"count": len(backup_codes)},
            tenant_id=user.tenant_id,
            session=session,
        )

        logger.info(
            "Backup codes regenerated successfully",
            user_id=str(user.id),
            count=len(backup_codes),
        )

        return {
            "message": "Backup codes regenerated successfully",
            "backup_codes": backup_codes,
            "warning": "Store these codes in a safe place. They will not be shown again.",
        }

    except HTTPException:
        raise
    except Exception:
        logger.error("Failed to regenerate backup codes", exc_info=True)
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes",
        )


# ========================================
# Metrics Endpoint
# ========================================


@auth_router.get("/metrics")
async def get_auth_metrics(
    session: AsyncSession = Depends(get_auth_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get authentication metrics including failed login attempts.

    Returns metrics for monitoring authentication security.
    """
    try:
        # Query recent audit logs for failed login attempts (last hour)
        from datetime import datetime, timedelta

        from sqlalchemy import func, select

        from dotmac.platform.audit.models import AuditActivity

        one_hour_ago = datetime.now(UTC) - timedelta(hours=1)

        # Count failed login attempts in last hour
        failed_login_query = select(func.count(AuditActivity.id)).where(
            AuditActivity.activity_type == "login_failed", AuditActivity.created_at >= one_hour_ago
        )
        result = await session.execute(failed_login_query)
        failed_attempts = result.scalar() or 0

        # Count successful logins in last hour
        successful_login_query = select(func.count(AuditActivity.id)).where(
            AuditActivity.activity_type == "login_success", AuditActivity.created_at >= one_hour_ago
        )
        result = await session.execute(successful_login_query)
        successful_logins = result.scalar() or 0

        # Count total active sessions
        # For now, return a placeholder - proper session counting would require session table query
        active_sessions = 0

        return {
            "failedAttempts": failed_attempts,
            "successfulLogins": successful_logins,
            "activeSessions": active_sessions,
            "timeWindow": "1h",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    except Exception as e:
        logger.error("Failed to fetch auth metrics", error=str(e), exc_info=True)
        # Return default values on error
        return {
            "failedAttempts": 0,
            "successfulLogins": 0,
            "activeSessions": 0,
            "timeWindow": "1h",
            "timestamp": datetime.now(UTC).isoformat(),
        }


# ========================================
# Sessions Management
# ========================================


@auth_router.get("/sessions")
async def list_user_sessions(
    user_info: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    List all active sessions for the current user.

    Note: This endpoint currently returns a simplified response due to SessionManager API limitations.
    In production, you may want to extend SessionManager to support listing user sessions.
    """
    try:
        # Get Redis client from session manager
        redis_client = await session_manager._get_redis()

        if redis_client:
            # Get all session IDs for the user
            user_key = f"user_sessions:{user_info.user_id}"
            session_ids = await redis_client.smembers(user_key)

            sessions = []
            for session_id in session_ids:
                session_data = await session_manager.get_session(session_id)
                if session_data:
                    sessions.append(
                        {
                            "id": session_id,
                            "created_at": session_data.get("created_at"),
                            "data": session_data.get("data", {}),
                        }
                    )

            return {"sessions": sessions}
        else:
            # Fallback - return empty list if Redis unavailable
            return {"sessions": []}
    except Exception as e:
        logger.error("Failed to list sessions", user_id=user_info.user_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions",
        )


@auth_router.post("/verify-phone/request")
async def request_phone_verification(
    phone_request: dict[str, Any],
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Request phone number verification code.
    """
    try:
        phone_number = phone_request.get("phone")
        if not phone_number or not isinstance(phone_number, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required",
            )

        # Generate 6-digit verification code using cryptographically secure RNG
        verification_code = f"{secrets.randbelow(1_000_000):06d}"

        # Get Redis client
        redis_client = await session_manager._get_redis()

        if redis_client:
            # Store code in Redis with 10-minute expiry
            await redis_client.setex(
                f"phone_verify:{user_info.user_id}",
                600,
                verification_code,  # 10 minutes
            )
        else:
            # Fallback - store in session manager's fallback store
            from datetime import timedelta

            session_manager._fallback_store[f"phone_verify:{user_info.user_id}"] = {
                "code": verification_code,
                "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
            }

        sms_feature_enabled = bool(
            getattr(settings.features, "sms_enabled", False)
            or getattr(settings.features, "communications_enabled", False)
        )
        sms_from_number = getattr(settings, "sms_from_number", None)

        if not sms_feature_enabled:
            logger.warning(
                "SMS verification requested while SMS feature disabled",
                user_id=user_info.user_id,
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SMS verification is currently unavailable",
            )

        if not sms_from_number:
            logger.error("SMS sender number not configured")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SMS verification not configured",
            )

        sms_integration = await get_integration_async("sms")
        if sms_integration is None:
            logger.error("SMS integration not available")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SMS provider is not configured",
            )

        if getattr(sms_integration, "status", None) != IntegrationStatus.READY:
            logger.error(
                "SMS integration not ready",
                status=str(getattr(sms_integration, "status", "unknown")),
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="SMS provider is not ready",
            )

        message_body = (
            f"Your DotMac verification code is {verification_code}. It will expire in 10 minutes."
        )

        send_result: dict[str, Any]
        try:
            send_result = await sms_integration.send_sms(
                to=phone_number,
                message=message_body,
                from_number=sms_from_number,
            )
        except Exception as send_error:  # pragma: no cover - defensive logging
            logger.error(
                "Failed to send verification SMS",
                error=str(send_error),
                user_id=user_info.user_id,
            )
            send_result = {"status": "failed", "error": str(send_error)}

        sms_sent = send_result.get("status") == "sent"
        provider_message_id = send_result.get("message_id")
        error_message = send_result.get("error") if not sms_sent else None

        communication_log = CommunicationLog(
            tenant_id=user_info.tenant_id,
            type=CommunicationType.SMS,
            recipient=phone_number,
            sender=sms_from_number,
            text_body=message_body,
            status=CommunicationStatus.SENT if sms_sent else CommunicationStatus.FAILED,
            sent_at=datetime.now(UTC) if sms_sent else None,
            failed_at=datetime.now(UTC) if not sms_sent else None,
            error_message=error_message,
            provider=sms_integration.provider,
            provider_message_id=provider_message_id,
            metadata_={
                "context": "phone_verification",
                "user_id": user_info.user_id,
            },
        )

        session.add(communication_log)
        try:
            await session.commit()
        except Exception:
            await session.rollback()
            raise

        if not sms_sent:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Failed to send verification code",
            )

        logger.info(
            "Phone verification code sent via SMS",
            user_id=user_info.user_id,
            phone=phone_number,
            provider_message_id=provider_message_id,
        )

        return {"message": "Verification code sent"}
    except HTTPException:
        raise
    except Exception as e:
        await session.rollback()
        logger.error("Failed to send verification code", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification code",
        )


@auth_router.post("/verify-phone/confirm")
async def confirm_phone_verification(
    verify_request: dict[str, Any],
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Confirm phone number with verification code.
    """
    try:
        code = verify_request.get("code")
        phone = verify_request.get("phone")

        # Get Redis client
        redis_client = await session_manager._get_redis()
        stored_code = None

        if redis_client:
            # Get stored code from Redis
            stored_code = await redis_client.get(f"phone_verify:{user_info.user_id}")
            if stored_code:
                stored_code = stored_code  # Already a string with decode_responses=True
        else:
            # Fallback - get from in-memory store

            fallback_data = session_manager._fallback_store.get(f"phone_verify:{user_info.user_id}")
            if fallback_data:
                # Check expiry
                expires_at = datetime.fromisoformat(fallback_data["expires_at"])
                if datetime.now(UTC) < expires_at:
                    stored_code = fallback_data["code"]

        if not stored_code or stored_code != code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code",
            )

        # Update user
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if user:
            user.phone = phone
            user.phone_verified = True
            await session.commit()

        # Delete verification code
        if redis_client:
            await redis_client.delete(f"phone_verify:{user_info.user_id}")
        else:
            session_manager._fallback_store.pop(f"phone_verify:{user_info.user_id}", None)

        return {"message": "Phone verified successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to verify phone", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify phone",
        )


# ========================================
# Two-Factor Authentication
# ========================================


@auth_router.post("/2fa/setup")
async def setup_2fa(
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Initialize 2FA setup and return QR code data.
    """
    try:
        import base64
        import io

        import pyotp
        import qrcode

        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Generate secret
        secret = pyotp.random_base32()

        # Get Redis client
        redis_client = await session_manager._get_redis()

        if redis_client:
            # Store secret temporarily in Redis
            await redis_client.setex(f"2fa_setup:{user_info.user_id}", 600, secret)  # 10 minutes
        else:
            # Fallback - store in session manager's fallback store
            from datetime import timedelta

            session_manager._fallback_store[f"2fa_setup:{user_info.user_id}"] = {
                "secret": secret,
                "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
            }

        # Generate QR code
        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="DotMac Platform")

        # Create QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_code_base64 = base64.b64encode(buffer.getvalue()).decode()

        return {
            "secret": secret,
            "qr_code": f"data:image/png;base64,{qr_code_base64}",
            "provisioning_uri": provisioning_uri,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to setup 2FA", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup 2FA",
        )
