"""
Celery application configuration with automatic OpenTelemetry instrumentation.

This module provides a properly configured Celery instance that automatically
enables tracing and metrics when the application starts.
"""

from typing import Any

from celery import Celery
from kombu import Queue

from dotmac.platform.core.tasks import init_celery_instrumentation
from dotmac.platform.settings import settings

# Create Celery application
celery_app = Celery(
    "dotmac_platform",
    broker=settings.celery.broker_url,
    backend=settings.celery.result_backend,
    include=[
        "dotmac.platform.tasks",
        "dotmac.platform.communications.task_service",
        "dotmac.platform.billing.dunning.tasks",
        "dotmac.platform.services.lifecycle.tasks",
    ],  # Auto-discover task modules
)

# Configure Celery settings
celery_app.conf.update(
    # Task routing
    task_routes={
        "dotmac.platform.tasks.*": {"queue": "default"},
    },
    # Queue configuration
    task_default_queue="default",
    task_queues=(
        Queue("default", routing_key="default"),
        Queue("high_priority", routing_key="high_priority"),
        Queue("low_priority", routing_key="low_priority"),
    ),
    # Task execution settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Task result settings
    result_expires=3600,  # 1 hour
    task_track_started=True,
    task_time_limit=300,  # 5 minutes
    task_soft_time_limit=240,  # 4 minutes
    # Worker settings
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    worker_max_tasks_per_child=1000,
    # Monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)


# Auto-initialize OpenTelemetry instrumentation when worker starts
@celery_app.on_after_configure.connect
def setup_celery_instrumentation(sender: Any, **kwargs: Any) -> None:
    """Setup OpenTelemetry instrumentation for Celery workers."""
    try:
        init_celery_instrumentation()
    except Exception as e:
        # Log error but don't fail worker startup
        import structlog

        logger = structlog.get_logger(__name__)
        logger.warning(
            "celery.instrumentation.failed",
            error=str(e),
            message="Celery worker started without OpenTelemetry instrumentation",
        )


# Log worker startup
@celery_app.on_after_finalize.connect
def setup_periodic_tasks(sender: Any, **kwargs: Any) -> None:
    """Configure any periodic tasks here."""
    import structlog

    if settings.billing.enable_multi_currency:
        from dotmac.platform.tasks import refresh_currency_rates_task

        refresh_interval = max(300, settings.billing.exchange_rate_refresh_minutes * 60)
        sender.add_periodic_task(
            refresh_interval,
            refresh_currency_rates_task.s(),
            name="currency-refresh-rates",
        )

    # Dunning & Collections - Process pending actions every 5 minutes
    from dotmac.platform.tasks import process_pending_dunning_actions_task

    sender.add_periodic_task(
        300.0,  # 5 minutes
        process_pending_dunning_actions_task.s(),
        name="dunning-process-pending-actions",
    )

    # Service Lifecycle - Process scheduled terminations every 10 minutes
    from dotmac.platform.services.lifecycle.tasks import (
        perform_health_checks_task,
        process_auto_resume_task,
        process_scheduled_terminations_task,
    )

    sender.add_periodic_task(
        600.0,  # 10 minutes
        process_scheduled_terminations_task.s(),
        name="lifecycle-process-scheduled-terminations",
    )

    # Service Lifecycle - Process auto-resumption every 15 minutes
    sender.add_periodic_task(
        900.0,  # 15 minutes
        process_auto_resume_task.s(),
        name="lifecycle-process-auto-resume",
    )

    # Service Lifecycle - Health checks every hour
    sender.add_periodic_task(
        3600.0,  # 1 hour
        perform_health_checks_task.s(),
        name="lifecycle-perform-health-checks",
    )

    logger = structlog.get_logger(__name__)
    logger.info(
        "celery.worker.configured",
        broker=settings.celery.broker_url,
        backend=settings.celery.result_backend,
        queues=["default", "high_priority", "low_priority"],
        periodic_tasks=[
            "currency-refresh-rates",
            "dunning-process-pending-actions",
            "lifecycle-process-scheduled-terminations",
            "lifecycle-process-auto-resume",
            "lifecycle-perform-health-checks",
        ],
    )


if __name__ == "__main__":
    # For running worker directly: python -m dotmac.platform.celery_app worker
    celery_app.start()
