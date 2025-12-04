"""Agent availability tracking models."""

from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.database import Base


class AgentStatus(str, enum.Enum):
    """Agent availability status."""

    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"
    AWAY = "away"


class AgentAvailability(Base):
    """Track real-time availability status for support agents."""

    __tablename__ = "agent_availability"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True, unique=True)
    tenant_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    status: Mapped[AgentStatus] = mapped_column(
        Enum(AgentStatus), default=AgentStatus.AVAILABLE, index=True
    )
    status_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<AgentAvailability(user_id={self.user_id}, status={self.status})>"


__all__ = ["AgentAvailability", "AgentStatus"]
