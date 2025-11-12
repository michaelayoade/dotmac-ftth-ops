"""
Fiber Infrastructure GraphQL Query Resolvers

Implements GraphQL query resolvers for fiber optic network management:
- Fiber Cable queries (list, detail, by route)
- Splice Point queries (list, by cable, by location)
- Distribution Point queries (list, by type, by capacity)
- Service Area queries (list, coverage analysis)
- Fiber Analytics queries (health, OTDR results, network stats)
- Fiber Dashboard (aggregated metrics)

Created: 2025-10-16
Updated: 2025-10-19 - Implemented real database queries
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Any
from uuid import UUID

import strawberry
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.types import Info

from dotmac.platform.fiber.models import (
    CableInstallationType as DBCableInstallationType,
)
from dotmac.platform.fiber.models import (
    DistributionPoint as DistributionPointModel,
)
from dotmac.platform.fiber.models import (
    DistributionPointType as DBDistributionPointType,
)
from dotmac.platform.fiber.models import (
    FiberCable as FiberCableModel,
)
from dotmac.platform.fiber.models import FiberCableStatus as DBFiberCableStatus
from dotmac.platform.fiber.models import (
    FiberHealthMetric as FiberHealthMetricModel,
)
from dotmac.platform.fiber.models import FiberHealthStatus as DBFiberHealthStatus
from dotmac.platform.fiber.models import FiberType as DBFiberType
from dotmac.platform.fiber.models import (
    OTDRTestResult as OTDRTestResultModel,
)
from dotmac.platform.fiber.models import (
    ServiceArea as ServiceAreaModel,
)
from dotmac.platform.fiber.models import ServiceAreaType as DBServiceAreaType
from dotmac.platform.fiber.models import (
    SplicePoint as SplicePointModel,
)
from dotmac.platform.fiber.models import SpliceStatus as DBSpliceStatus
from dotmac.platform.graphql.types.fiber import (
    CableInstallationType,
    CableRoute,
    DistributionPoint,
    DistributionPointConnection,
    DistributionPointType,
    FiberCable,
    FiberCableConnection,
    FiberCableStatus,
    FiberDashboard,
    FiberHealthMetrics,
    FiberHealthStatus,
    FiberNetworkAnalytics,
    FiberType,
    GeoCoordinate,
    OTDRTestResult,
    ServiceArea,
    ServiceAreaConnection,
    ServiceAreaType,
    SplicePoint,
    SplicePointConnection,
    SpliceStatus,
)


@strawberry.type
class FiberQueries:
    """Fiber infrastructure GraphQL queries."""

    # ========================================================================
    # Fiber Cable Queries
    # ========================================================================

    @strawberry.field
    async def fiber_cables(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        status: FiberCableStatus | None = None,
        fiber_type: FiberType | None = None,
        installation_type: CableInstallationType | None = None,
        site_id: str | None = None,
        search: str | None = None,
    ) -> FiberCableConnection:
        """
        Query fiber cables with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            status: Filter by cable status
            fiber_type: Filter by fiber type (single-mode/multi-mode)
            installation_type: Filter by installation method
            site_id: Filter by site/area
            search: Search by cable ID, name, or route

        Returns:
            Paginated fiber cables list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit <= 0 or offset < 0:
            return FiberCableConnection(
                cables=[],
                total_count=0,
                has_next_page=False,
            )

        # Build query
        query = select(FiberCableModel).where(FiberCableModel.tenant_id == tenant_id)

        # Apply filters
        if status:
            db_status = _map_graphql_status_to_db(status)
            query = query.where(FiberCableModel.status == db_status)

        if fiber_type:
            db_fiber_type = _map_graphql_fiber_type_to_db(fiber_type)
            query = query.where(FiberCableModel.fiber_type == db_fiber_type)

        if installation_type:
            db_installation_type = _map_graphql_installation_type_to_db(installation_type)
            query = query.where(FiberCableModel.installation_type == db_installation_type)

        if site_id:
            query = query.where(
                or_(
                    FiberCableModel.start_site_id == site_id,
                    FiberCableModel.end_site_id == site_id,
                )
            )

        if search:
            query = query.where(
                or_(
                    FiberCableModel.cable_id.ilike(f"%{search}%"),
                    FiberCableModel.name.ilike(f"%{search}%"),
                )
            )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(FiberCableModel.cable_id)

        # Execute query
        result = await db.execute(query)
        cable_models = result.scalars().all()

        # Map to GraphQL types
        cables = [map_cable_model_to_graphql(cable) for cable in cable_models]

        return FiberCableConnection(
            cables=cables,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def fiber_cable(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> FiberCable | None:
        """
        Query a single fiber cable by ID.

        Args:
            id: Fiber cable ID

        Returns:
            Fiber cable details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            lookup_id = UUID(str(id))
        except ValueError:
            # Try as cable_id string
            query = select(FiberCableModel).where(
                and_(
                    FiberCableModel.cable_id == str(id),
                    FiberCableModel.tenant_id == tenant_id,
                )
            )
            result = await db.execute(query)
            cable = result.scalar_one_or_none()
            if cable:
                return map_cable_model_to_graphql(cable)
            return None

        query = select(FiberCableModel).where(
            and_(
                FiberCableModel.id == lookup_id,
                FiberCableModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        cable = result.scalar_one_or_none()

        if not cable:
            return None

        return map_cable_model_to_graphql(cable)

    @strawberry.field
    async def fiber_cables_by_route(
        self,
        info: Info,
        start_point_id: str,
        end_point_id: str,
    ) -> list[FiberCable]:
        """
        Query fiber cables between two distribution points.

        Args:
            start_point_id: Start distribution point ID
            end_point_id: End distribution point ID

        Returns:
            List of cables on this route
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(FiberCableModel).where(
            and_(
                FiberCableModel.tenant_id == tenant_id,
                or_(
                    and_(
                        FiberCableModel.start_site_id == start_point_id,
                        FiberCableModel.end_site_id == end_point_id,
                    ),
                    and_(
                        FiberCableModel.start_site_id == end_point_id,
                        FiberCableModel.end_site_id == start_point_id,
                    ),
                ),
            )
        )

        result = await db.execute(query)
        cables = result.scalars().all()

        return [map_cable_model_to_graphql(cable) for cable in cables]

    @strawberry.field
    async def fiber_cables_by_distribution_point(
        self,
        info: Info,
        distribution_point_id: str,
    ) -> list[FiberCable]:
        """
        Query all fiber cables connected to a distribution point.

        Args:
            distribution_point_id: Distribution point identifier

        Returns:
            List of connected cables
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(FiberCableModel).where(
            and_(
                FiberCableModel.tenant_id == tenant_id,
                or_(
                    FiberCableModel.start_site_id == distribution_point_id,
                    FiberCableModel.end_site_id == distribution_point_id,
                ),
            )
        )

        result = await db.execute(query)
        cables = result.scalars().all()

        return [map_cable_model_to_graphql(cable) for cable in cables]

    # ========================================================================
    # Splice Point Queries
    # ========================================================================

    @strawberry.field
    async def splice_points(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        status: SpliceStatus | None = None,
        cable_id: str | None = None,
        distribution_point_id: str | None = None,
    ) -> SplicePointConnection:
        """
        Query splice points with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            status: Filter by splice status
            cable_id: Filter by cable ID
            distribution_point_id: Filter by distribution point

        Returns:
            Paginated splice points list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit <= 0 or offset < 0:
            return SplicePointConnection(
                splice_points=[],
                total_count=0,
                has_next_page=False,
            )

        # Build query
        query = select(SplicePointModel).where(SplicePointModel.tenant_id == tenant_id)

        # Apply filters
        if status:
            db_status = _map_graphql_splice_status_to_db(status)
            query = query.where(SplicePointModel.status == db_status)

        if cable_id:
            # Try UUID first
            try:
                cable_uuid = UUID(cable_id)
                query = query.where(SplicePointModel.cable_id == cable_uuid)
            except ValueError:
                # If not UUID, join with cable and filter by cable_id
                query = query.join(FiberCableModel).where(FiberCableModel.cable_id == cable_id)

        if distribution_point_id:
            try:
                dp_uuid = UUID(distribution_point_id)
                query = query.where(SplicePointModel.distribution_point_id == dp_uuid)
            except ValueError:
                # Join with distribution point and filter by point_id
                query = query.join(DistributionPointModel).where(
                    DistributionPointModel.point_id == distribution_point_id
                )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(SplicePointModel.splice_id)

        # Execute query
        result = await db.execute(query)
        splice_models = result.scalars().all()

        # Map to GraphQL types
        splice_points = [map_splice_point_model_to_graphql(splice) for splice in splice_models]

        return SplicePointConnection(
            splice_points=splice_points,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def splice_point(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> SplicePoint | None:
        """
        Query a single splice point by ID.

        Args:
            id: Splice point ID

        Returns:
            Splice point details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            lookup_id = UUID(str(id))
        except ValueError:
            # Try as splice_id string
            query = select(SplicePointModel).where(
                and_(
                    SplicePointModel.splice_id == str(id),
                    SplicePointModel.tenant_id == tenant_id,
                )
            )
            result = await db.execute(query)
            splice = result.scalar_one_or_none()
            if splice:
                return map_splice_point_model_to_graphql(splice)
            return None

        query = select(SplicePointModel).where(
            and_(
                SplicePointModel.id == lookup_id,
                SplicePointModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        splice = result.scalar_one_or_none()

        if not splice:
            return None

        return map_splice_point_model_to_graphql(splice)

    @strawberry.field
    async def splice_points_by_cable(
        self,
        info: Info,
        cable_id: str,
    ) -> list[SplicePoint]:
        """
        Query all splice points on a specific fiber cable.

        Args:
            cable_id: Fiber cable identifier

        Returns:
            List of splice points on the cable
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Try as UUID first
        try:
            cable_uuid = UUID(cable_id)
            query = select(SplicePointModel).where(
                and_(
                    SplicePointModel.cable_id == cable_uuid,
                    SplicePointModel.tenant_id == tenant_id,
                )
            )
        except ValueError:
            # Join with cable and filter by cable_id
            query = (
                select(SplicePointModel)
                .join(FiberCableModel)
                .where(
                    and_(
                        FiberCableModel.cable_id == cable_id,
                        SplicePointModel.tenant_id == tenant_id,
                    )
                )
            )

        result = await db.execute(query)
        splices = result.scalars().all()

        return [map_splice_point_model_to_graphql(splice) for splice in splices]

    # ========================================================================
    # Distribution Point Queries
    # ========================================================================

    @strawberry.field
    async def distribution_points(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        point_type: DistributionPointType | None = None,
        status: FiberCableStatus | None = None,
        site_id: str | None = None,
        near_capacity: bool | None = None,
    ) -> DistributionPointConnection:
        """
        Query distribution points with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            point_type: Filter by distribution point type
            status: Filter by operational status
            site_id: Filter by site/area
            near_capacity: Filter points at >80% capacity

        Returns:
            Paginated distribution points list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit <= 0 or offset < 0:
            return DistributionPointConnection(
                distribution_points=[],
                total_count=0,
                has_next_page=False,
            )

        # Build query
        query = select(DistributionPointModel).where(DistributionPointModel.tenant_id == tenant_id)

        # Apply filters
        if point_type:
            db_point_type = _map_graphql_point_type_to_db(point_type)
            query = query.where(DistributionPointModel.point_type == db_point_type)

        if status:
            db_status = _map_graphql_status_to_db(status)
            query = query.where(DistributionPointModel.status == db_status)

        if site_id:
            query = query.where(DistributionPointModel.site_id == site_id)

        if near_capacity:
            # Filter for >80% capacity utilization
            query = query.where(
                and_(
                    DistributionPointModel.total_ports.isnot(None),
                    DistributionPointModel.total_ports > 0,
                    (DistributionPointModel.used_ports * 100.0 / DistributionPointModel.total_ports)
                    > 80,
                )
            )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(DistributionPointModel.point_id)

        # Execute query
        result = await db.execute(query)
        dp_models = result.scalars().all()

        # Map to GraphQL types
        distribution_points = [map_distribution_point_model_to_graphql(dp) for dp in dp_models]

        return DistributionPointConnection(
            distribution_points=distribution_points,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def distribution_point(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> DistributionPoint | None:
        """
        Query a single distribution point by ID.

        Args:
            id: Distribution point ID

        Returns:
            Distribution point details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            lookup_id = UUID(str(id))
        except ValueError:
            # Try as point_id string
            query = select(DistributionPointModel).where(
                and_(
                    DistributionPointModel.point_id == str(id),
                    DistributionPointModel.tenant_id == tenant_id,
                )
            )
            result = await db.execute(query)
            dp = result.scalar_one_or_none()
            if dp:
                return map_distribution_point_model_to_graphql(dp)
            return None

        query = select(DistributionPointModel).where(
            and_(
                DistributionPointModel.id == lookup_id,
                DistributionPointModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        dp = result.scalar_one_or_none()

        if not dp:
            return None

        return map_distribution_point_model_to_graphql(dp)

    @strawberry.field
    async def distribution_points_by_site(
        self,
        info: Info,
        site_id: str,
    ) -> list[DistributionPoint]:
        """
        Query all distribution points at a specific site.

        Args:
            site_id: Site identifier

        Returns:
            List of distribution points at the site
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(DistributionPointModel).where(
            and_(
                DistributionPointModel.site_id == site_id,
                DistributionPointModel.tenant_id == tenant_id,
            )
        )

        result = await db.execute(query)
        dps = result.scalars().all()

        return [map_distribution_point_model_to_graphql(dp) for dp in dps]

    # ========================================================================
    # Service Area Queries
    # ========================================================================

    @strawberry.field
    async def service_areas(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        area_type: ServiceAreaType | None = None,
        is_serviceable: bool | None = None,
        construction_status: str | None = None,
    ) -> ServiceAreaConnection:
        """
        Query service areas with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            area_type: Filter by area type (residential/commercial/etc)
            is_serviceable: Filter by serviceability status
            construction_status: Filter by construction phase

        Returns:
            Paginated service areas list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit <= 0 or offset < 0:
            return ServiceAreaConnection(
                service_areas=[],
                total_count=0,
                has_next_page=False,
            )

        # Build query
        query = select(ServiceAreaModel).where(ServiceAreaModel.tenant_id == tenant_id)

        # Apply filters
        if area_type:
            db_area_type = _map_graphql_area_type_to_db(area_type)
            query = query.where(ServiceAreaModel.area_type == db_area_type)

        if is_serviceable is not None:
            query = query.where(ServiceAreaModel.is_serviceable == is_serviceable)

        if construction_status:
            query = query.where(ServiceAreaModel.construction_status == construction_status)

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(ServiceAreaModel.name)

        # Execute query
        result = await db.execute(query)
        area_models = result.scalars().all()

        # Map to GraphQL types
        service_areas = [map_service_area_model_to_graphql(area) for area in area_models]

        return ServiceAreaConnection(
            service_areas=service_areas,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def service_area(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> ServiceArea | None:
        """
        Query a single service area by ID.

        Args:
            id: Service area ID

        Returns:
            Service area details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            lookup_id = UUID(str(id))
        except ValueError:
            # Try as area_id string
            query = select(ServiceAreaModel).where(
                and_(
                    ServiceAreaModel.area_id == str(id),
                    ServiceAreaModel.tenant_id == tenant_id,
                )
            )
            result = await db.execute(query)
            area = result.scalar_one_or_none()
            if area:
                return map_service_area_model_to_graphql(area)
            return None

        query = select(ServiceAreaModel).where(
            and_(
                ServiceAreaModel.id == lookup_id,
                ServiceAreaModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        area = result.scalar_one_or_none()

        if not area:
            return None

        return map_service_area_model_to_graphql(area)

    @strawberry.field
    async def service_areas_by_postal_code(
        self,
        info: Info,
        postal_code: str,
    ) -> list[ServiceArea]:
        """
        Query service areas covering a specific postal code.

        Args:
            postal_code: Postal code to search

        Returns:
            List of service areas covering this postal code
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # PostgreSQL JSON array contains check
        query = select(ServiceAreaModel).where(
            and_(
                ServiceAreaModel.tenant_id == tenant_id,
                ServiceAreaModel.postal_codes.contains([postal_code]),
            )
        )

        result = await db.execute(query)
        areas = result.scalars().all()

        return [map_service_area_model_to_graphql(area) for area in areas]

    # ========================================================================
    # Fiber Analytics Queries
    # ========================================================================

    @strawberry.field
    async def fiber_health_metrics(
        self,
        info: Info,
        cable_id: str | None = None,
        health_status: FiberHealthStatus | None = None,
    ) -> list[FiberHealthMetrics]:
        """
        Query fiber health metrics for cables.

        Args:
            cable_id: Specific cable ID (optional)
            health_status: Filter by health status

        Returns:
            List of fiber health metrics
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Build query
        query = select(FiberHealthMetricModel).where(FiberHealthMetricModel.tenant_id == tenant_id)

        # Apply filters
        if cable_id:
            try:
                cable_uuid = UUID(cable_id)
                query = query.where(FiberHealthMetricModel.cable_id == cable_uuid)
            except ValueError:
                # Join with cable and filter by cable_id
                query = query.join(FiberCableModel).where(FiberCableModel.cable_id == cable_id)

        if health_status:
            db_health_status = _map_graphql_health_status_to_db(health_status)
            query = query.where(FiberHealthMetricModel.health_status == db_health_status)

        # Order by most recent first
        query = query.order_by(FiberHealthMetricModel.measured_at.desc())

        # Execute query
        result = await db.execute(query)
        metrics = result.scalars().all()

        return [map_health_metric_model_to_graphql(metric) for metric in metrics]

    @strawberry.field
    async def otdr_test_results(
        self,
        info: Info,
        cable_id: str,
        strand_id: int | None = None,
        limit: int = 10,
    ) -> list[OTDRTestResult]:
        """
        Query OTDR test results for a fiber cable.

        Args:
            cable_id: Fiber cable identifier
            strand_id: Specific strand (optional)
            limit: Maximum number of results

        Returns:
            List of OTDR test results (most recent first)
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Build query
        try:
            cable_uuid = UUID(cable_id)
            query = select(OTDRTestResultModel).where(
                and_(
                    OTDRTestResultModel.cable_id == cable_uuid,
                    OTDRTestResultModel.tenant_id == tenant_id,
                )
            )
        except ValueError:
            # Join with cable and filter by cable_id
            query = (
                select(OTDRTestResultModel)
                .join(FiberCableModel)
                .where(
                    and_(
                        FiberCableModel.cable_id == cable_id,
                        OTDRTestResultModel.tenant_id == tenant_id,
                    )
                )
            )

        # Filter by strand if specified
        if strand_id is not None:
            query = query.where(OTDRTestResultModel.strand_id == strand_id)

        # Order by most recent first and limit
        query = query.order_by(OTDRTestResultModel.test_date.desc()).limit(limit)

        # Execute query
        result = await db.execute(query)
        tests = result.scalars().all()

        return [map_otdr_test_model_to_graphql(test) for test in tests]

    @strawberry.field
    async def fiber_network_analytics(
        self,
        info: Info,
    ) -> FiberNetworkAnalytics:
        return await self._fiber_network_analytics(info)

    async def _fiber_network_analytics(
        self,
        info: Info,
    ) -> FiberNetworkAnalytics:
        """
        Query aggregated fiber network analytics.

        Provides network-wide statistics, capacity metrics,
        health assessment, and coverage data.

        Returns:
            Complete network analytics
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Total fiber infrastructure counts
        total_cables_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(FiberCableModel.tenant_id == tenant_id)
        )
        total_cables = await db.scalar(total_cables_query) or 0

        total_strands_query = select(func.sum(FiberCableModel.fiber_count)).where(
            FiberCableModel.tenant_id == tenant_id
        )
        total_strands = await db.scalar(total_strands_query) or 0

        total_fiber_km_query = select(func.sum(FiberCableModel.length_km)).where(
            FiberCableModel.tenant_id == tenant_id
        )
        total_fiber_km = await db.scalar(total_fiber_km_query) or 0.0

        total_dps_query = (
            select(func.count())
            .select_from(DistributionPointModel)
            .where(DistributionPointModel.tenant_id == tenant_id)
        )
        total_dps = await db.scalar(total_dps_query) or 0

        total_splices_query = (
            select(func.count())
            .select_from(SplicePointModel)
            .where(SplicePointModel.tenant_id == tenant_id)
        )
        total_splices = await db.scalar(total_splices_query) or 0

        # Capacity metrics
        total_capacity_query = select(func.sum(DistributionPointModel.total_ports)).where(
            DistributionPointModel.tenant_id == tenant_id
        )
        total_capacity = await db.scalar(total_capacity_query) or 0

        used_capacity_query = select(func.sum(DistributionPointModel.used_ports)).where(
            DistributionPointModel.tenant_id == tenant_id
        )
        used_capacity = await db.scalar(used_capacity_query) or 0

        available_capacity = max(0, total_capacity - used_capacity)
        capacity_utilization = (
            (used_capacity * 100.0 / total_capacity) if total_capacity > 0 else 0.0
        )

        # Health status counts
        healthy_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.ACTIVE,
                )
            )
        )
        healthy_cables = await db.scalar(healthy_query) or 0

        degraded_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status.in_(
                        [DBFiberCableStatus.MAINTENANCE, DBFiberCableStatus.DAMAGED]
                    ),
                )
            )
        )
        degraded_cables = await db.scalar(degraded_query) or 0

        failed_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.RETIRED,
                )
            )
        )
        failed_cables = await db.scalar(failed_query) or 0

        # Network health score (simplified)
        network_health_score = (healthy_cables * 100.0 / total_cables) if total_cables > 0 else 0.0

        # Service area metrics
        total_areas_query = (
            select(func.count())
            .select_from(ServiceAreaModel)
            .where(ServiceAreaModel.tenant_id == tenant_id)
        )
        total_areas = await db.scalar(total_areas_query) or 0

        active_areas_query = (
            select(func.count())
            .select_from(ServiceAreaModel)
            .where(
                and_(
                    ServiceAreaModel.tenant_id == tenant_id,
                    ServiceAreaModel.is_serviceable == True,  # noqa: E712
                )
            )
        )
        active_areas = await db.scalar(active_areas_query) or 0

        homes_passed_query = select(func.sum(ServiceAreaModel.homes_passed)).where(
            ServiceAreaModel.tenant_id == tenant_id
        )
        homes_passed = await db.scalar(homes_passed_query) or 0

        homes_connected_query = select(func.sum(ServiceAreaModel.homes_connected)).where(
            ServiceAreaModel.tenant_id == tenant_id
        )
        homes_connected = await db.scalar(homes_connected_query) or 0

        penetration_rate = (homes_connected * 100.0 / homes_passed) if homes_passed > 0 else 0.0

        # Average loss metrics
        avg_attenuation_query = select(func.avg(FiberCableModel.attenuation_db_per_km)).where(
            and_(
                FiberCableModel.tenant_id == tenant_id,
                FiberCableModel.attenuation_db_per_km.isnot(None),
            )
        )
        avg_attenuation = await db.scalar(avg_attenuation_query) or 0.0

        avg_splice_loss_query = select(func.avg(SplicePointModel.insertion_loss_db)).where(
            and_(
                SplicePointModel.tenant_id == tenant_id,
                SplicePointModel.insertion_loss_db.isnot(None),
            )
        )
        avg_splice_loss = await db.scalar(avg_splice_loss_query) or 0.0

        # Cable status counts
        active_cables_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.ACTIVE,
                )
            )
        )
        cables_active = await db.scalar(active_cables_query) or 0

        inactive_cables_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.INACTIVE,
                )
            )
        )
        cables_inactive = await db.scalar(inactive_cables_query) or 0

        construction_cables_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.UNDER_CONSTRUCTION,
                )
            )
        )
        cables_under_construction = await db.scalar(construction_cables_query) or 0

        maintenance_cables_query = (
            select(func.count())
            .select_from(FiberCableModel)
            .where(
                and_(
                    FiberCableModel.tenant_id == tenant_id,
                    FiberCableModel.status == DBFiberCableStatus.MAINTENANCE,
                )
            )
        )
        cables_maintenance = await db.scalar(maintenance_cables_query) or 0

        # Query cables with high loss (attenuation > 0.5 dB/km)
        high_loss_threshold = 0.5
        high_loss_cables_query = select(FiberCableModel.cable_id).where(
            and_(
                FiberCableModel.tenant_id == tenant_id,
                FiberCableModel.attenuation_db_per_km.isnot(None),
                FiberCableModel.attenuation_db_per_km > high_loss_threshold,
            )
        )
        result = await db.execute(high_loss_cables_query)
        cables_with_high_loss = list(result.scalars().all())

        distribution_points_near_capacity: list[str] = []
        service_areas_needs_expansion: list[str] = []
        cables_due_for_testing = 0

        return FiberNetworkAnalytics(
            total_fiber_km=float(total_fiber_km),
            total_cables=total_cables,
            total_strands=total_strands,
            total_distribution_points=total_dps,
            total_splice_points=total_splices,
            total_capacity=total_capacity,
            used_capacity=used_capacity,
            available_capacity=available_capacity,
            capacity_utilization_percent=float(capacity_utilization),
            healthy_cables=healthy_cables,
            degraded_cables=degraded_cables,
            failed_cables=failed_cables,
            network_health_score=float(network_health_score),
            total_service_areas=total_areas,
            active_service_areas=active_areas,
            homes_passed=homes_passed,
            homes_connected=homes_connected,
            penetration_rate_percent=float(penetration_rate),
            average_cable_loss_db_per_km=float(avg_attenuation),
            average_splice_loss_db=float(avg_splice_loss),
            cables_due_for_testing=cables_due_for_testing,
            cables_active=cables_active,
            cables_inactive=cables_inactive,
            cables_under_construction=cables_under_construction,
            cables_maintenance=cables_maintenance,
            cables_with_high_loss=cables_with_high_loss,
            distribution_points_near_capacity=distribution_points_near_capacity,
            service_areas_needs_expansion=service_areas_needs_expansion,
            generated_at=datetime.utcnow(),
        )

    @strawberry.field
    async def fiber_dashboard(
        self,
        info: Info,
    ) -> FiberDashboard:
        """
        Query complete fiber network dashboard data.

        Provides network overview, top performers, health monitoring,
        capacity planning, and trends.

        Returns:
            Complete dashboard data
        """
        # Get analytics (reuse the analytics query)
        analytics = await self._fiber_network_analytics(info)

        # For now, return dashboard with empty lists for top performers and trends
        # These would typically require time-series data or additional metrics
        return FiberDashboard(
            analytics=analytics,
            top_cables_by_utilization=[],
            top_distribution_points_by_capacity=[],
            top_service_areas_by_penetration=[],
            cables_requiring_attention=[],
            recent_test_results=[],
            distribution_points_near_capacity=[],
            service_areas_expansion_candidates=[],
            new_connections_trend=[],
            capacity_utilization_trend=[],
            network_health_trend=[],
            generated_at=datetime.utcnow(),
        )


# ============================================================================
# Helper Functions for Mapping Models to GraphQL Types
# ============================================================================


def _ensure_dict(data: Any) -> dict[str, Any]:
    if isinstance(data, dict):
        return data
    if isinstance(data, str):
        try:
            parsed = json.loads(data)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return {}
    return {}


def _geo_from_coordinates(coordinates: Any) -> GeoCoordinate:
    if isinstance(coordinates, (list, tuple)) and len(coordinates) >= 2:
        lon = float(coordinates[0])
        lat = float(coordinates[1])
        altitude = float(coordinates[2]) if len(coordinates) > 2 else None
        return GeoCoordinate(latitude=lat, longitude=lon, altitude=altitude)
    return GeoCoordinate(latitude=0.0, longitude=0.0)


def _geo_from_point(point: Any) -> GeoCoordinate:
    data = _ensure_dict(point)
    return _geo_from_coordinates(data.get("coordinates"))


def _build_cable_route(route_geojson: Any, length_km: float | None) -> CableRoute:
    data = _ensure_dict(route_geojson)
    coordinates = data.get("coordinates")
    intermediate: list[GeoCoordinate]
    if isinstance(coordinates, list) and coordinates:
        start = _geo_from_coordinates(coordinates[0])
        end = _geo_from_coordinates(coordinates[-1])
        intermediate = [_geo_from_coordinates(coord) for coord in coordinates[1:-1]]
    else:
        start = GeoCoordinate(latitude=0.0, longitude=0.0)
        end = GeoCoordinate(latitude=0.0, longitude=0.0)
        intermediate = []

    length_meters = float(length_km or 0.0) * 1000.0
    path_geojson = json.dumps(data) if data else "[]"

    return CableRoute(
        path_geojson=path_geojson,
        total_distance_meters=length_meters,
        start_point=start,
        end_point=end,
        intermediate_points=intermediate,
    )


def _geo_or_default(point: Any | None) -> GeoCoordinate:
    if point is None:
        return GeoCoordinate(latitude=0.0, longitude=0.0)
    return _geo_from_point(point)


def map_cable_model_to_graphql(cable_model: FiberCableModel) -> FiberCable:
    """
    Map database FiberCable model to GraphQL FiberCable type.

    Args:
        cable_model: Database model instance

    Returns:
        GraphQL FiberCable instance
    """
    total_strands = cable_model.fiber_count
    used_strands = cable_model.max_capacity or 0
    available_strands = max(0, total_strands - used_strands)
    capacity_utilization = (used_strands * 100.0 / total_strands) if total_strands else 0.0

    route = _build_cable_route(cable_model.route_geojson, cable_model.length_km)

    splice_points = getattr(cable_model, "splice_points", []) or []
    splice_ids = [str(splice.id) for splice in splice_points]

    health_metrics = getattr(cable_model, "health_metrics", []) or []
    primary_metric = health_metrics[0] if health_metrics else None

    total_loss_db = (
        float(primary_metric.total_loss_db)
        if primary_metric and primary_metric.total_loss_db is not None
        else None
    )
    avg_attenuation = (
        float(cable_model.attenuation_db_per_km)
        if cable_model.attenuation_db_per_km is not None
        else None
    )

    bandwidth_capacity = float(cable_model.max_capacity) if cable_model.max_capacity else None

    return FiberCable(
        id=strawberry.ID(str(cable_model.id)),
        cable_id=cable_model.cable_id,
        name=cable_model.name or "",
        description=cable_model.notes,
        status=_map_db_status_to_graphql(cable_model.status),
        is_active=cable_model.status == DBFiberCableStatus.ACTIVE,
        fiber_type=_map_db_fiber_type_to_graphql(cable_model.fiber_type),
        total_strands=total_strands,
        available_strands=available_strands,
        used_strands=used_strands,
        manufacturer=cable_model.manufacturer,
        model=cable_model.model,
        installation_type=(
            _map_db_installation_type_to_graphql(cable_model.installation_type)
            if cable_model.installation_type is not None
            else CableInstallationType.AERIAL
        ),
        route=route,
        length_meters=float(cable_model.length_km or 0.0) * 1000.0,
        strands=[],
        start_distribution_point_id=cable_model.start_site_id or "",
        end_distribution_point_id=cable_model.end_site_id or "",
        start_point_name=cable_model.start_site_id,
        end_point_name=cable_model.end_site_id,
        capacity_utilization_percent=float(capacity_utilization),
        bandwidth_capacity_gbps=bandwidth_capacity,
        splice_point_ids=splice_ids,
        splice_count=len(splice_ids),
        total_loss_db=total_loss_db,
        average_attenuation_db_per_km=avg_attenuation,
        max_attenuation_db_per_km=None,
        conduit_id=None,
        duct_number=None,
        armored=False,
        fire_rated=False,
        owner_id=None,
        owner_name=None,
        is_leased=False,
        installed_at=cable_model.installation_date,
        tested_at=primary_metric.measured_at if primary_metric else None,
        created_at=cable_model.created_at,
        updated_at=cable_model.updated_at,
    )


def map_splice_point_model_to_graphql(splice_model: SplicePointModel) -> SplicePoint:
    """
    Map database SplicePoint model to GraphQL SplicePoint type.

    Args:
        splice_model: Database model instance

    Returns:
        GraphQL SplicePoint instance
    """
    cables_connected = [str(splice_model.cable_id)]
    cable_count = len(cables_connected)
    status = _map_db_splice_status_to_graphql(splice_model.status)
    is_active = status == SpliceStatus.ACTIVE

    passing_splices = 1 if is_active else 0
    failing_splices = 1 if status == SpliceStatus.FAILED else 0

    return SplicePoint(
        id=strawberry.ID(str(splice_model.id)),
        splice_id=splice_model.splice_id,
        name=splice_model.splice_id,
        description=splice_model.notes,
        status=status,
        is_active=is_active,
        location=_geo_or_default(splice_model.location_geojson),
        address=None,
        distribution_point_id=(
            str(splice_model.distribution_point_id) if splice_model.distribution_point_id else None
        ),
        closure_type=splice_model.enclosure_type,
        manufacturer=None,
        model=None,
        tray_count=0,
        tray_capacity=0,
        cables_connected=cables_connected,
        cable_count=cable_count,
        splice_connections=[],
        total_splices=cable_count,
        active_splices=passing_splices,
        average_splice_loss_db=splice_model.insertion_loss_db,
        max_splice_loss_db=splice_model.insertion_loss_db,
        passing_splices=passing_splices,
        failing_splices=failing_splices,
        access_type="underground",
        requires_special_access=False,
        access_notes=None,
        installed_at=None,
        last_tested_at=splice_model.last_test_date,
        last_maintained_at=None,
        created_at=splice_model.created_at,
        updated_at=splice_model.updated_at,
    )


def map_distribution_point_model_to_graphql(
    dp_model: DistributionPointModel,
) -> DistributionPoint:
    """
    Map database DistributionPoint model to GraphQL DistributionPoint type.

    Args:
        dp_model: Database model instance

    Returns:
        GraphQL DistributionPoint instance
    """
    total_ports = dp_model.total_ports or 0
    used_ports = dp_model.used_ports or 0
    available_ports = max(0, total_ports - used_ports)
    utilization = (used_ports * 100.0 / total_ports) if total_ports > 0 else 0.0

    return DistributionPoint(
        id=strawberry.ID(str(dp_model.id)),
        site_id=dp_model.site_id or "",
        name=dp_model.name or dp_model.point_id,
        description=dp_model.notes,
        point_type=_map_db_point_type_to_graphql(dp_model.point_type),
        status=_map_db_status_to_graphql(dp_model.status),
        is_active=dp_model.status == DBFiberCableStatus.ACTIVE,
        location=_geo_or_default(dp_model.location_geojson),
        address=None,
        site_name=None,
        manufacturer=dp_model.manufacturer,
        model=dp_model.model,
        total_capacity=total_ports,
        available_capacity=available_ports,
        used_capacity=used_ports,
        ports=[],
        port_count=0,
        incoming_cables=[],
        outgoing_cables=[],
        total_cables_connected=(
            len(dp_model.splice_points)
            if hasattr(dp_model, "splice_points") and dp_model.splice_points
            else 0
        ),
        splice_points=[str(splice.id) for splice in getattr(dp_model, "splice_points", []) or []],
        splice_point_count=len(getattr(dp_model, "splice_points", []) or []),
        has_power=False,
        battery_backup=False,
        environmental_monitoring=False,
        temperature_celsius=None,
        humidity_percent=None,
        capacity_utilization_percent=float(utilization),
        fiber_strand_count=0,
        available_strand_count=0,
        service_area_ids=[],
        serves_customer_count=0,
        access_type="restricted",
        requires_key=False,
        security_level=None,
        access_notes=None,
        installed_at=dp_model.installation_date,
        last_inspected_at=None,
        last_maintained_at=None,
        created_at=dp_model.created_at,
        updated_at=dp_model.updated_at,
    )


def map_service_area_model_to_graphql(area_model: ServiceAreaModel) -> ServiceArea:
    """
    Map database ServiceArea model to GraphQL ServiceArea type.

    Args:
        area_model: Database model instance

    Returns:
        GraphQL ServiceArea instance
    """
    homes_passed = area_model.homes_passed or 0
    homes_connected = area_model.homes_connected or 0
    businesses_passed = area_model.businesses_passed or 0
    businesses_connected = area_model.businesses_connected or 0

    penetration_rate = (homes_connected * 100.0 / homes_passed) if homes_passed > 0 else 0.0
    ((businesses_connected * 100.0 / businesses_passed) if businesses_passed > 0 else 0.0)

    return ServiceArea(
        id=strawberry.ID(str(area_model.id)),
        area_id=area_model.area_id,
        name=area_model.name,
        description=area_model.notes,
        area_type=_map_db_area_type_to_graphql(area_model.area_type),
        is_active=area_model.is_serviceable,
        is_serviceable=area_model.is_serviceable,
        boundary_geojson=json.dumps(area_model.coverage_geojson or {}),
        area_sqkm=0.0,
        city="",
        state_province="",
        postal_codes=area_model.postal_codes or [],
        street_count=0,
        homes_passed=homes_passed,
        homes_connected=homes_connected,
        businesses_passed=businesses_passed,
        businesses_connected=businesses_connected,
        penetration_rate_percent=float(penetration_rate),
        distribution_point_ids=[],
        distribution_point_count=0,
        total_fiber_km=0.0,
        total_capacity=0,
        used_capacity=0,
        available_capacity=0,
        capacity_utilization_percent=0.0,
        max_bandwidth_gbps=0.0,
        average_distance_to_distribution_meters=None,
        estimated_population=None,
        household_density_per_sqkm=None,
        construction_status=area_model.construction_status or "planned",
        construction_complete_percent=None,
        target_completion_date=None,
        planned_at=None,
        construction_started_at=None,
        activated_at=area_model.go_live_date,
        created_at=area_model.created_at,
        updated_at=area_model.updated_at,
    )


def map_health_metric_model_to_graphql(
    metric_model: FiberHealthMetricModel,
) -> FiberHealthMetrics:
    """Map database FiberHealthMetric model to GraphQL type."""
    total_loss = float(metric_model.total_loss_db or 0.0)
    average_loss = total_loss  # Fallback until per-km metrics are available
    splice_loss = float(metric_model.splice_loss_db or 0.0)
    connector_loss = float(metric_model.connector_loss_db or 0.0)

    detected_issues = metric_model.detected_issues or []
    warning_items = metric_model.recommendations or []

    return FiberHealthMetrics(
        cable_id=str(metric_model.cable_id),
        cable_name="",
        health_status=_map_db_health_status_to_graphql(metric_model.health_status),
        health_score=float(metric_model.health_score or 0.0),
        total_loss_db=total_loss,
        average_loss_per_km_db=average_loss,
        max_loss_per_km_db=average_loss,
        reflectance_db=connector_loss,
        average_splice_loss_db=splice_loss,
        max_splice_loss_db=splice_loss,
        failing_splices_count=0,
        total_strands=0,
        active_strands=0,
        degraded_strands=0,
        failed_strands=0,
        last_tested_at=metric_model.measured_at,
        test_pass_rate_percent=None,
        days_since_last_test=None,
        active_alarms=len(detected_issues) if isinstance(detected_issues, list) else 0,
        warning_count=len(warning_items) if isinstance(warning_items, list) else 0,
        requires_maintenance=bool(detected_issues),
    )


def map_otdr_test_model_to_graphql(
    test_model: OTDRTestResultModel,
) -> OTDRTestResult:
    """Map database OTDRTestResult model to GraphQL type."""
    length_km = float(test_model.length_km or 0.0)
    total_length_meters = length_km * 1000.0
    total_loss = float(test_model.total_loss_db or 0.0)
    average_attenuation = (total_loss / length_km) if length_km > 0 else 0.0

    return OTDRTestResult(
        test_id=str(test_model.id),
        cable_id=str(test_model.cable_id),
        strand_id=test_model.strand_id,
        tested_at=test_model.test_date,
        tested_by=test_model.tester_id or "",
        wavelength_nm=test_model.wavelength_nm or 0,
        pulse_width_ns=test_model.pulse_width_ns or 0,
        total_loss_db=total_loss,
        total_length_meters=total_length_meters,
        average_attenuation_db_per_km=average_attenuation,
        splice_count=0,
        connector_count=0,
        bend_count=0,
        break_count=0,
        is_passing=bool(test_model.pass_fail),
        pass_threshold_db=0.0,
        margin_db=None,
        trace_file_url=None,
    )


# ============================================================================
# Enum Mapping Functions
# ============================================================================


def _map_graphql_status_to_db(status: FiberCableStatus) -> DBFiberCableStatus:
    """Map GraphQL FiberCableStatus to database enum."""
    value = status.value
    mapping: dict[str, DBFiberCableStatus] = {
        "active": DBFiberCableStatus.ACTIVE,
        "inactive": DBFiberCableStatus.INACTIVE,
        "under_construction": DBFiberCableStatus.UNDER_CONSTRUCTION,
        "maintenance": DBFiberCableStatus.MAINTENANCE,
        "damaged": DBFiberCableStatus.DAMAGED,
        "decommissioned": DBFiberCableStatus.RETIRED,
    }
    return mapping.get(value, DBFiberCableStatus.ACTIVE)


def _map_db_status_to_graphql(status: DBFiberCableStatus) -> FiberCableStatus:
    """Map database FiberCableStatus to GraphQL enum."""
    mapping = {
        DBFiberCableStatus.ACTIVE: FiberCableStatus.ACTIVE,
        DBFiberCableStatus.INACTIVE: FiberCableStatus.INACTIVE,
        DBFiberCableStatus.UNDER_CONSTRUCTION: FiberCableStatus.UNDER_CONSTRUCTION,
        DBFiberCableStatus.MAINTENANCE: FiberCableStatus.MAINTENANCE,
        DBFiberCableStatus.DAMAGED: FiberCableStatus.DAMAGED,
        DBFiberCableStatus.RETIRED: FiberCableStatus.DECOMMISSIONED,
    }
    return mapping.get(status, FiberCableStatus.ACTIVE)


def _map_graphql_fiber_type_to_db(fiber_type: FiberType) -> DBFiberType:
    """Map GraphQL FiberType to database enum."""
    if fiber_type == FiberType.MULTI_MODE:
        return DBFiberType.MULTI_MODE
    return DBFiberType.SINGLE_MODE


def _map_db_fiber_type_to_graphql(fiber_type: DBFiberType) -> FiberType:
    """Map database FiberType to GraphQL enum."""
    if fiber_type == DBFiberType.MULTI_MODE:
        return FiberType.MULTI_MODE
    return FiberType.SINGLE_MODE


def _map_graphql_installation_type_to_db(
    installation_type: CableInstallationType,
) -> DBCableInstallationType:
    """Map GraphQL CableInstallationType to database enum."""
    mapping = {
        CableInstallationType.AERIAL.value: DBCableInstallationType.AERIAL,
        CableInstallationType.UNDERGROUND.value: DBCableInstallationType.UNDERGROUND,
        CableInstallationType.BURIED.value: DBCableInstallationType.DIRECT_BURIAL,
        CableInstallationType.DUCT.value: DBCableInstallationType.DUCT,
        CableInstallationType.BUILDING.value: DBCableInstallationType.UNDERGROUND,
        CableInstallationType.SUBMARINE.value: DBCableInstallationType.DIRECT_BURIAL,
    }
    return mapping.get(installation_type.value, DBCableInstallationType.AERIAL)


def _map_db_installation_type_to_graphql(
    installation_type: DBCableInstallationType,
) -> CableInstallationType:
    """Map database CableInstallationType to GraphQL enum."""
    mapping = {
        DBCableInstallationType.AERIAL: CableInstallationType.AERIAL,
        DBCableInstallationType.UNDERGROUND: CableInstallationType.UNDERGROUND,
        DBCableInstallationType.DIRECT_BURIAL: CableInstallationType.BURIED,
        DBCableInstallationType.DUCT: CableInstallationType.DUCT,
    }
    return mapping.get(installation_type, CableInstallationType.AERIAL)


def _map_graphql_splice_status_to_db(status: SpliceStatus) -> DBSpliceStatus:
    """Map GraphQL SpliceStatus to database enum."""
    if status == SpliceStatus.ACTIVE:
        return DBSpliceStatus.ACTIVE
    if status == SpliceStatus.DEGRADED:
        return DBSpliceStatus.DEGRADED
    if status == SpliceStatus.FAILED:
        return DBSpliceStatus.FAILED
    return DBSpliceStatus.PENDING_TEST


def _map_db_splice_status_to_graphql(status: DBSpliceStatus) -> SpliceStatus:
    """Map database SpliceStatus to GraphQL enum."""
    if status == DBSpliceStatus.ACTIVE:
        return SpliceStatus.ACTIVE
    if status == DBSpliceStatus.DEGRADED:
        return SpliceStatus.DEGRADED
    if status == DBSpliceStatus.FAILED:
        return SpliceStatus.FAILED
    return SpliceStatus.INACTIVE


def _map_graphql_point_type_to_db(
    point_type: DistributionPointType,
) -> DBDistributionPointType:
    """Map GraphQL DistributionPointType to database enum."""
    mapping: dict[str, DBDistributionPointType] = {
        "cabinet": DBDistributionPointType.FDH,
        "closure": DBDistributionPointType.FAT,
        "pole": DBDistributionPointType.FDT,
        "manhole": DBDistributionPointType.SPLITTER,
        "handhole": DBDistributionPointType.PATCH_PANEL,
        "building_entry": DBDistributionPointType.FDH,
        "pedestal": DBDistributionPointType.FAT,
    }
    return mapping.get(point_type.value, DBDistributionPointType.FDH)


def _map_db_point_type_to_graphql(
    point_type: DBDistributionPointType,
) -> DistributionPointType:
    """Map database DistributionPointType to GraphQL enum."""
    mapping = {
        DBDistributionPointType.FDH: DistributionPointType.CABINET,
        DBDistributionPointType.FDT: DistributionPointType.PEDESTAL,
        DBDistributionPointType.FAT: DistributionPointType.CLOSURE,
        DBDistributionPointType.SPLITTER: DistributionPointType.MANHOLE,
        DBDistributionPointType.PATCH_PANEL: DistributionPointType.BUILDING_ENTRY,
    }
    return mapping.get(point_type, DistributionPointType.CABINET)


def _map_graphql_area_type_to_db(area_type: ServiceAreaType) -> DBServiceAreaType:
    """Map GraphQL ServiceAreaType to database enum."""
    mapping = {
        ServiceAreaType.RESIDENTIAL: DBServiceAreaType.RESIDENTIAL,
        ServiceAreaType.COMMERCIAL: DBServiceAreaType.COMMERCIAL,
        ServiceAreaType.INDUSTRIAL: DBServiceAreaType.INDUSTRIAL,
        ServiceAreaType.MIXED: DBServiceAreaType.MIXED,
    }
    return mapping[area_type]


def _map_db_area_type_to_graphql(area_type: DBServiceAreaType) -> ServiceAreaType:
    """Map database ServiceAreaType to GraphQL enum."""
    mapping = {
        DBServiceAreaType.RESIDENTIAL: ServiceAreaType.RESIDENTIAL,
        DBServiceAreaType.COMMERCIAL: ServiceAreaType.COMMERCIAL,
        DBServiceAreaType.INDUSTRIAL: ServiceAreaType.INDUSTRIAL,
        DBServiceAreaType.MIXED: ServiceAreaType.MIXED,
    }
    return mapping[area_type]


def _map_graphql_health_status_to_db(
    health_status: FiberHealthStatus,
) -> DBFiberHealthStatus:
    """Map GraphQL FiberHealthStatus to database enum."""
    if health_status == FiberHealthStatus.EXCELLENT:
        return DBFiberHealthStatus.EXCELLENT
    if health_status == FiberHealthStatus.GOOD:
        return DBFiberHealthStatus.GOOD
    if health_status == FiberHealthStatus.FAIR:
        return DBFiberHealthStatus.FAIR
    if health_status == FiberHealthStatus.POOR:
        return DBFiberHealthStatus.DEGRADED
    return DBFiberHealthStatus.CRITICAL


def _map_db_health_status_to_graphql(
    health_status: DBFiberHealthStatus,
) -> FiberHealthStatus:
    """Map database FiberHealthStatus to GraphQL enum."""
    if health_status == DBFiberHealthStatus.EXCELLENT:
        return FiberHealthStatus.EXCELLENT
    if health_status == DBFiberHealthStatus.GOOD:
        return FiberHealthStatus.GOOD
    if health_status == DBFiberHealthStatus.FAIR:
        return FiberHealthStatus.FAIR
    if health_status == DBFiberHealthStatus.DEGRADED:
        return FiberHealthStatus.POOR
    return FiberHealthStatus.CRITICAL
