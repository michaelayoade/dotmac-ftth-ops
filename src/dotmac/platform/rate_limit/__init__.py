"""
Rate Limiting Module.

Redis-backed rate limiting with sliding window algorithm.
"""

from dotmac.platform.rate_limit.decorators import (
    rate_limit,
    rate_limit_per_day,
    rate_limit_per_hour,
    rate_limit_per_ip,
    rate_limit_per_minute,
)
from dotmac.platform.rate_limit.middleware import RateLimitMiddleware
from dotmac.platform.rate_limit.models import (
    RateLimitAction,
    RateLimitLog,
    RateLimitRule,
    RateLimitScope,
    RateLimitWindow,
)
from dotmac.platform.rate_limit.service import RateLimitExceeded, RateLimitService

__all__ = [
    # Models
    "RateLimitRule",
    "RateLimitLog",
    "RateLimitAction",
    "RateLimitScope",
    "RateLimitWindow",
    # Service
    "RateLimitService",
    "RateLimitExceeded",
    # Middleware
    "RateLimitMiddleware",
    # Decorators
    "rate_limit",
    "rate_limit_per_minute",
    "rate_limit_per_hour",
    "rate_limit_per_day",
    "rate_limit_per_ip",
]
