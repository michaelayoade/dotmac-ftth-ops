"""
Reusable test data factories for billing tests.

These factories create real database records for testing, eliminating the need
for mocking database operations.

Usage:
    async def test_payment(payment_factory):
        # Create real payment in test database
        payment = await payment_factory(amount=Decimal("100.00"))

        # Test with real data
        assert payment.amount == Decimal("100.00")

All factories use flush() instead of commit(), allowing the async_db_session
fixture to rollback all changes automatically at test teardown.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

# ============================================================================
# Customer Factories
# ============================================================================


@pytest_asyncio.fixture
async def customer_factory(async_db_session: AsyncSession, tenant_id: str):
    """
    Factory for creating test customers.

    Example:
        customer = await customer_factory(
            email="test@example.com",
            first_name="John"
        )
    """
    from dotmac.platform.customer_management.models import Customer

    async def _create(
        customer_id: str | None = None,
        email: str | None = None,
        first_name: str = "Test",
        last_name: str = "Customer",
        _commit: bool = False,
        **kwargs,
    ):
        # Generate proper UUID for customer_id
        customer_id = customer_id or uuid4()
        email = email or f"customer-{str(uuid4())[:8]}@test.example.com"

        customer = Customer(
            id=customer_id,
            tenant_id=tenant_id,
            customer_number=f"CUST-{str(uuid4())[:8].upper()}",
            email=email,
            first_name=first_name,
            last_name=last_name,
            **kwargs,
        )
        async_db_session.add(customer)

        if _commit:
            await async_db_session.commit()
            await async_db_session.refresh(customer)
        else:
            await async_db_session.flush()
            await async_db_session.refresh(customer)

        return customer

    yield _create
    # No cleanup needed - async_db_session rolls back automatically


# ============================================================================
# Subscription Factories
# ============================================================================


@pytest_asyncio.fixture
async def subscription_plan_factory(async_db_session: AsyncSession, tenant_id: str):
    """
    Factory for creating test subscription plans.

    Example:
        plan = await subscription_plan_factory(
            name="Basic Plan",
            price=Decimal("29.99")
        )
    """
    try:
        from dotmac.platform.billing.models import BillingSubscriptionPlanTable

        HAS_SUBSCRIPTIONS = True
    except ImportError:
        HAS_SUBSCRIPTIONS = False

    if not HAS_SUBSCRIPTIONS:
        yield lambda **kwargs: None
        return

    async def _create(
        plan_id: str | None = None,
        name: str = "Test Plan",
        price: Decimal = Decimal("29.99"),
        billing_cycle: str = "MONTHLY",
        _commit: bool = False,
        **kwargs,
    ):
        # Generate plan_id string (not UUID)
        plan_id = plan_id or f"plan_{str(uuid4())[:8]}"

        plan = BillingSubscriptionPlanTable(
            plan_id=plan_id,
            tenant_id=tenant_id,
            product_id=kwargs.pop("product_id", f"prod_{str(uuid4())[:8]}"),
            name=name,
            description=kwargs.pop("description", f"{name} description"),
            billing_cycle=billing_cycle,
            price=price,
            currency=kwargs.pop("currency", "USD"),
            is_active=kwargs.pop("is_active", True),
            **kwargs,
        )
        async_db_session.add(plan)

        if _commit:
            await async_db_session.commit()
            await async_db_session.refresh(plan)
        else:
            await async_db_session.flush()
            await async_db_session.refresh(plan)

        return plan

    yield _create
    # No cleanup needed - async_db_session rolls back automatically


@pytest_asyncio.fixture
async def subscription_factory(
    async_db_session: AsyncSession, tenant_id: str, customer_factory, subscription_plan_factory
):
    """
    Factory for creating test subscriptions.

    Automatically creates customer and plan if not provided.

    Example:
        subscription = await subscription_factory(
            status="ACTIVE",
            customer_id="cust_123"
        )
    """
    try:
        from dotmac.platform.billing.models import BillingSubscriptionTable

        HAS_SUBSCRIPTIONS = True
    except ImportError:
        HAS_SUBSCRIPTIONS = False

    if not HAS_SUBSCRIPTIONS:
        yield lambda **kwargs: None
        return

    async def _create(
        subscription_id: str | None = None,
        customer_id: str | None = None,
        plan_id: str | None = None,
        status: str = "active",
        **kwargs,
    ):
        # Generate subscription_id string (not UUID)
        subscription_id = subscription_id or f"sub_{str(uuid4())[:8]}"

        # Create customer if not provided
        if not customer_id:
            customer = await customer_factory()
            customer_id = str(customer.id)

        # Create plan if not provided
        if not plan_id:
            plan = await subscription_plan_factory()
            plan_id = plan.plan_id

        subscription = BillingSubscriptionTable(
            subscription_id=subscription_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            plan_id=plan_id,
            status=status,
            current_period_start=kwargs.pop("current_period_start", datetime.now(UTC)),
            current_period_end=kwargs.pop("current_period_end", datetime.now(UTC)),
            **kwargs,
        )
        async_db_session.add(subscription)
        await async_db_session.flush()
        await async_db_session.refresh(subscription)
        return subscription

    yield _create
    # No cleanup needed - async_db_session rolls back automatically


# ============================================================================
# Invoice Factories
# ============================================================================


@pytest_asyncio.fixture
async def invoice_factory(async_db_session: AsyncSession, tenant_id: str, customer_factory):
    """
    Factory for creating test invoices.

    Example:
        invoice = await invoice_factory(
            amount=Decimal("100.00"),
            status="pending"
        )
    """
    try:
        from dotmac.platform.billing.core.entities import InvoiceEntity
        from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus

        HAS_INVOICING = True
    except ImportError:
        HAS_INVOICING = False

    if not HAS_INVOICING:
        yield lambda **kwargs: None
        return

    async def _create(
        invoice_id: str | None = None,
        customer_id: str | None = None,
        amount: Decimal = Decimal("100.00"),
        status: str | InvoiceStatus = "draft",
        _commit: bool = False,
        **kwargs,
    ):
        # Generate invoice_id string (UUID format)
        invoice_id = invoice_id or str(uuid4())

        # Create customer if not provided
        if not customer_id:
            customer = await customer_factory(_commit=_commit)
            customer_id = str(customer.id)

        # Convert amount from dollars to cents (minor units)
        amount_cents = int(amount * 100)

        # Parse status - accept either string or enum
        if isinstance(status, str):
            status_map = {
                "draft": InvoiceStatus.DRAFT,
                "open": InvoiceStatus.OPEN,
                "paid": InvoiceStatus.PAID,
                "void": InvoiceStatus.VOID,
                "overdue": InvoiceStatus.OVERDUE,
                "partially_paid": InvoiceStatus.PARTIALLY_PAID,
            }
            normalized_status = status.lower()
            if normalized_status not in status_map:
                raise ValueError(
                    f"Invalid invoice status: {status!r}. "
                    f"Valid options: {', '.join(status_map.keys())}"
                )
            invoice_status = status_map[normalized_status]
        else:
            invoice_status = status

        invoice = InvoiceEntity(
            invoice_id=invoice_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            invoice_number=kwargs.pop("invoice_number", f"INV-{str(uuid4())[:8].upper()}"),
            billing_email=kwargs.pop("billing_email", f"test-{str(uuid4())[:8]}@example.com"),
            billing_address=kwargs.pop(
                "billing_address", {"street": "123 Test St", "city": "Test City"}
            ),
            currency=kwargs.pop("currency", "USD"),
            issue_date=kwargs.pop("issue_date", datetime.now(UTC)),
            due_date=kwargs.pop("due_date", datetime.now(UTC)),
            subtotal=kwargs.pop("subtotal", amount_cents),
            tax_amount=kwargs.pop("tax_amount", 0),
            discount_amount=kwargs.pop("discount_amount", 0),
            total_amount=kwargs.pop("total_amount", amount_cents),
            remaining_balance=kwargs.pop("remaining_balance", amount_cents),
            status=invoice_status,
            payment_status=kwargs.pop("payment_status", PaymentStatus.PENDING),
            **kwargs,
        )
        async_db_session.add(invoice)

        if _commit:
            await async_db_session.commit()
            await async_db_session.refresh(invoice)
        else:
            await async_db_session.flush()
            await async_db_session.refresh(invoice)

        return invoice

    yield _create
    # No cleanup needed - async_db_session rolls back automatically


# ============================================================================
# Payment Factories
# ============================================================================


@pytest_asyncio.fixture
async def payment_method_factory(async_db_session: AsyncSession, tenant_id: str, customer_factory):
    """
    Factory for creating test payment methods.

    Example:
        pm = await payment_method_factory(
            type="card",
            is_default=True
        )
    """
    try:
        from dotmac.platform.billing.core.entities import PaymentMethodEntity
        from dotmac.platform.billing.core.enums import PaymentMethodStatus, PaymentMethodType

        HAS_PAYMENT_METHODS = True
    except ImportError:
        HAS_PAYMENT_METHODS = False

    if not HAS_PAYMENT_METHODS:
        yield lambda **kwargs: None
        return

    async def _create(
        payment_method_id: str | None = None,
        customer_id: str | None = None,
        method_type: str = "card",
        is_default: bool = False,
        **kwargs,
    ):
        # Generate payment_method_id string (UUID format)
        payment_method_id = payment_method_id or str(uuid4())

        # Create customer if not provided
        if not customer_id:
            customer = await customer_factory()
            customer_id = str(customer.id)

        payment_method = PaymentMethodEntity(
            payment_method_id=payment_method_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            type=PaymentMethodType.CARD
            if method_type == "card"
            else PaymentMethodType.BANK_ACCOUNT,
            status=kwargs.pop("status", PaymentMethodStatus.ACTIVE),
            provider=kwargs.pop("provider", "stripe"),
            provider_payment_method_id=kwargs.pop(
                "provider_payment_method_id", f"pm_{str(uuid4()).replace('-', '')[:24]}"
            ),
            display_name=kwargs.pop("display_name", f"Test {method_type.title()}"),
            last_four=kwargs.pop("last_four", "4242"),
            brand=kwargs.pop("brand", "visa" if method_type == "card" else None),
            is_default=is_default,
            **kwargs,
        )
        async_db_session.add(payment_method)
        await async_db_session.flush()
        await async_db_session.refresh(payment_method)
        return payment_method

    yield _create
    # No cleanup needed - async_db_session rolls back automatically


@pytest_asyncio.fixture
async def payment_factory(
    async_db_session: AsyncSession, tenant_id: str, customer_factory, invoice_factory
):
    """
    Factory for creating test payments.

    Example:
        payment = await payment_factory(
            amount=Decimal("100.00"),
            status="succeeded"
        )
    """
    try:
        from dotmac.platform.billing.core.entities import PaymentEntity, PaymentInvoiceEntity
        from dotmac.platform.billing.core.enums import PaymentMethodType, PaymentStatus

        HAS_PAYMENTS = True
    except ImportError:
        HAS_PAYMENTS = False

    if not HAS_PAYMENTS:
        yield lambda **kwargs: None
        return

    async def _create(
        payment_id: str | None = None,
        customer_id: str | None = None,
        invoice_id: str | None = None,
        amount: Decimal = Decimal("100.00"),
        status: str = "succeeded",
        _commit: bool = False,
        **kwargs,
    ):
        # Generate payment_id string (UUID format)
        payment_id = payment_id or str(uuid4())

        # Create customer if not provided
        if not customer_id:
            customer = await customer_factory(_commit=_commit)
            customer_id = str(customer.id)

        # Create invoice if not provided
        if not invoice_id:
            invoice = await invoice_factory(customer_id=customer_id, amount=amount, _commit=_commit)
            invoice_id = invoice.invoice_id

        # Convert amount from dollars to cents (minor units)
        amount_cents = int(amount * 100)

        payment = PaymentEntity(
            payment_id=payment_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=amount_cents,
            currency=kwargs.pop("currency", "USD"),
            status=PaymentStatus.SUCCEEDED
            if status == "succeeded"
            else PaymentStatus.FAILED
            if status == "failed"
            else PaymentStatus.PENDING,
            payment_method_type=kwargs.pop("payment_method_type", PaymentMethodType.CARD),
            payment_method_details=kwargs.pop("payment_method_details", {}),
            provider=kwargs.pop("provider", "stripe"),
            provider_payment_id=kwargs.pop(
                "provider_payment_id", f"pi_{str(uuid4()).replace('-', '')[:24]}"
            ),
            processed_at=kwargs.pop(
                "processed_at", datetime.now(UTC) if status == "succeeded" else None
            ),
            **kwargs,
        )
        async_db_session.add(payment)

        # Create payment-invoice linkage
        payment_invoice = PaymentInvoiceEntity(
            payment_id=payment_id,
            invoice_id=invoice_id,
            amount_applied=amount_cents,
            applied_at=datetime.now(UTC),
        )
        async_db_session.add(payment_invoice)

        if _commit:
            await async_db_session.commit()
            await async_db_session.refresh(payment)
        else:
            await async_db_session.flush()
            await async_db_session.refresh(payment)

        return payment

    yield _create
    # No cleanup needed - async_db_session rolls back automatically
