"""Cleanup helpers applied automatically after tests."""

from __future__ import annotations

import asyncio
from typing import Any, Set

import pytest

from tests.fixtures.environment import HAS_FASTAPI


@pytest.fixture(autouse=True, scope="function")
def cleanup_fastapi_state(request):
    """Clear FastAPI dependency overrides between tests."""
    yield

    if not HAS_FASTAPI:
        return

    from fastapi import FastAPI

    funcargs = getattr(request.node, "funcargs", {}) or {}
    seen: Set[int] = set()

    def _clean(obj: object) -> None:
        if obj is None:
            return

        obj_id = id(obj)
        if obj_id in seen:
            return
        seen.add(obj_id)

        if isinstance(obj, FastAPI):
            if hasattr(obj, "dependency_overrides"):
                obj.dependency_overrides.clear()
            if hasattr(obj, "state") and hasattr(obj.state, "_state"):
                obj.state._state.clear()  # type: ignore[attr-defined]
            return

        if isinstance(obj, dict):
            for value in obj.values():
                _clean(value)
            return

        if isinstance(obj, (list, tuple, set)):
            for value in obj:
                _clean(value)
            return

        for attr in (
            "app",
            "_app",
            "application",
            "test_app",
            "client",
            "_client",
            "transport",
            "_transport",
        ):
            if hasattr(obj, attr):
                try:
                    _clean(getattr(obj, attr))
                except AttributeError:
                    continue

    for value in funcargs.values():
        _clean(value)


@pytest.fixture(autouse=True, scope="function")
def cleanup_registry():
    """Reset and run the cleanup registry around each test."""
    from tests.helpers.cleanup_registry import (
        get_cleanup_registry,
        reset_cleanup_registry,
    )

    reset_cleanup_registry()
    registry = get_cleanup_registry()

    yield registry

    registry.cleanup_all()


@pytest.fixture(autouse=True, scope="function")
def disable_rate_limiting_globally(request):
    """Temporarily disable rate limiting to avoid flaky 429 responses."""
    from dotmac.platform.core.rate_limiting import get_limiter

    test_module = request.node.fspath.basename if hasattr(request.node, "fspath") else ""
    test_name = request.node.name if hasattr(request.node, "name") else ""
    test_class = (
        request.node.cls.__name__ if hasattr(request.node, "cls") and request.node.cls else ""
    )
    node_id = request.node.nodeid if hasattr(request.node, "nodeid") else ""

    if (
        "rate_limit" in test_module.lower()
        or "rate_limit" in test_name.lower()
        or "ratelimit" in test_class.lower()
        or "ratelimit" in node_id.lower()
    ):
        yield
        return

    try:
        limiter_instance = get_limiter()
    except Exception:
        yield
        return

    original_enabled = limiter_instance.enabled

    try:
        limiter_instance.enabled = False
        if hasattr(limiter_instance, "_storage") and limiter_instance._storage:
            storage = limiter_instance._storage
            reset = getattr(storage, "reset", None)
            if callable(reset):
                try:
                    reset()
                except Exception:
                    pass
        yield
    finally:
        limiter_instance.enabled = original_enabled


__all__ = [
    "cleanup_fastapi_state",
    "cleanup_registry",
    "disable_rate_limiting_globally",
]
