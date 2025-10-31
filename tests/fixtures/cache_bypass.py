"""
Reusable cache bypass fixture for testing cached endpoints.

This fixture mocks the @cached_result decorator to prevent tests from hitting
Redis cache and returning stale data.

Usage:
    from tests.fixtures.cache_bypass import mock_cached_result, apply_cache_bypass

    # In your test file, before importing the module with @cached_result:
    with apply_cache_bypass():
        from your.module import router

See CACHE_BYPASS_PATTERN.md for detailed documentation.
"""
import pytest

import sys
from contextlib import contextmanager
from unittest.mock import patch


def mock_cached_result(*args, **kwargs):
    """
    Pass-through decorator that doesn't cache.

    This replaces the real cached_result decorator with a no-op
    that simply returns the function unchanged.
    """

    def decorator(func):
        return func

    return decorator


@contextmanager
def apply_cache_bypass(module_name: str | None = None):
    """
    Context manager to apply cache bypass pattern.

    Args:
        module_name: Optional module name to reload. If provided,
                    removes the module from sys.modules before importing.

    Example:
        # Basic usage - just bypass cache
        with apply_cache_bypass():
            from my.module import router

        # Advanced usage - force module reload
        with apply_cache_bypass("my.module"):
            from my.module import router
    """
    # Remove module from cache if specified
    if module_name and module_name in sys.modules:
        del sys.modules[module_name]

    # Patch the cache decorator
    with patch("dotmac.platform.billing.cache.cached_result", mock_cached_result):
        yield


# Alternative: Pytest fixture version
def cache_bypass_fixture():
    """
    Pytest fixture for cache bypass.

    Usage in conftest.py:
        from tests.fixtures.cache_bypass import cache_bypass_fixture

        @pytest.fixture(autouse=True)
        def bypass_cache():
            with cache_bypass_fixture():
                yield
    """
    return apply_cache_bypass()
