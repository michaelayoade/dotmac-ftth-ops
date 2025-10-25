"""
Money-aware Pydantic models using py-moneyed for accurate currency handling.

These models extend billing models with proper Money objects,
automatic currency validation, and locale-aware formatting.
"""

from datetime import datetime
from decimal import Decimal
from typing import Any

from moneyed import Money
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from .money_utils import MoneyHandler, add_money, create_money, format_money, multiply_money

# Initialize money handler
money_handler = MoneyHandler()


class MoneyField(BaseModel):
    """Pydantic-compatible Money field for serialization."""

    model_config = ConfigDict(
        frozen=True,
        validate_assignment=True,
    )

    amount: str = Field(description="Amount as string for precision")
    currency: str = Field(description="ISO 4217 currency code")
    minor_units: int = Field(description="Amount in minor units (cents, etc.)")

    @classmethod
    def from_money(cls, money: Money) -> "MoneyField":
        """Create MoneyField from Money object."""
        return cls(
            amount=str(money.amount),
            currency=money.currency.code,
            minor_units=money_handler.money_to_minor_units(money),
        )

    def to_money(self) -> Money:
        """Convert back to Money object."""
        return create_money(self.amount, self.currency)

    def format(self, locale: str = "en_US", **kwargs: Any) -> str:
        """Format money with locale."""
        return format_money(self.to_money(), locale, **kwargs)


class MoneyInvoiceLineItem(BaseModel):
    """Invoice line item with Money objects for accurate calculations."""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        str_strip_whitespace=True,
        extra="forbid",
    )

    line_item_id: str | None = Field(None, description="Line item identifier")
    description: str = Field(description="Item description", max_length=500)
    quantity: int = Field(ge=1, description="Quantity of items")

    # Money fields
    unit_price: MoneyField = Field(description="Unit price as Money object")
    total_price: MoneyField = Field(description="Total price (calculated)")

    # Tax handling
    tax_rate: Decimal = Field(ge=0, le=1, description="Tax rate as decimal (0.1 = 10%)")
    tax_amount: MoneyField = Field(description="Tax amount (calculated)")

    # Discount handling
    discount_percentage: Decimal = Field(ge=0, le=1, description="Discount as decimal")
    discount_amount: MoneyField = Field(description="Discount amount (calculated)")

    # Optional references
    product_id: str | None = Field(None, description="Product reference")
    subscription_id: str | None = Field(None, description="Subscription reference")

    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    @field_validator("unit_price", "total_price", "tax_amount", "discount_amount")
    @classmethod
    def validate_money_fields(cls, v: MoneyField | dict[str, Any]) -> MoneyField:
        """Ensure Money fields are valid."""
        if isinstance(v, MoneyField):
            return v
        if isinstance(v, dict):
            return MoneyField(**v)
        raise TypeError("Money fields must be MoneyField instances or dicts")

    # Note: total_price includes tax and discounts, so no validation against unit_price * quantity

    @classmethod
    def create_from_values(
        cls,
        description: str,
        quantity: int,
        unit_price_amount: str | Decimal | int | float,
        currency: str = "USD",
        tax_rate: str | Decimal | float = 0,
        discount_percentage: str | Decimal | float = 0,
        **kwargs: Any,
    ) -> "MoneyInvoiceLineItem":
        """Create line item with automatic Money calculations."""

        # Create unit price Money object
        unit_money = create_money(unit_price_amount, currency)

        # Calculate total before tax/discount
        total_money = multiply_money(unit_money, quantity)

        # Calculate discount
        discount_rate = Decimal(str(discount_percentage))
        discount_money = multiply_money(total_money, discount_rate)
        discount_money = money_handler.round_money(discount_money)

        # Calculate subtotal after discount
        subtotal_money = Money(
            amount=total_money.amount - discount_money.amount, currency=total_money.currency
        )

        # Calculate tax on discounted amount
        tax_rate_decimal = Decimal(str(tax_rate))
        tax_money = multiply_money(subtotal_money, tax_rate_decimal)

        # Round tax amount to proper currency precision
        tax_money = money_handler.round_money(tax_money)

        # Final total
        final_total = Money(
            amount=subtotal_money.amount + tax_money.amount, currency=subtotal_money.currency
        )

        # Round final total
        final_total = money_handler.round_money(final_total)

        return cls(
            description=description,
            quantity=quantity,
            unit_price=MoneyField.from_money(unit_money),
            total_price=MoneyField.from_money(final_total),
            tax_rate=tax_rate_decimal,
            tax_amount=MoneyField.from_money(tax_money),
            discount_percentage=discount_rate,
            discount_amount=MoneyField.from_money(discount_money),
            **kwargs,
        )


class MoneyInvoice(BaseModel):
    """Invoice model with Money objects for accurate financial calculations."""

    model_config = ConfigDict(
        from_attributes=True,
        validate_assignment=True,
        str_strip_whitespace=True,
        extra="forbid",
    )

    # Basic info
    invoice_id: str | None = Field(None, description="Invoice identifier")
    invoice_number: str | None = Field(None, description="Human-readable number")
    tenant_id: str = Field(description="Tenant identifier")

    # Idempotency
    idempotency_key: str | None = Field(None, description="Idempotency key")
    created_by: str | None = Field(None, description="Creator")

    # Customer info
    customer_id: str = Field(description="Customer identifier")
    billing_email: str = Field(description="Billing email")
    billing_address: dict[str, str] = Field(default_factory=lambda: {})

    # Dates
    issue_date: datetime = Field(default_factory=datetime.utcnow)
    due_date: datetime | None = Field(None)

    # Currency
    currency: str = Field("USD", min_length=3, max_length=3)

    # Line items
    line_items: list[MoneyInvoiceLineItem] = Field(default_factory=lambda: [])

    # Money totals (computed from line items)
    subtotal: MoneyField = Field(description="Subtotal before tax")
    tax_amount: MoneyField = Field(description="Total tax amount")
    discount_amount: MoneyField = Field(description="Total discount amount")
    total_amount: MoneyField = Field(description="Final total amount")

    # Credits and payments
    total_credits_applied: MoneyField | None = Field(None, description="Credits applied")
    remaining_balance: MoneyField = Field(description="Outstanding balance")

    # Status
    status: str = Field("draft", description="Invoice status")
    payment_status: str = Field("pending", description="Payment status")

    # Metadata
    notes: str | None = Field(None, max_length=2000)
    internal_notes: str | None = Field(None, max_length=2000)
    subscription_id: str | None = Field(None, description="Subscription reference")
    extra_data: dict[str, Any] = Field(default_factory=lambda: {})

    # Timestamps
    created_at: datetime | None = Field(None)
    updated_at: datetime | None = Field(None)
    paid_at: datetime | None = None
    voided_at: datetime | None = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: Any) -> Any:
        """Validate currency code."""
        try:
            money_handler._validate_currency(v.upper())
            return v.upper()
        except ValueError:
            raise ValueError(f"Invalid currency code: {v}")

    @computed_field(return_type=MoneyField)
    def net_amount_due(self) -> MoneyField:
        """Calculate net amount due after credits."""
        total = self.total_amount.to_money()
        credits = (
            self.total_credits_applied.to_money()
            if self.total_credits_applied
            else create_money(0, self.currency)
        )
        net_money = Money(
            amount=max(Decimal("0"), total.amount - credits.amount), currency=total.currency
        )
        return MoneyField.from_money(net_money)

    def calculate_totals(self) -> None:
        """Recalculate all totals from line items."""
        if not self.line_items:
            zero_money = create_money(0, self.currency)
            self.subtotal = MoneyField.from_money(zero_money)
            self.tax_amount = MoneyField.from_money(zero_money)
            self.discount_amount = MoneyField.from_money(zero_money)
            self.total_amount = MoneyField.from_money(zero_money)
            self.remaining_balance = MoneyField.from_money(zero_money)
            return

        # Sum up line items
        line_totals = [item.total_price.to_money() for item in self.line_items]
        taxes = [item.tax_amount.to_money() for item in self.line_items]
        discounts = [item.discount_amount.to_money() for item in self.line_items]

        total_money = add_money(*line_totals)
        tax_money = add_money(*taxes)
        discount_money = add_money(*discounts)

        # Calculate subtotal before tax (line totals already include discounts)
        subtotal_money = Money(
            amount=total_money.amount - tax_money.amount,
            currency=total_money.currency,
        )
        subtotal_money = money_handler.round_money(subtotal_money)

        # Update fields
        self.subtotal = MoneyField.from_money(subtotal_money)
        self.tax_amount = MoneyField.from_money(tax_money)
        self.discount_amount = MoneyField.from_money(discount_money)
        self.total_amount = MoneyField.from_money(total_money)
        credits_money = (
            self.total_credits_applied.to_money()
            if self.total_credits_applied
            else create_money(0, self.currency)
        )
        remaining_money = Money(
            amount=max(Decimal("0"), total_money.amount - credits_money.amount),
            currency=total_money.currency,
        )
        remaining_money = money_handler.round_money(remaining_money)
        self.remaining_balance = MoneyField.from_money(remaining_money)

    def format_total(self, locale: str = "en_US") -> str:
        """Format total amount with locale."""
        return self.total_amount.format(locale)

    def format_remaining_balance(self, locale: str = "en_US") -> str:
        """Format remaining balance with locale."""
        return self.remaining_balance.format(locale)

    @classmethod
    def create_invoice(
        cls,
        tenant_id: str,
        customer_id: str,
        billing_email: str,
        line_items: list[dict[str, Any]],
        currency: str = "USD",
        **kwargs: Any,
    ) -> "MoneyInvoice":
        """Create invoice with automatic Money calculations."""

        # Convert line items to MoneyInvoiceLineItem
        money_line_items: list[MoneyInvoiceLineItem] = []
        for item_data in line_items:
            line_item = MoneyInvoiceLineItem.create_from_values(
                description=item_data["description"],
                quantity=item_data["quantity"],
                unit_price_amount=item_data["unit_price"],
                currency=currency,
                tax_rate=item_data.get("tax_rate", 0),
                discount_percentage=item_data.get("discount_percentage", 0),
                product_id=item_data.get("product_id"),
                subscription_id=item_data.get("subscription_id"),
            )
            money_line_items.append(line_item)

        # Create invoice
        invoice = cls(
            tenant_id=tenant_id,
            customer_id=customer_id,
            billing_email=billing_email,
            currency=currency,
            line_items=money_line_items,
            subtotal=MoneyField.from_money(create_money(0, currency)),
            tax_amount=MoneyField.from_money(create_money(0, currency)),
            discount_amount=MoneyField.from_money(create_money(0, currency)),
            total_amount=MoneyField.from_money(create_money(0, currency)),
            remaining_balance=MoneyField.from_money(create_money(0, currency)),
            **kwargs,
        )

        # Calculate totals
        invoice.calculate_totals()

        return invoice


# Export key classes
__all__ = ["MoneyField", "MoneyInvoiceLineItem", "MoneyInvoice", "MoneyHandler", "money_handler"]
