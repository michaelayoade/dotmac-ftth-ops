"""
Service Lifecycle API Router.

REST API endpoints for service lifecycle management including provisioning,
activation, suspension, resumption, and termination operations.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.db import get_async_session
from dotmac.platform.services.lifecycle.models import (
    LifecycleEventType,
    ServiceInstance,
    ServiceStatus,
    ServiceType,
)
from dotmac.platform.services.lifecycle.schemas import (
    BulkServiceOperationRequest,
    BulkServiceOperationResult,
    LifecycleEventResponse,
    ServiceActivationRequest,
    ServiceHealthCheckRequest,
    ServiceInstanceResponse,
    ServiceInstanceSummary,
    ServiceModificationRequest,
    ServiceOperationResult,
    ServiceProvisioningResponse,
    ServiceProvisionRequest,
    ServiceResumptionRequest,
    ServiceStatistics,
    ServiceSuspensionRequest,
    ServiceTerminationRequest,
)
from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService
from dotmac.platform.tenant import get_current_tenant_id

router = APIRouter(prefix="/lifecycle", tags=["Services - Lifecycle"])

# Rate limiting
limiter = Limiter(key_func=get_remote_address)


def _coerce_uuid(value: UUID | str | None) -> UUID | None:
    """Convert a user identifier to UUID when possible."""
    if value is None or isinstance(value, UUID):
        return value
    try:
        return UUID(str(value))
    except ValueError:
        return None


def _ensure_operation_result(
    result: ServiceOperationResult | ServiceInstance | Any, operation: str
) -> ServiceOperationResult:
    """Normalize service responses to ServiceOperationResult."""
    if isinstance(result, ServiceOperationResult):
        return result
    if isinstance(result, ServiceInstance):
        return ServiceOperationResult(
            success=True,
            service_instance_id=result.id,
            operation=operation,
            message="Operation completed successfully",
        )

    service_instance_id = getattr(result, "service_instance_id", None)
    return ServiceOperationResult(
        success=True,
        service_instance_id=service_instance_id,
        operation=operation,
        message="Operation completed successfully",
    )


# ==========================================
# Service Provisioning Endpoints
# ==========================================


@router.post(
    "/services/provision",
    response_model=ServiceProvisioningResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision new service",
    description="Initiate provisioning workflow for a new service instance",
)
@limiter.limit("20/minute")
async def provision_service(
    request: Request,
    provision_data: ServiceProvisionRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Provision a new service instance.

    Creates a new service and initiates the provisioning workflow.
    The provisioning process is asynchronous and may take time to complete.

    **Rate Limit:** 20 requests per minute

    **Required Permissions:** `services:provision`
    """
    service = LifecycleOrchestrationService(db_session)

    try:
        result = await service.provision_service(
            tenant_id=tenant_id,
            data=provision_data,
            created_by_user_id=_coerce_uuid(current_user.user_id),
        )

        response = ServiceProvisioningResponse.model_validate(result)
        return response.model_dump(mode="json")

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to provision service: {str(e)}",
        )


@router.post(
    "/services/{service_instance_id}/activate",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Activate service",
    description="Activate a provisioned service instance",
)
@limiter.limit("30/minute")
async def activate_service(
    request: Request,
    service_instance_id: UUID,
    activation_data: ServiceActivationRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Activate a provisioned service.

    Transitions service from provisioned to active state, enabling customer access.

    **Rate Limit:** 30 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    activation_data.service_instance_id = service_instance_id

    actor_id = _coerce_uuid(current_user.user_id)

    service_result = await service.activate_service(
        tenant_id=tenant_id,
        data=activation_data,
        activated_by_user_id=actor_id,
    )

    result = _ensure_operation_result(service_result, "activate")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Service Suspension Endpoints
# ==========================================


@router.post(
    "/services/{service_instance_id}/suspend",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Suspend service",
    description="Temporarily suspend an active service",
)
@limiter.limit("30/minute")
async def suspend_service(
    request: Request,
    service_instance_id: UUID,
    suspension_data: ServiceSuspensionRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Suspend an active service.

    Temporarily disables service access while maintaining the service record.
    Can optionally schedule automatic resumption.

    **Rate Limit:** 30 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    suspension_data.service_instance_id = service_instance_id

    suspended_by = _coerce_uuid(current_user.user_id)

    service_result = await service.suspend_service(
        tenant_id=tenant_id,
        data=suspension_data,
        suspended_by_user_id=suspended_by,
    )

    result = _ensure_operation_result(service_result, "suspend")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


@router.post(
    "/services/{service_instance_id}/resume",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Resume service",
    description="Resume a suspended service",
)
@limiter.limit("30/minute")
async def resume_service(
    request: Request,
    service_instance_id: UUID,
    resumption_data: ServiceResumptionRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Resume a suspended service.

    Restores service access after suspension.

    **Rate Limit:** 30 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    resumption_data.service_instance_id = service_instance_id

    resumed_by = _coerce_uuid(current_user.user_id)

    service_result = await service.resume_service(
        tenant_id=tenant_id,
        data=resumption_data,
        resumed_by_user_id=resumed_by,
    )

    result = _ensure_operation_result(service_result, "resume")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Service Termination Endpoints
# ==========================================


@router.post(
    "/services/{service_instance_id}/terminate",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Terminate service",
    description="Permanently terminate a service",
)
@limiter.limit("20/minute")
async def terminate_service(
    request: Request,
    service_instance_id: UUID,
    termination_data: ServiceTerminationRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Terminate a service.

    Permanently terminates service access. Can be scheduled for future date.

    **Rate Limit:** 20 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    termination_data.service_instance_id = service_instance_id

    terminated_by = _coerce_uuid(current_user.user_id)

    service_result = await service.terminate_service(
        tenant_id=tenant_id,
        data=termination_data,
        terminated_by_user_id=terminated_by,
    )

    result = _ensure_operation_result(service_result, "terminate")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Service Modification Endpoints
# ==========================================


@router.patch(
    "/services/{service_instance_id}",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Modify service",
    description="Modify service configuration or metadata",
)
@limiter.limit("30/minute")
async def modify_service(
    request: Request,
    service_instance_id: UUID,
    modification_data: ServiceModificationRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Modify an existing service.

    Updates service configuration, equipment, or metadata.

    **Rate Limit:** 30 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    modification_data.service_instance_id = service_instance_id

    modified_by = _coerce_uuid(current_user.user_id)

    service_result = await service.modify_service(
        tenant_id=tenant_id,
        data=modification_data,
        modified_by_user_id=modified_by,
    )

    result = _ensure_operation_result(service_result, "modify")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Health Check Endpoints
# ==========================================


@router.post(
    "/services/{service_instance_id}/health-check",
    response_model=ServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Perform health check",
    description="Check service health and connectivity",
)
@limiter.limit("60/minute")
async def perform_health_check(
    request: Request,
    service_instance_id: UUID,
    health_check_data: ServiceHealthCheckRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Perform health check on a service.

    Checks service connectivity, performance, and overall health.

    **Rate Limit:** 60 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    # Override service_instance_id from path
    health_check_data.service_instance_id = service_instance_id

    service_result = await service.perform_health_check(tenant_id, health_check_data)

    result = _ensure_operation_result(service_result, "health_check")

    if not result.success:
        if result.error == "NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=result.message,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.message,
            )

    response = ServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Bulk Operations Endpoints
# ==========================================


@router.post(
    "/services/bulk-operation",
    response_model=BulkServiceOperationResult,
    status_code=status.HTTP_200_OK,
    summary="Bulk service operation",
    description="Perform operations on multiple services",
)
@limiter.limit("10/minute")
async def bulk_service_operation(
    request: Request,
    bulk_data: BulkServiceOperationRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Perform bulk operations on multiple services.

    Supports suspend, resume, terminate, and health_check operations.

    **Rate Limit:** 10 requests per minute (to prevent abuse)
    """
    service = LifecycleOrchestrationService(db_session)

    result = await service.bulk_service_operation(
        tenant_id=tenant_id,
        data=bulk_data,
        user_id=_coerce_uuid(current_user.user_id),
    )

    response = BulkServiceOperationResult.model_validate(result)
    return response.model_dump(mode="json")


# ==========================================
# Query Endpoints
# ==========================================


@router.get(
    "/services",
    response_model=list[ServiceInstanceSummary],
    status_code=status.HTTP_200_OK,
    summary="List services",
    description="List service instances with filters",
)
@limiter.limit("60/minute")
async def list_services(
    request: Request,
    customer_id: UUID | None = Query(None, description="Filter by customer ID"),
    status_filter: ServiceStatus | None = Query(
        None, alias="status", description="Filter by service status"
    ),
    service_type: ServiceType | None = Query(None, description="Filter by service type"),
    limit: int = Query(100, ge=1, le=1000, description="Max results to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[dict[str, Any]]:
    """
    List service instances.

    Returns a paginated list of service instances with optional filters.

    **Rate Limit:** 60 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    services = await service.list_service_instances(
        tenant_id=tenant_id,
        customer_id=customer_id,
        status=status_filter,
        service_type=service_type,
        limit=limit,
        offset=offset,
    )

    return [
        ServiceInstanceSummary.model_validate(s).model_dump(mode="json")
        for s in services
    ]


@router.get(
    "/services/{service_instance_id}",
    response_model=ServiceInstanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get service details",
    description="Retrieve detailed service instance information",
)
@limiter.limit("100/minute")
async def get_service(
    request: Request,
    service_instance_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Get detailed service instance information.

    **Rate Limit:** 100 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    service_instance = await service.get_service_instance(service_instance_id, tenant_id)

    if not service_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service instance not found",
        )

    response = ServiceInstanceResponse.model_validate(service_instance)
    return response.model_dump(mode="json")


@router.get(
    "/services/{service_instance_id}/events",
    response_model=list[LifecycleEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Get lifecycle events",
    description="Retrieve lifecycle events for a service",
)
@limiter.limit("60/minute")
async def get_service_events(
    request: Request,
    service_instance_id: UUID,
    event_type: LifecycleEventType | None = Query(None, description="Filter by event type"),
    limit: int = Query(50, ge=1, le=500, description="Max events to return"),
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[dict[str, Any]]:
    """
    Get lifecycle events for a service instance.

    Returns audit trail of all lifecycle operations.

    **Rate Limit:** 60 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    events = await service.get_lifecycle_events(
        service_instance_id=service_instance_id,
        tenant_id=tenant_id,
        event_type=event_type,
        limit=limit,
    )

    return [
        LifecycleEventResponse.model_validate(e).model_dump(mode="json")
        for e in events
    ]


# ==========================================
# Statistics Endpoints
# ==========================================


@router.get(
    "/statistics",
    response_model=ServiceStatistics,
    status_code=status.HTTP_200_OK,
    summary="Get service statistics",
    description="Retrieve tenant-wide service statistics",
)
@limiter.limit("30/minute")
async def get_statistics(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Get service statistics for the tenant.

    Returns counts by status, type, health metrics, and workflow metrics.

    **Rate Limit:** 30 requests per minute
    """
    service = LifecycleOrchestrationService(db_session)

    stats = await service.get_statistics(tenant_id)

    response = ServiceStatistics.model_validate(stats)
    return response.model_dump(mode="json")
