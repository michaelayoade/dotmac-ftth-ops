"""
WireGuard VPN Pydantic Schemas.

Request/response schemas for WireGuard API endpoints.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from dotmac.platform.wireguard.models import WireGuardPeerStatus, WireGuardServerStatus

# ========================================================================
# Server Schemas
# ========================================================================


class WireGuardServerCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a WireGuard server."""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=255, description="Server name")
    description: str | None = Field(None, description="Server description")
    public_endpoint: str = Field(
        ...,
        description="Public endpoint (hostname:port or IP:port)",
        examples=["vpn.example.com:51820", "203.0.113.1:51820"],
    )
    listen_port: int = Field(
        51820,
        ge=1,
        le=65535,
        description="UDP listen port",
    )
    server_ipv4: str = Field(
        ...,
        description="Server VPN IPv4 address (CIDR notation)",
        examples=["10.8.0.1/24", "10.200.0.1/16"],
    )
    server_ipv6: str | None = Field(
        None,
        description="Server VPN IPv6 address (CIDR notation)",
        examples=["fd00::1/64"],
    )
    location: str | None = Field(
        None,
        max_length=255,
        description="Server location",
        examples=["US-East-1", "EU-West-2", "AP-Southeast-1"],
    )
    max_peers: int = Field(
        1000,
        ge=1,
        le=10000,
        description="Maximum number of peers",
    )
    dns_servers: list[str] = Field(
        default_factory=lambda: ["1.1.1.1", "1.0.0.1"],
        description="DNS servers for peers",
    )
    allowed_ips: list[str] = Field(
        default_factory=lambda: ["0.0.0.0/0", "::/0"],
        description="Default allowed IPs for peers (full tunnel by default)",
    )
    persistent_keepalive: int | None = Field(
        25,
        ge=0,
        le=600,
        description="Persistent keepalive in seconds (0 to disable)",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata",
    )


class WireGuardServerUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a WireGuard server."""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: WireGuardServerStatus | None = None
    max_peers: int | None = Field(None, ge=1, le=10000)
    dns_servers: list[str] | None = None
    allowed_ips: list[str] | None = None
    location: str | None = Field(None, max_length=255)
    metadata_: dict[str, Any] | None = Field(None, alias="metadata")


class WireGuardServerResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for WireGuard server response."""

    id: UUID
    tenant_id: UUID
    name: str
    description: str | None
    public_endpoint: str
    listen_port: int
    server_ipv4: str
    server_ipv6: str | None
    public_key: str
    status: WireGuardServerStatus
    max_peers: int
    current_peers: int
    next_peer_ip_offset: int
    dns_servers: list[str]
    allowed_ips: list[str]
    persistent_keepalive: int | None
    location: str | None
    metadata: dict[str, Any] = Field(alias="metadata_")
    total_rx_bytes: int
    total_tx_bytes: int
    last_stats_update: datetime | None
    utilization_percent: float
    has_capacity: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class WireGuardServerListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for list of servers."""

    model_config = ConfigDict()

    servers: list[WireGuardServerResponse]
    total: int
    limit: int
    offset: int


# ========================================================================
# Peer Schemas
# ========================================================================


class WireGuardPeerCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for creating a WireGuard peer."""

    model_config = ConfigDict()

    server_id: UUID = Field(..., description="Server ID")
    name: str = Field(..., min_length=1, max_length=255, description="Peer name")
    description: str | None = Field(None, description="Peer description")
    customer_id: UUID | None = Field(None, description="Customer ID (optional)")
    subscriber_id: str | None = Field(None, description="Subscriber ID (optional)")
    generate_keys: bool = Field(
        True,
        description="Auto-generate keys (if False, must provide public_key)",
    )
    public_key: str | None = Field(
        None,
        min_length=44,
        max_length=44,
        description="Peer public key (base64, 44 chars) - required if generate_keys=False",
    )
    peer_ipv4: str | None = Field(
        None,
        description="Peer VPN IPv4 (auto-allocated if not provided)",
        examples=["10.8.0.2/32"],
    )
    peer_ipv6: str | None = Field(
        None,
        description="Peer VPN IPv6 (optional)",
    )
    allowed_ips: list[str] | None = Field(
        None,
        description="Allowed IPs for peer (overrides server default)",
    )
    expires_at: datetime | None = Field(
        None,
        description="Peer expiration timestamp (for temporary access)",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata",
    )
    notes: str | None = Field(None, description="Internal notes")

    @model_validator(mode="after")
    def validate_public_key_if_not_generating(self) -> "WireGuardPeerCreate":
        """Validate public key is provided if not generating."""
        if not self.generate_keys and not self.public_key:
            raise ValueError("public_key is required when generate_keys=False")
        return self


class WireGuardPeerUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for updating a WireGuard peer."""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    status: WireGuardPeerStatus | None = None
    enabled: bool | None = None
    allowed_ips: list[str] | None = None
    expires_at: datetime | None = None
    metadata_: dict[str, Any] | None = Field(None, alias="metadata")
    notes: str | None = None


class WireGuardPeerResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for WireGuard peer response."""

    id: UUID
    tenant_id: UUID
    server_id: UUID
    customer_id: UUID | str | None
    subscriber_id: str | None
    name: str
    description: str | None
    public_key: str
    peer_ipv4: str
    peer_ipv6: str | None
    allowed_ips: list[str]
    status: WireGuardPeerStatus
    enabled: bool
    last_handshake: datetime | None
    endpoint: str | None
    rx_bytes: int
    tx_bytes: int
    total_bytes: int
    last_stats_update: datetime | None
    expires_at: datetime | None
    metadata: dict[str, Any] = Field(alias="metadata_")
    notes: str | None
    is_active: bool
    is_expired: bool
    is_online: bool
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class WireGuardPeerListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for list of peers."""

    model_config = ConfigDict()

    peers: list[WireGuardPeerResponse]
    total: int
    limit: int
    offset: int


class WireGuardPeerConfigResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for peer configuration file."""

    model_config = ConfigDict()

    peer_id: UUID
    peer_name: str
    config_file: str = Field(..., description="WireGuard configuration file content")
    created_at: datetime


class WireGuardPeerQRCodeResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for peer QR code."""

    model_config = ConfigDict()

    peer_id: UUID
    peer_name: str
    qr_code: str = Field(..., description="Base64-encoded PNG QR code")


# ========================================================================
# Statistics and Monitoring Schemas
# ========================================================================


class WireGuardServerHealthResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for server health status."""

    model_config = ConfigDict()

    server_id: str
    server_name: str
    status: str
    healthy: bool
    total_peers: int
    active_peers: int
    capacity_used_percent: float
    has_capacity: bool
    wireguard: dict[str, Any] = Field(
        ...,
        description="WireGuard interface health details",
    )
    error: str | None = Field(None, description="Error message if unhealthy")


class WireGuardDashboardStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for dashboard statistics."""

    model_config = ConfigDict()

    servers: dict[str, Any] = Field(
        ...,
        description="Server statistics",
        examples=[
            {
                "total": 3,
                "by_status": {
                    "active": 2,
                    "inactive": 1,
                },
            }
        ],
    )
    peers: dict[str, Any] = Field(
        ...,
        description="Peer statistics",
        examples=[
            {
                "total": 150,
                "by_status": {
                    "active": 120,
                    "inactive": 20,
                    "disabled": 10,
                },
            }
        ],
    )
    traffic: dict[str, Any] = Field(
        ...,
        description="Traffic statistics",
        examples=[
            {
                "total_rx_bytes": 1234567890,
                "total_tx_bytes": 9876543210,
                "total_bytes": 11111111100,
            }
        ],
    )


class WireGuardPeerStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for peer statistics."""

    model_config = ConfigDict()

    peer_id: UUID
    peer_name: str
    public_key: str
    endpoint: str | None
    last_handshake: datetime | None
    is_online: bool
    rx_bytes: int
    tx_bytes: int
    total_bytes: int
    allowed_ips: list[str]


# ========================================================================
# Bulk Operations Schemas
# ========================================================================


class WireGuardBulkPeerCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for bulk peer creation."""

    model_config = ConfigDict()

    server_id: UUID
    count: int = Field(..., ge=1, le=100, description="Number of peers to create")
    name_prefix: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="Peer name prefix (will append numbers)",
    )
    customer_id: UUID | None = None
    description: str | None = None
    allowed_ips: list[str] | None = None
    metadata: dict[str, Any] = Field(default_factory=lambda: {})


class WireGuardBulkPeerCreateResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for bulk peer creation response."""

    model_config = ConfigDict()

    created: int
    peers: list[WireGuardPeerResponse]
    errors: list[dict[str, str]] = Field(
        default_factory=list,
        description="Errors encountered during creation",
    )


class WireGuardSyncStatsRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for sync statistics request."""

    model_config = ConfigDict()

    server_id: UUID


class WireGuardSyncStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for sync statistics response."""

    model_config = ConfigDict()

    server_id: UUID
    peers_updated: int
    timestamp: datetime = Field(default_factory=datetime.utcnow)


# ========================================================================
# Integration Schemas
# ========================================================================


class WireGuardServiceProvisionRequest(BaseModel):
    """Schema for provisioning VPN service for a customer."""

    model_config = ConfigDict()

    customer_id: UUID
    subscriber_id: str | None = None
    server_id: UUID | None = Field(
        None,
        description="Specific server ID (auto-selects if not provided)",
    )
    peer_name: str | None = Field(
        None,
        description="Peer name (defaults to customer name)",
    )
    allowed_ips: list[str] | None = Field(
        None,
        description="Custom allowed IPs (defaults to server config)",
    )
    expires_at: datetime | None = Field(
        None,
        description="Expiration timestamp for temporary access",
    )


class WireGuardServiceProvisionResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Schema for service provisioning response."""

    model_config = ConfigDict()

    server: WireGuardServerResponse
    peer: WireGuardPeerResponse
    config_file: str
    message: str = "VPN service provisioned successfully"
