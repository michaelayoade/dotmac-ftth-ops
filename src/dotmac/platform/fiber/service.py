"""
Fiber Infrastructure Service

Business logic for fiber optic network infrastructure management.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    CableInstallationType,
    DistributionPoint,
    DistributionPointType,
    FiberCable,
    FiberCableStatus,
    FiberHealthMetric,
    FiberHealthStatus,
    FiberType,
    OTDRTestResult,
    ServiceArea,
    ServiceAreaType,
    SplicePoint,
    SpliceStatus,
)

logger = structlog.get_logger(__name__)


class FiberService:
    """Service for fiber infrastructure management."""

    def __init__(self, db: AsyncSession, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    # ========================================================================
    # Fiber Cable Methods
    # ========================================================================

    async def create_cable(
        self,
        cable_id: str,
        fiber_type: FiberType,
        fiber_count: int,
        name: str | None = None,
        installation_type: CableInstallationType | None = None,
        start_site_id: str | None = None,
        end_site_id: str | None = None,
        length_km: float | None = None,
        route_geojson: dict[str, Any] | None = None,
        manufacturer: str | None = None,
        model: str | None = None,
        installation_date: datetime | None = None,
        warranty_expiry_date: datetime | None = None,
        attenuation_db_per_km: float | None = None,
        max_capacity: int | None = None,
        notes: str | None = None,
        created_by: str | None = None,
    ) -> FiberCable:
        """Create a new fiber cable"""
        existing_stmt = select(FiberCable).where(
            FiberCable.tenant_id == self.tenant_id,
            FiberCable.cable_id == cable_id,
            FiberCable.deleted_at.is_(None),
        )
        existing_result = await self.db.execute(existing_stmt)
        existing = existing_result.scalar_one_or_none()
        if existing:
            raise ValueError(f"Fiber cable '{cable_id}' already exists")

        cable = FiberCable(
            tenant_id=self.tenant_id,
            cable_id=cable_id,
            name=name,
            fiber_type=fiber_type,
            fiber_count=fiber_count,
            status=FiberCableStatus.ACTIVE,
            installation_type=installation_type,
            start_site_id=start_site_id,
            end_site_id=end_site_id,
            length_km=length_km,
            route_geojson=route_geojson,
            manufacturer=manufacturer,
            model=model,
            installation_date=installation_date,
            warranty_expiry_date=warranty_expiry_date,
            attenuation_db_per_km=attenuation_db_per_km,
            max_capacity=max_capacity,
            notes=notes,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(cable)
        await self.db.commit()
        await self.db.refresh(cable)

        logger.info(
            "fiber.cable.created",
            cable_id=cable_id,
            cable_name=name,
            fiber_type=fiber_type.value,
            fiber_count=fiber_count,
            tenant_id=self.tenant_id,
        )

        return cable

    async def get_cable(
        self, cable_id: UUID | str, include_relations: bool = False
    ) -> FiberCable | None:
        """Get fiber cable by ID or cable_id"""
        filters = [
            FiberCable.tenant_id == self.tenant_id,
            FiberCable.deleted_at.is_(None),
        ]

        if isinstance(cable_id, UUID):
            filters.append(FiberCable.id == cable_id)
        else:
            filters.append(FiberCable.cable_id == cable_id)

        stmt: Select[tuple[FiberCable]] = select(FiberCable).where(*filters)

        if include_relations:
            stmt = stmt.options(
                selectinload(FiberCable.splice_points),
                selectinload(FiberCable.health_metrics),
                selectinload(FiberCable.otdr_test_results),
            )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_cables(
        self,
        fiber_type: FiberType | None = None,
        status: FiberCableStatus | None = None,
        installation_type: CableInstallationType | None = None,
        start_site_id: str | None = None,
        end_site_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[FiberCable]:
        """List fiber cables with filters"""
        filters = [
            FiberCable.tenant_id == self.tenant_id,
            FiberCable.deleted_at.is_(None),
        ]

        if fiber_type:
            filters.append(FiberCable.fiber_type == fiber_type)

        if status:
            filters.append(FiberCable.status == status)

        if installation_type:
            filters.append(FiberCable.installation_type == installation_type)

        if start_site_id:
            filters.append(FiberCable.start_site_id == start_site_id)

        if end_site_id:
            filters.append(FiberCable.end_site_id == end_site_id)

        stmt = select(FiberCable).where(*filters).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_cable(
        self,
        cable_id: UUID | str,
        updated_by: str | None = None,
        **kwargs: Any,
    ) -> FiberCable | None:
        """Update fiber cable"""
        cable = await self.get_cable(cable_id)
        if not cable:
            return None

        for key, value in kwargs.items():
            if hasattr(cable, key) and value is not None:
                setattr(cable, key, value)

        cable.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(cable)

        logger.info(
            "fiber.cable.updated",
            cable_id=str(cable.id),
            updates=list(kwargs.keys()),
            tenant_id=self.tenant_id,
        )

        return cable

    async def delete_cable(self, cable_id: UUID | str, deleted_by: str | None = None) -> bool:
        """Soft delete fiber cable"""
        cable = await self.get_cable(cable_id)
        if not cable:
            return False

        cable.deleted_at = datetime.now(UTC)
        cable.is_active = False
        cable.updated_by = deleted_by
        await self.db.commit()

        logger.info(
            "fiber.cable.deleted",
            cable_id=str(cable.id),
            tenant_id=self.tenant_id,
        )

        return True

    async def activate_cable(
        self, cable_id: UUID | str, activated_by: str | None = None
    ) -> FiberCable | None:
        """Activate a fiber cable (mark as active and operational)"""
        cable = await self.get_cable(cable_id)
        if not cable:
            return None

        cable.status = FiberCableStatus.ACTIVE
        cable.updated_by = activated_by
        await self.db.commit()
        await self.db.refresh(cable)

        logger.info(
            "fiber.cable.activated",
            cable_id=str(cable.id),
            tenant_id=self.tenant_id,
        )

        return cable

    # ========================================================================
    # Distribution Point Methods
    # ========================================================================

    async def create_distribution_point(
        self,
        point_id: str,
        point_type: DistributionPointType,
        name: str | None = None,
        site_id: str | None = None,
        location_geojson: dict[str, Any] | None = None,
        address: str | None = None,
        total_ports: int | None = None,
        used_ports: int = 0,
        manufacturer: str | None = None,
        model: str | None = None,
        installation_date: datetime | None = None,
        notes: str | None = None,
        created_by: str | None = None,
    ) -> DistributionPoint:
        """Create a new distribution point"""
        point = DistributionPoint(
            tenant_id=self.tenant_id,
            point_id=point_id,
            point_type=point_type,
            name=name,
            status=FiberCableStatus.UNDER_CONSTRUCTION,
            site_id=site_id,
            location_geojson=location_geojson,
            address=address,
            total_ports=total_ports,
            used_ports=used_ports,
            manufacturer=manufacturer,
            model=model,
            installation_date=installation_date,
            notes=notes,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(point)
        await self.db.commit()
        await self.db.refresh(point)

        logger.info(
            "fiber.distribution_point.created",
            point_id=point_id,
            point_type=point_type.value,
            tenant_id=self.tenant_id,
        )

        return point

    async def get_distribution_point(
        self, point_id: UUID | str, include_splice_points: bool = False
    ) -> DistributionPoint | None:
        """Get distribution point by ID or point_id"""
        filters = [
            DistributionPoint.tenant_id == self.tenant_id,
            DistributionPoint.deleted_at.is_(None),
        ]

        if isinstance(point_id, UUID):
            filters.append(DistributionPoint.id == point_id)
        else:
            filters.append(DistributionPoint.point_id == point_id)

        stmt: Select[tuple[DistributionPoint]] = select(DistributionPoint).where(*filters)

        if include_splice_points:
            stmt = stmt.options(selectinload(DistributionPoint.splice_points))

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_distribution_points(
        self,
        point_type: DistributionPointType | None = None,
        status: FiberCableStatus | None = None,
        site_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[DistributionPoint]:
        """List distribution points with filters"""
        filters = [
            DistributionPoint.tenant_id == self.tenant_id,
            DistributionPoint.deleted_at.is_(None),
        ]

        if point_type:
            filters.append(DistributionPoint.point_type == point_type)

        if status:
            filters.append(DistributionPoint.status == status)

        if site_id:
            filters.append(DistributionPoint.site_id == site_id)

        stmt = select(DistributionPoint).where(*filters).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_distribution_point(
        self,
        point_id: UUID | str,
        updated_by: str | None = None,
        **kwargs: Any,
    ) -> DistributionPoint | None:
        """Update distribution point"""
        point = await self.get_distribution_point(point_id)
        if not point:
            return None

        for key, value in kwargs.items():
            if hasattr(point, key) and value is not None:
                setattr(point, key, value)

        point.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(point)

        logger.info(
            "fiber.distribution_point.updated",
            point_id=str(point.id),
            updates=list(kwargs.keys()),
            tenant_id=self.tenant_id,
        )

        return point

    async def get_port_utilization(self, point_id: UUID | str) -> dict[str, Any]:
        """Get port utilization statistics for a distribution point"""
        point = await self.get_distribution_point(point_id)
        if not point or point.total_ports is None:
            return {}

        utilization_pct = (
            (point.used_ports / point.total_ports * 100) if point.total_ports > 0 else 0
        )
        available_ports = point.total_ports - point.used_ports

        return {
            "point_id": point.point_id,
            "total_ports": point.total_ports,
            "used_ports": point.used_ports,
            "available_ports": available_ports,
            "utilization_percentage": round(utilization_pct, 2),
            "is_full": available_ports == 0,
            "is_near_capacity": utilization_pct >= 80,
        }

    # ========================================================================
    # Service Area Methods
    # ========================================================================

    async def create_service_area(
        self,
        area_id: str,
        name: str,
        area_type: ServiceAreaType,
        is_serviceable: bool = False,
        coverage_geojson: dict[str, Any] | None = None,
        postal_codes: list[str] | None = None,
        construction_status: str | None = None,
        go_live_date: datetime | None = None,
        homes_passed: int = 0,
        homes_connected: int = 0,
        businesses_passed: int = 0,
        businesses_connected: int = 0,
        notes: str | None = None,
        created_by: str | None = None,
    ) -> ServiceArea:
        """Create a new service area"""
        area = ServiceArea(
            tenant_id=self.tenant_id,
            area_id=area_id,
            name=name,
            area_type=area_type,
            is_serviceable=is_serviceable,
            coverage_geojson=coverage_geojson,
            postal_codes=postal_codes,
            construction_status=construction_status,
            go_live_date=go_live_date,
            homes_passed=homes_passed,
            homes_connected=homes_connected,
            businesses_passed=businesses_passed,
            businesses_connected=businesses_connected,
            notes=notes,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(area)
        await self.db.commit()
        await self.db.refresh(area)

        logger.info(
            "fiber.service_area.created",
            area_id=area_id,
            area_name=name,
            area_type=area_type.value,
            tenant_id=self.tenant_id,
        )

        return area

    async def get_service_area(self, area_id: UUID | str) -> ServiceArea | None:
        """Get service area by ID or area_id"""
        filters = [
            ServiceArea.tenant_id == self.tenant_id,
            ServiceArea.deleted_at.is_(None),
        ]

        if isinstance(area_id, UUID):
            filters.append(ServiceArea.id == area_id)
        else:
            filters.append(ServiceArea.area_id == area_id)

        stmt = select(ServiceArea).where(*filters)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_service_areas(
        self,
        area_type: ServiceAreaType | None = None,
        is_serviceable: bool | None = None,
        construction_status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ServiceArea]:
        """List service areas with filters"""
        filters = [
            ServiceArea.tenant_id == self.tenant_id,
            ServiceArea.deleted_at.is_(None),
        ]

        if area_type:
            filters.append(ServiceArea.area_type == area_type)

        if is_serviceable is not None:
            filters.append(ServiceArea.is_serviceable == is_serviceable)

        if construction_status:
            filters.append(ServiceArea.construction_status == construction_status)

        stmt = select(ServiceArea).where(*filters).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_service_area(
        self,
        area_id: UUID | str,
        updated_by: str | None = None,
        **kwargs: Any,
    ) -> ServiceArea | None:
        """Update service area"""
        area = await self.get_service_area(area_id)
        if not area:
            return None

        for key, value in kwargs.items():
            if hasattr(area, key) and value is not None:
                setattr(area, key, value)

        area.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(area)

        logger.info(
            "fiber.service_area.updated",
            area_id=str(area.id),
            updates=list(kwargs.keys()),
            tenant_id=self.tenant_id,
        )

        return area

    async def get_coverage_statistics(self, area_id: UUID | str) -> dict[str, Any]:
        """Get coverage statistics for a service area"""
        area = await self.get_service_area(area_id)
        if not area:
            return {}

        residential_penetration = (
            (area.homes_connected / area.homes_passed * 100) if area.homes_passed > 0 else 0
        )
        business_penetration = (
            (area.businesses_connected / area.businesses_passed * 100)
            if area.businesses_passed > 0
            else 0
        )
        total_passed = area.homes_passed + area.businesses_passed
        total_connected = area.homes_connected + area.businesses_connected
        overall_penetration = (total_connected / total_passed * 100) if total_passed > 0 else 0

        return {
            "area_id": area.area_id,
            "area_name": area.name,
            "area_type": area.area_type.value,
            "is_serviceable": area.is_serviceable,
            "residential": {
                "passed": area.homes_passed,
                "connected": area.homes_connected,
                "penetration_percentage": round(residential_penetration, 2),
            },
            "commercial": {
                "passed": area.businesses_passed,
                "connected": area.businesses_connected,
                "penetration_percentage": round(business_penetration, 2),
            },
            "total": {
                "passed": total_passed,
                "connected": total_connected,
                "penetration_percentage": round(overall_penetration, 2),
            },
        }

    # ========================================================================
    # Splice Point Methods
    # ========================================================================

    async def create_splice_point(
        self,
        splice_id: str,
        cable_id: UUID,
        distribution_point_id: UUID | None = None,
        splice_type: str | None = None,
        location_geojson: dict[str, Any] | None = None,
        enclosure_type: str | None = None,
        insertion_loss_db: float | None = None,
        return_loss_db: float | None = None,
        last_test_date: datetime | None = None,
        notes: str | None = None,
        created_by: str | None = None,
    ) -> SplicePoint:
        """Create a new splice point"""
        splice = SplicePoint(
            tenant_id=self.tenant_id,
            splice_id=splice_id,
            cable_id=cable_id,
            distribution_point_id=distribution_point_id,
            status=SpliceStatus.PENDING_TEST,
            splice_type=splice_type,
            location_geojson=location_geojson,
            enclosure_type=enclosure_type,
            insertion_loss_db=insertion_loss_db,
            return_loss_db=return_loss_db,
            last_test_date=last_test_date,
            notes=notes,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(splice)
        await self.db.commit()
        await self.db.refresh(splice)

        logger.info(
            "fiber.splice_point.created",
            splice_id=splice_id,
            cable_id=str(cable_id),
            tenant_id=self.tenant_id,
        )

        return splice

    async def get_splice_point(self, splice_id: UUID | str) -> SplicePoint | None:
        """Get splice point by ID or splice_id"""
        filters = [
            SplicePoint.tenant_id == self.tenant_id,
            SplicePoint.deleted_at.is_(None),
        ]

        if isinstance(splice_id, UUID):
            filters.append(SplicePoint.id == splice_id)
        else:
            filters.append(SplicePoint.splice_id == splice_id)

        stmt = select(SplicePoint).where(*filters)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_splice_points(
        self,
        cable_id: UUID | None = None,
        status: SpliceStatus | None = None,
        distribution_point_id: UUID | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[SplicePoint]:
        """List splice points with filters"""
        filters = [
            SplicePoint.tenant_id == self.tenant_id,
            SplicePoint.deleted_at.is_(None),
        ]

        if cable_id:
            filters.append(SplicePoint.cable_id == cable_id)

        if status:
            filters.append(SplicePoint.status == status)

        if distribution_point_id:
            filters.append(SplicePoint.distribution_point_id == distribution_point_id)

        stmt = select(SplicePoint).where(*filters).offset(offset).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_splice_point(
        self,
        splice_id: UUID | str,
        updated_by: str | None = None,
        **kwargs: Any,
    ) -> SplicePoint | None:
        """Update splice point"""
        splice = await self.get_splice_point(splice_id)
        if not splice:
            return None

        for key, value in kwargs.items():
            if hasattr(splice, key) and value is not None:
                setattr(splice, key, value)

        splice.updated_by = updated_by
        await self.db.commit()
        await self.db.refresh(splice)

        logger.info(
            "fiber.splice_point.updated",
            splice_id=str(splice.id),
            updates=list(kwargs.keys()),
            tenant_id=self.tenant_id,
        )

        return splice

    # ========================================================================
    # Health Metrics Methods
    # ========================================================================

    async def record_health_metric(
        self,
        cable_id: UUID,
        health_status: FiberHealthStatus,
        measured_at: datetime | None = None,
        health_score: float | None = None,
        total_loss_db: float | None = None,
        splice_loss_db: float | None = None,
        connector_loss_db: float | None = None,
        detected_issues: list[dict[str, Any]] | None = None,
        recommendations: list[str] | None = None,
        created_by: str | None = None,
    ) -> FiberHealthMetric:
        """Record health metrics for a fiber cable"""
        metric = FiberHealthMetric(
            tenant_id=self.tenant_id,
            cable_id=cable_id,
            measured_at=measured_at or datetime.now(UTC),
            health_status=health_status,
            health_score=health_score,
            total_loss_db=total_loss_db,
            splice_loss_db=splice_loss_db,
            connector_loss_db=connector_loss_db,
            detected_issues=detected_issues,
            recommendations=recommendations,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(metric)
        await self.db.commit()
        await self.db.refresh(metric)

        logger.info(
            "fiber.health_metric.recorded",
            cable_id=str(cable_id),
            health_status=health_status.value,
            health_score=health_score,
            tenant_id=self.tenant_id,
        )

        return metric

    async def get_latest_health_metric(self, cable_id: UUID) -> FiberHealthMetric | None:
        """Get the most recent health metric for a cable"""
        stmt = (
            select(FiberHealthMetric)
            .where(
                FiberHealthMetric.cable_id == cable_id,
                FiberHealthMetric.tenant_id == self.tenant_id,
            )
            .order_by(FiberHealthMetric.measured_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_health_metrics(
        self,
        cable_id: UUID | None = None,
        health_status: FiberHealthStatus | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[FiberHealthMetric]:
        """List health metrics with filters"""
        filters = [
            FiberHealthMetric.tenant_id == self.tenant_id,
        ]

        if cable_id:
            filters.append(FiberHealthMetric.cable_id == cable_id)

        if health_status:
            filters.append(FiberHealthMetric.health_status == health_status)

        if start_date:
            filters.append(FiberHealthMetric.measured_at >= start_date)

        if end_date:
            filters.append(FiberHealthMetric.measured_at <= end_date)

        stmt = (
            select(FiberHealthMetric)
            .where(*filters)
            .order_by(FiberHealthMetric.measured_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ========================================================================
    # OTDR Test Result Methods
    # ========================================================================

    async def record_otdr_test(
        self,
        cable_id: UUID,
        strand_id: int,
        test_date: datetime | None = None,
        wavelength_nm: int | None = None,
        pulse_width_ns: int | None = None,
        total_loss_db: float | None = None,
        length_km: float | None = None,
        events_detected: int = 0,
        events: list[dict[str, Any]] | None = None,
        pass_fail: bool | None = None,
        tester_id: str | None = None,
        notes: str | None = None,
        created_by: str | None = None,
    ) -> OTDRTestResult:
        """Record OTDR test results for a fiber cable strand"""
        test_result = OTDRTestResult(
            tenant_id=self.tenant_id,
            cable_id=cable_id,
            strand_id=strand_id,
            test_date=test_date or datetime.now(UTC),
            wavelength_nm=wavelength_nm,
            pulse_width_ns=pulse_width_ns,
            total_loss_db=total_loss_db,
            length_km=length_km,
            events_detected=events_detected,
            events=events,
            pass_fail=pass_fail,
            tester_id=tester_id,
            notes=notes,
            created_by=created_by,
            updated_by=created_by,
        )
        self.db.add(test_result)
        await self.db.commit()
        await self.db.refresh(test_result)

        logger.info(
            "fiber.otdr_test.recorded",
            cable_id=str(cable_id),
            strand_id=strand_id,
            pass_fail=pass_fail,
            tenant_id=self.tenant_id,
        )

        return test_result

    async def get_latest_otdr_test(self, cable_id: UUID, strand_id: int) -> OTDRTestResult | None:
        """Get the most recent OTDR test for a cable strand"""
        stmt = (
            select(OTDRTestResult)
            .where(
                OTDRTestResult.cable_id == cable_id,
                OTDRTestResult.strand_id == strand_id,
                OTDRTestResult.tenant_id == self.tenant_id,
            )
            .order_by(OTDRTestResult.test_date.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_otdr_tests(
        self,
        cable_id: UUID | None = None,
        strand_id: int | None = None,
        pass_fail: bool | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[OTDRTestResult]:
        """List OTDR test results with filters"""
        filters = [
            OTDRTestResult.tenant_id == self.tenant_id,
        ]

        if cable_id:
            filters.append(OTDRTestResult.cable_id == cable_id)

        if strand_id is not None:
            filters.append(OTDRTestResult.strand_id == strand_id)

        if pass_fail is not None:
            filters.append(OTDRTestResult.pass_fail == pass_fail)

        if start_date:
            filters.append(OTDRTestResult.test_date >= start_date)

        if end_date:
            filters.append(OTDRTestResult.test_date <= end_date)

        stmt = (
            select(OTDRTestResult)
            .where(*filters)
            .order_by(OTDRTestResult.test_date.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ========================================================================
    # Analytics & Reporting Methods
    # ========================================================================

    async def get_network_health_summary(self) -> dict[str, Any]:
        """Get overall network health summary"""
        total_cables_stmt = select(func.count(FiberCable.id)).where(
            FiberCable.tenant_id == self.tenant_id,
            FiberCable.deleted_at.is_(None),
        )
        total_cables = (await self.db.execute(total_cables_stmt)).scalar_one()

        cables_by_status_stmt = (
            select(FiberCable.status, func.count(FiberCable.id))
            .where(
                FiberCable.tenant_id == self.tenant_id,
                FiberCable.deleted_at.is_(None),
            )
            .group_by(FiberCable.status)
        )
        cables_by_status_result = await self.db.execute(cables_by_status_stmt)
        cables_by_status = cables_by_status_result.all()

        health_by_status_stmt = (
            select(FiberHealthMetric.health_status, func.count(FiberHealthMetric.id))
            .where(FiberHealthMetric.tenant_id == self.tenant_id)
            .group_by(FiberHealthMetric.health_status)
        )
        health_by_status_result = await self.db.execute(health_by_status_stmt)
        health_by_status = health_by_status_result.all()

        return {
            "total_cables": total_cables,
            "cables_by_status": {status.name: count for status, count in cables_by_status},
            "health_by_status": {status.name: count for status, count in health_by_status},
        }

    async def get_capacity_planning_data(self) -> dict[str, Any]:
        """Get capacity planning data for distribution points"""
        points = await self.list_distribution_points(limit=1000)

        total_ports = sum(p.total_ports or 0 for p in points)
        used_ports = sum(p.used_ports for p in points)
        available_ports = total_ports - used_ports
        utilization_pct = (used_ports / total_ports * 100) if total_ports > 0 else 0

        near_capacity = [
            p for p in points if p.total_ports and (p.used_ports / p.total_ports) >= 0.8
        ]

        return {
            "total_distribution_points": len(points),
            "total_ports": total_ports,
            "used_ports": used_ports,
            "available_ports": available_ports,
            "utilization_percentage": round(utilization_pct, 2),
            "points_near_capacity": len(near_capacity),
            "near_capacity_points": [
                {
                    "point_id": p.point_id,
                    "point_type": p.point_type.value,
                    "utilization": (
                        round((p.used_ports / p.total_ports * 100), 2) if p.total_ports else 0
                    ),
                }
                for p in near_capacity
            ],
        }

    async def get_coverage_summary(self) -> dict[str, Any]:
        """Get overall coverage summary across all service areas"""
        areas = await self.list_service_areas(limit=1000)

        total_homes_passed = sum(a.homes_passed for a in areas)
        total_homes_connected = sum(a.homes_connected for a in areas)
        total_businesses_passed = sum(a.businesses_passed for a in areas)
        total_businesses_connected = sum(a.businesses_connected for a in areas)

        serviceable_areas = sum(1 for a in areas if a.is_serviceable)

        return {
            "total_service_areas": len(areas),
            "serviceable_areas": serviceable_areas,
            "residential": {
                "homes_passed": total_homes_passed,
                "homes_connected": total_homes_connected,
                "penetration_percentage": round(
                    (
                        (total_homes_connected / total_homes_passed * 100)
                        if total_homes_passed > 0
                        else 0
                    ),
                    2,
                ),
            },
            "commercial": {
                "businesses_passed": total_businesses_passed,
                "businesses_connected": total_businesses_connected,
                "penetration_percentage": round(
                    (
                        (total_businesses_connected / total_businesses_passed * 100)
                        if total_businesses_passed > 0
                        else 0
                    ),
                    2,
                ),
            },
        }
