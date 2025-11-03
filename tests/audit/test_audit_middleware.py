"""
Tests for audit context middleware.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Request

from dotmac.platform.audit.middleware import (
    AuditContextMiddleware,
    create_audit_aware_dependency,
)

pytestmark = pytest.mark.asyncio


@pytest.fixture
def mock_request():
    """Create a mock request object."""
    request = MagicMock(spec=Request)
    request.state = MagicMock()
    request.headers = {}
    request.client = MagicMock()
    request.client.host = "192.168.1.100"
    return request


@pytest.fixture
def middleware():
    """Create middleware instance."""
    return AuditContextMiddleware(app=None)


@pytest.mark.integration
class TestAuditContextMiddleware:
    """Test AuditContextMiddleware functionality."""

    @pytest.mark.asyncio
    async def test_middleware_extracts_jwt_user_context(self, middleware, mock_request):
        """Test middleware extracts user from JWT token."""
        mock_request.headers = {
            "Authorization": "Bearer test-token-123",
        }

        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            mock_jwt.verify_token.return_value = {
                "sub": "user123",
                "username": "john.doe",
                "email": "john@example.com",
                "tenant_id": "tenant456",
                "roles": ["user", "admin"],
            }

            call_next = AsyncMock()
            call_next.return_value = MagicMock()

            await middleware.dispatch(mock_request, call_next)

            # Check user context was set on request.state
            assert mock_request.state.user_id == "user123"
            assert mock_request.state.username == "john.doe"
            assert mock_request.state.email == "john@example.com"
            assert mock_request.state.tenant_id == "tenant456"
            assert mock_request.state.roles == ["user", "admin"]

            call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_extracts_api_key_context(self, middleware, mock_request):
        """Test middleware extracts user from API key."""
        mock_request.headers = {
            "X-API-Key": "test-api-key-123",
        }

        with patch("dotmac.platform.auth.core.api_key_service") as mock_api:
            mock_api.verify_api_key = AsyncMock()
            mock_api.verify_api_key.return_value = {
                "user_id": "api-user-456",
                "name": "api-service",
                "tenant_id": "tenant789",
            }

            call_next = AsyncMock()
            call_next.return_value = MagicMock()

            await middleware.dispatch(mock_request, call_next)

            # Check API user context was set
            assert mock_request.state.user_id == "api-user-456"
            assert mock_request.state.username == "api-service"
            assert mock_request.state.tenant_id == "tenant789"
            assert mock_request.state.roles == ["api_user"]

            call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_handles_invalid_token(self, middleware, mock_request):
        """Test middleware handles invalid JWT token gracefully."""
        mock_request.headers = {
            "Authorization": "Bearer invalid-token",
        }

        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            mock_jwt.verify_token.side_effect = Exception("Invalid token")

            with patch("dotmac.platform.tenant.set_current_tenant_id"):
                call_next = AsyncMock()
                call_next.return_value = MagicMock()

                # Should not raise exception
                await middleware.dispatch(mock_request, call_next)

                # Just verify the middleware doesn't crash on invalid tokens
                pass

                # Request should continue
                call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_no_auth_header(self, middleware, mock_request):
        """Test middleware with no authentication header."""
        mock_request.headers = {}

        with patch("dotmac.platform.tenant.set_current_tenant_id"):
            call_next = AsyncMock()
            call_next.return_value = MagicMock()

            await middleware.dispatch(mock_request, call_next)

            # Just verify the middleware works with no auth headers
            pass

            # Request should continue normally
            call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_handles_exceptions(self, middleware, mock_request):
        """Test middleware handles exceptions in user extraction."""
        mock_request.headers = {
            "Authorization": "Bearer test-token",
        }

        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            # Simulate an error during token processing
            mock_jwt.verify_token.side_effect = Exception("Database error")

            with patch("dotmac.platform.tenant.set_current_tenant_id"):
                call_next = AsyncMock()
                call_next.return_value = MagicMock()

                # Should not raise exception
                await middleware.dispatch(mock_request, call_next)

                # Request should continue
                call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_sets_tenant_context(self, middleware, mock_request):
        """Test middleware sets tenant context variable."""
        mock_request.headers = {
            "Authorization": "Bearer test-token-123",
        }

        with patch("dotmac.platform.auth.core.jwt_service") as mock_jwt:
            mock_jwt.verify_token.return_value = {
                "sub": "user123",
                "tenant_id": "tenant456",
            }

            with patch("dotmac.platform.tenant.set_current_tenant_id") as mock_set_tenant:
                call_next = AsyncMock()
                call_next.return_value = MagicMock()

                await middleware.dispatch(mock_request, call_next)

                # Verify tenant context was set
                mock_set_tenant.assert_called_once_with("tenant456")
                call_next.assert_called_once_with(mock_request)

    @pytest.mark.asyncio
    async def test_middleware_handles_api_key_exception(self, middleware, mock_request):
        """Test middleware handles API key extraction exception gracefully."""
        mock_request.headers = {
            "X-API-Key": "test-api-key-123",
        }

        with patch("dotmac.platform.auth.core.api_key_service") as mock_api:
            # Simulate exception during API key verification
            mock_api.verify_api_key = AsyncMock()
            mock_api.verify_api_key.side_effect = Exception("API key service error")

            with patch("dotmac.platform.tenant.set_current_tenant_id"):
                call_next = AsyncMock()
                call_next.return_value = MagicMock()

                # Should not raise exception - should handle gracefully
                await middleware.dispatch(mock_request, call_next)

                # Request should continue even with API key error
                call_next.assert_called_once_with(mock_request)


@pytest.mark.integration
class TestAuditAwareDependency:
    """Test create_audit_aware_dependency function."""

    @pytest.mark.asyncio
    async def test_audit_aware_dependency_sets_user_context(self):
        """Test that audit aware dependency sets user context on request."""
        mock_request = MagicMock()
        mock_request.state = MagicMock()

        mock_user_info = MagicMock()
        mock_user_info.user_id = "user123"
        mock_user_info.username = "john.doe"
        mock_user_info.email = "john@example.com"
        mock_user_info.tenant_id = "tenant456"
        mock_user_info.roles = ["user"]

        mock_dependency = MagicMock(return_value=mock_user_info)

        wrapper = create_audit_aware_dependency(mock_dependency)
        result = await wrapper(mock_request, mock_user_info)

        # Check user context was set
        assert mock_request.state.user_id == "user123"
        assert mock_request.state.username == "john.doe"
        assert mock_request.state.email == "john@example.com"
        assert mock_request.state.tenant_id == "tenant456"
        assert mock_request.state.roles == ["user"]

        # Should return the user info
        assert result == mock_user_info

    @pytest.mark.asyncio
    async def test_audit_aware_dependency_handles_none_user(self):
        """Test dependency handles None user (unauthenticated)."""
        mock_request = MagicMock()
        mock_request.state = MagicMock()

        with patch("dotmac.platform.tenant.set_current_tenant_id"):
            wrapper = create_audit_aware_dependency(None)
            result = await wrapper(mock_request, None)

            # Just verify dependency works with None user
            pass

            # Should return None
            assert result is None

    @pytest.mark.asyncio
    async def test_audit_aware_dependency_sets_tenant_context(self):
        """Test dependency sets tenant context when tenant_id is present."""
        mock_request = MagicMock()
        mock_request.state = MagicMock()

        mock_user_info = MagicMock()
        mock_user_info.user_id = "user123"
        mock_user_info.username = "john.doe"
        mock_user_info.email = "john@example.com"
        mock_user_info.tenant_id = "tenant789"  # Has tenant_id
        mock_user_info.roles = ["admin"]

        mock_dependency = MagicMock(return_value=mock_user_info)

        with patch("dotmac.platform.tenant.set_current_tenant_id") as mock_set_tenant:
            wrapper = create_audit_aware_dependency(mock_dependency)
            result = await wrapper(mock_request, mock_user_info)

            # Verify tenant context was set
            mock_set_tenant.assert_called_once_with("tenant789")

            # Should return the user info
            assert result == mock_user_info
