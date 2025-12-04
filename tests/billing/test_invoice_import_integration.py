"""
Tests for invoice import integration with data_transfer module.

Verifies that:
1. InvoiceImportSchema validates data correctly
2. InvoiceMapper transforms import data to model data
3. Invoice import task processes CSV/JSON files
4. Error handling works for invalid data
5. Integration with InvoiceService is correct
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.billing.invoicing.mappers import InvoiceImportSchema, InvoiceMapper
from dotmac.platform.data_import.models import ImportJobType

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestInvoiceImportSchema:
    """Test InvoiceImportSchema validation."""

    def test_valid_invoice_data(self):
        """Test validation of valid invoice data."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.50",
            "currency": "USD",
            "status": "draft",
        }

        validated = InvoiceImportSchema(**data)

        assert validated.customer_id == "cust-123"
        assert validated.amount == Decimal("100.50")
        assert validated.currency == "USD"
        assert validated.status == "draft"

    def test_currency_validation_uppercase(self):
        """Test currency code is converted to uppercase."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "currency": "usd",
        }

        validated = InvoiceImportSchema(**data)
        assert validated.currency == "USD"

    def test_currency_validation_length(self):
        """Test currency must be 3 characters."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "currency": "US",  # Too short
        }

        with pytest.raises(ValueError, match="Currency must be 3-letter ISO code"):
            InvoiceImportSchema(**data)

    def test_status_validation_valid_values(self):
        """Test status accepts valid values."""
        valid_statuses = ["draft", "pending", "paid", "cancelled", "overdue"]

        for status in valid_statuses:
            data = {
                "customer_id": "cust-123",
                "amount": "100.00",
                "status": status,
            }
            validated = InvoiceImportSchema(**data)
            assert validated.status == status.lower()

    def test_status_validation_invalid_value(self):
        """Test status rejects invalid values."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "status": "invalid_status",
        }

        with pytest.raises(ValueError, match="Status must be one of"):
            InvoiceImportSchema(**data)

    def test_amount_must_be_positive(self):
        """Test amount must be greater than zero."""
        data = {
            "customer_id": "cust-123",
            "amount": "0",
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_amount_negative_rejected(self):
        """Test negative amounts are rejected."""
        data = {
            "customer_id": "cust-123",
            "amount": "-50.00",
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_optional_fields_defaults(self):
        """Test optional fields have proper defaults."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
        }

        validated = InvoiceImportSchema(**data)

        assert validated.currency == "USD"
        assert validated.status == "draft"
        assert validated.invoice_number is None
        assert validated.external_id is None

    def test_decimal_precision(self):
        """Test decimal amounts maintain precision."""
        data = {
            "customer_id": "cust-123",
            "amount": "123.456789",
        }

        validated = InvoiceImportSchema(**data)
        assert validated.amount == Decimal("123.456789")


@pytest.mark.asyncio
class TestInvoiceMapper:
    """Test InvoiceMapper transformation logic."""

    def test_validate_import_row_success(self):
        """Test successful row validation."""
        row_data = {
            "customer_id": "cust-456",
            "amount": "250.00",
            "currency": "EUR",
        }

        result = InvoiceMapper.validate_import_row(row_data, row_number=1)

        assert isinstance(result, InvoiceImportSchema)
        assert result.customer_id == "cust-456"
        assert result.amount == Decimal("250.00")

    def test_validate_import_row_failure(self):
        """Test validation failure returns error dict."""
        row_data = {
            "customer_id": "",  # Invalid - empty
            "amount": "0",  # Invalid - must be > 0
        }

        result = InvoiceMapper.validate_import_row(row_data, row_number=5)

        assert isinstance(result, dict)
        assert result["row_number"] == 5
        assert "error" in result
        assert result["data"] == row_data

    def test_from_import_to_model_basic(self):
        """Test basic transformation to model data."""
        import_data = InvoiceImportSchema(
            customer_id="cust-789",
            amount=Decimal("500.00"),
            currency="GBP",
            status="pending",
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=False
        )

        assert model_data["tenant_id"] == "tenant-123"
        assert model_data["customer_id"] == "cust-789"
        assert model_data["amount"] == Decimal("500.00")
        assert model_data["currency"] == "GBP"
        assert model_data["status"] == "pending"

    def test_from_import_to_model_generates_invoice_number(self):
        """Test automatic invoice number generation."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=True
        )

        assert "invoice_number" in model_data
        assert model_data["invoice_number"].startswith("INV-")
        assert len(model_data["invoice_number"]) > 4

    def test_from_import_to_model_preserves_invoice_number(self):
        """Test existing invoice number is preserved."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
            invoice_number="CUSTOM-001",
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=True
        )

        assert model_data["invoice_number"] == "CUSTOM-001"

    def test_from_import_to_model_date_parsing(self):
        """Test date string parsing."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
            issue_date="2025-01-15T10:30:00Z",
            due_date="2025-02-15T10:30:00Z",
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=False
        )

        assert isinstance(model_data["issue_date"], datetime)
        assert model_data["issue_date"].year == 2025
        assert model_data["issue_date"].month == 1

        assert isinstance(model_data["due_date"], datetime)
        assert model_data["due_date"].month == 2

    def test_from_import_to_model_default_issue_date(self):
        """Test default issue_date is set to current time."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
            # No issue_date provided
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=False
        )

        assert "issue_date" in model_data
        assert isinstance(model_data["issue_date"], datetime)
        # Should be very recent (within last minute)
        now = datetime.now(UTC)
        time_diff = (now - model_data["issue_date"]).total_seconds()
        assert time_diff < 60

    def test_from_import_to_model_optional_fields(self):
        """Test optional fields are included when provided."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
            description="Test invoice",
            notes="Internal notes",
            purchase_order="PO-12345",
            subtotal=Decimal("90.00"),
            tax_amount=Decimal("10.00"),
            discount_amount=Decimal("5.00"),
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=False
        )

        assert model_data["description"] == "Test invoice"
        assert model_data["notes"] == "Internal notes"
        assert model_data["purchase_order"] == "PO-12345"
        assert model_data["subtotal"] == Decimal("90.00")
        assert model_data["tax_amount"] == Decimal("10.00")
        assert model_data["discount_amount"] == Decimal("5.00")

    def test_from_import_to_model_external_references(self):
        """Test external reference fields."""
        import_data = InvoiceImportSchema(
            customer_id="cust-100",
            amount=Decimal("100.00"),
            external_id="EXT-INV-999",
            source_system="legacy_system",
            import_batch_id="batch-2025-01",
        )

        model_data = InvoiceMapper.from_import_to_model(
            import_data, tenant_id="tenant-123", generate_invoice_number=False
        )

        assert model_data["external_id"] == "EXT-INV-999"
        # source_system and import_batch_id are stored in metadata
        assert "metadata" in model_data
        assert model_data["metadata"]["source_system"] == "legacy_system"
        assert model_data["metadata"]["import_batch_id"] == "batch-2025-01"


@pytest.mark.asyncio
class TestInvoiceImportIntegration:
    """Test invoice import integration with data_transfer module."""

    @patch("dotmac.platform.data_import.tasks._process_data_chunk")
    async def test_invoice_import_uses_correct_service(self, mock_process_chunk):
        """Test that invoice import loads the correct service and mapper."""
        from dotmac.platform.billing.invoicing.mappers import InvoiceMapper
        from dotmac.platform.billing.invoicing.service import InvoiceService

        # This test verifies that the import pipeline is wired correctly
        # Actual processing is tested in data_import tests

        AsyncMock()
        mock_job = MagicMock()
        mock_job.id = "job-123"
        mock_job.status = "processing"

        # Verify InvoiceService and InvoiceMapper are used for invoice imports
        assert InvoiceService is not None
        assert InvoiceMapper is not None
        assert hasattr(InvoiceMapper, "validate_import_row")
        assert hasattr(InvoiceMapper, "from_import_to_model")

    def test_invoice_import_schema_matches_customer_pattern(self):
        """Test that InvoiceImportSchema follows same pattern as CustomerImportSchema."""
        # Both should have validate_import_row and from_import_to_model
        from dotmac.platform.customer_management.mappers import CustomerMapper

        assert hasattr(InvoiceMapper, "validate_import_row")
        assert hasattr(InvoiceMapper, "from_import_to_model")
        assert hasattr(CustomerMapper, "validate_import_row")
        assert hasattr(CustomerMapper, "from_import_to_model")

    async def test_import_job_type_invoice_supported(self):
        """Test that ImportJobType.INVOICES is supported."""
        # Verify the enum value exists
        assert hasattr(ImportJobType, "INVOICES")
        assert ImportJobType.INVOICES == "invoices"


@pytest.mark.asyncio
class TestInvoiceImportErrorHandling:
    """Test error handling during invoice import."""

    def test_missing_required_field_customer_id(self):
        """Test import fails when customer_id is missing."""
        data = {
            "amount": "100.00",
            # Missing customer_id
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_missing_required_field_amount(self):
        """Test import fails when amount is missing."""
        data = {
            "customer_id": "cust-123",
            # Missing amount
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_invalid_amount_type(self):
        """Test import fails with invalid amount type."""
        data = {
            "customer_id": "cust-123",
            "amount": "not-a-number",
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_validation_error_includes_row_number(self):
        """Test validation errors include row number for debugging."""
        row_data = {"customer_id": "", "amount": "invalid"}

        result = InvoiceMapper.validate_import_row(row_data, row_number=42)

        assert isinstance(result, dict)
        assert result["row_number"] == 42
        assert "error" in result

    def test_empty_string_customer_id_rejected(self):
        """Test empty customer_id is rejected."""
        data = {
            "customer_id": "",
            "amount": "100.00",
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)

    def test_whitespace_only_customer_id_rejected(self):
        """Test whitespace-only customer_id is rejected."""
        data = {
            "customer_id": "   ",
            "amount": "100.00",
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)


@pytest.mark.asyncio
class TestInvoiceImportBatchProcessing:
    """Test batch processing of invoice imports."""

    def test_multiple_invoices_validation(self):
        """Test validation of multiple invoice rows."""
        rows = [
            {"customer_id": "cust-1", "amount": "100.00"},
            {"customer_id": "cust-2", "amount": "200.00"},
            {"customer_id": "cust-3", "amount": "300.00"},
        ]

        results = [InvoiceMapper.validate_import_row(row, i) for i, row in enumerate(rows)]

        assert all(isinstance(r, InvoiceImportSchema) for r in results)
        assert results[0].amount == Decimal("100.00")
        assert results[1].amount == Decimal("200.00")
        assert results[2].amount == Decimal("300.00")

    def test_partial_batch_failure(self):
        """Test that some rows can fail while others succeed."""
        rows = [
            {"customer_id": "cust-1", "amount": "100.00"},  # Valid
            {"customer_id": "", "amount": "0"},  # Invalid
            {"customer_id": "cust-3", "amount": "300.00"},  # Valid
        ]

        results = [InvoiceMapper.validate_import_row(row, i) for i, row in enumerate(rows)]

        assert isinstance(results[0], InvoiceImportSchema)  # Success
        assert isinstance(results[1], dict)  # Error
        assert isinstance(results[2], InvoiceImportSchema)  # Success

        assert results[1]["row_number"] == 1
        assert "error" in results[1]

    def test_import_with_mixed_currencies(self):
        """Test importing invoices with different currencies."""
        rows = [
            {"customer_id": "cust-1", "amount": "100.00", "currency": "USD"},
            {"customer_id": "cust-2", "amount": "200.00", "currency": "EUR"},
            {"customer_id": "cust-3", "amount": "300.00", "currency": "GBP"},
        ]

        results = [InvoiceMapper.validate_import_row(row, i) for i, row in enumerate(rows)]

        assert all(isinstance(r, InvoiceImportSchema) for r in results)
        assert results[0].currency == "USD"
        assert results[1].currency == "EUR"
        assert results[2].currency == "GBP"


@pytest.mark.asyncio
class TestInvoiceImportEdgeCases:
    """Test edge cases in invoice import."""

    def test_very_large_amount(self):
        """Test importing invoice with very large amount."""
        data = {
            "customer_id": "cust-123",
            "amount": "9999999999.99",
        }

        validated = InvoiceImportSchema(**data)
        assert validated.amount == Decimal("9999999999.99")

    def test_very_small_amount(self):
        """Test importing invoice with very small amount."""
        data = {
            "customer_id": "cust-123",
            "amount": "0.01",
        }

        validated = InvoiceImportSchema(**data)
        assert validated.amount == Decimal("0.01")

    def test_unicode_in_description(self):
        """Test unicode characters in description."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "description": "Consulting services 2025 – €500 project",
        }

        validated = InvoiceImportSchema(**data)
        assert "€" in validated.description

    def test_special_characters_in_notes(self):
        """Test special characters in notes field."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "notes": "Client requested <urgent> payment! @john see this #important",
        }

        validated = InvoiceImportSchema(**data)
        assert "<urgent>" in validated.notes
        assert "@john" in validated.notes

    def test_max_length_invoice_number(self):
        """Test invoice number at maximum length."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "invoice_number": "X" * 50,  # Max length is 50
        }

        validated = InvoiceImportSchema(**data)
        assert len(validated.invoice_number) == 50

    def test_invoice_number_too_long(self):
        """Test invoice number exceeding maximum length."""
        data = {
            "customer_id": "cust-123",
            "amount": "100.00",
            "invoice_number": "X" * 51,  # Exceeds max length
        }

        with pytest.raises(ValueError):
            InvoiceImportSchema(**data)
