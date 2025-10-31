"""Tests for AppBoundaryMiddleware and SingleTenantMiddleware."""

from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException, Request, Response
from starlette.datastructures import Headers

from dotmac.platform.api.app_boundary_middleware import (
    AppBoundaryMiddleware,
    SingleTenantMiddleware,
)


@pytest.mark.unit
class TestAppBoundaryMiddleware:
    """Test AppBoundaryMiddleware route boundary enforcement."""

    @pytest.fixture
    def middleware(self):
        """Create AppBoundaryMiddleware instance."""
        app = Mock()
        return AppBoundaryMiddleware(app)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.url = Mock()
        request.headers = Headers({})
        request.state = Mock()
        return request

    async def call_next(self, request):
        """Mock call_next function."""
        return Response(content="OK", status_code=200)

    # ===== Public Route Tests =====

    @pytest.mark.asyncio
    async def test_public_routes_bypass_middleware(self, middleware, mock_request):
        """Test that public routes bypass boundary checks."""
        public_paths = [
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/public/status",
        ]

        for path in public_paths:
            mock_request.url.path = path
            response = await middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_health_routes_bypass_middleware(self, middleware, mock_request):
        """Test that health check routes bypass boundary checks."""
        health_paths = [
            "/health",
            "/ready",
            "/metrics",
        ]

        for path in health_paths:
            mock_request.url.path = path
            response = await middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200

    # ===== Platform Route Tests =====

    @pytest.mark.asyncio
    async def test_platform_route_requires_authentication(self, middleware, mock_request):
        """Test that platform routes require authentication."""
        mock_request.url.path = "/api/platform/v1/admin"
        mock_request.state.user = None
        mock_request.state.tenant_id = None

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, self.call_next)

        assert exc_info.value.status_code == 401
        assert "Authentication required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_platform_route_requires_platform_scope(self, middleware, mock_request):
        """Test that platform routes require platform scopes."""
        mock_request.url.path = "/api/platform/v1/tenants"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_user.scopes = ["isp_admin:read", "billing:write"]  # No platform scopes
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = None

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, self.call_next)

        assert exc_info.value.status_code == 403
        assert "Platform access requires platform-level permissions" in str(
            exc_info.value.detail["error"]
        )

    @pytest.mark.asyncio
    async def test_platform_route_accepts_platform_scope(self, middleware, mock_request):
        """Test that platform routes accept valid platform scopes."""
        mock_request.url.path = "/api/platform/v1/admin"
        mock_user = Mock()
        mock_user.id = "admin-123"
        mock_user.scopes = ["platform:tenants:*", "platform_super_admin"]
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = None

        response = await middleware.dispatch(mock_request, self.call_next)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_platform_route_blocked_in_single_tenant_mode(self, middleware, mock_request):
        """Test that platform routes are blocked in single-tenant mode."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "single_tenant"

            mock_request.url.path = "/api/platform/v1/admin"
            mock_user = Mock()
            mock_user.id = "admin-123"
            mock_user.scopes = ["platform:*"]
            mock_request.state.user = mock_user
            mock_request.state.tenant_id = None

            with pytest.raises(HTTPException) as exc_info:
                await middleware.dispatch(mock_request, self.call_next)

            assert exc_info.value.status_code == 403
            assert "Platform routes are disabled in single-tenant deployment mode" in str(
                exc_info.value.detail["error"]
            )

    @pytest.mark.asyncio
    async def test_platform_scope_variations(self, middleware, mock_request):
        """Test various platform scope formats are recognized."""
        platform_scopes = [
            ["platform:*"],
            ["platform:tenants:read"],
            ["platform_super_admin"],
            ["platform_support"],
            ["platform_finance"],
            ["platform_partner_admin"],
            ["platform_observer"],
        ]

        mock_request.url.path = "/api/platform/v1/admin"
        mock_user = Mock()
        mock_user.id = "admin-123"
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = None

        for scopes in platform_scopes:
            mock_user.scopes = scopes
            response = await middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200, f"Failed for scopes: {scopes}"

    # ===== Tenant Route Tests =====

    @pytest.mark.asyncio
    async def test_tenant_route_requires_authentication(self, middleware, mock_request):
        """Test that tenant routes require authentication."""
        mock_request.url.path = "/api/tenant/v1/customers"
        mock_request.state.user = None
        mock_request.state.tenant_id = None

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, self.call_next)

        assert exc_info.value.status_code == 401
        assert "Authentication required" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_tenant_route_requires_tenant_context(self, middleware, mock_request):
        """Test that tenant routes require tenant_id context."""
        mock_request.url.path = "/api/tenant/v1/billing/invoices"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_user.scopes = ["billing:read"]
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = None  # Missing tenant context

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, self.call_next)

        assert exc_info.value.status_code == 400
        assert "Tenant context required" in str(exc_info.value.detail["error"])
        assert "X-Tenant-ID" in str(exc_info.value.detail["help"])

    @pytest.mark.asyncio
    async def test_tenant_route_requires_tenant_scope(self, middleware, mock_request):
        """Test that tenant routes require tenant-level scopes."""
        mock_request.url.path = "/api/tenant/v1/radius/sessions"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_user.scopes = ["public:read"]  # No tenant scopes
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = "tenant-456"

        with pytest.raises(HTTPException) as exc_info:
            await middleware.dispatch(mock_request, self.call_next)

        assert exc_info.value.status_code == 403
        assert "Insufficient permissions for tenant operations" in str(
            exc_info.value.detail["error"]
        )

    @pytest.mark.asyncio
    async def test_tenant_route_accepts_tenant_scope(self, middleware, mock_request):
        """Test that tenant routes accept valid tenant scopes."""
        mock_request.url.path = "/api/tenant/v1/network/devices"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_user.scopes = ["network:read", "network:write"]
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = "tenant-456"

        response = await middleware.dispatch(mock_request, self.call_next)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_tenant_route_accepts_platform_scope(self, middleware, mock_request):
        """Test that tenant routes accept platform scopes (for support)."""
        mock_request.url.path = "/api/tenant/v1/customers"
        mock_user = Mock()
        mock_user.id = "support-123"
        mock_user.scopes = ["platform_support"]  # Platform scope
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = "tenant-456"

        response = await middleware.dispatch(mock_request, self.call_next)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_tenant_scope_variations(self, middleware, mock_request):
        """Test various tenant scope formats are recognized."""
        tenant_scopes = [
            ["isp_admin:*"],
            ["network:read"],
            ["billing:write"],
            ["customer:*"],
            ["services:read"],
            ["reseller:write"],
            ["support:*"],
            ["ticket:read"],
            ["workflows:write"],
            ["jobs:*"],
            ["integrations:read"],
            ["plugins:write"],
            ["analytics:read"],
            ["audit:read"],
        ]

        mock_request.url.path = "/api/tenant/v1/customers"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = "tenant-456"

        for scopes in tenant_scopes:
            mock_user.scopes = scopes
            response = await middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200, f"Failed for scopes: {scopes}"

    # ===== Shared Route Tests =====

    @pytest.mark.asyncio
    async def test_shared_routes_bypass_boundary_checks(self, middleware, mock_request):
        """Test that shared /api/v1/* routes bypass boundary middleware."""
        mock_request.url.path = "/api/v1/users"
        mock_user = Mock()
        mock_user.id = "user-123"
        mock_user.scopes = ["user:read"]
        mock_request.state.user = mock_user
        mock_request.state.tenant_id = None

        # Should pass through without tenant_id requirement
        response = await middleware.dispatch(mock_request, self.call_next)
        assert response.status_code == 200

    # ===== Helper Method Tests =====

    def test_is_public_route(self, middleware):
        """Test public route detection."""
        assert middleware._is_public_route("/docs")
        assert middleware._is_public_route("/redoc")
        assert middleware._is_public_route("/openapi.json")
        assert middleware._is_public_route("/api/public/status")
        assert not middleware._is_public_route("/api/platform/v1/admin")

    def test_is_health_route(self, middleware):
        """Test health route detection."""
        assert middleware._is_health_route("/health")
        assert middleware._is_health_route("/ready")
        assert middleware._is_health_route("/metrics")
        assert not middleware._is_health_route("/api/v1/healthcheck")

    def test_is_platform_route(self, middleware):
        """Test platform route detection."""
        assert middleware._is_platform_route("/api/platform/v1/admin")
        assert middleware._is_platform_route("/api/platform/v1/tenants")
        assert not middleware._is_platform_route("/api/tenant/v1/customers")
        assert not middleware._is_platform_route("/api/v1/users")

    def test_is_tenant_route(self, middleware):
        """Test tenant route detection."""
        assert middleware._is_tenant_route("/api/tenant/v1/customers")
        assert middleware._is_tenant_route("/api/tenant/v1/radius/sessions")
        assert not middleware._is_tenant_route("/api/platform/v1/admin")
        assert not middleware._is_tenant_route("/api/v1/users")

    def test_has_platform_scope(self, middleware):
        """Test platform scope detection."""
        user_with_platform = Mock()
        user_with_platform.scopes = ["platform:*", "other:scope"]
        assert middleware._has_platform_scope(user_with_platform)

        user_with_platform_role = Mock()
        user_with_platform_role.scopes = ["platform_super_admin"]
        assert middleware._has_platform_scope(user_with_platform_role)

        user_without_platform = Mock()
        user_without_platform.scopes = ["isp_admin:*", "billing:read"]
        assert not middleware._has_platform_scope(user_without_platform)

        user_no_scopes = Mock()
        user_no_scopes.scopes = []
        assert not middleware._has_platform_scope(user_no_scopes)

        user_invalid = Mock()
        del user_invalid.scopes
        assert not middleware._has_platform_scope(user_invalid)

    def test_has_tenant_scope(self, middleware):
        """Test tenant scope detection."""
        user_with_tenant = Mock()
        user_with_tenant.scopes = ["isp_admin:*", "billing:read"]
        assert middleware._has_tenant_scope(user_with_tenant)

        user_with_platform = Mock()
        user_with_platform.scopes = ["platform_support"]
        # Platform users can access tenant routes
        assert middleware._has_tenant_scope(user_with_platform)

        user_without_tenant = Mock()
        user_without_tenant.scopes = ["public:read"]
        assert not middleware._has_tenant_scope(user_without_tenant)

        user_no_scopes = Mock()
        user_no_scopes.scopes = []
        assert not middleware._has_tenant_scope(user_no_scopes)


@pytest.mark.unit
class TestSingleTenantMiddleware:
    """Test SingleTenantMiddleware for single-tenant deployments."""

    @pytest.fixture
    def middleware(self):
        """Create SingleTenantMiddleware instance."""
        app = Mock()
        return SingleTenantMiddleware(app)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.url = Mock()
        request.url.path = "/api/tenant/v1/customers"
        request.state = Mock()
        return request

    async def call_next(self, request):
        """Mock call_next function."""
        return Response(content="OK", status_code=200)

    @pytest.mark.asyncio
    async def test_sets_tenant_id_in_single_tenant_mode(self, middleware, mock_request):
        """Test that middleware sets tenant_id from config in single-tenant mode."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "single_tenant"
            mock_settings.TENANT_ID = "fixed-tenant-123"

            response = await middleware.dispatch(mock_request, self.call_next)

            assert response.status_code == 200
            assert mock_request.state.tenant_id == "fixed-tenant-123"

    @pytest.mark.asyncio
    async def test_bypasses_in_multi_tenant_mode(self, middleware, mock_request):
        """Test that middleware bypasses in multi-tenant mode."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "multi_tenant"

            # Clear any existing tenant_id
            if hasattr(mock_request.state, "tenant_id"):
                delattr(mock_request.state, "tenant_id")

            response = await middleware.dispatch(mock_request, self.call_next)

            assert response.status_code == 200
            # tenant_id should NOT be set by middleware
            assert not hasattr(mock_request.state, "tenant_id")

    @pytest.mark.asyncio
    async def test_warns_if_tenant_id_missing(self, middleware, mock_request):
        """Test that middleware warns if TENANT_ID is not configured."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "single_tenant"
            mock_settings.TENANT_ID = None

            with patch("dotmac.platform.api.app_boundary_middleware.logger") as mock_logger:
                response = await middleware.dispatch(mock_request, self.call_next)

                assert response.status_code == 200
                mock_logger.warning.assert_called_once()
                assert "single_tenant_mode_missing_tenant_id" in str(mock_logger.warning.call_args)


@pytest.mark.unit
class TestMiddlewareIntegration:
    """Test middleware integration scenarios."""

    @pytest.fixture
    def app_middleware(self):
        """Create AppBoundaryMiddleware instance."""
        app = Mock()
        return AppBoundaryMiddleware(app)

    @pytest.fixture
    def tenant_middleware(self):
        """Create SingleTenantMiddleware instance."""
        app = Mock()
        return SingleTenantMiddleware(app)

    @pytest.fixture
    def mock_request(self):
        """Create mock Request object."""
        request = Mock(spec=Request)
        request.url = Mock()
        request.headers = Headers({})
        request.state = Mock()
        return request

    async def call_next(self, request):
        """Mock call_next function."""
        return Response(content="OK", status_code=200)

    @pytest.mark.asyncio
    async def test_single_tenant_mode_full_flow(
        self, app_middleware, tenant_middleware, mock_request
    ):
        """Test complete flow: SingleTenantMiddleware → AppBoundaryMiddleware → Route."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "single_tenant"
            mock_settings.TENANT_ID = "fixed-tenant-123"

            # Step 1: SingleTenantMiddleware sets tenant_id
            mock_request.url.path = "/api/tenant/v1/customers"
            await tenant_middleware.dispatch(mock_request, self.call_next)
            assert mock_request.state.tenant_id == "fixed-tenant-123"

            # Step 2: AppBoundaryMiddleware validates tenant route
            mock_user = Mock()
            mock_user.id = "user-456"
            mock_user.scopes = ["customer:read"]
            mock_request.state.user = mock_user

            response = await app_middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_multi_tenant_mode_platform_access(self, app_middleware, mock_request):
        """Test multi-tenant mode with platform admin access."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "multi_tenant"

            # Platform admin accessing platform routes
            mock_request.url.path = "/api/platform/v1/tenants"
            mock_user = Mock()
            mock_user.id = "admin-123"
            mock_user.scopes = ["platform:tenants:*"]
            mock_request.state.user = mock_user
            mock_request.state.tenant_id = None

            response = await app_middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_hybrid_mode_platform_support_tenant_access(self, app_middleware, mock_request):
        """Test hybrid mode: platform support accessing tenant routes."""
        with patch("dotmac.platform.api.app_boundary_middleware.settings") as mock_settings:
            mock_settings.DEPLOYMENT_MODE = "hybrid"

            # Platform support user accessing tenant route with tenant context
            mock_request.url.path = "/api/tenant/v1/radius/sessions"
            mock_user = Mock()
            mock_user.id = "support-123"
            mock_user.scopes = ["platform_support"]
            mock_request.state.user = mock_user
            mock_request.state.tenant_id = "tenant-456"

            response = await app_middleware.dispatch(mock_request, self.call_next)
            assert response.status_code == 200
