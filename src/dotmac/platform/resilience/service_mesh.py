"""
Service Mesh Implementation

Provides comprehensive service-to-service communication management:
- Service registration and discovery
- Load balancing and traffic routing
- Circuit breakers and retry policies
- Security and encryption (mTLS)
- Observability and distributed tracing
- Traffic policies and rate limiting
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import ssl
import time
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import Enum
from typing import Any
from uuid import uuid4

import aiohttp
import structlog
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

# Use core exceptions
from ..core.exceptions import EntityNotFoundError


class PerformanceOptimizationService:
    """Stub for performance optimization service."""

    pass


class ServiceMarketplace:
    """Stub for service marketplace - discovers available services."""

    async def discover_service(self) -> Any:
        """Discover available services."""
        # Return empty list by default
        return []


logger = structlog.get_logger(__name__)


class TrafficPolicy(str, Enum):
    """Traffic routing policies."""

    ROUND_ROBIN = "round_robin"
    WEIGHTED = "weighted"
    LEAST_CONNECTIONS = "least_connections"
    CONSISTENT_HASH = "consistent_hash"
    STICKY_SESSION = "sticky_session"


class RetryPolicy(str, Enum):
    """Retry policies for failed requests."""

    NONE = "none"
    EXPONENTIAL_BACKOFF = "exponential_backoff"
    FIXED_INTERVAL = "fixed_interval"
    CIRCUIT_BREAKER = "circuit_breaker"


class EncryptionLevel(str, Enum):
    """Service communication encryption levels."""

    NONE = "none"
    TLS = "tls"
    MTLS = "mtls"


class ServiceStatus(str, Enum):
    """Service health status."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    DEGRADED = "degraded"


@dataclass
class ServiceEndpoint:
    """Service endpoint configuration."""

    service_name: str
    host: str
    port: int
    path: str = "/"
    protocol: str = "http"
    weight: int = 100
    health_check_path: str = "/health"
    metadata: dict[str, Any] = field(default_factory=lambda: {})
    status: ServiceStatus = ServiceStatus.UNKNOWN

    @property
    def url(self) -> str:
        """Get the full URL for this endpoint."""
        return f"{self.protocol}://{self.host}:{self.port}{self.path}"

    @property
    def health_url(self) -> str:
        """Get the health check URL."""
        return f"{self.protocol}://{self.host}:{self.port}{self.health_check_path}"


@dataclass
class TrafficRule:
    """Traffic routing rule configuration."""

    name: str
    source_service: str
    destination_service: str
    policy: TrafficPolicy = TrafficPolicy.ROUND_ROBIN
    weight_distribution: dict[str, int] = field(default_factory=lambda: {})
    headers: dict[str, str] = field(default_factory=lambda: {})
    timeout_seconds: int = 30
    retry_policy: RetryPolicy = RetryPolicy.EXPONENTIAL_BACKOFF
    max_retries: int = 3
    circuit_breaker_enabled: bool = True
    rate_limit_rpm: int | None = None
    encryption_level: EncryptionLevel = EncryptionLevel.TLS


@dataclass
class ServiceCall:
    """Represents a service-to-service call."""

    call_id: str
    source_service: str
    destination_service: str
    method: str
    path: str
    headers: dict[str, str]
    body: bytes | None
    timestamp: datetime
    trace_id: str
    span_id: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            "call_id": self.call_id,
            "source_service": self.source_service,
            "destination_service": self.destination_service,
            "method": self.method,
            "path": self.path,
            "headers": self.headers,
            "timestamp": self.timestamp.isoformat(),
            "trace_id": self.trace_id,
            "span_id": self.span_id,
        }


class CircuitBreakerState:
    """Circuit breaker for service calls."""

    def __init__(
        self, failure_threshold: int = 5, timeout_seconds: int = 60, service_name: str | None = None
    ):
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.service_name = service_name or ""
        self.failure_count = 0
        self.last_failure_time: float | None = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    def record_success(self) -> None:
        """Record a successful call."""
        self.failure_count = 0
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            logger.info("Circuit breaker closed after successful call")

    def record_failure(self) -> None:
        """Record a failed call."""
        self.failure_count += 1
        self.last_failure_time = time.time()

        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            logger.warning(f"Circuit breaker opened after {self.failure_count} failures")

    def can_execute(self) -> bool:
        """Check if call can be executed."""
        if self.state == "CLOSED":
            return True
        elif self.state == "OPEN":
            if time.time() - (self.last_failure_time or 0) > self.timeout_seconds:
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker transitioning to HALF_OPEN")
                return True
            return False
        else:  # HALF_OPEN
            return True

    @property
    def is_open(self) -> bool:
        return self.state == "OPEN"


class ServiceRegistry:
    """Registry for service endpoints and configurations."""

    def __init__(self) -> None:
        self.endpoints: dict[str, list[ServiceEndpoint]] = {}
        self.traffic_rules: dict[str, TrafficRule] = {}
        self.circuit_breakers: dict[str, CircuitBreakerState] = {}
        self.connection_counts: dict[str, int] = {}
        self.health_status: dict[str, dict[str, Any]] = {}

    def register_endpoint(self, endpoint: ServiceEndpoint) -> None:
        """Register a service endpoint."""
        if endpoint.service_name not in self.endpoints:
            self.endpoints[endpoint.service_name] = []

        # Remove existing endpoint with same host:port
        self.endpoints[endpoint.service_name] = [
            ep
            for ep in self.endpoints[endpoint.service_name]
            if not (ep.host == endpoint.host and ep.port == endpoint.port)
        ]

        self.endpoints[endpoint.service_name].append(endpoint)
        logger.info(f"Registered endpoint: {endpoint.service_name} at {endpoint.url}")

    def unregister_endpoint(self, service_name: str, host: str, port: int) -> None:
        """Unregister a service endpoint."""
        if service_name in self.endpoints:
            self.endpoints[service_name] = [
                ep
                for ep in self.endpoints[service_name]
                if not (ep.host == host and ep.port == port)
            ]
            logger.info(f"Unregistered endpoint: {service_name} at {host}:{port}")

    def get_endpoints(self, service_name: str) -> list[ServiceEndpoint]:
        """Get all endpoints for a service."""
        return self.endpoints.get(service_name, [])

    def add_traffic_rule(self, rule: TrafficRule) -> None:
        """Add a traffic routing rule."""
        rule_key = f"{rule.source_service}->{rule.destination_service}"
        self.traffic_rules[rule_key] = rule
        logger.info(f"Added traffic rule: {rule.name}")

    def get_traffic_rule(self, source_service: str, destination_service: str) -> TrafficRule | None:
        """Get traffic rule for service pair."""
        rule_key = f"{source_service}->{destination_service}"
        return self.traffic_rules.get(rule_key)

    def get_circuit_breaker(self, service_name: str) -> CircuitBreakerState:
        """Get circuit breaker for service."""
        if service_name not in self.circuit_breakers:
            self.circuit_breakers[service_name] = CircuitBreakerState()
        return self.circuit_breakers[service_name]


class LoadBalancer:
    """Load balancer for selecting service endpoints."""

    def __init__(self, registry: ServiceRegistry) -> None:
        self.registry = registry
        self.round_robin_counters: dict[str, int] = {}

    async def select_endpoint(
        self,
        service_name: str,
        policy: TrafficPolicy,
        source_context: dict[str, Any] | None = None,
    ) -> ServiceEndpoint | None:
        """Select an endpoint based on traffic policy."""
        endpoints = self.registry.get_endpoints(service_name)
        if not endpoints:
            return None

        # Filter healthy endpoints
        healthy_endpoints = [ep for ep in endpoints if await self._is_healthy(ep)]
        if not healthy_endpoints:
            # Fallback to all endpoints if none are healthy
            healthy_endpoints = endpoints

        if policy == TrafficPolicy.ROUND_ROBIN:
            return self._select_round_robin(service_name, healthy_endpoints)
        elif policy == TrafficPolicy.WEIGHTED:
            return self._select_weighted(healthy_endpoints)
        elif policy == TrafficPolicy.LEAST_CONNECTIONS:
            return self._select_least_connections(healthy_endpoints)
        elif policy == TrafficPolicy.CONSISTENT_HASH:
            return self._select_consistent_hash(healthy_endpoints, source_context or {})
        elif policy == TrafficPolicy.STICKY_SESSION:
            return self._select_sticky_session(healthy_endpoints, source_context or {})
        else:
            return healthy_endpoints[0]  # Default to first

    def _select_round_robin(
        self, service_name: str, endpoints: list[ServiceEndpoint]
    ) -> ServiceEndpoint:
        """Select endpoint using round robin."""
        if service_name not in self.round_robin_counters:
            self.round_robin_counters[service_name] = 0

        selected = endpoints[self.round_robin_counters[service_name] % len(endpoints)]
        self.round_robin_counters[service_name] += 1
        return selected

    def _select_weighted(self, endpoints: list[ServiceEndpoint]) -> ServiceEndpoint:
        """Select endpoint using weighted random selection."""
        total_weight = sum(ep.weight for ep in endpoints)
        if total_weight == 0:
            return endpoints[0]

        from secrets import SystemRandom

        _sr = SystemRandom()
        r = _sr.randint(1, total_weight)
        current_weight = 0

        for endpoint in endpoints:
            current_weight += endpoint.weight
            if current_weight >= r:
                return endpoint

        return endpoints[-1]

    def _select_least_connections(self, endpoints: list[ServiceEndpoint]) -> ServiceEndpoint:
        """Select endpoint with least connections."""
        min_connections = float("inf")
        selected = endpoints[0]

        for endpoint in endpoints:
            endpoint_key = f"{endpoint.host}:{endpoint.port}"
            connections = self.registry.connection_counts.get(endpoint_key, 0)
            if connections < min_connections:
                min_connections = connections
                selected = endpoint

        return selected

    def _select_consistent_hash(
        self, endpoints: list[ServiceEndpoint], source_context: dict[str, Any]
    ) -> ServiceEndpoint:
        """Select endpoint using consistent hashing."""
        if not source_context:
            return endpoints[0]

        # Create hash from source context (using SHA-256 instead of MD5 for security)
        hash_input = json.dumps(source_context, sort_keys=True)
        hash_value = int(hashlib.sha256(hash_input.encode()).hexdigest()[:16], 16)
        index = hash_value % len(endpoints)
        return endpoints[index]

    def _select_sticky_session(
        self, endpoints: list[ServiceEndpoint], source_context: dict[str, Any]
    ) -> ServiceEndpoint:
        """Select endpoint using sticky sessions with well-known context keys."""
        candidate_value: str | None = None

        if isinstance(source_context, dict):
            for key in (
                "session_id",
                "session",
                "user_id",
                "customer_id",
                "client_ip",
                "trace_id",
            ):
                value = source_context.get(key)
                if value:
                    candidate_value = str(value)
                    break

        if candidate_value:
            hash_value = int(hashlib.sha256(candidate_value.encode()).hexdigest()[:16], 16)
            return endpoints[hash_value % len(endpoints)]

        # Fallback to consistent hash using full context (or first endpoint if empty)
        return self._select_consistent_hash(endpoints, source_context)

    async def _is_healthy(self, endpoint: ServiceEndpoint) -> bool:
        """Check if endpoint is healthy."""
        # Check cached health status first
        endpoint_key = f"{endpoint.host}:{endpoint.port}"
        health_status = self.registry.health_status.get(endpoint_key, {})

        # Check if we have recent health data (within 30 seconds)
        last_check = health_status.get("last_check", 0)
        if time.time() - last_check < 30:
            cached_healthy = health_status.get("healthy")
            if isinstance(cached_healthy, bool):
                return cached_healthy
            return True

        # Perform health check
        return await self._perform_health_check(endpoint)

    async def _perform_health_check(self, endpoint: ServiceEndpoint) -> bool:
        """Perform actual health check on endpoint."""
        endpoint_key = f"{endpoint.host}:{endpoint.port}"

        try:
            # Make health check request
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=5)) as session:
                health_url = endpoint.health_url
                async with session.get(health_url) as response:
                    is_healthy = response.status == 200

                    # Update health status
                    self.registry.health_status[endpoint_key] = {
                        "healthy": is_healthy,
                        "last_check": time.time(),
                        "status_code": response.status,
                        "response_time_ms": 0,  # Would need timing logic
                    }

                    return is_healthy

        except Exception as e:
            logger.warning(f"Health check failed for {endpoint_key}: {e}")
            self.registry.health_status[endpoint_key] = {
                "healthy": False,
                "last_check": time.time(),
                "error": str(e),
            }
            return False


class ServiceMesh:
    """Main service mesh implementation."""

    def __init__(
        self,
        db_session: AsyncSession,
        tenant_id: str,
        marketplace: ServiceMarketplace,
        performance_service: PerformanceOptimizationService | None = None,
    ):
        self.db_session = db_session
        self.tenant_id = tenant_id
        self.marketplace = marketplace
        self.performance_service = performance_service

        self.registry = ServiceRegistry()
        self.load_balancer = LoadBalancer(self.registry)

        # Metrics and monitoring
        self.call_metrics: dict[str, Any] = {
            "total_calls": 0,
            "successful_calls": 0,
            "failed_calls": 0,
            "average_latency_ms": 0.0,
            "calls_by_service": {},
            "active_connections": 0,
        }

        # HTTP session for service calls
        self.http_session: aiohttp.ClientSession | None = None

        # Health monitoring
        self.health_check_task: asyncio.Task[None] | None = None

    @staticmethod
    def _metadata_bool(metadata: dict[str, Any], key: str, default: bool) -> bool:
        """Convert metadata value to boolean with sensible defaults."""
        if key not in metadata or metadata[key] is None:
            return default

        value = metadata[key]
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"1", "true", "yes", "on"}
        return bool(value)

    def _get_ssl_context(
        self,
        endpoint: ServiceEndpoint,
        traffic_rule: TrafficRule,
    ) -> ssl.SSLContext | None:
        """Build or validate SSL context based on encryption policy."""
        metadata = endpoint.metadata or {}
        protocol = (endpoint.protocol or "http").lower()
        encryption = traffic_rule.encryption_level

        if encryption in {EncryptionLevel.TLS, EncryptionLevel.MTLS}:
            if protocol != "https":
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"Service '{endpoint.service_name}' requires HTTPS for encryption "
                        f"policy '{encryption.value}', but endpoint protocol is '{endpoint.protocol}'."
                    ),
                )
            return self._create_ssl_context(
                endpoint=endpoint,
                metadata=metadata,
                require_client_cert=encryption == EncryptionLevel.MTLS,
            )

        # No encryption required, but allow TLS metadata if endpoint already uses HTTPS
        if protocol == "https":
            return self._create_ssl_context(
                endpoint=endpoint,
                metadata=metadata,
                require_client_cert=False,
            )

        return None

    def _create_ssl_context(
        self,
        *,
        endpoint: ServiceEndpoint,
        metadata: dict[str, Any],
        require_client_cert: bool,
    ) -> ssl.SSLContext | None:
        """Create an SSL context using endpoint metadata."""
        verify_tls = self._metadata_bool(metadata, "verify_tls", True)
        ca_cert_path = metadata.get("ca_cert_path") or metadata.get("ca_bundle_path")
        client_cert_path = metadata.get("client_cert_path") or metadata.get("mtls_client_cert")
        client_key_path = metadata.get("client_key_path") or metadata.get("mtls_client_key")
        client_key_password = metadata.get("client_key_password") or metadata.get(
            "mtls_client_key_password"
        )

        needs_context = (
            require_client_cert
            or ca_cert_path is not None
            or not verify_tls
            or client_cert_path is not None
            or client_key_path is not None
        )

        if not needs_context:
            # Default aiohttp SSL handling is sufficient
            return None

        context = ssl.create_default_context()

        if ca_cert_path:
            if not os.path.exists(ca_cert_path):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"CA certificate '{ca_cert_path}' configured for service "
                        f"'{endpoint.service_name}' was not found on disk."
                    ),
                )
            context.load_verify_locations(cafile=ca_cert_path)

        if not verify_tls:
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

        if require_client_cert or client_cert_path or client_key_path:
            if not client_cert_path or not client_key_path:
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"mTLS configuration for service '{endpoint.service_name}' requires "
                        "'client_cert_path' and 'client_key_path'."
                    ),
                )

            if not os.path.exists(client_cert_path) or not os.path.exists(client_key_path):
                raise HTTPException(
                    status_code=503,
                    detail=(
                        f"Client certificate '{client_cert_path}' or key '{client_key_path}' "
                        f"for service '{endpoint.service_name}' was not found."
                    ),
                )

            context.load_cert_chain(
                certfile=client_cert_path,
                keyfile=client_key_path,
                password=client_key_password,
            )

        return context

    async def initialize(self) -> None:
        """Initialize the service mesh."""
        self.http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100),
        )

        # Discover and register services from marketplace
        await self._discover_services()

        # Start health monitoring
        self.health_check_task = asyncio.create_task(self._health_monitoring_loop())

        logger.info(f"Service mesh initialized with health monitoring for tenant: {self.tenant_id}")

    async def shutdown(self) -> None:
        """Shutdown the service mesh."""
        # Cancel health monitoring
        if self.health_check_task:
            self.health_check_task.cancel()
            try:
                await self.health_check_task
            except asyncio.CancelledError:
                pass

        if self.http_session:
            await self.http_session.close()
        logger.info("Service mesh shutdown complete")

    async def _discover_services(self) -> None:
        """Discover services from marketplace and register endpoints."""
        try:
            services = await self.marketplace.discover_service()

            for service_info in services:
                service_name = service_info.get("name", "unknown")
                instances = service_info.get("instances", [])

                for instance in instances:
                    endpoint = ServiceEndpoint(
                        service_name=service_name,
                        host=instance.get("host", "localhost"),
                        port=instance.get("port", 8000),
                        path=instance.get("base_path", "/"),
                        metadata=instance.get("metadata", {}),
                    )
                    self.registry.register_endpoint(endpoint)

            logger.info(f"Discovered and registered {len(services)} services")
        except Exception as e:
            logger.error(f"Service discovery failed: {e}")

    async def call_service(
        self,
        source_service: str,
        destination_service: str,
        method: str,
        path: str,
        headers: dict[str, str] | None = None,
        body: bytes | None = None,
        timeout: int | None = None,
    ) -> dict[str, Any]:
        """Make a service-to-service call through the mesh."""
        start_time = time.time()
        call_id = str(uuid4())
        trace_id = headers.get("X-Trace-ID", str(uuid4())) if headers else str(uuid4())
        span_id = str(uuid4())

        # Get traffic rule
        traffic_rule = self.registry.get_traffic_rule(source_service, destination_service)
        if not traffic_rule:
            # Create default rule
            traffic_rule = TrafficRule(
                name=f"default-{source_service}-{destination_service}",
                source_service=source_service,
                destination_service=destination_service,
            )

        # Check circuit breaker
        circuit_breaker = self.registry.get_circuit_breaker(destination_service)
        if not circuit_breaker.can_execute():
            raise HTTPException(
                status_code=503,
                detail=f"Service {destination_service} is currently unavailable (circuit breaker open)",
            )

        # Select endpoint
        endpoint = await self.load_balancer.select_endpoint(
            destination_service, traffic_rule.policy, {"source_service": source_service}
        )

        if not endpoint:
            raise EntityNotFoundError("ServiceEndpoint", destination_service)

        # Create service call record
        service_call = ServiceCall(
            call_id=call_id,
            source_service=source_service,
            destination_service=destination_service,
            method=method,
            path=path,
            headers=headers or {},
            body=body,
            timestamp=datetime.now(UTC),
            trace_id=trace_id,
            span_id=span_id,
        )

        attempts = 1
        if traffic_rule.retry_policy != RetryPolicy.NONE:
            attempts += max(0, traffic_rule.max_retries)

        ssl_context = self._get_ssl_context(endpoint, traffic_rule)

        for attempt in range(1, attempts + 1):
            endpoint_key = f"{endpoint.host}:{endpoint.port}"
            self.registry.connection_counts[endpoint_key] = (
                self.registry.connection_counts.get(endpoint_key, 0) + 1
            )
            self.call_metrics["active_connections"] += 1

            try:
                response = await self._make_http_call(
                    endpoint,
                    method,
                    path,
                    headers,
                    body,
                    timeout or traffic_rule.timeout_seconds,
                    ssl_context,
                )

                circuit_breaker.record_success()
                self._record_call_success(service_call, time.time() - start_time)

                return {
                    "status_code": response["status_code"],
                    "headers": response["headers"],
                    "body": response["body"],
                    "call_id": call_id,
                    "trace_id": trace_id,
                    "span_id": span_id,
                }

            except Exception as e:
                circuit_breaker.record_failure()

                if attempt >= attempts or traffic_rule.retry_policy == RetryPolicy.NONE:
                    self._record_call_failure(service_call, time.time() - start_time, str(e))
                    raise HTTPException(status_code=500, detail=f"Service call failed: {e}") from e

                wait_time = self._get_retry_delay(
                    traffic_rule.retry_policy, attempt, circuit_breaker
                )
                if wait_time > 0:
                    await asyncio.sleep(wait_time)

            finally:
                current_count = self.registry.connection_counts.get(endpoint_key, 1)
                self.registry.connection_counts[endpoint_key] = max(0, current_count - 1)
                self.call_metrics["active_connections"] = max(
                    0, self.call_metrics["active_connections"] - 1
                )

        raise HTTPException(
            status_code=500, detail="Service call failed after retries were exhausted"
        )

    async def _make_http_call(
        self,
        endpoint: ServiceEndpoint,
        method: str,
        path: str,
        headers: dict[str, str] | None,
        body: bytes | None,
        timeout: int,
        ssl_context: ssl.SSLContext | None,
    ) -> dict[str, Any]:
        """Make the actual HTTP call to the service."""
        url = f"{endpoint.url.rstrip('/')}/{path.lstrip('/')}"

        # Prepare headers
        call_headers = {}
        if headers:
            call_headers.update(headers)

        # Add mesh headers
        call_headers.update(
            {
                "X-Mesh-Source": "dotmac-service-mesh",
                "X-Mesh-Version": "1.0.0",
                "X-Mesh-Tenant": self.tenant_id,
            }
        )

        if not self.http_session:
            raise RuntimeError("HTTP session not initialized")

        # Convert timeout to ClientTimeout object
        client_timeout = aiohttp.ClientTimeout(total=timeout)

        async with self.http_session.request(
            method=method.upper(),
            url=url,
            headers=call_headers,
            data=body,
            timeout=client_timeout,
            ssl=ssl_context if ssl_context is not None else True,
        ) as response:
            response_body = await response.read()

            return {
                "status_code": response.status,
                "headers": dict(response.headers),
                "body": response_body,
            }

    def _get_retry_delay(
        self,
        policy: RetryPolicy,
        attempt_number: int,
        circuit_breaker: CircuitBreakerState,
    ) -> float:
        """Calculate the delay before the next retry attempt."""
        if policy == RetryPolicy.EXPONENTIAL_BACKOFF:
            delay = 0.5 * (2 ** max(0, attempt_number - 1))
            return min(delay, 10.0)
        if policy == RetryPolicy.FIXED_INTERVAL:
            return 1.0
        if policy == RetryPolicy.CIRCUIT_BREAKER:
            return max(
                0.0, circuit_breaker.timeout_seconds / max(1, circuit_breaker.failure_threshold)
            )
        return 0.0

    def _record_call_success(self, call: ServiceCall, duration: float) -> None:
        """Record a successful service call."""
        self.call_metrics["total_calls"] += 1
        self.call_metrics["successful_calls"] += 1

        # Update average latency
        current_avg = self.call_metrics["average_latency_ms"]
        total_calls = self.call_metrics["total_calls"]
        self.call_metrics["average_latency_ms"] = (
            current_avg * (total_calls - 1) + duration * 1000
        ) / total_calls

        # Update service-specific metrics
        service_key = f"{call.source_service}->{call.destination_service}"
        if service_key not in self.call_metrics["calls_by_service"]:
            self.call_metrics["calls_by_service"][service_key] = {
                "total": 0,
                "successful": 0,
                "failed": 0,
            }

        self.call_metrics["calls_by_service"][service_key]["total"] += 1
        self.call_metrics["calls_by_service"][service_key]["successful"] += 1

    def _record_call_failure(self, call: ServiceCall, duration: float, error: str) -> None:
        """Record a failed service call."""
        self.call_metrics["total_calls"] += 1
        self.call_metrics["failed_calls"] += 1

        # Update service-specific metrics
        service_key = f"{call.source_service}->{call.destination_service}"
        if service_key not in self.call_metrics["calls_by_service"]:
            self.call_metrics["calls_by_service"][service_key] = {
                "total": 0,
                "successful": 0,
                "failed": 0,
            }

        self.call_metrics["calls_by_service"][service_key]["total"] += 1
        self.call_metrics["calls_by_service"][service_key]["failed"] += 1

        logger.warning(f"Service call failed: {call.call_id} - {error}")

    def add_traffic_rule(self, rule: TrafficRule) -> None:
        """Add a traffic routing rule."""
        self.registry.add_traffic_rule(rule)

    def register_service_endpoint(self, endpoint: ServiceEndpoint) -> None:
        """Register a new service endpoint."""
        self.registry.register_endpoint(endpoint)

    def get_mesh_metrics(self) -> dict[str, Any]:
        """Get service mesh metrics."""
        success_rate = 0.0
        if self.call_metrics["total_calls"] > 0:
            success_rate = (
                self.call_metrics["successful_calls"] / self.call_metrics["total_calls"]
            ) * 100

        return {
            "tenant_id": self.tenant_id,
            "total_calls": self.call_metrics["total_calls"],
            "successful_calls": self.call_metrics["successful_calls"],
            "failed_calls": self.call_metrics["failed_calls"],
            "success_rate_percent": round(success_rate, 2),
            "average_latency_ms": round(self.call_metrics["average_latency_ms"], 2),
            "active_connections": self.call_metrics["active_connections"],
            "registered_services": len(self.registry.endpoints),
            "total_endpoints": sum(len(eps) for eps in self.registry.endpoints.values()),
            "traffic_rules": len(self.registry.traffic_rules),
            "circuit_breakers": {
                name: cb.state for name, cb in self.registry.circuit_breakers.items()
            },
            "calls_by_service": self.call_metrics["calls_by_service"],
        }

    def get_service_topology(self) -> dict[str, Any]:
        """Get service mesh topology information."""
        services: dict[str, dict[str, Any]] = {}
        connections: list[dict[str, Any]] = []

        # Build service information
        for service_name, endpoints in self.registry.endpoints.items():
            services[service_name] = {
                "endpoints": [
                    {
                        "host": ep.host,
                        "port": ep.port,
                        "path": ep.path,
                        "weight": ep.weight,
                        "metadata": ep.metadata,
                    }
                    for ep in endpoints
                ],
                "total_endpoints": len(endpoints),
            }

        # Build connection information from traffic rules
        for rule in self.registry.traffic_rules.values():
            connections.append(
                {
                    "source": rule.source_service,
                    "destination": rule.destination_service,
                    "policy": rule.policy,
                    "encryption": rule.encryption_level,
                    "circuit_breaker": rule.circuit_breaker_enabled,
                }
            )

        return {
            "services": services,
            "connections": connections,
        }

    async def _health_monitoring_loop(self) -> None:
        """Background task to monitor endpoint health."""
        logger.info("Starting health monitoring loop")

        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds
                await self._check_all_endpoints_health()
            except asyncio.CancelledError:
                logger.info("Health monitoring loop cancelled")
                break
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")

    async def _check_all_endpoints_health(self) -> None:
        """Check health of all registered endpoints."""
        tasks = []
        for _service_name, endpoints in self.registry.endpoints.items():
            for endpoint in endpoints:
                tasks.append(self._check_endpoint_health(endpoint))

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            healthy_count = sum(1 for r in results if r is True)
            total_count = len(results)
            logger.info(f"Health check complete: {healthy_count}/{total_count} endpoints healthy")

    async def _check_endpoint_health(self, endpoint: ServiceEndpoint) -> bool:
        """Check health of a single endpoint."""
        endpoint_key = f"{endpoint.host}:{endpoint.port}"

        try:
            if not self.http_session:
                return False

            health_url = endpoint.health_url
            async with self.http_session.get(health_url) as response:
                is_healthy = response.status == 200
                response_time = 0  # Would need actual timing

                # Update health status
                self.registry.health_status[endpoint_key] = {
                    "healthy": is_healthy,
                    "last_check": time.time(),
                    "status_code": response.status,
                    "response_time_ms": response_time,
                    "endpoint": endpoint.service_name,
                }

                # Update endpoint status
                endpoint.status = ServiceStatus.HEALTHY if is_healthy else ServiceStatus.UNHEALTHY

                if not is_healthy:
                    logger.warning(f"Endpoint {endpoint_key} is unhealthy: {response.status}")

                return is_healthy

        except Exception as e:
            logger.error(f"Health check failed for {endpoint_key}: {e}")
            self.registry.health_status[endpoint_key] = {
                "healthy": False,
                "last_check": time.time(),
                "error": str(e),
                "endpoint": endpoint.service_name,
            }
            endpoint.status = ServiceStatus.UNHEALTHY
            return False

    def get_health_status(self) -> dict[str, Any]:
        """Get current health status of all endpoints."""
        total_endpoints = sum(len(endpoints) for endpoints in self.registry.endpoints.values())
        healthy_endpoints = sum(
            1 for status in self.registry.health_status.values() if status.get("healthy", False)
        )

        return {
            "total_endpoints": total_endpoints,
            "healthy_endpoints": healthy_endpoints,
            "unhealthy_endpoints": total_endpoints - healthy_endpoints,
            "health_percentage": (
                (healthy_endpoints / total_endpoints * 100) if total_endpoints > 0 else 0
            ),
            "endpoints": self.registry.health_status,
            "last_check": max(
                (status.get("last_check", 0) for status in self.registry.health_status.values()),
                default=0,
            ),
        }


class ServiceMeshFactory:
    """Factory for creating service mesh instances."""

    @staticmethod
    def create_service_mesh(
        db_session: AsyncSession,
        tenant_id: str,
        marketplace: ServiceMarketplace,
        performance_service: PerformanceOptimizationService | None = None,
    ) -> ServiceMesh:
        """Create a service mesh instance."""
        mesh = ServiceMesh(
            db_session=db_session,
            tenant_id=tenant_id,
            marketplace=marketplace,
            performance_service=performance_service,
        )
        return mesh

    @staticmethod
    def create_traffic_rule(
        name: str, source_service: str, destination_service: str, **kwargs: Any
    ) -> TrafficRule:
        """Create a traffic rule with default settings."""
        return TrafficRule(
            name=name,
            source_service=source_service,
            destination_service=destination_service,
            **kwargs,
        )

    @staticmethod
    def create_service_endpoint(
        service_name: str, host: str, port: int, **kwargs: Any
    ) -> ServiceEndpoint:
        """Create a service endpoint configuration."""
        return ServiceEndpoint(service_name=service_name, host=host, port=port, **kwargs)


async def setup_service_mesh_for_consolidated_services(
    db_session: AsyncSession,
    tenant_id: str,
    marketplace: ServiceMarketplace,
    performance_service: PerformanceOptimizationService | None = None,
) -> ServiceMesh:
    """Setup service mesh with consolidated services from Phase 2."""
    mesh = ServiceMeshFactory.create_service_mesh(
        db_session, tenant_id, marketplace, performance_service
    )

    await mesh.initialize()

    # Add default traffic rules for consolidated services
    consolidated_services = [
        "unified-billing-service",
        "unified-analytics-service",
        "unified-identity-service",
    ]

    for source in consolidated_services:
        for dest in consolidated_services:
            if source != dest:
                rule = ServiceMeshFactory.create_traffic_rule(
                    name=f"default-{source}-to-{dest}",
                    source_service=source,
                    destination_service=dest,
                    policy=TrafficPolicy.ROUND_ROBIN,
                    retry_policy=RetryPolicy.EXPONENTIAL_BACKOFF,
                    max_retries=3,
                    circuit_breaker_enabled=True,
                )
                mesh.add_traffic_rule(rule)

    logger.info("Service mesh setup complete with consolidated services")
    return mesh
