"""Tests for billing recovery mechanisms."""

import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest

from dotmac.platform.billing.exceptions import (
    BillingError,
    PaymentError,
)
from dotmac.platform.billing.recovery import (
    BillingRetry,
    CircuitBreaker,
    ExponentialBackoff,
    IdempotencyManager,
    LinearBackoff,
    RecoveryContext,
    with_retry,
)


@pytest.mark.unit
class TestRetryStrategies:
    """Test retry strategy implementations."""

    def test_exponential_backoff_without_jitter(self):
        """Test exponential backoff calculates correct delays."""
        strategy = ExponentialBackoff(base_delay=1.0, max_delay=60.0, jitter=False)

        assert strategy.get_delay(0) == 1.0  # 1 * 2^0
        assert strategy.get_delay(1) == 2.0  # 1 * 2^1
        assert strategy.get_delay(2) == 4.0  # 1 * 2^2
        assert strategy.get_delay(3) == 8.0  # 1 * 2^3
        assert strategy.get_delay(10) == 60.0  # Max delay cap

    def test_exponential_backoff_with_jitter(self):
        """Test exponential backoff with jitter adds randomness."""
        strategy = ExponentialBackoff(base_delay=1.0, max_delay=60.0, jitter=True)

        delay = strategy.get_delay(2)  # Base would be 4.0
        assert 2.0 <= delay <= 8.0  # Jitter between 0.5x and 1.5x

    def test_linear_backoff(self):
        """Test linear backoff increases linearly."""
        strategy = LinearBackoff(delay=1.0, increment=0.5)

        assert strategy.get_delay(0) == 1.0  # 1.0 + 0 * 0.5
        assert strategy.get_delay(1) == 1.5  # 1.0 + 1 * 0.5
        assert strategy.get_delay(2) == 2.0  # 1.0 + 2 * 0.5
        assert strategy.get_delay(5) == 3.5  # 1.0 + 5 * 0.5


@pytest.mark.unit
class TestBillingRetry:
    """Test BillingRetry class."""

    @pytest.mark.asyncio
    async def test_successful_first_attempt(self):
        """Test function succeeds on first attempt."""
        mock_func = AsyncMock(return_value="success")
        retry = BillingRetry(max_attempts=3)

        result = await retry.execute(mock_func, "arg1", key="value")

        assert result == "success"
        mock_func.assert_called_once_with("arg1", key="value")

    @pytest.mark.asyncio
    async def test_retry_on_payment_error(self):
        """Test retry on PaymentError."""
        mock_func = AsyncMock(
            side_effect=[PaymentError("Payment failed"), PaymentError("Payment failed"), "success"]
        )

        strategy = LinearBackoff(delay=0.01, increment=0)  # Fast for testing
        retry = BillingRetry(max_attempts=3, strategy=strategy)

        result = await retry.execute(mock_func)

        assert result == "success"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_retry_exhausted(self):
        """Test all retry attempts exhausted."""
        mock_func = AsyncMock(side_effect=PaymentError("Payment failed"))

        strategy = LinearBackoff(delay=0.01, increment=0)
        retry = BillingRetry(max_attempts=3, strategy=strategy)

        with pytest.raises(PaymentError) as exc_info:
            await retry.execute(mock_func)

        assert str(exc_info.value) == "Payment failed"
        assert mock_func.call_count == 3

    @pytest.mark.asyncio
    async def test_non_retryable_exception(self):
        """Test non-retryable exception is raised immediately."""
        mock_func = AsyncMock(side_effect=ValueError("Invalid value"))

        retry = BillingRetry(max_attempts=3)

        with pytest.raises(ValueError) as exc_info:
            await retry.execute(mock_func)

        assert str(exc_info.value) == "Invalid value"
        mock_func.assert_called_once()

    @pytest.mark.asyncio
    async def test_on_retry_callback(self):
        """Test on_retry callback is called."""
        mock_func = AsyncMock(side_effect=[PaymentError("Failed"), "success"])
        on_retry_mock = AsyncMock()

        strategy = LinearBackoff(delay=0.01, increment=0)
        retry = BillingRetry(max_attempts=3, strategy=strategy, on_retry=on_retry_mock)

        result = await retry.execute(mock_func)

        assert result == "success"
        on_retry_mock.assert_called_once()

        call_args = on_retry_mock.call_args
        assert call_args[0][0] == 0  # Attempt number
        assert isinstance(call_args[0][1], PaymentError)


@pytest.mark.unit
class TestWithRetryDecorator:
    """Test with_retry decorator."""

    @pytest.mark.asyncio
    async def test_decorator_basic(self):
        """Test decorator applies retry logic."""
        call_count = 0

        @with_retry(max_attempts=3, strategy=LinearBackoff(0.01, 0))
        async def flaky_function():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise PaymentError("Failed")
            return "success"

        result = await flaky_function()

        assert result == "success"
        assert call_count == 3

    @pytest.mark.asyncio
    async def test_decorator_with_args(self):
        """Test decorator with function arguments."""

        @with_retry(max_attempts=2)
        async def process_payment(payment_id: str, amount: float):
            if payment_id == "fail":
                raise PaymentError("Payment failed")
            return f"Processed {amount} for {payment_id}"

        result = await process_payment("success", 100.0)
        assert result == "Processed 100.0 for success"

        with pytest.raises(PaymentError):
            await process_payment("fail", 100.0)


@pytest.mark.unit
class TestCircuitBreaker:
    """Test CircuitBreaker pattern."""

    @pytest.mark.asyncio
    async def test_circuit_closed_success(self):
        """Test circuit breaker in closed state with successful calls."""
        mock_func = AsyncMock(return_value="success")
        breaker = CircuitBreaker(failure_threshold=3)

        result = await breaker.call(mock_func)

        assert result == "success"
        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_opens_after_threshold(self):
        """Test circuit opens after failure threshold."""
        mock_func = AsyncMock(side_effect=BillingError("Service error"))
        breaker = CircuitBreaker(failure_threshold=3)

        # Fail 3 times to open circuit
        for _ in range(3):
            with pytest.raises(BillingError):
                await breaker.call(mock_func)

        assert breaker.state == CircuitBreaker.OPEN
        assert breaker.failure_count == 3

    @pytest.mark.asyncio
    async def test_circuit_open_fails_fast(self):
        """Test open circuit fails immediately."""
        mock_func = AsyncMock(return_value="success")
        breaker = CircuitBreaker(failure_threshold=1)

        # Open the circuit
        breaker.state = CircuitBreaker.OPEN
        breaker.failure_count = 1
        breaker.last_failure_time = datetime.now(UTC).timestamp()

        with pytest.raises(BillingError) as exc_info:
            await breaker.call(mock_func)

        assert "Service temporarily unavailable" in str(exc_info.value)
        assert exc_info.value.error_code == "CIRCUIT_BREAKER_OPEN"
        mock_func.assert_not_called()

    @pytest.mark.asyncio
    async def test_circuit_half_open_success_resets(self):
        """Test successful call in half-open state resets circuit."""
        mock_func = AsyncMock(return_value="success")
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=0.01)

        # Set to open state
        breaker.state = CircuitBreaker.OPEN
        breaker.failure_count = 3
        breaker.last_failure_time = datetime.now(UTC).timestamp() - 1

        # Wait for recovery timeout
        await asyncio.sleep(0.02)

        # Should transition to half-open and succeed
        result = await breaker.call(mock_func)

        assert result == "success"
        assert breaker.state == CircuitBreaker.CLOSED
        assert breaker.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_half_open_failure_reopens(self):
        """Test failure in half-open state reopens circuit."""
        mock_func = AsyncMock(side_effect=BillingError("Still failing"))
        breaker = CircuitBreaker(failure_threshold=3, recovery_timeout=0.01)

        # Set to open state
        breaker.state = CircuitBreaker.OPEN
        breaker.failure_count = 3
        breaker.last_failure_time = datetime.now(UTC).timestamp() - 1

        # Wait for recovery timeout
        await asyncio.sleep(0.02)

        # Should transition to half-open and fail
        with pytest.raises(BillingError):
            await breaker.call(mock_func)

        assert breaker.state == CircuitBreaker.OPEN
        assert breaker.failure_count == 4


@pytest.mark.unit
class TestRecoveryContext:
    """Test RecoveryContext manager."""

    @pytest.mark.asyncio
    async def test_successful_primary(self):
        """Test successful primary function execution."""
        primary = AsyncMock(return_value="primary_result")
        fallback = AsyncMock(return_value="fallback_result")

        async with RecoveryContext() as ctx:
            result = await ctx.execute_with_fallback(
                primary=primary, fallback=fallback, arg1="test"
            )

        assert result == "primary_result"
        primary.assert_called_once_with(arg1="test")
        fallback.assert_not_called()

        assert len(ctx.attempts) == 1
        assert ctx.attempts[0]["type"] == "primary"
        assert ctx.attempts[0]["success"] is True

    @pytest.mark.asyncio
    async def test_fallback_on_primary_failure(self):
        """Test fallback executes when primary fails."""
        primary = AsyncMock(side_effect=PaymentError("Primary failed"))
        fallback = AsyncMock(return_value="fallback_result")

        async with RecoveryContext() as ctx:
            result = await ctx.execute_with_fallback(
                primary=primary, fallback=fallback, payment_id="123"
            )

        assert result == "fallback_result"
        primary.assert_called_once_with(payment_id="123")
        fallback.assert_called_once_with(payment_id="123")

        assert len(ctx.attempts) == 2
        assert ctx.attempts[0]["type"] == "primary"
        assert ctx.attempts[0]["success"] is False
        assert ctx.attempts[1]["type"] == "fallback"
        assert ctx.attempts[1]["success"] is True

    @pytest.mark.asyncio
    async def test_both_functions_fail(self):
        """Test exception when both primary and fallback fail."""
        primary = AsyncMock(side_effect=PaymentError("Primary failed"))
        fallback = AsyncMock(side_effect=PaymentError("Fallback failed"))

        async with RecoveryContext() as ctx:
            with pytest.raises(PaymentError) as exc_info:
                await ctx.execute_with_fallback(primary=primary, fallback=fallback)

        assert str(exc_info.value) == "Fallback failed"
        assert len(ctx.attempts) == 2
        assert all(not attempt["success"] for attempt in ctx.attempts)

    @pytest.mark.asyncio
    async def test_context_state_tracking(self):
        """Test context tracks state correctly."""
        async with RecoveryContext(save_state=True) as ctx:
            assert "started_at" in ctx.state
            assert isinstance(ctx.state["started_at"], datetime)

            ctx.state["custom_data"] = "test"

        assert "completed_at" in ctx.state
        assert ctx.state["success"] is True
        assert ctx.state["custom_data"] == "test"


@pytest.mark.unit
class TestIdempotencyManager:
    """Test IdempotencyManager for preventing duplicates."""

    @pytest.mark.asyncio
    async def test_first_execution(self):
        """Test first execution of idempotent operation."""
        manager = IdempotencyManager()
        mock_func = AsyncMock(return_value="result")

        result = await manager.ensure_idempotent(key="unique-key", func=mock_func, arg1="test")

        assert result == "result"
        mock_func.assert_called_once_with(arg1="test")

    @pytest.mark.asyncio
    async def test_cached_result(self):
        """Test cached result is returned for duplicate key."""
        manager = IdempotencyManager()
        mock_func = AsyncMock(return_value="result")

        # First call
        result1 = await manager.ensure_idempotent("key", mock_func)

        # Second call with same key
        result2 = await manager.ensure_idempotent("key", mock_func)

        assert result1 == result2 == "result"
        mock_func.assert_called_once()  # Only called once

    @pytest.mark.asyncio
    async def test_different_keys(self):
        """Test different keys execute independently."""
        manager = IdempotencyManager()
        mock_func = AsyncMock(side_effect=["result1", "result2"])

        result1 = await manager.ensure_idempotent("key1", mock_func)
        result2 = await manager.ensure_idempotent("key2", mock_func)

        assert result1 == "result1"
        assert result2 == "result2"
        assert mock_func.call_count == 2

    @pytest.mark.asyncio
    async def test_failure_not_cached(self):
        """Test failures are not cached."""
        manager = IdempotencyManager()
        mock_func = AsyncMock(side_effect=[PaymentError("First attempt failed"), "success"])

        # First attempt fails
        with pytest.raises(PaymentError):
            await manager.ensure_idempotent("key", mock_func)

        # Second attempt should execute again
        result = await manager.ensure_idempotent("key", mock_func)

        assert result == "success"
        assert mock_func.call_count == 2

    def test_cleanup_expired(self):
        """Test cleanup of expired cache entries."""
        manager = IdempotencyManager(cache_ttl=1)  # 1 second TTL

        now = datetime.now(UTC)

        # Add old entry (expired - 2 seconds ago)
        old_time = now - timedelta(seconds=2)
        manager._cache["old_key"] = {"result": "old_result", "timestamp": old_time}

        # Add recent entry (not expired)
        manager._cache["recent_key"] = {"result": "recent_result", "timestamp": now}

        # Cleanup should remove old entry
        manager.cleanup_expired()

        assert "old_key" not in manager._cache
        assert "recent_key" in manager._cache


@pytest.mark.unit
class TestIntegration:
    """Integration tests combining multiple recovery mechanisms."""

    @pytest.mark.asyncio
    async def test_retry_with_circuit_breaker(self):
        """Test retry mechanism with circuit breaker."""
        mock_func = AsyncMock(
            side_effect=[BillingError("Fail 1"), BillingError("Fail 2"), "success"]
        )

        breaker = CircuitBreaker(failure_threshold=5)
        retry = BillingRetry(
            max_attempts=3, strategy=LinearBackoff(0.01, 0), retryable_exceptions=(BillingError,)
        )

        async def wrapped_func():
            return await breaker.call(mock_func)

        result = await retry.execute(wrapped_func)

        assert result == "success"
        assert mock_func.call_count == 3
        assert breaker.state == CircuitBreaker.CLOSED

    @pytest.mark.asyncio
    async def test_idempotent_retry(self):
        """Test idempotent operations with retry."""
        call_count = 0

        async def payment_func():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise PaymentError("First attempt failed")
            return f"Payment {call_count}"

        manager = IdempotencyManager()
        retry = BillingRetry(max_attempts=2, strategy=LinearBackoff(0.01, 0))

        # First execution with retry
        result1 = await retry.execute(manager.ensure_idempotent, "payment-123", payment_func)

        # Second execution should use cache
        result2 = await retry.execute(manager.ensure_idempotent, "payment-123", payment_func)

        assert result1 == result2 == "Payment 2"
        assert call_count == 2  # Only retried once, second used cache
