"""
Cache Decorators.

Decorators for automatic caching of function results.
"""

import asyncio
import functools
import hashlib
import inspect
import json
from collections.abc import Callable
from typing import Any, TypeVar

import structlog

from dotmac.platform.cache.models import CacheNamespace
from dotmac.platform.cache.service import get_cache_service

logger = structlog.get_logger(__name__)

T = TypeVar("T")


def cached(
    ttl: int = 3600,
    namespace: CacheNamespace | str = CacheNamespace.API_RESPONSE,
    key_prefix: str | None = None,
    include_tenant: bool = True,
    include_user: bool = False,
    key_builder: Callable[..., Any] | None = None,
) -> Callable[..., Any]:
    """
    Decorator to cache function results.

    Usage:
        @cached(ttl=3600, namespace=CacheNamespace.CUSTOMER)
        async def get_customer(customer_id: UUID):
            # Expensive operation
            return customer

    Args:
        ttl: Time-to-live in seconds
        namespace: Cache namespace
        key_prefix: Optional key prefix (defaults to function name)
        include_tenant: Include tenant_id in cache key
        include_user: Include user_id in cache key
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            cache = get_cache_service()

            # Generate cache key from function args
            cache_key = _generate_cache_key(
                func,
                args,
                kwargs,
                key_prefix,
                include_tenant,
                include_user,
                key_builder(*args, **kwargs) if key_builder else None,
            )

            # Extract tenant_id for isolation
            tenant_id = _extract_tenant_id(args, kwargs) if include_tenant else None

            # Try to get from cache
            cached_value = await cache.get(cache_key, namespace, tenant_id)

            if cached_value is not None:
                logger.debug(
                    "Cache hit",
                    function=func.__name__,
                    key=cache_key,
                    namespace=namespace,
                )
                return cached_value

            # Cache miss - execute function
            result = await func(*args, **kwargs)

            # Store in cache
            await cache.set(cache_key, result, namespace, tenant_id, ttl)

            logger.debug(
                "Cache miss - value cached",
                function=func.__name__,
                key=cache_key,
                namespace=namespace,
                ttl=ttl,
            )

            return result

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            # For sync functions, run async cache operations
            cache = get_cache_service()

            cache_key = _generate_cache_key(
                func,
                args,
                kwargs,
                key_prefix,
                include_tenant,
                include_user,
                key_builder(*args, **kwargs) if key_builder else None,
            )
            tenant_id = _extract_tenant_id(args, kwargs) if include_tenant else None

            # Try to get from cache (blocking)
            cached_value = asyncio.run(cache.get(cache_key, namespace, tenant_id))

            if cached_value is not None:
                return cached_value

            # Cache miss - execute function
            result = func(*args, **kwargs)

            # Store in cache (blocking)
            asyncio.run(cache.set(cache_key, result, namespace, tenant_id, ttl))

            return result

        # Return appropriate wrapper based on function type
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def cache_aside(
    ttl: int = 3600,
    namespace: CacheNamespace | str = CacheNamespace.QUERY_RESULT,
    key_builder: Callable[..., Any] | None = None,
) -> Callable[..., Any]:
    """
    Cache-aside pattern decorator.

    Check cache first, if miss load from source and cache.

    Usage:
        @cache_aside(ttl=3600, namespace=CacheNamespace.CUSTOMER)
        async def get_customer_by_id(db: AsyncSession, customer_id: UUID):
            stmt = select(Customer).where(Customer.id == customer_id)
            result = await db.execute(stmt)
            return result.scalar_one_or_none()
    """
    return cached(ttl=ttl, namespace=namespace, key_prefix=None, key_builder=key_builder)


def invalidate_cache(
    namespace: CacheNamespace | str,
    key_pattern: str | None = None,
    keys: list[str] | None = None,
) -> Callable[..., Any]:
    """
    Decorator to invalidate cache after function execution.

    Usage:
        @invalidate_cache(
            namespace=CacheNamespace.CUSTOMER,
            key_pattern="get_customer:*"
        )
        async def update_customer(customer_id: UUID, data: dict[str, Any]):
            # Update customer
            return customer

    Args:
        namespace: Cache namespace to invalidate
        key_pattern: Pattern for keys to invalidate (supports *)
        keys: Specific keys to invalidate
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            # Execute function first
            result = await func(*args, **kwargs)

            # Invalidate cache
            cache = get_cache_service()
            tenant_id = _extract_tenant_id(args, kwargs)

            if key_pattern:
                await cache.invalidate_pattern(key_pattern, namespace, tenant_id)
                logger.debug(
                    "Cache invalidated by pattern",
                    function=func.__name__,
                    pattern=key_pattern,
                    namespace=namespace,
                )
            elif keys:
                for key in keys:
                    await cache.delete(key, namespace, tenant_id)
                logger.debug(
                    "Cache invalidated by keys",
                    function=func.__name__,
                    keys=keys,
                    namespace=namespace,
                )

            return result

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            result = func(*args, **kwargs)

            cache = get_cache_service()
            tenant_id = _extract_tenant_id(args, kwargs)

            if key_pattern:
                asyncio.run(cache.invalidate_pattern(key_pattern, namespace, tenant_id))
            elif keys:
                for key in keys:
                    asyncio.run(cache.delete(key, namespace, tenant_id))

            return result

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def cache_result_per_user(ttl: int = 3600) -> Callable[..., Any]:
    """
    Convenience decorator for user-specific caching.

    Usage:
        @cache_result_per_user(ttl=3600)
        async def get_user_dashboard(user_id: UUID):
            # Expensive dashboard computation
            return dashboard_data
    """
    return cached(ttl=ttl, include_tenant=True, include_user=True)


def cache_result_per_tenant(ttl: int = 3600) -> Callable[..., Any]:
    """
    Convenience decorator for tenant-specific caching.

    Usage:
        @cache_result_per_tenant(ttl=3600)
        async def get_tenant_settings(tenant_id: str):
            # Load tenant settings
            return settings
    """
    return cached(ttl=ttl, include_tenant=True, include_user=False)


def memoize(maxsize: int = 128) -> Callable[..., Any]:
    """
    LRU cache for function results (in-memory, not Redis).

    Usage:
        @memoize(maxsize=128)
        def expensive_computation(x: int, y: int) -> int:
            return x * y
    """
    from functools import lru_cache

    return lru_cache(maxsize=maxsize)


def _generate_cache_key(
    func: Callable[..., Any],
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    key_prefix: str | None,
    include_tenant: bool,
    include_user: bool,
    custom_key: Any | None,
) -> str:
    """Generate cache key from function signature."""
    # Start with function name or custom prefix
    prefix = key_prefix or func.__name__

    # Build key from arguments
    key_parts = [prefix]

    # Get function signature
    sig = inspect.signature(func)
    bound_args = sig.bind(*args, **kwargs)
    bound_args.apply_defaults()

    # Skip 'self' and 'cls' parameters
    skip_params = {"self", "cls"}

    # Extract tenant_id and user_id if needed
    tenant_id_value = _extract_tenant_id(args, kwargs) if include_tenant else None
    user_id_value = _extract_user_id(args, kwargs) if include_user else None

    if custom_key is not None:
        key_parts.append(str(custom_key))
    else:
        for param_name, param_value in bound_args.arguments.items():
            if param_name in skip_params:
                continue

            if include_tenant and param_name == "tenant_id":
                continue
            if include_user and param_name == "user_id":
                continue

            # Convert value to string for key
            try:
                if hasattr(param_value, "id"):  # Database models
                    key_parts.append(f"{param_name}:{param_value.id}")
                elif isinstance(param_value, (str, int, float, bool)):
                    key_parts.append(f"{param_name}:{param_value}")
                else:
                    # Hash complex objects
                    # MD5 used for cache key generation, not security
                    value_str = json.dumps(param_value, sort_keys=True, default=str)
                    value_hash = hashlib.md5(value_str.encode(), usedforsecurity=False).hexdigest()[
                        :8
                    ]  # nosec B324
                    key_parts.append(f"{param_name}:{value_hash}")
            except Exception:
                # Skip unpicklable objects
                continue

    # Add tenant_id and user_id to key if requested
    insert_index = 1
    if tenant_id_value:
        key_parts.insert(insert_index, f"tenant:{tenant_id_value}")
        insert_index += 1
    if user_id_value:
        key_parts.insert(insert_index, f"user:{user_id_value}")

    return ":".join(key_parts)


def _extract_tenant_id(args: tuple[Any, ...], kwargs: dict[str, Any]) -> str | None:
    """Extract tenant_id from function arguments."""
    # Check kwargs first
    if "tenant_id" in kwargs:
        return str(kwargs["tenant_id"])

    # Check args by inspecting common patterns
    for arg in args:
        if hasattr(arg, "tenant_id"):
            return str(arg.tenant_id)

    return None


def _extract_user_id(args: tuple[Any, ...], kwargs: dict[str, Any]) -> str | None:
    """Extract user_id from function arguments."""
    if "user_id" in kwargs:
        return str(kwargs["user_id"])

    for arg in args:
        if hasattr(arg, "user_id"):
            return str(arg.user_id)
        if hasattr(arg, "id") and hasattr(arg, "__tablename__") and arg.__tablename__ == "users":
            return str(arg.id)

    return None
