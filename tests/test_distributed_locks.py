"""Tests for distributed locks module."""

from unittest.mock import AsyncMock, patch

import pytest

# Import the entire module to ensure coverage tracking
import dotmac.platform.core.distributed_locks
from dotmac.platform.core.distributed_locks import (
    DistributedLock,
    distributed_lock,
    get_redis_client,
    release_lock,
    try_lock,
)


@pytest.mark.integration
class TestDistributedLocks:
    """Test distributed locks functionality."""

    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client."""
        client = AsyncMock()
        client.set = AsyncMock()
        client.eval = AsyncMock()
        client.get = AsyncMock()
        return client

    @patch("dotmac.platform.core.distributed_locks.redis.from_url")
    @patch("dotmac.platform.core.distributed_locks.settings")
    @pytest.mark.asyncio
    async def test_get_redis_client_creates_new(self, mock_settings, mock_from_url):
        """Test Redis client creation."""
        # Clear any existing client

        dotmac.platform.core.distributed_locks._redis_client = None

        mock_settings.redis.redis_url = "redis://localhost:6379"
        mock_client = AsyncMock()
        mock_from_url.return_value = mock_client

        result = await get_redis_client()

        mock_from_url.assert_called_once_with("redis://localhost:6379")
        assert result == mock_client

    @pytest.mark.asyncio
    async def test_get_redis_client_returns_existing(self):
        """Test Redis client returns existing instance."""
        # Set up existing client

        mock_existing_client = AsyncMock()
        dotmac.platform.core.distributed_locks._redis_client = mock_existing_client

        with patch("dotmac.platform.core.distributed_locks.redis.from_url") as mock_from_url:
            result = await get_redis_client()

            # Should not create new client
            mock_from_url.assert_not_called()
            assert result == mock_existing_client

        # Clean up
        dotmac.platform.core.distributed_locks._redis_client = None

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_success(self, mock_get_client, mock_redis_client):
        """Test successful lock acquisition and release."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True  # Lock acquired
        mock_redis_client.eval.return_value = 1  # Lock released

        async with distributed_lock("test_key", timeout=30):
            # Code in critical section
            pass

        # Verify lock acquisition
        assert mock_redis_client.set.call_count >= 1
        set_call = mock_redis_client.set.call_args
        assert set_call[0][0] == "lock:test_key"  # key
        assert set_call[1]["nx"] is True
        assert set_call[1]["ex"] == 30

        # Verify lock release
        mock_redis_client.eval.assert_called_once()

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_timeout(self, mock_get_client, mock_redis_client):
        """Test lock timeout when cannot acquire."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = False  # Lock not acquired

        with pytest.raises(TimeoutError, match="Could not acquire lock test_key within 1s"):
            async with distributed_lock("test_key", timeout=1, retry_delay=0.1):
                pass

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @patch("asyncio.sleep")
    @pytest.mark.asyncio
    async def test_distributed_lock_retry_success(
        self, mock_sleep, mock_get_client, mock_redis_client
    ):
        """Test lock acquisition after retry."""
        mock_get_client.return_value = mock_redis_client
        # First call fails, second succeeds
        mock_redis_client.set.side_effect = [False, True]
        mock_redis_client.eval.return_value = 1

        async with distributed_lock("test_key", timeout=2, retry_delay=0.1):
            pass

        # Verify retry was attempted
        assert mock_redis_client.set.call_count == 2
        mock_sleep.assert_called_with(0.1)

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_try_lock_success(self, mock_get_client, mock_redis_client):
        """Test try_lock successful acquisition."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True

        result = await try_lock("test_key", timeout=30)

        assert result is not None
        assert isinstance(result, str)
        mock_redis_client.set.assert_called_once()

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_try_lock_failure(self, mock_get_client, mock_redis_client):
        """Test try_lock failure."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = False

        result = await try_lock("test_key", timeout=30)

        assert result is None

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_release_lock_success(self, mock_get_client, mock_redis_client):
        """Test release_lock successful release."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.eval.return_value = 1

        result = await release_lock("test_key", "test_value")

        assert result is True
        mock_redis_client.eval.assert_called_once()

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_release_lock_failure(self, mock_get_client, mock_redis_client):
        """Test release_lock when we don't own the lock."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.eval.return_value = 0

        result = await release_lock("test_key", "wrong_value")

        assert result is False

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_release_lock_with_coroutine_result(self, mock_get_client, mock_redis_client):
        """Test release_lock when eval returns coroutine."""
        mock_get_client.return_value = mock_redis_client

        # Mock eval to return 1 (successful lock release)
        mock_redis_client.eval.return_value = 1

        result = await release_lock("test_key", "test_value")

        assert result is True


@pytest.mark.integration
class TestDistributedLockClass:
    """Test DistributedLock class."""

    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client."""
        client = AsyncMock()
        client.set = AsyncMock()
        client.eval = AsyncMock()
        return client

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_acquire_success(self, mock_get_client, mock_redis_client):
        """Test DistributedLock acquire success."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True

        lock = DistributedLock("test_key", timeout=30)
        result = await lock.acquire()

        assert result is True
        assert lock.lock_value is not None

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_acquire_failure(self, mock_get_client, mock_redis_client):
        """Test DistributedLock acquire failure."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = False

        lock = DistributedLock("test_key", timeout=1)
        result = await lock.acquire(retry_delay=0.1)

        assert result is False
        assert lock.lock_value is None

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_acquire_already_holding(
        self, mock_get_client, mock_redis_client
    ):
        """Test DistributedLock acquire when already holding lock."""
        lock = DistributedLock("test_key")
        lock.lock_value = "existing_value"

        result = await lock.acquire()

        assert result is False

    @patch("dotmac.platform.core.distributed_locks.release_lock")
    @pytest.mark.asyncio
    async def test_distributed_lock_release_success(self, mock_release_lock):
        """Test DistributedLock release success."""
        mock_release_lock.return_value = True

        lock = DistributedLock("test_key")
        lock.lock_value = "test_value"

        result = await lock.release()

        assert result is True
        assert lock.lock_value is None
        mock_release_lock.assert_called_once_with("test_key", "test_value")

    @pytest.mark.asyncio
    async def test_distributed_lock_release_no_value(self):
        """Test DistributedLock release when no lock value."""
        lock = DistributedLock("test_key")

        result = await lock.release()

        assert result is False

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_context_manager_success(
        self, mock_get_client, mock_redis_client
    ):
        """Test DistributedLock as async context manager."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True

        with patch.object(DistributedLock, "release", new_callable=AsyncMock) as mock_release:
            mock_release.return_value = True

            async with DistributedLock("test_key") as lock:
                assert isinstance(lock, DistributedLock)

            mock_release.assert_called_once()

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_context_manager_timeout(
        self, mock_get_client, mock_redis_client
    ):
        """Test DistributedLock context manager timeout."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = False

        with pytest.raises(TimeoutError, match="Could not acquire lock test_key"):
            async with DistributedLock("test_key", timeout=1):
                pass

    def test_distributed_lock_class_init(self):
        """Test DistributedLock initialization."""
        lock = DistributedLock("test_key", timeout=60)

        assert lock.key == "test_key"
        assert lock.timeout == 60
        assert lock.lock_value is None


@pytest.mark.integration
class TestDistributedLocksEdgeCases:
    """Test edge cases and error handling for distributed locks."""

    @pytest.fixture
    def mock_redis_client(self):
        """Mock Redis client."""
        client = AsyncMock()
        client.set = AsyncMock()
        client.eval = AsyncMock()
        return client

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_exception_during_acquire(
        self, mock_get_client, mock_redis_client
    ):
        """Test exception handling during lock acquisition."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.side_effect = Exception("Redis connection error")

        with pytest.raises(Exception, match="Redis connection error"):
            async with distributed_lock("test_key"):
                pass

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_exception_during_release(
        self, mock_get_client, mock_redis_client
    ):
        """Test exception handling during lock release."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True  # Acquire succeeds
        mock_redis_client.eval.side_effect = Exception("Redis eval error")

        # Release failure will propagate the exception
        with pytest.raises(Exception, match="Redis eval error"):
            async with distributed_lock("test_key"):
                pass

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_release_without_acquire(
        self, mock_get_client, mock_redis_client
    ):
        """Test releasing lock without acquiring it first."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.eval.return_value = 0

        # Should handle gracefully
        result = await release_lock("test_key", "fake_value")
        assert result is False

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @patch("asyncio.sleep")
    @pytest.mark.asyncio
    async def test_distributed_lock_retry_with_fractional_timeout(
        self, mock_sleep, mock_get_client, mock_redis_client
    ):
        """Test retry logic with fractional timeout values."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = False  # Always fail

        with pytest.raises(TimeoutError):
            async with distributed_lock("test_key", timeout=0.5, retry_delay=0.1):
                pass

        # Should attempt retries based on timeout/retry_delay calculation
        expected_retries = int(0.5 / 0.1)  # 5 retries
        assert mock_redis_client.set.call_count >= expected_retries

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_distributed_lock_class_acquire_with_retry_success(
        self, mock_get_client, mock_redis_client
    ):
        """Test DistributedLock class acquire with retry success."""
        mock_get_client.return_value = mock_redis_client
        # First call fails, second succeeds
        mock_redis_client.set.side_effect = [False, True]

        lock = DistributedLock("test_key", timeout=2)
        with patch("asyncio.sleep") as mock_sleep:
            result = await lock.acquire(retry_delay=0.1)

        assert result is True
        assert lock.lock_value is not None
        assert mock_redis_client.set.call_count == 2
        mock_sleep.assert_called_with(0.1)

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_eval_result_handling_sync_result(self, mock_get_client, mock_redis_client):
        """Test handling of synchronous result from Redis eval."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.eval.return_value = 1  # Synchronous result

        result = await release_lock("test_key", "test_value")

        assert result is True

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_eval_result_handling_async_result(self, mock_get_client, mock_redis_client):
        """Test handling of asynchronous result from Redis eval."""
        mock_get_client.return_value = mock_redis_client

        # Mock eval to return 1 (successful result)
        mock_redis_client.eval.return_value = 1

        result = await release_lock("test_key", "test_value")

        assert result is True

    def test_module_imports(self):
        """Test that all required imports are available."""
        from dotmac.platform.core import distributed_locks

        # Check that key functions are available
        assert hasattr(distributed_locks, "get_redis_client")
        assert hasattr(distributed_locks, "distributed_lock")
        assert hasattr(distributed_locks, "try_lock")
        assert hasattr(distributed_locks, "release_lock")
        assert hasattr(distributed_locks, "DistributedLock")

    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_lua_script_execution_in_context_manager(
        self, mock_get_client, mock_redis_client
    ):
        """Test Lua script execution in distributed lock context manager."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True  # Acquire succeeds
        mock_redis_client.eval.return_value = 1  # Release succeeds

        async with distributed_lock("test_key"):
            pass

        # Verify Lua script was called with correct parameters
        eval_call = mock_redis_client.eval.call_args
        lua_script = eval_call[0][0]

        # Check that the Lua script contains the expected logic
        assert 'redis.call("get", KEYS[1])' in lua_script
        assert 'redis.call("del", KEYS[1])' in lua_script
        assert eval_call[0][1] == 1  # Number of keys
        assert eval_call[0][2] == "lock:test_key"  # Lock key
        # eval_call[0][3] should be the lock value (UUID)

    @patch("dotmac.platform.core.distributed_locks.logger")
    @patch("dotmac.platform.core.distributed_locks.get_redis_client")
    @pytest.mark.asyncio
    async def test_logging_on_lock_acquire_and_release(
        self, mock_get_client, mock_logger, mock_redis_client
    ):
        """Test that lock acquisition and release are logged."""
        mock_get_client.return_value = mock_redis_client
        mock_redis_client.set.return_value = True
        mock_redis_client.eval.return_value = 1

        async with distributed_lock("test_key"):
            pass

        # Verify debug logging
        assert mock_logger.debug.call_count == 2  # acquire + release

        # Check acquire logging
        acquire_call = mock_logger.debug.call_args_list[0]
        assert "Lock acquired" in acquire_call[0][0]
        assert acquire_call[1]["key"] == "test_key"

        # Check release logging
        release_call = mock_logger.debug.call_args_list[1]
        assert "Lock released" in release_call[0][0]
        assert release_call[1]["key"] == "test_key"
