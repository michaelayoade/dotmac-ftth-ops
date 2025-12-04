"""
Tests for Licensing Router

Tests HTTP endpoints, request validation, response formatting, and error handling
for the licensing API.
"""

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

from dotmac.platform.version import get_version

pytestmark = pytest.mark.integration

CURRENT_VERSION = get_version()


class MockObject:
    """Helper to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def sample_license_dict() -> dict[str, Any]:
    """Sample license for testing."""
    return {
        "id": str(uuid4()),
        "tenant_id": "test-tenant",
        "license_key": "LIC-2025-001-ABCD",
        "customer_id": str(uuid4()),
        "product_id": str(uuid4()),
        "product_name": "Test Product",
        "product_version": CURRENT_VERSION,
        "license_type": "PERPETUAL",
        "license_model": "PER_SEAT",
        "issued_to": "Test Customer",
        "max_activations": 10,
        "current_activations": 5,
        "status": "ACTIVE",
        "issued_date": datetime.utcnow().isoformat(),
        "activation_date": datetime.utcnow().isoformat(),
        "expiry_date": (datetime.utcnow() + timedelta(days=365)).isoformat(),
        "features": [],
        "restrictions": [],
        "auto_renewal": False,
        "grace_period_days": 30,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "metadata": {},
    }


@pytest.fixture
def sample_activation_dict() -> dict[str, Any]:
    """Sample activation for testing."""
    return {
        "id": str(uuid4()),
        "tenant_id": "test-tenant",
        "license_id": str(uuid4()),
        "activation_token": "ACT-2025-001-TOKEN",
        "device_fingerprint": "fp-abc123",
        "machine_name": "test-machine",
        "hardware_id": "hw-123",
        "mac_address": "00:11:22:33:44:55",
        "ip_address": "192.168.1.100",
        "operating_system": "Linux",
        "user_agent": "TestAgent/1.0",
        "application_version": CURRENT_VERSION,
        "activation_type": "ONLINE",
        "location": None,
        "status": "ACTIVE",
        "activated_at": datetime.utcnow().isoformat(),
        "last_heartbeat": datetime.utcnow().isoformat(),
        "deactivated_at": None,
        "deactivation_reason": None,
        "usage_metrics": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest.fixture
def sample_template_dict() -> dict[str, Any]:
    """Sample license template for testing."""
    return {
        "id": str(uuid4()),
        "tenant_id": "test-tenant",
        "template_name": "Standard License",
        "product_id": str(uuid4()),
        "description": "Standard product license",
        "license_type": "SUBSCRIPTION",
        "license_model": "PER_SEAT",
        "default_duration": 365,
        "max_activations": 5,
        "features": [],
        "restrictions": [],
        "pricing": {"base_price": 100.0, "currency": "USD", "billing_cycle": "MONTHLY"},
        "auto_renewal_enabled": True,
        "trial_allowed": False,
        "trial_duration_days": 30,
        "active": True,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest.fixture
def sample_order_dict() -> dict[str, Any]:
    """Sample license order for testing."""
    return {
        "id": str(uuid4()),
        "order_number": "ORD-LIC-2025-001",
        "template_id": str(uuid4()),
        "quantity": 10,
        "customer_id": str(uuid4()),
        "reseller_id": None,
        "custom_features": None,
        "custom_restrictions": None,
        "duration_override": None,
        "pricing_override": None,
        "special_instructions": None,
        "fulfillment_method": "AUTO",
        "status": "PENDING",
        "total_amount": 1000.00,
        "discount_applied": None,
        "payment_status": "PENDING",
        "invoice_id": None,
        "subscription_id": None,
        "generated_licenses": None,
        "fulfilled_at": None,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest_asyncio.fixture
async def async_client(monkeypatch):
    """Async HTTP client with licensing router and mocked dependencies."""
    import dotmac.platform.auth.rbac_dependencies
    from dotmac.platform.auth.core import UserInfo, get_current_user
    from dotmac.platform.db import get_async_session

    # Create mock user
    mock_user = UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        tenant_id="test-tenant",
        roles=["admin"],
        permissions=[
            "licensing.read",
            "licensing.write",
            "licensing.admin",
        ],
        is_platform_admin=False,
    )

    # Mock RBAC service to prevent database access
    from dotmac.platform.auth.rbac_service import RBACService

    mock_rbac_service = MagicMock(spec=RBACService)
    mock_rbac_service.user_has_all_permissions = AsyncMock(return_value=True)
    mock_rbac_service.user_has_any_permission = AsyncMock(return_value=True)
    mock_rbac_service.get_user_permissions = AsyncMock(return_value=set())
    mock_rbac_service.get_user_roles = AsyncMock(return_value=[])

    # Monkeypatch RBACService class
    monkeypatch.setattr(
        dotmac.platform.auth.rbac_dependencies, "RBACService", lambda db: mock_rbac_service
    )

    # Mock async session
    mock_session = AsyncMock()
    mock_session.commit = AsyncMock()
    mock_session.flush = AsyncMock()
    mock_session.refresh = AsyncMock()
    mock_session.add = MagicMock()
    mock_session.delete = MagicMock()

    # Mock execute() to return proper result chain
    mock_result = MagicMock()
    mock_scalars = MagicMock()
    mock_scalars.all = MagicMock(return_value=[])
    mock_scalars.first = MagicMock(return_value=None)
    mock_result.scalars = MagicMock(return_value=mock_scalars)
    mock_result.scalar_one_or_none = MagicMock(return_value=None)
    mock_session.execute = AsyncMock(return_value=mock_result)

    # Mock LicensingService
    from dotmac.platform.licensing.service import LicensingService

    mock_licensing_service = LicensingService(
        session=mock_session,
        tenant_id="test-tenant",
        user_id=str(uuid4()),
    )

    # Mock all service methods
    mock_licensing_service.get_license = AsyncMock(return_value=None)
    mock_licensing_service.get_license_by_key = AsyncMock(return_value=None)
    mock_licensing_service.create_license = AsyncMock()
    mock_licensing_service.update_license = AsyncMock()
    mock_licensing_service.renew_license = AsyncMock()
    mock_licensing_service.suspend_license = AsyncMock()
    mock_licensing_service.revoke_license = AsyncMock()
    mock_licensing_service.transfer_license = AsyncMock()

    mock_licensing_service.activate_license = AsyncMock()
    mock_licensing_service.get_activation = AsyncMock(return_value=None)
    mock_licensing_service.validate_activation = AsyncMock()
    mock_licensing_service.deactivate_license = AsyncMock()
    mock_licensing_service.update_heartbeat = AsyncMock()
    mock_licensing_service.generate_offline_activation_request = AsyncMock()
    mock_licensing_service.process_offline_activation = AsyncMock()

    mock_licensing_service.get_template = AsyncMock(return_value=None)
    mock_licensing_service.get_order = AsyncMock(return_value=None)

    mock_licensing_service.validate_license_key = AsyncMock()
    mock_licensing_service.integrity_check = AsyncMock()
    mock_licensing_service.generate_emergency_code = AsyncMock()
    mock_licensing_service.blacklist_device = AsyncMock()
    mock_licensing_service.report_suspicious_activity = AsyncMock()

    # Import router after mocking
    from dotmac.platform.licensing.router import get_licensing_service
    from dotmac.platform.licensing.router import router as licensing_router

    app = FastAPI()

    # Override dependencies
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_async_session] = lambda: mock_session
    app.dependency_overrides[get_licensing_service] = lambda: mock_licensing_service

    # Include router
    app.include_router(licensing_router)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Store mocks on client for tests to access
        client.mock_licensing_service = mock_licensing_service  # type: ignore
        client.mock_session = mock_session  # type: ignore
        yield client


class TestLicenseManagement:
    """Test license management endpoints."""

    @pytest.mark.asyncio
    async def test_get_licenses_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test getting list of licenses."""
        # Arrange
        license1 = MockObject(**sample_license_dict)
        license2_data = {
            **sample_license_dict,
            "id": str(uuid4()),
            "license_key": "LIC-2025-002-ABCD",
        }
        license2 = MockObject(**license2_data)

        # Mock the session execute to return licenses
        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all = MagicMock(return_value=[license1, license2])
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        async_client.mock_session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get("/api/licensing/licenses")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert "total" in data
        assert len(data["data"]) == 2
        assert data["data"][0]["license_key"] == "LIC-2025-001-ABCD"

    @pytest.mark.asyncio
    async def test_get_license_by_id_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test getting license by ID."""
        # Arrange
        license_obj = MockObject(**sample_license_dict)
        async_client.mock_licensing_service.get_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.get(f"/api/licensing/licenses/{sample_license_dict['id']}")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["license_key"] == "LIC-2025-001-ABCD"

    @pytest.mark.asyncio
    async def test_get_license_not_found(self, async_client: AsyncClient):
        """Test getting non-existent license."""
        # Arrange
        async_client.mock_licensing_service.get_license.return_value = None  # type: ignore

        # Act
        response = await async_client.get(f"/api/licensing/licenses/{uuid4()}")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_license_by_key_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test getting license by key."""
        # Arrange
        license_obj = MockObject(**sample_license_dict)
        async_client.mock_licensing_service.get_license_by_key.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.get(
            f"/api/licensing/licenses/by-key/{sample_license_dict['license_key']}"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["license_key"] == sample_license_dict["license_key"]

    @pytest.mark.asyncio
    async def test_create_license_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test creating new license."""
        # Arrange
        license_obj = MockObject(**sample_license_dict)
        async_client.mock_licensing_service.create_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/licenses",
            json={
                "customer_id": sample_license_dict["customer_id"],
                "product_id": sample_license_dict["product_id"],
                "product_name": "Test Product",
                "product_version": CURRENT_VERSION,
                "license_type": "PERPETUAL",
                "license_model": "PER_SEAT",
                "issued_to": "Test Customer",
                "max_activations": 10,
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "data" in data
        assert data["data"]["status"] == "ACTIVE"

    @pytest.mark.asyncio
    async def test_update_license_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test updating license."""
        # Arrange
        updated_dict = {**sample_license_dict, "max_activations": 20}
        license_obj = MockObject(**updated_dict)
        async_client.mock_licensing_service.update_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.put(
            f"/api/licensing/licenses/{sample_license_dict['id']}", json={"max_activations": 20}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["max_activations"] == 20

    @pytest.mark.asyncio
    async def test_renew_license_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test renewing license."""
        # Arrange
        renewed_dict = {
            **sample_license_dict,
            "expiry_date": (datetime.utcnow() + timedelta(days=730)).isoformat(),
        }
        license_obj = MockObject(**renewed_dict)
        async_client.mock_licensing_service.renew_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/licenses/{sample_license_dict['id']}/renew",
            json={"duration_months": 12},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_suspend_license_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test suspending license."""
        # Arrange
        suspended_dict = {**sample_license_dict, "status": "SUSPENDED"}
        license_obj = MockObject(**suspended_dict)
        async_client.mock_licensing_service.suspend_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/licenses/{sample_license_dict['id']}/suspend",
            json={"reason": "Temporary suspension"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["status"] == "SUSPENDED"

    @pytest.mark.asyncio
    async def test_revoke_license_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test revoking license."""
        # Arrange
        revoked_dict = {**sample_license_dict, "status": "REVOKED"}
        license_obj = MockObject(**revoked_dict)
        async_client.mock_licensing_service.revoke_license.return_value = license_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/licenses/{sample_license_dict['id']}/revoke",
            json={"reason": "License violation"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["status"] == "REVOKED"


class TestActivationManagement:
    """Test activation management endpoints."""

    @pytest.mark.asyncio
    async def test_create_activation_success(
        self, async_client: AsyncClient, sample_activation_dict: dict[str, Any]
    ):
        """Test creating new activation."""
        # Arrange
        activation_obj = MockObject(**sample_activation_dict)
        async_client.mock_licensing_service.activate_license.return_value = activation_obj  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/activations",
            json={
                "license_key": "LIC-2025-001-ABCD",
                "device_fingerprint": "fp-abc123",
                "application_version": CURRENT_VERSION,
                "activation_type": "ONLINE",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_get_activations_success(
        self, async_client: AsyncClient, sample_activation_dict: dict[str, Any]
    ):
        """Test getting list of activations."""
        # Arrange
        activation1 = MockObject(**sample_activation_dict)
        activation2_data = {**sample_activation_dict, "id": str(uuid4()), "device_id": "device-456"}
        activation2 = MockObject(**activation2_data)

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all = MagicMock(return_value=[activation1, activation2])
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        async_client.mock_session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get("/api/licensing/activations")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 2

    @pytest.mark.asyncio
    async def test_get_activation_by_id_success(
        self, async_client: AsyncClient, sample_activation_dict: dict[str, Any]
    ):
        """Test getting activation by ID."""
        # Arrange
        activation_obj = MockObject(**sample_activation_dict)
        # Mock session.execute to return activation
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=activation_obj)
        async_client.mock_licensing_service.session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get(
            f"/api/licensing/activations/{sample_activation_dict['id']}"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_validate_activation_success(
        self,
        async_client: AsyncClient,
        sample_activation_dict: dict[str, Any],
        sample_license_dict: dict[str, Any],
    ):
        """Test validating activation."""
        # Arrange
        activation_obj = MockObject(**sample_activation_dict)
        license_obj = MockObject(**sample_license_dict)
        # Service returns tuple: (valid, activation, license)
        async_client.mock_licensing_service.validate_activation.return_value = (
            True,
            activation_obj,
            license_obj,
        )  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/activations/validate", json={"activation_token": "ACT-2025-001-TOKEN"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["valid"] is True

    @pytest.mark.asyncio
    async def test_deactivate_success(
        self, async_client: AsyncClient, sample_activation_dict: dict[str, Any]
    ):
        """Test deactivating activation."""
        # Arrange
        deactivated_dict = {**sample_activation_dict, "status": "DEACTIVATED"}
        activation_obj = MockObject(**deactivated_dict)
        async_client.mock_licensing_service.deactivate_license.return_value = activation_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/activations/{sample_activation_dict['id']}/deactivate",
            json={"reason": "Testing deactivation"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_heartbeat_success(self, async_client: AsyncClient):
        """Test activation heartbeat."""
        # Arrange
        heartbeat_result = {"status": "ok", "next_check": "3600"}
        async_client.mock_licensing_service.update_heartbeat.return_value = heartbeat_result  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/activations/heartbeat", json={"activation_token": "ACT-2025-001-TOKEN"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_offline_activation_request_success(
        self, async_client: AsyncClient, sample_license_dict: dict[str, Any]
    ):
        """Test offline activation request."""
        # Arrange
        license_obj = MockObject(**sample_license_dict)
        async_client.mock_licensing_service.get_license_by_key.return_value = license_obj  # type: ignore

        offline_response = {
            "request_code": "REQUEST-123",
            "instructions": "Contact support with this request code",
        }
        async_client.mock_licensing_service.generate_offline_activation_request.return_value = (
            offline_response  # type: ignore
        )

        # Act
        response = await async_client.post(
            "/api/licensing/activations/offline-request",
            json={"license_key": "LIC-2025-001-ABCD", "device_fingerprint": "fp-abc123"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_offline_activation_process_success(
        self, async_client: AsyncClient, sample_activation_dict: dict[str, Any]
    ):
        """Test processing offline activation."""
        # Arrange
        activation_obj = MockObject(**sample_activation_dict)
        async_client.mock_licensing_service.process_offline_activation.return_value = activation_obj  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/activations/offline-activate",
            json={"request_code": "REQUEST-123", "response_code": "RESPONSE-456"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data


class TestTemplateManagement:
    """Test license template management endpoints."""

    @pytest.mark.asyncio
    async def test_get_templates_success(
        self, async_client: AsyncClient, sample_template_dict: dict[str, Any]
    ):
        """Test getting list of templates."""
        # Arrange
        template1 = MockObject(**sample_template_dict)
        template2_data = {**sample_template_dict, "id": str(uuid4()), "name": "Premium License"}
        template2 = MockObject(**template2_data)

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all = MagicMock(return_value=[template1, template2])
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        async_client.mock_session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get("/api/licensing/templates")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 2

    @pytest.mark.asyncio
    async def test_get_template_by_id_success(
        self, async_client: AsyncClient, sample_template_dict: dict[str, Any]
    ):
        """Test getting template by ID."""
        # Arrange
        template_obj = MockObject(**sample_template_dict)
        # Mock session.execute to return template
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=template_obj)
        async_client.mock_licensing_service.session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get(f"/api/licensing/templates/{sample_template_dict['id']}")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert data["data"]["template_name"] == "Standard License"

    @pytest.mark.asyncio
    async def test_create_template_success(
        self, async_client: AsyncClient, sample_template_dict: dict[str, Any]
    ):
        """Test creating new template."""
        # Arrange
        MockObject(**sample_template_dict)

        # Act
        response = await async_client.post(
            "/api/licensing/templates",
            json={
                "template_name": "Standard License",
                "product_id": str(uuid4()),
                "description": "Standard product license",
                "license_type": "SUBSCRIPTION",
                "license_model": "PER_SEAT",
                "default_duration": 365,
                "max_activations": 5,
                "features": [],
                "restrictions": [],
                "pricing": {"base_price": 100.0, "currency": "USD", "billing_cycle": "MONTHLY"},
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_update_template_success(
        self, async_client: AsyncClient, sample_template_dict: dict[str, Any]
    ):
        """Test updating template."""
        # Arrange
        updated_dict = {**sample_template_dict, "default_seats": 10}
        template_obj = MockObject(**updated_dict)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=template_obj)
        async_client.mock_licensing_service.session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.put(
            f"/api/licensing/templates/{sample_template_dict['id']}", json={"default_seats": 10}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data


class TestOrderManagement:
    """Test license order management endpoints."""

    @pytest.mark.asyncio
    async def test_get_orders_success(
        self, async_client: AsyncClient, sample_order_dict: dict[str, Any]
    ):
        """Test getting list of orders."""
        # Arrange
        order1 = MockObject(**sample_order_dict)
        order2_data = {**sample_order_dict, "id": str(uuid4()), "order_number": "ORD-LIC-2025-002"}
        order2 = MockObject(**order2_data)

        mock_result = MagicMock()
        mock_scalars = MagicMock()
        mock_scalars.all = MagicMock(return_value=[order1, order2])
        mock_result.scalars = MagicMock(return_value=mock_scalars)
        async_client.mock_session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get("/api/licensing/orders")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
        assert len(data["data"]) == 2

    @pytest.mark.asyncio
    async def test_get_order_by_id_success(
        self, async_client: AsyncClient, sample_order_dict: dict[str, Any]
    ):
        """Test getting order by ID."""
        # Arrange
        order_obj = MockObject(**sample_order_dict)
        # Mock session.execute to return order
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=order_obj)
        async_client.mock_licensing_service.session.execute = AsyncMock(return_value=mock_result)  # type: ignore

        # Act
        response = await async_client.get(f"/api/licensing/orders/{sample_order_dict['id']}")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_create_order_success(
        self,
        async_client: AsyncClient,
        sample_order_dict: dict[str, Any],
        sample_template_dict: dict[str, Any],
    ):
        """Test creating new order."""
        # Arrange
        MockObject(**sample_order_dict)
        template_obj = MockObject(**sample_template_dict)

        # Mock session.execute to return template when queried
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=template_obj)
        async_client.mock_licensing_service.session.execute = AsyncMock(return_value=mock_result)  # type: ignore
        async_client.mock_licensing_service.get_template.return_value = template_obj  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/orders",
            json={"template_id": sample_order_dict["template_id"], "quantity": 10},
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_approve_order_success(
        self, async_client: AsyncClient, sample_order_dict: dict[str, Any]
    ):
        """Test approving order."""
        # Arrange
        approved_dict = {**sample_order_dict, "status": "approved"}
        order_obj = MockObject(**approved_dict)
        async_client.mock_licensing_service.get_order.return_value = order_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/orders/{sample_order_dict['id']}/approve",
            json={"approved_by": "admin-user"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_fulfill_order_success(
        self, async_client: AsyncClient, sample_order_dict: dict[str, Any]
    ):
        """Test fulfilling order."""
        # Arrange
        fulfilled_dict = {**sample_order_dict, "status": "fulfilled"}
        order_obj = MockObject(**fulfilled_dict)
        async_client.mock_licensing_service.get_order.return_value = order_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/orders/{sample_order_dict['id']}/fulfill"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_cancel_order_success(
        self, async_client: AsyncClient, sample_order_dict: dict[str, Any]
    ):
        """Test cancelling order."""
        # Arrange
        cancelled_dict = {**sample_order_dict, "status": "cancelled"}
        order_obj = MockObject(**cancelled_dict)
        async_client.mock_licensing_service.get_order.return_value = order_obj  # type: ignore

        # Act
        response = await async_client.post(
            f"/api/licensing/orders/{sample_order_dict['id']}/cancel",
            json={"reason": "Customer request"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data


class TestSecurityValidation:
    """Test security and validation endpoints."""

    @pytest.mark.asyncio
    async def test_validate_license_key_success(self, async_client: AsyncClient):
        """Test license key validation."""
        # Arrange
        validation_result = {"valid": True, "license_info": {"status": "ACTIVE"}}
        async_client.mock_licensing_service.validate_license_key.return_value = validation_result  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/validate", json={"license_key": "LIC-2025-001-ABCD"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_integrity_check_success(self, async_client: AsyncClient):
        """Test integrity check."""
        # Arrange
        check_result = {"valid": True, "checksum": "abc123"}
        async_client.mock_licensing_service.integrity_check.return_value = check_result  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/integrity-check",
            json={"license_key": "LIC-2025-001-ABCD", "checksum": "abc123"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_emergency_code_success(self, async_client: AsyncClient):
        """Test emergency code generation."""
        # Arrange
        emergency_result = {"code": "EMERGENCY-123", "valid_until": datetime.utcnow().isoformat()}
        async_client.mock_licensing_service.generate_emergency_code.return_value = emergency_result  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/emergency-code",
            json={"license_key": "LIC-2025-001-ABCD", "reason": "System failure"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_blacklist_device_success(self, async_client: AsyncClient):
        """Test device blacklisting."""
        # Arrange
        blacklist_result = {"success": True}
        async_client.mock_licensing_service.blacklist_device.return_value = blacklist_result  # type: ignore

        # Act
        response = await async_client.post(
            "/api/licensing/security/blacklist-device",
            json={"device_fingerprint": "fp-device-123", "reason": "Suspected fraud"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data

    @pytest.mark.asyncio
    async def test_report_suspicious_activity_success(self, async_client: AsyncClient):
        """Test reporting suspicious activity."""
        # Arrange
        # Note: endpoint doesn't use service method, it handles directly
        # Just ensure the endpoint processes the request correctly

        # Act
        response = await async_client.post(
            "/api/licensing/security/report-activity",
            json={
                "license_key": "LIC-2025-001-ABCD",
                "activity_type": "MULTIPLE_ACTIVATIONS",
                "description": "Exceeded max activations",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "data" in data
