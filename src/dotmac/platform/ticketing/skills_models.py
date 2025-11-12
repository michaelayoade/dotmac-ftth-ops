"""Agent skills matrix models for intelligent ticket routing."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.database import Base


class AgentSkill(Base):
    """Track skills and expertise for support agents."""

    __tablename__ = "agent_skills"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True)
    tenant_id: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    skill_category: Mapped[str] = mapped_column(
        String(100), index=True, comment="e.g., 'network', 'billing', 'technical'"
    )
    skill_level: Mapped[int] = mapped_column(
        Integer, default=1, comment="1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert"
    )
    can_handle_escalations: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )

    def __repr__(self) -> str:
        """String representation."""
        return f"<AgentSkill(user_id={self.user_id}, category={self.skill_category}, level={self.skill_level})>"


__all__ = ["AgentSkill"]
