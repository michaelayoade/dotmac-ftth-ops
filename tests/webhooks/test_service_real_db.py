"""
Real database tests for webhook subscription service to achieve 90%+ coverage.
"""

from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.webhooks.models import (
    DeliveryStatus,
    WebhookDelivery,
    WebhookSubscription,
    WebhookSubscriptionCreate,
    WebhookSubscriptionUpdate,
)
from dotmac.platform.webhooks.service import WebhookSubscriptionService


@pytest_asyncio.fixture
async def webhook_service(async_db_session: AsyncSession):
    """Create webhook service with real database."""
    return WebhookSubscriptionService(async_db_session)


@pytest_asyncio.fixture
async def is_sqlite(async_db_session: AsyncSession) -> bool:
    """Check if using SQLite database."""
    engine_url = str(async_db_session.get_bind().url)
    return "sqlite" in engine_url


@pytest_asyncio.fixture
async def sample_subscription(
    webhook_service: WebhookSubscriptionService, async_db_session: AsyncSession
):
    """Create a sample subscription for testing."""
    sub_data = WebhookSubscriptionCreate(
        url="https://example.com/webhook",
        description="Test subscription",
        events=["user.registered", "user.updated"],
        retry_enabled=True,
        max_retries=3,
    )
    subscription = await webhook_service.create_subscription("test-tenant", sub_data)
    await async_db_session.commit()
    return subscription


@pytest.mark.integration
class TestCreateSubscription:
    """Test subscription creation."""

    @pytest.mark.asyncio
    async def test_create_subscription_success(
        self, webhook_service: WebhookSubscriptionService, async_db_session: AsyncSession
    ):
        """Test creating a webhook subscription."""
        sub_data = WebhookSubscriptionCreate(
            url="https://api.example.com/webhooks",
            description="Production webhook",
            events=["invoice.created", "payment.succeeded"],
            headers={"X-Custom-Header": "value"},
            retry_enabled=True,
            max_retries=5,
            timeout_seconds=30,
            custom_metadata={"env": "production"},
        )

        subscription = await webhook_service.create_subscription("prod-tenant", sub_data)

        assert subscription.id is not None
        assert subscription.tenant_id == "prod-tenant"
        assert subscription.url == "https://api.example.com/webhooks"
        assert subscription.events == ["invoice.created", "payment.succeeded"]
        assert subscription.secret is not None
        assert len(subscription.secret) > 20
        assert subscription.is_active is True
        assert subscription.success_count == 0
        assert subscription.failure_count == 0

    @pytest.mark.asyncio
    async def test_create_subscription_generates_secret(
        self, webhook_service: WebhookSubscriptionService
    ):
        """Test that subscription creation generates a unique secret."""
        sub_data = WebhookSubscriptionCreate(url="https://test.com/webhook", events=["user.login"])

        sub1 = await webhook_service.create_subscription("tenant1", sub_data)
        sub2 = await webhook_service.create_subscription("tenant2", sub_data)

        assert sub1.secret != sub2.secret

    @pytest.mark.asyncio
    async def test_create_subscription_accepts_arbitrary_events(
        self, webhook_service: WebhookSubscriptionService
    ):
        """Ensure arbitrary event names are persisted for UI compatibility."""
        sub_data = WebhookSubscriptionCreate(
            url="https://hooks.example.com/anything",
            events=["custom.event", "tenant.something-happened"],
        )

        sub = await webhook_service.create_subscription("tenant-compat", sub_data)

        assert sub.events == ["custom.event", "tenant.something-happened"]


@pytest.mark.integration
class TestGetSubscription:
    """Test getting subscriptions."""

    @pytest.mark.asyncio
    async def test_get_subscription_success(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test getting an existing subscription."""
        result = await webhook_service.get_subscription(str(sample_subscription.id), "test-tenant")

        assert result is not None
        assert result.id == sample_subscription.id
        assert result.url == sample_subscription.url

    @pytest.mark.asyncio
    async def test_get_subscription_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test getting non-existent subscription."""
        result = await webhook_service.get_subscription(str(uuid4()), "test-tenant")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_subscription_wrong_tenant(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test getting subscription with wrong tenant_id."""
        result = await webhook_service.get_subscription(str(sample_subscription.id), "wrong-tenant")
        assert result is None


@pytest.mark.integration
class TestListSubscriptions:
    """Test listing subscriptions."""

    @pytest.mark.asyncio
    async def test_list_subscriptions_basic(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test basic subscription listing."""
        result = await webhook_service.list_subscriptions("test-tenant")

        assert len(result) >= 1
        assert any(sub.id == sample_subscription.id for sub in result)

    @pytest.mark.asyncio
    async def test_list_subscriptions_filter_active(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test filtering by is_active."""
        # Create inactive subscription
        inactive_sub = WebhookSubscription(
            tenant_id="test-tenant",
            url="https://inactive.com/webhook",
            events=["user.login"],
            secret="secret123",
            is_active=False,
        )
        async_db_session.add(inactive_sub)
        await async_db_session.commit()

        # Get only active
        active_result = await webhook_service.list_subscriptions("test-tenant", is_active=True)
        assert all(sub.is_active for sub in active_result)

        # Get only inactive
        inactive_result = await webhook_service.list_subscriptions("test-tenant", is_active=False)
        assert all(not sub.is_active for sub in inactive_result)

    @pytest.mark.asyncio
    async def test_list_subscriptions_filter_event_type(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test filtering by event_type."""
        result = await webhook_service.list_subscriptions(
            "test-tenant", event_type="user.registered"
        )

        assert len(result) >= 1
        assert all("user.registered" in sub.events for sub in result)

    @pytest.mark.asyncio
    async def test_list_subscriptions_pagination(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test pagination."""
        # Create multiple subscriptions
        for i in range(5):
            sub = WebhookSubscription(
                tenant_id="test-tenant",
                url=f"https://test{i}.com/webhook",
                events=["user.login"],
                secret=f"secret{i}",
            )
            async_db_session.add(sub)
        await async_db_session.commit()

        # Get first page
        page1 = await webhook_service.list_subscriptions("test-tenant", limit=3, offset=0)
        assert len(page1) == 3

        # Get second page
        page2 = await webhook_service.list_subscriptions("test-tenant", limit=3, offset=3)
        assert len(page2) >= 1

        # Ensure no overlap
        page1_ids = {sub.id for sub in page1}
        page2_ids = {sub.id for sub in page2}
        assert page1_ids.isdisjoint(page2_ids)


@pytest.mark.integration
class TestUpdateSubscription:
    """Test updating subscriptions."""

    @pytest.mark.asyncio
    async def test_update_subscription_url(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test updating subscription URL."""
        update_data = WebhookSubscriptionUpdate(url="https://new-url.com/webhook")

        result = await webhook_service.update_subscription(
            str(sample_subscription.id), "test-tenant", update_data
        )

        assert result is not None
        assert result.url == "https://new-url.com/webhook"

    @pytest.mark.asyncio
    async def test_update_subscription_events(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test updating subscription events."""
        update_data = WebhookSubscriptionUpdate(events=["invoice.created", "payment.succeeded"])

        result = await webhook_service.update_subscription(
            str(sample_subscription.id), "test-tenant", update_data
        )

        assert result is not None
        assert result.events == ["invoice.created", "payment.succeeded"]

    @pytest.mark.asyncio
    async def test_update_subscription_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test updating non-existent subscription."""
        update_data = WebhookSubscriptionUpdate(events=["user.login"])

        result = await webhook_service.update_subscription(str(uuid4()), "test-tenant", update_data)
        assert result is None

    @pytest.mark.asyncio
    async def test_update_subscription_partial(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test partial update (only some fields)."""
        original_url = sample_subscription.url

        update_data = WebhookSubscriptionUpdate(description="Updated description")

        result = await webhook_service.update_subscription(
            str(sample_subscription.id), "test-tenant", update_data
        )

        assert result is not None
        assert result.description == "Updated description"
        assert result.url == original_url  # URL unchanged


@pytest.mark.integration
class TestDeleteSubscription:
    """Test deleting subscriptions."""

    @pytest.mark.asyncio
    async def test_delete_subscription_success(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test deleting a subscription."""
        result = await webhook_service.delete_subscription(
            str(sample_subscription.id), "test-tenant"
        )

        assert result is True

        # Verify deleted
        get_result = await webhook_service.get_subscription(
            str(sample_subscription.id), "test-tenant"
        )
        assert get_result is None

    @pytest.mark.asyncio
    async def test_delete_subscription_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test deleting non-existent subscription."""
        result = await webhook_service.delete_subscription(str(uuid4()), "test-tenant")
        assert result is False


@pytest.mark.integration
class TestGetSubscriptionsForEvent:
    """Test getting subscriptions for specific events."""

    @pytest.mark.asyncio
    async def test_get_subscriptions_for_event(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test getting subscriptions for a specific event."""
        # Create another subscription with different events
        other_sub = WebhookSubscription(
            tenant_id="test-tenant",
            url="https://other.com/webhook",
            events=["payment.succeeded"],
            secret="secret123",
            is_active=True,
        )
        async_db_session.add(other_sub)
        await async_db_session.commit()

        result = await webhook_service.get_subscriptions_for_event("user.registered", "test-tenant")

        assert len(result) >= 1
        assert all(sub.is_active for sub in result)
        assert all("user.registered" in sub.events for sub in result)

    @pytest.mark.asyncio
    async def test_get_subscriptions_for_event_inactive_excluded(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test that inactive subscriptions are excluded."""
        # Deactivate the subscription
        sample_subscription.is_active = False
        await async_db_session.commit()

        result = await webhook_service.get_subscriptions_for_event("user.created", "test-tenant")

        assert sample_subscription.id not in [sub.id for sub in result]


@pytest.mark.integration
class TestUpdateStatistics:
    """Test updating subscription statistics."""

    @pytest.mark.asyncio
    async def test_update_statistics_success(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test updating statistics on success."""
        await webhook_service.update_statistics(
            str(sample_subscription.id), success=True, tenant_id="test-tenant"
        )

        # Refresh to get updated values
        await async_db_session.refresh(sample_subscription)

        assert sample_subscription.success_count == 1
        assert sample_subscription.failure_count == 0
        assert sample_subscription.last_success_at is not None
        assert sample_subscription.last_triggered_at is not None

    @pytest.mark.asyncio
    async def test_update_statistics_failure(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test updating statistics on failure."""
        await webhook_service.update_statistics(
            str(sample_subscription.id), success=False, tenant_id="test-tenant"
        )

        await async_db_session.refresh(sample_subscription)

        assert sample_subscription.failure_count == 1
        assert sample_subscription.success_count == 0
        assert sample_subscription.last_failure_at is not None

    @pytest.mark.asyncio
    async def test_update_statistics_without_tenant(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test updating statistics without tenant_id (internal call)."""
        await webhook_service.update_statistics(
            sample_subscription.id, success=True, tenant_id=None
        )

        await async_db_session.refresh(sample_subscription)

        assert sample_subscription.success_count == 1

    @pytest.mark.asyncio
    async def test_update_statistics_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test updating statistics for non-existent subscription."""
        # Should not raise error
        await webhook_service.update_statistics(str(uuid4()), success=True, tenant_id="test-tenant")


@pytest.mark.integration
class TestDisableSubscription:
    """Test disabling subscriptions."""

    @pytest.mark.asyncio
    async def test_disable_subscription_success(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test disabling a subscription."""
        await webhook_service.disable_subscription(
            str(sample_subscription.id), "test-tenant", "Too many failures"
        )

        await async_db_session.refresh(sample_subscription)

        assert sample_subscription.is_active is False
        assert sample_subscription.custom_metadata["disabled_reason"] == "Too many failures"
        assert "disabled_at" in sample_subscription.custom_metadata

    @pytest.mark.asyncio
    async def test_disable_subscription_not_found(
        self, webhook_service: WebhookSubscriptionService
    ):
        """Test disabling non-existent subscription."""
        # Should not raise error
        await webhook_service.disable_subscription(str(uuid4()), "test-tenant", "reason")


class TestSecretManagement:
    """Test secret management."""

    @pytest.mark.asyncio
    async def test_get_subscription_secret(
        self, webhook_service: WebhookSubscriptionService, sample_subscription
    ):
        """Test getting subscription secret."""
        secret = await webhook_service.get_subscription_secret(
            str(sample_subscription.id), "test-tenant"
        )

        assert secret == sample_subscription.secret

    @pytest.mark.asyncio
    async def test_get_subscription_secret_not_found(
        self, webhook_service: WebhookSubscriptionService
    ):
        """Test getting secret for non-existent subscription."""
        secret = await webhook_service.get_subscription_secret(str(uuid4()), "test-tenant")
        assert secret is None

    @pytest.mark.asyncio
    async def test_rotate_secret_success(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test rotating subscription secret."""
        old_secret = sample_subscription.secret

        new_secret = await webhook_service.rotate_secret(str(sample_subscription.id), "test-tenant")

        await async_db_session.refresh(sample_subscription)

        assert new_secret is not None
        assert new_secret != old_secret
        assert sample_subscription.secret == new_secret
        assert "secret_rotated_at" in sample_subscription.custom_metadata
        assert "previous_secret_hash" in sample_subscription.custom_metadata

    @pytest.mark.asyncio
    async def test_rotate_secret_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test rotating secret for non-existent subscription."""
        result = await webhook_service.rotate_secret(str(uuid4()), "test-tenant")
        assert result is None


@pytest.mark.integration
class TestDeliveryLogs:
    """Test delivery log methods."""

    @pytest.mark.asyncio
    async def test_get_deliveries(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test getting delivery logs."""
        # Create delivery logs
        delivery1 = WebhookDelivery(
            subscription_id=sample_subscription.id,
            tenant_id="test-tenant",
            event_type="user.registered",
            event_id=str(uuid4()),
            event_data={"user_id": "123"},
            status=DeliveryStatus.SUCCESS,
            response_code=200,
        )
        delivery2 = WebhookDelivery(
            subscription_id=sample_subscription.id,
            tenant_id="test-tenant",
            event_type="user.updated",
            event_id=str(uuid4()),
            event_data={"user_id": "123"},
            status=DeliveryStatus.FAILED,
            response_code=500,
        )
        async_db_session.add_all([delivery1, delivery2])
        await async_db_session.commit()

        result = await webhook_service.get_deliveries(str(sample_subscription.id), "test-tenant")

        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_deliveries_filter_status(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test filtering deliveries by status."""
        delivery = WebhookDelivery(
            subscription_id=sample_subscription.id,
            tenant_id="test-tenant",
            event_type="user.login",
            event_id=str(uuid4()),
            event_data={},
            status=DeliveryStatus.SUCCESS,
            response_code=200,
        )
        async_db_session.add(delivery)
        await async_db_session.commit()

        result = await webhook_service.get_deliveries(
            str(sample_subscription.id), "test-tenant", status=DeliveryStatus.SUCCESS
        )

        assert all(d.status == DeliveryStatus.SUCCESS for d in result)

    @pytest.mark.asyncio
    async def test_get_deliveries_pagination(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test delivery pagination."""
        # Create multiple deliveries
        for i in range(10):
            delivery = WebhookDelivery(
                subscription_id=sample_subscription.id,
                tenant_id="test-tenant",
                event_type="user.login",
                event_id=str(uuid4()),
                event_data={"index": i},
                status=DeliveryStatus.SUCCESS,
                response_code=200,
            )
            async_db_session.add(delivery)
        await async_db_session.commit()

        page1 = await webhook_service.get_deliveries(
            str(sample_subscription.id), "test-tenant", limit=5, offset=0
        )
        page2 = await webhook_service.get_deliveries(
            str(sample_subscription.id), "test-tenant", limit=5, offset=5
        )

        assert len(page1) == 5
        assert len(page2) == 5

    @pytest.mark.asyncio
    async def test_get_recent_deliveries(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test getting recent deliveries across all subscriptions."""
        delivery = WebhookDelivery(
            subscription_id=sample_subscription.id,
            tenant_id="test-tenant",
            event_type="user.login",
            event_id=str(uuid4()),
            event_data={},
            status=DeliveryStatus.SUCCESS,
            response_code=200,
        )
        async_db_session.add(delivery)
        await async_db_session.commit()

        result = await webhook_service.get_recent_deliveries("test-tenant", limit=10)

        assert len(result) >= 1
        assert all(d.tenant_id == "test-tenant" for d in result)

    @pytest.mark.asyncio
    async def test_get_delivery(
        self,
        webhook_service: WebhookSubscriptionService,
        sample_subscription,
        async_db_session: AsyncSession,
    ):
        """Test getting a specific delivery."""
        delivery = WebhookDelivery(
            subscription_id=sample_subscription.id,
            tenant_id="test-tenant",
            event_type="user.login",
            event_id=str(uuid4()),
            event_data={"test": "data"},
            status=DeliveryStatus.SUCCESS,
            response_code=200,
        )
        async_db_session.add(delivery)
        await async_db_session.commit()

        result = await webhook_service.get_delivery(str(delivery.id), "test-tenant")

        assert result is not None
        assert result.id == delivery.id
        assert result.event_data == {"test": "data"}

    @pytest.mark.asyncio
    async def test_get_delivery_not_found(self, webhook_service: WebhookSubscriptionService):
        """Test getting non-existent delivery."""
        result = await webhook_service.get_delivery(str(uuid4()), "test-tenant")
        assert result is None
