"""Tests for billing money_utils module."""

from decimal import Decimal

import pytest
from moneyed import Currency, Money

from dotmac.platform.billing.money_utils import (
    EUR,
    GBP,
    JPY,
    USD,
    MoneyHandler,
    add_money,
    create_money,
    format_money,
    money_handler,
    multiply_money,
)


@pytest.mark.unit
class TestMoneyHandler:
    """Test MoneyHandler class."""

    def test_money_handler_initialization_defaults(self):
        """Test MoneyHandler with default settings."""
        handler = MoneyHandler()
        assert handler.default_currency.code == "USD"
        assert handler.default_locale == "en_US"

    def test_money_handler_initialization_custom(self):
        """Test MoneyHandler with custom settings."""
        handler = MoneyHandler(default_currency="EUR", default_locale="de_DE")
        assert handler.default_currency.code == "EUR"
        assert handler.default_locale == "de_DE"

    def test_validate_currency_valid(self):
        """Test validating valid currency codes."""
        handler = MoneyHandler()

        usd = handler._validate_currency("USD")
        assert usd.code == "USD"

        eur = handler._validate_currency("eur")  # lowercase
        assert eur.code == "EUR"

    def test_validate_currency_invalid(self):
        """Test validating invalid currency code raises error."""
        handler = MoneyHandler()

        with pytest.raises(ValueError) as exc_info:
            handler._validate_currency("INVALID")
        assert "Invalid currency code" in str(exc_info.value)

    def test_validate_locale_valid(self):
        """Test validating valid locale."""
        handler = MoneyHandler()

        locale1 = handler._validate_locale("en_US")
        assert locale1 == "en_US"

        locale2 = handler._validate_locale("de_DE")
        assert locale2 == "de_DE"

    def test_validate_locale_invalid_fallback(self):
        """Test invalid locale falls back to default."""
        handler = MoneyHandler()

        locale = handler._validate_locale("invalid_locale")
        assert locale == "en_US"  # Fallback to default

    def test_create_money_string_amount(self):
        """Test creating money from string amount."""
        handler = MoneyHandler()
        money = handler.create_money("100.50", "USD")

        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"

    def test_create_money_int_amount(self):
        """Test creating money from int amount."""
        handler = MoneyHandler()
        money = handler.create_money(100, "USD")

        assert money.amount == Decimal("100")
        assert money.currency.code == "USD"

    def test_create_money_float_amount(self):
        """Test creating money from float amount."""
        handler = MoneyHandler()
        money = handler.create_money(100.50, "USD")

        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"

    def test_create_money_decimal_amount(self):
        """Test creating money from Decimal amount."""
        handler = MoneyHandler()
        money = handler.create_money(Decimal("100.50"), "USD")

        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"

    def test_create_money_default_currency(self):
        """Test creating money with default currency."""
        handler = MoneyHandler()
        money = handler.create_money("50")

        assert money.amount == Decimal("50")
        assert money.currency.code == "USD"  # Default

    def test_format_money_default_locale(self):
        """Test formatting money with default locale."""
        handler = MoneyHandler()
        money = Money("1234.56", "USD")

        formatted = handler.format_money(money)
        # Should contain both currency and amount
        assert "1234.56" in formatted or "1,234.56" in formatted

    def test_format_money_custom_locale(self):
        """Test formatting money with custom locale."""
        handler = MoneyHandler()
        money = Money("1234.56", "USD")

        formatted = handler.format_money(money, locale="en_US")
        assert "1234.56" in formatted or "1,234.56" in formatted

    def test_add_money_single(self):
        """Test adding single money object."""
        handler = MoneyHandler()
        money1 = Money("100", "USD")

        result = handler.add_money(money1)
        assert result.amount == Decimal("100")
        assert result.currency.code == "USD"

    def test_add_money_multiple(self):
        """Test adding multiple money objects."""
        handler = MoneyHandler()
        money1 = Money("100", "USD")
        money2 = Money("50", "USD")
        money3 = Money("25.50", "USD")

        result = handler.add_money(money1, money2, money3)
        assert result.amount == Decimal("175.50")
        assert result.currency.code == "USD"

    def test_add_money_empty(self):
        """Test adding no money objects returns zero."""
        handler = MoneyHandler()

        result = handler.add_money()
        assert result.amount == Decimal("0")
        assert result.currency.code == "USD"  # Default currency

    def test_add_money_currency_mismatch(self):
        """Test adding money with different currencies raises error."""
        handler = MoneyHandler()
        money1 = Money("100", "USD")
        money2 = Money("50", "EUR")

        with pytest.raises(ValueError) as exc_info:
            handler.add_money(money1, money2)
        assert "Currency mismatch" in str(exc_info.value)

    def test_multiply_money_int(self):
        """Test multiplying money by integer."""
        handler = MoneyHandler()
        money = Money("10", "USD")

        result = handler.multiply_money(money, 5)
        assert result.amount == Decimal("50")
        assert result.currency.code == "USD"

    def test_multiply_money_float(self):
        """Test multiplying money by float."""
        handler = MoneyHandler()
        money = Money("10", "USD")

        result = handler.multiply_money(money, 1.5)
        assert result.amount == Decimal("15")
        assert result.currency.code == "USD"

    def test_multiply_money_decimal(self):
        """Test multiplying money by Decimal."""
        handler = MoneyHandler()
        money = Money("10", "USD")

        result = handler.multiply_money(money, Decimal("2.5"))
        assert result.amount == Decimal("25")
        assert result.currency.code == "USD"

    def test_multiply_money_string(self):
        """Test multiplying money by string number."""
        handler = MoneyHandler()
        money = Money("10", "USD")

        result = handler.multiply_money(money, "3")
        assert result.amount == Decimal("30")
        assert result.currency.code == "USD"

    def test_get_currency_precision_usd(self):
        """Test getting precision for USD (2 decimals)."""
        handler = MoneyHandler()
        precision = handler.get_currency_precision("USD")
        assert precision == 2

    def test_get_currency_precision_jpy(self):
        """Test getting precision for JPY (0 decimals)."""
        handler = MoneyHandler()
        precision = handler.get_currency_precision("JPY")
        assert precision == 0

    def test_round_money_usd(self):
        """Test rounding money to USD precision."""
        handler = MoneyHandler()
        money = Money("10.555", "USD")

        rounded = handler.round_money(money)
        assert rounded.amount == Decimal("10.56")  # Rounded to 2 decimals

    def test_round_money_jpy(self):
        """Test rounding money to JPY precision (no decimals)."""
        handler = MoneyHandler()
        money = Money("10.5", "JPY")

        rounded = handler.round_money(money)
        # JPY has 0 decimal places, rounds to nearest integer
        assert rounded.amount in [Decimal("10"), Decimal("11")]

    def test_money_to_minor_units_usd(self):
        """Test converting USD to cents."""
        handler = MoneyHandler()
        money = Money("100.50", "USD")

        minor_units = handler.money_to_minor_units(money)
        assert minor_units == 10050  # 100.50 * 100

    def test_money_to_minor_units_jpy(self):
        """Test converting JPY to minor units (no conversion needed)."""
        handler = MoneyHandler()
        money = Money("100", "JPY")

        minor_units = handler.money_to_minor_units(money)
        assert minor_units == 100  # JPY has no minor units

    def test_money_from_minor_units_usd(self):
        """Test creating money from cents."""
        handler = MoneyHandler()

        money = handler.money_from_minor_units(10050, "USD")
        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"

    def test_money_from_minor_units_jpy(self):
        """Test creating money from JPY minor units."""
        handler = MoneyHandler()

        money = handler.money_from_minor_units(100, "JPY")
        assert money.amount == Decimal("100")
        assert money.currency.code == "JPY"

    def test_to_dict(self):
        """Test converting money to dictionary."""
        handler = MoneyHandler()
        money = Money("100.50", "USD")

        result = handler.to_dict(money)
        assert result["amount"] == "100.50"
        assert result["currency"] == "USD"
        assert result["minor_units"] == 10050

    def test_from_dict(self):
        """Test creating money from dictionary."""
        handler = MoneyHandler()
        data = {"amount": "100.50", "currency": "USD"}

        money = handler.from_dict(data)
        assert money.amount == Decimal("100.50")
        assert money.currency.code == "USD"


class TestConvenienceFunctions:
    """Test convenience wrapper functions."""

    def test_create_money_function(self):
        """Test create_money convenience function."""
        money = create_money("50.25", "USD")

        assert money.amount == Decimal("50.25")
        assert money.currency.code == "USD"

    def test_create_money_default_currency(self):
        """Test create_money with default USD."""
        money = create_money("100")

        assert money.amount == Decimal("100")
        assert money.currency.code == "USD"

    def test_format_money_function(self):
        """Test format_money convenience function."""
        money = Money("100.50", "USD")
        formatted = format_money(money)

        assert "100.50" in formatted or "100" in formatted

    def test_add_money_function(self):
        """Test add_money convenience function."""
        money1 = Money("100", "USD")
        money2 = Money("50", "USD")

        result = add_money(money1, money2)
        assert result.amount == Decimal("150")

    def test_multiply_money_function(self):
        """Test multiply_money convenience function."""
        money = Money("10", "USD")

        result = multiply_money(money, 5)
        assert result.amount == Decimal("50")


class TestCurrencyConstants:
    """Test exported currency constants."""

    def test_usd_constant(self):
        """Test USD currency constant."""
        assert USD.code == "USD"
        assert isinstance(USD, Currency)

    def test_eur_constant(self):
        """Test EUR currency constant."""
        assert EUR.code == "EUR"
        assert isinstance(EUR, Currency)

    def test_gbp_constant(self):
        """Test GBP currency constant."""
        assert GBP.code == "GBP"
        assert isinstance(GBP, Currency)

    def test_jpy_constant(self):
        """Test JPY currency constant."""
        assert JPY.code == "JPY"
        assert isinstance(JPY, Currency)


class TestGlobalMoneyHandler:
    """Test global money_handler instance."""

    def test_global_instance_exists(self):
        """Test global money_handler instance is available."""
        assert money_handler is not None
        assert isinstance(money_handler, MoneyHandler)

    def test_global_instance_create_money(self):
        """Test using global instance to create money."""
        money = money_handler.create_money("100", "USD")

        assert money.amount == Decimal("100")
        assert money.currency.code == "USD"
