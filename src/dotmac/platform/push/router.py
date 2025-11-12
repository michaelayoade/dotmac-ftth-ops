"""
Push Notification Router
Handles push notification subscriptions and sending for PWA
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac
from dotmac.platform.db import get_db_session
from dotmac.platform.push.service import PushNotificationService

router = APIRouter(prefix="/api/v1/push", tags=["push-notifications"])


# ============================================================================
# Request/Response Models
# ============================================================================


class PushSubscriptionKeys(BaseModel):
    """Push subscription keys"""

    p256dh: str
    auth: str


class PushSubscriptionCreate(BaseModel):
    """Push subscription request"""

    endpoint: str
    expirationTime: int | None = None
    keys: PushSubscriptionKeys


class PushNotificationCreate(BaseModel):
    """Push notification request"""

    title: str
    body: str
    url: str | None = None
    tag: str | None = None
    requireInteraction: bool = False
    data: dict[str, Any] | None = None


class PushSubscriptionResponse(BaseModel):
    """Push subscription response"""

    id: str
    endpoint: str
    active: bool


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/subscribe", response_model=PushSubscriptionResponse)
async def subscribe_to_push_notifications(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user_with_rbac),
    db: AsyncSession = Depends(get_db_session),
) -> PushSubscriptionResponse:
    """
    Subscribe to push notifications

    Saves push subscription to database for the current user.
    """
    service = PushNotificationService(db)

    user_id = current_user["user_id"]
    tenant_id = current_user["tenant_id"]

    subscription_id = await service.save_subscription(
        user_id=user_id,
        tenant_id=tenant_id,
        endpoint=subscription.endpoint,
        p256dh=subscription.keys.p256dh,
        auth=subscription.keys.auth,
        expiration_time=subscription.expirationTime,
    )

    return PushSubscriptionResponse(
        id=subscription_id,
        endpoint=subscription.endpoint,
        active=True,
    )


@router.post("/unsubscribe")
async def unsubscribe_from_push_notifications(
    subscription: PushSubscriptionCreate,
    current_user: dict = Depends(get_current_user_with_rbac),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    """
    Unsubscribe from push notifications

    Deactivates push subscription for the current user.
    """
    service = PushNotificationService(db)

    user_id = current_user["user_id"]

    await service.deactivate_subscription(
        user_id=user_id,
        endpoint=subscription.endpoint,
    )

    return {"status": "success", "message": "Unsubscribed successfully"}


@router.post("/send")
async def send_push_notification(
    notification: PushNotificationCreate,
    user_id: str | None = None,
    current_user: dict = Depends(get_current_user_with_rbac),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, Any]:
    """
    Send push notification

    Send push notification to specific user or broadcast to all users in tenant.
    Requires admin role.
    """
    # Check permissions
    if "admin" not in current_user.get("roles", []):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required to send push notifications",
        )

    service = PushNotificationService(db)
    tenant_id = current_user["tenant_id"]

    # Build notification data
    notification_data = {
        "title": notification.title,
        "body": notification.body,
        "url": notification.url,
        "tag": notification.tag,
        "requireInteraction": notification.requireInteraction,
        "data": notification.data or {},
    }

    if user_id:
        # Send to specific user
        result = await service.send_to_user(
            user_id=user_id,
            notification_data=notification_data,
        )
    else:
        # Broadcast to all users in tenant
        result = await service.broadcast_to_tenant(
            tenant_id=tenant_id,
            notification_data=notification_data,
        )

    return {
        "status": "success",
        "sent_count": result["sent"],
        "failed_count": result["failed"],
    }


@router.get("/subscriptions")
async def list_push_subscriptions(
    current_user: dict = Depends(get_current_user_with_rbac),
    db: AsyncSession = Depends(get_db_session),
) -> dict[str, list[PushSubscriptionResponse]]:
    """
    List push subscriptions

    Returns all active push subscriptions for the current user.
    """
    service = PushNotificationService(db)
    user_id = current_user["user_id"]

    subscriptions = await service.get_user_subscriptions(user_id=user_id)

    return {
        "subscriptions": [
            PushSubscriptionResponse(
                id=str(sub.id),
                endpoint=sub.endpoint,
                active=sub.active,
            )
            for sub in subscriptions
        ]
    }
