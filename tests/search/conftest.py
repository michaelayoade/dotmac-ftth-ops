"""Shared fixtures for search tests."""

import pytest


@pytest.fixture(autouse=True)
def reset_search_backend_state():
    """
    Reset the global search backend state between tests.

    The search router uses a global _backend_state object (line 84 in router.py)
    that accumulates documents across test runs. Without resetting it:
    - Documents from test A remain visible in test B
    - Assertions like "total >= 1" pass even if indexing regresses
    - Tests become order-dependent and can mask failures

    This fixture ensures each test starts with a clean backend.
    """
    from dotmac.platform.search import router

    # Store original state
    original_backend = getattr(router._backend_state, "_backend", None)
    router._backend_state.known_types.copy()

    # Clear the backend to force reinitialization
    router._backend_state._backend = None
    router._backend_state.known_types.clear()

    # If there's an in-memory backend, clear its indices
    if original_backend and hasattr(original_backend, "indices"):
        original_backend.indices.clear()

    yield

    # Note: We don't restore the original state after the test
    # because we want each test to start fresh. The next test
    # will get a new backend via the fixture setup above.
