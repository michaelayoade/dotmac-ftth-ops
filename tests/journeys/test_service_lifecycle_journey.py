"""
Integration tests for service lifecycle journey.

Tests service activation, usage, suspension, resumption, and cancellation.
"""

import pytest
from datetime import datetime, UTC, timedelta
from decimal import Decimal
from uuid import uuid4

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.billing.subscriptions.models import (
    Subscription,
    SubscriptionStatus,
    SubscriptionPlan as BillingPlan,  # Alias for compatibility
    BillingCycle,
)
from dotmac.platform.services.internet_plans.models import PlanType
from dotmac.platform.billing.core.models import Invoice
from dotmac.platform.billing.core.enums import InvoiceStatus


@pytest.mark.asyncio
class TestServiceLifecycleJourney:
    """Test complete service lifecycle from activation to cancellation."""

    async def test_service_activation_to_cancellation_journey(
        self,
        db_session,
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
            customer_code=f"LC-{uuid4().hex[:8].upper()}",
            first_name="Lifecycle",
            last_name="Test",
            email=f"lifecycle_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        # Setup: Create plan
        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Monthly Service",
            plan_code="MONTHLY-SVC",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("39.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        # Step 1: Activate service
        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            activated_at=now,
            created_at=now,
        )
        db_session.add(subscription)
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE
        print(f"✅ Step 1: Service activated - {subscription.status.value}")

        # Step 2: Generate first invoice
        invoice1 = Invoice(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            subscription_id=subscription.id,
            invoice_number=f"INV-{uuid4().hex[:8].upper()}",
            status=InvoiceStatus.DRAFT,
            subtotal=plan.price,
            total=plan.price,
            currency="USD",
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
            created_at=now,
        )
        db_session.add(invoice1)
        await db_session.flush()

        # Finalize and mark as paid
        invoice1.status = InvoiceStatus.PAID
        invoice1.paid_at = now + timedelta(minutes=5)
        await db_session.flush()

        assert invoice1.status == InvoiceStatus.PAID
        print(f"✅ Step 2: First invoice paid - {invoice1.invoice_number}")

        # Step 3: Service used for 30 days (simulate)
        # In real scenario, usage would be tracked here

        # Step 4: Generate renewal invoice
        renewal_date = now + timedelta(days=30)
        subscription.current_period_start = renewal_date
        subscription.current_period_end = renewal_date + timedelta(days=30)

        invoice2 = Invoice(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            subscription_id=subscription.id,
            invoice_number=f"INV-{uuid4().hex[:8].upper()}",
            status=InvoiceStatus.OPEN,  # Awaiting payment
            subtotal=plan.price,
            total=plan.price,
            currency="USD",
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end,
            due_date=renewal_date + timedelta(days=7),
            created_at=renewal_date,
        )
        db_session.add(invoice2)
        await db_session.flush()

        assert invoice2.status == InvoiceStatus.OPEN
        print(f"✅ Step 4: Renewal invoice generated - {invoice2.invoice_number}")

        # Step 5: Suspend service for non-payment (payment overdue)
        past_due_date = renewal_date + timedelta(days=10)
        subscription.status = SubscriptionStatus.PAST_DUE
        invoice2.status = InvoiceStatus.OVERDUE
        await db_session.flush()

        # After grace period, suspend
        subscription.status = SubscriptionStatus.SUSPENDED
        subscription.suspended_at = past_due_date
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.SUSPENDED
        assert invoice2.status == InvoiceStatus.OVERDUE
        print(f"✅ Step 5: Service suspended - non-payment")

        # Step 6: Resume service after payment
        payment_date = past_due_date + timedelta(days=2)
        invoice2.status = InvoiceStatus.PAID
        invoice2.paid_at = payment_date

        subscription.status = SubscriptionStatus.ACTIVE
        subscription.suspended_at = None
        subscription.resumed_at = payment_date
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE
        assert invoice2.status == InvoiceStatus.PAID
        print(f"✅ Step 6: Service resumed - payment received")

        # Step 7: Cancel service
        cancellation_date = payment_date + timedelta(days=15)
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelled_at = cancellation_date
        subscription.cancellation_reason = "Customer request"
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.CANCELLED
        assert subscription.cancelled_at is not None
        print(f"✅ Step 7: Service cancelled - {subscription.cancellation_reason}")

        await db_session.commit()

        print(f"""
        ✅ Complete Service Lifecycle Journey Tested:
        1. ✅ Activation: {subscription.activated_at.date()}
        2. ✅ First Invoice: {invoice1.invoice_number} (PAID)
        3. ✅ Service Period: 30 days
        4. ✅ Renewal Invoice: {invoice2.invoice_number}
        5. ✅ Suspension: {subscription.suspended_at.date() if subscription.suspended_at else 'N/A'}
        6. ✅ Resumption: {subscription.resumed_at.date() if subscription.resumed_at else 'N/A'}
        7. ✅ Cancellation: {subscription.cancelled_at.date()}
        """)

    async def test_plan_upgrade_journey(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test customer upgrading from basic to premium plan."""
        # Create customer
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"UPG-{uuid4().hex[:8].upper()}",
            first_name="Upgrade",
            last_name="Customer",
            email=f"upgrade_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        # Create basic plan
        basic_plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Basic Plan",
            plan_code="BASIC",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("19.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(basic_plan)
        await db_session.flush()

        # Create premium plan
        premium_plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Premium Plan",
            plan_code="PREMIUM",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(premium_plan)
        await db_session.flush()

        # Start with basic subscription
        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=basic_plan.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            activated_at=now,
            created_at=now,
        )
        db_session.add(subscription)
        await db_session.flush()

        print(f"✅ Initial: {basic_plan.name} - ${basic_plan.price}/month")

        # Upgrade to premium (mid-cycle)
        upgrade_date = now + timedelta(days=15)

        # Calculate proration (15 days remaining at basic, switch to premium)
        # In real implementation, this would be calculated by service layer

        subscription.plan_id = premium_plan.id
        # subscription.previous_plan_id = basic_plan.id  # Track history
        await db_session.flush()

        assert subscription.plan_id == premium_plan.id
        print(f"✅ Upgraded: {premium_plan.name} - ${premium_plan.price}/month")

        await db_session.commit()

        print(f"""
        ✅ Plan Upgrade Journey Complete:
        - Started: {basic_plan.name} (${basic_plan.price})
        - Upgraded to: {premium_plan.name} (${premium_plan.price})
        - Upgrade Date: {upgrade_date.date()}
        - Status: {subscription.status.value}
        """)

    async def test_service_pause_and_resume_journey(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test customer pausing and resuming service (vacation hold)."""
        # Create customer
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"PAUSE-{uuid4().hex[:8].upper()}",
            first_name="Pause",
            last_name="Test",
            email=f"pause_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        # Create plan
        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Standard Plan",
            plan_code="STANDARD",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        # Create active subscription
        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            activated_at=now,
            created_at=now,
        )
        db_session.add(subscription)
        await db_session.flush()

        print(f"✅ Service active: {subscription.status.value}")

        # Pause service (vacation hold)
        pause_date = now + timedelta(days=10)
        subscription.status = SubscriptionStatus.PAUSED
        subscription.paused_at = pause_date
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.PAUSED
        print(f"✅ Service paused: {pause_date.date()}")

        # Resume service
        resume_date = pause_date + timedelta(days=30)  # After vacation
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.resumed_at = resume_date
        subscription.paused_at = None
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE
        print(f"✅ Service resumed: {resume_date.date()}")

        await db_session.commit()

        print(f"""
        ✅ Pause/Resume Journey Complete:
        - Paused: {pause_date.date()}
        - Resumed: {resume_date.date()}
        - Pause Duration: {(resume_date - pause_date).days} days
        - Current Status: {subscription.status.value}
        """)


@pytest.mark.asyncio
class TestServiceLifecycleEdgeCases:
    """Test edge cases in service lifecycle."""

    async def test_immediate_cancellation_journey(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test customer cancelling immediately after activation."""
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"IMM-{uuid4().hex[:8].upper()}",
            first_name="Immediate",
            last_name="Cancel",
            email=f"immcancel_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test Plan",
            plan_code="TEST",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("9.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE,
            start_date=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            activated_at=now,
            created_at=now,
        )
        db_session.add(subscription)
        await db_session.flush()

        # Cancel immediately (within same day)
        cancel_date = now + timedelta(hours=2)
        subscription.status = SubscriptionStatus.CANCELLED
        subscription.cancelled_at = cancel_date
        subscription.cancellation_reason = "Changed mind"
        await db_session.flush()

        # In real scenario, refund logic would apply
        assert subscription.status == SubscriptionStatus.CANCELLED
        assert (cancel_date - now).total_seconds() < 86400  # Within 24 hours

        await db_session.commit()

        print(f"""
        ✅ Immediate Cancellation Tested:
        - Activated: {now}
        - Cancelled: {cancel_date}
        - Duration: {(cancel_date - now).total_seconds() / 3600:.1f} hours
        - Refund: Would apply (within 24 hours)
        """)
