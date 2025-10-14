"""
NetBox Pydantic Schemas

Request and response schemas for NetBox API integration.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

# ============================================================================
# IP Address Management (IPAM) Schemas
# ============================================================================


class IPAddressCreate(BaseModel):
    """Create IP address in NetBox"""

    address: str = Field(..., description="IP address with prefix (e.g., 10.0.0.1/24)")
    status: str = Field(default="active", description="IP status (active, reserved, dhcp)")
    tenant: int | None = Field(None, description="Tenant ID")
    vrf: int | None = Field(None, description="VRF ID")
    description: str | None = Field(None, max_length=200, description="Description")
    dns_name: str | None = Field(None, max_length=255, description="DNS name")
    assigned_object_type: str | None = Field(
        None, description="Object type (e.g., dcim.interface)"
    )
    assigned_object_id: int | None = Field(None, description="Object ID")
    tags: list[str] | None = Field(default_factory=list, description="Tags")
    custom_fields: dict[str, Any] | None = Field(
        default_factory=dict, description="Custom fields"
    )

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        valid_statuses = ["active", "reserved", "deprecated", "dhcp", "slaac"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v.lower()


class IPAddressUpdate(BaseModel):
    """Update IP address in NetBox"""

    status: str | None = None
    tenant: int | None = None
    vrf: int | None = None
    description: str | None = Field(None, max_length=200)
    dns_name: str | None = Field(None, max_length=255)
    tags: list[str] | None = None
    custom_fields: dict[str, Any] | None = None


class IPAddressResponse(BaseModel):
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
    tags: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class PrefixCreate(BaseModel):
    """Create IP prefix (subnet) in NetBox"""

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


class PrefixResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class VRFCreate(BaseModel):
    """Create VRF in NetBox"""

    name: str = Field(..., min_length=1, max_length=100, description="VRF name")
    rd: str | None = Field(None, max_length=21, description="Route distinguisher")
    tenant: int | None = Field(None, description="Tenant ID")
    enforce_unique: bool = Field(default=True, description="Enforce unique IP addresses")
    description: str | None = Field(None, max_length=200, description="Description")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class VRFResponse(BaseModel):
    """VRF response from NetBox"""

    id: int
    name: str
    rd: str | None = None
    tenant: dict[str, Any] | None = None
    enforce_unique: bool
    description: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# DCIM (Data Center Infrastructure Management) Schemas
# ============================================================================


class SiteCreate(BaseModel):
    """Create site in NetBox"""

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


class SiteResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class DeviceCreate(BaseModel):
    """Create device in NetBox"""

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


class DeviceUpdate(BaseModel):
    """Update device in NetBox"""

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


class DeviceResponse(BaseModel):
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

    model_config = {"from_attributes": True}


class InterfaceCreate(BaseModel):
    """Create interface in NetBox"""

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


class InterfaceResponse(BaseModel):
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
    tagged_vlans: list[dict[str, Any]] = Field(default_factory=list)
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# Tenancy Schemas
# ============================================================================


class TenantCreate(BaseModel):
    """Create tenant in NetBox"""

    name: str = Field(..., min_length=1, max_length=100, description="Tenant name")
    slug: str = Field(..., min_length=1, max_length=100, description="URL-friendly slug")
    group: int | None = Field(None, description="Tenant group ID")
    description: str | None = Field(None, max_length=200, description="Description")
    comments: str | None = Field(None, description="Comments")
    tags: list[str] | None = Field(default_factory=list, description="Tags")


class TenantResponse(BaseModel):
    """Tenant response from NetBox"""

    id: int
    name: str
    slug: str
    group: dict[str, Any] | None = None
    description: str
    comments: str
    created: datetime | None = None
    last_updated: datetime | None = None

    model_config = {"from_attributes": True}


# ============================================================================
# Query and Utility Schemas
# ============================================================================


class NetBoxQuery(BaseModel):
    """Common query parameters for NetBox API"""

    tenant: str | None = Field(None, description="Filter by tenant")
    site: str | None = Field(None, description="Filter by site")
    limit: int = Field(100, ge=1, le=1000, description="Results per page")
    offset: int = Field(0, ge=0, description="Results offset")


class IPAllocationRequest(BaseModel):
    """Request to allocate IP from prefix"""

    prefix_id: int = Field(..., description="Prefix ID to allocate from")
    description: str | None = Field(None, max_length=200, description="Description")
    dns_name: str | None = Field(None, max_length=255, description="DNS name")
    tenant: int | None = Field(None, description="Tenant ID")


class NetBoxHealthResponse(BaseModel):
    """NetBox health check response"""

    healthy: bool
    version: str | None = None
    message: str
