"""
Billing validation utilities.

Provides comprehensive validation for billing data, including currency amounts,
dates, SKUs, and business rules validation.
"""

import re
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import structlog

from dotmac.platform.billing.exceptions import (
    BillingConfigurationError,
    PaymentError,
    PricingError,
    ProductError,
    SubscriptionError,
)

logger = structlog.get_logger(__name__)


class CurrencyValidator:
    """Validator for currency codes and amounts."""

    # ISO 4217 currency codes (subset of commonly used)
    VALID_CURRENCIES = {
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "JPY",
        "CNY",
        "INR",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
        "NZD",
        "SGD",
        "HKD",
        "MXN",
        "BRL",
        "ZAR",
        "KRW",
        "TWD",
    }

    # Currencies with zero decimal places
    ZERO_DECIMAL_CURRENCIES = {"JPY", "KRW", "TWD"}

    @classmethod
    def validate_currency_code(cls, code: str) -> str:
        """
        Validate currency code against ISO 4217.

        Args:
            code: Currency code to validate

        Returns:
            Uppercase currency code

        Raises:
            BillingConfigurationError: If currency code is invalid
        """
        if not code:
            raise BillingConfigurationError(
                "Currency code cannot be empty",
                config_key="currency",
                recovery_hint="Provide a valid ISO 4217 currency code",
            )

        code_upper = code.upper()
        if code_upper not in cls.VALID_CURRENCIES:
            raise BillingConfigurationError(
                f"Invalid currency code: {code}",
                config_key="currency",
                recovery_hint=f"Use a valid ISO 4217 currency code. Common codes: {', '.join(sorted(cls.VALID_CURRENCIES)[:5])}",
            )

        return code_upper

    @classmethod
    def validate_amount(
        cls,
        amount: int | float | Decimal,
        currency: str,
        min_amount: int | float | None = None,
        max_amount: int | float | None = None,
    ) -> Decimal:
        """
        Validate monetary amount for a given currency.

        Args:
            amount: Amount to validate (in minor units)
            currency: Currency code
            min_amount: Minimum allowed amount
            max_amount: Maximum allowed amount

        Returns:
            Validated amount as Decimal

        Raises:
            PaymentError: If amount is invalid
        """
        currency = cls.validate_currency_code(currency)

        try:
            decimal_amount = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise PaymentError(
                f"Invalid amount format: {amount}",
                context={"amount": amount, "currency": currency},
                recovery_hint="Provide a valid numeric amount",
            )

        # Check for negative amounts
        if decimal_amount < 0:
            raise PaymentError(
                "Amount cannot be negative",
                context={"amount": amount, "currency": currency},
                recovery_hint="Provide a positive amount",
            )

        # Validate against min/max if provided
        if min_amount is not None and decimal_amount < Decimal(str(min_amount)):
            raise PaymentError(
                f"Amount below minimum: {amount} < {min_amount}",
                context={"amount": amount, "min_amount": min_amount, "currency": currency},
                recovery_hint=f"Amount must be at least {min_amount}",
            )

        if max_amount is not None and decimal_amount > Decimal(str(max_amount)):
            raise PaymentError(
                f"Amount exceeds maximum: {amount} > {max_amount}",
                context={"amount": amount, "max_amount": max_amount, "currency": currency},
                recovery_hint=f"Amount must not exceed {max_amount}",
            )

        # Check decimal places for currency
        if currency in cls.ZERO_DECIMAL_CURRENCIES:
            if decimal_amount % 1 != 0:
                raise PaymentError(
                    f"Currency {currency} does not support decimal amounts",
                    context={"amount": amount, "currency": currency},
                    recovery_hint=f"Provide whole number amounts for {currency}",
                )

        return decimal_amount


class SKUValidator:
    """Validator for product SKUs."""

    # SKU pattern: alphanumeric, hyphens, underscores, max 100 chars
    SKU_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9_-]{0,98}[A-Z0-9]$", re.IGNORECASE)

    @classmethod
    def validate(cls, sku: str) -> str:
        """
        Validate and normalize product SKU.

        Args:
            sku: SKU to validate

        Returns:
            Normalized SKU (uppercase)

        Raises:
            ProductError: If SKU is invalid
        """
        if not sku:
            raise ProductError(
                "SKU cannot be empty", recovery_hint="Provide a valid SKU for the product"
            )

        sku = sku.strip().upper()

        if len(sku) < 2:
            raise ProductError(
                "SKU must be at least 2 characters",
                context={"sku": sku},
                recovery_hint="SKU should be at least 2 characters long",
            )

        if len(sku) > 100:
            raise ProductError(
                "SKU exceeds maximum length of 100 characters",
                context={"sku": sku, "length": len(sku)},
                recovery_hint="Use a SKU with 100 or fewer characters",
            )

        if not cls.SKU_PATTERN.match(sku):
            raise ProductError(
                "Invalid SKU format",
                context={"sku": sku},
                recovery_hint="SKU must contain only letters, numbers, hyphens, and underscores",
            )

        return sku


class DateRangeValidator:
    """Validator for date ranges in billing contexts."""

    @classmethod
    def validate_billing_period(
        cls, start_date: datetime, end_date: datetime, max_period_days: int = 366
    ) -> tuple[datetime, datetime]:
        """
        Validate billing period dates.

        Args:
            start_date: Period start date
            end_date: Period end date
            max_period_days: Maximum allowed period in days

        Returns:
            Validated (start_date, end_date) tuple

        Raises:
            SubscriptionError: If date range is invalid
        """
        # Ensure dates are timezone-aware
        if start_date.tzinfo is None:
            start_date = start_date.replace(tzinfo=UTC)
        if end_date.tzinfo is None:
            end_date = end_date.replace(tzinfo=UTC)

        # Check date order
        if end_date <= start_date:
            raise SubscriptionError(
                "End date must be after start date",
                context={"start_date": start_date.isoformat(), "end_date": end_date.isoformat()},
                recovery_hint="Ensure end date is later than start date",
            )

        # Check period length
        period_days = (end_date - start_date).days
        if period_days > max_period_days:
            raise SubscriptionError(
                f"Billing period exceeds maximum of {max_period_days} days",
                context={"period_days": period_days, "max_days": max_period_days},
                recovery_hint=f"Use a billing period of {max_period_days} days or less",
            )

        return start_date, end_date

    @classmethod
    def validate_trial_period(cls, trial_days: int, max_trial_days: int = 90) -> int:
        """
        Validate trial period length.

        Args:
            trial_days: Number of trial days
            max_trial_days: Maximum allowed trial period

        Returns:
            Validated trial days

        Raises:
            SubscriptionError: If trial period is invalid
        """
        if trial_days < 0:
            raise SubscriptionError(
                "Trial days cannot be negative",
                context={"trial_days": trial_days},
                recovery_hint="Use a positive number of trial days or 0 for no trial",
            )

        if trial_days > max_trial_days:
            raise SubscriptionError(
                f"Trial period exceeds maximum of {max_trial_days} days",
                context={"trial_days": trial_days, "max_trial_days": max_trial_days},
                recovery_hint=f"Use a trial period of {max_trial_days} days or less",
            )

        return trial_days


class PricingRuleValidator:
    """Validator for pricing rules and discounts."""

    @classmethod
    def validate_discount(
        cls,
        discount_type: str,
        discount_value: int | float | Decimal,
        max_percentage: float = 100.0,
    ) -> Decimal:
        """
        Validate discount value based on type.

        Args:
            discount_type: Type of discount (percentage or fixed)
            discount_value: Discount value
            max_percentage: Maximum allowed percentage discount

        Returns:
            Validated discount value as Decimal

        Raises:
            PricingError: If discount is invalid
        """
        try:
            value = Decimal(str(discount_value))
        except (InvalidOperation, ValueError):
            raise PricingError(
                f"Invalid discount value: {discount_value}",
                context={"discount_value": discount_value, "discount_type": discount_type},
                recovery_hint="Provide a valid numeric discount value",
            )

        if value < 0:
            raise PricingError(
                "Discount value cannot be negative",
                context={"discount_value": discount_value},
                recovery_hint="Use a positive discount value",
            )

        if discount_type == "percentage":
            if value > Decimal(str(max_percentage)):
                raise PricingError(
                    f"Percentage discount exceeds maximum of {max_percentage}%",
                    context={"discount_value": discount_value, "max_percentage": max_percentage},
                    recovery_hint=f"Use a percentage between 0 and {max_percentage}",
                )

        return value

    @classmethod
    def validate_quantity_rules(
        cls, min_quantity: int | None, max_quantity: int | None
    ) -> tuple[int | None, int | None]:
        """
        Validate quantity-based pricing rules.

        Args:
            min_quantity: Minimum quantity for rule
            max_quantity: Maximum quantity for rule

        Returns:
            Validated (min_quantity, max_quantity) tuple

        Raises:
            PricingError: If quantity rules are invalid
        """
        if min_quantity is not None and min_quantity < 1:
            raise PricingError(
                "Minimum quantity must be at least 1",
                context={"min_quantity": min_quantity},
                recovery_hint="Use a minimum quantity of 1 or more",
            )

        if max_quantity is not None and max_quantity < 1:
            raise PricingError(
                "Maximum quantity must be at least 1",
                context={"max_quantity": max_quantity},
                recovery_hint="Use a maximum quantity of 1 or more",
            )

        if min_quantity is not None and max_quantity is not None:
            if min_quantity > max_quantity:
                raise PricingError(
                    "Minimum quantity cannot exceed maximum quantity",
                    context={"min_quantity": min_quantity, "max_quantity": max_quantity},
                    recovery_hint="Ensure minimum quantity is less than or equal to maximum",
                )

        return min_quantity, max_quantity


class BusinessRulesValidator:
    """Validator for complex business rules."""

    @classmethod
    def validate_subscription_change(
        cls,
        current_plan_id: str,
        new_plan_id: str,
        current_status: str,
        allow_downgrades: bool = True,
    ) -> None:
        """
        Validate subscription plan change.

        Args:
            current_plan_id: Current subscription plan
            new_plan_id: New subscription plan
            current_status: Current subscription status
            allow_downgrades: Whether to allow plan downgrades

        Raises:
            SubscriptionError: If plan change is invalid
        """
        # Check if subscription is in valid state for changes
        valid_statuses = ["active", "trial"]
        if current_status not in valid_statuses:
            raise SubscriptionError(
                f"Cannot change plan for subscription in {current_status} status",
                context={"current_status": current_status, "valid_statuses": valid_statuses},
                recovery_hint=f"Subscription must be in {' or '.join(valid_statuses)} status",
            )

        # Check for same plan
        if current_plan_id == new_plan_id:
            raise SubscriptionError(
                "New plan is the same as current plan",
                context={"current_plan_id": current_plan_id, "new_plan_id": new_plan_id},
                recovery_hint="Select a different plan for the change",
            )

        # Additional downgrade validation could go here
        # This would typically check plan features, pricing tiers, etc.

    @classmethod
    def validate_refund_eligibility(
        cls,
        payment_date: datetime,
        amount: Decimal,
        refunded_amount: Decimal,
        refund_window_days: int = 30,
    ) -> None:
        """
        Validate refund eligibility.

        Args:
            payment_date: Original payment date
            amount: Original payment amount
            refunded_amount: Amount already refunded
            refund_window_days: Refund window in days

        Raises:
            PaymentError: If refund is not eligible
        """
        # Check refund window
        now = datetime.now(UTC)
        if payment_date.tzinfo is None:
            payment_date = payment_date.replace(tzinfo=UTC)

        days_since_payment = (now - payment_date).days
        if days_since_payment > refund_window_days:
            raise PaymentError(
                f"Refund window of {refund_window_days} days has expired",
                context={
                    "payment_date": payment_date.isoformat(),
                    "days_since_payment": days_since_payment,
                    "refund_window_days": refund_window_days,
                },
                recovery_hint=f"Refunds must be requested within {refund_window_days} days of payment",
            )

        # Check if fully refunded
        if refunded_amount >= amount:
            raise PaymentError(
                "Payment has already been fully refunded",
                context={"original_amount": str(amount), "refunded_amount": str(refunded_amount)},
                recovery_hint="This payment cannot be refunded further",
            )


class ValidationContext:
    """Context manager for batch validation with detailed error collection."""

    def __init__(self) -> None:
        self.errors: list[dict[str, Any]] = []
        self.warnings: list[dict[str, Any]] = []

    def add_error(
        self, field: str, message: str, value: Any | None = None, recovery_hint: str | None = None
    ) -> None:
        """Add validation error."""
        self.errors.append(
            {"field": field, "message": message, "value": value, "recovery_hint": recovery_hint}
        )

    def add_warning(self, field: str, message: str, value: Any | None = None) -> None:
        """Add validation warning."""
        self.warnings.append({"field": field, "message": message, "value": value})

    def has_errors(self) -> bool:
        """Check if validation has errors."""
        return len(self.errors) > 0

    def raise_if_errors(self) -> None:
        """Raise exception if validation errors exist."""
        if self.has_errors():
            raise BillingConfigurationError(
                f"Validation failed with {len(self.errors)} errors",
                config_key="validation",
                recovery_hint="Fix the validation errors and retry",
            )
