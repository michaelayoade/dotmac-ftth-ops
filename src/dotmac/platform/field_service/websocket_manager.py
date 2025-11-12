"""
WebSocket Connection Manager for Real-Time Technician Location Updates
"""

from __future__ import annotations

import logging
from datetime import datetime

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)


class TechnicianLocationWebSocketManager:
    """
    Manages WebSocket connections for real-time technician location updates.

    Each tenant has isolated connections - technicians from one tenant
    cannot see locations from another tenant.
    """

    def __init__(self) -> None:
        # Structure: {tenant_id: {connection_id: WebSocket}}
        self.active_connections: dict[str, dict[str, WebSocket]] = {}
        # Track which tenant each connection belongs to
        self.connection_tenants: dict[str, str] = {}

        # Analytics tracking
        self.connection_start_times: dict[str, datetime] = {}
        self.total_connections_count = 0
        self.total_messages_sent = 0
        self.start_time = datetime.utcnow()

    async def connect(self, websocket: WebSocket, tenant_id: str, connection_id: str) -> None:
        """
        Accept a new WebSocket connection and associate it with a tenant.

        Args:
            websocket: The WebSocket connection
            tenant_id: The tenant ID for multi-tenant isolation
            connection_id: Unique identifier for this connection
        """
        await websocket.accept()

        # Initialize tenant connections dict if not exists
        if tenant_id not in self.active_connections:
            self.active_connections[tenant_id] = {}

        # Add connection
        self.active_connections[tenant_id][connection_id] = websocket
        self.connection_tenants[connection_id] = tenant_id

        # Track analytics
        self.connection_start_times[connection_id] = datetime.utcnow()
        self.total_connections_count += 1

        logger.info(
            f"WebSocket connected: tenant={tenant_id}, connection={connection_id}, "
            f"total_for_tenant={len(self.active_connections[tenant_id])}"
        )

    def disconnect(self, connection_id: str) -> None:
        """
        Remove a WebSocket connection.

        Args:
            connection_id: Unique identifier for the connection to remove
        """
        tenant_id = self.connection_tenants.get(connection_id)
        if not tenant_id:
            return

        # Remove from active connections
        if tenant_id in self.active_connections:
            self.active_connections[tenant_id].pop(connection_id, None)

            # Clean up empty tenant dict
            if not self.active_connections[tenant_id]:
                del self.active_connections[tenant_id]

        # Remove from tenant mapping
        self.connection_tenants.pop(connection_id, None)

        # Remove analytics tracking
        self.connection_start_times.pop(connection_id, None)

        logger.info(f"WebSocket disconnected: tenant={tenant_id}, connection={connection_id}")

    async def broadcast_to_tenant(self, tenant_id: str, message: dict) -> None:
        """
        Broadcast a message to all connections for a specific tenant.

        Args:
            tenant_id: The tenant ID to broadcast to
            message: Dictionary to send as JSON
        """
        if tenant_id not in self.active_connections:
            return

        # Get all connections for this tenant
        connections = self.active_connections[tenant_id].copy()

        # Track disconnected connections to remove
        disconnected = []

        # Send to all connections
        for connection_id, websocket in connections.items():
            try:
                await websocket.send_json(message)
                self.total_messages_sent += 1
            except WebSocketDisconnect:
                disconnected.append(connection_id)
                logger.warning(f"WebSocket send failed (disconnected): {connection_id}")
            except Exception as e:
                disconnected.append(connection_id)
                logger.error(f"WebSocket send failed: {connection_id}, error: {e}")

        # Clean up disconnected connections
        for connection_id in disconnected:
            self.disconnect(connection_id)

        if message.get("type") == "location_update":
            logger.debug(
                f"Broadcasted location update to {len(connections) - len(disconnected)} "
                f"connections for tenant {tenant_id}"
            )

    async def send_to_connection(self, connection_id: str, message: dict) -> None:
        """
        Send a message to a specific connection.

        Args:
            connection_id: Unique identifier for the connection
            message: Dictionary to send as JSON
        """
        tenant_id = self.connection_tenants.get(connection_id)
        if not tenant_id:
            return

        if tenant_id not in self.active_connections:
            return

        websocket = self.active_connections[tenant_id].get(connection_id)
        if not websocket:
            return

        try:
            await websocket.send_json(message)
            self.total_messages_sent += 1
        except Exception as e:
            logger.error(f"Failed to send to connection {connection_id}: {e}")
            self.disconnect(connection_id)

    def get_active_connection_count(self, tenant_id: str | None = None) -> int:
        """
        Get count of active connections.

        Args:
            tenant_id: If provided, count for specific tenant. Otherwise, total count.

        Returns:
            Number of active connections
        """
        if tenant_id:
            return len(self.active_connections.get(tenant_id, {}))
        else:
            return sum(len(conns) for conns in self.active_connections.values())

    def get_active_tenants(self) -> set[str]:
        """
        Get set of tenant IDs with active connections.

        Returns:
            Set of tenant IDs
        """
        return set(self.active_connections.keys())

    def get_analytics(self) -> dict:
        """
        Get analytics and metrics for WebSocket connections.

        Returns:
            Dictionary with connection statistics
        """
        uptime = datetime.utcnow() - self.start_time

        # Calculate per-tenant stats
        tenant_stats = {}
        for tenant_id, connections in self.active_connections.items():
            tenant_stats[tenant_id] = {
                "active_connections": len(connections),
                "connection_ids": list(connections.keys()),
            }

        # Calculate average connection duration
        active_durations = []
        for _connection_id, start_time in self.connection_start_times.items():
            duration = datetime.utcnow() - start_time
            active_durations.append(duration.total_seconds())

        avg_duration = sum(active_durations) / len(active_durations) if active_durations else 0

        return {
            "uptime_seconds": int(uptime.total_seconds()),
            "uptime_formatted": str(uptime).split(".")[0],  # HH:MM:SS
            "total_active_connections": self.get_active_connection_count(),
            "total_active_tenants": len(self.get_active_tenants()),
            "total_connections_lifetime": self.total_connections_count,
            "total_messages_sent": self.total_messages_sent,
            "average_connection_duration_seconds": round(avg_duration, 1),
            "tenant_breakdown": tenant_stats,
        }


# Global singleton instance
ws_manager = TechnicianLocationWebSocketManager()
