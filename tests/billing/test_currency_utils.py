"""Tests for billing currency utilities."""

from decimal import Decimal
from unittest.mock import Mock, patch

import pytest

from dotmac.platform.billing.utils.currency import (
    CurrencyFormatter,
    format_money,
    get_currency_formatter,
    parse_money,
)


@pytest.fixture
def mock_currency_config():
    """Mock currency configuration."""
    config = Mock()
    config.default_currency = "USD"
    config.currency_symbol = "$"
    config.currency_decimal_places = 2
    config.use_minor_units = True
    config.currency_format = "{symbol}{amount}"
    return config


@pytest.fixture
def mock_billing_config(mock_currency_config):
    """Mock billing configuration."""
    billing_config = Mock()
    billing_config.currency = mock_currency_config
    return billing_config


@pytest.mark.unit
class TestCurrencyFormatter:
    """Test CurrencyFormatter class."""

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_formatter_initialization(self, mock_get_config, mock_billing_config):
        """Test CurrencyFormatter initialization."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        assert formatter.config == mock_billing_config.currency

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_amount_with_symbol(self, mock_get_config, mock_billing_config):
        """Test formatting amount with currency symbol."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        # 10050 cents = $100.50
        result = formatter.format_amount(10050, include_symbol=True)

        assert result == "$100.50"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_amount_without_symbol(self, mock_get_config, mock_billing_config):
        """Test formatting amount without currency symbol."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.format_amount(10050, include_symbol=False)

        assert result == "100.50"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_amount_zero(self, mock_get_config, mock_billing_config):
        """Test formatting zero amount."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.format_amount(0, include_symbol=True)

        assert result == "$0.00"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_amount_large_number(self, mock_get_config, mock_billing_config):
        """Test formatting large amount."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        # 123456789 cents = $1,234,567.89
        result = formatter.format_amount(123456789, include_symbol=False)

        assert result == "1234567.89"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_amount_no_minor_units(self, mock_get_config, mock_billing_config):
        """Test formatting when minor units are not used."""
        mock_billing_config.currency.use_minor_units = False
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.format_amount(100, include_symbol=False)

        assert result == "100.00"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_parse_amount_with_symbol(self, mock_get_config, mock_billing_config):
        """Test parsing amount with currency symbol."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.parse_amount("$100.50")

        assert result == 10050  # Converted to cents

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_parse_amount_without_symbol(self, mock_get_config, mock_billing_config):
        """Test parsing amount without currency symbol."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.parse_amount("100.50")

        assert result == 10050

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_parse_amount_with_thousands_separator(self, mock_get_config, mock_billing_config):
        """Test parsing amount with thousands separator."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.parse_amount("$1,234.56")

        assert result == 123456  # Converted to cents

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_parse_amount_zero(self, mock_get_config, mock_billing_config):
        """Test parsing zero amount."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.parse_amount("$0.00")

        assert result == 0

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_convert_to_minor_units(self, mock_get_config, mock_billing_config):
        """Test converting major units to minor units."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.convert_to_minor_units(Decimal("100.50"))

        assert result == 10050

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_convert_to_minor_units_rounding(self, mock_get_config, mock_billing_config):
        """Test rounding when converting to minor units."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.convert_to_minor_units(Decimal("100.555"))

        assert result == 10056  # Rounded up

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_convert_to_minor_units_no_minor_units(self, mock_get_config, mock_billing_config):
        """Test conversion when minor units not used."""
        mock_billing_config.currency.use_minor_units = False
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.convert_to_minor_units(Decimal("100"))

        assert result == 100

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_convert_to_major_units(self, mock_get_config, mock_billing_config):
        """Test converting minor units to major units."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.convert_to_major_units(10050)

        assert result == Decimal("100.50")

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_convert_to_major_units_no_minor_units(self, mock_get_config, mock_billing_config):
        """Test conversion to major units when minor units not used."""
        mock_billing_config.currency.use_minor_units = False
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        result = formatter.convert_to_major_units(100)

        assert result == Decimal("100")

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_get_currency_info(self, mock_get_config, mock_billing_config):
        """Test getting currency configuration info."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        info = formatter.get_currency_info()

        assert info["currency_code"] == "USD"
        assert info["currency_symbol"] == "$"
        assert info["decimal_places"] == 2
        assert info["uses_minor_units"] is True
        assert info["format_pattern"] == "{symbol}{amount}"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_validate_amount_valid(self, mock_get_config, mock_billing_config):
        """Test validating valid amounts."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        assert formatter.validate_amount(0) is True
        assert formatter.validate_amount(10050) is True
        assert formatter.validate_amount(99_999_999_999) is True

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_validate_amount_negative(self, mock_get_config, mock_billing_config):
        """Test validating negative amount."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        assert formatter.validate_amount(-100) is False

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_validate_amount_exceeds_max(self, mock_get_config, mock_billing_config):
        """Test validating amount exceeding maximum."""
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        assert formatter.validate_amount(100_000_000_000) is False

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_validate_amount_no_minor_units(self, mock_get_config, mock_billing_config):
        """Test validation when minor units not used."""
        mock_billing_config.currency.use_minor_units = False
        mock_get_config.return_value = mock_billing_config

        formatter = CurrencyFormatter()

        assert formatter.validate_amount(999_999_999) is True
        assert formatter.validate_amount(1_000_000_000) is False


class TestGlobalFormatter:
    """Test global formatter instance."""

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_get_currency_formatter(self, mock_get_config, mock_billing_config):
        """Test getting global formatter instance."""
        mock_get_config.return_value = mock_billing_config

        formatter = get_currency_formatter()

        assert isinstance(formatter, CurrencyFormatter)

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_get_currency_formatter_singleton(self, mock_get_config, mock_billing_config):
        """Test formatter is singleton."""
        mock_get_config.return_value = mock_billing_config

        # Clear any cached instance
        import dotmac.platform.billing.utils.currency as currency_module

        currency_module._currency_formatter = None

        formatter1 = get_currency_formatter()
        formatter2 = get_currency_formatter()

        assert formatter1 is formatter2


class TestConvenienceFunctions:
    """Test convenience wrapper functions."""

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_money_function(self, mock_get_config, mock_billing_config):
        """Test format_money convenience function."""
        mock_get_config.return_value = mock_billing_config

        # Clear cached instance
        import dotmac.platform.billing.utils.currency as currency_module

        currency_module._currency_formatter = None

        result = format_money(10050, include_symbol=True)

        assert result == "$100.50"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_format_money_without_symbol(self, mock_get_config, mock_billing_config):
        """Test format_money without symbol."""
        mock_get_config.return_value = mock_billing_config

        # Clear cached instance
        import dotmac.platform.billing.utils.currency as currency_module

        currency_module._currency_formatter = None

        result = format_money(10050, include_symbol=False)

        assert result == "100.50"

    @patch("dotmac.platform.billing.utils.currency.get_billing_config")
    def test_parse_money_function(self, mock_get_config, mock_billing_config):
        """Test parse_money convenience function."""
        mock_get_config.return_value = mock_billing_config

        # Clear cached instance
        import dotmac.platform.billing.utils.currency as currency_module

        currency_module._currency_formatter = None

        result = parse_money("$100.50")

        assert result == 10050
