"""
FastAPI router for subscriber network profile management.
"""

from __future__ import annotations

import time
from uuid import UUID as UUIDType

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_session_dependency
from dotmac.platform.monitoring.prometheus_exporter import PrometheusExporter
from dotmac.platform.network import schemas
from dotmac.platform.network.ipv4_lifecycle_service import IPv4LifecycleService
from dotmac.platform.network.ipv6_lifecycle_service import IPv6LifecycleService
from dotmac.platform.network.lifecycle_protocol import (
    ActivationError,
    AllocationError,
    InvalidTransitionError,
    LifecycleError,
    RevocationError,
)
from dotmac.platform.network.profile_service import SubscriberNetworkProfileService
from dotmac.platform.network.schemas import (
    IPv4ActivationRequest,
    IPv4AllocationRequest,
    IPv4LifecycleStatusResponse,
    IPv4OperationResponse,
    IPv4RevocationRequest,
    IPv4SuspensionRequest,
    IPv6ActivationRequest,
    IPv6AllocationRequest,
    IPv6LifecycleStatusResponse,
    IPv6OperationResponse,
    IPv6RevocationRequest,
    NetworkProfileResponse,
    NetworkProfileStatsResponse,
    NetworkProfileUpdate,
)
from dotmac.platform.radius.coa_client import CoAClient
from dotmac.platform.subscribers.models import Subscriber

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/network", tags=["Network"])


async def _get_tenant_id(user: UserInfo) -> str:
    if not user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Tenant context required"
        )
    return user.tenant_id


async def _ensure_subscriber(
    db: AsyncSession,
    tenant_id: str,
    subscriber_id: str,
) -> Subscriber:
    stmt = select(Subscriber).where(
        Subscriber.id == subscriber_id,
        Subscriber.tenant_id == tenant_id,
    )
    result = await db.execute(stmt)
    subscriber = result.scalar_one_or_none()
    if not subscriber:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subscriber not found")
    return subscriber


@router.get(
    "/subscribers/{subscriber_id}/profile",
    response_model=NetworkProfileResponse,
    responses={404: {"description": "Profile not found"}},
)
async def get_network_profile(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> NetworkProfileResponse:
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    service = SubscriberNetworkProfileService(db, tenant_id)
    profile = await service.get_profile(subscriber_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Network profile not configured"
        )

    return NetworkProfileResponse.model_validate(profile)


@router.put(
    "/subscribers/{subscriber_id}/profile",
    response_model=NetworkProfileResponse,
)
async def upsert_network_profile(
    subscriber_id: str,
    payload: NetworkProfileUpdate,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> NetworkProfileResponse:
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    service = SubscriberNetworkProfileService(db, tenant_id)
    profile = await service.upsert_profile(subscriber_id, payload, commit=True)
    logger.info(
        "network_profile_upserted",
        tenant_id=tenant_id,
        subscriber_id=subscriber_id,
        has_vlans=bool(profile.service_vlan),
        has_static_ipv4=bool(profile.static_ipv4),
    )
    return profile


@router.delete(
    "/subscribers/{subscriber_id}/profile",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_network_profile(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> None:
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    service = SubscriberNetworkProfileService(db, tenant_id)
    deleted = await service.delete_profile(subscriber_id, commit=True)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Network profile not found"
        )

    logger.info(
        "network_profile_deleted",
        tenant_id=tenant_id,
        subscriber_id=subscriber_id,
    )


@router.get(
    "/profiles/stats",
    response_model=NetworkProfileStatsResponse,
)
async def get_network_profile_stats(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> NetworkProfileStatsResponse:
    """
    Get aggregate statistics for network profiles in the tenant.

    Returns counts for:
    - Total profiles
    - Profiles with static IPv4/IPv6
    - Profiles with VLANs and QinQ
    - Option 82 bindings and policies
    """
    tenant_id = await _get_tenant_id(current_user)
    service = SubscriberNetworkProfileService(db, tenant_id)
    stats = await service.get_stats()
    return NetworkProfileStatsResponse.model_validate(stats)


@router.get(
    "/ipv6/stats",
    response_model=schemas.IPv6LifecycleStatsResponse,
)
async def get_ipv6_lifecycle_stats(
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> schemas.IPv6LifecycleStatsResponse:
    """
    Get comprehensive IPv6 lifecycle utilization statistics.

    Returns:
    - IPv6 prefix counts by lifecycle state
    - Utilization metrics (allocation rate, activation rate)
    - NetBox integration percentage
    - Revocation trends

    Useful for monitoring IPv6 deployment progress and identifying
    prefixes stuck in allocated-but-not-active state.
    """
    from .ipv6_metrics import IPv6Metrics

    tenant_id = await _get_tenant_id(current_user)
    metrics_service = IPv6Metrics(db, tenant_id)
    summary = await metrics_service.get_ipv6_lifecycle_summary()

    return schemas.IPv6LifecycleStatsResponse.model_validate(summary)


# Phase 4: IPv6 Lifecycle Management API


@router.get(
    "/subscribers/{subscriber_id}/ipv6/status",
    response_model=IPv6LifecycleStatusResponse,
    responses={404: {"description": "Network profile not found"}},
)
async def get_ipv6_lifecycle_status(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6LifecycleStatusResponse:
    """
    Get IPv6 lifecycle status for a subscriber.

    Returns current state, timestamps, and NetBox integration details.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    service = IPv6LifecycleService(db, tenant_id)
    try:
        status_dict = await service.get_lifecycle_status(subscriber_id)
        return IPv6LifecycleStatusResponse.model_validate(status_dict)
    except LifecycleError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv6/allocate",
    response_model=IPv6OperationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def allocate_ipv6_prefix(
    subscriber_id: str,
    payload: IPv6AllocationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6OperationResponse:
    """
    Allocate an IPv6 prefix from NetBox for a subscriber.

    Transitions: PENDING -> ALLOCATED
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv6LifecycleService(db, tenant_id, netbox_client=None)

    try:
        result = await service.allocate_ipv6(
            subscriber_id=subscriber_id,
            prefix_size=payload.prefix_size,
            netbox_pool_id=payload.netbox_pool_id,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="allocate",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv6_prefix_allocated",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            prefix=result.get("prefix"),
            duration_seconds=duration,
        )

        return IPv6OperationResponse(
            success=True,
            message="IPv6 prefix allocated successfully",
            **result,
        )

    except (LifecycleError, InvalidTransitionError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="allocate",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv6/activate",
    response_model=IPv6OperationResponse,
)
async def activate_ipv6_prefix(
    subscriber_id: str,
    payload: IPv6ActivationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6OperationResponse:
    """
    Activate an allocated IPv6 prefix.

    Transitions: ALLOCATED -> ACTIVE

    Optionally sends RADIUS CoA to update active session without restart.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    coa_client = CoAClient(tenant_id=tenant_id) if payload.send_coa else None
    service = IPv6LifecycleService(db, tenant_id, coa_client=coa_client)

    try:
        result = await service.activate_ipv6(
            subscriber_id=subscriber_id,
            username=payload.username,
            nas_ip=payload.nas_ip,
            send_coa=payload.send_coa,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="activate",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv6_prefix_activated",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            prefix=result.get("prefix"),
            coa_sent=payload.send_coa,
            duration_seconds=duration,
        )

        return IPv6OperationResponse(
            success=True,
            message="IPv6 prefix activated successfully",
            **result,
        )

    except (LifecycleError, InvalidTransitionError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="activate",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv6/suspend",
    response_model=IPv6OperationResponse,
)
async def suspend_ipv6_prefix(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6OperationResponse:
    """
    Suspend an active IPv6 prefix.

    Transitions: ACTIVE -> SUSPENDED

    Service suspended but prefix reservation is kept.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv6LifecycleService(db, tenant_id)

    try:
        result = await service.suspend_ipv6(subscriber_id=subscriber_id, commit=True)

        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="suspend",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv6_prefix_suspended",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            prefix=result.get("prefix"),
            duration_seconds=duration,
        )

        return IPv6OperationResponse(
            success=True,
            message="IPv6 prefix suspended successfully",
            **result,
        )

    except (LifecycleError, InvalidTransitionError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="suspend",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv6/resume",
    response_model=IPv6OperationResponse,
)
async def resume_ipv6_prefix(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6OperationResponse:
    """
    Resume a suspended IPv6 prefix.

    Transitions: SUSPENDED -> ACTIVE
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv6LifecycleService(db, tenant_id)

    try:
        result = await service.resume_ipv6(subscriber_id=subscriber_id, commit=True)

        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="resume",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv6_prefix_resumed",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            prefix=result.get("prefix"),
            duration_seconds=duration,
        )

        return IPv6OperationResponse(
            success=True,
            message="IPv6 prefix resumed successfully",
            **result,
        )

    except (LifecycleError, InvalidTransitionError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="resume",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv6/revoke",
    response_model=IPv6OperationResponse,
)
async def revoke_ipv6_prefix(
    subscriber_id: str,
    payload: IPv6RevocationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv6OperationResponse:
    """
    Revoke an IPv6 prefix and return it to the pool.

    Transitions: ANY -> REVOKING -> REVOKED

    Optionally sends RADIUS Disconnect-Request to force session restart.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    coa_client = CoAClient(tenant_id=tenant_id) if payload.send_disconnect else None
    service = IPv6LifecycleService(db, tenant_id, coa_client=coa_client)

    try:
        result = await service.revoke_ipv6(
            subscriber_id=subscriber_id,
            username=payload.username,
            nas_ip=payload.nas_ip,
            send_disconnect=payload.send_disconnect,
            release_to_netbox=payload.release_to_netbox,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="revoke",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv6_prefix_revoked",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            prefix=result.get("prefix"),
            disconnect_sent=payload.send_disconnect,
            duration_seconds=duration,
        )

        return IPv6OperationResponse(
            success=True,
            message="IPv6 prefix revoked successfully",
            **result,
        )

    except (LifecycleError, InvalidTransitionError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv6_lifecycle_operation(
            tenant_id=tenant_id,
            operation="revoke",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Phase 5: IPv4 Lifecycle Management API


@router.get(
    "/subscribers/{subscriber_id}/ipv4/status",
    response_model=IPv4LifecycleStatusResponse,
    responses={404: {"description": "IPv4 reservation not found"}},
)
async def get_ipv4_lifecycle_status(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4LifecycleStatusResponse:
    """
    Get IPv4 lifecycle status for a subscriber.

    Returns current state, timestamps, and NetBox integration details.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    service = IPv4LifecycleService(db, tenant_id)
    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.get_state(subscriber_uuid)
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No IPv4 reservation found for subscriber",
            )

        return IPv4LifecycleStatusResponse(
            subscriber_id=subscriber_id,
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            activated_at=result.activated_at,
            suspended_at=result.suspended_at,
            revoked_at=result.revoked_at,
            netbox_ip_id=result.netbox_ip_id,
            metadata=result.metadata,
        )
    except LifecycleError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv4/allocate",
    response_model=IPv4OperationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def allocate_ipv4_address(
    subscriber_id: str,
    payload: IPv4AllocationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4OperationResponse:
    """
    Allocate an IPv4 address from a pool for a subscriber.

    Transitions: PENDING -> ALLOCATED
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv4LifecycleService(db, tenant_id)

    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.allocate(
            subscriber_id=subscriber_uuid,
            pool_id=payload.pool_id,
            requested_address=payload.requested_address,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="allocate",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv4_address_allocated",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            address=result.address,
            duration_seconds=duration,
        )

        return IPv4OperationResponse(
            success=True,
            message="IPv4 address allocated successfully",
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            netbox_ip_id=result.netbox_ip_id,
            metadata=result.metadata,
        )

    except (AllocationError, InvalidTransitionError, LifecycleError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="allocate",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv4/activate",
    response_model=IPv4OperationResponse,
)
async def activate_ipv4_address(
    subscriber_id: str,
    payload: IPv4ActivationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4OperationResponse:
    """
    Activate an allocated IPv4 address.

    Transitions: ALLOCATED -> ACTIVE

    Optionally sends RADIUS CoA to update active session without restart.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv4LifecycleService(db, tenant_id)

    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.activate(
            subscriber_id=subscriber_uuid,
            username=payload.username,
            nas_ip=payload.nas_ip,
            send_coa=payload.send_coa,
            update_netbox=payload.update_netbox,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="activate",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv4_address_activated",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            address=result.address,
            coa_sent=payload.send_coa,
            duration_seconds=duration,
        )

        return IPv4OperationResponse(
            success=True,
            message="IPv4 address activated successfully",
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            activated_at=result.activated_at,
            netbox_ip_id=result.netbox_ip_id,
            coa_result=result.coa_result,
            metadata=result.metadata,
        )

    except (ActivationError, InvalidTransitionError, LifecycleError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="activate",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv4/suspend",
    response_model=IPv4OperationResponse,
)
async def suspend_ipv4_address(
    subscriber_id: str,
    payload: IPv4SuspensionRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4OperationResponse:
    """
    Suspend an active IPv4 address.

    Transitions: ACTIVE -> SUSPENDED

    Service suspended but address reservation is kept.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv4LifecycleService(db, tenant_id)

    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.suspend(
            subscriber_id=subscriber_uuid,
            username=payload.username,
            nas_ip=payload.nas_ip,
            send_coa=payload.send_coa,
            reason=payload.reason,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="suspend",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv4_address_suspended",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            address=result.address,
            reason=payload.reason,
            duration_seconds=duration,
        )

        return IPv4OperationResponse(
            success=True,
            message="IPv4 address suspended successfully",
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            activated_at=result.activated_at,
            suspended_at=result.suspended_at,
            coa_result=result.coa_result,
            metadata=result.metadata,
        )

    except (InvalidTransitionError, LifecycleError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="suspend",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv4/reactivate",
    response_model=IPv4OperationResponse,
)
async def reactivate_ipv4_address(
    subscriber_id: str,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4OperationResponse:
    """
    Reactivate a suspended IPv4 address.

    Transitions: SUSPENDED -> ACTIVE
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv4LifecycleService(db, tenant_id)

    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.reactivate(
            subscriber_id=subscriber_uuid,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="reactivate",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv4_address_reactivated",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            address=result.address,
            duration_seconds=duration,
        )

        return IPv4OperationResponse(
            success=True,
            message="IPv4 address reactivated successfully",
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            activated_at=result.activated_at,
            suspended_at=result.suspended_at,
            metadata=result.metadata,
        )

    except (InvalidTransitionError, LifecycleError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="reactivate",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/subscribers/{subscriber_id}/ipv4/revoke",
    response_model=IPv4OperationResponse,
)
async def revoke_ipv4_address(
    subscriber_id: str,
    payload: IPv4RevocationRequest,
    current_user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_session_dependency),
) -> IPv4OperationResponse:
    """
    Revoke an IPv4 address and return it to the pool.

    Transitions: ANY -> REVOKING -> REVOKED

    Optionally sends RADIUS Disconnect-Request to force session restart.
    """
    tenant_id = await _get_tenant_id(current_user)
    await _ensure_subscriber(db, tenant_id, subscriber_id)

    start_time = time.time()
    service = IPv4LifecycleService(db, tenant_id)

    try:
        subscriber_uuid = UUIDType(subscriber_id)
        result = await service.revoke(
            subscriber_id=subscriber_uuid,
            username=payload.username,
            nas_ip=payload.nas_ip,
            send_disconnect=payload.send_disconnect,
            release_to_pool=payload.release_to_pool,
            update_netbox=payload.update_netbox,
            commit=True,
        )

        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="revoke",
            success=True,
            duration_seconds=duration,
        )

        logger.info(
            "ipv4_address_revoked",
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            address=result.address,
            disconnect_sent=payload.send_disconnect,
            duration_seconds=duration,
        )

        return IPv4OperationResponse(
            success=True,
            message="IPv4 address revoked successfully",
            address=result.address,
            state=result.state,
            allocated_at=result.allocated_at,
            activated_at=result.activated_at,
            suspended_at=result.suspended_at,
            revoked_at=result.revoked_at,
            disconnect_result=result.disconnect_result,
            metadata=result.metadata,
        )

    except (RevocationError, InvalidTransitionError, LifecycleError) as e:
        duration = time.time() - start_time
        PrometheusExporter.record_ipv4_lifecycle_operation(
            tenant_id=tenant_id,
            operation="revoke",
            success=False,
            duration_seconds=duration,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
