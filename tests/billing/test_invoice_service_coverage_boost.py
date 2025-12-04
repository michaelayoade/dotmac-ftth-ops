"""
Comprehensive tests for billing/invoicing/service.py to achieve 90%+ coverage.

This file focuses on covering the gaps left by existing tests, particularly:
- Error handling paths
- Edge cases
- Private helper methods
- Payment status updates
- Credit applications
- Overdue invoice checking
"""

import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    InvoiceLineItemEntity,
    PaymentEntity,
    PaymentInvoiceEntity,
    TransactionEntity,
)
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus, TransactionType
from dotmac.platform.billing.core.exceptions import (
    InvoiceNotFoundError,
)
from dotmac.platform.billing.invoicing.service import InvoiceService


@pytest_asyncio.fixture(autouse=True)
async def _clean_invoice_tables(async_db_session):
    """Ensure invoice-related tables start empty for each test."""
    await async_db_session.execute(delete(PaymentInvoiceEntity))
    await async_db_session.execute(delete(InvoiceLineItemEntity))
    await async_db_session.execute(delete(PaymentEntity))
    await async_db_session.execute(delete(TransactionEntity))
    await async_db_session.execute(delete(InvoiceEntity))
    await async_db_session.commit()
    yield

    try:
        await async_db_session.execute(delete(PaymentInvoiceEntity))
        await async_db_session.execute(delete(InvoiceLineItemEntity))
        await async_db_session.execute(delete(PaymentEntity))
        await async_db_session.execute(delete(TransactionEntity))
        await async_db_session.execute(delete(InvoiceEntity))
        await async_db_session.commit()
    except Exception:
        await async_db_session.rollback()


@pytest.fixture
def invoice_service(async_db_session):
    """Create invoice service with mocked session."""
    return InvoiceService(db_session=async_db_session)


@pytest.fixture
def sample_line_items():
    """Sample line items for invoice creation (prices in minor units/cents)."""
    return [
        {
            "description": "Monthly subscription",
            "quantity": 1,
            "unit_price": 9999,  # $99.99 in cents
            "total_price": 9999,
            "tax_amount": 1000,  # $10.00 in cents
            "discount_amount": 0,
        },
        {
            "description": "Additional users",
            "quantity": 5,
            "unit_price": 1000,  # $10.00 in cents
            "total_price": 5000,  # $50.00 in cents
            "tax_amount": 500,  # $5.00 in cents
            "discount_amount": 500,  # $5.00 in cents
        },
    ]


@pytest.mark.integration
class TestInvoiceCreation:
    """Test invoice creation with various scenarios."""

    @pytest.mark.asyncio
    async def test_create_invoice_with_idempotency_key_returns_existing(
        self, invoice_service, async_db_session, sample_line_items
    ):
        """Test that idempotency key returns existing invoice."""

        tenant_id = str(uuid4())
        idempotency_key = "test-idempotency-key-123"

        # Create existing invoice
        existing_invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            idempotency_key=idempotency_key,
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(existing_invoice)
        await async_db_session.commit()

        # Try to create invoice with same idempotency key
        result = await invoice_service.create_invoice(
            tenant_id=tenant_id,
            customer_id="cust-456",  # Different customer
            billing_email="different@example.com",
            billing_address={"street": "456 Oak Ave"},
            line_items=sample_line_items,
            idempotency_key=idempotency_key,
        )

        # Should return existing invoice
        assert result.invoice_id == existing_invoice.invoice_id
        assert result.customer_id == "cust-123"  # Original customer

    @pytest.mark.asyncio
    async def test_create_invoice_calculates_due_date_from_due_days(
        self, invoice_service, sample_line_items
    ):
        """Test that due_date is calculated from due_days when not provided."""
        tenant_id = str(uuid4())

        with patch.object(invoice_service, "_generate_invoice_number", return_value="INV-2025-001"):
            result = await invoice_service.create_invoice(
                tenant_id=tenant_id,
                customer_id="cust-123",
                billing_email="test@example.com",
                billing_address={"street": "123 Main St"},
                line_items=sample_line_items,
                due_days=15,
            )

        # Due date should be 15 days from now
        expected_due_date = datetime.now(UTC) + timedelta(days=15)
        assert result.due_date.date() == expected_due_date.date()

    @pytest.mark.asyncio
    async def test_create_invoice_uses_default_30_days_when_no_due_date_or_days(
        self, invoice_service, sample_line_items
    ):
        """Test default 30 days due date when neither due_date nor due_days provided."""
        tenant_id = str(uuid4())

        with patch.object(invoice_service, "_generate_invoice_number", return_value="INV-2025-001"):
            result = await invoice_service.create_invoice(
                tenant_id=tenant_id,
                customer_id="cust-123",
                billing_email="test@example.com",
                billing_address={"street": "123 Main St"},
                line_items=sample_line_items,
            )

        # Default should be 30 days
        expected_due_date = datetime.now(UTC) + timedelta(days=30)
        assert result.due_date.date() == expected_due_date.date()


@pytest.mark.integration
class TestInvoicePaymentStatus:
    """Test invoice payment status updates."""

    @pytest.mark.asyncio
    async def test_mark_invoice_paid_raises_error_when_not_found(self, invoice_service):
        """Test error when marking non-existent invoice as paid."""
        tenant_id = str(uuid4())
        invoice_id = str(uuid4())

        with pytest.raises(InvoiceNotFoundError, match=f"Invoice {invoice_id} not found"):
            await invoice_service.mark_invoice_paid(
                tenant_id=tenant_id,
                invoice_id=invoice_id,
            )

    @pytest.mark.asyncio
    async def test_mark_invoice_paid_publishes_event_with_error_handling(
        self, invoice_service, async_db_session
    ):
        """Test that event publishing errors are handled gracefully."""

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        # Mock event bus to raise exception
        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_bus:
            mock_bus.return_value.publish = AsyncMock(side_effect=Exception("Event bus error"))

            # Should not raise, should handle error gracefully
            result = await invoice_service.mark_invoice_paid(
                tenant_id=tenant_id,
                invoice_id=invoice.invoice_id,
                payment_id="pay-123",
            )

        assert result.payment_status == PaymentStatus.SUCCEEDED
        assert result.status == InvoiceStatus.PAID

    @pytest.mark.asyncio
    async def test_update_invoice_payment_status_raises_error_when_not_found(self, invoice_service):
        """Test error when updating payment status of non-existent invoice."""
        tenant_id = str(uuid4())
        invoice_id = str(uuid4())

        with pytest.raises(InvoiceNotFoundError, match=f"Invoice {invoice_id} not found"):
            await invoice_service.update_invoice_payment_status(
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                payment_status=PaymentStatus.SUCCEEDED,
            )

    @pytest.mark.asyncio
    async def test_update_payment_status_to_succeeded_updates_invoice_status(
        self, invoice_service, async_db_session
    ):
        """Test that SUCCEEDED payment status sets invoice to PAID."""

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        result = await invoice_service.update_invoice_payment_status(
            tenant_id=tenant_id,
            invoice_id=invoice.invoice_id,
            payment_status=PaymentStatus.SUCCEEDED,
        )

        assert result.status == InvoiceStatus.PAID
        assert result.payment_status == PaymentStatus.SUCCEEDED
        assert result.remaining_balance == 0
        assert result.paid_at is not None

    @pytest.mark.asyncio
    async def test_update_payment_status_to_pending_partial(
        self, invoice_service, async_db_session
    ):
        """Test pending payment status updates for partial payments."""

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            total_credits_applied=0,
            remaining_balance=60,
            credit_applications=[],
            status=InvoiceStatus.PARTIALLY_PAID,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        result = await invoice_service.update_invoice_payment_status(
            tenant_id=tenant_id,
            invoice_id=invoice.invoice_id,
            payment_status=PaymentStatus.PENDING,
        )

        assert result.status == InvoiceStatus.PARTIALLY_PAID
        assert result.payment_status == PaymentStatus.PENDING


@pytest.mark.integration
class TestCreditApplication:
    """Test credit application to invoices."""

    @pytest.mark.asyncio
    async def test_apply_credit_raises_error_when_invoice_not_found(self, invoice_service):
        """Test error when applying credit to non-existent invoice."""
        tenant_id = str(uuid4())
        invoice_id = str(uuid4())

        with pytest.raises(InvoiceNotFoundError, match=f"Invoice {invoice_id} not found"):
            await invoice_service.apply_credit_to_invoice(
                tenant_id=tenant_id,
                invoice_id=invoice_id,
                credit_amount=50,
                credit_application_id="credit-123",
            )

    @pytest.mark.asyncio
    async def test_apply_credit_marks_invoice_paid_when_fully_credited(
        self, invoice_service, async_db_session
    ):
        """Test that full credit marks invoice as paid."""

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        # Apply full credit
        result = await invoice_service.apply_credit_to_invoice(
            tenant_id=tenant_id,
            invoice_id=invoice.invoice_id,
            credit_amount=110,
            credit_application_id="credit-123",
        )

        assert result.remaining_balance == 0
        assert result.total_credits_applied == 110
        assert result.payment_status == PaymentStatus.SUCCEEDED
        assert result.status == InvoiceStatus.PAID
        assert "credit-123" in result.credit_applications

    @pytest.mark.asyncio
    async def test_apply_partial_credit_marks_partially_paid(
        self, invoice_service, async_db_session
    ):
        """Test that partial credit marks invoice as partially paid."""

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        # Apply partial credit
        result = await invoice_service.apply_credit_to_invoice(
            tenant_id=tenant_id,
            invoice_id=invoice.invoice_id,
            credit_amount=50,
            credit_application_id="credit-123",
        )

        assert result.remaining_balance == 60
        assert result.total_credits_applied == 50
        assert result.payment_status == PaymentStatus.PENDING
        assert result.status == InvoiceStatus.PARTIALLY_PAID
        assert "credit-123" in result.credit_applications

    @pytest.mark.asyncio
    async def test_apply_credit_creates_transaction(self, invoice_service, async_db_session):
        """Test that applying credit creates a transaction record."""
        from sqlalchemy import select

        tenant_id = str(uuid4())
        invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            remaining_balance=110,
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice)
        await async_db_session.commit()

        await invoice_service.apply_credit_to_invoice(
            tenant_id=tenant_id,
            invoice_id=invoice.invoice_id,
            credit_amount=50,
            credit_application_id="credit-123",
        )

        # Check transaction was created
        query = select(TransactionEntity).where(TransactionEntity.invoice_id == invoice.invoice_id)
        result = await async_db_session.execute(query)
        transaction = result.scalar_one_or_none()

        assert transaction is not None
        assert transaction.amount == 50
        assert transaction.transaction_type == TransactionType.CREDIT
        assert transaction.customer_id == "cust-123"


@pytest.mark.integration
class TestOverdueInvoices:
    """Test overdue invoice detection and status updates."""

    @pytest.mark.asyncio
    async def test_check_overdue_invoices_updates_status(self, invoice_service, async_db_session):
        """Test that overdue invoices are marked as OVERDUE."""

        tenant_id = str(uuid4())

        # Create overdue invoice
        overdue_invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC) - timedelta(days=40),
            due_date=datetime.now(UTC) - timedelta(days=10),  # 10 days overdue
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            total_credits_applied=0,
            remaining_balance=110,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(overdue_invoice)

        # Create invoice that is not overdue
        current_invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-002",
            customer_id="cust-456",
            billing_email="test2@example.com",
            billing_address={"street": "456 Oak Ave"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=200,
            tax_amount=20,
            discount_amount=0,
            total_amount=220,
            total_credits_applied=0,
            remaining_balance=220,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(current_invoice)
        await async_db_session.commit()

        # Check for overdue invoices
        overdue_list = await invoice_service.check_overdue_invoices(tenant_id=tenant_id)

        assert len(overdue_list) == 1
        assert overdue_list[0].invoice_id == overdue_invoice.invoice_id
        assert overdue_list[0].status == InvoiceStatus.OVERDUE

    @pytest.mark.asyncio
    async def test_check_overdue_ignores_already_paid_invoices(
        self, invoice_service, async_db_session
    ):
        """Test that paid invoices are not marked as overdue even if past due date."""

        tenant_id = str(uuid4())

        # Create paid but past due date invoice
        paid_invoice = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number="INV-2025-001",
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC) - timedelta(days=40),
            due_date=datetime.now(UTC) - timedelta(days=10),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            total_credits_applied=0,
            remaining_balance=0,  # Paid, so 0 remaining
            credit_applications=[],
            status=InvoiceStatus.PAID,
            payment_status=PaymentStatus.SUCCEEDED,
        )
        async_db_session.add(paid_invoice)
        await async_db_session.commit()

        # Check for overdue invoices
        overdue_list = await invoice_service.check_overdue_invoices(tenant_id=tenant_id)

        assert len(overdue_list) == 0


@pytest.mark.integration
class TestPrivateHelperMethods:
    """Test private helper methods."""

    @pytest.mark.asyncio
    async def test_get_invoice_entity_returns_none_when_not_found(self, invoice_service):
        """Test that _get_invoice_entity returns None when invoice doesn't exist."""
        tenant_id = str(uuid4())
        invoice_id = str(uuid4())

        result = await invoice_service._get_invoice_entity(tenant_id, invoice_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_invoice_by_idempotency_key_returns_none_when_not_found(
        self, invoice_service
    ):
        """Test that _get_invoice_by_idempotency_key returns None when not found."""
        tenant_id = str(uuid4())
        idempotency_key = "non-existent-key"

        result = await invoice_service._get_invoice_by_idempotency_key(tenant_id, idempotency_key)

        assert result is None

    @pytest.mark.asyncio
    async def test_generate_invoice_number_creates_sequential_numbers(
        self, invoice_service, async_db_session
    ):
        """Test that invoice numbers are generated sequentially."""

        tenant_id = str(uuid4())
        year = datetime.now(UTC).year

        # Create first invoice (use 6-digit padding to match service format)
        invoice1 = InvoiceEntity(
            tenant_id=tenant_id,
            invoice_id=str(uuid4()),
            invoice_number=_build_invoice_number(tenant_id, year, 1),
            customer_id="cust-123",
            billing_email="test@example.com",
            billing_address={"street": "123 Main St"},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=10,
            discount_amount=0,
            total_amount=110,
            total_credits_applied=0,
            remaining_balance=110,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
        )
        async_db_session.add(invoice1)
        await async_db_session.commit()

        # Generate next invoice number
        next_number = await invoice_service._generate_invoice_number(tenant_id)

        assert next_number == _build_invoice_number(tenant_id, year, 2)


def _build_invoice_number(tenant_id: str, year: int, sequence: int) -> str:
    suffix = hashlib.sha256(tenant_id.encode()).hexdigest()[:4].upper()
    return f"INV-{suffix}-{year}-{sequence:06d}"
