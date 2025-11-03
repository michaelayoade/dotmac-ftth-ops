"""
Mock-based tests for tenant router to achieve 90%+ coverage.

Following Dev B's successful approach with dependency overrides and mocks.
Targets uncovered error handlers and edge cases.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant.models import TenantPlanType, TenantStatus
from dotmac.platform.tenant.router import router as tenant_router
from dotmac.platform.tenant.service import (
    TenantAlreadyExistsError,
    TenantNotFoundError,
    TenantService,
)


@pytest.mark.unit
class TestTenantRouterPropertyAssignments:
    """Test routes that assign response properties (lines 67-77, 108-121, etc)."""

    async def test_create_tenant_response_properties(self):
        """Test create tenant response includes all computed properties."""
        from dotmac.platform.tenant.models import Tenant
        from dotmac.platform.tenant.router import get_tenant_service

        # Create a mock tenant object with all properties
        mock_tenant = MagicMock(spec=Tenant)
        mock_tenant.id = "tenant-123"
        mock_tenant.name = "Test Org"
        mock_tenant.slug = "test-org"
        mock_tenant.email = "test@example.com"
        mock_tenant.status = TenantStatus.TRIAL
        mock_tenant.plan_type = TenantPlanType.FREE
        mock_tenant.max_users = 10
        mock_tenant.max_api_calls_per_month = 1000
        mock_tenant.max_storage_gb = 10
        mock_tenant.current_users = 5
        mock_tenant.current_api_calls = 500
        mock_tenant.current_storage_gb = 5.0
        mock_tenant.created_at = datetime.now(UTC)
        mock_tenant.updated_at = datetime.now(UTC)
        mock_tenant.deleted_at = None
        mock_tenant.trial_ends_at = None
        mock_tenant.subscription_starts_at = None
        mock_tenant.subscription_ends_at = None
        mock_tenant.billing_email = None
        mock_tenant.domain = None
        mock_tenant.phone = None
        mock_tenant.company_size = None
        mock_tenant.industry = None
        mock_tenant.country = None
        mock_tenant.timezone = "timezone.utc"
        mock_tenant.logo_url = None
        mock_tenant.primary_color = None
        mock_tenant.features = {}
        mock_tenant.settings = {}
        mock_tenant.custom_metadata = {}
        mock_tenant.billing_cycle = "monthly"

        # Mock computed properties
        mock_tenant.is_trial = True
        mock_tenant.is_active = True
        mock_tenant.status_is_active = False  # TRIAL status, not ACTIVE
        mock_tenant.trial_expired = False
        mock_tenant.has_exceeded_user_limit = False
        mock_tenant.has_exceeded_api_limit = False
        mock_tenant.has_exceeded_storage_limit = False

        # Mock user - needs to accept parameters like get_current_user
        async def override_user(request=None, token=None, api_key=None, credentials=None):
            return UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["tenants:write"],
                tenant_id=None,
                is_platform_admin=True,  # Required when tenant_id is None
                roles=["platform_admin"],
            )

        # Mock database
        async def override_db():
            mock_session = AsyncMock()
            yield mock_session

        # Mock service
        async def override_service():
            service = AsyncMock(spec=TenantService)
            service.create_tenant = AsyncMock(return_value=mock_tenant)
            return service

        # Create a fresh FastAPI app for this test
        app = FastAPI()
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_async_session] = override_db
        app.dependency_overrides[get_tenant_service] = override_service
        app.include_router(tenant_router, prefix="/api/v1", tags=["tenants"])

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.post(
                    "/api/v1/tenants",
                    json={
                        "name": "Test Org",
                        "slug": "test-org",
                        "email": "test@example.com",
                        "plan_type": "free",  # Valid enum value
                    },
                )

                # This should hit lines 67-77 (response property assignments)
                if response.status_code != 201:
                    print(f"Response status: {response.status_code}")
                    print(f"Response body: {response.text}")
                assert response.status_code == 201
                data = response.json()
                assert data["id"] == "tenant-123"
                assert "is_trial" in data
                assert "is_active" in data
        finally:
            app.dependency_overrides.clear()


@pytest.mark.unit
class TestTenantRouterErrorHandlers:
    """Test error handling paths (lines 77, 154, 283, etc)."""

    async def test_create_tenant_already_exists_error(self):
        """Test creating tenant when slug already exists (line 77)."""
        from dotmac.platform.tenant.router import get_tenant_service

        async def override_user(request=None, token=None, api_key=None, credentials=None):
            return UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["tenants:write"],
                tenant_id=None,
                is_platform_admin=True,
                roles=["platform_admin"],
            )

        async def override_db():
            mock_session = AsyncMock()
            yield mock_session

        async def override_service():
            service = AsyncMock(spec=TenantService)
            service.create_tenant = AsyncMock(
                side_effect=TenantAlreadyExistsError("Tenant with slug 'test-org' already exists")
            )
            return service

        # Create a fresh FastAPI app for this test
        app = FastAPI()
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_async_session] = override_db
        app.dependency_overrides[get_tenant_service] = override_service
        app.include_router(tenant_router, prefix="/api/v1", tags=["tenants"])

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.post(
                    "/api/v1/tenants",
                    json={
                        "name": "Test Org",
                        "slug": "test-org",
                        "email": "test@example.com",
                        "plan_type": "free",  # Valid enum value
                    },
                )

                # This should hit line 77 (TenantAlreadyExistsError handler)
                assert response.status_code == 409
                assert "already exists" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    async def test_get_tenant_not_found_error(self):
        """Test getting non-existent tenant (line 154)."""
        from dotmac.platform.tenant.router import get_tenant_service

        async def override_user(request=None, token=None, api_key=None, credentials=None):
            return UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["tenants:read"],
                tenant_id=None,
                is_platform_admin=True,
                roles=["platform_admin"],
            )

        async def override_db():
            mock_session = AsyncMock()
            yield mock_session

        async def override_service():
            service = AsyncMock(spec=TenantService)
            service.get_tenant = AsyncMock(
                side_effect=TenantNotFoundError("Tenant with ID 'nonexistent' not found")
            )
            return service

        # Create a fresh FastAPI app for this test
        app = FastAPI()
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_async_session] = override_db
        app.dependency_overrides[get_tenant_service] = override_service
        app.include_router(tenant_router, prefix="/api/v1", tags=["tenants"])

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.get("/api/v1/tenants/nonexistent")

                # This should hit line 154 (TenantNotFoundError handler in get_tenant)
                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    async def test_update_tenant_not_found_error(self):
        """Test updating non-existent tenant."""
        from dotmac.platform.tenant.router import get_tenant_service

        async def override_user(request=None, token=None, api_key=None, credentials=None):
            return UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["tenants:write"],
                tenant_id=None,
                is_platform_admin=True,
                roles=["platform_admin"],
            )

        async def override_db():
            mock_session = AsyncMock()
            yield mock_session

        async def override_service():
            service = AsyncMock(spec=TenantService)
            service.update_tenant = AsyncMock(
                side_effect=TenantNotFoundError("Tenant with ID 'nonexistent' not found")
            )
            return service

        # Create a fresh FastAPI app for this test
        app = FastAPI()
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_async_session] = override_db
        app.dependency_overrides[get_tenant_service] = override_service
        app.include_router(tenant_router, prefix="/api/v1", tags=["tenants"])

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.patch(
                    "/api/v1/tenants/nonexistent",
                    json={"name": "Updated Name"},
                )

                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    async def test_delete_tenant_not_found_error(self):
        """Test deleting non-existent tenant (line 283)."""
        from dotmac.platform.tenant.router import get_tenant_service

        async def override_user(request=None, token=None, api_key=None, credentials=None):
            return UserInfo(
                user_id="test-user",
                username="testuser",
                email="test@example.com",
                permissions=["tenants:delete"],
                tenant_id=None,
                is_platform_admin=True,
                roles=["platform_admin"],
            )

        async def override_db():
            mock_session = AsyncMock()
            yield mock_session

        async def override_service():
            service = AsyncMock(spec=TenantService)
            service.delete_tenant = AsyncMock(
                side_effect=TenantNotFoundError("Tenant with ID 'nonexistent' not found")
            )
            return service

        # Create a fresh FastAPI app for this test
        app = FastAPI()
        app.dependency_overrides[get_current_user] = override_user
        app.dependency_overrides[get_async_session] = override_db
        app.dependency_overrides[get_tenant_service] = override_service
        app.include_router(tenant_router, prefix="/api/v1", tags=["tenants"])

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as client:
                response = await client.delete("/api/v1/tenants/nonexistent")

                # This should hit line 283 (TenantNotFoundError handler in delete_tenant)
                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()
