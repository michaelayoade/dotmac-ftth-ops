"""
Network data models for subscriber-specific provisioning metadata.

Tracks DHCP Option 82 bindings, VLAN assignments, and static IP data so
provisioning/radius services can enforce per-subscriber policies.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
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
from dotmac.platform.radius.models import INET

if TYPE_CHECKING:
    from dotmac.platform.subscribers.models import Subscriber


class Option82Policy(str, Enum):
    """Determines how DHCP Option 82 metadata should be handled."""

    ENFORCE = "enforce"  # Block sessions when metadata does not match expected binding
    LOG = "log"  # Allow session but emit audit/log entries
    IGNORE = "ignore"  # Do not evaluate Option 82 metadata


class IPv6AssignmentMode(str, Enum):
    """IPv6 allocation strategies for a subscriber."""

    NONE = "none"
    SLAAC = "slaac"
    STATEFUL = "stateful"
    PD = "pd"
    DUAL_STACK = "dual_stack"


class IPv6LifecycleState(str, Enum):
    """IPv6 prefix lifecycle states for tracking allocation through revocation."""

    PENDING = "pending"  # Requested but not yet allocated from NetBox
    ALLOCATED = "allocated"  # Allocated from NetBox but not yet provisioned via RADIUS
    ACTIVE = "active"  # Provisioned via RADIUS and actively in use
    SUSPENDED = "suspended"  # Service suspended, prefix reserved but not advertised
    REVOKING = "revoking"  # Revocation in progress (CoA/DM sent, awaiting cleanup)
    REVOKED = "revoked"  # Released back to NetBox pool
    FAILED = "failed"  # Allocation or provisioning failed


class SubscriberNetworkProfile(  # type: ignore[misc]
    Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin
):
    """
    Stores subscriber-specific network metadata.

    Includes DHCP Option 82 bindings, VLAN/QinQ details, and static IP
    assignments that must remain consistent across RADIUS, NetBox, and OLTs.
    """

    __tablename__ = "subscriber_network_profiles"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "subscriber_id",
            name="uq_subscriber_network_profile_tenant_subscriber",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid4,
        nullable=False,
        comment="Primary identifier for the network profile",
    )

    subscriber_id: Mapped[str] = mapped_column(
        String(255),
        ForeignKey("subscribers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="Linked subscriber ID",
    )

    circuit_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="DHCP Option 82 circuit-id binding",
    )
    remote_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="DHCP Option 82 remote-id binding",
    )

    service_vlan: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Primary service VLAN (S-VLAN)",
    )
    inner_vlan: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Inner VLAN (C-VLAN) when QinQ is enabled",
    )
    vlan_pool: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Named VLAN pool or policy identifier",
    )
    qinq_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="Indicates whether QinQ tagging is required",
    )

    static_ipv4: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Assigned static IPv4 address",
    )
    static_ipv6: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Assigned static IPv6 address",
    )
    delegated_ipv6_prefix: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        comment="Delegated IPv6 prefix (CIDR notation)",
    )
    ipv6_pd_size: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        comment="Prefix delegation size (e.g., /56 -> 56)",
    )
    ipv6_assignment_mode: Mapped[IPv6AssignmentMode] = mapped_column(
        SQLEnum(IPv6AssignmentMode, name="ipv6assignmentmode"),
        nullable=False,
        default=IPv6AssignmentMode.NONE,
        comment="How IPv6 should be delivered to this subscriber",
    )

    # IPv6 Lifecycle Tracking (Phase 4)
    ipv6_state: Mapped[IPv6LifecycleState] = mapped_column(
        SQLEnum(IPv6LifecycleState, name="ipv6lifecyclestate"),
        nullable=False,
        default=IPv6LifecycleState.PENDING,
        comment="Current lifecycle state of IPv6 prefix allocation",
    )
    ipv6_allocated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was allocated from NetBox",
    )
    ipv6_activated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was provisioned via RADIUS",
    )
    ipv6_revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Timestamp when IPv6 prefix was revoked and returned to pool",
    )
    ipv6_netbox_prefix_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        index=True,
        comment="NetBox prefix ID for tracking lifecycle in IPAM",
    )

    option82_policy: Mapped[Option82Policy] = mapped_column(
        SQLEnum(Option82Policy, name="option82policy"),
        nullable=False,
        default=Option82Policy.LOG,
        comment="Handling strategy for DHCP Option 82 metadata",
    )

    metadata_: Mapped[dict[str, object]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
        comment="Additional vendor-specific metadata",
    )

    subscriber: Mapped[Subscriber] = relationship(
        "Subscriber",
        back_populates="network_profile",
        lazy="joined",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug utility
        return (
            f"<SubscriberNetworkProfile id={self.id} subscriber={self.subscriber_id} "
            f"vlan={self.service_vlan} option82={self.option82_policy}>"
        )
