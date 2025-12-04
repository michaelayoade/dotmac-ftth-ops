"""
Tests for service registry data models.
"""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from dotmac.platform.service_registry.models import (
    ServiceHealth,
    ServiceInfo,
    ServiceStatus,
)

pytestmark = pytest.mark.unit


class TestServiceStatus:
    """Test ServiceStatus enum."""

    def test_service_status_values(self):
        """Test all ServiceStatus enum values."""
        assert ServiceStatus.HEALTHY == "healthy"
        assert ServiceStatus.UNHEALTHY == "unhealthy"
        assert ServiceStatus.DEGRADED == "degraded"
        assert ServiceStatus.STARTING == "starting"
        assert ServiceStatus.STOPPING == "stopping"
        assert ServiceStatus.UNKNOWN == "unknown"

    def test_service_status_is_string_enum(self):
        """Test that ServiceStatus is a string enum."""
        status = ServiceStatus.HEALTHY
        assert isinstance(status, str)
        assert status.value == "healthy"
        assert status == "healthy"  # Should equal the string value


class TestServiceHealth:
    """Test ServiceHealth model."""

    def test_service_health_creation(self):
        """Test ServiceHealth creation with all fields."""
        health = ServiceHealth(
            status="passing",
            latency_ms=45.2,
            cpu_usage=0.35,
            memory_usage=0.62,
            error_rate=0.001,
            request_count=1000,
            details={"database": "connected", "cache": "available"},
        )

        assert health.status == "passing"
        assert health.latency_ms == 45.2
        assert health.cpu_usage == 0.35
        assert health.memory_usage == 0.62
        assert health.error_rate == 0.001
        assert health.request_count == 1000
        assert health.details["database"] == "connected"
        assert health.details["cache"] == "available"
        assert isinstance(health.checked_at, datetime)

    def test_service_health_minimal_creation(self):
        """Test ServiceHealth creation with minimal required fields."""
        health = ServiceHealth(status="passing")

        assert health.status == "passing"
        assert health.latency_ms is None
        assert health.cpu_usage is None
        assert health.memory_usage is None
        assert health.error_rate is None
        assert health.request_count is None
        assert health.details == {}
        assert isinstance(health.checked_at, datetime)

    def test_service_health_default_timestamp(self):
        """Test that checked_at is set automatically."""
        before = datetime.now(UTC)
        health = ServiceHealth(status="passing")
        after = datetime.now(UTC)

        assert before <= health.checked_at <= after
        assert health.checked_at.tzinfo == UTC

    def test_service_health_custom_timestamp(self):
        """Test ServiceHealth with custom timestamp."""
        custom_time = datetime(2023, 1, 1, 12, 0, 0, tzinfo=UTC)
        health = ServiceHealth(status="passing", checked_at=custom_time)

        assert health.checked_at == custom_time

    def test_service_health_details_factory(self):
        """Test that details field uses factory default."""
        health1 = ServiceHealth(status="passing")
        health2 = ServiceHealth(status="passing")

        # Should be separate instances
        assert health1.details is not health2.details
        health1.details["test"] = "value"
        assert "test" not in health2.details

    def test_service_health_validation(self):
        """Test ServiceHealth field validation."""
        # Valid creation should work
        health = ServiceHealth(
            status="passing",
            latency_ms=45.2,
            cpu_usage=0.35,
        )
        assert health.status == "passing"

        # Test that we can create with various status values
        health_critical = ServiceHealth(status="critical")
        assert health_critical.status == "critical"


class TestServiceInfo:
    """Test ServiceInfo model."""

    def test_service_info_creation(self):
        """Test ServiceInfo creation with all fields."""
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)
        health = ServiceHealth(status="passing")

        service = ServiceInfo(
            id="service-001",
            name="user-service",
            version="1.2.3",
            host="192.168.1.100",
            port=8080,
            tags=["api", "v1", "production"],
            metadata={"team": "backend", "environment": "prod"},
            health_check_url="/health",
            status=ServiceStatus.HEALTHY,
            health=health,
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
            weight=150,
            region="us-west-1",
            zone="us-west-1a",
        )

        assert service.id == "service-001"
        assert service.name == "user-service"
        assert service.version == "1.2.3"
        assert service.host == "192.168.1.100"
        assert service.port == 8080
        assert service.tags == ["api", "v1", "production"]
        assert service.metadata["team"] == "backend"
        assert service.metadata["environment"] == "prod"
        assert service.health_check_url == "/health"
        assert service.status == ServiceStatus.HEALTHY
        assert service.health == health
        assert service.registered_at == registered_time
        assert service.last_heartbeat == heartbeat_time
        assert service.weight == 150
        assert service.region == "us-west-1"
        assert service.zone == "us-west-1a"

    def test_service_info_minimal_creation(self):
        """Test ServiceInfo creation with minimal required fields."""
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        service = ServiceInfo(
            id="service-001",
            name="user-service",
            version="1.0.0",
            host="localhost",
            port=8080,
            health_check_url="/health",
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
        )

        assert service.id == "service-001"
        assert service.name == "user-service"
        assert service.version == "1.0.0"
        assert service.host == "localhost"
        assert service.port == 8080
        assert service.tags == []
        assert service.metadata == {}
        assert service.health_check_url == "/health"
        assert service.status == ServiceStatus.UNKNOWN
        assert service.health is None
        assert service.registered_at == registered_time
        assert service.last_heartbeat == heartbeat_time
        assert service.weight == 100
        assert service.region is None
        assert service.zone is None

    def test_service_info_default_values(self):
        """Test ServiceInfo default field values."""
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        service = ServiceInfo(
            id="service-001",
            name="user-service",
            version="1.0.0",
            host="localhost",
            port=8080,
            health_check_url="/health",
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
        )

        # Test default values
        assert service.status == ServiceStatus.UNKNOWN
        assert service.weight == 100
        assert service.tags == []
        assert service.metadata == {}

    def test_service_info_list_factories(self):
        """Test that list and dict fields use factory defaults."""
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        service1 = ServiceInfo(
            id="service-001",
            name="user-service",
            version="1.0.0",
            host="localhost",
            port=8080,
            health_check_url="/health",
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
        )

        service2 = ServiceInfo(
            id="service-002",
            name="user-service",
            version="1.0.0",
            host="localhost",
            port=8081,
            health_check_url="/health",
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
        )

        # Should be separate instances
        assert service1.tags is not service2.tags
        assert service1.metadata is not service2.metadata

        service1.tags.append("test")
        service1.metadata["test"] = "value"

        assert "test" not in service2.tags
        assert "test" not in service2.metadata

    def test_service_info_validation_errors(self):
        """Test ServiceInfo validation errors."""
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        # Test missing required field
        with pytest.raises(ValidationError) as exc_info:
            ServiceInfo(
                # Missing id
                name="user-service",
                version="1.0.0",
                host="localhost",
                port=8080,
                health_check_url="/health",
                registered_at=registered_time,
                last_heartbeat=heartbeat_time,
            )

        error = exc_info.value
        assert "id" in str(error)
        assert "Field required" in str(error)

    def test_service_info_with_complex_health(self):
        """Test ServiceInfo with complex health information."""
        health = ServiceHealth(
            status="passing",
            latency_ms=25.5,
            cpu_usage=0.45,
            memory_usage=0.78,
            error_rate=0.002,
            request_count=5000,
            details={
                "database": {"status": "connected", "latency": 12.3},
                "cache": {"status": "available", "hit_rate": 0.95},
                "external_api": {"status": "degraded", "timeout_rate": 0.05},
            },
        )

        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        service = ServiceInfo(
            id="service-001",
            name="complex-service",
            version="2.1.0",
            host="10.0.1.5",
            port=9090,
            tags=["microservice", "api", "monitoring"],
            metadata={
                "team": "platform",
                "environment": "staging",
                "deployed_by": "ci-cd",
                "build_number": "1234",
            },
            health_check_url="/actuator/health",
            status=ServiceStatus.DEGRADED,
            health=health,
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
            weight=75,
            region="eu-central-1",
            zone="eu-central-1b",
        )

        assert service.health.status == "passing"
        assert service.health.details["database"]["status"] == "connected"
        assert service.health.details["cache"]["hit_rate"] == 0.95
        assert service.status == ServiceStatus.DEGRADED
        assert service.weight == 75

    def test_service_info_json_serialization(self):
        """Test ServiceInfo JSON serialization/deserialization."""
        health = ServiceHealth(status="passing", latency_ms=30.0)
        registered_time = datetime.now(UTC)
        heartbeat_time = datetime.now(UTC)

        original = ServiceInfo(
            id="service-001",
            name="user-service",
            version="1.0.0",
            host="localhost",
            port=8080,
            tags=["api", "v1"],
            metadata={"environment": "test"},
            health_check_url="/health",
            status=ServiceStatus.HEALTHY,
            health=health,
            registered_at=registered_time,
            last_heartbeat=heartbeat_time,
            weight=120,
            region="us-east-1",
            zone="us-east-1a",
        )

        # Serialize to JSON
        json_data = original.model_dump()
        assert json_data["id"] == "service-001"
        assert json_data["status"] == "healthy"

        # Deserialize from JSON
        restored = ServiceInfo.model_validate(json_data)
        assert restored.id == original.id
        assert restored.name == original.name
        assert restored.status == original.status
        assert restored.health.status == original.health.status


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
