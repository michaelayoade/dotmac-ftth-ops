"""
Rate Limiting Middleware.

FastAPI middleware for automatic rate limiting.
"""

import structlog
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from dotmac.platform.database import get_async_session
from dotmac.platform.rate_limit.service import RateLimitService

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce rate limiting on all requests."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        """Process request with rate limiting."""
        # Skip rate limiting for health/metrics endpoints
        if request.url.path in ["/health", "/ready", "/metrics"]:
            return await call_next(request)

        # Extract request info
        endpoint = request.url.path
        method = request.method
        ip_address = self._get_client_ip(request)

        # Get user/tenant from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        tenant_id = getattr(request.state, "tenant_id", None)
        api_key_id = getattr(request.state, "api_key_id", None)

        # Skip if no tenant (unauthenticated requests to public endpoints)
        if not tenant_id:
            tenant_id = "public"  # Use special tenant for public endpoints

        try:
            # Check rate limit
            async for db in get_async_session():
                service = RateLimitService(db)

                is_allowed, rule_applied, current_count = await service.check_rate_limit(
                    tenant_id=tenant_id,
                    endpoint=endpoint,
                    method=method,
                    user_id=user_id,
                    ip_address=ip_address,
                    api_key_id=api_key_id,
                )

                if not is_allowed and rule_applied:
                    # Calculate retry-after
                    retry_after = rule_applied.window_seconds

                    # Commit the violation log
                    await db.commit()

                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "error": "rate_limit_exceeded",
                            "message": f"Rate limit exceeded: {current_count}/{rule_applied.max_requests} per {rule_applied.window.value}",
                            "rule": rule_applied.name,
                            "limit": rule_applied.max_requests,
                            "window": rule_applied.window.value,
                            "retry_after": retry_after,
                        },
                        headers={"Retry-After": str(retry_after)},
                    )

                # Process request
                response = await call_next(request)

                # Increment counter for successful requests
                if 200 <= response.status_code < 400:
                    await service.increment(
                        tenant_id=tenant_id,
                        endpoint=endpoint,
                        user_id=user_id,
                        ip_address=ip_address,
                        api_key_id=api_key_id,
                    )

                # Add rate limit headers
                if rule_applied:
                    remaining = max(0, rule_applied.max_requests - current_count - 1)
                    retry_after = rule_applied.window_seconds
                    response.headers["X-RateLimit-Limit"] = str(rule_applied.max_requests)
                    response.headers["X-RateLimit-Remaining"] = str(remaining)
                    response.headers["X-RateLimit-Reset"] = str(retry_after)

                await db.commit()

                return response

        except Exception as e:
            logger.error("Rate limit middleware error", error=str(e))
            # Don't block requests if rate limiting fails
            return await call_next(request)

        # Fallback (should not reach here)
        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request."""
        # Check X-Forwarded-For header (behind proxy)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fallback to direct client
        if request.client:
            return request.client.host

        return "unknown"
