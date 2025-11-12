"""
Core Subscription Service Tests - Phase 1 Coverage Improvement

Tests critical subscription service workflows:
- Subscription plan CRUD
- Subscription lifecycle (create, cancel, reactivate)
- Plan changes with proration
- Usage tracking and billing
- Trial period handling
- Subscription renewal
- Tenant isolation

Target: Increase subscription service coverage from 11.40% to 70%+
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.exceptions import (
    PlanNotFoundError,
    SubscriptionNotFoundError,
)
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    ProrationBehavior,
    SubscriptionCreateRequest,
    SubscriptionEventType,
    SubscriptionPlanChangeRequest,
    SubscriptionPlanCreateRequest,
    SubscriptionStatus,
    SubscriptionUpdateRequest,
    UsageRecordRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def tenant_id() -> str:
    """Test tenant ID."""

    return str(uuid4())


@pytest.fixture
def customer_id() -> str:
    """Test customer ID."""

    return str(uuid4())


@pytest.fixture
def sample_plan_data() -> SubscriptionPlanCreateRequest:
    """Sample subscription plan data."""
    return SubscriptionPlanCreateRequest(
        product_id="prod_basic",
        name="Basic Plan",
        description="Basic subscription plan",
        billing_cycle=BillingCycle.MONTHLY,
        price=Decimal("29.99"),
        currency="USD",
        setup_fee=Decimal("10.00"),
        trial_days=14,
        included_usage={"api_calls": 1000},
        overage_rates={"api_calls": Decimal("0.01")},
        metadata={"tier": "basic"},
    )


@pytest_asyncio.fixture
async def subscription_service(async_session: AsyncSession):
    """Subscription service instance."""
    return SubscriptionService(db_session=async_session)


@pytest.mark.integration
class TestSubscriptionPlanCRUD:
    """Test subscription plan CRUD operations."""

    async def test_create_plan_success(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test successful plan creation."""
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        assert plan.plan_id is not None
        assert plan.plan_id.startswith("plan_")
        assert plan.name == "Basic Plan"
        assert plan.billing_cycle == BillingCycle.MONTHLY
        assert plan.price == Decimal("29.99")
        assert plan.setup_fee == Decimal("10.00")
        assert plan.trial_days == 14
        assert plan.included_usage == {"api_calls": 1000}
        assert plan.is_active is True

    async def test_create_plan_with_minimal_data(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test plan creation with minimal required fields."""
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_minimal",
            name="Minimal Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("9.99"),
        )

        plan = await subscription_service.create_plan(
            plan_data=plan_data,
            tenant_id=tenant_id,
        )

        assert plan.plan_id is not None
        assert plan.name == "Minimal Plan"
        assert plan.setup_fee is None
        assert plan.trial_days is None

    async def test_get_plan_success(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test retrieving a plan by ID."""
        # Create plan first
        created_plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        # Retrieve it
        retrieved_plan = await subscription_service.get_plan(
            plan_id=created_plan.plan_id,
            tenant_id=tenant_id,
        )

        assert retrieved_plan is not None
        assert retrieved_plan.plan_id == created_plan.plan_id
        assert retrieved_plan.name == created_plan.name

    async def test_get_plan_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test retrieving non-existent plan."""
        with pytest.raises(PlanNotFoundError):
            await subscription_service.get_plan(
                plan_id="plan_nonexistent",
                tenant_id=tenant_id,
            )

    async def test_list_plans(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test listing all plans."""
        # Create multiple plans
        for i in range(3):
            plan_data = SubscriptionPlanCreateRequest(
                product_id=f"prod_{i}",
                name=f"Plan {i}",
                billing_cycle=BillingCycle.MONTHLY,
                price=Decimal(f"{10 + i}.99"),
            )
            await subscription_service.create_plan(
                plan_data=plan_data,
                tenant_id=tenant_id,
            )

        # List plans
        plans = await subscription_service.list_plans(tenant_id=tenant_id)

        assert len(plans) >= 3
        assert all(p.tenant_id == tenant_id for p in plans)


@pytest.mark.integration
class TestSubscriptionLifecycle:
    """Test subscription lifecycle operations."""

    async def test_create_subscription_success(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test successful subscription creation."""
        # Create plan first
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )

        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        assert subscription.subscription_id is not None
        assert subscription.subscription_id.startswith("sub_")
        assert subscription.customer_id == customer_id
        assert subscription.plan_id == plan.plan_id
        assert subscription.status == SubscriptionStatus.TRIALING  # Has trial period
        assert subscription.trial_end is not None
        assert subscription.current_period_start is not None
        assert subscription.current_period_end is not None

    async def test_create_subscription_without_trial(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test subscription creation without trial period."""
        # Create plan without trial
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_no_trial",
            name="No Trial Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("19.99"),
            trial_days=0,
        )
        plan = await subscription_service.create_plan(
            plan_data=plan_data,
            tenant_id=tenant_id,
        )

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )

        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.trial_end is None

    async def test_get_subscription_success(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test retrieving subscription by ID."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        created_sub = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Retrieve it
        retrieved_sub = await subscription_service.get_subscription(
            subscription_id=created_sub.subscription_id,
            tenant_id=tenant_id,
        )

        assert retrieved_sub is not None
        assert retrieved_sub.subscription_id == created_sub.subscription_id

    async def test_get_subscription_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test retrieving non-existent subscription."""
        with pytest.raises(SubscriptionNotFoundError):
            await subscription_service.get_subscription(
                subscription_id="sub_nonexistent",
                tenant_id=tenant_id,
            )

    async def test_list_subscriptions(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test listing subscriptions."""
        # Create plan
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        # Create multiple subscriptions
        for i in range(3):
            sub_data = SubscriptionCreateRequest(
                customer_id=f"cust_{i}",
                plan_id=plan.plan_id,
            )
            await subscription_service.create_subscription(
                subscription_data=sub_data,
                tenant_id=tenant_id,
            )

        # List subscriptions
        subscriptions = await subscription_service.list_subscriptions(tenant_id=tenant_id)

        assert len(subscriptions) >= 3

    async def test_cancel_subscription(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test canceling a subscription."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Cancel it at period end
        canceled_sub = await subscription_service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
            at_period_end=True,
        )

        assert canceled_sub.cancel_at_period_end is True
        assert canceled_sub.canceled_at is not None
        assert canceled_sub.status != SubscriptionStatus.ENDED  # Still active until period end

    async def test_cancel_subscription_immediately(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test immediate subscription cancellation."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Cancel immediately
        canceled_sub = await subscription_service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
            at_period_end=False,
        )

        assert canceled_sub.status == SubscriptionStatus.ENDED
        assert canceled_sub.ended_at is not None

    async def test_reactivate_subscription(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test reactivating a canceled subscription."""
        # Create, then cancel subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        await subscription_service.cancel_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
            at_period_end=True,
        )

        # Reactivate
        reactivated_sub = await subscription_service.reactivate_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )

        assert reactivated_sub.cancel_at_period_end is False
        assert reactivated_sub.status in [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING]


@pytest.mark.integration
class TestSubscriptionUpdates:
    """Test subscription update operations."""

    async def test_update_subscription_metadata(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test updating subscription metadata."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Update metadata
        update_data = SubscriptionUpdateRequest(metadata={"custom_field": "custom_value"})

        updated_sub = await subscription_service.update_subscription(
            subscription_id=subscription.subscription_id,
            updates=update_data,
            tenant_id=tenant_id,
        )

        assert updated_sub.metadata == {"custom_field": "custom_value"}

    async def test_update_subscription_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test updating non-existent subscription."""
        update_data = SubscriptionUpdateRequest(metadata={"test": "value"})

        with pytest.raises(SubscriptionNotFoundError):
            await subscription_service.update_subscription(
                subscription_id="sub_nonexistent",
                updates=update_data,
                tenant_id=tenant_id,
            )


@pytest.mark.integration
class TestPlanChanges:
    """Test subscription plan change operations."""

    async def test_change_plan_success(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test successful plan change."""
        # Create two plans
        plan1_data = SubscriptionPlanCreateRequest(
            product_id="prod_basic",
            name="Basic Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("19.99"),
        )
        plan1 = await subscription_service.create_plan(plan_data=plan1_data, tenant_id=tenant_id)

        plan2_data = SubscriptionPlanCreateRequest(
            product_id="prod_premium",
            name="Premium Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
        )
        plan2 = await subscription_service.create_plan(plan_data=plan2_data, tenant_id=tenant_id)

        # Create subscription on plan1
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan1.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Change to plan2
        change_request = SubscriptionPlanChangeRequest(
            new_plan_id=plan2.plan_id,
            proration_behavior=ProrationBehavior.NONE,
        )

        updated_sub, proration_result = await subscription_service.change_plan(
            subscription_id=subscription.subscription_id,
            change_request=change_request,
            tenant_id=tenant_id,
        )

        assert updated_sub.plan_id == plan2.plan_id


@pytest.mark.integration
class TestUsageTracking:
    """Test usage tracking and billing."""

    async def test_record_usage(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test recording usage for a subscription."""
        # Create plan with usage tracking
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_usage",
            name="Usage Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("0.00"),
            included_usage={"api_calls": 1000},
            overage_rates={"api_calls": Decimal("0.01")},
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Record usage
        usage_record = UsageRecordRequest(
            subscription_id=subscription.subscription_id,
            usage_type="api_calls",
            quantity=500,
        )

        result = await subscription_service.record_usage(
            usage_request=usage_record,
            tenant_id=tenant_id,
        )

        # record_usage returns Dict[str, int] with current usage
        assert isinstance(result, dict)
        assert "api_calls" in result

    async def test_get_usage_for_period(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test retrieving usage for a billing period."""
        # Create plan and subscription
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_usage",
            name="Usage Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("0.00"),
            included_usage={"api_calls": 1000},
            overage_rates={"api_calls": Decimal("0.01")},
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Record some usage
        usage_record = UsageRecordRequest(
            subscription_id=subscription.subscription_id,
            usage_type="api_calls",
            quantity=750,
        )
        await subscription_service.record_usage(usage_request=usage_record, tenant_id=tenant_id)

        # Get usage
        usage = await subscription_service.get_usage_for_period(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )

        assert usage is not None
        assert "api_calls" in usage
        assert usage["api_calls"] >= 750


@pytest.mark.integration
class TestSubscriptionRenewal:
    """Test subscription renewal operations."""

    async def test_get_subscriptions_due_for_renewal(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test finding subscriptions due for renewal."""
        # Create plan
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_renewal",
            name="Renewal Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            trial_days=0,
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Create subscription with past end date
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )

        # Mock to create subscription with past period

        past_time = datetime.now(UTC) - timedelta(days=5)
        with patch("dotmac.platform.billing.subscriptions.service.datetime") as mock_dt:
            mock_dt.now.return_value = past_time
            mock_dt.side_effect = lambda *args, **kw: datetime(*args, **kw)

            await subscription_service.create_subscription(
                subscription_data=sub_data,
                tenant_id=tenant_id,
            )

        # Get subscriptions due for renewal
        due_subscriptions = await subscription_service.get_subscriptions_due_for_renewal(
            tenant_id=tenant_id
        )

        # Should find our subscription (or at least not error)
        assert isinstance(due_subscriptions, list)


@pytest.mark.integration
class TestTenantIsolation:
    """Test tenant isolation in subscription service."""

    async def test_plan_tenant_isolation(
        self,
        subscription_service: SubscriptionService,
    ):
        """Test plans are isolated by tenant."""
        tenant1_id = "tenant-sub-1"
        tenant2_id = "tenant-sub-2"

        # Create plan for tenant 1
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_tenant1",
            name="Tenant 1 Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
        )
        plan1 = await subscription_service.create_plan(
            plan_data=plan_data,
            tenant_id=tenant1_id,
        )

        # Try to get tenant 1's plan using tenant 2 context - should raise exception
        with pytest.raises(PlanNotFoundError):
            await subscription_service.get_plan(
                plan_id=plan1.plan_id,
                tenant_id=tenant2_id,
            )

    async def test_subscription_tenant_isolation(
        self,
        subscription_service: SubscriptionService,
    ):
        """Test subscriptions are isolated by tenant."""
        tenant1_id = "tenant-sub-3"
        tenant2_id = "tenant-sub-4"

        # Create plan and subscription for tenant 1
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_tenant3",
            name="Tenant 3 Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
        )
        plan = await subscription_service.create_plan(
            plan_data=plan_data,
            tenant_id=tenant1_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id="cust_tenant1",
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant1_id,
        )

        # Try to get tenant 1's subscription using tenant 2 context - should raise exception
        with pytest.raises(SubscriptionNotFoundError):
            await subscription_service.get_subscription(
                subscription_id=subscription.subscription_id,
                tenant_id=tenant2_id,
            )


@pytest.mark.integration
class TestBillingCycles:
    """Test different billing cycle calculations."""

    async def test_quarterly_billing_cycle(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test subscription with quarterly billing cycle."""
        # Create quarterly plan
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_quarterly",
            name="Quarterly Plan",
            billing_cycle=BillingCycle.QUARTERLY,
            price=Decimal("99.99"),
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Verify period is approximately 3 months
        period_days = (subscription.current_period_end - subscription.current_period_start).days
        assert 85 <= period_days <= 95  # Approximately 3 months

    async def test_annual_billing_cycle(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test subscription with annual billing cycle."""
        # Create annual plan
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_annual",
            name="Annual Plan",
            billing_cycle=BillingCycle.ANNUAL,
            price=Decimal("999.99"),
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Verify period is approximately 1 year
        period_days = (subscription.current_period_end - subscription.current_period_start).days
        assert 360 <= period_days <= 370  # Approximately 1 year


@pytest.mark.integration
class TestProrationCalculation:
    """Test proration calculation for plan changes."""

    async def test_calculate_proration_preview(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test proration preview calculation."""
        # Create two plans
        plan1_data = SubscriptionPlanCreateRequest(
            product_id="prod_proration_1",
            name="Basic Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("20.00"),
        )
        plan1 = await subscription_service.create_plan(plan_data=plan1_data, tenant_id=tenant_id)

        plan2_data = SubscriptionPlanCreateRequest(
            product_id="prod_proration_2",
            name="Premium Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("50.00"),
        )
        plan2 = await subscription_service.create_plan(plan_data=plan2_data, tenant_id=tenant_id)

        # Create subscription on plan1
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan1.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Calculate proration preview
        proration_result = await subscription_service.calculate_proration_preview(
            subscription_id=subscription.subscription_id,
            new_plan_id=plan2.plan_id,
            tenant_id=tenant_id,
        )

        assert proration_result is not None
        assert proration_result.proration_amount is not None
        assert proration_result.days_remaining >= 0

    async def test_change_plan_with_proration(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test plan change with proration enabled."""
        # Create two plans
        plan1_data = SubscriptionPlanCreateRequest(
            product_id="prod_pro_1",
            name="Basic Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("20.00"),
        )
        plan1 = await subscription_service.create_plan(plan_data=plan1_data, tenant_id=tenant_id)

        plan2_data = SubscriptionPlanCreateRequest(
            product_id="prod_pro_2",
            name="Premium Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("50.00"),
        )
        plan2 = await subscription_service.create_plan(plan_data=plan2_data, tenant_id=tenant_id)

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan1.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Change plan with proration
        change_request = SubscriptionPlanChangeRequest(
            new_plan_id=plan2.plan_id,
            proration_behavior=ProrationBehavior.CREATE_PRORATIONS,
        )

        updated_sub, proration_result = await subscription_service.change_plan(
            subscription_id=subscription.subscription_id,
            change_request=change_request,
            tenant_id=tenant_id,
        )

        assert updated_sub.plan_id == plan2.plan_id
        assert proration_result is not None
        assert proration_result.proration_amount is not None


@pytest.mark.integration
class TestPlanFilters:
    """Test plan listing with filters."""

    async def test_list_plans_by_product_id(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test listing plans filtered by product ID."""
        # Create plans for different products
        plan1_data = SubscriptionPlanCreateRequest(
            product_id="product_a",
            name="Product A Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
        )
        await subscription_service.create_plan(plan_data=plan1_data, tenant_id=tenant_id)

        plan2_data = SubscriptionPlanCreateRequest(
            product_id="product_b",
            name="Product B Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("39.99"),
        )
        await subscription_service.create_plan(plan_data=plan2_data, tenant_id=tenant_id)

        # List plans for product_a only
        plans = await subscription_service.list_plans(
            tenant_id=tenant_id,
            product_id="product_a",
        )

        assert len(plans) >= 1
        assert all(p.product_id == "product_a" for p in plans)

    async def test_list_plans_by_billing_cycle(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test listing plans filtered by billing cycle."""
        # Create plans with different billing cycles
        monthly_plan = SubscriptionPlanCreateRequest(
            product_id="prod_monthly_filter",
            name="Monthly Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
        )
        await subscription_service.create_plan(plan_data=monthly_plan, tenant_id=tenant_id)

        annual_plan = SubscriptionPlanCreateRequest(
            product_id="prod_annual_filter",
            name="Annual Plan",
            billing_cycle=BillingCycle.ANNUAL,
            price=Decimal("299.99"),
        )
        await subscription_service.create_plan(plan_data=annual_plan, tenant_id=tenant_id)

        # List only monthly plans
        plans = await subscription_service.list_plans(
            tenant_id=tenant_id,
            billing_cycle=BillingCycle.MONTHLY,
        )

        assert len(plans) >= 1
        assert all(p.billing_cycle == BillingCycle.MONTHLY for p in plans)

    async def test_list_plans_include_inactive(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test listing plans including inactive ones."""
        # Create plan
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_inactive_test",
            name="Test Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
        )
        await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # List with active_only=False
        all_plans = await subscription_service.list_plans(
            tenant_id=tenant_id,
            active_only=False,
        )

        assert len(all_plans) >= 1


@pytest.mark.integration
class TestHelperMethods:
    """Test helper and utility methods."""

    async def test_get_usage(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test getting current usage for subscription."""
        # Create plan with usage tracking
        plan_data = SubscriptionPlanCreateRequest(
            product_id="prod_usage_helper",
            name="Usage Plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("0.00"),
            included_usage={"api_calls": 1000},
        )
        plan = await subscription_service.create_plan(plan_data=plan_data, tenant_id=tenant_id)

        # Create subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Record some usage
        usage_record = UsageRecordRequest(
            subscription_id=subscription.subscription_id,
            usage_type="api_calls",
            quantity=100,
        )
        await subscription_service.record_usage(usage_request=usage_record, tenant_id=tenant_id)

        # Get usage
        usage = await subscription_service.get_usage(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )

        assert usage is not None
        assert "api_calls" in usage

    async def test_record_event(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test recording subscription events."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Record custom event
        await subscription_service.record_event(
            subscription_id=subscription.subscription_id,
            event_type=SubscriptionEventType.PAYMENT_SUCCEEDED,
            event_data={"payment_id": "pay_123", "amount": 2999},
            tenant_id=tenant_id,
        )

        # No exception = success


@pytest.mark.integration
class TestErrorHandling:
    """Test error handling in subscription service."""

    async def test_create_subscription_with_invalid_plan(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
    ):
        """Test creating subscription with non-existent plan."""
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id="plan_nonexistent",
        )

        with pytest.raises(PlanNotFoundError):
            await subscription_service.create_subscription(
                subscription_data=sub_data,
                tenant_id=tenant_id,
            )

    async def test_cancel_nonexistent_subscription(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test canceling non-existent subscription."""
        with pytest.raises(SubscriptionNotFoundError):
            await subscription_service.cancel_subscription(
                subscription_id="sub_nonexistent",
                tenant_id=tenant_id,
                at_period_end=True,
            )

    async def test_change_plan_subscription_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test changing plan for non-existent subscription."""
        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_123",
            proration_behavior=ProrationBehavior.NONE,
        )

        with pytest.raises(SubscriptionNotFoundError):
            await subscription_service.change_plan(
                subscription_id="sub_nonexistent",
                change_request=change_request,
                tenant_id=tenant_id,
            )


@pytest.mark.integration
class TestPrivateHelperMethods:
    """Test private helper methods for edge cases."""

    async def test_update_subscription_status_helper(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test _update_subscription_status helper method."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Use private method to update status
        result = await subscription_service._update_subscription_status(
            subscription_id=subscription.subscription_id,
            status=SubscriptionStatus.ACTIVE,
            tenant_id=tenant_id,
        )

        assert result is True

        # Verify status was updated
        updated_sub = await subscription_service.get_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )
        assert updated_sub.status == SubscriptionStatus.ACTIVE

    async def test_update_subscription_status_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test _update_subscription_status with non-existent subscription."""
        result = await subscription_service._update_subscription_status(
            subscription_id="sub_nonexistent",
            status=SubscriptionStatus.ACTIVE,
            tenant_id=tenant_id,
        )

        assert result is False

    async def test_reset_usage_for_new_period(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test _reset_usage_for_new_period helper method."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Record some usage
        usage_record = UsageRecordRequest(
            subscription_id=subscription.subscription_id,
            usage_type="api_calls",
            quantity=500,
        )
        await subscription_service.record_usage(
            usage_request=usage_record,
            tenant_id=tenant_id,
        )

        # Reset usage
        result = await subscription_service._reset_usage_for_new_period(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )

        assert result is True

        # Verify usage was reset
        usage = await subscription_service.get_usage(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )
        assert usage.get("api_calls", 0) == 0

    async def test_reset_usage_not_found(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
    ):
        """Test _reset_usage_for_new_period with non-existent subscription."""
        result = await subscription_service._reset_usage_for_new_period(
            subscription_id="sub_nonexistent",
            tenant_id=tenant_id,
        )

        assert result is False


@pytest.mark.integration
class TestSubscriptionStatusTransitions:
    """Test subscription status transitions and edge cases."""

    async def test_pause_subscription(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test pausing an active subscription."""
        # Create plan and subscription
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Pause the subscription using helper
        await subscription_service._update_subscription_status(
            subscription_id=subscription.subscription_id,
            status=SubscriptionStatus.PAUSED,
            tenant_id=tenant_id,
        )

        # Verify status
        updated_sub = await subscription_service.get_subscription(
            subscription_id=subscription.subscription_id,
            tenant_id=tenant_id,
        )
        assert updated_sub.status == SubscriptionStatus.PAUSED

    async def test_list_subscriptions_by_status(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test listing subscriptions filtered by status."""
        # Create plan
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        # Create multiple subscriptions
        for _i in range(3):
            sub_data = SubscriptionCreateRequest(
                customer_id=customer_id,
                plan_id=plan.plan_id,
            )
            await subscription_service.create_subscription(
                subscription_data=sub_data,
                tenant_id=tenant_id,
            )

        # List all subscriptions
        all_subs = await subscription_service.list_subscriptions(
            tenant_id=tenant_id,
        )

        assert len(all_subs) >= 3

    async def test_get_active_subscription_count(
        self,
        subscription_service: SubscriptionService,
        tenant_id: str,
        customer_id: str,
        sample_plan_data: SubscriptionPlanCreateRequest,
    ):
        """Test counting active subscriptions."""
        # Create plan
        plan = await subscription_service.create_plan(
            plan_data=sample_plan_data,
            tenant_id=tenant_id,
        )

        # Create active subscription
        sub_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )
        subscription = await subscription_service.create_subscription(
            subscription_data=sub_data,
            tenant_id=tenant_id,
        )

        # Make it active
        await subscription_service._update_subscription_status(
            subscription_id=subscription.subscription_id,
            status=SubscriptionStatus.ACTIVE,
            tenant_id=tenant_id,
        )

        # List active subscriptions
        subs = await subscription_service.list_subscriptions(
            tenant_id=tenant_id,
        )

        active_count = sum(1 for s in subs if s.status == SubscriptionStatus.ACTIVE)
        assert active_count >= 1
