"""
WebSocket Authentication and Authorization.

Provides secure authentication for WebSocket connections with tenant isolation.
"""

import inspect
from typing import Any
from urllib.parse import parse_qs

import structlog
from fastapi import WebSocket, WebSocketDisconnect, status

from dotmac.platform.auth.core import TokenType, UserInfo, _verify_token_with_fallback

logger = structlog.get_logger(__name__)


class WebSocketAuthError(Exception):
    """WebSocket authentication/authorization error."""

    def __init__(self, message: str, *, already_closed: bool = False) -> None:
        super().__init__(message)
        self.already_closed = already_closed


async def extract_token_from_websocket(websocket: WebSocket) -> str | None:
    """
    Extract authentication token from WebSocket connection.

    Tries multiple sources in order:
    1. Authorization header: Authorization: Bearer <jwt_token>
    2. Cookie: access_token=<jwt_token>
    3. Query parameter (legacy fallback): ?token=<jwt_token>

    Args:
        websocket: FastAPI WebSocket connection

    Returns:
        Token string if found, None otherwise
    """
    # 1. Try Authorization header
    auth_header = websocket.headers.get("authorization") or websocket.headers.get("Authorization")
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            return parts[1]

    # 2. Try cookie
    cookies = websocket.cookies
    if "access_token" in cookies:
        return cookies["access_token"]

    # 3. Legacy query parameter fallback
    query_params = parse_qs(websocket.url.query) if websocket.url.query else {}
    if "token" in query_params:
        token = query_params["token"][0]
        if token:
            return token

    return None


async def authenticate_websocket(websocket: WebSocket) -> UserInfo:
    """
    Authenticate WebSocket connection and return user info.

    Args:
        websocket: FastAPI WebSocket connection

    Returns:
        UserInfo object containing user details

    Raises:
        WebSocketAuthError: If authentication fails
    """
    # Extract token
    token = await extract_token_from_websocket(websocket)

    if not token:
        logger.warning(
            "websocket.auth.no_token",
            path=str(websocket.url.path),
            client=websocket.client.host if websocket.client else "unknown",
        )
        raise WebSocketAuthError("No authentication token provided")

    # Verify token
    try:
        claims = await _verify_token_with_fallback(token, TokenType.ACCESS)

        # Extract user info from claims
        user_info = UserInfo(
            user_id=claims["sub"],
            username=claims.get("username", ""),
            email=claims.get("email", ""),
            tenant_id=claims.get("tenant_id", ""),
            roles=claims.get("roles", []),
            permissions=claims.get("permissions", []),
        )

        logger.info(
            "websocket.auth.success",
            user_id=user_info.user_id,
            tenant_id=user_info.tenant_id,
            path=str(websocket.url.path),
        )

        return user_info

    except Exception as e:
        logger.warning(
            "websocket.auth.failed",
            error=str(e),
            path=str(websocket.url.path),
            client=websocket.client.host if websocket.client else "unknown",
        )
        raise WebSocketAuthError(f"Authentication failed: {str(e)}") from e


async def authorize_websocket_resource(
    user_info: UserInfo,
    resource_type: str,
    resource_id: str | None = None,
    required_permissions: list[str] | None = None,
) -> None:
    """
    Authorize access to a specific WebSocket resource.

    Args:
        user_info: Authenticated user information
        resource_type: Type of resource (e.g., "job", "campaign", "session")
        resource_id: Optional resource ID for granular authorization
        required_permissions: List of required permissions

    Raises:
        WebSocketAuthError: If authorization fails
    """
    # Check permissions if specified
    if required_permissions:
        has_permission = any(perm in user_info.permissions for perm in required_permissions)
        if not has_permission:
            logger.warning(
                "websocket.authz.insufficient_permissions",
                user_id=user_info.user_id,
                tenant_id=user_info.tenant_id,
                resource_type=resource_type,
                resource_id=resource_id,
                required=required_permissions,
                actual=user_info.permissions,
            )
            raise WebSocketAuthError("Insufficient permissions for this resource")

    logger.info(
        "websocket.authz.success",
        user_id=user_info.user_id,
        tenant_id=user_info.tenant_id,
        resource_type=resource_type,
        resource_id=resource_id,
    )


async def accept_websocket_with_auth(
    websocket: WebSocket,
    required_permissions: list[str] | None = None,
) -> UserInfo:
    """
    Accept WebSocket connection with authentication.

    This is a convenience function that:
    1. Authenticates the connection
    2. Accepts the WebSocket if auth succeeds
    3. Closes with error code if auth fails

    Args:
        websocket: FastAPI WebSocket connection
        required_permissions: Optional list of required permissions

    Returns:
        UserInfo if authentication succeeds

    Raises:
        WebSocketAuthError: If authentication or authorization fails (connection will be closed)
    """
    try:
        # Authenticate
        user_info = await authenticate_websocket(websocket)

        # Check permissions if required
        if required_permissions:
            has_permission = any(perm in user_info.permissions for perm in required_permissions)
            if not has_permission:
                await websocket.close(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Insufficient permissions",
                )
                raise WebSocketAuthError("Insufficient permissions", already_closed=True)

        # Accept connection
        await websocket.accept()

        return user_info

    except WebSocketAuthError as exc:
        # Close connection with appropriate status code
        if not getattr(exc, "already_closed", False):
            try:
                await websocket.close(
                    code=status.WS_1008_POLICY_VIOLATION,
                    reason="Authentication failed",
                )
            except Exception:
                pass  # Connection might already be closed
        raise


def validate_tenant_isolation(user_info: UserInfo, tenant_id: str) -> None:
    """
    Validate that user has access to the specified tenant.

    Args:
        user_info: Authenticated user information
        tenant_id: Tenant ID to validate

    Raises:
        WebSocketAuthError: If tenant isolation is violated
    """
    if user_info.tenant_id != tenant_id:
        logger.error(
            "websocket.tenant_isolation.violated",
            user_tenant_id=user_info.tenant_id,
            requested_tenant_id=tenant_id,
            user_id=user_info.user_id,
        )
        raise WebSocketAuthError(
            f"Tenant isolation violation: user belongs to tenant {user_info.tenant_id}, "
            f"but requested access to tenant {tenant_id}"
        )


class AuthenticatedWebSocketConnection:
    """
    WebSocket connection with authentication and tenant isolation.

    This class ensures all WebSocket operations respect tenant boundaries.
    """

    def __init__(
        self,
        websocket: WebSocket,
        user_info: UserInfo,
        redis: Any,
    ):
        """
        Initialize authenticated WebSocket connection.

        Args:
            websocket: FastAPI WebSocket
            user_info: Authenticated user information
            redis: Redis client for pub/sub
        """
        self.websocket = websocket
        self.user_info = user_info
        self.tenant_id = user_info.tenant_id
        self.redis = redis
        self.pubsub: Any = None
        self.is_closed = False

    async def send_json(self, data: dict[str, Any]) -> None:
        """Send JSON message to client."""
        if self.is_closed:
            return

        try:
            await self.websocket.send_json(data)
        except Exception as e:
            logger.error(
                "websocket.send_failed",
                tenant_id=self.tenant_id,
                user_id=self.user_info.user_id,
                error=str(e),
            )

    async def receive_json(self) -> dict[str, Any]:
        """Receive JSON message from client."""
        try:
            data = await self.websocket.receive_json()
            if not isinstance(data, dict):
                raise TypeError("Expected JSON object from WebSocket client")
            return data
        except WebSocketDisconnect:
            logger.info(
                "websocket.client_disconnected",
                tenant_id=self.tenant_id,
                user_id=self.user_info.user_id,
            )
            raise
        except Exception as e:
            logger.error(
                "websocket.receive_failed",
                tenant_id=self.tenant_id,
                user_id=self.user_info.user_id,
                error=str(e),
            )
            raise

    async def subscribe_to_channel(self, channel: str) -> None:
        """
        Subscribe to Redis channel with tenant isolation.

        Ensures channel name includes tenant ID for isolation.

        Args:
            channel: Base channel name (will be prefixed with tenant ID if needed)
        """
        # Ensure channel respects tenant isolation
        if not channel.startswith(f"{self.tenant_id}:") and ":" not in channel:
            channel = f"{self.tenant_id}:{channel}"

        pubsub = self.redis.pubsub()
        if inspect.isawaitable(pubsub):
            pubsub = await pubsub
        self.pubsub = pubsub
        await self.pubsub.subscribe(channel)

        logger.info(
            "websocket.subscribed",
            tenant_id=self.tenant_id,
            user_id=self.user_info.user_id,
            channel=channel,
        )

        # Send subscription confirmation
        await self.send_json(
            {
                "type": "subscribed",
                "channel": channel,
                "tenant_id": self.tenant_id,
            }
        )

    async def close(self) -> None:
        """Close WebSocket connection and cleanup resources."""
        if self.is_closed:
            return

        self.is_closed = True

        if self.pubsub:
            try:
                await self.pubsub.close()
            except Exception as e:
                logger.warning(
                    "websocket.pubsub_close_failed",
                    tenant_id=self.tenant_id,
                    error=str(e),
                )

        try:
            await self.websocket.close()
        except Exception:
            pass  # Connection might already be closed

        logger.info(
            "websocket.disconnected",
            tenant_id=self.tenant_id,
            user_id=self.user_info.user_id,
        )
