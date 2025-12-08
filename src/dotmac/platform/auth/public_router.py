"""
Public Authentication Router.

Contains endpoints that don't require authentication:
- Login (JSON, OAuth2, Cookie)
- 2FA verification during login
- Token refresh
- Logout
- Password reset
"""

import json
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func, or_, select
from sqlalchemy.exc import MultipleResultsFound
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    UserInfo,
    hash_password,
    jwt_service,
    session_manager,
    TOKEN_EXP_LEEWAY_SECONDS,
    verify_password,
)
from dotmac.platform.auth.email_service import get_auth_email_service
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.auth.schemas import (
    LoginRequest,
    LoginSuccessResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    TokenResponse,
    Verify2FALoginRequest,
)
from dotmac.platform.core.rate_limiting import rate_limit_ip
from dotmac.platform.db import get_session_dependency
from dotmac.platform.settings import settings
from dotmac.platform.user_management.models import User
from dotmac.platform.user_management.service import UserService

from ..audit import ActivitySeverity, ActivityType, log_api_activity, log_user_activity
from ..webhooks.events import get_event_bus
from ..webhooks.models import WebhookEvent

logger = structlog.get_logger(__name__)

# Create public router (no prefix - will be included by main auth_router)
public_router = APIRouter(tags=["Authentication"])


# ========================================
# Cookie management helpers
# ========================================


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Set HttpOnly authentication cookies on the response."""
    from typing import Literal

    secure = settings.is_production
    samesite: Literal["strict", "lax", "none"] = "strict" if settings.is_production else "lax"

    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )

    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=7 * 24 * 60 * 60,  # 7 days
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """Clear authentication cookies from the response."""
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")


def get_token_from_cookie(request: Request, cookie_name: str) -> str | None:
    """Extract token from HttpOnly cookie."""
    return request.cookies.get(cookie_name)


# ========================================
# Session dependency
# ========================================


async def get_auth_session(
    session: AsyncSession = Depends(get_session_dependency),
):
    """Adapter to reuse the shared session dependency."""
    yield session


# ========================================
# Helper functions for login flow
# ========================================


async def _authenticate_and_issue_tokens(
    *,
    username: str,
    tenant_hint: str | None,
    password: str,
    request: Request,
    response: Response,
    session: AsyncSession,
) -> TokenResponse:
    """Shared login flow used by both JSON and OAuth2 password endpoints.

    SECURITY NOTE: Tenant headers are used ONLY to scope the initial user lookup.
    The issued token's tenant_id always comes from the authenticated user's record
    (user.tenant_id), NOT from request headers. This prevents tenant spoofing attacks.
    """
    from dotmac.platform.tenant import get_current_tenant_id, get_tenant_config

    user_service = UserService(session)
    current_tenant_id = get_current_tenant_id()
    tenant_hint = tenant_hint or None

    # Tenant resolution from request context
    try:
        tenant_config = get_tenant_config()

        # SECURITY: Do not honor tenant headers during auth. Use request.state (set by middleware)
        # or default tenant in multi-tenant mode. Tenant in tokens always comes from the user record.
        state_tenant = getattr(request.state, "tenant_id", None)
        if state_tenant:
            current_tenant_id = state_tenant
        elif tenant_hint:
            current_tenant_id = tenant_hint
        elif tenant_config and tenant_config.is_multi_tenant:
            current_tenant_id = tenant_config.default_tenant_id

        logger.debug(
            "resolved login tenant (auth routes ignore header)",
            context_tenant=current_tenant_id,
            state_tenant=state_tenant,
            tenant_hint=tenant_hint,
        )
    except Exception:
        pass

    tenant_config = get_tenant_config()
    default_tenant_id = tenant_config.default_tenant_id if tenant_config else None

    # Try to find user by username or email within the current tenant
    user = None
    candidate_tenant = current_tenant_id

    if candidate_tenant:
        user = await user_service.get_user_by_username(username, tenant_id=candidate_tenant)
        if not user:
            user = await user_service.get_user_by_email(username, tenant_id=candidate_tenant)
        if user:
            current_tenant_id = candidate_tenant

    # If still not found, attempt a cross-tenant lookup to support multi-tenant logins without headers.
    if not user and tenant_config and tenant_config.is_multi_tenant:
        user_lookup = await _find_user_across_tenants(username, session)
        if user_lookup == "ambiguous":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple accounts found. Please include tenant in login payload.",
            )
        user = user_lookup

    if not user or not verify_password(password, user.password_hash):
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
            if session_manager._fallback_enabled:
                session_data["expires_at"] = (
                    datetime.now(UTC) + timedelta(seconds=300)
                ).isoformat()
                session_manager._fallback_store[pending_key] = session_data

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

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA verification required",
            headers={"X-2FA-Required": "true", "X-User-ID": str(user.id)},
        )

    # Update last login
    client_ip = request.client.host if request.client else None
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
        action="login_success",
        description=f"User {user.username} logged in successfully",
        severity=ActivitySeverity.LOW,
        details={"username": user.username, "email": user.email, "roles": user.roles or []},
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

    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


async def _find_user_across_tenants(
    identifier: str, session: AsyncSession
) -> User | Literal["ambiguous"] | None:
    """
    Lookup a user across all tenants. Returns "ambiguous" if multiple matches are found.
    """
    normalized_email = identifier.lower() if "@" in identifier else None
    conditions = [User.username == identifier]
    if normalized_email:
        conditions.append(func.lower(User.email) == normalized_email)

    query = select(User).where(or_(*conditions)).limit(2)

    result = await session.execute(query)
    users = result.scalars().all()

    if not users:
        return None
    if len(users) > 1:
        return "ambiguous"
    return users[0]


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


# ========================================
# 2FA verification helpers
# ========================================


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
        remaining = await mfa_service.get_remaining_backup_codes_count(
            user_id=user.id, session=session
        )

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

    await session_manager.delete_session(f"2fa_pending:{user.id}")
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

    set_auth_cookies(response, access_token, refresh_token)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ========================================
# Login Endpoints
# ========================================


@public_router.post("/login", response_model=TokenResponse)
@rate_limit_ip("5/minute")
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
        tenant_hint=login_request.tenant,
        password=login_request.password,
        request=request,
        response=response,
        session=session,
    )


@public_router.post("/login/verify-2fa", response_model=TokenResponse)
@rate_limit_ip("5/minute")
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
    max_attempts = 5
    attempts_key = f"2fa_attempts:{verify_request.user_id}"

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

        if not pending_session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA session expired. Please login again.",
            )

        # Check attempt limits
        redis_client = await session_manager._get_redis()
        if redis_client:
            current_attempts = await redis_client.get(attempts_key)
            if current_attempts and int(current_attempts) >= max_attempts:
                await redis_client.delete(f"session:2fa_pending:{verify_request.user_id}")
                await redis_client.delete(attempts_key)
                logger.warning(
                    "2FA session invalidated due to too many failed attempts",
                    user_id=str(verify_request.user_id),
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed 2FA attempts. Please login again.",
                )

        # Verify the code
        if verify_request.is_backup_code:
            code_valid = await _verify_backup_code_and_log(
                user, verify_request.code, session, request
            )
        else:
            code_valid = await _verify_totp_code_and_log(
                user, verify_request.code, request, session
            )

        if not code_valid:
            if redis_client:
                await redis_client.incr(attempts_key)
                await redis_client.expire(attempts_key, 300)

            await _log_2fa_verification_failure(
                user, verify_request.is_backup_code, request, session
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code",
            )

        if redis_client:
            await redis_client.delete(attempts_key)

        return await _complete_2fa_login(user, request, response, session)

    except HTTPException:
        raise
    except Exception:
        logger.error("2FA verification failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="2FA verification failed",
        )


@public_router.post("/login/cookie", response_model=LoginSuccessResponse)
@rate_limit_ip("5/minute")
async def login_cookie_only(
    login_request: LoginRequest,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_auth_session),
) -> LoginSuccessResponse:
    """
    Cookie-only authentication endpoint.

    Sets HttpOnly cookies for authentication without returning tokens in response body.
    """
    from dotmac.platform.tenant import get_current_tenant_id, get_tenant_config

    user_service = UserService(session)
    current_tenant_id = get_current_tenant_id()
    tenant_config = get_tenant_config()

    candidate_tenant = current_tenant_id or login_request.tenant
    user = None

    if candidate_tenant:
        user = await user_service.get_user_by_username(
            login_request.username, tenant_id=candidate_tenant
        )
        if not user:
            user = await user_service.get_user_by_email(
                login_request.username, tenant_id=candidate_tenant
            )

    if not user and tenant_config and tenant_config.is_multi_tenant:
        user_lookup = await _find_user_across_tenants(login_request.username, session)
        if user_lookup == "ambiguous":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Multiple accounts found. Please include tenant in login payload.",
            )
        user = user_lookup

    if not user or not await user_service.verify_password(user, login_request.password):
        await log_user_activity(
            user_id="unknown",
            activity_type=ActivityType.USER_LOGIN,
            action="login_failed",
            description=f"Failed login attempt for: {login_request.username}",
            severity=ActivitySeverity.MEDIUM,
            details={"username": login_request.username, "reason": "invalid_credentials"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            tenant_id=candidate_tenant or (user.tenant_id if user else None),
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
            session_data["expires_at"] = (datetime.now(UTC) + timedelta(seconds=300)).isoformat()
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
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA verification required",
            headers={"X-2FA-Required": "true", "X-User-ID": str(user.id)},
        )

    await _complete_cookie_login(user, request, response, session)

    return LoginSuccessResponse(
        user_id=str(user.id), username=user.username, email=user.email, roles=user.roles or []
    )


@public_router.post("/token", response_model=TokenResponse)
async def issue_token(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: AsyncSession = Depends(get_auth_session),
) -> TokenResponse:
    """OAuth2 password flow endpoint compatible with FastAPI's security utilities."""
    return await _authenticate_and_issue_tokens(
        username=form_data.username,
        tenant_hint=None,
        password=form_data.password,
        request=request,
        response=response,
        session=session,
    )


# ========================================
# Token Refresh Endpoint
# ========================================


@public_router.post("/refresh", response_model=TokenResponse)
@rate_limit_ip("10/minute")
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
    from dotmac.platform.auth.core import TokenType

    try:
        refresh_token_value = get_token_from_cookie(request, "refresh_token")
        if not refresh_token_value and refresh_request:
            refresh_token_value = refresh_request.refresh_token

        if not refresh_token_value:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token not provided",
            )

        payload = jwt_service.verify_token(
            refresh_token_value,
            expected_type=TokenType.REFRESH,
            leeway_seconds=TOKEN_EXP_LEEWAY_SECONDS,
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

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

        allow_sessionless = (not settings.is_production) and not getattr(
            session_manager, "_redis", None
        )

        session_id = payload.get("session_id")
        if not session_id:
            if settings.is_production or not allow_sessionless:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )
            session_id = payload.get("jti") or secrets.token_urlsafe(16)
            logger.warning(
                "Refresh token missing session_id; generating fallback in non-production",
                session_id=session_id[:8] + "...",
                user_id=user_id,
            )

        # Validate session still exists
        existing_session = await session_manager.get_session(session_id)
        if not existing_session or str(existing_session.get("user_id")) != str(user.id):
            if settings.is_production or not allow_sessionless:
                logger.warning(
                    "Refresh token rejected: session no longer exists",
                    session_id=session_id[:8] + "..." if session_id else None,
                    user_id=user_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Session has been invalidated. Please login again.",
                )
            # In non-production environments allow refresh to proceed to keep tests/dev flows working
            logger.warning(
                "Session missing during refresh; proceeding in non-production environment",
                session_id=session_id[:8] + "..." if session_id else None,
                user_id=user_id,
            )
            existing_session = {
                "session_id": session_id,
                "user_id": str(user.id),
                "data": {},
            }
        await session_manager.touch_session(session_id)

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

        # Refresh session TTL
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
        except Exception as exc:
            logger.warning("Failed to refresh session metadata", error=str(exc))

        set_auth_cookies(response, access_token, new_refresh_token)

        return TokenResponse(
            access_token=access_token,
            refresh_token=new_refresh_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )

    except HTTPException:
        raise
    except Exception:
        logger.error("Token refresh failed", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )


# ========================================
# Logout Endpoint
# ========================================


@public_router.post("/logout")
async def logout(
    request: Request,
    response: Response,
) -> dict[str, Any]:
    """Logout user and invalidate session and tokens."""
    try:
        token = None
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
        else:
            token = get_token_from_cookie(request, "access_token")

        if token:
            try:
                payload = jwt_service.verify_token(token)
                user_id = payload.get("sub")
            except Exception:
                clear_auth_cookies(response)
                return {"message": "Logout completed"}
        else:
            clear_auth_cookies(response)
            return {"message": "Logout completed"}

        if user_id:
            if token:
                await jwt_service.revoke_token(token)

            refresh_token = get_token_from_cookie(request, "refresh_token")
            if refresh_token:
                try:
                    await jwt_service.revoke_token(refresh_token)
                except Exception:
                    logger.warning("Failed to revoke refresh token cookie", exc_info=True)

            deleted_sessions = await session_manager.delete_user_sessions(user_id)

            try:
                await jwt_service.revoke_user_tokens(user_id)
            except Exception:
                logger.warning("Failed to revoke user refresh tokens", exc_info=True)

            logger.info(
                "User logged out successfully", user_id=user_id, sessions_deleted=deleted_sessions
            )

            clear_auth_cookies(response)

            return {"message": "Logged out successfully", "sessions_deleted": deleted_sessions}
        else:
            clear_auth_cookies(response)
            return {"message": "Logout completed"}
    except Exception:
        logger.error("Logout failed", exc_info=True)
        try:
            if token:
                await jwt_service.revoke_token(token)
        except Exception:
            pass

        clear_auth_cookies(response)
        return {"message": "Logout completed"}


# ========================================
# Password Reset Endpoints
# ========================================


class TenantIdentityResolver:
    """Resolve tenant from request headers or query params."""

    async def resolve(self, request: Request) -> str | None:
        try:
            from dotmac.platform.tenant import get_tenant_config

            tenant_config = get_tenant_config()
            if not tenant_config:
                return None

            # Check header first
            header_tenant = request.headers.get(tenant_config.tenant_header_name)
            if header_tenant:
                return header_tenant.strip()

            # Check query param
            query_tenant = request.query_params.get("tenant_id")
            if query_tenant:
                return query_tenant.strip()

            return None
        except Exception:
            return None


@public_router.post("/password-reset")
@rate_limit_ip("3/minute")
async def request_password_reset(
    reset_request: PasswordResetRequest,
    request: Request,
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, str]:
    """
    Request a password reset email.

    Always returns success to prevent email enumeration.
    """
    try:
        resolver = TenantIdentityResolver()
        tenant_id = await resolver.resolve(request)

        user_service = UserService(session)
        try:
            user = await user_service.get_user_by_email(reset_request.email, tenant_id=tenant_id)
        except MultipleResultsFound:
            logger.warning(
                "Password reset request for email with multiple tenant accounts",
                email=reset_request.email,
                tenant_provided=tenant_id is not None,
            )
            return {"message": "Password reset link has been sent if the email is registered."}

        if user:
            email_service = get_auth_email_service()
            reset_token = email_service.create_reset_token(user.email)

            await email_service.send_password_reset_email(
                email=user.email,
                user_name=user.full_name or user.username,
                reset_token=reset_token,
            )

            logger.info("Password reset email sent", user_id=str(user.id))

        return {"message": "Password reset link has been sent if the email is registered."}
    except Exception:
        logger.error("Password reset request failed", exc_info=True)
        return {"message": "Password reset link has been sent if the email is registered."}


@public_router.post("/password-reset/confirm")
async def confirm_password_reset(
    reset_confirm: PasswordResetConfirm,
    http_request: Request,
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, str]:
    """Confirm password reset with token."""
    email_service = get_auth_email_service()
    email = email_service.verify_reset_token(reset_confirm.token)

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    resolver = TenantIdentityResolver()
    tenant_id = await resolver.resolve(http_request)

    user_service = UserService(session)
    try:
        user = await user_service.get_user_by_email(email, tenant_id=tenant_id)
    except MultipleResultsFound:
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

    try:
        user.password_hash = hash_password(reset_confirm.new_password)
        await session.commit()

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


# ========================================
# Token Verification Endpoint
# ========================================


@public_router.get("/verify")
async def verify_token_endpoint(
    request: Request,
) -> dict[str, Any]:
    """Verify the current token and return user information."""
    token = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = get_token_from_cookie(request, "access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided",
        )

    try:
        payload = jwt_service.verify_token(token)
        return {
            "valid": True,
            "user_id": payload.get("sub"),
            "username": payload.get("username"),
            "email": payload.get("email"),
            "roles": payload.get("roles", []),
            "permissions": payload.get("permissions", []),
            "tenant_id": payload.get("tenant_id"),
            "is_platform_admin": payload.get("is_platform_admin", False),
        }
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


# ========================================
# Exported Symbols
# ========================================

__all__ = [
    "public_router",
    "set_auth_cookies",
    "clear_auth_cookies",
    "get_token_from_cookie",
    "get_auth_session",
    "TenantIdentityResolver",
]
