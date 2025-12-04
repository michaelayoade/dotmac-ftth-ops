"""
Data mappers for customer management.

Transforms between database models, API schemas, and import formats.
Reusable by import scripts, tests, and API endpoints.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.customer_management.models import (
    CommunicationChannel,
    Customer,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)


class CustomerImportSchema(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for importing customer data from CSV/JSON."""

    # Required fields
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)

    # Optional identification
    customer_number: str | None = Field(None, max_length=50)
    external_id: str | None = Field(None, max_length=100)

    # Optional name fields
    middle_name: str | None = Field(None, max_length=100)
    display_name: str | None = Field(None, max_length=200)
    company_name: str | None = Field(None, max_length=200)

    # Account information
    status: CustomerStatus | None = CustomerStatus.PROSPECT
    customer_type: CustomerType | None = CustomerType.INDIVIDUAL
    tier: CustomerTier | None = CustomerTier.FREE

    # Contact information
    phone: str | None = Field(None, max_length=30)
    mobile: str | None = Field(None, max_length=30)

    # Address (accepts both snake_case and camelCase)
    address_line1: str | None = Field(None, max_length=200, alias="addressLine1")
    address_line2: str | None = Field(None, max_length=200, alias="addressLine2")
    city: str | None = Field(None, max_length=100)
    state_province: str | None = Field(None, max_length=100, alias="stateProvince")
    postal_code: str | None = Field(None, max_length=20, alias="postalCode")
    country: str | None = Field(None, max_length=2)  # ISO 3166-1 alpha-2

    # Business information
    tax_id: str | None = Field(None, max_length=50, alias="taxId")
    vat_number: str | None = Field(None, max_length=50, alias="vatNumber")
    industry: str | None = Field(None, max_length=100)
    employee_count: int | None = Field(None, ge=0)
    annual_revenue: float | None = Field(None, ge=0)

    # Communication preferences
    preferred_channel: CommunicationChannel | None = CommunicationChannel.EMAIL
    preferred_language: str | None = Field(default="en", max_length=10)
    timezone: str | None = Field(default="UTC", max_length=50)
    opt_in_marketing: bool | None = False
    opt_in_updates: bool | None = True

    # Metrics (for existing customers)
    lifetime_value: float | None = Field(default=0, ge=0)
    total_purchases: int | None = Field(default=0, ge=0)
    average_order_value: float | None = Field(default=0, ge=0)

    # Custom fields and tags
    tags: list[str] | None = Field(default_factory=lambda: [])
    custom_fields: dict[str, Any] | None = Field(default_factory=lambda: {})
    metadata: dict[str, Any] | None = Field(default_factory=lambda: {})

    # Import metadata
    source_system: str | None = Field(None, max_length=50)
    import_batch_id: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        populate_by_name=True,  # Allow both snake_case and camelCase field names
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Basic email validation."""
        if "@" not in v:
            raise ValueError("Invalid email format")
        return v.lower()

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str | None) -> str | None:
        """Validate country code."""
        if v and len(v) != 2:
            raise ValueError("Country must be 2-letter ISO code")
        return v.upper() if v else None


class CustomerExportSchema(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for exporting customer data to frontend format."""

    id: str
    customer_number: str
    first_name: str
    last_name: str
    middle_name: str | None = None
    display_name: str | None = None
    company_name: str | None = None

    # Status and type
    status: str
    customer_type: str
    tier: str

    # Contact
    email: str
    phone: str | None = None
    mobile: str | None = None

    # Address (using snake_case to match frontend)
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    state_province: str | None = None
    postal_code: str | None = None
    country: str | None = None

    # Business
    tax_id: str | None = None
    vat_number: str | None = None

    # Metrics
    lifetime_value: float = 0
    total_purchases: int = 0
    average_order_value: float = 0
    last_purchase_date: datetime | None = None
    first_purchase_date: datetime | None = None

    # Metadata
    tags: list[str] = Field(default_factory=lambda: [])
    metadata: dict[str, Any] = Field(default_factory=lambda: {})
    custom_fields: dict[str, Any] = Field(default_factory=lambda: {})

    # Timestamps
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(
        # Pydantic V2: json_encoders is deprecated, use model_serializer or field serializers instead
        # For now, remove deprecated config - serialization works with defaults
    )


class CustomerMapper:
    """Maps between different customer data formats."""

    @staticmethod
    def from_import_to_model(
        import_data: CustomerImportSchema, tenant_id: str, generate_customer_number: bool = True
    ) -> dict[str, Any]:
        """
        Convert import schema to database model format.

        Args:
            import_data: Validated import data
            tenant_id: Tenant identifier
            generate_customer_number: Whether to auto-generate customer number

        Returns:
            Dictionary ready for Customer model creation
        """
        from uuid import uuid4

        metadata: dict[str, Any] = dict(import_data.metadata or {})

        data: dict[str, Any] = {
            "tenant_id": tenant_id,
            "first_name": import_data.first_name,
            "last_name": import_data.last_name,
            "email": import_data.email,
            "status": import_data.status,
            "customer_type": import_data.customer_type,
            "tier": import_data.tier,
            "preferred_channel": import_data.preferred_channel,
            "preferred_language": import_data.preferred_language,
            "timezone": import_data.timezone,
            "opt_in_marketing": import_data.opt_in_marketing,
            "opt_in_updates": import_data.opt_in_updates,
            "tags": import_data.tags or [],
            "custom_fields": import_data.custom_fields or {},
            "metadata_": metadata,
        }

        # Generate customer number if needed
        if generate_customer_number and not import_data.customer_number:
            data["customer_number"] = f"CUST-{uuid4().hex[:8].upper()}"
        elif import_data.customer_number:
            data["customer_number"] = import_data.customer_number

        # Map optional fields
        optional_fields = [
            "external_id",
            "middle_name",
            "display_name",
            "company_name",
            "phone",
            "mobile",
            "address_line1",
            "address_line2",
            "city",
            "state_province",
            "postal_code",
            "country",
            "tax_id",
            "vat_number",
            "industry",
            "employee_count",
            "source_system",
        ]

        for field in optional_fields:
            value = getattr(import_data, field, None)
            if value is not None:
                data[field] = value

        # Convert numeric fields
        if import_data.annual_revenue is not None:
            data["annual_revenue"] = Decimal(str(import_data.annual_revenue))

        if import_data.lifetime_value is not None:
            data["lifetime_value"] = Decimal(str(import_data.lifetime_value))

        if import_data.average_order_value is not None:
            data["average_order_value"] = Decimal(str(import_data.average_order_value))

        if import_data.total_purchases is not None:
            data["total_purchases"] = import_data.total_purchases

        # Add import metadata
        if import_data.import_batch_id:
            metadata["import_batch_id"] = import_data.import_batch_id
            metadata["imported_at"] = datetime.now(UTC).isoformat()

        return data

    @staticmethod
    def from_model_to_export(customer: Customer) -> CustomerExportSchema:
        """
        Convert database model to export schema.

        Args:
            customer: Customer model instance

        Returns:
            CustomerExportSchema ready for JSON serialization
        """
        return CustomerExportSchema(
            id=str(customer.id),
            customer_number=customer.customer_number,
            first_name=customer.first_name,
            last_name=customer.last_name,
            middle_name=customer.middle_name,
            display_name=customer.display_name,
            company_name=customer.company_name,
            status=customer.status.value if customer.status else "prospect",
            customer_type=customer.customer_type.value if customer.customer_type else "individual",
            tier=customer.tier.value if customer.tier else "free",
            email=customer.email,
            phone=customer.phone,
            mobile=customer.mobile,
            address_line_1=customer.address_line1,
            address_line_2=customer.address_line2,
            city=customer.city,
            state_province=customer.state_province,
            postal_code=customer.postal_code,
            country=customer.country,
            tax_id=customer.tax_id,
            vat_number=customer.vat_number,
            lifetime_value=float(customer.lifetime_value),
            total_purchases=customer.total_purchases,
            average_order_value=float(customer.average_order_value),
            last_purchase_date=customer.last_purchase_date,
            first_purchase_date=customer.first_purchase_date,
            tags=customer.tags or [],
            metadata=customer.metadata_ or {},
            custom_fields=customer.custom_fields or {},
            created_at=customer.created_at,
            updated_at=customer.updated_at,
        )

    @staticmethod
    def validate_import_row(
        row: dict[str, Any], row_number: int
    ) -> CustomerImportSchema | dict[str, Any]:
        """
        Validate a single row of import data.

        Args:
            row: Raw row data from CSV/JSON
            row_number: Row number for error reporting

        Returns:
            Either validated CustomerImportSchema or error dict
        """
        try:
            # Clean up the row data
            cleaned_row = {}
            for key, value in row.items():
                # Skip empty strings
                if value == "":
                    continue
                # Convert string booleans
                if isinstance(value, str) and value.lower() in ["true", "false"]:
                    value = value.lower() == "true"
                cleaned_row[key] = value

            # Validate using schema
            return CustomerImportSchema(**cleaned_row)
        except Exception as e:
            return {"row_number": row_number, "error": str(e), "data": row}

    @staticmethod
    def batch_validate(
        rows: list[dict[str, Any]],
    ) -> tuple[list[CustomerImportSchema], list[dict[str, Any]]]:
        """
        Validate multiple rows of import data.

        Args:
            rows: List of raw row data

        Returns:
            Tuple of (valid_rows, error_rows)
        """
        valid_rows = []
        error_rows = []

        for i, row in enumerate(rows, start=1):
            result = CustomerMapper.validate_import_row(row, i)
            if isinstance(result, CustomerImportSchema):
                valid_rows.append(result)
            else:
                error_rows.append(result)

        return valid_rows, error_rows
