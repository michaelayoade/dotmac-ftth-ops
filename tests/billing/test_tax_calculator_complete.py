"""
Comprehensive tests for billing/tax/calculator.py to improve coverage from 0%.

Tests cover:
- TaxRate model validation
- TaxCalculationResult model
- TaxCalculator initialization
- Exclusive tax calculation (tax added to price)
- Inclusive tax calculation (tax included in price)
- Compound tax rates
- Tax thresholds
- Line item tax calculation
- Reverse tax calculation
- Jurisdiction-based tax rates
- Tax rate caching
- Item-specific tax classes
"""

from decimal import Decimal

import pytest

from dotmac.platform.billing.tax.calculator import (
    TaxCalculationResult,
    TaxCalculator,
    TaxRate,
)


@pytest.mark.unit
class TestTaxRateModel:
    """Test TaxRate Pydantic model."""

    def test_tax_rate_minimal(self):
        """Test TaxRate with minimal required fields."""
        rate = TaxRate(
            name="VAT",
            rate=Decimal("20.0"),
            jurisdiction="UK",
        )

        assert rate.name == "VAT"
        assert rate.rate == Decimal("20.0")
        assert rate.jurisdiction == "UK"
        assert rate.tax_type == "sales"
        assert rate.is_compound is False
        assert rate.is_inclusive is False
        assert rate.threshold_amount is None

    def test_tax_rate_full(self):
        """Test TaxRate with all fields."""
        rate = TaxRate(
            name="Provincial Sales Tax",
            rate=Decimal("7.0"),
            jurisdiction="BC",
            tax_type="provincial",
            is_compound=True,
            is_inclusive=False,
            threshold_amount=10000,
        )

        assert rate.name == "Provincial Sales Tax"
        assert rate.is_compound is True
        assert rate.threshold_amount == 10000

    def test_tax_rate_validation_negative_rate(self):
        """Test validation rejects negative rates."""
        with pytest.raises(ValueError):
            TaxRate(
                name="Invalid",
                rate=Decimal("-5.0"),
                jurisdiction="US",
            )

    def test_tax_rate_validation_rate_too_high(self):
        """Test validation rejects rates above 100%."""
        with pytest.raises(ValueError):
            TaxRate(
                name="Invalid",
                rate=Decimal("105.0"),
                jurisdiction="US",
            )


class TestTaxCalculationResultModel:
    """Test TaxCalculationResult model."""

    def test_tax_result_creation(self):
        """Test creating a tax calculation result."""
        result = TaxCalculationResult(
            subtotal=10000,
            tax_amount=2000,
            total_amount=12000,
            tax_breakdown=[{"name": "VAT", "rate": 20.0, "amount": 2000}],
        )

        assert result.subtotal == 10000
        assert result.tax_amount == 2000
        assert result.total_amount == 12000
        assert len(result.tax_breakdown) == 1


class TestTaxCalculatorInitialization:
    """Test TaxCalculator initialization."""

    def test_init_no_rates(self):
        """Test initializing calculator without default rates."""
        calc = TaxCalculator()

        assert calc.default_rates == []
        assert calc._rate_cache == {}

    def test_init_with_default_rates(self):
        """Test initializing calculator with default rates."""
        rates = [
            TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK"),
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA"),
        ]

        calc = TaxCalculator(default_rates=rates)

        assert len(calc.default_rates) == 2
        assert calc.default_rates[0].name == "VAT"


class TestExclusiveTaxCalculation:
    """Test exclusive tax calculation (tax added to price)."""

    def test_calculate_exclusive_tax_single_rate(self):
        """Test simple exclusive tax calculation."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=10000,
            jurisdiction="UK",
            tax_rates=[rate],
            is_tax_inclusive=False,
        )

        assert result.subtotal == 10000
        assert result.tax_amount == 2000  # 20% of 10000
        assert result.total_amount == 12000
        assert len(result.tax_breakdown) == 1
        assert result.tax_breakdown[0]["name"] == "VAT"

    def test_calculate_exclusive_tax_multiple_rates(self):
        """Test exclusive tax with multiple rates."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA"),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA"),
        ]
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=10000,
            jurisdiction="CA",
            tax_rates=rates,
            is_tax_inclusive=False,
        )

        assert result.subtotal == 10000
        assert result.tax_amount == 1200  # 5% + 7% = 12%
        assert result.total_amount == 11200

    def test_calculate_exclusive_tax_compound_rate(self):
        """Test exclusive tax with compound rate."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA", is_compound=False),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA", is_compound=True),
        ]
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=10000,
            jurisdiction="CA",
            tax_rates=rates,
            is_tax_inclusive=False,
        )

        # GST: 10000 * 5% = 500
        # PST (compound): (10000 + 500) * 7% = 735
        # Total tax: 500 + 735 = 1235
        assert result.subtotal == 10000
        assert result.tax_amount == 1235
        assert result.total_amount == 11235

    def test_calculate_exclusive_tax_with_threshold(self):
        """Test exclusive tax with minimum threshold."""
        rate = TaxRate(
            name="Luxury Tax",
            rate=Decimal("10.0"),
            jurisdiction="US",
            threshold_amount=20000,
        )
        calc = TaxCalculator()

        # Below threshold - no tax
        result = calc.calculate_tax(
            amount=15000,
            jurisdiction="US",
            tax_rates=[rate],
            is_tax_inclusive=False,
        )

        assert result.tax_amount == 0
        assert result.total_amount == 15000

        # Above threshold - tax applied
        result = calc.calculate_tax(
            amount=25000,
            jurisdiction="US",
            tax_rates=[rate],
            is_tax_inclusive=False,
        )

        assert result.tax_amount == 2500  # 10% of 25000
        assert result.total_amount == 27500


class TestInclusiveTaxCalculation:
    """Test inclusive tax calculation (tax included in price)."""

    def test_calculate_inclusive_tax_single_rate(self):
        """Test inclusive tax calculation."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=12000,
            jurisdiction="UK",
            tax_rates=[rate],
            is_tax_inclusive=True,
        )

        # With 20% tax inclusive: 12000 / 1.20 = 10000 subtotal
        assert result.subtotal == 10000
        assert result.tax_amount == 2000
        assert result.total_amount == 12000

    def test_calculate_inclusive_tax_multiple_rates(self):
        """Test inclusive tax with multiple rates."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA"),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA"),
        ]
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=11200,
            jurisdiction="CA",
            tax_rates=rates,
            is_tax_inclusive=True,
        )

        # With 12% tax inclusive: 11200 / 1.12 = 10000 subtotal
        assert result.subtotal == 10000
        assert result.tax_amount == 1200
        assert result.total_amount == 11200

    def test_calculate_inclusive_tax_compound_rate(self):
        """Test inclusive tax with compound rate."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA", is_compound=False),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA", is_compound=True),
        ]
        calc = TaxCalculator()

        result = calc.calculate_tax(
            amount=11235,
            jurisdiction="CA",
            tax_rates=rates,
            is_tax_inclusive=True,
        )

        # Just verify the calculation completes and total matches input
        assert result.total_amount == 11235
        assert result.subtotal > 0
        assert result.tax_amount > 0

    def test_reverse_calculate_tax(self):
        """Test reverse tax calculation."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        result = calc.reverse_calculate_tax(
            total_amount=12000,
            jurisdiction="UK",
            tax_rates=[rate],
        )

        assert result.subtotal == 10000
        assert result.tax_amount == 2000
        assert result.total_amount == 12000


class TestLineItemTaxCalculation:
    """Test tax calculation for multiple line items."""

    def test_calculate_line_item_tax_all_taxable(self):
        """Test line item tax with all taxable items."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        line_items = [
            {"item_id": "1", "amount": 5000, "description": "Item 1"},
            {"item_id": "2", "amount": 3000, "description": "Item 2"},
        ]

        total_tax, items_with_tax = calc.calculate_line_item_tax(
            line_items=line_items,
            jurisdiction="UK",
            tax_rates=[rate],
        )

        assert total_tax == 1600  # (5000 + 3000) * 20% = 1600
        assert len(items_with_tax) == 2
        assert items_with_tax[0]["tax_amount"] == 1000
        assert items_with_tax[1]["tax_amount"] == 600

    def test_calculate_line_item_tax_with_exempt(self):
        """Test line item tax with tax-exempt items."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        line_items = [
            {"item_id": "1", "amount": 5000, "is_tax_exempt": False},
            {"item_id": "2", "amount": 3000, "is_tax_exempt": True},  # Tax exempt
        ]

        total_tax, items_with_tax = calc.calculate_line_item_tax(
            line_items=line_items,
            jurisdiction="UK",
            tax_rates=[rate],
        )

        assert total_tax == 1000  # Only item 1 taxed
        assert items_with_tax[0]["tax_amount"] == 1000
        assert items_with_tax[1]["tax_amount"] == 0
        assert items_with_tax[1]["tax_rate"] == 0

    def test_calculate_line_item_tax_with_tax_classes(self):
        """Test line item tax with different tax classes."""
        rates = [
            TaxRate(name="Standard VAT", rate=Decimal("20.0"), jurisdiction="UK"),
            TaxRate(name="Reduced VAT", rate=Decimal("5.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator()

        line_items = [
            {"item_id": "1", "amount": 10000, "tax_class": "standard"},
            {"item_id": "2", "amount": 5000, "tax_class": "reduced"},
            {"item_id": "3", "amount": 3000, "tax_class": "zero"},
        ]

        total_tax, items_with_tax = calc.calculate_line_item_tax(
            line_items=line_items,
            jurisdiction="UK",
            tax_rates=rates,
        )

        # Standard item: 10000 * 20% = 2000
        # Reduced item: 5000 * 5% = 250
        # Zero-rated item: 0
        assert items_with_tax[0]["tax_amount"] > 0  # Standard
        assert items_with_tax[2]["tax_amount"] == 0  # Zero-rated


class TestJurisdictionRates:
    """Test jurisdiction-based tax rate lookups."""

    def test_get_rates_for_jurisdiction(self):
        """Test getting rates for specific jurisdiction."""
        rates = [
            TaxRate(name="UK VAT", rate=Decimal("20.0"), jurisdiction="UK"),
            TaxRate(name="CA GST", rate=Decimal("5.0"), jurisdiction="CA"),
        ]
        calc = TaxCalculator(default_rates=rates)

        uk_rates = calc._get_rates_for_jurisdiction("UK")

        assert len(uk_rates) == 1
        assert uk_rates[0].name == "UK VAT"

    def test_get_rates_with_wildcard_jurisdiction(self):
        """Test wildcard jurisdiction matches all."""
        rates = [
            TaxRate(name="Global Tax", rate=Decimal("1.0"), jurisdiction="*"),
            TaxRate(name="UK VAT", rate=Decimal("20.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator(default_rates=rates)

        uk_rates = calc._get_rates_for_jurisdiction("UK")

        assert len(uk_rates) == 2  # Both wildcard and UK-specific

    def test_rate_caching(self):
        """Test jurisdiction rates are cached."""
        rates = [
            TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator(default_rates=rates)

        # First call
        uk_rates_1 = calc._get_rates_for_jurisdiction("UK")

        # Check cache
        assert "UK" in calc._rate_cache

        # Second call should use cache
        uk_rates_2 = calc._get_rates_for_jurisdiction("UK")

        assert uk_rates_1 is uk_rates_2  # Same object from cache

    def test_calculate_tax_uses_default_rates(self):
        """Test calculate_tax uses default rates when none provided."""
        rates = [
            TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator(default_rates=rates)

        result = calc.calculate_tax(
            amount=10000,
            jurisdiction="UK",
        )

        assert result.tax_amount == 2000


class TestTaxRateManagement:
    """Test adding and managing tax rates."""

    def test_add_tax_rate(self):
        """Test adding a new tax rate."""
        calc = TaxCalculator()

        calc.add_tax_rate(
            jurisdiction="FR",
            name="French VAT",
            rate=20.0,
            tax_type="vat",
        )

        assert len(calc.default_rates) == 1
        assert calc.default_rates[0].name == "French VAT"
        assert calc.default_rates[0].rate == Decimal("20.0")

    def test_add_tax_rate_clears_cache(self):
        """Test adding a rate clears the cache for that jurisdiction."""
        calc = TaxCalculator()

        # Add initial rate and cache it
        calc.add_tax_rate(jurisdiction="DE", name="German VAT", rate=19.0)
        calc._get_rates_for_jurisdiction("DE")
        assert "DE" in calc._rate_cache

        # Add another rate for same jurisdiction
        calc.add_tax_rate(jurisdiction="DE", name="Solidarity Tax", rate=5.5)

        # Cache should be cleared
        assert "DE" not in calc._rate_cache

    def test_get_effective_rate_single(self):
        """Test getting effective rate for single tax."""
        rate = TaxRate(name="VAT", rate=Decimal("20.0"), jurisdiction="UK")
        calc = TaxCalculator()

        effective = calc.get_effective_rate("UK", tax_rates=[rate])

        assert effective == Decimal("20.0")

    def test_get_effective_rate_multiple(self):
        """Test getting effective rate for multiple taxes."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA"),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA"),
        ]
        calc = TaxCalculator()

        effective = calc.get_effective_rate("CA", tax_rates=rates)

        assert effective == Decimal("12.0")  # 5% + 7%

    def test_get_effective_rate_compound(self):
        """Test getting effective rate with compound tax."""
        rates = [
            TaxRate(name="GST", rate=Decimal("5.0"), jurisdiction="CA", is_compound=False),
            TaxRate(name="PST", rate=Decimal("7.0"), jurisdiction="CA", is_compound=True),
        ]
        calc = TaxCalculator()

        effective = calc.get_effective_rate("CA", tax_rates=rates)

        # With compound: 5% then PST compounds on that
        # Result: 5 * (1 + 7/100) = 5.35
        assert effective > Decimal("5.0")
        assert effective < Decimal("6.0")

    def test_get_effective_rate_no_rates(self):
        """Test effective rate with no rates returns zero."""
        calc = TaxCalculator()

        effective = calc.get_effective_rate("XX", tax_rates=[])

        assert effective == Decimal("0")


class TestItemTaxClasses:
    """Test item-specific tax class handling."""

    def test_get_item_tax_rates_standard(self):
        """Test getting rates for standard tax class."""
        rates = [
            TaxRate(name="Standard VAT", rate=Decimal("20.0"), jurisdiction="UK"),
            TaxRate(name="Reduced VAT", rate=Decimal("5.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator()

        item = {"tax_class": "standard"}
        item_rates = calc._get_item_tax_rates(item, rates)

        assert len(item_rates) == 2  # All rates apply

    def test_get_item_tax_rates_reduced(self):
        """Test getting rates for reduced tax class."""
        rates = [
            TaxRate(name="Standard VAT", rate=Decimal("20.0"), jurisdiction="UK"),
            TaxRate(name="Reduced VAT", rate=Decimal("5.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator()

        item = {"tax_class": "reduced"}
        item_rates = calc._get_item_tax_rates(item, rates)

        assert len(item_rates) == 1
        assert "reduced" in item_rates[0].name.lower()

    def test_get_item_tax_rates_zero(self):
        """Test getting rates for zero-rated items."""
        rates = [
            TaxRate(name="Standard VAT", rate=Decimal("20.0"), jurisdiction="UK"),
        ]
        calc = TaxCalculator()

        item = {"tax_class": "zero"}
        item_rates = calc._get_item_tax_rates(item, rates)

        assert len(item_rates) == 0  # No tax for zero-rated


class TestRoundingBehavior:
    """Test tax amount rounding."""

    def test_round_amount_round_up(self):
        """Test rounding up at 0.5."""
        calc = TaxCalculator()

        result = calc._round_amount(Decimal("10.5"))

        assert result == 11

    def test_round_amount_round_down(self):
        """Test rounding down below 0.5."""
        calc = TaxCalculator()

        result = calc._round_amount(Decimal("10.4"))

        assert result == 10

    def test_tax_calculation_with_rounding(self):
        """Test tax calculation properly rounds."""
        rate = TaxRate(name="VAT", rate=Decimal("20.5"), jurisdiction="UK")
        calc = TaxCalculator()

        # 10000 * 20.5% = 2050
        result = calc.calculate_tax(
            amount=10000,
            jurisdiction="UK",
            tax_rates=[rate],
        )

        assert isinstance(result.tax_amount, int)
        assert result.tax_amount == 2050
