"""
Push Notification Service
Service for managing and sending push notifications
"""

import json
import logging
from datetime import datetime
from typing import Any

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.push.models import PushSubscription
from dotmac.platform.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class PushNotificationService:
    """Service for push notification management"""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def save_subscription(
        self,
        user_id: str,
        tenant_id: str,
        endpoint: str,
        p256dh: str,
        auth: str,
        expiration_time: int | None = None,
    ) -> str:
        """
        Save push subscription

        Args:
            user_id: User ID
            tenant_id: Tenant ID
            endpoint: Push subscription endpoint
            p256dh: P256DH key
            auth: Auth key
            expiration_time: Optional expiration time

        Returns:
            Subscription ID
        """
        # Check if subscription already exists
        stmt = select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing subscription
            existing.p256dh = p256dh
            existing.auth = auth
            existing.expiration_time = expiration_time
            existing.active = True
            existing.updated_at = datetime.utcnow()

            await self.session.commit()
            return str(existing.id)

        # Create new subscription
        subscription = PushSubscription(
            user_id=user_id,
            tenant_id=tenant_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
            expiration_time=expiration_time,
            active=True,
        )

        self.session.add(subscription)
        await self.session.commit()
        await self.session.refresh(subscription)

        return str(subscription.id)

    async def deactivate_subscription(self, user_id: str, endpoint: str) -> bool:
        """
        Deactivate push subscription

        Args:
            user_id: User ID
            endpoint: Push subscription endpoint

        Returns:
            True if subscription was deactivated
        """
        stmt = select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.endpoint == endpoint,
        )
        result = await self.session.execute(stmt)
        subscription = result.scalar_one_or_none()

        if subscription:
            subscription.active = False
            subscription.updated_at = datetime.utcnow()
            await self.session.commit()
            return True

        return False

    async def get_user_subscriptions(self, user_id: str) -> list[PushSubscription]:
        """
        Get all active subscriptions for user

        Args:
            user_id: User ID

        Returns:
            List of push subscriptions
        """
        stmt = select(PushSubscription).where(
            PushSubscription.user_id == user_id,
            PushSubscription.active == True,  # noqa: E712
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def send_to_user(
        self,
        user_id: str,
        notification_data: dict[str, Any],
    ) -> dict[str, int]:
        """
        Send push notification to specific user

        Args:
            user_id: User ID
            notification_data: Notification payload

        Returns:
            Dict with sent and failed counts
        """
        subscriptions = await self.get_user_subscriptions(user_id)

        sent = 0
        failed = 0

        for subscription in subscriptions:
            success = await self._send_notification(subscription, notification_data)
            if success:
                sent += 1
            else:
                failed += 1

        return {"sent": sent, "failed": failed}

    async def broadcast_to_tenant(
        self,
        tenant_id: str,
        notification_data: dict[str, Any],
    ) -> dict[str, int]:
        """
        Broadcast push notification to all users in tenant

        Args:
            tenant_id: Tenant ID
            notification_data: Notification payload

        Returns:
            Dict with sent and failed counts
        """
        stmt = select(PushSubscription).where(
            PushSubscription.tenant_id == tenant_id,
            PushSubscription.active == True,  # noqa: E712
        )
        result = await self.session.execute(stmt)
        subscriptions = list(result.scalars().all())

        sent = 0
        failed = 0

        for subscription in subscriptions:
            success = await self._send_notification(subscription, notification_data)
            if success:
                sent += 1
            else:
                failed += 1

        return {"sent": sent, "failed": failed}

    async def _send_notification(
        self,
        subscription: PushSubscription,
        notification_data: dict[str, Any],
    ) -> bool:
        """
        Send push notification to subscription

        Args:
            subscription: Push subscription
            notification_data: Notification payload

        Returns:
            True if notification was sent successfully
        """
        try:
            # Build subscription info for py-webpush
            subscription_info = {
                "endpoint": subscription.endpoint,
                "keys": {
                    "p256dh": subscription.p256dh,
                    "auth": subscription.auth,
                },
            }

            # Get VAPID keys from settings
            vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", None)
            if not vapid_private_key:
                logger.error("Push notification VAPID_PRIVATE_KEY not configured")
                return False

            vapid_email = getattr(settings, "VAPID_EMAIL", None) or "noreply@dotmac.com"
            vapid_claims = {
                "sub": f"mailto:{vapid_email}",
            }

            # Send notification
            webpush(
                subscription_info=subscription_info,
                data=json.dumps(notification_data),
                vapid_private_key=vapid_private_key,
                vapid_claims=vapid_claims,
            )

            logger.info(f"Push notification sent to user {subscription.user_id}")
            return True

        except WebPushException as e:
            logger.error(f"Failed to send push notification to user {subscription.user_id}: {e}")

            # If subscription is expired or invalid, deactivate it
            if e.response and e.response.status_code in [404, 410]:
                subscription.active = False
                await self.session.commit()

            return False

        except Exception as e:
            logger.error(
                f"Unexpected error sending push notification to user {subscription.user_id}: {e}"
            )
            return False
