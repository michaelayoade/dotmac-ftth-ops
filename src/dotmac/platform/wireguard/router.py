"""
WireGuard VPN API Router.

FastAPI router for WireGuard VPN management endpoints.
"""

import base64
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.auth.tenant_context import TenantAdminAccess
from dotmac.platform.db import get_session_dependency
from dotmac.platform.secrets import AsyncVaultClient, SymmetricEncryptionService
from dotmac.platform.wireguard.client import WireGuardClient
from dotmac.platform.wireguard.models import WireGuardPeer, WireGuardPeerStatus, WireGuardServer
from dotmac.platform.wireguard.schemas import (
    WireGuardBulkPeerCreate,
    WireGuardBulkPeerCreateResponse,
    WireGuardDashboardStatsResponse,
    WireGuardPeerConfigResponse,
    WireGuardPeerCreate,
    WireGuardPeerListResponse,
    WireGuardPeerResponse,
    WireGuardPeerUpdate,
    WireGuardServerCreate,
    WireGuardServerHealthResponse,
    WireGuardServerListResponse,
    WireGuardServerResponse,
    WireGuardServerUpdate,
    WireGuardServiceProvisionRequest,
    WireGuardServiceProvisionResponse,
    WireGuardSyncStatsRequest,
    WireGuardSyncStatsResponse,
)
from dotmac.platform.wireguard.service import WireGuardService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wireguard", tags=["WireGuard VPN"])


# ========================================================================
# Dependency Injection
# ========================================================================


async def get_wireguard_service(
    tenant_access: Annotated[TenantAdminAccess, Depends(TenantAdminAccess)],
    session: AsyncSession = Depends(get_session_dependency),
) -> WireGuardService:
    """Get WireGuard service instance for the active tenant (Pure Vault mode in production)."""
    from dotmac.platform.settings import settings

    tenant = tenant_access.tenant

    # Initialize WireGuard client
    client = WireGuardClient(
        container_name="isp-wireguard",
        config_base_path="/config",
        server_interface="wg0",
    )

    # Pure Vault Mode: In production, Vault is REQUIRED
    vault_client = None
    encryption_service = None

    if settings.vault.enabled:
        # Production: Use Vault for all WireGuard private keys
        try:
            vault_client = AsyncVaultClient(
                url=settings.vault.url,
                token=settings.vault.token,
                mount_path=settings.vault.mount_path,
                kv_version=settings.vault.kv_version,
                namespace=settings.vault.namespace,
            )
            logger.info("✅ WireGuard service initialized with Vault/OpenBao secret storage (Pure Vault mode)")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Vault client: {e}")
            if settings.is_production:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="WireGuard service unavailable: Vault connection required in production but failed"
                ) from e
            # Development: Fall back to encryption
            encryption_service = SymmetricEncryptionService(secret=settings.secret_key)
            logger.warning("⚠️  Falling back to encrypted database storage (development only)")
    else:
        # Development/Test only: Use encryption service
        if settings.is_production:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="WireGuard service unavailable: Vault MUST be enabled in production"
            )
        encryption_service = SymmetricEncryptionService(secret=settings.secret_key)
        logger.warning("⚠️  WireGuard using encrypted database storage (Vault disabled - development only)")

    return WireGuardService(
        session=session,
        client=client,
        tenant_id=tenant.id,
        encryption_service=encryption_service,
        vault_client=vault_client,
    )


# ========================================================================
# Server Endpoints
# ========================================================================


@router.post(
    "/servers",
    response_model=WireGuardServerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create WireGuard Server",
)
async def create_server(
    request: WireGuardServerCreate,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardServer:
    """
    Create a new WireGuard VPN server.

    This endpoint creates a new WireGuard server configuration with:
    - Automatically generated server keypair
    - Encrypted private key storage
    - Network configuration (IP, port, DNS)
    - Peer capacity management

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        server = await service.create_server(
            name=request.name,
            public_endpoint=request.public_endpoint,
            server_ipv4=request.server_ipv4,
            listen_port=request.listen_port,
            description=request.description,
            location=request.location,
            max_peers=request.max_peers,
            dns_servers=request.dns_servers,
            allowed_ips=request.allowed_ips,
        )
        return server
    except Exception as e:
        logger.error(f"Failed to create WireGuard server: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create server: {str(e)}",
        ) from e


@router.get(
    "/servers",
    response_model=WireGuardServerListResponse,
    summary="List WireGuard Servers",
)
async def list_servers(
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="Filter by server status"),
    ] = None,
    location: Annotated[
        str | None,
        Query(description="Filter by location"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardServerListResponse:
    """
    List WireGuard servers with optional filtering.

    **Filters:**
    - `status`: Filter by server status (active, inactive, degraded, maintenance)
    - `location`: Filter by server location

    **Required Permission:** `isp.wireguard.read`
    """
    from dotmac.platform.wireguard.models import WireGuardServerStatus

    status_enum = None
    if status_filter:
        try:
            status_enum = WireGuardServerStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    servers = await service.list_servers(
        status=status_enum,
        location=location,
        limit=limit,
        offset=offset,
    )

    # Get total count
    query = select(func.count(WireGuardServer.id)).where(
        WireGuardServer.tenant_id == service.tenant_id,
        WireGuardServer.deleted_at.is_(None),
    )
    if status_enum:
        query = query.where(WireGuardServer.status == status_enum)
    if location:
        query = query.where(WireGuardServer.location == location)

    result = await service.session.execute(query)
    total = result.scalar_one()

    return WireGuardServerListResponse(
        servers=servers,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/servers/{server_id}",
    response_model=WireGuardServerResponse,
    summary="Get WireGuard Server",
)
async def get_server(
    server_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardServer:
    """
    Get WireGuard server by ID.

    **Required Permission:** `isp.wireguard.read`
    """
    server = await service.get_server(server_id)
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server {server_id} not found",
        )
    return server


@router.patch(
    "/servers/{server_id}",
    response_model=WireGuardServerResponse,
    summary="Update WireGuard Server",
)
async def update_server(
    server_id: UUID,
    request: WireGuardServerUpdate,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardServer:
    """
    Update WireGuard server configuration.

    **Updatable Fields:**
    - name, description, status
    - max_peers, dns_servers, allowed_ips
    - location, metadata

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        updates = request.model_dump(exclude_unset=True)
        server = await service.update_server(server_id, **updates)
        return server
    except Exception as e:
        logger.error(f"Failed to update server {server_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update server: {str(e)}",
        ) from e


@router.delete(
    "/servers/{server_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete WireGuard Server",
)
async def delete_server(
    server_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> None:
    """
    Delete (soft delete) a WireGuard server.

    This will mark the server as deleted and set status to inactive.
    All associated peers will also be soft deleted.

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        await service.delete_server(server_id)
    except Exception as e:
        logger.error(f"Failed to delete server {server_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete server: {str(e)}",
        ) from e


@router.get(
    "/servers/{server_id}/health",
    response_model=WireGuardServerHealthResponse,
    summary="Get Server Health",
)
async def get_server_health(
    server_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardServerHealthResponse:
    """
    Get WireGuard server health status.

    Checks:
    - WireGuard interface status
    - Peer connectivity
    - Capacity utilization

    **Required Permission:** `isp.wireguard.read`
    """
    try:
        health = await service.get_server_health(server_id)
        return WireGuardServerHealthResponse(**health)
    except Exception as e:
        logger.error(f"Health check failed for server {server_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Health check failed: {str(e)}",
        ) from e


# ========================================================================
# Peer Endpoints
# ========================================================================


@router.post(
    "/peers",
    response_model=WireGuardPeerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create WireGuard Peer",
)
async def create_peer(
    request: WireGuardPeerCreate,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardPeer:
    """
    Create a new WireGuard peer (VPN client).

    This endpoint creates a peer with:
    - Automatic keypair generation (optional)
    - Automatic IP allocation
    - Generated configuration file
    - Customer/Subscriber linkage

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        peer = await service.create_peer(
            server_id=request.server_id,
            name=request.name,
            customer_id=request.customer_id,
            subscriber_id=request.subscriber_id,
            description=request.description,
            generate_keys=request.generate_keys,
            public_key=request.public_key,
            peer_ipv4=request.peer_ipv4,
            allowed_ips=request.allowed_ips,
        )
        return peer
    except Exception as e:
        logger.error(f"Failed to create WireGuard peer: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create peer: {str(e)}",
        ) from e


@router.get(
    "/peers",
    response_model=WireGuardPeerListResponse,
    summary="List WireGuard Peers",
)
async def list_peers(
    server_id: Annotated[UUID | None, Query(description="Filter by server ID")] = None,
    customer_id: Annotated[UUID | None, Query(description="Filter by customer ID")] = None,
    subscriber_id: Annotated[str | None, Query(description="Filter by subscriber ID")] = None,
    status_filter: Annotated[
        str | None,
        Query(alias="status", description="Filter by peer status"),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardPeerListResponse:
    """
    List WireGuard peers with optional filtering.

    **Filters:**
    - `server_id`: Filter by server
    - `customer_id`: Filter by customer
    - `subscriber_id`: Filter by subscriber
    - `status`: Filter by peer status

    **Required Permission:** `isp.wireguard.read`
    """
    status_enum = None
    if status_filter:
        try:
            status_enum = WireGuardPeerStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )

    peers = await service.list_peers(
        server_id=server_id,
        customer_id=customer_id,
        subscriber_id=subscriber_id,
        status=status_enum,
        limit=limit,
        offset=offset,
    )

    # Get total count
    query = select(func.count(WireGuardPeer.id)).where(
        WireGuardPeer.tenant_id == service.tenant_id,
        WireGuardPeer.deleted_at.is_(None),
    )
    if server_id:
        query = query.where(WireGuardPeer.server_id == server_id)
    if customer_id:
        query = query.where(WireGuardPeer.customer_id == customer_id)
    if subscriber_id:
        query = query.where(WireGuardPeer.subscriber_id == subscriber_id)
    if status_enum:
        query = query.where(WireGuardPeer.status == status_enum)

    result = await service.session.execute(query)
    total = result.scalar_one()

    return WireGuardPeerListResponse(
        peers=peers,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/peers/{peer_id}",
    response_model=WireGuardPeerResponse,
    summary="Get WireGuard Peer",
)
async def get_peer(
    peer_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardPeer:
    """
    Get WireGuard peer by ID.

    **Required Permission:** `isp.wireguard.read`
    """
    peer = await service.get_peer(peer_id)
    if not peer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Peer {peer_id} not found",
        )
    return peer


@router.patch(
    "/peers/{peer_id}",
    response_model=WireGuardPeerResponse,
    summary="Update WireGuard Peer",
)
async def update_peer(
    peer_id: UUID,
    request: WireGuardPeerUpdate,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardPeer:
    """
    Update WireGuard peer configuration.

    **Updatable Fields:**
    - name, description, status, enabled
    - allowed_ips, expires_at
    - metadata, notes

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        updates = request.model_dump(exclude_unset=True)
        peer = await service.update_peer(peer_id, **updates)
        return peer
    except Exception as e:
        logger.error(f"Failed to update peer {peer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update peer: {str(e)}",
        ) from e


@router.delete(
    "/peers/{peer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete WireGuard Peer",
)
async def delete_peer(
    peer_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> None:
    """
    Delete (soft delete) a WireGuard peer.

    This will mark the peer as deleted and update server peer count.

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        await service.delete_peer(peer_id)
    except Exception as e:
        logger.error(f"Failed to delete peer {peer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete peer: {str(e)}",
        ) from e


@router.get(
    "/peers/{peer_id}/config",
    response_model=WireGuardPeerConfigResponse,
    summary="Get Peer Configuration",
)
async def get_peer_config(
    peer_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardPeerConfigResponse:
    """
    Get WireGuard peer configuration file.

    Returns the complete WireGuard configuration file that can be
    imported into WireGuard clients.

    **Required Permission:** `isp.wireguard.read`
    """
    try:
        peer = await service.get_peer(peer_id)
        if not peer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Peer {peer_id} not found",
            )

        config_file = await service.get_peer_config(peer_id)
        return WireGuardPeerConfigResponse(
            peer_id=peer.id,
            peer_name=peer.name,
            config_file=config_file,
            created_at=peer.created_at,
        )
    except Exception as e:
        logger.error(f"Failed to get peer config for {peer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get peer config: {str(e)}",
        ) from e


@router.post(
    "/peers/{peer_id}/regenerate",
    response_model=WireGuardPeerResponse,
    summary="Regenerate Peer Configuration",
)
async def regenerate_peer_config(
    peer_id: UUID,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardPeer:
    """
    Regenerate peer configuration with new keys.

    This will generate a new keypair and configuration file for the peer.
    Useful for key rotation or security incidents.

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        peer = await service.regenerate_peer_config(peer_id)
        return peer
    except Exception as e:
        logger.error(f"Failed to regenerate config for peer {peer_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to regenerate config: {str(e)}",
        ) from e


# ========================================================================
# Bulk Operations
# ========================================================================


@router.post(
    "/peers/bulk",
    response_model=WireGuardBulkPeerCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Bulk Create Peers",
)
async def bulk_create_peers(
    request: WireGuardBulkPeerCreate,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardBulkPeerCreateResponse:
    """
    Create multiple WireGuard peers at once.

    Useful for provisioning multiple customers or devices.

    **Required Permission:** `isp.wireguard.write`
    """
    created_peers = []
    errors = []

    for i in range(1, request.count + 1):
        peer_name = f"{request.name_prefix}{i}"

        try:
            peer = await service.create_peer(
                server_id=request.server_id,
                name=peer_name,
                customer_id=request.customer_id,
                description=request.description,
                allowed_ips=request.allowed_ips,
            )
            created_peers.append(peer)

        except Exception as e:
            logger.error(f"Failed to create peer {peer_name}: {e}")
            errors.append({
                "peer_name": peer_name,
                "error": str(e),
            })

    return WireGuardBulkPeerCreateResponse(
        created=len(created_peers),
        peers=created_peers,
        errors=errors,
    )


# ========================================================================
# Statistics and Monitoring
# ========================================================================


@router.post(
    "/stats/sync",
    response_model=WireGuardSyncStatsResponse,
    summary="Sync Peer Statistics",
)
async def sync_peer_stats(
    request: WireGuardSyncStatsRequest,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardSyncStatsResponse:
    """
    Synchronize peer statistics from WireGuard container to database.

    This endpoint:
    - Queries WireGuard for current peer stats (handshake, traffic)
    - Updates database records with latest data
    - Updates peer online/offline status

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        peers_updated = await service.sync_peer_stats(request.server_id)
        return WireGuardSyncStatsResponse(
            server_id=request.server_id,
            peers_updated=peers_updated,
        )
    except Exception as e:
        logger.error(f"Failed to sync stats for server {request.server_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync stats: {str(e)}",
        ) from e


@router.get(
    "/dashboard",
    response_model=WireGuardDashboardStatsResponse,
    summary="Get Dashboard Statistics",
)
async def get_dashboard_stats(
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.read")),
) -> WireGuardDashboardStatsResponse:
    """
    Get WireGuard dashboard statistics for tenant.

    Returns:
    - Server counts by status
    - Peer counts by status
    - Total traffic statistics

    **Required Permission:** `isp.wireguard.read`
    """
    try:
        stats = await service.get_dashboard_stats()
        return WireGuardDashboardStatsResponse(**stats)
    except Exception as e:
        logger.error(f"Failed to get dashboard stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard stats: {str(e)}",
        ) from e


# ========================================================================
# Service Provisioning (Integration with Service Lifecycle)
# ========================================================================


@router.post(
    "/provision",
    response_model=WireGuardServiceProvisionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision VPN Service for Customer",
)
async def provision_vpn_service(
    request: WireGuardServiceProvisionRequest,
    service: WireGuardService = Depends(get_wireguard_service),
    _: UserInfo = Depends(require_permission("isp.wireguard.write")),
) -> WireGuardServiceProvisionResponse:
    """
    Provision VPN service for a customer (service lifecycle integration).

    This endpoint:
    1. Selects optimal server (or uses specified server)
    2. Creates peer for customer
    3. Generates configuration
    4. Returns complete provisioning details

    **Required Permission:** `isp.wireguard.write`
    """
    try:
        # Select server
        if request.server_id:
            server = await service.get_server(request.server_id)
            if not server:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Server {request.server_id} not found",
                )
        else:
            # Auto-select server with capacity
            servers = await service.list_servers(limit=100)
            available_servers = [s for s in servers if s.has_capacity and s.is_active]

            if not available_servers:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="No available WireGuard servers with capacity",
                )

            # Select least utilized server
            server = min(available_servers, key=lambda s: s.utilization_percent)

        # Create peer
        peer_name = request.peer_name or f"customer-{request.customer_id}"

        peer = await service.create_peer(
            server_id=server.id,
            name=peer_name,
            customer_id=request.customer_id,
            subscriber_id=request.subscriber_id,
            allowed_ips=request.allowed_ips,
        )

        # Get config
        config_file = await service.get_peer_config(peer.id)

        return WireGuardServiceProvisionResponse(
            server=server,
            peer=peer,
            config_file=config_file,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to provision VPN service: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision VPN service: {str(e)}",
        ) from e
