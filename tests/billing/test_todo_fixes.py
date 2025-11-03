"""Tests for the TODO fixes in billing module."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.billing.core.enums import InvoiceStatus
from dotmac.platform.billing.integration import (
    BillingIntegrationService,
    BillingInvoiceRequest,
    InvoiceItem,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestBillingIntegrationFix:
    """Test that billing integration properly creates invoices."""

    @pytest.fixture
    def mock_db(self):
        """Create mock database session."""
        return AsyncMock()

    @pytest.fixture
    def billing_service(self, mock_db):
        """Create billing integration service."""
        with patch("dotmac.platform.billing.catalog.service.ProductService"):
            with patch("dotmac.platform.billing.pricing.service.PricingEngine"):
                with patch("dotmac.platform.billing.subscriptions.service.SubscriptionService"):
                    service = BillingIntegrationService(mock_db)
                    # Mock the invoice service methods we need
                    service.invoice_service = Mock()
                    return service

    @pytest.mark.asyncio
    async def test_create_invoice_uses_real_service(self, billing_service):
        """Test that _create_invoice uses the actual invoice service."""
        # Create mock invoice
        mock_invoice = Mock()
        mock_invoice.invoice_id = "inv-789"
        mock_invoice.status = InvoiceStatus.DRAFT
        mock_invoice.customer_id = "cust-123"

        # Mock invoice service methods
        billing_service.invoice_service.create_invoice = AsyncMock(return_value=mock_invoice)
        billing_service.invoice_service.finalize_invoice = AsyncMock(return_value=mock_invoice)

        # Create invoice request
        invoice_request = BillingInvoiceRequest(
            customer_id="cust-123",
            subscription_id="sub-456",
            billing_period_start=datetime.now(UTC),
            billing_period_end=datetime.now(UTC),
            items=[
                InvoiceItem(
                    product_id="prod-1",
                    description="Test Product",
                    quantity=1,
                    unit_price=Decimal("100.00"),
                    total_amount=Decimal("100.00"),
                    final_amount=Decimal("100.00"),
                )
            ],
            subtotal=Decimal("100.00"),
            total_discount=Decimal("0.00"),
            total_amount=Decimal("100.00"),
        )

        # Create invoice
        result = await billing_service._create_invoice(invoice_request, "tenant-123")

        # Verify
        assert result == "inv-789"
        billing_service.invoice_service.create_invoice.assert_called_once()
        billing_service.invoice_service.finalize_invoice.assert_called_once()

        # Check the invoice was created with correct parameters
        create_call = billing_service.invoice_service.create_invoice.call_args
        assert create_call.kwargs["tenant_id"] == "tenant-123"
        assert create_call.kwargs["customer_id"] == "cust-123"
        assert len(create_call.kwargs["line_items"]) == 1
        assert create_call.kwargs["line_items"][0]["unit_price"] == 10000  # Converted to cents

    @pytest.mark.asyncio
    async def test_create_invoice_handles_errors(self, billing_service):
        """Test that _create_invoice handles errors gracefully."""
        # Mock invoice service to raise error
        billing_service.invoice_service.create_invoice = AsyncMock(
            side_effect=Exception("Database error")
        )

        # Create invoice request
        invoice_request = BillingInvoiceRequest(
            customer_id="cust-123",
            subscription_id="sub-456",
            billing_period_start=datetime.now(UTC),
            billing_period_end=datetime.now(UTC),
            items=[],
            subtotal=Decimal("0"),
            total_discount=Decimal("0"),
            total_amount=Decimal("0"),
        )

        # Create invoice should return None on error
        result = await billing_service._create_invoice(invoice_request, "tenant-123")

        assert result is None
