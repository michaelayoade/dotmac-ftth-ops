"""
Platform monitoring integrations for DotMac Framework.

Provides comprehensive monitoring capabilities including:
- Integration with various monitoring services
- Benchmarking and performance tracking
- Observability data collection
- Alert management
- Health checks
- REST APIs for logs and traces
"""

import os

from dotmac.platform.settings import settings

from .benchmarks import (
    BenchmarkManager,
    BenchmarkResult,
    BenchmarkSuite,
    PerformanceBenchmark,
)
from .health_checks import (
    HealthChecker,
    ServiceHealth,
    ServiceStatus,
    check_startup_dependencies,
    ensure_infrastructure_running,
)
from .integrations import MetricData, PrometheusIntegration
from .prometheus_client import PrometheusClient, PrometheusQueryError

_skip_router_imports = os.getenv("DOTMAC_MONITORING_SKIP_IMPORTS", "").lower() in {
    "1",
    "true",
    "yes",
}

if not _skip_router_imports:
    from .logs_router import logs_router
    from .traces_router import traces_router
else:  # pragma: no cover - used only in test environments
    logs_router = None
    traces_router = None

__all__ = [
    # Settings
    "settings",
    # Integrations
    "MetricData",
    "PrometheusIntegration",
    "PrometheusClient",
    "PrometheusQueryError",
    # Benchmarks
    "BenchmarkManager",
    "PerformanceBenchmark",
    "BenchmarkResult",
    "BenchmarkSuite",
    # Health checks
    "HealthChecker",
    "ServiceHealth",
    "ServiceStatus",
    "check_startup_dependencies",
    "ensure_infrastructure_running",
    # Routers
    "logs_router",
    "traces_router",
]
