"""
Simple tests for API Keys Metrics Router to improve coverage.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from dotmac.platform.auth.api_keys_metrics_router import router as api_keys_metrics_router
from dotmac.platform.auth.core import UserInfo

pytestmark = pytest.mark.unit


@pytest.fixture
def metrics_app():
    """Create test app with API keys metrics router."""
    app = FastAPI()
    app.include_router(api_keys_metrics_router, prefix="/api-keys/metrics")

    # Create test user
    test_user = UserInfo(
        user_id=str(uuid4()),
        email="test@example.com",
        username="testuser",
        roles=["admin"],
        permissions=["api-keys:metrics:read"],  # Correct permission format
        tenant_id="test-tenant-123",
        is_platform_admin=False,
    )

    # Override get_current_user to return test user
    async def override_get_current_user():
        return test_user

    # Create mock database session
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(
        return_value=AsyncMock(
            scalars=AsyncMock(return_value=AsyncMock(all=AsyncMock(return_value=[])))
        )
    )

    async def override_get_async_session():
        return mock_db

    from dotmac.platform.auth.dependencies import get_current_user
    from dotmac.platform.db import get_async_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_async_session] = override_get_async_session

    return app


@pytest.mark.asyncio
async def test_get_api_key_metrics_success(metrics_app: FastAPI):
    """Test successful API key metrics retrieval."""
    # Patch RBAC service to bypass permission checks
    with (
        patch(
            "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
            return_value=True,
        ),
        patch(
            "dotmac.platform.auth.api_keys_metrics_router._fetch_all_api_keys_metadata"
        ) as mock_fetch,
    ):
        # Return empty list to simulate no API keys
        mock_fetch.return_value = []

        transport = ASGITransport(app=metrics_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api-keys/metrics/metrics")

        # Should return 200 even with no data
        assert response.status_code == 200
        data = response.json()

        # Verify response structure
        assert "total_keys" in data
        assert "active_keys" in data
        assert "inactive_keys" in data
        assert "expired_keys" in data
        assert "keys_created_last_30d" in data
        assert "keys_used_last_7d" in data
        assert "period" in data
        assert "timestamp" in data

        # With no keys, all counts should be 0
        assert data["total_keys"] == 0
        assert data["active_keys"] == 0
        assert data["never_used_keys"] == 0


@pytest.mark.asyncio
async def test_get_api_key_metrics_with_data(metrics_app: FastAPI):
    """Test API key metrics with sample data."""
    now = datetime.now(UTC)
    sample_keys = [
        {
            "key_id": "key-1",
            "is_active": True,
            "created_at": now.isoformat(),
            "last_used_at": now.isoformat(),
            "expires_at": (now.replace(year=now.year + 1)).isoformat(),
            "scopes": ["read:data", "write:data"],
            "request_count": 100,
            "tenant_id": "test-tenant-123",  # Add tenant_id to match filtering
        },
        {
            "key_id": "key-2",
            "is_active": False,
            "created_at": now.isoformat(),
            "last_used_at": None,
            "expires_at": None,
            "scopes": ["read:data"],
            "request_count": 0,
            "tenant_id": "test-tenant-123",  # Add tenant_id to match filtering
        },
    ]

    # Patch RBAC service to bypass permission checks
    with (
        patch(
            "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
            return_value=True,
        ),
        patch(
            "dotmac.platform.auth.api_keys_metrics_router._fetch_all_api_keys_metadata",
            new_callable=AsyncMock,
        ) as mock_fetch,
    ):
        # AsyncMock properly handles async functions
        mock_fetch.return_value = sample_keys

        transport = ASGITransport(app=metrics_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api-keys/metrics/metrics?period_days=30")

        assert response.status_code == 200
        data = response.json()

        # Should have 2 total keys
        assert data["total_keys"] == 2
        assert data["active_keys"] == 1
        assert data["inactive_keys"] == 1


@pytest.mark.asyncio
async def test_get_api_key_metrics_custom_period(metrics_app: FastAPI):
    """Test API key metrics with custom time period."""
    # Patch RBAC service to bypass permission checks
    with (
        patch(
            "dotmac.platform.auth.rbac_service.RBACService.user_has_all_permissions",
            return_value=True,
        ),
        patch(
            "dotmac.platform.auth.api_keys_metrics_router._fetch_all_api_keys_metadata"
        ) as mock_fetch,
    ):
        mock_fetch.return_value = []

        transport = ASGITransport(app=metrics_app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.get("/api-keys/metrics/metrics?period_days=7")

        assert response.status_code == 200
        data = response.json()

        # Period should reflect the custom value
        assert "7 days" in data["period"] or "7" in data["period"]


@pytest.mark.asyncio
async def test_get_api_key_metrics_requires_authentication(metrics_app: FastAPI):
    """Test that metrics endpoint requires authentication."""
    # Remove the override to test authentication
    metrics_app.dependency_overrides.clear()

    transport = ASGITransport(app=metrics_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        response = await client.get("/api-keys/metrics/metrics")

    # Should return 401 or 403 without auth
    assert response.status_code in [401, 403]
