"""
Tests for PlanSubscription subscriber_id validation.

Ensures that new subscriptions cannot be created without a valid subscriber_id,
and that the subscriber must belong to the specified customer.
"""

import pytest
import pytest_asyncio
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.services.internet_plans.models import (
    InternetServicePlan,
    PlanStatus,
    PlanType,
    SpeedUnit,
)
from dotmac.platform.services.internet_plans.schemas import PlanSubscriptionCreate
from dotmac.platform.services.internet_plans.service import InternetPlanService
from dotmac.platform.subscribers.models import Subscriber
from dotmac.platform.services.lifecycle.models import ServiceType


pytestmark = pytest.mark.unit


@pytest_asyncio.fixture
async def setup_test_data(async_session, test_tenant):
    """Create test data for subscription validation tests."""
    # Create a plan
    plan = InternetServicePlan(
        id=uuid4(),
        tenant_id=str(test_tenant.id),
        plan_code=f"TEST-{uuid4().hex[:6]}",
        name="Test Plan 100Mbps",
        plan_type=PlanType.RESIDENTIAL,
        status=PlanStatus.ACTIVE,
        download_speed=Decimal("100"),
        upload_speed=Decimal("50"),
        speed_unit=SpeedUnit.MBPS,
        monthly_price=Decimal("49.99"),
        currency="USD",
    )
    async_session.add(plan)

    # Create a customer
    customer = Customer(
        id=uuid4(),
        tenant_id=str(test_tenant.id),
        customer_number=f"CUST-{uuid4().hex[:6]}",
        email="test@example.com",
        first_name="Test",
        last_name="User",
    )
    async_session.add(customer)

    # Create a subscriber for that customer
    subscriber_id = f"subscriber-{uuid4().hex[:6]}"
    subscriber = Subscriber(
        id=subscriber_id,
        tenant_id=str(test_tenant.id),
        customer_id=customer.id,
        username=subscriber_id,
        password="sha256:dummy-password",
        service_type=ServiceType.FIBER_INTERNET,
    )
    async_session.add(subscriber)

    # Create another customer with their own subscriber
    other_customer = Customer(
        id=uuid4(),
        tenant_id=str(test_tenant.id),
        customer_number=f"CUST-{uuid4().hex[:6]}",
        email="other@example.com",
        first_name="Other",
        last_name="User",
    )
    async_session.add(other_customer)

    other_subscriber_id = f"subscriber-{uuid4().hex[:6]}"
    other_subscriber = Subscriber(
        id=other_subscriber_id,
        tenant_id=str(test_tenant.id),
        customer_id=other_customer.id,
        username=other_subscriber_id,
        password="sha256:other-password",
        service_type=ServiceType.FIBER_INTERNET,
    )
    async_session.add(other_subscriber)

    await async_session.commit()
    await async_session.refresh(plan)
    await async_session.refresh(customer)
    await async_session.refresh(subscriber)
    await async_session.refresh(other_customer)
    await async_session.refresh(other_subscriber)

    return {
        "plan": plan,
        "customer": customer,
        "subscriber": subscriber,
        "other_customer": other_customer,
        "other_subscriber": other_subscriber,
    }


@pytest.mark.asyncio
async def test_create_subscription_requires_subscriber_id(
    async_session, test_tenant, setup_test_data
):
    """Test that subscriber_id is required when creating a subscription."""
    data = setup_test_data
    service = InternetPlanService(async_session, test_tenant.id)

    # Create subscription with valid subscriber_id
    subscription_data = PlanSubscriptionCreate(
        plan_id=data["plan"].id,
        customer_id=data["customer"].id,
        subscriber_id=data["subscriber"].id,  # Required
    )

    subscription = await service.create_subscription(subscription_data)

    assert subscription.id is not None
    assert subscription.subscriber_id == data["subscriber"].id
    assert subscription.customer_id == data["customer"].id
    assert subscription.plan_id == data["plan"].id


@pytest.mark.asyncio
async def test_create_subscription_validates_subscriber_exists(
    async_session, test_tenant, setup_test_data
):
    """Test that subscriber_id must reference an existing subscriber."""
    data = setup_test_data
    service = InternetPlanService(async_session, test_tenant.id)

    # Try to create subscription with non-existent subscriber_id
    subscription_data = PlanSubscriptionCreate(
        plan_id=data["plan"].id,
        customer_id=data["customer"].id,
        subscriber_id="non-existent-subscriber",  # Does not exist
    )

    with pytest.raises(ValueError, match="Subscriber .* not found for customer"):
        await service.create_subscription(subscription_data)


@pytest.mark.asyncio
async def test_create_subscription_validates_subscriber_belongs_to_customer(
    async_session, test_tenant, setup_test_data
):
    """Test that subscriber must belong to the specified customer."""
    data = setup_test_data
    service = InternetPlanService(async_session, test_tenant.id)

    # Try to create subscription with subscriber from different customer
    subscription_data = PlanSubscriptionCreate(
        plan_id=data["plan"].id,
        customer_id=data["customer"].id,  # Customer A
        subscriber_id=data["other_subscriber"].id,  # Belongs to Customer B
    )

    with pytest.raises(ValueError, match="Subscriber .* not found for customer"):
        await service.create_subscription(subscription_data)


@pytest.mark.asyncio
async def test_create_subscription_validates_tenant_isolation(
    async_session, test_tenant, setup_test_data
):
    """Test that subscriber must belong to the same tenant."""
    data = setup_test_data

    # Create a service for a different tenant
    different_tenant_id = uuid4()
    service = InternetPlanService(async_session, different_tenant_id)

    # Try to create subscription with subscriber from different tenant
    subscription_data = PlanSubscriptionCreate(
        plan_id=data["plan"].id,
        customer_id=data["customer"].id,
        subscriber_id=data["subscriber"].id,  # Belongs to different tenant
    )

    with pytest.raises(ValueError, match="Subscriber .* not found for customer"):
        await service.create_subscription(subscription_data)


@pytest.mark.asyncio
async def test_create_subscription_validates_soft_deleted_subscriber(
    async_session, test_tenant, setup_test_data
):
    """Test that soft-deleted subscribers cannot be used."""
    data = setup_test_data
    service = InternetPlanService(async_session, test_tenant.id)

    # Soft-delete the subscriber
    data["subscriber"].deleted_at = datetime.utcnow()
    await async_session.commit()

    # Try to create subscription with soft-deleted subscriber
    subscription_data = PlanSubscriptionCreate(
        plan_id=data["plan"].id,
        customer_id=data["customer"].id,
        subscriber_id=data["subscriber"].id,
    )

    with pytest.raises(ValueError, match="Subscriber .* not found for customer"):
        await service.create_subscription(subscription_data)
