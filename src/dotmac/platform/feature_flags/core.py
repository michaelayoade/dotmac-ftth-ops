"""
Simple feature flags using Redis  # type: ignore[misc] + cache - no bloat.

Provides a lightweight feature flag system with Redis  # type: ignore[misc] backend and in-memory cache.
Supports simple on/off flags, context-based evaluation, and A/B testing.
"""

import inspect
import json
import threading
import time
from collections.abc import Callable
from hashlib import sha256
from typing import Any, TypeVar

import redis.asyncio as redis
import structlog
from cachetools import TTLCache  # noqa: PGH003

from dotmac.platform.redis_client import RedisClientType
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)

# In-memory cache for fast lookups
_flag_cache: TTLCache[str, dict[str, Any]] = TTLCache(maxsize=1000, ttl=60)  # 1 minute TTL
_redis_client: RedisClientType | None = None
_redis_available: bool | None = None  # Cache Redis  # type: ignore[misc] availability check


class FeatureFlagError(Exception):
    """Feature flag specific errors."""

    pass


class RedisUnavailableError(FeatureFlagError):
    """Redis  # type: ignore[misc] is not available for feature flags."""

    pass


async def _check_redis_availability() -> bool:
    """Check if Redis  # type: ignore[misc] is available and accessible."""
    global _redis_available

    if _redis_available is not None:
        return _redis_available

    try:
        # Get Redis  # type: ignore[misc] URL from settings
        redis_url = getattr(settings.redis, "redis_url", None)
        if not redis_url:
            logger.warning(
                "Redis  # type: ignore[misc] URL not configured, feature flags will use in-memory fallback"
            )
            _redis_available = False
            return False

        # Test connection
        test_client = redis.from_url(redis_url)
        try:
            await test_client.ping()
        finally:
            # Try aclose() first (modern async redis client)
            aclose_method = getattr(test_client, "aclose", None)
            if callable(aclose_method):
                await aclose_method()
            # Fallback to close() for older clients
            elif hasattr(test_client, "close"):
                close_result = getattr(test_client, "close", None)
                if callable(close_result):
                    result = close_result()
                    if inspect.isawaitable(result):
                        await result

        _redis_available = True
        logger.info("Redis  # type: ignore[misc] available for feature flags", redis_url=redis_url)
        return True

    except Exception as e:
        logger.warning(
            "Redis  # type: ignore[misc] not available, feature flags will use in-memory fallback",
            error=str(e),
        )
        _redis_available = False
        return False


async def get_redis_client() -> RedisClientType | None:
    """Get Redis  # type: ignore[misc] client for flags, returns None if Redis  # type: ignore[misc] unavailable."""
    global _redis_client

    if not await _check_redis_availability():
        return None

    if _redis_client is None:
        try:
            redis_url = settings.redis.redis_url
            _redis_client = redis.from_url(redis_url)
            # Test the connection
            await _redis_client.ping()
        except Exception as e:
            logger.error(
                "Failed to create Redis  # type: ignore[misc] client for feature flags",
                error=str(e),
            )
            _redis_client = None
            # Mark as unavailable for future calls
            global _redis_available
            _redis_available = False
            return None

    return _redis_client


def _normalize_flag_data(raw: dict[str, Any]) -> dict[str, Any]:
    """Ensure flag data has expected keys and migrate legacy metadata."""
    normalized_context = dict(raw.get("context") or {})
    normalized_metadata = dict(raw.get("metadata") or {})

    legacy_metadata_keys = {
        "_description": "description",
        "_created_at": "created_at",
        "_created_by": "created_by",
        "_updated_at": "updated_at",
        "_updated_by": "updated_by",
        "_bulk_updated_at": "bulk_updated_at",
    }

    for legacy_key, target_key in legacy_metadata_keys.items():
        if legacy_key in normalized_context and target_key not in normalized_metadata:
            normalized_metadata[target_key] = normalized_context.pop(legacy_key)

    return {
        "enabled": bool(raw.get("enabled", False)),
        "context": normalized_context,
        "metadata": normalized_metadata,
        "updated_at": raw.get("updated_at", int(time.time())),
    }


def _cache_flag(name: str, raw_flag: dict[str, Any]) -> dict[str, Any]:
    """Store normalized flag data in cache and return it."""
    normalized = _normalize_flag_data(raw_flag)
    _flag_cache[name] = normalized
    return normalized


async def set_flag(
    name: str,
    enabled: bool,
    context: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Set feature flag value."""
    flag_data = {
        "enabled": enabled,
        "context": dict(context or {}),
        "metadata": dict(metadata or {}),
        "updated_at": int(time.time()),
    }

    # Always update cache
    _cache_flag(name, flag_data)

    # Try to persist to Redis  # type: ignore[misc] if available
    client = await get_redis_client()
    if client:
        try:
            await client.hset("feature_flags", name, json.dumps(flag_data))
            logger.info(
                "Feature flag updated in Redis  # type: ignore[misc] and cache",
                flag=name,
                enabled=enabled,
            )
        except Exception as e:
            logger.warning(
                "Failed to persist flag to Redis  # type: ignore[misc], using cache only",
                flag=name,
                error=str(e),
            )
    else:
        logger.info(
            "Feature flag updated in cache only (Redis  # type: ignore[misc] unavailable)",
            flag=name,
            enabled=enabled,
        )


async def is_enabled(name: str, context: dict[str, Any] | None = None) -> bool:
    """Check if feature flag is enabled."""
    # Check cache first
    flag_data: dict[str, Any] | None
    if name in _flag_cache:
        flag_data = _flag_cache[name]
    else:
        # Try to get from Redis  # type: ignore[misc] if available
        client = await get_redis_client()
        flag_data = None

        if client:
            try:
                flag_json = await client.hget("feature_flags", name)
                if flag_json:
                    raw_flag_data = json.loads(flag_json)
                    flag_data = _cache_flag(name, raw_flag_data)
            except Exception as e:
                logger.warning(
                    "Failed to get flag from Redis  # type: ignore[misc], checking cache only",
                    flag=name,
                    error=str(e),
                )

        # If not found in Redis  # type: ignore[misc] or Redis  # type: ignore[misc] unavailable, check if we have a default
        if not flag_data:
            logger.debug("Feature flag not found, defaulting to False", flag=name)
            return False

    enabled: bool = flag_data.get("enabled", False)

    # Simple context matching (can be extended)
    flag_context: dict[str, Any] = dict(flag_data.get("context", {}))
    if context and flag_context:
        # Check if all flag context conditions match
        for key, value in flag_context.items():
            if key.startswith("_"):
                continue
            if context.get(key) != value:
                enabled = False
                break

    logger.debug("Feature flag checked", flag=name, enabled=enabled, context=context)
    return enabled


async def get_variant(name: str, context: dict[str, Any] | None = None) -> str:
    """Get A/B test variant. Returns 'control' if flag disabled."""
    if not await is_enabled(name, context):
        return "control"

    # Simple A/B test based on user_id hash
    if context and "user_id" in context:
        digest = sha256(f"{name}:{context['user_id']}".encode()).digest()
        bucket = int.from_bytes(digest[:8], "big") % 100
        return "variant_a" if bucket < 50 else "variant_b"

    return "control"


async def list_flags() -> dict[str, dict[str, Any]]:
    """List all feature flags."""
    result = {}

    # Start with flags from cache
    for name, flag_data in _flag_cache.items():
        result[name] = _normalize_flag_data(flag_data)

    # Try to get additional flags from Redis  # type: ignore[misc] if available
    client = await get_redis_client()
    if client:
        try:
            flags = await client.hgetall("feature_flags")

            for name, flag_json in flags.items():
                if isinstance(name, bytes):
                    name = name.decode()
                if isinstance(flag_json, bytes):
                    flag_json = flag_json.decode()

                try:
                    raw_flag = json.loads(flag_json)
                    flag_data = _cache_flag(name, raw_flag)
                    result[name] = flag_data
                except json.JSONDecodeError:
                    logger.warning("Invalid flag data in Redis  # type: ignore[misc]", flag=name)
        except Exception as e:
            logger.warning(
                "Failed to list flags from Redis  # type: ignore[misc], returning cache only",
                error=str(e),
            )

    logger.debug(
        "Listed feature flags",
        count=len(result),
        source="Redis  # type: ignore[misc]+Cache" if client else "Cache",
    )
    return result


async def delete_flag(name: str) -> bool:
    """Delete feature flag."""
    deleted_from_redis = False
    deleted_from_cache = False

    # Remove from cache
    if name in _flag_cache:
        del _flag_cache[name]
        deleted_from_cache = True

    # Try to remove from Redis  # type: ignore[misc] if available
    client = await get_redis_client()
    if client:
        try:
            deleted_count = await client.hdel("feature_flags", name)
            deleted_from_redis = bool(deleted_count)
        except Exception as e:
            logger.warning(
                "Failed to delete flag from Redis  # type: ignore[misc]", flag=name, error=str(e)
            )

    success = deleted_from_redis or deleted_from_cache
    if success:
        logger.info(
            "Feature flag deleted",
            flag=name,
            from_redis=deleted_from_redis,
            from_cache=deleted_from_cache,
        )
    else:
        logger.warning("Feature flag not found for deletion", flag=name)

    return success


async def get_flag_status() -> dict[str, Any]:
    """Get feature flag system status."""
    redis_available = await _check_redis_availability()
    cache_size = len(_flag_cache)

    status = {
        "redis_available": redis_available,
        "redis_url": getattr(settings.redis, "redis_url", None) if redis_available else None,
        "cache_size": cache_size,
        "cache_maxsize": _flag_cache.maxsize,
        "cache_ttl": _flag_cache.ttl,
        "total_flags": cache_size,
    }

    if redis_available:
        client = await get_redis_client()
        if client:
            try:
                redis_flags = await client.hlen("feature_flags")
                status["redis_flags"] = redis_flags
                status["total_flags"] = max(cache_size, redis_flags)
            except Exception as e:
                logger.warning("Failed to get Redis  # type: ignore[misc] flag count", error=str(e))

    return status


async def clear_cache() -> None:
    """Clear the in-memory flag cache."""
    _flag_cache.clear()
    logger.info("Feature flag cache cleared")


async def sync_from_redis() -> int:
    """Sync all flags from Redis  # type: ignore[misc] to cache. Returns number of flags synced."""
    client = await get_redis_client()
    if not client:
        logger.warning("Cannot sync from Redis  # type: ignore[misc]: not available")
        return 0

    try:
        flags = await client.hgetall("feature_flags")
        synced_count = 0

        for name, flag_json in flags.items():
            if isinstance(name, bytes):
                name = name.decode()
            if isinstance(flag_json, bytes):
                flag_json = flag_json.decode()

            try:
                raw_flag = json.loads(flag_json)
                _cache_flag(name, raw_flag)
                synced_count += 1
            except json.JSONDecodeError:
                logger.warning("Skipped invalid flag data during sync", flag=name)

        logger.info("Synced flags from Redis  # type: ignore[misc] to cache", count=synced_count)
        return synced_count

    except Exception as e:
        logger.error("Failed to sync flags from Redis  # type: ignore[misc]", error=str(e))
        return 0


# Convenience decorators
F = TypeVar("F", bound=Callable[..., Any])


def feature_flag(flag_name: str, default: bool = False) -> Callable[[F], F]:
    """Decorator to enable/disable function based on feature flag."""
    import asyncio

    def decorator(func: F) -> F:
        if asyncio.iscoroutinefunction(func):
            # Handle async functions
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                # Extract context from kwargs if available
                context = kwargs.pop("_feature_context", None)

                if await is_enabled(flag_name, context):
                    return await func(*args, **kwargs)
                elif default:
                    return await func(*args, **kwargs)
                else:
                    logger.debug("Function skipped due to feature flag", flag=flag_name)
                    return None

            return async_wrapper  # type: ignore[return-value]
        else:
            # Handle sync functions
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                # Extract context from kwargs if available
                context = kwargs.pop("_feature_context", None)

                async def evaluate() -> bool:
                    return await is_enabled(flag_name, context)

                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = None

                try:
                    running_loop = asyncio.get_running_loop()
                except RuntimeError:
                    running_loop = None

                if running_loop and running_loop.is_running():
                    result_container: dict[str, Any] = {}
                    exception_container: dict[str, BaseException] = {}

                    def runner() -> None:
                        try:
                            result_container["value"] = asyncio.run(evaluate())
                        except BaseException as exc:  # pragma: no cover - defensive
                            exception_container["error"] = exc

                    thread = threading.Thread(target=runner)
                    thread.start()
                    thread.join()

                    if "error" in exception_container:
                        raise exception_container["error"]

                    enabled = bool(result_container.get("value", False))
                elif loop:
                    enabled = loop.run_until_complete(evaluate())
                else:
                    enabled = asyncio.run(evaluate())

                if enabled or default:
                    return func(*args, **kwargs)
                else:
                    logger.debug("Function skipped due to feature flag", flag=flag_name)
                    return None

            return sync_wrapper  # type: ignore[return-value]

    return decorator


# Usage examples:
#
# # Set flags
# await set_flag("new_ui", True)
# await set_flag("beta_features", True, {"user_type": "premium"})
#
# # Check flags
# if await is_enabled("new_ui"):
#     return render_new_ui()
#
# # A/B testing
# variant = await get_variant("checkout_flow", {"user_id": "123"})
# if variant == "variant_a":
#     return new_checkout()
#
# # Decorator usage
# @feature_flag("experimental_feature")
# async def experimental_function():
#     return "This only runs if flag is enabled"
#
# # For even simpler cases, use Redis  # type: ignore[misc] directly:
# import redis.asyncio as redis
# client = redis.from_url("redis://localhost")
# await client.hset("flags", "my_flag", "true")
# enabled = await client.hget("flags", "my_flag") == b"true"
