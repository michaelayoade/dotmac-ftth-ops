"""Infrastructure Health Check Module.

Checks the health of Docker containers and external services during startup.
Reports any connectivity issues with infrastructure dependencies.
"""

import asyncio
import logging
import os
from dataclasses import dataclass
from enum import Enum

import httpx

from dotmac.platform.settings import settings

logger = logging.getLogger(__name__)


def _get_service_host(docker_host: str, local_host: str = "localhost") -> str:
    """Get the appropriate host based on whether we're running in Docker or locally.

    When running inside Docker, use Docker service names.
    When running locally (outside Docker), use localhost.
    """
    # Check if we're running inside Docker
    # Common indicators: /.dockerenv file exists, or DOCKER_CONTAINER env var
    is_docker = (
        os.path.exists("/.dockerenv")
        or os.getenv("DOCKER_CONTAINER", "false").lower() == "true"
        or os.getenv("HOSTNAME", "").startswith("app")  # Docker Compose container name
    )

    return docker_host if is_docker else local_host


class HealthStatus(str, Enum):
    """Health status of a service."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    DEGRADED = "degraded"
    UNKNOWN = "unknown"


@dataclass
class ServiceHealthCheck:
    """Configuration for a service health check."""

    name: str
    host: str
    port: int
    protocol: str = "http"  # http, tcp, redis, postgres
    path: str = "/"
    timeout: float = 5.0
    required: bool = True  # Whether service is required for startup
    enabled: bool = True  # Whether to check this service


@dataclass
class HealthCheckResult:
    """Result of a health check."""

    service: str
    status: HealthStatus
    message: str
    response_time_ms: float | None = None
    details: dict | None = None


# Infrastructure services to check
# Note: Will use localhost when running locally, Docker service names when in container
def get_infrastructure_services() -> list[ServiceHealthCheck]:
    """Get infrastructure services with environment-aware hostnames."""
    return [
        # Core Database
        ServiceHealthCheck(
            name="PostgreSQL",
            host=_get_service_host("postgres", "localhost"),
            port=5432,
            protocol="tcp",
            required=True,
        ),
        # Cache and Sessions
        ServiceHealthCheck(
            name="Redis",
            host=_get_service_host("redis", "localhost"),
            port=6379,
            protocol="tcp",
            required=True,
        ),
        # Object Storage
        ServiceHealthCheck(
            name="MinIO",
            host=_get_service_host("minio", "localhost"),
            port=9000,
            protocol="http",
            path="/minio/health/live",
            required=False,
        ),
        # Secrets Management
        ServiceHealthCheck(
            name="Vault/OpenBao",
            host=_get_service_host("vault", "localhost"),
            port=8200,
            protocol="http",
            path="/v1/sys/health",
            required=False,
        ),
        # Observability - OTEL Collector
        ServiceHealthCheck(
            name="OTEL Collector",
            host=_get_service_host("otel-collector", "localhost"),
            port=13133,
            protocol="http",
            path="/",
            required=False,
        ),
        # Monitoring - Prometheus
        ServiceHealthCheck(
            name="Prometheus",
            host=_get_service_host("prometheus", "localhost"),
            port=9090,
            protocol="http",
            path="/-/healthy",
            required=False,
        ),
        # Task Queue
        ServiceHealthCheck(
            name="Celery Broker (Redis)",
            host=_get_service_host("redis", "localhost"),
            port=6379,
            protocol="tcp",
            required=False,
        ),
        # Observability - Jaeger
        ServiceHealthCheck(
            name="Jaeger UI",
            host=_get_service_host("jaeger", "localhost"),
            port=16686,
            protocol="http",
            path="/",
            required=False,
        ),
        # Observability - Grafana
        ServiceHealthCheck(
            name="Grafana",
            host=_get_service_host("grafana", "localhost"),
            # Use internal port 3000 when in Docker, mapped port 3400 when local
            port=3000 if os.path.exists("/.dockerenv") else 3400,
            protocol="http",
            path="/api/health",
            required=False,
        ),
        # Task Monitoring - Flower
        ServiceHealthCheck(
            name="Flower (Celery Monitor)",
            host=_get_service_host("flower", "localhost"),
            port=5555,
            protocol="http",
            path="/",
            required=False,
        ),
    ]


# ISP-specific services (docker-compose.isp.yml)
def get_isp_services() -> list[ServiceHealthCheck]:
    """Get ISP services with environment-aware hostnames."""
    return [
        # MongoDB for GenieACS
        ServiceHealthCheck(
            name="MongoDB (GenieACS)",
            host=_get_service_host("mongodb", "localhost"),
            port=27017,
            protocol="tcp",
            required=False,
            enabled=False,  # Only enable if ISP stack is running
        ),
        ServiceHealthCheck(
            name="FreeRADIUS",
            host=_get_service_host("freeradius", "localhost"),
            port=18120,
            protocol="http",
            required=False,
            enabled=False,  # Only enable if ISP stack is running
        ),
        ServiceHealthCheck(
            name="NetBox",
            host=_get_service_host("netbox", "localhost"),
            port=8080,
            protocol="http",
            path="/api/status/",
            required=False,
            enabled=False,
        ),
        ServiceHealthCheck(
            name="GenieACS",
            host=_get_service_host("genieacs", "localhost"),
            port=7557,
            protocol="http",
            path="/devices",
            required=False,
            enabled=False,
        ),
        ServiceHealthCheck(
            name="LibreNMS",
            host=_get_service_host("librenms", "localhost"),
            port=8001,  # Changed to 8001 to free port 8000 for FastAPI
            protocol="http",
            required=False,
            enabled=False,
        ),
        ServiceHealthCheck(
            name="AWX",
            host=_get_service_host("awx-web", "localhost"),
            port=8052,
            protocol="http",
            required=False,
            enabled=False,
        ),
        ServiceHealthCheck(
            name="TimescaleDB",
            host=_get_service_host("timescaledb", "localhost"),
            port=5433,  # Using mapped port 5433 to avoid conflict with main Postgres
            protocol="tcp",
            required=False,
            enabled=False,
        ),
        # Note: WireGuard (UDP-only service) and worker containers (awx-task, netbox-worker)
        # are not included in health checks because:
        # - WireGuard: UDP service with no HTTP endpoint (monitor via Docker health or peer connectivity)
        # - Workers: Background job processors monitored via parent services (AWX-Web, NetBox)
    ]


async def check_tcp_connectivity(host: str, port: int, timeout: float) -> tuple[bool, str, float]:
    """Check TCP connectivity to a host:port."""
    import time

    start_time = time.time()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=timeout,
        )
        writer.close()
        await writer.wait_closed()
        elapsed_ms = (time.time() - start_time) * 1000
        return True, "TCP connection successful", elapsed_ms
    except TimeoutError:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, f"Connection timeout after {timeout}s", elapsed_ms
    except ConnectionRefusedError:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, "Connection refused", elapsed_ms
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, f"Connection error: {str(e)}", elapsed_ms


async def check_http_endpoint(
    host: str, port: int, path: str, timeout: float, protocol: str = "http"
) -> tuple[bool, str, float]:
    """Check HTTP endpoint health."""
    import time

    url = f"{protocol}://{host}:{port}{path}"
    start_time = time.time()

    try:
        # Only disable SSL verification for HTTPS in non-production environments
        # Production deployments should use valid SSL certificates
        verify_ssl = protocol != "https" or settings.is_production
        async with httpx.AsyncClient(timeout=timeout, verify=verify_ssl) as client:
            response = await client.get(url)
            elapsed_ms = (time.time() - start_time) * 1000

            # Consider 2xx and 3xx as healthy
            if 200 <= response.status_code < 400:
                return True, f"HTTP {response.status_code}", elapsed_ms
            else:
                return False, f"HTTP {response.status_code}", elapsed_ms

    except httpx.TimeoutException:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, f"HTTP timeout after {timeout}s", elapsed_ms
    except httpx.ConnectError:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, "HTTP connection refused", elapsed_ms
    except Exception as e:
        elapsed_ms = (time.time() - start_time) * 1000
        return False, f"HTTP error: {str(e)}", elapsed_ms


async def check_service_health(service: ServiceHealthCheck) -> HealthCheckResult:
    """Check the health of a single service."""
    if not service.enabled:
        return HealthCheckResult(
            service=service.name,
            status=HealthStatus.UNKNOWN,
            message="Service check disabled",
        )

    try:
        if service.protocol in ["http", "https"]:
            is_healthy, message, response_time = await check_http_endpoint(
                service.host,
                service.port,
                service.path,
                service.timeout,
                service.protocol,
            )
        else:  # TCP-based protocols (tcp, redis, postgres, etc.)
            is_healthy, message, response_time = await check_tcp_connectivity(
                service.host,
                service.port,
                service.timeout,
            )

        status = HealthStatus.HEALTHY if is_healthy else HealthStatus.UNHEALTHY

        return HealthCheckResult(
            service=service.name,
            status=status,
            message=message,
            response_time_ms=response_time,
        )

    except Exception as e:
        logger.exception(f"Error checking {service.name}")
        return HealthCheckResult(
            service=service.name,
            status=HealthStatus.UNHEALTHY,
            message=f"Health check failed: {str(e)}",
        )


async def check_all_infrastructure_health(
    include_isp_services: bool = False,
) -> list[HealthCheckResult]:
    """Check health of all infrastructure services."""
    services_to_check = get_infrastructure_services()

    if include_isp_services:
        # Enable ISP services if requested
        isp_services = get_isp_services()
        for svc in isp_services:
            svc.enabled = True
        services_to_check.extend(isp_services)

    # Run all health checks concurrently
    tasks = [check_service_health(service) for service in services_to_check]
    results = await asyncio.gather(*tasks)

    return list(results)


def format_health_report(results: list[HealthCheckResult]) -> str:
    """Format health check results as a readable report."""
    lines = ["", "=" * 70, "Infrastructure Health Check Report", "=" * 70, ""]

    # Group by status
    healthy = [r for r in results if r.status == HealthStatus.HEALTHY]
    unhealthy = [r for r in results if r.status == HealthStatus.UNHEALTHY]
    unknown = [r for r in results if r.status == HealthStatus.UNKNOWN]

    # Summary
    lines.append(f"Total Services: {len(results)}")
    lines.append(f"✅ Healthy: {len(healthy)}")
    lines.append(f"❌ Unhealthy: {len(unhealthy)}")
    lines.append(f"⚠️  Unknown: {len(unknown)}")
    lines.append("")

    # Healthy services
    if healthy:
        lines.append("✅ HEALTHY SERVICES:")
        for result in healthy:
            response_time = f"{result.response_time_ms:.1f}ms" if result.response_time_ms else "N/A"
            lines.append(f"   • {result.service:<25} {result.message:<30} ({response_time})")
        lines.append("")

    # Unhealthy services
    if unhealthy:
        lines.append("❌ UNHEALTHY SERVICES:")
        for result in unhealthy:
            lines.append(f"   • {result.service:<25} {result.message}")
        lines.append("")

    # Unknown services
    if unknown:
        lines.append("⚠️  UNKNOWN/DISABLED SERVICES:")
        for result in unknown:
            lines.append(f"   • {result.service:<25} {result.message}")
        lines.append("")

    lines.append("=" * 70)

    return "\n".join(lines)


async def check_required_services_healthy(
    include_isp_services: bool = False,
) -> tuple[bool, list[HealthCheckResult]]:
    """Check if all required services are healthy.

    Returns:
        tuple: (all_required_healthy, results)
    """
    results = await check_all_infrastructure_health(include_isp_services)

    # Get all service configs
    all_services = get_infrastructure_services()
    if include_isp_services:
        all_services.extend(get_isp_services())

    # Check if any required services are unhealthy
    required_unhealthy = []
    for result in results:
        # Find the service config to check if it's required
        service_config = next(
            (s for s in all_services if s.name == result.service),
            None,
        )

        if service_config and service_config.required and service_config.enabled:
            if result.status == HealthStatus.UNHEALTHY:
                required_unhealthy.append(result)

    all_required_healthy = len(required_unhealthy) == 0

    return all_required_healthy, results


async def run_startup_health_checks(
    fail_on_unhealthy: bool = False,
    include_isp_services: bool = False,
) -> bool:
    """Run infrastructure health checks on startup.

    Args:
        fail_on_unhealthy: Whether to raise an exception if required services are unhealthy
        include_isp_services: Whether to check ISP-specific services

    Returns:
        bool: True if all required services are healthy

    Raises:
        RuntimeError: If fail_on_unhealthy=True and required services are unhealthy
    """
    logger.info("🔍 Running infrastructure health checks...")

    all_healthy, results = await check_required_services_healthy(include_isp_services)

    # Print report
    report = format_health_report(results)
    print(report)  # Print to stdout for visibility

    # Also log at appropriate levels
    for result in results:
        if result.status == HealthStatus.HEALTHY:
            logger.debug(f"✅ {result.service}: {result.message}")
        elif result.status == HealthStatus.UNHEALTHY:
            logger.warning(f"❌ {result.service}: {result.message}")
        else:
            logger.debug(f"⚠️  {result.service}: {result.message}")

    if not all_healthy:
        error_msg = "Some required infrastructure services are unhealthy"
        logger.error(error_msg)

        if fail_on_unhealthy:
            raise RuntimeError(f"{error_msg}. Cannot start application safely.")

    else:
        logger.info("✅ All required infrastructure services are healthy")

    return all_healthy
