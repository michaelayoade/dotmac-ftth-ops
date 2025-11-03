"""
WebSocket Connection Manager with Tenant Isolation.

Manages active WebSocket connections with proper tenant isolation and resource tracking.
"""

from collections import defaultdict
from typing import Any
from uuid import UUID, uuid4

import structlog
from fastapi import WebSocket

from dotmac.platform.auth.core import UserInfo

logger = structlog.get_logger(__name__)


class ConnectionInfo:
    """Information about an active WebSocket connection."""

    def __init__(
        self,
        connection_id: UUID,
        websocket: WebSocket,
        user_info: UserInfo,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ):
        """
        Initialize connection info.

        Args:
            connection_id: Unique connection identifier
            websocket: FastAPI WebSocket instance
            user_info: Authenticated user information
            resource_type: Optional resource type (e.g., "job", "campaign")
            resource_id: Optional resource identifier
        """
        self.connection_id = connection_id
        self.websocket = websocket
        self.user_info = user_info
        self.tenant_id = user_info.tenant_id
        self.user_id = user_info.user_id
        self.resource_type = resource_type
        self.resource_id = resource_id

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "connection_id": str(self.connection_id),
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "username": self.user_info.username,
            "email": self.user_info.email,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
        }


class WebSocketConnectionManager:
    """
    Manages active WebSocket connections with tenant isolation.

    Features:
    - Per-tenant connection tracking
    - Resource-specific connection grouping
    - Broadcast to tenant-specific connections
    - Connection lifecycle management
    - Statistics and monitoring
    """

    def __init__(self) -> None:
        """Initialize connection manager."""
        # All active connections by connection_id
        self._connections: dict[UUID, ConnectionInfo] = {}

        # Connections grouped by tenant_id
        self._tenant_connections: dict[str, set[UUID]] = defaultdict(set)

        # Connections grouped by resource (e.g., job:123, campaign:456)
        self._resource_connections: dict[str, set[UUID]] = defaultdict(set)

        # Connections grouped by user_id
        self._user_connections: dict[str, set[UUID]] = defaultdict(set)

    def register(
        self,
        websocket: WebSocket,
        user_info: UserInfo,
        resource_type: str | None = None,
        resource_id: str | None = None,
    ) -> UUID:
        """
        Register a new WebSocket connection.

        Args:
            websocket: FastAPI WebSocket instance
            user_info: Authenticated user information
            resource_type: Optional resource type
            resource_id: Optional resource identifier

        Returns:
            Unique connection ID
        """
        connection_id = uuid4()

        conn_info = ConnectionInfo(
            connection_id=connection_id,
            websocket=websocket,
            user_info=user_info,
            resource_type=resource_type,
            resource_id=resource_id,
        )

        # Store connection
        self._connections[connection_id] = conn_info

        # Index by tenant
        if user_info.tenant_id is not None:
            self._tenant_connections[user_info.tenant_id].add(connection_id)

        # Index by user
        self._user_connections[user_info.user_id].add(connection_id)

        # Index by resource if specified
        if resource_type and resource_id:
            resource_key = f"{resource_type}:{resource_id}"
            self._resource_connections[resource_key].add(connection_id)

        logger.info(
            "connection_manager.registered",
            connection_id=str(connection_id),
            tenant_id=user_info.tenant_id,
            user_id=user_info.user_id,
            resource_type=resource_type,
            resource_id=resource_id,
        )

        return connection_id

    def unregister(self, connection_id: UUID) -> None:
        """
        Unregister and cleanup a WebSocket connection.

        Args:
            connection_id: Connection ID to remove
        """
        conn_info = self._connections.get(connection_id)
        if not conn_info:
            return

        # Remove from all indexes
        if conn_info.tenant_id is not None:
            self._tenant_connections[conn_info.tenant_id].discard(connection_id)
        self._user_connections[conn_info.user_id].discard(connection_id)

        if conn_info.resource_type and conn_info.resource_id:
            resource_key = f"{conn_info.resource_type}:{conn_info.resource_id}"
            self._resource_connections[resource_key].discard(connection_id)

        # Remove main entry
        del self._connections[connection_id]

        logger.info(
            "connection_manager.unregistered",
            connection_id=str(connection_id),
            tenant_id=conn_info.tenant_id,
            user_id=conn_info.user_id,
        )

    async def broadcast_to_tenant(
        self,
        tenant_id: str,
        message: dict[str, Any],
        exclude: set[UUID] | None = None,
    ) -> int:
        """
        Broadcast message to all connections in a tenant.

        Args:
            tenant_id: Tenant ID
            message: Message to broadcast
            exclude: Optional set of connection IDs to exclude

        Returns:
            Number of connections message was sent to
        """
        exclude = exclude or set()
        connection_ids = self._tenant_connections.get(tenant_id, set())
        sent_count = 0

        for conn_id in connection_ids:
            if conn_id in exclude:
                continue

            conn_info = self._connections.get(conn_id)
            if conn_info:
                try:
                    await conn_info.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.error(
                        "connection_manager.broadcast_failed",
                        connection_id=str(conn_id),
                        tenant_id=tenant_id,
                        error=str(e),
                    )

        logger.info(
            "connection_manager.broadcast_to_tenant",
            tenant_id=tenant_id,
            sent_count=sent_count,
            total_connections=len(connection_ids),
        )

        return sent_count

    async def broadcast_to_resource(
        self,
        resource_type: str,
        resource_id: str,
        message: dict[str, Any],
        exclude: set[UUID] | None = None,
    ) -> int:
        """
        Broadcast message to all connections watching a specific resource.

        Args:
            resource_type: Resource type (e.g., "job", "campaign")
            resource_id: Resource identifier
            message: Message to broadcast
            exclude: Optional set of connection IDs to exclude

        Returns:
            Number of connections message was sent to
        """
        exclude = exclude or set()
        resource_key = f"{resource_type}:{resource_id}"
        connection_ids = self._resource_connections.get(resource_key, set())
        sent_count = 0

        for conn_id in connection_ids:
            if conn_id in exclude:
                continue

            conn_info = self._connections.get(conn_id)
            if conn_info:
                try:
                    await conn_info.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.error(
                        "connection_manager.broadcast_failed",
                        connection_id=str(conn_id),
                        resource_type=resource_type,
                        resource_id=resource_id,
                        error=str(e),
                    )

        logger.info(
            "connection_manager.broadcast_to_resource",
            resource_type=resource_type,
            resource_id=resource_id,
            sent_count=sent_count,
            total_connections=len(connection_ids),
        )

        return sent_count

    async def broadcast_to_user(
        self,
        user_id: str,
        message: dict[str, Any],
        exclude: set[UUID] | None = None,
    ) -> int:
        """
        Broadcast message to all connections of a specific user.

        Args:
            user_id: User ID
            message: Message to broadcast
            exclude: Optional set of connection IDs to exclude

        Returns:
            Number of connections message was sent to
        """
        exclude = exclude or set()
        connection_ids = self._user_connections.get(user_id, set())
        sent_count = 0

        for conn_id in connection_ids:
            if conn_id in exclude:
                continue

            conn_info = self._connections.get(conn_id)
            if conn_info:
                try:
                    await conn_info.websocket.send_json(message)
                    sent_count += 1
                except Exception as e:
                    logger.error(
                        "connection_manager.broadcast_failed",
                        connection_id=str(conn_id),
                        user_id=user_id,
                        error=str(e),
                    )

        logger.info(
            "connection_manager.broadcast_to_user",
            user_id=user_id,
            sent_count=sent_count,
            total_connections=len(connection_ids),
        )

        return sent_count

    def get_tenant_connections(self, tenant_id: str) -> list[ConnectionInfo]:
        """
        Get all connections for a tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            List of connection info objects
        """
        connection_ids = self._tenant_connections.get(tenant_id, set())
        return [
            self._connections[conn_id] for conn_id in connection_ids if conn_id in self._connections
        ]

    def get_resource_connections(
        self, resource_type: str, resource_id: str
    ) -> list[ConnectionInfo]:
        """
        Get all connections watching a specific resource.

        Args:
            resource_type: Resource type
            resource_id: Resource identifier

        Returns:
            List of connection info objects
        """
        resource_key = f"{resource_type}:{resource_id}"
        connection_ids = self._resource_connections.get(resource_key, set())
        return [
            self._connections[conn_id] for conn_id in connection_ids if conn_id in self._connections
        ]

    def get_user_connections(self, user_id: str) -> list[ConnectionInfo]:
        """
        Get all connections for a user.

        Args:
            user_id: User ID

        Returns:
            List of connection info objects
        """
        connection_ids = self._user_connections.get(user_id, set())
        return [
            self._connections[conn_id] for conn_id in connection_ids if conn_id in self._connections
        ]

    def get_stats(self) -> dict[str, Any]:
        """
        Get connection statistics.

        Returns:
            Dictionary with connection statistics
        """
        return {
            "total_connections": len(self._connections),
            "total_tenants": len(self._tenant_connections),
            "total_users": len(self._user_connections),
            "total_resources": len(self._resource_connections),
            "connections_by_tenant": {
                tenant_id: len(conn_ids) for tenant_id, conn_ids in self._tenant_connections.items()
            },
            "connections_by_resource": {
                resource_key: len(conn_ids)
                for resource_key, conn_ids in self._resource_connections.items()
            },
        }

    def get_tenant_stats(self, tenant_id: str) -> dict[str, Any]:
        """
        Get connection statistics for a specific tenant.

        Args:
            tenant_id: Tenant ID

        Returns:
            Dictionary with tenant-specific statistics
        """
        connections = self.get_tenant_connections(tenant_id)
        unique_users = {conn.user_id for conn in connections}
        resources = {
            (conn.resource_type, conn.resource_id)
            for conn in connections
            if conn.resource_type and conn.resource_id
        }

        return {
            "tenant_id": tenant_id,
            "total_connections": len(connections),
            "unique_users": len(unique_users),
            "monitored_resources": len(resources),
            "connections": [conn.to_dict() for conn in connections],
        }


# Global connection manager instance
connection_manager = WebSocketConnectionManager()
