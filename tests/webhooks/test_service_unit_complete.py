"""
Comprehensive unit tests for WebhookSubscriptionService.

Tests all CRUD operations, statistics, secret management, and delivery logs
with mocked database to achieve high coverage.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, Mock
from uuid import UUID, uuid4

import pytest

from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
    WebhookSubscriptionCreate,
    WebhookSubscriptionUpdate,
)
from dotmac.platform.webhooks.service import WebhookSubscriptionService


@pytest.fixture
def mock_db_session():
    """Create mock database session."""
    session = AsyncMock()
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    return session


@pytest.fixture
def webhook_service(mock_db_session):
    """Create webhook service with mocked DB."""
    return WebhookSubscriptionService(mock_db_session)


@pytest.fixture
def tenant_id():
    """Sample tenant ID."""
    return "tenant-123"


@pytest.fixture
def subscription_id():
    """Sample subscription UUID."""
    return str(uuid4())


@pytest.fixture
def sample_subscription(tenant_id):
    """Create sample webhook subscription."""
    return WebhookSubscription(
        id=uuid4(),
        tenant_id=tenant_id,
        url="https://api.example.com/webhooks",
        description="Test webhook",
        events=["user.registered", "user.updated"],
        secret="test-secret-key",
        headers={"Authorization": "Bearer token"},
        retry_enabled=True,
        max_retries=3,
        timeout_seconds=30,
        metadata={"key": "value"},
        is_active=True,
        success_count=10,
        failure_count=2,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.mark.unit
class TestCreateSubscription:
    """Test subscription creation."""

    @pytest.mark.asyncio
    async def test_create_subscription_success(self, webhook_service, mock_db_session, tenant_id):
        """Test successful subscription creation."""
        subscription_data = WebhookSubscriptionCreate(
            url="https://api.example.com/webhooks",
            description="Test webhook",
            events=["user.registered", "user.updated"],
            headers={"Authorization": "Bearer token"},
            retry_enabled=True,
            max_retries=5,
            timeout_seconds=60,
            custom_metadata={"environment": "production"},
        )

        # Mock refresh to set ID
        async def mock_refresh(obj):
            obj.id = uuid4()

        mock_db_session.refresh.side_effect = mock_refresh

        subscription = await webhook_service.create_subscription(tenant_id, subscription_data)

        # Verify subscription was created correctly
        assert subscription.url == "https://api.example.com/webhooks"
        assert subscription.tenant_id == tenant_id
        assert subscription.description == "Test webhook"
        assert "user.registered" in subscription.events
        assert "user.updated" in subscription.events
        assert subscription.headers == {"Authorization": "Bearer token"}
        assert subscription.retry_enabled is True
        assert subscription.max_retries == 5
        assert subscription.timeout_seconds == 60
        assert subscription.metadata == {"environment": "production"}
        assert subscription.is_active is True
        assert subscription.success_count == 0
        assert subscription.failure_count == 0
        assert subscription.secret is not None

        # Verify DB operations
        mock_db_session.add.assert_called_once()
        mock_db_session.commit.assert_called_once()
        mock_db_session.refresh.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_subscription_minimal(self, webhook_service, mock_db_session, tenant_id):
        """Test subscription creation with minimal data."""
        subscription_data = WebhookSubscriptionCreate(
            url="https://minimal.example.com/webhook",
            events=["payment.succeeded"],
        )

        async def mock_refresh(obj):
            obj.id = uuid4()

        mock_db_session.refresh.side_effect = mock_refresh

        subscription = await webhook_service.create_subscription(tenant_id, subscription_data)

        assert subscription.url == "https://minimal.example.com/webhook"
        assert subscription.events == ["payment.succeeded"]
        assert subscription.description is None
        assert subscription.is_active is True


@pytest.mark.unit
class TestGetSubscription:
    """Test subscription retrieval."""

    @pytest.mark.asyncio
    async def test_get_subscription_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test successful subscription retrieval."""
        # Mock DB response
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        subscription = await webhook_service.get_subscription(subscription_id, tenant_id)

        assert subscription == sample_subscription
        mock_db_session.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_subscription_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test subscription not found."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        subscription = await webhook_service.get_subscription(subscription_id, tenant_id)

        assert subscription is None


@pytest.mark.unit
class TestListSubscriptions:
    """Test subscription listing."""

    @pytest.mark.asyncio
    async def test_list_subscriptions_all(
        self, webhook_service, mock_db_session, tenant_id, sample_subscription
    ):
        """Test listing all subscriptions."""
        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [sample_subscription]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        subscriptions = await webhook_service.list_subscriptions(tenant_id)

        assert len(subscriptions) == 1
        assert subscriptions[0] == sample_subscription

    @pytest.mark.asyncio
    async def test_list_subscriptions_active_only(
        self, webhook_service, mock_db_session, tenant_id, sample_subscription
    ):
        """Test listing active subscriptions only."""
        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [sample_subscription]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        subscriptions = await webhook_service.list_subscriptions(tenant_id, is_active=True)

        assert len(subscriptions) == 1

    @pytest.mark.asyncio
    async def test_list_subscriptions_with_pagination(
        self, webhook_service, mock_db_session, tenant_id
    ):
        """Test listing with pagination."""
        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        subscriptions = await webhook_service.list_subscriptions(tenant_id, limit=10, offset=20)

        assert len(subscriptions) == 0


@pytest.mark.unit
class TestUpdateSubscription:
    """Test subscription updates."""

    @pytest.mark.asyncio
    async def test_update_subscription_url(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test updating subscription URL."""
        # Mock get_subscription
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        # Mock refresh to return updated object
        async def mock_refresh(obj):
            pass

        mock_db_session.refresh.side_effect = mock_refresh

        update_data = WebhookSubscriptionUpdate(url="https://new-url.example.com/webhook")

        updated = await webhook_service.update_subscription(subscription_id, tenant_id, update_data)

        assert updated is not None
        assert updated.url == "https://new-url.example.com/webhook"
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_subscription_events(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test updating subscription events."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        update_data = WebhookSubscriptionUpdate(events=["payment.succeeded", "payment.failed"])

        updated = await webhook_service.update_subscription(subscription_id, tenant_id, update_data)

        assert updated is not None
        assert updated.events == ["payment.succeeded", "payment.failed"]

    @pytest.mark.asyncio
    async def test_update_subscription_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test updating non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        update_data = WebhookSubscriptionUpdate(description="Updated description")

        updated = await webhook_service.update_subscription(subscription_id, tenant_id, update_data)

        assert updated is None
        mock_db_session.commit.assert_not_called()


@pytest.mark.unit
class TestDeleteSubscription:
    """Test subscription deletion."""

    @pytest.mark.asyncio
    async def test_delete_subscription_success(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test successful subscription deletion."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        result = await webhook_service.delete_subscription(subscription_id, tenant_id)

        assert result is True
        mock_db_session.delete.assert_called_once_with(sample_subscription)
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_subscription_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test deleting non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await webhook_service.delete_subscription(subscription_id, tenant_id)

        assert result is False
        mock_db_session.delete.assert_not_called()


@pytest.mark.unit
class TestGetSubscriptionsForEvent:
    """Test getting subscriptions for specific event."""

    @pytest.mark.asyncio
    async def test_get_subscriptions_for_event(self, webhook_service, mock_db_session, tenant_id):
        """Test getting subscriptions for specific event."""
        sub1 = WebhookSubscription(
            id=uuid4(),
            tenant_id=tenant_id,
            url="https://example.com/webhook1",
            events=["user.registered", "user.updated"],
            secret="secret1",
            is_active=True,
        )
        sub2 = WebhookSubscription(
            id=uuid4(),
            tenant_id=tenant_id,
            url="https://example.com/webhook2",
            events=["payment.succeeded"],
            secret="secret2",
            is_active=True,
        )

        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [sub1, sub2]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        subscriptions = await webhook_service.get_subscriptions_for_event(
            "user.registered", tenant_id
        )

        assert len(subscriptions) == 1
        assert subscriptions[0] == sub1

    @pytest.mark.asyncio
    async def test_get_subscriptions_for_event_none_matching(
        self, webhook_service, mock_db_session, tenant_id
    ):
        """Test when no subscriptions match event."""
        sub1 = WebhookSubscription(
            id=uuid4(),
            tenant_id=tenant_id,
            url="https://example.com/webhook",
            events=["payment.succeeded"],
            secret="secret",
            is_active=True,
        )

        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [sub1]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        subscriptions = await webhook_service.get_subscriptions_for_event(
            "user.registered", tenant_id
        )

        assert len(subscriptions) == 0


@pytest.mark.unit
class TestUpdateStatistics:
    """Test subscription statistics updates."""

    @pytest.mark.asyncio
    async def test_update_statistics_success_with_tenant(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test updating statistics on success with tenant_id."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        initial_success = sample_subscription.success_count

        await webhook_service.update_statistics(subscription_id, success=True, tenant_id=tenant_id)

        assert sample_subscription.success_count == initial_success + 1
        assert sample_subscription.last_success_at is not None
        assert sample_subscription.last_triggered_at is not None
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_statistics_failure_with_tenant(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test updating statistics on failure with tenant_id."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        initial_failure = sample_subscription.failure_count

        await webhook_service.update_statistics(subscription_id, success=False, tenant_id=tenant_id)

        assert sample_subscription.failure_count == initial_failure + 1
        assert sample_subscription.last_failure_at is not None
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_statistics_without_tenant(
        self, webhook_service, mock_db_session, sample_subscription
    ):
        """Test updating statistics without tenant_id (internal call)."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        subscription_uuid = sample_subscription.id

        await webhook_service.update_statistics(subscription_uuid, success=True, tenant_id=None)

        assert sample_subscription.success_count == 11  # Was 10 initially
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_statistics_subscription_not_found(
        self, webhook_service, mock_db_session, subscription_id, tenant_id
    ):
        """Test updating statistics for non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Should not raise, just return silently
        await webhook_service.update_statistics(subscription_id, success=True, tenant_id=tenant_id)

        mock_db_session.commit.assert_not_called()


@pytest.mark.unit
class TestDisableSubscription:
    """Test subscription disabling."""

    @pytest.mark.asyncio
    async def test_disable_subscription_success(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test successfully disabling subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        await webhook_service.disable_subscription(subscription_id, tenant_id, "Too many failures")

        assert sample_subscription.is_active is False
        assert "disabled_reason" in sample_subscription.custom_metadata
        assert sample_subscription.custom_metadata["disabled_reason"] == "Too many failures"
        assert "disabled_at" in sample_subscription.custom_metadata
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_disable_subscription_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test disabling non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Should not raise, just return silently
        await webhook_service.disable_subscription(subscription_id, tenant_id, "Some reason")

        mock_db_session.commit.assert_not_called()


@pytest.mark.unit
class TestSecretManagement:
    """Test webhook secret management."""

    @pytest.mark.asyncio
    async def test_get_subscription_secret_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test getting subscription secret."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        secret = await webhook_service.get_subscription_secret(subscription_id, tenant_id)

        assert secret == sample_subscription.secret

    @pytest.mark.asyncio
    async def test_get_subscription_secret_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test getting secret for non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        secret = await webhook_service.get_subscription_secret(subscription_id, tenant_id)

        assert secret is None

    @pytest.mark.asyncio
    async def test_rotate_secret_success(
        self, webhook_service, mock_db_session, tenant_id, subscription_id, sample_subscription
    ):
        """Test successfully rotating webhook secret."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = sample_subscription
        mock_db_session.execute.return_value = mock_result

        old_secret = sample_subscription.secret
        new_secret = await webhook_service.rotate_secret(subscription_id, tenant_id)

        assert new_secret is not None
        assert new_secret != old_secret
        assert sample_subscription.secret == new_secret
        assert "secret_rotated_at" in sample_subscription.custom_metadata
        assert "previous_secret_hash" in sample_subscription.custom_metadata
        mock_db_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_rotate_secret_not_found(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test rotating secret for non-existent subscription."""
        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        new_secret = await webhook_service.rotate_secret(subscription_id, tenant_id)

        assert new_secret is None
        mock_db_session.commit.assert_not_called()


@pytest.mark.unit
class TestDeliveryLogs:
    """Test webhook delivery log methods."""

    @pytest.mark.asyncio
    async def test_get_deliveries_all(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test getting all deliveries for subscription."""
        delivery1 = WebhookDelivery(
            id=uuid4(),
            subscription_id=UUID(subscription_id),
            tenant_id=tenant_id,
            event_type="user.registered",
            status=DeliveryStatus.SUCCESS,
            created_at=datetime.now(UTC),
        )
        delivery2 = WebhookDelivery(
            id=uuid4(),
            subscription_id=UUID(subscription_id),
            tenant_id=tenant_id,
            event_type="user.updated",
            status=DeliveryStatus.FAILED,
            created_at=datetime.now(UTC),
        )

        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [delivery1, delivery2]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        deliveries = await webhook_service.get_deliveries(subscription_id, tenant_id)

        assert len(deliveries) == 2

    @pytest.mark.asyncio
    async def test_get_deliveries_filtered_by_status(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test getting deliveries filtered by status."""
        delivery = WebhookDelivery(
            id=uuid4(),
            subscription_id=UUID(subscription_id),
            tenant_id=tenant_id,
            event_type="user.registered",
            status=DeliveryStatus.SUCCESS,
            created_at=datetime.now(UTC),
        )

        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [delivery]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        deliveries = await webhook_service.get_deliveries(
            subscription_id, tenant_id, status=DeliveryStatus.SUCCESS
        )

        assert len(deliveries) == 1
        assert deliveries[0].status == DeliveryStatus.SUCCESS

    @pytest.mark.asyncio
    async def test_get_deliveries_with_pagination(
        self, webhook_service, mock_db_session, tenant_id, subscription_id
    ):
        """Test getting deliveries with pagination."""
        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = []
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        deliveries = await webhook_service.get_deliveries(
            subscription_id, tenant_id, limit=10, offset=20
        )

        assert len(deliveries) == 0

    @pytest.mark.asyncio
    async def test_get_recent_deliveries(self, webhook_service, mock_db_session, tenant_id):
        """Test getting recent deliveries across all subscriptions."""
        delivery = WebhookDelivery(
            id=uuid4(),
            subscription_id=uuid4(),
            tenant_id=tenant_id,
            event_type="payment.succeeded",
            status=DeliveryStatus.SUCCESS,
            created_at=datetime.now(UTC),
        )

        mock_result = Mock()
        mock_scalars = Mock()
        mock_scalars.all.return_value = [delivery]
        mock_result.scalars.return_value = mock_scalars
        mock_db_session.execute.return_value = mock_result

        deliveries = await webhook_service.get_recent_deliveries(tenant_id, limit=50)

        assert len(deliveries) == 1

    @pytest.mark.asyncio
    async def test_get_delivery_found(self, webhook_service, mock_db_session, tenant_id):
        """Test getting specific delivery."""
        delivery_id = str(uuid4())
        delivery = WebhookDelivery(
            id=UUID(delivery_id),
            subscription_id=uuid4(),
            tenant_id=tenant_id,
            event_type="user.deleted",
            status=DeliveryStatus.SUCCESS,
            created_at=datetime.now(UTC),
        )

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = delivery
        mock_db_session.execute.return_value = mock_result

        result = await webhook_service.get_delivery(delivery_id, tenant_id)

        assert result == delivery

    @pytest.mark.asyncio
    async def test_get_delivery_not_found(self, webhook_service, mock_db_session, tenant_id):
        """Test getting non-existent delivery."""
        delivery_id = str(uuid4())

        mock_result = Mock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        result = await webhook_service.get_delivery(delivery_id, tenant_id)

        assert result is None
