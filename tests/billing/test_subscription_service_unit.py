"""
Unit Tests for Subscription Service (Business Logic).

Strategy: Mock ALL dependencies (database, plan lookups, event creation)
Focus: Test business rules, validation, lifecycle management in isolation
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.exceptions import (
    PlanNotFoundError,
    SubscriptionError,
    SubscriptionNotFoundError,
)
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    ProrationBehavior,
    ProrationResult,
    Subscription,
    SubscriptionCreateRequest,
    SubscriptionPlan,
    SubscriptionPlanChangeRequest,
    SubscriptionPlanCreateRequest,
    SubscriptionStatus,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService


@pytest.mark.unit
class TestSubscriptionPlanManagement:
    """Test subscription plan CRUD operations."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        db = AsyncMock(spec=AsyncSession)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()
        return db

    @pytest.fixture
    def subscription_service(self, mock_db):
        """Create subscription service with mocked DB."""
        return SubscriptionService(db_session=mock_db)


def _make_db_subscription_stub(subscription: Subscription) -> SimpleNamespace:
    """Create a lightweight stub representing a DB row for subscription."""

    return SimpleNamespace(
        subscription_id=subscription.subscription_id,
        tenant_id=subscription.tenant_id,
        customer_id=subscription.customer_id,
        plan_id=subscription.plan_id,
        status=subscription.status.value,
        cancel_at_period_end=subscription.cancel_at_period_end,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        trial_end=subscription.trial_end,
        canceled_at=subscription.canceled_at,
        ended_at=subscription.ended_at,
        custom_price=subscription.custom_price,
        usage_records=subscription.usage_records,
        metadata_json=subscription.metadata,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at,
    )

    @pytest.fixture
    def basic_plan_request(self):
        """Create basic plan request."""
        return SubscriptionPlanCreateRequest(
            product_id="prod_123",
            name="Basic Plan",
            description="Basic subscription plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=14,
            included_usage={},
            overage_rates={},
            metadata={},
        )

    async def test_create_plan_success(self, subscription_service, mock_db, basic_plan_request):
        """Test successful plan creation."""
        await subscription_service.create_plan(plan_data=basic_plan_request, tenant_id="tenant-1")

        # Verify plan was added to DB
        assert mock_db.add.called
        assert mock_db.commit.called

        # Verify plan has generated ID
        added_plan = mock_db.add.call_args[0][0]
        assert added_plan.plan_id.startswith("plan_")
        assert added_plan.tenant_id == "tenant-1"
        assert added_plan.name == "Basic Plan"
        assert added_plan.price == Decimal("29.99")

    async def test_get_plan_not_found(self, subscription_service):
        """Test error when plan doesn't exist."""
        with patch.object(
            subscription_service.db,
            "execute",
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ):
            with pytest.raises(PlanNotFoundError) as exc:
                await subscription_service.get_plan("plan_invalid", "tenant-1")

            assert "not found" in str(exc.value).lower()

    async def test_list_plans_filtering(self, subscription_service):
        """Test plan listing with filters."""
        with patch.object(
            subscription_service.db,
            "execute",
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            ),
        ):
            plans = await subscription_service.list_plans(
                tenant_id="tenant-1",
                product_id="prod_123",
                billing_cycle=BillingCycle.MONTHLY,
                active_only=True,
            )

            assert isinstance(plans, list)


@pytest.mark.unit
class TestSubscriptionLifecycle:
    """Test subscription creation and lifecycle."""

    @pytest.fixture
    def subscription_service(self):
        """Create subscription service."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        mock_db.add = MagicMock()
        return SubscriptionService(db_session=mock_db), mock_db

    @pytest.fixture
    def active_plan(self):
        """Create active subscription plan."""
        return SubscriptionPlan(
            plan_id="plan_123",
            tenant_id="tenant-1",
            product_id="prod_123",
            name="Monthly Plan",
            description="Monthly subscription",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=14,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    @pytest.fixture
    def subscription_request(self):
        """Create subscription request."""
        return SubscriptionCreateRequest(
            customer_id="cust_123",
            plan_id="plan_123",
            start_date=None,  # Use now
            trial_end_override=None,
            custom_price=None,
            metadata={},
        )

    async def test_create_subscription_with_trial(
        self, subscription_service, active_plan, subscription_request
    ):
        """Test subscription creation with trial period."""
        service, mock_db = subscription_service

        with patch.object(service, "get_plan", return_value=active_plan):
            with patch.object(service, "_create_event", return_value=None):
                await service.create_subscription(
                    subscription_data=subscription_request, tenant_id="tenant-1"
                )

                # Verify subscription was added
                assert mock_db.add.called
                added_sub = mock_db.add.call_args[0][0]

                # Should be in TRIALING status (plan has 14 day trial)
                assert added_sub.status == SubscriptionStatus.TRIALING.value

                # Trial end should be set
                assert added_sub.trial_end is not None

    async def test_create_subscription_no_trial(
        self, subscription_service, active_plan, subscription_request
    ):
        """Test subscription creation without trial period."""
        service, mock_db = subscription_service

        # Remove trial from plan
        active_plan.trial_days = 0

        with patch.object(service, "get_plan", return_value=active_plan):
            with patch.object(service, "_create_event", return_value=None):
                await service.create_subscription(
                    subscription_data=subscription_request, tenant_id="tenant-1"
                )

                added_sub = mock_db.add.call_args[0][0]

                # Should be ACTIVE (no trial)
                assert added_sub.status == SubscriptionStatus.ACTIVE.value
                assert added_sub.trial_end is None

    async def test_get_subscription_not_found(self, subscription_service):
        """Test error when subscription doesn't exist."""
        service, _ = subscription_service

        with patch.object(
            service.db,
            "execute",
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ):
            with pytest.raises(SubscriptionNotFoundError):
                await service.get_subscription("sub_invalid", "tenant-1")


@pytest.mark.unit
class TestSubscriptionPlanChange:
    """Test subscription plan change with proration."""

    @pytest.fixture
    def subscription_service(self):
        """Create subscription service."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        return SubscriptionService(db_session=mock_db), mock_db

    @pytest.fixture
    def active_subscription(self):
        """Create active subscription."""
        now = datetime.now(UTC)
        return Subscription(
            subscription_id="sub_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            plan_id="plan_old",
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

    @pytest.fixture
    def old_plan(self):
        """Old subscription plan."""
        return SubscriptionPlan(
            plan_id="plan_old",
            tenant_id="tenant-1",
            product_id="prod_123",
            name="Old Plan",
            description="Old plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=0,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    @pytest.fixture
    def new_plan(self):
        """New subscription plan."""
        return SubscriptionPlan(
            plan_id="plan_new",
            tenant_id="tenant-1",
            product_id="prod_123",
            name="New Plan",
            description="New plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=0,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def test_change_plan_with_proration(
        self, subscription_service, active_subscription, old_plan, new_plan
    ):
        """Test plan change with proration calculation."""
        service, mock_db = subscription_service

        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_new",
            proration_behavior=ProrationBehavior.CREATE_PRORATIONS,
            effective_date=None,
        )

        db_stub = _make_db_subscription_stub(active_subscription)
        mock_db.execute = AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: db_stub)
        )

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with patch.object(service, "get_plan") as mock_get_plan:
                mock_get_plan.side_effect = [old_plan, new_plan]
                with patch.object(service, "_create_event", return_value=None):
                    updated_sub, proration_result = await service.change_plan(
                        subscription_id="sub_123",
                        change_request=change_request,
                        tenant_id="tenant-1",
                    )

                    # Should have proration result
                    assert proration_result is not None
                    assert isinstance(proration_result, ProrationResult)

                    # DB should be updated
                    assert mock_db.commit.called

    async def test_change_plan_to_same_plan_error(
        self, subscription_service, active_subscription, old_plan
    ):
        """Test error when changing to the same plan."""
        service, _ = subscription_service

        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_old",  # Same as current plan
            proration_behavior=ProrationBehavior.CREATE_PRORATIONS,
        )

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with patch.object(service, "get_plan", return_value=old_plan):
                with pytest.raises(SubscriptionError) as exc:
                    await service.change_plan(
                        subscription_id="sub_123",
                        change_request=change_request,
                        tenant_id="tenant-1",
                    )

                assert "already on the requested plan" in str(exc.value).lower()

    async def test_change_plan_inactive_subscription_error(
        self, subscription_service, active_subscription, old_plan, new_plan
    ):
        """Test error when changing plan for inactive subscription."""
        service, _ = subscription_service

        # Make subscription inactive
        active_subscription.status = SubscriptionStatus.ENDED

        change_request = SubscriptionPlanChangeRequest(
            new_plan_id="plan_new",
            proration_behavior=ProrationBehavior.CREATE_PRORATIONS,
        )

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with patch.object(service, "get_plan") as mock_get_plan:
                mock_get_plan.side_effect = [old_plan, new_plan]

                with pytest.raises(SubscriptionError) as exc:
                    await service.change_plan(
                        subscription_id="sub_123",
                        change_request=change_request,
                        tenant_id="tenant-1",
                    )

                assert "inactive" in str(exc.value).lower()


@pytest.mark.unit
class TestSubscriptionCancellation:
    """Test subscription cancellation logic."""

    @pytest.fixture
    def subscription_service(self):
        """Create subscription service."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        return SubscriptionService(db_session=mock_db), mock_db

    @pytest.fixture
    def active_subscription(self):
        """Create active subscription."""
        now = datetime.now(UTC)
        return Subscription(
            subscription_id="sub_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            plan_id="plan_123",
            current_period_start=now - timedelta(days=10),
            current_period_end=now + timedelta(days=20),
            status=SubscriptionStatus.ACTIVE,
            trial_end=None,
            cancel_at_period_end=False,
            canceled_at=None,
            ended_at=None,
            custom_price=None,
            usage_records={},
            metadata={},
            created_at=now - timedelta(days=10),
            updated_at=now,
        )

    async def test_cancel_subscription_at_period_end(
        self, subscription_service, active_subscription
    ):
        """Test cancel subscription at period end (default behavior)."""
        service, mock_db = subscription_service

        db_subscription_row = _make_db_subscription_stub(active_subscription)
        mock_db.execute = AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: db_subscription_row)
        )

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with patch.object(service, "_create_event", return_value=None):
                await service.cancel_subscription(
                    subscription_id="sub_123",
                    tenant_id="tenant-1",
                    at_period_end=True,
                )

                # Should be marked for cancellation at period end
                assert db_subscription_row.cancel_at_period_end is True
                # Status should remain ACTIVE when canceling at period end (not CANCELED)
                assert db_subscription_row.status == SubscriptionStatus.ACTIVE.value
                assert db_subscription_row.canceled_at is not None
                assert db_subscription_row.ended_at is None  # Not ended yet

    async def test_cancel_subscription_immediately(self, subscription_service, active_subscription):
        """Test immediate subscription cancellation."""
        service, mock_db = subscription_service

        db_subscription_row = _make_db_subscription_stub(active_subscription)
        mock_db.execute = AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: db_subscription_row)
        )

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with patch.object(service, "_create_event", return_value=None):
                await service.cancel_subscription(
                    subscription_id="sub_123",
                    tenant_id="tenant-1",
                    at_period_end=False,  # Immediate
                )

                # Should be ended immediately
                assert db_subscription_row.status == SubscriptionStatus.ENDED.value
                assert db_subscription_row.ended_at is not None
                assert db_subscription_row.canceled_at is not None

    async def test_cancel_inactive_subscription_error(
        self, subscription_service, active_subscription
    ):
        """Test error when canceling inactive subscription."""
        service, _ = subscription_service

        # Make subscription inactive
        active_subscription.status = SubscriptionStatus.ENDED

        with patch.object(service, "get_subscription", return_value=active_subscription):
            with pytest.raises(SubscriptionError) as exc:
                await service.cancel_subscription(
                    subscription_id="sub_123",
                    tenant_id="tenant-1",
                )

            # Error message says which status it's in and which statuses are allowed
            assert (
                "ended status" in str(exc.value).lower() or "only active" in str(exc.value).lower()
            )


@pytest.mark.unit
class TestSubscriptionReactivation:
    """Test subscription reactivation logic."""

    @pytest.fixture
    def subscription_service(self):
        """Create subscription service."""
        mock_db = AsyncMock(spec=AsyncSession)
        mock_db.commit = AsyncMock()
        mock_db.refresh = AsyncMock()
        return SubscriptionService(db_session=mock_db), mock_db

    @pytest.fixture
    def canceled_subscription(self):
        """Create canceled subscription."""
        now = datetime.now(UTC)
        return Subscription(
            subscription_id="sub_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            plan_id="plan_123",
            current_period_start=now - timedelta(days=10),
            current_period_end=now + timedelta(days=20),  # Still in period
            status=SubscriptionStatus.CANCELED,
            trial_end=None,
            cancel_at_period_end=True,
            canceled_at=now - timedelta(days=1),
            ended_at=None,
            custom_price=None,
            usage_records={},
            metadata={},
            created_at=now - timedelta(days=10),
            updated_at=now,
        )

    async def test_reactivate_subscription_success(
        self, subscription_service, canceled_subscription
    ):
        """Test successful reactivation of canceled subscription."""
        service, mock_db = subscription_service

        db_subscription_row = _make_db_subscription_stub(canceled_subscription)
        mock_db.execute = AsyncMock(
            return_value=SimpleNamespace(scalar_one_or_none=lambda: db_subscription_row)
        )

        with patch.object(service, "get_subscription", return_value=canceled_subscription):
            with patch.object(service, "_create_event", return_value=None):
                await service.reactivate_subscription(
                    subscription_id="sub_123", tenant_id="tenant-1"
                )

                # Should be reactivated
                assert db_subscription_row.status == SubscriptionStatus.ACTIVE.value
                assert db_subscription_row.cancel_at_period_end is False
                assert db_subscription_row.canceled_at is None

    async def test_reactivate_non_canceled_subscription_error(
        self, subscription_service, canceled_subscription
    ):
        """Test error when reactivating non-canceled subscription."""
        service, _ = subscription_service

        # Make subscription active (not canceled) and not pending cancellation
        canceled_subscription.status = SubscriptionStatus.ACTIVE
        canceled_subscription.cancel_at_period_end = False  # Not pending cancellation

        with patch.object(service, "get_subscription", return_value=canceled_subscription):
            with pytest.raises(SubscriptionError) as exc:
                await service.reactivate_subscription(
                    subscription_id="sub_123", tenant_id="tenant-1"
                )

            # Error message should indicate only canceled or pending cancellation can be reactivated
            assert (
                "pending cancellation" in str(exc.value).lower()
                or "already canceled" in str(exc.value).lower()
            )

    async def test_reactivate_after_period_end_error(
        self, subscription_service, canceled_subscription
    ):
        """Test error when reactivating after period end."""
        service, _ = subscription_service

        # Set period end in the past
        canceled_subscription.current_period_end = datetime.now(UTC) - timedelta(days=1)

        with patch.object(service, "get_subscription", return_value=canceled_subscription):
            with pytest.raises(SubscriptionError) as exc:
                await service.reactivate_subscription(
                    subscription_id="sub_123", tenant_id="tenant-1"
                )

            assert "after period end" in str(exc.value).lower()


@pytest.mark.unit
class TestProrationCalculation:
    """Test proration calculation logic."""

    @pytest.fixture
    def subscription_service(self):
        """Create subscription service."""
        mock_db = AsyncMock(spec=AsyncSession)
        return SubscriptionService(db_session=mock_db)

    @pytest.fixture
    def subscription_mid_period(self):
        """Subscription at mid-period (15 days remaining out of 30)."""
        now = datetime.now(UTC)
        return Subscription(
            subscription_id="sub_123",
            tenant_id="tenant-1",
            customer_id="cust_123",
            plan_id="plan_old",
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

    @pytest.fixture
    def plan_30(self):
        """$30 plan."""
        return SubscriptionPlan(
            plan_id="plan_30",
            tenant_id="tenant-1",
            product_id="prod_123",
            name="$30 Plan",
            description="$30 plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("30.00"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=0,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    @pytest.fixture
    def plan_50(self):
        """$50 plan."""
        return SubscriptionPlan(
            plan_id="plan_50",
            tenant_id="tenant-1",
            product_id="prod_123",
            name="$50 Plan",
            description="$50 plan",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("50.00"),
            currency="usd",
            setup_fee=Decimal("0"),
            trial_days=0,
            included_usage={},
            overage_rates={},
            is_active=True,
            metadata={},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    def test_proration_upgrade(
        self, subscription_service, subscription_mid_period, plan_30, plan_50
    ):
        """Test proration for plan upgrade (customer owes money)."""
        proration_result = subscription_service._calculate_proration(
            subscription_mid_period, plan_30, plan_50
        )

        # With 50% of period remaining:
        # - Old plan unused: $30 * 0.5 = $15
        # - New plan prorated: $50 * 0.5 = $25
        # - Net proration: $25 - $15 = $10 (customer owes)

        assert proration_result.proration_amount > Decimal("0")  # Customer owes money
        assert proration_result.days_remaining > 0
        assert proration_result.old_plan_unused_amount > Decimal("0")
        assert proration_result.new_plan_prorated_amount > Decimal("0")

    def test_proration_downgrade(
        self, subscription_service, subscription_mid_period, plan_50, plan_30
    ):
        """Test proration for plan downgrade (customer gets credit)."""
        proration_result = subscription_service._calculate_proration(
            subscription_mid_period, plan_50, plan_30
        )

        # With 50% of period remaining:
        # - Old plan unused: $50 * 0.5 = $25
        # - New plan prorated: $30 * 0.5 = $15
        # - Net proration: $15 - $25 = -$10 (customer gets credit)

        assert proration_result.proration_amount < Decimal("0")  # Customer gets credit
        assert proration_result.days_remaining > 0
