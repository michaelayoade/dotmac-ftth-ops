"""
Simplified fakeredis replacement used when the optional dependency is absent.
"""

from __future__ import annotations

from types import SimpleNamespace


def create_fakeredis_stub():
    """Return a namespace mimicking the API surface we use in tests."""

    class _DummySyncRedis:
        def __init__(self, *_, **__):
            self._data: dict[str, str] = {}

        def flushdb(self) -> None:
            self._data.clear()

        def set(self, key, value, ex=None):  # noqa: ANN001, ARG002
            self._data[str(key)] = value
            return True

        def get(self, key):  # noqa: ANN001
            return self._data.get(str(key))

        def delete(self, key):  # noqa: ANN001
            return 1 if self._data.pop(str(key), None) is not None else 0

        def close(self) -> None:
            return None

    class _DummyAsyncRedis:
        def __init__(self, *_, **__):
            self._data: dict[str, str] = {}

        async def flushdb(self) -> None:
            self._data.clear()

        async def set(self, key, value, ex=None):  # noqa: ANN001, ARG002
            self._data[str(key)] = value
            return True

        async def get(self, key):  # noqa: ANN001
            return self._data.get(str(key))

        async def delete(self, key):  # noqa: ANN001
            return 1 if self._data.pop(str(key), None) is not None else 0

        async def close(self) -> None:
            return None

    return SimpleNamespace(
        FakeRedis=_DummySyncRedis,
        aioredis=SimpleNamespace(FakeRedis=_DummyAsyncRedis),
    )
