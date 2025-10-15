"""
Subscriber Management Models for ISP Operations.

Represents RADIUS subscribers, service subscriptions, and network assignments.
A Subscriber is the network-level representation of a service connection,
which may be linked to a Customer (billing entity) but tracks different concerns.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
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
from dotmac.platform.radius.models import INET  # Cross-database INET type
from dotmac.platform.services.lifecycle.models import ServiceType

if TYPE_CHECKING:
    pass


class SubscriberStatus(str, Enum):
    """Subscriber service status."""

    PENDING = "pending"  # Awaiting activation
    ACTIVE = "active"  # Service active
    SUSPENDED = "suspended"  # Temporarily suspended (e.g., non-payment)
    DISCONNECTED = "disconnected"  # Administratively disconnected
    TERMINATED = "terminated"  # Service terminated
    QUARANTINED = "quarantined"  # Limited access (security/policy)


class Subscriber(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):
    """
    Network Subscriber Model.

    Represents a RADIUS subscriber with service profile, credentials,
    and network assignments. This is the core entity for ISP operations.

    Key Concepts:
    - A Customer (billing) may have multiple Subscribers (services/connections)
    - Each Subscriber has unique RADIUS credentials
    - Subscribers are linked to network devices (ONU, CPE)
    - Service lifecycle is tracked independently from Customer account
    """

    __tablename__ = "subscribers"

    # Primary identifier
    id: Mapped[str] = mapped_column(
        String(255),
        primary_key=True,
        default=lambda: str(uuid4()),
        nullable=False,
        comment="Subscriber UUID as string for RADIUS FK compatibility",
    )

    # Link to Customer (billing entity)
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to billing customer record",
    )

    # Optional: Link directly to portal User account
    # This allows a user to manage their subscriber from the portal
    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to portal user account (optional, for self-service)",
    )

    # Subscriber Identification
    username: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
        comment="RADIUS username (unique per tenant)",
    )
    password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="RADIUS password (hashed or cleartext depending on NAS)",
    )
    subscriber_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="Human-readable subscriber ID",
    )

    # Service Status
    status: Mapped[SubscriberStatus] = mapped_column(
        SQLEnum(SubscriberStatus),
        default=SubscriberStatus.PENDING,
        nullable=False,
        index=True,
    )
    service_type: Mapped[ServiceType] = mapped_column(
        SQLEnum(ServiceType),
        default=ServiceType.FIBER_INTERNET,
        nullable=False,
        index=True,
    )

    # Service Details
    bandwidth_profile_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("radius_bandwidth_profiles.id", ondelete="SET NULL"),
        nullable=True,
        comment="Link to bandwidth/QoS profile",
    )
    download_speed_kbps: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Current download speed in Kbps",
    )
    upload_speed_kbps: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Current upload speed in Kbps",
    )

    # Network Assignments
    static_ipv4: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Static IPv4 address if assigned",
    )
    ipv6_prefix: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        comment="IPv6 prefix delegation",
    )
    vlan_id: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="VLAN assignment",
    )
    nas_identifier: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        index=True,
        comment="NAS device serving this subscriber",
    )

    # Device Assignments
    onu_serial: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
        index=True,
        comment="ONU serial number (GPON/XGS-PON)",
    )
    cpe_mac_address: Mapped[str | None] = mapped_column(
        String(17),
        nullable=True,
        index=True,
        comment="CPE MAC address (for TR-069)",
    )
    device_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="Additional device info: {olt_id, pon_port, onu_id, etc}",
    )

    # Service Location
    service_address: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
        comment="Full service address",
    )
    service_coordinates: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False,
        comment="GPS coordinates: {lat: float, lon: float}",
    )
    site_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Network site/POP identifier",
    )

    # Service Dates
    activation_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Service activation date",
    )
    suspension_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Date service was suspended",
    )
    termination_date: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Service termination date",
    )

    # Session Limits
    session_timeout: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Max session duration in seconds (RADIUS attribute)",
    )
    idle_timeout: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="Idle timeout in seconds (RADIUS attribute)",
    )
    simultaneous_use: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
        comment="Max concurrent sessions allowed",
    )

    # Usage Tracking
    last_online: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last seen online (from RADIUS accounting)",
    )
    total_sessions: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Total number of sessions",
    )
    total_upload_bytes: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Lifetime upload bytes",
    )
    total_download_bytes: Mapped[int] = mapped_column(
        default=0,
        nullable=False,
        comment="Lifetime download bytes",
    )

    # External System References
    netbox_ip_id: Mapped[int | None] = mapped_column(
        nullable=True,
        comment="NetBox IP Address object ID",
    )
    voltha_onu_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="VOLTHA ONU device ID",
    )
    genieacs_device_id: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="GenieACS device ID (usually MAC or serial)",
    )

    # Custom Fields
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
        comment="Additional metadata",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal notes",
    )

    # Relationships
    customer = relationship("Customer", foreign_keys=[customer_id], lazy="joined")
    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    bandwidth_profile = relationship(
        "RadiusBandwidthProfile",
        foreign_keys=[bandwidth_profile_id],
        lazy="joined",
    )
    radius_checks = relationship("RadCheck", back_populates="subscriber", lazy="dynamic")
    radius_replies = relationship("RadReply", back_populates="subscriber", lazy="dynamic")
    radius_sessions = relationship("RadAcct", back_populates="subscriber", lazy="dynamic")

    # Indexes and constraints
    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_subscriber_tenant_username"),
        UniqueConstraint("tenant_id", "subscriber_number", name="uq_subscriber_tenant_number"),
        Index("ix_subscriber_status", "tenant_id", "status"),
        Index("ix_subscriber_service_type", "tenant_id", "service_type"),
        Index("ix_subscriber_customer", "customer_id"),
        Index("ix_subscriber_nas", "nas_identifier"),
        Index("ix_subscriber_onu", "onu_serial"),
        Index("ix_subscriber_cpe", "cpe_mac_address"),
        Index("ix_subscriber_site", "site_id"),
    )

    def __repr__(self) -> str:
        return f"<Subscriber(id={self.id}, username={self.username}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if subscriber service is currently active."""
        return self.status == SubscriberStatus.ACTIVE

    @property
    def total_bytes(self) -> int:
        """Total data transferred (upload + download)."""
        return self.total_upload_bytes + self.total_download_bytes

    @property
    def display_name(self) -> str:
        """Get display name for subscriber."""
        if self.subscriber_number:
            return f"{self.username} ({self.subscriber_number})"
        return self.username
