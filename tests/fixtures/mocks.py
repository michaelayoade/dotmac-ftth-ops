"""Lightweight mock fixtures shared across the test suite."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Iterator
from unittest.mock import AsyncMock, Mock

import pytest

from tests.fixtures.environment import HAS_FAKEREDIS, fakeredis

logger = logging.getLogger(__name__)


@pytest.fixture
def mock_session() -> AsyncMock:
    """Mock async database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_sync_session() -> Mock:
    """Mock synchronous database session."""
    session = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    session.close = Mock()
    return session


@pytest.fixture
def mock_provider() -> AsyncMock:
    """Generic async service/provider mock."""
    return AsyncMock()


@pytest.fixture
def mock_config() -> Mock:
    """Default configuration mock with common attributes."""
    config = Mock()
    config.environment = "test"
    config.debug = True
    return config


@pytest.fixture
def mock_api_key_service() -> AsyncMock:
    """Mock API key service with async interface."""
    service = AsyncMock()
    service.create_api_key = AsyncMock()
    service.validate_api_key = AsyncMock()
    service.revoke_api_key = AsyncMock()
    return service


@pytest.fixture
def mock_secrets_manager() -> AsyncMock:
    """Mock secrets manager used in auth fixtures."""
    manager = AsyncMock()
    manager.get_jwt_keypair = AsyncMock()
    manager.get_symmetric_secret = AsyncMock()
    manager.get_database_credentials = AsyncMock()
    return manager


# ---------------------------------------------------------------------------
# Redis fixtures (fakeredis fallback when real dependency unavailable)
# ---------------------------------------------------------------------------


if HAS_FAKEREDIS:

    @pytest.fixture
    def redis_client() -> Iterator[fakeredis.FakeRedis]:
        """Redis client using fakeredis."""
        client = fakeredis.FakeRedis(decode_responses=True)
        client.flushdb()
        try:
            yield client
        finally:
            client.flushdb()

    @pytest.fixture
    async def async_redis_client() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
        """Async Redis client using fakeredis."""
        client = fakeredis.aioredis.FakeRedis(decode_responses=True)
        await client.flushdb()
        try:
            yield client
        finally:
            await client.flushdb()

else:
    _LOGGED_FAKEREDIS_WARNING = False

    @pytest.fixture
    def redis_client() -> Iterator[fakeredis.FakeRedis]:
        """Fallback redis client returning dummy interface."""
        global _LOGGED_FAKEREDIS_WARNING
        if not _LOGGED_FAKEREDIS_WARNING:
            logger.warning(
                "fakeredis unavailable; using fallback Redis fixture without persistence."
            )
            _LOGGED_FAKEREDIS_WARNING = True

        client = fakeredis.FakeRedis()
        client.flushdb()
        try:
            yield client
        finally:
            client.flushdb()

    @pytest.fixture
    async def async_redis_client() -> AsyncIterator[fakeredis.aioredis.FakeRedis]:
        """Fallback async redis client returning dummy interface."""
        global _LOGGED_FAKEREDIS_WARNING
        if not _LOGGED_FAKEREDIS_WARNING:
            logger.warning(
                "fakeredis unavailable; using fallback async Redis fixture without persistence."
            )
            _LOGGED_FAKEREDIS_WARNING = True

        client = fakeredis.aioredis.FakeRedis()
        await client.flushdb()
        try:
            yield client
        finally:
            await client.flushdb()


__all__ = [
    "async_redis_client",
    "mock_api_key_service",
    "mock_config",
    "mock_provider",
    "mock_secrets_manager",
    "mock_session",
    "mock_sync_session",
    "redis_client",
]
