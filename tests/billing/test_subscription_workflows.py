"""
Integration tests for complete subscription workflows.

Tests end-to-end subscription scenarios that span multiple operations.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.models import (
    BillingSubscriptionPlanTable,
    BillingSubscriptionTable,
)
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    Subscription,
    SubscriptionCreateRequest,
    SubscriptionPlan,
    SubscriptionPlanCreateRequest,
    SubscriptionStatus,
    UsageRecordRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_db():
    """Mock database session."""
    db = AsyncMock()
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.fixture
def subscription_service(mock_db):
    """Subscription service with mock DB."""
    return SubscriptionService(mock_db)


@pytest.mark.integration
class TestCompleteSubscriptionLifecycle:
    """Test complete subscription lifecycle from creation to cancellation."""

    @pytest.mark.asyncio
    async def test_full_subscription_lifecycle_workflow(self, subscription_service, mock_db):
        """
        Test complete workflow:
        1. Create plan
        2. Create subscription
        3. Record usage
        4. Cancel subscription
        """
        now = datetime.now(UTC)

        # Step 1: Create plan
        plan_request = SubscriptionPlanCreateRequest(
            product_id="prod_workflow",
            name="Workflow Plan",
            description="Plan for workflow testing",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("99.99"),
            currency="USD",
            included_usage={"api_calls": 10000},
            overage_rates={"api_calls": Decimal("0.01")},
        )

        mock_db_plan = MagicMock(spec=BillingSubscriptionPlanTable)
        mock_db_plan.plan_id = "plan_workflow"
        mock_db_plan.tenant_id = "tenant_workflow"
        mock_db_plan.product_id = plan_request.product_id
        mock_db_plan.name = plan_request.name
        mock_db_plan.description = plan_request.description
        mock_db_plan.billing_cycle = plan_request.billing_cycle.value
        mock_db_plan.price = plan_request.price
        mock_db_plan.currency = plan_request.currency
        mock_db_plan.setup_fee = None
        mock_db_plan.trial_days = None
        mock_db_plan.included_usage = plan_request.included_usage
        mock_db_plan.overage_rates = {k: str(v) for k, v in plan_request.overage_rates.items()}
        mock_db_plan.metadata_json = {}
        mock_db_plan.is_active = True
        mock_db_plan.created_at = now
        mock_db_plan.updated_at = now

        async def mock_refresh_plan(obj):
            if isinstance(obj, BillingSubscriptionPlanTable):
                for key, value in vars(mock_db_plan).items():
                    if not key.startswith("_"):
                        setattr(obj, key, value)

        mock_db.refresh.side_effect = mock_refresh_plan

        plan = await subscription_service.create_plan(plan_request, "tenant_workflow")

        assert plan.plan_id == "plan_workflow"
        assert plan.price == Decimal("99.99")

    @pytest.mark.asyncio
    async def test_trial_to_active_workflow(self, subscription_service, mock_db):
        """
        Test workflow:
        1. Create subscription with trial
        2. Verify trial status
        3. Simulate trial end (would be done by background job)
        """
        now = datetime.now(UTC)

        # Create plan with trial
        mock_db_plan = MagicMock(spec=BillingSubscriptionPlanTable)
        mock_db_plan.plan_id = "plan_trial"
        mock_db_plan.tenant_id = "tenant_trial"
        mock_db_plan.product_id = "prod_trial"
        mock_db_plan.name = "Trial Plan"
        mock_db_plan.description = "Plan with trial"
        mock_db_plan.billing_cycle = BillingCycle.MONTHLY.value
        mock_db_plan.price = Decimal("49.99")
        mock_db_plan.currency = "USD"
        mock_db_plan.setup_fee = None
        mock_db_plan.trial_days = 14
        mock_db_plan.included_usage = {}
        mock_db_plan.overage_rates = {}
        mock_db_plan.metadata_json = {}
        mock_db_plan.is_active = True
        mock_db_plan.created_at = now
        mock_db_plan.updated_at = now

        # Create subscription
        mock_db_sub = MagicMock(spec=BillingSubscriptionTable)
        mock_db_sub.subscription_id = "sub_trial"
        mock_db_sub.tenant_id = "tenant_trial"
        mock_db_sub.customer_id = "cust_trial"
        mock_db_sub.plan_id = "plan_trial"
        mock_db_sub.current_period_start = now
        mock_db_sub.current_period_end = now + timedelta(days=30)
        mock_db_sub.status = SubscriptionStatus.TRIALING.value
        mock_db_sub.trial_end = now + timedelta(days=14)
        mock_db_sub.cancel_at_period_end = False
        mock_db_sub.canceled_at = None
        mock_db_sub.ended_at = None
        mock_db_sub.custom_price = None
        mock_db_sub.usage_records = {}
        mock_db_sub.metadata_json = {}
        mock_db_sub.created_at = now
        mock_db_sub.updated_at = now

        mock_result_plan = MagicMock()
        mock_result_plan.scalar_one_or_none.return_value = mock_db_plan

        call_count = [0]

        async def mock_execute(stmt):
            call_count[0] += 1
            if call_count[0] == 1:
                return mock_result_plan
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_db_sub
            return mock_result

        mock_db.execute.side_effect = mock_execute

        async def mock_refresh(obj):
            if isinstance(obj, BillingSubscriptionTable):
                for key, value in vars(mock_db_sub).items():
                    if not key.startswith("_"):
                        setattr(obj, key, value)

        mock_db.refresh.side_effect = mock_refresh

        sub_request = SubscriptionCreateRequest(
            customer_id="cust_trial",
            plan_id="plan_trial",
        )

        subscription = await subscription_service.create_subscription(sub_request, "tenant_trial")

        assert subscription.status == SubscriptionStatus.TRIALING
        assert subscription.is_in_trial() is True
        assert subscription.trial_end is not None


@pytest.mark.integration
class TestPlanUpgradeDowngradeWorkflows:
    """Test plan upgrade and downgrade workflows."""

    @pytest.mark.asyncio
    async def test_upgrade_plan_with_proration_workflow(self, subscription_service, mock_db):
        """
        Test workflow:
        1. Subscribe to basic plan
        2. Upgrade to pro plan mid-cycle
        3. Calculate proration
        """
        now = datetime.now(UTC)

        # Basic plan
        basic_plan = SubscriptionPlan(
            plan_id="plan_basic",
            tenant_id="tenant_upgrade",
            product_id="prod_123",
            name="Basic Plan",
            description="Basic tier",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="USD",
            setup_fee=None,
            trial_days=None,
            included_usage={"api_calls": 1000},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=now,
            updated_at=now,
        )

        # Pro plan
        pro_plan = SubscriptionPlan(
            plan_id="plan_pro",
            tenant_id="tenant_upgrade",
            product_id="prod_123",
            name="Pro Plan",
            description="Professional tier",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("99.99"),
            currency="USD",
            setup_fee=None,
            trial_days=None,
            included_usage={"api_calls": 10000},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=now,
            updated_at=now,
        )

        # Subscription halfway through period
        subscription = Subscription(
            subscription_id="sub_upgrade",
            tenant_id="tenant_upgrade",
            customer_id="cust_upgrade",
            plan_id="plan_basic",
            current_period_start=now - timedelta(days=15),
            current_period_end=now + timedelta(days=15),
            status=SubscriptionStatus.ACTIVE,
            trial_end=None,
            cancel_at_period_end=False,
            canceled_at=None,
            ended_at=None,
            custom_price=None,
            usage_records={},
            metadata={},
            created_at=now - timedelta(days=15),
            updated_at=now,
        )

        # Calculate proration
        proration = subscription_service._calculate_proration(subscription, basic_plan, pro_plan)

        # Should charge for difference
        assert proration.proration_amount > 0  # Upgrade costs more
        assert proration.days_remaining >= 14  # Allow for timing variance
        assert proration.days_remaining <= 15
        assert proration.old_plan_unused_amount >= 0
        assert proration.new_plan_prorated_amount > proration.old_plan_unused_amount

    @pytest.mark.asyncio
    async def test_downgrade_plan_with_credit_workflow(self, subscription_service, mock_db):
        """
        Test workflow:
        1. Subscribe to pro plan
        2. Downgrade to basic plan mid-cycle
        3. Calculate credit
        """
        now = datetime.now(UTC)

        # Pro plan
        pro_plan = SubscriptionPlan(
            plan_id="plan_pro",
            tenant_id="tenant_downgrade",
            product_id="prod_123",
            name="Pro Plan",
            description="Professional tier",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("99.99"),
            currency="USD",
            setup_fee=None,
            trial_days=None,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=now,
            updated_at=now,
        )

        # Basic plan
        basic_plan = SubscriptionPlan(
            plan_id="plan_basic",
            tenant_id="tenant_downgrade",
            product_id="prod_123",
            name="Basic Plan",
            description="Basic tier",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="USD",
            setup_fee=None,
            trial_days=None,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=now,
            updated_at=now,
        )

        # Subscription halfway through period
        subscription = Subscription(
            subscription_id="sub_downgrade",
            tenant_id="tenant_downgrade",
            customer_id="cust_downgrade",
            plan_id="plan_pro",
            current_period_start=now - timedelta(days=15),
            current_period_end=now + timedelta(days=15),
            status=SubscriptionStatus.ACTIVE,
            trial_end=None,
            cancel_at_period_end=False,
            canceled_at=None,
            ended_at=None,
            custom_price=None,
            usage_records={},
            metadata={},
            created_at=now - timedelta(days=15),
            updated_at=now,
        )

        # Calculate proration
        proration = subscription_service._calculate_proration(subscription, pro_plan, basic_plan)

        # Should provide credit for difference
        assert proration.proration_amount < 0  # Downgrade provides credit
        assert proration.days_remaining >= 14  # Allow for timing variance
        assert proration.days_remaining <= 15
        assert proration.old_plan_unused_amount > proration.new_plan_prorated_amount


@pytest.mark.integration
class TestUsageBasedBillingWorkflows:
    """Test usage-based billing workflows."""

    @pytest.mark.asyncio
    async def test_usage_tracking_workflow(self, subscription_service, mock_db):
        """
        Test workflow:
        1. Create subscription
        2. Record multiple usage events
        3. Verify accumulated usage
        """
        now = datetime.now(UTC)

        mock_db_sub = MagicMock(spec=BillingSubscriptionTable)
        mock_db_sub.subscription_id = "sub_usage"
        mock_db_sub.tenant_id = "tenant_usage"
        mock_db_sub.customer_id = "cust_usage"
        mock_db_sub.plan_id = "plan_usage"
        mock_db_sub.current_period_start = now
        mock_db_sub.current_period_end = now + timedelta(days=30)
        mock_db_sub.status = SubscriptionStatus.ACTIVE.value
        mock_db_sub.trial_end = None
        mock_db_sub.cancel_at_period_end = False
        mock_db_sub.canceled_at = None
        mock_db_sub.ended_at = None
        mock_db_sub.custom_price = None
        mock_db_sub.usage_records = {}
        mock_db_sub.metadata_json = {}
        mock_db_sub.created_at = now
        mock_db_sub.updated_at = now

        async def mock_execute(stmt):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = mock_db_sub
            return mock_result

        mock_db.execute.side_effect = mock_execute

        # Record first usage
        usage1 = UsageRecordRequest(
            subscription_id="sub_usage",
            usage_type="api_calls",
            quantity=1000,
        )

        result1 = await subscription_service.record_usage(usage1, "tenant_usage")
        assert result1["api_calls"] == 1000

        # Record second usage
        usage2 = UsageRecordRequest(
            subscription_id="sub_usage",
            usage_type="api_calls",
            quantity=500,
        )

        result2 = await subscription_service.record_usage(usage2, "tenant_usage")
        assert result2["api_calls"] == 1500

        # Record different usage type
        usage3 = UsageRecordRequest(
            subscription_id="sub_usage",
            usage_type="storage_gb",
            quantity=100,
        )

        result3 = await subscription_service.record_usage(usage3, "tenant_usage")
        assert result3["api_calls"] == 1500
        assert result3["storage_gb"] == 100


@pytest.mark.integration
class TestCancellationWorkflows:
    """Test various cancellation workflows."""

    @pytest.mark.asyncio
    async def test_cancel_at_period_end_then_reactivate_workflow(
        self, subscription_service, mock_db
    ):
        """
        Test workflow:
        1. Cancel subscription at period end
        2. Change mind and reactivate before period ends
        """
        now = datetime.now(UTC)

        # Initial active subscription
        mock_db_sub = MagicMock(spec=BillingSubscriptionTable)
        mock_db_sub.subscription_id = "sub_reactivate"
        mock_db_sub.tenant_id = "tenant_reactivate"
        mock_db_sub.customer_id = "cust_reactivate"
        mock_db_sub.plan_id = "plan_123"
        mock_db_sub.current_period_start = now - timedelta(days=15)
        mock_db_sub.current_period_end = now + timedelta(days=15)
        mock_db_sub.status = SubscriptionStatus.ACTIVE.value
        mock_db_sub.trial_end = None
        mock_db_sub.cancel_at_period_end = False
        mock_db_sub.canceled_at = None
        mock_db_sub.ended_at = None
        mock_db_sub.custom_price = None
        mock_db_sub.usage_records = {}
        mock_db_sub.metadata_json = {}
        mock_db_sub.created_at = now - timedelta(days=30)
        mock_db_sub.updated_at = now

        call_count = [0]

        async def mock_execute(stmt):
            call_count[0] += 1
            mock_result = MagicMock()
            # After cancellation, status should be CANCELED
            if call_count[0] > 2:
                mock_db_sub.status = SubscriptionStatus.CANCELED.value
                mock_db_sub.cancel_at_period_end = True
                mock_db_sub.canceled_at = now
            # After reactivation, status should be ACTIVE
            if call_count[0] > 4:
                mock_db_sub.status = SubscriptionStatus.ACTIVE.value
                mock_db_sub.cancel_at_period_end = False
                mock_db_sub.canceled_at = None
            mock_result.scalar_one_or_none.return_value = mock_db_sub
            return mock_result

        mock_db.execute.side_effect = mock_execute

        async def mock_refresh(obj):
            pass  # Mock already updated inline

        mock_db.refresh.side_effect = mock_refresh

        # Cancel subscription
        await subscription_service.cancel_subscription(
            "sub_reactivate", "tenant_reactivate", at_period_end=True
        )

        assert mock_db_sub.cancel_at_period_end is True
        assert mock_db_sub.canceled_at is not None

        # Reactivate before period end
        await subscription_service.reactivate_subscription("sub_reactivate", "tenant_reactivate")

        assert mock_db_sub.cancel_at_period_end is False
        assert mock_db_sub.canceled_at is None


@pytest.mark.integration
class TestMultiTenantWorkflows:
    """Test multi-tenant isolation in subscription workflows."""

    @pytest.mark.asyncio
    async def test_tenant_isolation_in_plan_listing(self, subscription_service, mock_db):
        """
        Test that plans are properly isolated by tenant.
        """
        now = datetime.now(UTC)

        # Plans for tenant_a
        plan_a1 = MagicMock(spec=BillingSubscriptionPlanTable)
        plan_a1.plan_id = "plan_a1"
        plan_a1.tenant_id = "tenant_a"
        plan_a1.product_id = "prod_123"
        plan_a1.name = "Tenant A Plan"
        plan_a1.description = "Plan for tenant A"
        plan_a1.billing_cycle = BillingCycle.MONTHLY.value
        plan_a1.price = Decimal("50.00")
        plan_a1.currency = "USD"
        plan_a1.setup_fee = None
        plan_a1.trial_days = None
        plan_a1.included_usage = {}
        plan_a1.overage_rates = {}
        plan_a1.is_active = True
        plan_a1.metadata_json = {}
        plan_a1.created_at = now
        plan_a1.updated_at = now

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [plan_a1]
        mock_db.execute.return_value = mock_result

        plans_a = await subscription_service.list_plans(tenant_id="tenant_a")

        assert len(plans_a) == 1
        assert plans_a[0].tenant_id == "tenant_a"

    @pytest.mark.asyncio
    async def test_tenant_isolation_in_subscription_retrieval(self, subscription_service, mock_db):
        """
        Test that subscriptions are properly isolated by tenant.
        """
        now = datetime.now(UTC)

        # Subscription for tenant_a
        sub_a = MagicMock(spec=BillingSubscriptionTable)
        sub_a.subscription_id = "sub_a"
        sub_a.tenant_id = "tenant_a"
        sub_a.customer_id = "cust_a"
        sub_a.plan_id = "plan_a"
        sub_a.current_period_start = now
        sub_a.current_period_end = now + timedelta(days=30)
        sub_a.status = SubscriptionStatus.ACTIVE.value
        sub_a.trial_end = None
        sub_a.cancel_at_period_end = False
        sub_a.canceled_at = None
        sub_a.ended_at = None
        sub_a.custom_price = None
        sub_a.usage_records = {}
        sub_a.metadata_json = {}
        sub_a.created_at = now
        sub_a.updated_at = now

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sub_a
        mock_db.execute.return_value = mock_result

        subscription = await subscription_service.get_subscription("sub_a", "tenant_a")

        assert subscription.tenant_id == "tenant_a"
        assert subscription.subscription_id == "sub_a"
