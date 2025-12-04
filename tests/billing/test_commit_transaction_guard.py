"""
Test that async_db_session fixture correctly guards rollback after commit.

This test verifies the fix in tests/fixtures/database.py:270 where we added:
    if transaction.is_active:
        await transaction.rollback()

Before the fix: InvalidRequestError raised on teardown after commit
After the fix: Teardown succeeds because rollback is guarded
"""

from decimal import Decimal

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestTransactionGuardFix:
    """Test that fixture handles committed transactions gracefully."""

    async def test_single_commit_no_error(
        self,
        subscription_plan_factory,
    ):
        """Test single commit doesn't cause InvalidRequestError on teardown."""

        # Create plan with _commit=True
        plan = await subscription_plan_factory(
            name="Single Commit Test",
            price=Decimal("29.99"),
            _commit=True,  # ← Commits and closes transaction
        )

        assert plan.plan_id is not None
        assert plan.name == "Single Commit Test"

        # SUCCESS: Test passes without InvalidRequestError on teardown
        # This verifies the transaction.is_active guard works

    async def test_multiple_commits_no_error(
        self,
        subscription_plan_factory,
    ):
        """Test multiple commits work correctly with guarded rollback."""

        # Create multiple plans with commits
        plan1 = await subscription_plan_factory(name="Plan 1", price=Decimal("19.99"), _commit=True)

        plan2 = await subscription_plan_factory(name="Plan 2", price=Decimal("29.99"), _commit=True)

        plan3 = await subscription_plan_factory(name="Plan 3", price=Decimal("39.99"), _commit=True)

        # All plans created successfully
        assert plan1.plan_id is not None
        assert plan2.plan_id is not None
        assert plan3.plan_id is not None

        # SUCCESS: Multiple commits don't cause errors on teardown

    async def test_default_behavior_still_works(
        self,
        subscription_plan_factory,
    ):
        """Test that default flush behavior (no commit) still works."""

        # Create plan without _commit (default behavior)
        plan = await subscription_plan_factory(
            name="Default Behavior",
            price=Decimal("49.99"),
            # _commit defaults to False - uses flush()
        )

        assert plan.plan_id is not None

        # SUCCESS: Default flush + rollback cleanup works
        # Transaction rollback happens normally on teardown

    async def test_mixed_commit_and_flush_operations(
        self,
        subscription_plan_factory,
    ):
        """Test mixing committed and flushed operations."""

        # Commit one plan
        committed_plan = await subscription_plan_factory(
            name="Committed Plan", price=Decimal("99.99"), _commit=True
        )

        # Flush another plan (default)
        flushed_plan = await subscription_plan_factory(
            name="Flushed Plan",
            price=Decimal("79.99"),
            # Uses default flush()
        )

        assert committed_plan.plan_id is not None
        assert flushed_plan.plan_id is not None

        # SUCCESS: Mixed operations don't cause teardown errors
        # Guard handles committed transaction, rolls back flushed data
