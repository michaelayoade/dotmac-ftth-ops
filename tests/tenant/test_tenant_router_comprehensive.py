"""
Comprehensive tests for tenant management API router.

Tests all REST endpoints for tenant operations.
"""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from fastapi import status
from httpx import AsyncClient

from src.dotmac.platform.auth.platform_admin import create_platform_admin_token
from src.dotmac.platform.tenant.models import TenantPlanType

pytestmark = pytest.mark.integration


@pytest.fixture
def auth_headers():
    """Get authentication headers using a real signed platform admin token."""
    token = create_platform_admin_token(
        user_id="test-admin",
        email="test-admin@example.com",
        permissions=[
            "platform:tenants:read",
            "platform:tenants:write",
            "tenants:*",
        ],
    )
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": "test-tenant",
    }


@pytest_asyncio.fixture
async def sample_tenant_id(async_client, auth_headers, tenant_service):
    """Create a sample tenant and return its ID."""
    from src.dotmac.platform.tenant.schemas import TenantCreate

    tenant_data = TenantCreate(
        name="Test Organization",
        slug="test-org-api",
        email="test@example.com",
        plan_type=TenantPlanType.PROFESSIONAL,
    )
    tenant = await tenant_service.create_tenant(tenant_data, created_by="test-user")
    return tenant.id


class TestTenantCRUDEndpoints:
    """Test tenant CRUD API endpoints."""

    async def test_create_tenant_endpoint(self, async_client: AsyncClient, auth_headers):
        """Test POST /api/v1/tenants - Create tenant."""
        response = await async_client.post(
            "/api/v1/tenants",
            headers=auth_headers,
            json={
                "name": "New Org",
                "slug": "new-org",
                "email": "neworg@example.com",
                "plan_type": "starter",
                "max_users": 15,
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["name"] == "New Org"
        assert data["slug"] == "new-org"
        assert data["status"] == "trial"
        assert data["plan_type"] == "starter"
        assert data["max_users"] == 15

    async def test_create_tenant_duplicate_slug(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test creating tenant with duplicate slug fails."""
        response = await async_client.post(
            "/api/v1/tenants",
            headers=auth_headers,
            json={
                "name": "Duplicate",
                "slug": "test-org-api",  # Duplicate
                "email": "dup@example.com",
            },
        )

        assert response.status_code == status.HTTP_409_CONFLICT

    async def test_list_tenants_endpoint(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants - List tenants."""
        response = await async_client.get(
            "/api/v1/tenants",
            headers=auth_headers,
            params={"page": 1, "page_size": 10},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "total_pages" in data
        assert data["page"] == 1
        assert data["page_size"] == 10

    async def test_list_tenants_with_filters(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test listing with status filter."""
        response = await async_client.get(
            "/api/v1/tenants",
            headers=auth_headers,
            params={"status": "trial", "page_size": 20},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert all(item["status"] == "trial" for item in data["items"])

    async def test_list_tenants_with_search(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test listing with search."""
        response = await async_client.get(
            "/api/v1/tenants",
            headers=auth_headers,
            params={"search": "Test Organization"},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1

    async def test_get_tenant_by_id(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/{id} - Get tenant by ID."""
        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_tenant_id
        assert data["name"] == "Test Organization"

    async def test_get_tenant_by_slug(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/slug/{slug} - Get by slug."""
        response = await async_client.get(
            "/api/v1/tenants/slug/test-org-api",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["slug"] == "test-org-api"

    async def test_get_nonexistent_tenant(self, async_client: AsyncClient, auth_headers):
        """Test getting non-existent tenant returns 404."""
        response = await async_client.get(
            "/api/v1/tenants/nonexistent-id",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    async def test_update_tenant(self, async_client: AsyncClient, auth_headers, sample_tenant_id):
        """Test PATCH /api/v1/tenants/{id} - Update tenant."""
        response = await async_client.patch(
            f"/api/v1/tenants/{sample_tenant_id}",
            headers=auth_headers,
            json={
                "name": "Updated Name",
                "max_users": 25,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["max_users"] == 25

    async def test_soft_delete_tenant(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test DELETE /api/v1/tenants/{id} - Soft delete."""
        response = await async_client.delete(
            f"/api/v1/tenants/{sample_tenant_id}",
            headers=auth_headers,
            params={"permanent": False},
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify tenant is soft deleted
        get_response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}",
            headers=auth_headers,
        )
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    async def test_restore_tenant(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id, tenant_service
    ):
        """Test POST /api/v1/tenants/{id}/restore - Restore tenant."""
        # First soft delete
        await tenant_service.delete_tenant(sample_tenant_id, permanent=False)

        # Then restore
        response = await async_client.post(
            f"/api/v1/tenants/{sample_tenant_id}/restore",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == sample_tenant_id
        assert data["deleted_at"] is None


class TestTenantSettingsEndpoints:
    """Test tenant settings API endpoints."""

    async def test_create_setting(self, async_client: AsyncClient, auth_headers, sample_tenant_id):
        """Test POST /api/v1/tenants/{id}/settings - Create setting."""
        response = await async_client.post(
            f"/api/v1/tenants/{sample_tenant_id}/settings",
            headers=auth_headers,
            json={
                "key": "api_endpoint",
                "value": "https://api.example.com",
                "value_type": "string",
                "description": "API endpoint URL",
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "api_endpoint"
        assert data["value"] == "https://api.example.com"

    async def test_get_all_settings(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/{id}/settings - Get all settings."""
        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}/settings",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    async def test_get_specific_setting(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id, tenant_service
    ):
        """Test GET /api/v1/tenants/{id}/settings/{key} - Get setting."""
        from src.dotmac.platform.tenant.schemas import TenantSettingCreate

        # Create a setting first
        await tenant_service.set_tenant_setting(
            sample_tenant_id,
            TenantSettingCreate(key="test_key", value="test_value"),
        )

        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}/settings/test_key",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["key"] == "test_key"
        assert data["value"] == "test_value"

    async def test_delete_setting(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id, tenant_service
    ):
        """Test DELETE /api/v1/tenants/{id}/settings/{key} - Delete setting."""
        from src.dotmac.platform.tenant.schemas import TenantSettingCreate

        await tenant_service.set_tenant_setting(
            sample_tenant_id,
            TenantSettingCreate(key="delete_me", value="temp"),
        )

        response = await async_client.delete(
            f"/api/v1/tenants/{sample_tenant_id}/settings/delete_me",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT


class TestTenantUsageEndpoints:
    """Test tenant usage tracking endpoints."""

    async def test_record_usage(self, async_client: AsyncClient, auth_headers, sample_tenant_id):
        """Test POST /api/v1/tenants/{id}/usage - Record usage."""
        now = datetime.now(UTC)
        response = await async_client.post(
            f"/api/v1/tenants/{sample_tenant_id}/usage",
            headers=auth_headers,
            json={
                "period_start": (now - timedelta(hours=1)).isoformat(),
                "period_end": now.isoformat(),
                "api_calls": 1000,
                "storage_gb": 5.5,
                "active_users": 10,
                "bandwidth_gb": 2.3,
                "metrics": {},
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["api_calls"] == 1000
        assert data["storage_gb"] == 5.5

    async def test_get_usage_history(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/{id}/usage - Get usage."""
        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}/usage",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    async def test_get_tenant_stats(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/{id}/stats - Get statistics."""
        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}/stats",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "tenant_id" in data
        assert "user_usage_percent" in data
        assert "api_usage_percent" in data
        assert "storage_usage_percent" in data


class TestTenantInvitationEndpoints:
    """Test tenant invitation endpoints."""

    async def test_create_invitation(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test POST /api/v1/tenants/{id}/invitations - Create invitation."""
        response = await async_client.post(
            f"/api/v1/tenants/{sample_tenant_id}/invitations",
            headers=auth_headers,
            json={
                "email": "newuser@example.com",
                "role": "member",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["role"] == "member"
        assert data["status"] == "pending"
        assert data["token"] is not None

    async def test_list_invitations(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id
    ):
        """Test GET /api/v1/tenants/{id}/invitations - List invitations."""
        response = await async_client.get(
            f"/api/v1/tenants/{sample_tenant_id}/invitations",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)

    async def test_accept_invitation(
        self, async_client: AsyncClient, sample_tenant_id, tenant_service
    ):
        """Test POST /api/v1/tenants/invitations/accept - Accept invitation."""
        from src.dotmac.platform.tenant.schemas import TenantInvitationCreate

        # Create invitation
        invitation = await tenant_service.create_invitation(
            sample_tenant_id,
            TenantInvitationCreate(email="accept@example.com"),
            invited_by="admin",
        )

        response = await async_client.post(
            "/api/v1/tenants/invitations/accept",
            json={"token": invitation.token},
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "accepted"

    async def test_revoke_invitation(
        self, async_client: AsyncClient, auth_headers, sample_tenant_id, tenant_service
    ):
        """Test POST /api/v1/tenants/{id}/invitations/{inv_id}/revoke - Revoke."""
        from src.dotmac.platform.tenant.schemas import TenantInvitationCreate

        invitation = await tenant_service.create_invitation(
            sample_tenant_id,
            TenantInvitationCreate(email="revoke@example.com"),
            invited_by="admin",
        )

        response = await async_client.post(
            f"/api/v1/tenants/{sample_tenant_id}/invitations/{invitation.id}/revoke",
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "revoked"


class TestTenantFeatureEndpoints:
    """Test tenant feature management endpoints."""

    async def test_update_features(self, async_client: AsyncClient, auth_headers, sample_tenant_id):
        """Test PATCH /api/v1/tenants/{id}/features - Update features."""
        response = await async_client.patch(
            f"/api/v1/tenants/{sample_tenant_id}/features",
            headers=auth_headers,
            json={
                "features": {
                    "webhooks": True,
                    "advanced_analytics": True,
                    "custom_domain": False,
                }
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["features"]["webhooks"] is True
        assert data["features"]["advanced_analytics"] is True

    async def test_update_metadata(self, async_client: AsyncClient, auth_headers, sample_tenant_id):
        """Test PATCH /api/v1/tenants/{id}/metadata - Update metadata."""
        response = await async_client.patch(
            f"/api/v1/tenants/{sample_tenant_id}/metadata",
            headers=auth_headers,
            json={
                "custom_metadata": {
                    "onboarding_completed": True,
                    "custom_field": "value",
                }
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["custom_metadata"]["onboarding_completed"] is True


class TestTenantBulkEndpoints:
    """Test bulk operation endpoints."""

    async def test_bulk_status_update(
        self, async_client: AsyncClient, auth_headers, tenant_service
    ):
        """Test POST /api/v1/tenants/bulk/status - Bulk status update."""
        from src.dotmac.platform.tenant.schemas import TenantCreate

        # Create test tenants
        tenant_ids = []
        for i in range(3):
            tenant_data = TenantCreate(
                name=f"Bulk Test {i}",
                slug=f"bulk-test-{i}",
            )
            tenant = await tenant_service.create_tenant(tenant_data)
            tenant_ids.append(tenant.id)

        response = await async_client.post(
            "/api/v1/tenants/bulk/status",
            headers=auth_headers,
            json={
                "tenant_ids": tenant_ids,
                "status": "active",
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["updated_count"] == 3

    async def test_bulk_delete(self, async_client: AsyncClient, auth_headers, tenant_service):
        """Test POST /api/v1/tenants/bulk/delete - Bulk delete."""
        from src.dotmac.platform.tenant.schemas import TenantCreate

        # Create test tenants
        tenant_ids = []
        for i in range(2):
            tenant_data = TenantCreate(
                name=f"Delete Test {i}",
                slug=f"delete-test-{i}",
            )
            tenant = await tenant_service.create_tenant(tenant_data)
            tenant_ids.append(tenant.id)

        response = await async_client.post(
            "/api/v1/tenants/bulk/delete",
            headers=auth_headers,
            json={
                "tenant_ids": tenant_ids,
                "permanent": False,
            },
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["deleted_count"] == 2
        assert data["permanent"] is False


class TestTenantValidation:
    """Test request validation."""

    async def test_create_tenant_invalid_slug(self, async_client: AsyncClient, auth_headers):
        """Test creating tenant with invalid slug."""
        response = await async_client.post(
            "/api/v1/tenants",
            headers=auth_headers,
            json={
                "name": "Test",
                "slug": "Invalid Slug!",  # Invalid characters
                "email": "test@example.com",
            },
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_create_tenant_missing_required_fields(
        self, async_client: AsyncClient, auth_headers
    ):
        """Test creating tenant without required fields."""
        response = await async_client.post(
            "/api/v1/tenants",
            headers=auth_headers,
            json={
                "name": "Test",
                # Missing slug
            },
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    async def test_pagination_validation(self, async_client: AsyncClient, auth_headers):
        """Test pagination parameter validation."""
        # Invalid page number
        response = await async_client.get(
            "/api/v1/tenants",
            headers=auth_headers,
            params={"page": 0},  # Must be >= 1
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Invalid page size
        response = await async_client.get(
            "/api/v1/tenants",
            headers=auth_headers,
            params={"page_size": 200},  # Max is 100
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
