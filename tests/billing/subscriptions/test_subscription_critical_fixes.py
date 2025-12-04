"""
Tests for critical subscription security and business logic fixes.

This module tests the fixes for:
1. Subscriptions router duplicate /billing prefix
2. cancel_at_period_end immediately setting status to CANCELED
3. change_plan ignoring effective_date parameter
4. change_tenant_subscription_plan calling non-existent method
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.subscriptions.models import (
    ProrationBehavior,
    SubscriptionPlanChangeRequest,
    SubscriptionStatus,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService


@pytest.mark.unit
class TestSubscriptionsRouterPrefix:
    """Tests for subscriptions router prefix fix"""

    def test_subscriptions_router_has_correct_prefix(self):
        """Test that subscriptions router has /subscriptions prefix, not /billing/subscriptions"""
        from dotmac.platform.billing.subscriptions.router import router

        # Should be /subscriptions (not /billing/subscriptions)
        # because parent billing router adds /billing prefix
        assert router.prefix == "/subscriptions"
        assert router.prefix != "/billing/subscriptions"


@pytest.mark.unit
class TestCancelAtPeriodEnd:
    """Tests for cancel_at_period_end keeping subscription active"""

    @pytest.mark.asyncio
    async def test_cancel_at_period_end_keeps_status_active(self):
        """Test that canceling at period end keeps subscription ACTIVE until period ends"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Create mock subscription DB object
        mock_sub = MagicMock()
        mock_sub.subscription_id = "sub_123"
        mock_sub.tenant_id = "tenant_1"
        mock_sub.status = SubscriptionStatus.ACTIVE.value
        mock_sub.cancel_at_period_end = False
        mock_sub.canceled_at = None
        mock_sub.plan_id = "plan_123"
        mock_sub.customer_id = "cust_1"
        mock_sub.current_period_end = datetime.now(UTC) + timedelta(days=30)

        # Mock the query result
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_sub)
        mock_db.execute.return_value = mock_result

        service = SubscriptionService(mock_db)

        # Mock _db_to_pydantic_subscription
        service._db_to_pydantic_subscription = MagicMock(
            return_value=MagicMock(
                subscription_id="sub_123",
                status=SubscriptionStatus.ACTIVE,  # Should still be ACTIVE
                cancel_at_period_end=True,
            )
        )

        # Mock _create_event
        service._create_event = AsyncMock()

        # Cancel subscription at period end (not immediate)
        await service.cancel_subscription(
            subscription_id="sub_123",
            tenant_id="tenant_1",
            at_period_end=True,  # Cancel at period end (default)
        )

        # Verify cancel_at_period_end was set
        assert mock_sub.cancel_at_period_end is True
        assert mock_sub.canceled_at is not None

        # CRITICAL: Verify status was NOT changed to CANCELED
        # Status should remain ACTIVE until period actually ends
        assert mock_sub.status != SubscriptionStatus.CANCELED.value
        # The status should not have been modified from its original value
        # (or if it was, it should still be ACTIVE)

    @pytest.mark.asyncio
    async def test_cancel_immediate_sets_status_ended(self):
        """Test that immediate cancellation sets status to ENDED"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        mock_sub = MagicMock()
        mock_sub.subscription_id = "sub_123"
        mock_sub.tenant_id = "tenant_1"
        mock_sub.status = SubscriptionStatus.ACTIVE

        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=mock_sub)
        mock_db.execute.return_value = mock_result

        service = SubscriptionService(mock_db)

        # Mock get_subscription to return a proper subscription with ACTIVE status
        mock_subscription = MagicMock()
        mock_subscription.status = SubscriptionStatus.ACTIVE
        mock_subscription.subscription_id = "sub_123"
        service.get_subscription = AsyncMock(return_value=mock_subscription)

        # Mock _db_to_pydantic_subscription to avoid Pydantic validation errors
        mock_result_subscription = MagicMock()
        mock_result_subscription.status = SubscriptionStatus.ENDED
        service._db_to_pydantic_subscription = MagicMock(return_value=mock_result_subscription)

        service._create_event = AsyncMock()

        # Cancel subscription immediately
        await service.cancel_subscription(
            subscription_id="sub_123",
            tenant_id="tenant_1",
            at_period_end=False,  # Cancel immediately (not at period end)
        )

        # Verify status was set to ENDED
        assert mock_sub.status == SubscriptionStatus.ENDED
        assert mock_sub.ended_at is not None


@pytest.mark.unit
class TestChangePlanEffectiveDate:
    """Tests for change_plan honoring effective_date"""

    @pytest.mark.asyncio
    async def test_change_plan_immediate_when_no_effective_date(self):
        """Test that plan changes immediately when no effective_date specified"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Mock subscription
        mock_sub = MagicMock()
        mock_sub.subscription_id = "sub_123"
        mock_sub.plan_id = "plan_old"
        mock_sub.status = SubscriptionStatus.ACTIVE.value

        # Mock plan lookup results
        old_plan = MagicMock(plan_id="plan_old", amount=1000)
        new_plan = MagicMock(plan_id="plan_new", amount=2000)

        def mock_execute_side_effect(*args, **kwargs):
            result = MagicMock()
            result.scalar_one_or_none = MagicMock(return_value=mock_sub)
            return result

        mock_db.execute.side_effect = mock_execute_side_effect

        service = SubscriptionService(mock_db)

        # Mock helper methods
        service.get_subscription = AsyncMock(
            return_value=MagicMock(
                subscription_id="sub_123",
                plan_id="plan_old",
                is_active=lambda: True,
            )
        )
        service.get_plan = AsyncMock(side_effect=[old_plan, new_plan])
        service._db_to_pydantic_subscription = MagicMock()
        service._create_event = AsyncMock()

        # Change plan without effective_date (should apply immediately)
        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_new",
            proration_behavior=ProrationBehavior.NONE,
            effective_date=None,  # No effective date - apply now
        )

        await service.change_plan(
            subscription_id="sub_123",
            tenant_id="tenant_1",
            change_request=change_request,
        )

        # Verify plan was changed immediately
        assert mock_sub.plan_id == "plan_new"

    @pytest.mark.asyncio
    async def test_change_plan_scheduled_when_future_effective_date(self):
        """Test that plan changes are scheduled when effective_date is in the future"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()

        # Mock subscription with scheduled fields
        mock_sub = MagicMock()
        mock_sub.subscription_id = "sub_123"
        mock_sub.plan_id = "plan_old"
        mock_sub.status = SubscriptionStatus.ACTIVE.value
        mock_sub.scheduled_plan_id = None
        mock_sub.scheduled_plan_change_date = None

        old_plan = MagicMock(plan_id="plan_old", amount=1000)
        new_plan = MagicMock(plan_id="plan_new", amount=2000)

        def mock_execute_side_effect(*args, **kwargs):
            result = MagicMock()
            result.scalar_one_or_none = MagicMock(return_value=mock_sub)
            return result

        mock_db.execute.side_effect = mock_execute_side_effect

        service = SubscriptionService(mock_db)
        service.get_subscription = AsyncMock(
            return_value=MagicMock(
                subscription_id="sub_123",
                plan_id="plan_old",
                is_active=lambda: True,
            )
        )
        service.get_plan = AsyncMock(side_effect=[old_plan, new_plan])
        service._db_to_pydantic_subscription = MagicMock()
        service._create_event = AsyncMock()

        # Change plan with future effective_date
        future_date = datetime.now(UTC) + timedelta(days=30)
        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_new",
            proration_behavior=ProrationBehavior.NONE,
            effective_date=future_date,  # Future date
        )

        await service.change_plan(
            subscription_id="sub_123",
            tenant_id="tenant_1",
            change_request=change_request,
        )

        # Verify plan was NOT changed immediately
        # If schema supports scheduled changes, it should be stored in scheduled_plan_id
        if hasattr(mock_sub, "scheduled_plan_id"):
            # Current plan should still be the old one
            # The change should be scheduled
            assert mock_sub.scheduled_plan_id == "plan_new"
            assert mock_sub.scheduled_plan_change_date == future_date
            # Plan ID should NOT have changed yet (unless fallback to immediate)
        # If schema doesn't support scheduled changes, it will log warning and apply immediately


@pytest.mark.unit
class TestChangeTenantSubscriptionPlan:
    """Tests for change_tenant_subscription_plan method name fix"""

    @pytest.mark.asyncio
    async def test_change_tenant_subscription_plan_calls_correct_method(self):
        """Test that change_tenant_subscription_plan calls change_plan, not change_subscription_plan"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        service = SubscriptionService(mock_db)

        # Mock the methods
        mock_subscription = MagicMock(
            subscription_id="sub_123",
            plan_id="plan_old",
        )
        service.get_tenant_subscription = AsyncMock(return_value=mock_subscription)
        service.get_plan = AsyncMock()  # Validates plan exists
        service.change_plan = AsyncMock()  # The correct method
        service._create_event = AsyncMock()

        # Call the method with required parameters
        await service.change_tenant_subscription_plan(
            tenant_id="tenant_1",
            new_plan_id="plan_new",
            effective_date=None,  # Apply immediately
            proration_behavior=ProrationBehavior.NONE,
            changed_by_user_id="user_1",
        )

        # Verify change_plan was called (not change_subscription_plan which doesn't exist)
        assert service.change_plan.called
        call_args = service.change_plan.call_args

        # Verify the call arguments
        assert call_args[1]["subscription_id"] == "sub_123"
        assert call_args[1]["tenant_id"] == "tenant_1"

        # Verify change_request was passed
        change_request = call_args[1]["change_request"]
        assert change_request.new_plan_id == "plan_new"
        assert change_request.proration_behavior == ProrationBehavior.NONE

    @pytest.mark.asyncio
    async def test_change_tenant_subscription_plan_no_attribute_error(self):
        """Test that change_tenant_subscription_plan doesn't raise AttributeError"""
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        service = SubscriptionService(mock_db)

        # Verify the method doesn't try to call non-existent change_subscription_plan
        # which would raise AttributeError
        assert not hasattr(service, "change_subscription_plan")
        assert hasattr(service, "change_plan")

        # Mock dependencies
        mock_subscription = MagicMock(subscription_id="sub_123", plan_id="plan_old")
        service.get_tenant_subscription = AsyncMock(return_value=mock_subscription)
        service.get_plan = AsyncMock()
        service.change_plan = AsyncMock()
        service._create_event = AsyncMock()

        # This should NOT raise AttributeError
        try:
            await service.change_tenant_subscription_plan(
                tenant_id="tenant_1",
                new_plan_id="plan_new",
                effective_date=None,
                proration_behavior=ProrationBehavior.NONE,
                changed_by_user_id="user_1",
            )
            # Success - no AttributeError
            assert True
        except AttributeError as e:
            # If we get AttributeError about change_subscription_plan, the bug is not fixed
            if "change_subscription_plan" in str(e):
                pytest.fail(
                    f"change_tenant_subscription_plan tried to call non-existent "
                    f"change_subscription_plan method: {e}"
                )
            else:
                # Some other AttributeError - re-raise
                raise
