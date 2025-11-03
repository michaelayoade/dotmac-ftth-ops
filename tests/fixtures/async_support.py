"""Async utilities and cleanup fixtures."""

from __future__ import annotations

import asyncio
import warnings
from contextlib import suppress

import pytest

try:
    import pytest_asyncio
except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
    pytest_asyncio = None

AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture


@AsyncFixture
async def async_cleanup():
    """Track async tasks and ensure they are cancelled after the test."""
    tasks: list[asyncio.Task] = []

    def track_task(task: asyncio.Task) -> None:
        tasks.append(task)

    yield track_task

    current_task = asyncio.current_task()
    pending_tracked = []
    pending_untracked = []

    for task in asyncio.all_tasks():
        if task is current_task or task.done():
            continue
        if task in tasks:
            pending_tracked.append(task)
        else:
            pending_untracked.append(task)

    for task in pending_tracked:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task

    if pending_untracked:
        task_descriptions = ", ".join(repr(task) for task in pending_untracked)
        warnings.warn(
            f"Found {len(pending_untracked)} untracked async task(s) during cleanup: {task_descriptions}",
            RuntimeWarning,
            stacklevel=2,
        )
        for task in pending_untracked:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task


@pytest.fixture(scope="function")
def event_loop():
    """Provide a fresh event loop per test."""
    policy = asyncio.get_event_loop_policy()
    try:
        previous_loop = policy.get_event_loop()
    except RuntimeError:
        previous_loop = None

    loop = policy.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        yield loop
    finally:
        loop.close()
        if previous_loop is None:
            asyncio.set_event_loop(None)
        else:
            asyncio.set_event_loop(previous_loop)


__all__ = ["async_cleanup", "event_loop"]
