"""
Circuit Breaker Pattern for Redis Operations.

Implements circuit breaker to prevent cascading failures when Redis is unavailable.

For simple retry logic, use tenacity directly:
    from tenacity import retry, stop_after_attempt, wait_exponential

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=10))
    async def resilient_function():
        # your code
        pass
"""

import asyncio
import time
from collections.abc import Callable
from enum import Enum
from typing import Any, TypeVar

import structlog
from redis.exceptions import RedisError

# Re-export tenacity for convenience
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)

T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, reject requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""

    pass


class CircuitBreaker:
    """
    Circuit breaker for Redis operations.

    Prevents cascading failures by temporarily blocking requests
    when Redis is unavailable.

    States:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Too many failures, reject all requests
    - HALF_OPEN: Testing if service recovered

    Transitions:
    - CLOSED -> OPEN: After failure_threshold failures
    - OPEN -> HALF_OPEN: After recovery_timeout seconds
    - HALF_OPEN -> CLOSED: After success_threshold successes
    - HALF_OPEN -> OPEN: After any failure
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ):
        """
        Initialize circuit breaker.

        Args:
            name: Circuit breaker name for logging
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying again
            success_threshold: Successes needed to close circuit from half-open
        """
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold

        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: float | None = None
        self._lock = asyncio.Lock()

    async def call(self, func: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        """
        Execute function with circuit breaker protection.

        Args:
            func: Async function to execute
            *args: Positional arguments for func
            **kwargs: Keyword arguments for func

        Returns:
            Result of func

        Raises:
            CircuitBreakerError: If circuit is open
        """
        async with self._lock:
            if self.state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    logger.info(
                        "circuit_breaker.half_open",
                        name=self.name,
                        recovery_timeout=self.recovery_timeout,
                    )
                    self.state = CircuitState.HALF_OPEN
                    self.success_count = 0
                else:
                    logger.warning(
                        "circuit_breaker.open",
                        name=self.name,
                        failure_count=self.failure_count,
                    )
                    raise CircuitBreakerError(
                        f"Circuit breaker '{self.name}' is open. Service unavailable."
                    )

        try:
            result = await func(*args, **kwargs)
            await self._on_success()
            return result

        except (RedisError, Exception):
            await self._on_failure()
            raise

    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt recovery."""
        if self.last_failure_time is None:
            return True
        return (time.time() - self.last_failure_time) >= self.recovery_timeout

    async def _on_success(self) -> None:
        """Handle successful operation."""
        async with self._lock:
            self.failure_count = 0

            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                logger.info(
                    "circuit_breaker.success",
                    name=self.name,
                    success_count=self.success_count,
                    success_threshold=self.success_threshold,
                )

                if self.success_count >= self.success_threshold:
                    logger.info(
                        "circuit_breaker.closed",
                        name=self.name,
                        message="Circuit recovered",
                    )
                    self.state = CircuitState.CLOSED
                    self.success_count = 0

    async def _on_failure(self) -> None:
        """Handle failed operation."""
        async with self._lock:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.state == CircuitState.HALF_OPEN:
                logger.warning(
                    "circuit_breaker.half_open_failed",
                    name=self.name,
                    message="Test request failed, reopening circuit",
                )
                self.state = CircuitState.OPEN
                self.success_count = 0

            elif self.state == CircuitState.CLOSED:
                if self.failure_count >= self.failure_threshold:
                    logger.error(
                        "circuit_breaker.opened",
                        name=self.name,
                        failure_count=self.failure_count,
                        failure_threshold=self.failure_threshold,
                    )
                    self.state = CircuitState.OPEN

    def reset(self) -> None:
        """Manually reset circuit breaker to closed state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time = None
        logger.info("circuit_breaker.reset", name=self.name)

    @property
    def is_open(self) -> bool:
        """Check if circuit is open."""
        return self.state == CircuitState.OPEN

    @property
    def is_closed(self) -> bool:
        """Check if circuit is closed."""
        return self.state == CircuitState.CLOSED

    def get_state(self) -> dict[str, Any]:
        """Get current circuit breaker state."""
        return {
            "name": self.name,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "success_count": self.success_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "last_failure_time": self.last_failure_time,
        }


# Global circuit breaker instances
_redis_pubsub_breaker = CircuitBreaker(
    name="redis_pubsub",
    failure_threshold=5,
    recovery_timeout=30.0,
    success_threshold=2,
)

_redis_operations_breaker = CircuitBreaker(
    name="redis_operations",
    failure_threshold=10,
    recovery_timeout=10.0,
    success_threshold=3,
)


def get_redis_pubsub_breaker() -> CircuitBreaker:
    """Get Redis pub/sub circuit breaker."""
    return _redis_pubsub_breaker


def get_redis_operations_breaker() -> CircuitBreaker:
    """Get Redis operations circuit breaker."""
    return _redis_operations_breaker


__all__ = [
    "retry",
    "stop_after_attempt",
    "wait_exponential",
    "retry_if_exception_type",
    "CircuitBreaker",
    "CircuitBreakerError",
    "CircuitState",
    "get_redis_pubsub_breaker",
    "get_redis_operations_breaker",
]
