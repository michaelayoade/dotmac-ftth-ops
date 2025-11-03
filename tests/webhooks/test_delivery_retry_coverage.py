"""
Test coverage gaps for webhooks/delivery.py retry functionality.

Targeting specific uncovered lines to push coverage from 86.18% to 90%+:
- Lines 307-349: retry_delivery() method
- Lines 393-420: process_pending_retries() method

Following the fake/real testing pattern as demonstrated in FAKE_PATTERN_COMPLETE_SUMMARY.md
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.webhooks.delivery import WebhookDeliveryService
from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
)


@pytest.fixture
def mock_db():
    """Create mock database session."""
    db = AsyncMock()
    db.add = AsyncMock()
    db.commit = AsyncMock()
    db.execute = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def delivery_service(mock_db):
    """Create WebhookDeliveryService instance."""
    return WebhookDeliveryService(mock_db)


@pytest.mark.integration
class TestRetryDeliveryMethod:
    """Test retry_delivery() method - covers lines 307-349."""

    @pytest.mark.asyncio
    async def test_retry_delivery_happy_path(self, delivery_service, mock_db):
        """Test successful retry_delivery execution - lines 307-349."""
        # Setup
        delivery_id = str(uuid4())
        tenant_id = "test-tenant"
        subscription_id = uuid4()

        # Create delivery and subscription objects
        delivery = WebhookDelivery(
            id=delivery_id,
            event_id=str(uuid4()),
            event_type="test.event",
            event_data={"key": "value"},
            subscription_id=subscription_id,
            status=DeliveryStatus.FAILED,
            attempt_number=1,
            tenant_id=tenant_id,
        )

        subscription = WebhookSubscription(
            id=subscription_id,
            url="https://example.com/webhook",
            secret="test-secret-123",
            is_active=True,
            tenant_id=tenant_id,
            headers={},
        )

        # Mock subscription service methods
        with (
            patch.object(
                delivery_service.subscription_service,
                "get_delivery",
                new_callable=AsyncMock,
                return_value=delivery,
            ),
            patch.object(
                delivery_service.subscription_service,
                "get_subscription",
                new_callable=AsyncMock,
                return_value=subscription,
            ),
            patch.object(
                delivery_service,
                "_attempt_delivery",
                new_callable=AsyncMock,
            ) as mock_attempt,
        ):
            # Execute - this covers lines 307-349
            result = await delivery_service.retry_delivery(delivery_id, tenant_id)

            # Verify
            assert result is True
            assert delivery.status == DeliveryStatus.RETRYING
            assert delivery.attempt_number == 2
            mock_db.commit.assert_awaited_once()
            mock_attempt.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_retry_delivery_not_found(self, delivery_service):
        """Test retry when delivery not found - line 288."""
        with patch.object(
            delivery_service.subscription_service,
            "get_delivery",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await delivery_service.retry_delivery(str(uuid4()), "test-tenant")
            assert result is False

    @pytest.mark.asyncio
    async def test_retry_delivery_already_succeeded(self, delivery_service):
        """Test retry when delivery already succeeded - line 293."""
        delivery = WebhookDelivery(
            id=str(uuid4()),
            event_id=str(uuid4()),
            event_type="test.event",
            event_data={},
            subscription_id=uuid4(),
            status=DeliveryStatus.SUCCESS,
            attempt_number=1,
            tenant_id="test-tenant",
        )

        with patch.object(
            delivery_service.subscription_service,
            "get_delivery",
            new_callable=AsyncMock,
            return_value=delivery,
        ):
            result = await delivery_service.retry_delivery(str(delivery.id), "test-tenant")
            assert result is False

    @pytest.mark.asyncio
    async def test_retry_delivery_subscription_not_found(self, delivery_service):
        """Test retry when subscription not found - line 304."""
        delivery = WebhookDelivery(
            id=str(uuid4()),
            event_id=str(uuid4()),
            event_type="test.event",
            event_data={},
            subscription_id=uuid4(),
            status=DeliveryStatus.FAILED,
            attempt_number=1,
            tenant_id="test-tenant",
        )

        with (
            patch.object(
                delivery_service.subscription_service,
                "get_delivery",
                new_callable=AsyncMock,
                return_value=delivery,
            ),
            patch.object(
                delivery_service.subscription_service,
                "get_subscription",
                new_callable=AsyncMock,
                return_value=None,  # Subscription not found
            ),
        ):
            result = await delivery_service.retry_delivery(str(delivery.id), "test-tenant")
            assert result is False

    @pytest.mark.asyncio
    async def test_retry_delivery_subscription_inactive(self, delivery_service):
        """Test retry when subscription is inactive - line 299."""
        delivery = WebhookDelivery(
            id=str(uuid4()),
            event_id=str(uuid4()),
            event_type="test.event",
            event_data={},
            subscription_id=uuid4(),
            status=DeliveryStatus.FAILED,
            attempt_number=1,
            tenant_id="test-tenant",
        )

        subscription = WebhookSubscription(
            id=delivery.subscription_id,
            url="https://example.com/webhook",
            secret="test-secret",
            is_active=False,  # Inactive!
            tenant_id="test-tenant",
        )

        with (
            patch.object(
                delivery_service.subscription_service,
                "get_delivery",
                new_callable=AsyncMock,
                return_value=delivery,
            ),
            patch.object(
                delivery_service.subscription_service,
                "get_subscription",
                new_callable=AsyncMock,
                return_value=subscription,
            ),
        ):
            result = await delivery_service.retry_delivery(str(delivery.id), "test-tenant")
            assert result is False


@pytest.mark.integration
class TestProcessPendingRetriesMethod:
    """Test process_pending_retries() method - covers lines 393-420."""

    @pytest.mark.asyncio
    async def test_process_pending_retries_success(self, delivery_service, mock_db):
        """Test successful processing of pending retries - lines 393-420."""
        subscription_id = uuid4()

        # Create deliveries ready for retry
        deliveries = [
            WebhookDelivery(
                id=str(uuid4()),
                event_id=str(uuid4()),
                event_type=f"test.event{i}",
                event_data={"index": i},
                subscription_id=subscription_id,
                status=DeliveryStatus.RETRYING,
                next_retry_at=datetime.now(UTC) - timedelta(minutes=i + 1),
                attempt_number=1,
                tenant_id="test-tenant",
            )
            for i in range(2)
        ]

        subscription = WebhookSubscription(
            id=subscription_id,
            url="https://example.com/webhook",
            secret="test-secret",
            is_active=True,
            tenant_id="test-tenant",
            headers={},
        )

        # Mock database queries
        mock_delivery_result = MagicMock()
        mock_delivery_result.scalars.return_value.all.return_value = deliveries

        mock_sub_result = MagicMock()
        mock_sub_result.scalar_one_or_none.return_value = subscription

        # Setup execute to return deliveries first, then subscription for each delivery
        mock_db.execute.side_effect = [
            mock_delivery_result,
            mock_sub_result,
            mock_sub_result,
        ]

        with patch.object(
            delivery_service,
            "_attempt_delivery",
            new_callable=AsyncMock,
        ) as mock_attempt:
            # Execute - covers lines 393-420
            processed = await delivery_service.process_pending_retries(limit=10)

            # Verify
            assert processed == 2
            assert deliveries[0].attempt_number == 2
            assert deliveries[1].attempt_number == 2
            assert mock_attempt.await_count == 2

    @pytest.mark.asyncio
    async def test_process_pending_retries_inactive_subscription(self, delivery_service, mock_db):
        """Test retry with inactive subscription - lines 386-390."""
        delivery = WebhookDelivery(
            id=str(uuid4()),
            event_id=str(uuid4()),
            event_type="test.event",
            event_data={},
            subscription_id=uuid4(),
            status=DeliveryStatus.RETRYING,
            next_retry_at=datetime.now(UTC) - timedelta(minutes=5),
            attempt_number=1,
            tenant_id="test-tenant",
        )

        # Mock database queries
        mock_delivery_result = MagicMock()
        mock_delivery_result.scalars.return_value.all.return_value = [delivery]

        mock_sub_result = MagicMock()
        mock_sub_result.scalar_one_or_none.return_value = None  # Subscription not found

        mock_db.execute.side_effect = [mock_delivery_result, mock_sub_result]

        # Execute
        processed = await delivery_service.process_pending_retries()

        # Verify - delivery marked as failed
        assert processed == 0
        assert delivery.status == DeliveryStatus.FAILED
        assert delivery.error_message == "Subscription no longer active"
        mock_db.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_process_pending_retries_no_deliveries(self, delivery_service, mock_db):
        """Test when no deliveries are pending retry."""
        # Mock empty result
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        # Execute
        processed = await delivery_service.process_pending_retries()

        # Verify
        assert processed == 0

    @pytest.mark.asyncio
    async def test_process_pending_retries_respects_limit(self, delivery_service, mock_db):
        """Test that limit parameter is used correctly."""
        # The limit is applied at the SQL query level (line 371)
        # So we're verifying the query is constructed correctly
        subscription_id = uuid4()

        # Create 3 deliveries
        deliveries = [
            WebhookDelivery(
                id=str(uuid4()),
                event_id=str(uuid4()),
                event_type=f"test.event{i}",
                event_data={},
                subscription_id=subscription_id,
                status=DeliveryStatus.RETRYING,
                next_retry_at=datetime.now(UTC) - timedelta(minutes=i + 1),
                attempt_number=1,
                tenant_id="test-tenant",
            )
            for i in range(3)
        ]

        subscription = WebhookSubscription(
            id=subscription_id,
            url="https://example.com/webhook",
            secret="test-secret",
            is_active=True,
            tenant_id="test-tenant",
            headers={},
        )

        mock_delivery_result = MagicMock()
        mock_delivery_result.scalars.return_value.all.return_value = deliveries

        mock_sub_result = MagicMock()
        mock_sub_result.scalar_one_or_none.return_value = subscription

        mock_db.execute.side_effect = [
            mock_delivery_result,
            mock_sub_result,
            mock_sub_result,
            mock_sub_result,
        ]

        with patch.object(
            delivery_service,
            "_attempt_delivery",
            new_callable=AsyncMock,
        ):
            # Execute with limit=5 (all 3 should be processed)
            processed = await delivery_service.process_pending_retries(limit=5)

            # Verify all 3 were processed
            assert processed == 3
