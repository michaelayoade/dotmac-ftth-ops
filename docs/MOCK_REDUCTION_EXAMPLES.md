# Mock Reduction Examples

**Date:** 2025-10-30
**Baseline:** 7,670 mock lines
**Target:** <3,000 mock lines (60% reduction)

This document shows concrete examples of reducing mock usage in tests.

---

## Table of Contents

1. [Example 1: Replace Database Mocks with Real Database](#example-1-replace-database-mocks-with-real-database)
2. [Example 2: Replace Service Mocks with Fakes](#example-2-replace-service-mocks-with-fakes)
3. [Example 3: Use Real Objects Instead of Mocks](#example-3-use-real-objects-instead-of-mocks)
4. [Tracking Progress](#tracking-progress)

---

## Example 1: Replace Database Mocks with Real Database

### File: `tests/billing/payments/test_payment_helpers_service.py`

**Category:** Database Mocking → Real Database
**Lines Saved:** ~40 lines of mock configuration per test file
**Impact:** Tests catch real SQL errors, relationship issues, constraints

### ❌ BEFORE - Using Mocked Database

```python
"""
Tests for payment service private helper methods.
Uses MOCKED database session.
"""

import pytest
from unittest.mock import AsyncMock

pytestmark = pytest.mark.asyncio

@pytest.mark.unit
class TestPrivateHelperMethods:
    """Test private helper methods"""

    async def test_get_payment_entity(
        self, payment_service, mock_payment_db_session, sample_payment_entity
    ):
        """Test _get_payment_entity helper"""
        # Setup mock return value
        mock_payment_db_session.execute.return_value.scalar.return_value = sample_payment_entity

        # Execute
        result = await payment_service._get_payment_entity("test-tenant", "payment_123")

        # Verify
        assert result == sample_payment_entity

    async def test_count_payment_methods(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test _count_payment_methods helper"""
        # Setup - complex mock chain!
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = [
            sample_payment_method_entity,
            sample_payment_method_entity,
        ]

        # Execute
        result = await payment_service._count_payment_methods("test-tenant", "customer_456")

        # Verify
        assert result == 2

    async def test_clear_default_payment_methods(
        self, payment_service, mock_payment_db_session, sample_payment_method_entity
    ):
        """Test _clear_default_payment_methods helper"""
        # Setup
        sample_payment_method_entity.is_default = True
        mock_payment_db_session.execute.return_value.scalars.return_value.all.return_value = [
            sample_payment_method_entity
        ]

        # Execute
        await payment_service._clear_default_payment_methods("test-tenant", "customer_456")

        # Verify
        assert sample_payment_method_entity.is_default is False
        mock_payment_db_session.commit.assert_called()  # Verifying mock calls!
```

**Problems:**
- ❌ Mocking SQLAlchemy's complex query chain
- ❌ Tests don't catch real SQL errors
- ❌ Can't test database relationships
- ❌ Can't test constraints
- ❌ Verifying mock calls instead of actual behavior
- ❌ Brittle to SQLAlchemy version changes

### ✅ AFTER - Using Real Database

```python
"""
Tests for payment service private helper methods.
Uses REAL database session with test data.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.payments.service import PaymentService
from dotmac.platform.billing.core.entities import PaymentEntity, PaymentMethodEntity
from dotmac.platform.billing.core.enums import TransactionType, PaymentStatus

pytestmark = pytest.mark.integration  # Changed from unit to integration

@pytest_asyncio.fixture
async def payment_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test payments in real database."""
    created_payments = []

    async def _create_payment(
        payment_id: str = "payment_123",
        customer_id: str = "customer_456",
        amount: Decimal = Decimal("100.00"),
        status: PaymentStatus = PaymentStatus.SUCCEEDED,
        **kwargs
    ):
        payment = PaymentEntity(
            id=payment_id,
            tenant_id=tenant_id,
            customer_id=customer_id,
            amount=amount,
            status=status,
            currency="USD",
            **kwargs
        )
        async_db_session.add(payment)
        await async_db_session.commit()
        await async_db_session.refresh(payment)
        created_payments.append(payment)
        return payment

    yield _create_payment

    # Cleanup
    for payment in created_payments:
        await async_db_session.delete(payment)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def payment_method_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test payment methods in real database."""
    created_methods = []

    async def _create_method(
        customer_id: str = "customer_456",
        is_default: bool = False,
        **kwargs
    ):
        method = PaymentMethodEntity(
            id=f"pm_{len(created_methods)}",
            tenant_id=tenant_id,
            customer_id=customer_id,
            type="card",
            is_default=is_default,
            **kwargs
        )
        async_db_session.add(method)
        await async_db_session.commit()
        await async_db_session.refresh(method)
        created_methods.append(method)
        return method

    yield _create_method

    # Cleanup
    for method in created_methods:
        await async_db_session.delete(method)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def payment_service(async_db_session: AsyncSession, tenant_id: str):
    """Create payment service with real database session."""
    return PaymentService(
        session=async_db_session,
        tenant_id=tenant_id
    )


class TestPrivateHelperMethods:
    """Test private helper methods with real database"""

    async def test_get_payment_entity(
        self, payment_service, payment_factory
    ):
        """Test _get_payment_entity helper - retrieves from REAL database"""
        # Create real payment in database
        payment = await payment_factory(
            payment_id="payment_123",
            customer_id="customer_456",
            amount=Decimal("50.00")
        )

        # Execute - queries real database
        result = await payment_service._get_payment_entity(
            payment.tenant_id,
            "payment_123"
        )

        # Verify - got real object from database
        assert result.id == "payment_123"
        assert result.amount == Decimal("50.00")
        assert result.customer_id == "customer_456"

    async def test_count_payment_methods(
        self, payment_service, payment_method_factory, tenant_id
    ):
        """Test _count_payment_methods helper - counts REAL records"""
        # Create real payment methods in database
        await payment_method_factory(customer_id="customer_456")
        await payment_method_factory(customer_id="customer_456")
        await payment_method_factory(customer_id="other_customer")  # Different customer

        # Execute - counts real database records
        result = await payment_service._count_payment_methods(
            tenant_id,
            "customer_456"
        )

        # Verify - counted only customer_456's methods
        assert result == 2

    async def test_clear_default_payment_methods(
        self, payment_service, payment_method_factory, async_db_session, tenant_id
    ):
        """Test _clear_default_payment_methods helper - updates REAL records"""
        # Create real payment methods with defaults
        method1 = await payment_method_factory(
            customer_id="customer_456",
            is_default=True
        )
        method2 = await payment_method_factory(
            customer_id="customer_456",
            is_default=True
        )

        # Execute - updates real database
        await payment_service._clear_default_payment_methods(
            tenant_id,
            "customer_456"
        )

        # Verify - check actual database state
        await async_db_session.refresh(method1)
        await async_db_session.refresh(method2)
        assert method1.is_default is False
        assert method2.is_default is False

    async def test_create_transaction(
        self, payment_service, payment_factory, async_db_session, tenant_id
    ):
        """Test _create_transaction helper - creates REAL transaction"""
        # Create real payment
        payment = await payment_factory(amount=Decimal("100.00"))

        # Execute - creates real transaction in database
        await payment_service._create_transaction(
            payment,
            TransactionType.PAYMENT
        )
        await async_db_session.commit()

        # Verify - query actual database
        from dotmac.platform.billing.core.entities import TransactionEntity
        result = await async_db_session.execute(
            select(TransactionEntity).where(
                TransactionEntity.tenant_id == tenant_id,
                TransactionEntity.payment_id == payment.id
            )
        )
        transaction = result.scalar_one()
        assert transaction.amount == Decimal("100.00")
        assert transaction.transaction_type == TransactionType.PAYMENT
```

**Benefits:**
- ✅ Tests actual SQL queries
- ✅ Catches real database errors
- ✅ Tests relationships and constraints
- ✅ Tests transaction behavior
- ✅ No mock configuration needed
- ✅ No mock call verification
- ✅ Verifies actual database state

**Tradeoffs:**
- ⚠️ Slightly slower (but SQLite in-memory is still fast)
- ⚠️ Requires database fixtures (but reusable!)
- ✅ Changed from `unit` to `integration` marker (appropriate!)

---

## Example 2: Replace Service Mocks with Fakes

### File: Hypothetical `tests/billing/test_billing_workflow.py`

**Category:** Service Mocking → Fakes
**Lines Saved:** ~50-100 lines of mock configuration
**Impact:** Tests catch real integration bugs between services

### ❌ BEFORE - Mocking Internal Services

```python
"""
Tests for billing workflow.
Mocks INTERNAL services (bad practice!).
"""

from unittest.mock import AsyncMock
import pytest

async def test_bill_customer_workflow():
    """Test complete billing workflow"""

    # Mock invoice service (our own service!)
    mock_invoice_service = AsyncMock()
    mock_invoice_service.create_invoice.return_value = {
        "id": "inv_123",
        "amount": 100.00,
        "status": "pending"
    }
    mock_invoice_service.get_invoice.return_value = {
        "id": "inv_123",
        "status": "pending"
    }

    # Mock payment service (our own service!)
    mock_payment_service = AsyncMock()
    mock_payment_service.process_payment.return_value = {
        "id": "pay_456",
        "status": "success"
    }
    mock_payment_service.get_payment.return_value = {
        "id": "pay_456",
        "status": "success"
    }

    # Mock payment gateway (external service - OK to mock)
    mock_gateway = AsyncMock()
    mock_gateway.charge.return_value = {
        "transaction_id": "tx_789",
        "status": "success"
    }

    # Create workflow with mocks
    workflow = BillingWorkflow(
        invoice_service=mock_invoice_service,
        payment_service=mock_payment_service,
        payment_gateway=mock_gateway
    )

    # Execute
    result = await workflow.bill_customer("customer_123", amount=100.00)

    # Verify mock calls (testing implementation, not behavior!)
    assert result["success"] is True
    mock_invoice_service.create_invoice.assert_called_once()
    mock_payment_service.process_payment.assert_called_once()
    mock_gateway.charge.assert_called_once()
```

**Problems:**
- ❌ Mocking our own services
- ❌ Won't catch integration bugs
- ❌ Won't catch API contract changes
- ❌ Testing implementation (mock calls) not behavior
- ❌ Lots of mock configuration

### ✅ AFTER - Using Real Services + Fakes

```python
"""
Tests for billing workflow.
Uses REAL internal services + FAKE external gateway.
"""

import pytest
import pytest_asyncio
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.invoicing.service import InvoiceService
from dotmac.platform.billing.payments.service import PaymentService
from dotmac.platform.billing.workflows import BillingWorkflow
from tests.helpers.fakes import FakePaymentGateway

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def customer_factory(async_db_session: AsyncSession, tenant_id: str):
    """Factory for creating test customers."""
    from dotmac.platform.customer_management.models import Customer
    created_customers = []

    async def _create(customer_id: str = "customer_123", **kwargs):
        customer = Customer(
            id=customer_id,
            tenant_id=tenant_id,
            email=f"{customer_id}@test.com",
            first_name="Test",
            last_name="Customer",
            **kwargs
        )
        async_db_session.add(customer)
        await async_db_session.commit()
        created_customers.append(customer)
        return customer

    yield _create

    for customer in created_customers:
        await async_db_session.delete(customer)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def billing_workflow(
    async_db_session: AsyncSession,
    tenant_id: str,
    payment_gateway_fake: FakePaymentGateway  # From conftest.py
):
    """Create billing workflow with real services + fake gateway."""
    invoice_service = InvoiceService(
        session=async_db_session,
        tenant_id=tenant_id
    )

    payment_service = PaymentService(
        session=async_db_session,
        tenant_id=tenant_id,
        payment_gateway=payment_gateway_fake  # Only mock the external gateway
    )

    return BillingWorkflow(
        invoice_service=invoice_service,
        payment_service=payment_service
    )


class TestBillingWorkflow:
    """Test billing workflow with real services"""

    async def test_bill_customer_workflow_success(
        self,
        billing_workflow,
        customer_factory,
        payment_gateway_fake,
        async_db_session
    ):
        """Test complete billing workflow - REAL services, REAL database"""
        # Create real customer
        customer = await customer_factory(customer_id="customer_123")

        # Execute workflow - uses real services
        result = await billing_workflow.bill_customer(
            customer_id=customer.id,
            amount=Decimal("100.00")
        )

        # Verify real database state
        assert result["success"] is True

        # Verify invoice was created in database
        from dotmac.platform.billing.invoicing.models import Invoice
        invoice_result = await async_db_session.execute(
            select(Invoice).where(Invoice.customer_id == customer.id)
        )
        invoice = invoice_result.scalar_one()
        assert invoice.amount == Decimal("100.00")
        assert invoice.status == "paid"

        # Verify payment was created in database
        from dotmac.platform.billing.payments.models import Payment
        payment_result = await async_db_session.execute(
            select(Payment).where(Payment.invoice_id == invoice.id)
        )
        payment = payment_result.scalar_one()
        assert payment.amount == Decimal("100.00")
        assert payment.status == "success"

        # Verify external gateway was called (only this is fake)
        charges = payment_gateway_fake.get_charges()
        assert len(charges) == 1
        assert charges[0]["amount"] == Decimal("100.00")

    async def test_bill_customer_workflow_payment_failure(
        self,
        billing_workflow,
        customer_factory,
        payment_gateway_fake,
        async_db_session
    ):
        """Test billing workflow when payment fails"""
        # Create real customer
        customer = await customer_factory(customer_id="customer_456")

        # Simulate payment gateway failure
        payment_gateway_fake.simulate_failure(reason="insufficient_funds")

        # Execute workflow
        result = await billing_workflow.bill_customer(
            customer_id=customer.id,
            amount=Decimal("50.00")
        )

        # Verify failure was handled
        assert result["success"] is False
        assert "insufficient_funds" in result["error"]

        # Verify invoice exists but is unpaid
        from dotmac.platform.billing.invoicing.models import Invoice
        invoice_result = await async_db_session.execute(
            select(Invoice).where(Invoice.customer_id == customer.id)
        )
        invoice = invoice_result.scalar_one()
        assert invoice.status == "pending"  # Not paid!

        # Verify no payment record (transaction rolled back)
        from dotmac.platform.billing.payments.models import Payment
        payment_result = await async_db_session.execute(
            select(Payment).where(Payment.invoice_id == invoice.id)
        )
        payment = payment_result.scalar_one_or_none()
        assert payment is None  # No payment created

    async def test_bill_customer_with_existing_payment_method(
        self,
        billing_workflow,
        customer_factory,
        payment_gateway_fake,
        async_db_session
    ):
        """Test billing with saved payment method"""
        # Create customer with saved payment method
        customer = await customer_factory()

        # Create saved payment method
        from dotmac.platform.billing.payments.models import PaymentMethod
        payment_method = PaymentMethod(
            id="pm_123",
            tenant_id=customer.tenant_id,
            customer_id=customer.id,
            type="card",
            is_default=True,
            provider_payment_method_id="card_xyz"
        )
        async_db_session.add(payment_method)
        await async_db_session.commit()

        # Execute - should use saved payment method
        result = await billing_workflow.bill_customer(
            customer_id=customer.id,
            amount=Decimal("75.00")
        )

        # Verify success
        assert result["success"] is True

        # Verify gateway was called with saved payment method
        charges = payment_gateway_fake.get_charges()
        assert len(charges) == 1
        assert charges[0]["payment_method"] == "card_xyz"
```

**Benefits:**
- ✅ Tests real service integration
- ✅ Catches API contract changes
- ✅ Tests real database transactions
- ✅ Tests error handling across services
- ✅ Only mocks external service (payment gateway)
- ✅ Minimal mock configuration (just the fake)
- ✅ Verifies actual behavior, not mock calls

---

## Example 3: Use Real Objects Instead of Mocks

### Category: Value Object Mocking → Real Objects

### ❌ BEFORE - Mocking Value Objects

```python
from unittest.mock import MagicMock

def test_invoice_calculation():
    """Test invoice total calculation"""
    # Mocking simple objects (wasteful!)
    mock_item1 = MagicMock()
    mock_item1.amount = 100.00
    mock_item1.quantity = 2

    mock_item2 = MagicMock()
    mock_item2.amount = 50.00
    mock_item2.quantity = 1

    mock_invoice = MagicMock()
    mock_invoice.items = [mock_item1, mock_item2]

    # Calculate
    total = calculate_invoice_total(mock_invoice)
    assert total == 250.00
```

**Problems:**
- ❌ Over-engineering simple objects
- ❌ MagicMock allows typos (`mock_item.amout` won't error!)
- ❌ No type checking

### ✅ AFTER - Using Real Objects

```python
from decimal import Decimal
from dotmac.platform.billing.invoicing.models import Invoice, InvoiceItem

def test_invoice_calculation():
    """Test invoice total calculation"""
    # Use real objects (simple and correct!)
    item1 = InvoiceItem(
        description="Service A",
        amount=Decimal("100.00"),
        quantity=2
    )

    item2 = InvoiceItem(
        description="Service B",
        amount=Decimal("50.00"),
        quantity=1
    )

    invoice = Invoice(
        customer_id="cust_123",
        items=[item1, item2]
    )

    # Calculate
    total = calculate_invoice_total(invoice)
    assert total == Decimal("250.00")
```

**Benefits:**
- ✅ Real object validation
- ✅ Type checking works
- ✅ Typos cause errors (good!)
- ✅ Simpler code
- ✅ No mock imports needed

---

## Tracking Progress

### Run Mock Counter

```bash
# Get current mock usage
./scripts/count_mocks.sh

# After making changes
./scripts/count_mocks.sh > mock_report_$(date +%Y%m%d).txt
```

### Target Metrics

| Metric | Current | Phase 1 | Phase 2 | Target |
|--------|---------|---------|---------|---------|
| **Total Mocks** | 7,670 | 7,000 | 5,000 | 3,000 |
| **Auth Mocks** | 69 | 30 | 10 | 0 |
| **DB Mocks** | 2,592 | 2,000 | 500 | <50 |
| **Service Mocks** | 2,762 | 2,500 | 1,500 | <500 |

### Per-Module Targets

High-priority modules to refactor:

| Module | Current | Target | Priority |
|--------|---------|--------|----------|
| **billing** | 1,581 | <500 | High |
| **auth** | 359 | <100 | Medium |
| **workflows** | 237 | <50 | High |
| **customer_management** | 216 | <100 | Medium |
| **services** | 152 | <50 | High |

---

## Quick Reference

### Decision Tree: When to Use What?

```
Is it an EXTERNAL service? (payment, email, SMS, API)
├─ Yes → Use FAKE (tests/helpers/fakes.py)
└─ No → Is it YOUR service?
    ├─ Yes → Use REAL service with real database
    └─ No → Is it a simple object? (model, dataclass, dict)
        ├─ Yes → Use REAL object
        └─ No → Is it database?
            ├─ Yes → Use REAL database (async_db_session fixture)
            └─ No → Consider if you really need a test at this level
```

### Quick Commands

```bash
# Find database mocking
grep -r "mock.*session\|AsyncMock.*execute" tests/ --include="*.py" | wc -l

# Find service mocking
grep -r "mock.*service\|mock.*Service" tests/ --include="*.py" | wc -l

# Find files with most mocks
for f in tests/**/*.py; do echo "$(grep -c 'AsyncMock\|MagicMock\|@patch' $f 2>/dev/null):$f"; done | sort -rn | head -10
```

---

## Next Steps

1. **Start with billing/** - Highest mock usage (1,581 lines)
2. **Refactor database mocks first** - Biggest impact (2,592 lines)
3. **Create more fakes as needed** - Add to `tests/helpers/fakes.py`
4. **Run tests** after each refactoring to ensure they still pass
5. **Track progress** with `count_mocks.sh`

**Goal:** <3,000 mock lines (60% reduction) within 2-3 weeks
