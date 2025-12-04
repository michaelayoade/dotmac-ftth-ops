"""
Test to verify ORM entity factory fixes work correctly.

This test verifies that factories use actual ORM entities, not Pydantic models.
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_payment_method_factory_uses_orm_entity(async_db_session, payment_method_factory):
    """Verify payment_method factory uses PaymentMethodEntity ORM model."""
    # Create payment method using factory
    payment_method = await payment_method_factory(method_type="card", is_default=True)

    # Verify payment method was created
    assert payment_method.payment_method_id is not None
    assert payment_method.customer_id is not None
    assert payment_method.is_default is True

    # Verify it's an ORM entity (has __table__ attribute)
    assert hasattr(payment_method.__class__, "__table__")

    # Session should still be usable
    await async_db_session.flush()


@pytest.mark.asyncio
async def test_payment_factory_uses_orm_entity(async_db_session, payment_factory):
    """Verify payment factory uses PaymentEntity ORM model."""
    # Create payment using factory
    payment = await payment_factory(amount=Decimal("50.00"), status="succeeded")

    # Verify payment was created
    assert payment.payment_id is not None
    assert payment.customer_id is not None
    assert payment.amount == 5000  # In cents

    # Verify it's an ORM entity (has __table__ attribute)
    assert hasattr(payment.__class__, "__table__")

    # Session should still be usable
    await async_db_session.flush()


@pytest.mark.asyncio
async def test_subscription_plan_factory_uses_orm_entity(
    async_db_session, subscription_plan_factory
):
    """Verify subscription_plan factory uses BillingSubscriptionPlanTable ORM model."""
    # Create subscription plan using factory
    plan = await subscription_plan_factory(name="Test Plan", price=Decimal("29.99"))

    # Verify plan was created
    assert plan.plan_id is not None
    assert plan.name == "Test Plan"
    assert plan.price == Decimal("29.99")

    # Verify it's an ORM entity (has __table__ attribute)
    assert hasattr(plan.__class__, "__table__")

    # Session should still be usable
    await async_db_session.flush()
