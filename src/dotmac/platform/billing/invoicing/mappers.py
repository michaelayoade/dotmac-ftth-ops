"""
Data mappers for invoice import.

Transforms between database models, API schemas, and import formats.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InvoiceImportSchema(BaseModel):
    """Schema for importing invoice data from CSV/JSON."""

    # Required fields
    customer_id: str = Field(min_length=1, description="Customer UUID or customer_number")
    amount: Decimal = Field(gt=0, description="Invoice total amount")

    # Optional identification
    invoice_number: str | None = Field(None, max_length=50)
    external_id: str | None = Field(None, max_length=100)

    # Invoice details
    currency: str = Field(default="USD", max_length=3)
    status: str = Field(default="draft", max_length=20)
    description: str | None = Field(None, max_length=500)

    # Dates
    issue_date: str | None = None  # ISO date string
    due_date: str | None = None  # ISO date string
    paid_date: str | None = None  # ISO date string

    # Amounts
    subtotal: Decimal | None = Field(None, ge=0)
    tax_amount: Decimal | None = Field(None, ge=0)
    discount_amount: Decimal | None = Field(None, ge=0)

    # References
    purchase_order: str | None = Field(None, max_length=100)
    notes: str | None = None

    # Import metadata
    source_system: str | None = Field(None, max_length=50)
    import_batch_id: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code is 3 letters."""
        if len(v) != 3:
            raise ValueError("Currency must be 3-letter ISO code")
        return v.upper()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate invoice status."""
        valid_statuses = ["draft", "pending", "paid", "cancelled", "overdue"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()


class InvoiceMapper:
    """Maps between different invoice data formats."""

    @staticmethod
    def validate_import_row(
        row_data: dict[str, Any], row_number: int
    ) -> InvoiceImportSchema | dict[str, Any]:
        """
        Validate and parse a single import row.

        Args:
            row_data: Raw CSV/JSON row data
            row_number: Row number for error reporting

        Returns:
            InvoiceImportSchema if valid, error dict otherwise
        """
        try:
            # Parse and validate using Pydantic
            validated = InvoiceImportSchema(**row_data)
            return validated
        except Exception as e:
            return {
                "row_number": row_number,
                "error": f"Validation failed: {str(e)}",
                "data": row_data,
            }

    @staticmethod
    def from_import_to_model(
        import_data: InvoiceImportSchema, tenant_id: str, generate_invoice_number: bool = True
    ) -> dict[str, Any]:
        """
        Convert import schema to database model format.

        Args:
            import_data: Validated import data
            tenant_id: Tenant identifier
            generate_invoice_number: Whether to auto-generate invoice number

        Returns:
            Dictionary ready for Invoice model creation
        """
        data: dict[str, Any] = {
            "tenant_id": tenant_id,
            "customer_id": import_data.customer_id,  # Will be resolved to UUID in service
            "amount": import_data.amount,
            "currency": import_data.currency,
            "status": import_data.status,
        }

        # Generate invoice number if needed
        if generate_invoice_number and not import_data.invoice_number:
            data["invoice_number"] = f"INV-{uuid4().hex[:8].upper()}"
        elif import_data.invoice_number:
            data["invoice_number"] = import_data.invoice_number

        # Map optional fields
        if import_data.external_id:
            data["external_id"] = import_data.external_id
        if import_data.description:
            data["description"] = import_data.description
        if import_data.subtotal:
            data["subtotal"] = import_data.subtotal
        if import_data.tax_amount:
            data["tax_amount"] = import_data.tax_amount
        if import_data.discount_amount:
            data["discount_amount"] = import_data.discount_amount
        if import_data.purchase_order:
            data["purchase_order"] = import_data.purchase_order
        if import_data.notes:
            data["notes"] = import_data.notes

        # Parse date strings
        if import_data.issue_date:
            data["issue_date"] = datetime.fromisoformat(
                import_data.issue_date.replace("Z", "+00:00")
            )
        else:
            data["issue_date"] = datetime.now(UTC)

        if import_data.due_date:
            data["due_date"] = datetime.fromisoformat(import_data.due_date.replace("Z", "+00:00"))

        if import_data.paid_date:
            data["paid_date"] = datetime.fromisoformat(import_data.paid_date.replace("Z", "+00:00"))

        # Add import metadata
        metadata = {}
        if import_data.source_system:
            metadata["source_system"] = import_data.source_system
        if import_data.import_batch_id:
            metadata["import_batch_id"] = import_data.import_batch_id
        if metadata:
            data["metadata"] = metadata

        return data
