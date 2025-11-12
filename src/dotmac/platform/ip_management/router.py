"""
FastAPI router for IP management operations.
"""

from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.ip_management.ip_service import (
    IPConflictError,
    IPManagementService,
    IPPoolDepletedError,
)
from dotmac.platform.ip_management.models import IPPoolStatus, IPPoolType
from dotmac.platform.ip_management.schemas import (
    IPAvailabilityResponse,
    IPConflictCheck,
    IPConflictResult,
    IPPoolCreate,
    IPPoolResponse,
    IPPoolUpdate,
    IPReservationAutoAssign,
    IPReservationCreate,
    IPReservationResponse,
)

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/ip-management", tags=["IP Management"])


async def _get_tenant_id(user: UserInfo) -> str:
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required",
        )
    return user.tenant_id


# ============================================================================
# IP Pool Endpoints
# ============================================================================


@router.post(
    "/pools",
    response_model=IPPoolResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pool(
    pool: IPPoolCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPPoolResponse:
    """
    Create a new IP pool.

    Requires authentication and tenant context.
    """
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    try:
        created_pool = await service.create_pool(
            pool_name=pool.pool_name,
            pool_type=pool.pool_type,
            network_cidr=pool.network_cidr,
            gateway=pool.gateway,
            dns_servers=pool.dns_servers,
            vlan_id=pool.vlan_id,
            description=pool.description,
            auto_assign_enabled=pool.auto_assign_enabled,
        )
        await db.commit()

        return IPPoolResponse.model_validate(created_pool)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/pools",
    response_model=list[IPPoolResponse],
)
async def list_pools(
    pool_type: IPPoolType | None = None,
    pool_status: IPPoolStatus | None = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=500),
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[IPPoolResponse]:
    """
    List IP pools for the tenant.

    Supports filtering by type and status.
    """
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    pools = await service.list_pools(
        pool_type=pool_type,
        status=pool_status,
        limit=limit,
    )

    return [IPPoolResponse.model_validate(p) for p in pools]


@router.get(
    "/pools/{pool_id}",
    response_model=IPPoolResponse,
)
async def get_pool(
    pool_id: UUID,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPPoolResponse:
    """Get IP pool by ID."""
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    pool = await service.get_pool(pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pool {pool_id} not found",
        )

    return IPPoolResponse.model_validate(pool)


@router.patch(
    "/pools/{pool_id}",
    response_model=IPPoolResponse,
)
async def update_pool(
    pool_id: UUID,
    updates: IPPoolUpdate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPPoolResponse:
    """Update IP pool."""
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    pool = await service.get_pool(pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pool {pool_id} not found",
        )

    # Apply updates
    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(pool, field, value)

    await db.commit()
    await db.refresh(pool)

    return IPPoolResponse.model_validate(pool)


@router.get(
    "/pools/{pool_id}/available-ips",
    response_model=IPAvailabilityResponse,
)
async def get_available_ips(
    pool_id: UUID,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPAvailabilityResponse:
    """Find available IP in pool."""
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    pool = await service.get_pool(pool_id)
    if not pool:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pool {pool_id} not found",
        )

    available_ip = await service.find_available_ip(pool_id)
    available_count = pool.total_addresses - (pool.reserved_count + pool.assigned_count)

    return IPAvailabilityResponse(
        available_ip=available_ip,
        pool_id=str(pool_id),
        total_available=available_count,
    )


# ============================================================================
# IP Reservation Endpoints
# ============================================================================


@router.post(
    "/reservations",
    response_model=IPReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_reservation(
    reservation: IPReservationCreate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPReservationResponse:
    """
    Manually reserve an IP address for a subscriber.

    Performs conflict detection before creating reservation.
    """
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    try:
        created_reservation = await service.reserve_ip(
            subscriber_id=reservation.subscriber_id,
            ip_address=reservation.ip_address,
            pool_id=UUID(reservation.pool_id),
            ip_type=reservation.ip_type,
            assigned_by=current_user.email,
            assignment_reason=reservation.assignment_reason,
        )
        await db.commit()

        return IPReservationResponse.model_validate(created_reservation)
    except IPConflictError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"IP conflict detected for {e.ip_address}",
                "conflicts": e.conflicts,
            },
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post(
    "/reservations/auto-assign",
    response_model=IPReservationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def auto_assign_ip(
    request: IPReservationAutoAssign,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPReservationResponse:
    """
    Automatically assign an available IP from pool.

    Finds next available IP and creates reservation.
    """
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    try:
        reservation = await service.assign_ip_auto(
            subscriber_id=request.subscriber_id,
            pool_id=UUID(request.pool_id),
            ip_type=request.ip_type,
            assigned_by=current_user.email,
        )
        await db.commit()

        return IPReservationResponse.model_validate(reservation)
    except IPPoolDepletedError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/reservations/{reservation_id}",
    response_model=IPReservationResponse,
)
async def get_reservation(
    reservation_id: UUID,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPReservationResponse:
    """Get IP reservation by ID."""
    tenant_id = await _get_tenant_id(current_user)
    IPManagementService(db, tenant_id)

    from sqlalchemy import select

    from dotmac.platform.ip_management.models import IPReservation

    stmt = select(IPReservation).where(
        IPReservation.id == reservation_id,
        IPReservation.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    reservation = result.scalar_one_or_none()

    if not reservation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reservation {reservation_id} not found",
        )

    return IPReservationResponse.model_validate(reservation)


@router.delete(
    "/reservations/{reservation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def release_reservation(
    reservation_id: UUID,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> None:
    """Release an IP reservation."""
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    released = await service.release_ip(
        reservation_id=reservation_id,
        released_by=current_user.email,
    )

    if not released:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reservation {reservation_id} not found",
        )

    await db.commit()


@router.get(
    "/subscribers/{subscriber_id}/reservations",
    response_model=list[IPReservationResponse],
)
async def get_subscriber_reservations(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> list[IPReservationResponse]:
    """Get all IP reservations for a subscriber."""
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    reservations = await service.get_subscriber_reservations(subscriber_id)
    return [IPReservationResponse.model_validate(r) for r in reservations]


# ============================================================================
# Conflict Detection Endpoints
# ============================================================================


@router.post(
    "/check-conflicts",
    response_model=IPConflictResult,
)
async def check_conflicts(
    request: IPConflictCheck,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPConflictResult:
    """
    Check for IP address conflicts.

    Returns any existing reservations or conflicts.
    """
    tenant_id = await _get_tenant_id(current_user)
    service = IPManagementService(db, tenant_id)

    conflicts = await service.check_ip_conflicts(request.ip_address)

    return IPConflictResult(
        has_conflict=len(conflicts) > 0,
        ip_address=request.ip_address,
        conflicts=conflicts,
    )
