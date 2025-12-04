"""Additional tests to boost service_mesh coverage to 90%+."""

import asyncio
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from dotmac.platform.resilience.service_mesh import (
    CircuitBreakerState,
    LoadBalancer,
    PerformanceOptimizationService,
    RetryPolicy,
    ServiceCall,
    ServiceEndpoint,
    ServiceMarketplace,
    ServiceMesh,
    ServiceRegistry,
    ServiceStatus,
    TrafficPolicy,
    TrafficRule,
)

pytestmark = pytest.mark.unit


class TestCircuitBreakerStateProperties:
    """Test CircuitBreakerState is_open property."""

    def test_is_open_when_state_open(self):
        """Test is_open property returns True when state is OPEN."""
        cb = CircuitBreakerState()
        cb.state = "OPEN"
        assert cb.is_open is True

    def test_is_open_when_state_closed(self):
        """Test is_open property returns False when state is CLOSED."""
        cb = CircuitBreakerState()
        cb.state = "CLOSED"
        assert cb.is_open is False

    def test_is_open_when_state_half_open(self):
        """Test is_open property returns False when state is HALF_OPEN."""
        cb = CircuitBreakerState()
        cb.state = "HALF_OPEN"
        assert cb.is_open is False


class TestCircuitBreakerHalfOpenState:
    """Test CircuitBreakerState HALF_OPEN state transitions."""

    def test_can_execute_when_half_open(self):
        """Test can_execute returns True in HALF_OPEN state."""
        cb = CircuitBreakerState()
        cb.state = "HALF_OPEN"
        assert cb.can_execute() is True


class TestServiceRegistryUnregister:
    """Test ServiceRegistry unregister functionality."""

    def test_unregister_endpoint_with_no_service(self):
        """Test unregistering when service doesn't exist."""
        registry = ServiceRegistry()
        # Should not raise error
        registry.unregister_endpoint("nonexistent", "localhost", 8080)

    def test_unregister_specific_endpoint(self):
        """Test unregistering specific endpoint."""
        registry = ServiceRegistry()

        endpoint1 = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
        )
        endpoint2 = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8081,
        )

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        assert len(registry.get_endpoints("test-service")) == 2

        registry.unregister_endpoint("test-service", "localhost", 8080)

        endpoints = registry.get_endpoints("test-service")
        assert len(endpoints) == 1
        assert endpoints[0].port == 8081


class TestLoadBalancerPolicies:
    """Test LoadBalancer selection policies."""

    @pytest.mark.asyncio
    async def test_select_endpoint_no_endpoints(self):
        """Test selecting when no endpoints exist."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        result = await lb.select_endpoint("nonexistent", TrafficPolicy.ROUND_ROBIN)
        assert result is None

    @pytest.mark.asyncio
    async def test_select_weighted_zero_total_weight(self):
        """Test weighted selection when all weights are zero."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint1 = ServiceEndpoint(service_name="test", host="host1", port=8080, weight=0)
        endpoint2 = ServiceEndpoint(service_name="test", host="host2", port=8080, weight=0)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        with patch.object(lb, "_is_healthy", return_value=True):
            result = await lb.select_endpoint("test", TrafficPolicy.WEIGHTED)
            # Should return first endpoint when all weights are 0
            assert result == endpoint1

    @pytest.mark.asyncio
    async def test_select_consistent_hash_no_context(self):
        """Test consistent hash selection with empty context."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(service_name="test", host="host1", port=8080)

        registry.register_endpoint(endpoint)

        with patch.object(lb, "_is_healthy", return_value=True):
            result = await lb.select_endpoint(
                "test", TrafficPolicy.CONSISTENT_HASH, source_context={}
            )
            # Should return first endpoint when context is empty
            assert result == endpoint

    @pytest.mark.asyncio
    async def test_select_consistent_hash_with_context(self):
        """Test consistent hash selection with source context."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint1 = ServiceEndpoint(service_name="test", host="host1", port=8080)
        endpoint2 = ServiceEndpoint(service_name="test", host="host2", port=8080)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        with patch.object(lb, "_is_healthy", return_value=True):
            result = await lb.select_endpoint(
                "test",
                TrafficPolicy.CONSISTENT_HASH,
                source_context={"user_id": "123", "session": "abc"},
            )
            # Should consistently select same endpoint for same context
            assert result in [endpoint1, endpoint2]

    @pytest.mark.asyncio
    async def test_select_endpoint_sticky_session(self):
        """Test sticky session selection stays consistent for same context."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint1 = ServiceEndpoint(service_name="test", host="host1", port=8080)
        endpoint2 = ServiceEndpoint(service_name="test", host="host2", port=8080)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        with patch.object(lb, "_is_healthy", return_value=True):
            context = {"session_id": "session-123"}
            result1 = await lb.select_endpoint("test", TrafficPolicy.STICKY_SESSION, context)
            result2 = await lb.select_endpoint("test", TrafficPolicy.STICKY_SESSION, context)

            assert result1 == result2
            assert result1 in (endpoint1, endpoint2)

            # Different sessions may be routed elsewhere
            other_context = {"session_id": "session-456"}
            result3 = await lb.select_endpoint("test", TrafficPolicy.STICKY_SESSION, other_context)
            assert result3 in (endpoint1, endpoint2)

    @pytest.mark.asyncio
    async def test_select_endpoint_all_unhealthy_fallback(self):
        """Test fallback to all endpoints when none are healthy."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(service_name="test", host="host1", port=8080)

        registry.register_endpoint(endpoint)

        # Mock _is_healthy to return False
        with patch.object(lb, "_is_healthy", return_value=False):
            result = await lb.select_endpoint("test", TrafficPolicy.ROUND_ROBIN)
            # Should still return endpoint even if unhealthy (fallback)
            assert result == endpoint


class TestLoadBalancerHealthChecks:
    """Test LoadBalancer health checking."""

    @pytest.mark.asyncio
    async def test_perform_health_check_success(self):
        """Test successful health check."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(
            service_name="test", host="localhost", port=8080, health_check_path="/health"
        )

        # Mock aiohttp response - use MagicMock for synchronous context manager
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_session = MagicMock()
        mock_session.get = MagicMock(return_value=mock_response)
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with patch("aiohttp.ClientSession", return_value=mock_session):
            result = await lb._perform_health_check(endpoint)

        assert result is True
        # Check health status was updated
        endpoint_key = "localhost:8080"
        assert endpoint_key in registry.health_status
        assert registry.health_status[endpoint_key]["healthy"] is True
        assert registry.health_status[endpoint_key]["status_code"] == 200

    @pytest.mark.asyncio
    async def test_perform_health_check_failure(self):
        """Test failed health check."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(
            service_name="test", host="localhost", port=8080, health_check_path="/health"
        )

        # Mock aiohttp to raise exception
        with patch("aiohttp.ClientSession", side_effect=Exception("Connection failed")):
            result = await lb._perform_health_check(endpoint)

        assert result is False
        # Check error was recorded
        endpoint_key = "localhost:8080"
        assert endpoint_key in registry.health_status
        assert registry.health_status[endpoint_key]["healthy"] is False
        assert "error" in registry.health_status[endpoint_key]

    @pytest.mark.asyncio
    async def test_is_healthy_cached_status(self):
        """Test _is_healthy uses cached status."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # Set recent cached status
        import time

        endpoint_key = "localhost:8080"
        registry.health_status[endpoint_key] = {
            "healthy": True,
            "last_check": time.time(),  # Recent check
        }

        # Should use cached status and not perform health check
        with patch.object(lb, "_perform_health_check") as mock_health_check:
            result = await lb._is_healthy(endpoint)

        assert result is True
        # Health check should not have been called due to cache
        mock_health_check.assert_not_called()

    @pytest.mark.asyncio
    async def test_is_healthy_expired_cache(self):
        """Test _is_healthy performs check when cache expired."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # Set old cached status (>30 seconds ago)
        endpoint_key = "localhost:8080"
        registry.health_status[endpoint_key] = {
            "healthy": True,
            "last_check": 0,  # Very old
        }

        # Should perform fresh health check
        with patch.object(lb, "_perform_health_check", return_value=True) as mock_health_check:
            result = await lb._is_healthy(endpoint)

        assert result is True
        # Health check should have been called due to expired cache
        mock_health_check.assert_called_once()


class TestServiceMarketplace:
    """Test ServiceMarketplace stub."""

    @pytest.mark.asyncio
    async def test_discover_service_returns_empty(self):
        """Test discover_service returns empty list."""
        marketplace = ServiceMarketplace()
        result = await marketplace.discover_service()
        assert result == []


class TestPerformanceOptimizationService:
    """Test PerformanceOptimizationService stub."""

    def test_performance_optimization_service_exists(self):
        """Test PerformanceOptimizationService can be instantiated."""
        service = PerformanceOptimizationService()
        assert service is not None


class TestServiceMeshInitialization:
    """Test ServiceMesh initialization and shutdown."""

    @pytest.mark.asyncio
    async def test_service_mesh_init(self):
        """Test ServiceMesh initialization."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        assert mesh.tenant_id == "test-tenant"
        assert mesh.registry is not None
        assert mesh.load_balancer is not None
        assert mesh.call_metrics["total_calls"] == 0

    @pytest.mark.asyncio
    async def test_service_mesh_initialize(self):
        """Test ServiceMesh initialize method."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Mock _discover_services
        with patch.object(mesh, "_discover_services", new_callable=AsyncMock):
            await mesh.initialize()

        assert mesh.http_session is not None
        assert mesh.health_check_task is not None

    @pytest.mark.asyncio
    async def test_service_mesh_shutdown(self):
        """Test ServiceMesh shutdown method."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Initialize first
        with patch.object(mesh, "_discover_services", new_callable=AsyncMock):
            await mesh.initialize()

        # Now shutdown
        await mesh.shutdown()

        assert mesh.http_session.closed

    @pytest.mark.asyncio
    async def test_service_mesh_shutdown_no_session(self):
        """Test shutdown when http_session is None."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Shutdown without initializing
        await mesh.shutdown()
        # Should not raise error

    @pytest.mark.asyncio
    async def test_service_mesh_shutdown_no_health_task(self):
        """Test shutdown when health_check_task is None."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        mesh.http_session = AsyncMock()
        mesh.http_session.close = AsyncMock()
        mesh.http_session.closed = False

        # Shutdown without health task
        await mesh.shutdown()
        mesh.http_session.close.assert_called_once()


class TestServiceMeshDiscovery:
    """Test ServiceMesh service discovery."""

    @pytest.mark.asyncio
    async def test_discover_services_empty(self):
        """Test discovering services when marketplace returns empty."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        await mesh._discover_services()
        # Should not raise error with empty services

    @pytest.mark.asyncio
    async def test_discover_services_with_instances(self):
        """Test discovering services with actual instances."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        # Mock discover_service to return test data
        async def mock_discover():
            return [
                {
                    "name": "test-service",
                    "instances": [
                        {
                            "host": "localhost",
                            "port": 8080,
                            "base_path": "/api",
                            "metadata": {"version": "1.0"},
                        }
                    ],
                }
            ]

        marketplace.discover_service = mock_discover

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        await mesh._discover_services()

        # Check endpoint was registered
        endpoints = mesh.registry.get_endpoints("test-service")
        assert len(endpoints) == 1
        assert endpoints[0].host == "localhost"
        assert endpoints[0].port == 8080

    @pytest.mark.asyncio
    async def test_discover_services_error_handling(self):
        """Test error handling during service discovery."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        # Mock discover_service to raise error
        async def mock_discover_error():
            raise Exception("Discovery failed")

        marketplace.discover_service = mock_discover_error

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Should not raise, just log error
        await mesh._discover_services()


class TestServiceMeshCallService:
    """Test ServiceMesh call_service method."""

    @pytest.mark.asyncio
    async def test_call_service_circuit_breaker_open(self):
        """Test call_service when circuit breaker is open."""
        from fastapi import HTTPException

        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoint
        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.registry.register_endpoint(endpoint)

        # Open circuit breaker
        cb = mesh.registry.get_circuit_breaker("test-service")
        cb.state = "OPEN"
        cb.last_failure_time = 9999999999.0  # Far future so it stays open

        # Call should raise HTTPException
        with pytest.raises(HTTPException) as exc_info:
            await mesh.call_service(
                source_service="source",
                destination_service="test-service",
                method="GET",
                path="/test",
            )

        assert exc_info.value.status_code == 503
        assert "circuit breaker open" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_call_service_no_endpoints(self):
        """Test call_service when no endpoints available."""
        from dotmac.platform.core.exceptions import EntityNotFoundError

        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Don't register any endpoints
        with pytest.raises(EntityNotFoundError) as exc_info:
            await mesh.call_service(
                source_service="source",
                destination_service="nonexistent-service",
                method="GET",
                path="/test",
            )

        assert "ServiceEndpoint not found" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_call_service_success(self):
        """Test successful service call."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoint
        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.registry.register_endpoint(endpoint)

        # Mock _make_http_call
        mock_response = {
            "status_code": 200,
            "headers": {"Content-Type": "application/json"},
            "body": b'{"result": "success"}',
        }

        with patch.object(mesh, "_make_http_call", return_value=mock_response):
            with patch.object(mesh.load_balancer, "select_endpoint", return_value=endpoint):
                result = await mesh.call_service(
                    source_service="source",
                    destination_service="test-service",
                    method="GET",
                    path="/test",
                    headers={"X-Custom": "value"},
                )

        assert result["status_code"] == 200
        assert "call_id" in result
        assert "trace_id" in result
        assert "span_id" in result

    @pytest.mark.asyncio
    async def test_call_service_with_traffic_rule(self):
        """Test call_service with existing traffic rule."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoint
        endpoint = ServiceEndpoint(
            service_name="dest-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.registry.register_endpoint(endpoint)

        # Add traffic rule
        rule = TrafficRule(
            name="test-rule",
            source_service="source-service",
            destination_service="dest-service",
            policy=TrafficPolicy.WEIGHTED,
            timeout_seconds=60,
        )
        mesh.registry.add_traffic_rule(rule)

        # Mock _make_http_call
        mock_response = {"status_code": 200, "headers": {}, "body": b'{"status": "ok"}'}

        with patch.object(mesh, "_make_http_call", return_value=mock_response):
            with patch.object(mesh.load_balancer, "select_endpoint", return_value=endpoint):
                result = await mesh.call_service(
                    source_service="source-service",
                    destination_service="dest-service",
                    method="POST",
                    path="/api/test",
                    body=b'{"data": "test"}',
                )

        assert result["status_code"] == 200

    @pytest.mark.asyncio
    async def test_call_service_failure_records_metrics(self):
        """Test that failures are recorded in circuit breaker."""
        from fastapi import HTTPException

        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoint
        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.registry.register_endpoint(endpoint)

        # Mock _make_http_call to fail
        with patch.object(mesh, "_make_http_call", side_effect=Exception("Connection failed")):
            with patch.object(mesh.load_balancer, "select_endpoint", return_value=endpoint):
                with pytest.raises(HTTPException) as exc_info:
                    await mesh.call_service(
                        source_service="source",
                        destination_service="test-service",
                        method="GET",
                        path="/test",
                    )

        assert exc_info.value.status_code == 500

        # Check circuit breaker recorded failure
        cb = mesh.registry.get_circuit_breaker("test-service")
        assert cb.failure_count > 0


class TestServiceMeshHttpCall:
    """Test ServiceMesh _make_http_call method."""

    @pytest.mark.asyncio
    async def test_make_http_call_success(self):
        """Test successful HTTP call."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080, path="/api")

        # Mock http_session
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.headers = {"Content-Type": "application/json"}
        mock_response.read = AsyncMock(return_value=b'{"result": "ok"}')
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_session = MagicMock()
        mock_session.request = MagicMock(return_value=mock_response)
        mesh.http_session = mock_session

        result = await mesh._make_http_call(
            endpoint=endpoint,
            method="GET",
            path="/test",
            headers={"X-Custom": "value"},
            body=None,
            timeout=30,
            ssl_context=None,
        )

        assert result["status_code"] == 200
        assert result["body"] == b'{"result": "ok"}'
        # Check mesh headers were added
        call_args = mock_session.request.call_args
        assert call_args.kwargs["headers"]["X-Mesh-Source"] == "dotmac-service-mesh"
        assert call_args.kwargs["headers"]["X-Mesh-Tenant"] == "test-tenant"

    @pytest.mark.asyncio
    async def test_make_http_call_no_session(self):
        """Test _make_http_call when http_session is None."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # http_session is None by default
        with pytest.raises(RuntimeError, match="HTTP session not initialized"):
            await mesh._make_http_call(
                endpoint=endpoint,
                method="POST",
                path="/test",
                headers=None,
                body=b"test",
                timeout=10,
                ssl_context=None,
            )


class TestServiceMeshMetrics:
    """Test ServiceMesh metrics recording."""

    def test_record_call_success(self):
        """Test recording successful call metrics."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        call = ServiceCall(
            call_id="test-call",
            source_service="source",
            destination_service="dest",
            method="GET",
            path="/test",
            headers={},
            body=None,
            timestamp=datetime.now(UTC),
            trace_id="trace-123",
            span_id="span-456",
        )

        # Record first success
        mesh._record_call_success(call, 0.5)

        assert mesh.call_metrics["total_calls"] == 1
        assert mesh.call_metrics["successful_calls"] == 1
        assert mesh.call_metrics["failed_calls"] == 0
        assert mesh.call_metrics["average_latency_ms"] == 500.0

        # Record second success
        mesh._record_call_success(call, 1.0)

        assert mesh.call_metrics["total_calls"] == 2
        assert mesh.call_metrics["successful_calls"] == 2
        # Average of 500ms and 1000ms = 750ms
        assert mesh.call_metrics["average_latency_ms"] == 750.0

        # Check service-specific metrics
        service_key = "source->dest"
        assert service_key in mesh.call_metrics["calls_by_service"]
        assert mesh.call_metrics["calls_by_service"][service_key]["total"] == 2
        assert mesh.call_metrics["calls_by_service"][service_key]["successful"] == 2

    def test_record_call_failure(self):
        """Test recording failed call metrics."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        call = ServiceCall(
            call_id="test-call",
            source_service="source",
            destination_service="dest",
            method="GET",
            path="/test",
            headers={},
            body=None,
            timestamp=datetime.now(UTC),
            trace_id="trace-123",
            span_id="span-456",
        )

        # Record failure
        mesh._record_call_failure(call, 0.3, "Connection timeout")

        assert mesh.call_metrics["total_calls"] == 1
        assert mesh.call_metrics["successful_calls"] == 0
        assert mesh.call_metrics["failed_calls"] == 1

        # Check service-specific metrics
        service_key = "source->dest"
        assert service_key in mesh.call_metrics["calls_by_service"]
        assert mesh.call_metrics["calls_by_service"][service_key]["failed"] == 1


class TestServiceMeshHelperMethods:
    """Test ServiceMesh helper methods."""

    def test_add_traffic_rule(self):
        """Test adding traffic rule."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        rule = TrafficRule(
            name="test-rule",
            source_service="source",
            destination_service="dest",
        )

        mesh.add_traffic_rule(rule)

        # Check rule was added
        retrieved = mesh.registry.get_traffic_rule("source", "dest")
        assert retrieved == rule

    def test_register_service_endpoint(self):
        """Test registering service endpoint."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )

        mesh.register_service_endpoint(endpoint)

        # Check endpoint was registered
        endpoints = mesh.registry.get_endpoints("test-service")
        assert len(endpoints) == 1
        assert endpoints[0] == endpoint

    def test_get_mesh_metrics(self):
        """Test getting mesh metrics."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Add some metrics
        call = ServiceCall(
            call_id="test",
            source_service="source",
            destination_service="dest",
            method="GET",
            path="/test",
            headers={},
            body=None,
            timestamp=datetime.now(UTC),
            trace_id="trace-123",
            span_id="span-456",
        )

        mesh._record_call_success(call, 0.5)

        metrics = mesh.get_mesh_metrics()

        assert metrics["tenant_id"] == "test-tenant"
        assert metrics["total_calls"] == 1
        assert metrics["successful_calls"] == 1
        assert metrics["failed_calls"] == 0
        assert metrics["success_rate_percent"] == 100.0
        assert metrics["average_latency_ms"] == 500.0

    def test_get_mesh_metrics_zero_calls(self):
        """Test getting metrics when no calls made."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        metrics = mesh.get_mesh_metrics()

        assert metrics["total_calls"] == 0
        assert metrics["success_rate_percent"] == 0.0

    def test_get_service_topology(self):
        """Test getting service topology."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register some endpoints
        endpoint1 = ServiceEndpoint(
            service_name="service1", host="host1", port=8080, metadata={"version": "1.0"}
        )
        endpoint2 = ServiceEndpoint(service_name="service2", host="host2", port=8081)

        mesh.register_service_endpoint(endpoint1)
        mesh.register_service_endpoint(endpoint2)

        # Add traffic rule
        rule = TrafficRule(
            name="rule1",
            source_service="service1",
            destination_service="service2",
            policy=TrafficPolicy.ROUND_ROBIN,
        )
        mesh.add_traffic_rule(rule)

        topology = mesh.get_service_topology()

        assert "services" in topology
        assert "connections" in topology
        assert "service1" in topology["services"]
        assert "service2" in topology["services"]
        assert topology["services"]["service1"]["total_endpoints"] == 1
        assert len(topology["connections"]) == 1
        assert topology["connections"][0]["source"] == "service1"
        assert topology["connections"][0]["destination"] == "service2"


class TestServiceMeshRetryLogic:
    """Test retry logic in call_service."""

    @pytest.mark.asyncio
    async def test_call_service_with_retry_policy_none(self):
        """Test call_service with retry policy NONE still raises on error."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.register_service_endpoint(endpoint)

        # Add traffic rule with NONE retry policy
        rule = TrafficRule(
            name="no-retry-rule",
            source_service="source",
            destination_service="test-service",
            retry_policy=RetryPolicy.NONE,
            max_retries=0,
        )
        mesh.registry.add_traffic_rule(rule)

        # Mock endpoint selection and failed HTTP call
        with patch.object(mesh.load_balancer, "select_endpoint", return_value=endpoint):
            with patch.object(
                mesh, "_make_http_call", side_effect=Exception("Network error")
            ) as mock_call:
                with patch(
                    "dotmac.platform.resilience.service_mesh.asyncio.sleep",
                    new_callable=AsyncMock,
                ) as mock_sleep:
                    with pytest.raises(HTTPException) as exc_info:
                        await mesh.call_service(
                            source_service="source",
                            destination_service="test-service",
                            method="GET",
                            path="/test",
                        )

        assert exc_info.value.status_code == 500
        assert "Service call failed" in exc_info.value.detail
        assert mock_call.await_count == 1
        mock_sleep.assert_not_called()

    @pytest.mark.asyncio
    async def test_call_service_with_retry_policy_enabled_still_raises(self):
        """Test call_service with retry policy enabled (but not implemented yet) still raises."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        endpoint = ServiceEndpoint(
            service_name="test-service",
            host="localhost",
            port=8080,
            protocol="https",
        )
        mesh.register_service_endpoint(endpoint)

        # Add traffic rule with retry policy enabled
        rule = TrafficRule(
            name="retry-rule",
            source_service="source",
            destination_service="test-service",
            retry_policy=RetryPolicy.EXPONENTIAL_BACKOFF,
            max_retries=3,
        )
        mesh.registry.add_traffic_rule(rule)

        # Mock endpoint selection and failed HTTP call
        with patch.object(mesh.load_balancer, "select_endpoint", return_value=endpoint):
            with patch.object(
                mesh, "_make_http_call", side_effect=Exception("Network error")
            ) as mock_call:
                with patch(
                    "dotmac.platform.resilience.service_mesh.asyncio.sleep",
                    new_callable=AsyncMock,
                ) as mock_sleep:
                    with pytest.raises(HTTPException) as exc_info:
                        await mesh.call_service(
                            source_service="source",
                            destination_service="test-service",
                            method="GET",
                            path="/test",
                        )

        # Should still fail after exhausting retries
        assert exc_info.value.status_code == 500
        assert mock_call.await_count == rule.max_retries + 1
        assert mock_sleep.await_count == rule.max_retries
        assert mesh.call_metrics["active_connections"] == 0


class TestServiceMeshHealthMonitoring:
    """Test health monitoring background tasks."""

    @pytest.mark.asyncio
    async def test_check_all_endpoints_health(self):
        """Test checking health of all endpoints."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoints
        endpoint1 = ServiceEndpoint(service_name="service-a", host="localhost", port=8001)
        endpoint2 = ServiceEndpoint(service_name="service-b", host="localhost", port=8002)

        mesh.register_service_endpoint(endpoint1)
        mesh.register_service_endpoint(endpoint2)

        # Mock _check_endpoint_health to return True
        with patch.object(mesh, "_check_endpoint_health", new_callable=AsyncMock) as mock_check:
            mock_check.return_value = True

            await mesh._check_all_endpoints_health()

            # Should have checked both endpoints
            assert mock_check.call_count == 2

    @pytest.mark.asyncio
    async def test_check_all_endpoints_health_empty(self):
        """Test checking health when no endpoints registered."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # No endpoints registered
        await mesh._check_all_endpoints_health()
        # Should not raise error

    @pytest.mark.asyncio
    async def test_check_endpoint_health_success(self):
        """Test checking health of a single endpoint - success."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Initialize http_session
        await mesh.initialize()

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # Mock successful health check
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(mesh.http_session, "get", return_value=mock_response):
            result = await mesh._check_endpoint_health(endpoint)

        assert result is True
        assert endpoint.status == ServiceStatus.HEALTHY
        assert "localhost:8080" in mesh.registry.health_status
        assert mesh.registry.health_status["localhost:8080"]["healthy"] is True

    @pytest.mark.asyncio
    async def test_check_endpoint_health_unhealthy(self):
        """Test checking health of unhealthy endpoint."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Initialize http_session
        await mesh.initialize()

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # Mock unhealthy response
        mock_response = MagicMock()
        mock_response.status = 503
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        with patch.object(mesh.http_session, "get", return_value=mock_response):
            result = await mesh._check_endpoint_health(endpoint)

        assert result is False
        assert endpoint.status == ServiceStatus.UNHEALTHY

    @pytest.mark.asyncio
    async def test_check_endpoint_health_no_session(self):
        """Test checking health when http_session is None."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Don't initialize http_session
        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        result = await mesh._check_endpoint_health(endpoint)

        assert result is False

    @pytest.mark.asyncio
    async def test_check_endpoint_health_exception(self):
        """Test checking health when exception occurs."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Initialize http_session
        await mesh.initialize()

        endpoint = ServiceEndpoint(service_name="test", host="localhost", port=8080)

        # Mock exception during health check
        with patch.object(mesh.http_session, "get", side_effect=Exception("Connection timeout")):
            result = await mesh._check_endpoint_health(endpoint)

        assert result is False
        assert endpoint.status == ServiceStatus.UNHEALTHY
        assert "localhost:8080" in mesh.registry.health_status
        assert mesh.registry.health_status["localhost:8080"]["healthy"] is False
        assert "error" in mesh.registry.health_status["localhost:8080"]

    @pytest.mark.asyncio
    async def test_health_monitoring_loop_cancellation(self):
        """Test health monitoring loop handles cancellation."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Start the health monitoring loop
        task = asyncio.create_task(mesh._health_monitoring_loop())

        # Let it run briefly
        await asyncio.sleep(0.1)

        # Cancel it
        task.cancel()

        try:
            await task
        except asyncio.CancelledError:
            # Expected
            pass

    @pytest.mark.asyncio
    async def test_health_monitoring_loop_exception_handling(self):
        """Test health monitoring loop handles exceptions gracefully."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        call_count = 0

        async def mock_check_health_with_error():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise Exception("Health check error")
            # Cancel after second call to exit loop
            raise asyncio.CancelledError()

        with patch.object(
            mesh, "_check_all_endpoints_health", side_effect=mock_check_health_with_error
        ):
            try:
                await mesh._health_monitoring_loop()
            except asyncio.CancelledError:
                pass

        # Should have attempted at least one check
        assert call_count >= 1

    def test_get_health_status(self):
        """Test getting overall health status."""
        mock_db = AsyncMock()
        marketplace = ServiceMarketplace()

        mesh = ServiceMesh(db_session=mock_db, tenant_id="test-tenant", marketplace=marketplace)

        # Register endpoints
        endpoint1 = ServiceEndpoint(service_name="service-a", host="localhost", port=8001)
        endpoint2 = ServiceEndpoint(service_name="service-b", host="localhost", port=8002)

        mesh.register_service_endpoint(endpoint1)
        mesh.register_service_endpoint(endpoint2)

        # Set health status for one endpoint
        mesh.registry.health_status["localhost:8001"] = {"healthy": True}
        mesh.registry.health_status["localhost:8002"] = {"healthy": False}

        health_status = mesh.get_health_status()

        assert health_status["total_endpoints"] == 2
        assert health_status["healthy_endpoints"] == 1
        assert health_status["unhealthy_endpoints"] == 1


class TestServiceCallModel:
    """Test ServiceCall model."""

    def test_service_call_to_dict(self):
        """Test ServiceCall to_dict method."""
        call = ServiceCall(
            call_id="test-call",
            source_service="source",
            destination_service="dest",
            method="GET",
            path="/test",
            headers={"X-Custom": "value"},
            body=b"test",
            timestamp=datetime(2025, 10, 3, 12, 0, 0, tzinfo=UTC),
            trace_id="trace-123",
            span_id="span-456",
        )

        result = call.to_dict()

        assert result["call_id"] == "test-call"
        assert result["source_service"] == "source"
        assert result["destination_service"] == "dest"
        assert result["method"] == "GET"
        assert result["path"] == "/test"
        assert result["headers"] == {"X-Custom": "value"}
        assert result["timestamp"] == "2025-10-03T12:00:00+00:00"
        assert result["trace_id"] == "trace-123"
        assert result["span_id"] == "span-456"


class TestCircuitBreakerStateTransitions:
    """Test circuit breaker state transitions."""

    def test_record_success_in_half_open_closes_breaker(self):
        """Test that recording success in HALF_OPEN state closes the circuit breaker."""
        cb = CircuitBreakerState()
        cb.state = "HALF_OPEN"

        cb.record_success()

        assert cb.state == "CLOSED"
        assert cb.failure_count == 0

    def test_record_failure_opens_breaker_at_threshold(self):
        """Test that circuit breaker opens when failure threshold is reached."""
        cb = CircuitBreakerState(failure_threshold=3)

        # Record failures up to threshold
        cb.record_failure()
        assert cb.state == "CLOSED"

        cb.record_failure()
        assert cb.state == "CLOSED"

        cb.record_failure()
        assert cb.state == "OPEN"  # Should open at threshold

    def test_can_execute_open_state_transitions_to_half_open(self):
        """Test that OPEN state transitions to HALF_OPEN after timeout."""
        cb = CircuitBreakerState(timeout_seconds=1)
        cb.state = "OPEN"
        cb.last_failure_time = time.time() - 2  # 2 seconds ago (past timeout)

        result = cb.can_execute()

        assert result is True
        assert cb.state == "HALF_OPEN"


class TestLoadBalancerWeightedPolicyEdgeCases:
    """Test load balancer weighted policy edge cases."""

    @pytest.mark.asyncio
    async def test_select_weighted_with_mixed_weights(self):
        """Test weighted selection with mixed weight values."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        # Register endpoints with different weights
        endpoint1 = ServiceEndpoint(service_name="test", host="host1", port=8001, weight=10)
        endpoint2 = ServiceEndpoint(
            service_name="test", host="host2", port=8002, weight=0
        )  # Zero weight
        endpoint3 = ServiceEndpoint(service_name="test", host="host3", port=8003, weight=90)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)
        registry.register_endpoint(endpoint3)

        # Select multiple times, should mostly get endpoint3 due to higher weight
        selections = []
        for _ in range(10):
            endpoint = await lb.select_endpoint("test", TrafficPolicy.WEIGHTED)
            if endpoint:
                selections.append(endpoint.port)

        # Endpoint with weight 90 should be selected more often
        assert 8003 in selections


class TestLoadBalancerConsistentHashEdgeCases:
    """Test consistent hash edge cases."""

    @pytest.mark.asyncio
    async def test_select_consistent_hash_without_user_id(self):
        """Test consistent hash when no user_id in context."""
        registry = ServiceRegistry()
        lb = LoadBalancer(registry)

        endpoint1 = ServiceEndpoint(service_name="test", host="host1", port=8001)
        endpoint2 = ServiceEndpoint(service_name="test", host="host2", port=8002)

        registry.register_endpoint(endpoint1)
        registry.register_endpoint(endpoint2)

        # Call with empty context
        endpoint = await lb.select_endpoint("test", TrafficPolicy.CONSISTENT_HASH, {})

        # Should still select an endpoint (falls back to first)
        assert endpoint is not None


class TestServiceMeshDiscoverServicesWithInstanceData:
    """Test discover_services with instance data processing."""
