"""
Webhook subscription service for CRUD operations.
"""

import uuid
from datetime import UTC, datetime

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from .models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
    WebhookSubscriptionCreate,
    WebhookSubscriptionUpdate,
    generate_webhook_secret,
)

logger = structlog.get_logger(__name__)


class WebhookSubscriptionService:
    """Service for managing webhook subscriptions."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create_subscription(
        self,
        tenant_id: str,
        subscription_data: WebhookSubscriptionCreate,
    ) -> WebhookSubscription:
        """Create a new webhook subscription."""
        # Generate secure signing secret
        secret = generate_webhook_secret()

        subscription = WebhookSubscription(
            tenant_id=tenant_id,
            url=str(subscription_data.url),
            description=subscription_data.description,
            events=subscription_data.events,
            secret=secret,
            headers=subscription_data.headers,
            retry_enabled=subscription_data.retry_enabled,
            max_retries=subscription_data.max_retries,
            timeout_seconds=subscription_data.timeout_seconds,
            metadata=subscription_data.custom_metadata,
            is_active=True,
            success_count=0,
            failure_count=0,
        )

        self.db.add(subscription)
        await self.db.commit()
        await self.db.refresh(subscription)

        logger.info(
            "Webhook subscription created",
            subscription_id=str(subscription.id),
            tenant_id=tenant_id,
            url=subscription.url,
            events=subscription.events,
        )

        return subscription

    async def get_subscription(
        self, subscription_id: str, tenant_id: str
    ) -> WebhookSubscription | None:
        """Get webhook subscription by ID."""
        stmt = select(WebhookSubscription).where(
            WebhookSubscription.id == uuid.UUID(subscription_id),
            WebhookSubscription.tenant_id == tenant_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_subscriptions(
        self,
        tenant_id: str,
        is_active: bool | None = None,
        event_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WebhookSubscription]:
        """List webhook subscriptions with optional filtering."""
        stmt = select(WebhookSubscription).where(WebhookSubscription.tenant_id == tenant_id)

        if is_active is not None:
            stmt = stmt.where(WebhookSubscription.is_active == is_active)

        stmt = stmt.order_by(WebhookSubscription.created_at.desc())

        if event_type is None:
            stmt = stmt.limit(limit).offset(offset)
            result = await self.db.execute(stmt)
            return list(result.scalars().all())

        result = await self.db.execute(stmt)
        all_subscriptions = list(result.scalars().all())
        filtered = [sub for sub in all_subscriptions if event_type in sub.events]
        return filtered[offset : offset + limit]

    async def update_subscription(
        self,
        subscription_id: str,
        tenant_id: str,
        update_data: WebhookSubscriptionUpdate,
    ) -> WebhookSubscription | None:
        """Update webhook subscription."""
        subscription = await self.get_subscription(subscription_id, tenant_id)
        if not subscription:
            return None

        # Update fields if provided
        update_dict = update_data.model_dump(exclude_unset=True)

        # Convert HttpUrl to string if present
        if "url" in update_dict and update_dict["url"]:
            update_dict["url"] = str(update_dict["url"])

        for field, value in update_dict.items():
            setattr(subscription, field, value)

        subscription.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(subscription)

        logger.info(
            "Webhook subscription updated",
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            updated_fields=list(update_dict.keys()),
        )

        return subscription

    async def delete_subscription(self, subscription_id: str, tenant_id: str) -> bool:
        """Delete webhook subscription."""
        subscription = await self.get_subscription(subscription_id, tenant_id)
        if not subscription:
            return False

        await self.db.delete(subscription)
        await self.db.commit()

        logger.info(
            "Webhook subscription deleted",
            subscription_id=subscription_id,
            tenant_id=tenant_id,
        )

        return True

    async def get_subscriptions_for_event(
        self, event_type: str, tenant_id: str
    ) -> list[WebhookSubscription]:
        """Get all active subscriptions for a specific event type and tenant."""
        stmt = select(WebhookSubscription).where(
            WebhookSubscription.tenant_id == tenant_id,
            WebhookSubscription.is_active,
        )

        result = await self.db.execute(stmt)
        all_subscriptions = result.scalars().all()

        # Filter in Python since JSON contains query is DB-specific
        matching_subscriptions = [sub for sub in all_subscriptions if event_type in sub.events]

        return matching_subscriptions

    async def update_statistics(
        self,
        subscription_id: str,
        success: bool,
        tenant_id: str | None = None,
    ) -> None:
        """Update subscription success/failure statistics."""
        if tenant_id:
            subscription = await self.get_subscription(str(subscription_id), tenant_id)
        else:
            # For internal calls without tenant_id
            stmt = select(WebhookSubscription).where(WebhookSubscription.id == subscription_id)
            result = await self.db.execute(stmt)
            subscription = result.scalar_one_or_none()

        if not subscription:
            return

        now = datetime.now(UTC)
        subscription.last_triggered_at = now

        if success:
            subscription.success_count += 1
            subscription.last_success_at = now
        else:
            subscription.failure_count += 1
            subscription.last_failure_at = now

        await self.db.commit()

    async def disable_subscription(
        self, subscription_id: str, tenant_id: str | None, reason: str
    ) -> None:
        """Disable a webhook subscription (e.g., after repeated failures)."""
        if tenant_id:
            subscription = await self.get_subscription(subscription_id, tenant_id)
        else:
            stmt = select(WebhookSubscription).where(
                WebhookSubscription.id == uuid.UUID(subscription_id)
            )
            result = await self.db.execute(stmt)
            subscription = result.scalar_one_or_none()
        if not subscription:
            return

        subscription.is_active = False
        metadata = dict(subscription.custom_metadata or {})
        metadata["disabled_reason"] = reason
        metadata["disabled_at"] = datetime.now(UTC).isoformat()
        subscription.custom_metadata = metadata
        # Mark the JSON field as modified so SQLAlchemy persists the changes
        flag_modified(subscription, "custom_metadata")

        await self.db.commit()

        logger.warning(
            "Webhook subscription disabled",
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            reason=reason,
        )

    async def get_subscription_secret(self, subscription_id: str, tenant_id: str) -> str | None:
        """Get webhook secret for signature verification (sensitive operation)."""
        subscription = await self.get_subscription(subscription_id, tenant_id)
        return subscription.secret if subscription else None

    async def rotate_secret(self, subscription_id: str, tenant_id: str) -> str | None:
        """Rotate webhook signing secret."""
        subscription = await self.get_subscription(subscription_id, tenant_id)
        if not subscription:
            return None

        old_secret = subscription.secret
        new_secret = generate_webhook_secret()

        subscription.secret = new_secret
        metadata = dict(subscription.custom_metadata or {})
        metadata["secret_rotated_at"] = datetime.now(UTC).isoformat()
        metadata["previous_secret_hash"] = old_secret[:8]  # Store hint only
        subscription.custom_metadata = metadata
        # Mark the JSON field as modified so SQLAlchemy persists the changes
        flag_modified(subscription, "custom_metadata")

        await self.db.commit()

        logger.info(
            "Webhook secret rotated",
            subscription_id=subscription_id,
            tenant_id=tenant_id,
        )

        return new_secret

    # Delivery log methods

    async def get_deliveries(
        self,
        subscription_id: str,
        tenant_id: str,
        status: DeliveryStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[WebhookDelivery]:
        """Get delivery logs for a subscription."""
        stmt = (
            select(WebhookDelivery)
            .where(
                WebhookDelivery.subscription_id == uuid.UUID(subscription_id),
                WebhookDelivery.tenant_id == tenant_id,
            )
            .order_by(WebhookDelivery.created_at.desc())
        )

        if status:
            stmt = stmt.where(WebhookDelivery.status == status)

        stmt = stmt.limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_recent_deliveries(
        self,
        tenant_id: str,
        limit: int = 50,
    ) -> list[WebhookDelivery]:
        """Get recent deliveries across all subscriptions for a tenant."""
        stmt = (
            select(WebhookDelivery)
            .where(WebhookDelivery.tenant_id == tenant_id)
            .order_by(WebhookDelivery.created_at.desc())
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_delivery(self, delivery_id: str, tenant_id: str) -> WebhookDelivery | None:
        """Get specific delivery log."""
        stmt = select(WebhookDelivery).where(
            WebhookDelivery.id == uuid.UUID(delivery_id),
            WebhookDelivery.tenant_id == tenant_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
