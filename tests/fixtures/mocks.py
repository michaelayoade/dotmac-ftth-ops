"""Lightweight mock fixtures shared across the test suite."""

from __future__ import annotations

from unittest.mock import AsyncMock, Mock

import pytest

from tests.fixtures.environment import HAS_FAKEREDIS, fakeredis


@pytest.fixture
def mock_session():
    """Mock async database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.close = AsyncMock()
    return session


@pytest.fixture
def mock_sync_session():
    """Mock synchronous database session."""
    session = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    session.close = Mock()
    return session


@pytest.fixture
def mock_provider():
    """Generic async service/provider mock."""
    return AsyncMock()


@pytest.fixture
def mock_config():
    """Default configuration mock with common attributes."""
    config = Mock()
    config.environment = "test"
    config.debug = True
    return config


@pytest.fixture
def mock_api_key_service():
    """Mock API key service with async interface."""
    service = AsyncMock()
    service.create_api_key = AsyncMock()
    service.validate_api_key = AsyncMock()
    service.revoke_api_key = AsyncMock()
    return service


@pytest.fixture
def mock_secrets_manager():
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
    def redis_client():
        """Redis client using fakeredis."""
        client = fakeredis.FakeRedis(decode_responses=True)
        client.flushall()
        try:
            yield client
        finally:
            client.flushall()

    @pytest.fixture
    async def async_redis_client():
        """Async Redis client using fakeredis."""
        client = fakeredis.aioredis.FakeRedis(decode_responses=True)
        await client.flushall()
        try:
            yield client
        finally:
            await client.flushall()

else:

    @pytest.fixture
    def redis_client():
        """Fallback redis client returning dummy interface."""
        client = fakeredis.FakeRedis()
        client.flushdb()
        try:
            yield client
        finally:
            client.flushdb()

    @pytest.fixture
    async def async_redis_client():
        """Fallback async redis client returning dummy interface."""
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
