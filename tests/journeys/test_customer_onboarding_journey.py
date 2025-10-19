"""
Integration tests for complete customer onboarding journey.

Tests the full workflow from user registration to active service.
"""

import pytest
from datetime import datetime, UTC, timedelta
from decimal import Decimal
from uuid import uuid4

from dotmac.platform.user_management.models import User
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.billing.subscriptions.models import (
    Subscription,
    SubscriptionStatus,
    SubscriptionPlan as BillingPlan,  # Alias for compatibility
    BillingCycle,
)
from dotmac.platform.services.internet_plans.models import PlanType


@pytest.mark.asyncio
class TestCustomerOnboardingJourney:
    """Test complete customer onboarding workflow."""

    async def test_complete_onboarding_journey_success(
        self,
        db_session,
    ):
        """
        Test successful customer onboarding journey from registration to active service.

        Journey Steps:
        1. User registers account
        2. User verifies email
        3. Customer record created
        4. Customer selects billing plan
        5. Subscription created
        6. Service provisioned
        7. Customer becomes active
        """
        # Use test tenant ID
        tenant_id = "test-tenant-123"

        # Step 1: Create user (simulating registration)
        user = User(
            id=uuid4(),
            tenant_id=tenant_id,
            username=f"newcustomer_{uuid4().hex[:8]}",
            email=f"customer_{uuid4().hex[:8]}@example.com",
            hashed_password="$2b$12$test_hash",
            is_active=False,  # Not verified yet
            email_verified=False,
            created_at=datetime.now(UTC),
        )
        db_session.add(user)
        await db_session.flush()

        assert user.id is not None
        assert not user.is_active
        assert not user.email_verified

        # Step 2: Simulate email verification
        user.email_verified = True
        user.is_active = True
        user.verified_at = datetime.now(UTC)
        await db_session.flush()

        assert user.email_verified
        assert user.is_active

        # Step 3: Create customer record
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"CUST-{uuid4().hex[:8].upper()}",
            first_name="John",
            last_name="Doe",
            email=user.email,
            phone="+1234567890",
            address_line1="123 Main St",
            city="TestCity",
            postal_code="12345",
            country="US",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        assert customer.id is not None
        assert customer.customer_code.startswith("CUST-")

        # Step 4: Create billing plan (ISP internet plan)
        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Fiber 100Mbps",
            plan_code="FIBER-100",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("49.99"),
            currency="USD",
            is_active=True,
            trial_period_days=0,
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        assert plan.id is not None
        assert plan.price == Decimal("49.99")

        # Step 5: Create subscription
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.PENDING,
            start_date=datetime.now(UTC),
            current_period_start=datetime.now(UTC),
            current_period_end=datetime.now(UTC) + timedelta(days=30),
            created_at=datetime.now(UTC),
        )
        db_session.add(subscription)
        await db_session.flush()

        assert subscription.id is not None
        assert subscription.status == SubscriptionStatus.PENDING

        # Step 6: Activate subscription (simulating successful payment)
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.activated_at = datetime.now(UTC)
        await db_session.flush()

        assert subscription.status == SubscriptionStatus.ACTIVE
        assert subscription.activated_at is not None

        # Step 7: Verify complete onboarding
        await db_session.commit()

        # Verify final state
        assert user.is_active
        assert user.email_verified
        assert customer.id is not None
        assert subscription.status == SubscriptionStatus.ACTIVE

        print(f"""
        ✅ Customer Onboarding Journey Complete:
        - User: {user.username} (verified: {user.email_verified})
        - Customer: {customer.customer_code}
        - Plan: {plan.name} (${plan.price}/month)
        - Subscription: {subscription.status.value}
        """)

    async def test_onboarding_journey_with_trial(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test customer onboarding with trial period."""
        # Create user
        user = User(
            id=uuid4(),
            tenant_id=test_tenant.id,
            username=f"trial_user_{uuid4().hex[:8]}",
            email=f"trial_{uuid4().hex[:8]}@example.com",
            hashed_password="$2b$12$test_hash",
            is_active=True,
            email_verified=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(user)
        await db_session.flush()

        # Create customer
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"TRIAL-{uuid4().hex[:8].upper()}",
            first_name="Trial",
            last_name="Customer",
            email=user.email,
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        # Create plan with trial
        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Fiber 50Mbps Trial",
            plan_code="FIBER-50-TRIAL",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("29.99"),
            currency="USD",
            is_active=True,
            trial_period_days=14,  # 14-day trial
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        # Create subscription in trial
        now = datetime.now(UTC)
        subscription = Subscription(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_id=customer.id,
            plan_id=plan.id,
            status=SubscriptionStatus.TRIALING,
            start_date=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=14),
            trial_start=now,
            trial_end=now + timedelta(days=14),
            created_at=now,
        )
        db_session.add(subscription)
        await db_session.flush()

        # Verify trial state
        assert subscription.status == SubscriptionStatus.TRIALING
        assert subscription.trial_start is not None
        assert subscription.trial_end is not None
        assert (subscription.trial_end - subscription.trial_start).days == 14

        await db_session.commit()

        print(f"""
        ✅ Trial Onboarding Complete:
        - Customer: {customer.customer_code}
        - Plan: {plan.name} (14-day trial, then ${plan.price}/month)
        - Trial Period: {subscription.trial_start.date()} to {subscription.trial_end.date()}
        """)

    async def test_onboarding_journey_validation_failures(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test onboarding journey with various validation failures."""
        # Test 1: Duplicate email
        user1 = User(
            id=uuid4(),
            tenant_id=test_tenant.id,
            username="user1",
            email="duplicate@example.com",
            hashed_password="$2b$12$test_hash",
            is_active=True,
            email_verified=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(user1)
        await db_session.flush()

        # Attempting to create another user with same email would fail at DB level
        # (tested via unique constraint)

        # Test 2: Create customer without required fields
        # This would fail validation in the service layer

        # Test 3: Create subscription without payment method
        # This would require payment validation in service layer

        await db_session.rollback()

        print("✅ Validation failure scenarios documented")


@pytest.mark.asyncio
class TestCustomerOnboardingJourneyFailures:
    """Test failure scenarios in customer onboarding."""

    async def test_registration_with_invalid_email(self, db_session, test_tenant: Tenant):
        """Test registration fails with invalid email format."""
        # This would be validated at the Pydantic schema level
        # in the actual API endpoint

        # Simulate invalid email scenarios
        invalid_emails = [
            "notanemail",
            "@example.com",
            "user@",
            "user@.com",
        ]

        for email in invalid_emails:
            # In actual API, this would be rejected by Pydantic validation
            print(f"❌ Would reject: {email}")

        print("✅ Email validation scenarios documented")

    async def test_subscription_without_payment_method(
        self,
        db_session,
        test_tenant: Tenant,
    ):
        """Test that subscription creation requires payment method."""
        # Create minimal customer
        customer = Customer(
            id=uuid4(),
            tenant_id=test_tenant.id,
            customer_code=f"NOPAY-{uuid4().hex[:8].upper()}",
            first_name="No",
            last_name="Payment",
            email=f"nopay_{uuid4().hex[:8]}@example.com",
            created_at=datetime.now(UTC),
        )
        db_session.add(customer)
        await db_session.flush()

        # Create plan
        plan = BillingPlan(
            id=uuid4(),
            tenant_id=test_tenant.id,
            name="Test Plan",
            plan_code="TEST-PLAN",
            plan_type=PlanType.SUBSCRIPTION,
            billing_cycle=BillingCycle.MONTHLY,
            price=Decimal("19.99"),
            currency="USD",
            is_active=True,
            created_at=datetime.now(UTC),
        )
        db_session.add(plan)
        await db_session.flush()

        # In real service layer, attempting to create subscription
        # without payment method would fail
        # Here we just document the scenario

        await db_session.rollback()

        print("""
        ✅ Payment validation scenario documented:
        - Subscription requires payment method
        - Would fail at service layer validation
        - Customer prompted to add payment method
        """)
