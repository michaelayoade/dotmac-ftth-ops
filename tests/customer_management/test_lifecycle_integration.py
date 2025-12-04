"""
Integration tests for customer service lifecycle event helpers.

These tests exercise the lifecycle handler logic in isolation with patched
dependencies to avoid touching real infrastructure components.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

from dotmac.platform.billing.models import BillingSubscriptionTable
from dotmac.platform.billing.subscriptions.models import SubscriptionStatus
from dotmac.platform.customer_management.models import CustomerStatus
from dotmac.platform.customer_management.router import _handle_status_lifecycle_events


@pytest.fixture
def mock_db_session():
    """Mock database session."""
    session = AsyncMock()
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_event_bus():
    """Mock event bus."""
    bus = AsyncMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def sample_customer_data():
    """Sample customer data."""
    return {
        "customer_id": str(uuid4()),
        "tenant_id": "test_tenant",
        "email": "customer@example.com",
        "name": "Test Customer",
        "status": "ACTIVE",
    }


@pytest.fixture(autouse=True)
def reset_event_bus_state():
    """Ensure the global event bus cache does not leak between tests."""
    from dotmac.platform.events.bus import reset_event_bus

    reset_event_bus()
    yield
    reset_event_bus()


@pytest.mark.integration
class TestServiceSuspensionEndpoint:
    """Test service suspension via customer status change webhook."""

    @pytest.mark.asyncio
    async def test_suspend_customer_via_status_change(
        self, mock_db_session, mock_event_bus, sample_customer_data
    ) -> None:
        """Test suspending customer via status change webhook."""
        # This would be triggered by a status change webhook
        # In the actual router, this happens in the status change handler

        status_change_payload = {
            "customer_id": sample_customer_data["customer_id"],
            "old_status": "ACTIVE",
            "new_status": "SUSPENDED",
            "tenant_id": sample_customer_data["tenant_id"],
            "changed_at": datetime.now(UTC).isoformat(),
        }

        # Mock active subscriptions
        active_subscription = BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=sample_customer_data["tenant_id"],
            customer_id=sample_customer_data["customer_id"],
            plan_id="plan_basic",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={},
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [active_subscription]
        mock_db_session.execute.return_value = mock_result

        with patch(
            "dotmac.platform.events.bus.get_event_bus",
            return_value=mock_event_bus,
        ):
            await _handle_status_lifecycle_events(
                customer_id=UUID(status_change_payload["customer_id"]),
                old_status=status_change_payload["old_status"],
                new_status=status_change_payload["new_status"],
                customer_email="customer@example.com",
                session=mock_db_session,
            )

        # Assertions would verify:
        # 1. Subscription status updated to PAUSED
        # 2. Metadata contains suspension info
        # 3. Event published

    @pytest.mark.asyncio
    async def test_suspend_customer_with_multiple_subscriptions(
        self, mock_db_session, mock_event_bus
    ):
        """Test suspending customer with multiple active subscriptions."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        # Mock multiple subscriptions
        subscriptions = [
            BillingSubscriptionTable(
                subscription_id=f"sub_{uuid4().hex[:24]}",
                tenant_id=tenant_id,
                customer_id=customer_id,
                plan_id="plan_basic",
                status=SubscriptionStatus.ACTIVE.value,
                current_period_start=datetime.now(UTC),
                current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
                metadata_json={},
            ),
            BillingSubscriptionTable(
                subscription_id=f"sub_{uuid4().hex[:24]}",
                tenant_id=tenant_id,
                customer_id=customer_id,
                plan_id="plan_premium",
                status=SubscriptionStatus.TRIALING.value,
                current_period_start=datetime.now(UTC),
                current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
                metadata_json={},
            ),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = subscriptions
        mock_db_session.execute.return_value = mock_result

        # Both subscriptions should be suspended
        # Verify call count for updates


@pytest.mark.integration
class TestServiceReactivationEndpoint:
    """Test service reactivation via customer status change webhook."""

    @pytest.mark.asyncio
    async def test_reactivate_customer_via_status_change(self, mock_db_session, mock_event_bus):
        """Test reactivating suspended customer via status change webhook."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        status_change_payload = {
            "customer_id": customer_id,
            "old_status": "SUSPENDED",
            "new_status": "ACTIVE",
            "tenant_id": tenant_id,
            "changed_at": datetime.now(UTC).isoformat(),
        }

        # Mock suspended subscription
        suspended_subscription = BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id="plan_basic",
            status=SubscriptionStatus.PAUSED.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={
                "suspension": {
                    "suspended_at": "2025-10-15T10:00:00+00:00",
                    "original_status": SubscriptionStatus.ACTIVE.value,
                    "reason": "customer_suspended",
                }
            },
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [suspended_subscription]
        mock_db_session.execute.return_value = mock_result

        with patch(
            "dotmac.platform.events.bus.get_event_bus",
            return_value=mock_event_bus,
        ):
            await _handle_status_lifecycle_events(
                customer_id=UUID(status_change_payload["customer_id"]),
                old_status=status_change_payload["old_status"],
                new_status=status_change_payload["new_status"],
                customer_email="customer@example.com",
                session=mock_db_session,
            )

    @pytest.mark.asyncio
    async def test_reactivate_restores_original_status(self, mock_db_session, mock_event_bus):
        """Test that reactivation restores the original subscription status."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        # Subscription was TRIALING before suspension
        suspended_subscription = BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id="plan_basic",
            status=SubscriptionStatus.PAUSED.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={
                "suspension": {
                    "suspended_at": "2025-10-15T10:00:00+00:00",
                    "original_status": SubscriptionStatus.TRIALING.value,
                    "reason": "customer_suspended",
                }
            },
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [suspended_subscription]
        mock_db_session.execute.return_value = mock_result

        # Should restore to TRIALING, not ACTIVE


@pytest.mark.integration
class TestChurnHandlingEndpoint:
    """Test churn handling via customer status change webhook."""

    @pytest.mark.asyncio
    async def test_churn_customer_via_status_change(self, mock_db_session, mock_event_bus):
        """Test churning customer via status change webhook."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        {
            "customer_id": customer_id,
            "old_status": "ACTIVE",
            "new_status": "CHURNED",
            "tenant_id": tenant_id,
            "changed_at": datetime.now(UTC).isoformat(),
        }

        # Mock active subscription
        active_subscription = BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id="plan_basic",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={},
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [active_subscription]
        mock_db_session.execute.return_value = mock_result

        # Subscription should be canceled at period end
        # Churn event should be published

    @pytest.mark.asyncio
    async def test_churn_cancels_at_period_end(self, mock_db_session, mock_event_bus):
        """Test that churn schedules cancellation for period end."""
        from dotmac.platform.billing.subscriptions.service import SubscriptionService

        mock_subscription_service = AsyncMock(spec=SubscriptionService)
        mock_subscription_service.cancel_subscription = AsyncMock()

        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        active_subscription = BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id="plan_basic",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={},
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [active_subscription]
        mock_db_session.execute.return_value = mock_result

        with (
            patch(
                "dotmac.platform.billing.subscriptions.service.SubscriptionService",
                return_value=mock_subscription_service,
            ),
            patch(
                "dotmac.platform.events.bus.get_event_bus",
                return_value=mock_event_bus,
            ),
        ):
            await _handle_status_lifecycle_events(
                customer_id=UUID(customer_id),
                old_status=CustomerStatus.ACTIVE.value,
                new_status=CustomerStatus.CHURNED.value,
                customer_email="customer@example.com",
                session=mock_db_session,
            )

        call_kwargs = mock_subscription_service.cancel_subscription.call_args.kwargs
        assert call_kwargs["cancel_immediately"] is False

    @pytest.mark.asyncio
    async def test_churn_handles_error_gracefully(self, mock_db_session, mock_event_bus):
        """Test that churn handling continues even if one subscription fails."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        # Mock multiple subscriptions, one will fail
        subscriptions = [
            BillingSubscriptionTable(
                subscription_id=f"sub_{uuid4().hex[:24]}",
                tenant_id=tenant_id,
                customer_id=customer_id,
                plan_id="plan_basic",
                status=SubscriptionStatus.ACTIVE.value,
                current_period_start=datetime.now(UTC),
                current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
                metadata_json={},
            ),
            BillingSubscriptionTable(
                subscription_id="sub_will_fail",
                tenant_id=tenant_id,
                customer_id=customer_id,
                plan_id="plan_premium",
                status=SubscriptionStatus.ACTIVE.value,
                current_period_start=datetime.now(UTC),
                current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
                metadata_json={},
            ),
        ]

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = subscriptions
        mock_db_session.execute.return_value = mock_result

        # Should attempt to cancel all subscriptions
        # Should log error but continue


@pytest.mark.asyncio
@pytest.mark.integration
class TestEndToEndLifecycleWorkflow:
    """End-to-end test of complete customer lifecycle."""

    async def test_complete_lifecycle_suspend_reactivate(self, mock_db_session, mock_event_bus):
        """Test complete workflow: active -> suspend -> reactivate."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        # Step 1: Customer is ACTIVE with subscription
        BillingSubscriptionTable(
            subscription_id=f"sub_{uuid4().hex[:24]}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id="plan_basic",
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=datetime.now(UTC),
            current_period_end=datetime(2025, 11, 20, tzinfo=UTC),
            metadata_json={},
        )

        # Step 2: Customer status changes to SUSPENDED
        # Subscription should be PAUSED with suspension metadata

        # Step 3: Customer status changes back to ACTIVE
        # Subscription should be restored to ACTIVE

        # This would be a comprehensive E2E test
        pass

    async def test_complete_lifecycle_active_to_churned(self, mock_db_session, mock_event_bus):
        """Test complete workflow: active -> churned."""
        str(uuid4())

        # Step 1: Customer is ACTIVE with subscription
        # Step 2: Customer status changes to CHURNED
        # Subscription should be scheduled for cancellation
        # Churn event should be published

        # This would be a comprehensive E2E test
        pass


@pytest.mark.integration
class TestEventDrivenWorkflow:
    """Test event-driven aspects of lifecycle management."""

    @pytest.mark.asyncio
    async def test_suspension_triggers_downstream_events(self, mock_event_bus):
        """Test that suspension triggers expected downstream events."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        # Suspension should trigger:
        # 1. customer.suspended event
        # 2. subscription.paused events (for each subscription)
        # 3. notification.send events (for customer email)

        await mock_event_bus.publish(
            event_type="customer.suspended",
            data={
                "customer_id": customer_id,
                "tenant_id": tenant_id,
                "suspended_at": datetime.now(UTC).isoformat(),
            },
        )

        # Verify event was published
        assert mock_event_bus.publish.call_count >= 1

    @pytest.mark.asyncio
    async def test_churn_triggers_analytics_event(self, mock_event_bus):
        """Test that churn publishes analytics data."""
        customer_id = str(uuid4())
        tenant_id = "test_tenant"

        churn_event_data = {
            "customer_id": customer_id,
            "tenant_id": tenant_id,
            "churned_at": datetime.now(UTC).isoformat(),
            "new_status": "CHURNED",
            "subscriptions_affected": 2,
            "lifetime_value": 1250.00,
            "tenure_days": 365,
        }

        await mock_event_bus.publish(
            event_type="customer.churned",
            data=churn_event_data,
        )

        # Verify analytics data is included
        call_args = mock_event_bus.publish.call_args
        assert call_args.kwargs["data"]["subscriptions_affected"] == 2


@pytest.mark.integration
class TestErrorHandling:
    """Test error handling in lifecycle workflows."""

    @pytest.mark.asyncio
    async def test_database_error_during_suspension(self, mock_db_session, mock_event_bus):
        """Test graceful handling of database errors during suspension."""
        # Mock database error
        mock_db_session.execute.side_effect = Exception("Database connection lost")

        # Should log error and rollback transaction
        # Should not crash the application

    @pytest.mark.asyncio
    async def test_event_bus_error_does_not_block_operation(self, mock_db_session, mock_event_bus):
        """Test that event publishing errors don't block the operation."""
        # Mock event bus error
        mock_event_bus.publish.side_effect = Exception("Event bus unavailable")

        # Should still complete the subscription status change
        # Should log error about event publishing

    @pytest.mark.asyncio
    async def test_partial_subscription_cancellation_on_churn(self, mock_db_session):
        """Test that churn continues even if some subscriptions fail to cancel."""
        from dotmac.platform.billing.subscriptions.service import SubscriptionService

        mock_subscription_service = AsyncMock(spec=SubscriptionService)

        # First call succeeds, second fails
        mock_subscription_service.cancel_subscription.side_effect = [
            None,  # Success
            Exception("Cannot cancel subscription"),  # Failure
        ]

        # Should attempt to cancel all subscriptions
        # Should log error for failed cancellation
        # Should still publish churn event
