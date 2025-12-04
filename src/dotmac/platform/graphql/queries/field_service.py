"""
GraphQL Queries for Field Service Management

Queries for technicians, scheduling, time tracking, and resource management.
"""
# mypy: disable-error-code="arg-type"

from datetime import date, datetime
from typing import Any

import strawberry
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.field_service.models import (
    Technician,
    TechnicianSkillLevel,
    TechnicianStatus,
)
from dotmac.platform.graphql.context import get_context
from dotmac.platform.graphql.types.field_service import (
    AssignmentConnection,
    AssignmentStatusEnum,
    EquipmentConnection,
    EquipmentStatusEnum,
    EquipmentType,
    LaborRateType,
    ScheduleStatusEnum,
    SkillLevelEnum,
    TaskAssignmentType,
    TechnicianCertificationType,
    TechnicianConnection,
    TechnicianScheduleType,
    TechnicianSkillType,
    TechnicianStatusEnum,
    TechnicianType,
    TimeEntryConnection,
    TimeEntryStatusEnum,
    TimeEntryType,
    TimeEntryTypeEnum,
    VehicleConnection,
    VehicleStatusEnum,
    VehicleType,
)
from dotmac.platform.project_management.resource_models import (
    Equipment,
    Vehicle,
)
from dotmac.platform.project_management.scheduling_models import (
    TaskAssignment,
    TechnicianSchedule,
)
from dotmac.platform.project_management.time_tracking_models import (
    LaborRate,
    TimeEntry,
)


@strawberry.type
class FieldServiceQueries:
    """Queries for field service management."""

    # ========================================================================
    # Technician Queries
    # ========================================================================

    @strawberry.field(description="Get a single technician by ID")  # type: ignore[misc]
    async def technician(
        self,
        id: strawberry.ID,
        info: strawberry.Info,
    ) -> TechnicianType | None:
        """Get technician by ID."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        result = await session.execute(
            select(Technician)
            .where(and_(Technician.id == id, Technician.tenant_id == tenant_id))
            .options(
                selectinload(Technician.skills),
                selectinload(Technician.certifications),
            )
        )
        technician = result.scalar_one_or_none()

        if not technician:
            return None

        return self._map_technician(technician)

    @strawberry.field(description="List technicians with filtering")  # type: ignore[misc]
    async def technicians(
        self,
        info: strawberry.Info,
        status: list[TechnicianStatusEnum] | None = None,
        skill_level: list[SkillLevelEnum] | None = None,
        is_available: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TechnicianConnection:
        """List technicians with filtering and pagination."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(Technician).where(Technician.tenant_id == tenant_id)

        # Apply filters
        if status:
            query = query.where(Technician.status.in_([s.value for s in status]))

        if skill_level:
            query = query.where(Technician.skill_level.in_([sl.value for sl in skill_level]))

        if is_available is not None:
            # Filter by AVAILABLE status when is_available=True
            if is_available:
                query = query.where(Technician.status == "available")
            else:
                query = query.where(Technician.status != "available")

        if search:
            query = query.where(
                or_(
                    Technician.first_name.ilike(f"%{search}%"),
                    Technician.last_name.ilike(f"%{search}%"),
                    Technician.email.ilike(f"%{search}%"),
                    Technician.employee_id.ilike(f"%{search}%"),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        # Load relationships
        query = query.options(
            selectinload(Technician.skills),
            selectinload(Technician.certifications),
        )

        result = await session.execute(query)
        technicians = result.scalars().all()

        return TechnicianConnection(
            items=[self._map_technician(t) for t in technicians],
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > (page * page_size),
        )

    # ========================================================================
    # Scheduling Queries
    # ========================================================================

    @strawberry.field(description="Get technician schedules")  # type: ignore[misc]
    async def schedules(
        self,
        info: strawberry.Info,
        technician_id: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        status: list[ScheduleStatusEnum] | None = None,
    ) -> list[TechnicianScheduleType]:
        """Get technician schedules with filtering."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(TechnicianSchedule).where(TechnicianSchedule.tenant_id == tenant_id)

        if technician_id:
            query = query.where(TechnicianSchedule.technician_id == technician_id)

        if date_from:
            query = query.where(TechnicianSchedule.schedule_date >= date_from)

        if date_to:
            query = query.where(TechnicianSchedule.schedule_date <= date_to)

        if status:
            query = query.where(TechnicianSchedule.status.in_([s.value for s in status]))

        result = await session.execute(query)
        schedules = result.scalars().all()

        return [self._map_schedule(s) for s in schedules]

    @strawberry.field(description="Get task assignments")  # type: ignore[misc]
    async def assignments(
        self,
        info: strawberry.Info,
        technician_id: str | None = None,
        task_id: str | None = None,
        status: list[AssignmentStatusEnum] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> AssignmentConnection:
        """Get task assignments with filtering."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(TaskAssignment).where(TaskAssignment.tenant_id == tenant_id)

        if technician_id:
            query = query.where(TaskAssignment.technician_id == technician_id)

        if task_id:
            query = query.where(TaskAssignment.task_id == task_id)

        if status:
            query = query.where(TaskAssignment.status.in_([s.value for s in status]))

        if date_from:
            query = query.where(TaskAssignment.scheduled_start >= date_from)

        if date_to:
            query = query.where(TaskAssignment.scheduled_end <= date_to)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = (
            query.offset(offset).limit(page_size).order_by(TaskAssignment.scheduled_start.desc())
        )

        result = await session.execute(query)
        assignments = result.scalars().all()

        return AssignmentConnection(
            items=[self._map_assignment(a) for a in assignments],
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > (page * page_size),
        )

    # ========================================================================
    # Time Tracking Queries
    # ========================================================================

    @strawberry.field(description="Get time entries")  # type: ignore[misc]
    async def time_entries(
        self,
        info: strawberry.Info,
        technician_id: str | None = None,
        status: list[TimeEntryStatusEnum] | None = None,
        entry_type: list[TimeEntryTypeEnum] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TimeEntryConnection:
        """Get time entries with filtering."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(TimeEntry).where(TimeEntry.tenant_id == tenant_id)

        if technician_id:
            query = query.where(TimeEntry.technician_id == technician_id)

        if status:
            query = query.where(TimeEntry.status.in_([s.value for s in status]))

        if entry_type:
            query = query.where(TimeEntry.entry_type.in_([et.value for et in entry_type]))

        if date_from:
            query = query.where(TimeEntry.clock_in >= date_from)

        if date_to:
            query = query.where(TimeEntry.clock_in <= date_to)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size).order_by(TimeEntry.clock_in.desc())

        result = await session.execute(query)
        entries = result.scalars().all()

        return TimeEntryConnection(
            items=[self._map_time_entry(e) for e in entries],
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > (page * page_size),
        )

    @strawberry.field(description="Get labor rates")  # type: ignore[misc]
    async def labor_rates(
        self,
        info: strawberry.Info,
        is_active: bool | None = True,
    ) -> list[LaborRateType]:
        """Get labor rates."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(LaborRate).where(LaborRate.tenant_id == tenant_id)

        if is_active is not None:
            query = query.where(LaborRate.is_active == is_active)

        result = await session.execute(query)
        rates = result.scalars().all()

        return [self._map_labor_rate(r) for r in rates]

    # ========================================================================
    # Resource Queries
    # ========================================================================

    @strawberry.field(description="Get equipment list")  # type: ignore[misc]
    async def equipment(
        self,
        info: strawberry.Info,
        status: list[EquipmentStatusEnum] | None = None,
        category: str | None = None,
        is_available: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> EquipmentConnection:
        """Get equipment with filtering."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(Equipment).where(Equipment.tenant_id == tenant_id)

        if status:
            query = query.where(Equipment.status.in_([s.value for s in status]))

        if category:
            query = query.where(Equipment.category == category)

        if is_available is not None:
            if is_available:
                query = query.where(
                    and_(
                        Equipment.status == "available",
                        Equipment.is_active,
                        Equipment.assigned_to_technician_id.is_(None),
                    )
                )

        if search:
            query = query.where(
                or_(
                    Equipment.name.ilike(f"%{search}%"),
                    Equipment.asset_tag.ilike(f"%{search}%"),
                    Equipment.serial_number.ilike(f"%{search}%"),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await session.execute(query)
        equipment = result.scalars().all()

        return EquipmentConnection(
            items=[self._map_equipment(e) for e in equipment],
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > (page * page_size),
        )

    @strawberry.field(description="Get vehicles list")  # type: ignore[misc]
    async def vehicles(
        self,
        info: strawberry.Info,
        status: list[VehicleStatusEnum] | None = None,
        vehicle_type: str | None = None,
        is_available: bool | None = None,
        search: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> VehicleConnection:
        """Get vehicles with filtering."""
        context = await get_context(info)
        session: AsyncSession = context["db_session"]
        tenant_id = context["tenant_id"]

        query = select(Vehicle).where(Vehicle.tenant_id == tenant_id)

        if status:
            query = query.where(Vehicle.status.in_([s.value for s in status]))

        if vehicle_type:
            query = query.where(Vehicle.vehicle_type == vehicle_type)

        if is_available is not None:
            if is_available:
                query = query.where(
                    and_(
                        Vehicle.status == "available",
                        Vehicle.is_active,
                        Vehicle.assigned_to_technician_id.is_(None),
                    )
                )

        if search:
            query = query.where(
                or_(
                    Vehicle.name.ilike(f"%{search}%"),
                    Vehicle.license_plate.ilike(f"%{search}%"),
                    Vehicle.vin.ilike(f"%{search}%"),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar_one()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.offset(offset).limit(page_size)

        result = await session.execute(query)
        vehicles = result.scalars().all()

        return VehicleConnection(
            items=[self._map_vehicle(v) for v in vehicles],
            total=total,
            page=page,
            page_size=page_size,
            has_more=total > (page * page_size),
        )

    # ========================================================================
    # Helper Methods
    # ========================================================================

    def _parse_datetime(self, value: Any) -> datetime | None:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value)
            except ValueError:
                return None
        return None

    def _parse_date(self, value: Any) -> date | None:
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return date.fromisoformat(value.split("T")[0])
            except ValueError:
                return None
        return None

    def _resolve_skill_level(
        self,
        value: Any,
        default_level: TechnicianSkillLevel,
    ) -> SkillLevelEnum:
        if isinstance(value, TechnicianSkillLevel):
            candidate = value.value
        elif isinstance(value, SkillLevelEnum):
            candidate = value.value
        elif isinstance(value, str):
            candidate = value
        else:
            candidate = default_level.value

        try:
            return SkillLevelEnum(candidate)
        except ValueError:
            return SkillLevelEnum(default_level.value)

    def _map_technician_skills(self, tech: Technician) -> list[TechnicianSkillType]:
        raw = tech.skills or {}
        skills: list[TechnicianSkillType] = []

        if isinstance(raw, dict):
            iterable = raw.items()
        elif isinstance(raw, list):
            iterable = []
            for entry in raw:
                if isinstance(entry, dict):
                    name = entry.get("skill") or entry.get("name")
                    if name:
                        iterable.append((name, entry))
        else:
            iterable = []

        default_level = (
            tech.skill_level
            if isinstance(tech.skill_level, TechnicianSkillLevel)
            else TechnicianSkillLevel.INTERMEDIATE
        )

        for name, entry in iterable:
            if not name:
                continue

            if isinstance(entry, dict):
                level_value = entry.get("level")
                certified = bool(entry.get("certified", True))
                years_experience = entry.get("years_experience")
                last_assessed = self._parse_datetime(entry.get("last_assessed"))
            else:
                level_value = None
                certified = bool(entry)
                years_experience = None
                last_assessed = None

            skills.append(
                TechnicianSkillType(
                    skill=name,
                    level=self._resolve_skill_level(level_value, default_level),
                    years_experience=years_experience,
                    certified=certified,
                    last_assessed=last_assessed,
                )
            )

        return skills

    def _map_technician_certifications(self, tech: Technician) -> list[TechnicianCertificationType]:
        raw = tech.certifications or []
        certifications: list[TechnicianCertificationType] = []

        for entry in raw:
            if not isinstance(entry, dict):
                continue

            name = entry.get("name")
            if not name:
                continue

            certifications.append(
                TechnicianCertificationType(
                    name=name,
                    issuing_organization=entry.get("issuing_organization"),
                    issue_date=self._parse_date(entry.get("issue_date")),
                    expiry_date=self._parse_date(entry.get("expiry_date")),
                    certificate_number=entry.get("certificate_number"),
                    certificate_url=entry.get("certificate_url"),
                    is_active=entry.get("is_active"),
                )
            )

        return certifications

    def _map_technician(self, tech: Technician) -> TechnicianType:
        """Map Technician model to GraphQL type."""
        skills = self._map_technician_skills(tech)
        certifications = self._map_technician_certifications(tech)

        phone_value = tech.phone or getattr(tech, "mobile", None)
        service_areas = list(tech.service_areas or [])

        return TechnicianType(
            id=strawberry.ID(str(tech.id)),
            tenant_id=tech.tenant_id,
            user_id=str(tech.user_id) if tech.user_id is not None else None,
            employee_id=tech.employee_id,
            first_name=tech.first_name,
            last_name=tech.last_name,
            full_name=f"{tech.first_name} {tech.last_name}",
            email=tech.email,
            phone=phone_value,
            avatar=getattr(tech, "avatar", None),
            status=TechnicianStatusEnum(
                tech.status.value if isinstance(tech.status, TechnicianStatus) else str(tech.status)
            ),
            hire_date=tech.hire_date,
            termination_date=getattr(tech, "termination_date", None),
            skill_level=SkillLevelEnum(
                tech.skill_level.value
                if isinstance(tech.skill_level, TechnicianSkillLevel)
                else str(tech.skill_level)
            ),
            hourly_rate=getattr(tech, "hourly_rate", None),
            skills=skills,
            certifications=certifications,
            specializations=list(getattr(tech, "specializations", []) or []),
            home_location_lat=float(tech.home_base_lat) if tech.home_base_lat is not None else None,
            home_location_lng=float(tech.home_base_lng) if tech.home_base_lng is not None else None,
            home_address=getattr(tech, "home_base_address", None),
            current_location_lat=float(tech.current_lat) if tech.current_lat is not None else None,
            current_location_lng=float(tech.current_lng) if tech.current_lng is not None else None,
            last_location_update=tech.last_location_update,
            service_areas=service_areas,
            is_available=tech.is_available_now(),
            max_concurrent_tasks=getattr(tech, "max_concurrent_tasks", 0) or 0,
            completed_tasks=getattr(tech, "jobs_completed", 0) or 0,
            average_rating=float(tech.average_rating) if tech.average_rating is not None else None,
            completion_rate=float(tech.completion_rate)
            if tech.completion_rate is not None
            else None,
            average_response_time_minutes=getattr(tech, "average_response_time_minutes", None),
            created_at=tech.created_at,
            updated_at=tech.updated_at,
        )

    def _map_schedule(self, schedule: TechnicianSchedule) -> TechnicianScheduleType:  # type: ignore
        """Map TechnicianSchedule model to GraphQL type."""
        return TechnicianScheduleType(  # type: ignore
            id=strawberry.ID(str(schedule.id)),
            tenant_id=schedule.tenant_id,
            technician_id=str(schedule.technician_id),
            schedule_date=schedule.schedule_date,
            shift_start=schedule.shift_start,
            shift_end=schedule.shift_end,
            break_start=schedule.break_start,
            break_end=schedule.break_end,
            status=ScheduleStatusEnum(schedule.status),
            start_location_lat=float(schedule.start_location_lat)
            if schedule.start_location_lat
            else None,
            start_location_lng=float(schedule.start_location_lng)
            if schedule.start_location_lng
            else None,
            start_location_name=schedule.start_location_name,
            max_tasks=schedule.max_tasks,
            assigned_tasks_count=schedule.assigned_tasks_count,
            notes=schedule.notes,
            created_at=schedule.created_at,
        )

    def _map_assignment(self, assignment: TaskAssignment) -> TaskAssignmentType:  # type: ignore
        """Map TaskAssignment model to GraphQL type."""
        return TaskAssignmentType(  # type: ignore
            id=strawberry.ID(str(assignment.id)),
            tenant_id=assignment.tenant_id,
            task_id=str(assignment.task_id),
            technician_id=str(assignment.technician_id),
            schedule_id=str(assignment.schedule_id) if assignment.schedule_id else None,
            scheduled_start=assignment.scheduled_start,
            scheduled_end=assignment.scheduled_end,
            actual_start=assignment.actual_start,
            actual_end=assignment.actual_end,
            travel_time_minutes=assignment.travel_time_minutes,
            travel_distance_km=float(assignment.travel_distance_km)
            if assignment.travel_distance_km
            else None,
            status=AssignmentStatusEnum(assignment.status),
            customer_confirmation_required=assignment.customer_confirmation_required,
            customer_confirmed_at=assignment.customer_confirmed_at,
            assignment_method=assignment.assignment_method,
            assignment_score=float(assignment.assignment_score)
            if assignment.assignment_score
            else None,
            task_location_lat=float(assignment.task_location_lat)
            if assignment.task_location_lat
            else None,
            task_location_lng=float(assignment.task_location_lng)
            if assignment.task_location_lng
            else None,
            task_location_address=assignment.task_location_address,
            original_scheduled_start=assignment.original_scheduled_start,
            reschedule_count=assignment.reschedule_count,
            reschedule_reason=assignment.reschedule_reason,
            notes=assignment.notes,
            created_at=assignment.created_at,
        )

    def _map_time_entry(self, entry: TimeEntry) -> TimeEntryType:  # type: ignore
        """Map TimeEntry model to GraphQL type."""
        return TimeEntryType(  # type: ignore
            id=strawberry.ID(str(entry.id)),
            tenant_id=entry.tenant_id,
            technician_id=str(entry.technician_id),
            task_id=str(entry.task_id) if entry.task_id else None,
            project_id=str(entry.project_id) if entry.project_id else None,
            assignment_id=str(entry.assignment_id) if entry.assignment_id else None,
            clock_in=entry.clock_in,
            clock_out=entry.clock_out,
            break_duration_minutes=entry.break_duration_minutes or 0,
            entry_type=TimeEntryTypeEnum(entry.entry_type),
            status=TimeEntryStatusEnum(entry.status),
            clock_in_lat=entry.clock_in_lat,
            clock_in_lng=entry.clock_in_lng,
            clock_out_lat=entry.clock_out_lat,
            clock_out_lng=entry.clock_out_lng,
            labor_rate_id=str(entry.labor_rate_id) if entry.labor_rate_id else None,
            hourly_rate=entry.hourly_rate,
            total_hours=entry.total_hours,
            total_cost=entry.total_cost,
            submitted_at=entry.submitted_at,
            approved_at=entry.approved_at,
            approved_by=entry.approved_by,
            rejected_at=entry.rejected_at,
            rejected_by=entry.rejected_by,
            rejection_reason=entry.rejection_reason,
            description=entry.description,
            notes=entry.notes,
            created_at=entry.created_at,
        )

    def _map_labor_rate(self, rate: LaborRate) -> LaborRateType:  # type: ignore
        """Map LaborRate model to GraphQL type."""
        return LaborRateType(  # type: ignore
            id=strawberry.ID(str(rate.id)),
            tenant_id=rate.tenant_id,
            name=rate.name,
            description=rate.description,
            skill_level=SkillLevelEnum(rate.skill_level) if rate.skill_level else None,
            role=rate.role,
            regular_rate=rate.regular_rate,
            overtime_rate=rate.overtime_rate,
            weekend_rate=rate.weekend_rate,
            holiday_rate=rate.holiday_rate,
            night_rate=rate.night_rate,
            effective_from=rate.effective_from,
            effective_to=rate.effective_to,
            is_active=rate.is_active,
            currency=rate.currency,
            created_at=rate.created_at,
        )

    def _map_equipment(self, equipment: Equipment) -> EquipmentType:  # type: ignore
        """Map Equipment model to GraphQL type."""
        return EquipmentType(  # type: ignore
            id=strawberry.ID(str(equipment.id)),
            tenant_id=equipment.tenant_id,
            name=equipment.name,
            category=equipment.category,
            equipment_type=equipment.equipment_type,
            serial_number=equipment.serial_number,
            asset_tag=equipment.asset_tag,
            barcode=equipment.barcode,
            manufacturer=equipment.manufacturer,
            model=equipment.model,
            status=EquipmentStatusEnum(equipment.status),
            condition=equipment.condition,
            current_location=equipment.current_location,
            home_location=equipment.home_location,
            assigned_to_technician_id=str(equipment.assigned_to_technician_id)
            if equipment.assigned_to_technician_id
            else None,
            purchase_date=equipment.purchase_date,
            purchase_cost=equipment.purchase_cost,
            next_maintenance_due=equipment.next_maintenance_due,
            requires_calibration=equipment.requires_calibration,
            next_calibration_due=equipment.next_calibration_due,
            is_rental=equipment.is_rental,
            rental_cost_per_day=equipment.rental_cost_per_day,
            is_active=equipment.is_active,
            created_at=equipment.created_at,
        )

    def _map_vehicle(self, vehicle: Vehicle) -> VehicleType:  # type: ignore
        """Map Vehicle model to GraphQL type."""
        return VehicleType(  # type: ignore
            id=strawberry.ID(str(vehicle.id)),
            tenant_id=vehicle.tenant_id,
            name=vehicle.name,
            vehicle_type=vehicle.vehicle_type,
            make=vehicle.make,
            model=vehicle.model,
            year=vehicle.year,
            license_plate=vehicle.license_plate,
            status=VehicleStatusEnum(vehicle.status),
            odometer_reading=vehicle.odometer_reading,
            assigned_to_technician_id=str(vehicle.assigned_to_technician_id)
            if vehicle.assigned_to_technician_id
            else None,
            current_lat=vehicle.current_lat,
            current_lng=vehicle.current_lng,
            last_location_update=vehicle.last_location_update,
            next_service_due=vehicle.next_service_due,
            next_service_odometer=vehicle.next_service_odometer,
            is_active=vehicle.is_active,
            created_at=vehicle.created_at,
        )
