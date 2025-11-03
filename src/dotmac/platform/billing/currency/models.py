"""
Currency exchange rate persistence models.
"""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base, TimestampMixin


class ExchangeRate(Base, TimestampMixin):  # type: ignore[misc]  # Mixin has type Any
    """Historical exchange rate information."""

    __tablename__ = "billing_exchange_rates"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid4()),
    )

    base_currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    target_currency: Mapped[str] = mapped_column(String(3), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    rate: Mapped[Decimal] = mapped_column(Numeric(18, 9), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    effective_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    __table_args__ = (
        UniqueConstraint(
            "base_currency",
            "target_currency",
            "provider",
            "effective_at",
            name="uq_exchange_rate_effective",
        ),
    )
