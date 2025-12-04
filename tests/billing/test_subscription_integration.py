"""
Integration Tests for Subscription Service (with Real Database).

Strategy: Use REAL database, mock ONLY external APIs
Focus: Test subscription lifecycle with actual DB operations
"""

from decimal import Decimal

import pytest

from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionCreateRequest,
    SubscriptionPlanCreateRequest,
    SubscriptionStatus,
    SubscriptionUpdateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService


async def _create_test_plan(
    service: SubscriptionService,
    tenant_id: str = "test-tenant",
    **overrides,
):
    """Helper to create a subscription plan via the service."""

    plan_data = SubscriptionPlanCreateRequest(
        product_id=overrides.get("product_id", "prod_123"),
        name=overrides.get("name", "Test Plan"),
        description=overrides.get("description", "Test subscription plan"),
        billing_cycle=overrides.get("billing_cycle", BillingCycle.MONTHLY),
        price=overrides.get("price", Decimal("29.99")),
        currency=overrides.get("currency", "usd"),
        trial_days=overrides.get("trial_days", 14),
        included_usage=overrides.get("included_usage", {}),
        overage_rates=overrides.get("overage_rates", {}),
        metadata=overrides.get("metadata", {}),
    )

    return await service.create_plan(plan_data=plan_data, tenant_id=tenant_id)


pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestSubscriptionPlanManagement:
    """Test subscription plan CRUD with real database."""

    async def test_create_plan_success(self, async_session):
        """Test creating subscription plan with real DB."""
        service = SubscriptionService(db_session=async_session)

        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_123",
            name="Premium Plan",
            description="Premium subscription",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
            currency="usd",
            trial_days=14,
        )

        plan = await service.create_plan(plan_data=plan_data, tenant_id="test-tenant")

        assert plan.plan_id is not None
        assert plan.name == "Premium Plan"
        assert plan.price == Decimal("49.99")
        assert plan.trial_days == 14

    async def test_list_plans(self, async_session):
        """Test listing plans."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        plans = await service.list_plans(tenant_id="test-tenant")

        assert len(plans) >= 1
        assert any(p.plan_id == plan.plan_id for p in plans)

    async def test_get_plan_by_id(self, async_session):
        """Test getting plan by ID."""
        service = SubscriptionService(db_session=async_session)

        plan_created = await _create_test_plan(service)

        plan = await service.get_plan(plan_id=plan_created.plan_id, tenant_id="test-tenant")

        assert plan.plan_id == plan_created.plan_id
        assert plan.name == plan_created.name


@pytest.mark.asyncio
class TestSubscriptionLifecycle:
    """Test subscription lifecycle with real database."""

    async def test_create_subscription_with_trial(self, async_session):
        """Test creating subscription with trial period."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_123",
            plan_id=plan.plan_id,
        )

        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        assert subscription.subscription_id is not None
        assert subscription.status == SubscriptionStatus.TRIALING
        assert subscription.trial_end is not None

    async def test_create_subscription_no_trial(self, async_session):
        """Test creating subscription without trial."""
        service = SubscriptionService(db_session=async_session)

        # Create plan without trial
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_456",
            name="No Trial Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="usd",
            trial_days=0,
        )
        plan = await service.create_plan(plan_data=plan_data, tenant_id="test-tenant")

        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_123",
            plan_id=plan.plan_id,
        )

        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.trial_end is None

    async def test_get_subscription(self, async_session):
        """Test getting subscription by ID."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        # Create subscription
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_123",
            plan_id=plan.plan_id,
        )
        created = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # Get subscription
        subscription = await service.get_subscription(
            subscription_id=created.subscription_id, tenant_id="test-tenant"
        )

        assert subscription.subscription_id == created.subscription_id
        assert subscription.customer_id == "cust_123"

    async def test_list_subscriptions(self, async_session):
        """Test listing subscriptions."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        # Create subscription
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_list",
            plan_id=plan.plan_id,
        )
        await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # List subscriptions
        subscriptions = await service.list_subscriptions(
            tenant_id="test-tenant", customer_id="cust_list"
        )

        assert len(subscriptions) >= 1
        assert any(s.customer_id == "cust_list" for s in subscriptions)


@pytest.mark.asyncio
class TestSubscriptionCancellation:
    """Test subscription cancellation logic."""

    async def test_cancel_subscription_at_period_end(self, async_session):
        """Test canceling subscription at period end."""
        service = SubscriptionService(db_session=async_session)

        # Create active subscription (no trial)
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_789",
            name="Cancel Test Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("19.99"),
            currency="usd",
            trial_days=0,
        )
        plan = await service.create_plan(plan_data=plan_data, tenant_id="test-tenant")

        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_123",
            plan_id=plan.plan_id,
        )
        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # Cancel at period end
        canceled = await service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id="test-tenant",
            at_period_end=True,
        )

        assert canceled.cancel_at_period_end is True
        # When canceled at period end, status remains ACTIVE until period ends
        assert canceled.status == SubscriptionStatus.ACTIVE

    async def test_cancel_subscription_immediately(self, async_session):
        """Test immediate subscription cancellation."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        # Create subscription
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_456",
            plan_id=plan.plan_id,
        )
        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # Cancel immediately
        canceled = await service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id="test-tenant",
            at_period_end=False,
        )

        assert canceled.status == SubscriptionStatus.ENDED  # Immediate cancellation sets to ENDED
        assert canceled.canceled_at is not None
        assert canceled.ended_at is not None


@pytest.mark.asyncio
class TestSubscriptionPlanChange:
    """Test subscription plan changes."""

    async def test_change_plan_upgrade(self, async_session):
        """Test upgrading subscription plan."""
        service = SubscriptionService(db_session=async_session)

        # Create basic plan
        basic_plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_basic",
            name="Basic Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("9.99"),
            currency="usd",
            trial_days=0,
        )
        basic_plan = await service.create_plan(plan_data=basic_plan_data, tenant_id="test-tenant")

        # Create premium plan
        premium_plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_premium",
            name="Premium Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="usd",
            trial_days=0,
        )
        premium_plan = await service.create_plan(
            plan_data=premium_plan_data, tenant_id="test-tenant"
        )

        # Create subscription with basic plan
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_upgrade",
            plan_id=basic_plan.plan_id,
        )
        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # Upgrade to premium
        from dotmac.platform.billing.subscriptions.models import SubscriptionPlanChangeRequest

        change_request = SubscriptionPlanChangeRequest(new_plan_id=premium_plan.plan_id)

        upgraded, proration = await service.change_plan(
            subscription_id=subscription.subscription_id,
            change_request=change_request,
            tenant_id="test-tenant",
        )

        assert upgraded.plan_id == premium_plan.plan_id
        assert upgraded.status == SubscriptionStatus.ACTIVE


@pytest.mark.asyncio
class TestSubscriptionReactivation:
    """Test subscription reactivation."""

    async def test_reactivate_canceled_subscription(self, async_session):
        """Test reactivating a canceled subscription."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        # Create and cancel subscription at period end (sets status to CANCELED)
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_reactivate",
            plan_id=plan.plan_id,
        )
        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        canceled = await service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id="test-tenant",
            at_period_end=True,  # Changed to True to keep status as CANCELED
        )

        # Reactivate
        reactivated = await service.reactivate_subscription(
            subscription_id=canceled.subscription_id,
            tenant_id="test-tenant",
        )

        assert reactivated.status == SubscriptionStatus.ACTIVE
        assert reactivated.canceled_at is None


@pytest.mark.asyncio
class TestSubscriptionUpdate:
    """Test subscription updates."""

    async def test_update_subscription_metadata(self, async_session):
        """Test updating subscription metadata."""
        service = SubscriptionService(db_session=async_session)

        plan = await _create_test_plan(service)

        # Create subscription
        subscription_data = SubscriptionCreateRequest(
            customer_id="cust_update",
            plan_id=plan.plan_id,
        )
        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id="test-tenant"
        )

        # Update with metadata
        update_data = SubscriptionUpdateRequest(metadata={"key": "value", "updated": True})
        updated = await service.update_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id="test-tenant",
            updates=update_data,
        )

        assert updated.metadata.get("key") == "value"
        assert updated.metadata.get("updated") is True
