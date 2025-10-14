"""
Unit tests covering currency normalization branches in InvoiceService.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from moneyed import Money

from dotmac.platform.billing.invoicing.service import InvoiceService
from dotmac.platform.settings import settings


class DummyRateService:
    """Test double that simulates currency conversion without external calls."""

    def __init__(self, _session) -> None:
        self._session = _session

    async def convert_money(  # noqa: D401 - simple double
        self,
        money: Money,
        target_currency: str,
        *,
        force_refresh: bool = False,
    ) -> Money:
        # Doubles the amount to make assertions deterministic.
        return Money(amount=money.amount * Decimal("2"), currency=target_currency)

    async def get_rate(
        self,
        base_currency: str,
        target_currency: str,
        *,
        force_refresh: bool = False,
    ) -> Decimal:
        return Decimal("2")


@pytest.mark.asyncio
async def test_normalize_currency_disabled(invoice_service: InvoiceService, monkeypatch) -> None:
    """When multi-currency support is disabled, normalization is skipped."""
    monkeypatch.setattr(settings.billing, "enable_multi_currency", False)

    result = await invoice_service._normalize_currency_components(
        "EUR",
        {"subtotal": 1000, "total_amount": 1000},
    )

    assert result is None


@pytest.mark.asyncio
async def test_normalize_currency_same_as_default(invoice_service: InvoiceService, monkeypatch) -> None:
    """If the invoice currency already matches default currency, no normalization occurs."""
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")

    result = await invoice_service._normalize_currency_components(
        "usd",  # lower-case to ensure comparison uses upper()
        {"total_amount": 2500},
    )

    assert result is None


@pytest.mark.asyncio
async def test_normalize_currency_converts_components(invoice_service: InvoiceService, monkeypatch) -> None:
    """Currency conversion details are returned when normalization runs successfully."""
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")
    monkeypatch.setattr(
        "dotmac.platform.billing.invoicing.service.CurrencyRateService",
        DummyRateService,
    )

    amounts = {
        "subtotal": 1000,
        "tax_amount": 200,
        "discount_amount": 50,
        "total_amount": 1150,
    }

    conversion_details, normalized_total, normalized_currency = (
        await invoice_service._normalize_currency_components("EUR", amounts)
    )

    assert normalized_currency == "USD"
    assert normalized_total == 2300  # doubled total

    total_component = conversion_details["components"]["total_amount"]
    assert total_component["original_minor_units"] == 1150
    assert total_component["converted_minor_units"] == 2300
    assert Decimal(total_component["converted_amount"]) == Decimal("23")  # 11.5 doubled

