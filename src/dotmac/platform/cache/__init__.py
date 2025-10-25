"""
Cache Module.

Redis-backed caching with decorators and multiple strategies.
"""

from dotmac.platform.cache.decorators import (
    cache_aside,
    cache_result_per_tenant,
    cache_result_per_user,
    cached,
    invalidate_cache,
    memoize,
)
from dotmac.platform.cache.models import (
    CacheConfig,
    CacheNamespace,
    CachePattern,
    CacheStatistics,
    CacheStrategy,
)
from dotmac.platform.cache.service import CacheService, get_cache_service

__all__ = [
    # Models
    "CacheConfig",
    "CacheStatistics",
    "CacheNamespace",
    "CachePattern",
    "CacheStrategy",
    # Service
    "CacheService",
    "get_cache_service",
    # Decorators
    "cached",
    "cache_aside",
    "invalidate_cache",
    "cache_result_per_user",
    "cache_result_per_tenant",
    "memoize",
]
