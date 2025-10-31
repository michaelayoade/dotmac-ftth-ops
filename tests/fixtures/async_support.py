"""Async utilities and cleanup fixtures."""

from __future__ import annotations

import asyncio
from typing import Callable, Coroutine, List

import pytest

try:
    import pytest_asyncio
except ImportError:  # pragma: no cover - fallback when pytest-asyncio unavailable
    pytest_asyncio = None

AsyncFixture = pytest_asyncio.fixture if pytest_asyncio else pytest.fixture


@AsyncFixture
async def async_cleanup():
    """Track async tasks and ensure they are cancelled after the test."""
    tasks: List[asyncio.Task] = []

    def track_task(task: asyncio.Task) -> None:
        tasks.append(task)

    yield track_task

    for task in tasks:
        if task.done():
            continue
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@pytest.fixture(scope="function")
def event_loop():
    """Provide a fresh event loop per test."""
    loop = asyncio.new_event_loop()
    previous_loop = None
    try:
        try:
            previous_loop = asyncio.get_running_loop()
        except RuntimeError:
            previous_loop = None

        asyncio.set_event_loop(loop)
        yield loop
    finally:
        loop.close()
        if previous_loop is not None:
            asyncio.set_event_loop(previous_loop)
        else:
            asyncio.set_event_loop(None)


__all__ = ["async_cleanup", "event_loop"]
