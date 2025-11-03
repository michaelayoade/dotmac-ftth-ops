"""
Tests for subscription plan CRUD operations.
"""

from decimal import Decimal

import pytest

from dotmac.platform.billing.exceptions import PlanNotFoundError
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionPlanCreateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService

pytestmark = pytest.mark.asyncio


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
