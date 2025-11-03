from decimal import Decimal

import pytest
from sqlalchemy import select

from dotmac.platform.billing.currency.models import ExchangeRate
from dotmac.platform.billing.currency.service import CurrencyRateService
from dotmac.platform.billing.money_utils import money_handler
from dotmac.platform.integrations import IntegrationStatus
from dotmac.platform.settings import settings

pytestmark = pytest.mark.integration


class DummyCurrencyIntegration:
    def __init__(self, rates: dict[str, float]) -> None:
        self._rates = rates
        self.status = IntegrationStatus.READY
        self.provider = "dummy"

    async def fetch_rates(
        self, base_currency: str, target_currencies: list[str]
    ) -> dict[str, float]:
        return {currency: self._rates[currency] for currency in target_currencies}


@pytest.mark.asyncio
async def test_currency_rate_service_converts_and_persists(async_db_session, monkeypatch):
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")
    monkeypatch.setattr(settings.billing, "supported_currencies", ["USD", "EUR"])

    integration = DummyCurrencyIntegration({"EUR": 0.9})

    async def fake_get_integration(name: str):
        assert name == "currency"
        return integration

    monkeypatch.setattr(
        "dotmac.platform.billing.currency.service.get_integration_async",
        fake_get_integration,
    )

    service = CurrencyRateService(async_db_session)
    money = money_handler.create_money("100", "USD")

    converted = await service.convert_money(money, "EUR")

    assert converted.currency.code == "EUR"
    assert converted.amount == Decimal("90")

    result = await async_db_session.execute(select(ExchangeRate))
    rates = result.scalars().all()
    assert any(rate.base_currency == "USD" and rate.target_currency == "EUR" for rate in rates)

    cached_rate = await service.get_rate("USD", "EUR")
    assert cached_rate == Decimal("0.9")


@pytest.mark.asyncio
async def test_currency_rate_service_force_refresh(async_db_session, monkeypatch):
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")
    monkeypatch.setattr(settings.billing, "supported_currencies", ["USD", "EUR"])

    integration = DummyCurrencyIntegration({"EUR": 0.9})

    async def fake_get_integration(name: str):
        return integration

    monkeypatch.setattr(
        "dotmac.platform.billing.currency.service.get_integration_async",
        fake_get_integration,
    )

    service = CurrencyRateService(async_db_session)
    rate_initial = await service.get_rate("USD", "EUR")
    assert rate_initial == Decimal("0.9")

    # Update integration rates but without force_refresh cache should remain
    integration._rates["EUR"] = 0.8
    cached_rate = await service.get_rate("USD", "EUR")
    assert cached_rate == Decimal("0.9")

    refreshed_rate = await service.get_rate("USD", "EUR", force_refresh=True)
    assert refreshed_rate == Decimal("0.8")


@pytest.mark.asyncio
async def test_refresh_rates_skips_invalid_values(async_db_session, monkeypatch):
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")
    monkeypatch.setattr(settings.billing, "supported_currencies", ["USD", "EUR"])

    integration = DummyCurrencyIntegration({"EUR": 0.0})

    async def fake_get_integration(name: str):
        return integration

    monkeypatch.setattr(
        "dotmac.platform.billing.currency.service.get_integration_async",
        fake_get_integration,
    )

    service = CurrencyRateService(async_db_session)

    with pytest.raises(RuntimeError, match="Exchange rate not available"):
        await service.get_rate("USD", "EUR")

    result = await async_db_session.execute(select(ExchangeRate))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_refresh_rates_skips_inverse_when_precision_exceeded(async_db_session, monkeypatch):
    monkeypatch.setattr(settings.billing, "enable_multi_currency", True)
    monkeypatch.setattr(settings.billing, "default_currency", "USD")
    monkeypatch.setattr(settings.billing, "supported_currencies", ["USD", "VND"])

    integration = DummyCurrencyIntegration({"VND": 1e-9})

    async def fake_get_integration(name: str):
        return integration

    monkeypatch.setattr(
        "dotmac.platform.billing.currency.service.get_integration_async",
        fake_get_integration,
    )

    service = CurrencyRateService(async_db_session)
    await service.refresh_rates(base_currency="USD", target_currencies=["VND"])

    result = await async_db_session.execute(select(ExchangeRate))
    records = result.scalars().all()
    assert any(rate.base_currency == "USD" and rate.target_currency == "VND" for rate in records)
    assert not any(
        rate.base_currency == "VND" and rate.target_currency == "USD" for rate in records
    )
