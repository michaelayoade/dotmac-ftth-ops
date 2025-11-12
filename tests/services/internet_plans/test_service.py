"""
Unit tests for Internet Service Plan Service Layer

Tests the business logic for managing internet service plans and subscriptions.
"""

from datetime import datetime, time
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.services.internet_plans.models import (
    BillingCycle,
    DataUnit,
    InternetServicePlan,
    PlanStatus,
    PlanSubscription,
    PlanType,
    SpeedUnit,
    ThrottlePolicy,
)
from dotmac.platform.services.internet_plans.schemas import (
    InternetServicePlanCreate,
    InternetServicePlanUpdate,
    PlanSubscriptionCreate,
    PlanValidationRequest,
    UsageUpdateRequest,
)
from dotmac.platform.services.internet_plans.service import InternetPlanService
from dotmac.platform.subscribers.models import Subscriber
from dotmac.platform.tenant.models import BillingCycle as TenantBillingCycle
from dotmac.platform.tenant.models import Tenant, TenantPlanType, TenantStatus


@pytest_asyncio.fixture
async def test_tenant(async_session: AsyncSession) -> Tenant:
    """Create a tenant record for internet plan tests."""
    tenant_id = str(uuid4())

    tenant = Tenant(
        id=tenant_id,
        name="Internet Plans Test Tenant",
        slug=f"internet-plans-{uuid4().hex[:8]}",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=TenantBillingCycle.MONTHLY,
        email="internet-plans-test@example.com",
    )

    async_session.add(tenant)
    await async_session.flush()
    return tenant


@pytest.fixture
def tenant_id(test_tenant):
    """Get tenant ID from test_tenant fixture."""
    return UUID(test_tenant.id)


@pytest.fixture
def customer_id():
    """Create a test customer ID."""
    return uuid4()


@pytest_asyncio.fixture
async def test_subscriber(async_session: AsyncSession, test_tenant, customer_id: UUID):
    """Create a test subscriber for subscription tests."""
    # Create customer
    customer = Customer(
        id=customer_id,
        tenant_id=test_tenant.id,
        customer_number=f"CUST-{str(customer_id)[:8]}",
        email="test@example.com",
        first_name="Test",
        last_name="User",
    )
    async_session.add(customer)

    # Create subscriber
    subscriber_id = f"test-subscriber-{uuid4().hex[:8]}"
    subscriber = Subscriber(
        id=subscriber_id,
        tenant_id=test_tenant.id,
        customer_id=customer_id,
        username=subscriber_id,
        password="test-password-hash",
        service_type="fiber_internet",
    )
    async_session.add(subscriber)
    await async_session.flush()  # Use flush instead of commit to work with nested transactions
    return subscriber


@pytest_asyncio.fixture
async def service(async_session: AsyncSession, tenant_id: UUID):
    """Create service instance for testing."""
    return InternetPlanService(session=async_session, tenant_id=tenant_id)


@pytest.fixture
def plan_create_data():
    """Create basic plan creation data."""
    return InternetServicePlanCreate(
        plan_code="TEST-100",
        name="Test 100Mbps",
        description="Test plan",
        plan_type=PlanType.RESIDENTIAL,
        status=PlanStatus.ACTIVE,
        download_speed=Decimal("100"),
        upload_speed=Decimal("50"),
        speed_unit=SpeedUnit.MBPS,
        has_data_cap=False,
        throttle_policy=ThrottlePolicy.NO_THROTTLE,
        has_fup=False,
        has_time_restrictions=False,
        qos_priority=50,
        traffic_shaping_enabled=False,
        monthly_price=Decimal("50.00"),
        setup_fee=Decimal("25.00"),
        currency="USD",
        billing_cycle=BillingCycle.MONTHLY,
        is_public=True,
        is_promotional=False,
        minimum_contract_months=12,
        early_termination_fee=Decimal("100.00"),
        contention_ratio="1:20",
        ipv4_included=True,
        ipv6_included=True,
        static_ip_included=False,
        static_ip_count=0,
        router_included=False,
        installation_included=False,
        technical_support_level="basic",
        tags={},
        features=[],
        restrictions=[],
    )


@pytest.mark.integration
class TestInternetPlanServiceCreate:
    """Test plan creation."""

    @pytest.mark.asyncio
    async def test_create_plan_success(self, service, plan_create_data):
        """Test successful plan creation."""
        result = await service.create_plan(plan_create_data)

        assert result is not None
        assert result.plan_code == "TEST-100"
        assert result.name == "Test 100Mbps"
        assert result.download_speed == Decimal("100")
        assert result.upload_speed == Decimal("50")
        assert result.monthly_price == Decimal("50.00")
        assert isinstance(result.id, UUID)

    @pytest.mark.asyncio
    async def test_create_plan_with_data_cap(self, service, plan_create_data):
        """Test creating plan with data cap."""
        plan_create_data.has_data_cap = True
        plan_create_data.data_cap_amount = Decimal("500")
        plan_create_data.data_cap_unit = DataUnit.GB
        plan_create_data.throttle_policy = ThrottlePolicy.THROTTLE
        plan_create_data.throttled_download_speed = Decimal("10")
        plan_create_data.throttled_upload_speed = Decimal("5")

        result = await service.create_plan(plan_create_data)

        assert result.has_data_cap
        assert result.data_cap_amount == Decimal("500")
        assert result.data_cap_unit == DataUnit.GB
        assert result.throttle_policy == ThrottlePolicy.THROTTLE

    @pytest.mark.asyncio
    async def test_create_plan_with_burst_speed(self, service, plan_create_data):
        """Test creating plan with burst speeds."""
        plan_create_data.burst_download_speed = Decimal("200")
        plan_create_data.burst_upload_speed = Decimal("100")
        plan_create_data.burst_duration_seconds = 60

        result = await service.create_plan(plan_create_data)

        assert result.burst_download_speed == Decimal("200")
        assert result.burst_upload_speed == Decimal("100")
        assert result.burst_duration_seconds == 60

    @pytest.mark.asyncio
    async def test_create_plan_with_time_restrictions(self, service, plan_create_data):
        """Test creating plan with time-based restrictions."""
        plan_create_data.has_time_restrictions = True
        plan_create_data.unrestricted_start_time = time(22, 0)
        plan_create_data.unrestricted_end_time = time(6, 0)
        plan_create_data.unrestricted_data_unlimited = True

        result = await service.create_plan(plan_create_data)

        assert result.has_time_restrictions
        assert result.unrestricted_start_time == time(22, 0)
        assert result.unrestricted_end_time == time(6, 0)
        assert result.unrestricted_data_unlimited


@pytest.mark.integration
class TestInternetPlanServiceRetrieve:
    """Test plan retrieval."""

    @pytest.mark.asyncio
    async def test_get_plan_by_id(self, service, plan_create_data):
        """Test retrieving plan by ID."""
        created = await service.create_plan(plan_create_data)
        result = await service.get_plan(created.id)

        assert result is not None
        assert result.id == created.id
        assert result.plan_code == created.plan_code

    @pytest.mark.asyncio
    async def test_get_plan_not_found(self, service):
        """Test retrieving non-existent plan returns None."""
        result = await service.get_plan(uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_get_plan_by_code(self, service, plan_create_data):
        """Test retrieving plan by code."""
        await service.create_plan(plan_create_data)
        result = await service.get_plan_by_code("TEST-100")

        assert result is not None
        assert result.plan_code == "TEST-100"

    @pytest.mark.asyncio
    async def test_get_plan_by_code_case_insensitive(self, service, plan_create_data):
        """Test plan code lookup is case-insensitive."""
        await service.create_plan(plan_create_data)
        result = await service.get_plan_by_code("test-100")

        assert result is not None
        assert result.plan_code == "TEST-100"

    @pytest.mark.asyncio
    async def test_get_plan_by_code_not_found(self, service):
        """Test retrieving plan by non-existent code returns None."""
        result = await service.get_plan_by_code("NONEXISTENT")
        assert result is None


@pytest.mark.integration
class TestInternetPlanServiceList:
    """Test plan listing and filtering."""

    @pytest.mark.asyncio
    async def test_list_plans_empty(self, service):
        """Test listing plans when none exist."""
        result = await service.list_plans()
        assert result == []

    @pytest.mark.asyncio
    async def test_list_plans_multiple(self, service, plan_create_data):
        """Test listing multiple plans."""
        # Create 3 plans
        plan1 = plan_create_data.model_copy()
        plan1.plan_code = "PLAN-1"
        plan1.name = "Plan 1"
        await service.create_plan(plan1)

        plan2 = plan_create_data.model_copy()
        plan2.plan_code = "PLAN-2"
        plan2.name = "Plan 2"
        await service.create_plan(plan2)

        plan3 = plan_create_data.model_copy()
        plan3.plan_code = "PLAN-3"
        plan3.name = "Plan 3"
        await service.create_plan(plan3)

        result = await service.list_plans()
        assert len(result) == 3

    @pytest.mark.asyncio
    async def test_list_plans_filter_by_type(self, service, plan_create_data):
        """Test filtering plans by type."""
        # Create residential plan
        res_plan = plan_create_data.model_copy()
        res_plan.plan_code = "RES-1"
        res_plan.plan_type = PlanType.RESIDENTIAL
        await service.create_plan(res_plan)

        # Create business plan
        biz_plan = plan_create_data.model_copy()
        biz_plan.plan_code = "BIZ-1"
        biz_plan.plan_type = PlanType.BUSINESS
        await service.create_plan(biz_plan)

        result = await service.list_plans(plan_type=PlanType.BUSINESS)
        assert len(result) == 1
        assert result[0].plan_type == PlanType.BUSINESS

    @pytest.mark.asyncio
    async def test_list_plans_filter_by_status(self, service, plan_create_data):
        """Test filtering plans by status."""
        # Create active plan
        active_plan = plan_create_data.model_copy()
        active_plan.plan_code = "ACTIVE-1"
        active_plan.status = PlanStatus.ACTIVE
        await service.create_plan(active_plan)

        # Create draft plan
        draft_plan = plan_create_data.model_copy()
        draft_plan.plan_code = "DRAFT-1"
        draft_plan.status = PlanStatus.DRAFT
        await service.create_plan(draft_plan)

        result = await service.list_plans(status=PlanStatus.ACTIVE)
        assert len(result) == 1
        assert result[0].status == PlanStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_list_plans_filter_by_public(self, service, plan_create_data):
        """Test filtering plans by public visibility."""
        # Create public plan
        public_plan = plan_create_data.model_copy()
        public_plan.plan_code = "PUBLIC-1"
        public_plan.is_public = True
        await service.create_plan(public_plan)

        # Create private plan
        private_plan = plan_create_data.model_copy()
        private_plan.plan_code = "PRIVATE-1"
        private_plan.is_public = False
        await service.create_plan(private_plan)

        result = await service.list_plans(is_public=True)
        assert len(result) == 1
        assert result[0].is_public

    @pytest.mark.asyncio
    async def test_list_plans_search_by_name(self, service, plan_create_data):
        """Test searching plans by name."""
        plan1 = plan_create_data.model_copy()
        plan1.plan_code = "PLAN-1"
        plan1.name = "Premium Fast Internet"
        await service.create_plan(plan1)

        plan2 = plan_create_data.model_copy()
        plan2.plan_code = "PLAN-2"
        plan2.name = "Basic Slow Internet"
        await service.create_plan(plan2)

        result = await service.list_plans(search="Premium")
        assert len(result) == 1
        assert "Premium" in result[0].name

    @pytest.mark.asyncio
    async def test_list_plans_pagination(self, service, plan_create_data):
        """Test plan listing pagination."""
        # Create 5 plans
        for i in range(5):
            plan = plan_create_data.model_copy()
            plan.plan_code = f"PLAN-{i}"
            await service.create_plan(plan)

        # Get first 3
        result = await service.list_plans(limit=3, offset=0)
        assert len(result) == 3

        # Get next 2
        result = await service.list_plans(limit=3, offset=3)
        assert len(result) == 2


@pytest.mark.integration
class TestInternetPlanServiceUpdate:
    """Test plan updates."""

    @pytest.mark.asyncio
    async def test_update_plan_success(self, service, plan_create_data):
        """Test successful plan update."""
        created = await service.create_plan(plan_create_data)

        update_data = InternetServicePlanUpdate(
            name="Updated Plan Name",
            monthly_price=Decimal("75.00"),
        )

        result = await service.update_plan(created.id, update_data)

        assert result is not None
        assert result.name == "Updated Plan Name"
        assert result.monthly_price == Decimal("75.00")
        # Other fields should remain unchanged
        assert result.plan_code == created.plan_code

    @pytest.mark.asyncio
    async def test_update_plan_not_found(self, service):
        """Test updating non-existent plan returns None."""
        update_data = InternetServicePlanUpdate(name="New Name")
        result = await service.update_plan(uuid4(), update_data)
        assert result is None

    @pytest.mark.asyncio
    async def test_update_plan_partial(self, service, plan_create_data):
        """Test partial plan update."""
        created = await service.create_plan(plan_create_data)

        update_data = InternetServicePlanUpdate(qos_priority=80)
        result = await service.update_plan(created.id, update_data)

        assert result is not None
        assert result.qos_priority == 80
        assert result.name == created.name  # Unchanged


@pytest.mark.integration
class TestInternetPlanServiceDelete:
    """Test plan deletion (archival)."""

    @pytest.mark.asyncio
    async def test_delete_plan_success(self, service, plan_create_data):
        """Test successful plan deletion."""
        created = await service.create_plan(plan_create_data)
        result = await service.delete_plan(created.id)

        assert result is True

        # Verify plan is archived
        plan = await service.get_plan(created.id)
        assert plan.status == PlanStatus.ARCHIVED

    @pytest.mark.asyncio
    async def test_delete_plan_not_found(self, service):
        """Test deleting non-existent plan returns False."""
        result = await service.delete_plan(uuid4())
        assert result is False

    @pytest.mark.asyncio
    async def test_delete_plan_with_active_subscriptions_fails(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test cannot delete plan with active subscriptions."""
        # Create plan
        plan = await service.create_plan(plan_create_data)

        # Create active subscription
        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        await service.create_subscription(subscription_data)

        # Try to delete plan
        result = await service.delete_plan(plan.id)
        assert result is False

        # Plan should not be archived
        plan_check = await service.get_plan(plan.id)
        assert plan_check.status != PlanStatus.ARCHIVED


@pytest.mark.integration
class TestInternetPlanServiceValidation:
    """Test plan validation."""

    @pytest.mark.asyncio
    async def test_validate_plan_success(self, service, plan_create_data):
        """Test plan validation."""
        plan = await service.create_plan(plan_create_data)

        validation_request = PlanValidationRequest(
            validate_speeds=True,
            validate_data_caps=True,
            validate_pricing=True,
            validate_time_restrictions=True,
            validate_qos=True,
        )

        result = await service.validate_plan(plan.id, validation_request)

        assert result is not None
        assert result.plan_id == plan.id
        assert result.plan_code == plan.plan_code
        assert result.overall_status in ["passed", "info", "warning"]
        assert result.validated_at is not None

    @pytest.mark.asyncio
    async def test_validate_plan_updates_plan_status(
        self, service, plan_create_data, async_session
    ):
        """Test validation updates plan validation status."""
        plan = await service.create_plan(plan_create_data)

        validation_request = PlanValidationRequest(validate_speeds=True)
        await service.validate_plan(plan.id, validation_request)

        # Check plan was updated
        stmt = select(InternetServicePlan).where(InternetServicePlan.id == plan.id)
        result = await async_session.execute(stmt)
        updated_plan = result.scalar_one()

        assert updated_plan.last_validated_at is not None
        assert updated_plan.validation_status is not None

    @pytest.mark.asyncio
    async def test_validate_plan_not_found(self, service):
        """Test validating non-existent plan returns None."""
        validation_request = PlanValidationRequest()
        result = await service.validate_plan(uuid4(), validation_request)
        assert result is None


@pytest.mark.integration
class TestInternetPlanServiceComparison:
    """Test plan comparison."""

    @pytest.mark.asyncio
    async def test_compare_plans(self, service, plan_create_data):
        """Test comparing multiple plans."""
        # Create 3 different plans
        plan1 = plan_create_data.model_copy()
        plan1.plan_code = "BASIC-50"
        plan1.name = "Basic 50Mbps"
        plan1.download_speed = Decimal("50")
        plan1.monthly_price = Decimal("30.00")
        p1 = await service.create_plan(plan1)

        plan2 = plan_create_data.model_copy()
        plan2.plan_code = "STANDARD-100"
        plan2.name = "Standard 100Mbps"
        plan2.download_speed = Decimal("100")
        plan2.monthly_price = Decimal("50.00")
        p2 = await service.create_plan(plan2)

        plan3 = plan_create_data.model_copy()
        plan3.plan_code = "PREMIUM-500"
        plan3.name = "Premium 500Mbps"
        plan3.download_speed = Decimal("500")
        plan3.monthly_price = Decimal("100.00")
        p3 = await service.create_plan(plan3)

        # Compare plans
        result = await service.compare_plans([p1.id, p2.id, p3.id])

        assert len(result.plans) == 3
        assert "Download Speed" in result.comparison_matrix
        assert len(result.recommendations) > 0
        # Should recommend highest speed
        assert "Premium 500Mbps" in result.recommendations[0]

    @pytest.mark.asyncio
    async def test_compare_plans_best_value(self, service, plan_create_data):
        """Test comparison identifies best value plan."""
        # Create plan with best price/performance ratio
        plan1 = plan_create_data.model_copy()
        plan1.plan_code = "VALUE-100"
        plan1.download_speed = Decimal("100")
        plan1.monthly_price = Decimal("40.00")  # Best value: 2.5 Mbps/$
        p1 = await service.create_plan(plan1)

        plan2 = plan_create_data.model_copy()
        plan2.plan_code = "EXPENSIVE-50"
        plan2.download_speed = Decimal("50")
        plan2.monthly_price = Decimal("50.00")  # Poor value: 1 Mbps/$
        p2 = await service.create_plan(plan2)

        result = await service.compare_plans([p1.id, p2.id])

        # Should recommend best value
        assert any("Best value" in r for r in result.recommendations)


@pytest.mark.integration
class TestInternetPlanServiceSubscriptions:
    """Test subscription management."""

    @pytest.mark.asyncio
    async def test_create_subscription(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test creating subscription."""
        plan = await service.create_plan(plan_create_data)

        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )

        result = await service.create_subscription(subscription_data)

        assert result is not None
        assert result.plan_id == plan.id
        assert result.customer_id == customer_id
        assert result.is_active
        assert result.current_period_usage_gb == Decimal("0.00")

    @pytest.mark.asyncio
    async def test_create_subscription_with_custom_speeds(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test creating subscription with custom speeds."""
        plan = await service.create_plan(plan_create_data)

        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
            custom_download_speed=Decimal("200"),
            custom_upload_speed=Decimal("100"),
        )

        result = await service.create_subscription(subscription_data)

        assert result.custom_download_speed == Decimal("200")
        assert result.custom_upload_speed == Decimal("100")

    @pytest.mark.asyncio
    async def test_get_subscription(self, service, plan_create_data, customer_id, test_subscriber):
        """Test retrieving subscription."""
        plan = await service.create_plan(plan_create_data)
        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        created = await service.create_subscription(subscription_data)

        result = await service.get_subscription(created.id)

        assert result is not None
        assert result.id == created.id

    @pytest.mark.asyncio
    async def test_get_subscription_not_found(self, service):
        """Test retrieving non-existent subscription returns None."""
        result = await service.get_subscription(uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_list_subscriptions_by_plan(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test listing subscriptions by plan."""
        plan = await service.create_plan(plan_create_data)

        # Create 2 subscriptions for same plan
        for _i in range(2):
            sub_data = PlanSubscriptionCreate(
                plan_id=plan.id,
                customer_id=customer_id,
                start_date=datetime.utcnow(),
                subscriber_id=test_subscriber.id,
            )
            await service.create_subscription(sub_data)

        result = await service.list_subscriptions(plan_id=plan.id)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_subscriptions_by_customer(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test listing subscriptions by customer."""
        plan1 = await service.create_plan(plan_create_data)

        plan2_data = plan_create_data.model_copy()
        plan2_data.plan_code = "PLAN-2"
        plan2 = await service.create_plan(plan2_data)

        # Create 2 subscriptions for same customer
        for plan in [plan1, plan2]:
            sub_data = PlanSubscriptionCreate(
                plan_id=plan.id,
                customer_id=customer_id,
                start_date=datetime.utcnow(),
                subscriber_id=test_subscriber.id,
            )
            await service.create_subscription(sub_data)

        result = await service.list_subscriptions(customer_id=customer_id)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_list_subscriptions_filter_active(
        self, service, plan_create_data, async_session, test_subscriber, customer_id
    ):
        """Test filtering subscriptions by active status."""
        plan = await service.create_plan(plan_create_data)

        # Create active subscription
        sub1_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        sub1 = await service.create_subscription(sub1_data)

        # Create inactive subscription
        sub2_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        sub2 = await service.create_subscription(sub2_data)

        # Manually set sub2 to inactive
        stmt = select(PlanSubscription).where(PlanSubscription.id == sub2.id)
        result = await async_session.execute(stmt)
        sub2_model = result.scalar_one()
        sub2_model.is_active = False
        await async_session.flush()

        # Filter active only
        result = await service.list_subscriptions(is_active=True)
        assert len(result) == 1
        assert result[0].id == sub1.id


@pytest.mark.integration
class TestInternetPlanServiceUsageTracking:
    """Test usage tracking."""

    @pytest.mark.asyncio
    async def test_update_usage(self, service, plan_create_data, customer_id, test_subscriber):
        """Test updating subscription usage."""
        plan = await service.create_plan(plan_create_data)
        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        subscription = await service.create_subscription(subscription_data)

        # Update usage
        usage_data = UsageUpdateRequest(
            download_gb=Decimal("50.5"),
            upload_gb=Decimal("25.25"),
        )

        result = await service.update_usage(subscription.id, usage_data)

        assert result is not None
        # Should sum download + upload
        assert result.current_period_usage_gb == Decimal("75.75")

    @pytest.mark.asyncio
    async def test_update_usage_accumulates(
        self, service, plan_create_data, customer_id, test_subscriber
    ):
        """Test usage updates accumulate."""
        plan = await service.create_plan(plan_create_data)
        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        subscription = await service.create_subscription(subscription_data)

        # First update
        usage_data1 = UsageUpdateRequest(
            download_gb=Decimal("50"),
            upload_gb=Decimal("25"),
        )
        await service.update_usage(subscription.id, usage_data1)

        # Second update
        usage_data2 = UsageUpdateRequest(
            download_gb=Decimal("30"),
            upload_gb=Decimal("15"),
        )
        result = await service.update_usage(subscription.id, usage_data2)

        # Should accumulate: (50+25) + (30+15) = 120
        assert result.current_period_usage_gb == Decimal("120")

    @pytest.mark.asyncio
    async def test_reset_usage(self, service, plan_create_data, customer_id, test_subscriber):
        """Test resetting usage for new billing period."""
        plan = await service.create_plan(plan_create_data)
        subscription_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        subscription = await service.create_subscription(subscription_data)

        # Add usage
        usage_data = UsageUpdateRequest(
            download_gb=Decimal("100"),
            upload_gb=Decimal("50"),
        )
        await service.update_usage(subscription.id, usage_data)

        # Reset usage
        result = await service.reset_usage(subscription.id)

        assert result is not None
        assert result.current_period_usage_gb == Decimal("0.00")
        assert result.last_usage_reset is not None

    @pytest.mark.asyncio
    async def test_update_usage_not_found(self, service):
        """Test updating usage for non-existent subscription returns None."""
        usage_data = UsageUpdateRequest(download_gb=Decimal("50"), upload_gb=Decimal("25"))
        result = await service.update_usage(uuid4(), usage_data)
        assert result is None


@pytest.mark.integration
class TestInternetPlanServiceStatistics:
    """Test plan statistics."""

    @pytest.mark.asyncio
    async def test_get_plan_statistics_no_subscriptions(self, service, plan_create_data):
        """Test statistics for plan with no subscriptions."""
        plan = await service.create_plan(plan_create_data)
        result = await service.get_plan_statistics(plan.id)

        assert result["plan_id"] == str(plan.id)
        assert result["active_subscriptions"] == 0
        assert result["monthly_recurring_revenue"] == 0.0

    @pytest.mark.asyncio
    async def test_get_plan_statistics_with_subscriptions(
        self, service, plan_create_data, test_subscriber, customer_id
    ):
        """Test statistics calculation with active subscriptions."""
        plan = await service.create_plan(plan_create_data)

        # Create 3 active subscriptions
        for _i in range(3):
            sub_data = PlanSubscriptionCreate(
                plan_id=plan.id,
                customer_id=customer_id,
                start_date=datetime.utcnow(),
                subscriber_id=test_subscriber.id,
            )
            await service.create_subscription(sub_data)

        result = await service.get_plan_statistics(plan.id)

        assert result["active_subscriptions"] == 3
        # MRR = 3 * $50.00 = $150.00
        assert result["monthly_recurring_revenue"] == 150.0

    @pytest.mark.asyncio
    async def test_get_plan_statistics_excludes_inactive(
        self, service, plan_create_data, async_session, test_subscriber, customer_id
    ):
        """Test statistics only count active subscriptions."""
        plan = await service.create_plan(plan_create_data)

        # Create active subscription
        sub1_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        await service.create_subscription(sub1_data)

        # Create inactive subscription
        sub2_data = PlanSubscriptionCreate(
            plan_id=plan.id,
            customer_id=customer_id,
            start_date=datetime.utcnow(),
            subscriber_id=test_subscriber.id,
        )
        sub2 = await service.create_subscription(sub2_data)

        # Make sub2 inactive
        stmt = select(PlanSubscription).where(PlanSubscription.id == sub2.id)
        result = await async_session.execute(stmt)
        sub2_model = result.scalar_one()
        sub2_model.is_active = False
        await async_session.flush()

        # Get statistics
        result = await service.get_plan_statistics(plan.id)

        assert result["active_subscriptions"] == 1
        assert result["monthly_recurring_revenue"] == 50.0
