"""
Tax calculation logic
"""

import logging
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


class TaxRate(BaseModel):
    """Tax rate configuration"""

    model_config = ConfigDict()

    name: str = Field(..., description="Tax name (e.g., VAT, GST, Sales Tax)")
    rate: Decimal = Field(..., ge=0, le=100, description="Tax rate percentage")
    jurisdiction: str = Field(..., description="Tax jurisdiction (country/state)")
    tax_type: str = Field("sales", description="Type of tax")
    is_compound: bool = Field(False, description="Whether tax compounds on other taxes")
    is_inclusive: bool = Field(False, description="Whether prices include tax")
    threshold_amount: int | None = Field(None, description="Minimum amount for tax to apply")


class TaxCalculationResult(BaseModel):
    """Result of tax calculation"""

    model_config = ConfigDict()

    subtotal: int = Field(..., description="Subtotal amount in minor units")
    tax_amount: int = Field(..., description="Total tax amount in minor units")
    total_amount: int = Field(..., description="Total including tax in minor units")
    tax_breakdown: list[dict[str, Any]] = Field(
        default_factory=list, description="Breakdown of individual taxes applied"
    )


class TaxCalculator:
    """Tax calculation engine"""

    def __init__(self, default_rates: list[TaxRate] | None = None) -> None:
        """Initialize tax calculator with default rates"""
        self.default_rates = default_rates or []
        self._rate_cache: dict[str, list[TaxRate]] = {}

    def calculate_tax(
        self,
        amount: int,
        jurisdiction: str,
        tax_rates: list[TaxRate] | None = None,
        is_tax_inclusive: bool = False,
    ) -> TaxCalculationResult:
        """Calculate tax for a given amount and jurisdiction"""

        # Use provided rates or lookup rates for jurisdiction
        rates = tax_rates or self._get_rates_for_jurisdiction(jurisdiction)

        if is_tax_inclusive:
            return self._calculate_inclusive_tax(amount, rates)
        else:
            return self._calculate_exclusive_tax(amount, rates)

    def _calculate_exclusive_tax(self, amount: int, rates: list[TaxRate]) -> TaxCalculationResult:
        """Calculate tax when prices don't include tax"""

        subtotal = amount
        total_tax = 0
        tax_breakdown = []

        # Sort rates: non-compound first, then compound
        sorted_rates = sorted(rates, key=lambda r: r.is_compound)

        for rate in sorted_rates:
            # Check if threshold is met
            if rate.threshold_amount and amount < rate.threshold_amount:
                continue

            # Calculate tax base (subtotal + previous taxes if compound)
            tax_base = subtotal + total_tax if rate.is_compound else subtotal

            # Calculate tax amount
            tax_amount = self._round_amount(Decimal(tax_base) * (rate.rate / 100))

            total_tax += tax_amount
            tax_breakdown.append(
                {
                    "name": rate.name,
                    "rate": float(rate.rate),
                    "amount": tax_amount,
                    "jurisdiction": rate.jurisdiction,
                    "is_compound": rate.is_compound,
                }
            )

        return TaxCalculationResult(
            subtotal=subtotal,
            tax_amount=total_tax,
            total_amount=subtotal + total_tax,
            tax_breakdown=tax_breakdown,
        )

    def _calculate_inclusive_tax(self, amount: int, rates: list[TaxRate]) -> TaxCalculationResult:
        """Calculate tax when prices include tax"""

        # For inclusive tax, work backwards from total
        total_amount = amount

        # Calculate combined tax rate
        combined_rate = Decimal(0)
        for rate in rates:
            if not rate.is_compound:
                combined_rate += rate.rate
            else:
                # Compound rates multiply
                combined_rate = combined_rate * (1 + rate.rate / 100)

        # Calculate subtotal
        divisor = 1 + (combined_rate / 100)
        subtotal = self._round_amount(Decimal(total_amount) / divisor)

        # Calculate tax amount
        tax_amount = total_amount - subtotal

        # Calculate breakdown
        tax_breakdown = []
        remaining_tax = tax_amount

        for i, rate in enumerate(rates):
            if i == len(rates) - 1:
                # Last tax gets Any rounding difference
                rate_tax = remaining_tax
            else:
                rate_tax = self._round_amount(Decimal(subtotal) * (rate.rate / 100))
                remaining_tax -= rate_tax

            tax_breakdown.append(
                {
                    "name": rate.name,
                    "rate": float(rate.rate),
                    "amount": rate_tax,
                    "jurisdiction": rate.jurisdiction,
                    "is_compound": rate.is_compound,
                }
            )

        return TaxCalculationResult(
            subtotal=subtotal,
            tax_amount=tax_amount,
            total_amount=total_amount,
            tax_breakdown=tax_breakdown,
        )

    def calculate_line_item_tax(
        self,
        line_items: list[dict[str, Any]],
        jurisdiction: str,
        tax_rates: list[TaxRate] | None = None,
    ) -> tuple[int, list[dict[str, Any]]]:
        """Calculate tax for multiple line items"""

        rates = tax_rates or self._get_rates_for_jurisdiction(jurisdiction)
        total_tax = 0
        items_with_tax = []

        for item in line_items:
            # Skip non-taxable items
            if item.get("is_tax_exempt", False):
                items_with_tax.append(
                    {
                        **item,
                        "tax_amount": 0,
                        "tax_rate": 0,
                    }
                )
                continue

            # Get item-specific rates if Any
            item_rates = self._get_item_tax_rates(item, rates)

            # Calculate tax for this item
            result = self.calculate_tax(
                amount=item["amount"],
                jurisdiction=jurisdiction,
                tax_rates=item_rates,
            )

            total_tax += result.tax_amount
            items_with_tax.append(
                {
                    **item,
                    "tax_amount": result.tax_amount,
                    "tax_breakdown": result.tax_breakdown,
                }
            )

        return total_tax, items_with_tax

    def reverse_calculate_tax(
        self,
        total_amount: int,
        jurisdiction: str,
        tax_rates: list[TaxRate] | None = None,
    ) -> TaxCalculationResult:
        """Reverse calculate tax from a total amount (extract tax from inclusive price)"""

        rates = tax_rates or self._get_rates_for_jurisdiction(jurisdiction)
        return self._calculate_inclusive_tax(total_amount, rates)

    def _get_rates_for_jurisdiction(self, jurisdiction: str) -> list[TaxRate]:
        """Get tax rates for a specific jurisdiction"""

        # Check cache first
        if jurisdiction in self._rate_cache:
            return self._rate_cache[jurisdiction]

        # Filter default rates by jurisdiction
        rates = [
            rate
            for rate in self.default_rates
            if rate.jurisdiction == jurisdiction or rate.jurisdiction == "*"
        ]

        # Cache the result
        self._rate_cache[jurisdiction] = rates
        return rates

    def _get_item_tax_rates(
        self, item: dict[str, Any], available_rates: list[TaxRate]
    ) -> list[TaxRate]:
        """Get applicable tax rates for a specific item"""

        # Check for item-specific tax class
        tax_class = item.get("tax_class", "standard")

        # Filter rates based on tax class or product type
        if tax_class == "reduced":
            # Apply reduced rates if available
            return [r for r in available_rates if "reduced" in r.name.lower()]
        elif tax_class == "zero":
            return []  # No tax
        else:
            # Standard rates
            return available_rates

    def _round_amount(self, amount: Decimal) -> int:
        """Round decimal amount to nearest integer (minor currency unit)"""
        return int(amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP))

    def add_tax_rate(self, jurisdiction: str, name: str, rate: float, **kwargs: Any) -> None:
        """Add a new tax rate configuration"""

        tax_rate = TaxRate(name=name, rate=Decimal(str(rate)), jurisdiction=jurisdiction, **kwargs)

        self.default_rates.append(tax_rate)
        # Clear cache for this jurisdiction
        self._rate_cache.pop(jurisdiction, None)

    def get_effective_rate(
        self,
        jurisdiction: str,
        tax_rates: list[TaxRate] | None = None,
    ) -> Decimal:
        """Get the effective tax rate for a jurisdiction"""

        rates = tax_rates or self._get_rates_for_jurisdiction(jurisdiction)

        if not rates:
            return Decimal(0)

        # Calculate effective rate
        effective_rate = Decimal(0)
        for rate in rates:
            if not rate.is_compound:
                effective_rate += rate.rate
            else:
                effective_rate = effective_rate * (1 + rate.rate / 100)

        return effective_rate
