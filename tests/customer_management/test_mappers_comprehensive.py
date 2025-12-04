"""
Comprehensive tests for customer management mappers.

Tests data transformation between import, model, and export formats.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

import pytest
from pydantic import ValidationError

from dotmac.platform.customer_management.mappers import (
    CustomerExportSchema,
    CustomerImportSchema,
    CustomerMapper,
)
from dotmac.platform.customer_management.models import (
    CommunicationChannel,
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)


@pytest.mark.unit
class TestCustomerImportSchema:
    """Test customer import schema validation."""

    def test_valid_import_schema_minimal(self):
        """Test import schema with minimal required fields."""
        data = {"first_name": "John", "last_name": "Doe", "email": "john.doe@example.com"}

        import_schema = CustomerImportSchema(**data)

        assert import_schema.first_name == "John"
        assert import_schema.last_name == "Doe"
        assert import_schema.email == "john.doe@example.com"
        assert import_schema.status == CustomerStatus.PROSPECT
        assert import_schema.customer_type == CustomerType.INDIVIDUAL
        assert import_schema.tier == CustomerTier.FREE

    def test_valid_import_schema_complete(self):
        """Test import schema with all fields."""
        data = {
            "first_name": "Jane",
            "last_name": "Smith",
            "middle_name": "Marie",
            "email": "jane.smith@example.com",
            "customer_number": "CUST-12345",
            "external_id": "EXT-98765",
            "display_name": "Jane M. Smith",
            "company_name": "Acme Corp",
            "status": CustomerStatus.ACTIVE,
            "customer_type": CustomerType.BUSINESS,
            "tier": CustomerTier.PREMIUM,
            "phone": "+1-555-0123",
            "mobile": "+1-555-0124",
            "address_line1": "123 Main St",
            "address_line2": "Suite 100",
            "city": "New York",
            "state_province": "NY",
            "postal_code": "10001",
            "country": "US",
            "tax_id": "12-3456789",
            "vat_number": "VAT123",
            "industry": "Technology",
            "employee_count": 50,
            "annual_revenue": 1000000.00,
            "preferred_channel": CommunicationChannel.EMAIL,
            "preferred_language": "en",
            "timezone": "America/New_York",
            "opt_in_marketing": True,
            "opt_in_updates": True,
            "lifetime_value": 50000.00,
            "total_purchases": 100,
            "average_order_value": 500.00,
            "tags": ["vip", "enterprise"],
            "custom_fields": {"account_manager": "Alice"},
            "metadata": {"notes": "Important customer"},
            "source_system": "legacy_crm",
            "import_batch_id": "batch-001",
        }

        import_schema = CustomerImportSchema(**data)

        assert import_schema.first_name == "Jane"
        assert import_schema.company_name == "Acme Corp"
        assert import_schema.status == CustomerStatus.ACTIVE
        assert import_schema.tier == CustomerTier.PREMIUM
        assert import_schema.employee_count == 50
        assert import_schema.annual_revenue == 1000000.00
        assert import_schema.tags == ["vip", "enterprise"]

    def test_email_validation_fail(self):
        """Test email validation failure."""
        data = {"first_name": "John", "last_name": "Doe", "email": "invalid-email"}  # Missing @

        with pytest.raises(ValidationError) as exc_info:
            CustomerImportSchema(**data)

        assert "Invalid email format" in str(exc_info.value)

    def test_email_lowercase_normalization(self):
        """Test email is normalized to lowercase."""
        data = {"first_name": "John", "last_name": "Doe", "email": "John.Doe@EXAMPLE.COM"}

        import_schema = CustomerImportSchema(**data)

        assert import_schema.email == "john.doe@example.com"

    def test_country_code_validation_fail(self):
        """Test country code validation failure."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "country": "USA",  # Should be 2-letter code
        }

        with pytest.raises(ValidationError) as exc_info:
            CustomerImportSchema(**data)

        # Pydantic enforces max_length=2 constraint
        assert "at most 2 characters" in str(exc_info.value)

    def test_country_code_uppercase_normalization(self):
        """Test country code is normalized to uppercase."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "country": "us",
        }

        import_schema = CustomerImportSchema(**data)

        assert import_schema.country == "US"

    def test_camel_case_alias_support(self):
        """Test that camelCase aliases are supported."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "addressLine1": "123 Main St",
            "stateProvince": "CA",
            "postalCode": "90210",
            "taxId": "12-3456789",
            "vatNumber": "VAT123",
        }

        import_schema = CustomerImportSchema(**data)

        assert import_schema.address_line1 == "123 Main St"
        assert import_schema.state_province == "CA"
        assert import_schema.postal_code == "90210"
        assert import_schema.tax_id == "12-3456789"
        assert import_schema.vat_number == "VAT123"

    def test_negative_values_fail(self):
        """Test negative values validation."""
        data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "employee_count": -5,  # Should be >= 0
        }

        with pytest.raises(ValidationError):
            CustomerImportSchema(**data)


@pytest.mark.unit
class TestCustomerExportSchema:
    """Test customer export schema."""

    def test_export_schema_creation(self):
        """Test creating export schema."""
        export_data = CustomerExportSchema(
            id="123e4567-e89b-12d3-a456-426614174000",
            customer_number="CUST-12345",
            first_name="John",
            last_name="Doe",
            status="active",
            customer_type="individual",
            tier="free",
            email="john@example.com",
            lifetime_value=1000.50,
            total_purchases=10,
            average_order_value=100.05,
            created_at=datetime.now(UTC),
        )

        assert export_data.id == "123e4567-e89b-12d3-a456-426614174000"
        assert export_data.customer_number == "CUST-12345"
        assert export_data.lifetime_value == 1000.50


@pytest.mark.unit
class TestCustomerMapper:
    """Test customer mapper transformations."""

    def test_from_import_to_model_minimal(self):
        """Test mapping minimal import data to model format."""
        import_data = CustomerImportSchema(
            first_name="John", last_name="Doe", email="john@example.com"
        )

        result = CustomerMapper.from_import_to_model(
            import_data, tenant_id="tenant_123", generate_customer_number=True
        )

        assert result["tenant_id"] == "tenant_123"
        assert result["first_name"] == "John"
        assert result["last_name"] == "Doe"
        assert result["email"] == "john@example.com"
        assert result["status"] == CustomerStatus.PROSPECT
        assert "customer_number" in result
        assert result["customer_number"].startswith("CUST-")

    def test_from_import_to_model_with_customer_number(self):
        """Test mapping with provided customer number."""
        import_data = CustomerImportSchema(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            customer_number="CUST-CUSTOM",
        )

        result = CustomerMapper.from_import_to_model(
            import_data, tenant_id="tenant_123", generate_customer_number=False
        )

        assert result["customer_number"] == "CUST-CUSTOM"

    def test_from_import_to_model_complete(self):
        """Test mapping complete import data."""
        import_data = CustomerImportSchema(
            first_name="Jane",
            last_name="Smith",
            middle_name="Marie",
            email="jane@example.com",
            external_id="EXT-123",
            display_name="Jane M. Smith",
            company_name="Acme Corp",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.BUSINESS,
            tier=CustomerTier.PREMIUM,
            phone="+1-555-0123",
            mobile="+1-555-0124",
            address_line1="123 Main St",
            city="New York",
            state_province="NY",
            postal_code="10001",
            country="US",
            tax_id="12-3456789",
            industry="Technology",
            employee_count=50,
            annual_revenue=1000000.00,
            lifetime_value=50000.00,
            total_purchases=100,
            average_order_value=500.00,
            tags=["vip"],
            custom_fields={"key": "value"},
            metadata={"note": "test"},
        )

        result = CustomerMapper.from_import_to_model(import_data, tenant_id="tenant_123")

        assert result["middle_name"] == "Marie"
        assert result["company_name"] == "Acme Corp"
        assert result["phone"] == "+1-555-0123"
        assert result["address_line1"] == "123 Main St"
        assert result["city"] == "New York"
        assert result["tax_id"] == "12-3456789"
        assert result["industry"] == "Technology"
        assert result["employee_count"] == 50
        assert result["annual_revenue"] == Decimal("1000000.00")
        assert result["lifetime_value"] == Decimal("50000.00")
        assert result["total_purchases"] == 100
        assert result["average_order_value"] == Decimal("500.00")
        assert result["tags"] == ["vip"]
        assert result["custom_fields"] == {"key": "value"}
        assert result["metadata_"] == {"note": "test"}

    def test_from_import_to_model_with_import_metadata(self):
        """Test mapping with import batch metadata."""
        import_data = CustomerImportSchema(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            import_batch_id="batch-001",
        )

        result = CustomerMapper.from_import_to_model(import_data, tenant_id="tenant_123")

        assert "metadata_" in result
        assert result["metadata_"]["import_batch_id"] == "batch-001"
        assert "imported_at" in result["metadata_"]

    def test_from_model_to_export(self):
        """Test mapping model to export format."""
        now = datetime.now(UTC)

        # Create a mock customer model
        customer = Customer(
            id=UUID("123e4567-e89b-12d3-a456-426614174000"),
            tenant_id="tenant_123",
            customer_number="CUST-12345",
            first_name="John",
            last_name="Doe",
            middle_name="Q",
            display_name="John Q. Doe",
            company_name="Acme Corp",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.BUSINESS,
            tier=CustomerTier.PREMIUM,
            email="john@example.com",
            phone="+1-555-0123",
            mobile="+1-555-0124",
            address_line1="123 Main St",
            address_line2="Suite 100",
            city="New York",
            state_province="NY",
            postal_code="10001",
            country="US",
            tax_id="12-3456789",
            vat_number="VAT123",
            lifetime_value=Decimal("50000.00"),
            total_purchases=100,
            average_order_value=Decimal("500.00"),
            last_purchase_date=now,
            first_purchase_date=now,
            tags=["vip", "enterprise"],
            metadata_={"note": "Important"},
            custom_fields={"manager": "Alice"},
            created_at=now,
            updated_at=now,
        )

        export_data = CustomerMapper.from_model_to_export(customer)

        assert export_data.id == "123e4567-e89b-12d3-a456-426614174000"
        assert export_data.customer_number == "CUST-12345"
        assert export_data.first_name == "John"
        assert export_data.last_name == "Doe"
        assert export_data.middle_name == "Q"
        assert export_data.display_name == "John Q. Doe"
        assert export_data.company_name == "Acme Corp"
        assert export_data.status == "active"
        assert export_data.customer_type == "business"
        assert export_data.tier == "premium"
        assert export_data.email == "john@example.com"
        assert export_data.phone == "+1-555-0123"
        assert export_data.address_line_1 == "123 Main St"
        assert export_data.address_line_2 == "Suite 100"
        assert export_data.city == "New York"
        assert export_data.state_province == "NY"
        assert export_data.postal_code == "10001"
        assert export_data.country == "US"
        assert export_data.tax_id == "12-3456789"
        assert export_data.vat_number == "VAT123"
        assert export_data.lifetime_value == 50000.00
        assert export_data.total_purchases == 100
        assert export_data.average_order_value == 500.00
        assert export_data.tags == ["vip", "enterprise"]
        assert export_data.metadata == {"note": "Important"}
        assert export_data.custom_fields == {"manager": "Alice"}

    def test_from_model_to_export_with_none_values(self):
        """Test mapping model with None values to export."""
        now = datetime.now(UTC)

        customer = Customer(
            id=UUID("123e4567-e89b-12d3-a456-426614174000"),
            tenant_id="tenant_123",
            customer_number="CUST-12345",
            first_name="John",
            last_name="Doe",
            status=CustomerStatus.PROSPECT,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
            email="john@example.com",
            lifetime_value=Decimal("0"),
            total_purchases=0,
            average_order_value=Decimal("0"),
            created_at=now,
        )

        export_data = CustomerMapper.from_model_to_export(customer)

        assert export_data.middle_name is None
        assert export_data.company_name is None
        assert export_data.phone is None
        assert export_data.address_line_1 is None
        assert export_data.last_purchase_date is None
        assert export_data.tags == []
        assert export_data.metadata == {}

    def test_validate_import_row_success(self):
        """Test validating a single import row successfully."""
        row = {"first_name": "John", "last_name": "Doe", "email": "john@example.com"}

        result = CustomerMapper.validate_import_row(row, row_number=1)

        assert isinstance(result, CustomerImportSchema)
        assert result.first_name == "John"

    def test_validate_import_row_with_empty_strings(self):
        """Test validating row with empty strings."""
        row = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "middle_name": "",  # Empty string should be skipped
            "phone": "",
        }

        result = CustomerMapper.validate_import_row(row, row_number=1)

        assert isinstance(result, CustomerImportSchema)
        assert result.middle_name is None

    def test_validate_import_row_with_string_booleans(self):
        """Test validating row with string boolean values."""
        row = {
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "opt_in_marketing": "true",
            "opt_in_updates": "false",
        }

        result = CustomerMapper.validate_import_row(row, row_number=1)

        assert isinstance(result, CustomerImportSchema)
        assert result.opt_in_marketing is True
        assert result.opt_in_updates is False

    def test_validate_import_row_failure(self):
        """Test validating invalid row returns error dict."""
        row = {
            "first_name": "John",
            # Missing required last_name
            "email": "john@example.com",
        }

        result = CustomerMapper.validate_import_row(row, row_number=5)

        assert isinstance(result, dict)
        assert result["row_number"] == 5
        assert "error" in result
        assert "data" in result

    def test_batch_validate_success(self):
        """Test batch validation with all valid rows."""
        rows = [
            {"first_name": "John", "last_name": "Doe", "email": "john@example.com"},
            {"first_name": "Jane", "last_name": "Smith", "email": "jane@example.com"},
        ]

        valid_rows, error_rows = CustomerMapper.batch_validate(rows)

        assert len(valid_rows) == 2
        assert len(error_rows) == 0
        assert valid_rows[0].first_name == "John"
        assert valid_rows[1].first_name == "Jane"

    def test_batch_validate_with_errors(self):
        """Test batch validation with some invalid rows."""
        rows = [
            {"first_name": "John", "last_name": "Doe", "email": "john@example.com"},
            {
                "first_name": "Invalid",
                # Missing required fields
            },
            {"first_name": "Jane", "last_name": "Smith", "email": "jane@example.com"},
        ]

        valid_rows, error_rows = CustomerMapper.batch_validate(rows)

        assert len(valid_rows) == 2
        assert len(error_rows) == 1
        assert error_rows[0]["row_number"] == 2

    def test_batch_validate_empty_list(self):
        """Test batch validation with empty list."""
        rows = []

        valid_rows, error_rows = CustomerMapper.batch_validate(rows)

        assert len(valid_rows) == 0
        assert len(error_rows) == 0
