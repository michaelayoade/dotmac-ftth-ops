"""
Generic caching decorators for the DotMac platform.

Provides reusable caching decorators that can be used across all modules.
"""

import hashlib
import inspect
import json
from collections.abc import Awaitable, Callable
from enum import Enum
from functools import wraps
from typing import ParamSpec, TypeVar, cast

import structlog

from dotmac.platform.core.caching import cache_get, cache_set

logger = structlog.get_logger(__name__)


class CacheTier(str, Enum):
    """Cache tier levels."""

    L1_MEMORY = "l1_memory"  # In-process memory cache
    L2_REDIS = "l2_redis"  # Distributed Redis cache
    L3_DATABASE = "l3_database"  # Database layer


P = ParamSpec("P")
R = TypeVar("R")


def cached_result(
    ttl: int | None = None,
    key_prefix: str = "",
    key_params: list[str] | None = None,
    tier: CacheTier = CacheTier.L2_REDIS,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """
    Decorator for caching function results.

    Args:
        ttl: Time to live in seconds
        key_prefix: Prefix for cache key
        key_params: Parameters to include in cache key
        tier: Cache tier to use

    Example:
        @cached_result(ttl=3600, key_prefix="user", key_params=["user_id"])
        async def get_user(user_id: str):
            # Expensive database query
            return user
    """

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        signature = inspect.signature(func)

        def _default_cache_key(*args: P.args, **kwargs: P.kwargs) -> str:
            func_name = f"{func.__module__}.{func.__name__}"
            args_str = json.dumps(
                {
                    "args": [str(a) for a in args],
                    "kwargs": {k: str(v) for k, v in kwargs.items()},
                },
                sort_keys=True,
            )
            args_hash = hashlib.md5(args_str.encode(), usedforsecurity=False).hexdigest()  # nosec B324 - Hash used for cache key generation only, not security
            return f"{key_prefix}:{func_name}:{args_hash}"

        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            # Generate cache key
            if key_params:
                bound = signature.bind_partial(*args, **kwargs)
                bound.apply_defaults()

                key_parts: list[str] = []
                if key_prefix:
                    key_parts.append(key_prefix)

                for param in key_params:
                    if param in bound.arguments:
                        key_parts.append(str(bound.arguments[param]))

                if key_parts and len(key_parts) > (1 if key_prefix else 0):
                    cache_key = ":".join(key_parts)
                else:
                    cache_key = _default_cache_key(*args, **kwargs)
            else:
                cache_key = _default_cache_key(*args, **kwargs)

            # Only L2_REDIS is supported for now (L1 would need instance-specific cache)
            if tier == CacheTier.L2_REDIS:
                cached_value = cast(R | None, cache_get(cache_key))
                if cached_value is not None:
                    logger.debug("Cache hit", key=cache_key, func=func.__name__)
                    return cached_value

                # Cache miss - execute function
                logger.debug("Cache miss", key=cache_key, func=func.__name__)
                result = await func(*args, **kwargs)

                # Store in cache
                if result is not None:
                    cache_set(cache_key, result, ttl=ttl)

                return result
            else:
                # Tier not supported, just execute function
                return await func(*args, **kwargs)

        return wrapper

    return decorator


__all__ = ["CacheTier", "cached_result"]
