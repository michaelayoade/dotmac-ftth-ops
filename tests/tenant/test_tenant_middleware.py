"""
Test tenant middleware for both single and multi-tenant modes.
"""

import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from dotmac.platform.tenant import (
    TenantConfiguration,
    TenantMiddleware,
    TenantMode,
)


@pytest.fixture
def single_tenant_config():
    """Create single-tenant configuration."""
    return TenantConfiguration(mode=TenantMode.SINGLE, default_tenant_id="single-tenant-org")


@pytest.fixture
def multi_tenant_config():
    """Create multi-tenant configuration."""
    return TenantConfiguration(
        mode=TenantMode.MULTI,
        default_tenant_id="default-org",
        require_tenant_header=True,
    )


@pytest.fixture
def multi_tenant_optional_config():
    """Create multi-tenant configuration with optional header."""
    return TenantConfiguration(
        mode=TenantMode.MULTI, default_tenant_id="default-org", require_tenant_header=False
    )


def create_test_app(config: TenantConfiguration) -> TestClient:
    """Create a test FastAPI app with tenant middleware."""
    app = FastAPI()
    app.add_middleware(TenantMiddleware, config=config)

    @app.get("/test")
    @pytest.mark.asyncio
    async def test_endpoint(request: Request):
        """Test endpoint that returns the tenant ID."""
        return {"tenant_id": getattr(request.state, "tenant_id", None)}

    @app.get("/health")
    async def health_endpoint(request: Request):
        """Health endpoint (exempt from tenant requirements)."""
        tenant_id = getattr(request.state, "tenant_id", None)
        return {"status": "healthy", "tenant_id": tenant_id}

    return TestClient(app)


@pytest.mark.integration
class TestSingleTenantMode:
    """Test middleware in single-tenant mode."""

    def test_single_tenant_always_sets_default(self, single_tenant_config):
        """Test that single-tenant mode always uses default tenant."""
        client = create_test_app(single_tenant_config)

        # Without any headers
        response = client.get("/test")
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "single-tenant-org"

        # Even with tenant header (should be ignored)
        response = client.get("/test", headers={"X-Tenant-ID": "other-tenant"})
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "single-tenant-org"

        # With query parameter (should be ignored)
        response = client.get("/test?tenant_id=another-tenant")
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "single-tenant-org"

    def test_single_tenant_exempt_paths(self, single_tenant_config):
        """Test that exempt paths still get tenant ID in single-tenant mode."""
        client = create_test_app(single_tenant_config)

        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "single-tenant-org"


@pytest.mark.integration
class TestMultiTenantMode:
    """Test middleware in multi-tenant mode."""

    def test_multi_tenant_requires_header(self, multi_tenant_config):
        """Test that multi-tenant mode requires tenant identification."""
        client = create_test_app(multi_tenant_config)

        # Without tenant ID - should fail
        response = client.get("/test")
        assert response.status_code == 400
        assert "Tenant ID is required" in response.json()["detail"]

    def test_multi_tenant_with_header(self, multi_tenant_config):
        """Test multi-tenant with header."""
        client = create_test_app(multi_tenant_config)

        response = client.get("/test", headers={"X-Tenant-ID": "tenant-123"})
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "tenant-123"

    def test_multi_tenant_with_query_param(self, multi_tenant_config):
        """Test multi-tenant with query parameter."""
        client = create_test_app(multi_tenant_config)

        response = client.get("/test?tenant_id=tenant-456")
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "tenant-456"

    def test_multi_tenant_header_takes_precedence(self, multi_tenant_config):
        """Test that header takes precedence over query param."""
        client = create_test_app(multi_tenant_config)

        response = client.get("/test?tenant_id=from-query", headers={"X-Tenant-ID": "from-header"})
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "from-header"

    def test_multi_tenant_exempt_paths(self, multi_tenant_config):
        """Test that exempt paths don't require tenant ID."""
        client = create_test_app(multi_tenant_config)

        # Health check should work without tenant
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["tenant_id"] is None


@pytest.mark.integration
class TestMultiTenantOptionalMode:
    """Test middleware in multi-tenant mode with optional header."""

    def test_multi_tenant_optional_without_header(self, multi_tenant_optional_config):
        """Test multi-tenant optional mode falls back to default."""
        client = create_test_app(multi_tenant_optional_config)

        response = client.get("/test")
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "default-org"

    def test_multi_tenant_optional_with_header(self, multi_tenant_optional_config):
        """Test multi-tenant optional mode uses provided tenant."""
        client = create_test_app(multi_tenant_optional_config)

        response = client.get("/test", headers={"X-Tenant-ID": "custom-org"})
        assert response.status_code == 200
        assert response.json()["tenant_id"] == "custom-org"


@pytest.mark.integration
class TestCustomConfiguration:
    """Test custom configuration options."""

    def test_custom_header_name(self):
        """Test custom header name configuration."""
        # Remove env vars so custom config is used
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TENANT_HEADER_NAME", None)
            os.environ.pop("TENANT_QUERY_PARAM", None)
            config = TenantConfiguration(
                mode=TenantMode.MULTI, tenant_header_name="X-Organization-ID"
            )
            client = create_test_app(config)

            # Old header name shouldn't work
            response = client.get("/test", headers={"X-Tenant-ID": "org-123"})
            assert response.status_code == 400

            # Custom header name should work
            response = client.get("/test", headers={"X-Organization-ID": "org-123"})
            assert response.status_code == 200
            assert response.json()["tenant_id"] == "org-123"

    def test_custom_query_param(self):
        """Test custom query parameter name."""
        # Remove env vars so custom config is used
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TENANT_HEADER_NAME", None)
            os.environ.pop("TENANT_QUERY_PARAM", None)
            config = TenantConfiguration(mode=TenantMode.MULTI, tenant_query_param="org_id")
            client = create_test_app(config)

            # Old query param shouldn't work
            response = client.get("/test?tenant_id=org-456")
            assert response.status_code == 400

            # Custom query param should work
            response = client.get("/test?org_id=org-456")
            assert response.status_code == 200
            assert response.json()["tenant_id"] == "org-456"
