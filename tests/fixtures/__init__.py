"""Convenient exports for commonly used test fixtures."""

from __future__ import annotations

from importlib import import_module
from typing import Iterable

__all__: list[str] = []
_exported: set[str] = set()


def _export(module_name: str, names: Iterable[str] | None = None) -> None:
    """Import a fixture module and expose selected names at package level."""
    try:
        module = import_module(module_name)
    except Exception:
        return

    exports = list(names) if names is not None else list(getattr(module, "__all__", []))

    if not exports:
        return

    for name in exports:
        if not hasattr(module, name):
            continue
        globals()[name] = getattr(module, name)
        if name not in _exported:
            __all__.append(name)
            _exported.add(name)


_MANUAL_EXPORTS: dict[str, tuple[str, ...]] = {
    "tests.fixtures.async_db": (
        "MockAsyncSessionFactory",
        "create_mock_async_result",
        "create_mock_async_session",
        "create_mock_scalar_result",
    ),
    "tests.fixtures.cache_bypass": (
        "apply_cache_bypass",
        "cache_bypass_fixture",
        "mock_cached_result",
    ),
}

_MODULE_EXPORTS: tuple[str, ...] = (
    "tests.fixtures.app",
    "tests.fixtures.async_support",
    "tests.fixtures.billing_support",
    "tests.fixtures.cleanup",
    "tests.fixtures.database",
    "tests.fixtures.environment",
    "tests.fixtures.misc",
    "tests.fixtures.mocks",
)

for module_name, names in _MANUAL_EXPORTS.items():
    _export(module_name, names)

for module_name in _MODULE_EXPORTS:
    _export(module_name)

# Clean up internal helpers from namespace
del import_module
del Iterable
del _export
del _exported
del _MANUAL_EXPORTS
del _MODULE_EXPORTS
