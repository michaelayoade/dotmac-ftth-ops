"""
MFA (Multi-Factor Authentication) Router.

Contains endpoints for 2FA management:
- POST /2fa/enable - Enable 2FA
- POST /2fa/verify - Verify and activate 2FA
- POST /2fa/disable - Disable 2FA
- POST /2fa/regenerate-backup-codes - Regenerate backup codes
- POST /2fa/setup - Initialize 2FA setup
- GET /metrics - Auth metrics
- GET /sessions - List user sessions
"""

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import (
    UserInfo,
    get_current_user,
    session_manager,
    verify_password,
)
from dotmac.platform.auth.mfa_service import mfa_service
from dotmac.platform.auth.schemas import (
    Disable2FARequest,
    Enable2FARequest,
    Enable2FAResponse,
    RegenerateBackupCodesRequest,
    Verify2FARequest,
)
from dotmac.platform.auth.public_router import get_auth_session
from dotmac.platform.user_management.service import UserService

from ..audit import ActivitySeverity, ActivityType, log_user_activity

logger = structlog.get_logger(__name__)

# Create MFA router
mfa_router = APIRouter(tags=["Two-Factor Authentication"])


# ========================================
# Session dependency
# ========================================


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
# 2FA Endpoints
# ========================================


@mfa_router.post("/2fa/enable", response_model=Enable2FAResponse)
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

        if user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is already enabled",
            )

        secret = mfa_service.generate_secret()
        account_name = user.email

        provisioning_uri = mfa_service.get_provisioning_uri(secret, account_name)
        qr_code = mfa_service.generate_qr_code(provisioning_uri)

        backup_codes = mfa_service.generate_backup_codes()

        user.mfa_secret = secret
        await session.commit()

        await mfa_service.store_backup_codes(
            user_id=user.id, codes=backup_codes, session=session, tenant_id=user.tenant_id or ""
        )

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


@mfa_router.post("/2fa/verify")
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

        if not user.mfa_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA setup not initiated. Please enable 2FA first.",
            )

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

        user.mfa_enabled = True
        await session.commit()

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


@mfa_router.post("/2fa/disable")
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

        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled",
            )

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

        user.mfa_enabled = False
        user.mfa_secret = None
        await session.commit()

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


@mfa_router.post("/2fa/regenerate-backup-codes")
async def regenerate_backup_codes(
    regenerate_request: RegenerateBackupCodesRequest,
    current_user: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """
    Regenerate backup codes for MFA.

    Requires password verification for security.
    Returns new backup codes (only shown once).
    """
    try:
        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            current_user.user_id, **_tenant_scope_kwargs(current_user)
        )

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if not user.mfa_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="2FA is not enabled for this user",
            )

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

        backup_codes = mfa_service.generate_backup_codes(count=10)

        await mfa_service.store_backup_codes(
            user_id=user.id,
            codes=backup_codes,
            session=session,
            tenant_id=user.tenant_id or "",
        )

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


@mfa_router.post("/2fa/setup")
async def setup_2fa(
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """Initialize 2FA setup and return QR code data."""
    try:
        import base64
        import io
        from datetime import timedelta

        import pyotp
        import qrcode

        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        secret = pyotp.random_base32()

        redis_client = await session_manager._get_redis()

        if redis_client:
            await redis_client.setex(f"2fa_setup:{user_info.user_id}", 600, secret)
        else:
            session_manager._fallback_store[f"2fa_setup:{user_info.user_id}"] = {
                "secret": secret,
                "expires_at": (datetime.now(UTC) + timedelta(minutes=10)).isoformat(),
            }

        totp = pyotp.TOTP(secret)
        provisioning_uri = totp.provisioning_uri(name=user.email, issuer_name="DotMac Platform")

        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

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


# ========================================
# Metrics Endpoint
# ========================================


@mfa_router.get("/metrics")
async def get_auth_metrics(
    session: AsyncSession = Depends(get_auth_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get authentication metrics including failed login attempts.

    Returns metrics for monitoring authentication security.
    """
    try:
        from datetime import timedelta

        from sqlalchemy import func, select

        from dotmac.platform.audit.models import AuditActivity

        one_hour_ago = datetime.now(UTC) - timedelta(hours=1)

        failed_login_query = select(func.count(AuditActivity.id)).where(
            AuditActivity.activity_type == "login_failed", AuditActivity.created_at >= one_hour_ago
        )
        result = await session.execute(failed_login_query)
        failed_attempts = result.scalar() or 0

        successful_login_query = select(func.count(AuditActivity.id)).where(
            AuditActivity.activity_type == "login_success", AuditActivity.created_at >= one_hour_ago
        )
        result = await session.execute(successful_login_query)
        successful_logins = result.scalar() or 0

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


@mfa_router.get("/sessions")
async def list_user_sessions(
    user_info: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """List all active sessions for the current user."""
    try:
        redis_client = await session_manager._get_redis()

        if redis_client:
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
            return {"sessions": []}
    except Exception as e:
        logger.error("Failed to list sessions", user_id=user_info.user_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve sessions",
        )


# ========================================
# Exported Symbols
# ========================================

__all__ = [
    "mfa_router",
]
