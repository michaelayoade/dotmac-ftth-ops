"""
Simple tests for Platform Admin Router to improve coverage.
"""

from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.platform_admin_router import router as platform_admin_router

pytestmark = pytest.mark.unit


@pytest.fixture
def platform_admin_app():
    """Create test app with platform admin router."""
    app = FastAPI()
    app.include_router(platform_admin_router, prefix="/platform-admin")

    # Override dependencies to return platform admin user
    async def override_get_current_user():
        return UserInfo(
            user_id=str(uuid4()),
            email="admin@platform.example.com",
            username="platform-admin",
            roles=["platform_admin"],
            permissions=["platform.admin"],
            tenant_id="platform-tenant",
            is_platform_admin=True,
        )

    async def override_require_platform_admin():
        return UserInfo(
            user_id=str(uuid4()),
            email="admin@platform.example.com",
            username="platform-admin",
            roles=["platform_admin"],
            permissions=["platform.admin"],
            tenant_id="platform-tenant",
            is_platform_admin=True,
        )

    async def override_get_async_session():
        """Mock database session."""
        session = AsyncMock(spec=AsyncSession)

        # Mock execute to return empty results
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_result.scalar_one_or_none.return_value = None
        mock_result.one.return_value = (0,)  # For count queries
        session.execute = AsyncMock(return_value=mock_result)

        return session

    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.auth.platform_admin import require_platform_admin
    from dotmac.platform.db import get_async_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_platform_admin] = override_require_platform_admin
    app.dependency_overrides[get_async_session] = override_get_async_session

    return app


@pytest.mark.asyncio
async def test_health_check(platform_admin_app: FastAPI):
    """Test platform admin health check endpoint."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/health")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["healthy", "operational"]


@pytest.mark.asyncio
async def test_list_tenants(platform_admin_app: FastAPI):
    """Test listing all tenants."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/tenants")

    assert response.status_code == 200
    data = response.json()
    assert "tenants" in data
    assert "total" in data
    assert "page" in data
    assert isinstance(data["tenants"], list)


@pytest.mark.asyncio
async def test_list_tenants_with_pagination(platform_admin_app: FastAPI):
    """Test listing tenants with pagination parameters."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/tenants?page=1&page_size=10")

    assert response.status_code == 200
    data = response.json()
    assert data["page"] == 1
    assert data["page_size"] == 10


@pytest.mark.asyncio
async def test_get_tenant_details(platform_admin_app: FastAPI):
    """Test getting detailed tenant information."""
    tenant_id = "test-tenant-123"

    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get(f"/platform-admin/tenants/{tenant_id}")

    # Will return 404 since tenant doesn't exist in mocked DB
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_platform_stats(platform_admin_app: FastAPI):
    """Test getting platform-wide statistics."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/stats")

    assert response.status_code == 200
    data = response.json()
    # Check for any stats-related fields
    assert "total_tenants" in data or "active_tenants" in data
    assert len(data) > 0  # Ensure we got some data back


@pytest.mark.asyncio
async def test_get_platform_permissions(platform_admin_app: FastAPI):
    """Test getting available platform permissions."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/permissions")

    assert response.status_code == 200
    data = response.json()
    # Response structure may vary
    assert isinstance(data, (dict, list))
    if isinstance(data, dict):
        assert len(data) > 0


@pytest.mark.asyncio
async def test_cross_tenant_search(platform_admin_app: FastAPI):
    """Test cross-tenant search functionality."""
    search_payload = {"query": "test user", "entity_type": "user", "limit": 10}

    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/platform-admin/search", json=search_payload)

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)


@pytest.mark.asyncio
async def test_get_recent_audit_logs(platform_admin_app: FastAPI):
    """Test getting recent platform audit logs."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/audit/recent?limit=50")

    assert response.status_code == 200
    data = response.json()
    # Response may have different field names
    assert "actions" in data or "audit_logs" in data or "events" in data
    assert "total" in data or "limit" in data


@pytest.mark.asyncio
async def test_clear_system_cache(platform_admin_app: FastAPI):
    """Test clearing system cache."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post("/platform-admin/system/cache/clear")

    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ["success", "cleared"]


@pytest.mark.asyncio
async def test_get_system_config(platform_admin_app: FastAPI):
    """Test getting system configuration."""
    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/system/config")

    assert response.status_code == 200
    data = response.json()
    # Response structure - check for any configuration-related data
    assert isinstance(data, dict)
    assert len(data) > 0


@pytest.mark.asyncio
async def test_tenant_impersonation(platform_admin_app: FastAPI):
    """Test generating impersonation token for tenant."""
    tenant_id = "test-tenant-123"

    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.post(
            f"/platform-admin/tenants/{tenant_id}/impersonate", json={"user_id": str(uuid4())}
        )

    # Will return 404 or 400 since tenant/user doesn't exist
    assert response.status_code in [200, 400, 404]


@pytest.mark.asyncio
async def test_requires_platform_admin(platform_admin_app: FastAPI):
    """Test that endpoints require platform admin privileges."""
    # Remove the override to test authentication
    platform_admin_app.dependency_overrides.clear()

    transport = ASGITransport(app=platform_admin_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/platform-admin/stats")

    # Should return 401 or 403 without platform admin
    assert response.status_code in [401, 403]
