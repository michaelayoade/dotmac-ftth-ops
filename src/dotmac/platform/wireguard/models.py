"""
WireGuard VPN Database Models.

Models for WireGuard VPN servers, peers, and configurations.
"""

from datetime import datetime
from enum import Enum as PyEnum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import INET, UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
)


class WireGuardServerStatus(str, PyEnum):
    """WireGuard server status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"


class WireGuardPeerStatus(str, PyEnum):
    """WireGuard peer status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    DISABLED = "disabled"
    EXPIRED = "expired"


class WireGuardServer(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):
    """
    WireGuard VPN Server Model.

    Represents a WireGuard VPN server endpoint that customers can connect to.
    Each server has its own configuration, keys, and network settings.
    """

    __tablename__ = "wireguard_servers"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Server identification
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable server name",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Server description",
    )

    # Network configuration
    public_endpoint: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Public endpoint (hostname or IP:port)",
    )
    listen_port: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=51820,
        comment="UDP listen port",
    )
    server_ipv4: Mapped[str] = mapped_column(
        INET,
        nullable=False,
        comment="Server VPN IPv4 address (e.g., 10.8.0.1/24)",
    )
    server_ipv6: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Server VPN IPv6 address (optional)",
    )

    # WireGuard keys
    public_key: Mapped[str] = mapped_column(
        String(44),
        nullable=False,
        unique=True,
        comment="Server public key (base64, 44 chars)",
    )
    private_key_encrypted: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment="Encrypted server private key",
    )

    # Server status
    status: Mapped[WireGuardServerStatus] = mapped_column(
        SQLEnum(WireGuardServerStatus),
        default=WireGuardServerStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    # Peer allocation
    max_peers: Mapped[int] = mapped_column(
        Integer,
        default=1000,
        nullable=False,
        comment="Maximum number of peers",
    )
    current_peers: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Current number of active peers",
    )
    next_peer_ip_offset: Mapped[int] = mapped_column(
        Integer,
        default=2,
        nullable=False,
        comment="Next IP offset for peer allocation (server uses .1)",
    )

    # DNS and routing
    dns_servers: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="DNS servers for peers (e.g., ['1.1.1.1', '8.8.8.8'])",
    )
    allowed_ips: Mapped[list[str]] = mapped_column(
        JSON,
        default=lambda: ["0.0.0.0/0", "::/0"],
        nullable=False,
        comment="Default allowed IPs for peers",
    )
    persistent_keepalive: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
        default=25,
        comment="Persistent keepalive in seconds",
    )

    # Server location and metadata
    location: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Server location (e.g., 'US-East-1', 'EU-West-2')",
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
        comment="Additional server metadata",
    )

    # Traffic statistics
    total_rx_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total received bytes",
    )
    total_tx_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total transmitted bytes",
    )
    last_stats_update: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last statistics update timestamp",
    )

    # Relationships
    peers: Mapped[list["WireGuardPeer"]] = relationship(
        "WireGuardPeer",
        back_populates="server",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_wireguard_server_tenant_status", "tenant_id", "status"),
        Index("ix_wireguard_server_public_key", "public_key"),
    )

    def __repr__(self) -> str:
        return f"<WireGuardServer(id={self.id}, name={self.name}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if server is active."""
        return self.status == WireGuardServerStatus.ACTIVE

    @property
    def has_capacity(self) -> bool:
        """Check if server can accept more peers."""
        return self.current_peers < self.max_peers

    @property
    def utilization_percent(self) -> float:
        """Calculate server utilization percentage."""
        if self.max_peers == 0:
            return 0.0
        return (self.current_peers / self.max_peers) * 100


class WireGuardPeer(Base, TimestampMixin, TenantMixin, SoftDeleteMixin, AuditMixin):
    """
    WireGuard VPN Peer Model.

    Represents a VPN client (subscriber) connected to a WireGuard server.
    Each peer has unique keys and IP allocation.
    """

    __tablename__ = "wireguard_peers"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        nullable=False,
    )

    # Server relationship
    server_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("wireguard_servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Customer/Subscriber relationship
    customer_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to billing customer",
    )
    subscriber_id: Mapped[str | None] = mapped_column(
        String(255),
        ForeignKey("subscribers.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="Link to network subscriber",
    )

    # Peer identification
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Human-readable peer name",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Peer description",
    )

    # WireGuard keys
    public_key: Mapped[str] = mapped_column(
        String(44),
        nullable=False,
        unique=True,
        comment="Peer public key (base64, 44 chars)",
    )
    preshared_key_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Encrypted preshared key (optional, for extra security)",
    )

    # Network allocation
    peer_ipv4: Mapped[str] = mapped_column(
        INET,
        nullable=False,
        comment="Peer VPN IPv4 address (e.g., 10.8.0.2/32)",
    )
    peer_ipv6: Mapped[str | None] = mapped_column(
        INET,
        nullable=True,
        comment="Peer VPN IPv6 address (optional)",
    )
    allowed_ips: Mapped[list[str]] = mapped_column(
        JSON,
        default=list,
        nullable=False,
        comment="Allowed IPs for this peer (overrides server default)",
    )

    # Peer status
    status: Mapped[WireGuardPeerStatus] = mapped_column(
        SQLEnum(WireGuardPeerStatus),
        default=WireGuardPeerStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether peer is enabled",
    )

    # Connection tracking
    last_handshake: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last successful handshake timestamp",
    )
    endpoint: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        comment="Peer's current public endpoint (IP:port)",
    )

    # Traffic statistics
    rx_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total received bytes from peer",
    )
    tx_bytes: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Total transmitted bytes to peer",
    )
    last_stats_update: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Last statistics update timestamp",
    )

    # Expiration
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        comment="Peer configuration expiration (for temporary access)",
    )

    # Peer metadata
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        nullable=False,
        comment="Additional peer metadata",
    )
    notes: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Internal notes",
    )

    # Configuration file
    config_file: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        comment="Generated WireGuard config file for peer",
    )

    # Relationships
    server: Mapped["WireGuardServer"] = relationship(
        "WireGuardServer",
        back_populates="peers",
    )
    customer = relationship("Customer", foreign_keys=[customer_id])
    subscriber = relationship("Subscriber", foreign_keys=[subscriber_id])

    __table_args__ = (
        Index("ix_wireguard_peer_server", "server_id"),
        Index("ix_wireguard_peer_customer", "customer_id"),
        Index("ix_wireguard_peer_subscriber", "subscriber_id"),
        Index("ix_wireguard_peer_tenant_status", "tenant_id", "status"),
        Index("ix_wireguard_peer_public_key", "public_key"),
    )

    def __repr__(self) -> str:
        return f"<WireGuardPeer(id={self.id}, name={self.name}, status={self.status})>"

    @property
    def is_active(self) -> bool:
        """Check if peer is active and enabled."""
        return self.status == WireGuardPeerStatus.ACTIVE and self.enabled

    @property
    def is_expired(self) -> bool:
        """Check if peer has expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at.replace(tzinfo=None)

    @property
    def is_online(self) -> bool:
        """Check if peer is currently online (handshake within last 3 minutes)."""
        if not self.last_handshake:
            return False
        time_since_handshake = datetime.utcnow() - self.last_handshake.replace(tzinfo=None)
        return time_since_handshake.total_seconds() < 180  # 3 minutes

    @property
    def total_bytes(self) -> int:
        """Total data transferred (rx + tx)."""
        return self.rx_bytes + self.tx_bytes
