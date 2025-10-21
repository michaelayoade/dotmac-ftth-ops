"""
Money and currency utilities using py-moneyed and Babel.

Provides currency handling with proper decimal precision,
locale-aware formatting, and currency validation.
"""

from decimal import Decimal
from typing import TYPE_CHECKING, Any

from babel import Locale
from babel.core import UnknownLocaleError
from babel.numbers import format_currency, get_currency_precision
from moneyed import Currency, Money, get_currency
from moneyed.classes import CurrencyDoesNotExist

# Common currencies for quick access
USD = Currency("USD")
EUR = Currency("EUR")
GBP = Currency("GBP")
CAD = Currency("CAD")
AUD = Currency("AUD")
JPY = Currency("JPY")

# Default locale for formatting
DEFAULT_LOCALE = "en_US"


class MoneyHandler:
    """Central handler for money operations with proper error handling."""

    def __init__(self, default_currency: str = "USD", default_locale: str = DEFAULT_LOCALE) -> None:
        self.default_currency = self._validate_currency(default_currency)
        self.default_locale = self._validate_locale(default_locale)

    def _validate_currency(self, currency_code: str) -> Currency:
        """Validate and return Currency object."""
        try:
            return get_currency(currency_code.upper())
        except CurrencyDoesNotExist:
            raise ValueError(f"Invalid currency code: {currency_code}")

    def _validate_locale(self, locale_code: str) -> str:
        """Validate locale code."""
        try:
            Locale.parse(locale_code)
            return locale_code
        except UnknownLocaleError:
            return DEFAULT_LOCALE

    def create_money(
        self, amount: int | float | Decimal | str, currency: str | None = None
    ) -> Money:
        """Create Money object with proper validation."""
        currency = currency or self.default_currency.code
        validated_currency = self._validate_currency(currency)

        # Convert to Decimal for precision
        if isinstance(amount, str):
            decimal_amount = Decimal(amount)
        else:
            decimal_amount = Decimal(str(amount))

        return Money(amount=decimal_amount, currency=validated_currency)

    def format_money(self, money: Money, locale: str | None = None, **kwargs: Any) -> str:
        """Format Money object with locale-aware formatting."""
        locale = locale or self.default_locale
        validated_locale = self._validate_locale(locale)

        try:
            return format_currency(
                number=money.amount, currency=money.currency.code, locale=validated_locale, **kwargs
            )
        except (TypeError, ValueError):
            # Fallback to simple formatting if locale issues
            return f"{money.currency.code} {money.amount}"

    def add_money(self, *money_objects: Money) -> Money:
        """Add multiple Money objects safely."""
        if not money_objects:
            return self.create_money(0)

        # Ensure all currencies match
        first_currency = money_objects[0].currency
        for money in money_objects[1:]:
            if money.currency != first_currency:
                raise ValueError(f"Currency mismatch: {money.currency} != {first_currency}")

        total = sum(money_objects, self.create_money(0, first_currency.code))
        return total

    def multiply_money(self, money: Money, multiplier: int | float | Decimal | str) -> Money:
        """Multiply Money by a number with proper precision."""
        if isinstance(multiplier, str):
            multiplier = Decimal(multiplier)
        elif not isinstance(multiplier, Decimal):
            multiplier = Decimal(str(multiplier))

        return money * multiplier

    def get_currency_precision(self, currency_code: str) -> int:
        """Get decimal precision for a currency."""
        return get_currency_precision(currency_code.upper())

    def round_money(self, money: Money) -> Money:
        """Round Money to proper currency precision."""
        precision = self.get_currency_precision(money.currency.code)
        rounded_amount = money.amount.quantize(Decimal("0.1") ** precision)
        return Money(amount=rounded_amount, currency=money.currency)

    def money_to_minor_units(self, money: Money) -> int:
        """Convert Money to minor units (e.g., cents for USD)."""
        precision = self.get_currency_precision(money.currency.code)
        multiplier = 10**precision
        return int(money.amount * multiplier)

    def money_from_minor_units(self, minor_units: int, currency: str) -> Money:
        """Create Money from minor units (e.g., cents)."""
        validated_currency = self._validate_currency(currency)
        precision = self.get_currency_precision(currency)
        divisor = Decimal(10**precision)
        amount = Decimal(minor_units) / divisor
        return Money(amount=amount, currency=validated_currency)

    def to_dict(self, money: Money) -> dict[str, Any]:
        """Convert Money to dictionary for serialization."""
        return {
            "amount": str(money.amount),
            "currency": money.currency.code,
            "minor_units": self.money_to_minor_units(money),
        }

    def from_dict(self, data: dict[str, Any]) -> Money:
        """Create Money from dictionary."""
        return self.create_money(amount=data["amount"], currency=data["currency"])


# Global instance for convenience
money_handler = MoneyHandler()


# Convenience functions
def create_money(amount: int | float | Decimal | str, currency: str = "USD") -> Money:
    """Create Money object with default handler."""
    return money_handler.create_money(amount, currency)


def format_money(money: Money, locale: str | None = None, **kwargs: Any) -> str:
    """Format Money with default handler."""
    return money_handler.format_money(money, locale, **kwargs)


def add_money(*money_objects: Money) -> Money:
    """Add Money objects with default handler."""
    return money_handler.add_money(*money_objects)


def multiply_money(money: Money, multiplier: int | float | Decimal | str) -> Money:
    """Multiply Money with default handler."""
    return money_handler.multiply_money(money, multiplier)


# Currency conversion utilities (for future enhancement)
if TYPE_CHECKING:  # pragma: no cover - type checking only
    from sqlalchemy.ext.asyncio import AsyncSession


class CurrencyConverter:
    """Currency conversion helper backed by the currency rate service."""

    def __init__(self, session: "AsyncSession") -> None:
        from dotmac.platform.billing.currency.service import CurrencyRateService

        self._service = CurrencyRateService(session)

    async def convert(
        self,
        money: Money,
        target_currency: str,
        *,
        force_refresh: bool = False,
    ) -> Money:
        """Convert money to a target currency using persisted exchange rates."""
        result: Money = await self._service.convert_money(
            money,
            target_currency,
            force_refresh=force_refresh,
        )
        return result


# Export commonly used functions and classes
__all__ = [
    "MoneyHandler",
    "CurrencyConverter",
    "money_handler",
    "create_money",
    "format_money",
    "add_money",
    "multiply_money",
    "USD",
    "EUR",
    "GBP",
    "CAD",
    "AUD",
    "JPY",
]
