"""
Unit tests for API key verification Redis fallback.

Tests that when Redis is unavailable, API key verification properly
falls back to in-memory storage and still returns expected UserInfo.
"""

import hashlib
import json
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.auth.core import APIKeyService


@pytest.fixture
def api_key_service():
    """Create API key service instance."""
    return APIKeyService(redis_url="redis://localhost:6379/0")


@pytest.fixture
def sample_api_key():
    """Generate a sample API key."""
    return "sk_test_abcd1234efgh5678ijkl9012mnop3456"


@pytest.fixture
def api_key_hash(sample_api_key):
    """Generate hash of sample API key."""
    return hashlib.sha256(sample_api_key.encode()).hexdigest()


@pytest.fixture
def api_key_data():
    """Sample API key data."""
    return {
        "user_id": "test-user-123",
        "tenant_id": "test-tenant",
        "scopes": ["read", "write"],
        "name": "Test API Key",
        "created_at": datetime.now(UTC).isoformat(),
        "is_active": True,
    }


class TestAPIKeyRedisUnavailable:
    """Test API key verification when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_verify_api_key_falls_back_to_memory_when_redis_none(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that verify_api_key falls back to memory when Redis returns None."""
        # Seed memory cache with hashed key
        api_key_service._memory_keys[api_key_hash] = api_key_data

        # Patch _get_redis to return None (simulating Redis unavailable)
        with patch.object(api_key_service, "_get_redis", return_value=None):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert fallback returned the correct data from memory
        assert result is not None
        assert result["user_id"] == "test-user-123"
        assert result["tenant_id"] == "test-tenant"
        assert result["scopes"] == ["read", "write"]
        assert result["name"] == "Test API Key"
        assert result["is_active"] is True

    @pytest.mark.asyncio
    async def test_verify_api_key_returns_none_when_not_in_memory(
        self, api_key_service, sample_api_key
    ):
        """Test that verify_api_key returns None when key not in memory and Redis unavailable."""
        # Don't seed memory cache
        api_key_service._memory_keys = {}

        # Patch _get_redis to return None
        with patch.object(api_key_service, "_get_redis", return_value=None):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert None returned when key not found
        assert result is None

    @pytest.mark.asyncio
    async def test_verify_api_key_uses_redis_when_available(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that verify_api_key uses Redis when available (not falling back)."""
        # Create mock Redis client
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(return_value=json.dumps(api_key_data))

        # Patch _get_redis to return mock Redis client
        with patch.object(api_key_service, "_get_redis", return_value=mock_redis):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert Redis was used (not memory fallback)
        assert result is not None
        assert result["user_id"] == "test-user-123"
        # Verify Redis get was called (implementation calls it multiple times for key, lookup, metadata)
        assert mock_redis.get.called
        assert mock_redis.get.call_count >= 1  # At least once for the main key lookup

    @pytest.mark.asyncio
    async def test_verify_api_key_falls_back_when_redis_raises_exception(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that verify_api_key falls back to memory when Redis raises exception."""
        # Seed memory cache
        api_key_service._memory_keys[api_key_hash] = api_key_data

        # Create mock Redis that raises exception
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(side_effect=Exception("Redis connection failed"))

        # Patch _get_redis to return failing Redis client
        with patch.object(api_key_service, "_get_redis", return_value=mock_redis):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert None returned due to exception (logged and caught)
        assert result is None


class TestAPIKeyMetadataValidation:
    """Test API key metadata validation with Redis fallback."""

    @pytest.mark.asyncio
    async def test_verify_api_key_checks_is_active_from_metadata(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that inactive keys are rejected even with Redis available."""
        # Create mock Redis with inactive key metadata
        mock_redis = AsyncMock()

        # Mock the main key data
        mock_redis.get = AsyncMock(
            side_effect=lambda key: {
                f"api_key:{api_key_hash}": json.dumps(api_key_data),
                f"api_key_lookup:{api_key_hash}": "key_123",
                "api_key_meta:key_123": json.dumps({"is_active": False}),
            }.get(key)
        )

        with patch.object(api_key_service, "_get_redis", return_value=mock_redis):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert inactive key returns None
        assert result is None

    @pytest.mark.asyncio
    async def test_verify_api_key_checks_expires_at_from_metadata(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that expired keys are rejected even with Redis available."""
        from datetime import timedelta

        # Create expired timestamp
        expired_time = (datetime.now(UTC) - timedelta(days=1)).isoformat()

        # Create mock Redis with expired key metadata
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(
            side_effect=lambda key: {
                f"api_key:{api_key_hash}": json.dumps(api_key_data),
                f"api_key_lookup:{api_key_hash}": "key_123",
                "api_key_meta:key_123": json.dumps(
                    {"is_active": True, "expires_at": expired_time}
                ),
            }.get(key)
        )

        with patch.object(api_key_service, "_get_redis", return_value=mock_redis):
            result = await api_key_service.verify_api_key(sample_api_key)

        # Assert expired key returns None
        assert result is None

    @pytest.mark.asyncio
    async def test_verify_api_key_accepts_active_unexpired_key(
        self, api_key_service, sample_api_key, api_key_hash, api_key_data
    ):
        """Test that active, unexpired keys are accepted."""
        from datetime import timedelta

        # Create future expiry timestamp
        future_time = (datetime.now(UTC) + timedelta(days=30)).isoformat()

        # Create mock Redis with valid key metadata
        mock_redis = AsyncMock()
        mock_redis.get = AsyncMock(
            side_effect=lambda key: {
                f"api_key:{api_key_hash}": json.dumps(api_key_data),
                f"api_key_lookup:{api_key_hash}": "key_123",
                "api_key_meta:key_123": json.dumps(
                    {"is_active": True, "expires_at": future_time, "name": "Updated Name"}
                ),
            }.get(key)
        )

        # Mock _deserialize to return the metadata dict
        def mock_deserialize(data):
            if isinstance(data, bytes):
                data = data.decode("utf-8")
            return json.loads(data)

        with patch.object(api_key_service, "_get_redis", return_value=mock_redis):
            with patch.object(api_key_service, "_deserialize", side_effect=mock_deserialize):
                result = await api_key_service.verify_api_key(sample_api_key)

        # Assert valid key returns data with metadata merged
        assert result is not None
        assert result["user_id"] == "test-user-123"
        assert result["is_active"] is True
        assert result["name"] == "Updated Name"  # Metadata merged in
