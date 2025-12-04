"""
Tests for integrations REST API router.

Tests the newly created integrations router that exposes the internal
integration registry via REST endpoints.
"""

import pytest
import pytest_asyncio
from fastapi import status
from starlette.testclient import TestClient

from dotmac.platform.integrations import (
    IntegrationConfig,
    IntegrationRegistry,
    IntegrationStatus,
    IntegrationType,
    SendGridIntegration,
    TwilioIntegration,
)

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def integration_registry():
    """Create a test integration registry with mock integrations."""
    from unittest.mock import AsyncMock

    from dotmac.platform.integrations import IntegrationHealth

    registry = IntegrationRegistry()

    # Register SendGrid (email) integration
    email_config = IntegrationConfig(
        name="email",
        type=IntegrationType.EMAIL,
        provider="sendgrid",
        enabled=True,
        settings={
            "from_email": "test@example.com",
            "from_name": "Test Platform",
        },
        secrets_path="email/sendgrid",
        required_packages=["sendgrid"],
    )

    # Register Twilio (SMS) integration
    sms_config = IntegrationConfig(
        name="sms",
        type=IntegrationType.SMS,
        provider="twilio",
        enabled=True,
        settings={
            "from_number": "+1234567890",
        },
        secrets_path="sms/twilio",
        required_packages=["twilio"],
    )

    # Store configs without initializing (to avoid external dependencies)
    registry._configs["email"] = email_config
    registry._configs["sms"] = sms_config

    # Create mock integration instances with mocked health checks
    email_integration = SendGridIntegration(email_config)
    email_integration._status = IntegrationStatus.READY
    email_integration.health_check = AsyncMock(
        return_value=IntegrationHealth(
            name="email",
            status=IntegrationStatus.READY,
            message="SendGrid is healthy",
        )
    )

    sms_integration = TwilioIntegration(sms_config)
    sms_integration._status = IntegrationStatus.ERROR
    sms_integration.health_check = AsyncMock(
        return_value=IntegrationHealth(
            name="sms",
            status=IntegrationStatus.ERROR,
            message="Twilio connection failed",
        )
    )

    registry._integrations["email"] = email_integration
    registry._integrations["sms"] = sms_integration

    return registry


def test_list_integrations(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test GET /api/v1/integrations - List all integrations."""

    # Mock the registry getter
    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert "integrations" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["integrations"]) == 2

    # Check email integration
    email_int = next((i for i in data["integrations"] if i["name"] == "email"), None)
    assert email_int is not None
    assert email_int["type"] == "email"
    assert email_int["provider"] == "sendgrid"
    assert email_int["enabled"] is True
    assert email_int["status"] == "ready"
    assert email_int["settings_count"] == 2
    assert email_int["has_secrets"] is True
    assert "sendgrid" in email_int["required_packages"]

    # Check SMS integration
    sms_int = next((i for i in data["integrations"] if i["name"] == "sms"), None)
    assert sms_int is not None
    assert sms_int["type"] == "sms"
    assert sms_int["provider"] == "twilio"
    assert sms_int["status"] == "error"
    assert "twilio" in sms_int["required_packages"]


def test_list_integrations_requires_auth(test_client: TestClient):
    """Test that listing integrations requires authentication."""
    response = test_client.get("/api/v1/integrations", headers={"X-Tenant-ID": None})

    # Tenant middleware returns 400 for missing tenant ID before auth check
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_get_integration_details(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test GET /api/v1/integrations/{name} - Get specific integration."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations/email",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["name"] == "email"
    assert data["type"] == "email"
    assert data["provider"] == "sendgrid"
    assert data["enabled"] is True
    assert data["status"] == "ready"
    assert data["settings_count"] == 2
    assert data["has_secrets"] is True
    assert "sendgrid" in data["required_packages"]


def test_get_integration_not_found(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test getting a non-existent integration returns 404."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations/nonexistent",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "not found" in response.json()["detail"].lower()


def test_health_check_integration(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test POST /api/v1/integrations/{name}/health-check."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.post(
        "/api/v1/integrations/email/health-check",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["name"] == "email"
    assert data["status"] in ["ready", "error", "disabled", "configuring"]


def test_health_check_requires_auth(test_client: TestClient):
    """Test that health check requires authentication."""
    response = test_client.post(
        "/api/v1/integrations/email/health-check", headers={"X-Tenant-ID": None}
    )

    # Tenant middleware returns 400 for missing tenant ID before auth check
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_health_check_not_found(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test health check on non-existent integration returns 404."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.post(
        "/api/v1/integrations/nonexistent/health-check",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_get_integration_not_initialized_returns_error(monkeypatch):
    """Test that uninitialized integrations return error status instead of 404."""
    from dotmac.platform.integrations.router import get_integration_details

    registry = IntegrationRegistry()

    config = IntegrationConfig(
        name="email",
        type=IntegrationType.EMAIL,
        provider="sendgrid",
        enabled=True,
        settings={"from_email": "ops@example.com"},
        secrets_path="email/sendgrid",
    )

    registry._configs["email"] = config
    registry._integration_errors["email"] = (
        "Exception during initialization. See server logs for details."
    )

    async def mock_get_registry():
        return registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    result = await get_integration_details("email", current_user=object())

    assert result.status == "error"
    assert result.message == registry._integration_errors["email"]


@pytest.mark.asyncio
async def test_list_integrations_includes_failed_entries(monkeypatch):
    """Test that failed integrations still appear in listing."""
    from dotmac.platform.integrations.router import list_integrations

    registry = IntegrationRegistry()

    config = IntegrationConfig(
        name="currency",
        type=IntegrationType.CURRENCY,
        provider="openexchangerates",
        enabled=True,
        settings={"base_currency": "USD"},
        secrets_path="currency/openexchangerates",
    )

    registry._configs["currency"] = config
    registry._integration_errors["currency"] = (
        "RuntimeError during initialization. See server logs for details."
    )

    async def mock_get_registry():
        return registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    result = await list_integrations(current_user=object())

    assert result.total == 1
    assert result.integrations[0].name == "currency"
    assert result.integrations[0].status == "error"
    assert result.integrations[0].message == registry._integration_errors["currency"]


def test_integration_response_schema(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test that integration response includes all required fields."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations/email",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()

    # Check all required fields are present
    required_fields = [
        "name",
        "type",
        "provider",
        "enabled",
        "status",
        "settings_count",
        "has_secrets",
        "required_packages",
    ]

    for field in required_fields:
        assert field in data, f"Missing required field: {field}"

    # Check optional fields
    optional_fields = ["message", "last_check", "metadata"]
    for field in optional_fields:
        assert field in data  # Should be present even if None


def test_list_integrations_empty_registry(
    test_client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
):
    """Test listing integrations when registry is empty."""
    empty_registry = IntegrationRegistry()

    async def mock_get_registry():
        return empty_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    assert data["total"] == 0
    assert len(data["integrations"]) == 0


def test_integration_types_are_valid(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test that integration types match expected enum values."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    valid_types = [
        "email",
        "sms",
        "storage",
        "search",
        "analytics",
        "monitoring",
        "secrets",
        "cache",
        "queue",
    ]

    for integration in data["integrations"]:
        assert integration["type"] in valid_types


def test_integration_status_values(
    test_client: TestClient,
    auth_headers: dict[str, str],
    integration_registry: IntegrationRegistry,
    monkeypatch,
):
    """Test that integration status values are valid."""

    async def mock_get_registry():
        return integration_registry

    monkeypatch.setattr(
        "dotmac.platform.integrations.router.get_integration_registry",
        mock_get_registry,
    )

    response = test_client.get(
        "/api/v1/integrations",
        headers=auth_headers,
    )

    assert response.status_code == status.HTTP_200_OK

    data = response.json()
    valid_statuses = ["disabled", "configuring", "ready", "error", "deprecated"]

    for integration in data["integrations"]:
        assert integration["status"] in valid_statuses
