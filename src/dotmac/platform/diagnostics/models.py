"""
Diagnostics Models.

Models for network diagnostics and troubleshooting.
"""

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ENUM as SQLEnum
from sqlalchemy.dialects.postgresql import JSON, TIMESTAMP
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import AuditMixin, Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class DiagnosticType(str, Enum):
    """Types of diagnostic checks."""

    # Connectivity checks
    CONNECTIVITY_CHECK = "connectivity_check"
    PING_TEST = "ping_test"
    TRACEROUTE = "traceroute"

    # Service-specific checks
    RADIUS_SESSION = "radius_session"
    ONU_STATUS = "onu_status"
    CPE_STATUS = "cpe_status"
    IP_VERIFICATION = "ip_verification"

    # Performance tests
    BANDWIDTH_TEST = "bandwidth_test"
    LATENCY_TEST = "latency_test"
    PACKET_LOSS_TEST = "packet_loss_test"

    # Device operations
    CPE_RESTART = "cpe_restart"
    ONU_REBOOT = "onu_reboot"

    # Comprehensive checks
    HEALTH_CHECK = "health_check"
    SERVICE_PATH_TRACE = "service_path_trace"


class DiagnosticStatus(str, Enum):
    """Status of diagnostic run."""

    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


class DiagnosticSeverity(str, Enum):
    """Severity of diagnostic findings."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class DiagnosticRun(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """Diagnostic run tracking."""

    __tablename__ = "diagnostic_runs"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, nullable=False
    )
    tenant_id: Mapped[str] = mapped_column(
        String(255), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Diagnostic info
    diagnostic_type: Mapped[DiagnosticType] = mapped_column(
        SQLEnum(DiagnosticType, name="diagnostictype"), nullable=False, index=True
    )
    status: Mapped[DiagnosticStatus] = mapped_column(
        SQLEnum(DiagnosticStatus, name="diagnosticstatus"),
        nullable=False,
        default=DiagnosticStatus.PENDING,
        index=True,
    )
    severity: Mapped[DiagnosticSeverity | None] = mapped_column(
        SQLEnum(DiagnosticSeverity, name="diagnosticseverity"), nullable=True
    )

    # Target entity
    subscriber_id: Mapped[str | None] = mapped_column(
        String(255), ForeignKey("subscribers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Execution details
    started_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Results
    success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Detailed results (JSON)
    results: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    recommendations: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )

    # Additional metadata (renamed to avoid SQLAlchemy reserved name)
    diagnostic_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSON, nullable=False, default=dict
    )

    # Timestamps (from TimestampMixin)
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

    # Soft delete (from SoftDeleteMixin)
    deleted_at: Mapped[datetime | None]

    # Audit (from AuditMixin)
    created_by_id: Mapped[UUID | None]
    updated_by_id: Mapped[UUID | None]

    # Relationships
    subscriber = relationship("Subscriber", foreign_keys=[subscriber_id], lazy="select")
    customer = relationship("Customer", foreign_keys=[customer_id], lazy="select")

    def __repr__(self) -> str:
        """String representation."""
        return f"<DiagnosticRun(id={self.id}, type={self.diagnostic_type}, status={self.status})>"
