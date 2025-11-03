"""
Tests for Consul-based service registry.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.service_registry.consul_registry import (
    ConsulServiceInfo,
    ConsulServiceRegistry,
    deregister_service,
    discover_services,
    get_consul_registry,
    get_healthy_services,
    register_service,
)

pytestmark = pytest.mark.unit


class TestConsulServiceInfo:
    """Test ConsulServiceInfo dataclass."""

    def test_consul_service_info_creation(self):
        """Test ConsulServiceInfo creation."""
        service = ConsulServiceInfo(
            name="user-service",
            address="192.168.1.100",
            port=8080,
            service_id="user-service-001",
            tags=["api", "v1"],
            meta={"team": "backend", "environment": "prod"},
            health="passing",
        )

        assert service.name == "user-service"
        assert service.address == "192.168.1.100"
        assert service.port == 8080
        assert service.service_id == "user-service-001"
        assert service.tags == ["api", "v1"]
        assert service.meta == {"team": "backend", "environment": "prod"}
        assert service.health == "passing"

    def test_consul_service_info_default_health(self):
        """Test ConsulServiceInfo with default health."""
        service = ConsulServiceInfo(
            name="test-service",
            address="localhost",
            port=3000,
            service_id="test-001",
            tags=[],
            meta={},
        )

        assert service.health == "passing"  # Default value

    def test_consul_service_info_url_property(self):
        """Test URL property generation."""
        service = ConsulServiceInfo(
            name="api-service",
            address="10.0.1.5",
            port=9090,
            service_id="api-001",
            tags=[],
            meta={},
        )

        assert service.url == "http://10.0.1.5:9090"

    def test_consul_service_info_url_localhost(self):
        """Test URL property with localhost."""
        service = ConsulServiceInfo(
            name="local-service",
            address="localhost",
            port=8080,
            service_id="local-001",
            tags=[],
            meta={},
        )

        assert service.url == "http://localhost:8080"


class TestConsulServiceRegistry:
    """Test ConsulServiceRegistry class."""

    @pytest.fixture
    def mock_consul(self):
        """Create mock Consul client."""
        consul = MagicMock()
        consul.agent = MagicMock()
        consul.agent.service = MagicMock()
        consul.agent.service.register = AsyncMock()
        consul.agent.service.deregister = AsyncMock()
        consul.health = MagicMock()
        consul.health.service = AsyncMock()
        return consul

    @pytest.fixture
    def registry(self, mock_consul):
        """Create ConsulServiceRegistry with mocked Consul."""
        with patch(
            "dotmac.platform.service_registry.consul_registry.consul.aio.Consul",
            return_value=mock_consul,
        ):
            registry = ConsulServiceRegistry("localhost", 8500)
            return registry

    @pytest.mark.asyncio
    async def test_registry_initialization(self, registry):
        """Test registry initialization."""
        assert registry._registered_services == set()

    @pytest.mark.asyncio
    async def test_register_service_basic(self, registry, mock_consul):
        """Test basic service registration."""
        service_id = await registry.register(name="test-service", address="localhost", port=8080)

        expected_service_id = "test-service-localhost-8080"
        assert service_id == expected_service_id

        # Verify Consul was called correctly
        mock_consul.agent.service.register.assert_called_once()
        call_kwargs = mock_consul.agent.service.register.call_args.kwargs

        assert call_kwargs["name"] == "test-service"
        assert call_kwargs["service_id"] == expected_service_id
        assert call_kwargs["address"] == "localhost"
        assert call_kwargs["port"] == 8080
        assert call_kwargs["tags"] == []
        assert call_kwargs["meta"] == {}
        assert call_kwargs["check"] is None

        # Verify service is tracked
        assert expected_service_id in registry._registered_services

    @pytest.mark.asyncio
    async def test_register_service_with_custom_id(self, registry, mock_consul):
        """Test service registration with custom ID."""
        custom_id = "my-custom-service-id"
        service_id = await registry.register(
            name="test-service", address="localhost", port=8080, service_id=custom_id
        )

        assert service_id == custom_id
        assert custom_id in registry._registered_services

        call_kwargs = mock_consul.agent.service.register.call_args.kwargs
        assert call_kwargs["service_id"] == custom_id

    @pytest.mark.asyncio
    async def test_register_service_with_tags_and_meta(self, registry, mock_consul):
        """Test service registration with tags and metadata."""
        await registry.register(
            name="api-service",
            address="10.0.1.5",
            port=9090,
            tags=["api", "v2", "production"],
            meta={"team": "platform", "version": "2.1.0"},
        )

        call_kwargs = mock_consul.agent.service.register.call_args.kwargs
        assert call_kwargs["tags"] == ["api", "v2", "production"]
        assert call_kwargs["meta"] == {"team": "platform", "version": "2.1.0"}

    @pytest.mark.asyncio
    async def test_register_service_with_health_check(self, registry, mock_consul):
        """Test service registration with health check."""
        await registry.register(
            name="web-service",
            address="192.168.1.10",
            port=8080,
            health_check="/actuator/health",
            health_interval="15s",
        )

        call_kwargs = mock_consul.agent.service.register.call_args.kwargs
        check = call_kwargs["check"]

        assert check["HTTP"] == "http://192.168.1.10:8080/actuator/health"
        assert check["Interval"] == "15s"
        assert check["Timeout"] == "10s"
        assert check["DeregisterCriticalServiceAfter"] == "90s"

    @pytest.mark.asyncio
    async def test_deregister_service(self, registry, mock_consul):
        """Test service deregistration."""
        # First register a service
        service_id = await registry.register(name="test-service", address="localhost", port=8080)

        assert service_id in registry._registered_services

        # Then deregister it
        await registry.deregister(service_id)

        mock_consul.agent.service.deregister.assert_called_once_with(service_id)
        assert service_id not in registry._registered_services

    @pytest.mark.asyncio
    async def test_discover_services_healthy_only(self, registry, mock_consul):
        """Test service discovery with healthy services only."""
        # Mock Consul response
        mock_consul.health.service.return_value = (
            None,  # index
            [
                {
                    "Service": {
                        "Service": "user-service",
                        "ID": "user-service-1",
                        "Address": "10.0.1.1",
                        "Port": 8080,
                        "Tags": ["api", "v1"],
                        "Meta": {"team": "backend"},
                    },
                    "Checks": [{"Status": "passing"}],
                },
                {
                    "Service": {
                        "Service": "user-service",
                        "ID": "user-service-2",
                        "Address": "10.0.1.2",
                        "Port": 8080,
                        "Tags": ["api", "v1"],
                        "Meta": {"team": "backend"},
                    },
                    "Checks": [{"Status": "passing"}],
                },
            ],
        )

        services = await registry.discover("user-service", only_healthy=True)

        assert len(services) == 2
        assert all(isinstance(s, ConsulServiceInfo) for s in services)

        # Check first service
        service1 = services[0]
        assert service1.name == "user-service"
        assert service1.service_id == "user-service-1"
        assert service1.address == "10.0.1.1"
        assert service1.port == 8080
        assert service1.tags == ["api", "v1"]
        assert service1.meta == {"team": "backend"}
        assert service1.health == "passing"

        # Verify Consul was called with correct parameters
        mock_consul.health.service.assert_called_once_with("user-service", passing=True)

    @pytest.mark.asyncio
    async def test_discover_services_include_unhealthy(self, registry, mock_consul):
        """Test service discovery including unhealthy services."""
        # Mock response with mixed health statuses
        mock_consul.health.service.return_value = (
            None,
            [
                {
                    "Service": {
                        "Service": "api-service",
                        "ID": "api-1",
                        "Address": "10.0.1.1",
                        "Port": 8080,
                        "Tags": [],
                        "Meta": {},
                    },
                    "Checks": [{"Status": "passing"}],
                },
                {
                    "Service": {
                        "Service": "api-service",
                        "ID": "api-2",
                        "Address": "10.0.1.2",
                        "Port": 8080,
                        "Tags": [],
                        "Meta": {},
                    },
                    "Checks": [{"Status": "critical"}],
                },
            ],
        )

        services = await registry.discover("api-service", only_healthy=False)

        assert len(services) == 2
        assert services[0].health == "passing"
        assert services[1].health == "critical"

        mock_consul.health.service.assert_called_once_with("api-service", passing=False)

    @pytest.mark.asyncio
    async def test_discover_services_empty_result(self, registry, mock_consul):
        """Test service discovery with no services found."""
        mock_consul.health.service.return_value = (None, [])

        services = await registry.discover("nonexistent-service")

        assert len(services) == 0
        assert isinstance(services, list)

    @pytest.mark.asyncio
    async def test_discover_services_multiple_checks(self, registry, mock_consul):
        """Test service discovery with multiple health checks."""
        # Service with multiple checks, one failing
        mock_consul.health.service.return_value = (
            None,
            [
                {
                    "Service": {
                        "Service": "complex-service",
                        "ID": "complex-1",
                        "Address": "10.0.1.1",
                        "Port": 8080,
                        "Tags": [],
                        "Meta": {},
                    },
                    "Checks": [
                        {"Status": "passing"},
                        {"Status": "critical"},  # This makes overall health critical
                        {"Status": "passing"},
                    ],
                }
            ],
        )

        services = await registry.discover("complex-service")

        assert len(services) == 1
        assert services[0].health == "critical"  # Should be critical due to one failing check

    @pytest.mark.asyncio
    async def test_get_healthy_services(self, registry, mock_consul):
        """Test get_healthy_services method."""
        mock_consul.health.service.return_value = (
            None,
            [
                {
                    "Service": {
                        "Service": "healthy-service",
                        "ID": "healthy-1",
                        "Address": "10.0.1.1",
                        "Port": 8080,
                        "Tags": [],
                        "Meta": {},
                    },
                    "Checks": [{"Status": "passing"}],
                }
            ],
        )

        services = await registry.get_healthy_services("healthy-service")

        assert len(services) == 1
        assert services[0].health == "passing"

        # Should call discover with only_healthy=True
        mock_consul.health.service.assert_called_once_with("healthy-service", passing=True)

    @pytest.mark.asyncio
    async def test_close_registry(self, registry, mock_consul):
        """Test registry cleanup and close."""
        # Register multiple services
        service1_id = await registry.register("service1", "localhost", 8001)
        service2_id = await registry.register("service2", "localhost", 8002)

        assert len(registry._registered_services) == 2

        # Close registry
        await registry.close()

        # Verify all services were deregistered
        assert mock_consul.agent.service.deregister.call_count == 2
        calls = mock_consul.agent.service.deregister.call_args_list
        deregistered_ids = {call[0][0] for call in calls}
        assert deregistered_ids == {service1_id, service2_id}

        # Registry should be empty
        assert len(registry._registered_services) == 0

    @pytest.mark.asyncio
    async def test_async_context_manager(self, mock_consul):
        """Test registry as async context manager."""
        with patch(
            "dotmac.platform.service_registry.consul_registry.consul.aio.Consul",
            return_value=mock_consul,
        ):
            async with ConsulServiceRegistry() as registry:
                service_id = await registry.register("test-service", "localhost", 8080)
                assert service_id in registry._registered_services

            # After context exit, service should be deregistered
            mock_consul.agent.service.deregister.assert_called_once_with(service_id)

    @pytest.mark.asyncio
    async def test_service_discovery_missing_optional_fields(self, registry, mock_consul):
        """Test service discovery with missing optional fields in Consul response."""
        mock_consul.health.service.return_value = (
            None,
            [
                {
                    "Service": {
                        "Service": "minimal-service",
                        "ID": "minimal-1",
                        "Address": "",
                        "Port": 8080,
                        # Tags and Meta are missing
                    },
                    "Node": {"Address": "10.0.1.1"},
                    "Checks": [{"Status": "passing"}],
                }
            ],
        )

        services = await registry.discover("minimal-service")

        assert len(services) == 1
        service = services[0]
        assert service.tags == []  # Should default to empty list
        assert service.meta == {}  # Should default to empty dict
        assert (
            service.address == "10.0.1.1"
        )  # Falls back to node address when service address empty


class TestGlobalFunctions:
    """Test global convenience functions."""

    def test_get_consul_registry_singleton(self):
        """Test that get_consul_registry returns singleton."""
        with patch(
            "dotmac.platform.service_registry.consul_registry.ConsulServiceRegistry"
        ) as mock_registry_class:
            mock_instance = MagicMock()
            mock_registry_class.return_value = mock_instance

            # First call
            registry1 = get_consul_registry()

            # Second call should return same instance
            registry2 = get_consul_registry()

            assert registry1 is registry2
            # ConsulServiceRegistry should only be instantiated once
            assert mock_registry_class.call_count == 1

    def test_get_consul_registry_with_settings(self):
        """Test get_consul_registry with custom settings."""
        with patch("dotmac.platform.service_registry.consul_registry.settings") as mock_settings:
            mock_settings.consul_host = "consul.example.com"
            mock_settings.consul_port = 8501

            with patch(
                "dotmac.platform.service_registry.consul_registry.ConsulServiceRegistry"
            ) as mock_registry_class:
                # Reset global registry to test fresh instantiation
                import dotmac.platform.service_registry.consul_registry as registry_module

                registry_module._consul_registry = None

                get_consul_registry()

                mock_registry_class.assert_called_once_with("consul.example.com", 8501)

    @pytest.mark.asyncio
    async def test_register_service_function(self):
        """Test global register_service function."""
        with patch(
            "dotmac.platform.service_registry.consul_registry.get_consul_registry"
        ) as mock_get_registry:
            mock_registry = MagicMock()
            mock_registry.register = AsyncMock(return_value="test-service-id")
            mock_get_registry.return_value = mock_registry

            service_id = await register_service(
                name="test-service",
                address="localhost",
                port=8080,
                service_id="custom-id",
                tags=["test"],
                meta={"env": "test"},
                health_check="/health",
            )

            assert service_id == "test-service-id"
            mock_registry.register.assert_called_once_with(
                name="test-service",
                address="localhost",
                port=8080,
                service_id="custom-id",
                tags=["test"],
                meta={"env": "test"},
                health_check="/health",
            )

    @pytest.mark.asyncio
    async def test_deregister_service_function(self):
        """Test global deregister_service function."""
        with patch(
            "dotmac.platform.service_registry.consul_registry.get_consul_registry"
        ) as mock_get_registry:
            mock_registry = MagicMock()
            mock_registry.deregister = AsyncMock()
            mock_get_registry.return_value = mock_registry

            await deregister_service("test-service-id")

            mock_registry.deregister.assert_called_once_with("test-service-id")

    @pytest.mark.asyncio
    async def test_discover_services_function(self):
        """Test global discover_services function."""
        mock_service = ConsulServiceInfo(
            name="test-service",
            address="localhost",
            port=8080,
            service_id="test-1",
            tags=[],
            meta={},
        )

        with patch(
            "dotmac.platform.service_registry.consul_registry.get_consul_registry"
        ) as mock_get_registry:
            mock_registry = MagicMock()
            mock_registry.discover = AsyncMock(return_value=[mock_service])
            mock_get_registry.return_value = mock_registry

            services = await discover_services("test-service", only_healthy=False)

            assert len(services) == 1
            assert services[0] == mock_service
            mock_registry.discover.assert_called_once_with("test-service", False)

    @pytest.mark.asyncio
    async def test_get_healthy_services_function(self):
        """Test global get_healthy_services function."""
        mock_service = ConsulServiceInfo(
            name="healthy-service",
            address="localhost",
            port=8080,
            service_id="healthy-1",
            tags=[],
            meta={},
        )

        with patch(
            "dotmac.platform.service_registry.consul_registry.get_consul_registry"
        ) as mock_get_registry:
            mock_registry = MagicMock()
            mock_registry.get_healthy_services = AsyncMock(return_value=[mock_service])
            mock_get_registry.return_value = mock_registry

            services = await get_healthy_services("healthy-service")

            assert len(services) == 1
            assert services[0] == mock_service
            mock_registry.get_healthy_services.assert_called_once_with("healthy-service")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
