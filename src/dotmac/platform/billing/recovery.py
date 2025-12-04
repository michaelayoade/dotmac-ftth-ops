"""
Billing error recovery and retry mechanisms.

Provides utilities for handling transient failures, implementing retry logic,
and recovering from billing errors gracefully.
"""

import asyncio
import secrets
import uuid
from collections.abc import Awaitable, Callable, Iterable
from datetime import UTC, datetime
from functools import wraps
from typing import Any, ParamSpec, TypeVar

import structlog

from dotmac.platform.billing.exceptions import (
    BillingError,
    PaymentError,
    WebhookError,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T")
P = ParamSpec("P")
RetryCallback = Callable[[int, Exception], Awaitable[None] | None]


class RetryStrategy:
    """Base class for retry strategies."""

    def get_delay(self, attempt: int) -> float:
        """Calculate delay before next retry attempt."""
        raise NotImplementedError


class ExponentialBackoff(RetryStrategy):
    """Exponential backoff retry strategy with jitter."""

    def __init__(
        self, base_delay: float = 1.0, max_delay: float = 60.0, jitter: bool = True
    ) -> None:
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.jitter = jitter

    def get_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay with optional jitter.

        Uses secrets.SystemRandom for better randomness than random.random().
        """
        delay: float = min(self.base_delay * (2**attempt), self.max_delay)
        if self.jitter:
            # Use secrets module for cryptographically strong random numbers
            jitter_factor = 0.5 + (secrets.SystemRandom().random())
            delay = delay * jitter_factor
        return delay


class LinearBackoff(RetryStrategy):
    """Linear backoff retry strategy."""

    def __init__(self, delay: float = 1.0, increment: float = 1.0) -> None:
        self.delay = delay
        self.increment = increment

    def get_delay(self, attempt: int) -> float:
        """Calculate linear backoff delay."""
        return self.delay + (attempt * self.increment)


class BillingRetry:
    """
    Retry mechanism for billing operations with configurable strategies.

    Example:
        retry = BillingRetry(max_attempts=3, strategy=ExponentialBackoff())
        result = await retry.execute(payment_service.process_payment, payment_id)
    """

    def __init__(
        self,
        max_attempts: int = 3,
        strategy: RetryStrategy | None = None,
        retryable_exceptions: Iterable[type[Exception]] = (PaymentError, WebhookError),
        on_retry: RetryCallback | None = None,
    ) -> None:
        self.max_attempts = max_attempts
        self.strategy = strategy or ExponentialBackoff()
        self.retryable_exceptions = tuple(retryable_exceptions)
        self.on_retry = on_retry

    async def execute(self, func: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any) -> T:
        """
        Execute function with retry logic.

        Args:
            func: Async function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from successful function execution

        Raises:
            Last exception if all retry attempts fail
        """
        last_exception: Exception | None = None

        for attempt in range(self.max_attempts):
            try:
                result: T = await func(*args, **kwargs)
                if attempt > 0:
                    logger.info(
                        "Operation succeeded after retry",
                        function=func.__name__,
                        attempt=attempt + 1,
                    )
                return result

            except self.retryable_exceptions as e:
                last_exception = e

                if attempt < self.max_attempts - 1:
                    delay = self.strategy.get_delay(attempt)

                    logger.warning(
                        "Operation failed, retrying",
                        function=func.__name__,
                        attempt=attempt + 1,
                        max_attempts=self.max_attempts,
                        delay=delay,
                        error=str(e),
                    )

                    if self.on_retry:
                        callback_result = self.on_retry(attempt, e)
                        if isinstance(callback_result, Awaitable):
                            await callback_result

                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        "Operation failed after all retry attempts",
                        function=func.__name__,
                        attempts=self.max_attempts,
                        error=str(e),
                    )

            except Exception as e:
                # Non-retryable exception
                logger.error(
                    "Non-retryable exception occurred", function=func.__name__, error=str(e)
                )
                raise

        if last_exception:
            raise last_exception
        raise BillingError("No result from execute", error_code="NO_RESULT")


def with_retry(
    max_attempts: int = 3,
    strategy: RetryStrategy | None = None,
    retryable_exceptions: tuple[type[Exception], ...] = (PaymentError, WebhookError),
) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
    """
    Decorator for adding retry logic to async functions.

    Example:
        @with_retry(max_attempts=3)
        async def process_payment(payment_id: str):
            # Payment processing logic
            pass
    """

    def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            retry = BillingRetry(
                max_attempts=max_attempts,
                strategy=strategy,
                retryable_exceptions=retryable_exceptions,
            )
            return await retry.execute(func, *args, **kwargs)

        return wrapper

    return decorator


class CircuitBreaker:
    """
    Circuit breaker pattern for preventing cascading failures.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Failures exceeded threshold, requests fail fast
    - HALF_OPEN: Testing if service recovered
    """

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type[Exception] = BillingError,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self.failure_count = 0
        self.last_failure_time: float | None = None
        self.state = self.CLOSED

    async def call(self, func: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any) -> T:
        """
        Execute function through circuit breaker.

        Args:
            func: Async function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result from function execution

        Raises:
            BillingError: If circuit is open
            Original exception: If function fails
        """
        if self.state == self.OPEN:
            if self._should_attempt_reset():
                self.state = self.HALF_OPEN
            else:
                raise BillingError(
                    "Service temporarily unavailable",
                    error_code="CIRCUIT_BREAKER_OPEN",
                    status_code=503,
                    recovery_hint="Service is experiencing issues. Please try again later.",
                )

        try:
            result: T = await func(*args, **kwargs)
            self._on_success()
            return result

        except Exception as e:
            if isinstance(e, self.expected_exception):
                self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time passed to attempt reset."""
        if self.last_failure_time is None:
            return False

        time_since_failure = datetime.now(UTC).timestamp() - self.last_failure_time
        return time_since_failure >= self.recovery_timeout

    def _on_success(self) -> None:
        """Handle successful call."""
        if self.state == self.HALF_OPEN:
            logger.info("Circuit breaker reset to CLOSED")
            self.state = self.CLOSED
        self.failure_count = 0
        self.last_failure_time = None

    def _on_failure(self) -> None:
        """Handle failed call."""
        self.failure_count += 1
        self.last_failure_time = datetime.now(UTC).timestamp()

        if self.failure_count >= self.failure_threshold:
            logger.warning(
                "Circuit breaker opened",
                failure_count=self.failure_count,
                threshold=self.failure_threshold,
            )
            self.state = self.OPEN


class RecoveryContext:
    """
    Context manager for handling recoverable billing operations.

    Example:
        async with RecoveryContext() as ctx:
            result = await ctx.execute_with_fallback(
                primary=payment_service.charge_card,
                fallback=payment_service.charge_bank_account,
                payment_id=payment_id
            )
    """

    def __init__(self, save_state: bool = True, state_key: str | None = None) -> None:
        self.save_state = save_state
        self.state_key = state_key or str(uuid.uuid4())
        self.state: dict[str, Any] = {}
        self.attempts: list[dict[str, Any]] = []

    async def __aenter__(self) -> "RecoveryContext":
        """Enter recovery context."""
        if self.save_state:
            self.state["started_at"] = datetime.now(UTC)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        """Exit recovery context and log results."""
        if self.save_state:
            self.state["completed_at"] = datetime.now(UTC)
            self.state["success"] = exc_type is None

            if exc_type:
                self.state["error"] = str(exc_val)
                logger.error(
                    "Recovery context failed",
                    state_key=self.state_key,
                    attempts=len(self.attempts),
                    error=str(exc_val),
                )
            else:
                logger.info(
                    "Recovery context succeeded",
                    state_key=self.state_key,
                    attempts=len(self.attempts),
                )

    async def execute_with_fallback(
        self,
        primary: Callable[..., Awaitable[T]],
        fallback: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        Execute primary function with fallback on failure.

        Args:
            primary: Primary async function to execute
            fallback: Fallback async function if primary fails
            *args: Positional arguments for functions
            **kwargs: Keyword arguments for functions

        Returns:
            Result from primary or fallback function
        """
        attempt: dict[str, Any] = {"type": "primary", "function": primary.__name__}

        try:
            result: T = await primary(*args, **kwargs)
            attempt["success"] = True
            self.attempts.append(attempt)
            return result

        except Exception as e:
            attempt["success"] = False
            attempt["error"] = str(e)
            self.attempts.append(attempt)

            logger.warning(
                "Primary function failed, trying fallback",
                primary=primary.__name__,
                fallback=fallback.__name__,
                error=str(e),
            )

            fallback_attempt: dict[str, Any] = {"type": "fallback", "function": fallback.__name__}

            try:
                result = await fallback(*args, **kwargs)
                fallback_attempt["success"] = True
                self.attempts.append(fallback_attempt)
                return result

            except Exception as fallback_error:
                fallback_attempt["success"] = False
                fallback_attempt["error"] = str(fallback_error)
                self.attempts.append(fallback_attempt)
                raise


class IdempotencyManager:
    """
    Manager for ensuring idempotent billing operations.

    Prevents duplicate charges, refunds, and other critical operations.
    """

    def __init__(self, cache_ttl: int = 3600) -> None:
        self.cache_ttl = cache_ttl
        self._cache: dict[str, dict[str, Any]] = {}

    async def ensure_idempotent(
        self, key: str, func: Callable[..., Awaitable[T]], *args: Any, **kwargs: Any
    ) -> T:
        """
        Execute function only if not already processed.

        Args:
            key: Idempotency key
            func: Async function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Cached result if already processed, otherwise new result
        """
        if key in self._cache:
            logger.info(
                "Returning cached result for idempotent operation", key=key, function=func.__name__
            )
            cached_result: T = self._cache[key]["result"]
            return cached_result

        try:
            result: T = await func(*args, **kwargs)
            self._cache[key] = {"result": result, "timestamp": datetime.now(UTC)}
            return result

        except Exception as e:
            # Don't cache failures
            logger.error(
                "Idempotent operation failed", key=key, function=func.__name__, error=str(e)
            )
            raise

    def cleanup_expired(self) -> None:
        """Remove expired entries from cache."""
        now = datetime.now(UTC)
        expired_keys = [
            key
            for key, value in self._cache.items()
            if (now - value["timestamp"]).total_seconds() > self.cache_ttl
        ]

        for key in expired_keys:
            del self._cache[key]

        if expired_keys:
            logger.info("Cleaned up expired idempotency keys", count=len(expired_keys))
