"""
Currency conversion service backed by persisted exchange rates.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from typing import Any

import structlog
from moneyed import Money, get_currency
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.currency.models import ExchangeRate
from dotmac.platform.billing.money_utils import money_handler
from dotmac.platform.integrations import IntegrationStatus, get_integration_async

logger = structlog.get_logger(__name__)


class CurrencyRateService:
    """Service for fetching, caching, and converting currency amounts."""

    _MAX_RATE = Decimal("999999999.999999999")
    _RATE_QUANTIZE = Decimal("0.000000001")

    def __init__(self, session: AsyncSession, cache_ttl: int = 3600) -> None:
        self.session = session
        self.cache_ttl = cache_ttl
        self._memory_cache: dict[tuple[str, str], tuple[datetime, Decimal]] = {}

    async def convert_money(
        self,
        money: Money,
        target_currency: str,
        *,
        force_refresh: bool = False,
    ) -> Money:
        """Convert a Money object to the target currency."""
        base_currency = money.currency.code.upper()
        target_currency = target_currency.upper()

        if base_currency == target_currency:
            return money

        rate = await self.get_rate(
            base_currency,
            target_currency,
            force_refresh=force_refresh,
        )

        converted_amount = money.amount * rate
        precision = money_handler.get_currency_precision(target_currency)
        rounded_amount = converted_amount.quantize(
            Decimal("1") / (Decimal(10) ** precision),
            rounding=ROUND_HALF_UP,
        )

        return Money(amount=rounded_amount, currency=get_currency(target_currency))

    async def get_rate(
        self,
        base_currency: str,
        target_currency: str,
        *,
        force_refresh: bool = False,
    ) -> Decimal:
        """Get exchange rate for the specified currency pair."""
        base_currency = base_currency.upper()
        target_currency = target_currency.upper()

        if base_currency == target_currency:
            return Decimal("1")

        cache_key = (base_currency, target_currency)
        now = datetime.now(UTC)

        # Check in-memory cache first
        if not force_refresh:
            cached = self._memory_cache.get(cache_key)
            if cached:
                fetched_at, rate = cached
                if (now - fetched_at).total_seconds() < self.cache_ttl:
                    return rate

        # Look up in database
        rate_entry = await self._get_latest_rate(base_currency, target_currency)
        if rate_entry and not force_refresh:
            if not rate_entry.expires_at or rate_entry.expires_at > now:
                rate_value: Decimal = rate_entry.rate
                self._memory_cache[cache_key] = (now, rate_value)
                return rate_value

        # Load from provider and persist
        await self.refresh_rates(base_currency=base_currency, target_currencies=[target_currency])

        rate_entry = await self._get_latest_rate(base_currency, target_currency)
        if not rate_entry:
            raise RuntimeError(f"Exchange rate not available for {base_currency}/{target_currency}")

        final_rate: Decimal = rate_entry.rate
        self._memory_cache[cache_key] = (now, final_rate)
        return final_rate

    async def refresh_rates(
        self,
        *,
        base_currency: str,
        target_currencies: Iterable[str],
        provider_name: str | None = None,
    ) -> None:
        """Refresh exchange rates for the given currencies using the configured integration."""
        base_currency = base_currency.upper()
        targets = sorted(
            {
                currency.upper()
                for currency in target_currencies
                if currency.upper() != base_currency
            }
        )

        if not targets:
            logger.debug("No target currencies specified for refresh")
            return

        integration = await get_integration_async("currency")
        if integration is None:
            raise RuntimeError("Currency integration is not configured")

        if integration.status != IntegrationStatus.READY:
            raise RuntimeError(f"Currency integration not ready: {integration.status}")

        provider = provider_name or integration.provider

        logger.debug(
            "Refreshing exchange rates",
            provider=provider,
            base_currency=base_currency,
            targets=targets,
        )

        rates = await integration.fetch_rates(base_currency, targets)
        now = datetime.now(UTC)

        updated_pairs: set[tuple[str, str]] = set()

        for target_currency, rate_value in rates.items():
            target_upper = target_currency.upper()
            try:
                rate_decimal = Decimal(str(rate_value))
            except (InvalidOperation, TypeError, ValueError):
                logger.warning(
                    "Invalid rate value from provider",
                    provider=provider,
                    base_currency=base_currency,
                    target_currency=target_upper,
                    value=rate_value,
                )
                continue

            if not rate_decimal.is_finite() or rate_decimal <= 0:
                logger.warning(
                    "Discarding non-positive or non-finite rate from provider",
                    provider=provider,
                    base_currency=base_currency,
                    target_currency=target_upper,
                    value=str(rate_decimal),
                )
                continue

            rate_decimal = rate_decimal.quantize(self._RATE_QUANTIZE, rounding=ROUND_HALF_UP)
            if rate_decimal > self._MAX_RATE:
                logger.warning(
                    "Rate exceeds supported precision; skipping",
                    provider=provider,
                    base_currency=base_currency,
                    target_currency=target_upper,
                    value=str(rate_decimal),
                )
                continue

            exchange_rate = ExchangeRate(
                base_currency=base_currency,
                target_currency=target_upper,
                provider=provider,
                rate=rate_decimal,
                fetched_at=now,
                effective_at=now,
                expires_at=now + timedelta(seconds=self.cache_ttl * 4),
                metadata_json={"provider": provider},
            )

            self.session.add(exchange_rate)
            updated_pairs.add((base_currency, target_upper))
            updated_pairs.add((target_upper, base_currency))

            inverse_rate_decimal = (Decimal("1") / rate_decimal).quantize(
                self._RATE_QUANTIZE, rounding=ROUND_HALF_UP
            )
            if (
                not inverse_rate_decimal.is_finite()
                or inverse_rate_decimal <= 0
                or inverse_rate_decimal > self._MAX_RATE
            ):
                logger.warning(
                    "Skipping inverse rate due to precision limits",
                    provider=provider,
                    base_currency=base_currency,
                    target_currency=target_upper,
                    inverse_value=str(inverse_rate_decimal),
                )
            else:
                inverse_rate = ExchangeRate(
                    base_currency=target_upper,
                    target_currency=base_currency,
                    provider=provider,
                    rate=inverse_rate_decimal,
                    fetched_at=now,
                    effective_at=now,
                    expires_at=now + timedelta(seconds=self.cache_ttl * 4),
                    metadata_json={"provider": provider, "inverse_of": base_currency},
                )
                self.session.add(inverse_rate)
                updated_pairs.add((target_upper, base_currency))

        if not updated_pairs:
            logger.debug(
                "No exchange rates persisted after validation",
                provider=provider,
                base_currency=base_currency,
                targets=targets,
            )
            return

        try:
            await self.session.commit()
        except Exception as exc:
            await self.session.rollback()
            logger.error(
                "Failed to persist exchange rates",
                provider=provider,
                base_currency=base_currency,
                targets=targets,
                error=str(exc),
            )
            raise

        # Clear in-memory cache entries for updated pairs
        for pair in updated_pairs:
            self._memory_cache.pop(pair, None)

    async def _get_latest_rate(
        self,
        base_currency: str,
        target_currency: str,
    ) -> ExchangeRate | None:
        """Retrieve the latest stored rate for a currency pair."""
        stmt = (
            select(ExchangeRate)
            .where(
                and_(
                    ExchangeRate.base_currency == base_currency,
                    ExchangeRate.target_currency == target_currency,
                )
            )
            .order_by(ExchangeRate.effective_at.desc())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()


async def convert_amount(
    session: AsyncSession,
    amount: Decimal,
    base_currency: str,
    target_currency: str,
) -> Decimal:
    """Utility helper to convert a decimal amount between currencies."""
    service = CurrencyRateService(session)
    money = money_handler.create_money(str(amount), currency=base_currency)
    converted = await service.convert_money(money, target_currency)
    return converted.amount


def sync_refresh_currency_rates(
    base_currency: str,
    target_currencies: Iterable[str],
) -> dict[str, Any]:
    """
    Helper used by Celery task to refresh rates in a synchronous context.
    """

    from dotmac.platform.db import AsyncSessionLocal

    async def _refresh() -> dict[str, Any]:
        async with AsyncSessionLocal() as session:
            service = CurrencyRateService(session)
            await service.refresh_rates(
                base_currency=base_currency,
                target_currencies=target_currencies,
            )
        return {"base_currency": base_currency, "targets": list(target_currencies)}

    return asyncio.run(_refresh())
