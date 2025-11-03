"""
Tests for Customer Management Router

Tests HTTP endpoints, request validation, response formatting, and error handling
for the customer management API.
"""

from datetime import datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI, status
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.integration


class MockObject:
    """Helper to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def sample_customer_dict() -> dict[str, Any]:
    """Sample customer for testing."""
    customer_id = str(uuid4())
    return {
        "id": customer_id,
        "customer_number": "CUST-2025-001",
        "tenant_id": "1",
        "first_name": "John",
        "last_name": "Doe",
        "display_name": "John Doe",
        "email": "john.doe@example.com",
        "phone": "+1-555-0100",
        "customer_type": "individual",
        "tier": "standard",
        "status": "active",
        "city": "San Francisco",
        "state_province": "CA",
        "country": "US",
        "preferred_channel": "email",
        "preferred_language": "en",
        "timezone": "timezone.utc",
        "opt_in_marketing": False,
        "opt_in_updates": True,
        "email_verified": True,
        "phone_verified": False,
        "lifetime_value": "1000.00",
        "average_order_value": "200.00",
        "total_purchases": 5,
        "risk_score": 50,
        "acquisition_date": datetime.utcnow().isoformat(),
        "tags": [],
        "metadata_": {},
        "custom_fields": {},
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }


@pytest_asyncio.fixture
async def async_client(monkeypatch):
    """Async HTTP client with customer management router."""
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.customer_management.router import get_customer_service
    from dotmac.platform.customer_management.router import router as customer_router
    from dotmac.platform.db import get_session_dependency

    # Create mocks fresh for each test
    mock_service = MagicMock()
    mock_service.create_customer = AsyncMock()
    mock_service.get_customer = AsyncMock()
    mock_service.get_customer_by_email = AsyncMock(return_value=None)
    mock_service.get_customer_by_number = AsyncMock()
    mock_service.update_customer = AsyncMock()
    mock_service.delete_customer = AsyncMock(return_value=True)
    mock_service.search_customers = AsyncMock(return_value=([], 0))
    mock_service.add_activity = AsyncMock()
    mock_service.get_customer_activities = AsyncMock(return_value=[])
    mock_service.add_note = AsyncMock()
    mock_service.get_customer_notes = AsyncMock(return_value=[])
    mock_service.update_metrics = AsyncMock()
    mock_service.get_customer_metrics = AsyncMock()
    mock_service.create_segment = AsyncMock()
    mock_service.recalculate_segment = AsyncMock(return_value=100)
    mock_service.session = MagicMock()

    mock_user = UserInfo(
        user_id=str(uuid4()),
        username="testuser",
        email="test@example.com",
        tenant_id="1",
        roles=["admin"],
        permissions=[
            "customer.read",
            "customer.create",
            "customer.update",
            "customer.delete",
        ],
        is_platform_admin=False,
    )

    # Mock JWT service
    mock_jwt = MagicMock()
    mock_jwt.create_access_token = MagicMock(return_value="mock_token")
    import dotmac.platform.auth.core

    monkeypatch.setattr(dotmac.platform.auth.core, "jwt_service", mock_jwt)

    # Mock audit logging
    async def mock_log(*args, **kwargs):
        pass

    import dotmac.platform.audit

    monkeypatch.setattr(dotmac.platform.audit, "log_user_activity", mock_log)

    # Mock email service
    mock_email = MagicMock()
    mock_email.send_password_reset_email = AsyncMock(return_value=("sent", "token"))

    def get_email():
        return mock_email

    import dotmac.platform.auth.email_service

    monkeypatch.setattr(dotmac.platform.auth.email_service, "get_auth_email_service", get_email)

    app = FastAPI()

    # Override core dependencies
    app.dependency_overrides[get_customer_service] = lambda: mock_service
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_session_dependency] = lambda: MagicMock()

    # Override RBAC dependencies to avoid model imports
    from dotmac.platform.auth.rbac_dependencies import (
        require_customer_impersonate,
        require_customer_manage_status,
        require_customer_reset_password,
    )

    app.dependency_overrides[require_customer_impersonate] = lambda: mock_user
    app.dependency_overrides[require_customer_manage_status] = lambda: mock_user
    app.dependency_overrides[require_customer_reset_password] = lambda: mock_user

    app.include_router(customer_router, prefix="/api/v1/customers")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Store mock service on client for tests to access
        client.mock_service = mock_service  # type: ignore
        yield client


class TestCustomerCRUD:
    """Test customer CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_customer_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test successful customer creation."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.create_customer.return_value = customer_obj  # type: ignore

        # Act
        response = await async_client.post(
            "/api/v1/customers/",
            json={
                "first_name": "John",
                "last_name": "Doe",
                "email": "john.doe@example.com",
                "phone": "+1-555-0100",
                "customer_type": "individual",
                "tier": "standard",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
        assert data["email"] == "john.doe@example.com"

    @pytest.mark.asyncio
    async def test_get_customer_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test get customer by ID."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.get_customer.return_value = customer_obj

        # Act
        response = await async_client.get(f"/api/v1/customers/{sample_customer_dict['id']}")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_customer_dict["id"]
        assert data["email"] == "john.doe@example.com"

    @pytest.mark.asyncio
    async def test_get_customer_not_found(
        self,
        async_client: AsyncClient,
    ):
        """Test get non-existent customer."""
        # Arrange
        async_client.mock_service.get_customer.return_value = None

        # Act
        response = await async_client.get(f"/api/v1/customers/{uuid4()}")

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_get_customer_by_number_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test get customer by customer number."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.get_customer_by_number.return_value = customer_obj

        # Act
        response = await async_client.get("/api/v1/customers/by-number/CUST-2025-001")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["customer_number"] == "CUST-2025-001"

    @pytest.mark.asyncio
    async def test_update_customer_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test customer update."""
        # Arrange
        updated_data = {**sample_customer_dict, "phone": "+1-555-9999"}
        customer_obj = MockObject(**updated_data)
        async_client.mock_service.update_customer.return_value = customer_obj

        # Act
        response = await async_client.patch(
            f"/api/v1/customers/{sample_customer_dict['id']}", json={"phone": "+1-555-9999"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["phone"] == "+1-555-9999"

    @pytest.mark.asyncio
    async def test_delete_customer_success(
        self,
        async_client: AsyncClient,
    ):
        """Test customer deletion."""
        # Arrange
        customer_id = str(uuid4())
        async_client.mock_service.delete_customer.return_value = True

        # Act
        response = await async_client.delete(f"/api/v1/customers/{customer_id}")

        # Assert
        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestCustomerSearch:
    """Test customer search endpoint."""

    @pytest.mark.asyncio
    async def test_search_customers_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test customer search."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.search_customers.return_value = ([customer_obj], 1)

        # Act
        response = await async_client.post(
            "/api/v1/customers/search", json={"status": "active", "page": 1, "page_size": 10}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 1
        assert len(data["customers"]) == 1


class TestCustomerActivities:
    """Test customer activity endpoints."""

    @pytest.mark.asyncio
    async def test_add_customer_activity_success(
        self,
        async_client: AsyncClient,
    ):
        """Test adding customer activity."""
        # Arrange
        customer_id = uuid4()
        activity_id = uuid4()
        activity = MockObject(
            id=activity_id,
            customer_id=customer_id,
            activity_type="purchase",
            title="Premium Plan Purchase",
            description="Purchased Premium Plan",
            metadata={},
            created_at=datetime.utcnow(),
        )
        async_client.mock_service.add_activity.return_value = activity

        # Act
        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/activities",
            json={
                "activity_type": "purchase",
                "title": "Premium Plan Purchase",
                "description": "Purchased Premium Plan",
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["activity_type"] == "purchase"

    @pytest.mark.asyncio
    async def test_get_customer_activities_success(
        self,
        async_client: AsyncClient,
    ):
        """Test get customer activities."""
        # Arrange
        customer_id = uuid4()
        activities = [
            MockObject(
                id=uuid4(),
                customer_id=customer_id,
                activity_type="purchase",
                title="Activity 1",
                description="Activity 1 description",
                metadata={},
                created_at=datetime.utcnow(),
            )
        ]
        async_client.mock_service.get_customer_activities.return_value = activities

        # Act
        response = await async_client.get(f"/api/v1/customers/{customer_id}/activities")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1


class TestCustomerNotes:
    """Test customer notes endpoints."""

    @pytest.mark.asyncio
    async def test_add_customer_note_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test adding customer note."""
        # Arrange
        customer_id = uuid4()
        customer_obj = MockObject(**{**sample_customer_dict, "id": customer_id})
        note_id = uuid4()
        note = MockObject(
            id=note_id,
            customer_id=customer_id,
            subject="Important Note",
            content="Important note content",
            is_internal=True,
            created_by_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        # Mock customer lookup first
        async_client.mock_service.get_customer.return_value = customer_obj
        async_client.mock_service.add_note.return_value = note

        # Act
        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/notes",
            json={
                "subject": "Important Note",
                "content": "Important note content",
                "is_internal": True,
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["content"] == "Important note content"

    @pytest.mark.asyncio
    async def test_get_customer_notes_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test get customer notes."""
        # Arrange
        customer_id = uuid4()
        customer_obj = MockObject(**{**sample_customer_dict, "id": customer_id})
        notes = [
            MockObject(
                id=uuid4(),
                customer_id=customer_id,
                subject="Note 1",
                content="Note 1 content",
                is_internal=False,
                created_by_id=None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
        ]
        # Mock customer lookup first
        async_client.mock_service.get_customer.return_value = customer_obj
        async_client.mock_service.get_customer_notes.return_value = notes

        # Act
        response = await async_client.get(f"/api/v1/customers/{customer_id}/notes")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1


class TestCustomerMetrics:
    """Test customer metrics endpoints."""

    @pytest.mark.asyncio
    async def test_record_purchase_success(
        self,
        async_client: AsyncClient,
    ):
        """Test recording customer purchase."""
        # Arrange
        customer_id = str(uuid4())
        async_client.mock_service.update_metrics.return_value = None

        # Act
        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/metrics/purchase?amount=99.99"
        )

        # Assert
        assert response.status_code == status.HTTP_204_NO_CONTENT

    @pytest.mark.asyncio
    async def test_get_customer_metrics_success(
        self,
        async_client: AsyncClient,
    ):
        """Test get customer metrics overview."""
        # Arrange
        metrics = {
            "total_customers": 1000,
            "active_customers": 800,
            "churn_rate": 2.5,
            "average_lifetime_value": 3500.00,
            "total_revenue": 3500000.00,
            "customers_by_status": {"active": 800},
            "customers_by_tier": {"standard": 600},
            "customers_by_type": {"individual": 900},
            "top_segments": [],
        }
        async_client.mock_service.get_customer_metrics.return_value = metrics

        # Act
        response = await async_client.get("/api/v1/customers/metrics/overview")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_customers"] == 1000


class TestCustomerSegments:
    """Test customer segment endpoints."""

    @pytest.mark.asyncio
    async def test_create_segment_success(
        self,
        async_client: AsyncClient,
    ):
        """Test creating customer segment."""
        # Arrange
        segment_id = str(uuid4())
        segment = MockObject(
            id=segment_id,
            name="High Value",
            description="High value customers",
            criteria={"ltv__gte": 5000},
            is_dynamic=True,
            priority=10,
            member_count=100,
            last_calculated=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        async_client.mock_service.create_segment.return_value = segment

        # Act
        response = await async_client.post(
            "/api/v1/customers/segments",
            json={
                "name": "High Value",
                "description": "High value customers",
                "criteria": {"ltv__gte": 5000},
                "is_dynamic": True,
            },
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "High Value"

    @pytest.mark.asyncio
    async def test_recalculate_segment_success(
        self,
        async_client: AsyncClient,
    ):
        """Test recalculating segment membership."""
        # Arrange
        segment_id = str(uuid4())
        async_client.mock_service.recalculate_segment.return_value = 150

        # Act
        response = await async_client.post(f"/api/v1/customers/segments/{segment_id}/recalculate")

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["member_count"] == 150


class TestAdminActions:
    """Test admin/support action endpoints."""

    @pytest.mark.asyncio
    async def test_impersonate_customer_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test customer impersonation."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.get_customer.return_value = customer_obj

        # Act
        response = await async_client.post(
            f"/api/v1/customers/{sample_customer_dict['id']}/impersonate"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_update_customer_status_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test updating customer status."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        updated_customer = MockObject(**{**sample_customer_dict, "status": "suspended"})
        async_client.mock_service.get_customer.return_value = customer_obj
        async_client.mock_service.update_customer.return_value = updated_customer

        # Act
        response = await async_client.patch(
            f"/api/v1/customers/{sample_customer_dict['id']}/status", json={"status": "suspended"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "suspended"

    @pytest.mark.asyncio
    async def test_reset_customer_password_success(
        self, async_client: AsyncClient, sample_customer_dict: dict[str, Any]
    ):
        """Test admin-initiated password reset."""
        # Arrange
        customer_obj = MockObject(**sample_customer_dict)
        async_client.mock_service.get_customer.return_value = customer_obj

        # Act
        response = await async_client.post(
            f"/api/v1/customers/{sample_customer_dict['id']}/reset-password"
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "message" in data
        assert sample_customer_dict["email"] in data["message"]
