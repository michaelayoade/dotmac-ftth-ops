"""
Data mappers for billing domain.

Transforms between database models, API schemas, and import formats.
"""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InvoiceImportSchema(BaseModel):
    """Schema for importing invoice data from CSV/JSON."""

    # Required fields
    customer_id: str = Field(description="Customer identifier")
    invoice_number: str | None = Field(None, max_length=50)
    amount: float = Field(gt=0, description="Invoice amount")
    currency: str = Field(default="USD", max_length=3)

    # Dates
    invoice_date: datetime | None = None
    due_date: datetime | None = None
    payment_date: datetime | None = None

    # Status
    status: str | None = Field(default="draft")  # draft, sent, paid, overdue, canceled

    # Details
    description: str | None = Field(None, max_length=500)
    payment_method: str | None = Field(None, max_length=50)
    payment_reference: str | None = Field(None, max_length=100)

    # Tax and discounts
    tax_rate: float | None = Field(default=0, ge=0, le=100)
    tax_amount: float | None = Field(default=0, ge=0)
    discount_rate: float | None = Field(default=0, ge=0, le=100)
    discount_amount: float | None = Field(default=0, ge=0)

    # Line items (JSON array)
    line_items: list[dict[str, Any]] | None = Field(default_factory=lambda: [])

    # External references
    external_id: str | None = Field(None, max_length=100)
    source_system: str | None = Field(None, max_length=50)

    # Import metadata
    import_batch_id: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, validate_assignment=True
    )

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        """Validate currency code."""
        return v.upper()

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate invoice status."""
        valid_statuses = {"draft", "sent", "paid", "overdue", "canceled", "refunded"}
        if v.lower() not in valid_statuses:
            raise ValueError(f"Invalid status. Must be one of: {valid_statuses}")
        return v.lower()


class SubscriptionImportSchema(BaseModel):
    """Schema for importing subscription data."""

    # Required fields
    customer_id: str = Field(description="Customer identifier")
    plan_id: str = Field(description="Subscription plan identifier")

    # Subscription details
    status: str | None = Field(default="active")  # trial, active, past_due, canceled, ended
    billing_cycle: str | None = Field(default="monthly")  # monthly, quarterly, annual

    # Pricing
    price: float = Field(gt=0, description="Subscription price")
    currency: str = Field(default="USD", max_length=3)
    custom_price: float | None = Field(None, ge=0)

    # Dates
    start_date: datetime | None = None
    trial_end_date: datetime | None = None
    next_billing_date: datetime | None = None
    canceled_at: datetime | None = None
    cancel_at_period_end: bool = False

    # External references
    external_id: str | None = Field(None, max_length=100)
    payment_method_id: str | None = Field(None, max_length=100)
    source_system: str | None = Field(None, max_length=50)

    # Import metadata
    import_batch_id: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, validate_assignment=True
    )


class PaymentImportSchema(BaseModel):
    """Schema for importing payment data."""

    # Required fields
    customer_id: str = Field(description="Customer identifier")
    amount: float = Field(gt=0, description="Payment amount")
    currency: str = Field(default="USD", max_length=3)

    # Payment details
    payment_date: datetime
    payment_method: str = Field(max_length=50)
    status: str | None = Field(default="succeeded")  # pending, succeeded, failed, refunded

    # References
    invoice_id: str | None = Field(None, max_length=100)
    subscription_id: str | None = Field(None, max_length=100)
    transaction_id: str | None = Field(None, max_length=100)
    reference_number: str | None = Field(None, max_length=100)

    # External references
    external_id: str | None = Field(None, max_length=100)
    source_system: str | None = Field(None, max_length=50)

    # Import metadata
    import_batch_id: str | None = Field(None, max_length=100)

    model_config = ConfigDict(
        populate_by_name=True, str_strip_whitespace=True, validate_assignment=True
    )


class BillingMapper:
    """Maps between different billing data formats."""

    @staticmethod
    def _generate_invoice_number_if_needed(
        import_data: InvoiceImportSchema, generate_invoice_number: bool
    ) -> str | None:
        """Generate invoice number if needed."""
        from uuid import uuid4

        if generate_invoice_number and not import_data.invoice_number:
            timestamp = datetime.now(UTC).strftime("%Y%m")
            return f"INV-{timestamp}-{uuid4().hex[:6].upper()}"
        elif import_data.invoice_number:
            return import_data.invoice_number
        return None

    @staticmethod
    def _map_optional_date_fields(import_data: InvoiceImportSchema) -> dict[str, Any]:
        """Map optional date fields."""
        data = {}
        if import_data.invoice_date:
            data["invoice_date"] = import_data.invoice_date
        if import_data.due_date:
            data["due_date"] = import_data.due_date
        if import_data.payment_date:
            data["payment_date"] = import_data.payment_date
        return data

    @staticmethod
    def _map_optional_text_fields(import_data: InvoiceImportSchema) -> dict[str, Any]:
        """Map optional text fields."""
        data = {}
        if import_data.description:
            data["description"] = import_data.description
        if import_data.payment_method:
            data["payment_method"] = import_data.payment_method
        if import_data.payment_reference:
            data["payment_reference"] = import_data.payment_reference
        return data

    @staticmethod
    def _map_tax_and_discount_fields(import_data: InvoiceImportSchema) -> dict[str, Any]:
        """Map tax and discount fields with decimal conversion."""
        data = {}
        if import_data.tax_amount:
            data["tax_amount"] = Decimal(str(import_data.tax_amount))
        if import_data.tax_rate:
            data["tax_rate"] = Decimal(str(import_data.tax_rate))
        if import_data.discount_amount:
            data["discount_amount"] = Decimal(str(import_data.discount_amount))
        if import_data.discount_rate:
            data["discount_rate"] = Decimal(str(import_data.discount_rate))
        return data

    @staticmethod
    def _map_external_references(
        import_data: InvoiceImportSchema,
    ) -> tuple[dict[str, Any], dict[str, Any]]:
        """Map external references to data and metadata."""
        data = {}
        metadata = {}

        if import_data.external_id:
            data["external_id"] = import_data.external_id
            metadata["external_id"] = import_data.external_id
        if import_data.source_system:
            data["source_system"] = import_data.source_system
            metadata["source_system"] = import_data.source_system

        return data, metadata

    @staticmethod
    def _add_import_metadata(import_data: InvoiceImportSchema, metadata: dict[str, Any]) -> None:
        """Add import-specific metadata."""
        if import_data.import_batch_id:
            metadata["import_batch_id"] = import_data.import_batch_id
            metadata["imported_at"] = datetime.now(UTC).isoformat()

    @staticmethod
    def invoice_from_import(
        import_data: InvoiceImportSchema, tenant_id: str, generate_invoice_number: bool = True
    ) -> dict[str, Any]:
        """
        Convert import schema to invoice model format.

        Args:
            import_data: Validated import data
            tenant_id: Tenant identifier
            generate_invoice_number: Whether to auto-generate invoice number

        Returns:
            Dictionary ready for invoice creation
        """
        # Initialize base data with required fields
        metadata: dict[str, Any] = {}
        data: dict[str, Any] = {
            "tenant_id": tenant_id,
            "customer_id": import_data.customer_id,
            "amount": Decimal(str(import_data.amount)),
            "currency": import_data.currency,
            "status": import_data.status,
            "metadata_json": metadata,
        }

        # Generate or set invoice number
        invoice_number = BillingMapper._generate_invoice_number_if_needed(
            import_data, generate_invoice_number
        )
        if invoice_number:
            data["invoice_number"] = invoice_number

        # Map optional fields using helpers
        data.update(BillingMapper._map_optional_date_fields(import_data))
        data.update(BillingMapper._map_optional_text_fields(import_data))
        data.update(BillingMapper._map_tax_and_discount_fields(import_data))

        # Map line items
        if import_data.line_items:
            data["line_items"] = import_data.line_items

        # Map external references
        external_data, external_metadata = BillingMapper._map_external_references(import_data)
        data.update(external_data)
        metadata.update(external_metadata)

        # Add import metadata
        BillingMapper._add_import_metadata(import_data, metadata)

        return data

    @staticmethod
    def _map_subscription_dates(import_data: SubscriptionImportSchema) -> dict[str, Any]:
        """Map subscription date fields."""
        data: dict[str, Any] = {}

        if import_data.start_date:
            data["current_period_start"] = import_data.start_date
        else:
            data["current_period_start"] = datetime.now(UTC)

        if import_data.trial_end_date:
            data["trial_end"] = import_data.trial_end_date

        if import_data.next_billing_date:
            data["current_period_end"] = import_data.next_billing_date

        if import_data.canceled_at:
            data["canceled_at"] = import_data.canceled_at

        data["cancel_at_period_end"] = import_data.cancel_at_period_end

        return data

    @staticmethod
    def _map_subscription_external_refs(import_data: SubscriptionImportSchema) -> dict[str, Any]:
        """Map subscription external references to metadata."""
        metadata: dict[str, Any] = {}

        if import_data.external_id:
            metadata["external_id"] = import_data.external_id
        if import_data.payment_method_id:
            metadata["payment_method_id"] = import_data.payment_method_id
        if import_data.source_system:
            metadata["source_system"] = import_data.source_system

        return metadata

    @staticmethod
    def subscription_from_import(
        import_data: SubscriptionImportSchema, tenant_id: str
    ) -> dict[str, Any]:
        """
        Convert import schema to subscription model format.

        Args:
            import_data: Validated import data
            tenant_id: Tenant identifier

        Returns:
            Dictionary ready for subscription creation
        """
        from uuid import uuid4

        metadata: dict[str, Any] = {}
        data: dict[str, Any] = {
            "subscription_id": f"SUB-{uuid4().hex[:12].upper()}",
            "tenant_id": tenant_id,
            "customer_id": import_data.customer_id,
            "plan_id": import_data.plan_id,
            "status": import_data.status,
            "price": Decimal(str(import_data.price)),
            "currency": import_data.currency,
            "metadata_json": metadata,
        }

        # Optional billing cycle
        if import_data.billing_cycle:
            data["billing_cycle"] = import_data.billing_cycle

        # Custom pricing
        if import_data.custom_price is not None:
            data["custom_price"] = Decimal(str(import_data.custom_price))

        # Map dates
        data.update(BillingMapper._map_subscription_dates(import_data))

        # Map external references
        metadata.update(BillingMapper._map_subscription_external_refs(import_data))

        # Import metadata
        if import_data.import_batch_id:
            metadata["import_batch_id"] = import_data.import_batch_id
            metadata["imported_at"] = datetime.now(UTC).isoformat()

        return data

    @staticmethod
    def payment_from_import(import_data: PaymentImportSchema, tenant_id: str) -> dict[str, Any]:
        """
        Convert import schema to payment model format.

        Args:
            import_data: Validated import data
            tenant_id: Tenant identifier

        Returns:
            Dictionary ready for payment creation
        """
        from uuid import uuid4

        metadata: dict[str, Any] = {}
        data: dict[str, Any] = {
            "payment_id": f"PAY-{uuid4().hex[:12].upper()}",
            "tenant_id": tenant_id,
            "customer_id": import_data.customer_id,
            "amount": Decimal(str(import_data.amount)),
            "currency": import_data.currency,
            "payment_date": import_data.payment_date,
            "payment_method": import_data.payment_method,
            "status": import_data.status,
            "metadata_json": metadata,
        }

        # References
        if import_data.invoice_id:
            data["invoice_id"] = import_data.invoice_id
        if import_data.subscription_id:
            data["subscription_id"] = import_data.subscription_id
        if import_data.transaction_id:
            data["transaction_id"] = import_data.transaction_id
        if import_data.reference_number:
            data["reference_number"] = import_data.reference_number

        # External references
        if import_data.external_id:
            metadata["external_id"] = import_data.external_id
        if import_data.source_system:
            metadata["source_system"] = import_data.source_system

        # Import metadata
        if import_data.import_batch_id:
            metadata["import_batch_id"] = import_data.import_batch_id
            metadata["imported_at"] = datetime.now(UTC).isoformat()

        return data

    @staticmethod
    def validate_invoice_row(
        row: dict[str, Any], row_number: int
    ) -> InvoiceImportSchema | dict[str, Any]:
        """Validate a single invoice row."""
        try:
            cleaned_row = {}
            for key, value in row.items():
                if value == "":
                    continue
                if isinstance(value, str) and value.lower() in ["true", "false"]:
                    value = value.lower() == "true"
                cleaned_row[key] = value
            return InvoiceImportSchema(**cleaned_row)
        except Exception as e:
            return {"row_number": row_number, "error": str(e), "data": row}

    @staticmethod
    def validate_subscription_row(
        row: dict[str, Any], row_number: int
    ) -> SubscriptionImportSchema | dict[str, Any]:
        """Validate a single subscription row."""
        try:
            cleaned_row = {}
            for key, value in row.items():
                if value == "":
                    continue
                if isinstance(value, str) and value.lower() in ["true", "false"]:
                    value = value.lower() == "true"
                cleaned_row[key] = value
            return SubscriptionImportSchema(**cleaned_row)
        except Exception as e:
            return {"row_number": row_number, "error": str(e), "data": row}
