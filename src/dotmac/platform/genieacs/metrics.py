"""
Prometheus metrics for GenieACS operations.

Provides counters, gauges, and histograms for monitoring firmware upgrades
and mass configuration jobs.
"""

from prometheus_client import Counter, Gauge, Histogram

# =============================================================================
# Firmware Upgrade Metrics
# =============================================================================

firmware_upgrade_schedules_total = Counter(
    "genieacs_firmware_upgrade_schedules_total",
    "Total number of firmware upgrade schedules created",
    ["tenant_id"],
)

firmware_upgrade_devices_total = Counter(
    "genieacs_firmware_upgrade_devices_total",
    "Total number of devices processed in firmware upgrades",
    ["tenant_id", "status"],  # status: success, failed
)

firmware_upgrade_duration_seconds = Histogram(
    "genieacs_firmware_upgrade_duration_seconds",
    "Duration of firmware upgrade execution in seconds",
    ["tenant_id"],
    buckets=[30, 60, 120, 300, 600, 1200, 1800, 3600],  # 30s to 1h
)

firmware_upgrade_schedule_status = Gauge(
    "genieacs_firmware_upgrade_schedule_status",
    "Current status of firmware upgrade schedules",
    ["tenant_id", "schedule_id", "status"],  # status: pending, running, completed, failed
)

firmware_upgrade_active_schedules = Gauge(
    "genieacs_firmware_upgrade_active_schedules",
    "Number of currently active firmware upgrade schedules",
    ["tenant_id"],
)

# =============================================================================
# Mass Configuration Metrics
# =============================================================================

mass_config_jobs_total = Counter(
    "genieacs_mass_config_jobs_total",
    "Total number of mass configuration jobs created",
    ["tenant_id"],
)

mass_config_devices_total = Counter(
    "genieacs_mass_config_devices_total",
    "Total number of devices configured in mass config jobs",
    ["tenant_id", "status"],  # status: success, failed, skipped
)

mass_config_duration_seconds = Histogram(
    "genieacs_mass_config_duration_seconds",
    "Duration of mass configuration execution in seconds",
    ["tenant_id"],
    buckets=[10, 30, 60, 120, 300, 600, 1200, 1800],  # 10s to 30m
)

mass_config_job_status = Gauge(
    "genieacs_mass_config_job_status",
    "Current status of mass configuration jobs",
    ["tenant_id", "job_id", "status"],  # status: pending, running, completed, failed
)

mass_config_active_jobs = Gauge(
    "genieacs_mass_config_active_jobs",
    "Number of currently active mass configuration jobs",
    ["tenant_id"],
)

# =============================================================================
# General CPE Metrics
# =============================================================================

genieacs_api_requests_total = Counter(
    "genieacs_api_requests_total",
    "Total number of GenieACS API requests",
    ["tenant_id", "operation", "status"],  # operation: get_devices, add_task, etc.
)

genieacs_api_request_duration_seconds = Histogram(
    "genieacs_api_request_duration_seconds",
    "Duration of GenieACS API requests in seconds",
    ["tenant_id", "operation"],
    buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0],
)

genieacs_task_queue_size = Gauge(
    "genieacs_task_queue_size",
    "Current size of GenieACS task queue",
    ["tenant_id", "task_type"],  # task_type: firmware_upgrade, mass_config
)


# =============================================================================
# Helper Functions
# =============================================================================


def record_firmware_upgrade_created(tenant_id: str) -> None:
    """Record firmware upgrade schedule creation."""
    firmware_upgrade_schedules_total.labels(tenant_id=tenant_id).inc()


def record_firmware_upgrade_device(tenant_id: str, status: str) -> None:
    """Record firmware upgrade device result."""
    firmware_upgrade_devices_total.labels(tenant_id=tenant_id, status=status).inc()


def record_firmware_upgrade_duration(tenant_id: str, duration_seconds: float) -> None:
    """Record firmware upgrade execution duration."""
    firmware_upgrade_duration_seconds.labels(tenant_id=tenant_id).observe(duration_seconds)


def set_firmware_upgrade_schedule_status(
    tenant_id: str, schedule_id: str, status: str, value: float = 1.0
) -> None:
    """Set firmware upgrade schedule status gauge."""
    firmware_upgrade_schedule_status.labels(
        tenant_id=tenant_id, schedule_id=schedule_id, status=status
    ).set(value)


def set_firmware_upgrade_active_schedules(tenant_id: str, count: int) -> None:
    """Set number of active firmware upgrade schedules."""
    firmware_upgrade_active_schedules.labels(tenant_id=tenant_id).set(count)


def record_mass_config_created(tenant_id: str) -> None:
    """Record mass configuration job creation."""
    mass_config_jobs_total.labels(tenant_id=tenant_id).inc()


def record_mass_config_device(tenant_id: str, status: str) -> None:
    """Record mass configuration device result."""
    mass_config_devices_total.labels(tenant_id=tenant_id, status=status).inc()


def record_mass_config_duration(tenant_id: str, duration_seconds: float) -> None:
    """Record mass configuration execution duration."""
    mass_config_duration_seconds.labels(tenant_id=tenant_id).observe(duration_seconds)


def set_mass_config_job_status(
    tenant_id: str, job_id: str, status: str, value: float = 1.0
) -> None:
    """Set mass configuration job status gauge."""
    mass_config_job_status.labels(tenant_id=tenant_id, job_id=job_id, status=status).set(value)


def set_mass_config_active_jobs(tenant_id: str, count: int) -> None:
    """Set number of active mass configuration jobs."""
    mass_config_active_jobs.labels(tenant_id=tenant_id).set(count)


def record_genieacs_api_request(
    tenant_id: str, operation: str, status: str, duration_seconds: float
) -> None:
    """Record GenieACS API request."""
    genieacs_api_requests_total.labels(
        tenant_id=tenant_id, operation=operation, status=status
    ).inc()
    genieacs_api_request_duration_seconds.labels(tenant_id=tenant_id, operation=operation).observe(
        duration_seconds
    )


def set_task_queue_size(tenant_id: str, task_type: str, size: int) -> None:
    """Set task queue size."""
    genieacs_task_queue_size.labels(tenant_id=tenant_id, task_type=task_type).set(size)
