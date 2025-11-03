"""
Tests for GenieACS durable job storage and replay behaviour.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

import dotmac.platform.genieacs.models  # noqa: F401  # Ensure tables are registered
from dotmac.platform.genieacs.models import FirmwareUpgradeSchedule, MassConfigJob
from dotmac.platform.genieacs.schemas import (
    FirmwareUpgradeScheduleCreate,
    MassConfigFilter,
    MassConfigRequest,
)
from dotmac.platform.genieacs.service_db import GenieACSServiceDB
from dotmac.platform.genieacs.tasks import (
    _replay_pending_operations_async,
)
from dotmac.platform.tenant.models import BillingCycle, Tenant, TenantPlanType, TenantStatus

UTC = UTC


class StubGenieACSClient:
    """Simple stub of the GenieACS client for persistence tests."""

    def __init__(self) -> None:
        self.devices = [
            {"_id": "device-1"},
            {"_id": "device-2"},
        ]
        self.tasks: list[tuple[str, str]] = []
        self.parameter_sets: list[tuple[str, dict[str, object]]] = []

    async def get_devices(self, query=None, projection=None, skip=0, limit=1000):
        return self.devices

    async def add_task(self, device_id=None, task_name=None, **kwargs):
        self.tasks.append((device_id or "", task_name or ""))
        return {"device_id": device_id, "task": task_name}

    async def set_parameter_values(self, device_id=None, parameters=None, **kwargs):
        self.parameter_sets.append((device_id or "", parameters or {}))
        return True


class DummyTask:
    """Test helper that mimics a Celery task's delay interface."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def delay(self, identifier: str) -> None:
        self.calls.append(identifier)


async def _create_tenant(session) -> Tenant:
    tenant = Tenant(
        id=str(uuid4()),
        name="Test Tenant",
        slug=f"tenant-{uuid4().hex[:8]}",
        status=TenantStatus.TRIAL,
        plan_type=TenantPlanType.FREE,
        billing_cycle=BillingCycle.MONTHLY,
        timezone="UTC",
    )
    session.add(tenant)
    await session.commit()
    await session.refresh(tenant)
    return tenant


@pytest.mark.asyncio
async def test_execute_firmware_schedule_marks_queued(monkeypatch, async_db_session):
    """Executing a firmware schedule should mark it queued and enqueue the task."""

    # Patch metrics no-ops to keep test lightweight
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.record_firmware_upgrade_created", lambda *_, **__: None
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.set_firmware_upgrade_schedule_status",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.set_mass_config_job_status",
        lambda *_, **__: None,
    )

    # Collect Celery task invocations
    dummy_fw = DummyTask()
    monkeypatch.setattr(
        "dotmac.platform.genieacs.tasks.execute_firmware_upgrade",
        dummy_fw,
    )

    tenant = await _create_tenant(async_db_session)
    service = GenieACSServiceDB(
        session=async_db_session,
        client=StubGenieACSClient(),
        tenant_id=tenant.id,
    )

    request = FirmwareUpgradeScheduleCreate(
        name="Nightly firmware upgrade",
        description="Test schedule",
        firmware_file="firmware.bin",
        device_filter={"_id": {"$exists": True}},
        scheduled_at=datetime.now(UTC),
        timezone="UTC",
        max_concurrent=2,
    )

    response = await service.create_firmware_upgrade_schedule(request)
    schedule_id = response.schedule.schedule_id

    await service.execute_firmware_upgrade_schedule(schedule_id)

    schedule = await async_db_session.get(FirmwareUpgradeSchedule, schedule_id)
    assert schedule is not None
    assert schedule.status == "queued"
    assert dummy_fw.calls == [schedule_id]


@pytest.mark.asyncio
async def test_replay_pending_operations(monkeypatch, async_db_session):
    """Queued or running jobs should be replayed on worker startup."""

    # Patch metrics to no-ops
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.record_firmware_upgrade_created", lambda *_, **__: None
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.record_mass_config_created", lambda *_, **__: None
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.set_firmware_upgrade_schedule_status",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.service_db.set_mass_config_job_status",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.metrics.set_firmware_upgrade_schedule_status",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.metrics.set_mass_config_job_status",
        lambda *_, **__: None,
    )

    dummy_fw = DummyTask()
    dummy_mass = DummyTask()
    monkeypatch.setattr(
        "dotmac.platform.genieacs.tasks.execute_firmware_upgrade",
        dummy_fw,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.tasks.execute_mass_config",
        dummy_mass,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.tasks.set_firmware_upgrade_schedule_status",
        lambda *_, **__: None,
    )
    monkeypatch.setattr(
        "dotmac.platform.genieacs.tasks.set_mass_config_job_status",
        lambda *_, **__: None,
    )

    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _session_ctx():
        try:
            yield async_db_session
        finally:
            await async_db_session.flush()
            await async_db_session.commit()
            async_db_session.expire_all()

    import dotmac.platform.genieacs.tasks as genieacs_tasks

    monkeypatch.setattr(
        genieacs_tasks.db_module,
        "async_session_maker",
        lambda: _session_ctx(),
        raising=False,
    )

    tenant = await _create_tenant(async_db_session)
    service = GenieACSServiceDB(
        session=async_db_session,
        client=StubGenieACSClient(),
        tenant_id=tenant.id,
    )

    # Create firmware schedule and mark as previously running
    schedule_response = await service.create_firmware_upgrade_schedule(
        FirmwareUpgradeScheduleCreate(
            name="Replay firmware",
            description=None,
            firmware_file="firmware.bin",
            device_filter={"_id": {"$exists": True}},
            scheduled_at=datetime.now(UTC),
            timezone="UTC",
            max_concurrent=1,
        )
    )
    schedule_id = schedule_response.schedule.schedule_id

    schedule = await async_db_session.get(FirmwareUpgradeSchedule, schedule_id)
    assert schedule is not None
    schedule.status = "running"
    schedule.started_at = datetime.now(UTC) - timedelta(minutes=10)
    schedule.completed_at = None
    await async_db_session.commit()

    # Create mass configuration job and mark as previously running
    mass_response = await service.create_mass_config_job(
        MassConfigRequest(
            name="Replay mass config",
            description=None,
            device_filter=MassConfigFilter(query={"_id": {"$exists": True}}),
            wifi=None,
            lan=None,
            wan=None,
            custom_parameters=None,
            max_concurrent=1,
            dry_run=False,
        )
    )
    job_id = mass_response.job.job_id

    job = await async_db_session.get(MassConfigJob, job_id)
    assert job is not None
    job.status = "running"
    job.started_at = datetime.now(UTC) - timedelta(minutes=5)
    job.completed_at = None
    await async_db_session.commit()

    # Replay pending operations
    result = await _replay_pending_operations_async()

    async_db_session.expire_all()

    # Ensure tasks were re-enqueued exactly once
    assert dummy_fw.calls == [schedule_id]
    assert dummy_mass.calls == [job_id]
    assert result == {"firmware_requeued": 1, "mass_config_requeued": 1}

    # Reload entities to verify status adjustments
    schedule_refreshed = await async_db_session.get(FirmwareUpgradeSchedule, schedule_id)
    assert schedule_refreshed is not None
    assert schedule_refreshed.status == "queued"
    assert schedule_refreshed.started_at is None

    job_refreshed = await async_db_session.get(MassConfigJob, job_id)
    assert job_refreshed is not None
    assert job_refreshed.status == "queued"
    assert job_refreshed.started_at is None
    assert job_refreshed.pending_devices == job_refreshed.total_devices
