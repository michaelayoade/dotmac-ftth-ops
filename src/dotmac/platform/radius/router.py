"""
RADIUS API Router

FastAPI endpoints for RADIUS subscriber management, session tracking,
and accounting operations.
"""


from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.tenant.dependencies import TenantAdminAccess
from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    BandwidthProfileResponse,
    BandwidthProfileUpdate,
    NASCreate,
    NASResponse,
    NASUpdate,
    RADIUSAuthTest,
    RADIUSAuthTestResponse,
    RADIUSSessionDisconnect,
    RADIUSSessionResponse,
    RADIUSSubscriberCreate,
    RADIUSSubscriberResponse,
    RADIUSSubscriberUpdate,
    RADIUSUsageQuery,
    RADIUSUsageResponse,
)
from dotmac.platform.radius.service import RADIUSService

router = APIRouter(prefix="/api/v1/radius", tags=["radius"])


# =============================================================================
# Dependency: Get RADIUS Service
# =============================================================================


async def get_radius_service(
    tenant_access: TenantAdminAccess,
    session: AsyncSession = Depends(get_session_dependency),
) -> RADIUSService:
    """Get RADIUS service instance for the active tenant."""
    _, tenant = tenant_access
    return RADIUSService(session, tenant.id)


# =============================================================================
# Subscriber Management Endpoints
# =============================================================================


@router.post(
    "/subscribers",
    response_model=RADIUSSubscriberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create RADIUS Subscriber",
    description="Create RADIUS authentication credentials for a subscriber",
)
async def create_subscriber(
    data: RADIUSSubscriberCreate,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Create RADIUS subscriber with authentication and bandwidth profile"""
    try:
        return await service.create_subscriber(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create RADIUS subscriber: {str(e)}",
        )


@router.get(
    "/subscribers/{username}",
    response_model=RADIUSSubscriberResponse,
    summary="Get RADIUS Subscriber",
    description="Get RADIUS subscriber details by username",
)
async def get_subscriber(
    username: str,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """Get RADIUS subscriber by username"""
    subscriber = await service.get_subscriber(username)
    if not subscriber:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RADIUS subscriber '{username}' not found",
        )
    return subscriber


@router.get(
    "/subscribers",
    response_model=list[RADIUSSubscriberResponse],
    summary="List RADIUS Subscribers",
    description="List all RADIUS subscribers for the tenant",
)
async def list_subscribers(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """List RADIUS subscribers with pagination"""
    return await service.list_subscribers(skip=skip, limit=limit)


@router.patch(
    "/subscribers/{username}",
    response_model=RADIUSSubscriberResponse,
    summary="Update RADIUS Subscriber",
    description="Update RADIUS subscriber credentials or attributes",
)
async def update_subscriber(
    username: str,
    data: RADIUSSubscriberUpdate,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Update RADIUS subscriber"""
    try:
        subscriber = await service.update_subscriber(username, data)
        if not subscriber:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RADIUS subscriber '{username}' not found",
            )
        return subscriber
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update RADIUS subscriber: {str(e)}",
        )


@router.delete(
    "/subscribers/{username}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete RADIUS Subscriber",
    description="Delete RADIUS subscriber and all associated data",
)
async def delete_subscriber(
    username: str,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Delete RADIUS subscriber"""
    deleted = await service.delete_subscriber(username)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RADIUS subscriber '{username}' not found",
        )
    return None


@router.post(
    "/subscribers/{username}/enable",
    response_model=RADIUSSubscriberResponse,
    summary="Enable RADIUS Subscriber",
    description="Enable RADIUS authentication for subscriber",
)
async def enable_subscriber(
    username: str,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Enable RADIUS subscriber"""
    try:
        subscriber = await service.enable_subscriber(username)
        if not subscriber:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RADIUS subscriber '{username}' not found",
            )
        return subscriber
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to enable subscriber: {str(e)}",
        )


@router.post(
    "/subscribers/{username}/disable",
    response_model=RADIUSSubscriberResponse,
    summary="Disable RADIUS Subscriber",
    description="Disable RADIUS authentication for subscriber",
)
async def disable_subscriber(
    username: str,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Disable RADIUS subscriber"""
    try:
        subscriber = await service.disable_subscriber(username)
        if not subscriber:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"RADIUS subscriber '{username}' not found",
            )
        return subscriber
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to disable subscriber: {str(e)}",
        )


# =============================================================================
# Session Management Endpoints
# =============================================================================


@router.get(
    "/sessions",
    response_model=list[RADIUSSessionResponse],
    summary="Get Active Sessions",
    description="Get all active RADIUS sessions for the tenant",
)
async def get_active_sessions(
    username: str | None = Query(None, description="Filter by username"),
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """Get active RADIUS sessions"""
    return await service.get_active_sessions(username=username)


@router.get(
    "/sessions/{subscriber_id}",
    response_model=list[RADIUSSessionResponse],
    summary="Get Subscriber Sessions",
    description="Get RADIUS sessions for a specific subscriber",
)
async def get_subscriber_sessions(
    subscriber_id: str,
    active_only: bool = Query(False, description="Return only active sessions"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """Get sessions for a subscriber"""
    return await service.get_subscriber_sessions(
        subscriber_id=subscriber_id,
        active_only=active_only,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/sessions/disconnect",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Disconnect RADIUS Session",
    description="Send CoA/DM disconnect request to terminate session",
)
async def disconnect_session(
    data: RADIUSSessionDisconnect,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.sessions.manage")),
):
    """
    Disconnect RADIUS session using RFC 5176 CoA/DM.

    Sends a Disconnect-Request packet to the RADIUS server, which forwards
    it to the NAS to forcefully terminate the session.

    Requirements:
    - FreeRADIUS server must have CoA enabled (listen on port 3799)
    - NAS must support RFC 5176 Disconnect Messages
    - radclient tool must be installed in the container

    Returns:
    - success: True if CoA packet was sent successfully
    - message: Status message
    - details: Raw output from RADIUS server
    """
    result = await service.disconnect_session(
        username=data.username,
        session_id=data.session_id,
        nas_ip=data.nas_ip,
    )

    return result


# =============================================================================
# Accounting & Usage Endpoints
# =============================================================================


@router.post(
    "/accounting/usage",
    response_model=RADIUSUsageResponse,
    summary="Get Usage Statistics",
    description="Get RADIUS accounting usage statistics",
)
async def get_usage_stats(
    query: RADIUSUsageQuery,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """Get usage statistics for subscriber or tenant"""
    try:
        return await service.get_usage_stats(query)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve usage stats: {str(e)}",
        )


# =============================================================================
# NAS Management Endpoints
# =============================================================================


@router.post(
    "/nas",
    response_model=NASResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create NAS Device",
    description="Register a new Network Access Server (router/OLT/AP)",
)
async def create_nas(
    data: NASCreate,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Create NAS device"""
    try:
        return await service.create_nas(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create NAS: {str(e)}",
        )


@router.get(
    "/nas/{nas_id}",
    response_model=NASResponse,
    summary="Get NAS Device",
    description="Get NAS device details by ID",
)
async def get_nas(
    nas_id: int,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """Get NAS device by ID"""
    nas = await service.get_nas(nas_id)
    if not nas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NAS device {nas_id} not found",
        )
    return nas


@router.get(
    "/nas",
    response_model=list[NASResponse],
    summary="List NAS Devices",
    description="List all NAS devices for the tenant",
)
async def list_nas_devices(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
):
    """List NAS devices"""
    return await service.list_nas_devices(skip=skip, limit=limit)


@router.patch(
    "/nas/{nas_id}",
    response_model=NASResponse,
    summary="Update NAS Device",
    description="Update NAS device configuration",
)
async def update_nas(
    nas_id: int,
    data: NASUpdate,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Update NAS device"""
    try:
        nas = await service.update_nas(nas_id, data)
        if not nas:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"NAS device {nas_id} not found",
            )
        return nas
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update NAS: {str(e)}",
        )


@router.delete(
    "/nas/{nas_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete NAS Device",
    description="Delete NAS device",
)
async def delete_nas(
    nas_id: int,
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.write")),
):
    """Delete NAS device"""
    deleted = await service.delete_nas(nas_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"NAS device {nas_id} not found",
        )
    return None


# =============================================================================
# Bandwidth Profile Endpoints
# =============================================================================


@router.post(
    "/bandwidth-profiles",
    response_model=BandwidthProfileResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Bandwidth Profile",
    description="Create a bandwidth rate limiting profile",
)
async def create_bandwidth_profile(
    data: BandwidthProfileCreate,
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """Create bandwidth profile"""
    try:
        return await service.create_bandwidth_profile(data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create bandwidth profile: {str(e)}",
        )


@router.get(
    "/bandwidth-profiles/{profile_id}",
    response_model=BandwidthProfileResponse,
    summary="Get Bandwidth Profile",
    description="Get bandwidth profile details by ID",
)
async def get_bandwidth_profile(
    profile_id: str,
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """Get bandwidth profile by ID"""
    profile = await service.get_bandwidth_profile(profile_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bandwidth profile '{profile_id}' not found",
        )
    return profile


@router.get(
    "/bandwidth-profiles",
    response_model=list[BandwidthProfileResponse],
    summary="List Bandwidth Profiles",
    description="List all bandwidth profiles for the tenant",
)
async def list_bandwidth_profiles(
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """List bandwidth profiles"""
    return await service.list_bandwidth_profiles(skip=skip, limit=limit)


@router.patch(
    "/bandwidth-profiles/{profile_id}",
    response_model=BandwidthProfileResponse,
    summary="Update Bandwidth Profile",
    description="Update bandwidth profile rates",
)
async def update_bandwidth_profile(
    profile_id: str,
    data: BandwidthProfileUpdate,
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """Update bandwidth profile"""
    try:
        profile = await service.update_bandwidth_profile(profile_id, data)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Bandwidth profile '{profile_id}' not found",
            )
        return profile
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update bandwidth profile: {str(e)}",
        )


@router.delete(
    "/bandwidth-profiles/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Bandwidth Profile",
    description="Delete bandwidth profile",
)
async def delete_bandwidth_profile(
    profile_id: str,
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """Delete bandwidth profile"""
    deleted = await service.delete_bandwidth_profile(profile_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bandwidth profile '{profile_id}' not found",
        )
    return None


# =============================================================================
# Testing & Diagnostics Endpoints
# =============================================================================


@router.post(
    "/test/auth",
    response_model=RADIUSAuthTestResponse,
    summary="Test RADIUS Authentication",
    description="Test RADIUS authentication against the database (not actual RADIUS server)",
)
async def test_authentication(
    data: RADIUSAuthTest,
    service: RADIUSService = Depends(get_radius_service),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    Test RADIUS authentication

    Note: This tests against the database only, not the actual RADIUS server.
    For full testing, use radtest or radclient tools against FreeRADIUS.
    """
    import time

    start_time = time.time()

    # Check if user exists
    subscriber = await service.get_subscriber(data.username)
    if not subscriber:
        return RADIUSAuthTestResponse(
            success=False,
            message=f"User '{data.username}' not found in RADIUS database",
            response_time_ms=round((time.time() - start_time) * 1000, 2),
        )

    # Check password (this is simplified - actual RADIUS has more complex logic)
    radcheck = await service.repository.get_radcheck_by_username(service.tenant_id, data.username)
    if not radcheck or radcheck.value != data.password:
        return RADIUSAuthTestResponse(
            success=False,
            message="Authentication failed: Invalid password",
            response_time_ms=round((time.time() - start_time) * 1000, 2),
        )

    # Get reply attributes
    radreplies = await service.repository.get_radreplies_by_username(
        service.tenant_id, data.username
    )
    attributes = {reply.attribute: reply.value for reply in radreplies}

    return RADIUSAuthTestResponse(
        success=True,
        message="Authentication successful",
        attributes=attributes,
        response_time_ms=round((time.time() - start_time) * 1000, 2),
    )
