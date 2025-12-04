"""Typed wrappers for shared decorators used by the billing package."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, ParamSpec, TypeVar, cast

from celery import shared_task as celery_shared_task

from dotmac.platform.core.cache_decorators import CacheTier as _CacheTier
from dotmac.platform.core.cache_decorators import cached_result as _cached_result
from dotmac.platform.core.rate_limiting import rate_limit as _rate_limit
from dotmac.platform.core.tasks import idempotent_task as _idempotent_task

P = ParamSpec("P")
R = TypeVar("R")
S = TypeVar("S")

CacheTier = _CacheTier


def shared_task(*args: Any, **kwargs: Any) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Typed wrapper around ``celery.shared_task`` for mypy."""
    return cast(Callable[[Callable[P, R]], Callable[P, R]], celery_shared_task(*args, **kwargs))


def idempotent_task(ttl: int = 3600) -> Callable[[Callable[P, R]], Callable[P, R | None]]:
    """Typed wrapper around the core idempotent task decorator."""
    decorator = _idempotent_task(ttl)
    return decorator


def rate_limit(limit: str) -> Callable[[Callable[P, R]], Callable[P, R]]:
    """Typed wrapper around the shared rate limit decorator."""
    decorator = _rate_limit(limit)
    return decorator


def cached_result(
    *,
    ttl: int | None = None,
    key_prefix: str = "",
    key_params: list[str] | None = None,
    tier: Any = CacheTier.L2_REDIS,
) -> Callable[[Callable[P, Awaitable[S]]], Callable[P, Awaitable[S]]]:
    """Typed wrapper around the shared cached_result decorator."""
    decorator = _cached_result(ttl=ttl, key_prefix=key_prefix, key_params=key_params, tier=tier)
    return decorator


__all__ = ["CacheTier", "shared_task", "idempotent_task", "rate_limit", "cached_result"]
