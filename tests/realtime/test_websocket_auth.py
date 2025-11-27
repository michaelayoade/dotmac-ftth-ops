"""
Tests for WebSocket Authentication and Tenant Isolation.

Tests cover:
- Token extraction from multiple sources
- Authentication success and failure
- Tenant isolation validation
- Permission-based authorization
- Connection lifecycle
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import WebSocket, status

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.realtime.auth import (
    AuthenticatedWebSocketConnection,
    WebSocketAuthError,
    accept_websocket_with_auth,
    authenticate_websocket,
    authorize_websocket_resource,
    extract_token_from_websocket,
    validate_tenant_isolation,
)

pytestmark = pytest.mark.unit


class TestTokenExtraction:
    """Test token extraction from various sources."""

    @pytest.mark.asyncio
    async def test_extract_token_from_query_param(self):
        """Test extracting token from query parameter."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="token=test_jwt_token")
        mock_websocket.headers = {}
        mock_websocket.cookies = {}

        token = await extract_token_from_websocket(mock_websocket)
        assert token == "test_jwt_token"

    @pytest.mark.asyncio
    async def test_extract_token_from_authorization_header(self):
        """Test extracting token from Authorization header."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="")
        mock_websocket.headers = {"authorization": "Bearer test_jwt_token"}
        mock_websocket.cookies = {}

        token = await extract_token_from_websocket(mock_websocket)
        assert token == "test_jwt_token"

    @pytest.mark.asyncio
    async def test_extract_token_from_cookie(self):
        """Test extracting token from cookie."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="")
        mock_websocket.headers = {}
        mock_websocket.cookies = {"access_token": "test_jwt_token"}

        token = await extract_token_from_websocket(mock_websocket)
        assert token == "test_jwt_token"

    @pytest.mark.asyncio
    async def test_extract_token_priority_header_first(self):
        """Test token extraction prioritizes Authorization header over others."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="token=query_token")
        mock_websocket.headers = {"authorization": "Bearer header_token"}
        mock_websocket.cookies = {"access_token": "cookie_token"}

        token = await extract_token_from_websocket(mock_websocket)
        # Header has priority, then cookie, then query param (legacy fallback)
        assert token == "header_token"

    @pytest.mark.asyncio
    async def test_extract_token_no_token_provided(self):
        """Test token extraction when no token is provided."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="")
        mock_websocket.headers = {}
        mock_websocket.cookies = {}

        token = await extract_token_from_websocket(mock_websocket)
        assert token is None


class TestWebSocketAuthentication:
    """Test WebSocket authentication."""

    @pytest.mark.asyncio
    @patch("dotmac.platform.realtime.auth._verify_token_with_fallback")
    async def test_authenticate_websocket_success(self, mock_verify):
        """Test successful WebSocket authentication."""
        # Mock token verification
        mock_verify.return_value = {
            "sub": "user123",
            "username": "testuser",
            "email": "test@example.com",
            "tenant_id": "tenant123",
            "roles": ["user"],
            "permissions": ["sessions.read"],
        }

        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="token=valid_token", path="/ws/sessions")
        mock_websocket.headers = {}
        mock_websocket.cookies = {}
        mock_websocket.client = Mock(host="127.0.0.1")

        user_info = await authenticate_websocket(mock_websocket)

        assert user_info.user_id == "user123"
        assert user_info.username == "testuser"
        assert user_info.email == "test@example.com"
        assert user_info.tenant_id == "tenant123"
        assert "user" in user_info.roles
        assert "sessions.read" in user_info.permissions

    @pytest.mark.asyncio
    async def test_authenticate_websocket_no_token(self):
        """Test WebSocket authentication fails when no token provided."""
        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="", path="/ws/sessions")
        mock_websocket.headers = {}
        mock_websocket.cookies = {}
        mock_websocket.client = Mock(host="127.0.0.1")

        with pytest.raises(WebSocketAuthError, match="No authentication token provided"):
            await authenticate_websocket(mock_websocket)

    @pytest.mark.asyncio
    @patch("dotmac.platform.realtime.auth._verify_token_with_fallback")
    async def test_authenticate_websocket_invalid_token(self, mock_verify):
        """Test WebSocket authentication fails with invalid token."""
        mock_verify.side_effect = Exception("Invalid token")

        mock_websocket = Mock(spec=WebSocket)
        mock_websocket.url = Mock(query="token=invalid_token", path="/ws/sessions")
        mock_websocket.headers = {}
        mock_websocket.cookies = {}
        mock_websocket.client = Mock(host="127.0.0.1")

        with pytest.raises(WebSocketAuthError, match="Authentication failed"):
            await authenticate_websocket(mock_websocket)


class TestWebSocketAuthorization:
    """Test WebSocket authorization."""

    @pytest.mark.asyncio
    async def test_authorize_resource_with_permission(self):
        """Test successful resource authorization."""
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=["jobs.read"],
        )

        # Should not raise
        await authorize_websocket_resource(
            user_info,
            resource_type="job",
            resource_id="job123",
            required_permissions=["jobs.read"],
        )

    @pytest.mark.asyncio
    async def test_authorize_resource_without_permission(self):
        """Test resource authorization fails without required permission."""
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=["sessions.read"],
        )

        with pytest.raises(WebSocketAuthError, match="Insufficient permissions"):
            await authorize_websocket_resource(
                user_info,
                resource_type="job",
                resource_id="job123",
                required_permissions=["jobs.read"],
            )

    @pytest.mark.asyncio
    async def test_authorize_resource_with_any_permission(self):
        """Test authorization succeeds with any of multiple required permissions."""
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=["sessions.read"],
        )

        # Should not raise - user has one of the required permissions
        await authorize_websocket_resource(
            user_info,
            resource_type="session",
            resource_id="session123",
            required_permissions=["sessions.read", "radius.sessions.read"],
        )


class TestTenantIsolation:
    """Test tenant isolation validation."""

    def test_validate_tenant_isolation_same_tenant(self):
        """Test tenant isolation validation passes for same tenant."""
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        # Should not raise
        validate_tenant_isolation(user_info, "tenant123")

    def test_validate_tenant_isolation_different_tenant(self):
        """Test tenant isolation validation fails for different tenant."""
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        with pytest.raises(WebSocketAuthError, match="Tenant isolation violation"):
            validate_tenant_isolation(user_info, "tenant456")


class TestAuthenticatedWebSocketConnection:
    """Test authenticated WebSocket connection class."""

    @pytest.mark.asyncio
    async def test_send_json(self):
        """Test sending JSON over authenticated WebSocket."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_redis = Mock()

        connection = AuthenticatedWebSocketConnection(mock_websocket, user_info, mock_redis)

        await connection.send_json({"type": "test", "data": "value"})

        mock_websocket.send_json.assert_called_once_with({"type": "test", "data": "value"})

    @pytest.mark.asyncio
    async def test_subscribe_to_channel_with_tenant_prefix(self):
        """Test subscribing to channel adds tenant prefix."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_redis = AsyncMock()
        mock_pubsub = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub

        connection = AuthenticatedWebSocketConnection(mock_websocket, user_info, mock_redis)

        await connection.subscribe_to_channel("sessions")

        # Should prefix with tenant ID
        mock_pubsub.subscribe.assert_called_once_with("tenant123:sessions")

    @pytest.mark.asyncio
    async def test_subscribe_to_channel_already_prefixed(self):
        """Test subscribing to channel that's already prefixed."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_redis = AsyncMock()
        mock_pubsub = AsyncMock()
        mock_redis.pubsub.return_value = mock_pubsub

        connection = AuthenticatedWebSocketConnection(mock_websocket, user_info, mock_redis)

        await connection.subscribe_to_channel("tenant123:sessions")

        # Should not double-prefix
        mock_pubsub.subscribe.assert_called_once_with("tenant123:sessions")

    @pytest.mark.asyncio
    async def test_close_connection(self):
        """Test closing WebSocket connection."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_redis = AsyncMock()
        mock_pubsub = AsyncMock()

        connection = AuthenticatedWebSocketConnection(mock_websocket, user_info, mock_redis)
        connection.pubsub = mock_pubsub

        await connection.close()

        assert connection.is_closed is True
        mock_pubsub.close.assert_called_once()
        mock_websocket.close.assert_called_once()


class TestAcceptWebSocketWithAuth:
    """Test accept_websocket_with_auth convenience function."""

    @pytest.mark.asyncio
    @patch("dotmac.platform.realtime.auth.authenticate_websocket")
    async def test_accept_with_auth_success(self, mock_auth):
        """Test accepting WebSocket with successful authentication."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=["sessions.read"],
        )
        mock_auth.return_value = user_info

        result = await accept_websocket_with_auth(
            mock_websocket, required_permissions=["sessions.read"]
        )

        assert result == user_info
        mock_websocket.accept.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.realtime.auth.authenticate_websocket")
    async def test_accept_with_auth_insufficient_permissions(self, mock_auth):
        """Test accepting WebSocket fails with insufficient permissions."""
        mock_websocket = AsyncMock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=["campaigns.read"],
        )
        mock_auth.return_value = user_info

        with pytest.raises(WebSocketAuthError, match="Insufficient permissions"):
            await accept_websocket_with_auth(mock_websocket, required_permissions=["jobs.read"])

        mock_websocket.close.assert_called_once_with(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Insufficient permissions",
        )

    @pytest.mark.asyncio
    @patch("dotmac.platform.realtime.auth.authenticate_websocket")
    async def test_accept_with_auth_authentication_fails(self, mock_auth):
        """Test accepting WebSocket when authentication fails."""
        mock_websocket = AsyncMock(spec=WebSocket)
        mock_auth.side_effect = WebSocketAuthError("Invalid token")

        with pytest.raises(WebSocketAuthError, match="Invalid token"):
            await accept_websocket_with_auth(mock_websocket)

        mock_websocket.close.assert_called_once_with(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Authentication failed",
        )
