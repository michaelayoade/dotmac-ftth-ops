"""
NetBox API Router

FastAPI endpoints for NetBox IPAM and DCIM operations.
"""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config
from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.netbox.schemas import (
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
    InterfaceCreate,
    InterfaceResponse,
    IPAddressCreate,
    IPAddressResponse,
    IPAddressUpdate,
    IPAllocationRequest,
    NetBoxHealthResponse,
    PrefixCreate,
    PrefixResponse,
    SiteCreate,
    SiteResponse,
    VRFCreate,
    VRFResponse,
)
from dotmac.platform.netbox.service import NetBoxService

router = APIRouter(prefix="/api/v1/netbox", tags=["netbox"])


# =============================================================================
# Dependency: Get NetBox Service
# =============================================================================


async def get_netbox_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> NetBoxService:
    """Get NetBox service instance for the active tenant."""
    _, tenant = tenant_access
    try:
        config = await get_service_config(session, tenant.id, OSSService.NETBOX)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    client = NetBoxClient(
        base_url=config.url,
        api_token=config.api_token,
        verify_ssl=config.verify_ssl,
        timeout_seconds=config.timeout_seconds,
        max_retries=config.max_retries,
    )
    return NetBoxService(client=client)


# =============================================================================
# Health Check
# =============================================================================


@router.get(
    "/health",
    response_model=NetBoxHealthResponse,
    summary="NetBox Health Check",
    description="Check NetBox connectivity and status",
)
async def health_check(
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Check NetBox health"""
    return await service.health_check()


# =============================================================================
# IP Address Management (IPAM) Endpoints
# =============================================================================


@router.get(
    "/ipam/ip-addresses",
    response_model=list[IPAddressResponse],
    summary="List IP Addresses",
    description="List IP addresses from NetBox",
)
async def list_ip_addresses(
    tenant: str | None = Query(None, description="Filter by tenant"),
    vrf: str | None = Query(None, description="Filter by VRF"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List IP addresses"""
    return await service.list_ip_addresses(tenant=tenant, vrf=vrf, limit=limit, offset=offset)


@router.get(
    "/ipam/ip-addresses/{ip_id}",
    response_model=IPAddressResponse,
    summary="Get IP Address",
    description="Get IP address details by ID",
)
async def get_ip_address(
    ip_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Get IP address by ID"""
    ip_address = await service.get_ip_address(ip_id)
    if not ip_address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IP address {ip_id} not found",
        )
    return ip_address


@router.post(
    "/ipam/ip-addresses",
    response_model=IPAddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create IP Address",
    description="Create new IP address in NetBox",
)
async def create_ip_address(
    data: IPAddressCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create IP address"""
    try:
        return await service.create_ip_address(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IP address: {str(e)}",
        )


@router.patch(
    "/ipam/ip-addresses/{ip_id}",
    response_model=IPAddressResponse,
    summary="Update IP Address",
    description="Update IP address in NetBox",
)
async def update_ip_address(
    ip_id: int,
    data: IPAddressUpdate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Update IP address"""
    ip_address = await service.update_ip_address(ip_id, data)
    if not ip_address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IP address {ip_id} not found",
        )
    return ip_address


@router.delete(
    "/ipam/ip-addresses/{ip_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete IP Address",
    description="Delete IP address from NetBox",
)
async def delete_ip_address(
    ip_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Delete IP address"""
    deleted = await service.delete_ip_address(ip_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IP address {ip_id} not found",
        )
    return None


@router.get(
    "/ipam/prefixes",
    response_model=list[PrefixResponse],
    summary="List IP Prefixes",
    description="List IP prefixes (subnets) from NetBox",
)
async def list_prefixes(
    tenant: str | None = Query(None, description="Filter by tenant"),
    vrf: str | None = Query(None, description="Filter by VRF"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List IP prefixes"""
    return await service.list_prefixes(tenant=tenant, vrf=vrf, limit=limit, offset=offset)


@router.get(
    "/ipam/prefixes/{prefix_id}",
    response_model=PrefixResponse,
    summary="Get IP Prefix",
    description="Get IP prefix details by ID",
)
async def get_prefix(
    prefix_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Get IP prefix by ID"""
    prefix = await service.get_prefix(prefix_id)
    if not prefix:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prefix {prefix_id} not found",
        )
    return prefix


@router.post(
    "/ipam/prefixes",
    response_model=PrefixResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create IP Prefix",
    description="Create new IP prefix (subnet) in NetBox",
)
async def create_prefix(
    data: PrefixCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create IP prefix"""
    try:
        return await service.create_prefix(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create prefix: {str(e)}",
        )


@router.get(
    "/ipam/prefixes/{prefix_id}/available-ips",
    response_model=list[str],
    summary="Get Available IPs",
    description="Get available IP addresses in a prefix",
)
async def get_available_ips(
    prefix_id: int,
    limit: int = Query(10, ge=1, le=100, description="Maximum IPs to return"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Get available IPs in prefix"""
    return await service.get_available_ips(prefix_id, limit)


@router.post(
    "/ipam/allocate-ip",
    response_model=IPAddressResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Allocate IP Address",
    description="Allocate next available IP from a prefix",
)
async def allocate_ip(
    request: IPAllocationRequest,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Allocate next available IP"""
    ip_address = await service.allocate_ip(request)
    if not ip_address:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to allocate IP from prefix {request.prefix_id}",
        )
    return ip_address


@router.get(
    "/ipam/vrfs",
    response_model=list[VRFResponse],
    summary="List VRFs",
    description="List VRFs (Virtual Routing and Forwarding) from NetBox",
)
async def list_vrfs(
    tenant: str | None = Query(None, description="Filter by tenant"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List VRFs"""
    return await service.list_vrfs(tenant=tenant, limit=limit, offset=offset)


@router.post(
    "/ipam/vrfs",
    response_model=VRFResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create VRF",
    description="Create new VRF in NetBox",
)
async def create_vrf(
    data: VRFCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create VRF"""
    try:
        return await service.create_vrf(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create VRF: {str(e)}",
        )


# =============================================================================
# DCIM Endpoints
# =============================================================================


@router.get(
    "/dcim/sites",
    response_model=list[SiteResponse],
    summary="List Sites",
    description="List sites from NetBox",
)
async def list_sites(
    tenant: str | None = Query(None, description="Filter by tenant"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List sites"""
    return await service.list_sites(tenant=tenant, limit=limit, offset=offset)


@router.get(
    "/dcim/sites/{site_id}",
    response_model=SiteResponse,
    summary="Get Site",
    description="Get site details by ID",
)
async def get_site(
    site_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Get site by ID"""
    site = await service.get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site {site_id} not found",
        )
    return site


@router.post(
    "/dcim/sites",
    response_model=SiteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Site",
    description="Create new site in NetBox",
)
async def create_site(
    data: SiteCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create site"""
    try:
        return await service.create_site(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create site: {str(e)}",
        )


@router.get(
    "/dcim/devices",
    response_model=list[DeviceResponse],
    summary="List Devices",
    description="List devices from NetBox",
)
async def list_devices(
    tenant: str | None = Query(None, description="Filter by tenant"),
    site: str | None = Query(None, description="Filter by site"),
    role: str | None = Query(None, description="Filter by role"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List devices"""
    return await service.list_devices(
        tenant=tenant, site=site, role=role, limit=limit, offset=offset
    )


@router.get(
    "/dcim/devices/{device_id}",
    response_model=DeviceResponse,
    summary="Get Device",
    description="Get device details by ID",
)
async def get_device(
    device_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """Get device by ID"""
    device = await service.get_device(device_id)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return device


@router.post(
    "/dcim/devices",
    response_model=DeviceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Device",
    description="Create new device in NetBox",
)
async def create_device(
    data: DeviceCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create device"""
    try:
        return await service.create_device(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create device: {str(e)}",
        )


@router.patch(
    "/dcim/devices/{device_id}",
    response_model=DeviceResponse,
    summary="Update Device",
    description="Update device in NetBox",
)
async def update_device(
    device_id: int,
    data: DeviceUpdate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Update device"""
    device = await service.update_device(device_id, data)
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Device {device_id} not found",
        )
    return device


@router.get(
    "/dcim/interfaces",
    response_model=list[InterfaceResponse],
    summary="List Interfaces",
    description="List network interfaces from NetBox",
)
async def list_interfaces(
    device_id: int | None = Query(None, description="Filter by device ID"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
):
    """List interfaces"""
    return await service.list_interfaces(device_id=device_id, limit=limit, offset=offset)


@router.post(
    "/dcim/interfaces",
    response_model=InterfaceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Interface",
    description="Create new network interface in NetBox",
)
async def create_interface(
    data: InterfaceCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
):
    """Create interface"""
    try:
        return await service.create_interface(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interface: {str(e)}",
        )
