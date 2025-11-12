"""
External Service Circuit Breakers

Provides circuit breaker protection for all external service integrations
to prevent cascading failures and improve system resilience.
"""

from typing import Any

import structlog

from dotmac.platform.monitoring.error_tracking import track_external_api_error
from dotmac.platform.resilience.circuit_breaker import CircuitBreaker, CircuitBreakerError

logger = structlog.get_logger(__name__)


class ExternalServiceBreakerManager:
    """
    Manages circuit breakers for external services.

    Automatically creates and manages circuit breakers for different
    external services, tracking failures and preventing cascading issues.
    """

    def __init__(self):
        """Initialize the circuit breaker manager."""
        self._breakers: dict[str, CircuitBreaker] = {}

        # Pre-configure breakers for known external services
        self._configure_default_breakers()

    def _configure_default_breakers(self) -> None:
        """Configure circuit breakers for known external services."""

        # Payment processors
        self.register_breaker(
            "stripe",
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2,
        )

        # Communications
        self.register_breaker(
            "twilio",
            failure_threshold=3,
            recovery_timeout=30.0,
            success_threshold=2,
        )

        # IPAM/NetBox
        self.register_breaker(
            "netbox",
            failure_threshold=5,
            recovery_timeout=30.0,
            success_threshold=2,
        )

        # GenieACS (TR-069)
        self.register_breaker(
            "genieacs",
            failure_threshold=5,
            recovery_timeout=45.0,
            success_threshold=2,
        )

        # Email services
        self.register_breaker(
            "smtp",
            failure_threshold=5,
            recovery_timeout=60.0,
            success_threshold=2,
        )

        # Billing services (KillBill)
        self.register_breaker(
            "killbill",
            failure_threshold=5,
            recovery_timeout=30.0,
            success_threshold=2,
        )

        # Storage services (MinIO)
        self.register_breaker(
            "minio",
            failure_threshold=10,
            recovery_timeout=20.0,
            success_threshold=3,
        )

        logger.info(
            "external_service_breakers.configured",
            breaker_count=len(self._breakers),
            services=list(self._breakers.keys()),
        )

    def register_breaker(
        self,
        service_name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        success_threshold: int = 2,
    ) -> CircuitBreaker:
        """
        Register a circuit breaker for a service.

        Args:
            service_name: Name of the external service
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before trying again
            success_threshold: Successes needed to close circuit

        Returns:
            Configured CircuitBreaker instance
        """
        if service_name not in self._breakers:
            self._breakers[service_name] = CircuitBreaker(
                name=f"external_{service_name}",
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
                success_threshold=success_threshold,
            )
            logger.info(
                "external_service_breaker.registered",
                service=service_name,
                failure_threshold=failure_threshold,
                recovery_timeout=recovery_timeout,
            )

        return self._breakers[service_name]

    def get_breaker(self, service_name: str) -> CircuitBreaker:
        """
        Get circuit breaker for a service.

        Args:
            service_name: Name of the external service

        Returns:
            CircuitBreaker instance (creates if doesn't exist)
        """
        if service_name not in self._breakers:
            logger.warning(
                "external_service_breaker.auto_created",
                service=service_name,
                message="Breaker not pre-configured, using defaults",
            )
            return self.register_breaker(service_name)

        return self._breakers[service_name]

    async def call_service(
        self,
        service_name: str,
        func: Any,
        *args: Any,
        tenant_id: str = "unknown",
        **kwargs: Any,
    ) -> Any:
        """
        Call external service with circuit breaker protection.

        Args:
            service_name: Name of the external service
            func: Async function to call
            *args: Positional arguments for func
            tenant_id: Tenant ID for tracking
            **kwargs: Keyword arguments for func

        Returns:
            Result from func

        Raises:
            CircuitBreakerError: If circuit is open
            Exception: Original exception from func
        """
        breaker = self.get_breaker(service_name)

        try:
            result = await breaker.call(func, *args, **kwargs)
            return result

        except CircuitBreakerError as e:
            # Circuit is open, track the rejection
            logger.warning(
                "external_service.circuit_open",
                service=service_name,
                tenant_id=tenant_id,
                state=breaker.get_state(),
            )
            track_external_api_error(
                service=service_name,
                error=e,
                tenant_id=tenant_id,
            )
            raise

        except Exception as e:
            # Service call failed, track the error
            logger.error(
                "external_service.call_failed",
                service=service_name,
                tenant_id=tenant_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            track_external_api_error(
                service=service_name,
                error=e,
                tenant_id=tenant_id,
            )
            raise

    def get_all_states(self) -> dict[str, dict[str, Any]]:
        """
        Get states of all circuit breakers.

        Returns:
            Dictionary mapping service names to their states
        """
        return {service: breaker.get_state() for service, breaker in self._breakers.items()}

    def reset_breaker(self, service_name: str) -> None:
        """
        Manually reset a circuit breaker.

        Args:
            service_name: Name of the service to reset
        """
        if service_name in self._breakers:
            self._breakers[service_name].reset()
            logger.info("external_service_breaker.reset", service=service_name)
        else:
            logger.warning(
                "external_service_breaker.reset_failed",
                service=service_name,
                reason="not_found",
            )

    def reset_all(self) -> None:
        """Reset all circuit breakers."""
        for _service, breaker in self._breakers.items():
            breaker.reset()
        logger.info(
            "external_service_breakers.reset_all",
            breaker_count=len(self._breakers),
        )


# Global singleton instance
_breaker_manager: ExternalServiceBreakerManager | None = None


def get_breaker_manager() -> ExternalServiceBreakerManager:
    """
    Get the global circuit breaker manager instance.

    Returns:
        ExternalServiceBreakerManager singleton
    """
    global _breaker_manager
    if _breaker_manager is None:
        _breaker_manager = ExternalServiceBreakerManager()
    return _breaker_manager


async def call_external_service(
    service_name: str,
    func: Any,
    *args: Any,
    tenant_id: str = "unknown",
    **kwargs: Any,
) -> Any:
    """
    Convenience function to call external service with circuit breaker.

    Args:
        service_name: Name of the external service
        func: Async function to call
        *args: Positional arguments for func
        tenant_id: Tenant ID for tracking
        **kwargs: Keyword arguments for func

    Returns:
        Result from func

    Raises:
        CircuitBreakerError: If circuit is open
        Exception: Original exception from func

    Example:
        ```python
        from dotmac.platform.resilience.external_service_breakers import call_external_service

        async def send_email(to: str, subject: str, body: str):
            # actual email sending logic
            pass

        result = await call_external_service(
            "smtp",
            send_email,
            "user@example.com",
            "Hello",
            "Email body",
            tenant_id="tenant_123",
        )
        ```
    """
    manager = get_breaker_manager()
    return await manager.call_service(service_name, func, *args, tenant_id=tenant_id, **kwargs)


__all__ = [
    "ExternalServiceBreakerManager",
    "get_breaker_manager",
    "call_external_service",
    "CircuitBreakerError",  # Re-export for convenience
]
