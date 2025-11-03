"""
Tests for tenant onboarding automation API endpoints.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from fastapi import status
from httpx import AsyncClient

from dotmac.platform.auth.platform_admin import create_platform_admin_token
from dotmac.platform.tenant.schemas import TenantCreate
from dotmac.platform.tenant.service import TenantAlreadyExistsError

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient) -> dict[str, str]:
    """Provide authentication headers for onboarding API calls."""
    token = create_platform_admin_token(
        user_id="onboarding-admin",
        email="onboarding@test.com",
        permissions=[
            "platform:tenants:write",
            "platform:tenants:read",
            "tenants:*",
        ],
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "test-tenant",
    }


class TestTenantOnboardingRouter:
    """Validate onboarding automation workflows."""

    async def test_onboarding_creates_tenant_with_admin(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        mock_tenant_service: AsyncMock,
        mock_user_service: AsyncMock,
    ) -> None:
        """Ensure onboarding can create tenant, settings, metadata, and admin user."""
        mock_user_service.create_user.return_value = SimpleNamespace(id="admin-123")

        response = await async_client.post(
            "/api/v1/tenants/onboarding",
            headers=auth_headers,
            json={
                "tenant": {
                    "name": "Automation Org",
                    "slug": "automation-org",
                    "email": "owner@example.com",
                },
                "admin_user": {
                    "username": "automation-admin",
                    "email": "admin@example.com",
                    "password": "StrongPass123!",
                    "full_name": "Automation Admin",
                },
                "metadata": {"welcome_message_sent": True},
                "invitations": [{"email": "invitee@example.com", "role": "member"}],
                "feature_flags": {"webhooks": True},
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["created"] is True
        assert data["tenant"]["slug"] == "automation-org"
        assert "onboarding.status" in data["applied_settings"]
        assert data["metadata"]["onboarding_status"] in {"completed", "in_progress"}
        assert data["admin_user_id"] == "admin-123"
        assert data["admin_user_password"] is None
        assert mock_user_service.create_user.await_count == 1
        assert mock_tenant_service.update_tenant_features.await_count == 1
        assert len(data["invitations"]) == 1

    async def test_onboarding_resumes_existing_tenant_when_allowed(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        mock_tenant_service: AsyncMock,
        mock_user_service: AsyncMock,
    ) -> None:
        """Validate allow_existing_tenant option reuses current tenant records."""

        async def _raise_exists(*args, **kwargs):
            raise TenantAlreadyExistsError("tenant already exists")

        # Seed existing tenant so lookup succeeds when slug already present
        existing_data = TenantCreate(
            name="Existing Org",
            slug="existing-org",
            email="existing@example.com",
        )
        existing_tenant = await mock_tenant_service.create_tenant(existing_data)

        mock_tenant_service.create_tenant.side_effect = _raise_exists
        mock_tenant_service.get_tenant_by_slug.return_value = existing_tenant
        mock_user_service.create_user.return_value = SimpleNamespace(id="admin-456")

        response = await async_client.post(
            "/api/v1/tenants/onboarding",
            headers=auth_headers,
            json={
                "tenant": {
                    "name": "Existing Org",
                    "slug": "existing-org",
                    "email": "existing@example.com",
                },
                "options": {"allow_existing_tenant": True, "mark_onboarding_complete": False},
                "admin_user": {
                    "username": "existing-admin",
                    "email": "existing.admin@example.com",
                    "password": "SecurePass456!",
                },
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["created"] is False
        assert data["tenant"]["slug"] == "existing-org"
        assert data["metadata"]["onboarding_status"] == "in_progress"
        assert data["admin_user_id"] == "admin-456"

    async def test_get_onboarding_status_endpoint(
        self,
        async_client: AsyncClient,
        auth_headers: dict[str, str],
        mock_user_service: AsyncMock,
    ) -> None:
        """Ensure status endpoint reflects onboarding metadata."""
        mock_user_service.create_user.return_value = SimpleNamespace(id="admin-999")

        create_response = await async_client.post(
            "/api/v1/tenants/onboarding",
            headers=auth_headers,
            json={
                "tenant": {
                    "name": "Status Org",
                    "slug": "status-org",
                    "email": "status@example.com",
                },
                "admin_user": {
                    "username": "status-admin",
                    "email": "status.admin@example.com",
                    "generate_password": True,
                },
            },
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        create_payload = create_response.json()
        tenant_id = create_payload["tenant"]["id"]
        assert create_payload["admin_user_password"] is not None

        status_response = await async_client.get(
            f"/api/v1/tenants/{tenant_id}/onboarding/status",
            headers=auth_headers,
        )

        assert status_response.status_code == status.HTTP_200_OK
        status_data = status_response.json()
        assert status_data["tenant_id"] == tenant_id
        assert status_data["status"] in {"completed", "in_progress"}
        assert isinstance(status_data["metadata"], dict)
        assert status_data["completed"] is True
