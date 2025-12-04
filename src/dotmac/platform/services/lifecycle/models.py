"""
Service Lifecycle Models.

Comprehensive service instance lifecycle management for ISP operations including
provisioning, activation, suspension, and termination workflows.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, TypeVar
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModel
else:
    BaseModel = Base


class ServiceType(str, Enum):
    """Types of services that can be managed."""

    # Internet Services
    FIBER_INTERNET = "fiber_internet"
    DSL_INTERNET = "dsl_internet"
    CABLE_INTERNET = "cable_internet"
    WIRELESS_INTERNET = "wireless_internet"
    SATELLITE_INTERNET = "satellite_internet"

    # Voice Services
    VOIP = "voip"
    PSTN = "pstn"
    MOBILE = "mobile"

    # TV/IPTV Services
    IPTV = "iptv"
    CABLE_TV = "cable_tv"

    # Value-Added Services
    STATIC_IP = "static_ip"
    EMAIL_HOSTING = "email_hosting"
    CLOUD_STORAGE = "cloud_storage"
    MANAGED_WIFI = "managed_wifi"
    NETWORK_SECURITY = "network_security"

    # Bundle Services
    TRIPLE_PLAY = "triple_play"  # Internet + Voice + TV
    DOUBLE_PLAY = "double_play"  # Any two services
    CUSTOM_BUNDLE = "custom_bundle"


class ServiceStatus(str, Enum):
    """Service instance lifecycle status."""

    # Initial States
    PENDING = "pending"  # Order received, not yet provisioned
    PROVISIONING = "provisioning"  # Being provisioned
    PROVISIONING_FAILED = "provisioning_failed"  # Provisioning failed

    # Active States
    ACTIVE = "active"  # Service is active and running
    SUSPENDED = "suspended"  # Temporarily suspended (non-payment, customer request)
    SUSPENDED_NON_PAYMENT = "suspended_non_payment"  # Suspended due to billing issues
    SUSPENDED_FRAUD = "suspended_fraud"  # Suspended due to fraud

    # Degraded States
    DEGRADED = "degraded"  # Service running but with issues
    MAINTENANCE = "maintenance"  # Under maintenance

    # Termination States
    TERMINATING = "terminating"  # Being terminated
    TERMINATED = "terminated"  # Service terminated
    FAILED = "failed"  # Service in failed state


class ProvisioningStatus(str, Enum):
    """Detailed provisioning workflow status."""

    PENDING = "pending"
    VALIDATING = "validating"
    ALLOCATING_RESOURCES = "allocating_resources"
    CONFIGURING_EQUIPMENT = "configuring_equipment"
    ACTIVATING_SERVICE = "activating_service"
    TESTING = "testing"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class LifecycleEventType(str, Enum):
    """Types of lifecycle events."""

    # Provisioning Events
    PROVISION_REQUESTED = "provision_requested"
    PROVISION_STARTED = "provision_started"
    PROVISION_COMPLETED = "provision_completed"
    PROVISION_FAILED = "provision_failed"

    # Activation Events
    ACTIVATION_REQUESTED = "activation_requested"
    ACTIVATION_COMPLETED = "activation_completed"
    ACTIVATION_FAILED = "activation_failed"

    # Modification Events
    MODIFICATION_REQUESTED = "modification_requested"
    MODIFICATION_COMPLETED = "modification_completed"
    MODIFICATION_FAILED = "modification_failed"

    # Suspension Events
    SUSPENSION_REQUESTED = "suspension_requested"
    SUSPENSION_COMPLETED = "suspension_completed"
    SUSPENSION_FAILED = "suspension_failed"

    # Resumption Events
    RESUMPTION_REQUESTED = "resumption_requested"
    RESUMPTION_COMPLETED = "resumption_completed"
    RESUMPTION_FAILED = "resumption_failed"

    # Termination Events
    TERMINATION_REQUESTED = "termination_requested"
    TERMINATION_STARTED = "termination_started"
    TERMINATION_COMPLETED = "termination_completed"
    TERMINATION_FAILED = "termination_failed"

    # Status Events
    STATUS_CHANGED = "status_changed"
    HEALTH_CHECK_COMPLETED = "health_check_completed"
    MAINTENANCE_STARTED = "maintenance_started"
    MAINTENANCE_COMPLETED = "maintenance_completed"

    # Error Events
    ERROR_DETECTED = "error_detected"
    ERROR_RESOLVED = "error_resolved"


EnumT = TypeVar("EnumT", bound=Enum)


def _enum[EnumT: Enum](enum_cls: type[EnumT], *, name: str) -> SQLEnum:
    """Create SQLAlchemy Enum that persists Enum values instead of names."""
    return SQLEnum(
        enum_cls,
        name=name,
        values_callable=lambda members: [member.value for member in members],
    )


class ServiceInstance(BaseModel, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):
    """
    Service instance representing a provisioned service for a customer.

    This model tracks the complete lifecycle of a service from provisioning
    through activation, suspension, and termination.
    """

    __tablename__ = "service_instances"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Service identification
    service_identifier: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique service identifier (e.g., SVC-12345)",
    )

    service_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable service name",
    )

    service_type: Mapped[ServiceType] = mapped_column(
        _enum(ServiceType, name="servicetype"),
        nullable=False,
        index=True,
        comment="Type of service",
    )

    # Relationships
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Customer who owns this service",
    )

    subscription_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Related billing subscription ID",
    )

    plan_id: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Service plan/product ID",
    )

    # Service Status
    status: Mapped[ServiceStatus] = mapped_column(
        _enum(ServiceStatus, name="servicestatus"),
        default=ServiceStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current service status",
    )

    provisioning_status: Mapped[ProvisioningStatus | None] = mapped_column(
        _enum(ProvisioningStatus, name="provisioningstatus"),
        nullable=True,
        comment="Detailed provisioning workflow status",
    )

    # Service Lifecycle Dates
    ordered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        comment="When service was ordered",
    )

    provisioning_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When provisioning started",
    )

    provisioned_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When service was successfully provisioned",
    )

    activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When service was activated",
    )

    suspended_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When service was suspended",
    )

    terminated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
        comment="When service was terminated",
    )

    # Service Configuration
    service_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Service-specific configuration (bandwidth, static IP, etc.)",
    )

    # Installation/Service Location
    installation_address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Service installation address",
    )

    installation_scheduled_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Scheduled installation date",
    )

    installation_completed_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Actual installation completion date",
    )

    installation_technician_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="Technician assigned to installation",
    )

    # Network Configuration
    equipment_assigned: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of equipment IDs assigned (ONT, router, STB, etc.)",
    )

    ip_address: Mapped[str | None] = mapped_column(
        String(45),
        nullable=True,
        comment="Assigned IP address (IPv4 or IPv6)",
    )

    mac_address: Mapped[str | None] = mapped_column(
        String(17),
        nullable=True,
        comment="MAC address of customer equipment",
    )

    vlan_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="VLAN ID for network segmentation",
    )

    # Integration Identifiers
    external_service_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="External system service ID (RADIUS, BSS, etc.)",
    )

    network_element_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Network element identifier (OLT, DSLAM, etc.)",
    )

    # Suspension Information
    suspension_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for service suspension",
    )

    auto_resume_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Scheduled automatic resumption date",
    )

    # Termination Information
    termination_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for service termination",
    )

    termination_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Type of termination (customer_request, non_payment, churn, etc.)",
    )

    # Health and Monitoring
    last_health_check_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last health check timestamp",
    )

    health_status: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Current health status (healthy, degraded, unhealthy)",
    )

    uptime_percentage: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Service uptime percentage (last 30 days)",
    )

    # Workflow Tracking
    workflow_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Current or last workflow execution ID",
    )

    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of retry attempts for failed operations",
    )

    max_retries: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False,
        comment="Maximum retry attempts before marking as failed",
    )

    # Notifications
    notification_sent: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether customer notification has been sent",
    )

    # Flexible metadata (renamed from 'metadata' to avoid SQLAlchemy reserved name conflict)
    service_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",  # Database column name
        JSON,
        default=dict,
        nullable=False,
        comment="Additional service metadata",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal notes about the service",
    )

    # Relationships (to be defined in related models)
    # lifecycle_events: Mapped[list["LifecycleEvent"]] = relationship(
    #     back_populates="service_instance", cascade="all, delete-orphan"
    # )

    __table_args__ = (
        Index("ix_service_tenant_customer", "tenant_id", "customer_id"),
        Index("ix_service_tenant_status", "tenant_id", "status"),
        Index("ix_service_tenant_type", "tenant_id", "service_type"),
        Index("ix_service_subscription", "subscription_id"),
        Index("ix_service_provisioning_status", "provisioning_status"),
        Index(
            "ix_service_installation_scheduled",
            "tenant_id",
            "installation_scheduled_date",
        ),
        Index("ix_service_health_check", "last_health_check_at"),
    )


class LifecycleEvent(BaseModel, TimestampMixin, TenantMixin):
    """
    Lifecycle event tracking for service instances.

    Provides complete audit trail of all lifecycle operations including
    provisioning, activation, suspension, resumption, and termination.
    """

    __tablename__ = "lifecycle_events"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Relationships
    service_instance_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Related service instance",
    )

    # Event Information
    event_type: Mapped[LifecycleEventType] = mapped_column(
        _enum(LifecycleEventType, name="lifecycleeventtype"),
        nullable=False,
        index=True,
        comment="Type of lifecycle event",
    )

    event_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        index=True,
        comment="When the event occurred",
    )

    # Previous and New States
    previous_status: Mapped[ServiceStatus | None] = mapped_column(
        _enum(ServiceStatus, name="servicestatus"),
        nullable=True,
        comment="Service status before this event",
    )

    new_status: Mapped[ServiceStatus | None] = mapped_column(
        _enum(ServiceStatus, name="servicestatus"),
        nullable=True,
        comment="Service status after this event",
    )

    # Event Details
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Human-readable event description",
    )

    # Success/Failure Tracking
    success: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether the operation succeeded",
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Error message if operation failed",
    )

    error_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="Error code for categorization",
    )

    # Workflow Tracking
    workflow_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Workflow execution ID",
    )

    task_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Celery task ID",
    )

    # Duration Tracking
    duration_seconds: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Duration of operation in seconds",
    )

    # User/System Information
    triggered_by_user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        comment="User who triggered the event",
    )

    triggered_by_system: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="System that triggered the event (api, scheduler, webhook, etc.)",
    )

    # Event-specific data
    event_data: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Event-specific additional data",
    )

    # External Integration
    external_system_response: Mapped[dict[str, Any] | None] = mapped_column(
        JSON,
        nullable=True,
        comment="Response from external systems (RADIUS, provisioning system)",
    )

    # Relationships
    service_instance: Mapped["ServiceInstance"] = relationship(
        "ServiceInstance",
        foreign_keys=[service_instance_id],
    )

    __table_args__ = (
        Index("ix_lifecycle_service_tenant", "tenant_id", "service_instance_id"),
        Index("ix_lifecycle_event_type", "event_type"),
        Index("ix_lifecycle_timestamp", "event_timestamp"),
        Index("ix_lifecycle_success", "success"),
        Index("ix_lifecycle_workflow", "workflow_id"),
    )


class ProvisioningWorkflow(BaseModel, TimestampMixin, TenantMixin):
    """
    Tracks multi-step provisioning workflows.

    Manages complex provisioning processes with multiple steps, dependencies,
    and rollback capabilities.
    """

    __tablename__ = "provisioning_workflows"

    # Primary identifier
    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Workflow identification
    workflow_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Unique workflow identifier",
    )

    workflow_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Type of workflow (provision, terminate, modify, etc.)",
    )

    # Relationships
    service_instance_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("service_instances.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Related service instance",
    )

    # Workflow Status
    status: Mapped[ProvisioningStatus] = mapped_column(
        _enum(ProvisioningStatus, name="provisioningstatus"),
        default=ProvisioningStatus.PENDING,
        nullable=False,
        index=True,
        comment="Current workflow status",
    )

    # Steps Tracking
    total_steps: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        comment="Total number of steps in workflow",
    )

    current_step: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Current step being executed (0-indexed)",
    )

    completed_steps: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of completed step names",
    )

    failed_steps: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="List of failed step names",
    )

    # Workflow Execution
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When workflow started",
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="When workflow completed",
    )

    # Error Handling
    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Number of retry attempts",
    )

    last_error: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Last error message",
    )

    # Rollback Support
    rollback_required: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether rollback is required",
    )

    rollback_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether rollback has been completed",
    )

    # Workflow Configuration
    workflow_config: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Workflow-specific configuration",
    )

    # Step Results
    step_results: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Results from each workflow step",
    )

    # Relationships
    service_instance: Mapped["ServiceInstance"] = relationship(
        "ServiceInstance",
        foreign_keys=[service_instance_id],
    )

    __table_args__ = (
        Index("ix_workflow_tenant_service", "tenant_id", "service_instance_id"),
        Index("ix_workflow_status", "status"),
        Index("ix_workflow_type", "workflow_type"),
    )
