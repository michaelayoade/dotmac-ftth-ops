"""
Simple caching setup using redis-py and cachetools directly.

SECURITY: Uses JSON serialization instead of pickle to prevent
arbitrary code execution vulnerabilities.
"""

import json
from datetime import datetime
from functools import wraps
from typing import Any, cast

import redis
from cachetools import LRUCache, TTLCache, cached  # noqa: PGH003

from dotmac.platform.settings import settings


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles datetime objects."""

    def default(self, obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


# Redis client for distributed caching (lazy initialisation)
redis_client: redis.Redis[Any] | None = None
_redis_init_attempted = False

# In-memory caches for local caching
# These are thread-safe by default in cachetools
memory_cache: TTLCache[str, Any] = TTLCache(maxsize=1000, ttl=300)  # 5 min TTL
lru_cache: LRUCache[str, Any] = LRUCache(maxsize=500)


def get_redis() -> redis.Redis[Any] | None:
    """Get Redis client if available."""
    global redis_client, _redis_init_attempted

    if redis_client is not None:
        return redis_client

    if _redis_init_attempted:
        return redis_client

    _redis_init_attempted = True
    try:
        redis_client = cast(
            redis.Redis[Any],
            redis.Redis.from_url(
                settings.redis.cache_url,
                decode_responses=False,
                max_connections=settings.redis.max_connections,
            ),
        )
    except Exception:
        redis_client = None

    return redis_client


def set_redis_client(client: redis.Redis[Any] | None) -> None:
    """Override the global Redis client (useful for testing)."""
    global redis_client, _redis_init_attempted
    redis_client = client
    _redis_init_attempted = client is not None


def cache_get(key: str, default: Any | None = None) -> Any:
    """
    Get value from cache (Redis if available, memory otherwise).

    SECURITY: Uses JSON deserialization to prevent pickle vulnerabilities.

    Args:
        key: Cache key
        default: Default value if not found

    Returns:
        Cached value or default

    Note:
        Only JSON-serializable types are supported. Complex objects
        (e.g., datetime, custom classes) should be converted before caching.
    """
    client = get_redis()
    if client:
        try:
            value = client.get(key)
            if value:
                # Decode bytes to string and parse JSON
                if isinstance(value, bytes):
                    return json.loads(value.decode("utf-8"))
                if isinstance(value, (bytearray, memoryview)):
                    return json.loads(bytes(value).decode("utf-8"))
                return json.loads(value)
        except (json.JSONDecodeError, UnicodeDecodeError, TypeError):
            # Invalid JSON or encoding - return default
            pass
        except Exception:
            pass  # Fall back to memory cache

    return memory_cache.get(key, default)


def cache_set(key: str, value: Any, ttl: int | None = 300) -> bool:
    """
    Set value in cache (Redis if available, memory otherwise).

    SECURITY: Uses JSON serialization to prevent pickle vulnerabilities.

    Args:
        key: Cache key
        value: Value to cache (must be JSON-serializable)
        ttl: Time to live in seconds

    Returns:
        True if successful

    Raises:
        TypeError: If value is not JSON-serializable

    Note:
        Only JSON-serializable types are supported. Complex objects
        (e.g., datetime, custom classes) should be converted before caching.
    """
    client = get_redis()
    if client:
        try:
            # Serialize to JSON with datetime support
            payload = json.dumps(value, cls=DateTimeEncoder)
            if ttl is None:
                client.set(key, payload)
            else:
                client.setex(key, ttl, payload)
            return True
        except (TypeError, ValueError) as e:
            # Value not JSON-serializable - raise error for caller to handle
            raise TypeError(f"Cache value must be JSON-serializable: {e}") from e
        except Exception:
            pass  # Fall back to memory cache

    memory_cache[key] = value
    return True


def cache_delete(key: str) -> bool:
    """
    Delete value from cache.

    Args:
        key: Cache key

    Returns:
        True if key existed and was deleted
    """
    deleted = False

    client = get_redis()
    if client:
        try:
            deleted = bool(client.delete(key))
        except Exception:
            pass

    if key in memory_cache:
        del memory_cache[key]
        deleted = True

    return deleted


def cache_clear() -> None:
    """Clear all caches."""
    client = get_redis()
    if client:
        try:
            client.flushdb()
        except Exception:
            pass

    memory_cache.clear()
    lru_cache.clear()


def redis_cache(ttl: int = 300) -> Any:
    """
    Decorator for caching function results in Redis.

    Args:
        ttl: Time to live in seconds

    Example:
        @redis_cache(ttl=600)
        def expensive_function(arg):
            return compute_something(arg)
    """

    def decorator(func: Any) -> Any:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Create stable cache key from function name and arguments
            import hashlib

            key_data = f"{func.__module__}.{func.__name__}:{args}:{sorted(kwargs.items())}"
            key = f"cache:{hashlib.md5(key_data.encode(), usedforsecurity=False).hexdigest()}"  # nosec B324 - MD5 for cache key only

            # Try to get from cache
            result = cache_get(key)
            if result is not None:
                return result

            # Compute and cache
            result = func(*args, **kwargs)
            cache_set(key, result, ttl)
            return result

        return wrapper

    return decorator


# Direct exports of cachetools decorators for in-memory caching
# Users can use these directly without any wrapper
__all__ = [
    # Redis functions
    "redis_client",
    "set_redis_client",
    "get_redis",
    "cache_get",
    "cache_set",
    "cache_delete",
    "cache_clear",
    "redis_cache",
    # In-memory caches
    "memory_cache",
    "lru_cache",
    # Direct cachetools exports
    "cached",
    "TTLCache",
    "LRUCache",
]

# Example usage:
#
# # Redis caching
# @redis_cache(ttl=600)
# def get_user(user_id):
#     return db.query(User).get(user_id)
#
# # In-memory caching with cachetools
# @cached(cache=TTLCache(maxsize=100, ttl=300))
# def calculate_something(x, y):
#     return expensive_calculation(x, y)
