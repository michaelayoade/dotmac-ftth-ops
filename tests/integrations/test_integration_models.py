"""Tests for integration models and dataclasses."""

import pytest

from dotmac.platform.integrations import (
    IntegrationConfig,
    IntegrationHealth,
    IntegrationStatus,
    IntegrationType,
)


@pytest.mark.unit
class TestIntegrationConfig:
    """Test IntegrationConfig dataclass."""

    def test_config_creation(self):
        """Test creating integration config."""
        config = IntegrationConfig(
            name="sendgrid",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={"api_version": "v3"},
        )

        assert config.name == "sendgrid"
        assert config.type == IntegrationType.EMAIL
        assert config.provider == "sendgrid"
        assert config.enabled is True
        assert config.settings["api_version"] == "v3"

    def test_config_with_secrets_path(self):
        """Test config with secrets path."""
        config = IntegrationConfig(
            name="sendgrid",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={},
            secrets_path="email/sendgrid",
        )

        assert config.secrets_path == "email/sendgrid"

    def test_config_with_required_packages(self):
        """Test config with required packages."""
        config = IntegrationConfig(
            name="sendgrid",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={},
            required_packages=["sendgrid", "python-dotenv"],
        )

        assert len(config.required_packages) == 2
        assert "sendgrid" in config.required_packages

    def test_config_default_health_check_interval(self):
        """Test default health check interval."""
        config = IntegrationConfig(
            name="test", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
        )

        assert config.health_check_interval == 300  # 5 minutes default


@pytest.mark.unit
class TestIntegrationHealth:
    """Test IntegrationHealth dataclass."""

    def test_health_creation(self):
        """Test creating health status."""
        health = IntegrationHealth(
            name="sendgrid", status=IntegrationStatus.READY, message="Healthy"
        )

        assert health.name == "sendgrid"
        assert health.status == IntegrationStatus.READY
        assert health.message == "Healthy"

    def test_health_with_metadata(self):
        """Test health with metadata."""
        health = IntegrationHealth(
            name="redis",
            status=IntegrationStatus.READY,
            metadata={"connections": 10, "memory_used": "1.5MB"},
        )

        assert health.metadata["connections"] == 10
        assert health.metadata["memory_used"] == "1.5MB"

    def test_health_error_status(self):
        """Test health with error status."""
        health = IntegrationHealth(
            name="postgres",
            status=IntegrationStatus.ERROR,
            message="Connection timeout",
            metadata={"error_code": "TIMEOUT"},
        )

        assert health.status == IntegrationStatus.ERROR
        assert "timeout" in health.message.lower()
