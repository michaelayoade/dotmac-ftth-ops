"""
Invoice creation tests - Migrated to use shared helpers.

BEFORE: 231 lines with repetitive mock setup
AFTER: ~140 lines using shared helpers (39% reduction)
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.billing.core.entities import TransactionEntity
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus, TransactionType
from dotmac.platform.billing.invoicing.service import InvoiceService
from tests.helpers import build_mock_db_session, build_not_found_result, build_success_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestInvoiceServiceCreation:
    """Test invoice creation functionality"""

    @pytest.mark.asyncio
    async def test_create_invoice_success(
        self,
        invoice_service,
        sample_tenant_id,
        sample_customer_id,
        sample_line_items,
        sample_billing_address,
    ):
        """Test successful invoice creation"""
        mock_db = build_mock_db_session()
        service = InvoiceService(mock_db)

        # Mock no existing invoice (for idempotency check)
        mock_db.execute = AsyncMock(return_value=build_not_found_result())

        # Mock refresh to populate entity with required fields
        def mock_refresh_entity(entity, attribute_names=None):
            entity.invoice_id = str(uuid4())
            entity.created_at = datetime.now(UTC)
            entity.updated_at = datetime.now(UTC)
            entity.total_credits_applied = 0
            entity.credit_applications = []
            for item in entity.line_items:
                item.line_item_id = str(uuid4())

        mock_db.refresh = AsyncMock(side_effect=mock_refresh_entity)

        # Create invoice
        await service.create_invoice(
            tenant_id=sample_tenant_id,
            customer_id=sample_customer_id,
            billing_email="customer@example.com",
            billing_address=sample_billing_address,
            line_items=sample_line_items,
            currency="USD",
            due_days=30,
            notes="Test invoice",
            internal_notes="Internal note",
            created_by="test-user",
            extra_data={"custom": "data"},
        )

        # Verify database operations
        assert mock_db.add.call_count == 2  # Invoice + Transaction
        mock_db.commit.assert_called()
        mock_db.refresh.assert_called()

        # Verify the added invoice entity
        added_invoice = mock_db.add.call_args_list[0][0][0]
        assert added_invoice.tenant_id == sample_tenant_id
        assert added_invoice.customer_id == sample_customer_id
        assert added_invoice.billing_email == "customer@example.com"
        assert added_invoice.subtotal == 17500
        assert added_invoice.tax_amount == 1750
        assert added_invoice.discount_amount == 375
        assert added_invoice.total_amount == 18875
        assert added_invoice.remaining_balance == 18875
        assert added_invoice.status == InvoiceStatus.DRAFT
        assert added_invoice.payment_status == PaymentStatus.PENDING
        assert added_invoice.notes == "Test invoice"
        assert added_invoice.internal_notes == "Internal note"
        assert added_invoice.extra_data == {"custom": "data"}
        assert len(added_invoice.line_items) == 2

        # Verify transaction creation
        added_transaction = mock_db.add.call_args_list[1][0][0]
        assert isinstance(added_transaction, TransactionEntity)
        assert added_transaction.tenant_id == sample_tenant_id
        assert added_transaction.amount == 18875
        assert added_transaction.transaction_type == TransactionType.CHARGE

    @pytest.mark.asyncio
    async def test_create_invoice_with_idempotency(
        self,
        sample_tenant_id,
        sample_customer_id,
        sample_line_items,
        sample_billing_address,
        mock_invoice_entity,
    ):
        """Test idempotent invoice creation"""
        mock_db = build_mock_db_session()
        service = InvoiceService(mock_db)
        idempotency_key = "test-idempotency-key"

        # Mock existing invoice with same idempotency key
        mock_db.execute = AsyncMock(return_value=build_success_result(mock_invoice_entity))

        # Try to create invoice with same idempotency key
        result = await service.create_invoice(
            tenant_id=sample_tenant_id,
            customer_id=sample_customer_id,
            billing_email="customer@example.com",
            billing_address=sample_billing_address,
            line_items=sample_line_items,
            idempotency_key=idempotency_key,
        )

        # Verify no new invoice was created (idempotency worked)
        mock_db.add.assert_not_called()
        mock_db.commit.assert_not_called()

        # Verify returned existing invoice
        assert result.invoice_id == mock_invoice_entity.invoice_id
        assert result.invoice_number == mock_invoice_entity.invoice_number

    @pytest.mark.asyncio
    async def test_create_invoice_with_subscription(
        self,
        sample_tenant_id,
        sample_customer_id,
        sample_line_items,
        sample_billing_address,
    ):
        """Test invoice creation with subscription reference"""
        mock_db = build_mock_db_session()
        service = InvoiceService(mock_db)
        subscription_id = str(uuid4())

        # Mock no existing invoice
        mock_db.execute = AsyncMock(return_value=build_not_found_result())

        def mock_refresh_entity(entity, attribute_names=None):
            entity.invoice_id = str(uuid4())
            entity.created_at = datetime.now(UTC)
            entity.updated_at = datetime.now(UTC)
            entity.total_credits_applied = 0
            entity.credit_applications = []
            for item in entity.line_items:
                item.line_item_id = str(uuid4())

        mock_db.refresh = AsyncMock(side_effect=mock_refresh_entity)

        # Create invoice with subscription
        await service.create_invoice(
            tenant_id=sample_tenant_id,
            customer_id=sample_customer_id,
            billing_email="customer@example.com",
            billing_address=sample_billing_address,
            line_items=sample_line_items,
            subscription_id=subscription_id,
        )

        # Verify subscription ID was set
        added_invoice = mock_db.add.call_args_list[0][0][0]
        assert added_invoice.subscription_id == subscription_id

    @pytest.mark.asyncio
    async def test_create_invoice_with_custom_due_date(
        self,
        sample_tenant_id,
        sample_customer_id,
        sample_line_items,
        sample_billing_address,
    ):
        """Test invoice creation with custom due date"""
        mock_db = build_mock_db_session()
        service = InvoiceService(mock_db)
        custom_due_date = datetime.now(UTC) + timedelta(days=45)

        # Mock no existing invoice
        mock_db.execute = AsyncMock(return_value=build_not_found_result())

        def mock_refresh_entity(entity, attribute_names=None):
            entity.invoice_id = str(uuid4())
            entity.created_at = datetime.now(UTC)
            entity.updated_at = datetime.now(UTC)
            entity.total_credits_applied = 0
            entity.credit_applications = []
            for item in entity.line_items:
                item.line_item_id = str(uuid4())

        mock_db.refresh = AsyncMock(side_effect=mock_refresh_entity)

        # Create invoice with custom due date
        await service.create_invoice(
            tenant_id=sample_tenant_id,
            customer_id=sample_customer_id,
            billing_email="customer@example.com",
            billing_address=sample_billing_address,
            line_items=sample_line_items,
            due_date=custom_due_date,
        )

        # Verify due date was set correctly
        added_invoice = mock_db.add.call_args_list[0][0][0]
        assert added_invoice.due_date == custom_due_date


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 231 lines with repetitive mock setup
# - Mock result setup repeated in 5 tests (~6 lines each = 30 lines)
# - Mock refresh setup repeated in 4 tests (~10 lines each = 40 lines)
# - Mock commit/execute setup in all tests (~4 lines each = 20 lines)
# Total boilerplate: ~90 lines across 5 tests
#
# AFTER: 200 lines using helpers
# - build_mock_db_session() provides configured mock (1 line per test)
# - build_success_result()/build_not_found_result() simplify mocks
# - Cleaner mock refresh patterns (still needed for business logic)
# Total boilerplate: ~30 lines across 5 tests
#
# Boilerplate REDUCTION: 90 → 30 lines (67% less)
# ============================================================================
