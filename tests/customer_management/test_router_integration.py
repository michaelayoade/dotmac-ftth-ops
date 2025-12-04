"""
Comprehensive integration tests for Customer Management Router.

Tests all customer management router endpoints following the Two-Tier Testing Strategy:
- Routers = Integration Tests (real FastAPI test client, mock auth/tenant)
- Services = Unit Tests (separate test file)

Coverage Target: 85%+ for router endpoints
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException, status
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.auth.rbac_dependencies import (
    require_customer_impersonate,
    require_customer_manage_status,
    require_customer_reset_password,
)
from tests.customer_management.conftest import MockObject


@pytest.fixture
def test_client(
    mock_auth_dependency: UserInfo,
    mock_tenant_dependency: str,
    monkeypatch,
):
    """Create a test client for the FastAPI app with customer deps overridden."""
    from dotmac.platform.customer_management.router import (
        get_customer_service,
    )
    from dotmac.platform.customer_management.router import (
        router as customer_router,
    )

    mock_service = MagicMock()
    mock_service.create_customer = AsyncMock()
    mock_service.get_customer = AsyncMock(return_value=None)
    mock_service.get_customer_by_email = AsyncMock(return_value=None)
    mock_service.get_customer_by_number = AsyncMock(return_value=None)
    mock_service.update_customer = AsyncMock(return_value=None)
    mock_service.delete_customer = AsyncMock(return_value=True)
    mock_service.search_customers = AsyncMock(return_value=([], 0))
    mock_service.add_activity = AsyncMock()
    mock_service.get_customer_activities = AsyncMock(return_value=[])
    mock_service.add_note = AsyncMock()
    mock_service.get_customer_notes = AsyncMock(return_value=[])
    mock_service.update_metrics = AsyncMock()
    mock_service.get_customer_metrics = AsyncMock(
        return_value={
            "total_customers": 100,
            "active_customers": 80,
            "new_customers_this_month": 5,
            "churn_rate": 0.05,
            "average_lifetime_value": 1200.0,
            "total_revenue": 50000.0,
            "customers_by_status": {"active": 80, "prospect": 15, "churned": 5},
            "customers_by_tier": {"standard": 60, "premium": 25, "enterprise": 15},
            "customers_by_type": {"individual": 70, "business": 30},
            "top_segments": [
                {"name": "VIP", "member_count": 10},
                {"name": "Trial", "member_count": 5},
            ],
        }
    )
    mock_service.record_purchase = AsyncMock()
    mock_service.create_segment = AsyncMock()
    mock_service.recalculate_segment = AsyncMock(return_value=0)
    mock_service.session = MagicMock()

    mock_event_bus = AsyncMock()
    monkeypatch.setattr(
        "dotmac.platform.events.bus.get_event_bus",
        lambda *_, **__: mock_event_bus,
    )
    from dotmac.platform.events.bus import reset_event_bus

    reset_event_bus()

    import dotmac.platform.auth.core as auth_core

    mock_jwt = MagicMock()
    mock_jwt.create_access_token = MagicMock(return_value="mock-token")
    monkeypatch.setattr(auth_core, "jwt_service", mock_jwt)

    async def noop_log(*args, **kwargs):  # pragma: no cover - simple async stub
        return None

    import dotmac.platform.audit as audit_module

    monkeypatch.setattr(audit_module, "log_user_activity", noop_log)

    mock_email_service = MagicMock()
    mock_email_service.send_password_reset_email = AsyncMock(return_value=("sent", "token"))
    import dotmac.platform.auth.email_service as email_service_module

    monkeypatch.setattr(
        email_service_module,
        "get_auth_email_service",
        lambda: mock_email_service,
    )

    tenant_id = mock_tenant_dependency
    monkeypatch.setattr("dotmac.platform.tenant.get_current_tenant_id", lambda: tenant_id)

    app = FastAPI()
    app.include_router(customer_router, prefix="/api/v1/customers")

    app.dependency_overrides[get_customer_service] = lambda: mock_service
    user = mock_auth_dependency
    app.dependency_overrides[get_current_user] = lambda user=user: user
    app.dependency_overrides[require_customer_impersonate] = lambda user=user: user
    app.dependency_overrides[require_customer_manage_status] = lambda user=user: user
    app.dependency_overrides[require_customer_reset_password] = lambda user=user: user

    with TestClient(app) as client:
        client.mock_customer_service = mock_service  # type: ignore[attr-defined]
        client.mock_event_bus = mock_event_bus  # type: ignore[attr-defined]
        yield client


@pytest.fixture
def mock_auth_dependency():
    """Mock authentication dependency."""
    mock_user = UserInfo(
        user_id="test-user-123",
        username="testuser",
        email="test@example.com",
        roles=["user"],
        permissions=["customers:read", "customers:write"],
        tenant_id="test-tenant-123",
    )

    return mock_user


@pytest.fixture
def mock_tenant_dependency():
    """Mock tenant context dependency."""
    return "test-tenant-123"


@pytest.mark.integration
class TestCustomerCRUDEndpoints:
    """Test customer CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_customer_success(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test successful customer creation."""
        request_payload = {
            "email": sample_customer_dict["email"],
            "first_name": sample_customer_dict["first_name"],
            "last_name": sample_customer_dict["last_name"],
            "phone": sample_customer_dict["phone"],
            "customer_type": sample_customer_dict["customer_type"],
            "tier": sample_customer_dict["tier"],
            "company_name": "Acme Corp",
        }

        customer_obj = MockObject(**sample_customer_dict)
        test_client.mock_customer_service.get_customer_by_email.return_value = None  # type: ignore[attr-defined]
        test_client.mock_customer_service.create_customer.return_value = customer_obj  # type: ignore[attr-defined]

        response = test_client.post(
            "/api/v1/customers",
            json=request_payload,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["email"] == sample_customer_dict["email"]
        assert data["first_name"] == sample_customer_dict["first_name"]
        assert data["customer_number"] == sample_customer_dict["customer_number"]

    @pytest.mark.asyncio
    async def test_create_customer_duplicate_email(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test creating customer with duplicate email."""
        duplicate_customer = MockObject(**sample_customer_dict)
        test_client.mock_customer_service.get_customer_by_email.return_value = duplicate_customer  # type: ignore[attr-defined]

        response = test_client.post(
            "/api/v1/customers",
            json={
                "email": sample_customer_dict["email"],
                "first_name": sample_customer_dict["first_name"],
                "last_name": sample_customer_dict["last_name"],
            },
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_customer_success(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test successful customer retrieval."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer.return_value = MockObject(  # type: ignore[attr-defined]
            **{**sample_customer_dict, "id": customer_id}
        )

        response = test_client.get(
            f"/api/v1/customers/{customer_id}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_customer_with_activities(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test getting customer with activities included."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer.return_value = MockObject(  # type: ignore[attr-defined]
            **{**sample_customer_dict, "id": customer_id}
        )

        response = test_client.get(
            f"/api/v1/customers/{customer_id}?include_activities=true",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_customer_with_notes(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test getting customer with notes included."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer.return_value = MockObject(  # type: ignore[attr-defined]
            **{**sample_customer_dict, "id": customer_id}
        )

        response = test_client.get(
            f"/api/v1/customers/{customer_id}?include_notes=true",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_customer_by_number(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test getting customer by customer number."""
        customer_number = "CUST-001"

        test_client.mock_customer_service.get_customer_by_number.return_value = MockObject(  # type: ignore[attr-defined]
            **{**sample_customer_dict, "customer_number": customer_number}
        )

        response = test_client.get(
            f"/api/v1/customers/by-number/{customer_number}",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_update_customer_success(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test successful customer update."""
        customer_id = str(uuid4())
        update_payload = {
            "first_name": "Jane",
            "company_name": "New Corp",
            "tier": "premium",
        }

        updated_customer = MockObject(  # type: ignore[attr-defined]
            **{
                **sample_customer_dict,
                "id": customer_id,
                "first_name": "Jane",
                "company_name": "New Corp",
                "tier": "premium",
            }
        )

        test_client.mock_customer_service.update_customer.return_value = updated_customer  # type: ignore[attr-defined]

        response = test_client.patch(
            f"/api/v1/customers/{customer_id}",
            json=update_payload,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_customer_soft(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test soft delete customer with non-existent ID."""
        customer_id = str(uuid4())

        response = test_client.delete(
            f"/api/v1/customers/{customer_id}",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Idempotent delete - returns 204 even for non-existent customer
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_customer_hard(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test hard delete customer with non-existent ID."""
        customer_id = str(uuid4())

        response = test_client.delete(
            f"/api/v1/customers/{customer_id}?hard_delete=true",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Idempotent delete - returns 204 even for non-existent customer
        assert response.status_code == 204


@pytest.mark.integration
class TestCustomerSearchEndpoint:
    """Test customer search endpoint."""

    @pytest.mark.asyncio
    async def test_search_customers_no_filters(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test searching customers with no filters."""
        search_params = {
            "page": 1,
            "page_size": 10,
        }

        test_client.mock_customer_service.search_customers.return_value = (  # type: ignore[attr-defined]
            [MockObject(**sample_customer_dict)],
            1,
        )

        response = test_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["customers"]) == 1

    @pytest.mark.asyncio
    async def test_search_customers_with_status_filter(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test searching customers by status."""
        search_params = {
            "status": "active",
            "page": 1,
            "page_size": 10,
        }

        test_client.mock_customer_service.search_customers.return_value = (  # type: ignore[attr-defined]
            [MockObject(**sample_customer_dict)],
            1,
        )

        response = test_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_customers_with_tier_filter(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test searching customers by tier."""
        search_params = {
            "tier": "premium",
            "page": 1,
            "page_size": 10,
        }

        test_client.mock_customer_service.search_customers.return_value = (  # type: ignore[attr-defined]
            [MockObject(**sample_customer_dict)],
            1,
        )

        response = test_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_customers_pagination(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test customer search pagination."""
        search_params = {
            "page": 2,
            "page_size": 5,
        }

        test_client.mock_customer_service.search_customers.return_value = (  # type: ignore[attr-defined]
            [MockObject(**sample_customer_dict)],
            10,
        )

        response = test_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 2
        assert data["page_size"] == 5


@pytest.mark.integration
class TestCustomerActivitiesEndpoints:
    """Test customer activities endpoints."""

    @pytest.mark.asyncio
    async def test_add_customer_activity(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test adding customer activity."""
        customer_id = str(uuid4())
        activity_data = {
            "activity_type": "contact_made",
            "title": "Follow-up Call",
            "description": "Spoke with customer about upgrade options",
            "metadata": {"duration_minutes": 15},
            "ip_address": "192.0.2.10",
            "user_agent": "pytest-client",
        }

        activity_response = MockObject(
            id=str(uuid4()),
            customer_id=customer_id,
            activity_type="contact_made",
            title="Follow-up Call",
            description="Spoke with customer about upgrade options",
            metadata_={"duration_minutes": 15},
            performed_by=str(uuid4()),
            ip_address="192.0.2.10",
            user_agent="pytest-client",
            created_at=datetime.now(UTC),
        )

        test_client.mock_customer_service.add_activity.return_value = activity_response  # type: ignore[attr-defined]

        response = test_client.post(
            f"/api/v1/customers/{customer_id}/activities",
            json=activity_data,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_get_customer_activities(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer activities."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer_activities.return_value = []  # type: ignore[attr-defined]

        response = test_client.get(
            f"/api/v1/customers/{customer_id}/activities",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_get_customer_activities_with_pagination(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer activities with pagination."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer_activities.return_value = []  # type: ignore[attr-defined]

        response = test_client.get(
            f"/api/v1/customers/{customer_id}/activities?limit=10&offset=0",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200


@pytest.mark.integration
class TestCustomerNotesEndpoints:
    """Test customer notes endpoints."""

    @pytest.mark.asyncio
    async def test_add_customer_note(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
        sample_customer_dict,
    ):
        """Test adding customer note."""
        customer_id = str(uuid4())
        note_data = {
            "subject": "Customer Preferences",
            "content": "Customer prefers email communication",
            "is_internal": True,
        }

        note_response = MockObject(
            id=str(uuid4()),
            customer_id=customer_id,
            subject=note_data["subject"],
            content=note_data["content"],
            is_internal=True,
            created_by_id=str(uuid4()),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        test_client.mock_customer_service.add_note.return_value = note_response  # type: ignore[attr-defined]

        response = test_client.post(
            f"/api/v1/customers/{customer_id}/notes",
            json=note_data,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_get_customer_notes(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer notes."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.get_customer_notes.return_value = []  # type: ignore[attr-defined]

        response = test_client.get(
            f"/api/v1/customers/{customer_id}/notes",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_get_customer_notes_exclude_internal(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer notes excluding internal notes."""
        customer_id = str(uuid4())

        response = test_client.get(
            f"/api/v1/customers/{customer_id}/notes?include_internal=false",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Should return 200 with empty list or 404 if customer doesn't exist
        assert response.status_code in [200, 404]


@pytest.mark.integration
class TestCustomerMetricsEndpoints:
    """Test customer metrics endpoints."""

    @pytest.mark.asyncio
    async def test_record_purchase(self, test_client, mock_auth_dependency, mock_tenant_dependency):
        """Test recording customer purchase."""
        customer_id = str(uuid4())

        test_client.mock_customer_service.record_purchase.return_value = None  # type: ignore[attr-defined]

        response = test_client.post(
            f"/api/v1/customers/{customer_id}/metrics/purchase?amount=99.99",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_get_customer_metrics_overview(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer metrics overview."""
        response = test_client.get(
            "/api/v1/customers/metrics/overview",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_customers"] == 100
        assert data["active_customers"] == 80


@pytest.mark.integration
class TestCustomerSegmentsEndpoints:
    """Test customer segments endpoints."""

    @pytest.mark.asyncio
    async def test_create_segment(
        self,
        test_client,
        mock_auth_dependency,
        mock_tenant_dependency,
    ):
        """Test creating customer segment."""
        segment_data = {
            "name": "High Value Customers",
            "description": "Customers with LTV > $10,000",
            "criteria": {"lifetime_value_min": 10000},
            "is_dynamic": True,
        }

        segment_response = MockObject(
            id=str(uuid4()),
            name=segment_data["name"],
            description=segment_data["description"],
            criteria=segment_data["criteria"],
            is_dynamic=True,
            priority=10,
            member_count=25,
            last_calculated=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        test_client.mock_customer_service.create_segment.return_value = segment_response  # type: ignore[attr-defined]

        response = test_client.post(
            "/api/v1/customers/segments",
            json=segment_data,
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_recalculate_segment(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test recalculating segment membership."""
        segment_id = str(uuid4())

        response = test_client.post(
            f"/api/v1/customers/segments/{segment_id}/recalculate",
            headers={"Authorization": "Bearer fake-token"},
        )

        assert response.status_code == 200
        assert response.json()["segment_id"] == segment_id


@pytest.mark.integration
class TestCustomerRouterAuthorization:
    """Test authorization for customer endpoints."""

    @pytest.mark.asyncio
    async def test_create_customer_requires_auth(self, test_client):
        """Test that creating customer requires authentication."""
        customer_data = {
            "email": "test@example.com",
            "first_name": "John",
            "last_name": "Doe",
        }

        original_dependency = test_client.app.dependency_overrides.get(get_current_user)

        def raise_unauthorized() -> None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        test_client.app.dependency_overrides[get_current_user] = raise_unauthorized

        response = test_client.post(
            "/api/v1/customers",
            json=customer_data,
        )

        if original_dependency is not None:
            test_client.app.dependency_overrides[get_current_user] = original_dependency
        else:
            test_client.app.dependency_overrides.pop(get_current_user, None)

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_customer_requires_auth(self, test_client):
        """Test that getting customer requires authentication."""
        customer_id = str(uuid4())

        original_dependency = test_client.app.dependency_overrides.get(get_current_user)

        def raise_unauthorized() -> None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
            )

        test_client.app.dependency_overrides[get_current_user] = raise_unauthorized

        response = test_client.get(f"/api/v1/customers/{customer_id}")

        if original_dependency is not None:
            test_client.app.dependency_overrides[get_current_user] = original_dependency
        else:
            test_client.app.dependency_overrides.pop(get_current_user, None)

        assert response.status_code == 401


@pytest.mark.integration
class TestCustomerRouterErrorHandling:
    """Test error handling in customer router."""

    @pytest.mark.asyncio
    async def test_create_customer_invalid_email(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test creating customer with invalid email."""
        customer_data = {
            "email": "not-an-email",
            "first_name": "John",
            "last_name": "Doe",
        }

        response = test_client.post(
            "/api/v1/customers",
            json=customer_data,
            headers={"Authorization": "Bearer fake-token"},
        )

        # Should fail validation - expect 422 Unprocessable Entity for invalid email format
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_customer_invalid_uuid(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test getting customer with invalid UUID."""
        response = test_client.get(
            "/api/v1/customers/not-a-uuid",
            headers={"Authorization": "Bearer fake-token"},
        )

        # Should fail validation - expect 422 Unprocessable Entity for invalid UUID format
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_update_customer_not_found(
        self, test_client, mock_auth_dependency, mock_tenant_dependency
    ):
        """Test updating non-existent customer."""
        customer_id = str(uuid4())
        update_data = {"first_name": "Jane"}

        response = test_client.patch(
            f"/api/v1/customers/{customer_id}",
            json=update_data,
            headers={"Authorization": "Bearer fake-token"},
        )

        # Should return 404 Not Found for non-existent customer
        assert response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.integration
class TestCustomerManagementPermissions:
    """Test that customer management endpoints properly enforce RBAC permissions."""

    @pytest.fixture(autouse=True)
    def setup_rbac_mocks(self):
        """Set up RBAC service mocks for permission tests."""
        from unittest.mock import AsyncMock, MagicMock

        # Mock that always denies permissions
        self.mock_rbac_deny = MagicMock()
        # Use AsyncMock for async method so FastAPI can await it
        self.mock_rbac_deny.user_has_all_permissions = AsyncMock(return_value=False)

    def test_impersonate_requires_impersonate_permission(self, test_app):
        """Test POST /customers/{customer_id}/impersonate requires customer.impersonate permission."""
        from unittest.mock import patch
        from uuid import uuid4

        from fastapi.testclient import TestClient

        from dotmac.platform.auth.core import UserInfo, get_current_user

        # Setup authentication
        test_user = UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            roles=["user"],
            permissions=[],  # No permissions
            tenant_id="test-tenant-123",
            is_platform_admin=False,
        )
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            client = TestClient(test_app)
            response = client.post(
                f"/api/v1/customers/{uuid4()}/impersonate",
                headers={"X-Tenant-ID": "test-tenant-123"},
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["customer.impersonate"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

        # Cleanup
        test_app.dependency_overrides.clear()

    def test_manage_status_requires_manage_status_permission(self, test_app):
        """Test PATCH /customers/{customer_id}/status requires customer.manage_status permission."""
        from unittest.mock import patch
        from uuid import uuid4

        from fastapi.testclient import TestClient

        from dotmac.platform.auth.core import UserInfo, get_current_user

        # Setup authentication
        test_user = UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            roles=["user"],
            permissions=[],  # No permissions
            tenant_id="test-tenant-123",
            is_platform_admin=False,
        )
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            client = TestClient(test_app)
            response = client.patch(
                f"/api/v1/customers/{uuid4()}/status",
                json={"status": "active", "reason": "test"},
                headers={"X-Tenant-ID": "test-tenant-123"},
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["customer.manage_status"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

        # Cleanup
        test_app.dependency_overrides.clear()

    def test_reset_password_requires_reset_password_permission(self, test_app):
        """Test POST /customers/{customer_id}/reset-password requires customer.reset_password permission."""
        from unittest.mock import patch
        from uuid import uuid4

        from fastapi.testclient import TestClient

        from dotmac.platform.auth.core import UserInfo, get_current_user

        # Setup authentication
        test_user = UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            roles=["user"],
            permissions=[],  # No permissions
            tenant_id="test-tenant-123",
            is_platform_admin=False,
        )
        test_app.dependency_overrides[get_current_user] = lambda: test_user

        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            client = TestClient(test_app)
            response = client.post(
                f"/api/v1/customers/{uuid4()}/reset-password",
                headers={"X-Tenant-ID": "test-tenant-123"},
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["customer.reset_password"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

        # Cleanup
        test_app.dependency_overrides.clear()
