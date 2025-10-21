"""Celery task queue configuration and utilities.

Provides a configured Celery app instance and idempotency decorator
for background task processing in the DotMac platform.

Usage:
    from dotmac.platform.core.tasks import app, idempotent_task

    @app.task
    def my_task(arg1, arg2):
        return f"Processed {arg1} and {arg2}"

    @app.task
    @idempotent_task(ttl=3600)  # type: ignore[misc]  # Custom decorator is untyped
    def unique_task(data):
        return process_data(data)

Run worker:
    celery -A dotmac.platform.tasks worker --loglevel=info

Optional dependencies:
    - opentelemetry-instrumentation-celery: For distributed tracing of tasks
      Install with: pip install opentelemetry-instrumentation-celery
"""

import hashlib
import json
from collections.abc import Callable
from functools import wraps
from typing import Any, ParamSpec, TypeVar, cast

import structlog
from celery import Celery
from celery import shared_task as celery_shared_task

from dotmac.platform.core.caching import get_redis, redis_client
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

P = ParamSpec("P")
R = TypeVar("R")

# Create Celery app instance
app = Celery(
    "dotmac",
    broker=settings.celery.broker_url,
    backend=settings.celery.result_backend,
)

# Configure Celery settings
app.conf.update(
    # Serialization
    task_serializer=settings.celery.task_serializer,
    result_serializer=settings.celery.result_serializer,
    accept_content=settings.celery.accept_content,
    # Timezone
    timezone=settings.celery.timezone,
    enable_utc=settings.celery.enable_utc,
    # Worker configuration
    worker_concurrency=settings.celery.worker_concurrency,
    worker_prefetch_multiplier=settings.celery.worker_prefetch_multiplier,
    worker_max_tasks_per_child=settings.celery.worker_max_tasks_per_child,
    # Task execution limits
    task_soft_time_limit=settings.celery.task_soft_time_limit,
    task_time_limit=settings.celery.task_time_limit,
    # Automatic retry on failure
    task_autoretry_for=(Exception,),
    task_retry_kwargs={
        "max_retries": 3,  # Default retry count
        "countdown": 5,  # Default retry delay in seconds
    },
    # Result backend settings
    result_expires=3600,  # Results expire after 1 hour
    # Track task events for monitoring
    worker_send_task_events=True,
    task_send_sent_event=True,
)

# Auto-discover tasks in the platform modules
app.autodiscover_tasks(["dotmac.platform"])


def shared_task(*args: Any, **kwargs: Any) -> Callable[..., Any]:
    """Typed wrapper around Celery's ``shared_task`` decorator."""
    if args and callable(args[0]) and len(args) == 1 and not kwargs:
        func = cast(Callable[..., Any], args[0])
        return cast(Callable[..., Any], celery_shared_task(func))
    return cast(Callable[..., Any], celery_shared_task(*args, **kwargs))


def idempotent_task(ttl: int = 3600) -> Callable[[Callable[P, R]], Callable[P, R | None]]:
    """Decorator to ensure task idempotency using Redis.

    Prevents duplicate task execution within the TTL window by using
    Redis SETNX (set if not exists) with automatic expiration.

    Args:
        ttl: Time-to-live in seconds for the idempotency key.
             Default is 3600 seconds (1 hour).

    Returns:
        Decorated function that ensures single execution within TTL, returning the original
        result or ``None`` when a duplicate invocation is detected.

    Example:
        @app.task
        @idempotent_task(ttl=300)  # 5 minutes
        def send_email(user_id, subject):
            # This will only run once per unique arguments within 5 minutes
            return send_email_to_user(user_id, subject)
    """

    def decorator(func: Callable[P, R]) -> Callable[P, R | None]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R | None:
            # Generate unique key based on function name and arguments
            key_data = f"{func.__name__}:{args}:{sorted(kwargs.items())}"
            task_key = f"task:idempotent:{hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()}"  # nosec B324 - MD5 for task deduplication key
            result_key = f"{task_key}:result"

            client = redis_client or get_redis()

            if not client:
                logger.warning("Redis not available, executing task without idempotency")
                return cast(R | None, func(*args, **kwargs))

            try:
                # Try to acquire lock with TTL (atomic operation)
                if client.set(task_key, "processing", nx=True, ex=ttl):
                    logger.debug(f"Acquired idempotency lock for {func.__name__}")
                    try:
                        # Execute the task
                        result = func(*args, **kwargs)

                        # Cache the result
                        if result is not None:
                            client.setex(result_key, ttl, json.dumps(result, default=str))

                        return result
                    except Exception as e:
                        # Release lock on failure to allow retry
                        client.delete(task_key)
                        logger.error(f"Task {func.__name__} failed, releasing lock: {e}")
                        raise
                else:
                    # Task is already running or completed
                    logger.debug(
                        f"Task {func.__name__} already processed, checking for cached result"
                    )

                    # Try to get cached result
                    cached_bytes = client.get(result_key)
                    if cached_bytes is not None:
                        # Redis returns bytes, decode to string for JSON
                        if isinstance(cached_bytes, bytes):
                            cached_str = cached_bytes.decode("utf-8")
                        else:
                            cached_str = str(cached_bytes)
                        return cast(R | None, json.loads(cached_str))

                    # Still processing, return None
                    logger.info(f"Task {func.__name__} still processing")
                    return None

            except Exception as e:
                logger.error(f"Idempotency check failed for {func.__name__}: {e}")
                # Fall back to executing the task
                return cast(R | None, func(*args, **kwargs))

        return wrapper

    return decorator


def get_celery_app() -> Celery:
    """Get the configured Celery app instance.

    Returns:
        Configured Celery application.
    """
    return app


def init_celery_instrumentation() -> None:
    """Initialize OpenTelemetry instrumentation for Celery.

    This should be called when the worker starts.
    Instrumentation is controlled by settings:
    - settings.observability.otel_enabled: Master switch for OpenTelemetry
    - settings.observability.otel_instrument_celery: Specific toggle for Celery instrumentation
    """
    if not settings.observability.otel_enabled:
        logger.debug("OpenTelemetry is disabled in settings, skipping Celery instrumentation")
        return

    if not settings.observability.otel_instrument_celery:
        logger.debug("Celery instrumentation is disabled in settings")
        return

    try:
        from opentelemetry.instrumentation.celery import CeleryInstrumentor

        # Check if already instrumented to avoid double-instrumentation
        instrumentor = CeleryInstrumentor()
        if hasattr(instrumentor, "_instrumented") and instrumentor._instrumented:
            logger.debug("celery.instrumentation.already_enabled")
            return

        instrumentor.instrument()
        logger.info("Celery instrumentation enabled for OpenTelemetry tracing")
    except ImportError as e:
        logger.warning(f"Failed to instrument Celery: {e}")
        # Don't raise - let worker continue without instrumentation
        return
    except Exception as e:
        logger.error(f"Failed to instrument Celery: {e}")
        # Don't raise - let worker continue without instrumentation
        return


# Import tasks to register them with Celery
try:
    from .communications.bulk_service import process_bulk_email_job  # noqa: F401

    logger.info("Bulk email tasks registered")
except ImportError:
    logger.debug("Bulk email tasks not available")

# Initialize instrumentation on import if in worker context
try:
    from celery import current_task

    if current_task:
        init_celery_instrumentation()
except Exception:
    pass  # Not in worker context


__all__ = [
    "app",
    "shared_task",
    "idempotent_task",
    "get_celery_app",
    "init_celery_instrumentation",
]
