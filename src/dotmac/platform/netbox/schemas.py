"""
NetBox Pydantic Schemas

Request and response schemas for NetBox API integration.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.core.ip_validation import (
    IPNetworkValidator,
)

# ============================================================================
# IP Address Management (IPAM) Schemas
# ============================================================================


class IPAddressCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create IP address in NetBox"""

    model_config = ConfigDict()

    address: str = Field(
        ..., description="IP address with prefix (e.g., 10.0.0.1/24 or 2001:db8::1/64)"
    )
    status: str = Field(default="active", description="IP status (active, reserved, dhcp, slaac)")
    tenant: int | None = Field(None, description="Tenant ID")
    vrf: int | None = Field(None, description="VRF ID")
    description: str | None = Field(None, max_length=200, description="Description")
    dns_name: str | None = Field(None, max_length=255, description="DNS name")
    assigned_object_type: str | None = Field(None, description="Object type (e.g., dcim.interface)")
    assigned_object_id: int | None = Field(None, description="Object ID")
    tags: list[str] | None = Field(default_factory=list, description="Tags")
    custom_fields: dict[str, Any] | None = Field(default_factory=dict, description="Custom fields")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = ["active", "reserved", "deprecated", "dhcp", "slaac"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        """Validate IP address with CIDR notation (IPv4 or IPv6)"""
        validated = IPNetworkValidator.validate(v, strict=False)
        if validated is None:
            raise ValueError(f"Invalid IP address with CIDR notation: {v}")
        return validated


class IPAddressUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update IP address in NetBox"""

    model_config = ConfigDict()

    status: str | None = None
    tenant: int | None = None
    vrf: int | None = None
    description: str | None = Field(None, max_length=200)
    dns_name: str | None = Field(None, max_length=255)
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None


class IPAddressResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """IP address response from NetBox"""

    id: int
    address: str
    status: dict[str, Any]
    tenant: dict[str, Any] | None = None
    vrf: dict[str, Any] | None = None
    description: str
    dns_name: str
    assigned_object_type: str | None = None
    assigned_object_id: int | None = None
    assigned_object: dict[str, Any] | None = None
    created: datetime | None = None
    last_updated: datetime | None = None
    tags: list[dict[str, Any]] = Field(default_factory=lambda: [])

    model_config = ConfigDict(from_attributes=True)


class PrefixCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create IP prefix (subnet) in NetBox"""

    model_config = ConfigDict()

    prefix: str = Field(..., description="IP prefix in CIDR notation (e.g., 10.0.0.0/24)")
    status: str = Field(default="active", description="Prefix status")
    tenant: int | None = Field(None, description="Tenant ID")
    vrf: int | None = Field(None, description="VRF ID")
    site: int | None = Field(None, description="Site ID")
    vlan: int | None = Field(None, description="VLAN ID")
    role: int | None = Field(None, description="Role ID")
    is_pool: bool = Field(default=False, description="Is IP pool for allocation")
    description: str | None = Field(None, max_length=200, description="Description")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class PrefixResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """IP prefix response from NetBox"""

    id: int
    prefix: str
    status: dict[str, Any]
    tenant: dict[str, Any] | None = None
    vrf: dict[str, Any] | None = None
    site: dict[str, Any] | None = None
    vlan: dict[str, Any] | None = None
    role: dict[str, Any] | None = None
    is_pool: bool
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class VRFCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create VRF in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="VRF name")
    rd: str | None = Field(None, max_length=21, description="Route distinguisher")
    tenant: int | None = Field(None, description="Tenant ID")
    enforce_unique: bool = Field(default=True, description="Enforce unique IP addresses")
    description: str | None = Field(None, max_length=200, description="Description")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class VRFResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """VRF response from NetBox"""

    id: int
    name: str
    rd: str | None = None
    tenant: dict[str, Any] | None = None
    enforce_unique: bool
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# DCIM (Data Center Infrastructure Management) Schemas
# ============================================================================


class SiteCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create site in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Site name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    status: str = Field(default="active", description="Site status")
    tenant: int | None = Field(None, description="Tenant ID")
    facility: str | None = Field(None, max_length=50, description="Facility designation")
    asn: int | None = Field(None, description="AS number")
    time_zone: str | None = Field(None, description="Time zone")
    description: str | None = Field(None, max_length=200, description="Description")
    physical_address: str | None = Field(None, max_length=200, description="Physical address")
    shipping_address: str | None = Field(None, max_length=200, description="Shipping address")
    latitude: float | None = Field(None, ge=-90, le=90, description="Latitude")
    longitude: float | None = Field(None, ge=-180, le=180, description="Longitude")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class SiteResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Site response from NetBox"""

    id: int
    name: str
    slug: str
    status: dict[str, Any]
    tenant: dict[str, Any] | None = None
    facility: str
    description: str
    physical_address: str
    latitude: float | None = None
    longitude: float | None = None
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class DeviceCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create device in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=64, description="Device name")
    device_type: int = Field(..., description="Device type ID")
    device_role: int = Field(..., description="Device role ID")
    site: int = Field(..., description="Site ID")
    tenant: int | None = Field(None, description="Tenant ID")
    platform: int | None = Field(None, description="Platform ID")
    serial: str | None = Field(None, max_length=50, description="Serial number")
    asset_tag: str | None = Field(None, max_length=50, description="Asset tag")
    status: str = Field(default="active", description="Device status")
    rack: int | None = Field(None, description="Rack ID")
    position: int | None = Field(None, description="Rack position")
    face: str | None = Field(None, description="Rack face (front/rear)")
    primary_ip4: int | None = Field(None, description="Primary IPv4 ID")
    primary_ip6: int | None = Field(None, description="Primary IPv6 ID")
    comments: str | None = Field(None, description="Comments")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class DeviceUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update device in NetBox"""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=64)
    device_role: int | None = None
    tenant: int | None = None
    platform: int | None = None
    serial: str | None = Field(None, max_length=50)
    asset_tag: str | None = Field(None, max_length=50)
    status: str | None = None
    primary_ip4: int | None = None
    primary_ip6: int | None = None
    comments: str | None = None
    tags: list[str] | None = None


class DeviceResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Device response from NetBox"""

    id: int
    name: str
    device_type: dict[str, Any]
    device_role: dict[str, Any]
    tenant: dict[str, Any] | None = None
    platform: dict[str, Any] | None = None
    serial: str
    asset_tag: str | None = None
    site: dict[str, Any]
    rack: dict[str, Any] | None = None
    position: int | None = None
    face: dict[str, Any] | None = None
    status: dict[str, Any]
    primary_ip: dict[str, Any] | None = None
    primary_ip4: dict[str, Any] | None = None
    primary_ip6: dict[str, Any] | None = None
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class InterfaceCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create interface in NetBox"""

    model_config = ConfigDict()

    device: int = Field(..., description="Device ID")
    name: str = Field(..., min_length=1, max_length=64, description="Interface name")
    type: str = Field(..., description="Interface type (e.g., 1000base-t, sfp-plus)")
    enabled: bool = Field(default=True, description="Interface enabled")
    mtu: int | None = Field(None, gt=0, le=65536, description="MTU size")
    mac_address: str | None = Field(None, description="MAC address")
    description: str | None = Field(None, max_length=200, description="Description")
    mode: str | None = Field(None, description="802.1Q mode (access/tagged/tagged-all)")
    untagged_vlan: int | None = Field(None, description="Untagged VLAN ID")
    tagged_vlans: list[int] | None = Field(default_factory=list, description="Tagged VLAN IDs")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class InterfaceResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Interface response from NetBox"""

    id: int
    device: dict[str, Any]
    name: str
    type: dict[str, Any]
    enabled: bool
    mtu: int | None = None
    mac_address: str | None = None
    description: str
    mode: dict[str, Any] | None = None
    untagged_vlan: dict[str, Any] | None = None
    tagged_vlans: list[dict[str, Any]] = Field(default_factory=lambda: [])
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Tenancy Schemas
# ============================================================================


class TenantCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create tenant in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Tenant name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    group: int | None = Field(None, description="Tenant group ID")
    description: str | None = Field(None, max_length=200, description="Description")
    comments: str | None = Field(None, description="Comments")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class TenantResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Tenant response from NetBox"""

    id: int
    name: str
    slug: str
    group: dict[str, Any] | None = None
    description: str
    comments: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Query and Utility Schemas
# ============================================================================


class NetBoxQuery(BaseModel):  # BaseModel resolves to Any in isolation
    """Common query parameters for NetBox API"""

    model_config = ConfigDict()

    tenant: str | None = Field(None, description="Filter by tenant")
    site: str | None = Field(None, description="Filter by site")
    limit: int = Field(100, ge=1, le=1000, description="Results per page")
    offset: int = Field(0, ge=0, description="Results offset")


class IPAllocationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to allocate IP from prefix"""

    model_config = ConfigDict()

    prefix_id: int = Field(..., description="Prefix ID to allocate from")
    description: str | None = Field(None, max_length=200, description="Description")
    dns_name: str | None = Field(None, max_length=255, description="DNS name")
    tenant: int | None = Field(None, description="Tenant ID")


class NetBoxHealthResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """NetBox health check response"""

    model_config = ConfigDict()

    healthy: bool
    version: str | None = None
    message: str


# ============================================================================
# VLAN Schemas
# ============================================================================


class VLANCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create VLAN in NetBox"""

    model_config = ConfigDict()

    vid: int = Field(..., ge=1, le=4094, description="VLAN ID (1-4094)")
    name: str = Field(..., min_length=1, max_length=64, description="VLAN name")
    site: int | None = Field(None, description="Site ID")
    group: int | None = Field(None, description="VLAN group ID")
    tenant: int | None = Field(None, description="Tenant ID")
    status: str = Field(default="active", description="VLAN status")
    role: int | None = Field(None, description="Role ID")
    description: str | None = Field(None, max_length=200, description="Description")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class VLANUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update VLAN in NetBox"""

    model_config = ConfigDict()

    name: str | None = Field(None, min_length=1, max_length=64)
    site: int | None = None
    group: int | None = None
    tenant: int | None = None
    status: str | None = None
    role: int | None = None
    description: str | None = Field(None, max_length=200)
    tags: list[str] | None = None


class VLANResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """VLAN response from NetBox"""

    id: int
    vid: int
    name: str
    site: dict[str, Any] | None = None
    group: dict[str, Any] | None = None
    tenant: dict[str, Any] | None = None
    status: dict[str, Any]
    role: dict[str, Any] | None = None
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Cable Management Schemas
# ============================================================================


class CableCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create cable in NetBox"""

    model_config = ConfigDict()

    a_terminations: list[dict[str, Any]] = Field(
        ..., description="A-side terminations (e.g., interface, circuit termination)"
    )
    b_terminations: list[dict[str, Any]] = Field(
        ..., description="B-side terminations (e.g., interface, circuit termination)"
    )
    type: str = Field(default="cat6", description="Cable type")
    status: str = Field(default="connected", description="Cable status")
    tenant: int | None = Field(None, description="Tenant ID")
    label: str | None = Field(None, max_length=100, description="Cable label")
    color: str | None = Field(None, max_length=6, description="Cable color (hex)")
    length: float | None = Field(None, gt=0, description="Cable length")
    length_unit: str | None = Field(None, description="Length unit (m, ft, etc.)")
    description: str | None = Field(None, max_length=200, description="Description")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class CableUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update cable in NetBox"""

    model_config = ConfigDict()

    type: str | None = None
    status: str | None = None
    tenant: int | None = None
    label: str | None = Field(None, max_length=100)
    color: str | None = Field(None, max_length=6)
    length: float | None = Field(None, gt=0)
    length_unit: str | None = None
    description: str | None = Field(None, max_length=200)
    tags: list[str] | None = None


class CableResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Cable response from NetBox"""

    id: int
    type: dict[str, Any]
    status: dict[str, Any]
    tenant: dict[str, Any] | None = None
    label: str
    color: str
    length: float | None = None
    length_unit: str | None = None
    a_terminations: list[dict[str, Any]]
    b_terminations: list[dict[str, Any]]
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Circuit Management Schemas
# ============================================================================


class CircuitProviderCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create circuit provider in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Provider name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    asn: int | None = Field(None, description="AS number")
    account: str | None = Field(None, max_length=30, description="Account number")
    portal_url: str | None = Field(None, max_length=200, description="Portal URL")
    noc_contact: str | None = Field(None, max_length=200, description="NOC contact")
    admin_contact: str | None = Field(None, max_length=200, description="Admin contact")
    comments: str | None = Field(None, description="Comments")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class CircuitProviderResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Circuit provider response from NetBox"""

    id: int
    name: str
    slug: str
    asn: int | None = None
    account: str
    portal_url: str
    noc_contact: str
    admin_contact: str
    comments: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CircuitTypeCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create circuit type in NetBox"""

    model_config = ConfigDict()

    name: str = Field(..., min_length=1, max_length=100, description="Circuit type name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    description: str | None = Field(None, max_length=200, description="Description")


class CircuitTypeResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Circuit type response from NetBox"""

    id: int
    name: str
    slug: str
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CircuitCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create circuit in NetBox"""

    model_config = ConfigDict()

    cid: str = Field(..., min_length=1, max_length=100, description="Circuit ID")
    provider: int = Field(..., description="Provider ID")
    type: int = Field(..., description="Circuit type ID")
    status: str = Field(default="active", description="Circuit status")
    tenant: int | None = Field(None, description="Tenant ID")
    install_date: datetime | None = Field(None, description="Installation date")
    commit_rate: int | None = Field(None, gt=0, description="Commit rate (kbps)")
    description: str | None = Field(None, max_length=200, description="Description")
    comments: str | None = Field(None, description="Comments")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class CircuitUpdate(BaseModel):  # BaseModel resolves to Any in isolation
    """Update circuit in NetBox"""

    model_config = ConfigDict()

    status: str | None = None
    tenant: int | None = None
    install_date: datetime | None = None
    commit_rate: int | None = Field(None, gt=0)
    description: str | None = Field(None, max_length=200)
    comments: str | None = None
    tags: list[str] | None = None


class CircuitResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Circuit response from NetBox"""

    id: int
    cid: str
    provider: dict[str, Any]
    type: dict[str, Any]
    status: dict[str, Any]
    tenant: dict[str, Any] | None = None
    install_date: datetime | None = None
    commit_rate: int | None = None
    description: str
    comments: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class CircuitTerminationCreate(BaseModel):  # BaseModel resolves to Any in isolation
    """Create circuit termination in NetBox"""

    model_config = ConfigDict()

    circuit: int = Field(..., description="Circuit ID")
    term_side: str = Field(..., description="Termination side (A or Z)")
    site: int = Field(..., description="Site ID")
    port_speed: int | None = Field(None, gt=0, description="Port speed (kbps)")
    upstream_speed: int | None = Field(None, gt=0, description="Upstream speed (kbps)")
    xconnect_id: str | None = Field(None, max_length=50, description="Cross-connect ID")
    pp_info: str | None = Field(None, max_length=100, description="Patch panel info")
    description: str | None = Field(None, max_length=200, description="Description")


class CircuitTerminationResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Circuit termination response from NetBox"""

    id: int
    circuit: dict[str, Any]
    term_side: str
    site: dict[str, Any]
    port_speed: int | None = None
    upstream_speed: int | None = None
    xconnect_id: str
    pp_info: str
    description: str
    cable: dict[str, Any] | None = None
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Dual-Stack IP Allocation Schemas (NEW)
# ============================================================================


class DualStackAllocationRequest(BaseModel):
    """Request to allocate both IPv4 and IPv6 addresses atomically"""

    model_config = ConfigDict()

    ipv4_prefix_id: int = Field(..., description="IPv4 prefix ID to allocate from")
    ipv6_prefix_id: int = Field(..., description="IPv6 prefix ID to allocate from")
    description: str | None = Field(None, max_length=200, description="Description for both IPs")
    dns_name: str | None = Field(None, max_length=255, description="DNS name for both IPs")
    tenant: int | None = Field(None, description="Tenant ID")


class DualStackAllocationResponse(BaseModel):
    """Response after dual-stack allocation"""

    model_config = ConfigDict()

    ipv4: IPAddressResponse = Field(..., description="Allocated IPv4 address")
    ipv6: IPAddressResponse = Field(..., description="Allocated IPv6 address")
    allocated_at: datetime = Field(
        default_factory=datetime.utcnow, description="Allocation timestamp"
    )


class BulkIPAllocationRequest(BaseModel):
    """Request to allocate multiple IPs from a prefix"""

    model_config = ConfigDict()

    prefix_id: int = Field(..., description="Prefix ID to allocate from")
    count: int = Field(..., ge=1, le=100, description="Number of IPs to allocate (1-100)")
    description_prefix: str | None = Field(
        None, max_length=150, description="Description prefix (will be numbered)"
    )
    tenant: int | None = Field(None, description="Tenant ID")


class BulkIPAllocationResponse(BaseModel):
    """Response after bulk IP allocation"""

    model_config = ConfigDict()

    allocated: list[IPAddressResponse] = Field(..., description="List of allocated IPs")
    count: int = Field(..., description="Number of IPs allocated")
    prefix_id: int = Field(..., description="Source prefix ID")


class IPUtilizationResponse(BaseModel):
    """IP prefix utilization statistics"""

    model_config = ConfigDict()

    prefix_id: int
    prefix: str
    family: int = Field(..., description="IP version (4 or 6)")
    total_ips: int = Field(..., description="Total IPs in prefix")
    allocated_ips: int = Field(..., description="Number of allocated IPs")
    available_ips: int = Field(..., description="Number of available IPs")
    utilization_percent: float = Field(..., ge=0, le=100, description="Utilization percentage")
    status: str = Field(..., description="Prefix status")
