"""
NetBox API Router

FastAPI endpoints for NetBox IPAM and DCIM operations.
"""

from typing import cast

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.netbox.schemas import (
    CableCreate,
    CableResponse,
    CableUpdate,
    CircuitCreate,
    CircuitProviderCreate,
    CircuitProviderResponse,
    CircuitResponse,
    CircuitTerminationCreate,
    CircuitTerminationResponse,
    CircuitTypeCreate,
    CircuitTypeResponse,
    CircuitUpdate,
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
    VLANCreate,
    VLANResponse,
    VLANUpdate,
    VRFCreate,
    VRFResponse,
)
from dotmac.platform.netbox.service import NetBoxService
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.tenant.oss_config import OSSService, get_service_config

router = APIRouter(prefix="/netbox", tags=["NetBox"])


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
        tenant_id=tenant.id,
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
) -> NetBoxHealthResponse:
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
) -> list[IPAddressResponse]:
    """List IP addresses"""
    result = await service.list_ip_addresses(tenant=tenant, vrf=vrf, limit=limit, offset=offset)
    return result


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
) -> IPAddressResponse:
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
) -> IPAddressResponse:
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
) -> IPAddressResponse:
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
) -> None:
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
) -> list[PrefixResponse]:
    """List IP prefixes"""
    result = await service.list_prefixes(tenant=tenant, vrf=vrf, limit=limit, offset=offset)
    return result


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
) -> PrefixResponse:
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
) -> PrefixResponse:
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
) -> list[str]:
    """Get available IPs in prefix"""
    result = await service.get_available_ips(prefix_id, limit)
    return result


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
) -> IPAddressResponse:
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
) -> list[VRFResponse]:
    """List VRFs"""
    result = await service.list_vrfs(tenant=tenant, limit=limit, offset=offset)
    return result


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
) -> VRFResponse:
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
) -> list[SiteResponse]:
    """List sites"""
    result = await service.list_sites(tenant=tenant, limit=limit, offset=offset)
    return result


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
) -> SiteResponse:
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
) -> SiteResponse:
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
) -> list[DeviceResponse]:
    """List devices"""
    result = await service.list_devices(
        tenant=tenant, site=site, role=role, limit=limit, offset=offset
    )
    return result


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
) -> DeviceResponse:
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
) -> DeviceResponse:
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
) -> DeviceResponse:
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
) -> list[InterfaceResponse]:
    """List interfaces"""
    result = await service.list_interfaces(device_id=device_id, limit=limit, offset=offset)
    return result


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
) -> InterfaceResponse:
    """Create interface"""
    try:
        return await service.create_interface(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create interface: {str(e)}",
        )


# =============================================================================
# VLAN Endpoints
# =============================================================================


@router.get(
    "/ipam/vlans",
    response_model=list[VLANResponse],
    summary="List VLANs",
    description="List VLANs from NetBox",
)
async def list_vlans(
    tenant: str | None = Query(None, description="Filter by tenant"),
    site: str | None = Query(None, description="Filter by site"),
    vid: int | None = Query(None, description="Filter by VLAN ID"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[VLANResponse]:
    """List VLANs"""
    result = await service.list_vlans(tenant=tenant, site=site, vid=vid, limit=limit, offset=offset)
    return result


@router.get(
    "/ipam/vlans/{vlan_id}",
    response_model=VLANResponse,
    summary="Get VLAN",
    description="Get VLAN details by ID",
)
async def get_vlan(
    vlan_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> VLANResponse:
    """Get VLAN by ID"""
    vlan = await service.get_vlan(vlan_id)
    if not vlan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"VLAN {vlan_id} not found",
        )
    return vlan


@router.post(
    "/ipam/vlans",
    response_model=VLANResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create VLAN",
    description="Create new VLAN in NetBox",
)
async def create_vlan(
    data: VLANCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> VLANResponse:
    """Create VLAN"""
    try:
        return await service.create_vlan(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create VLAN: {str(e)}",
        )


@router.patch(
    "/ipam/vlans/{vlan_id}",
    response_model=VLANResponse,
    summary="Update VLAN",
    description="Update VLAN in NetBox",
)
async def update_vlan(
    vlan_id: int,
    data: VLANUpdate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> VLANResponse:
    """Update VLAN"""
    vlan = await service.update_vlan(vlan_id, data)
    if not vlan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"VLAN {vlan_id} not found",
        )
    return vlan


@router.delete(
    "/ipam/vlans/{vlan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete VLAN",
    description="Delete VLAN from NetBox",
)
async def delete_vlan(
    vlan_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> None:
    """Delete VLAN"""
    deleted = await service.delete_vlan(vlan_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"VLAN {vlan_id} not found",
        )
    return None


# =============================================================================
# Cable Endpoints
# =============================================================================


@router.get(
    "/dcim/cables",
    response_model=list[CableResponse],
    summary="List Cables",
    description="List cables from NetBox",
)
async def list_cables(
    tenant: str | None = Query(None, description="Filter by tenant"),
    site: str | None = Query(None, description="Filter by site"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[CableResponse]:
    """List cables"""
    result = await service.list_cables(tenant=tenant, site=site, limit=limit, offset=offset)
    return result


@router.get(
    "/dcim/cables/{cable_id}",
    response_model=CableResponse,
    summary="Get Cable",
    description="Get cable details by ID",
)
async def get_cable(
    cable_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> CableResponse:
    """Get cable by ID"""
    cable = await service.get_cable(cable_id)
    if not cable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cable {cable_id} not found",
        )
    return cable


@router.post(
    "/dcim/cables",
    response_model=CableResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Cable",
    description="Create new cable in NetBox",
)
async def create_cable(
    data: CableCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CableResponse:
    """Create cable"""
    try:
        return await service.create_cable(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create cable: {str(e)}",
        )


@router.patch(
    "/dcim/cables/{cable_id}",
    response_model=CableResponse,
    summary="Update Cable",
    description="Update cable in NetBox",
)
async def update_cable(
    cable_id: int,
    data: CableUpdate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CableResponse:
    """Update cable"""
    cable = await service.update_cable(cable_id, data)
    if not cable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cable {cable_id} not found",
        )
    return cable


@router.delete(
    "/dcim/cables/{cable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Cable",
    description="Delete cable from NetBox",
)
async def delete_cable(
    cable_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> None:
    """Delete cable"""
    deleted = await service.delete_cable(cable_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cable {cable_id} not found",
        )
    return None


# =============================================================================
# Circuit Endpoints
# =============================================================================


@router.get(
    "/circuits/providers",
    response_model=list[CircuitProviderResponse],
    summary="List Circuit Providers",
    description="List circuit providers from NetBox",
)
async def list_circuit_providers(
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[CircuitProviderResponse]:
    """List circuit providers"""
    result = await service.list_circuit_providers(limit=limit, offset=offset)
    return result


@router.get(
    "/circuits/providers/{provider_id}",
    response_model=CircuitProviderResponse,
    summary="Get Circuit Provider",
    description="Get circuit provider details by ID",
)
async def get_circuit_provider(
    provider_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> CircuitProviderResponse:
    """Get circuit provider by ID"""
    provider = await service.get_circuit_provider(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit provider {provider_id} not found",
        )
    return provider


@router.post(
    "/circuits/providers",
    response_model=CircuitProviderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Circuit Provider",
    description="Create new circuit provider in NetBox",
)
async def create_circuit_provider(
    data: CircuitProviderCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CircuitProviderResponse:
    """Create circuit provider"""
    try:
        return await service.create_circuit_provider(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create circuit provider: {str(e)}",
        )


@router.get(
    "/circuits/circuit-types",
    response_model=list[CircuitTypeResponse],
    summary="List Circuit Types",
    description="List circuit types from NetBox",
)
async def list_circuit_types(
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[CircuitTypeResponse]:
    """List circuit types"""
    result = await service.list_circuit_types(limit=limit, offset=offset)
    return result


@router.post(
    "/circuits/circuit-types",
    response_model=CircuitTypeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Circuit Type",
    description="Create new circuit type in NetBox",
)
async def create_circuit_type(
    data: CircuitTypeCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CircuitTypeResponse:
    """Create circuit type"""
    try:
        return await service.create_circuit_type(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create circuit type: {str(e)}",
        )


@router.get(
    "/circuits/circuits",
    response_model=list[CircuitResponse],
    summary="List Circuits",
    description="List circuits from NetBox",
)
async def list_circuits(
    tenant: str | None = Query(None, description="Filter by tenant"),
    provider: str | None = Query(None, description="Filter by provider"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[CircuitResponse]:
    """List circuits"""
    result = await service.list_circuits(
        tenant=tenant, provider=provider, limit=limit, offset=offset
    )
    return result


@router.get(
    "/circuits/circuits/{circuit_id}",
    response_model=CircuitResponse,
    summary="Get Circuit",
    description="Get circuit details by ID",
)
async def get_circuit(
    circuit_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> CircuitResponse:
    """Get circuit by ID"""
    circuit = await service.get_circuit(circuit_id)
    if not circuit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit {circuit_id} not found",
        )
    return circuit


@router.post(
    "/circuits/circuits",
    response_model=CircuitResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Circuit",
    description="Create new circuit in NetBox",
)
async def create_circuit(
    data: CircuitCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CircuitResponse:
    """Create circuit"""
    try:
        return await service.create_circuit(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create circuit: {str(e)}",
        )


@router.patch(
    "/circuits/circuits/{circuit_id}",
    response_model=CircuitResponse,
    summary="Update Circuit",
    description="Update circuit in NetBox",
)
async def update_circuit(
    circuit_id: int,
    data: CircuitUpdate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CircuitResponse:
    """Update circuit"""
    circuit = await service.update_circuit(circuit_id, data)
    if not circuit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit {circuit_id} not found",
        )
    return circuit


@router.delete(
    "/circuits/circuits/{circuit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Circuit",
    description="Delete circuit from NetBox",
)
async def delete_circuit(
    circuit_id: int,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> None:
    """Delete circuit"""
    deleted = await service.delete_circuit(circuit_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit {circuit_id} not found",
        )
    return None


@router.get(
    "/circuits/circuit-terminations",
    response_model=list[CircuitTerminationResponse],
    summary="List Circuit Terminations",
    description="List circuit terminations from NetBox",
)
async def list_circuit_terminations(
    circuit_id: int | None = Query(None, description="Filter by circuit ID"),
    site: str | None = Query(None, description="Filter by site"),
    limit: int = Query(100, ge=1, le=1000, description="Results per page"),
    offset: int = Query(0, ge=0, description="Results offset"),
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.read")),
) -> list[CircuitTerminationResponse]:
    """List circuit terminations"""
    result = await service.list_circuit_terminations(
        circuit_id=circuit_id, site=site, limit=limit, offset=offset
    )
    return result


@router.post(
    "/circuits/circuit-terminations",
    response_model=CircuitTerminationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Circuit Termination",
    description="Create new circuit termination in NetBox",
)
async def create_circuit_termination(
    data: CircuitTerminationCreate,
    service: NetBoxService = Depends(get_netbox_service),
    _: UserInfo = Depends(require_permission("isp.ipam.write")),
) -> CircuitTerminationResponse:
    """Create circuit termination"""
    try:
        return await service.create_circuit_termination(data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create circuit termination: {str(e)}",
        )
