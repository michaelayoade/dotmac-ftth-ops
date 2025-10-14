"""
Rate Limiting Decorators.

Decorators for fine-grained rate limiting on specific endpoints.
"""

from functools import wraps
from typing import Any, Callable

from fastapi import HTTPException, Request, status

from dotmac.platform.database import get_async_session
from dotmac.platform.rate_limit.models import RateLimitAction, RateLimitScope, RateLimitWindow
from dotmac.platform.rate_limit.service import RateLimitService


def rate_limit(
    max_requests: int,
    window: RateLimitWindow = RateLimitWindow.MINUTE,
    scope: RateLimitScope = RateLimitScope.PER_USER,
    action: RateLimitAction = RateLimitAction.BLOCK,
) -> Callable:
    """
    Decorator to apply rate limiting to a specific endpoint.

    Usage:
        @router.get("/api/expensive-operation")
        @rate_limit(max_requests=10, window=RateLimitWindow.HOUR, scope=RateLimitScope.PER_USER)
        async def expensive_operation():
            ...

    Args:
        max_requests: Maximum number of requests allowed
        window: Time window for rate limit
        scope: Scope of rate limit (per user, per IP, etc.)
        action: Action to take when limit exceeded
    """

    def decorator(func: Callable) -> Callable:
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
            method = request.method
            user_id = getattr(request.state, "user_id", None)
            tenant_id = getattr(request.state, "tenant_id", None) or "public"
            ip_address = _get_client_ip(request)
            api_key_id = getattr(request.state, "api_key_id", None)

            # Check rate limit
            async for db in get_async_session():
                service = RateLimitService(db)

                # Create temporary rule for this decorator
                from dotmac.platform.rate_limit.models import RateLimitRule
                from uuid import uuid4

                temp_rule = RateLimitRule(
                    id=uuid4(),
                    tenant_id=tenant_id,
                    name=f"decorator_{func.__name__}",
                    scope=scope,
                    max_requests=max_requests,
                    window=window,
                    window_seconds=service._get_window_seconds(window),
                    action=action,
                )

                # Determine identifier
                identifier = service._get_identifier(
                    scope, user_id, ip_address, api_key_id, endpoint
                )

                if identifier is None:
                    # Can't determine identifier, allow request
                    return await func(*args, **kwargs)

                # Check limit
                is_allowed, current_count = await service._check_limit(
                    tenant_id=tenant_id,
                    rule=temp_rule,
                    identifier=identifier,
                )

                if not is_allowed:
                    retry_after = temp_rule.window_seconds

                    if action == RateLimitAction.BLOCK:
                        raise HTTPException(
                            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail={
                                "error": "rate_limit_exceeded",
                                "message": f"Rate limit exceeded: {current_count}/{max_requests} per {window.value}",
                                "limit": max_requests,
                                "window": window.value,
                                "retry_after": retry_after,
                            },
                            headers={"Retry-After": str(retry_after)},
                        )
                    elif action == RateLimitAction.LOG_ONLY:
                        # Just log and continue
                        import structlog

                        logger = structlog.get_logger(__name__)
                        logger.warning(
                            "Rate limit exceeded (log only)",
                            endpoint=endpoint,
                            count=current_count,
                            limit=max_requests,
                        )

                # Execute function
                result = await func(*args, **kwargs)

                # Increment counter
                await service._increment_counter(tenant_id, temp_rule, identifier)

                return result

        return wrapper

    return decorator


def _get_client_ip(request: Request) -> str:
    """Extract client IP address from request."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    if request.client:
        return request.client.host

    return "unknown"


# Convenience decorators for common use cases
def rate_limit_per_minute(max_requests: int = 60) -> Callable:
    """Rate limit per user per minute."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.MINUTE,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_hour(max_requests: int = 1000) -> Callable:
    """Rate limit per user per hour."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.HOUR,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_day(max_requests: int = 10000) -> Callable:
    """Rate limit per user per day."""
    return rate_limit(
        max_requests=max_requests,
        window=RateLimitWindow.DAY,
        scope=RateLimitScope.PER_USER,
    )


def rate_limit_per_ip(max_requests: int = 100, window: RateLimitWindow = RateLimitWindow.MINUTE) -> Callable:
    """Rate limit per IP address."""
    return rate_limit(
        max_requests=max_requests,
        window=window,
        scope=RateLimitScope.PER_IP,
    )
