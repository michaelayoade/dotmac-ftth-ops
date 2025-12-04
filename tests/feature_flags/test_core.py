"""
Tests for feature flags core functionality.

Tests the core feature flag operations including Redis fallback handling,
cache management, and flag evaluation logic.
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import redis.asyncio as redis

from dotmac.platform.feature_flags.core import (
    _check_redis_availability,
    _flag_cache,
    clear_cache,
    delete_flag,
    get_flag_status,
    get_redis_client,
    get_variant,
    is_enabled,
    list_flags,
    set_flag,
    sync_from_redis,
)

pytestmark = [pytest.mark.unit, pytest.mark.asyncio]


@pytest.fixture(autouse=True)
def clean_cache():
    """Clean the flag cache before each test."""
    _flag_cache.clear()
    yield
    _flag_cache.clear()


@pytest.fixture
def mock_redis_client():
    """Create a mock Redis client."""
    client = AsyncMock()
    client.ping = AsyncMock()
    client.hset = AsyncMock()
    client.hget = AsyncMock()
    client.hgetall = AsyncMock()
    client.hdel = AsyncMock()
    client.hlen = AsyncMock()
    client.aclose = AsyncMock()
    return client


class TestRedisAvailability:
    """Test Redis availability checking."""

    @pytest.mark.asyncio
    async def test_redis_available_with_valid_config(self):
        """Test Redis availability check with valid configuration."""
        with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
            mock_settings.redis.redis_url = "redis://localhost:6379/0"

            with patch("redis.asyncio.from_url") as mock_redis:
                mock_client = AsyncMock()
                mock_client.ping = AsyncMock()
                mock_client.aclose = AsyncMock()
                mock_redis.return_value = mock_client

                # Clear cached value
                import dotmac.platform.feature_flags.core

                dotmac.platform.feature_flags.core._redis_available = None

                result = await _check_redis_availability()

                assert result is True
                mock_redis.assert_called_once_with("redis://localhost:6379/0")
                mock_client.ping.assert_called_once()
                mock_client.aclose.assert_called_once()

    @pytest.mark.asyncio
    async def test_redis_unavailable_no_url(self):
        """Test Redis availability check with no URL configured."""
        with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
            mock_settings.redis = MagicMock()
            mock_settings.redis.redis_url = None

            # Clear cached value
            import dotmac.platform.feature_flags.core

            dotmac.platform.feature_flags.core._redis_available = None

            result = await _check_redis_availability()

            assert result is False

    @pytest.mark.asyncio
    async def test_redis_unavailable_connection_failed(self):
        """Test Redis availability check with connection failure."""
        with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
            mock_settings.redis.redis_url = "redis://localhost:6379/0"

            with patch("redis.asyncio.from_url") as mock_redis:
                mock_redis.side_effect = redis.ConnectionError("Connection failed")

                # Clear cached value
                import dotmac.platform.feature_flags.core

                dotmac.platform.feature_flags.core._redis_available = None

                result = await _check_redis_availability()

                assert result is False

    @pytest.mark.asyncio
    async def test_redis_availability_cached(self):
        """Test that Redis availability is cached."""
        # Set cached value
        import dotmac.platform.feature_flags.core

        dotmac.platform.feature_flags.core._redis_available = True

        result = await _check_redis_availability()

        assert result is True
        # No Redis calls should be made due to caching


class TestGetRedisClient:
    """Test Redis client creation and management."""

    @pytest.mark.asyncio
    async def test_get_redis_client_success(self, mock_redis_client):
        """Test successful Redis client creation."""
        with patch(
            "dotmac.platform.feature_flags.core._check_redis_availability", return_value=True
        ):
            with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
                mock_settings.redis.redis_url = "redis://localhost:6379/0"

                with patch("redis.asyncio.from_url", return_value=mock_redis_client):
                    # Clear cached client
                    import dotmac.platform.feature_flags.core

                    dotmac.platform.feature_flags.core._redis_client = None

                    client = await get_redis_client()

                    assert client is mock_redis_client
                    mock_redis_client.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_redis_client_unavailable(self):
        """Test Redis client when Redis is unavailable."""
        with patch(
            "dotmac.platform.feature_flags.core._check_redis_availability", return_value=False
        ):
            client = await get_redis_client()

            assert client is None

    @pytest.mark.asyncio
    async def test_get_redis_client_connection_fails(self):
        """Test Redis client when connection fails."""
        with patch(
            "dotmac.platform.feature_flags.core._check_redis_availability", return_value=True
        ):
            with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
                mock_settings.redis.redis_url = "redis://localhost:6379/0"

                with patch("redis.asyncio.from_url") as mock_redis:
                    mock_client = AsyncMock()
                    mock_client.ping.side_effect = redis.ConnectionError("Failed")
                    mock_redis.return_value = mock_client

                    # Clear cached client
                    import dotmac.platform.feature_flags.core

                    dotmac.platform.feature_flags.core._redis_client = None

                    client = await get_redis_client()

                    assert client is None


class TestSetFlag:
    """Test setting feature flags."""

    @pytest.mark.asyncio
    async def test_set_flag_with_redis(self, mock_redis_client):
        """Test setting flag when Redis is available."""
        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            await set_flag("test_flag", True, {"env": "test"})

            # Check Redis was called
            mock_redis_client.hset.assert_called_once()
            call_args = mock_redis_client.hset.call_args
            assert call_args[0][0] == "feature_flags"
            assert call_args[0][1] == "test_flag"

            # Parse JSON data
            flag_data = json.loads(call_args[0][2])
            assert flag_data["enabled"] is True
            assert flag_data["context"] == {"env": "test"}
            assert flag_data["metadata"] == {}
            assert "updated_at" in flag_data

            # Check cache was updated
            assert "test_flag" in _flag_cache
            assert _flag_cache["test_flag"]["metadata"] == {}

    @pytest.mark.asyncio
    async def test_set_flag_without_redis(self):
        """Test setting flag when Redis is not available."""
        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            await set_flag("cache_only_flag", True, {"env": "test"})

            # Check flag is in cache
            assert "cache_only_flag" in _flag_cache
            flag_data = _flag_cache["cache_only_flag"]
            assert flag_data["enabled"] is True
            assert flag_data["context"] == {"env": "test"}
            assert flag_data["metadata"] == {}

    @pytest.mark.asyncio
    async def test_set_flag_redis_error(self, mock_redis_client):
        """Test setting flag when Redis operation fails."""
        mock_redis_client.hset.side_effect = redis.RedisError("Redis error")

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            await set_flag("error_flag", True)

            # Should still work and update cache
            assert "error_flag" in _flag_cache

    @pytest.mark.asyncio
    async def test_set_flag_default_context(self):
        """Test setting flag with default context."""
        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            await set_flag("simple_flag", False)

            flag_data = _flag_cache["simple_flag"]
            assert flag_data["enabled"] is False
            assert flag_data["context"] == {}
            assert flag_data["metadata"] == {}

    @pytest.mark.asyncio
    async def test_set_flag_with_metadata(self, mock_redis_client):
        """Test setting flag with metadata persists metadata separately."""
        metadata = {"description": "Test flag", "created_by": "user123"}

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            await set_flag("meta_flag", True, {"env": "stage"}, metadata)

            # Redis payload should include metadata
            call_args = mock_redis_client.hset.call_args
            payload = json.loads(call_args[0][2])
            assert payload["metadata"] == metadata
            assert payload["context"] == {"env": "stage"}

            # Cache should have isolated metadata copy
            cached_flag = _flag_cache["meta_flag"]
            assert cached_flag["metadata"] == metadata
            metadata["description"] = "Updated"
            assert cached_flag["metadata"]["description"] == "Test flag"


class TestIsEnabled:
    """Test checking if flags are enabled."""

    @pytest.mark.asyncio
    async def test_is_enabled_from_cache(self):
        """Test checking flag from cache."""
        # Set flag in cache
        _flag_cache["cached_flag"] = {"enabled": True, "context": {}}

        result = await is_enabled("cached_flag")

        assert result is True

    @pytest.mark.asyncio
    async def test_is_enabled_from_redis(self, mock_redis_client):
        """Test checking flag from Redis when not in cache."""
        flag_data = {"enabled": True, "context": {"env": "prod"}}
        mock_redis_client.hget.return_value = json.dumps(flag_data)

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await is_enabled("redis_flag")

            assert result is True
            # Should be cached now
            assert "redis_flag" in _flag_cache

    @pytest.mark.asyncio
    async def test_is_enabled_not_found(self, mock_redis_client):
        """Test checking non-existent flag."""
        mock_redis_client.hget.return_value = None

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await is_enabled("nonexistent_flag")

        assert result is False

    @pytest.mark.asyncio
    async def test_is_enabled_with_context_matching(self):
        """Test flag evaluation with context matching."""
        _flag_cache["context_flag"] = {
            "enabled": True,
            "context": {"env": "prod", "feature": "beta"},
        }

        # Matching context
        result = await is_enabled(
            "context_flag", {"env": "prod", "feature": "beta", "extra": "ignored"}
        )
        assert result is True

        # Non-matching context
        result = await is_enabled("context_flag", {"env": "dev", "feature": "beta"})
        assert result is False

        # Partial context (missing required key)
        result = await is_enabled("context_flag", {"env": "prod"})
        assert result is False

    @pytest.mark.asyncio
    async def test_is_enabled_ignores_metadata_keys(self):
        """Ensure metadata-style keys do not impact evaluation."""
        _flag_cache["meta_flag"] = {
            "enabled": True,
            "context": {"env": "prod", "_created_by": "user123"},
        }

        result = await is_enabled("meta_flag", {"env": "prod"})

        assert result is True

    @pytest.mark.asyncio
    async def test_is_enabled_redis_error(self, mock_redis_client):
        """Test flag checking when Redis fails."""
        mock_redis_client.hget.side_effect = redis.RedisError("Redis error")

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await is_enabled("error_flag")

            assert result is False

    @pytest.mark.asyncio
    async def test_is_enabled_no_redis(self):
        """Test flag checking when Redis is unavailable."""
        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            result = await is_enabled("no_redis_flag")

            assert result is False


class TestGetVariant:
    """Test A/B testing variant functionality."""

    @pytest.mark.asyncio
    async def test_get_variant_flag_disabled(self):
        """Test variant when flag is disabled."""
        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=False):
            variant = await get_variant("disabled_flag")

            assert variant == "control"

    @pytest.mark.asyncio
    async def test_get_variant_with_user_id(self):
        """Test variant with user_id context."""
        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=True):
            # Test deterministic variant assignment
            variant1 = await get_variant("ab_test", {"user_id": "user123"})
            variant2 = await get_variant("ab_test", {"user_id": "user123"})
            variant3 = await get_variant("ab_test", {"user_id": "user456"})

            # Same user should get same variant
            assert variant1 == variant2
            # Different users might get different variants
            assert variant1 in ["variant_a", "variant_b"]
            assert variant3 in ["variant_a", "variant_b"]

    @pytest.mark.asyncio
    async def test_get_variant_no_user_id(self):
        """Test variant without user_id context."""
        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=True):
            variant = await get_variant("ab_test", {"other": "context"})

            assert variant == "control"


class TestListFlags:
    """Test listing feature flags."""

    @pytest.mark.asyncio
    async def test_list_flags_cache_only(self):
        """Test listing flags from cache only."""
        _flag_cache["flag1"] = {"enabled": True, "context": {}}
        _flag_cache["flag2"] = {"enabled": False, "context": {"env": "test"}}

        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            flags = await list_flags()

            assert len(flags) == 2
            assert flags["flag1"]["enabled"] is True
            assert flags["flag2"]["enabled"] is False

    @pytest.mark.asyncio
    async def test_list_flags_with_redis(self, mock_redis_client):
        """Test listing flags with Redis data."""
        redis_data = {
            b"redis_flag": b'{"enabled": true, "context": {"source": "redis"}}',
            b"shared_flag": b'{"enabled": false, "context": {}}',
        }
        mock_redis_client.hgetall.return_value = redis_data

        _flag_cache["cache_flag"] = {"enabled": True, "context": {"source": "cache"}}

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            flags = await list_flags()

            # Should have flags from both sources
            assert "redis_flag" in flags
            assert "cache_flag" in flags
            assert "shared_flag" in flags

            # Redis data should override cache data
            assert flags["redis_flag"]["context"]["source"] == "redis"

    @pytest.mark.asyncio
    async def test_list_flags_invalid_json(self, mock_redis_client):
        """Test listing flags with invalid JSON in Redis."""
        redis_data = {
            b"valid_flag": b'{"enabled": true, "context": {}}',
            b"invalid_flag": b"invalid json",
        }
        mock_redis_client.hgetall.return_value = redis_data

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            flags = await list_flags()

            # Should only have valid flag
            assert "valid_flag" in flags
            assert "invalid_flag" not in flags

    @pytest.mark.asyncio
    async def test_list_flags_migrates_legacy_metadata(self):
        """Legacy context keys should move to metadata automatically."""
        _flag_cache["legacy_flag"] = {
            "enabled": True,
            "context": {"env": "prod", "_description": "Legacy flag"},
            "updated_at": 111,
        }

        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            flags = await list_flags()

        flag = flags["legacy_flag"]
        assert flag["context"] == {"env": "prod"}
        assert flag["metadata"]["description"] == "Legacy flag"
        assert flag["updated_at"] == 111


class TestDeleteFlag:
    """Test deleting feature flags."""

    @pytest.mark.asyncio
    async def test_delete_flag_with_redis(self, mock_redis_client):
        """Test deleting flag when Redis is available."""
        mock_redis_client.hdel.return_value = 1  # 1 flag deleted

        _flag_cache["delete_me"] = {"enabled": True, "context": {}}

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await delete_flag("delete_me")

            assert result is True
            assert "delete_me" not in _flag_cache
            mock_redis_client.hdel.assert_called_once_with("feature_flags", "delete_me")

    @pytest.mark.asyncio
    async def test_delete_flag_cache_only(self):
        """Test deleting flag from cache when Redis unavailable."""
        _flag_cache["cache_delete"] = {"enabled": True, "context": {}}

        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            result = await delete_flag("cache_delete")

            assert result is True
            assert "cache_delete" not in _flag_cache

    @pytest.mark.asyncio
    async def test_delete_flag_not_found(self, mock_redis_client):
        """Test deleting non-existent flag."""
        mock_redis_client.hdel.return_value = 0  # 0 flags deleted

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await delete_flag("nonexistent")

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_flag_redis_error(self, mock_redis_client):
        """Test deleting flag when Redis operation fails."""
        mock_redis_client.hdel.side_effect = redis.RedisError("Redis error")

        _flag_cache["error_delete"] = {"enabled": True, "context": {}}

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            result = await delete_flag("error_delete")

            # Should still succeed from cache deletion
            assert result is True
            assert "error_delete" not in _flag_cache


class TestUtilityFunctions:
    """Test utility functions."""

    @pytest.mark.asyncio
    async def test_get_flag_status_redis_available(self, mock_redis_client):
        """Test getting status when Redis is available."""
        mock_redis_client.hlen.return_value = 5

        _flag_cache["test"] = {"enabled": True, "context": {}}

        with patch(
            "dotmac.platform.feature_flags.core._check_redis_availability", return_value=True
        ):
            with patch(
                "dotmac.platform.feature_flags.core.get_redis_client",
                return_value=mock_redis_client,
            ):
                with patch("dotmac.platform.feature_flags.core.settings") as mock_settings:
                    mock_settings.redis.redis_url = "redis://localhost:6379/0"

                    status = await get_flag_status()

                    assert status["redis_available"] is True
                    assert status["redis_url"] == "redis://localhost:6379/0"
                    assert status["cache_size"] == 1
                    assert status["redis_flags"] == 5
                    assert status["total_flags"] == 5

    @pytest.mark.asyncio
    async def test_get_flag_status_redis_unavailable(self):
        """Test getting status when Redis is unavailable."""
        _flag_cache["test"] = {"enabled": True, "context": {}}

        with patch(
            "dotmac.platform.feature_flags.core._check_redis_availability", return_value=False
        ):
            status = await get_flag_status()

            assert status["redis_available"] is False
            assert status["redis_url"] is None
            assert status["cache_size"] == 1
            assert status["total_flags"] == 1

    @pytest.mark.asyncio
    async def test_clear_cache(self):
        """Test clearing the cache."""
        _flag_cache["test"] = {"enabled": True, "context": {}}

        await clear_cache()

        assert len(_flag_cache) == 0

    @pytest.mark.asyncio
    async def test_sync_from_redis(self, mock_redis_client):
        """Test syncing flags from Redis."""
        redis_data = {
            b"flag1": b'{"enabled": true, "context": {}}',
            b"flag2": b'{"enabled": false, "context": {"env": "test"}}',
        }
        mock_redis_client.hgetall.return_value = redis_data

        with patch(
            "dotmac.platform.feature_flags.core.get_redis_client", return_value=mock_redis_client
        ):
            synced_count = await sync_from_redis()

            assert synced_count == 2
            assert "flag1" in _flag_cache
            assert "flag2" in _flag_cache

    @pytest.mark.asyncio
    async def test_sync_from_redis_unavailable(self):
        """Test syncing when Redis is unavailable."""
        with patch("dotmac.platform.feature_flags.core.get_redis_client", return_value=None):
            synced_count = await sync_from_redis()

            assert synced_count == 0


class TestDecorator:
    """Test feature flag decorator functionality."""

    @pytest.mark.asyncio
    async def test_decorator_enabled(self):
        """Test decorator when flag is enabled."""
        from dotmac.platform.feature_flags.core import feature_flag

        @feature_flag("test_decorator", default=False)
        async def decorated_function():
            return "success"

        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=True):
            result = await decorated_function()

            assert result == "success"

    @pytest.mark.asyncio
    async def test_decorator_disabled_with_default(self):
        """Test decorator when flag is disabled but default is True."""
        from dotmac.platform.feature_flags.core import feature_flag

        @feature_flag("test_decorator", default=True)
        async def decorated_function():
            return "success"

        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=False):
            result = await decorated_function()

            assert result == "success"

    @pytest.mark.asyncio
    async def test_decorator_disabled_no_default(self):
        """Test decorator when flag is disabled and no default."""
        from dotmac.platform.feature_flags.core import feature_flag

        @feature_flag("test_decorator", default=False)
        async def decorated_function():
            return "success"

        with patch("dotmac.platform.feature_flags.core.is_enabled", return_value=False):
            result = await decorated_function()

            assert result is None

    def test_decorator_sync_function_enabled(self):
        """Sync decorated functions should evaluate flag without runtime errors."""
        from dotmac.platform.feature_flags.core import feature_flag

        @feature_flag("test_sync_decorator", default=False)
        def decorated_function():
            return "success"

        async_enabled = AsyncMock(return_value=True)
        with patch("dotmac.platform.feature_flags.core.is_enabled", async_enabled):
            result = decorated_function()

        assert result == "success"
        async_enabled.assert_awaited()

    def test_decorator_sync_function_with_running_loop(self):
        """Sync decorator must still work when a loop is already running."""
        from dotmac.platform.feature_flags.core import feature_flag

        @feature_flag("test_sync_with_loop", default=False)
        def decorated_function():
            return "success"

        async_enabled = AsyncMock(return_value=True)

        class DummyLoop:
            def is_running(self) -> bool:
                return True

        with (
            patch("dotmac.platform.feature_flags.core.is_enabled", async_enabled),
            patch("asyncio.get_running_loop", return_value=DummyLoop()),
        ):
            result = decorated_function()

        assert result == "success"
        async_enabled.assert_awaited()
