"""
Webhook delivery service with retry logic and HMAC signatures.
"""

import hashlib
import hmac
import time
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookEventPayload,
    WebhookSubscription,
)
from .service import WebhookSubscriptionService

logger = structlog.get_logger(__name__)


class WebhookDeliveryService:
    """Service for delivering webhooks with retry logic."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.subscription_service = WebhookSubscriptionService(db)

    def _generate_signature(self, payload: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 signature for webhook payload."""
        return hmac.new(
            secret.encode("utf-8"),
            payload,
            hashlib.sha256,
        ).hexdigest()

    def _build_headers(
        self,
        subscription: WebhookSubscription,
        signature: str,
        event_id: str,
        event_type: str,
    ) -> dict[str, str]:
        """Build HTTP headers for webhook request."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "DotMac-Webhooks/1.0",
            "X-Webhook-Signature": signature,
            "X-Webhook-Event-Id": event_id,
            "X-Webhook-Event-Type": event_type,
            "X-Webhook-Timestamp": datetime.now(UTC).isoformat(),
        }

        # Add custom headers from subscription
        headers.update(subscription.headers)

        return headers

    async def deliver(
        self,
        subscription: WebhookSubscription,
        event_type: str,
        event_data: dict[str, Any],
        event_id: str | None = None,
        tenant_id: str | None = None,
    ) -> WebhookDelivery:
        """
        Deliver webhook to endpoint.

        Args:
            subscription: Webhook subscription
            event_type: Event type (e.g., "invoice.created")
            event_data: Event payload data
            event_id: Optional event ID for idempotency
            tenant_id: Optional tenant ID

        Returns:
            WebhookDelivery record
        """
        # Use tenant_id from subscription if not provided
        if tenant_id is None:
            tenant_id = subscription.tenant_id

        # Generate event ID if not provided
        if event_id is None:
            event_id = str(uuid.uuid4())

        # Build webhook payload
        payload = WebhookEventPayload(
            id=event_id,
            type=event_type,
            timestamp=datetime.now(UTC),
            data=event_data,
            tenant_id=tenant_id,
        )

        payload_json = payload.model_dump_json()
        payload_bytes = payload_json.encode("utf-8")

        # Generate signature
        signature = self._generate_signature(payload_bytes, subscription.secret)

        # Build headers
        headers = self._build_headers(
            subscription=subscription,
            signature=signature,
            event_id=event_id,
            event_type=event_type,
        )

        # Create delivery record
        delivery = WebhookDelivery(
            tenant_id=tenant_id,
            subscription_id=subscription.id,
            event_type=event_type,
            event_id=event_id,
            event_data=event_data,
            status=DeliveryStatus.PENDING,
            attempt_number=1,
        )

        self.db.add(delivery)
        await self.db.commit()
        await self.db.refresh(delivery)

        # Attempt delivery
        await self._attempt_delivery(
            delivery=delivery,
            subscription=subscription,
            payload_bytes=payload_bytes,
            headers=headers,
        )

        return delivery

    async def _attempt_delivery(
        self,
        delivery: WebhookDelivery,
        subscription: WebhookSubscription,
        payload_bytes: bytes,
        headers: dict[str, str],
    ) -> None:
        """Attempt to deliver webhook."""
        start_time = time.time()

        try:
            async with httpx.AsyncClient(timeout=subscription.timeout_seconds) as client:
                response = await client.post(
                    subscription.url,
                    content=payload_bytes,
                    headers=headers,
                )

                duration_ms = int((time.time() - start_time) * 1000)

                # Update delivery record
                delivery.response_code = response.status_code
                delivery.response_body = response.text[:1000]  # Truncate large responses
                delivery.duration_ms = duration_ms

                # Handle response
                if response.status_code == 410:
                    # 410 Gone - endpoint permanently disabled
                    delivery.status = DeliveryStatus.DISABLED
                    delivery.error_message = "Endpoint returned 410 Gone (permanently disabled)"

                    # Disable subscription
                    await self.subscription_service.disable_subscription(
                        subscription_id=str(subscription.id),
                        tenant_id=subscription.tenant_id,
                        reason="Endpoint returned 410 Gone",
                    )

                    logger.warning(
                        "Webhook endpoint returned 410 Gone, subscription disabled",
                        subscription_id=str(subscription.id),
                        url=subscription.url,
                    )

                elif 200 <= response.status_code < 300:
                    # Success
                    delivery.status = DeliveryStatus.SUCCESS

                    # Update subscription statistics
                    await self.subscription_service.update_statistics(
                        subscription_id=str(subscription.id),
                        success=True,
                        tenant_id=subscription.tenant_id,
                    )

                    logger.info(
                        "Webhook delivered successfully",
                        subscription_id=str(subscription.id),
                        event_type=delivery.event_type,
                        status_code=response.status_code,
                        duration_ms=duration_ms,
                    )

                else:
                    # Failure - schedule retry if enabled
                    delivery.status = DeliveryStatus.FAILED
                    delivery.error_message = f"HTTP {response.status_code}: {response.text[:500]}"

                    await self._handle_failure(delivery, subscription)

        except httpx.TimeoutException:
            duration_ms = int((time.time() - start_time) * 1000)
            delivery.status = DeliveryStatus.FAILED
            delivery.error_message = f"Request timeout after {subscription.timeout_seconds}s"
            delivery.duration_ms = duration_ms

            await self._handle_failure(delivery, subscription)

        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            delivery.status = DeliveryStatus.FAILED
            delivery.error_message = f"Delivery error: {str(e)}"
            delivery.duration_ms = duration_ms

            await self._handle_failure(delivery, subscription)

        finally:
            await self.db.commit()

    async def _handle_failure(
        self,
        delivery: WebhookDelivery,
        subscription: WebhookSubscription,
    ) -> None:
        """Handle failed delivery and schedule retry if applicable."""
        # Update subscription failure statistics
        await self.subscription_service.update_statistics(
            subscription_id=str(subscription.id),
            success=False,
            tenant_id=subscription.tenant_id,
        )

        # Check if retry is enabled and within retry limit
        if subscription.retry_enabled and delivery.attempt_number < subscription.max_retries:
            # Schedule retry with exponential backoff
            # Retry delays: 5min, 1hr, 6hrs
            retry_delays = [300, 3600, 21600]  # seconds
            delay_index = min(delivery.attempt_number - 1, len(retry_delays) - 1)
            delay_seconds = retry_delays[delay_index]

            delivery.status = DeliveryStatus.RETRYING
            delivery.next_retry_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)

            logger.warning(
                "Webhook delivery failed, scheduling retry",
                subscription_id=str(subscription.id),
                event_type=delivery.event_type,
                attempt=delivery.attempt_number,
                next_retry_at=delivery.next_retry_at.isoformat(),
                error=delivery.error_message,
            )

        else:
            # No more retries
            delivery.status = DeliveryStatus.FAILED

            logger.error(
                "Webhook delivery failed (no retries left)",
                subscription_id=str(subscription.id),
                event_type=delivery.event_type,
                attempts=delivery.attempt_number,
                error=delivery.error_message,
            )

    async def retry_delivery(self, delivery_id: str, tenant_id: str) -> bool:
        """
        Manually retry a failed delivery.

        Args:
            delivery_id: Delivery ID to retry
            tenant_id: Tenant ID for authorization

        Returns:
            True if retry was initiated, False otherwise
        """
        # Get delivery
        delivery = await self.subscription_service.get_delivery(delivery_id, tenant_id)
        if not delivery:
            logger.warning("Delivery not found for retry", delivery_id=delivery_id)
            return False

        # Check if already succeeded
        if delivery.status == DeliveryStatus.SUCCESS:
            logger.info("Delivery already succeeded, skipping retry", delivery_id=delivery_id)
            return False

        # Get subscription
        subscription = await self.subscription_service.get_subscription(
            str(delivery.subscription_id), tenant_id
        )
        if not subscription or not subscription.is_active:
            logger.warning(
                "Subscription not found or inactive",
                subscription_id=str(delivery.subscription_id),
            )
            return False

        # Create new payload
        payload = WebhookEventPayload(
            id=delivery.event_id,
            type=delivery.event_type,
            timestamp=datetime.now(UTC),
            data=delivery.event_data,
            tenant_id=tenant_id,
        )

        payload_json = payload.model_dump_json()
        payload_bytes = payload_json.encode("utf-8")

        # Generate new signature
        signature = self._generate_signature(payload_bytes, subscription.secret)

        # Build headers
        headers = self._build_headers(
            subscription=subscription,
            signature=signature,
            event_id=delivery.event_id,
            event_type=delivery.event_type,
        )

        # Increment attempt number
        delivery.attempt_number += 1
        delivery.status = DeliveryStatus.RETRYING

        await self.db.commit()

        # Attempt delivery
        await self._attempt_delivery(
            delivery=delivery,
            subscription=subscription,
            payload_bytes=payload_bytes,
            headers=headers,
        )

        logger.info(
            "Manual retry initiated",
            delivery_id=delivery_id,
            attempt_number=delivery.attempt_number,
        )

        return True

    async def process_pending_retries(self, limit: int = 100) -> int:
        """
        Process pending retries (called by background task).

        Args:
            limit: Maximum number of retries to process

        Returns:
            Number of retries processed
        """
        from sqlalchemy import select

        # Find deliveries ready for retry
        now = datetime.now(UTC)
        stmt = (
            select(WebhookDelivery)
            .where(
                WebhookDelivery.status == DeliveryStatus.RETRYING,
                WebhookDelivery.next_retry_at <= now,
            )
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        deliveries = result.scalars().all()

        processed = 0
        for delivery in deliveries:
            # Get subscription
            stmt_sub = select(WebhookSubscription).where(
                WebhookSubscription.id == delivery.subscription_id
            )
            result_sub = await self.db.execute(stmt_sub)
            subscription = result_sub.scalar_one_or_none()

            if not subscription or not subscription.is_active:
                delivery.status = DeliveryStatus.FAILED
                delivery.error_message = "Subscription no longer active"
                await self.db.commit()
                continue

            # Retry delivery
            payload = WebhookEventPayload(
                id=delivery.event_id,
                type=delivery.event_type,
                timestamp=datetime.now(UTC),
                data=delivery.event_data,
                tenant_id=delivery.tenant_id,
            )

            payload_json = payload.model_dump_json()
            payload_bytes = payload_json.encode("utf-8")

            signature = self._generate_signature(payload_bytes, subscription.secret)
            headers = self._build_headers(
                subscription=subscription,
                signature=signature,
                event_id=delivery.event_id,
                event_type=delivery.event_type,
            )

            delivery.attempt_number += 1
            await self._attempt_delivery(
                delivery=delivery,
                subscription=subscription,
                payload_bytes=payload_bytes,
                headers=headers,
            )

            processed += 1

        logger.info("Processed pending webhook retries", count=processed)
        return processed
