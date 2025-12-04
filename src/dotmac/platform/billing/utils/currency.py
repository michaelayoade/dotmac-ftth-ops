"""
Currency utilities for billing
"""

from decimal import ROUND_HALF_UP, Decimal

from dotmac.platform.billing.config import CurrencyConfig, get_billing_config


class CurrencyFormatter:
    """Currency formatting utilities"""

    def __init__(self) -> None:
        self.config: CurrencyConfig = get_billing_config().currency

    def format_amount(self, amount: int, include_symbol: bool = True) -> str:
        """Format amount from minor units to display string"""

        if self.config.use_minor_units:
            # Convert from minor units (cents) to major units (dollars)
            decimal_amount = Decimal(amount) / (10**self.config.currency_decimal_places)
        else:
            decimal_amount = Decimal(amount)

        # Format with proper decimal places
        formatted = f"{decimal_amount:.{self.config.currency_decimal_places}f}"

        if include_symbol:
            # Apply currency format
            currency_format: str = self.config.currency_format
            return currency_format.format(
                symbol=self.config.currency_symbol,
                amount=formatted,
                currency=self.config.default_currency,
            )
        else:
            return formatted

    def parse_amount(self, amount_str: str) -> int:
        """Parse display amount to minor units"""

        # Remove currency symbol and whitespace
        clean_str = amount_str.replace(self.config.currency_symbol, "").strip()
        clean_str = clean_str.replace(",", "")  # Remove thousands separator

        # Convert to Decimal
        decimal_amount = Decimal(clean_str)

        if self.config.use_minor_units:
            # Convert to minor units
            minor_units = decimal_amount * (10**self.config.currency_decimal_places)
            return int(minor_units.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        else:
            return int(decimal_amount)

    def convert_to_minor_units(self, major_amount: Decimal) -> int:
        """Convert major currency units to minor units"""

        if self.config.use_minor_units:
            minor_units = major_amount * (10**self.config.currency_decimal_places)
            return int(minor_units.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        else:
            return int(major_amount)

    def convert_to_major_units(self, minor_amount: int) -> Decimal:
        """Convert minor currency units to major units"""

        if self.config.use_minor_units:
            decimals = int(self.config.currency_decimal_places)
            divisor = Decimal(10) ** decimals
            return Decimal(minor_amount) / divisor
        else:
            return Decimal(minor_amount)

    def get_currency_info(self) -> dict[str, str | int | bool]:
        """Get currency configuration information"""

        return {
            "currency_code": self.config.default_currency,
            "currency_symbol": self.config.currency_symbol,
            "decimal_places": self.config.currency_decimal_places,
            "uses_minor_units": self.config.use_minor_units,
            "format_pattern": self.config.currency_format,
        }

    def validate_amount(self, amount: int) -> bool:
        """Validate that amount is valid for the currency"""

        # Check if amount is non-negative
        if amount < 0:
            return False

        # Check if amount exceeds reasonable limits
        # Max: 999,999,999.99 in major units = 99,999,999,999 in minor units
        max_amount = 99_999_999_999 if self.config.use_minor_units else 999_999_999

        return amount <= max_amount


# Global formatter instance
_currency_formatter: CurrencyFormatter | None = None


def get_currency_formatter() -> CurrencyFormatter:
    """Get the global currency formatter instance"""
    global _currency_formatter
    if _currency_formatter is None:
        _currency_formatter = CurrencyFormatter()
    return _currency_formatter


def format_money(amount: int, include_symbol: bool = True) -> str:
    """Convenience function to format money amount"""
    return get_currency_formatter().format_amount(amount, include_symbol)


def parse_money(amount_str: str) -> int:
    """Convenience function to parse money string"""
    return get_currency_formatter().parse_amount(amount_str)
