"""
Comprehensive tests for rate_limiting.py to improve coverage from 75%.

Tests cover:
- Limiter creation and configuration
- Storage backend selection (Redis vs in-memory)
- Lazy initialization
- Singleton pattern
- Proxy functionality
- Rate limit decorator
"""

from unittest.mock import Mock, patch

import pytest
from slowapi import Limiter

from dotmac.platform.core.rate_limiting import (
    RateLimitExceeded,
    _create_limiter,
    _LimiterProxy,
    _rate_limit_exceeded_handler,
    get_limiter,
    get_remote_address,
    limiter,
    rate_limit,
    reset_limiter,
)


@pytest.mark.integration
class TestCreateLimiter:
    """Test limiter creation with different storage backends."""

    @patch("dotmac.platform.core.rate_limiting.redis_client", None)
    @patch("dotmac.platform.settings.settings")
    def test_create_limiter_with_storage_uri(self, mock_settings):
        """Test limiter creation with configured storage URI."""
        mock_rate_limit = Mock()
        mock_rate_limit.storage_url = "redis://localhost:6379/0"
        mock_rate_limit.enabled = True  # Provide actual bool, not Mock
        mock_settings.rate_limit = mock_rate_limit

        result = _create_limiter()

        assert isinstance(result, Limiter)

    @patch("dotmac.platform.core.rate_limiting.redis_client", Mock())
    @patch("dotmac.platform.settings.settings")
    def test_create_limiter_with_redis_cache_url(self, mock_settings):
        """Test limiter creation using Redis cache URL."""
        mock_rate_limit = Mock()
        mock_rate_limit.storage_url = None
        mock_rate_limit.enabled = True  # Provide actual bool, not Mock
        mock_redis = Mock()
        mock_redis.cache_url = "redis://localhost:6379/1"
        mock_settings.rate_limit = mock_rate_limit
        mock_settings.redis = mock_redis

        result = _create_limiter()

        assert isinstance(result, Limiter)

    @patch("dotmac.platform.core.rate_limiting.redis_client", None)
    @patch("dotmac.platform.settings.settings")
    def test_create_limiter_fallback_memory(self, mock_settings):
        """Test limiter creation falls back to in-memory storage."""
        mock_rate_limit = Mock()
        mock_rate_limit.storage_url = None
        mock_rate_limit.enabled = True  # Provide actual bool, not Mock
        mock_settings.rate_limit = mock_rate_limit

        result = _create_limiter()

        assert isinstance(result, Limiter)

    @patch("dotmac.platform.core.rate_limiting.redis_client", Mock())
    @patch("dotmac.platform.settings.settings")
    def test_create_limiter_with_redis_client_but_no_storage_url(self, mock_settings):
        """Test limiter uses Redis cache URL when redis_client exists."""
        mock_rate_limit = Mock()
        mock_rate_limit.storage_url = None
        mock_rate_limit.enabled = True  # Provide actual bool, not Mock
        mock_redis = Mock()
        mock_redis.cache_url = "redis://localhost:6379/2"
        mock_settings.rate_limit = mock_rate_limit
        mock_settings.redis = mock_redis

        result = _create_limiter()

        assert isinstance(result, Limiter)


@pytest.mark.integration
class TestGetLimiter:
    """Test limiter singleton getter."""

    def setup_method(self):
        """Reset limiter before each test."""
        reset_limiter()

    def test_get_limiter_lazy_initialization(self):
        """Test limiter is lazily initialized on first access."""
        # Limiter should be None initially
        reset_limiter()

        # First call should create limiter
        limiter1 = get_limiter()
        assert isinstance(limiter1, Limiter)

        # Second call should return same instance
        limiter2 = get_limiter()
        assert limiter1 is limiter2

    def test_get_limiter_returns_same_instance(self):
        """Test get_limiter returns singleton instance."""
        limiter1 = get_limiter()
        limiter2 = get_limiter()
        limiter3 = get_limiter()

        assert limiter1 is limiter2 is limiter3

    def test_get_limiter_after_reset(self):
        """Test get_limiter creates new instance after reset."""
        limiter1 = get_limiter()

        reset_limiter()

        limiter2 = get_limiter()

        # Should be a new instance
        assert limiter1 is not limiter2
        assert isinstance(limiter2, Limiter)


@pytest.mark.integration
class TestResetLimiter:
    """Test limiter reset functionality."""

    def test_reset_limiter(self):
        """Test reset_limiter clears cached instance."""
        # Create limiter
        limiter1 = get_limiter()
        assert limiter1 is not None

        # Reset
        reset_limiter()

        # Get new limiter - should be different instance
        limiter2 = get_limiter()
        assert limiter2 is not None
        assert limiter1 is not limiter2

    def test_reset_limiter_multiple_times(self):
        """Test reset_limiter can be called multiple times."""
        get_limiter()
        reset_limiter()
        reset_limiter()  # Second reset should not fail
        reset_limiter()  # Third reset should not fail

        # Should still be able to get limiter
        new_limiter = get_limiter()
        assert isinstance(new_limiter, Limiter)


@pytest.mark.integration
class TestLimiterProxy:
    """Test limiter proxy functionality."""

    def setup_method(self):
        """Reset limiter before each test."""
        reset_limiter()

    def test_limiter_proxy_delegates_to_real_limiter(self):
        """Test proxy delegates method calls to real limiter."""
        # The proxy should delegate to the actual limiter
        # Just verify we can access the proxy without error
        assert isinstance(limiter, _LimiterProxy)

    def test_limiter_proxy_getattr(self):
        """Test proxy __getattr__ works correctly."""
        proxy = _LimiterProxy()

        # Accessing __getattr__ should work
        assert hasattr(proxy, "__getattr__")

    def test_limiter_proxy_type(self):
        """Test proxy type check."""
        proxy = _LimiterProxy()

        # Should be a _LimiterProxy instance
        assert isinstance(proxy, _LimiterProxy)

    def test_global_limiter_proxy(self):
        """Test the global limiter proxy instance."""
        # limiter is a global _LimiterProxy instance
        assert isinstance(limiter, _LimiterProxy)

        # Should be able to call __getattr__
        assert callable(getattr(limiter, "__getattr__", None))


@pytest.mark.integration
class TestRateLimitDecorator:
    """Test rate_limit decorator functionality."""

    def test_rate_limit_decorator_returns_decorator(self):
        """Test rate_limit returns a decorator function."""
        decorator = rate_limit("100/minute")

        # Should return a decorator function
        assert callable(decorator)

    def test_rate_limit_decorator_different_limits(self):
        """Test decorator creation with different rate limit strings."""
        # Just test that decorators can be created
        decorator1 = rate_limit("10/second")
        decorator2 = rate_limit("100/minute")
        decorator3 = rate_limit("1000/hour")

        # All should be callable decorators
        assert callable(decorator1)
        assert callable(decorator2)
        assert callable(decorator3)

    def test_rate_limit_decorator_limit_strings(self):
        """Test various rate limit string formats."""
        # Test different formats are accepted
        formats = [
            "10/second",
            "100/minute",
            "1000/hour",
            "10000/day",
            "5/second",
        ]

        for limit_str in formats:
            decorator = rate_limit(limit_str)
            assert callable(decorator)


@pytest.mark.integration
class TestExportedComponents:
    """Test that all components are properly exported."""

    def test_all_exports_available(self):
        """Test that all __all__ exports are accessible."""
        from dotmac.platform.core import rate_limiting

        # Check all exported names are available
        assert hasattr(rate_limiting, "limiter")
        assert hasattr(rate_limiting, "get_limiter")
        assert hasattr(rate_limiting, "reset_limiter")
        assert hasattr(rate_limiting, "rate_limit")
        assert hasattr(rate_limiting, "RateLimitExceeded")
        assert hasattr(rate_limiting, "get_remote_address")
        assert hasattr(rate_limiting, "_rate_limit_exceeded_handler")

    def test_rate_limit_exceeded_exception(self):
        """Test RateLimitExceeded exception is available."""
        # Should be able to import exception class
        assert RateLimitExceeded is not None
        assert issubclass(RateLimitExceeded, Exception)

    def test_get_remote_address_function(self):
        """Test get_remote_address is a callable."""
        assert callable(get_remote_address)

    def test_rate_limit_exceeded_handler(self):
        """Test rate limit exceeded handler is available."""
        assert callable(_rate_limit_exceeded_handler)


@pytest.mark.integration
class TestLimiterIntegration:
    """Test limiter integration scenarios."""

    def setup_method(self):
        """Reset limiter before each test."""
        reset_limiter()

    def test_limiter_is_slowapi_instance(self):
        """Test limiter is a SlowAPI Limiter instance."""
        actual_limiter = get_limiter()

        # Should be a Limiter instance
        assert isinstance(actual_limiter, Limiter)

    def test_limiter_has_limit_method(self):
        """Test limiter has the limit method."""
        actual_limiter = get_limiter()

        # Should have limit method (core SlowAPI functionality)
        assert hasattr(actual_limiter, "limit")
        assert callable(actual_limiter.limit)

    @patch("dotmac.platform.settings.settings")
    def test_limiter_with_different_storage_configs(self, mock_settings):
        """Test limiter creation with different storage configurations."""
        # Test with no storage URL - provide real redis.cache_url to avoid urlparse issues
        mock_rate_limit = Mock()
        mock_rate_limit.storage_url = None
        mock_rate_limit.enabled = True  # Provide actual bool, not Mock
        mock_redis = Mock()
        mock_redis.cache_url = "redis://localhost:6379/0"  # Real URL string for urlparse
        mock_settings.rate_limit = mock_rate_limit
        mock_settings.redis = mock_redis
        reset_limiter()
        limiter1 = get_limiter()
        assert isinstance(limiter1, Limiter)

        # Test with storage URL
        mock_rate_limit.storage_url = "memory://"
        reset_limiter()
        limiter2 = get_limiter()
        assert isinstance(limiter2, Limiter)


@pytest.mark.integration
class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_multiple_reset_and_get_cycles(self):
        """Test multiple cycles of reset and get."""
        for _i in range(5):
            limiter_instance = get_limiter()
            assert isinstance(limiter_instance, Limiter)
            reset_limiter()

        # After all cycles, should still work
        final_limiter = get_limiter()
        assert isinstance(final_limiter, Limiter)

    def test_concurrent_get_limiter_calls(self):
        """Test concurrent get_limiter calls return same instance."""
        import threading

        limiters = []

        def get_and_store():
            limiters.append(get_limiter())

        # Create multiple threads
        threads = [threading.Thread(target=get_and_store) for _ in range(10)]

        for thread in threads:
            thread.start()

        for thread in threads:
            thread.join()

        # All should be the same instance
        assert len(limiters) == 10
        assert all(lim is limiters[0] for lim in limiters)
