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

from datetime import datetime
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
                    FiberCableModel.status == DBFiberCableStatus.DECOMMISSIONED,
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

        # Query distribution points near capacity (utilization > 80%)
        capacity_threshold = 80.0
        near_capacity_dps_query = select(DistributionPointModel.dp_id).where(
            and_(
                DistributionPointModel.tenant_id == tenant_id,
                DistributionPointModel.max_capacity.isnot(None),
                DistributionPointModel.max_capacity > 0,
                (
                    (
                        DistributionPointModel.current_capacity
                        * 100.0
                        / DistributionPointModel.max_capacity
                    )
                    > capacity_threshold
                ),
            )
        )
        result = await db.execute(near_capacity_dps_query)
        distribution_points_near_capacity = list(result.scalars().all())

        # Query service areas needing expansion (penetration rate < 30%)
        penetration_threshold = 30.0
        expansion_areas_query = select(ServiceAreaModel.area_id).where(
            and_(
                ServiceAreaModel.tenant_id == tenant_id,
                ServiceAreaModel.homes_passed.isnot(None),
                ServiceAreaModel.homes_passed > 0,
                ServiceAreaModel.is_serviceable == True,  # noqa: E712
                (
                    (ServiceAreaModel.homes_connected * 100.0 / ServiceAreaModel.homes_passed)
                    < penetration_threshold
                ),
            )
        )
        result = await db.execute(expansion_areas_query)
        service_areas_needs_expansion = list(result.scalars().all())

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
            cables_due_for_testing=0,  # Would require OTDR test date tracking
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
        analytics = await self.fiber_network_analytics(info)

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


def map_cable_model_to_graphql(cable_model: FiberCableModel) -> FiberCable:
    """
    Map database FiberCable model to GraphQL FiberCable type.

    Args:
        cable_model: Database model instance

    Returns:
        GraphQL FiberCable instance
    """
    return FiberCable(
        id=str(cable_model.id),
        cable_id=cable_model.cable_id,
        name=cable_model.name or "",
        description=None,
        status=_map_db_status_to_graphql(cable_model.status),
        is_active=cable_model.status == DBFiberCableStatus.ACTIVE,
        fiber_type=_map_db_fiber_type_to_graphql(cable_model.fiber_type),
        total_strands=cable_model.fiber_count,
        available_strands=cable_model.fiber_count - (cable_model.max_capacity or 0)
        if cable_model.max_capacity
        else cable_model.fiber_count,
        used_strands=cable_model.max_capacity or 0,
        manufacturer=cable_model.manufacturer,
        model=cable_model.model,
        installation_type=_map_db_installation_type_to_graphql(cable_model.installation_type)
        if cable_model.installation_type
        else CableInstallationType.UNDERGROUND,
        route=cable_model.route_geojson if cable_model.route_geojson else None,
        start_point_id=cable_model.start_site_id,
        end_point_id=cable_model.end_site_id,
        length_km=cable_model.length_km or 0.0,
        installation_date=cable_model.installation_date,
        warranty_expiry_date=cable_model.warranty_expiry_date,
        attenuation_db_per_km=cable_model.attenuation_db_per_km,
        max_capacity=cable_model.max_capacity,
        splice_count=len(cable_model.splice_points)
        if hasattr(cable_model, "splice_points") and cable_model.splice_points
        else 0,
        health_status=_map_db_health_status_to_graphql(cable_model.health_metrics[0].health_status)
        if hasattr(cable_model, "health_metrics") and cable_model.health_metrics
        else None,
        last_tested_at=cable_model.health_metrics[0].measured_at
        if hasattr(cable_model, "health_metrics") and cable_model.health_metrics
        else None,
        notes=cable_model.notes,
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
    return SplicePoint(
        id=str(splice_model.id),
        splice_id=splice_model.splice_id,
        cable_id=str(splice_model.cable_id),
        distribution_point_id=str(splice_model.distribution_point_id)
        if splice_model.distribution_point_id
        else None,
        status=_map_db_splice_status_to_graphql(splice_model.status),
        splice_type=splice_model.splice_type,
        location=splice_model.location_geojson if splice_model.location_geojson else None,
        enclosure_type=splice_model.enclosure_type,
        insertion_loss_db=splice_model.insertion_loss_db,
        return_loss_db=splice_model.return_loss_db,
        last_test_date=splice_model.last_test_date,
        is_healthy=splice_model.status == DBSpliceStatus.ACTIVE,
        notes=splice_model.notes,
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
        id=str(dp_model.id),
        point_id=dp_model.point_id,
        point_type=_map_db_point_type_to_graphql(dp_model.point_type),
        name=dp_model.name,
        description=None,
        status=_map_db_status_to_graphql(dp_model.status),
        is_active=dp_model.status == DBFiberCableStatus.ACTIVE,
        site_id=dp_model.site_id,
        location=dp_model.location_geojson if dp_model.location_geojson else None,
        address=dp_model.address,
        total_ports=total_ports,
        used_ports=used_ports,
        available_ports=available_ports,
        capacity_utilization_percent=float(utilization),
        is_near_capacity=utilization > 80.0,
        connected_cables_count=len(dp_model.splice_points)
        if hasattr(dp_model, "splice_points") and dp_model.splice_points
        else 0,
        manufacturer=dp_model.manufacturer,
        model=dp_model.model,
        installation_date=dp_model.installation_date,
        notes=dp_model.notes,
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
    business_penetration_rate = (
        (businesses_connected * 100.0 / businesses_passed) if businesses_passed > 0 else 0.0
    )

    return ServiceArea(
        id=str(area_model.id),
        area_id=area_model.area_id,
        name=area_model.name,
        description=None,
        area_type=_map_db_area_type_to_graphql(area_model.area_type),
        is_serviceable=area_model.is_serviceable,
        coverage=area_model.coverage_geojson if area_model.coverage_geojson else None,
        postal_codes=area_model.postal_codes or [],
        construction_status=area_model.construction_status,
        go_live_date=area_model.go_live_date,
        homes_passed=homes_passed,
        homes_connected=homes_connected,
        homes_penetration_percent=float(penetration_rate),
        businesses_passed=businesses_passed,
        businesses_connected=businesses_connected,
        businesses_penetration_percent=float(business_penetration_rate),
        total_passed=homes_passed + businesses_passed,
        total_connected=homes_connected + businesses_connected,
        overall_penetration_percent=float(
            ((homes_connected + businesses_connected) * 100.0 / (homes_passed + businesses_passed))
            if (homes_passed + businesses_passed) > 0
            else 0.0
        ),
        notes=area_model.notes,
        created_at=area_model.created_at,
        updated_at=area_model.updated_at,
    )


def map_health_metric_model_to_graphql(
    metric_model: FiberHealthMetricModel,
) -> FiberHealthMetrics:
    """Map database FiberHealthMetric model to GraphQL type."""
    return FiberHealthMetrics(
        id=str(metric_model.id),
        cable_id=str(metric_model.cable_id),
        measured_at=metric_model.measured_at,
        health_status=_map_db_health_status_to_graphql(metric_model.health_status),
        health_score=metric_model.health_score or 0.0,
        total_loss_db=metric_model.total_loss_db or 0.0,
        splice_loss_db=metric_model.splice_loss_db or 0.0,
        connector_loss_db=metric_model.connector_loss_db or 0.0,
        detected_issues=metric_model.detected_issues or [],
        recommendations=metric_model.recommendations or [],
    )


def map_otdr_test_model_to_graphql(
    test_model: OTDRTestResultModel,
) -> OTDRTestResult:
    """Map database OTDRTestResult model to GraphQL type."""
    return OTDRTestResult(
        id=str(test_model.id),
        cable_id=str(test_model.cable_id),
        strand_id=test_model.strand_id,
        test_date=test_model.test_date,
        wavelength_nm=test_model.wavelength_nm,
        pulse_width_ns=test_model.pulse_width_ns,
        total_loss_db=test_model.total_loss_db or 0.0,
        length_km=test_model.length_km or 0.0,
        events_detected=test_model.events_detected or 0,
        events=test_model.events or [],
        pass_fail=test_model.pass_fail,
        tester_id=test_model.tester_id,
        notes=test_model.notes,
    )


# ============================================================================
# Enum Mapping Functions
# ============================================================================


def _map_graphql_status_to_db(status: FiberCableStatus) -> DBFiberCableStatus:
    """Map GraphQL FiberCableStatus to database enum."""
    mapping = {
        FiberCableStatus.ACTIVE: DBFiberCableStatus.ACTIVE,
        FiberCableStatus.INACTIVE: DBFiberCableStatus.INACTIVE,
        FiberCableStatus.UNDER_CONSTRUCTION: DBFiberCableStatus.UNDER_CONSTRUCTION,
        FiberCableStatus.MAINTENANCE: DBFiberCableStatus.MAINTENANCE,
        FiberCableStatus.DAMAGED: DBFiberCableStatus.DAMAGED,
        FiberCableStatus.DECOMMISSIONED: DBFiberCableStatus.DECOMMISSIONED,
    }
    return mapping[status]


def _map_db_status_to_graphql(status: DBFiberCableStatus) -> FiberCableStatus:
    """Map database FiberCableStatus to GraphQL enum."""
    mapping = {
        DBFiberCableStatus.ACTIVE: FiberCableStatus.ACTIVE,
        DBFiberCableStatus.INACTIVE: FiberCableStatus.INACTIVE,
        DBFiberCableStatus.UNDER_CONSTRUCTION: FiberCableStatus.UNDER_CONSTRUCTION,
        DBFiberCableStatus.MAINTENANCE: FiberCableStatus.MAINTENANCE,
        DBFiberCableStatus.DAMAGED: FiberCableStatus.DAMAGED,
        DBFiberCableStatus.DECOMMISSIONED: FiberCableStatus.DECOMMISSIONED,
    }
    return mapping[status]


def _map_graphql_fiber_type_to_db(fiber_type: FiberType) -> DBFiberType:
    """Map GraphQL FiberType to database enum."""
    mapping = {
        FiberType.SINGLE_MODE: DBFiberType.SINGLE_MODE,
        FiberType.MULTI_MODE: DBFiberType.MULTI_MODE,
        FiberType.HYBRID: DBFiberType.HYBRID,
    }
    return mapping[fiber_type]


def _map_db_fiber_type_to_graphql(fiber_type: DBFiberType) -> FiberType:
    """Map database FiberType to GraphQL enum."""
    mapping = {
        DBFiberType.SINGLE_MODE: FiberType.SINGLE_MODE,
        DBFiberType.MULTI_MODE: FiberType.MULTI_MODE,
        DBFiberType.HYBRID: FiberType.HYBRID,
    }
    return mapping[fiber_type]


def _map_graphql_installation_type_to_db(
    installation_type: CableInstallationType,
) -> DBCableInstallationType:
    """Map GraphQL CableInstallationType to database enum."""
    mapping = {
        CableInstallationType.AERIAL: DBCableInstallationType.AERIAL,
        CableInstallationType.UNDERGROUND: DBCableInstallationType.UNDERGROUND,
        CableInstallationType.BURIED: DBCableInstallationType.BURIED,
        CableInstallationType.DUCT: DBCableInstallationType.DUCT,
        CableInstallationType.BUILDING: DBCableInstallationType.BUILDING,
        CableInstallationType.SUBMARINE: DBCableInstallationType.SUBMARINE,
    }
    return mapping[installation_type]


def _map_db_installation_type_to_graphql(
    installation_type: DBCableInstallationType,
) -> CableInstallationType:
    """Map database CableInstallationType to GraphQL enum."""
    mapping = {
        DBCableInstallationType.AERIAL: CableInstallationType.AERIAL,
        DBCableInstallationType.UNDERGROUND: CableInstallationType.UNDERGROUND,
        DBCableInstallationType.BURIED: CableInstallationType.BURIED,
        DBCableInstallationType.DUCT: CableInstallationType.DUCT,
        DBCableInstallationType.BUILDING: CableInstallationType.BUILDING,
        DBCableInstallationType.SUBMARINE: CableInstallationType.SUBMARINE,
    }
    return mapping[installation_type]


def _map_graphql_splice_status_to_db(status: SpliceStatus) -> DBSpliceStatus:
    """Map GraphQL SpliceStatus to database enum."""
    mapping = {
        SpliceStatus.ACTIVE: DBSpliceStatus.ACTIVE,
        SpliceStatus.INACTIVE: DBSpliceStatus.INACTIVE,
        SpliceStatus.DEGRADED: DBSpliceStatus.DEGRADED,
        SpliceStatus.FAILED: DBSpliceStatus.FAILED,
    }
    return mapping[status]


def _map_db_splice_status_to_graphql(status: DBSpliceStatus) -> SpliceStatus:
    """Map database SpliceStatus to GraphQL enum."""
    mapping = {
        DBSpliceStatus.ACTIVE: SpliceStatus.ACTIVE,
        DBSpliceStatus.INACTIVE: SpliceStatus.INACTIVE,
        DBSpliceStatus.DEGRADED: SpliceStatus.DEGRADED,
        DBSpliceStatus.FAILED: SpliceStatus.FAILED,
    }
    return mapping[status]


def _map_graphql_point_type_to_db(
    point_type: DistributionPointType,
) -> DBDistributionPointType:
    """Map GraphQL DistributionPointType to database enum."""
    mapping = {
        DistributionPointType.CABINET: DBDistributionPointType.CABINET,
        DistributionPointType.CLOSURE: DBDistributionPointType.CLOSURE,
        DistributionPointType.POLE: DBDistributionPointType.POLE,
        DistributionPointType.MANHOLE: DBDistributionPointType.MANHOLE,
        DistributionPointType.HANDHOLE: DBDistributionPointType.HANDHOLE,
        DistributionPointType.BUILDING_ENTRY: DBDistributionPointType.BUILDING_ENTRY,
        DistributionPointType.PEDESTAL: DBDistributionPointType.PEDESTAL,
    }
    return mapping[point_type]


def _map_db_point_type_to_graphql(
    point_type: DBDistributionPointType,
) -> DistributionPointType:
    """Map database DistributionPointType to GraphQL enum."""
    mapping = {
        DBDistributionPointType.CABINET: DistributionPointType.CABINET,
        DBDistributionPointType.CLOSURE: DistributionPointType.CLOSURE,
        DBDistributionPointType.POLE: DistributionPointType.POLE,
        DBDistributionPointType.MANHOLE: DistributionPointType.MANHOLE,
        DBDistributionPointType.HANDHOLE: DistributionPointType.HANDHOLE,
        DBDistributionPointType.BUILDING_ENTRY: DistributionPointType.BUILDING_ENTRY,
        DBDistributionPointType.PEDESTAL: DistributionPointType.PEDESTAL,
    }
    return mapping[point_type]


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
    mapping = {
        FiberHealthStatus.EXCELLENT: DBFiberHealthStatus.EXCELLENT,
        FiberHealthStatus.GOOD: DBFiberHealthStatus.GOOD,
        FiberHealthStatus.FAIR: DBFiberHealthStatus.FAIR,
        FiberHealthStatus.POOR: DBFiberHealthStatus.POOR,
        FiberHealthStatus.CRITICAL: DBFiberHealthStatus.CRITICAL,
    }
    return mapping[health_status]


def _map_db_health_status_to_graphql(
    health_status: DBFiberHealthStatus,
) -> FiberHealthStatus:
    """Map database FiberHealthStatus to GraphQL enum."""
    mapping = {
        DBFiberHealthStatus.EXCELLENT: FiberHealthStatus.EXCELLENT,
        DBFiberHealthStatus.GOOD: FiberHealthStatus.GOOD,
        DBFiberHealthStatus.FAIR: FiberHealthStatus.FAIR,
        DBFiberHealthStatus.POOR: FiberHealthStatus.POOR,
        DBFiberHealthStatus.CRITICAL: FiberHealthStatus.CRITICAL,
    }
    return mapping[health_status]
