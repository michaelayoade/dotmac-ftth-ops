"""
Monitoring data models.

Currently provides persistence for alert channel configuration so that
alert routing survives process restarts and can be shared across data centres.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import BaseModel


class MonitoringAlertChannel(BaseModel):  # type: ignore[misc]
    """
    Stored configuration for alert routing channels.

    We store the full channel payload (as JSON) so the webhook router can
    reconstruct the Pydantic `AlertChannel` definition verbatim.
    """

    __tablename__ = "monitoring_alert_channels"

    id: Mapped[str] = mapped_column(String(120), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    channel_type: Mapped[str] = mapped_column(String(32), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tenant_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    config: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)

    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


__all__ = ["MonitoringAlertChannel"]
