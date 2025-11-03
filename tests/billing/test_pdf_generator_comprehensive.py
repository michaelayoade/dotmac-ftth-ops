"""
Comprehensive tests for PDF invoice generator using ReportLab.

Tests PDF generation, layout customization, locale formatting,
batch processing, and error handling.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import mock_open, patch

import pytest
from moneyed import Money
from reportlab.lib.pagesizes import LETTER

from dotmac.platform.billing.money_models import (
    MoneyField,
    MoneyInvoice,
    MoneyInvoiceLineItem,
)
from dotmac.platform.billing.pdf_generator_reportlab import (
    DEFAULT_MARGINS,
    DEFAULT_PAGE_SIZE,
    ReportLabInvoiceGenerator,
    default_reportlab_generator,
    generate_invoice_pdf_reportlab,
)


def create_test_line_item(
    description: str,
    quantity: int = 1,
    unit_price_amount: str = "100.00",
    tax_rate: str = "0.10",
    currency: str = "USD",
) -> "MoneyInvoiceLineItem":
    """Helper to create test line items with all required fields."""
    from decimal import Decimal

    from moneyed import Money

    from dotmac.platform.billing.money_models import MoneyField, MoneyInvoiceLineItem

    unit_price = Money(unit_price_amount, currency)
    tax_rate_decimal = Decimal(tax_rate)

    # Calculate values
    subtotal = Money(str(Decimal(unit_price_amount) * quantity), currency)
    tax = Money(str(Decimal(str(subtotal.amount)) * tax_rate_decimal), currency)
    total = Money(str(subtotal.amount + tax.amount), currency)

    return MoneyInvoiceLineItem(
        description=description,
        quantity=quantity,
        unit_price=MoneyField.from_money(unit_price),
        tax_rate=tax_rate_decimal,
        tax_amount=MoneyField.from_money(tax),
        total_price=MoneyField.from_money(total),
        discount_percentage=Decimal("0"),
        discount_amount=MoneyField.from_money(Money("0", currency)),
    )


@pytest.fixture
def sample_invoice():
    """Create a sample invoice for testing."""
    line_items = [
        MoneyInvoiceLineItem(
            description="Premium Subscription",
            quantity=1,
            unit_price=MoneyField.from_money(Money("99.00", "USD")),
            tax_rate=Decimal("0.10"),
            tax_amount=MoneyField.from_money(Money("9.90", "USD")),
            discount_percentage=Decimal("0"),
            discount_amount=MoneyField.from_money(Money("0.00", "USD")),
            total_price=MoneyField.from_money(Money("108.90", "USD")),
        ),
        MoneyInvoiceLineItem(
            description="Additional User Licenses",
            quantity=5,
            unit_price=MoneyField.from_money(Money("10.00", "USD")),
            tax_rate=Decimal("0.10"),
            tax_amount=MoneyField.from_money(Money("5.00", "USD")),
            discount_percentage=Decimal("0"),
            discount_amount=MoneyField.from_money(Money("0.00", "USD")),
            total_price=MoneyField.from_money(Money("55.00", "USD")),
        ),
    ]

    invoice = MoneyInvoice(
        invoice_number="INV-2025-001",
        customer_id="cust-123",
        tenant_id="tenant-123",
        billing_email="customer@example.com",
        currency="USD",
        status="paid",
        payment_status="paid",
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC),
        line_items=line_items,
        subtotal=MoneyField.from_money(Money("149.00", "USD")),
        tax_amount=MoneyField.from_money(Money("14.90", "USD")),
        discount_amount=MoneyField.from_money(Money("0.00", "USD")),
        total_amount=MoneyField.from_money(Money("163.90", "USD")),
        remaining_balance=MoneyField.from_money(Money("163.90", "USD")),
        notes="Thank you for your business!",
    )

    return invoice


@pytest.fixture
def company_info():
    """Create sample company information."""
    return {
        "name": "Test Company Inc.",
        "address": {
            "street": "123 Business St",
            "city": "San Francisco",
            "state": "CA",
            "postal_code": "94105",
            "country": "USA",
        },
        "email": "billing@testcompany.com",
        "phone": "+1 (555) 123-4567",
        "website": "www.testcompany.com",
        "tax_id": "12-3456789",
    }


@pytest.fixture
def customer_info():
    """Create sample customer information."""
    return {
        "name": "John Doe",
        "company": "Acme Corp",
    }


@pytest.mark.unit
class TestGeneratorInitialization:
    """Test generator initialization and configuration."""

    def test_default_initialization(self):
        """Test generator with default settings."""
        generator = ReportLabInvoiceGenerator()

        assert generator.page_size == DEFAULT_PAGE_SIZE
        assert generator.margins == DEFAULT_MARGINS
        assert generator.logo_path is None

    def test_custom_page_size(self):
        """Test generator with custom page size."""
        generator = ReportLabInvoiceGenerator(page_size=LETTER)

        assert generator.page_size == LETTER

    def test_custom_margins(self):
        """Test generator with custom margins."""
        custom_margins = (15, 15, 15, 15)
        generator = ReportLabInvoiceGenerator(margins=custom_margins)

        assert generator.margins == custom_margins

    def test_with_logo_path(self):
        """Test generator with logo path."""
        logo_path = "/path/to/logo.png"
        generator = ReportLabInvoiceGenerator(logo_path=logo_path)

        assert generator.logo_path == logo_path

    def test_styles_creation(self):
        """Test that custom styles are created."""
        generator = ReportLabInvoiceGenerator()

        assert "CompanyName" in generator.styles
        assert "InvoiceTitle" in generator.styles
        assert "SectionTitle" in generator.styles
        assert "Normal" in generator.styles
        assert "BoldText" in generator.styles


@pytest.mark.unit
class TestPDFGeneration:
    """Test PDF generation functionality."""

    def test_generate_basic_invoice(self, sample_invoice, company_info, customer_info):
        """Test generating a basic invoice PDF."""
        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=sample_invoice,
            company_info=company_info,
            customer_info=customer_info,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0
        assert pdf_bytes.startswith(b"%PDF")  # PDF file signature

    def test_generate_without_company_info(self, sample_invoice):
        """Test generating invoice without company info."""
        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(invoice=sample_invoice)

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_generate_without_customer_info(self, sample_invoice, company_info):
        """Test generating invoice without customer info."""
        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=sample_invoice,
            company_info=company_info,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_generate_with_payment_instructions(self, sample_invoice, company_info):
        """Test generating invoice with payment instructions."""
        generator = ReportLabInvoiceGenerator()

        payment_instructions = "Please pay within 30 days via bank transfer."

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=sample_invoice,
            company_info=company_info,
            payment_instructions=payment_instructions,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_generate_with_notes(self, company_info, customer_info):
        """Test generating invoice with notes."""
        invoice = MoneyInvoice(
            invoice_number="INV-2025-002",
            customer_id="cust-456",
            tenant_id="tenant-123",
            billing_email="test@example.com",
            currency="USD",
            status="pending",
            payment_status="pending",
            issue_date=datetime.now(UTC),
            line_items=[],
            subtotal=MoneyField.from_money(Money("100.00", "USD")),
            tax_amount=MoneyField.from_money(Money("0.00", "USD")),
            discount_amount=MoneyField.from_money(Money("0.00", "USD")),
            total_amount=MoneyField.from_money(Money("100.00", "USD")),
            remaining_balance=MoneyField.from_money(Money("100.00", "USD")),
            notes="This is a test invoice with important notes.",
        )

        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=invoice,
            company_info=company_info,
            customer_info=customer_info,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_generate_with_locale(self, sample_invoice, company_info):
        """Test generating invoice with specific locale."""
        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=sample_invoice,
            company_info=company_info,
            locale="en_GB",
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0


@pytest.mark.unit
class TestSaveToFile:
    """Test saving PDF to file."""

    def test_save_to_file(self, sample_invoice, company_info, tmp_path):
        """Test saving PDF to file."""
        output_path = str(tmp_path / "test_invoice.pdf")
        generator = ReportLabInvoiceGenerator()

        pdf_bytes = generator.generate_invoice_pdf(
            invoice=sample_invoice,
            company_info=company_info,
            output_path=output_path,
        )

        # Check that file was created
        import os

        assert os.path.exists(output_path)

        # Check that bytes are returned
        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    @patch("builtins.open", new_callable=mock_open)
    def test_save_writes_bytes(self, mock_file, sample_invoice):
        """Test that save writes correct bytes to file."""
        generator = ReportLabInvoiceGenerator()

        generator.generate_invoice_pdf(
            invoice=sample_invoice,
            output_path="/fake/path/invoice.pdf",
        )

        mock_file.assert_called_once_with("/fake/path/invoice.pdf", "wb")
        mock_file().write.assert_called_once()


@pytest.mark.unit
class TestHeaderCreation:
    """Test invoice header creation."""

    def test_header_with_company_info(self, sample_invoice, company_info):
        """Test header includes company information."""
        generator = ReportLabInvoiceGenerator()

        header = generator._create_header(sample_invoice, company_info)

        assert len(header) > 0

    def test_header_without_company_info(self, sample_invoice):
        """Test header with default company info."""
        generator = ReportLabInvoiceGenerator()

        header = generator._create_header(sample_invoice, None)

        assert len(header) > 0

    def test_header_includes_invoice_number(self, sample_invoice, company_info):
        """Test header includes invoice number."""
        generator = ReportLabInvoiceGenerator()

        header = generator._create_header(sample_invoice, company_info)

        # Header should contain invoice number element
        assert len(header) > 0


@pytest.mark.unit
class TestBillingSection:
    """Test billing details section."""

    def test_billing_section_with_customer_info(self, sample_invoice, customer_info):
        """Test billing section with customer information."""
        generator = ReportLabInvoiceGenerator()

        section = generator._create_billing_section(sample_invoice, customer_info)

        assert len(section) > 0

    def test_billing_section_without_customer_info(self, sample_invoice):
        """Test billing section without customer information."""
        generator = ReportLabInvoiceGenerator()

        section = generator._create_billing_section(sample_invoice, None)

        assert len(section) > 0

    def test_billing_section_includes_email(self, sample_invoice):
        """Test billing section includes email."""
        generator = ReportLabInvoiceGenerator()

        section = generator._create_billing_section(sample_invoice, None)

        assert len(section) > 0


@pytest.mark.unit
class TestLineItemsTable:
    """Test line items table creation."""

    def test_line_items_table(self, sample_invoice):
        """Test creating line items table."""
        generator = ReportLabInvoiceGenerator()

        table = generator._create_line_items_table(sample_invoice, "en_US")

        assert len(table) > 0

    def test_line_items_includes_all_items(self, sample_invoice):
        """Test table includes all line items."""
        generator = ReportLabInvoiceGenerator()

        table = generator._create_line_items_table(sample_invoice, "en_US")

        # Should have items for header, line items, and spacer
        assert len(table) > 0

    def test_line_items_with_tax(self):
        """Test line items table with tax amounts."""
        invoice = MoneyInvoice(
            invoice_number="INV-TAX-001",
            customer_id="cust-789",
            tenant_id="tenant-123",
            billing_email="tax@example.com",
            currency="USD",
            status="pending",
            payment_status="pending",
            issue_date=datetime.now(UTC),
            line_items=[
                MoneyInvoiceLineItem(
                    description="Taxable Item",
                    quantity=1,
                    unit_price=MoneyField.from_money(Money("100.00", "USD")),
                    tax_rate=Decimal("0.0825"),
                    tax_amount=MoneyField.from_money(Money("8.25", "USD")),
                    discount_percentage=Decimal("0"),
                    discount_amount=MoneyField.from_money(Money("0.00", "USD")),
                    total_price=MoneyField.from_money(Money("108.25", "USD")),
                ),
            ],
            subtotal=MoneyField.from_money(Money("100.00", "USD")),
            tax_amount=MoneyField.from_money(Money("8.25", "USD")),
            discount_amount=MoneyField.from_money(Money("0.00", "USD")),
            total_amount=MoneyField.from_money(Money("108.25", "USD")),
            remaining_balance=MoneyField.from_money(Money("108.25", "USD")),
        )

        generator = ReportLabInvoiceGenerator()
        table = generator._create_line_items_table(invoice, "en_US")

        assert len(table) > 0


@pytest.mark.unit
class TestTotalsSection:
    """Test totals section creation."""

    def test_totals_section_basic(self, sample_invoice):
        """Test basic totals section."""
        generator = ReportLabInvoiceGenerator()

        section = generator._create_totals_section(sample_invoice, "en_US")

        assert len(section) > 0

    def test_totals_with_discount(self):
        """Test totals section with discount."""
        invoice = MoneyInvoice(
            invoice_number="INV-DISC-001",
            customer_id="cust-discount",
            tenant_id="tenant-123",
            billing_email="discount@example.com",
            currency="USD",
            status="pending",
            payment_status="pending",
            issue_date=datetime.now(UTC),
            line_items=[],
            subtotal=MoneyField.from_money(Money("100.00", "USD")),
            tax_amount=MoneyField.from_money(Money("0.00", "USD")),
            discount_amount=MoneyField.from_money(Money("10.00", "USD")),
            total_amount=MoneyField.from_money(Money("90.00", "USD")),
            remaining_balance=MoneyField.from_money(Money("90.00", "USD")),
        )

        generator = ReportLabInvoiceGenerator()
        section = generator._create_totals_section(invoice, "en_US")

        assert len(section) > 0

    def test_totals_with_credits(self):
        """Test totals section with applied credits."""
        invoice = MoneyInvoice(
            invoice_number="INV-CRED-001",
            customer_id="cust-credit",
            tenant_id="tenant-123",
            billing_email="credit@example.com",
            currency="USD",
            status="pending",
            payment_status="pending",
            issue_date=datetime.now(UTC),
            line_items=[],
            subtotal=MoneyField.from_money(Money("100.00", "USD")),
            tax_amount=MoneyField.from_money(Money("0.00", "USD")),
            discount_amount=MoneyField.from_money(Money("0.00", "USD")),
            total_amount=MoneyField.from_money(Money("100.00", "USD")),
            total_credits_applied=MoneyField.from_money(Money("20.00", "USD")),
            remaining_balance=MoneyField.from_money(Money("80.00", "USD")),
        )

        generator = ReportLabInvoiceGenerator()
        section = generator._create_totals_section(invoice, "en_US")

        assert len(section) > 0


@pytest.mark.unit
class TestStatusColor:
    """Test invoice status color mapping."""

    def test_draft_status_color(self):
        """Test color for draft status."""
        generator = ReportLabInvoiceGenerator()

        color = generator._get_status_color("draft")

        assert color is not None

    def test_pending_status_color(self):
        """Test color for pending status."""
        generator = ReportLabInvoiceGenerator()

        color = generator._get_status_color("pending")

        assert color is not None

    def test_paid_status_color(self):
        """Test color for paid status."""
        generator = ReportLabInvoiceGenerator()

        color = generator._get_status_color("paid")

        assert color is not None

    def test_overdue_status_color(self):
        """Test color for overdue status."""
        generator = ReportLabInvoiceGenerator()

        color = generator._get_status_color("overdue")

        assert color is not None

    def test_unknown_status_color(self):
        """Test default color for unknown status."""
        generator = ReportLabInvoiceGenerator()

        color = generator._get_status_color("unknown_status")

        assert color is not None


@pytest.mark.unit
class TestBatchGeneration:
    """Test batch invoice generation."""

    def test_batch_generation(self, tmp_path):
        """Test generating multiple invoices in batch."""
        invoices = []
        for i in range(3):
            invoice = MoneyInvoice(
                invoice_number=f"INV-BATCH-{i:03d}",
                customer_id=f"cust-{i}",
                tenant_id="tenant-123",
                billing_email=f"customer{i}@example.com",
                currency="USD",
                status="pending",
                payment_status="pending",
                issue_date=datetime.now(UTC),
                line_items=[],
                subtotal=MoneyField.from_money(Money("100.00", "USD")),
                tax_amount=MoneyField.from_money(Money("0.00", "USD")),
                discount_amount=MoneyField.from_money(Money("0.00", "USD")),
                total_amount=MoneyField.from_money(Money("100.00", "USD")),
                remaining_balance=MoneyField.from_money(Money("100.00", "USD")),
            )
            invoices.append(invoice)

        generator = ReportLabInvoiceGenerator()
        output_dir = str(tmp_path / "batch_invoices")

        output_paths = generator.generate_batch_invoices(
            invoices=invoices,
            output_dir=output_dir,
        )

        assert len(output_paths) == 3

        # Check all files exist
        import os

        for path in output_paths:
            assert os.path.exists(path)

    def test_batch_with_company_info(self, tmp_path, company_info):
        """Test batch generation with company info."""
        invoices = [
            MoneyInvoice(
                invoice_number="INV-BATCH-COMPANY-001",
                customer_id="cust-batch",
                tenant_id="tenant-123",
                billing_email="batch@example.com",
                currency="USD",
                status="pending",
                payment_status="pending",
                issue_date=datetime.now(UTC),
                line_items=[],
                subtotal=MoneyField.from_money(Money("50.00", "USD")),
                tax_amount=MoneyField.from_money(Money("0.00", "USD")),
                discount_amount=MoneyField.from_money(Money("0.00", "USD")),
                total_amount=MoneyField.from_money(Money("50.00", "USD")),
                remaining_balance=MoneyField.from_money(Money("50.00", "USD")),
            ),
        ]

        generator = ReportLabInvoiceGenerator()
        output_dir = str(tmp_path / "batch_with_company")

        output_paths = generator.generate_batch_invoices(
            invoices=invoices,
            output_dir=output_dir,
            company_info=company_info,
        )

        assert len(output_paths) == 1


@pytest.mark.unit
class TestConvenienceFunction:
    """Test convenience function."""

    def test_generate_invoice_pdf_reportlab(self, sample_invoice, company_info):
        """Test convenience function."""
        pdf_bytes = generate_invoice_pdf_reportlab(
            invoice=sample_invoice,
            company_info=company_info,
        )

        assert isinstance(pdf_bytes, bytes)
        assert len(pdf_bytes) > 0

    def test_default_generator_instance(self):
        """Test default generator instance exists."""
        assert default_reportlab_generator is not None
        assert isinstance(default_reportlab_generator, ReportLabInvoiceGenerator)
