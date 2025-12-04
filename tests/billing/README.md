# Billing Tests

## Overview

The billing test suite contains **1,334 tests** covering:
- Payment processing (Stripe, PayPal)
- Invoice generation and management
- Subscription lifecycle
- Webhook handlers
- Receipt generation
- Bank account management
- Multi-currency support
- Tax calculation
- Credit notes and refunds

## Database Requirements

**Most billing tests require a database with the billing schema.**

### Quick Setup (SQLite)

```bash
# 1. Create test database with schema
./scripts/setup-test-db.sh

# 2. Run tests
DATABASE_URL=sqlite:////tmp/test_billing.db pytest tests/billing/
```

### Using Postgres (Recommended for Integration Tests)

```bash
# 1. Create test database
createdb dotmac_test

# 2. Run migrations
DATABASE_URL=postgresql://dotmac_user:password@localhost:5432/dotmac_test \
  .venv/bin/alembic upgrade head

# 3. Run tests
DATABASE_URL=postgresql://dotmac_user:password@localhost:5432/dotmac_test \
  pytest tests/billing/
```

## Test Categories

### Unit Tests (No Database Required)

These tests use mocked dependencies and can run without a database:

```bash
pytest tests/billing/test_webhook_handlers.py
pytest tests/billing/test_payment_service_unit.py
pytest tests/billing/test_invoice_service_unit.py
```

### Integration Tests (Database Required)

These tests need real database tables:

```bash
# Invoice integration
DATABASE_URL=sqlite:////tmp/test_billing.db \
  pytest tests/billing/test_invoice_integration.py

# Payment router
DATABASE_URL=sqlite:////tmp/test_billing.db \
  pytest tests/billing/test_payments_router.py

# Full suite
DATABASE_URL=sqlite:////tmp/test_billing.db \
  pytest tests/billing/
```

## Common Issues

### Issue: `sqlite3.OperationalError: no such table: payments`

**Cause**: Database schema not initialized.

**Solution**: Run `./scripts/setup-test-db.sh` first.

### Issue: `sqlite3.OperationalError: attempt to write a readonly database`

**Cause**: Using file-based SQLite without proper permissions or pytest-xdist workers creating conflicting database files.

**Solution**: Use in-memory database for isolated tests:
```bash
DOTMAC_DATABASE_URL_ASYNC="sqlite+aiosqlite:///:memory:" \
  pytest tests/billing/test_invoice_integration.py
```

### Issue: Tests pass individually but fail in suite

**Cause**: Database state pollution between tests.

**Solution**: Use test fixtures with proper cleanup:
```python
@pytest.fixture
async def async_db_session(async_db_engine):
    async with async_db_engine.begin() as conn:
        await conn.begin_nested()
        session = AsyncSession(bind=conn, expire_on_commit=False)
        yield session
        await session.rollback()
```

## Test Metrics

As of last run:
- **Total Tests**: 1,334
- **Passing**: ~1,165 (87.3%)
- **Failing**: ~10 (0.7%)
- **Errors** (DB setup): ~159 (12%)

### Pass Rate by Category

| Category | Tests | Pass Rate | Notes |
|----------|-------|-----------|-------|
| Invoice Tests | 53 | 100% | ✅ All passing |
| Webhook Handlers | 11 | 100% | ✅ All passing |
| Payment Service (Unit) | 16 | 100% | ✅ All passing |
| Payment Router | 6 | 100% | ✅ Requires DB |
| Receipt Router | 16 | ~30% | ⚠️ Needs auth fixes |
| Bank Accounts | 15 | ~80% | ⚠️ Needs DB |
| Metrics Router | 12 | ~50% | ⚠️ Needs DB |

## Recent Fixes

### Session 2025-10-08

1. **Invoice Integration Tests** - Fixed invoice number collision issues
   - Changed tests to use same tenant to avoid global UNIQUE constraint violations
   - Fixed invoice number padding format (6 digits not 4)

2. **Webhook Handler Tests** - Fixed incorrect method assertions
   - Changed `get_payment()` to `update_payment_status()`
   - Changed `process_refund()` to `process_refund_notification()`
   - Fixed parameter signatures to match actual implementation

3. **Payment Router Tests** - Fixed dollar/cent conversions
   - All amount assertions changed from dollars to cents (minor units)

## Running Specific Test Suites

```bash
# Unit tests only (no DB required)
pytest tests/billing/ -m unit

# Integration tests (DB required)
DATABASE_URL=sqlite:////tmp/test_billing.db \
  pytest tests/billing/ -m integration

# Webhook tests
pytest tests/billing/test_webhook_handlers.py -v

# Invoice tests with in-memory DB
DOTMAC_DATABASE_URL_ASYNC="sqlite+aiosqlite:///:memory:" \
  pytest tests/billing/test_invoice*.py -v

# Quick smoke test
pytest tests/billing/test_webhook_handlers.py \
       tests/billing/test_payment_service_unit.py \
       tests/billing/test_invoice_service_unit.py
```

## Debugging Failed Tests

### Enable verbose output
```bash
pytest tests/billing/test_name.py -vv --tb=short
```

### Run single test
```bash
pytest tests/billing/test_name.py::TestClass::test_method -xvs
```

### Check SQL queries
```bash
pytest tests/billing/test_name.py -vv --log-cli-level=DEBUG
```

## Available Test Fixtures

Comprehensive fixtures are available in `tests/billing/conftest.py` for all billing tests.

### Payment Provider Mocks

Mock payment providers that simulate Stripe and PayPal responses without hitting real APIs.

#### `mock_stripe_provider` - Stripe Success Mock
```python
async def test_successful_stripe_payment(mock_stripe_provider):
    """Test successful Stripe payment."""
    result = await mock_stripe_provider.charge_payment_method(
        payment_method_id="pm_test_123",
        amount=10000,
        currency="USD"
    )

    assert result.success is True
    assert result.provider_payment_id == "pi_test_123"
    assert result.provider_fee == 30  # $0.30
```

#### `mock_stripe_provider_failure` - Stripe Failure Mock
```python
async def test_declined_stripe_payment(mock_stripe_provider_failure):
    """Test declined Stripe payment."""
    result = await mock_stripe_provider_failure.charge_payment_method(
        payment_method_id="pm_test_123",
        amount=10000,
        currency="USD"
    )

    assert result.success is False
    assert result.error_message == "Your card was declined."
```

#### `mock_paypal_provider` - PayPal Success Mock
```python
async def test_successful_paypal_payment(mock_paypal_provider):
    """Test successful PayPal payment."""
    result = await mock_paypal_provider.charge_payment_method(
        payment_method_id="BA-TEST123",
        amount=10000,
        currency="USD"
    )

    assert result.success is True
    assert result.provider_payment_id == "PAYID-TEST123"
```

#### `mock_payment_providers` - All Providers Dict
```python
async def test_multi_provider_payment(mock_payment_providers):
    """Test payment routing to different providers."""
    stripe_result = await mock_payment_providers["stripe"].charge_payment_method(...)
    paypal_result = await mock_payment_providers["paypal"].charge_payment_method(...)
```

### Tenant and Customer Fixtures

#### `test_tenant_id` - Unique Tenant ID
```python
async def test_tenant_isolation(test_tenant_id):
    """Test with isolated tenant."""
    assert test_tenant_id.startswith("test-tenant-")
    # Use this tenant_id for all tenant-scoped operations
```

#### `test_customer_id` - Unique Customer ID
```python
async def test_customer_operations(test_tenant_id, test_customer_id):
    """Test customer operations."""
    customer = await customer_service.get_customer(
        tenant_id=test_tenant_id,
        customer_id=test_customer_id
    )
```

### Payment Method Fixtures

#### `active_card_payment_method` - Active Card in Database
Creates a fully active Visa card payment method in the database.

```python
async def test_charge_existing_card(active_card_payment_method, mock_stripe_provider):
    """Test charging an existing payment method."""
    # Payment method already in database
    assert active_card_payment_method.status == PaymentMethodStatus.ACTIVE
    assert active_card_payment_method.last_four == "4242"
    assert active_card_payment_method.brand == "visa"

    # Use it to process payment
    result = await payment_service.charge_payment_method(
        payment_method_id=active_card_payment_method.payment_method_id,
        amount=10000,
        currency="USD"
    )
```

### Invoice Fixtures

#### `sample_draft_invoice` - Draft Invoice in Database
Creates a draft invoice ($110.00 total) ready for finalization.

```python
async def test_finalize_draft_invoice(sample_draft_invoice):
    """Test finalizing a draft invoice."""
    assert sample_draft_invoice.status == InvoiceStatus.DRAFT
    assert sample_draft_invoice.total_amount == 11000  # $110.00 in cents
    assert sample_draft_invoice.remaining_balance == 11000

    # Finalize it
    finalized = await invoice_service.finalize_invoice(
        invoice_id=sample_draft_invoice.invoice_id,
        tenant_id=sample_draft_invoice.tenant_id
    )
    assert finalized.status == InvoiceStatus.OPEN
```

#### `sample_open_invoice` - Open Invoice in Database
Creates an open (finalized) invoice ($275.00 total) ready for payment.

```python
async def test_pay_open_invoice(sample_open_invoice, active_card_payment_method):
    """Test paying an open invoice."""
    assert sample_open_invoice.status == InvoiceStatus.OPEN
    assert sample_open_invoice.total_amount == 27500  # $275.00

    # Process payment
    payment = await payment_service.pay_invoice(
        invoice_id=sample_open_invoice.invoice_id,
        payment_method_id=active_card_payment_method.payment_method_id,
        tenant_id=sample_open_invoice.tenant_id
    )
```

#### `sample_paid_invoice` - Paid Invoice in Database
Creates a fully paid invoice ($550.00 total) for testing refunds and history.

```python
async def test_refund_paid_invoice(sample_paid_invoice):
    """Test refunding a paid invoice."""
    assert sample_paid_invoice.status == InvoiceStatus.PAID
    assert sample_paid_invoice.remaining_balance == 0
    assert sample_paid_invoice.paid_at is not None

    # Process refund
    credit_note = await invoice_service.create_credit_note(
        invoice_id=sample_paid_invoice.invoice_id,
        amount=10000,  # Partial refund: $100.00
        reason="Customer requested refund"
    )
```

### Payment Fixtures

#### `sample_successful_payment` - Successful Payment in Database
Creates a successful Stripe payment ($100.00) in the database.

```python
async def test_payment_receipt(sample_successful_payment):
    """Test generating receipt for successful payment."""
    assert sample_successful_payment.status == PaymentStatus.SUCCEEDED
    assert sample_successful_payment.amount == 10000  # $100.00
    assert sample_successful_payment.provider == "stripe"

    # Generate receipt
    receipt = await receipt_service.generate_payment_receipt(
        payment_id=sample_successful_payment.payment_id
    )
```

#### `sample_failed_payment` - Failed Payment in Database
Creates a failed payment ($50.00) for testing retry logic.

```python
async def test_retry_failed_payment(sample_failed_payment):
    """Test retrying a failed payment."""
    assert sample_failed_payment.status == PaymentStatus.FAILED
    assert sample_failed_payment.failure_reason == "Your card was declined."
    assert sample_failed_payment.retry_count == 1

    # Retry with different payment method
    retry_result = await payment_service.retry_payment(
        payment_id=sample_failed_payment.payment_id,
        new_payment_method_id="pm_different_card"
    )
```

### Complete Billing Scenario

#### `complete_billing_scenario` - Full Billing Flow
Creates a complete billing scenario with payment method, invoice, and payment.

```python
async def test_full_billing_flow(complete_billing_scenario):
    """Test complete billing workflow."""
    tenant_id = complete_billing_scenario["tenant_id"]
    customer_id = complete_billing_scenario["customer_id"]
    payment_method = complete_billing_scenario["payment_method"]
    invoice = complete_billing_scenario["invoice"]
    payment = complete_billing_scenario["payment"]

    # All entities are already created and linked
    assert payment_method.customer_id == customer_id
    assert invoice.customer_id == customer_id
    assert payment.customer_id == customer_id

    # Test business operations on complete scenario
    summary = await billing_service.get_customer_billing_summary(
        tenant_id=tenant_id,
        customer_id=customer_id
    )
    assert summary.total_invoices >= 1
    assert summary.total_payments >= 1
```

### Service Mock Fixtures

#### `mock_event_bus` - Event Bus Mock
```python
async def test_event_publishing(mock_event_bus):
    """Test that service publishes events."""
    service = PaymentService(db=db, event_bus=mock_event_bus)

    payment = await service.create_payment(...)

    # Verify event was published
    mock_event_bus.publish.assert_called_once()
    event = mock_event_bus.publish.call_args[0][0]
    assert isinstance(event, PaymentCreated)
```

#### `mock_invoice_service` - Invoice Service Mock
```python
async def test_payment_with_invoice(mock_invoice_service):
    """Test payment that updates invoice."""
    mock_invoice_service.mark_invoice_paid.return_value = Invoice(...)

    payment_handler = PaymentHandler(invoice_service=mock_invoice_service)
    await payment_handler.handle_successful_payment(payment_id="pay_123")

    mock_invoice_service.mark_invoice_paid.assert_called_once()
```

#### `mock_payment_service` - Payment Service Mock
```python
async def test_webhook_handler(mock_payment_service):
    """Test webhook handler with mocked payment service."""
    handler = StripeWebhookHandler(payment_service=mock_payment_service)

    await handler.handle_payment_succeeded(event_data)

    mock_payment_service.update_payment_status.assert_called_once()
```

## Contributing

When adding new billing tests:

1. **Use cents for all amounts** (not dollars)
   ```python
   amount = 10000  # $100.00 in cents
   ```

2. **Include tenant isolation**
   ```python
   payment = await service.create_payment(
       tenant_id=tenant_id,  # Always required
       amount=10000,
       ...
   )
   ```

3. **Use proper fixtures from conftest.py**
   ```python
   async def test_payment_flow(
       async_db_session,
       test_tenant_id,
       test_customer_id,
       active_card_payment_method,
       sample_open_invoice,
       mock_stripe_provider
   ):
       # All fixtures auto-injected and cleaned up
       payment = await payment_service.pay_invoice(...)
   ```

4. **Test both success and failure paths**
   ```python
   async def test_payment_success(mock_stripe_provider):
       # Test success case with mock_stripe_provider

   async def test_payment_declined(mock_stripe_provider_failure):
       # Test failure case with mock_stripe_provider_failure
   ```

5. **Use appropriate fixture scope**
   - `test_tenant_id`, `test_customer_id` - Fresh IDs for each test
   - `async_db_session` - Isolated database session with rollback
   - Invoice/payment fixtures - Created in database, cleaned up automatically

### Example: Complete Test Using Fixtures

```python
import pytest
from dotmac.platform.billing.core.enums import PaymentStatus, InvoiceStatus

async def test_complete_payment_workflow(
    async_db_session,
    test_tenant_id,
    test_customer_id,
    active_card_payment_method,
    sample_open_invoice,
    mock_stripe_provider,
    mock_event_bus
):
    """
    Test complete payment workflow using fixtures.

    This test demonstrates:
    - Using database fixtures (invoice, payment method)
    - Mocking external services (Stripe)
    - Verifying event publishing
    - Testing with tenant isolation
    """
    # Setup service with mocked dependencies
    payment_service = PaymentService(
        db=async_db_session,
        event_bus=mock_event_bus,
        payment_providers={"stripe": mock_stripe_provider}
    )

    # Execute payment using existing fixtures
    payment = await payment_service.pay_invoice(
        tenant_id=test_tenant_id,
        invoice_id=sample_open_invoice.invoice_id,
        payment_method_id=active_card_payment_method.payment_method_id
    )

    # Verify payment success
    assert payment.status == PaymentStatus.SUCCEEDED
    assert payment.amount == sample_open_invoice.total_amount
    assert payment.tenant_id == test_tenant_id

    # Verify Stripe was called correctly
    mock_stripe_provider.charge_payment_method.assert_called_once_with(
        payment_method_id=active_card_payment_method.provider_payment_method_id,
        amount=sample_open_invoice.total_amount,
        currency=sample_open_invoice.currency,
        idempotency_key=payment.payment_id
    )

    # Verify event was published
    mock_event_bus.publish.assert_called()
    event = mock_event_bus.publish.call_args[0][0]
    assert event.payment_id == payment.payment_id

    # Verify invoice was updated
    await async_db_session.refresh(sample_open_invoice)
    assert sample_open_invoice.status == InvoiceStatus.PAID
    assert sample_open_invoice.remaining_balance == 0
```

## Additional Resources

- [Billing Architecture](../../docs/billing/architecture.md)
- [Payment Providers](../../docs/billing/payment-providers.md)
- [Invoice Lifecycle](../../docs/billing/invoices.md)
- [Testing Best Practices](../../docs/testing.md)
