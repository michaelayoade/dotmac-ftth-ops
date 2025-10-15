"""
GenieACS Database Models

SQLAlchemy models for firmware upgrade schedules and mass configuration jobs.
"""

from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from dotmac.platform.db import Base


class FirmwareUpgradeSchedule(Base):  # type: ignore[misc]
    """Firmware upgrade schedule model."""

    __tablename__ = "firmware_upgrade_schedules"

    schedule_id = Column(String(36), primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    firmware_file = Column(String(255), nullable=False)
    file_type = Column(String(100), default="1 Firmware Upgrade Image")
    device_filter = Column(JSON, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    timezone = Column(String(50), default="UTC")
    max_concurrent = Column(Integer, default=10)
    status = Column(String(50), default="pending", index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    results = relationship(
        "FirmwareUpgradeResult",
        back_populates="schedule",
        cascade="all, delete-orphan",
    )
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    # Indexes
    __table_args__ = (
        Index("ix_firmware_schedules_tenant_status", "tenant_id", "status"),
        Index("ix_firmware_schedules_scheduled_at", "scheduled_at"),
    )

    def __repr__(self) -> str:
        return f"<FirmwareUpgradeSchedule {self.schedule_id}: {self.name}>"


class FirmwareUpgradeResult(Base):  # type: ignore[misc]
    """Firmware upgrade result per device."""

    __tablename__ = "firmware_upgrade_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(
        String(36),
        ForeignKey("firmware_upgrade_schedules.schedule_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    schedule = relationship("FirmwareUpgradeSchedule", back_populates="results")

    # Indexes
    __table_args__ = (
        Index("ix_firmware_results_schedule_status", "schedule_id", "status"),
        Index("ix_firmware_results_device", "device_id"),
    )

    def __repr__(self) -> str:
        return f"<FirmwareUpgradeResult {self.id}: {self.device_id} - {self.status}>"


class MassConfigJob(Base):  # type: ignore[misc]
    """Mass configuration job model."""

    __tablename__ = "mass_config_jobs"

    job_id = Column(String(36), primary_key=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    device_filter = Column(JSON, nullable=False)
    config_changes = Column(JSON, nullable=False)  # Store wifi, lan, wan, custom params
    total_devices = Column(Integer, default=0)
    completed_devices = Column(Integer, default=0)
    failed_devices = Column(Integer, default=0)
    pending_devices = Column(Integer, default=0)
    status = Column(String(50), default="pending", index=True)
    dry_run = Column(String(10), default="false")  # Store as string for compatibility
    max_concurrent = Column(Integer, default=10)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    results = relationship(
        "MassConfigResult",
        back_populates="job",
        cascade="all, delete-orphan",
    )
    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    # Indexes
    __table_args__ = (
        Index("ix_mass_config_jobs_tenant_status", "tenant_id", "status"),
        Index("ix_mass_config_jobs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<MassConfigJob {self.job_id}: {self.name}>"


class MassConfigResult(Base):  # type: ignore[misc]
    """Mass configuration result per device."""

    __tablename__ = "mass_config_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(
        String(36),
        ForeignKey("mass_config_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    device_id = Column(String(255), nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)
    parameters_changed = Column(JSON)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Relationships
    job = relationship("MassConfigJob", back_populates="results")

    # Indexes
    __table_args__ = (
        Index("ix_mass_config_results_job_status", "job_id", "status"),
        Index("ix_mass_config_results_device", "device_id"),
    )

    def __repr__(self) -> str:
        return f"<MassConfigResult {self.id}: {self.device_id} - {self.status}>"
