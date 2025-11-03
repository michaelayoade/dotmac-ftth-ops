"""
E2E Test Fixtures for Tenant Portal Billing Integration.

Creates realistic billing data for testing the tenant portal UI:
- Multiple invoices (draft, open, overdue, paid)
- Multiple payments (successful, failed, pending)
- Complete billing history for a tenant
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    PaymentEntity,
    PaymentInvoiceEntity,
)
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentMethodType, PaymentStatus
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus


@pytest_asyncio.fixture
async def tenant_portal_billing_data(async_session: AsyncSession):
    """
    Create comprehensive billing data for tenant portal E2E testing.

    Creates:
    - 1 active tenant
    - 10 invoices (various statuses)
    - 15 payments (various statuses)
    - Realistic date ranges and amounts
    """
    tenant_id = f"e2e-tenant-{uuid4().hex[:8]}"
    customer_id = f"e2e-customer-{uuid4().hex[:8]}"

    # Create tenant
    tenant = Tenant(
        id=tenant_id,
        name="E2E Test Corporation",
        slug="e2e-test-corp",
        email="billing@e2e-test.com",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
        billing_cycle=BillingCycle.MONTHLY,
        billing_email="billing@e2e-test.com",
        max_users=25,
        max_api_calls_per_month=500000,
        max_storage_gb=100,
        current_users=15,
        current_api_calls=125000,
        current_storage_gb=45.5,
        created_at=datetime.now(UTC) - timedelta(days=365),
    )
    async_session.add(tenant)

    # Generate invoices with variety of statuses
    invoices = []

    # 1. Overdue invoices (2)
    for i in range(2):
        invoice = InvoiceEntity(
            invoice_id=str(uuid4()),
            tenant_id=tenant_id,
            invoice_number=f"INV-2025-{1001 + i}",
            customer_id=customer_id,
            billing_email="billing@e2e-test.com",
            billing_address={
                "name": "E2E Test Corporation",
                "street": "123 Test Street",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94105",
                "country": "US",
            },
            issue_date=datetime.now(UTC) - timedelta(days=45 + i * 10),
            due_date=datetime.now(UTC) - timedelta(days=15 + i * 5),  # Past due
            currency="USD",
            subtotal=299900,  # $2,999.00
            tax_amount=24999,  # $249.99 (CA tax)
            discount_amount=0,
            total_amount=324899,  # $3,248.99
            remaining_balance=324899,  # Unpaid
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.FAILED,
            created_at=datetime.now(UTC) - timedelta(days=46 + i * 10),
        )
        invoices.append(invoice)
        async_session.add(invoice)

    # 2. Open invoices due soon (3)
    for i in range(3):
        invoice = InvoiceEntity(
            invoice_id=str(uuid4()),
            tenant_id=tenant_id,
            invoice_number=f"INV-2025-{1003 + i}",
            customer_id=customer_id,
            billing_email="billing@e2e-test.com",
            billing_address={
                "name": "E2E Test Corporation",
                "street": "123 Test Street",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94105",
                "country": "US",
            },
            issue_date=datetime.now(UTC) - timedelta(days=5 + i * 2),
            due_date=datetime.now(UTC) + timedelta(days=15 + i * 5),  # Due soon
            currency="USD",
            subtotal=299900,  # $2,999.00
            tax_amount=24999,  # $249.99
            discount_amount=0,
            total_amount=324899,  # $3,248.99
            remaining_balance=324899,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
            created_at=datetime.now(UTC) - timedelta(days=6 + i * 2),
        )
        invoices.append(invoice)
        async_session.add(invoice)

    # 3. Paid invoices (4)
    for i in range(4):
        invoice = InvoiceEntity(
            invoice_id=str(uuid4()),
            tenant_id=tenant_id,
            invoice_number=f"INV-2025-{1006 + i}",
            customer_id=customer_id,
            billing_email="billing@e2e-test.com",
            billing_address={
                "name": "E2E Test Corporation",
                "street": "123 Test Street",
                "city": "San Francisco",
                "state": "CA",
                "zip": "94105",
                "country": "US",
            },
            issue_date=datetime.now(UTC) - timedelta(days=60 + i * 30),
            due_date=datetime.now(UTC) - timedelta(days=30 + i * 30),
            currency="USD",
            subtotal=299900,  # $2,999.00
            tax_amount=24999,  # $249.99
            discount_amount=0,
            total_amount=324899,  # $3,248.99
            remaining_balance=0,  # Fully paid
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.PAID,
            payment_status=PaymentStatus.SUCCEEDED,
            paid_at=datetime.now(UTC) - timedelta(days=35 + i * 30),
            created_at=datetime.now(UTC) - timedelta(days=61 + i * 30),
        )
        invoices.append(invoice)
        async_session.add(invoice)

    # 4. Draft invoice (1)
    draft_invoice = InvoiceEntity(
        invoice_id=str(uuid4()),
        tenant_id=tenant_id,
        invoice_number=f"INV-2025-{1010}",
        customer_id=customer_id,
        billing_email="billing@e2e-test.com",
        billing_address={
            "name": "E2E Test Corporation",
            "street": "123 Test Street",
            "city": "San Francisco",
            "state": "CA",
            "zip": "94105",
            "country": "US",
        },
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=299900,  # $2,999.00
        tax_amount=24999,  # $249.99
        discount_amount=0,
        total_amount=324899,  # $3,248.99
        remaining_balance=324899,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.DRAFT,
        payment_status=PaymentStatus.PENDING,
        created_at=datetime.now(UTC),
    )
    invoices.append(draft_invoice)
    async_session.add(draft_invoice)

    # Generate payments with variety of statuses
    payments = []

    # 1. Successful payments for paid invoices (4)
    paid_invoices = [inv for inv in invoices if inv.status == InvoiceStatus.PAID]
    for i, invoice in enumerate(paid_invoices):
        payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=324899,  # $3,248.99
            currency="USD",
            status=PaymentStatus.SUCCEEDED,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={
                "last_four": "4242",
                "brand": "visa",
                "exp_month": 12,
                "exp_year": 2026,
            },
            provider="stripe",
            provider_payment_id=f"pi_test_success_{uuid4().hex[:8]}",
            provider_fee=972,  # 2.9% + $0.30 = $97.17
            created_at=datetime.now(UTC) - timedelta(days=35 + i * 30),
        )
        payments.append(payment)
        async_session.add(payment)
        async_session.add(
            PaymentInvoiceEntity(
                payment_id=payment.payment_id,
                invoice_id=invoice.invoice_id,
                amount_applied=payment.amount,
            )
        )

    # 2. Failed payments (attempts for overdue invoices) (4)
    for i in range(4):
        invoices[0] if i < 2 else invoices[1]
        payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=324899,  # $3,248.99
            currency="USD",
            status=PaymentStatus.FAILED,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={
                "last_four": "0002",  # Test card that fails
                "brand": "visa",
                "exp_month": 12,
                "exp_year": 2026,
            },
            provider="stripe",
            provider_payment_id=None,
            provider_fee=0,
            failure_reason="Your card was declined. Please use a different payment method.",
            retry_count=i + 1,
            created_at=datetime.now(UTC) - timedelta(days=10 + i * 3),
        )
        payments.append(payment)
        async_session.add(payment)

    # 3. Pending/Processing payments (3)
    for i in range(3):
        status = PaymentStatus.PENDING if i % 2 == 0 else PaymentStatus.PROCESSING
        invoices[2 + i]
        payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=324899,  # $3,248.99
            currency="USD",
            status=status,
            payment_method_type=PaymentMethodType.BANK_ACCOUNT,
            payment_method_details={
                "account_last_four": "6789",
                "bank_name": "Test Bank",
            },
            provider="stripe",
            provider_payment_id=f"pi_test_{status.value.lower()}_{uuid4().hex[:8]}",
            provider_fee=0,  # ACH transfers have no fee
            retry_count=0,
            created_at=datetime.now(UTC) - timedelta(days=2 + i),
        )
        payments.append(payment)
        async_session.add(payment)

    # 4. Recent successful payments (4)
    for i in range(4):
        payment = PaymentEntity(
            payment_id=str(uuid4()),
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=99900,  # $999.00 (smaller add-on charges)
            currency="USD",
            status=PaymentStatus.SUCCEEDED,
            payment_method_type=PaymentMethodType.CARD,
            payment_method_details={
                "last_four": "4242",
                "brand": "visa",
                "exp_month": 12,
                "exp_year": 2026,
            },
            provider="stripe",
            provider_payment_id=f"pi_test_addon_{uuid4().hex[:8]}",
            provider_fee=320,  # 2.9% + $0.30 = $29.27 + $0.30
            retry_count=0,
            created_at=datetime.now(UTC) - timedelta(days=i * 7),
        )
        payments.append(payment)
        async_session.add(payment)

    await async_session.commit()

    return {
        "tenant": tenant,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "invoices": invoices,
        "payments": payments,
        "summary": {
            "total_invoices": len(invoices),
            "open_invoices": len([i for i in invoices if i.status == InvoiceStatus.OPEN]),
            "overdue_invoices": len(
                [
                    i
                    for i in invoices
                    if i.status == InvoiceStatus.OPEN and i.due_date < datetime.now(UTC)
                ]
            ),
            "paid_invoices": len([i for i in invoices if i.status == InvoiceStatus.PAID]),
            "total_payments": len(payments),
            "successful_payments": len(
                [p for p in payments if p.status == PaymentStatus.SUCCEEDED]
            ),
            "failed_payments": len([p for p in payments if p.status == PaymentStatus.FAILED]),
            "pending_payments": len(
                [
                    p
                    for p in payments
                    if p.status in [PaymentStatus.PENDING, PaymentStatus.PROCESSING]
                ]
            ),
        },
    }


@pytest_asyncio.fixture
async def minimal_tenant_billing_data(async_session: AsyncSession):
    """
    Create minimal billing data for smoke testing.

    Creates:
    - 1 active tenant
    - 1 open invoice
    - 1 successful payment
    """
    tenant_id = f"minimal-tenant-{uuid4().hex[:8]}"
    customer_id = f"minimal-customer-{uuid4().hex[:8]}"

    # Create tenant
    tenant = Tenant(
        id=tenant_id,
        name="Minimal Test Tenant",
        slug="minimal-test",
        email="test@minimal.com",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.STARTER,
        billing_cycle=BillingCycle.MONTHLY,
        created_at=datetime.now(UTC) - timedelta(days=30),
    )
    async_session.add(tenant)

    # Create one open invoice
    invoice = InvoiceEntity(
        invoice_id=str(uuid4()),
        tenant_id=tenant_id,
        invoice_number="INV-2025-MIN-001",
        customer_id=customer_id,
        billing_email="test@minimal.com",
        billing_address={"street": "123 Main St", "city": "Test City", "country": "US"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=9900,  # $99.00
        tax_amount=0,
        discount_amount=0,
        total_amount=9900,
        remaining_balance=9900,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.OPEN,
        payment_status=PaymentStatus.PENDING,
        created_at=datetime.now(UTC),
    )
    async_session.add(invoice)

    # Create one successful payment
    payment = PaymentEntity(
        payment_id=str(uuid4()),
        tenant_id=tenant_id,
        customer_id=customer_id,
        amount=9900,  # $99.00
        currency="USD",
        status=PaymentStatus.SUCCEEDED,
        payment_method_type=PaymentMethodType.CARD,
        payment_method_details={"last_four": "4242", "brand": "visa"},
        provider="stripe",
        provider_payment_id=f"pi_minimal_{uuid4().hex[:8]}",
        provider_fee=320,
        created_at=datetime.now(UTC) - timedelta(days=5),
    )
    async_session.add(payment)

    await async_session.commit()

    return {
        "tenant": tenant,
        "tenant_id": tenant_id,
        "customer_id": customer_id,
        "invoice": invoice,
        "payment": payment,
    }
