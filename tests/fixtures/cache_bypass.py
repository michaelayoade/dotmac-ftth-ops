"""
Reusable cache bypass fixture for testing cached endpoints.

This fixture mocks the @cached_result decorator to prevent tests from hitting
Redis cache and returning stale data.

Usage:
    from tests.fixtures.cache_bypass import mock_cached_result, apply_cache_bypass

    # In your test file, before importing the module with @cached_result:
    with apply_cache_bypass():
        from your.module import router

    # Override the cached_result path for other modules:
    with apply_cache_bypass(cached_result_paths="some.other.cache.cached_result"):
        from your.module import router

See CACHE_BYPASS_PATTERN.md for detailed documentation.
"""

import importlib
import sys
from collections.abc import Iterable
from contextlib import ExitStack, contextmanager
from unittest.mock import patch

import pytest


def mock_cached_result(*args, **kwargs):
    """
    Pass-through decorator that doesn't cache.

    This replaces the real cached_result decorator with a no-op
    that simply returns the function unchanged.
    """

    def decorator(func):
        return func

    return decorator


DEFAULT_CACHED_RESULT_PATH = "dotmac.platform.billing.cache.cached_result"


@contextmanager
def apply_cache_bypass(
    module_name: str | None = None,
    cached_result_paths: str | Iterable[str] = DEFAULT_CACHED_RESULT_PATH,
):
    """
    Context manager to apply cache bypass pattern.

    Args:
        module_name: Optional module name to reload. If provided, reloads the
                     module after the decorator patch is applied so newly
                     imported symbols skip caching.
        cached_result_paths: One or more dotted paths to the cached_result
                             decorator that should be replaced with the
                             no-op mock.

    Example:
        # Basic usage - just bypass cache
        with apply_cache_bypass():
            from my.module import router

        # Advanced usage - force module reload
        with apply_cache_bypass("my.module"):
            from my.module import router

    Note:
        Reloading modules can trigger side effects for modules with global
        state. Prefer limiting module reloads to leaf modules that simply
        import cached views.
    """
    paths = (
        [cached_result_paths] if isinstance(cached_result_paths, str) else list(cached_result_paths)
    )

    with ExitStack() as stack:
        for path in paths:
            stack.enter_context(patch(path, mock_cached_result))

        if module_name:
            _reload_module(module_name)

        yield


def _reload_module(module_name: str) -> None:
    """Reload a module after the cached_result patch is applied."""
    module = sys.modules.get(module_name)
    if module:
        importlib.reload(module)
        return

    importlib.import_module(module_name)


# Alternative: Pytest fixture version
@pytest.fixture
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

    def _cache_bypass(
        module_name: str | None = None,
        cached_result_paths: str | Iterable[str] = DEFAULT_CACHED_RESULT_PATH,
    ):
        return apply_cache_bypass(module_name=module_name, cached_result_paths=cached_result_paths)

    return _cache_bypass
