"""
Comprehensive tests for billing/receipts/generators.py to improve coverage from 0%.

Tests cover:
- ReceiptGenerator abstract base class
- HTMLReceiptGenerator: HTML generation, formatting, conditional sections
- PDFReceiptGenerator: PDF generation (placeholder), text content
- TextReceiptGenerator: plain text receipt generation
- All receipt fields and optional fields
"""

from datetime import datetime

import pytest

from dotmac.platform.billing.receipts.generators import (
    HTMLReceiptGenerator,
    PDFReceiptGenerator,
    ReceiptGenerator,
    TextReceiptGenerator,
)
from dotmac.platform.billing.receipts.models import Receipt, ReceiptLineItem


@pytest.fixture
def sample_line_items():
    """Create sample receipt line items."""
    return [
        ReceiptLineItem(
            description="Premium Subscription",
            quantity=1,
            unit_price=9900,
            total_price=9900,
        ),
        ReceiptLineItem(
            description="Additional Storage (50GB)",
            quantity=2,
            unit_price=500,
            total_price=1000,
        ),
    ]


@pytest.fixture
def minimal_receipt(sample_line_items):
    """Create minimal receipt with required fields only."""
    return Receipt(
        tenant_id="tenant_123",
        receipt_number="RCP-2024-001",
        issue_date=datetime(2024, 1, 15, 10, 30, 0),
        customer_id="cust_123",
        customer_name="John Doe",
        customer_email="john@example.com",
        line_items=sample_line_items,
        subtotal=10900,
        tax_amount=1090,
        total_amount=11990,
        currency="USD",
        payment_method="credit_card",
        payment_status="completed",
    )


@pytest.fixture
def full_receipt(sample_line_items):
    """Create receipt with all optional fields."""
    return Receipt(
        tenant_id="tenant_456",
        receipt_number="RCP-2024-002",
        issue_date=datetime(2024, 2, 1, 14, 0, 0),
        customer_id="cust_456",
        customer_name="Jane Smith",
        customer_email="jane@example.com",
        line_items=sample_line_items,
        subtotal=10900,
        tax_amount=1090,
        total_amount=11990,
        currency="EUR",
        payment_method="bank_transfer",
        payment_status="pending",
        payment_id="pay_123456789",
        invoice_id="inv_987654321",
        billing_address={
            "street": "123 Main Street",
            "city": "Berlin",
            "postal_code": "10115",
            "country": "Germany",
        },
        notes="Thank you for your business. Contact support@example.com for questions.",
    )


@pytest.mark.unit
class TestReceiptGeneratorBase:
    """Test ReceiptGenerator abstract base class."""

    def test_cannot_instantiate_abstract_class(self):
        """Test that ReceiptGenerator cannot be instantiated directly."""
        with pytest.raises(TypeError):
            ReceiptGenerator()

    def test_subclass_must_implement_generate(self):
        """Test that subclasses must implement generate method."""

        class IncompleteGenerator(ReceiptGenerator):
            pass

        with pytest.raises(TypeError):
            IncompleteGenerator()


@pytest.mark.unit
class TestHTMLReceiptGenerator:
    """Test HTMLReceiptGenerator."""

    @pytest.mark.asyncio
    async def test_generate_html_minimal_receipt(self, minimal_receipt):
        """Test generating HTML for minimal receipt."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        assert isinstance(html, str)
        assert "<!DOCTYPE html>" in html
        assert minimal_receipt.receipt_number in html
        assert minimal_receipt.customer_name in html
        assert minimal_receipt.customer_email in html

    @pytest.mark.asyncio
    async def test_generate_html_includes_line_items(self, minimal_receipt):
        """Test HTML includes all line items."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # Check line items are present
        assert "Premium Subscription" in html
        assert "Additional Storage" in html
        assert "$99.00" in html  # Premium subscription price
        assert "$5.00" in html  # Storage unit price

    @pytest.mark.asyncio
    async def test_generate_html_includes_totals(self, minimal_receipt):
        """Test HTML includes subtotal, tax, and total."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # Check monetary amounts
        assert "$109.00" in html  # Subtotal
        assert "$10.90" in html  # Tax
        assert "$119.90" in html  # Total
        assert "USD" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_payment_id(self, full_receipt):
        """Test HTML includes payment ID when present."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(full_receipt)

        assert full_receipt.payment_id in html
        assert "Payment ID" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_invoice_id(self, full_receipt):
        """Test HTML includes invoice ID when present."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(full_receipt)

        assert full_receipt.invoice_id in html
        assert "Invoice ID" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_billing_address(self, full_receipt):
        """Test HTML includes billing address when present."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(full_receipt)

        # Check all address components
        assert "123 Main Street" in html
        assert "Berlin" in html
        assert "10115" in html
        assert "Germany" in html
        assert "Street:" in html  # Title case formatting

    @pytest.mark.asyncio
    async def test_generate_html_with_notes(self, full_receipt):
        """Test HTML includes notes when present."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(full_receipt)

        assert full_receipt.notes in html
        assert "Notes" in html

    @pytest.mark.asyncio
    async def test_generate_html_without_optional_fields(self, minimal_receipt):
        """Test HTML generation without optional fields."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # Optional fields should not appear
        assert "Payment ID" not in html
        assert "Invoice ID" not in html
        assert "Notes" not in html

    @pytest.mark.asyncio
    async def test_generate_html_payment_method_formatting(self, minimal_receipt):
        """Test payment method formatting (underscores replaced)."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # "credit_card" should be formatted as "Credit Card"
        assert "Credit Card" in html

    @pytest.mark.asyncio
    async def test_generate_html_payment_status_formatting(self, minimal_receipt):
        """Test payment status formatting."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # "completed" should be formatted as "Completed"
        assert "Completed" in html

    @pytest.mark.asyncio
    async def test_generate_html_date_formatting(self, minimal_receipt):
        """Test date formatting in HTML."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        # Date should be formatted as "January 15, 2024"
        assert "January 15, 2024" in html

    @pytest.mark.asyncio
    async def test_generate_html_has_styling(self, minimal_receipt):
        """Test HTML includes CSS styling."""
        generator = HTMLReceiptGenerator()

        html = await generator.generate_html(minimal_receipt)

        assert "<style>" in html
        assert "font-family" in html
        assert "border-collapse" in html

    @pytest.mark.asyncio
    async def test_generate_method_calls_generate_html(self, minimal_receipt):
        """Test that generate method delegates to generate_html."""
        generator = HTMLReceiptGenerator()

        result = await generator.generate(minimal_receipt)

        # Should return same result as generate_html
        assert isinstance(result, str)
        assert minimal_receipt.receipt_number in result


@pytest.mark.unit
class TestPDFReceiptGenerator:
    """Test PDFReceiptGenerator."""

    @pytest.mark.asyncio
    async def test_generate_pdf_returns_bytes(self, minimal_receipt):
        """Test PDF generation returns bytes."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)

        assert isinstance(pdf_data, bytes)

    @pytest.mark.asyncio
    async def test_generate_pdf_includes_receipt_info(self, minimal_receipt):
        """Test PDF includes receipt information."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        assert minimal_receipt.receipt_number in content
        assert minimal_receipt.customer_name in content
        assert minimal_receipt.customer_email in content

    @pytest.mark.asyncio
    async def test_generate_pdf_includes_line_items(self, minimal_receipt):
        """Test PDF includes line items."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        assert "Premium Subscription" in content
        assert "Additional Storage" in content
        assert "LINE ITEMS" in content

    @pytest.mark.asyncio
    async def test_generate_pdf_includes_totals(self, minimal_receipt):
        """Test PDF includes financial totals."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        assert "Subtotal" in content
        assert "Tax" in content
        assert "Total" in content
        assert "USD" in content

    @pytest.mark.asyncio
    async def test_generate_pdf_with_billing_address(self, full_receipt):
        """Test PDF includes billing address when present."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(full_receipt)
        content = pdf_data.decode("utf-8")

        assert "BILLING ADDRESS" in content
        assert "123 Main Street" in content
        assert "Berlin" in content
        assert "Germany" in content

    @pytest.mark.asyncio
    async def test_generate_pdf_with_notes(self, full_receipt):
        """Test PDF includes notes when present."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(full_receipt)
        content = pdf_data.decode("utf-8")

        assert full_receipt.notes in content

    @pytest.mark.asyncio
    async def test_generate_pdf_payment_info_formatting(self, minimal_receipt):
        """Test PDF formats payment information."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        # Should format "credit_card" as "Credit Card"
        assert "Credit Card" in content
        # Should format "completed" as "Completed"
        assert "Completed" in content

    @pytest.mark.asyncio
    async def test_generate_simple_pdf_content(self, minimal_receipt):
        """Test internal _generate_simple_pdf_content method."""
        generator = PDFReceiptGenerator()

        content = generator._generate_simple_pdf_content(minimal_receipt)

        assert isinstance(content, str)
        assert "RECEIPT" in content
        assert minimal_receipt.receipt_number in content

    @pytest.mark.asyncio
    async def test_generate_pdf_date_formatting(self, minimal_receipt):
        """Test PDF date formatting."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        # Date should be formatted as "January 15, 2024"
        assert "January 15, 2024" in content

    @pytest.mark.asyncio
    async def test_generate_pdf_line_item_formatting(self, minimal_receipt):
        """Test PDF line item table formatting."""
        generator = PDFReceiptGenerator()

        pdf_data = await generator.generate_pdf(minimal_receipt)
        content = pdf_data.decode("utf-8")

        # Should have header row
        assert "Description" in content
        assert "Qty" in content
        assert "Unit Price" in content
        assert "Total" in content

        # Should have separator lines
        assert "---" in content

    @pytest.mark.asyncio
    async def test_generate_method_calls_generate_pdf(self, minimal_receipt):
        """Test that generate method delegates to generate_pdf."""
        generator = PDFReceiptGenerator()

        result = await generator.generate(minimal_receipt)

        assert isinstance(result, bytes)


@pytest.mark.unit
class TestTextReceiptGenerator:
    """Test TextReceiptGenerator."""

    @pytest.mark.asyncio
    async def test_generate_text_basic_info(self, minimal_receipt):
        """Test text generation includes basic receipt info."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(minimal_receipt)

        assert isinstance(text, str)
        assert minimal_receipt.receipt_number in text
        assert minimal_receipt.customer_name in text
        assert minimal_receipt.customer_email in text

    @pytest.mark.asyncio
    async def test_generate_text_includes_totals(self, minimal_receipt):
        """Test text includes total amount."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(minimal_receipt)

        assert "$119.90" in text
        assert "USD" in text

    @pytest.mark.asyncio
    async def test_generate_text_includes_payment_info(self, minimal_receipt):
        """Test text includes payment method and status."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(minimal_receipt)

        assert minimal_receipt.payment_method in text
        assert minimal_receipt.payment_status in text

    @pytest.mark.asyncio
    async def test_generate_text_with_payment_id(self, full_receipt):
        """Test text includes payment ID when present."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(full_receipt)

        assert full_receipt.payment_id in text
        assert "Payment ID" in text

    @pytest.mark.asyncio
    async def test_generate_text_with_invoice_id(self, full_receipt):
        """Test text includes invoice ID when present."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(full_receipt)

        assert full_receipt.invoice_id in text
        assert "Invoice ID" in text

    @pytest.mark.asyncio
    async def test_generate_text_without_optional_fields(self, minimal_receipt):
        """Test text generation without optional fields."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(minimal_receipt)

        # Optional fields should not appear
        assert "Payment ID" not in text
        assert "Invoice ID" not in text

    @pytest.mark.asyncio
    async def test_generate_text_date_formatting(self, minimal_receipt):
        """Test text date formatting."""
        generator = TextReceiptGenerator()

        text = await generator.generate_text(minimal_receipt)

        # Date should be formatted as "YYYY-MM-DD HH:MM:SS"
        assert "2024-01-15 10:30:00" in text

    @pytest.mark.asyncio
    async def test_generate_method_calls_generate_text(self, minimal_receipt):
        """Test that generate method delegates to generate_text."""
        generator = TextReceiptGenerator()

        result = await generator.generate(minimal_receipt)

        assert isinstance(result, str)
        assert minimal_receipt.receipt_number in result


@pytest.mark.unit
class TestMultipleGenerators:
    """Test using multiple generators with same receipt."""

    @pytest.mark.asyncio
    async def test_all_generators_produce_valid_output(self, full_receipt):
        """Test all generators work with the same receipt."""
        html_gen = HTMLReceiptGenerator()
        pdf_gen = PDFReceiptGenerator()
        text_gen = TextReceiptGenerator()

        html = await html_gen.generate(full_receipt)
        pdf = await pdf_gen.generate(full_receipt)
        text = await text_gen.generate(full_receipt)

        # All should produce valid output
        assert isinstance(html, str) and len(html) > 0
        assert isinstance(pdf, bytes) and len(pdf) > 0
        assert isinstance(text, str) and len(text) > 0

        # All should include receipt number
        assert full_receipt.receipt_number in html
        assert full_receipt.receipt_number in pdf.decode("utf-8")
        assert full_receipt.receipt_number in text

    @pytest.mark.asyncio
    async def test_generators_handle_different_currencies(self):
        """Test generators handle different currency codes."""
        line_items = [
            ReceiptLineItem(
                description="Product",
                quantity=1,
                unit_price=5000,
                total_price=5000,
            )
        ]

        receipt_gbp = Receipt(
            tenant_id="tenant_789",
            receipt_number="RCP-GBP",
            issue_date=datetime(2024, 1, 1),
            customer_id="cust_789",
            customer_name="UK Customer",
            customer_email="uk@example.com",
            line_items=line_items,
            subtotal=5000,
            tax_amount=1000,
            total_amount=6000,
            currency="GBP",
            payment_method="card",
            payment_status="paid",
        )

        html_gen = HTMLReceiptGenerator()
        html = await html_gen.generate(receipt_gbp)

        assert "GBP" in html
        assert "$60.00" in html  # Still uses $ for formatting

    @pytest.mark.asyncio
    async def test_generators_handle_multiple_line_items(self):
        """Test generators handle receipts with many line items."""
        line_items = [
            ReceiptLineItem(
                description=f"Item {i}",
                quantity=i,
                unit_price=1000 * i,
                total_price=1000 * i * i,
            )
            for i in range(1, 6)
        ]

        receipt = Receipt(
            tenant_id="tenant_multi",
            receipt_number="RCP-MULTI",
            issue_date=datetime(2024, 1, 1),
            customer_id="cust_multi",
            customer_name="Customer",
            customer_email="customer@example.com",
            line_items=line_items,
            subtotal=55000,
            tax_amount=5500,
            total_amount=60500,
            currency="USD",
            payment_method="card",
            payment_status="paid",
        )

        html_gen = HTMLReceiptGenerator()
        html = await html_gen.generate(receipt)

        # All items should be present
        for i in range(1, 6):
            assert f"Item {i}" in html
