"""
GenieACS Service Layer with Database Integration

Production-ready service with database persistence, Celery tasks,
# mypy: disable-error-code="arg-type,assignment"
and Prometheus metrics.
"""

from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.genieacs.metrics import (
    record_firmware_upgrade_created,
    record_mass_config_created,
    set_firmware_upgrade_active_schedules,
    set_firmware_upgrade_schedule_status,
    set_mass_config_active_jobs,
    set_mass_config_job_status,
)
from dotmac.platform.genieacs.models import (
    FirmwareUpgradeResult,
    FirmwareUpgradeSchedule,
    MassConfigJob,
    MassConfigResult,
)
from dotmac.platform.genieacs.schemas import FirmwareUpgradeResult as FirmwareUpgradeResultSchema
from dotmac.platform.genieacs.schemas import (
    FirmwareUpgradeSchedule as FirmwareUpgradeScheduleSchema,
)
from dotmac.platform.genieacs.schemas import (
    FirmwareUpgradeScheduleCreate,
    FirmwareUpgradeScheduleList,
    FirmwareUpgradeScheduleResponse,
    MassConfigJobList,
    MassConfigRequest,
    MassConfigResponse,
)
from dotmac.platform.genieacs.schemas import MassConfigJob as MassConfigJobSchema
from dotmac.platform.genieacs.schemas import MassConfigResult as MassConfigResultSchema
from dotmac.platform.genieacs.service import GenieACSService

logger = structlog.get_logger(__name__)


class GenieACSServiceDB(GenieACSService):
    """Production-ready GenieACS service with database persistence."""

    def __init__(
        self,
        session: AsyncSession,
        client: GenieACSClient | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize GenieACS service with database session.

        Args:
            session: AsyncSession for database operations
            client: GenieACS client instance
            tenant_id: Tenant ID for multi-tenancy
        """
        super().__init__(client=client, tenant_id=tenant_id)

        self.session = session

    def _require_tenant_id(self) -> str:
        """Return the tenant identifier or raise if unavailable."""
        if self.tenant_id is None:
            raise ValueError("Tenant ID is required for GenieACS operations")
        return self.tenant_id

    @property
    def _db(self) -> AsyncSession:
        """Return the active database session."""
        if self.session is None:
            raise RuntimeError("Database session is not configured for GenieACSServiceDB")
        return self.session

    # =========================================================================
    # Scheduled Firmware Upgrades
    # =========================================================================

    async def create_firmware_upgrade_schedule(
        self, request: FirmwareUpgradeScheduleCreate
    ) -> FirmwareUpgradeScheduleResponse:
        """
        Create firmware upgrade schedule with database persistence.

        Args:
            request: Schedule creation request

        Returns:
            FirmwareUpgradeScheduleResponse with schedule details
        """
        # Generate schedule ID
        schedule_id = str(uuid4())

        # Query devices to get count
        devices = await self.client.get_devices(query=request.device_filter)
        total_devices = len(devices)

        # Create schedule model
        schedule = FirmwareUpgradeSchedule(
            schedule_id=schedule_id,
            tenant_id=self._require_tenant_id(),
            name=request.name,
            description=request.description,
            firmware_file=request.firmware_file,
            file_type=request.file_type,
            device_filter=request.device_filter,
            scheduled_at=request.scheduled_at,
            timezone=request.timezone,
            max_concurrent=request.max_concurrent,
            status="pending",
            created_at=datetime.now(UTC),
        )

        self._db.add(schedule)
        await self._db.commit()

        # Record metrics
        tenant_id = self._require_tenant_id()
        record_firmware_upgrade_created(tenant_id)
        set_firmware_upgrade_schedule_status(tenant_id, schedule_id, "pending", 1.0)

        logger.info(
            "firmware_schedule.created_db",
            schedule_id=schedule_id,
            tenant_id=tenant_id,
            total_devices=total_devices,
        )

        return FirmwareUpgradeScheduleResponse(
            schedule=FirmwareUpgradeScheduleSchema(
                schedule_id=schedule.schedule_id,
                name=schedule.name,
                description=schedule.description,
                firmware_file=schedule.firmware_file,
                file_type=schedule.file_type,
                device_filter=schedule.device_filter,
                scheduled_at=schedule.scheduled_at,
                timezone=schedule.timezone,
                max_concurrent=schedule.max_concurrent,
                status=schedule.status,
                created_at=schedule.created_at,
                started_at=schedule.started_at,
                completed_at=schedule.completed_at,
            ),
            total_devices=total_devices,
            completed_devices=0,
            failed_devices=0,
            pending_devices=total_devices,
            results=[],
        )

    async def list_firmware_upgrade_schedules(
        self,
    ) -> FirmwareUpgradeScheduleList:
        """List all firmware upgrade schedules for tenant."""
        tenant_id = self._require_tenant_id()

        result = await self._db.execute(
            select(FirmwareUpgradeSchedule)
            .where(FirmwareUpgradeSchedule.tenant_id == tenant_id)
            .order_by(FirmwareUpgradeSchedule.created_at.desc())
        )

        schedules = result.scalars().all()

        # Update active schedules metric
        active_count = sum(1 for s in schedules if s.status in ("pending", "running"))
        set_firmware_upgrade_active_schedules(tenant_id, active_count)

        return FirmwareUpgradeScheduleList(
            schedules=[
                FirmwareUpgradeScheduleSchema(
                    schedule_id=s.schedule_id,
                    name=s.name,
                    description=s.description,
                    firmware_file=s.firmware_file,
                    file_type=s.file_type,
                    device_filter=s.device_filter,
                    scheduled_at=s.scheduled_at,
                    timezone=s.timezone,
                    max_concurrent=s.max_concurrent,
                    status=s.status,
                    created_at=s.created_at,
                    started_at=s.started_at,
                    completed_at=s.completed_at,
                )
                for s in schedules
            ],
            total=len(schedules),
        )

    async def get_firmware_upgrade_schedule(
        self, schedule_id: str
    ) -> FirmwareUpgradeScheduleResponse:
        """Get firmware upgrade schedule with results."""
        tenant_id = self._require_tenant_id()

        result = await self._db.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.schedule_id == schedule_id,
                FirmwareUpgradeSchedule.tenant_id == tenant_id,
            )
        )

        schedule = result.scalar_one_or_none()
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        # Get results
        results_result = await self._db.execute(
            select(FirmwareUpgradeResult).where(FirmwareUpgradeResult.schedule_id == schedule_id)
        )

        results = results_result.scalars().all()

        # Count statuses
        completed = sum(1 for r in results if r.status == "success")
        failed = sum(1 for r in results if r.status == "failed")
        pending = sum(1 for r in results if r.status in ("pending", "in_progress"))

        # Query current device count
        filter_payload = cast(dict[str, Any], schedule.device_filter or {})
        devices = await self.client.get_devices(query=filter_payload)
        total_devices = len(devices)

        return FirmwareUpgradeScheduleResponse(
            schedule=FirmwareUpgradeScheduleSchema(
                schedule_id=schedule.schedule_id,
                name=schedule.name,
                description=schedule.description,
                firmware_file=schedule.firmware_file,
                file_type=schedule.file_type,
                device_filter=schedule.device_filter,
                scheduled_at=schedule.scheduled_at,
                timezone=schedule.timezone,
                max_concurrent=schedule.max_concurrent,
                status=schedule.status,
                created_at=schedule.created_at,
                started_at=schedule.started_at,
                completed_at=schedule.completed_at,
            ),
            total_devices=total_devices,
            completed_devices=completed,
            failed_devices=failed,
            pending_devices=pending,
            results=[
                FirmwareUpgradeResultSchema(
                    device_id=r.device_id,
                    status=r.status,
                    error_message=r.error_message,
                    started_at=r.started_at,
                    completed_at=r.completed_at,
                )
                for r in results
            ],
        )

    async def cancel_firmware_upgrade_schedule(self, schedule_id: str) -> dict[str, Any]:
        """Cancel firmware upgrade schedule."""
        tenant_id = self._require_tenant_id()

        result = await self._db.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.schedule_id == schedule_id,
                FirmwareUpgradeSchedule.tenant_id == tenant_id,
            )
        )

        schedule = result.scalar_one_or_none()
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        if schedule.status not in ("pending", "queued", "running"):
            raise ValueError(f"Cannot cancel schedule with status: {schedule.status}")

        schedule.status = "cancelled"
        schedule.completed_at = datetime.now(UTC)
        await self._db.commit()

        # Update metrics
        set_firmware_upgrade_schedule_status(tenant_id, schedule_id, "cancelled", 1.0)

        logger.info(
            "firmware_schedule.cancelled_db",
            schedule_id=schedule_id,
            tenant_id=tenant_id,
        )

        return {"success": True, "message": f"Schedule {schedule_id} cancelled"}

    async def execute_firmware_upgrade_schedule(
        self, schedule_id: str
    ) -> FirmwareUpgradeScheduleResponse:
        """
        Execute firmware upgrade schedule asynchronously via Celery.

        Args:
            schedule_id: Schedule ID

        Returns:
            FirmwareUpgradeScheduleResponse with initial status
        """
        from dotmac.platform.genieacs.tasks import execute_firmware_upgrade

        tenant_id = self._require_tenant_id()

        # Verify schedule exists
        result = await self._db.execute(
            select(FirmwareUpgradeSchedule).where(
                FirmwareUpgradeSchedule.schedule_id == schedule_id,
                FirmwareUpgradeSchedule.tenant_id == tenant_id,
            )
        )

        schedule = result.scalar_one_or_none()
        if not schedule:
            raise ValueError(f"Firmware upgrade schedule {schedule_id} not found")

        # Mark as queued before handing off to Celery to ensure durable replay
        schedule.status = "queued"
        schedule.started_at = None
        schedule.completed_at = None
        await self._db.commit()
        set_firmware_upgrade_schedule_status(tenant_id, schedule_id, "queued", 1.0)

        # Queue Celery task
        execute_firmware_upgrade.delay(schedule_id)

        logger.info(
            "firmware_schedule.queued",
            schedule_id=schedule_id,
            tenant_id=tenant_id,
        )

        # Return current state
        return await self.get_firmware_upgrade_schedule(schedule_id)

    # =========================================================================
    # Mass CPE Configuration
    # =========================================================================

    async def create_mass_config_job(self, request: MassConfigRequest) -> MassConfigResponse:
        """Create mass configuration job with database persistence."""
        # Generate job ID
        job_id = str(uuid4())

        # Query devices
        devices = await self.client.get_devices(query=request.device_filter.query)
        total_devices = len(devices)

        # Validate expected count
        if request.device_filter.expected_count is not None:
            if total_devices != request.device_filter.expected_count:
                raise ValueError(
                    f"Device count mismatch: expected {request.device_filter.expected_count}, found {total_devices}"
                )

        # Build config_changes JSON
        tenant_id = self._require_tenant_id()

        config_changes: dict[str, Any] = {}
        if request.wifi:
            config_changes["wifi"] = request.wifi.model_dump(exclude_none=True)
        if request.lan:
            config_changes["lan"] = request.lan.model_dump(exclude_none=True)
        if request.wan:
            config_changes["wan"] = request.wan.model_dump(exclude_none=True)
        if request.custom_parameters:
            config_changes["custom_parameters"] = request.custom_parameters

        # Create job model
        job = MassConfigJob(
            job_id=job_id,
            tenant_id=tenant_id,
            name=request.name,
            description=request.description,
            device_filter=request.device_filter.query,
            config_changes=config_changes,
            total_devices=total_devices,
            pending_devices=total_devices,
            status="pending",
            dry_run="true" if request.dry_run else "false",
            max_concurrent=request.max_concurrent,
            created_at=datetime.now(UTC),
        )

        self._db.add(job)
        await self._db.commit()

        # Record metrics
        if not request.dry_run:
            record_mass_config_created(tenant_id)
            set_mass_config_job_status(tenant_id, job_id, "pending", 1.0)

        logger.info(
            "mass_config.created_db",
            job_id=job_id,
            tenant_id=tenant_id,
            total_devices=total_devices,
            dry_run=request.dry_run,
        )

        # Return preview if dry-run
        preview = None
        if request.dry_run:
            preview = [device.get("_id", "") for device in devices]

        return MassConfigResponse(
            job=MassConfigJobSchema(
                job_id=job.job_id,
                name=job.name,
                description=job.description,
                device_filter=job.device_filter,
                total_devices=job.total_devices,
                completed_devices=job.completed_devices,
                failed_devices=job.failed_devices,
                pending_devices=job.pending_devices,
                status=job.status,
                dry_run=job.dry_run == "true",
                created_at=job.created_at,
                started_at=job.started_at,
                completed_at=job.completed_at,
            ),
            preview=preview,
            results=[],
        )

    async def list_mass_config_jobs(self) -> MassConfigJobList:
        """List all mass configuration jobs for tenant."""
        tenant_id = self._require_tenant_id()
        result = await self._db.execute(
            select(MassConfigJob)
            .where(MassConfigJob.tenant_id == tenant_id)
            .order_by(MassConfigJob.created_at.desc())
        )

        jobs = result.scalars().all()

        # Update active jobs metric
        active_count = sum(1 for j in jobs if j.status in ("pending", "running"))
        set_mass_config_active_jobs(tenant_id, active_count)

        return MassConfigJobList(
            jobs=[
                MassConfigJobSchema(
                    job_id=j.job_id,
                    name=j.name,
                    description=j.description,
                    device_filter=j.device_filter,
                    total_devices=j.total_devices,
                    completed_devices=j.completed_devices,
                    failed_devices=j.failed_devices,
                    pending_devices=j.pending_devices,
                    status=j.status,
                    dry_run=j.dry_run == "true",
                    created_at=j.created_at,
                    started_at=j.started_at,
                    completed_at=j.completed_at,
                )
                for j in jobs
            ],
            total=len(jobs),
        )

    async def get_mass_config_job(self, job_id: str) -> MassConfigResponse:
        """Get mass configuration job with results."""
        tenant_id = self._require_tenant_id()
        result = await self._db.execute(
            select(MassConfigJob).where(
                MassConfigJob.job_id == job_id,
                MassConfigJob.tenant_id == tenant_id,
            )
        )

        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        # Get results
        results_result = await self._db.execute(
            select(MassConfigResult).where(MassConfigResult.job_id == job_id)
        )

        results = results_result.scalars().all()

        return MassConfigResponse(
            job=MassConfigJobSchema(
                job_id=job.job_id,
                name=job.name,
                description=job.description,
                device_filter=job.device_filter,
                total_devices=job.total_devices,
                completed_devices=job.completed_devices,
                failed_devices=job.failed_devices,
                pending_devices=job.pending_devices,
                status=job.status,
                dry_run=job.dry_run == "true",
                created_at=job.created_at,
                started_at=job.started_at,
                completed_at=job.completed_at,
            ),
            preview=None,
            results=[
                MassConfigResultSchema(
                    device_id=r.device_id,
                    status=r.status,
                    parameters_changed=r.parameters_changed or {},
                    error_message=r.error_message,
                    started_at=r.started_at,
                    completed_at=r.completed_at,
                )
                for r in results
            ],
        )

    async def cancel_mass_config_job(self, job_id: str) -> dict[str, Any]:
        """Cancel mass configuration job."""
        tenant_id = self._require_tenant_id()
        result = await self._db.execute(
            select(MassConfigJob).where(
                MassConfigJob.job_id == job_id,
                MassConfigJob.tenant_id == tenant_id,
            )
        )

        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        if job.status not in ("pending", "running"):
            raise ValueError(f"Cannot cancel job with status: {job.status}")

        job.status = "cancelled"
        job.completed_at = datetime.now(UTC)
        await self._db.commit()

        # Update metrics
        set_mass_config_job_status(tenant_id, job_id, "cancelled", 1.0)

        logger.info(
            "mass_config.cancelled_db",
            job_id=job_id,
            tenant_id=tenant_id,
        )

        return {"success": True, "message": f"Job {job_id} cancelled"}

    async def execute_mass_config_job(self, job_id: str) -> MassConfigResponse:
        """
        Execute mass configuration job asynchronously via Celery.

        Args:
            job_id: Job ID

        Returns:
            MassConfigResponse with initial status
        """
        from dotmac.platform.genieacs.tasks import execute_mass_config

        tenant_id = self._require_tenant_id()

        # Verify job exists
        result = await self._db.execute(
            select(MassConfigJob).where(
                MassConfigJob.job_id == job_id,
                MassConfigJob.tenant_id == tenant_id,
            )
        )

        job = result.scalar_one_or_none()
        if not job:
            raise ValueError(f"Mass configuration job {job_id} not found")

        if job.dry_run == "true":
            raise ValueError("Cannot execute dry-run job")

        job.status = "queued"
        job.started_at = None
        job.completed_at = None
        job.completed_devices = 0
        job.failed_devices = 0
        total_devices = cast(int, job.total_devices)
        job.pending_devices = total_devices
        await self._db.commit()
        set_mass_config_job_status(tenant_id, job_id, "queued", 1.0)

        # Queue Celery task
        execute_mass_config.delay(job_id)

        logger.info(
            "mass_config.queued",
            job_id=job_id,
            tenant_id=tenant_id,
        )

        # Return current state
        return await self.get_mass_config_job(job_id)
