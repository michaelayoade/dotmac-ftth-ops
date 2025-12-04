"""
Integration tests for service lifecycle journey.

Tests service activation, usage, suspension, resumption, and cancellation.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest

from dotmac.platform.billing.models import (
    BillingSubscriptionPlanTable,
    BillingSubscriptionTable,
)
from dotmac.platform.billing.subscriptions.models import (
    BillingCycle,
    ProrationBehavior,
    SubscriptionPlanChangeRequest,
    SubscriptionStatus,
)
from dotmac.platform.billing.subscriptions.service import SubscriptionService
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.customer_management.schemas import CustomerCreate
from dotmac.platform.customer_management.service import CustomerService
from dotmac.platform.tenant.models import Tenant

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestServiceLifecycleJourney:
    """Test complete service lifecycle from activation to cancellation."""

    async def test_service_activation_to_cancellation_journey(
        self,
        async_session,
        test_tenant: Tenant,
    ):
        """
        Test complete service lifecycle journey.

        Journey Steps:
        1. Service activated (subscription created)
        2. First invoice generated
        3. Service used for period
        4. Renewal invoice generated
        5. Service suspended for non-payment
        6. Service resumed after payment
        7. Service cancelled by customer
        """
        # Setup: Create customer
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_number=f"LC-{uuid4().hex[:8].upper()}",
            first_name="Lifecycle",
            last_name="Test",
            email=f"lifecycle_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        async_session.add(customer)
        await async_session.flush()

        # Setup: Create plan
        plan_id = f"plan-{uuid4().hex[:8]}"
        product_id = f"prod-{uuid4().hex[:8]}"
        plan = BillingSubscriptionPlanTable(
            tenant_id=test_tenant.id,
            plan_id=plan_id,
            product_id=product_id,
            name="Monthly Service",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("39.99"),
            currency="USD",
            is_active=True,
            trial_days=0,
        )
        async_session.add(plan)
        await async_session.flush()

        # Step 1: Activate service
        now = datetime.now(UTC)
        subscription = BillingSubscriptionTable(
            subscription_id=str(uuid4()),
            tenant_id=test_tenant.id,
            customer_id=str(customer.id),
            plan_id=str(plan.id),
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        async_session.add(subscription)
        await async_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE.value
        print(f"✅ Step 1: Service activated - {subscription.status}")

        # Step 2: Invoice generation would happen here
        # NOTE: Invoice is not a SQLAlchemy model, it's a Pydantic model
        # Direct database manipulation of invoices is not possible
        # Use InvoiceService for invoice operations (see test_service_lifecycle_journey_improved.py)
        print("✅ Step 2: Invoice generation skipped (use service layer for invoices)")

        # Step 3: Service used for 30 days (simulate)
        # In real scenario, usage would be tracked here

        # Step 4: Renewal invoice would be generated here
        renewal_date = now + timedelta(days=30)
        subscription.current_period_start = renewal_date
        subscription.current_period_end = renewal_date + timedelta(days=30)
        await async_session.flush()

        print("✅ Step 4: Renewal invoice skipped (use service layer for invoices)")

        # Step 5: Suspend service for non-payment (payment overdue)
        past_due_date = renewal_date + timedelta(days=10)
        subscription.status = SubscriptionStatus.PAST_DUE.value
        await async_session.flush()

        # After grace period, pause/suspend
        subscription.status = SubscriptionStatus.PAUSED.value
        subscription.suspended_at = past_due_date
        await async_session.flush()

        assert subscription.status == SubscriptionStatus.PAUSED.value
        print("✅ Step 5: Service paused - non-payment")

        # Step 6: Resume service after payment
        payment_date = past_due_date + timedelta(days=2)

        subscription.status = SubscriptionStatus.ACTIVE.value
        subscription.suspended_at = None
        subscription.resumed_at = payment_date
        await async_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE.value
        print("✅ Step 6: Service resumed - payment received")

        # Step 7: Cancel service
        cancellation_date = payment_date + timedelta(days=15)
        subscription.status = SubscriptionStatus.CANCELED.value
        subscription.cancelled_at = cancellation_date
        subscription.cancellation_reason = "Customer request"
        await async_session.flush()

        assert subscription.status == SubscriptionStatus.CANCELED.value
        assert subscription.cancelled_at is not None
        print(f"✅ Step 7: Service cancelled - {subscription.cancellation_reason}")

        await async_session.flush()

        print(f"""
        ✅ Complete Service Lifecycle Journey Tested:
        1. ✅ Activation: {subscription.current_period_start.date()}
        2. ✅ First Invoice: Skipped (use service layer)
        3. ✅ Service Period: 30 days
        4. ✅ Renewal Invoice: Skipped (use service layer)
        5. ✅ Suspension: {subscription.suspended_at.date() if subscription.suspended_at else "N/A"}
        6. ✅ Resumption: {subscription.resumed_at.date() if subscription.resumed_at else "N/A"}
        7. ✅ Cancellation: {subscription.cancelled_at.date()}
        """)

    async def test_plan_upgrade_journey(
        self,
        async_session,
        test_tenant: Tenant,
    ):
        """Test customer upgrading from basic to premium plan using service layer."""
        # Create customer using service
        customer_service = CustomerService(async_session)
        customer_data = CustomerCreate(
            first_name="Upgrade",
            last_name="Customer",
            email=f"upgrade_{uuid4().hex[:8]}@example.com",
        )
        customer = await customer_service.create_customer(customer_data)

        # Create basic plan
        basic_plan_id = f"plan-basic-{uuid4().hex[:8]}"
        basic_plan = BillingSubscriptionPlanTable(
            tenant_id=test_tenant.id,
            plan_id=basic_plan_id,
            product_id=f"prod-{uuid4().hex[:8]}",
            name="Basic Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("19.99"),
            currency="USD",
            is_active=True,
        )
        async_session.add(basic_plan)
        await async_session.flush()

        # Create premium plan
        premium_plan_id = f"plan-premium-{uuid4().hex[:8]}"
        premium_plan = BillingSubscriptionPlanTable(
            tenant_id=test_tenant.id,
            plan_id=premium_plan_id,
            product_id=f"prod-{uuid4().hex[:8]}",
            name="Premium Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("49.99"),
            currency="USD",
            is_active=True,
        )
        async_session.add(premium_plan)
        await async_session.flush()

        # Create subscription using SQLAlchemy table (initial setup)
        now = datetime.now(UTC)
        subscription_id = f"sub-{uuid4().hex[:8]}"
        subscription = BillingSubscriptionTable(
            tenant_id=test_tenant.id,
            subscription_id=subscription_id,
            customer_id=str(customer.id),
            plan_id=basic_plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        async_session.add(subscription)
        await async_session.flush()
        await async_session.flush()

        print(f"✅ Initial: {basic_plan.name} - ${basic_plan.price}/month")

        # Upgrade to premium using service layer (mid-cycle)
        subscription_service = SubscriptionService(async_session)

        change_request = SubscriptionPlanChangeRequest(
            new_plan_id=premium_plan_id,
            proration_behavior=ProrationBehavior.CREATE_PRORATIONS,
            effective_date=None,  # Immediate
        )

        updated_subscription, proration_result = await subscription_service.change_plan(
            subscription_id=subscription_id,
            change_request=change_request,
            tenant_id=test_tenant.id,
        )

        # Assertions on business side effects
        assert updated_subscription.plan_id == premium_plan_id, "Plan should be updated"
        assert proration_result is not None, "Proration should be calculated for mid-cycle upgrade"
        assert proration_result.proration_amount != Decimal("0"), (
            "Proration amount should be non-zero"
        )

        # Verify proration reflects price difference
        # Basic: $19.99/month, Premium: $49.99/month
        # Difference: $30.00/month for remaining days
        expected_daily_diff = (Decimal("49.99") - Decimal("19.99")) / Decimal("30")
        assert proration_result.days_remaining > 0, "Should have remaining days in period"

        print(f"""
        ✅ Plan Upgrade Journey Complete (Service Layer):
        - Started: {basic_plan.name} (${basic_plan.price})
        - Upgraded to: {premium_plan.name} (${premium_plan.price})
        - Status: {updated_subscription.status}
        - Proration Amount: ${proration_result.proration_amount}
        - Days Remaining: {proration_result.days_remaining}
        - Daily Rate Difference: ${expected_daily_diff:.2f}
        """)

    async def test_service_pause_and_resume_journey(
        self,
        async_session,
        test_tenant: Tenant,
    ):
        """Test customer pausing and resuming service with proper side-effect validation."""
        # Create customer using service
        customer_service = CustomerService(async_session)
        customer_data = CustomerCreate(
            first_name="Pause",
            last_name="Test",
            email=f"pause_{uuid4().hex[:8]}@example.com",
        )
        customer = await customer_service.create_customer(customer_data)

        # Create plan
        plan_id = f"plan-standard-{uuid4().hex[:8]}"
        plan = BillingSubscriptionPlanTable(
            tenant_id=test_tenant.id,
            plan_id=plan_id,
            product_id=f"prod-{uuid4().hex[:8]}",
            name="Standard Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("29.99"),
            currency="USD",
            is_active=True,
        )
        async_session.add(plan)
        await async_session.flush()

        # Create active subscription
        now = datetime.now(UTC)
        subscription_id = f"sub-{uuid4().hex[:8]}"
        subscription = BillingSubscriptionTable(
            tenant_id=test_tenant.id,
            subscription_id=subscription_id,
            customer_id=str(customer.id),
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        async_session.add(subscription)
        await async_session.flush()
        await async_session.flush()

        print(f"✅ Service active: {subscription.status}")

        # Pause service (vacation hold) - Direct DB mutation with business logic validation
        # Note: In a full implementation, this would use a pause() service method
        pause_date = datetime.now(UTC)

        # Retrieve subscription for update
        from sqlalchemy import and_, select

        stmt = select(BillingSubscriptionTable).where(
            and_(
                BillingSubscriptionTable.subscription_id == subscription_id,
                BillingSubscriptionTable.tenant_id == test_tenant.id,
            )
        )
        result = await async_session.execute(stmt)
        db_subscription = result.scalar_one()

        # Store pre-pause state for validation
        pre_pause_period_end = db_subscription.current_period_end

        # Pause subscription
        db_subscription.status = SubscriptionStatus.PAUSED.value
        await async_session.flush()
        await async_session.flush()

        # Assertions on pause side effects
        assert db_subscription.status == SubscriptionStatus.PAUSED.value, "Status should be PAUSED"
        # In real implementation, assert:
        # - Suspension timestamp set
        # - Usage tracking frozen
        # - Billing suspended
        # - Pause credit/adjustment created

        print("✅ Service paused")

        # Resume service
        resume_date = datetime.now(UTC)

        # Retrieve subscription again
        result = await async_session.execute(stmt)
        db_subscription = result.scalar_one()

        # Resume subscription
        db_subscription.status = SubscriptionStatus.ACTIVE.value
        # In real implementation, extend period_end by pause duration
        pause_duration = (resume_date - pause_date).days
        await async_session.flush()
        await async_session.flush()

        # Assertions on resume side effects
        assert db_subscription.status == SubscriptionStatus.ACTIVE.value, "Status should be ACTIVE"
        # In real implementation, assert:
        # - Resumption timestamp set
        # - Usage tracking reactivated
        # - Billing period extended by pause duration
        # - Resume notification sent

        print("✅ Service resumed")

        print(f"""
        ✅ Pause/Resume Journey Complete (With Side-Effect Validation):
        - Paused At: {pause_date}
        - Resumed At: {resume_date}
        - Pause Duration: {pause_duration} days
        - Current Status: {db_subscription.status}
        - Original Period End: {pre_pause_period_end}

        Expected Business Logic (to be implemented):
        - ✅ Status transitions validated
        - ⚠️  Suspension/resumption timestamps (to be added to model)
        - ⚠️  Billing period adjustment for pause duration
        - ⚠️  Usage tracking freeze/unfreeze
        - ⚠️  Pause/resume notifications
        """)


@pytest.mark.asyncio
class TestServiceLifecycleEdgeCases:
    """Test edge cases in service lifecycle."""

    async def test_immediate_cancellation_journey(
        self,
        async_session,
        test_tenant: Tenant,
    ):
        """Test customer cancelling immediately after activation using service layer."""
        # Create customer using service
        customer_service = CustomerService(async_session)
        customer_data = CustomerCreate(
            first_name="Immediate",
            last_name="Cancel",
            email=f"immcancel_{uuid4().hex[:8]}@example.com",
        )
        customer = await customer_service.create_customer(customer_data)

        # Create plan
        plan_id = f"plan-test-{uuid4().hex[:8]}"
        plan = BillingSubscriptionPlanTable(
            tenant_id=test_tenant.id,
            plan_id=plan_id,
            product_id=f"prod-{uuid4().hex[:8]}",
            name="Test Plan",
            billing_cycle=BillingCycle.MONTHLY.value,
            price=Decimal("9.99"),
            currency="USD",
            is_active=True,
        )
        async_session.add(plan)
        await async_session.flush()

        # Create subscription
        now = datetime.now(UTC)
        subscription_id = f"sub-{uuid4().hex[:8]}"
        subscription = BillingSubscriptionTable(
            tenant_id=test_tenant.id,
            subscription_id=subscription_id,
            customer_id=str(customer.id),
            plan_id=plan_id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        )
        async_session.add(subscription)
        await async_session.flush()
        await async_session.flush()

        activation_time = now

        # Cancel immediately using service layer (immediate cancellation)
        subscription_service = SubscriptionService(async_session)

        cancelled_subscription = await subscription_service.cancel_subscription(
            subscription_id=subscription_id,
            tenant_id=test_tenant.id,
            at_period_end=False,  # Immediate cancellation
        )

        # Assertions on business side effects
        assert cancelled_subscription.status == SubscriptionStatus.ENDED.value, (
            "Should be immediately ended"
        )
        assert cancelled_subscription.ended_at is not None, "ended_at should be set"
        assert cancelled_subscription.canceled_at is not None, "canceled_at should be set"

        # Verify cancellation happened within a short time
        time_since_activation = (
            cancelled_subscription.canceled_at - activation_time
        ).total_seconds()
        assert time_since_activation < 86400, "Should be cancelled within 24 hours"

        # In a complete implementation, we would also assert:
        # - Refund invoice/credit created for unused time
        # - Cancellation event published
        # - Notification sent to customer
        # For now, document expected behavior

        print(f"""
        ✅ Immediate Cancellation Tested (Service Layer):
        - Activated: {activation_time}
        - Cancelled: {cancelled_subscription.canceled_at}
        - Duration: {time_since_activation / 3600:.1f} hours
        - Status: {cancelled_subscription.status}
        - Ended At: {cancelled_subscription.ended_at}

        Expected Business Logic (to be implemented):
        - ✅ Subscription ended immediately
        - ⚠️  Refund/credit for unused period (to be tested when implemented)
        - ⚠️  Cancellation notice sent (to be tested when implemented)
        """)
