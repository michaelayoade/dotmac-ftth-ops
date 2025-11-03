"""
Dunning & Collections Management Models.

Provides automated dunning workflows for past-due accounts,
including email/SMS reminders and service suspension automation.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import AuditMixin, Base, TenantMixin, TimestampMixin


class DunningActionType(str, Enum):
    """Types of dunning actions."""

    EMAIL = "email"
    SMS = "sms"
    SUSPEND_SERVICE = "suspend_service"
    TERMINATE_SERVICE = "terminate_service"
    WEBHOOK = "webhook"
    CUSTOM = "custom"


class DunningExecutionStatus(str, Enum):
    """Status of dunning execution."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class DunningCampaign(Base, TimestampMixin, TenantMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Dunning campaign configuration defining automated collection workflows.

    Campaigns define trigger conditions and a sequence of escalating actions
    to recover past-due payments.
    """

    __tablename__ = "dunning_campaigns"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # Campaign details
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="Campaign name",
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trigger conditions
    trigger_after_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Days past due before triggering campaign",
    )

    # Retry configuration
    max_retries: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        comment="Maximum number of retry attempts",
    )
    retry_interval_days: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=3,
        comment="Days between retry attempts",
    )

    # Action sequence (JSON array)
    actions: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="Ordered list of actions to execute",
    )
    # Example structure:
    # [
    #   {
    #     "type": "email",
    #     "template": "payment_reminder_1",
    #     "delay_days": 0
    #   },
    #   {
    #     "type": "sms",
    #     "template": "payment_alert",
    #     "delay_days": 3
    #   },
    #   {
    #     "type": "suspend_service",
    #     "delay_days": 7
    #   }
    # ]

    # Exclusion rules (JSON)
    exclusion_rules: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="Rules to exclude certain subscriptions",
    )
    # Example: {"min_lifetime_value": 1000, "customer_tiers": ["premium"]}

    # Status
    is_active: Mapped[bool] = mapped_column(
        default=True,
        nullable=False,
        comment="Whether campaign is active",
    )

    # Priority (higher = runs first)
    priority: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Campaign priority (higher runs first)",
    )

    # Statistics
    total_executions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total number of executions",
    )
    successful_executions: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of successful collections",
    )
    total_recovered_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total amount recovered (cents)",
    )

    # Relationships
    executions: Mapped[list["DunningExecution"]] = relationship(
        "DunningExecution",
        back_populates="campaign",
        lazy="dynamic",
    )

    __table_args__ = (
        Index("ix_dunning_campaigns_tenant_active", "tenant_id", "is_active"),
        Index("ix_dunning_campaigns_tenant_priority", "tenant_id", "priority"),
    )


class DunningExecution(Base, TimestampMixin, TenantMixin, AuditMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Individual execution of a dunning campaign for a specific subscription.

    Tracks the progress through the campaign action sequence and records
    outcomes of each action.
    """

    __tablename__ = "dunning_executions"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # References
    campaign_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("dunning_campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subscription_id: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
        comment="Billing subscription ID",
    )
    customer_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invoice_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Past-due invoice ID",
    )

    # Execution details
    status: Mapped[DunningExecutionStatus] = mapped_column(
        SQLEnum(DunningExecutionStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=DunningExecutionStatus.PENDING,
        index=True,
    )

    # Progress tracking
    current_step: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Current action step (0-indexed)",
    )
    total_steps: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total number of steps in campaign",
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of retry attempts",
    )

    # Timing
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    next_action_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="Scheduled time for next action",
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Amount details (stored in cents)
    outstanding_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Outstanding amount in cents",
    )
    recovered_amount: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Recovered amount in cents",
    )

    # Execution log (JSON array)
    execution_log: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON,
        nullable=False,
        default=list,
        comment="Detailed log of each action execution",
    )
    # Example entry:
    # {
    #   "step": 0,
    #   "action_type": "email",
    #   "executed_at": "2025-10-14T12:00:00Z",
    #   "status": "success",
    #   "details": {"template": "payment_reminder_1", "sent_to": "customer@example.com"}
    # }

    # Cancellation details
    canceled_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    canceled_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        nullable=False,
        default=dict,
    )

    # Relationships
    campaign: Mapped[DunningCampaign] = relationship(
        "DunningCampaign",
        back_populates="executions",
    )

    __table_args__ = (
        Index("ix_dunning_executions_tenant_status", "tenant_id", "status"),
        Index("ix_dunning_executions_next_action", "next_action_at"),
        Index("ix_dunning_executions_subscription", "subscription_id", "status"),
    )


class DunningActionLog(Base, TimestampMixin, TenantMixin):  # type: ignore[misc]  # Mixin has type Any
    """
    Detailed log of individual dunning actions executed.

    Provides audit trail and debugging information for each action.
    """

    __tablename__ = "dunning_action_logs"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
    )

    # References
    execution_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("dunning_executions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Action details
    action_type: Mapped[DunningActionType] = mapped_column(
        SQLEnum(DunningActionType),
        nullable=False,
        # Note: Index removed here - composite index defined in __table_args__ instead
    )
    action_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="Action configuration from campaign",
    )

    # Execution details
    step_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Step number in campaign sequence",
    )
    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="success, failed, skipped",
    )

    # Result details
    result: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=dict,
        comment="Detailed execution result",
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # External references
    external_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="External system reference (e.g., email ID, webhook ID)",
    )

    __table_args__ = (
        Index("ix_dunning_action_logs_execution", "execution_id", "step_number"),
        Index("ix_dunning_action_logs_action_type", "action_type", "status"),
    )


__all__ = [
    "DunningCampaign",
    "DunningExecution",
    "DunningActionLog",
    "DunningActionType",
    "DunningExecutionStatus",
]
