"""
Verification Router.

Contains endpoints for email and phone verification:
- POST /verify-email - Send verification email
- POST /verify-email/confirm - Confirm email verification
- POST /verify-email/resend - Resend verification email
- POST /verify-phone/request - Request phone verification
- POST /verify-phone/confirm - Confirm phone verification
"""

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import (
    UserInfo,
    get_current_user,
    session_manager,
)
from dotmac.platform.auth.public_router import get_auth_session
from dotmac.platform.auth.email_service import get_auth_email_service
from dotmac.platform.auth.schemas import ConfirmEmailRequest, SendVerificationEmailRequest
from dotmac.platform.communications.models import (
    CommunicationLog,
    CommunicationStatus,
    CommunicationType,
)
from dotmac.platform.integrations import IntegrationStatus, get_integration_async
from dotmac.platform.settings import settings
from dotmac.platform.user_management.service import UserService

from ..audit import ActivitySeverity, ActivityType, log_user_activity

logger = structlog.get_logger(__name__)

# Create verification router
verification_router = APIRouter(tags=["Verification"])


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
# Email Verification Endpoints
# ========================================


@verification_router.post("/verify-email")
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

        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()

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

        try:
            _email_service = get_auth_email_service()
            try:
                frontend_url = settings.external_services.frontend_url
            except AttributeError:
                frontend_url = getattr(settings, "frontend_url", "http://localhost:3000")

            verification_url = f"{frontend_url}/verify-email?token={token}"

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


@verification_router.post("/verify-email/confirm")
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

        from sqlalchemy import select

        from dotmac.platform.user_management.models import EmailVerificationToken

        token_hash = hashlib.sha256(confirm_request.token.encode()).hexdigest()

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

        if verification_token.is_expired():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired",
            )

        verification_token.used = True
        verification_token.used_at = datetime.now(UTC)
        verification_token.used_ip = request.client.host if request.client else None

        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

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


@verification_router.post("/verify-email/resend")
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
        from sqlalchemy import update

        from dotmac.platform.user_management.models import EmailVerificationToken

        stmt = (
            update(EmailVerificationToken)
            .where(EmailVerificationToken.user_id == user_info.user_id)
            .where(EmailVerificationToken.email == email_request.email)
            .where(EmailVerificationToken.used.is_(False))
            .values(used=True, used_at=datetime.now(UTC))
        )
        await session.execute(stmt)
        await session.commit()

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


# ========================================
# Phone Verification Endpoints
# ========================================


@verification_router.post("/verify-phone/request")
async def request_phone_verification(
    phone_request: dict[str, Any],
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """Request phone number verification code."""
    try:
        phone_number = phone_request.get("phone")
        if not phone_number or not isinstance(phone_number, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required",
            )

        verification_code = f"{secrets.randbelow(1_000_000):06d}"

        redis_client = await session_manager._get_redis()

        if redis_client:
            await redis_client.setex(
                f"phone_verify:{user_info.user_id}",
                600,
                verification_code,
            )
        else:
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
        except Exception as send_error:
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


@verification_router.post("/verify-phone/confirm")
async def confirm_phone_verification(
    verify_request: dict[str, Any],
    user_info: UserInfo = Depends(get_current_user),
    session: AsyncSession = Depends(get_auth_session),
) -> dict[str, Any]:
    """Confirm phone number with verification code."""
    try:
        code = verify_request.get("code")
        phone = verify_request.get("phone")

        redis_client = await session_manager._get_redis()
        stored_code = None

        if redis_client:
            stored_code = await redis_client.get(f"phone_verify:{user_info.user_id}")
        else:
            fallback_data = session_manager._fallback_store.get(f"phone_verify:{user_info.user_id}")
            if fallback_data:
                expires_at = datetime.fromisoformat(fallback_data["expires_at"])
                if datetime.now(UTC) < expires_at:
                    stored_code = fallback_data["code"]

        if not stored_code or stored_code != code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code",
            )

        user_service = UserService(session)
        user = await user_service.get_user_by_id(
            user_info.user_id, **_tenant_scope_kwargs(user_info)
        )

        if user:
            user.phone = phone
            user.phone_verified = True
            await session.commit()

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
# Exported Symbols
# ========================================

__all__ = [
    "verification_router",
]
