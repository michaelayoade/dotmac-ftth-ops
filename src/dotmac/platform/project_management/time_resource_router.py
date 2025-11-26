"""
Time Tracking & Resource Management API Router

Combined REST API for time tracking (clock in/out) and resource management
# mypy: disable-error-code="arg-type,assignment"
(equipment/vehicle assignment).
"""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import (
    require_field_service_resource_manage,
    require_field_service_resource_read,
    require_field_service_time_manage,
    require_field_service_time_read,
)
from dotmac.platform.db import get_async_session
from dotmac.platform.field_service.models import Technician
from dotmac.platform.project_management.resource_models import (
    Equipment,
    EquipmentStatus,
    ResourceAssignment,
    ResourceAssignmentStatus,
    Vehicle,
    VehicleStatus,
)
from dotmac.platform.project_management.time_tracking_models import (
    LaborRate,
    TimeEntry,
    TimeEntryType,
)
from dotmac.platform.tenant import get_current_tenant_id

router = APIRouter(prefix="/api/v1", tags=["time-tracking", "resources"])


# ============================================================================
# Pydantic Schemas
# ============================================================================


# Time Entry Schemas
class ClockInRequest(BaseModel):
    technician_id: UUID
    task_id: UUID | None = None
    project_id: UUID | None = None
    entry_type: str = "regular"
    latitude: float | None = None
    longitude: float | None = None
    description: str | None = None


class ClockOutRequest(BaseModel):
    latitude: float | None = None
    longitude: float | None = None
    break_duration_minutes: float | None = 0
    notes: str | None = None


class TimeEntryResponse(BaseModel):
    id: UUID
    tenant_id: str
    technician_id: UUID
    task_id: UUID | None
    project_id: UUID | None
    clock_in: datetime
    clock_out: datetime | None
    entry_type: str
    status: str
    total_hours: Decimal | None
    total_cost: Decimal | None
    hourly_rate: Decimal | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Equipment Schemas
class EquipmentCreate(BaseModel):
    name: str
    category: str
    equipment_type: str
    serial_number: str | None = None
    asset_tag: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    home_location: str | None = None
    purchase_date: date | None = None
    purchase_cost: Decimal | None = None
    requires_calibration: bool = False
    description: str | None = None


class EquipmentResponse(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    category: str
    equipment_type: str
    serial_number: str | None
    asset_tag: str | None
    status: str
    condition: str | None
    assigned_to_technician_id: UUID | None
    is_available: bool
    needs_maintenance: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Vehicle Schemas
class VehicleCreate(BaseModel):
    name: str
    vehicle_type: str
    make: str
    model: str
    license_plate: str
    year: int | None = None
    vin: str | None = None
    home_location: str | None = None
    fuel_type: str | None = None
    description: str | None = None


class VehicleResponse(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    vehicle_type: str
    make: str
    model: str
    license_plate: str
    status: str
    assigned_to_technician_id: UUID | None
    odometer_reading: int | None
    is_available: bool
    needs_service: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Resource Assignment Schemas
class ResourceAssignRequest(BaseModel):
    technician_id: UUID
    equipment_id: UUID | None = None
    vehicle_id: UUID | None = None
    task_id: UUID | None = None
    project_id: UUID | None = None
    expected_return_at: datetime | None = None
    assignment_notes: str | None = None


class ResourceAssignmentResponse(BaseModel):
    id: UUID
    tenant_id: str
    technician_id: UUID
    equipment_id: UUID | None
    vehicle_id: UUID | None
    task_id: UUID | None
    assigned_at: datetime
    expected_return_at: datetime | None
    returned_at: datetime | None
    status: str
    is_active: bool

    class Config:
        from_attributes = True


def _enum_value(value: object) -> str:
    """Return the string value for enums or plain strings."""
    return value.value if hasattr(value, "value") else str(value)


def _decimal_from_float(value: float | Decimal | None) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _time_entry_response(entry: TimeEntry) -> TimeEntryResponse:
    """Build a consistent response for time entry records."""
    return TimeEntryResponse(
        id=entry.id,
        tenant_id=entry.tenant_id,
        technician_id=entry.technician_id,
        task_id=entry.task_id,
        project_id=entry.project_id,
        clock_in=entry.clock_in,
        clock_out=entry.clock_out,
        entry_type=_enum_value(entry.entry_type),
        status=_enum_value(entry.status),
        total_hours=entry.calculate_hours(),
        total_cost=entry.calculate_cost(),
        hourly_rate=entry.hourly_rate,
        is_active=entry.is_active(),
        created_at=entry.created_at,
    )


def _equipment_response(equipment: Equipment) -> EquipmentResponse:
    return EquipmentResponse(
        id=equipment.id,
        tenant_id=equipment.tenant_id,
        name=equipment.name,
        category=equipment.category,
        equipment_type=equipment.equipment_type,
        serial_number=equipment.serial_number,
        asset_tag=equipment.asset_tag,
        status=_enum_value(equipment.status),
        condition=equipment.condition,
        assigned_to_technician_id=equipment.assigned_to_technician_id,
        is_available=equipment.is_available(),
        needs_maintenance=equipment.needs_maintenance(),
        created_at=equipment.created_at,
    )


def _vehicle_response(vehicle: Vehicle) -> VehicleResponse:
    return VehicleResponse(
        id=vehicle.id,
        tenant_id=vehicle.tenant_id,
        name=vehicle.name,
        vehicle_type=vehicle.vehicle_type,
        make=vehicle.make,
        model=vehicle.model,
        license_plate=vehicle.license_plate,
        status=_enum_value(vehicle.status),
        assigned_to_technician_id=vehicle.assigned_to_technician_id,
        odometer_reading=vehicle.odometer_reading,
        is_available=vehicle.is_available(),
        needs_service=vehicle.needs_service(),
        created_at=vehicle.created_at,
    )


def _assignment_response(assignment: ResourceAssignment) -> ResourceAssignmentResponse:
    return ResourceAssignmentResponse(
        id=assignment.id,
        tenant_id=assignment.tenant_id,
        technician_id=assignment.technician_id,
        equipment_id=assignment.equipment_id,
        vehicle_id=assignment.vehicle_id,
        task_id=assignment.task_id,
        assigned_at=assignment.assigned_at,
        expected_return_at=assignment.expected_return_at,
        returned_at=assignment.returned_at,
        status=_enum_value(assignment.status),
        is_active=assignment.is_active(),
    )


# ============================================================================
# Time Tracking Endpoints
# ============================================================================


@router.post(
    "/time/clock-in",
    response_model=TimeEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def clock_in(
    clock_in_request: ClockInRequest,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_time_manage),
) -> TimeEntryResponse:
    """
    Clock in - Start tracking time for a technician.

    Creates a new time entry with clock-in timestamp and optional GPS location.
    """
    # Verify technician exists
    result = await session.execute(
        select(Technician).where(
            and_(
                Technician.id == clock_in_request.technician_id,
                Technician.tenant_id == tenant_id,
                Technician.is_active,
            )
        )
    )
    technician = result.scalar_one_or_none()
    if not technician:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Check if technician already has an active time entry
    active_entry = await session.execute(
        select(TimeEntry).where(
            and_(
                TimeEntry.technician_id == clock_in_request.technician_id,
                TimeEntry.tenant_id == tenant_id,
                TimeEntry.clock_out.is_(None),
            )
        )
    )
    if active_entry.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Technician already has an active time entry. Please clock out first.",
        )

    # Get labor rate for technician
    labor_rate = await session.execute(
        select(LaborRate)
        .where(
            and_(
                LaborRate.tenant_id == tenant_id,
                LaborRate.skill_level == technician.skill_level,
                LaborRate.is_active,
                LaborRate.effective_from <= datetime.now(),
            )
        )
        .order_by(LaborRate.effective_from.desc())
    )
    rate = labor_rate.scalar_one_or_none()

    # Create time entry
    from uuid import uuid4

    time_entry = TimeEntry(
        id=uuid4(),
        tenant_id=tenant_id,
        technician_id=clock_in_request.technician_id,
        task_id=clock_in_request.task_id,
        project_id=clock_in_request.project_id,
        clock_in=datetime.now(),
        entry_type=TimeEntryType(clock_in_request.entry_type),
        clock_in_lat=clock_in_request.latitude,
        clock_in_lng=clock_in_request.longitude,
        description=clock_in_request.description,
        labor_rate_id=rate.id if rate else None,
        hourly_rate=rate.regular_rate if rate else None,
        created_by=current_user.user_id,
    )

    session.add(time_entry)
    await session.commit()
    await session.refresh(time_entry)

    return _time_entry_response(time_entry)


@router.post(
    "/time/entries/{entry_id}/clock-out",
    response_model=TimeEntryResponse,
)
async def clock_out(
    entry_id: UUID,
    clock_out_request: ClockOutRequest,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_time_manage),
) -> TimeEntryResponse:
    """
    Clock out - End time tracking for a time entry.

    Updates the time entry with clock-out timestamp and calculates hours/cost.
    """
    result = await session.execute(
        select(TimeEntry).where(and_(TimeEntry.id == entry_id, TimeEntry.tenant_id == tenant_id))
    )
    time_entry = result.scalar_one_or_none()
    if not time_entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Time entry not found")

    if time_entry.clock_out:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Time entry already clocked out"
        )

    # Update clock out
    time_entry.clock_out = datetime.now()
    time_entry.clock_out_lat = _decimal_from_float(clock_out_request.latitude)
    time_entry.clock_out_lng = _decimal_from_float(clock_out_request.longitude)
    time_entry.break_duration_minutes = _decimal_from_float(
        clock_out_request.break_duration_minutes
    )
    if clock_out_request.notes:
        time_entry.notes = clock_out_request.notes
    time_entry.updated_by = current_user.user_id

    # Calculate hours and cost
    time_entry.total_hours = time_entry.calculate_hours()
    time_entry.total_cost = time_entry.calculate_cost()

    await session.commit()
    await session.refresh(time_entry)

    return _time_entry_response(time_entry)


@router.get(
    "/time/entries",
    response_model=list[TimeEntryResponse],
)
async def list_time_entries(
    technician_id: UUID | None = Query(None),
    task_id: UUID | None = Query(None),
    status_filter: str | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    _current_user: UserInfo = Depends(require_field_service_time_read),
) -> list[TimeEntryResponse]:
    """
    List time entries with optional filtering.
    """
    query = select(TimeEntry).where(TimeEntry.tenant_id == tenant_id)

    if technician_id:
        query = query.where(TimeEntry.technician_id == technician_id)
    if task_id:
        query = query.where(TimeEntry.task_id == task_id)
    if status_filter:
        query = query.where(TimeEntry.status == status_filter)
    if start_date:
        query = query.where(TimeEntry.clock_in >= start_date)
    if end_date:
        query = query.where(TimeEntry.clock_in <= end_date)
    if active_only:
        query = query.where(TimeEntry.clock_out.is_(None))

    query = query.order_by(TimeEntry.clock_in.desc()).limit(limit).offset(offset)

    result = await session.execute(query)
    entries = result.scalars().all()
    return [_time_entry_response(entry) for entry in entries]


# ============================================================================
# Equipment Management Endpoints
# ============================================================================


@router.post(
    "/resources/equipment",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_equipment(
    equipment: EquipmentCreate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_resource_manage),
) -> EquipmentResponse:
    """Create new equipment record."""
    from uuid import uuid4

    db_equipment = Equipment(
        id=uuid4(),
        tenant_id=tenant_id,
        **equipment.model_dump(),
        created_by=current_user.user_id,
    )

    session.add(db_equipment)
    await session.commit()
    await session.refresh(db_equipment)

    return _equipment_response(db_equipment)


@router.get(
    "/resources/equipment",
    response_model=list[EquipmentResponse],
)
async def list_equipment(
    category: str | None = Query(None),
    status_filter: str | None = Query(None),
    available_only: bool = Query(False),
    assigned_to: UUID | None = Query(None),
    limit: int = Query(default=100, le=1000),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    _current_user: UserInfo = Depends(require_field_service_resource_read),
) -> list[EquipmentResponse]:
    """List equipment with optional filtering."""
    query = select(Equipment).where(Equipment.tenant_id == tenant_id)

    if category:
        query = query.where(Equipment.category == category)
    if status_filter:
        query = query.where(Equipment.status == status_filter)
    if available_only:
        query = query.where(
            and_(
                Equipment.status == EquipmentStatus.AVAILABLE,
                Equipment.assigned_to_technician_id.is_(None),
            )
        )
    if assigned_to:
        query = query.where(Equipment.assigned_to_technician_id == assigned_to)

    query = query.limit(limit)
    result = await session.execute(query)
    equipment_list = result.scalars().all()
    return [_equipment_response(eq) for eq in equipment_list]


# ============================================================================
# Vehicle Management Endpoints
# ============================================================================


@router.post(
    "/resources/vehicles",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vehicle(
    vehicle: VehicleCreate,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_resource_manage),
) -> VehicleResponse:
    """Create new vehicle record."""
    from uuid import uuid4

    db_vehicle = Vehicle(
        id=uuid4(),
        tenant_id=tenant_id,
        **vehicle.model_dump(),
        created_by=current_user.user_id,
    )

    session.add(db_vehicle)
    await session.commit()
    await session.refresh(db_vehicle)

    return _vehicle_response(db_vehicle)


@router.get(
    "/resources/vehicles",
    response_model=list[VehicleResponse],
)
async def list_vehicles(
    vehicle_type: str | None = Query(None),
    status_filter: str | None = Query(None),
    available_only: bool = Query(False),
    assigned_to: UUID | None = Query(None),
    limit: int = Query(default=100, le=1000),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    _current_user: UserInfo = Depends(require_field_service_resource_read),
) -> list[VehicleResponse]:
    """List vehicles with optional filtering."""
    query = select(Vehicle).where(Vehicle.tenant_id == tenant_id)

    if vehicle_type:
        query = query.where(Vehicle.vehicle_type == vehicle_type)
    if status_filter:
        query = query.where(Vehicle.status == status_filter)
    if available_only:
        query = query.where(
            and_(
                Vehicle.status == VehicleStatus.AVAILABLE,
                Vehicle.assigned_to_technician_id.is_(None),
            )
        )
    if assigned_to:
        query = query.where(Vehicle.assigned_to_technician_id == assigned_to)

    query = query.limit(limit)
    result = await session.execute(query)
    vehicles = result.scalars().all()

    return [_vehicle_response(v) for v in vehicles]


# ============================================================================
# Resource Assignment Endpoints
# ============================================================================


@router.post(
    "/resources/assignments",
    response_model=ResourceAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_resource(
    assignment: ResourceAssignRequest,
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_resource_manage),
) -> ResourceAssignmentResponse:
    """
    Assign equipment or vehicle to a technician.

    Automatically updates the resource status to IN_USE.
    """
    if not assignment.equipment_id and not assignment.vehicle_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must specify either equipment_id or vehicle_id",
        )

    # Verify technician exists
    tech_result = await session.execute(
        select(Technician).where(
            and_(
                Technician.id == assignment.technician_id,
                Technician.tenant_id == tenant_id,
                Technician.is_active,
            )
        )
    )
    if not tech_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found")

    # Check if resource is available
    if assignment.equipment_id:
        eq_result = await session.execute(
            select(Equipment).where(
                and_(Equipment.id == assignment.equipment_id, Equipment.tenant_id == tenant_id)
            )
        )
        equipment = eq_result.scalar_one_or_none()
        if not equipment or not equipment.is_available():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Equipment not available"
            )
        equipment.status = EquipmentStatus.IN_USE
        equipment.assigned_to_technician_id = assignment.technician_id

    if assignment.vehicle_id:
        v_result = await session.execute(
            select(Vehicle).where(
                and_(Vehicle.id == assignment.vehicle_id, Vehicle.tenant_id == tenant_id)
            )
        )
        vehicle = v_result.scalar_one_or_none()
        if not vehicle or not vehicle.is_available():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Vehicle not available"
            )
        vehicle.status = VehicleStatus.IN_USE
        vehicle.assigned_to_technician_id = assignment.technician_id

    # Create assignment
    from uuid import uuid4

    db_assignment = ResourceAssignment(
        id=uuid4(),
        tenant_id=tenant_id,
        **assignment.model_dump(),
        assigned_at=datetime.now(),
        status=ResourceAssignmentStatus.ASSIGNED,
        created_by=current_user.user_id,
    )

    session.add(db_assignment)
    await session.commit()
    await session.refresh(db_assignment)

    return _assignment_response(db_assignment)


@router.post(
    "/resources/assignments/{assignment_id}/return",
    response_model=ResourceAssignmentResponse,
)
async def return_resource(
    assignment_id: UUID,
    condition: str | None = Query(None),
    damage_description: str | None = Query(None),
    notes: str | None = Query(None),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: UserInfo = Depends(require_field_service_resource_manage),
) -> ResourceAssignmentResponse:
    """
    Return assigned resource.

    Updates the assignment and resource status back to AVAILABLE.
    """
    result = await session.execute(
        select(ResourceAssignment)
        .where(
            and_(ResourceAssignment.id == assignment_id, ResourceAssignment.tenant_id == tenant_id)
        )
        .options(
            selectinload(ResourceAssignment.equipment), selectinload(ResourceAssignment.vehicle)
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    if assignment.returned_at:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Resource already returned"
        )

    # Update assignment
    assignment.returned_at = datetime.now()
    assignment.status = ResourceAssignmentStatus.RETURNED
    assignment.condition_at_return = condition
    assignment.damage_description = damage_description
    assignment.return_notes = notes
    assignment.updated_by = current_user.user_id

    # Update resource status
    if assignment.equipment:
        assignment.equipment.status = EquipmentStatus.AVAILABLE
        assignment.equipment.assigned_to_technician_id = None
    if assignment.vehicle:
        assignment.vehicle.status = VehicleStatus.AVAILABLE
        assignment.vehicle.assigned_to_technician_id = None

    await session.commit()
    await session.refresh(assignment)

    return _assignment_response(assignment)


@router.get(
    "/resources/assignments",
    response_model=list[ResourceAssignmentResponse],
)
async def list_resource_assignments(
    technician_id: UUID | None = Query(None),
    equipment_id: UUID | None = Query(None),
    vehicle_id: UUID | None = Query(None),
    active_only: bool = Query(False),
    limit: int = Query(default=100, le=1000),
    session: AsyncSession = Depends(get_async_session),
    tenant_id: str = Depends(get_current_tenant_id),
    _current_user: UserInfo = Depends(require_field_service_resource_read),
) -> list[ResourceAssignmentResponse]:
    """List resource assignments with optional filtering."""
    query = select(ResourceAssignment).where(ResourceAssignment.tenant_id == tenant_id)

    if technician_id:
        query = query.where(ResourceAssignment.technician_id == technician_id)
    if equipment_id:
        query = query.where(ResourceAssignment.equipment_id == equipment_id)
    if vehicle_id:
        query = query.where(ResourceAssignment.vehicle_id == vehicle_id)
    if active_only:
        query = query.where(ResourceAssignment.returned_at.is_(None))

    query = query.order_by(ResourceAssignment.assigned_at.desc()).limit(limit)
    result = await session.execute(query)
    assignments = result.scalars().all()
    return [_assignment_response(a) for a in assignments]
