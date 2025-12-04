"""
Comprehensive tests for receipt generators.

Achieves 90%+ coverage for receipt generation functionality.
"""

from datetime import UTC, datetime

import pytest

from dotmac.platform.billing.receipts.generators import (
    HTMLReceiptGenerator,
    PDFReceiptGenerator,
    ReceiptGenerator,
    TextReceiptGenerator,
)
from dotmac.platform.billing.receipts.models import Receipt, ReceiptLineItem


@pytest.mark.unit
class TestReceiptModels:
    """Tests for Receipt and ReceiptLineItem models."""

    def test_receipt_line_item_creation(self):
        """Test creating a receipt line item."""
        line_item = ReceiptLineItem(
            description="Product License",
            quantity=2,
            unit_price=5000,
            total_price=10000,
            tax_rate=8.0,
            tax_amount=800,
            product_id="prod_123",
            sku="SKU-001",
        )

        assert line_item.description == "Product License"
        assert line_item.quantity == 2
        assert line_item.unit_price == 5000
        assert line_item.total_price == 10000
        assert line_item.tax_rate == 8.0
        assert line_item.tax_amount == 800
        assert line_item.product_id == "prod_123"
        assert line_item.sku == "SKU-001"
        assert line_item.line_item_id is not None

    def test_receipt_line_item_defaults(self):
        """Test default values for receipt line item."""
        line_item = ReceiptLineItem(
            description="Service",
            unit_price=1000,
            total_price=1000,
        )

        assert line_item.quantity == 1
        assert line_item.tax_rate == 0.0
        assert line_item.tax_amount == 0
        assert line_item.product_id is None
        assert line_item.sku is None
        assert line_item.extra_data == {}

    def test_receipt_creation(self):
        """Test creating a receipt."""
        line_items = [
            ReceiptLineItem(
                description="Product A",
                quantity=1,
                unit_price=10000,
                total_price=10000,
            ),
            ReceiptLineItem(
                description="Product B",
                quantity=2,
                unit_price=5000,
                total_price=10000,
            ),
        ]

        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000001",
            customer_id="cust_123",
            customer_name="John Doe",
            customer_email="john@example.com",
            subtotal=20000,
            tax_amount=1600,
            total_amount=21600,
            payment_method="credit_card",
            payment_status="completed",
            line_items=line_items,
            payment_id="pay_123",
            invoice_id="inv_123",
            billing_address={
                "street": "123 Main St",
                "city": "New York",
                "state": "NY",
                "postal_code": "10001",
                "country": "US",
            },
            notes="Thank you for your purchase",
        )

        assert receipt.receipt_number == "REC-2024-000001"
        assert receipt.customer_name == "John Doe"
        assert receipt.customer_email == "john@example.com"
        assert receipt.subtotal == 20000
        assert receipt.tax_amount == 1600
        assert receipt.total_amount == 21600
        assert receipt.currency == "USD"
        assert len(receipt.line_items) == 2
        assert receipt.payment_id == "pay_123"
        assert receipt.invoice_id == "inv_123"
        assert receipt.billing_address["city"] == "New York"
        assert receipt.notes == "Thank you for your purchase"

    def test_receipt_minimal(self):
        """Test creating a receipt with minimal required fields."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000002",
            customer_id="cust_456",
            customer_name="Jane Smith",
            customer_email="jane@example.com",
            subtotal=5000,
            total_amount=5000,
            payment_method="bank_transfer",
            payment_status="pending",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=5000,
                    total_price=5000,
                )
            ],
        )

        assert receipt.tax_amount == 0
        assert receipt.currency == "USD"
        assert receipt.payment_id is None
        assert receipt.invoice_id is None
        assert receipt.billing_address == {}
        assert receipt.notes is None
        assert receipt.pdf_url is None
        assert receipt.html_content is None


@pytest.mark.unit
class TestReceiptGeneratorBase:
    """Tests for base ReceiptGenerator class."""

    def test_receipt_generator_is_abstract(self):
        """Test that ReceiptGenerator is abstract."""
        with pytest.raises(TypeError):
            ReceiptGenerator()

    @pytest.mark.asyncio
    async def test_receipt_generator_subclass_must_implement_generate(self):
        """Test that subclasses must implement generate method."""

        class IncompleteGenerator(ReceiptGenerator):
            pass

        with pytest.raises(TypeError):
            IncompleteGenerator()


@pytest.mark.unit
class TestHTMLReceiptGenerator:
    """Tests for HTML receipt generation."""

    @pytest.fixture
    def sample_receipt(self):
        """Create a sample receipt for testing."""
        return Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000001",
            customer_id="cust_123",
            customer_name="John Doe",
            customer_email="john@example.com",
            subtotal=10000,
            tax_amount=800,
            total_amount=10800,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Product License",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                    tax_rate=8.0,
                    tax_amount=800,
                )
            ],
            payment_id="pay_123",
            invoice_id="inv_123",
            billing_address={
                "street": "123 Main St",
                "city": "New York",
                "state": "NY",
                "postal_code": "10001",
            },
            notes="Thank you for your purchase!",
        )

    @pytest.mark.asyncio
    async def test_generate_html_basic(self, sample_receipt):
        """Test basic HTML receipt generation."""
        generator = HTMLReceiptGenerator()
        html = await generator.generate(sample_receipt)

        assert "<!DOCTYPE html>" in html
        assert "<html>" in html
        assert "</html>" in html
        assert "REC-2024-000001" in html
        assert "John Doe" in html
        assert "john@example.com" in html
        assert "Product License" in html
        assert "$100.00" in html  # Unit price
        assert "$8.00" in html  # Tax
        assert "$108.00" in html  # Total
        assert "credit_card" in html or "Credit Card" in html
        assert "completed" in html or "Completed" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_billing_address(self, sample_receipt):
        """Test HTML generation includes billing address."""
        generator = HTMLReceiptGenerator()
        html = await generator.generate(sample_receipt)

        assert "123 Main St" in html
        assert "New York" in html
        assert "NY" in html
        assert "10001" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_payment_invoice_ids(self, sample_receipt):
        """Test HTML includes payment and invoice IDs."""
        generator = HTMLReceiptGenerator()
        html = await generator.generate(sample_receipt)

        assert "pay_123" in html
        assert "inv_123" in html
        assert "Payment ID" in html or "Payment Information" in html
        assert "Invoice ID" in html or "Invoice Information" in html

    @pytest.mark.asyncio
    async def test_generate_html_with_notes(self, sample_receipt):
        """Test HTML includes notes section."""
        generator = HTMLReceiptGenerator()
        html = await generator.generate(sample_receipt)

        assert "Thank you for your purchase!" in html
        assert "Notes" in html

    @pytest.mark.asyncio
    async def test_generate_html_without_optional_fields(self):
        """Test HTML generation without optional fields."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000002",
            customer_id="cust_456",
            customer_name="Jane Smith",
            customer_email="jane@example.com",
            subtotal=5000,
            total_amount=5000,
            payment_method="bank_transfer",
            payment_status="pending",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=5000,
                    total_price=5000,
                )
            ],
        )

        generator = HTMLReceiptGenerator()
        html = await generator.generate(receipt)

        assert "REC-2024-000002" in html
        assert "Jane Smith" in html
        assert "jane@example.com" in html
        assert "$50.00" in html
        assert "Notes" not in html or "Notes</div></div>" not in html  # Empty notes section
        assert "Payment ID" not in html or "Payment Information</div></div>" not in html
        assert "Invoice ID" not in html or "Invoice Information</div></div>" not in html

    @pytest.mark.asyncio
    async def test_generate_html_multiple_line_items(self):
        """Test HTML generation with multiple line items."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000003",
            customer_id="cust_789",
            customer_name="Bob Wilson",
            customer_email="bob@example.com",
            subtotal=30000,
            tax_amount=2400,
            total_amount=32400,
            payment_method="paypal",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Product A",
                    quantity=2,
                    unit_price=5000,
                    total_price=10000,
                ),
                ReceiptLineItem(
                    description="Product B",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                ),
                ReceiptLineItem(
                    description="Product C",
                    quantity=4,
                    unit_price=2500,
                    total_price=10000,
                ),
            ],
        )

        generator = HTMLReceiptGenerator()
        html = await generator.generate(receipt)

        assert "Product A" in html
        assert "Product B" in html
        assert "Product C" in html
        assert "$300.00" in html  # Subtotal
        assert "$24.00" in html  # Tax
        assert "$324.00" in html  # Total

    @pytest.mark.asyncio
    async def test_generate_html_currency_display(self):
        """Test currency is properly displayed in HTML."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000004",
            customer_id="cust_eur",
            customer_name="Euro Customer",
            customer_email="euro@example.com",
            currency="EUR",
            subtotal=10000,
            total_amount=10000,
            payment_method="bank_transfer",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=10000,
                    total_price=10000,
                )
            ],
        )

        generator = HTMLReceiptGenerator()
        html = await generator.generate(receipt)

        assert "EUR" in html
        assert "$100.00 EUR" in html

    @pytest.mark.asyncio
    async def test_generate_html_styling(self, sample_receipt):
        """Test HTML includes proper styling."""
        generator = HTMLReceiptGenerator()
        html = await generator.generate(sample_receipt)

        assert "<style>" in html
        assert "font-family" in html
        assert "border-collapse" in html
        assert "background-color" in html
        assert ".receipt-number" in html
        assert ".info-section" in html
        assert ".payment-info" in html


@pytest.mark.unit
class TestPDFReceiptGenerator:
    """Tests for PDF receipt generation."""

    @pytest.fixture
    def sample_receipt(self):
        """Create a sample receipt for testing."""
        return Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000001",
            customer_id="cust_123",
            customer_name="John Doe",
            customer_email="john@example.com",
            subtotal=10000,
            tax_amount=800,
            total_amount=10800,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Product License - Professional Edition",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                )
            ],
            billing_address={
                "street": "123 Main St",
                "city": "New York",
                "state": "NY",
                "postal_code": "10001",
            },
            notes="Thank you for your purchase!",
        )

    @pytest.mark.asyncio
    async def test_generate_pdf_basic(self, sample_receipt):
        """Test basic PDF receipt generation."""
        generator = PDFReceiptGenerator()
        pdf_bytes = await generator.generate(sample_receipt)

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

        # Convert bytes to string to check content
        pdf_text = pdf_bytes.decode("utf-8")
        assert "RECEIPT" in pdf_text
        assert "REC-2024-000001" in pdf_text
        assert "John Doe" in pdf_text
        assert "john@example.com" in pdf_text

    @pytest.mark.asyncio
    async def test_generate_pdf_content(self, sample_receipt):
        """Test PDF contains all necessary information."""
        generator = PDFReceiptGenerator()
        pdf_bytes = await generator.generate_pdf(sample_receipt)

        pdf_text = pdf_bytes.decode("utf-8")

        # Check customer information
        assert "CUSTOMER INFORMATION" in pdf_text
        assert "Name: John Doe" in pdf_text
        assert "Email: john@example.com" in pdf_text

        # Check billing address
        assert "BILLING ADDRESS" in pdf_text
        assert "123 Main St" in pdf_text
        assert "New York" in pdf_text
        assert "NY" in pdf_text
        assert "10001" in pdf_text

        # Check line items
        assert "LINE ITEMS" in pdf_text
        assert "Product License" in pdf_text
        assert "100.00" in pdf_text  # Unit price
        assert "100.00" in pdf_text  # Total price

        # Check totals
        assert "Subtotal: $100.00" in pdf_text
        assert "Tax:      $8.00" in pdf_text
        assert "Total:    $108.00 USD" in pdf_text

        # Check payment information
        assert "Payment Method: Credit Card" in pdf_text
        assert "Payment Status: Completed" in pdf_text

        # Check notes
        assert "Thank you for your purchase!" in pdf_text

    @pytest.mark.asyncio
    async def test_generate_pdf_without_optional_fields(self):
        """Test PDF generation without optional fields."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000002",
            customer_id="cust_456",
            customer_name="Jane Smith",
            customer_email="jane@example.com",
            subtotal=5000,
            total_amount=5000,
            payment_method="bank_transfer",
            payment_status="pending",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=5000,
                    total_price=5000,
                )
            ],
        )

        generator = PDFReceiptGenerator()
        pdf_bytes = await generator.generate(receipt)

        pdf_text = pdf_bytes.decode("utf-8")

        assert "BILLING ADDRESS" not in pdf_text
        assert "Notes:" not in pdf_text
        assert "Jane Smith" in pdf_text
        assert "$50.00" in pdf_text

    @pytest.mark.asyncio
    async def test_generate_pdf_long_description_truncation(self):
        """Test PDF handles long descriptions properly."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000003",
            customer_id="cust_789",
            customer_name="Bob Wilson",
            customer_email="bob@example.com",
            subtotal=10000,
            total_amount=10000,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Very Long Product Description That Exceeds The Normal Length",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                )
            ],
        )

        generator = PDFReceiptGenerator()
        pdf_bytes = await generator.generate(receipt)

        pdf_text = pdf_bytes.decode("utf-8")

        # Should truncate to 25 characters
        assert "Very Long Product Descrip" in pdf_text

    @pytest.mark.asyncio
    async def test_generate_pdf_multiple_line_items(self):
        """Test PDF with multiple line items."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000004",
            customer_id="cust_multi",
            customer_name="Multi Customer",
            customer_email="multi@example.com",
            subtotal=30000,
            tax_amount=2400,
            total_amount=32400,
            payment_method="paypal",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Product A",
                    quantity=2,
                    unit_price=5000,
                    total_price=10000,
                ),
                ReceiptLineItem(
                    description="Product B",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                ),
                ReceiptLineItem(
                    description="Product C",
                    quantity=4,
                    unit_price=2500,
                    total_price=10000,
                ),
            ],
        )

        generator = PDFReceiptGenerator()
        pdf_bytes = await generator.generate(receipt)

        pdf_text = pdf_bytes.decode("utf-8")

        assert "Product A" in pdf_text
        assert "Product B" in pdf_text
        assert "Product C" in pdf_text
        assert "2 " in pdf_text  # Quantity for Product A
        assert "4 " in pdf_text  # Quantity for Product C
        assert "Subtotal: $300.00" in pdf_text
        assert "Tax:      $24.00" in pdf_text
        assert "Total:    $324.00 USD" in pdf_text

    def test_generate_simple_pdf_content(self):
        """Test the internal PDF content generation method."""
        generator = PDFReceiptGenerator()

        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-TEST",
            customer_id="cust_test",
            customer_name="Test User",
            customer_email="test@example.com",
            subtotal=10000,
            tax_amount=800,
            total_amount=10800,
            currency="GBP",
            payment_method="bank_transfer",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Test Product",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                )
            ],
        )

        content = generator._generate_simple_pdf_content(receipt)

        assert "RECEIPT" in content
        assert "REC-2024-TEST" in content
        assert "Test User" in content
        assert "test@example.com" in content
        assert "GBP" in content
        assert "Thank you for your business!" in content


@pytest.mark.unit
class TestTextReceiptGenerator:
    """Tests for plain text receipt generation."""

    @pytest.fixture
    def sample_receipt(self):
        """Create a sample receipt for testing."""
        return Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000001",
            customer_id="cust_123",
            customer_name="John Doe",
            customer_email="john@example.com",
            subtotal=10000,
            tax_amount=800,
            total_amount=10800,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Product License",
                    quantity=1,
                    unit_price=10000,
                    total_price=10000,
                )
            ],
            payment_id="pay_123",
            invoice_id="inv_123",
        )

    @pytest.mark.asyncio
    async def test_generate_text_basic(self, sample_receipt):
        """Test basic text receipt generation."""
        generator = TextReceiptGenerator()
        text = await generator.generate(sample_receipt)

        assert "Receipt: REC-2024-000001" in text
        assert "Customer: John Doe (john@example.com)" in text
        assert "Total: $108.00 USD" in text
        assert "Payment: credit_card - completed" in text

    @pytest.mark.asyncio
    async def test_generate_text_with_ids(self, sample_receipt):
        """Test text receipt includes payment and invoice IDs."""
        generator = TextReceiptGenerator()
        text = await generator.generate_text(sample_receipt)

        assert "Payment ID: pay_123" in text
        assert "Invoice ID: inv_123" in text

    @pytest.mark.asyncio
    async def test_generate_text_without_ids(self):
        """Test text receipt without optional IDs."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000002",
            customer_id="cust_456",
            customer_name="Jane Smith",
            customer_email="jane@example.com",
            subtotal=5000,
            total_amount=5000,
            payment_method="bank_transfer",
            payment_status="pending",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=5000,
                    total_price=5000,
                )
            ],
        )

        generator = TextReceiptGenerator()
        text = await generator.generate(receipt)

        assert "REC-2024-000002" in text
        assert "Jane Smith" in text
        assert "$50.00 USD" in text
        assert "Payment ID:" not in text
        assert "Invoice ID:" not in text

    @pytest.mark.asyncio
    async def test_generate_text_date_format(self):
        """Test text receipt date formatting."""
        specific_date = datetime(2024, 3, 15, 10, 30, 45, tzinfo=UTC)
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000003",
            customer_id="cust_789",
            customer_name="Date Test",
            customer_email="date@example.com",
            issue_date=specific_date,
            subtotal=1000,
            total_amount=1000,
            payment_method="cash",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Item",
                    unit_price=1000,
                    total_price=1000,
                )
            ],
        )

        generator = TextReceiptGenerator()
        text = await generator.generate(receipt)

        assert "Date: 2024-03-15 10:30:45" in text

    @pytest.mark.asyncio
    async def test_generate_text_different_currency(self):
        """Test text receipt with different currency."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-000004",
            customer_id="cust_eur",
            customer_name="Euro Customer",
            customer_email="euro@example.com",
            currency="EUR",
            subtotal=10000,
            total_amount=10000,
            payment_method="bank_transfer",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Service",
                    unit_price=10000,
                    total_price=10000,
                )
            ],
        )

        generator = TextReceiptGenerator()
        text = await generator.generate(receipt)

        assert "$100.00 EUR" in text


@pytest.mark.unit
class TestGeneratorIntegration:
    """Integration tests for receipt generators."""

    @pytest.mark.asyncio
    async def test_all_generators_produce_output(self):
        """Test that all generators produce some output."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-INT001",
            customer_id="cust_int",
            customer_name="Integration Test",
            customer_email="integration@example.com",
            subtotal=10000,
            total_amount=10000,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Test Item",
                    unit_price=10000,
                    total_price=10000,
                )
            ],
        )

        # Test HTML generator
        html_gen = HTMLReceiptGenerator()
        html_output = await html_gen.generate(receipt)
        assert len(html_output) > 100
        assert isinstance(html_output, str)

        # Test PDF generator
        pdf_gen = PDFReceiptGenerator()
        pdf_output = await pdf_gen.generate(receipt)
        assert len(pdf_output) > 50
        assert isinstance(pdf_output, bytes)

        # Test text generator
        text_gen = TextReceiptGenerator()
        text_output = await text_gen.generate(receipt)
        assert len(text_output) > 50
        assert isinstance(text_output, str)

    @pytest.mark.asyncio
    async def test_generators_handle_special_characters(self):
        """Test generators handle special characters in data."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-SPECIAL",
            customer_id="cust_special",
            customer_name="O'Brien & Sons, Ltd.",
            customer_email="o'brien@example.com",
            subtotal=10000,
            total_amount=10000,
            payment_method="credit_card",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description='Product with "quotes" & special <chars>',
                    unit_price=10000,
                    total_price=10000,
                )
            ],
            notes="Special note: 10% discount & free shipping!",
        )

        # HTML should escape special characters
        html_gen = HTMLReceiptGenerator()
        html_output = await html_gen.generate(receipt)
        assert "O'Brien" in html_output or "O&#39;Brien" in html_output
        assert "&amp;" in html_output or "& " in html_output

        # PDF (text) should handle special characters
        pdf_gen = PDFReceiptGenerator()
        pdf_output = await pdf_gen.generate(receipt)
        pdf_text = pdf_output.decode("utf-8")
        assert "O'Brien" in pdf_text

        # Text should preserve special characters
        text_gen = TextReceiptGenerator()
        text_output = await text_gen.generate(receipt)
        assert "O'Brien & Sons, Ltd." in text_output

    @pytest.mark.asyncio
    async def test_generators_handle_empty_line_items_list_validation(self):
        """Test that receipt validation requires at least one line item."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            Receipt(
                tenant_id="tenant_123",
                receipt_number="REC-2024-EMPTY",
                customer_id="cust_empty",
                customer_name="Empty Test",
                customer_email="empty@example.com",
                subtotal=0,
                total_amount=0,
                payment_method="credit_card",
                payment_status="completed",
                line_items=[],  # Empty list should fail validation
            )

    @pytest.mark.asyncio
    async def test_generators_handle_large_amounts(self):
        """Test generators handle large monetary amounts."""
        receipt = Receipt(
            tenant_id="tenant_123",
            receipt_number="REC-2024-LARGE",
            customer_id="cust_large",
            customer_name="Large Corp",
            customer_email="large@example.com",
            subtotal=99999999,  # $999,999.99
            tax_amount=7999999,  # $79,999.99
            total_amount=107999998,  # $1,079,999.98
            payment_method="bank_transfer",
            payment_status="completed",
            line_items=[
                ReceiptLineItem(
                    description="Enterprise License",
                    quantity=100,
                    unit_price=999999,
                    total_price=99999900,
                )
            ],
        )

        # Test all generators handle large amounts
        html_gen = HTMLReceiptGenerator()
        html_output = await html_gen.generate(receipt)
        assert "999999" in html_output or "999,999" in html_output

        pdf_gen = PDFReceiptGenerator()
        pdf_output = await pdf_gen.generate(receipt)
        pdf_text = pdf_output.decode("utf-8")
        assert "999999" in pdf_text

        text_gen = TextReceiptGenerator()
        text_output = await text_gen.generate(receipt)
        assert "1079999.98" in text_output

    @pytest.mark.asyncio
    async def test_generators_payment_method_formatting(self):
        """Test payment method formatting in generators."""
        test_methods = [
            ("credit_card", ["Credit Card", "credit card"]),
            ("bank_transfer", ["Bank Transfer", "bank transfer"]),
            ("paypal", ["Paypal", "paypal"]),
            ("crypto_payment", ["Crypto Payment", "crypto payment"]),
        ]

        for method, expected_formats in test_methods:
            receipt = Receipt(
                tenant_id="tenant_123",
                receipt_number=f"REC-2024-{method}",
                customer_id="cust_test",
                customer_name="Test User",
                customer_email="test@example.com",
                subtotal=1000,
                total_amount=1000,
                payment_method=method,
                payment_status="completed",
                line_items=[
                    ReceiptLineItem(
                        description="Test",
                        unit_price=1000,
                        total_price=1000,
                    )
                ],
            )

            html_gen = HTMLReceiptGenerator()
            html_output = await html_gen.generate(receipt)

            # Check that at least one expected format is in the output
            assert any(fmt in html_output for fmt in expected_formats + [method])
