"""
Field Service API Router

Endpoints for technician management, location tracking, and job assignment.
"""

from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import (
    require_field_service_geofence_read,
    require_field_service_technician_location,
    require_field_service_technician_read,
)
from dotmac.platform.db import get_async_session
from dotmac.platform.field_service.geofencing_service import GeofencingService
from dotmac.platform.field_service.models import (
    Technician,
    TechnicianLocationHistory,
    TechnicianStatus,
)
from dotmac.platform.field_service.schemas import (
    TechnicianListResponse,
    TechnicianLocationResponse,
    TechnicianLocationUpdate,
    TechnicianResponse,
)
from dotmac.platform.field_service.websocket_manager import ws_manager

router = APIRouter(prefix="/field-service", tags=["field-service"])


def _require_tenant_id(user: UserInfo) -> str:
    """Ensure field-service operations execute within a tenant scope."""
    tenant_id = user.effective_tenant_id
    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for field-service operations.",
        )
    return tenant_id


@router.get("/technicians", response_model=TechnicianListResponse)
async def list_technicians(
    status: TechnicianStatus | None = None,
    is_active: bool | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserInfo = Depends(require_field_service_technician_read),
    session: AsyncSession = Depends(get_async_session),
) -> TechnicianListResponse:
    """
    List technicians with optional filtering.

    Args:
        status: Filter by technician status (available, on_job, etc.)
        is_active: Filter by active status
        limit: Maximum number of results
        offset: Pagination offset
    """
    tenant_id = _require_tenant_id(current_user)

    # Build query
    query = select(Technician).where(Technician.tenant_id == tenant_id)

    if status is not None:
        query = query.where(Technician.status == status)

    if is_active is not None:
        query = query.where(Technician.is_active == is_active)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await session.execute(count_query)).scalar() or 0

    # Add pagination
    query = query.offset(offset).limit(limit)

    # Execute
    result = await session.execute(query)
    technicians = list(result.scalars().all())

    page = (offset // limit) + 1 if limit else 1

    return TechnicianListResponse(
        technicians=[TechnicianResponse.model_validate(t) for t in technicians],
        total=total,
        limit=limit,
        offset=offset,
        page=page,
        page_size=limit,
    )


@router.get("/technicians/{technician_id}", response_model=TechnicianResponse)
async def get_technician(
    technician_id: UUID,
    current_user: UserInfo = Depends(require_field_service_technician_read),
    session: AsyncSession = Depends(get_async_session),
) -> TechnicianResponse:
    """Get technician details by ID."""
    tenant_id = _require_tenant_id(current_user)

    query = select(Technician).where(
        and_(
            Technician.id == technician_id,
            Technician.tenant_id == tenant_id,
        )
    )

    result = await session.execute(query)
    technician = result.scalar_one_or_none()

    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    return TechnicianResponse.model_validate(technician)


@router.post("/technicians/{technician_id}/location", response_model=TechnicianLocationResponse)
async def update_technician_location(
    technician_id: UUID,
    location_data: TechnicianLocationUpdate,
    current_user: UserInfo = Depends(require_field_service_technician_location),
    session: AsyncSession = Depends(get_async_session),
) -> TechnicianLocationResponse:
    """
    Update technician's current location.

    This endpoint is called by mobile technician app to report GPS location.
    """
    tenant_id = _require_tenant_id(current_user)

    # Get technician
    query = select(Technician).where(
        and_(
            Technician.id == technician_id,
            Technician.tenant_id == tenant_id,
        )
    )

    result = await session.execute(query)
    technician = result.scalar_one_or_none()

    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Update current location
    technician.current_lat = location_data.latitude
    technician.current_lng = location_data.longitude
    technician.last_location_update = datetime.utcnow()

    # Create location history entry
    location_history = TechnicianLocationHistory(
        tenant_id=tenant_id,
        technician_id=technician_id,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        accuracy_meters=location_data.accuracy_meters,
        altitude=location_data.altitude,
        speed_kmh=location_data.speed_kmh,
        heading=location_data.heading,
        recorded_at=location_data.timestamp or datetime.utcnow(),
        job_id=location_data.job_id,
        activity=location_data.activity,
        metadata=location_data.metadata or {},
    )

    session.add(location_history)
    await session.commit()
    await session.refresh(technician)

    # Check for geofence events
    geofence_service = GeofencingService(session)
    geofence_event = await geofence_service.check_geofence(
        technician_id=technician_id,
        current_lat=location_data.latitude,
        current_lng=location_data.longitude,
        job_id=UUID(location_data.job_id) if location_data.job_id else None,
    )

    # Auto-update job status if geofence event occurred
    geofence_message = None
    if geofence_event:
        success, message = await geofence_service.auto_update_job_status(geofence_event)
        if success:
            geofence_message = message

            # Broadcast geofence event notification
            await ws_manager.broadcast_to_tenant(
                tenant_id=str(tenant_id),
                message={
                    "type": "geofence_event",
                    "data": {
                        "technician_id": str(geofence_event.technician_id),
                        "technician_name": technician.full_name,
                        "job_id": str(geofence_event.job_id),
                        "event_type": geofence_event.event_type,
                        "timestamp": geofence_event.timestamp.isoformat(),
                        "distance_meters": geofence_event.distance_meters,
                        "message": message,
                    },
                },
            )

    # Create response
    response = TechnicianLocationResponse(
        technician_id=technician.id,
        technician_name=technician.full_name,
        latitude=technician.current_lat,
        longitude=technician.current_lng,
        last_update=technician.last_location_update,
        status=technician.status,
    )

    # Broadcast location update to all WebSocket clients for this tenant
    await ws_manager.broadcast_to_tenant(
        tenant_id=str(tenant_id),
        message={
            "type": "location_update",
            "data": {
                "technician_id": str(technician.id),
                "technician_name": technician.full_name,
                "latitude": technician.current_lat,
                "longitude": technician.current_lng,
                "last_update": technician.last_location_update.isoformat()
                if technician.last_location_update
                else None,
                "status": technician.status.value,
                "geofence_message": geofence_message,
            },
        },
    )

    return response


@router.get("/technicians/locations/active", response_model=list[TechnicianLocationResponse])
async def get_active_technician_locations(
    current_user: UserInfo = Depends(require_field_service_technician_read),
    session: AsyncSession = Depends(get_async_session),
) -> list[TechnicianLocationResponse]:
    """
    Get current locations of all active technicians.

    Returns technicians who are available or on a job.
    Used for real-time map visualization.
    """
    tenant_id = _require_tenant_id(current_user)

    query = select(Technician).where(
        and_(
            Technician.tenant_id == tenant_id,
            Technician.is_active == True,  # noqa: E712
            Technician.status.in_(
                [
                    TechnicianStatus.AVAILABLE,
                    TechnicianStatus.ON_JOB,
                    TechnicianStatus.ON_BREAK,
                ]
            ),
        )
    )

    result = await session.execute(query)
    technicians = list(result.scalars().all())

    return [
        TechnicianLocationResponse(
            technician_id=tech.id,
            technician_name=tech.full_name,
            latitude=tech.current_lat,
            longitude=tech.current_lng,
            last_update=tech.last_location_update,
            status=tech.status,
        )
        for tech in technicians
        if tech.current_lat is not None and tech.current_lng is not None
    ]


@router.get("/technicians/{technician_id}/location-history")
async def get_technician_location_history(
    technician_id: UUID,
    start_time: datetime | None = None,
    end_time: datetime | None = None,
    limit: int = 100,
    current_user: UserInfo = Depends(require_field_service_technician_read),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get technician's location history.

    Args:
        start_time: Filter from this time
        end_time: Filter until this time
        limit: Maximum number of points to return
    """
    tenant_id = _require_tenant_id(current_user)

    # Verify technician exists and belongs to tenant
    tech_query = select(Technician).where(
        and_(
            Technician.id == technician_id,
            Technician.tenant_id == tenant_id,
        )
    )
    tech_result = await session.execute(tech_query)
    if not tech_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Build location history query
    query = select(TechnicianLocationHistory).where(
        and_(
            TechnicianLocationHistory.technician_id == technician_id,
            TechnicianLocationHistory.tenant_id == tenant_id,
        )
    )

    if start_time:
        query = query.where(TechnicianLocationHistory.recorded_at >= start_time)

    if end_time:
        query = query.where(TechnicianLocationHistory.recorded_at <= end_time)

    query = query.order_by(TechnicianLocationHistory.recorded_at.desc()).limit(limit)

    result = await session.execute(query)
    history = list(result.scalars().all())

    return {
        "technician_id": str(technician_id),
        "total_points": len(history),
        "locations": [
            {
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "accuracy_meters": loc.accuracy_meters,
                "altitude": loc.altitude,
                "speed_kmh": loc.speed_kmh,
                "heading": loc.heading,
                "recorded_at": loc.recorded_at.isoformat(),
                "job_id": loc.job_id,
                "activity": loc.activity,
            }
            for loc in history
        ],
    }


@router.websocket("/ws/technician-locations")
async def websocket_technician_locations(
    websocket: WebSocket,
    token: str,
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """
    WebSocket endpoint for real-time technician location updates.

    Usage:
        ws://localhost:8000/api/v1/field-service/ws/technician-locations?token=YOUR_JWT_TOKEN

    The server will send messages in this format:
        {
            "type": "location_update",
            "data": {
                "technician_id": "uuid",
                "technician_name": "John Doe",
                "latitude": 6.5244,
                "longitude": 3.3792,
                "last_update": "2025-11-08T10:30:45Z",
                "status": "on_job"
            }
        }

    On connect, server sends:
        {
            "type": "connected",
            "message": "Connected to technician location updates",
            "connection_id": "uuid"
        }

    Args:
        token: JWT authentication token (query parameter)
    """
    from dotmac.platform.auth.core import jwt_service

    # Authenticate via token
    try:
        payload = jwt_service.decode_token(token)
        user_id = payload.get("user_id")
        tenant_id = payload.get("tenant_id")

        if not user_id or not tenant_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

    except Exception:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Generate unique connection ID
    connection_id = str(uuid4())

    # Accept connection and add to manager
    await ws_manager.connect(websocket, str(tenant_id), connection_id)

    try:
        # Send connection confirmation
        await websocket.send_json(
            {
                "type": "connected",
                "message": "Connected to technician location updates",
                "connection_id": connection_id,
                "tenant_id": str(tenant_id),
            }
        )

        # Send initial state (all active technician locations)
        query = select(Technician).where(
            and_(
                Technician.tenant_id == tenant_id,
                Technician.is_active == True,  # noqa: E712
                Technician.status.in_(
                    [
                        TechnicianStatus.AVAILABLE,
                        TechnicianStatus.ON_JOB,
                        TechnicianStatus.ON_BREAK,
                    ]
                ),
            )
        )

        result = await session.execute(query)
        technicians = list(result.scalars().all())

        initial_locations = [
            {
                "technician_id": str(tech.id),
                "technician_name": tech.full_name,
                "latitude": tech.current_lat,
                "longitude": tech.current_lng,
                "last_update": tech.last_location_update.isoformat()
                if tech.last_location_update
                else None,
                "status": tech.status.value,
            }
            for tech in technicians
            if tech.current_lat is not None and tech.current_lng is not None
        ]

        await websocket.send_json(
            {
                "type": "initial_state",
                "data": initial_locations,
            }
        )

        # Keep connection alive and listen for client messages (ping/pong)
        while True:
            try:
                # Wait for messages from client (e.g., ping to keep alive)
                data = await websocket.receive_text()

                # Handle ping/pong
                if data == "ping":
                    await websocket.send_json({"type": "pong"})

            except WebSocketDisconnect:
                break

    except Exception as e:
        print(f"WebSocket error: {e}")

    finally:
        # Remove connection
        ws_manager.disconnect(connection_id)


@router.get("/geofence/nearby-jobs")
async def get_nearby_jobs(
    technician_id: UUID,
    radius_meters: float = 1000.0,
    current_user: UserInfo = Depends(require_field_service_geofence_read),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get jobs near technician's current location.

    Args:
        technician_id: Technician ID
        radius_meters: Search radius in meters (default: 1000m = 1km)

    Returns:
        List of nearby jobs with distances
    """
    tenant_id = _require_tenant_id(current_user)

    # Get technician's current location
    tech_query = select(Technician).where(
        and_(
            Technician.id == technician_id,
            Technician.tenant_id == tenant_id,
        )
    )
    tech_result = await session.execute(tech_query)
    technician = tech_result.scalar_one_or_none()

    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    if not technician.current_lat or not technician.current_lng:
        return {
            "technician_id": str(technician_id),
            "current_location": None,
            "nearby_jobs": [],
        }

    # Get nearby jobs
    geofence_service = GeofencingService(session)
    nearby = await geofence_service.get_nearby_jobs(
        technician_id=technician_id,
        current_lat=technician.current_lat,
        current_lng=technician.current_lng,
        radius_meters=radius_meters,
    )

    return {
        "technician_id": str(technician_id),
        "current_location": {
            "latitude": technician.current_lat,
            "longitude": technician.current_lng,
        },
        "search_radius_meters": radius_meters,
        "nearby_jobs": [
            {
                "job_id": str(job.id),
                "title": job.title,
                "status": job.status,
                "location": {
                    "latitude": job.location_lat,
                    "longitude": job.location_lng,
                },
                "distance_meters": round(distance, 1),
                "is_assigned_to_me": job.assigned_technician_id == technician_id,
            }
            for job, distance in nearby
        ],
    }


@router.get("/geofence/job-time-on-site/{job_id}")
async def get_job_time_on_site(
    job_id: UUID,
    current_user: UserInfo = Depends(require_field_service_geofence_read),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, Any]:
    """
    Get time spent on-site for a specific job.

    Args:
        job_id: Job ID

    Returns:
        Time on-site information
    """
    geofence_service = GeofencingService(session)
    time_on_site = await geofence_service.get_time_on_site(job_id)

    if time_on_site is None:
        return {
            "job_id": str(job_id),
            "time_on_site_seconds": None,
            "time_on_site_formatted": None,
        }

    total_seconds = int(time_on_site.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60

    formatted = f"{hours}h {minutes}m {seconds}s" if hours > 0 else f"{minutes}m {seconds}s"

    return {
        "job_id": str(job_id),
        "time_on_site_seconds": total_seconds,
        "time_on_site_formatted": formatted,
    }


@router.get("/analytics/websocket-stats")
async def get_websocket_analytics(
    current_user: UserInfo = Depends(require_field_service_technician_read),
) -> dict[str, Any]:
    """
    Get real-time WebSocket connection analytics.

    Returns:
        - Total active connections
        - Active tenants
        - Total connections (lifetime)
        - Total messages sent
        - Average connection duration
        - Per-tenant breakdown
        - Uptime

    Example response:
    {
        "uptime_seconds": 3600,
        "uptime_formatted": "1:00:00",
        "total_active_connections": 25,
        "total_active_tenants": 5,
        "total_connections_lifetime": 143,
        "total_messages_sent": 8742,
        "average_connection_duration_seconds": 1834.2,
        "tenant_breakdown": {
            "tenant-uuid-1": {
                "active_connections": 10,
                "connection_ids": ["conn-1", "conn-2", ...]
            },
            ...
        }
    }
    """
    analytics = ws_manager.get_analytics()
    return analytics
