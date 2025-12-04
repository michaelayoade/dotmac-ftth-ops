"""
Feature flags package.

Provides feature flag management with Redis backend, in-memory caching,
and comprehensive REST API for managing flags in production environments.
"""

from .core import (
    FeatureFlagError,
    RedisUnavailableError,
    clear_cache,
    delete_flag,
    feature_flag,
    get_flag_status,
    get_variant,
    is_enabled,
    list_flags,
    set_flag,
    sync_from_redis,
)
from .router import feature_flags_router

__all__ = [
    # Core functionality
    "is_enabled",
    "set_flag",
    "delete_flag",
    "list_flags",
    "get_variant",
    "feature_flag",
    # Management functions
    "get_flag_status",
    "clear_cache",
    "sync_from_redis",
    # Exceptions
    "FeatureFlagError",
    "RedisUnavailableError",
    # API router
    "feature_flags_router",
]
