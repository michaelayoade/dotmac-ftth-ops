"""
Fiber Infrastructure API Router

REST API endpoints for fiber optic network infrastructure management.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth.core import UserInfo
from ..auth.dependencies import get_current_user
from ..db import get_session_dependency
from .models import (
    CableInstallationType,
    DistributionPointType,
    FiberCableStatus,
    FiberHealthStatus,
    FiberType,
    ServiceAreaType,
)
from .schemas import (
    CapacityPlanningResponse,
    CoverageStatisticsResponse,
    CoverageSummaryResponse,
    DistributionPointCreate,
    DistributionPointResponse,
    FiberCableCreate,
    FiberCableResponse,
    FiberCableUpdate,
    HealthMetricCreate,
    HealthMetricResponse,
    NetworkHealthSummaryResponse,
    OTDRTestCreate,
    OTDRTestResponse,
    PortUtilizationResponse,
    ServiceAreaCreate,
    ServiceAreaResponse,
)
from .service import FiberService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/fiber", tags=["Fiber Infrastructure"])


async def get_fiber_service(
    db: AsyncSession = Depends(get_session_dependency),
    current_user: UserInfo = Depends(get_current_user),
) -> FiberService:
    """Dependency to get fiber service"""
    return FiberService(db=db, tenant_id=current_user.tenant_id)


def _parse_enum(value: Any, enum_cls: type[Enum], field: str) -> Enum | None:
    """Normalize potentially case-insensitive string values into Enum members."""
    if value is None or isinstance(value, enum_cls):
        return value

    if isinstance(value, str):
        candidate = value.strip()
        try:
            return enum_cls[candidate.upper()]
        except KeyError:
            try:
                return enum_cls(candidate.lower())
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid value '{value}' for {field}",
                ) from exc

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=f"Invalid value '{value}' for {field}",
    )


# ============================================================================
# Fiber Cable Endpoints
# ============================================================================


@router.post(
    "/cables",
    response_model=FiberCableResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Fiber Cable",
    description="Register a new fiber optic cable",
)
async def create_cable(
    data: FiberCableCreate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> FiberCableResponse:
    """Create a new fiber cable"""
    try:
        cable = await service.create_cable(
            **data.model_dump(),
            created_by=current_user.email,
        )
        return FiberCableResponse.model_validate(cable)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("fiber.cable.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create fiber cable",
        )


@router.get(
    "/cables",
    response_model=list[FiberCableResponse],
    summary="List Fiber Cables",
    description="List fiber cables with filters",
)
async def list_cables(
    fiber_type: str | None = Query(None, description="Filter by fiber type"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    installation_type: str | None = Query(None, description="Filter by installation type"),
    start_site_id: str | None = Query(None, description="Filter by start site"),
    end_site_id: str | None = Query(None, description="Filter by end site"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: FiberService = Depends(get_fiber_service),
) -> list[FiberCableResponse]:
    """List fiber cables"""
    try:
        fiber_type_enum = _parse_enum(fiber_type, FiberType, "fiber_type")
        status_enum = _parse_enum(status_filter, FiberCableStatus, "status")
        installation_enum = _parse_enum(
            installation_type, CableInstallationType, "installation_type"
        )

        cables = await service.list_cables(
            fiber_type=fiber_type_enum,
            status=status_enum,
            installation_type=installation_enum,
            start_site_id=start_site_id,
            end_site_id=end_site_id,
            limit=limit,
            offset=offset,
        )
        return [FiberCableResponse.model_validate(cable) for cable in cables]
    except Exception as e:
        logger.exception("fiber.cable.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list fiber cables",
        )


@router.get(
    "/cables/{cable_id}",
    response_model=FiberCableResponse,
    summary="Get Fiber Cable",
    description="Get fiber cable by ID or cable_id",
)
async def get_cable(
    cable_id: str,
    include_relations: bool = Query(
        False, description="Include splice points, health metrics, and OTDR tests"
    ),
    service: FiberService = Depends(get_fiber_service),
) -> FiberCableResponse:
    """Get fiber cable by ID"""
    try:
        # Try UUID first, then string ID
        try:
            cable_uuid = UUID(cable_id)
            cable = await service.get_cable(cable_uuid, include_relations=include_relations)
        except ValueError:
            cable = await service.get_cable(cable_id, include_relations=include_relations)

        if not cable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fiber cable {cable_id} not found",
            )

        return FiberCableResponse.model_validate(cable)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.cable.get.failed", cable_id=cable_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get fiber cable",
        )


@router.patch(
    "/cables/{cable_id}",
    response_model=FiberCableResponse,
    summary="Update Fiber Cable",
    description="Update fiber cable properties",
)
async def update_cable(
    cable_id: str,
    data: FiberCableUpdate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> FiberCableResponse:
    """Update fiber cable"""
    try:
        try:
            cable_uuid = UUID(cable_id)
        except ValueError:
            cable_uuid = cable_id  # type: ignore

        cable = await service.update_cable(
            cable_uuid,
            updated_by=current_user.email,
            **data.model_dump(exclude_unset=True),
        )

        if not cable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fiber cable {cable_id} not found",
            )

        return FiberCableResponse.model_validate(cable)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.cable.update.failed", cable_id=cable_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update fiber cable",
        )


@router.post(
    "/cables/{cable_id}/activate",
    response_model=FiberCableResponse,
    summary="Activate Fiber Cable",
    description="Mark fiber cable as active and operational",
)
async def activate_cable(
    cable_id: str,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> FiberCableResponse:
    """Activate fiber cable"""
    try:
        try:
            cable_uuid = UUID(cable_id)
        except ValueError:
            cable_uuid = cable_id  # type: ignore

        cable = await service.activate_cable(cable_uuid, activated_by=current_user.email)

        if not cable:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fiber cable {cable_id} not found",
            )

        return FiberCableResponse.model_validate(cable)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.cable.activate.failed", cable_id=cable_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate fiber cable",
        )


@router.delete(
    "/cables/{cable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Fiber Cable",
    description="Soft delete a fiber cable",
)
async def delete_cable(
    cable_id: str,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> None:
    """Delete fiber cable"""
    try:
        try:
            cable_uuid = UUID(cable_id)
        except ValueError:
            cable_uuid = cable_id  # type: ignore

        success = await service.delete_cable(cable_uuid, deleted_by=current_user.email)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fiber cable {cable_id} not found",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.cable.delete.failed", cable_id=cable_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete fiber cable",
        )


# ============================================================================
# Distribution Point Endpoints
# ============================================================================


@router.post(
    "/distribution-points",
    response_model=DistributionPointResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Distribution Point",
    description="Create a new distribution point (FDH, FDT, FAT, Splitter, Patch Panel)",
)
async def create_distribution_point(
    data: DistributionPointCreate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> DistributionPointResponse:
    """Create distribution point"""
    try:
        point = await service.create_distribution_point(
            **data.model_dump(),
            created_by=current_user.email,
        )
        return DistributionPointResponse.model_validate(point)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("fiber.distribution_point.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create distribution point",
        )


@router.get(
    "/distribution-points",
    response_model=list[DistributionPointResponse],
    summary="List Distribution Points",
    description="List distribution points with filters",
)
async def list_distribution_points(
    point_type: str | None = Query(None, description="Filter by point type"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    site_id: str | None = Query(None, description="Filter by site"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: FiberService = Depends(get_fiber_service),
) -> list[DistributionPointResponse]:
    """List distribution points"""
    try:
        point_type_enum = _parse_enum(point_type, DistributionPointType, "point_type")
        status_enum = _parse_enum(status_filter, FiberCableStatus, "status")

        points = await service.list_distribution_points(
            point_type=point_type_enum,
            status=status_enum,
            site_id=site_id,
            limit=limit,
            offset=offset,
        )
        return [DistributionPointResponse.model_validate(point) for point in points]
    except Exception as e:
        logger.exception("fiber.distribution_point.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list distribution points",
        )


@router.get(
    "/distribution-points/{point_id}",
    response_model=DistributionPointResponse,
    summary="Get Distribution Point",
    description="Get distribution point by ID or point_id",
)
async def get_distribution_point(
    point_id: str,
    service: FiberService = Depends(get_fiber_service),
) -> DistributionPointResponse:
    """Get distribution point"""
    try:
        try:
            point_uuid = UUID(point_id)
        except ValueError:
            point_uuid = point_id  # type: ignore

        point = await service.get_distribution_point(point_uuid)

        if not point:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Distribution point {point_id} not found",
            )

        return DistributionPointResponse.model_validate(point)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.distribution_point.get.failed", point_id=point_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get distribution point",
        )


@router.get(
    "/distribution-points/{point_id}/utilization",
    response_model=PortUtilizationResponse,
    summary="Get Port Utilization",
    description="Get port utilization statistics for a distribution point",
)
async def get_port_utilization(
    point_id: str,
    service: FiberService = Depends(get_fiber_service),
) -> PortUtilizationResponse:
    """Get port utilization statistics"""
    try:
        try:
            point_uuid = UUID(point_id)
        except ValueError:
            point_uuid = point_id  # type: ignore

        stats = await service.get_port_utilization(point_uuid)

        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Distribution point {point_id} not found",
            )

        return PortUtilizationResponse(**stats)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.port_utilization.get.failed", point_id=point_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get port utilization",
        )


# ============================================================================
# Service Area Endpoints
# ============================================================================


@router.post(
    "/service-areas",
    response_model=ServiceAreaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Service Area",
    description="Create a new service coverage area",
)
async def create_service_area(
    data: ServiceAreaCreate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> ServiceAreaResponse:
    """Create service area"""
    try:
        area = await service.create_service_area(
            **data.model_dump(),
            created_by=current_user.email,
        )
        return ServiceAreaResponse.model_validate(area)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("fiber.service_area.create.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create service area",
        )


@router.get(
    "/service-areas",
    response_model=list[ServiceAreaResponse],
    summary="List Service Areas",
    description="List service areas with filters",
)
async def list_service_areas(
    area_type: str | None = Query(None, description="Filter by area type"),
    is_serviceable: bool | None = Query(None, description="Filter by serviceability"),
    construction_status: str | None = Query(None, description="Filter by construction status"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: FiberService = Depends(get_fiber_service),
) -> list[ServiceAreaResponse]:
    """List service areas"""
    try:
        area_type_enum = _parse_enum(area_type, ServiceAreaType, "area_type")

        areas = await service.list_service_areas(
            area_type=area_type_enum,
            is_serviceable=is_serviceable,
            construction_status=construction_status,
            limit=limit,
            offset=offset,
        )
        return [ServiceAreaResponse.model_validate(area) for area in areas]
    except Exception as e:
        logger.exception("fiber.service_area.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list service areas",
        )


@router.get(
    "/service-areas/{area_id}/coverage",
    response_model=CoverageStatisticsResponse,
    summary="Get Coverage Statistics",
    description="Get coverage statistics for a service area",
)
async def get_coverage_statistics(
    area_id: str,
    service: FiberService = Depends(get_fiber_service),
) -> CoverageStatisticsResponse:
    """Get coverage statistics"""
    try:
        try:
            area_uuid = UUID(area_id)
        except ValueError:
            area_uuid = area_id  # type: ignore

        stats = await service.get_coverage_statistics(area_uuid)

        if not stats:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Service area {area_id} not found",
            )

        return CoverageStatisticsResponse(**stats)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("fiber.coverage_statistics.get.failed", area_id=area_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get coverage statistics",
        )


# ============================================================================
# Health Metrics Endpoints
# ============================================================================


@router.post(
    "/health-metrics",
    response_model=HealthMetricResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record Health Metric",
    description="Record health metrics for a fiber cable",
)
async def record_health_metric(
    data: HealthMetricCreate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> HealthMetricResponse:
    """Record health metric"""
    try:
        metric = await service.record_health_metric(
            **data.model_dump(),
            created_by=current_user.email,
        )
        return HealthMetricResponse.model_validate(metric)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("fiber.health_metric.record.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record health metric",
        )


@router.get(
    "/health-metrics",
    response_model=list[HealthMetricResponse],
    summary="List Health Metrics",
    description="List health metrics with filters",
)
async def list_health_metrics(
    cable_id: UUID | None = Query(None, description="Filter by cable"),
    health_status: FiberHealthStatus | None = Query(None, description="Filter by health status"),
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: FiberService = Depends(get_fiber_service),
) -> list[HealthMetricResponse]:
    """List health metrics"""
    try:
        metrics = await service.list_health_metrics(
            cable_id=cable_id,
            health_status=health_status,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )
        return [HealthMetricResponse.model_validate(metric) for metric in metrics]
    except Exception as e:
        logger.exception("fiber.health_metric.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list health metrics",
        )


# ============================================================================
# OTDR Test Endpoints
# ============================================================================


@router.post(
    "/otdr-tests",
    response_model=OTDRTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record OTDR Test",
    description="Record OTDR test results for a fiber cable strand",
)
async def record_otdr_test(
    data: OTDRTestCreate,
    service: FiberService = Depends(get_fiber_service),
    current_user: UserInfo = Depends(get_current_user),
) -> OTDRTestResponse:
    """Record OTDR test"""
    try:
        test = await service.record_otdr_test(
            **data.model_dump(),
            created_by=current_user.email,
        )
        return OTDRTestResponse.model_validate(test)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("fiber.otdr_test.record.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to record OTDR test",
        )


@router.get(
    "/otdr-tests",
    response_model=list[OTDRTestResponse],
    summary="List OTDR Tests",
    description="List OTDR test results with filters",
)
async def list_otdr_tests(
    cable_id: UUID | None = Query(None, description="Filter by cable"),
    strand_id: int | None = Query(None, description="Filter by strand"),
    pass_fail: bool | None = Query(None, description="Filter by pass/fail"),
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    service: FiberService = Depends(get_fiber_service),
) -> list[OTDRTestResponse]:
    """List OTDR tests"""
    try:
        tests = await service.list_otdr_tests(
            cable_id=cable_id,
            strand_id=strand_id,
            pass_fail=pass_fail,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset,
        )
        return [OTDRTestResponse.model_validate(test) for test in tests]
    except Exception as e:
        logger.exception("fiber.otdr_test.list.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list OTDR tests",
        )


# ============================================================================
# Analytics & Reporting Endpoints
# ============================================================================


@router.get(
    "/analytics/network-health",
    response_model=NetworkHealthSummaryResponse,
    summary="Get Network Health Summary",
    description="Get overall network health summary",
)
async def get_network_health_summary(
    service: FiberService = Depends(get_fiber_service),
) -> NetworkHealthSummaryResponse:
    """Get network health summary"""
    try:
        summary = await service.get_network_health_summary()
        return NetworkHealthSummaryResponse.model_validate(summary)
    except Exception as e:
        logger.exception("fiber.network_health.get.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get network health summary",
        )


@router.get(
    "/analytics/capacity-planning",
    response_model=CapacityPlanningResponse,
    summary="Get Capacity Planning Data",
    description="Get capacity planning data for distribution points",
)
async def get_capacity_planning_data(
    service: FiberService = Depends(get_fiber_service),
) -> CapacityPlanningResponse:
    """Get capacity planning data"""
    try:
        data = await service.get_capacity_planning_data()
        return CapacityPlanningResponse.model_validate(data)
    except Exception as e:
        logger.exception("fiber.capacity_planning.get.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get capacity planning data",
        )


@router.get(
    "/analytics/coverage-summary",
    response_model=CoverageSummaryResponse,
    summary="Get Coverage Summary",
    description="Get overall coverage summary across all service areas",
)
async def get_coverage_summary(
    service: FiberService = Depends(get_fiber_service),
) -> CoverageSummaryResponse:
    """Get coverage summary"""
    try:
        summary = await service.get_coverage_summary()
        return CoverageSummaryResponse.model_validate(summary)
    except Exception as e:
        logger.exception("fiber.coverage_summary.get.failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get coverage summary",
        )
