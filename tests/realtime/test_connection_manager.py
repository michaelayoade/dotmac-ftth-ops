"""
Tests for WebSocket Connection Manager.

Tests cover:
- Connection registration and unregistration
- Tenant-based connection grouping
- Resource-based connection grouping
- Broadcasting to specific groups
- Connection statistics
"""

from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import WebSocket

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.realtime.connection_manager import (
    ConnectionInfo,
    WebSocketConnectionManager,
)

pytestmark = pytest.mark.unit


class TestConnectionInfo:
    """Test ConnectionInfo class."""

    def test_connection_info_creation(self):
        """Test creating connection info."""
        mock_websocket = Mock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        conn_id = uuid4()
        conn_info = ConnectionInfo(
            connection_id=conn_id,
            websocket=mock_websocket,
            user_info=user_info,
            resource_type="job",
            resource_id="job123",
        )

        assert conn_info.connection_id == conn_id
        assert conn_info.websocket == mock_websocket
        assert conn_info.user_info == user_info
        assert conn_info.tenant_id == "tenant123"
        assert conn_info.user_id == "user123"
        assert conn_info.resource_type == "job"
        assert conn_info.resource_id == "job123"

    def test_connection_info_to_dict(self):
        """Test converting connection info to dictionary."""
        mock_websocket = Mock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        conn_id = uuid4()
        conn_info = ConnectionInfo(
            connection_id=conn_id,
            websocket=mock_websocket,
            user_info=user_info,
            resource_type="job",
            resource_id="job123",
        )

        conn_dict = conn_info.to_dict()

        assert conn_dict["connection_id"] == str(conn_id)
        assert conn_dict["tenant_id"] == "tenant123"
        assert conn_dict["user_id"] == "user123"
        assert conn_dict["username"] == "testuser"
        assert conn_dict["email"] == "test@example.com"
        assert conn_dict["resource_type"] == "job"
        assert conn_dict["resource_id"] == "job123"


class TestWebSocketConnectionManager:
    """Test WebSocket connection manager."""

    def test_register_connection(self):
        """Test registering a new connection."""
        manager = WebSocketConnectionManager()
        mock_websocket = Mock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        conn_id = manager.register(mock_websocket, user_info)

        assert conn_id is not None
        assert conn_id in manager._connections
        assert conn_id in manager._tenant_connections["tenant123"]
        assert conn_id in manager._user_connections["user123"]

    def test_register_connection_with_resource(self):
        """Test registering connection with resource tracking."""
        manager = WebSocketConnectionManager()
        mock_websocket = Mock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        conn_id = manager.register(
            mock_websocket, user_info, resource_type="job", resource_id="job123"
        )

        assert conn_id in manager._resource_connections["job:job123"]

    def test_unregister_connection(self):
        """Test unregistering a connection."""
        manager = WebSocketConnectionManager()
        mock_websocket = Mock(spec=WebSocket)
        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        conn_id = manager.register(
            mock_websocket, user_info, resource_type="job", resource_id="job123"
        )

        manager.unregister(conn_id)

        assert conn_id not in manager._connections
        assert conn_id not in manager._tenant_connections["tenant123"]
        assert conn_id not in manager._user_connections["user123"]
        assert conn_id not in manager._resource_connections["job:job123"]

    def test_multiple_tenants(self):
        """Test managing connections from multiple tenants."""
        manager = WebSocketConnectionManager()

        # Register connections for tenant1
        user1 = UserInfo(
            user_id="user1",
            username="user1",
            email="user1@example.com",
            tenant_id="tenant1",
            roles=["user"],
            permissions=[],
        )
        conn1 = manager.register(Mock(spec=WebSocket), user1)

        # Register connections for tenant2
        user2 = UserInfo(
            user_id="user2",
            username="user2",
            email="user2@example.com",
            tenant_id="tenant2",
            roles=["user"],
            permissions=[],
        )
        conn2 = manager.register(Mock(spec=WebSocket), user2)

        # Verify tenant isolation
        assert len(manager._tenant_connections["tenant1"]) == 1
        assert len(manager._tenant_connections["tenant2"]) == 1
        assert conn1 in manager._tenant_connections["tenant1"]
        assert conn2 in manager._tenant_connections["tenant2"]
        assert conn1 not in manager._tenant_connections["tenant2"]
        assert conn2 not in manager._tenant_connections["tenant1"]

    @pytest.mark.asyncio
    async def test_broadcast_to_tenant(self):
        """Test broadcasting to all connections in a tenant."""
        manager = WebSocketConnectionManager()

        # Register multiple connections for same tenant
        user1 = UserInfo(
            user_id="user1",
            username="user1",
            email="user1@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws1 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws1, user1)

        user2 = UserInfo(
            user_id="user2",
            username="user2",
            email="user2@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws2 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws2, user2)

        # Broadcast message
        message = {"type": "test", "data": "value"}
        sent_count = await manager.broadcast_to_tenant("tenant123", message)

        assert sent_count == 2
        mock_ws1.send_json.assert_called_once_with(message)
        mock_ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast_to_tenant_with_exclusion(self):
        """Test broadcasting to tenant excluding specific connections."""
        manager = WebSocketConnectionManager()

        user1 = UserInfo(
            user_id="user1",
            username="user1",
            email="user1@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws1 = AsyncMock(spec=WebSocket)
        conn1 = manager.register(mock_ws1, user1)

        user2 = UserInfo(
            user_id="user2",
            username="user2",
            email="user2@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws2 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws2, user2)

        # Broadcast excluding conn1
        message = {"type": "test", "data": "value"}
        sent_count = await manager.broadcast_to_tenant("tenant123", message, exclude={conn1})

        assert sent_count == 1
        mock_ws1.send_json.assert_not_called()
        mock_ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_broadcast_to_resource(self):
        """Test broadcasting to connections watching a specific resource."""
        manager = WebSocketConnectionManager()

        user1 = UserInfo(
            user_id="user1",
            username="user1",
            email="user1@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws1 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws1, user1, resource_type="job", resource_id="job123")

        user2 = UserInfo(
            user_id="user2",
            username="user2",
            email="user2@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )
        mock_ws2 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws2, user2, resource_type="job", resource_id="job456")

        # Broadcast to job123 only
        message = {"type": "job_update", "status": "completed"}
        sent_count = await manager.broadcast_to_resource("job", "job123", message)

        assert sent_count == 1
        mock_ws1.send_json.assert_called_once_with(message)
        mock_ws2.send_json.assert_not_called()

    @pytest.mark.asyncio
    async def test_broadcast_to_user(self):
        """Test broadcasting to all connections of a specific user."""
        manager = WebSocketConnectionManager()

        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        # Register multiple connections for same user (e.g., different tabs)
        mock_ws1 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws1, user_info)

        mock_ws2 = AsyncMock(spec=WebSocket)
        manager.register(mock_ws2, user_info)

        # Broadcast to user
        message = {"type": "notification", "text": "Hello"}
        sent_count = await manager.broadcast_to_user("user123", message)

        assert sent_count == 2
        mock_ws1.send_json.assert_called_once_with(message)
        mock_ws2.send_json.assert_called_once_with(message)

    def test_get_tenant_connections(self):
        """Test retrieving all connections for a tenant."""
        manager = WebSocketConnectionManager()

        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        manager.register(Mock(spec=WebSocket), user_info)
        manager.register(Mock(spec=WebSocket), user_info)

        connections = manager.get_tenant_connections("tenant123")

        assert len(connections) == 2
        assert all(conn.tenant_id == "tenant123" for conn in connections)

    def test_get_resource_connections(self):
        """Test retrieving connections watching a specific resource."""
        manager = WebSocketConnectionManager()

        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        manager.register(Mock(spec=WebSocket), user_info, resource_type="job", resource_id="job123")
        manager.register(Mock(spec=WebSocket), user_info, resource_type="job", resource_id="job123")

        connections = manager.get_resource_connections("job", "job123")

        assert len(connections) == 2
        assert all(conn.resource_id == "job123" for conn in connections)

    def test_get_stats(self):
        """Test getting connection statistics."""
        manager = WebSocketConnectionManager()

        # Register connections
        user1 = UserInfo(
            user_id="user1",
            username="user1",
            email="user1@example.com",
            tenant_id="tenant1",
            roles=["user"],
            permissions=[],
        )
        manager.register(Mock(spec=WebSocket), user1)

        user2 = UserInfo(
            user_id="user2",
            username="user2",
            email="user2@example.com",
            tenant_id="tenant2",
            roles=["user"],
            permissions=[],
        )
        manager.register(Mock(spec=WebSocket), user2, resource_type="job", resource_id="job123")

        stats = manager.get_stats()

        assert stats["total_connections"] == 2
        assert stats["total_tenants"] == 2
        assert stats["total_users"] == 2
        assert stats["total_resources"] == 1
        assert stats["connections_by_tenant"]["tenant1"] == 1
        assert stats["connections_by_tenant"]["tenant2"] == 1
        assert stats["connections_by_resource"]["job:job123"] == 1

    def test_get_tenant_stats(self):
        """Test getting tenant-specific statistics."""
        manager = WebSocketConnectionManager()

        user_info = UserInfo(
            user_id="user123",
            username="testuser",
            email="test@example.com",
            tenant_id="tenant123",
            roles=["user"],
            permissions=[],
        )

        manager.register(Mock(spec=WebSocket), user_info)
        manager.register(Mock(spec=WebSocket), user_info, resource_type="job", resource_id="job123")

        tenant_stats = manager.get_tenant_stats("tenant123")

        assert tenant_stats["tenant_id"] == "tenant123"
        assert tenant_stats["total_connections"] == 2
        assert tenant_stats["unique_users"] == 1
        assert tenant_stats["monitored_resources"] == 1
        assert len(tenant_stats["connections"]) == 2
