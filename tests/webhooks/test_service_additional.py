"""
Additional service tests to reach 90% coverage for webhooks service.

Focuses on filtering, statistics, and helper methods.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookSubscription,
    WebhookSubscriptionUpdate,
)
from dotmac.platform.webhooks.service import WebhookSubscriptionService

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestListSubscriptionsFiltering:
    """Test list_subscriptions filtering logic."""

    async def test_list_with_is_active_filter(self):
        """Test filtering by is_active."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        # Test with is_active=True
        result = await service.list_subscriptions(tenant_id="tenant-123", is_active=True)

        assert result == []
        mock_db.execute.assert_called_once()

    async def test_list_with_event_type_filter(self):
        """Test filtering by event_type."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        # Test with event_type filter
        result = await service.list_subscriptions(
            tenant_id="tenant-123", event_type="invoice.created"
        )

        assert result == []
        mock_db.execute.assert_called_once()


@pytest.mark.integration
class TestUpdateSubscription:
    """Test update_subscription edge cases."""

    async def test_update_subscription_not_found(self):
        """Test updating non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        # Mock get_subscription to return None
        service.get_subscription = AsyncMock(return_value=None)

        update_data = WebhookSubscriptionUpdate(events=["payment.succeeded"])
        result = await service.update_subscription(
            subscription_id="nonexistent", tenant_id="tenant-123", update_data=update_data
        )

        assert result is None

    async def test_update_subscription_with_url(self):
        """Test updating subscription URL."""
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        service = WebhookSubscriptionService(mock_db)

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.id = uuid.uuid4()

        service.get_subscription = AsyncMock(return_value=mock_sub)

        update_data = WebhookSubscriptionUpdate(url="https://new.example.com/webhook")

        await service.update_subscription(
            subscription_id=str(mock_sub.id), tenant_id="tenant-123", update_data=update_data
        )

        # Verify URL was converted to string
        assert mock_sub.url == "https://new.example.com/webhook"


@pytest.mark.integration
class TestDeleteSubscription:
    """Test delete_subscription edge cases."""

    async def test_delete_subscription_not_found(self):
        """Test deleting non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        # Mock get_subscription to return None
        service.get_subscription = AsyncMock(return_value=None)

        result = await service.delete_subscription(
            subscription_id="nonexistent", tenant_id="tenant-123"
        )

        assert result is False


@pytest.mark.integration
class TestUpdateStatistics:
    """Test update_statistics method."""

    async def test_update_statistics_success(self):
        """Test updating statistics for successful delivery."""
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()

        service = WebhookSubscriptionService(mock_db)

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.success_count = 0
        mock_sub.failure_count = 0

        service.get_subscription = AsyncMock(return_value=mock_sub)

        await service.update_statistics(
            subscription_id="sub-123", success=True, tenant_id="tenant-123"
        )

        assert mock_sub.success_count == 1
        assert mock_sub.last_success_at is not None

    async def test_update_statistics_failure(self):
        """Test updating statistics for failed delivery."""
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()

        service = WebhookSubscriptionService(mock_db)

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.success_count = 0
        mock_sub.failure_count = 0

        service.get_subscription = AsyncMock(return_value=mock_sub)

        await service.update_statistics(
            subscription_id="sub-123", success=False, tenant_id="tenant-123"
        )

        assert mock_sub.failure_count == 1
        assert mock_sub.last_failure_at is not None

    async def test_update_statistics_without_tenant_id(self):
        """Test updating statistics without tenant_id."""
        mock_db = MagicMock()
        mock_db.commit = AsyncMock()
        mock_result = MagicMock()

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.success_count = 0
        mock_sub.failure_count = 0

        mock_result.scalar_one_or_none.return_value = mock_sub
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        await service.update_statistics(subscription_id=uuid.uuid4(), success=True, tenant_id=None)

        assert mock_sub.success_count == 1

    async def test_update_statistics_subscription_not_found(self):
        """Test updating statistics for non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        service.get_subscription = AsyncMock(return_value=None)

        # Should not raise error
        await service.update_statistics(
            subscription_id="nonexistent", success=True, tenant_id="tenant-123"
        )


@pytest.mark.integration
class TestDisableSubscription:
    """Test disable_subscription method."""

    async def test_disable_subscription_success(self):
        """Test disabling a subscription."""
        from unittest.mock import patch

        mock_db = MagicMock()
        mock_db.commit = AsyncMock()

        service = WebhookSubscriptionService(mock_db)

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.is_active = True
        mock_sub.custom_metadata = {}

        service.get_subscription = AsyncMock(return_value=mock_sub)

        # Mock flag_modified since we're using a mock object
        with patch("dotmac.platform.webhooks.service.flag_modified"):
            await service.disable_subscription(
                subscription_id="sub-123", tenant_id="tenant-123", reason="Too many failures"
            )

        assert mock_sub.is_active is False
        assert mock_sub.custom_metadata["disabled_reason"] == "Too many failures"

    async def test_disable_subscription_not_found(self):
        """Test disabling non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        service.get_subscription = AsyncMock(return_value=None)

        # Should not raise error
        await service.disable_subscription(
            subscription_id="nonexistent", tenant_id="tenant-123", reason="Test"
        )


@pytest.mark.integration
class TestGetSubscriptionSecret:
    """Test get_subscription_secret method."""

    async def test_get_secret_success(self):
        """Test getting subscription secret."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        # Create mock subscription
        mock_sub = MagicMock(spec=WebhookSubscription)
        mock_sub.secret = "whsec_test123"

        service.get_subscription = AsyncMock(return_value=mock_sub)

        secret = await service.get_subscription_secret(
            subscription_id="sub-123", tenant_id="tenant-123"
        )

        assert secret == "whsec_test123"

    async def test_get_secret_not_found(self):
        """Test getting secret for non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        service.get_subscription = AsyncMock(return_value=None)

        secret = await service.get_subscription_secret(
            subscription_id="nonexistent", tenant_id="tenant-123"
        )

        assert secret is None


@pytest.mark.integration
class TestRotateSecret:
    """Test rotate_secret method."""

    async def test_rotate_secret_not_found(self):
        """Test rotating secret for non-existent subscription."""
        mock_db = MagicMock()
        service = WebhookSubscriptionService(mock_db)

        service.get_subscription = AsyncMock(return_value=None)

        result = await service.rotate_secret(subscription_id="nonexistent", tenant_id="tenant-123")

        assert result is None


@pytest.mark.integration
class TestDeliveryMethods:
    """Test delivery-related methods."""

    async def test_get_deliveries_with_status_filter(self):
        """Test getting deliveries with status filter."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        sub_id = str(uuid.uuid4())

        result = await service.get_deliveries(
            subscription_id=sub_id, tenant_id="tenant-123", status=DeliveryStatus.FAILED
        )

        assert result == []
        mock_db.execute.assert_called_once()

    async def test_get_recent_deliveries(self):
        """Test getting recent deliveries."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        result = await service.get_recent_deliveries(tenant_id="tenant-123", limit=50)

        assert result == []
        mock_db.execute.assert_called_once()

    async def test_get_delivery(self):
        """Test getting specific delivery."""
        mock_db = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        service = WebhookSubscriptionService(mock_db)

        delivery_id = str(uuid.uuid4())

        result = await service.get_delivery(delivery_id=delivery_id, tenant_id="tenant-123")

        assert result is None
        mock_db.execute.assert_called_once()
