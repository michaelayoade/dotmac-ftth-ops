"""
Rate Limiting Decorators.

Decorators for fine-grained rate limiting on specific endpoints.
"""

import hashlib
import ipaddress
from collections.abc import Callable
from datetime import UTC, datetime
from functools import wraps
from typing import Any
from uuid import UUID

import redis.asyncio as aioredis
import structlog
from fastapi import HTTPException, Request, status

from dotmac.platform.rate_limit.models import RateLimitAction, RateLimitScope, RateLimitWindow
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# Global Redis connection pool for rate limiting
# This avoids creating a new connection for every request
_redis_pool: aioredis.Redis | None = None


async def _get_redis() -> aioredis.Redis:
    """
    Get Redis connection for rate limiting.

    Uses a singleton connection pool to avoid exhausting connections.
    This is independent of the database session pool.
    """
    global _redis_pool

    if _redis_pool is None:
        redis_url = settings.redis.redis_url
        _redis_pool = await aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=50,  # Dedicated pool for rate limiting
        )

    return _redis_pool


async def _check_rate_limit_redis(
    tenant_id: str,
    scope: RateLimitScope,
    identifier: str,
    max_requests: int,
    window_seconds: int,
    endpoint: str,
) -> tuple[bool, int]:
    """
    Check rate limit directly against Redis without database session.

    This avoids the database connection exhaustion issue for public endpoints.

    Args:
        tenant_id: Tenant identifier
        scope: Rate limit scope
        identifier: Unique identifier (IP, user ID, etc.)
        max_requests: Maximum requests allowed
        window_seconds: Time window in seconds
        endpoint: API endpoint path

    Returns:
        Tuple of (is_allowed, current_count)
    """
    redis = await _get_redis()

    # Generate key (same logic as RateLimitService)
    key_parts = [tenant_id, scope.value, identifier, endpoint]
    key_str = ":".join(key_parts)
    id_hash = hashlib.md5(key_str.encode(), usedforsecurity=False).hexdigest()[:16]
    key = f"ratelimit:{tenant_id}:{scope.value}:{id_hash}"

    # Use Redis sorted set for sliding window
    now = datetime.now(UTC).timestamp()
    window_start = now - window_seconds

    # Remove old entries outside window
    await redis.zremrangebyscore(key, 0, window_start)

    # Count current entries in window
    current_count = await redis.zcount(key, window_start, now)

    # Check limit
    is_allowed = current_count < max_requests

    return is_allowed, current_count


async def _increment_rate_limit_redis(
    tenant_id: str,
    scope: RateLimitScope,
    identifier: str,
    window_seconds: int,
    endpoint: str,
) -> None:
    """
    Increment rate limit counter in Redis without database session.

    Args:
        tenant_id: Tenant identifier
        scope: Rate limit scope
        identifier: Unique identifier (IP, user ID, etc.)
        window_seconds: Time window in seconds
        endpoint: API endpoint path
    """
    redis = await _get_redis()

    # Generate key (same logic as RateLimitService)
    key_parts = [tenant_id, scope.value, identifier, endpoint]
    key_str = ":".join(key_parts)
    id_hash = hashlib.md5(key_str.encode(), usedforsecurity=False).hexdigest()[:16]
    key = f"ratelimit:{tenant_id}:{scope.value}:{id_hash}"

    now = datetime.now(UTC).timestamp()

    # Add current request to sorted set
    await redis.zadd(key, {str(now): now})

    # Set expiration to window + 60 seconds buffer
    await redis.expire(key, window_seconds + 60)


def rate_limit(
    max_requests: int,
    window: RateLimitWindow = RateLimitWindow.MINUTE,
    scope: RateLimitScope = RateLimitScope.PER_USER,
    action: RateLimitAction = RateLimitAction.BLOCK,
) -> Callable[..., Any]:
    """
    Decorator to apply rate limiting to a specific endpoint.

    Usage:
        @router.get("/api/expensive-operation")
        @rate_limit(max_requests=10, window=RateLimitWindow.HOUR, scope=RateLimitScope.PER_USER)  # type: ignore[misc]  # Rate limit decorator is untyped
        async def expensive_operation():
            ...

    Args:
        max_requests: Maximum number of requests allowed
        window: Time window for rate limit
        scope: Scope of rate limit (per user, per IP, etc.)
        action: Action to take when limit exceeded
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Extract request from args/kwargs
            request: Request | None = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if not request and "request" in kwargs:
                request = kwargs["request"]

            if not request:
                # No request object, skip rate limiting
                return await func(*args, **kwargs)

            # Extract request info
            endpoint = request.url.path
            raw_user_id = getattr(request.state, "user_id", None)
            user_id: UUID | None = None
            if raw_user_id is not None:
                if isinstance(raw_user_id, UUID):
                    user_id = raw_user_id
                else:
                    try:
                        user_id = UUID(str(raw_user_id))
                    except (TypeError, ValueError):
                        user_id = None
            tenant_id = getattr(request.state, "tenant_id", None) or "public"
            ip_address = _get_client_ip(request)
            api_key_id = getattr(request.state, "api_key_id", None)

            # Convert window to seconds
            window_seconds_map = {
                RateLimitWindow.SECOND: 1,
                RateLimitWindow.MINUTE: 60,
                RateLimitWindow.HOUR: 3600,
                RateLimitWindow.DAY: 86400,
            }
            window_seconds = window_seconds_map.get(window, 60)

            # Determine identifier based on scope
            identifier: str | None = None
            if scope == RateLimitScope.PER_USER:
                identifier = str(user_id) if user_id else None
            elif scope == RateLimitScope.PER_IP:
                identifier = ip_address
            elif scope == RateLimitScope.PER_ENDPOINT:
                identifier = endpoint
            elif scope == RateLimitScope.PER_TENANT:
                identifier = tenant_id
            elif scope == RateLimitScope.PER_API_KEY:
                identifier = str(api_key_id) if api_key_id else None
            elif scope == RateLimitScope.GLOBAL:
                identifier = "global"

            if identifier is None or identifier == "unknown":
                # Can't determine identifier, allow request
                # (e.g., PER_USER scope but no user, or IP is unknown)
                return await func(*args, **kwargs)

            # Check rate limit using Redis directly (no database session)
            is_allowed, current_count = await _check_rate_limit_redis(
                tenant_id=tenant_id,
                scope=scope,
                identifier=identifier,
                max_requests=max_requests,
                window_seconds=window_seconds,
                endpoint=endpoint,
            )

            if not is_allowed:
                if action == RateLimitAction.BLOCK:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail={
                            "error": "rate_limit_exceeded",
                            "message": f"Rate limit exceeded: {current_count}/{max_requests} per {window.value}",
                            "limit": max_requests,
                            "window": window.value,
                            "retry_after": window_seconds,
                        },
                        headers={"Retry-After": str(window_seconds)},
                    )
                elif action == RateLimitAction.LOG_ONLY:
                    # Just log and continue
                    logger.warning(
                        "Rate limit exceeded (log only)",
                        endpoint=endpoint,
                        count=current_count,
                        limit=max_requests,
                    )

            # Execute function
            result = await func(*args, **kwargs)

            # Increment counter using Redis directly (no database session)
            await _increment_rate_limit_redis(
                tenant_id=tenant_id,
                scope=scope,
                identifier=identifier,
                window_seconds=window_seconds,
                endpoint=endpoint,
            )

            return result

        return wrapper

    return decorator


def _is_trusted_proxy(ip_str: str, trusted_proxies: list[str]) -> bool:
    """
    Check if an IP address is in the trusted proxy list.

    Args:
        ip_str: IP address to check
        trusted_proxies: List of trusted proxy IPs/networks in CIDR notation

    Returns:
        True if IP is trusted, False otherwise
    """
    try:
        client_ip = ipaddress.ip_address(ip_str)

        for proxy_spec in trusted_proxies:
            try:
                # Try as network first (e.g., "10.0.0.0/8")
                if "/" in proxy_spec:
                    network = ipaddress.ip_network(proxy_spec, strict=False)
                    if client_ip in network:
                        return True
                else:
                    # Try as single IP
                    proxy_ip = ipaddress.ip_address(proxy_spec)
                    if client_ip == proxy_ip:
                        return True
            except (ValueError, TypeError):
                # Invalid proxy spec, skip it
                continue

        return False
    except (ValueError, TypeError):
        # Invalid IP format
        return False


def _get_client_ip(request: Request) -> str:
    """
    Extract client IP address from request with trusted proxy validation.

    SECURITY: Parses X-Forwarded-For from RIGHT to LEFT, stripping known trusted
    proxies to find the real client IP. This prevents bypass attacks where standard
    reverse proxies APPEND to client-supplied headers.

    Example:
        Client sends: X-Forwarded-For: 1.2.3.4
        NGINX appends: X-Forwarded-For: 1.2.3.4, 5.6.7.8
        We parse right-to-left, skip 5.6.7.8 (trusted), use 1.2.3.4 (attacker)

        Better: Client real IP is 5.6.7.8 (last hop before trusted proxy)
        Parse: [1.2.3.4, 5.6.7.8] -> 5.6.7.8 is trusted, 1.2.3.4 is client-supplied

        Correct algorithm: Take rightmost IP that's NOT in trusted_proxies

    Args:
        request: FastAPI Request object

    Returns:
        Client IP address (or "unknown" if cannot be determined)
    """
    # Get the direct connection IP (always available)
    direct_ip = request.client.host if request.client else "unknown"

    # Only trust proxy headers if request came from a trusted proxy
    trusted_proxies = settings.trusted_proxies

    if direct_ip != "unknown" and _is_trusted_proxy(direct_ip, trusted_proxies):
        # Request came from trusted proxy, check forwarded headers
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # X-Forwarded-For format: "client, proxy1, proxy2, ..."
            # Parse RIGHT to LEFT, skipping trusted proxies
            ips = [ip.strip() for ip in forwarded.split(",")]

            # Walk backwards, skipping trusted proxies
            for ip in reversed(ips):
                # Validate it's a real IP
                try:
                    ipaddress.ip_address(ip)
                except (ValueError, TypeError):
                    continue  # Skip invalid IPs

                # If this IP is NOT a trusted proxy, it's the real client
                if not _is_trusted_proxy(ip, trusted_proxies):
                    return ip

            # All IPs were trusted proxies or invalid, fall through

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            # Validate it's a real IP before using
            try:
                ipaddress.ip_address(real_ip)
                return real_ip
            except (ValueError, TypeError):
                pass  # Invalid IP, fall through

    # Either not from trusted proxy, or no valid forwarded headers
    # Use direct connection IP
    return direct_ip


# Convenience decorators for common use cases
def rate_limit_per_minute(max_requests: int = 60) -> Callable[..., Any]:
    """Rate limit per user per minute."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.MINUTE,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_hour(max_requests: int = 1000) -> Callable[..., Any]:
    """Rate limit per user per hour."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.HOUR,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_day(max_requests: int = 10000) -> Callable[..., Any]:
    """Rate limit per user per day."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.DAY,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_ip(
    max_requests: int = 100, window: RateLimitWindow = RateLimitWindow.MINUTE
) -> Callable[..., Any]:
    """Rate limit per IP address."""
    return rate_limit(
        max_requests=max_requests,
        window=window,
        scope=RateLimitScope.PER_IP,
    )
