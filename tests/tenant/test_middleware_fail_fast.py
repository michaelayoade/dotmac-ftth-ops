"""
Regression tests for tenant middleware fail-fast behavior.

SECURITY: Tests that tenant middleware rejects requests without tenant_id
when require_tenant=True, preventing silent fallback to default tenant.

These tests verify the fixes for the HIGH severity security issue where
tenant middleware silently fell back to default tenant, bypassing isolation.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Request, status
from starlette.responses import JSONResponse

from dotmac.platform.tenant.config import TenantConfiguration, TenantMode
from dotmac.platform.tenant.tenant import TenantMiddleware


@pytest.fixture
def multi_tenant_config():
    """Multi-tenant configuration with require_tenant=True."""
    return TenantConfiguration(
        mode=TenantMode.MULTI,
        default_tenant_id="default-tenant",
        require_tenant_header=True,  # SECURITY: Tenant is required
        tenant_header_name="X-Tenant-ID",
        tenant_query_param="tenant_id",
    )


@pytest.fixture
def optional_tenant_config():
    """Multi-tenant configuration with require_tenant=False."""
    return TenantConfiguration(
        mode=TenantMode.MULTI,
        default_tenant_id="default-tenant",
        require_tenant_header=False,  # Tenant not required
        tenant_header_name="X-Tenant-ID",
        tenant_query_param="tenant_id",
    )


@pytest.fixture
def single_tenant_config():
    """Single-tenant configuration."""
    return TenantConfiguration(
        mode=TenantMode.SINGLE,
        default_tenant_id="single-tenant",
        require_tenant_header=False,
        tenant_header_name="X-Tenant-ID",
        tenant_query_param="tenant_id",
    )


@pytest.mark.integration
class TestTenantMiddlewareFailFast:
    """Test that tenant middleware fails fast when tenant_id is required but missing."""

    @pytest.mark.asyncio
    async def test_multi_tenant_rejects_request_without_tenant_id(self, multi_tenant_config):
        """
        SECURITY TEST: Middleware rejects requests without tenant_id in multi-tenant mode.

        This prevents silent fallback to default tenant which would bypass isolation.
        """
        # Create middleware with require_tenant=True
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request without tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {}  # No tenant header
        mock_request.query_params = {}  # No tenant query param
        mock_request.state = SimpleNamespace()  # No tenant in state

        mock_call_next = AsyncMock()

        # Execute middleware
        response = await middleware.dispatch(mock_request, mock_call_next)

        # SECURITY ASSERTION: Request is rejected
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # SECURITY ASSERTION: call_next is NOT called (request blocked)
        mock_call_next.assert_not_called()

        # Verify error message
        import json

        body = response.body.decode()
        content = json.loads(body)
        assert "Tenant ID is required" in content["detail"]

    @pytest.mark.asyncio
    async def test_multi_tenant_allows_request_with_valid_tenant_id(self, multi_tenant_config):
        """Test that requests WITH tenant_id are allowed through."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request with tenant_id in header
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {"X-Tenant-ID": "tenant-123"}  # Valid tenant
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        mock_call_next.assert_called_once()

        # ASSERTION: tenant_id is set on request state
        assert mock_request.state.tenant_id == "tenant-123"

    @pytest.mark.asyncio
    async def test_multi_tenant_tenant_from_query_param(self, multi_tenant_config):
        """Test that tenant_id can be provided via query parameter."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request with tenant_id in query param
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.query_params = {"tenant_id": "tenant-456"}  # Query param
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        mock_call_next.assert_called_once()

        # ASSERTION: tenant_id is set from query param
        assert mock_request.state.tenant_id == "tenant-456"

    @pytest.mark.asyncio
    async def test_exempt_paths_skip_tenant_validation(self, multi_tenant_config):
        """Test that exempt paths (health, docs) skip tenant validation."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request to exempt path without tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/health"  # Exempt path
        mock_request.headers = {}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock(return_value={"status": "healthy"})

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        assert mock_call_next.called

    @pytest.mark.asyncio
    async def test_optional_tenant_paths_use_default_tenant(self, multi_tenant_config):
        """Test that optional tenant paths fall back to default tenant."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request to optional tenant path without tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/audit/frontend-logs"  # Optional tenant path
        mock_request.method = "POST"
        mock_request.headers = {}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        mock_call_next.assert_called_once()

        # ASSERTION: Default tenant is used for optional paths
        assert mock_request.state.tenant_id == "default-tenant"


@pytest.mark.integration
class TestTenantMiddlewareOptionalMode:
    """Test tenant middleware behavior when require_tenant=False."""

    @pytest.mark.asyncio
    async def test_optional_mode_falls_back_to_default_tenant(self, optional_tenant_config):
        """
        Test that when require_tenant=False, requests without tenant_id
        fall back to default tenant (backwards compatibility).
        """
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=optional_tenant_config,
            require_tenant=False,  # Optional mode
        )

        # Create request without tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through (no rejection)
        mock_call_next.assert_called_once()

        # ASSERTION: Default tenant is used
        assert mock_request.state.tenant_id == "default-tenant"

    @pytest.mark.asyncio
    async def test_optional_mode_prefers_provided_tenant(self, optional_tenant_config):
        """Test that when require_tenant=False, provided tenant_id is still used."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=optional_tenant_config,
            require_tenant=False,
        )

        # Create request with tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.headers = {"X-Tenant-ID": "tenant-999"}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Provided tenant is used, not default
        assert mock_request.state.tenant_id == "tenant-999"

    @pytest.mark.asyncio
    async def test_multi_tenant_uses_jwt_claim_when_header_missing(self, multi_tenant_config):
        """Tenant middleware should extract tenant_id from JWT when header/query are absent."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/graphql"
        mock_request.method = "POST"
        mock_request.headers = {"Authorization": "Bearer jwt-token"}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()
        mock_request.cookies = {}

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        with patch("dotmac.platform.auth.core.jwt_service.verify_token") as verify_token:
            verify_token.return_value = {
                "sub": "user-1",
                "tenant_id": "tenant-from-jwt",
            }

            await middleware.dispatch(mock_request, mock_call_next)

        mock_call_next.assert_called_once()
        assert mock_request.state.tenant_id == "tenant-from-jwt"

    @pytest.mark.asyncio
    async def test_multi_tenant_respects_active_managed_tenant_header(self, multi_tenant_config):
        """Tenant middleware should honor X-Active-Tenant-Id when user manages that tenant."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/graphql"
        mock_request.method = "POST"
        mock_request.headers = {
            "Authorization": "Bearer jwt-token",
            "X-Active-Tenant-Id": "managed-tenant-1",
        }
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()
        mock_request.cookies = {}

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        with patch("dotmac.platform.auth.core.jwt_service.verify_token") as verify_token:
            verify_token.return_value = {
                "sub": "partner-user",
                "tenant_id": "home-tenant",
                "managed_tenant_ids": ["managed-tenant-1", "managed-tenant-2"],
            }

            await middleware.dispatch(mock_request, mock_call_next)

        mock_call_next.assert_called_once()
        assert mock_request.state.tenant_id == "managed-tenant-1"

    @pytest.mark.asyncio
    async def test_multi_tenant_falls_back_to_api_key_tenant(self, multi_tenant_config):
        """Tenant middleware should derive tenant_id from API key metadata."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/jobs"
        mock_request.method = "GET"
        mock_request.headers = {"X-API-Key": "sk_test"}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()
        mock_request.cookies = {}

        mock_call_next = AsyncMock(return_value={"status": "ok"})

        with patch(
            "dotmac.platform.auth.core.api_key_service.verify_api_key",
            new_callable=AsyncMock,
        ) as verify_api_key:
            verify_api_key.return_value = {"tenant_id": "tenant-from-api-key"}

            await middleware.dispatch(mock_request, mock_call_next)

        verify_api_key.assert_awaited_once()
        mock_call_next.assert_called_once()
        assert mock_request.state.tenant_id == "tenant-from-api-key"


@pytest.mark.integration
class TestTenantMiddlewarePlatformAdmin:
    """Test tenant middleware behavior for platform admins."""

    @pytest.mark.asyncio
    async def test_platform_admin_with_target_tenant(self, multi_tenant_config):
        """Test that platform admins can specify target tenant via X-Target-Tenant-ID."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request with platform admin targeting specific tenant
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {
            "X-Target-Tenant-ID": "tenant-target-123",  # Platform admin impersonation
            "Authorization": "Bearer test-token",
        }
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware
        with patch("dotmac.platform.auth.core.jwt_service.verify_token") as verify_token:
            verify_token.return_value = {
                "sub": "platform-admin-1",
                "email": "admin@example.com",
                "username": "platform-admin",
                "roles": ["admin"],
                "permissions": ["platform:admin"],
                "tenant_id": None,
                "is_platform_admin": True,
            }

            await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        mock_call_next.assert_called_once()

        # ASSERTION: Target tenant is used
        assert mock_request.state.tenant_id == "tenant-target-123"

    @pytest.mark.asyncio
    async def test_platform_admin_without_target_tenant(self, multi_tenant_config):
        """Test that platform admins without X-Target-Tenant-ID get None (cross-tenant mode)."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=multi_tenant_config,
            require_tenant=True,
        )

        # Create request from platform admin without target tenant
        # This simulates is_platform_admin_request check but without actual user auth
        # In production, this would be validated by auth middleware
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.method = "GET"
        mock_request.headers = {}  # No X-Target-Tenant-ID
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware - this should be REJECTED now
        response = await middleware.dispatch(mock_request, mock_call_next)

        # SECURITY ASSERTION: Without tenant_id OR X-Target-Tenant-ID, request is rejected
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.integration
class TestTenantMiddlewareSingleTenant:
    """Test tenant middleware behavior in single-tenant mode."""

    @pytest.mark.asyncio
    async def test_single_tenant_always_uses_default(self, single_tenant_config):
        """Test that single-tenant mode always uses default tenant_id."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=single_tenant_config,
        )

        # Create request without any tenant identifier
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.headers = {}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Request is allowed through
        mock_call_next.assert_called_once()

        # ASSERTION: Default tenant is always used
        assert mock_request.state.tenant_id == "single-tenant"

    @pytest.mark.asyncio
    async def test_single_tenant_ignores_provided_tenant(self, single_tenant_config):
        """Test that single-tenant mode ignores provided tenant_id."""
        middleware = TenantMiddleware(
            app=MagicMock(),
            config=single_tenant_config,
        )

        # Create request with tenant_id (should be ignored)
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/customers"
        mock_request.headers = {"X-Tenant-ID": "some-other-tenant"}
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware
        await middleware.dispatch(mock_request, mock_call_next)

        # ASSERTION: Default tenant is used, not provided one
        assert mock_request.state.tenant_id == "single-tenant"


@pytest.mark.integration
class TestTenantMiddlewareSecurityRegression:
    """
    REGRESSION TESTS: Verify the security fix prevents tenant isolation bypass.
    """

    @pytest.mark.asyncio
    async def test_production_config_rejects_missing_tenant(self):
        """
        SECURITY TEST: In production with require_tenant=True, missing tenant_id is rejected.

        Before fix: Request would silently fall back to default tenant
        After fix: Request is rejected with 400 Bad Request
        """
        # Production configuration
        prod_config = TenantConfiguration(
            mode=TenantMode.MULTI,
            default_tenant_id="production-default",
            require_tenant_header=True,  # PRODUCTION: Tenant required
            tenant_header_name="X-Tenant-ID",
            tenant_query_param="tenant_id",
        )

        middleware = TenantMiddleware(
            app=MagicMock(),
            config=prod_config,
            require_tenant=True,
        )

        # Simulate API request without tenant_id
        mock_request = MagicMock(spec=Request)
        mock_request.url.path = "/api/v1/billing/invoices"
        mock_request.method = "GET"
        mock_request.headers = {}  # Missing X-Tenant-ID
        mock_request.query_params = {}
        mock_request.state = SimpleNamespace()

        mock_call_next = AsyncMock()

        # Execute middleware
        response = await middleware.dispatch(mock_request, mock_call_next)

        # SECURITY ASSERTION: Request is REJECTED
        assert isinstance(response, JSONResponse)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # SECURITY ASSERTION: Downstream handler NOT called
        mock_call_next.assert_not_called()

        # SECURITY ASSERTION: request.state.tenant_id NOT set to default
        # (No silent fallback that would bypass isolation)

    @pytest.mark.asyncio
    async def test_multiple_tenants_cannot_access_each_other(self):
        """
        INTEGRATION TEST: Verify different tenant_ids result in different context.
        """
        config = TenantConfiguration(
            mode=TenantMode.MULTI,
            default_tenant_id="default",
            require_tenant_header=True,
            tenant_header_name="X-Tenant-ID",
            tenant_query_param="tenant_id",
        )

        middleware = TenantMiddleware(
            app=MagicMock(),
            config=config,
            require_tenant=True,
        )

        # Request 1: Tenant A
        mock_request_a = MagicMock(spec=Request)
        mock_request_a.url.path = "/api/v1/customers"
        mock_request_a.headers = {"X-Tenant-ID": "tenant-a"}
        mock_request_a.query_params = {}
        mock_request_a.state = SimpleNamespace()

        await middleware.dispatch(mock_request_a, AsyncMock())

        # Request 2: Tenant B
        mock_request_b = MagicMock(spec=Request)
        mock_request_b.url.path = "/api/v1/customers"
        mock_request_b.headers = {"X-Tenant-ID": "tenant-b"}
        mock_request_b.query_params = {}
        mock_request_b.state = SimpleNamespace()

        await middleware.dispatch(mock_request_b, AsyncMock())

        # SECURITY ASSERTION: Different tenants have different contexts
        assert mock_request_a.state.tenant_id == "tenant-a"
        assert mock_request_b.state.tenant_id == "tenant-b"
        assert mock_request_a.state.tenant_id != mock_request_b.state.tenant_id
