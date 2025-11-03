"""Tests for caching module."""

import json
from unittest.mock import MagicMock, Mock, patch

import pytest

# Import the entire module to ensure coverage tracking
from dotmac.platform.core.caching import (
    cache_clear,
    cache_delete,
    cache_get,
    cache_set,
    get_redis,
    lru_cache,
    memory_cache,
    redis_cache,
    redis_client,
)


@pytest.mark.integration
class TestCaching:
    """Test caching functionality."""

    def setup_method(self):
        """Clean caches before each test."""
        memory_cache.clear()
        lru_cache.clear()

    @patch("dotmac.platform.core.caching.redis_client", None)
    @patch("dotmac.platform.core.caching._redis_init_attempted", False)
    def test_get_redis(self):
        """Test get_redis returns redis client."""
        with patch("dotmac.platform.core.caching.redis.Redis.from_url") as mock_from_url:
            mock_redis = MagicMock()
            mock_from_url.return_value = mock_redis

            result = get_redis()
            # Should return the newly created redis client
            assert result is mock_redis

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_get_with_redis_success(self, mock_redis):
        """Test cache_get with Redis successful retrieval (JSON)."""
        test_value = {"test": "data"}
        # Use JSON serialization instead of pickle for security
        mock_redis.get.return_value = json.dumps(test_value).encode("utf-8")

        result = cache_get("test_key", "default")

        assert result == test_value
        mock_redis.get.assert_called_once_with("test_key")

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_get_with_redis_none(self, mock_redis):
        """Test cache_get with Redis returning None."""
        mock_redis.get.return_value = None

        result = cache_get("test_key", "default")

        assert result == "default"

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_get_with_redis_exception(self, mock_redis):
        """Test cache_get with Redis exception."""
        mock_redis.get.side_effect = Exception("Redis error")

        # Put something in memory cache
        memory_cache["test_key"] = "memory_value"

        result = cache_get("test_key", "default")

        assert result == "memory_value"

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_get_memory_only(self):
        """Test cache_get with no Redis (memory only)."""
        memory_cache["test_key"] = "memory_value"

        result = cache_get("test_key", "default")

        assert result == "memory_value"

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_get_memory_missing(self):
        """Test cache_get with missing key in memory cache."""
        result = cache_get("missing_key", "default")

        assert result == "default"

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_set_with_redis_success(self, mock_redis):
        """Test cache_set with Redis successful storage (JSON)."""
        test_value = {"test": "data"}
        mock_redis.setex = Mock()

        result = cache_set("test_key", test_value, 600)

        assert result is True
        # Use JSON serialization instead of pickle for security
        mock_redis.setex.assert_called_once_with("test_key", 600, json.dumps(test_value))

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_set_with_redis_exception(self, mock_redis):
        """Test cache_set with Redis exception."""
        mock_redis.setex.side_effect = Exception("Redis error")

        result = cache_set("test_key", "test_value", 600)

        assert result is True
        # Should fall back to memory cache
        assert memory_cache["test_key"] == "test_value"

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_set_memory_only(self):
        """Test cache_set with no Redis (memory only)."""
        result = cache_set("test_key", "test_value")

        assert result is True
        assert memory_cache["test_key"] == "test_value"

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_delete_with_redis_success(self, mock_redis):
        """Test cache_delete with Redis successful deletion."""
        mock_redis.delete.return_value = 1  # Key existed and was deleted

        result = cache_delete("test_key")

        assert result is True
        mock_redis.delete.assert_called_once_with("test_key")

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_delete_with_redis_not_found(self, mock_redis):
        """Test cache_delete with Redis key not found."""
        mock_redis.delete.return_value = 0  # Key didn't exist

        # Put key in memory cache
        memory_cache["test_key"] = "value"

        result = cache_delete("test_key")

        assert result is True  # Deleted from memory cache
        assert "test_key" not in memory_cache

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_delete_with_redis_exception(self, mock_redis):
        """Test cache_delete with Redis exception."""
        mock_redis.delete.side_effect = Exception("Redis error")

        # Put key in memory cache
        memory_cache["test_key"] = "value"

        result = cache_delete("test_key")

        assert result is True  # Deleted from memory cache
        assert "test_key" not in memory_cache

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_delete_memory_only(self):
        """Test cache_delete with no Redis (memory only)."""
        memory_cache["test_key"] = "value"

        result = cache_delete("test_key")

        assert result is True
        assert "test_key" not in memory_cache

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_delete_memory_missing(self):
        """Test cache_delete with key not in memory cache."""
        result = cache_delete("missing_key")

        assert result is False

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_clear_with_redis(self, mock_redis):
        """Test cache_clear with Redis."""
        mock_redis.delete = Mock()
        mock_redis.flushdb = Mock()

        cache_set("tracked:key1", "redis_value")
        memory_cache["key1"] = "value1"
        lru_cache["key2"] = "value2"

        cache_clear()

        mock_redis.delete.assert_called_once_with("tracked:key1")
        assert len(memory_cache) == 0
        assert len(lru_cache) == 0

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_clear_with_redis_exception(self, mock_redis):
        """Test cache_clear with Redis exception."""
        mock_redis.delete.side_effect = Exception("Redis error")
        cache_set("tracked:key1", "redis_value")
        memory_cache["key1"] = "value1"
        lru_cache["key2"] = "value2"

        cache_clear()

        # Should still clear memory caches
        assert len(memory_cache) == 0
        assert len(lru_cache) == 0

    @patch("dotmac.platform.core.caching.redis_client", None)
    def test_cache_clear_memory_only(self):
        """Test cache_clear with no Redis (memory only)."""
        memory_cache["key1"] = "value1"
        lru_cache["key2"] = "value2"

        cache_clear()

        assert len(memory_cache) == 0
        assert len(lru_cache) == 0

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_clear_flush_all(self, mock_redis):
        """Test cache_clear flush all resets Redis DB."""
        mock_redis.flushdb = Mock()
        cache_clear(flush_all=True)
        mock_redis.flushdb.assert_called_once()

    @patch("dotmac.platform.core.caching.cache_get")
    @patch("dotmac.platform.core.caching.cache_set")
    def test_redis_cache_decorator_cache_hit(self, mock_cache_set, mock_cache_get):
        """Test redis_cache decorator with cache hit."""
        mock_cache_get.return_value = "cached_result"

        @redis_cache(ttl=600)
        def test_func(arg1, arg2):
            return f"result_{arg1}_{arg2}"

        result = test_func("a", "b")

        assert result == "cached_result"
        mock_cache_get.assert_called_once()
        mock_cache_set.assert_not_called()

    @patch("dotmac.platform.core.caching.cache_get")
    @patch("dotmac.platform.core.caching.cache_set")
    def test_redis_cache_decorator_cache_miss(self, mock_cache_set, mock_cache_get):
        """Test redis_cache decorator with cache miss."""
        mock_cache_get.return_value = None

        @redis_cache(ttl=600)
        def test_func(arg1, arg2):
            return f"result_{arg1}_{arg2}"

        result = test_func("a", "b")

        assert result == "result_a_b"
        mock_cache_get.assert_called_once()
        mock_cache_set.assert_called_once()

    @patch("dotmac.platform.core.caching.cache_get")
    @patch("dotmac.platform.core.caching.cache_set")
    def test_redis_cache_decorator_key_generation(self, mock_cache_set, mock_cache_get):
        """Test redis_cache decorator key generation."""
        mock_cache_get.return_value = None

        @redis_cache(ttl=300)
        def test_func(arg1, kwarg1=None):
            return "result"

        test_func("value1", kwarg1="value2")

        # Verify cache_get was called with a consistent key
        cache_key = mock_cache_get.call_args[0][0]
        assert cache_key.startswith("cache:")
        assert len(cache_key.split(":")) == 2  # "cache" + hash

        # Verify cache_set was called with same key
        assert mock_cache_set.call_args[0][0] == cache_key
        assert mock_cache_set.call_args[0][1] == "result"
        assert mock_cache_set.call_args[0][2] == 300

    def test_redis_cache_decorator_with_kwargs(self):
        """Test redis_cache decorator with keyword arguments."""
        # Clear caches first to ensure clean state
        cache_clear()

        call_count = 0

        @redis_cache(ttl=300)
        def test_func(arg1, kwarg1=None):
            nonlocal call_count
            call_count += 1
            return f"result_{arg1}_{kwarg1}_{call_count}"

        # Call with same arguments should return cached result
        result1 = test_func("a", kwarg1="b")
        result2 = test_func("a", kwarg1="b")

        assert result1 == result2
        assert call_count == 1  # Function should only be called once

    def test_memory_caches_exist(self):
        """Test that memory caches are properly initialized."""
        from cachetools import LRUCache, TTLCache

        assert isinstance(memory_cache, TTLCache)
        assert isinstance(lru_cache, LRUCache)

    def test_module_exports(self):
        """Test that all required exports are available."""
        from dotmac.platform.core import caching

        required_exports = [
            "redis_client",
            "get_redis",
            "cache_get",
            "cache_set",
            "cache_delete",
            "cache_clear",
            "redis_cache",
            "memory_cache",
            "lru_cache",
            "cached",
            "TTLCache",
            "LRUCache",
        ]

        for export in required_exports:
            assert hasattr(caching, export), f"Missing export: {export}"

    def test_redis_client_initialization(self):
        """Test Redis client initialization."""
        # This will be None or Redis instance depending on settings
        assert redis_client is None or hasattr(redis_client, "get")

    def test_redis_initialization_logic(self):
        """Test the Redis initialization logic works correctly."""
        # Test the import path and settings access
        # This verifies the initialization code can run without errors
        from dotmac.platform.settings import settings

        # Verify settings attributes exist (they may be None)
        assert hasattr(settings.redis, "host")
        assert hasattr(settings.redis, "cache_url")
        assert hasattr(settings.redis, "max_connections")

        # Test that the redis_client import works
        from dotmac.platform.core.caching import redis_client

        # redis_client will be None if no Redis configured, or a Redis instance if configured
        assert redis_client is None or hasattr(redis_client, "get")

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_get_with_bytes_data(self, mock_redis):
        """Test cache_get properly handles bytes data from Redis (JSON)."""
        test_value = {"test": "data"}
        # Use JSON serialization instead of pickle for security
        mock_redis.get.return_value = json.dumps(test_value).encode("utf-8")

        result = cache_get("test_key")

        assert result == test_value

    @patch("dotmac.platform.core.caching.redis_client")
    def test_cache_get_with_non_bytes_data(self, mock_redis):
        """Test cache_get with non-bytes data from Redis."""
        mock_redis.get.return_value = "string_data"  # Not bytes

        result = cache_get("test_key", "default")

        # Should return default since value is not bytes
        assert result == "default"
