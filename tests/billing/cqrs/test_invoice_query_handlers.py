"""Tests for Invoice Query Handlers (CQRS Pattern)"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from dotmac.platform.billing.core.enums import InvoiceStatus
from dotmac.platform.billing.queries.handlers import InvoiceQueryHandler
from dotmac.platform.billing.queries.invoice_queries import (
    GetInvoiceQuery,
    GetInvoiceStatisticsQuery,
    GetOverdueInvoicesQuery,
    ListInvoicesQuery,
)
from dotmac.platform.billing.read_models.invoice_read_models import (
    InvoiceDetail,
    InvoiceListItem,
    InvoiceStatistics,
)


@pytest.mark.unit
class TestInvoiceQueryHandler:
    """Test InvoiceQueryHandler with mocked database"""

    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session"""
        return AsyncMock()

    @pytest.fixture
    def query_handler(self, mock_db_session):
        """Create query handler with mocked dependencies"""
        return InvoiceQueryHandler(mock_db_session)

    @pytest.mark.asyncio
    async def test_handle_get_invoice_returns_detail(self, query_handler, mock_db_session):
        """Test get invoice returns InvoiceDetail"""
        query = GetInvoiceQuery(
            tenant_id="tenant-1",
            invoice_id="inv-123",
            include_line_items=True,
            include_payments=True,
        )

        # Mock database result
        mock_invoice = MagicMock()
        mock_invoice.invoice_id = "inv-123"
        mock_invoice.invoice_number = "INV-001"
        mock_invoice.tenant_id = "tenant-1"
        mock_invoice.customer_id = "cust-456"
        mock_invoice.billing_email = "customer@example.com"
        mock_invoice.billing_address = {"name": "John Doe"}
        mock_invoice.line_items = []
        mock_invoice.subtotal = 10000
        mock_invoice.tax_amount = 0
        mock_invoice.discount_amount = 0
        mock_invoice.total_amount = 10000
        mock_invoice.remaining_balance = 10000
        mock_invoice.currency = "USD"
        mock_invoice.status = InvoiceStatus.DRAFT
        mock_invoice.created_at = datetime.now(UTC)
        mock_invoice.updated_at = datetime.now(UTC)
        mock_invoice.issue_date = datetime.now(UTC)
        mock_invoice.due_date = datetime.now(UTC) + timedelta(days=30)
        mock_invoice.finalized_at = None
        mock_invoice.paid_at = None
        mock_invoice.voided_at = None
        mock_invoice.notes = None
        mock_invoice.internal_notes = None
        mock_invoice.subscription_id = None
        mock_invoice.idempotency_key = None
        mock_invoice.created_by = "user-123"
        mock_invoice.extra_data = {}

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_invoice
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_invoice(query)

        # Verify result
        assert result is not None
        assert isinstance(result, InvoiceDetail)
        assert result.invoice_id == "inv-123"
        assert result.invoice_number == "INV-001"
        assert result.customer_id == "cust-456"

    @pytest.mark.asyncio
    async def test_handle_get_invoice_not_found(self, query_handler, mock_db_session):
        """Test get invoice returns None when not found"""
        query = GetInvoiceQuery(tenant_id="tenant-1", invoice_id="inv-999")

        # Mock database returns None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_invoice(query)

        # Verify result
        assert result is None

    @pytest.mark.asyncio
    async def test_handle_list_invoices_with_pagination(self, query_handler, mock_db_session):
        """Test list invoices with pagination"""
        query = ListInvoicesQuery(
            tenant_id="tenant-1", page=1, page_size=10, sort_by="created_at", sort_order="desc"
        )

        # Mock database results
        mock_invoices = []
        for i in range(5):
            mock_invoice = MagicMock()
            mock_invoice.invoice_id = f"inv-{i}"
            mock_invoice.invoice_number = f"INV-{i:03d}"
            mock_invoice.customer_id = "cust-456"
            mock_invoice.billing_email = "customer@example.com"
            mock_invoice.billing_address = {"name": "Customer Name"}
            mock_invoice.total_amount = 10000
            mock_invoice.remaining_balance = 10000
            mock_invoice.currency = "USD"
            mock_invoice.status = InvoiceStatus.DRAFT
            mock_invoice.created_at = datetime.now(UTC)
            mock_invoice.due_date = datetime.now(UTC) + timedelta(days=30)
            mock_invoice.paid_at = None
            mock_invoice.line_items = []
            mock_invoice.payments = []
            mock_invoices.append(mock_invoice)

        # Mock count query
        mock_db_session.scalar.return_value = 5

        # Mock list query
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_invoices
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_list_invoices(query)

        # Verify result
        assert "items" in result
        assert "total" in result
        assert "page" in result
        assert "page_size" in result
        assert "total_pages" in result
        assert result["total"] == 5
        assert result["page"] == 1
        assert result["page_size"] == 10
        assert result["total_pages"] == 1
        assert len(result["items"]) == 5

    @pytest.mark.asyncio
    async def test_handle_list_invoices_with_filters(self, query_handler, mock_db_session):
        """Test list invoices with status and customer filters"""
        query = ListInvoicesQuery(
            tenant_id="tenant-1",
            customer_id="cust-456",
            status="open",
            created_after=datetime.now(UTC) - timedelta(days=30),
            created_before=datetime.now(UTC),
            page=1,
            page_size=50,
        )

        # Mock database results
        mock_db_session.scalar.return_value = 0
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_list_invoices(query)

        # Verify result structure
        assert result["total"] == 0
        assert len(result["items"]) == 0
        assert result["page"] == 1
        assert result["page_size"] == 50

    @pytest.mark.asyncio
    async def test_handle_get_overdue_invoices(self, query_handler, mock_db_session):
        """Test get overdue invoices"""
        query = GetOverdueInvoicesQuery(tenant_id="tenant-1", limit=10)

        # Mock overdue invoices
        mock_invoices = []
        for i in range(3):
            mock_invoice = MagicMock()
            mock_invoice.invoice_id = f"inv-overdue-{i}"
            mock_invoice.invoice_number = f"INV-OD-{i:03d}"
            mock_invoice.customer_id = "cust-456"
            mock_invoice.billing_email = "customer@example.com"
            mock_invoice.billing_address = {"name": "Customer"}
            mock_invoice.total_amount = 10000
            mock_invoice.remaining_balance = 10000
            mock_invoice.currency = "USD"
            mock_invoice.status = InvoiceStatus.OPEN
            mock_invoice.created_at = datetime.now(UTC) - timedelta(days=60)
            mock_invoice.due_date = datetime.now(UTC) - timedelta(days=10 * (i + 1))
            mock_invoice.paid_at = None
            mock_invoice.line_items = []
            mock_invoice.payments = []
            mock_invoices.append(mock_invoice)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = mock_invoices
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_overdue_invoices(query)

        # Verify result
        assert len(result) == 3
        assert all(isinstance(item, InvoiceListItem) for item in result)

    @pytest.mark.asyncio
    async def test_handle_get_invoice_statistics(self, query_handler, mock_db_session):
        """Test get invoice statistics with aggregations"""
        query = GetInvoiceStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=30),
            end_date=datetime.now(UTC),
        )

        # Mock aggregation result
        mock_row = MagicMock()
        mock_row.total_count = 100
        mock_row.draft_count = 10
        mock_row.open_count = 30
        mock_row.paid_count = 60
        mock_row.total_amount = 1000000  # $10,000 in cents
        mock_row.outstanding_amount = 400000  # $4,000 in cents
        mock_row.average_amount = 10000  # $100 in cents

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_invoice_statistics(query)

        # Verify result
        assert isinstance(result, InvoiceStatistics)
        assert result.total_count == 100
        assert result.draft_count == 10
        assert result.open_count == 30
        assert result.paid_count == 60
        assert result.total_amount == 1000000
        assert result.outstanding_amount == 400000
        assert result.paid_amount == 600000  # total - outstanding
        assert result.average_invoice_amount == 10000
        assert result.formatted_total == "$10,000.00"
        assert result.formatted_outstanding == "$4,000.00"

    @pytest.mark.asyncio
    async def test_handle_get_invoice_statistics_empty(self, query_handler, mock_db_session):
        """Test invoice statistics with no data"""
        query = GetInvoiceStatisticsQuery(
            tenant_id="tenant-1",
            start_date=datetime.now(UTC) - timedelta(days=30),
            end_date=datetime.now(UTC),
        )

        # Mock empty result
        mock_row = MagicMock()
        mock_row.total_count = None
        mock_row.draft_count = None
        mock_row.open_count = None
        mock_row.paid_count = None
        mock_row.total_amount = None
        mock_row.outstanding_amount = None
        mock_row.average_amount = None

        mock_result = MagicMock()
        mock_result.one.return_value = mock_row
        mock_db_session.execute.return_value = mock_result

        # Execute query
        result = await query_handler.handle_get_invoice_statistics(query)

        # Verify defaults
        assert result.total_count == 0
        assert result.draft_count == 0
        assert result.open_count == 0
        assert result.paid_count == 0
        assert result.total_amount == 0
        assert result.outstanding_amount == 0
        assert result.paid_amount == 0
        assert result.average_invoice_amount == 0


@pytest.mark.unit
class TestInvoiceListItemMapping:
    """Test InvoiceListItem mapping from entity"""

    @pytest.fixture
    def query_handler(self):
        """Create query handler"""
        return InvoiceQueryHandler(AsyncMock())

    def test_map_to_list_item_basic(self, query_handler):
        """Test mapping invoice entity to list item"""
        mock_invoice = MagicMock()
        mock_invoice.invoice_id = "inv-123"
        mock_invoice.invoice_number = "INV-001"
        mock_invoice.customer_id = "cust-456"
        mock_invoice.billing_email = "customer@example.com"
        mock_invoice.billing_address = {"name": "John Doe", "city": "Boston"}
        mock_invoice.total_amount = 10000
        mock_invoice.remaining_balance = 5000
        mock_invoice.currency = "USD"
        mock_invoice.status = InvoiceStatus.OPEN
        mock_invoice.created_at = datetime.now(UTC)
        mock_invoice.due_date = datetime.now(UTC) + timedelta(days=15)
        mock_invoice.paid_at = None
        mock_invoice.line_items = []
        mock_invoice.payments = []

        # Map to list item
        result = query_handler._map_to_list_item(mock_invoice)

        # Verify mapping
        assert isinstance(result, InvoiceListItem)
        assert result.invoice_id == "inv-123"
        assert result.invoice_number == "INV-001"
        assert result.customer_id == "cust-456"
        assert result.customer_name == "John Doe"
        assert result.customer_email == "customer@example.com"
        assert result.total_amount == 10000
        assert result.remaining_balance == 5000
        assert result.currency == "USD"
        assert result.status == InvoiceStatus.OPEN
        assert result.is_overdue is False
        assert result.formatted_total == "$100.00"
        assert result.formatted_balance == "$50.00"
        assert result.days_until_due is not None
        assert 14 <= result.days_until_due <= 15  # Allow for timing variation


@pytest.mark.unit
class TestInvoiceDetailMapping:
    """Test InvoiceDetail mapping from entity"""

    @pytest.fixture
    def query_handler(self):
        """Create query handler"""
        return InvoiceQueryHandler(AsyncMock())

    def test_map_to_detail(self, query_handler):
        """Test mapping invoice entity to detail view"""
        now = datetime.now(UTC)
        mock_invoice = MagicMock()
        mock_invoice.invoice_id = "inv-123"
        mock_invoice.invoice_number = "INV-001"
        mock_invoice.tenant_id = "tenant-1"
        mock_invoice.customer_id = "cust-456"
        mock_invoice.billing_email = "customer@example.com"
        mock_invoice.billing_address = {"name": "John Doe", "street": "123 Main St"}

        # Create mock line item with object attributes (not dict)
        mock_line_item = MagicMock()
        mock_line_item.description = "Item 1"
        mock_line_item.quantity = 1
        mock_line_item.unit_price = 10000
        mock_line_item.total_price = 10000
        mock_line_item.product_id = None
        mock_line_item.subscription_id = None
        mock_line_item.tax_rate = None
        mock_line_item.tax_amount = 0
        mock_line_item.discount_percentage = None
        mock_line_item.discount_amount = 0
        mock_line_item.extra_data = {}

        mock_invoice.line_items = [mock_line_item]
        mock_invoice.subtotal = 10000
        mock_invoice.tax_amount = 1000
        mock_invoice.discount_amount = 500
        mock_invoice.total_amount = 10500
        mock_invoice.remaining_balance = 10500
        mock_invoice.currency = "USD"
        mock_invoice.status = InvoiceStatus.OPEN
        mock_invoice.created_at = now
        mock_invoice.updated_at = now
        mock_invoice.issue_date = now
        mock_invoice.due_date = now + timedelta(days=30)
        mock_invoice.finalized_at = now
        mock_invoice.paid_at = None
        mock_invoice.voided_at = None
        mock_invoice.notes = "Test notes"
        mock_invoice.internal_notes = "Internal notes"
        mock_invoice.subscription_id = "sub-123"
        mock_invoice.idempotency_key = "idem-key"
        mock_invoice.created_by = "user-123"
        mock_invoice.extra_data = {"custom": "value"}
        mock_invoice.payments = []  # No payments for this test

        # Map to detail
        result = query_handler._map_to_detail(mock_invoice)

        # Verify detailed mapping
        assert isinstance(result, InvoiceDetail)
        assert result.invoice_id == "inv-123"
        assert result.tenant_id == "tenant-1"
        assert result.customer_name == "John Doe"
        assert result.subtotal == 10000
        assert result.tax_amount == 1000
        assert result.discount_amount == 500
        assert result.total_amount == 10500
        assert result.total_paid == 0
        assert result.notes == "Test notes"
        assert result.internal_notes == "Internal notes"
        assert result.subscription_id == "sub-123"
        assert result.idempotency_key == "idem-key"
        assert result.created_by == "user-123"
        assert result.extra_data == {"custom": "value"}
