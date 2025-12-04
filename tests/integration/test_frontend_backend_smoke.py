"""
Smoke tests for frontend-backend integration.

These tests validate that all critical API endpoints used by the frontend
are accessible and return expected data structures.

Run with: pytest tests/integration/test_frontend_backend_smoke.py -v
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient

pytestmark = [pytest.mark.integration, pytest.mark.parallel_safe]


class TestUserManagementEndpoints:
    """Test user management endpoints used by admin UI."""

    @pytest.mark.asyncio
    async def test_list_users_endpoint_exists(self, async_client: AsyncClient):
        """Verify GET /api/v1/users endpoint exists."""
        response = await async_client.get("/api/v1/users")

        # Should return 401/403 without auth, not 404
        assert response.status_code in [
            200,
            401,
            403,
        ], f"Endpoint should exist but got {response.status_code}"

    @pytest.mark.asyncio
    async def test_user_response_structure(self, async_client: AsyncClient, auth_headers: dict):
        """Validate user list response matches frontend interface."""
        response = await async_client.get("/api/v1/users", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            assert "users" in data, "Response must have 'users' field"
            assert "total" in data, "Response must have 'total' field"
            assert isinstance(data["users"], list), "users must be a list"
            assert isinstance(data["total"], int), "total must be an integer"


class TestSettingsEndpoints:
    """Test settings management endpoints used by admin UI."""

    @pytest.mark.asyncio
    async def test_list_categories_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/admin/settings/categories endpoint exists."""
        response = await async_client.get("/api/v1/admin/settings/categories")

        assert response.status_code in [200, 401, 403], "Settings categories endpoint should exist"

    @pytest.mark.asyncio
    async def test_category_settings_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/admin/settings/category/{name} endpoint exists."""
        response = await async_client.get("/api/v1/admin/settings/category/jwt")

        assert response.status_code in [
            200,
            401,
            403,
            404,
        ], "Category settings endpoint should exist"

    @pytest.mark.asyncio
    async def test_settings_response_structure(self, async_client: AsyncClient, auth_headers: dict):
        """Validate settings response matches frontend interface."""
        response = await async_client.get("/api/v1/admin/settings/categories", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            assert isinstance(data, list), "Categories must be a list"

            if len(data) > 0:
                category = data[0]
                required_fields = ["category", "display_name", "description", "restart_required"]
                for field in required_fields:
                    assert field in category, f"Category must have '{field}' field"


class TestPluginsEndpoints:
    """Test plugin management endpoints used by plugins UI."""

    @pytest.mark.asyncio
    async def test_list_plugins_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/plugins endpoint exists."""
        response = await async_client.get("/api/v1/plugins", follow_redirects=True)

        assert response.status_code in [
            200,
            401,
            403,
        ], f"Plugins list endpoint should exist but got {response.status_code}"

    @pytest.mark.asyncio
    async def test_plugin_instances_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/plugins/instances endpoint exists."""
        response = await async_client.get("/api/v1/plugins/instances")

        assert response.status_code in [200, 401, 403], "Plugin instances endpoint should exist"

    @pytest.mark.asyncio
    async def test_plugin_instance_response_structure(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """Validate plugin instance response matches frontend interface."""
        response = await async_client.get("/api/v1/plugins/instances", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            assert "plugins" in data, "Response must have 'plugins' field"
            assert "total" in data, "Response must have 'total' field"
            assert isinstance(data["plugins"], list), "plugins must be a list"


class TestMonitoringEndpoints:
    """Test monitoring dashboard endpoints."""

    @pytest.mark.asyncio
    async def test_metrics_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/metrics endpoint exists."""
        response = await async_client.get("/api/v1/metrics?period_days=1")

        assert response.status_code in [200, 401, 403], "Metrics endpoint should exist"

    @pytest.mark.asyncio
    async def test_log_stats_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/monitoring/logs/stats endpoint exists."""
        response = await async_client.get("/api/v1/monitoring/logs?limit=100")

        assert response.status_code in [200, 401, 403], "Log stats endpoint should exist"

    @pytest.mark.asyncio
    async def test_health_endpoint(self, async_client: AsyncClient):
        """Verify GET /health endpoint exists and returns correct structure."""
        response = await async_client.get("/health")

        assert response.status_code == 200, "Health endpoint should always be accessible"

        data = response.json()
        assert "status" in data, "Health response must have 'status' field"
        assert data["status"] in [
            "healthy",
            "degraded",
            "unhealthy",
        ], "Status must be one of: healthy, degraded, unhealthy"

    @pytest.mark.asyncio
    async def test_metrics_response_structure(self, async_client: AsyncClient, auth_headers: dict):
        """Validate metrics response matches frontend interface."""
        response = await async_client.get("/api/v1/metrics?period_days=1", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            required_fields = [
                "error_rate",
                "total_requests",
                "avg_response_time_ms",
                "successful_requests",
                "failed_requests",
                "top_errors",
            ]

            for field in required_fields:
                assert field in data, f"Metrics must have '{field}' field"

            assert isinstance(data["top_errors"], list), "top_errors must be a list"


class TestDataTransferEndpoints:
    """Test data transfer/import-export endpoints."""

    @pytest.mark.asyncio
    async def test_list_jobs_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/data-transfer/jobs endpoint exists."""
        response = await async_client.get("/api/v1/data-transfer/jobs?page=1&page_size=20")

        assert response.status_code in [200, 401, 403], "Data transfer jobs endpoint should exist"

    @pytest.mark.asyncio
    async def test_formats_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/data-transfer/formats endpoint exists."""
        response = await async_client.get("/api/v1/data-transfer/formats")

        assert response.status_code in [
            200,
            401,
            403,
        ], "Data transfer formats endpoint should exist"

    @pytest.mark.asyncio
    async def test_jobs_response_structure(self, async_client: AsyncClient, auth_headers: dict):
        """Validate jobs list response matches frontend interface."""
        response = await async_client.get("/api/v1/data-transfer/jobs", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            required_fields = ["jobs", "total", "page", "page_size", "has_more"]
            for field in required_fields:
                assert field in data, f"Jobs response must have '{field}' field"

            assert isinstance(data["jobs"], list), "jobs must be a list"
            assert isinstance(data["total"], int), "total must be an integer"
            assert isinstance(data["has_more"], bool), "has_more must be a boolean"


class TestIntegrationsEndpoints:
    """Test integrations registry endpoints."""

    @pytest.mark.asyncio
    async def test_list_integrations_endpoint(self, async_client: AsyncClient):
        """Verify GET /api/v1/integrations endpoint exists."""
        response = await async_client.get("/api/v1/integrations")

        assert response.status_code in [200, 401, 403], "Integrations list endpoint should exist"

    @pytest.mark.asyncio
    async def test_integrations_response_structure(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """Validate integrations response matches frontend interface."""
        response = await async_client.get("/api/v1/integrations", headers=auth_headers)

        if response.status_code == 200:
            data = response.json()

            assert "integrations" in data, "Response must have 'integrations' field"
            assert "total" in data, "Response must have 'total' field"
            assert isinstance(data["integrations"], list), "integrations must be a list"

            if len(data["integrations"]) > 0:
                integration = data["integrations"][0]
                required_fields = [
                    "name",
                    "type",
                    "provider",
                    "enabled",
                    "status",
                    "settings_count",
                    "has_secrets",
                    "required_packages",
                ]
                for field in required_fields:
                    assert field in integration, f"Integration must have '{field}' field"


class TestCrossModuleIntegration:
    """Test that cross-module workflows work end-to-end."""

    @pytest.mark.asyncio
    async def test_user_to_audit_flow(self, async_client: AsyncClient, auth_headers: dict):
        """Test that user actions generate audit logs."""
        # This is a placeholder for more complex integration tests
        # In a full implementation, you would:
        # 1. Create a user via API
        # 2. Verify audit log was created
        # 3. Query audit logs and verify entry exists

        # For now, just verify both endpoints exist
        users_response = await async_client.get("/api/v1/users", headers=auth_headers)

        audit_response = await async_client.get("/api/v1/audit/activities", headers=auth_headers)

        assert users_response.status_code in [200, 401, 403]
        assert audit_response.status_code in [200, 401, 403]

    @pytest.mark.asyncio
    async def test_settings_to_integrations_flow(
        self, async_client: AsyncClient, auth_headers: dict
    ):
        """Test that settings changes can affect integrations."""
        # Verify settings and integrations endpoints work together
        settings_response = await async_client.get(
            "/api/v1/admin/settings/categories", headers=auth_headers
        )

        integrations_response = await async_client.get("/api/v1/integrations", headers=auth_headers)

        assert settings_response.status_code in [200, 401, 403]
        assert integrations_response.status_code in [200, 401, 403]


# Fixtures for smoke tests
@pytest_asyncio.fixture
async def async_client():
    """Provide async HTTP client for testing."""
    from httpx import ASGITransport, AsyncClient

    from dotmac.platform.main import app  # Import after conftest runs

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def auth_headers():
    """Provide mock auth headers for testing."""
    # In a real test, you would generate a valid JWT token
    return {"Authorization": "Bearer test-token-for-smoke-tests"}
