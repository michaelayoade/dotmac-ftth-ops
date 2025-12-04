"""
Load Testing for Subscription Module

Tests performance and scalability with large volumes:
- 1000+ subscriptions
- Concurrent operations
- Bulk operations
- Query performance
- Memory usage
"""

import asyncio
import os
import time
from decimal import Decimal
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import func, select

from dotmac.platform.billing.models import BillingSubscriptionTable
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    SubscriptionCreateRequest,
    SubscriptionPlanChangeRequest,
    SubscriptionPlanCreateRequest,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService

RUN_SUBSCRIPTION_LOAD_TESTS = os.getenv("RUN_SUBSCRIPTION_LOAD_TESTS") == "1"

# Mark these as integration tests and skip unless explicitly enabled.
pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_SUBSCRIPTION_LOAD_TESTS,
        reason="Set RUN_SUBSCRIPTION_LOAD_TESTS=1 to enable subscription load tests.",
    ),
]


@pytest_asyncio.fixture
async def load_test_plans(async_db_session):
    """Create multiple plans for load testing."""
    service = SubscriptionService(db_session=async_db_session)
    tenant_id = str(uuid4())
    product_id = str(uuid4())

    plans = []
    for i, (name, price) in enumerate(
        [
            ("Starter", "9.99"),
            ("Basic", "29.99"),
            ("Pro", "99.99"),
            ("Enterprise", "299.99"),
        ]
    ):
        plan_data = SubscriptionPlanCreateRequest(
            product_id=product_id,
            name=f"Load Test {name}",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal(price),
            currency="USD",
            trial_days=14 if i < 2 else 7,
            is_active=True,
        )
        plan = await service.create_plan(plan_data=plan_data, tenant_id=tenant_id)
        plans.append(plan)

    return plans, tenant_id


@pytest.mark.integration
class TestSubscriptionLoadPerformance:
    """Test subscription performance under load."""

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_create_1000_subscriptions(self, async_db_session, load_test_plans):
        """Test creating 1000 subscriptions and measure performance."""
        plans, tenant_id = load_test_plans
        service = SubscriptionService(db_session=async_db_session)

        num_subscriptions = 1000
        batch_size = 100

        print(f"\n🚀 Creating {num_subscriptions} subscriptions in batches of {batch_size}...")
        start_time = time.time()

        created_subscription_ids = []

        for batch_num in range(num_subscriptions // batch_size):
            batch_start = time.time()

            for i in range(batch_size):
                customer_id = str(uuid4())
                plan = plans[i % len(plans)]  # Rotate through plans

                subscription_data = SubscriptionCreateRequest(
                    customer_id=customer_id,
                    plan_id=plan.plan_id,
                )

                subscription = await service.create_subscription(
                    subscription_data=subscription_data, tenant_id=tenant_id
                )
                created_subscription_ids.append(subscription.subscription_id)

            # Commit batch
            await async_db_session.commit()

            batch_time = time.time() - batch_start
            print(
                f"  Batch {batch_num + 1}/{num_subscriptions // batch_size}: "
                f"{batch_size} subscriptions in {batch_time:.2f}s "
                f"({batch_size / batch_time:.1f} subscriptions/sec)"
            )

        total_time = time.time() - start_time
        avg_per_subscription = (total_time / num_subscriptions) * 1000  # ms

        print(f"\n✅ Created {num_subscriptions} subscriptions in {total_time:.2f}s")
        print(f"   Average: {avg_per_subscription:.1f}ms per subscription")
        print(f"   Throughput: {num_subscriptions / total_time:.1f} subscriptions/sec")

        # Verify count in database
        result = await async_db_session.execute(
            select(func.count())
            .select_from(BillingSubscriptionTable)
            .where(BillingSubscriptionTable.tenant_id == tenant_id)
        )
        count = result.scalar()

        assert count == num_subscriptions
        assert total_time < 120  # Should complete in under 2 minutes
        assert avg_per_subscription < 200  # Should be under 200ms per subscription

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_list_subscriptions_pagination_performance(
        self, async_db_session, load_test_plans
    ):
        """Test listing subscriptions with pagination at scale."""
        plans, tenant_id = load_test_plans
        service = SubscriptionService(db_session=async_db_session)

        # Create 500 subscriptions for this test
        num_subscriptions = 500
        print(f"\n📋 Creating {num_subscriptions} subscriptions for pagination test...")

        for i in range(num_subscriptions):
            customer_id = str(uuid4())
            plan = plans[i % len(plans)]

            subscription_data = SubscriptionCreateRequest(
                customer_id=customer_id,
                plan_id=plan.plan_id,
            )

            await service.create_subscription(
                subscription_data=subscription_data, tenant_id=tenant_id
            )

            if (i + 1) % 100 == 0:
                await async_db_session.commit()
                print(f"  Created {i + 1}/{num_subscriptions}...")

        await async_db_session.commit()

        # Test pagination performance
        print("\n🔍 Testing pagination performance...")
        page_size = 50
        pages_to_test = 5

        for page in range(1, pages_to_test + 1):
            start_time = time.time()

            subscriptions = await service.list_subscriptions(
                tenant_id=tenant_id, limit=page_size, page=page
            )

            query_time = (time.time() - start_time) * 1000  # ms

            print(f"  Page {page}: {len(subscriptions)} results in {query_time:.1f}ms")

            assert len(subscriptions) == page_size
            assert query_time < 500  # Should be under 500ms per page

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_concurrent_subscription_operations(self, async_db_session, load_test_plans):
        """Test concurrent subscription operations."""
        plans, tenant_id = load_test_plans
        service = SubscriptionService(db_session=async_db_session)

        # Create base subscriptions
        num_subscriptions = 100
        subscription_ids = []

        print(f"\n⚡ Creating {num_subscriptions} subscriptions for concurrency test...")
        for i in range(num_subscriptions):
            customer_id = str(uuid4())
            plan = plans[i % len(plans)]

            subscription_data = SubscriptionCreateRequest(
                customer_id=customer_id,
                plan_id=plan.plan_id,
            )

            subscription = await service.create_subscription(
                subscription_data=subscription_data, tenant_id=tenant_id
            )
            subscription_ids.append(subscription.subscription_id)

        await async_db_session.commit()

        # Test concurrent reads
        print(f"\n🔄 Testing {num_subscriptions} concurrent reads...")
        start_time = time.time()

        async def read_subscription(sub_id):
            return await service.get_subscription(subscription_id=sub_id, tenant_id=tenant_id)

        # Simulate concurrent reads
        tasks = [read_subscription(sub_id) for sub_id in subscription_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        concurrent_time = time.time() - start_time

        # Check for errors
        errors = [r for r in results if isinstance(r, Exception)]
        successful = len(results) - len(errors)

        print(f"  ✅ {successful}/{num_subscriptions} successful reads")
        print(f"  ⏱️  Total time: {concurrent_time:.2f}s")
        print(f"  📊 Throughput: {successful / concurrent_time:.1f} reads/sec")

        assert len(errors) == 0
        assert concurrent_time < 30  # Should complete in under 30 seconds

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_bulk_cancellation_performance(self, async_db_session, load_test_plans):
        """Test bulk cancellation performance."""
        plans, tenant_id = load_test_plans
        service = SubscriptionService(db_session=async_db_session)

        # Create subscriptions
        num_subscriptions = 200
        subscription_ids = []

        print(f"\n🛑 Creating {num_subscriptions} subscriptions for bulk cancellation...")
        for i in range(num_subscriptions):
            customer_id = str(uuid4())
            plan = plans[i % len(plans)]

            subscription_data = SubscriptionCreateRequest(
                customer_id=customer_id,
                plan_id=plan.plan_id,
            )

            subscription = await service.create_subscription(
                subscription_data=subscription_data, tenant_id=tenant_id
            )
            subscription_ids.append(subscription.subscription_id)

        await async_db_session.commit()

        # Bulk cancel
        print(f"\n❌ Canceling {num_subscriptions} subscriptions...")
        start_time = time.time()

        canceled_count = 0
        for sub_id in subscription_ids:
            await service.cancel_subscription(
                subscription_id=sub_id,
                tenant_id=tenant_id,
                at_period_end=True,  # Cancel at period end
            )
            canceled_count += 1

            if canceled_count % 50 == 0:
                await async_db_session.commit()
                print(f"  Canceled {canceled_count}/{num_subscriptions}...")

        await async_db_session.commit()

        cancel_time = time.time() - start_time
        avg_cancel_time = (cancel_time / num_subscriptions) * 1000  # ms

        print(f"\n✅ Canceled {num_subscriptions} subscriptions in {cancel_time:.2f}s")
        print(f"   Average: {avg_cancel_time:.1f}ms per cancellation")

        # Verify cancellations
        result = await async_db_session.execute(
            select(func.count())
            .select_from(BillingSubscriptionTable)
            .where(
                BillingSubscriptionTable.tenant_id == tenant_id,
                BillingSubscriptionTable.cancel_at_period_end,
            )
        )
        canceled = result.scalar()

        assert canceled == num_subscriptions
        assert avg_cancel_time < 100  # Should be under 100ms per cancellation

    @pytest.mark.asyncio
    @pytest.mark.slow
    async def test_plan_change_performance_at_scale(self, async_db_session, load_test_plans):
        """Test plan change performance with many subscriptions."""
        plans, tenant_id = load_test_plans
        service = SubscriptionService(db_session=async_db_session)

        # Create subscriptions on starter plan
        num_subscriptions = 100
        subscription_ids = []
        starter_plan = plans[0]
        pro_plan = plans[2]

        print(f"\n📈 Creating {num_subscriptions} subscriptions for plan change test...")
        for _i in range(num_subscriptions):
            customer_id = str(uuid4())

            subscription_data = SubscriptionCreateRequest(
                customer_id=customer_id,
                plan_id=starter_plan.plan_id,
            )

            subscription = await service.create_subscription(
                subscription_data=subscription_data, tenant_id=tenant_id
            )
            subscription_ids.append(subscription.subscription_id)

        await async_db_session.commit()

        # Upgrade all to pro plan
        print(f"\n⬆️  Upgrading {num_subscriptions} subscriptions to Pro plan...")
        start_time = time.time()

        upgraded_count = 0
        for sub_id in subscription_ids:
            change_request = SubscriptionPlanChangeRequest(new_plan_id=pro_plan.plan_id)
            await service.change_plan(
                subscription_id=sub_id, change_request=change_request, tenant_id=tenant_id
            )
            upgraded_count += 1

            if upgraded_count % 25 == 0:
                await async_db_session.commit()
                print(f"  Upgraded {upgraded_count}/{num_subscriptions}...")

        await async_db_session.commit()

        upgrade_time = time.time() - start_time
        avg_upgrade_time = (upgrade_time / num_subscriptions) * 1000  # ms

        print(f"\n✅ Upgraded {num_subscriptions} subscriptions in {upgrade_time:.2f}s")
        print(f"   Average: {avg_upgrade_time:.1f}ms per upgrade (includes proration)")

        # Verify upgrades
        result = await async_db_session.execute(
            select(func.count())
            .select_from(BillingSubscriptionTable)
            .where(
                BillingSubscriptionTable.tenant_id == tenant_id,
                BillingSubscriptionTable.plan_id == pro_plan.plan_id,
            )
        )
        upgraded = result.scalar()

        assert upgraded == num_subscriptions
        assert avg_upgrade_time < 150  # Should be under 150ms per upgrade


@pytest.mark.asyncio
@pytest.mark.slow
async def test_complete_load_test_scenario(async_db_session):
    """
    Complete load test scenario simulating real-world usage:
    1. Create 500 subscriptions
    2. Perform mixed operations (reads, updates, cancellations)
    3. Measure overall system performance
    """
    service = SubscriptionService(db_session=async_db_session)
    tenant_id = str(uuid4())
    product_id = str(uuid4())

    print("\n" + "=" * 70)
    print("🎯 COMPLETE LOAD TEST SCENARIO")
    print("=" * 70)

    # Step 1: Create plans
    print("\n📋 Step 1: Creating test plans...")
    plans = []
    for name, price in [("Basic", "19.99"), ("Pro", "49.99")]:
        plan_data = SubscriptionPlanCreateRequest(
            product_id=product_id,
            name=f"Load {name}",
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal(price),
            currency="USD",
            trial_days=14,
            is_active=True,
        )
        plan = await service.create_plan(plan_data=plan_data, tenant_id=tenant_id)
        plans.append(plan)

    # Step 2: Create subscriptions
    num_subscriptions = 500
    print(f"\n📦 Step 2: Creating {num_subscriptions} subscriptions...")
    start_time = time.time()

    subscription_ids = []
    for i in range(num_subscriptions):
        customer_id = str(uuid4())
        plan = plans[i % len(plans)]

        subscription_data = SubscriptionCreateRequest(
            customer_id=customer_id,
            plan_id=plan.plan_id,
        )

        subscription = await service.create_subscription(
            subscription_data=subscription_data, tenant_id=tenant_id
        )
        subscription_ids.append(subscription.subscription_id)

        if (i + 1) % 100 == 0:
            await async_db_session.commit()
            elapsed = time.time() - start_time
            rate = (i + 1) / elapsed
            print(f"  Progress: {i + 1}/{num_subscriptions} ({rate:.1f} subs/sec)")

    await async_db_session.commit()
    create_time = time.time() - start_time

    # Step 3: Mixed read operations
    print("\n🔍 Step 3: Performing 200 random reads...")
    start_time = time.time()

    import random

    for _ in range(200):
        sub_id = random.choice(subscription_ids)
        await service.get_subscription(subscription_id=sub_id, tenant_id=tenant_id)

    read_time = time.time() - start_time

    # Step 4: Plan changes
    print("\n⬆️  Step 4: Upgrading 100 subscriptions...")
    start_time = time.time()

    for i in range(100):
        sub_id = subscription_ids[i]
        change_request = SubscriptionPlanChangeRequest(new_plan_id=plans[1].plan_id)
        await service.change_plan(
            subscription_id=sub_id,
            change_request=change_request,
            tenant_id=tenant_id,
        )

    await async_db_session.commit()
    upgrade_time = time.time() - start_time

    # Step 5: Cancellations
    print("\n❌ Step 5: Canceling 50 subscriptions...")
    start_time = time.time()

    for i in range(50):
        sub_id = subscription_ids[-(i + 1)]  # Cancel from the end
        await service.cancel_subscription(
            subscription_id=sub_id,
            tenant_id=tenant_id,
            at_period_end=True,  # Cancel at period end
        )

    await async_db_session.commit()
    cancel_time = time.time() - start_time

    # Final report
    print("\n" + "=" * 70)
    print("📊 LOAD TEST RESULTS")
    print("=" * 70)
    print(
        f"✅ Created {num_subscriptions} subscriptions: {create_time:.2f}s "
        f"({num_subscriptions / create_time:.1f} subs/sec)"
    )
    print(f"✅ Performed 200 reads: {read_time:.2f}s ({200 / read_time:.1f} reads/sec)")
    print(
        f"✅ Upgraded 100 subscriptions: {upgrade_time:.2f}s "
        f"({100 / upgrade_time:.1f} upgrades/sec)"
    )
    print(f"✅ Canceled 50 subscriptions: {cancel_time:.2f}s ({50 / cancel_time:.1f} cancels/sec)")
    print("=" * 70)

    # Performance assertions
    assert create_time < 60  # Should create 500 subscriptions in under 60s
    assert read_time < 10  # Should read 200 subscriptions in under 10s
    assert upgrade_time < 15  # Should upgrade 100 subscriptions in under 15s
    assert cancel_time < 10  # Should cancel 50 subscriptions in under 10s

    print("\n✅ All performance benchmarks passed!")
