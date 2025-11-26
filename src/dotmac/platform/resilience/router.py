"""
Resilience and Circuit Breaker API Routes

Provides endpoints to monitor and manage circuit breakers for external services.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from dotmac.platform.auth.rbac_dependencies import get_current_active_user
from dotmac.platform.resilience.circuit_breaker import CircuitState
from dotmac.platform.resilience.external_service_breakers import get_breaker_manager
from dotmac.platform.user_management.models import User

router = APIRouter(prefix="/api/v1/resilience", tags=["resilience"])


class CircuitBreakerState(BaseModel):
    """Circuit breaker state response model."""

    name: str
    state: str
    failure_count: int
    success_count: int
    failure_threshold: int
    recovery_timeout: float
    last_failure_time: float | None


class CircuitBreakerSummary(BaseModel):
    """Summary of all circuit breaker states."""

    total_breakers: int
    open_count: int
    half_open_count: int
    closed_count: int
    breakers: dict[str, CircuitBreakerState]


class ResetResponse(BaseModel):
    """Response for reset operations."""

    success: bool
    message: str
    service: str | None = None


@router.get(
    "/circuit-breakers",
    response_model=CircuitBreakerSummary,
    summary="Get all circuit breaker states",
    description="Returns the current state of all external service circuit breakers",
)
async def get_circuit_breakers(
    current_user: User = Depends(get_current_active_user),
) -> CircuitBreakerSummary:
    """
    Get states of all circuit breakers.

    Requires authentication. Returns detailed information about each
    circuit breaker including state, failure counts, and thresholds.
    """
    manager = get_breaker_manager()
    states = manager.get_all_states()

    # Count states
    open_count = sum(1 for s in states.values() if s["state"] == CircuitState.OPEN.value)
    half_open_count = sum(1 for s in states.values() if s["state"] == CircuitState.HALF_OPEN.value)
    closed_count = sum(1 for s in states.values() if s["state"] == CircuitState.CLOSED.value)

    # Convert to response model
    breakers = {service: CircuitBreakerState(**state) for service, state in states.items()}

    return CircuitBreakerSummary(
        total_breakers=len(states),
        open_count=open_count,
        half_open_count=half_open_count,
        closed_count=closed_count,
        breakers=breakers,
    )


@router.get(
    "/circuit-breakers/{service_name}",
    response_model=CircuitBreakerState,
    summary="Get specific circuit breaker state",
    description="Returns the state of a specific external service circuit breaker",
)
async def get_circuit_breaker(
    service_name: str,
    current_user: User = Depends(get_current_active_user),
) -> CircuitBreakerState:
    """
    Get state of a specific circuit breaker.

    Args:
        service_name: Name of the external service

    Returns:
        Current state of the circuit breaker

    Raises:
        404: If circuit breaker not found
    """
    manager = get_breaker_manager()
    states = manager.get_all_states()

    if service_name not in states:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit breaker for service '{service_name}' not found",
        )

    return CircuitBreakerState(**states[service_name])


@router.post(
    "/circuit-breakers/{service_name}/reset",
    response_model=ResetResponse,
    summary="Reset a circuit breaker",
    description="Manually reset a circuit breaker to closed state (admin only)",
)
async def reset_circuit_breaker(
    service_name: str,
    current_user: User = Depends(get_current_active_user),
) -> ResetResponse:
    """
    Manually reset a circuit breaker to closed state.

    This should be used with caution - only reset when you know
    the underlying service has been fixed.

    Args:
        service_name: Name of the external service

    Returns:
        Reset operation result

    Raises:
        404: If circuit breaker not found
    """
    # TODO: Add admin permission check
    # from dotmac.platform.auth.rbac_dependencies import require_permission
    # require_permission("system:circuit_breakers:reset")

    manager = get_breaker_manager()
    states = manager.get_all_states()

    if service_name not in states:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit breaker for service '{service_name}' not found",
        )

    manager.reset_breaker(service_name)

    return ResetResponse(
        success=True,
        message=f"Circuit breaker for '{service_name}' has been reset",
        service=service_name,
    )


@router.post(
    "/circuit-breakers/reset-all",
    response_model=ResetResponse,
    summary="Reset all circuit breakers",
    description="Manually reset all circuit breakers to closed state (admin only)",
)
async def reset_all_circuit_breakers(
    current_user: User = Depends(get_current_active_user),
) -> ResetResponse:
    """
    Manually reset all circuit breakers to closed state.

    This should be used with EXTREME caution - only reset when you know
    all underlying services have been fixed.

    Returns:
        Reset operation result
    """
    # TODO: Add admin permission check
    # from dotmac.platform.auth.rbac_dependencies import require_permission
    # require_permission("system:circuit_breakers:reset_all")

    manager = get_breaker_manager()
    manager.reset_all()

    return ResetResponse(
        success=True,
        message="All circuit breakers have been reset",
    )


@router.get(
    "/health-check",
    response_model=dict[str, Any],
    summary="Resilience health check",
    description="Check health of resilience system and external service connectivity",
)
async def resilience_health_check(
    current_user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    """
    Health check for resilience system.

    Returns overview of circuit breaker states and system health.
    """
    manager = get_breaker_manager()
    states = manager.get_all_states()

    open_breakers = [
        service for service, state in states.items() if state["state"] == CircuitState.OPEN.value
    ]

    half_open_breakers = [
        service
        for service, state in states.items()
        if state["state"] == CircuitState.HALF_OPEN.value
    ]

    # System is healthy if no breakers are open
    is_healthy = len(open_breakers) == 0

    return {
        "healthy": is_healthy,
        "total_breakers": len(states),
        "open_breakers": open_breakers,
        "half_open_breakers": half_open_breakers,
        "degraded_services": open_breakers + half_open_breakers,
        "status": "healthy" if is_healthy else "degraded",
    }
