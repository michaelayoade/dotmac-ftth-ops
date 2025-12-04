"""
Resource Management Models

Models for equipment, vehicles, and resource assignment tracking.
"""

import enum
from datetime import date, datetime
from typing import cast
from uuid import UUID as UUIDType
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base
from dotmac.platform.db.types import JSONBCompat


class EquipmentStatus(str, enum.Enum):
    """Equipment status."""

    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    RETIRED = "retired"
    LOST = "lost"


class VehicleStatus(str, enum.Enum):
    """Vehicle status."""

    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    RETIRED = "retired"


class ResourceAssignmentStatus(str, enum.Enum):
    """Resource assignment status."""

    RESERVED = "reserved"
    ASSIGNED = "assigned"
    IN_USE = "in_use"
    RETURNED = "returned"
    DAMAGED = "damaged"
    LOST = "lost"


class Equipment(Base):
    """
    Equipment Model.

    Tracks tools, instruments, and equipment used by technicians.
    Examples: OTDR, fusion splicer, power meter, cable tester, ladders, etc.
    """

    __tablename__ = "equipment"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Equipment identification
    name = Column(String(255), nullable=False)
    category = Column(
        String(100), nullable=False, index=True
    )  # test_equipment, tools, safety, etc.
    equipment_type = Column(String(100), nullable=False)  # otdr, fusion_splicer, ladder, etc.
    serial_number = Column(String(100), nullable=True, index=True)
    asset_tag = Column(String(100), nullable=True, unique=True, index=True)
    barcode = Column(String(100), nullable=True, index=True)

    # Specifications
    manufacturer = Column(String(255), nullable=True)
    model = Column(String(255), nullable=True)
    specifications = Column(JSONBCompat, nullable=True)  # Technical specs

    # Status and condition
    status: Mapped[EquipmentStatus] = mapped_column(
        SQLEnum(EquipmentStatus),
        nullable=False,
        default=EquipmentStatus.AVAILABLE,
        index=True,
    )
    condition = Column(String(50), nullable=True)  # excellent, good, fair, poor
    condition_notes = Column(Text, nullable=True)

    # Location tracking
    current_location = Column(String(255), nullable=True)
    home_location = Column(String(255), nullable=True)  # Base/warehouse location
    assigned_to_technician_id = Column(
        UUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Lifecycle
    purchase_date = Column(Date, nullable=True)
    purchase_cost = Column(Numeric(10, 2), nullable=True)
    warranty_expires = Column(Date, nullable=True)
    last_maintenance_date = Column(Date, nullable=True)
    next_maintenance_due = Column(Date, nullable=True, index=True)

    # Calibration (for test equipment)
    requires_calibration = Column(Boolean, default=False)
    last_calibration_date = Column(Date, nullable=True)
    next_calibration_due = Column(Date, nullable=True, index=True)
    calibration_certificate = Column(String(500), nullable=True)  # URL or file path

    # Rental/Cost tracking
    is_rental = Column(Boolean, default=False)
    rental_cost_per_day = Column(Numeric(10, 2), nullable=True)
    rental_vendor = Column(String(255), nullable=True)

    # Availability
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_shareable = Column(Boolean, default=True)  # Can be shared between technicians

    # Notes
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    # Relationships
    assigned_technician = relationship(
        "Technician", backref="assigned_equipment", foreign_keys=[assigned_to_technician_id]
    )
    assignments = relationship(
        "ResourceAssignment", back_populates="equipment", cascade="all, delete-orphan"
    )
    maintenance_records = relationship(
        "EquipmentMaintenance", back_populates="equipment", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_equipment_tenant_status", "tenant_id", "status", "is_active"),
        Index("idx_equipment_category_type", "category", "equipment_type", "is_active"),
        Index("idx_equipment_assigned", "assigned_to_technician_id", "status"),
    )

    def __repr__(self):
        return f"<Equipment {self.name} ({self.asset_tag})>"

    def is_available(self) -> bool:
        """Check if equipment is available for assignment."""
        is_active = cast(bool, self.is_active)
        status = self.status
        assigned = cast(UUIDType | None, self.assigned_to_technician_id)
        return bool(is_active) and status == EquipmentStatus.AVAILABLE and not assigned

    def needs_maintenance(self) -> bool:
        """Check if equipment needs maintenance."""
        next_due = cast(date | None, self.next_maintenance_due)
        if not next_due:
            return False
        return date.today() >= next_due

    def needs_calibration(self) -> bool:
        """Check if equipment needs calibration."""
        requires_calibration = cast(bool, self.requires_calibration)
        next_calibration_due = cast(date | None, self.next_calibration_due)
        if not requires_calibration or not next_calibration_due:
            return False
        return date.today() >= next_calibration_due


class Vehicle(Base):
    """
    Vehicle Model.

    Tracks company vehicles used by technicians for field service.
    """

    __tablename__ = "vehicles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Vehicle identification
    name = Column(String(255), nullable=False)  # Friendly name
    vehicle_type = Column(String(100), nullable=False, index=True)  # van, truck, car, motorcycle
    make = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=True)
    color = Column(String(50), nullable=True)

    # Registration
    license_plate = Column(String(20), nullable=False, unique=True, index=True)
    vin = Column(String(17), nullable=True, unique=True)  # Vehicle Identification Number
    registration_number = Column(String(100), nullable=True)
    registration_expires = Column(Date, nullable=True, index=True)

    # Status
    status: Mapped[VehicleStatus] = mapped_column(
        SQLEnum(VehicleStatus),
        nullable=False,
        default=VehicleStatus.AVAILABLE,
        index=True,
    )
    condition = Column(String(50), nullable=True)
    odometer_reading = Column(Integer, nullable=True)  # Current mileage/km

    # Assignment
    assigned_to_technician_id = Column(
        UUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    home_location = Column(String(255), nullable=True)

    # Location tracking (GPS)
    current_lat = Column(Numeric(10, 7), nullable=True)
    current_lng = Column(Numeric(10, 7), nullable=True)
    last_location_update = Column(DateTime(timezone=True), nullable=True)

    # Maintenance
    last_service_date = Column(Date, nullable=True)
    next_service_due = Column(Date, nullable=True, index=True)
    last_service_odometer = Column(Integer, nullable=True)
    next_service_odometer = Column(Integer, nullable=True)

    # Insurance
    insurance_company = Column(String(255), nullable=True)
    insurance_policy_number = Column(String(100), nullable=True)
    insurance_expires = Column(Date, nullable=True, index=True)

    # Fuel tracking
    fuel_type = Column(String(50), nullable=True)  # petrol, diesel, electric, hybrid
    fuel_card_number = Column(String(100), nullable=True)
    average_fuel_consumption = Column(Numeric(10, 2), nullable=True)  # L/100km or mpg

    # Capacity
    seating_capacity = Column(Integer, nullable=True)
    cargo_capacity = Column(String(100), nullable=True)  # e.g., "2000 kg" or "5 cubic meters"

    # Lifecycle
    purchase_date = Column(Date, nullable=True)
    purchase_cost = Column(Numeric(10, 2), nullable=True)
    is_leased = Column(Boolean, default=False)
    lease_expires = Column(Date, nullable=True)

    # Availability
    is_active = Column(Boolean, default=True, nullable=False, index=True)

    # Notes
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    # Relationships
    assigned_technician = relationship(
        "Technician", backref="assigned_vehicle", foreign_keys=[assigned_to_technician_id]
    )
    assignments = relationship(
        "ResourceAssignment", back_populates="vehicle", cascade="all, delete-orphan"
    )
    maintenance_records = relationship(
        "VehicleMaintenance", back_populates="vehicle", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_vehicle_tenant_status", "tenant_id", "status", "is_active"),
        Index("idx_vehicle_assigned", "assigned_to_technician_id", "status"),
    )

    def __repr__(self):
        return f"<Vehicle {self.license_plate} - {self.make} {self.model}>"

    def is_available(self) -> bool:
        """Check if vehicle is available for assignment."""
        is_active = cast(bool, self.is_active)
        status = self.status
        assigned = cast(UUIDType | None, self.assigned_to_technician_id)
        return bool(is_active) and status == VehicleStatus.AVAILABLE and not assigned

    def needs_service(self) -> bool:
        """Check if vehicle needs maintenance."""
        # Check by date
        if self.next_service_due and date.today() >= self.next_service_due:
            return True

        # Check by odometer
        if (
            self.odometer_reading
            and self.next_service_odometer
            and self.odometer_reading >= self.next_service_odometer
        ):
            return True

        return False


class ResourceAssignment(Base):
    """
    Resource Assignment Model.

    Tracks assignment of equipment and vehicles to technicians and tasks.
    """

    __tablename__ = "resource_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    # Assignment target (task or technician)
    technician_id = Column(
        UUID(as_uuid=True),
        ForeignKey("technicians.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id = Column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Resource (either equipment or vehicle)
    equipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # Assignment period
    assigned_at = Column(DateTime(timezone=True), nullable=False, index=True)
    expected_return_at = Column(DateTime(timezone=True), nullable=True)
    returned_at = Column(DateTime(timezone=True), nullable=True)

    # Status
    status: Mapped[ResourceAssignmentStatus] = mapped_column(
        SQLEnum(ResourceAssignmentStatus),
        nullable=False,
        default=ResourceAssignmentStatus.ASSIGNED,
        index=True,
    )

    # Condition tracking
    condition_at_assignment = Column(String(50), nullable=True)
    condition_at_return = Column(String(50), nullable=True)
    damage_description = Column(Text, nullable=True)
    damage_cost = Column(Numeric(10, 2), nullable=True)

    # Notes
    assignment_notes = Column(Text, nullable=True)
    return_notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(String(255), nullable=True)
    updated_by = Column(String(255), nullable=True)

    # Relationships
    technician = relationship("Technician", backref="resource_assignments")
    task = relationship("Task", backref="resource_assignments")
    project = relationship("Project", backref="resource_assignments")
    equipment = relationship("Equipment", back_populates="assignments")
    vehicle = relationship("Vehicle", back_populates="assignments")

    __table_args__ = (
        Index("idx_resource_assignment_tech", "technician_id", "status", "assigned_at"),
        Index("idx_resource_assignment_equipment", "equipment_id", "status"),
        Index("idx_resource_assignment_vehicle", "vehicle_id", "status"),
        Index("idx_resource_assignment_dates", "tenant_id", "assigned_at", "returned_at"),
    )

    def __repr__(self):
        resource_type = "Equipment" if self.equipment_id else "Vehicle"
        return f"<ResourceAssignment {resource_type} → {self.technician_id}>"

    def is_active(self) -> bool:
        """Check if assignment is currently active."""
        return self.returned_at is None and self.status in [
            ResourceAssignmentStatus.ASSIGNED,
            ResourceAssignmentStatus.IN_USE,
        ]

    def is_overdue(self) -> bool:
        """Check if resource is overdue for return."""
        expected_return_at = cast(datetime | None, self.expected_return_at)
        returned_at = cast(datetime | None, self.returned_at)
        if not expected_return_at or returned_at:
            return False
        return datetime.now() > expected_return_at


class EquipmentMaintenance(Base):
    """
    Equipment Maintenance Record.

    Tracks maintenance, repairs, and calibration for equipment.
    """

    __tablename__ = "equipment_maintenance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    equipment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Maintenance details
    maintenance_type = Column(
        String(100), nullable=False, index=True
    )  # repair, calibration, inspection, cleaning
    maintenance_date = Column(Date, nullable=False, index=True)
    performed_by = Column(String(255), nullable=True)  # Technician or vendor
    cost = Column(Numeric(10, 2), nullable=True)

    # Description
    description = Column(Text, nullable=True)
    parts_replaced = Column(JSONBCompat, nullable=True)  # List of parts
    work_performed = Column(Text, nullable=True)

    # Calibration specific
    calibration_certificate_number = Column(String(100), nullable=True)
    calibration_certificate_url = Column(String(500), nullable=True)
    next_calibration_due = Column(Date, nullable=True)

    # Warranty
    warranty_claim = Column(Boolean, default=False)
    warranty_claim_number = Column(String(100), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(String(255), nullable=True)

    # Relationships
    equipment = relationship("Equipment", back_populates="maintenance_records")

    __table_args__ = (
        Index("idx_equipment_maintenance", "equipment_id", "maintenance_date"),
        Index(
            "idx_equipment_maintenance_type", "tenant_id", "maintenance_type", "maintenance_date"
        ),
    )

    def __repr__(self):
        return f"<EquipmentMaintenance {self.equipment_id} on {self.maintenance_date}>"


class VehicleMaintenance(Base):
    """
    Vehicle Maintenance Record.

    Tracks maintenance, repairs, and service for vehicles.
    """

    __tablename__ = "vehicle_maintenance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    tenant_id = Column(String(255), nullable=False, index=True)

    vehicle_id = Column(
        UUID(as_uuid=True),
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Maintenance details
    maintenance_type = Column(
        String(100), nullable=False, index=True
    )  # service, repair, inspection, tire_change
    maintenance_date = Column(Date, nullable=False, index=True)
    odometer_reading = Column(Integer, nullable=True)
    performed_by = Column(String(255), nullable=True)  # Workshop/vendor
    cost = Column(Numeric(10, 2), nullable=True)

    # Description
    description = Column(Text, nullable=True)
    parts_replaced = Column(JSONBCompat, nullable=True)
    work_performed = Column(Text, nullable=True)

    # Next service
    next_service_due_date = Column(Date, nullable=True)
    next_service_due_odometer = Column(Integer, nullable=True)

    # Warranty
    warranty_claim = Column(Boolean, default=False)
    warranty_claim_number = Column(String(100), nullable=True)

    # Notes
    notes = Column(Text, nullable=True)
    additional_metadata = Column(JSONBCompat, nullable=True)

    # Audit
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(String(255), nullable=True)

    # Relationships
    vehicle = relationship("Vehicle", back_populates="maintenance_records")

    __table_args__ = (
        Index("idx_vehicle_maintenance", "vehicle_id", "maintenance_date"),
        Index("idx_vehicle_maintenance_type", "tenant_id", "maintenance_type", "maintenance_date"),
    )

    def __repr__(self):
        return f"<VehicleMaintenance {self.vehicle_id} on {self.maintenance_date}>"
