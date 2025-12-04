"""
Push Notification Models
Database models for push notification subscriptions
"""

from datetime import datetime
from uuid import UUID as UUIDType
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from dotmac.platform.db import Base


class PushSubscription(Base):
    """Push notification subscription"""

    __tablename__ = "push_subscriptions"

    id: Mapped[UUIDType] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)

    # Subscription details
    endpoint: Mapped[str] = mapped_column(String, nullable=False)
    p256dh: Mapped[str] = mapped_column(String, nullable=False)  # Encryption key
    auth: Mapped[str] = mapped_column(String, nullable=False)  # Auth secret
    expiration_time: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Status
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    __table_args__ = (
        Index("idx_push_subscriptions_user_active", "user_id", "active"),
        Index("idx_push_subscriptions_tenant_active", "tenant_id", "active"),
        Index("idx_push_subscriptions_endpoint", "endpoint"),
    )

    def __repr__(self) -> str:
        return f"<PushSubscription(user_id={self.user_id}, active={self.active})>"
