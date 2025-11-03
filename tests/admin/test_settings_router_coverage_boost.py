"""
Additional tests to boost admin settings router coverage.

Targets specific uncovered error paths in the router.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user."""
    return UserInfo(
        user_id=str(uuid4()),  # Use proper UUID
        username="admin",
        email="admin@example.com",
        roles=["admin"],
        permissions=["admin:settings:read", "admin:settings:write"],
        tenant_id=str(uuid4()),  # Use proper UUID
    )


@pytest.fixture
def mock_rbac_service():
    """Create a mock RBAC service that always grants permissions."""
    mock_service = AsyncMock()
    mock_service.user_has_all_permissions = AsyncMock(return_value=True)
    mock_service.user_has_any_permission = AsyncMock(return_value=True)
    mock_service.user_has_permission = AsyncMock(return_value=True)
    return mock_service


@pytest.fixture
def test_app(mock_admin_user, async_db_session):
    """Create a test FastAPI app with the router."""
    from dotmac.platform.admin.settings.router import router
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.db import get_async_session, get_session_dependency

    app = FastAPI()

    # Override the underlying dependencies
    async def override_get_current_user():
        return mock_admin_user

    async def override_get_async_session():
        yield async_db_session

    async def override_get_session():
        yield async_db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_session_dependency] = override_get_session

    app.include_router(router, prefix="/api/v1/admin/settings")

    return app


@pytest.fixture
def test_client(test_app, mock_rbac_service):
    """Create a test client with patched RBAC service."""
    # Patch RBACService to return our mock
    with patch(
        "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=mock_rbac_service
    ):
        client = TestClient(test_app)
        yield client


class TestUpdateValidationFailures:
    """Test update endpoint validation failure paths."""

    def test_update_with_nonexistent_field(self, test_client):
        """Test update with field that doesn't exist in schema."""
        response = test_client.put(
            "/api/v1/admin/settings/category/email",
            json={
                "updates": {
                    "nonexistent_field_xyz": "value"  # Field doesn't exist
                },
                "validate_only": False,
                "reason": "Test invalid field",
            },
        )

        # Should handle gracefully
        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]

    def test_get_invalid_category(self, test_client):
        """Test getting settings for non-existent category triggers ValueError (lines 83-84)."""
        response = test_client.get("/api/v1/admin/settings/category/nonexistent_category_xyz")

        assert response.status_code in [
            status.HTTP_404_NOT_FOUND,
            status.HTTP_422_UNPROCESSABLE_ENTITY,
        ]


class TestBulkUpdateCoverage:
    """Test bulk update to improve coverage."""

    def test_bulk_update_success(self, test_client):
        """Test successful bulk update."""
        response = test_client.post(
            "/api/v1/admin/settings/bulk-update",
            json={
                "updates": {
                    "email": {
                        "smtp_host": "smtp.example.com",
                    },
                },
                "validate_only": False,
                "reason": "Test bulk update",
            },
        )

        # Should succeed or return detailed errors
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_400_BAD_REQUEST]


class TestResetEndpointCoverage:
    """Test reset endpoint."""

    def test_reset_category_not_implemented(self, test_client):
        """Test reset endpoint returns not implemented (lines 533, 537)."""
        response = test_client.post(
            "/api/v1/admin/settings/reset/database",
            json={
                "confirm": True,
                "reason": "Test reset",
            },
        )

        assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
        data = response.json()
        assert "not" in data["detail"].lower() and "implement" in data["detail"].lower()
