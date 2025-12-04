"""Tests for integration enums."""

import pytest

from dotmac.platform.integrations import (
    IntegrationStatus,
    IntegrationType,
)


@pytest.mark.unit
class TestIntegrationStatus:
    """Test IntegrationStatus enum."""

    def test_status_values(self):
        """Test all status values are defined."""
        assert IntegrationStatus.DISABLED == "disabled"
        assert IntegrationStatus.CONFIGURING == "configuring"
        assert IntegrationStatus.READY == "ready"
        assert IntegrationStatus.ERROR == "error"
        assert IntegrationStatus.DEPRECATED == "deprecated"

    def test_status_enum_iteration(self):
        """Test enum can be iterated."""
        statuses = list(IntegrationStatus)
        assert len(statuses) >= 5
        assert IntegrationStatus.READY in statuses


@pytest.mark.unit
class TestIntegrationType:
    """Test IntegrationType enum."""

    def test_type_values(self):
        """Test all integration types are defined."""
        assert IntegrationType.EMAIL == "email"
        assert IntegrationType.SMS == "sms"
        assert IntegrationType.STORAGE == "storage"
        assert IntegrationType.SEARCH == "search"
        assert IntegrationType.ANALYTICS == "analytics"
        assert IntegrationType.MONITORING == "monitoring"
        assert IntegrationType.SECRETS == "secrets"
        assert IntegrationType.CACHE == "cache"
        assert IntegrationType.QUEUE == "queue"

    def test_type_enum_iteration(self):
        """Test enum can be iterated."""
        types = list(IntegrationType)
        assert len(types) >= 9
        assert IntegrationType.EMAIL in types
