"""
Workflow Service Base Class

Provides shared patterns and utilities for all workflow services:
- Comprehensive error handling
- Transaction retry logic
- Circuit breaker pattern
- Request/response logging
- Performance metrics
- Input validation
- Monitoring infrastructure integration (AuditActivity, Prometheus)
"""

import asyncio
import functools
import logging
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from enum import Enum
from typing import Any, ParamSpec, TypeVar, cast

import structlog
from pydantic import BaseModel, ValidationError
from sqlalchemy.exc import (
    DBAPIError,
    IntegrityError,
    OperationalError,
)
from sqlalchemy.ext.asyncio import AsyncSession

# Import monitoring infrastructure
from dotmac.platform.audit.models import ActivitySeverity, ActivityType, AuditActivity
from dotmac.platform.monitoring.integrations import PrometheusIntegration

logger = logging.getLogger(__name__)
structured_logger = structlog.get_logger(__name__)

# Global Prometheus integration instance
prometheus = PrometheusIntegration()

# Type variable for generic function return types
P = ParamSpec("P")
T = TypeVar("T")


class CircuitState(str, Enum):
    """Circuit breaker states."""

    CLOSED = "closed"  # Normal operation
    OPEN = "open"  # Failing, rejecting requests
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerConfig(BaseModel):
    """Circuit breaker configuration."""

    failure_threshold: int = 5  # Open circuit after N failures
    success_threshold: int = 2  # Close circuit after N successes (in half-open)
    timeout: int = 60  # Seconds to wait before trying again
    half_open_max_calls: int = 3  # Max concurrent calls in half-open state


class RetryConfig(BaseModel):
    """Retry configuration for database operations."""

    max_attempts: int = 3
    initial_delay: float = 0.1  # seconds
    max_delay: float = 2.0  # seconds
    exponential_base: float = 2.0  # delay multiplier
    jitter: bool = True  # Add randomness to delay


class MetricsCollector:
    """Collects performance metrics for workflow operations."""

    def __init__(self) -> None:
        self._metrics: dict[str, dict[str, Any]] = {}

    def record_execution(
        self,
        operation: str,
        duration: float,
        success: bool,
        error: str | None = None,
    ) -> None:
        """Record an operation execution."""
        if operation not in self._metrics:
            self._metrics[operation] = {
                "total_calls": 0,
                "successful_calls": 0,
                "failed_calls": 0,
                "total_duration": 0.0,
                "min_duration": float("inf"),
                "max_duration": 0.0,
                "errors": {},
            }

        metrics = self._metrics[operation]
        metrics["total_calls"] += 1
        metrics["total_duration"] += duration
        metrics["min_duration"] = min(metrics["min_duration"], duration)
        metrics["max_duration"] = max(metrics["max_duration"], duration)

        if success:
            metrics["successful_calls"] += 1
        else:
            metrics["failed_calls"] += 1
            if error:
                metrics["errors"][error] = metrics["errors"].get(error, 0) + 1

    def get_metrics(self, operation: str | None = None) -> dict[str, Any]:
        """Get metrics for an operation or all operations."""
        if operation:
            if operation not in self._metrics:
                return {}

            metrics = self._metrics[operation].copy()
            if metrics["total_calls"] > 0:
                metrics["avg_duration"] = metrics["total_duration"] / metrics["total_calls"]
                metrics["success_rate"] = metrics["successful_calls"] / metrics["total_calls"] * 100
            return metrics

        # Return all metrics
        result = {}
        for op, _data in self._metrics.items():
            result[op] = self.get_metrics(op)
        return result

    def reset(self, operation: str | None = None) -> None:
        """Reset metrics for an operation or all operations."""
        if operation:
            self._metrics.pop(operation, None)
        else:
            self._metrics.clear()


class CircuitBreaker:
    """
    Circuit breaker implementation for external service calls.

    Prevents cascading failures by stopping calls to failing services
    and giving them time to recover.
    """

    def __init__(self, name: str, config: CircuitBreakerConfig | None = None) -> None:
        self.name = name
        self.config = config or CircuitBreakerConfig()
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.success_count = 0
        self.last_failure_time: datetime | None = None
        self.half_open_calls = 0

    def _should_attempt(self) -> bool:
        """Check if we should attempt a call based on circuit state."""
        if self.state == CircuitState.CLOSED:
            return True

        if self.state == CircuitState.OPEN:
            # Check if timeout has elapsed
            if (
                self.last_failure_time
                and (datetime.utcnow() - self.last_failure_time).total_seconds()
                >= self.config.timeout
            ):
                logger.info(f"Circuit breaker '{self.name}': Entering HALF_OPEN state")
                self.state = CircuitState.HALF_OPEN
                self.half_open_calls = 0
                return True
            return False

        if self.state == CircuitState.HALF_OPEN:
            # Allow limited calls in half-open state
            if self.half_open_calls < self.config.half_open_max_calls:
                self.half_open_calls += 1
                return True
            return False

        return False

    def record_success(self) -> None:
        """Record a successful call."""
        if self.state == CircuitState.HALF_OPEN:
            self.success_count += 1
            if self.success_count >= self.config.success_threshold:
                logger.info(f"Circuit breaker '{self.name}': Closing circuit (recovered)")
                self.state = CircuitState.CLOSED
                self.failure_count = 0
                self.success_count = 0
                self.half_open_calls = 0
        elif self.state == CircuitState.CLOSED:
            # Reset failure count on success
            self.failure_count = 0

    def record_failure(self) -> None:
        """Record a failed call."""
        self.last_failure_time = datetime.utcnow()

        if self.state == CircuitState.HALF_OPEN:
            # Immediately reopen on failure in half-open
            logger.warning(f"Circuit breaker '{self.name}': Reopening circuit (still failing)")
            self.state = CircuitState.OPEN
            self.success_count = 0
            self.half_open_calls = 0
        elif self.state == CircuitState.CLOSED:
            self.failure_count += 1
            if self.failure_count >= self.config.failure_threshold:
                logger.error(
                    f"Circuit breaker '{self.name}': Opening circuit "
                    f"(failure threshold reached: {self.failure_count})"
                )
                self.state = CircuitState.OPEN

    async def call(
        self,
        func: Callable[..., Awaitable[T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """
        Execute a function with circuit breaker protection.

        Args:
            func: Async function to call
            *args, **kwargs: Arguments to pass to function

        Returns:
            Function result

        Raises:
            RuntimeError: If circuit is open
            Exception: Original exception from function
        """
        if not self._should_attempt():
            raise RuntimeError(
                f"Circuit breaker '{self.name}' is {self.state.value}. "
                f"Service is currently unavailable."
            )

        try:
            result = await func(*args, **kwargs)
            self.record_success()
            return result
        except Exception:
            self.record_failure()
            raise


class WorkflowServiceBase:
    """
    Base class for all workflow services.

    Provides:
    - Database session management
    - Transaction retry logic
    - Error handling and logging
    - Performance metrics
    - Circuit breaker for external services
    - Request/response logging
    - Monitoring infrastructure integration (AuditActivity, Prometheus)
    """

    def __init__(
        self,
        db: AsyncSession,
        service_name: str | None = None,
        retry_config: RetryConfig | None = None,
        tenant_id: str | None = None,
        user_id: str | None = None,
    ) -> None:
        """
        Initialize workflow service.

        Args:
            db: Database session
            service_name: Service name for logging (defaults to class name)
            retry_config: Retry configuration (uses defaults if not provided)
            tenant_id: Tenant ID for audit logging
            user_id: User ID for audit logging
        """
        self.db = db
        self.service_name = service_name or self.__class__.__name__
        self.retry_config = retry_config or RetryConfig()
        self.metrics = MetricsCollector()
        self._circuit_breakers: dict[str, CircuitBreaker] = {}
        self.tenant_id = tenant_id
        self.user_id = user_id

        logger.info(f"Initialized {self.service_name}")

    async def _create_audit_log(
        self,
        action: str,
        activity_type: ActivityType = ActivityType.API_REQUEST,
        severity: ActivitySeverity = ActivitySeverity.LOW,
        resource_type: str | None = None,
        resource_id: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        """
        Create an audit log entry in the database.

        Integrates with existing AuditActivity model for centralized logging.

        Args:
            action: Action description (e.g., "notify_team", "issue_license")
            activity_type: Type from ActivityType enum
            severity: Severity level from ActivitySeverity enum
            resource_type: Type of resource affected (optional)
            resource_id: ID of resource affected (optional)
            details: Additional details dictionary (optional)
        """
        try:
            if not self.tenant_id:
                # Skip audit logging if no tenant context
                return

            audit_log = AuditActivity(
                activity_type=activity_type,
                severity=severity,
                user_id=self.user_id,
                tenant_id=self.tenant_id,
                resource_type=resource_type or self.service_name,
                resource_id=resource_id,
                action=f"{self.service_name}.{action}",
                details=details or {},
                timestamp=datetime.now(UTC),
            )

            self.db.add(audit_log)
            await self.db.flush()

            structured_logger.debug(
                "Audit log created",
                service=self.service_name,
                action=action,
                tenant_id=self.tenant_id,
            )

        except Exception as e:
            # Don't fail the operation if audit logging fails
            logger.warning(
                f"Failed to create audit log for {action}: {e}",
                exc_info=False,
            )

    def _record_prometheus_metric(
        self,
        metric_name: str,
        value: float,
        labels: dict[str, str] | None = None,
    ) -> None:
        """
        Record a metric to Prometheus.

        Integrates with existing PrometheusIntegration for metrics export.

        Args:
            metric_name: Name of the metric
            value: Metric value
            labels: Optional labels dictionary
        """
        try:
            # Add service and tenant labels
            metric_labels = {
                "service": self.service_name,
                "tenant_id": self.tenant_id or "unknown",
            }
            if labels:
                metric_labels.update(labels)

            prometheus.record_metric(
                name=f"workflow_{metric_name}",
                value=value,
                labels=metric_labels,
            )

        except Exception as e:
            # Don't fail the operation if metrics recording fails
            logger.warning(
                f"Failed to record Prometheus metric {metric_name}: {e}",
                exc_info=False,
            )

    def get_circuit_breaker(
        self, name: str, config: CircuitBreakerConfig | None = None
    ) -> CircuitBreaker:
        """
        Get or create a circuit breaker for an external service.

        Args:
            name: Circuit breaker name (e.g., "netbox", "genieacs")
            config: Optional circuit breaker configuration

        Returns:
            CircuitBreaker instance
        """
        if name not in self._circuit_breakers:
            self._circuit_breakers[name] = CircuitBreaker(name, config)
        return self._circuit_breakers[name]

    def validate_input(self, schema: type[BaseModel], data: dict[str, Any]) -> BaseModel:
        """
        Validate input data against a Pydantic schema.

        Args:
            schema: Pydantic model class
            data: Input data to validate

        Returns:
            Validated Pydantic model instance

        Raises:
            ValueError: If validation fails
        """
        try:
            return schema(**data)
        except ValidationError as e:
            error_details = []
            for error in e.errors():
                field = " -> ".join(str(loc) for loc in error["loc"])
                error_details.append(f"{field}: {error['msg']}")

            raise ValueError(
                f"Input validation failed for {schema.__name__}:\n"
                + "\n".join(f"  - {detail}" for detail in error_details)
            ) from e

    async def with_retry(
        self,
        operation: Callable[..., Awaitable[T]],
        *args: Any,
        operation_name: str | None = None,
        **kwargs: Any,
    ) -> T:
        """
        Execute a database operation with automatic retry on transient failures.

        Args:
            operation: Async function to execute
            *args, **kwargs: Arguments to pass to operation
            operation_name: Name for logging (defaults to function name)

        Returns:
            Operation result

        Raises:
            Exception: If all retry attempts fail
        """
        op_name = operation_name or operation.__name__
        last_exception: Exception | None = None

        for attempt in range(1, self.retry_config.max_attempts + 1):
            try:
                logger.debug(
                    f"{self.service_name}.{op_name}: Attempt {attempt}/"
                    f"{self.retry_config.max_attempts}"
                )

                result = await operation(*args, **kwargs)

                if attempt > 1:
                    logger.info(f"{self.service_name}.{op_name}: Succeeded on attempt {attempt}")

                return result

            except (OperationalError, DBAPIError) as e:
                last_exception = e

                if attempt == self.retry_config.max_attempts:
                    logger.error(
                        f"{self.service_name}.{op_name}: All retry attempts failed",
                        exc_info=True,
                    )
                    break

                # Calculate delay with exponential backoff
                delay = min(
                    self.retry_config.initial_delay
                    * (self.retry_config.exponential_base ** (attempt - 1)),
                    self.retry_config.max_delay,
                )

                # Add jitter to prevent thundering herd
                if self.retry_config.jitter:
                    import random

                    delay *= random.uniform(0.5, 1.5)

                logger.warning(
                    f"{self.service_name}.{op_name}: Attempt {attempt} failed. "
                    f"Retrying in {delay:.2f}s... Error: {str(e)}"
                )

                # Rollback failed transaction
                await self.db.rollback()

                # Wait before retry
                await asyncio.sleep(delay)

            except IntegrityError as e:
                # Don't retry integrity errors (unique constraints, etc.)
                logger.error(
                    f"{self.service_name}.{op_name}: Integrity error (not retrying): {e}",
                    exc_info=True,
                )
                raise

            except Exception as e:
                # Don't retry unexpected errors
                logger.error(
                    f"{self.service_name}.{op_name}: Unexpected error (not retrying): {e}",
                    exc_info=True,
                )
                raise

        # All retries exhausted
        raise RuntimeError(
            f"{self.service_name}.{op_name}: Operation failed after "
            f"{self.retry_config.max_attempts} attempts"
        ) from last_exception

    @asynccontextmanager
    async def transaction(self, operation_name: str = "transaction") -> AsyncIterator[AsyncSession]:
        """
        Context manager for database transactions with automatic rollback on error.

        Usage:
            async with self.transaction("create_customer"):
                # Database operations
                customer = Customer(...)
                self.db.add(customer)
                await self.db.flush()

        Args:
            operation_name: Name for logging

        Yields:
            Database session
        """
        try:
            logger.debug(f"{self.service_name}.{operation_name}: Starting transaction")
            yield self.db

            logger.debug(f"{self.service_name}.{operation_name}: Committing transaction")
            await self.db.commit()

            logger.debug(f"{self.service_name}.{operation_name}: Transaction committed")

        except Exception as e:
            logger.error(
                f"{self.service_name}.{operation_name}: Rolling back transaction due to error: {e}",
                exc_info=True,
            )
            await self.db.rollback()
            raise

    def log_request(self, method: str, params: dict[str, Any]) -> None:
        """
        Log workflow method request.

        Args:
            method: Method name
            params: Method parameters
        """
        # Sanitize sensitive data
        sanitized_params = self._sanitize_params(params)

        logger.info(
            f"{self.service_name}.{method}: Request",
            extra={
                "service": self.service_name,
                "method": method,
                "params": sanitized_params,
            },
        )

    async def log_response(
        self,
        method: str,
        result: Any,
        duration: float,
        success: bool = True,
        error: str | None = None,
        resource_id: str | None = None,
    ) -> None:
        """
        Log workflow method response and record metrics.

        Integrates with:
        - Local MetricsCollector
        - Prometheus metrics
        - AuditActivity logs

        Args:
            method: Method name
            result: Method result
            duration: Execution duration in seconds
            success: Whether operation succeeded
            error: Error message if failed
            resource_id: Optional resource ID for audit logging
        """
        # Record local metrics
        self.metrics.record_execution(method, duration, success, error)

        # Record Prometheus metrics
        self._record_prometheus_metric(
            metric_name="operation_duration_seconds",
            value=duration,
            labels={"operation": method, "status": "success" if success else "error"},
        )
        self._record_prometheus_metric(
            metric_name="operation_total",
            value=1,
            labels={"operation": method, "status": "success" if success else "error"},
        )

        # Create audit log
        severity = ActivitySeverity.LOW if success else ActivitySeverity.HIGH
        details: dict[str, Any] = {
            "duration_seconds": duration,
            "success": success,
        }
        if error:
            details["error"] = error
        if result and isinstance(result, dict):
            # Include result summary in audit log
            details["result_summary"] = {
                k: v
                for k, v in result.items()
                if k in ["status", "notifications_sent", "license_key", "order_id"]
            }

        await self._create_audit_log(
            action=method,
            activity_type=ActivityType.API_REQUEST,
            severity=severity,
            resource_id=resource_id,
            details=details,
        )

        # Standard logging
        if success:
            structured_logger.info(
                f"{self.service_name}.{method}: Success",
                service=self.service_name,
                method=method,
                duration=duration,
                success=True,
                tenant_id=self.tenant_id,
            )
        else:
            structured_logger.error(
                f"{self.service_name}.{method}: Failed",
                service=self.service_name,
                method=method,
                duration=duration,
                success=False,
                error=error,
                tenant_id=self.tenant_id,
            )

    def _sanitize_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Remove sensitive data from parameters for logging.

        Args:
            params: Original parameters

        Returns:
            Sanitized parameters
        """
        sensitive_keys = {
            "password",
            "password_hash",
            "secret",
            "api_key",
            "token",
            "credit_card",
            "ssn",
            "tax_id",
        }

        sanitized: dict[str, Any] = {}
        for key, value in params.items():
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                sanitized[key] = "***REDACTED***"
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_params(value)
            else:
                sanitized[key] = value

        return sanitized

    @classmethod
    def operation(
        cls: type["WorkflowServiceBase"],
        method_name: str | None = None,
    ) -> Callable[[Callable[P, Awaitable[T]]], Callable[P, Awaitable[T]]]:
        """
        Decorator for workflow operations.

        Provides:
        - Request/response logging
        - Performance metrics
        - Error handling
        - Automatic retries for database operations
        - Monitoring integration (AuditActivity, Prometheus)

        Usage:
            @operation()
            async def create_customer(self, customer_data: dict):
                # Implementation
                pass
        """

        def decorator(func: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
            op_name = method_name or func.__name__

            @functools.wraps(func)
            async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
                if not args:
                    raise RuntimeError("Operation decorator requires instance method invocation")
                service = cast("WorkflowServiceBase", args[0])

                # Extract parameters for logging
                params: dict[str, Any] = {}
                if len(args) > 1:
                    params["args"] = args[1:]
                if kwargs:
                    params["kwargs"] = kwargs

                # Log request
                service.log_request(op_name, params)

                # Track execution time
                start_time = time.time()

                try:
                    # Execute operation
                    result = await func(*args, **kwargs)

                    # Calculate duration
                    duration = time.time() - start_time

                    # Extract resource_id from result if available
                    resource_id = None
                    if isinstance(result, dict):
                        resource_id = (
                            result.get("license_id")
                            or result.get("notification_id")
                            or result.get("order_id")
                        )

                    # Log success (with monitoring integration)
                    await service.log_response(
                        op_name, result, duration, success=True, resource_id=resource_id
                    )

                    return result

                except Exception as e:
                    # Calculate duration
                    duration = time.time() - start_time

                    # Log failure (with monitoring integration)
                    error_msg = f"{type(e).__name__}: {str(e)}"
                    await service.log_response(
                        op_name, None, duration, success=False, error=error_msg
                    )

                    raise

            return cast(Callable[..., Awaitable[T]], wrapper)

        return decorator

    def get_metrics(self) -> dict[str, Any]:
        """
        Get performance metrics for this service.

        Returns:
            Metrics dictionary with operation statistics
        """
        return {
            "service": self.service_name,
            "operations": self.metrics.get_metrics(),
            "circuit_breakers": {
                name: {
                    "state": cb.state.value,
                    "failure_count": cb.failure_count,
                    "success_count": cb.success_count,
                }
                for name, cb in self._circuit_breakers.items()
            },
        }
