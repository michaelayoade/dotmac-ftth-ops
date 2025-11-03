"""
Test factory _commit parameter behavior.

Verifies that factories with _commit=True:
1. Can commit data without InvalidRequestError
2. Make data visible across different sessions
3. Work correctly with guarded rollback in async_db_session fixture
"""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestFactoryCommitBehavior:
    """Test _commit parameter in factories."""

    async def test_subscription_plan_factory_with_commit(
        self,
        subscription_plan_factory,
        async_db_session: AsyncSession,
    ):
        """Test that subscription_plan_factory with _commit=True works without errors."""

        # Create plan with commit - should not raise InvalidRequestError
        plan = await subscription_plan_factory(
            name="Commit Test Plan",
            price=Decimal("29.99"),
            _commit=True,  # ← Commits transaction
        )

        # Verify plan was created
        assert plan.plan_id is not None
        assert plan.name == "Commit Test Plan"
        assert plan.price == Decimal("29.99")

        # Fixture teardown should not raise InvalidRequestError
        # (guarded by transaction.is_active check)

    async def test_customer_factory_with_commit(
        self,
        customer_factory,
        async_db_session: AsyncSession,
    ):
        """Test that customer_factory with _commit=True works without errors."""

        # Create customer with commit
        customer = await customer_factory(first_name="John", last_name="Doe", _commit=True)

        # Verify customer was created
        assert customer.id is not None
        assert customer.first_name == "John"
        assert customer.last_name == "Doe"

    async def test_payment_factory_with_commit_chain(
        self,
        payment_factory,
        async_db_session: AsyncSession,
    ):
        """Test that payment_factory propagates _commit through dependency chain."""

        # Payment factory creates customer and invoice automatically
        # _commit should propagate through all dependencies
        payment = await payment_factory(
            amount=Decimal("100.00"),
            status="succeeded",
            _commit=True,  # ← Should commit customer, invoice, and payment
        )

        # Verify all entities were created
        assert payment.payment_id is not None
        assert payment.customer_id is not None
        assert payment.amount == 10000  # Stored in cents

    async def test_factory_default_behavior_unchanged(
        self,
        subscription_plan_factory,
        async_db_session: AsyncSession,
    ):
        """Test that default behavior (flush without commit) still works."""

        # Create plan without _commit parameter (default behavior)
        plan = await subscription_plan_factory(
            name="Default Behavior Plan",
            price=Decimal("19.99"),
            # _commit defaults to False
        )

        # Verify plan was created
        assert plan.plan_id is not None
        assert plan.name == "Default Behavior Plan"

        # Data is flushed but not committed
        # Transaction rollback on teardown should work normally

    async def test_mixed_commit_and_flush(
        self,
        customer_factory,
        subscription_plan_factory,
        async_db_session: AsyncSession,
    ):
        """Test that mixing commit and flush operations works correctly."""

        # Create customer with commit
        customer = await customer_factory(first_name="Alice", _commit=True)

        # Create plan without commit (default flush)
        plan = await subscription_plan_factory(
            name="Mixed Test Plan",
            price=Decimal("49.99"),
            # Uses default _commit=False
        )

        # Both should exist
        assert customer.id is not None
        assert plan.plan_id is not None

        # Customer was committed, plan was flushed
        # Fixture should handle teardown correctly

    async def test_commit_makes_data_visible_to_new_session(
        self,
        subscription_plan_factory,
        async_db_session: AsyncSession,
        async_db_engine,
    ):
        """Test that _commit=True makes data visible to a new session."""
        if async_db_session.bind.dialect.name != "sqlite":
            pytest.skip(
                "Nested transactional test harness prevents cross-session visibility; "
                "verified via SQLite fallback."
            )
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

        # Create plan with commit
        await subscription_plan_factory(
            plan_id="plan_cross_session_test",
            name="Cross Session Plan",
            price=Decimal("99.99"),
            _commit=True,  # ← Commits to database
        )

        # Create a completely new session to verify data is visible
        SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
        async with SessionMaker() as new_session:
            # Query for the plan in new session
            result = await new_session.execute(
                select(BillingSubscriptionPlanTable).where(
                    BillingSubscriptionPlanTable.plan_id == "plan_cross_session_test"
                )
            )
            found_plan = result.scalar_one_or_none()

            # Plan should be visible in new session
            assert found_plan is not None
            assert found_plan.name == "Cross Session Plan"
            assert found_plan.price == Decimal("99.99")

    async def test_flush_data_not_visible_to_new_session(
        self,
        subscription_plan_factory,
        async_db_session: AsyncSession,
        async_db_engine,
    ):
        """Test that default (flush) does NOT make data visible to new session."""
        if async_db_engine.url.get_backend_name().startswith("sqlite"):
            pytest.skip(
                "SQLite keeps flushed data visible with shared connections; behaviour not guaranteed"
            )
        from sqlalchemy.ext.asyncio import async_sessionmaker

        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

        # Create plan with default flush behavior
        plan = await subscription_plan_factory(
            plan_id="plan_flush_test",
            name="Flush Only Plan",
            price=Decimal("79.99"),
            # _commit defaults to False - uses flush()
        )

        # Verify plan exists in current session
        assert plan.plan_id is not None

        # Create a completely new session
        SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
        async with SessionMaker() as new_session:
            # Query for the plan in new session
            result = await new_session.execute(
                select(BillingSubscriptionPlanTable).where(
                    BillingSubscriptionPlanTable.plan_id == "plan_flush_test"
                )
            )
            found_plan = result.scalar_one_or_none()

            # Plan should NOT be visible (only flushed, not committed)
            assert found_plan is None

    async def test_transaction_guard_prevents_error(
        self,
        subscription_plan_factory,
        async_db_session: AsyncSession,
    ):
        """Test that fixture's transaction guard prevents InvalidRequestError."""

        # This test verifies the fix in tests/fixtures/database.py:270
        # Before fix: fixture would raise InvalidRequestError on teardown
        # After fix: fixture checks transaction.is_active before rollback

        # Create multiple plans with commits
        plan1 = await subscription_plan_factory(name="Guard Test 1", _commit=True)

        plan2 = await subscription_plan_factory(name="Guard Test 2", _commit=True)

        # Multiple commits should work
        assert plan1.plan_id is not None
        assert plan2.plan_id is not None

        # Fixture teardown should not raise InvalidRequestError
        # because transaction.is_active check guards the rollback
