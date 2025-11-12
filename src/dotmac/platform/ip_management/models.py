"""
IP Management models for static IP allocation and reservation.

Provides IP pool management, reservation tracking, conflict detection,
and NetBox synchronization for ISP subscriber IP assignments.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    GUID,
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)
from dotmac.platform.db.types import JSONBCompat
from dotmac.platform.radius.models import INET

if TYPE_CHECKING:
    from dotmac.platform.subscribers.models import Subscriber


class IPPoolType(str, Enum):
    """Type of IP address pool."""

    IPV4_PUBLIC = "ipv4_public"
    IPV4_PRIVATE = "ipv4_private"
    IPV6_GLOBAL = "ipv6_global"
    IPV6_ULA = "ipv6_ula"
    IPV6_PREFIX_DELEGATION = "ipv6_pd"


class IPPoolStatus(str, Enum):
    """Status of IP pool."""

    ACTIVE = "active"
    RESERVED = "reserved"
    DEPLETED = "depleted"
    MAINTENANCE = "maintenance"


class IPReservationStatus(str, Enum):
    """Status of IP reservation."""

    RESERVED = "reserved"
    ASSIGNED = "assigned"
    RELEASED = "released"
    EXPIRED = "expired"


class IPPool(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    IP address pool for static IP allocation.

    Manages ranges of IP addresses that can be assigned to subscribers.
    Supports IPv4 and IPv6, including prefix delegation pools.
    """

    __tablename__ = "ip_pools"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "pool_name",
            name="uq_ip_pool_tenant_name",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid4,
        nullable=False,
        comment="Primary identifier for the IP pool",
    )

    pool_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Human-readable pool name",
    )

    pool_type: Mapped[IPPoolType] = mapped_column(
        SQLEnum(IPPoolType, name="ippooltype"),
        nullable=False,
        comment="Type of IP addresses in this pool",
    )

    network_cidr: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        comment="Network CIDR (e.g., 203.0.113.0/24 or 2001:db8::/32)",
    )

    gateway: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Gateway IP address for this pool",
    )

    dns_servers: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Comma-separated DNS server IPs",
    )

    vlan_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Associated VLAN ID",
    )

    status: Mapped[IPPoolStatus] = mapped_column(
        SQLEnum(IPPoolStatus, name="ippoolstatus"),
        nullable=False,
        default=IPPoolStatus.ACTIVE,
        comment="Current status of the pool",
    )

    total_addresses: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Total usable addresses in pool",
    )

    reserved_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of reserved addresses",
    )

    assigned_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="Number of assigned addresses",
    )

    # NetBox integration
    netbox_prefix_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="NetBox prefix ID for sync",
    )

    netbox_synced_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="Last sync with NetBox",
    )

    # Pool settings
    auto_assign_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Enable automatic assignment from this pool",
    )

    allow_manual_reservation: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="Allow operators to manually reserve IPs",
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Pool description and usage notes",
    )

    # Relationships
    reservations: Mapped[list[IPReservation]] = relationship(
        "IPReservation",
        back_populates="pool",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<IPPool id={self.id} name={self.pool_name} "
            f"type={self.pool_type} network={self.network_cidr}>"
        )


class IPReservation(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):  # type: ignore[misc]
    """
    IP address reservation for subscribers.

    Tracks individual IP assignments with conflict detection and lifecycle management.
    """

    __tablename__ = "ip_reservations"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "ip_address",
            name="uq_ip_reservation_tenant_ip",
        ),
        UniqueConstraint(
            "tenant_id",
            "subscriber_id",
            "ip_type",
            name="uq_ip_reservation_subscriber_type",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid4,
        nullable=False,
        comment="Primary identifier for the reservation",
    )

    pool_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("ip_pools.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
        comment="Associated IP pool",
    )

    subscriber_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("subscribers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Subscriber this IP is reserved for",
    )

    ip_address: Mapped[str] = mapped_column(
        INET,
        nullable=False,
        index=True,
        comment="Reserved IP address",
    )

    ip_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="Type: ipv4, ipv6, or ipv6_prefix",
    )

    prefix_length: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Prefix length for IPv6 delegations",
    )

    status: Mapped[IPReservationStatus] = mapped_column(
        SQLEnum(IPReservationStatus, name="ipreservationstatus"),
        nullable=False,
        default=IPReservationStatus.RESERVED,
        comment="Current reservation status",
    )

    reserved_at: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        comment="When the IP was reserved",
    )

    assigned_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was assigned to subscriber",
    )

    released_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was released",
    )

    expires_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="Expiration time for temporary reservations",
    )

    # NetBox integration
    netbox_ip_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="NetBox IP address ID",
    )

    netbox_synced: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Whether synced to NetBox",
    )

    # Assignment details
    assigned_by: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="User who assigned this IP",
    )

    assignment_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Reason for assignment",
    )

    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Additional notes",
    )

    # IPv4 Lifecycle Management (Phase 5)
    lifecycle_state: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        index=True,
        comment="Current lifecycle state (pending/allocated/active/suspended/revoking/revoked/failed)",
    )

    lifecycle_allocated_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was allocated (lifecycle tracking)",
    )

    lifecycle_activated_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was activated (lifecycle tracking)",
    )

    lifecycle_suspended_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was suspended (lifecycle tracking)",
    )

    lifecycle_revoked_at: Mapped[datetime | None] = mapped_column(
        nullable=True,
        comment="When the IP was revoked (lifecycle tracking)",
    )

    lifecycle_metadata: Mapped[dict[str, Any] | None] = mapped_column(
        JSONBCompat,
        nullable=True,
        default=dict,
        comment="Additional lifecycle metadata (NetBox sync, CoA results, etc.)",
    )

    # Relationships
    pool: Mapped[IPPool] = relationship(
        "IPPool",
        back_populates="reservations",
    )

    subscriber: Mapped[Subscriber] = relationship(
        "Subscriber",
        foreign_keys=[subscriber_id],
        back_populates="ip_reservations",
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<IPReservation id={self.id} ip={self.ip_address} "
            f"subscriber={self.subscriber_id} status={self.status} "
            f"lifecycle_state={self.lifecycle_state}>"
        )
