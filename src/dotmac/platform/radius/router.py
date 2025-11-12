"""
RADIUS API Router

FastAPI endpoints for RADIUS subscriber management, session tracking,
and accounting operations.
"""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.db import get_session_dependency
from dotmac.platform.radius.schemas import (
    BandwidthProfileCreate,
    BandwidthProfileResponse,
    BandwidthProfileUpdate,
    NASCreate,
    NASResponse,
    NASUpdate,
    RADIUSAuthorizationRequest,
    RADIUSAuthorizationResponse,
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
from dotmac.platform.tenant.dependencies import TenantAdminAccess

router = APIRouter(prefix="/radius", tags=["RADIUS"])
logger = structlog.get_logger(__name__)


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
) -> RADIUSSubscriberResponse:
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
) -> RADIUSSubscriberResponse:
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
) -> list[RADIUSSubscriberResponse]:
    """List RADIUS subscribers with pagination"""
    result = await service.list_subscribers(skip=skip, limit=limit)
    return result


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
) -> RADIUSSubscriberResponse:
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
) -> None:
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
) -> RADIUSSubscriberResponse:
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
) -> RADIUSSubscriberResponse:
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
) -> list[RADIUSSessionResponse]:
    """Get active RADIUS sessions"""
    result = await service.get_active_sessions(username=username)
    return result


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
) -> list[RADIUSSessionResponse]:
    """Get sessions for a subscriber"""
    result = await service.get_subscriber_sessions(
        subscriber_id=subscriber_id,
        active_only=active_only,
        skip=skip,
        limit=limit,
    )
    return result


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
) -> dict[str, Any]:
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
        session_id=data.acctsessionid,
        nas_ip=data.nasipaddress,
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
) -> RADIUSUsageResponse:
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
) -> NASResponse:
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
) -> NASResponse:
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
) -> list[NASResponse]:
    """List NAS devices"""
    result = await service.list_nas_devices(skip=skip, limit=limit)
    return result


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
) -> NASResponse:
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
) -> None:
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
) -> BandwidthProfileResponse:
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
) -> BandwidthProfileResponse:
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
) -> list[BandwidthProfileResponse]:
    """List bandwidth profiles"""
    result = await service.list_bandwidth_profiles(skip=skip, limit=limit)
    return result


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
) -> BandwidthProfileResponse:
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
) -> None:
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
) -> RADIUSAuthTestResponse:
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


@router.post(
    "/authorize",
    response_model=RADIUSAuthorizationResponse,
    summary="RADIUS Authorization with Option 82",
    description="Authorize RADIUS Access-Request with Option 82 validation (Phase 3)",
)
async def authorize_access(
    request: RADIUSAuthorizationRequest,
    service: RADIUSService = Depends(get_radius_service),
) -> RADIUSAuthorizationResponse:
    """
    Phase 3: RADIUS Authorization with Option 82 Validation

    This endpoint is designed to be called by FreeRADIUS via rlm_rest module.
    It performs:
    1. Subscriber authentication (username/password check)
    2. Option 82 validation (circuit-id, remote-id)
    3. VLAN attribute injection
    4. Bandwidth profile application
    5. IPv4/IPv6 address assignment

    Returns Access-Accept or Access-Reject with appropriate attributes.

    **Integration with FreeRADIUS**:
    Configure rlm_rest in FreeRADIUS to call this endpoint during authorization:

    ```
    rest {
        authorize {
            uri = "http://api:8000/api/v1/radius/authorize"
            method = "post"
            body = "json"
        }
    }
    ```

    **Option 82 Policies**:
    - ENFORCE: Deny access if Option 82 doesn't match expected values
    - LOG: Log mismatch but allow access
    - IGNORE: Skip Option 82 validation entirely
    """
    try:
        # Call service layer for authorization
        result = await service.authorize_subscriber(request)
        return result
    except ValueError as e:
        # Reject access for invalid requests
        return RADIUSAuthorizationResponse(
            accept=False,
            reason=str(e),
            reply_attributes={},
            option82_validation=None,
        )
    except Exception as e:
        # Log error and reject access
        logger.error(
            "radius.authorization.error",
            username=request.username,
            error=str(e),
            tenant_id=service.tenant_id,
        )
        return RADIUSAuthorizationResponse(
            accept=False,
            reason=f"Internal error during authorization: {str(e)}",
            reply_attributes={},
            option82_validation=None,
        )


# =============================================================================
# RADIUS Server Health Monitoring
# =============================================================================


@router.get(
    "/health",
    summary="RADIUS Server Health",
    description="Check FreeRADIUS server health and connectivity",
)
async def get_radius_health(
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
) -> dict[str, Any]:
    """
    Get comprehensive RADIUS server health status.

    Checks:
    - FreeRADIUS server connectivity
    - Database connectivity
    - Active sessions count
    - NAS devices count
    - Recent authentication failures
    """
    import os
    import socket
    import time

    health_data: dict[str, Any] = {
        "timestamp": time.time(),
        "status": "healthy",
        "checks": {},
    }

    # Check RADIUS server connectivity
    radius_host = os.getenv("RADIUS_SERVER_HOST", "localhost")
    radius_port = int(os.getenv("RADIUS_AUTH_PORT", "1812"))

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.settimeout(2)
            sock.connect((radius_host, radius_port))
            health_data["checks"]["radius_connectivity"] = {
                "status": "healthy",
                "message": f"RADIUS server reachable at {radius_host}:{radius_port}",
            }
    except Exception as e:
        health_data["status"] = "degraded"
        health_data["checks"]["radius_connectivity"] = {
            "status": "unhealthy",
            "message": f"RADIUS server unreachable: {str(e)}",
        }

    # Check database connectivity via session count
    try:
        active_sessions = await service.get_active_sessions()
        health_data["checks"]["database"] = {
            "status": "healthy",
            "message": "Database accessible",
            "active_sessions": len(active_sessions),
        }
    except Exception as e:
        health_data["status"] = "degraded"
        health_data["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database error: {str(e)}",
        }

    # Get NAS devices count
    try:
        nas_devices = await service.list_nas_devices()
        health_data["checks"]["nas_devices"] = {
            "status": "healthy",
            "count": len(nas_devices),
        }
    except Exception as e:
        health_data["checks"]["nas_devices"] = {
            "status": "degraded",
            "message": f"Failed to query NAS devices: {str(e)}",
        }

    # Check recent authentication failures (last 5 minutes)
    try:
        from datetime import datetime, timedelta

        from sqlalchemy import and_, func, select

        from dotmac.platform.radius.models import RadPostAuth

        five_minutes_ago = datetime.utcnow() - timedelta(minutes=5)

        stmt = (
            select(func.count())
            .select_from(RadPostAuth)
            .where(
                and_(
                    RadPostAuth.tenant_id == service.tenant_id,
                    RadPostAuth.authdate >= five_minutes_ago,
                    RadPostAuth.reply == "Access-Reject",
                )
            )
        )

        result = await service.session.execute(stmt)
        failure_count = result.scalar() or 0

        health_data["checks"]["authentication"] = {
            "status": "healthy" if failure_count < 100 else "degraded",
            "recent_failures": failure_count,
            "window_minutes": 5,
        }

        if failure_count >= 100:
            health_data["status"] = "degraded"

    except Exception as e:
        health_data["checks"]["authentication"] = {
            "status": "degraded",
            "message": f"Failed to query auth failures: {str(e)}",
        }

    return health_data


# =============================================================================
# RADIUS Attribute Dictionary
# =============================================================================


@router.get(
    "/attributes/standard",
    summary="List Standard RADIUS Attributes",
    description="Get list of standard RADIUS attributes (RFC 2865, 2866, etc.)",
)
async def list_standard_attributes(
    _: UserInfo = Depends(require_permission("isp.radius.read")),
) -> dict[str, Any]:
    """
    List all standard RADIUS attributes.

    Returns attributes from RFCs including:
    - RFC 2865: RADIUS base attributes
    - RFC 2866: RADIUS accounting
    - RFC 3162: RADIUS IPv6 support
    """
    from dotmac.platform.radius.attributes import registry

    return {
        "attributes": registry.list_standard_attributes(),
        "total": len(registry.standard_attrs),
    }


@router.get(
    "/attributes/vendor",
    summary="List Vendor-Specific RADIUS Attributes",
    description="Get list of vendor-specific RADIUS attributes (VSAs)",
)
async def list_vendor_attributes(
    vendor_id: int | None = Query(None, description="Filter by vendor ID"),
    _: UserInfo = Depends(require_permission("isp.radius.read")),
) -> dict[str, Any]:
    """
    List vendor-specific RADIUS attributes.

    Includes VSAs for:
    - Mikrotik (14988): Rate limiting, address lists
    - Cisco (9): AVPair, account info
    - WISPr (14122): Hotspot/captive portal
    """
    from dotmac.platform.radius.attributes import registry

    attrs = registry.list_vendor_attributes(vendor_id)
    return {
        "attributes": attrs,
        "total": len(attrs),
        "vendor_id": vendor_id,
    }


@router.get(
    "/attributes/check-items",
    summary="List RADIUS Check Attributes",
    description="Get attributes that can be used in radcheck table",
)
async def list_check_attributes(
    _: UserInfo = Depends(require_permission("isp.radius.read")),
) -> dict[str, Any]:
    """
    List RADIUS check attributes.

    These are attributes that can be used in the radcheck table
    for authentication and authorization checks.
    """
    from dotmac.platform.radius.attributes import registry

    return {
        "attributes": registry.list_check_items(),
        "total": len([a for a in registry.standard_attrs.values() if a.check_item]),
    }


@router.get(
    "/attributes/reply-items",
    summary="List RADIUS Reply Attributes",
    description="Get attributes that can be used in radreply table",
)
async def list_reply_attributes(
    _: UserInfo = Depends(require_permission("isp.radius.read")),
) -> dict[str, Any]:
    """
    List RADIUS reply attributes.

    These are attributes that can be used in the radreply table
    for sending authorization responses to users.
    """
    from dotmac.platform.radius.attributes import registry

    return {
        "attributes": registry.list_reply_items(),
        "total": len([a for a in registry.standard_attrs.values() if a.reply_item]),
    }


# =============================================================================
# Password Security Monitoring
# =============================================================================


@router.get(
    "/security/password-stats",
    summary="Password Hashing Statistics",
    description="Get statistics on password hashing methods used across RADIUS subscribers",
)
async def get_password_hashing_stats(
    service: RADIUSService = Depends(get_radius_service),
    _: UserInfo = Depends(require_permission("isp.radius.admin")),
) -> dict[str, Any]:
    """
    Get password hashing statistics.

    Returns counts and percentages of subscribers using different
    password hashing methods (cleartext, MD5, SHA256, bcrypt).

    Useful for tracking security posture and migration progress.
    """
    return await service.get_password_hashing_stats()


@router.get(
    "/subscribers/{subscriber_id}/alerts",
    summary="Get subscriber alerts",
    description="Get active alerts for a subscriber (Option 82 mismatches, auth failures, etc.)",
)
async def get_subscriber_alerts(
    subscriber_id: str,
    current_user: UserInfo = Depends(require_permission("isp.radius.read")),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[dict[str, Any]]:
    """
    Get active alerts for a subscriber.

    Returns alerts with:
    - Severity levels (critical, warning, info)
    - Alert types (option82_mismatch, auth_failure, session_anomaly)
    - Timestamps and details
    """
    from sqlalchemy import select

    from dotmac.platform.network.models import Option82Policy, SubscriberNetworkProfile
    from dotmac.platform.subscribers.models import Subscriber

    tenant_id = current_user.tenant_id
    if not tenant_id:
        return []

    alerts = []

    # Get subscriber
    stmt = select(Subscriber).where(
        Subscriber.id == subscriber_id,
        Subscriber.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    subscriber = result.scalar_one_or_none()

    if not subscriber:
        return []

    # Check for Option 82 enforcement profile
    profile_stmt = select(SubscriberNetworkProfile).where(
        SubscriberNetworkProfile.subscriber_id == subscriber_id,
        SubscriberNetworkProfile.tenant_id == tenant_id,
    )
    profile_result = await db.execute(profile_stmt)
    profile = profile_result.scalar_one_or_none()

    if profile and profile.option82_policy == Option82Policy.ENFORCE:
        if profile.circuit_id or profile.remote_id:
            alerts.append(
                {
                    "id": f"opt82_{subscriber_id}",
                    "type": "option82_configured",
                    "severity": "info",
                    "title": "Option 82 Enforcement Active",
                    "message": "DHCP Option 82 validation is enforced for this subscriber",
                    "timestamp": profile.updated_at.isoformat() if profile.updated_at else None,
                }
            )

    # Check for recent authentication failures (last 7 days)
    # TODO: Implement Radpostauth model and import it to enable this feature
    # seven_days_ago = datetime.now(UTC) - timedelta(days=7)

    # try:
    #     # Query radpostauth for recent failures
    #     auth_failure_stmt = select(func.count()).where(
    #         and_(
    #             Radpostauth.username == subscriber.username,
    #             Radpostauth.reply == "Access-Reject",
    #             Radpostauth.authdate >= seven_days_ago,
    #         )
    #     )
    #     result = await db.execute(auth_failure_stmt)
    #     failure_count = result.scalar() or 0

    #     if failure_count > 0:
    #         severity = "critical" if failure_count > 10 else "warning"
    #         alerts.append({
    #             "id": f"auth_fail_{subscriber_id}",
    #             "type": "auth_failure",
    #             "severity": severity,
    #             "title": f"{failure_count} Authentication Failures",
    #             "message": f"Subscriber has {failure_count} failed auth attempts in the last 7 days",
    #             "timestamp": datetime.now(UTC).isoformat(),
    #             "count": failure_count,
    #         })
    # except Exception:
    #     # radpostauth table might not exist or be accessible
    #     pass

    return alerts
