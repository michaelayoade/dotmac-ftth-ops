"""
Health checks for external service dependencies.

Verifies that required services are available and healthy.
"""

import logging
from contextlib import contextmanager
from enum import Enum
from typing import Any

import httpx
from redis import Redis
from redis.exceptions import RedisError
from sqlalchemy import text

from dotmac.platform.db import get_sync_engine
from dotmac.platform.settings import settings

logger = logging.getLogger(__name__)


class ServiceStatus(str, Enum):
    """Service health status."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ServiceHealth:
    """Health check result for a service."""

    def __init__(
        self, name: str, status: ServiceStatus, message: str = "", required: bool = True
    ) -> None:
        self.name = name
        self.status = status
        self.message = message
        self.required = required

    @property
    def is_healthy(self) -> bool:
        return self.status == ServiceStatus.HEALTHY

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "status": self.status.value,
            "message": self.message,
            "required": self.required,
        }


class HealthChecker:
    """Check health of external service dependencies."""

    def __init__(self) -> None:
        self.checks: list[ServiceHealth] = []

    @staticmethod
    @contextmanager
    def _get_redis_client(url: str) -> Any:
        """Context manager for Redis client."""
        client = None
        try:
            client = Redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={},
            )
            yield client
        finally:
            if client:
                try:
                    client.close()
                except Exception:
                    pass  # Ignore close errors

    def _check_redis_url(self, url: str, service_name: str) -> tuple[bool, str]:
        """
        Check Redis connectivity for a given URL.

        Returns:
            Tuple of (is_healthy, message)
        """
        try:
            with self._get_redis_client(url) as client:
                client.ping()
                return True, f"{service_name} connection successful"
        except RedisError as e:
            logger.error(f"{service_name} health check failed: {e}")
            return False, f"Redis error: {str(e)}"
        except Exception as e:
            logger.error(f"{service_name} health check failed: {e}")
            return False, f"Connection failed: {str(e)}"

    def check_database(self) -> ServiceHealth:
        """Check PostgreSQL/database connectivity."""
        try:
            engine = get_sync_engine()
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                result.scalar()

            return ServiceHealth(
                name="database",
                status=ServiceStatus.HEALTHY,
                message="Database connection successful",
                required=True,
            )
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return ServiceHealth(
                name="database",
                status=ServiceStatus.UNHEALTHY,
                message=f"Connection failed: {str(e)}",
                required=True,
            )

    def check_redis(self) -> ServiceHealth:
        """Check Redis connectivity with production-aware fallback handling.

        SECURITY: In production, Redis is MANDATORY for session revocation to work
        across multiple workers. Session fallback is DISABLED in production.

        Production behavior:
        - Redis unavailable = UNHEALTHY + required=True (blocks startup)
        - Application will NOT start without Redis in production

        Development behavior:
        - Redis unavailable = DEGRADED + warning (continues with fallback)
        - In-memory fallback used (single-server only, not production-safe)
        """
        import os

        is_healthy, message = self._check_redis_url(settings.redis.redis_url, "Redis")

        # Check if we're in production mode
        is_production = os.getenv("ENVIRONMENT", "development").lower() in ("production", "prod")
        require_redis = os.getenv("REQUIRE_REDIS_SESSIONS", str(is_production)).lower() == "true"

        # SECURITY: Redis is ALWAYS required in production (no fallback)
        if not is_healthy:
            if require_redis or is_production:
                # PRODUCTION: Redis failure is CRITICAL - blocks startup
                return ServiceHealth(
                    name="redis",
                    status=ServiceStatus.UNHEALTHY,
                    message=(
                        f"{message}. "
                        "CRITICAL: Redis is MANDATORY in production for multi-worker session management. "
                        "Session revocation WILL NOT WORK without Redis. "
                        "Application startup BLOCKED."
                    ),
                    required=True,  # Blocks production startup
                )
            else:
                # DEVELOPMENT: Redis failure is DEGRADED (fallback available)
                # This is NOT safe for production - session revocation breaks across workers
                return ServiceHealth(
                    name="redis",
                    status=ServiceStatus.DEGRADED,
                    message=(
                        f"{message}. "
                        "WARNING: Running with in-memory fallback (DEVELOPMENT ONLY). "
                        "Session revocation does NOT work across multiple workers/servers. "
                        "DO NOT use in production."
                    ),
                    required=False,  # Allows dev startup with warning
                )

        # Redis is healthy
        return ServiceHealth(
            name="redis",
            status=ServiceStatus.HEALTHY,
            message=message if message else "Redis connection successful",
            required=True,  # Always required, even when healthy
        )

    def check_vault(self) -> ServiceHealth:
        """Check Vault/OpenBao connectivity."""
        if not settings.vault.enabled:
            return ServiceHealth(
                name="vault",
                status=ServiceStatus.HEALTHY,
                message="Vault disabled, skipping check",
                required=False,
            )

        try:
            from dotmac.platform.secrets import VaultClient

            client = VaultClient(
                url=settings.vault.url,
                token=settings.vault.token,
                namespace=settings.vault.namespace,
            )

            with client:
                if client.health_check():
                    return ServiceHealth(
                        name="vault",
                        status=ServiceStatus.HEALTHY,
                        message="Vault connection successful",
                        required=settings.environment == "production",
                    )
                else:
                    return ServiceHealth(
                        name="vault",
                        status=ServiceStatus.UNHEALTHY,
                        message="Vault health check failed",
                        required=settings.environment == "production",
                    )
        except Exception as e:
            logger.error(f"Vault health check failed: {e}")
            return ServiceHealth(
                name="vault",
                status=ServiceStatus.UNHEALTHY,
                message=f"Connection failed: {str(e)}",
                required=settings.environment == "production",
            )

    def check_celery_broker(self) -> ServiceHealth:
        """Check Celery broker (Redis/RabbitMQ) connectivity."""
        broker_url = settings.celery.broker_url

        if "redis://" in broker_url:
            # Redis broker
            is_healthy, message = self._check_redis_url(broker_url, "Celery broker")
            status = ServiceStatus.HEALTHY if is_healthy else ServiceStatus.DEGRADED
        elif "amqp://" in broker_url or "pyamqp://" in broker_url:
            # RabbitMQ broker - would need amqp client to check properly
            status = ServiceStatus.HEALTHY
            message = "RabbitMQ broker check not implemented"
            logger.debug("RabbitMQ health check not implemented")
        else:
            # Unknown broker type
            status = ServiceStatus.HEALTHY
            message = "Unknown broker type, assuming healthy"
            logger.warning(f"Unknown Celery broker type: {broker_url.split('://')[0]}")

        return ServiceHealth(
            name="celery_broker",
            status=status,
            message=message,
            required=False,  # Celery might not be required for all deployments
        )

    def check_storage(self) -> ServiceHealth:
        """Check MinIO/S3 storage connectivity."""
        # Guard against missing storage settings
        if not hasattr(settings, "storage"):
            return ServiceHealth(
                name="storage",
                status=ServiceStatus.HEALTHY,
                message="Storage configuration not found, using defaults",
                required=False,
            )

        # Get provider with fallback
        provider = getattr(settings.storage, "provider", "local")

        if provider == "local":
            # Local storage always available
            return ServiceHealth(
                name="storage",
                status=ServiceStatus.HEALTHY,
                message="Using local filesystem storage",
                required=False,
            )

        if provider == "minio":
            # MinIO health check would require the minio client; skip to avoid hard dependency
            return ServiceHealth(
                name="storage",
                status=ServiceStatus.HEALTHY,
                message="MinIO health check skipped (minio client not bundled)",
                required=False,
            )

        # S3 or other providers
        return ServiceHealth(
            name="storage",
            status=ServiceStatus.HEALTHY,
            message=f"Storage provider '{provider}' assumed healthy",
            required=False,
        )

    def check_observability(self) -> ServiceHealth:
        """Check observability backend (OTLP/Jaeger) connectivity."""
        if not settings.observability.otel_enabled:
            return ServiceHealth(
                name="observability",
                status=ServiceStatus.HEALTHY,
                message="Observability disabled, skipping check",
                required=False,
            )

        if not settings.observability.otel_endpoint:
            return ServiceHealth(
                name="observability",
                status=ServiceStatus.DEGRADED,
                message="OTLP endpoint not configured",
                required=False,
            )

        try:
            # Simple HTTP check to OTLP endpoint
            with httpx.Client(timeout=5.0) as client:
                response = client.get(settings.observability.otel_endpoint)

                if response.status_code < 500:
                    return ServiceHealth(
                        name="observability",
                        status=ServiceStatus.HEALTHY,
                        message="OTLP endpoint reachable",
                        required=False,
                    )
                else:
                    return ServiceHealth(
                        name="observability",
                        status=ServiceStatus.DEGRADED,
                        message=f"OTLP endpoint returned {response.status_code}",
                        required=False,
                    )
        except Exception as e:
            logger.warning(f"Observability health check failed: {e}")
            return ServiceHealth(
                name="observability",
                status=ServiceStatus.DEGRADED,
                message=f"Connection failed: {str(e)}",
                required=False,
            )

    def run_all_checks(self) -> tuple[bool, list[ServiceHealth]]:
        """
        Run all health checks.

        Returns:
            Tuple of (all_required_healthy, list_of_health_results)
        """
        self.checks = [
            self.check_database(),
            self.check_redis(),
            self.check_vault(),
            self.check_storage(),  # Re-enabled with proper guards
            self.check_celery_broker(),
            self.check_observability(),
        ]

        # Check if all required services are healthy
        all_required_healthy = all(check.is_healthy or not check.required for check in self.checks)

        return all_required_healthy, self.checks

    def get_summary(self) -> dict[str, Any]:
        """Get health check summary."""
        all_required_healthy, checks = self.run_all_checks()

        return {
            "healthy": all_required_healthy,
            "services": [check.to_dict() for check in checks],
            "required_services": [check.name for check in checks if check.required],
            "failed_services": [check.name for check in checks if not check.is_healthy],
            "failed_required": [
                check.name for check in checks if check.required and not check.is_healthy
            ],
        }


def check_startup_dependencies() -> bool:
    """
    Check if all required dependencies are available at startup.

    Returns:
        True if all required services are healthy, False otherwise.
    """
    checker = HealthChecker()
    all_healthy, checks = checker.run_all_checks()

    # Log status of each service
    logger.info("=" * 60)
    logger.info("Service Dependency Health Checks")
    logger.info("=" * 60)

    for check in checks:
        icon = "✅" if check.is_healthy else "❌" if check.required else "⚠️"
        logger.info(f"{icon} {check.name}: {check.status.value} - {check.message}")

    logger.info("=" * 60)

    if not all_healthy:
        failed_required = [c.name for c in checks if c.required and not c.is_healthy]
        if failed_required:
            logger.error(f"Required services not available: {', '.join(failed_required)}")

            if settings.environment == "production":
                logger.error("Cannot start in production with missing required services")
                return False
            else:
                logger.warning("Continuing in development mode despite missing services")

    return True


def ensure_infrastructure_running() -> None:
    """
    Provide guidance on starting required infrastructure.

    This doesn't start services but provides helpful instructions.
    """
    import structlog

    structured_logger = structlog.get_logger(__name__)

    # Log structured infrastructure requirements
    structured_logger.info(
        "infrastructure.startup_guide",
        required_services=["PostgreSQL", "Redis"],
        optional_services=["Vault/OpenBao", "Celery", "OTLP Collector"],
        docker_compose_command="docker-compose up -d",
        minimal_startup="docker-compose up -d postgres redis",
    )

    # Also log individual service commands for reference
    structured_logger.debug(
        "infrastructure.individual_services",
        postgres="docker run -d -p 5432:5432 postgres:15",
        redis="docker run -d -p 6379:6379 redis:7",
        vault="docker run -d -p 8200:8200 hashicorp/vault:latest",
    )
