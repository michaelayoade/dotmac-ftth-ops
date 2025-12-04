"""Tests for contacts router."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.contacts.schemas import ContactStage, ContactStatus

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_contact_service():
    """Create mock contact service."""
    service = AsyncMock()

    # Mock contact data - matches ContactResponse schema
    mock_contact = {
        "id": str(uuid4()),
        "first_name": "John",
        "last_name": "Doe",
        "company": "ACME Corp",
        "job_title": "CEO",
        "status": ContactStatus.ACTIVE.value,
        "stage": ContactStage.LEAD.value,
        "tenant_id": str(uuid4()),
        "owner_id": str(uuid4()),
        "customer_id": None,
        "is_verified": True,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "last_contacted_at": None,
        "contact_methods": [],  # Email/phone would be here as ContactMethodResponse objects
    }

    service.create_contact = AsyncMock(return_value=mock_contact)
    service.get_contact = AsyncMock(return_value=mock_contact)
    service.update_contact = AsyncMock(return_value=mock_contact)
    service.delete_contact = AsyncMock(return_value=True)
    service.list_contacts = AsyncMock(
        return_value={"items": [mock_contact], "total": 1, "page": 1, "size": 20}
    )

    return service


@pytest.fixture
def test_client(mock_contact_service):
    """Create test client with mocked dependencies."""
    app = FastAPI()

    # Import the router
    from dotmac.platform.contacts import router as contacts_module
    from dotmac.platform.contacts.router import get_async_session, get_current_tenant_id

    # Create mock user
    test_user = UserInfo(
        user_id=str(uuid4()),
        email="test@example.com",
        roles=["admin"],
        permissions=["contacts.create", "contacts.read", "contacts.update", "contacts.delete"],
        tenant_id=str(uuid4()),
    )

    # Mock dependencies using dependency overrides
    async def mock_get_session():
        return AsyncMock()

    test_tenant_id = str(uuid4())

    async def mock_get_tenant():
        return test_tenant_id

    # Override dependencies
    app.dependency_overrides[get_async_session] = mock_get_session
    app.dependency_overrides[get_current_tenant_id] = mock_get_tenant

    # Include router with prefix
    # Note: router already has prefix="/contacts", so we only add "/api/v1"
    app.include_router(contacts_module.router, prefix="/api/v1")

    # Set up permission overrides
    permission_names = {
        "contacts.create",
        "contacts.read",
        "contacts.update",
        "contacts.delete",
        "contacts.manage",
    }

    allowed_permissions = set(test_user.permissions)

    def make_override(permission: str):
        async def dependency():
            if permission not in allowed_permissions:
                from fastapi import HTTPException

                raise HTTPException(status_code=403, detail="Permission denied")
            return test_user

        return dependency

    for perm in permission_names:
        app.dependency_overrides[require_permission(perm)] = make_override(perm)

    client = TestClient(app)
    client.allowed_permissions = allowed_permissions  # type: ignore[attr-defined]
    client.test_user = test_user  # type: ignore[attr-defined]
    client.mock_service = mock_contact_service  # type: ignore[attr-defined]
    return client


class TestContactEndpoints:
    """Test contact CRUD endpoints."""

    def test_create_contact(self, test_client: TestClient, mock_contact_service):
        """Test creating a new contact."""
        contact_data = {
            "first_name": "John",
            "last_name": "Doe",
            "company": "ACME Corp",
            "job_title": "CEO",
        }

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.post("/api/v1/contacts/", json=contact_data)

        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
        assert data["company"] == "ACME Corp"
        assert data["job_title"] == "CEO"

    def test_get_contact(self, test_client: TestClient, mock_contact_service):
        """Test getting a contact by ID."""
        contact_id = str(uuid4())

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.get(f"/api/v1/contacts/{contact_id}")

        assert response.status_code == 200
        data = response.json()
        assert "first_name" in data
        assert "last_name" in data
        assert "contact_methods" in data  # Email would be in contact_methods

    def test_get_contact_not_found(self, test_client: TestClient):
        """Test getting a non-existent contact."""
        contact_id = str(uuid4())

        mock_service = AsyncMock()
        mock_service.get_contact = AsyncMock(return_value=None)

        with patch("dotmac.platform.contacts.router.ContactService", return_value=mock_service):
            response = test_client.get(f"/api/v1/contacts/{contact_id}")

        assert response.status_code == 404
        assert response.json()["detail"] == "Contact not found"

    def test_update_contact(self, test_client: TestClient, mock_contact_service):
        """Test updating a contact."""
        contact_id = str(uuid4())
        update_data = {"first_name": "Jane", "job_title": "CTO"}

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.patch(f"/api/v1/contacts/{contact_id}", json=update_data)

        assert response.status_code == 200
        data = response.json()
        assert "id" in data

    def test_update_contact_not_found(self, test_client: TestClient):
        """Test updating a non-existent contact."""
        contact_id = str(uuid4())
        update_data = {"first_name": "Jane"}

        mock_service = AsyncMock()
        mock_service.update_contact = AsyncMock(return_value=None)

        with patch("dotmac.platform.contacts.router.ContactService", return_value=mock_service):
            response = test_client.patch(f"/api/v1/contacts/{contact_id}", json=update_data)

        assert response.status_code == 404
        assert response.json()["detail"] == "Contact not found"

    def test_delete_contact(self, test_client: TestClient, mock_contact_service):
        """Test deleting a contact."""
        contact_id = str(uuid4())

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.delete(f"/api/v1/contacts/{contact_id}")

        assert response.status_code == 204

    def test_delete_contact_not_found(self, test_client: TestClient):
        """Test deleting a non-existent contact."""
        contact_id = str(uuid4())

        mock_service = AsyncMock()
        mock_service.delete_contact = AsyncMock(return_value=False)

        with patch("dotmac.platform.contacts.router.ContactService", return_value=mock_service):
            response = test_client.delete(f"/api/v1/contacts/{contact_id}")

        assert response.status_code == 404

    def test_search_contacts(self, test_client: TestClient, mock_contact_service):
        """Test searching contacts."""
        # Update mock to return search results format
        mock_contact_service.search_contacts = AsyncMock(
            return_value=(
                [mock_contact_service.create_contact.return_value],  # contacts list
                1,  # total count
            )
        )

        search_data = {"query": "", "page": 1, "page_size": 20}

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.post("/api/v1/contacts/search", json=search_data)

        assert response.status_code == 200
        data = response.json()
        assert "contacts" in data
        assert "total" in data
        assert data["total"] == 1
        assert len(data["contacts"]) == 1

    def test_search_contacts_with_filters(self, test_client: TestClient, mock_contact_service):
        """Test searching contacts with filters."""
        # Update mock to return search results format
        mock_contact_service.search_contacts = AsyncMock(
            return_value=(
                [mock_contact_service.create_contact.return_value],  # contacts list
                1,  # total count
            )
        )

        search_data = {
            "query": "john",
            "status": "active",
            "stage": "lead",
            "page": 1,
            "page_size": 10,
        }

        with patch(
            "dotmac.platform.contacts.router.ContactService", return_value=mock_contact_service
        ):
            response = test_client.post("/api/v1/contacts/search", json=search_data)

        assert response.status_code == 200
        data = response.json()
        assert "contacts" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data
        assert "has_next" in data
        assert "has_prev" in data


class TestContactPermissions:
    """Test contact permission requirements."""

    def test_create_requires_permission(self, test_client: TestClient):
        """Test that creating a contact requires proper permission."""
        # Override to user without permission
        test_client.allowed_permissions.discard("contacts.create")  # type: ignore[attr-defined]

        contact_data = {"first_name": "John", "last_name": "Doe", "company": "Test Corp"}

        response = test_client.post("/api/v1/contacts/", json=contact_data)
        assert response.status_code == 403

        test_client.allowed_permissions.add("contacts.create")  # type: ignore[attr-defined]

    def test_read_requires_permission(self, test_client: TestClient):
        """Test that reading a contact requires proper permission."""
        test_client.allowed_permissions.discard("contacts.read")  # type: ignore[attr-defined]

        contact_id = str(uuid4())
        response = test_client.get(f"/api/v1/contacts/{contact_id}")
        assert response.status_code == 403

        test_client.allowed_permissions.add("contacts.read")  # type: ignore[attr-defined]
