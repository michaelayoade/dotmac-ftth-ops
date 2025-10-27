"""Integrations API router."""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from dotmac.platform.auth.core import UserInfo, get_current_user

from . import (
    IntegrationHealth,
    IntegrationStatus,
    IntegrationType,
    get_integration_registry,
)
from .models import IntegrationListResponse, IntegrationResponse

logger = structlog.get_logger(__name__)
integrations_router = APIRouter(
    prefix="/integrations",
)


def _health_check_failure_message(exc: Exception | None = None) -> str:
    """Return a sanitized health-check failure message."""
    if exc:
        return f"Health check failed ({exc.__class__.__name__}). See server logs for details."
    return "Health check failed. See server logs for details."


@integrations_router.get("", response_model=IntegrationListResponse)
async def list_integrations(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> IntegrationListResponse:
    """
    List all registered integrations.

    Returns integration configurations, status, and metadata.
    """
    try:
        registry = await get_integration_registry()

        integrations = []
        for name, config in registry._configs.items():
            integration_obj = registry.get_integration(name)
            if integration_obj:
                # Get health status
                try:
                    health = await integration_obj.health_check()
                except Exception as exc:
                    logger.warning(
                        "Health check failed for integration",
                        integration=name,
                        error=str(exc),
                        exc_info=True,
                    )
                    health = IntegrationHealth(
                        name=name,
                        status=IntegrationStatus.ERROR,
                        message=_health_check_failure_message(exc),
                    )
            else:
                error_message = registry.get_integration_error(name) or (
                    "Integration not initialized. See server logs for details."
                )
                health = IntegrationHealth(
                    name=name,
                    status=IntegrationStatus.ERROR,
                    message=error_message,
                )

            integrations.append(
                IntegrationResponse(
                    name=config.name,
                    type=(
                        config.type.value
                        if isinstance(config.type, IntegrationType)
                        else config.type
                    ),
                    provider=config.provider,
                    enabled=config.enabled,
                    status=(
                        health.status.value
                        if isinstance(health.status, IntegrationStatus)
                        else health.status
                    ),
                    message=health.message,
                    last_check=health.last_check,
                    settings_count=len(config.settings),
                    has_secrets=config.secrets_path is not None,
                    required_packages=config.required_packages or [],
                    metadata=health.metadata,
                )
            )

        return IntegrationListResponse(
            integrations=integrations,
            total=len(integrations),
        )

    except Exception as e:
        logger.error(f"Error listing integrations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list integrations",
        )


@integrations_router.get("/{integration_name}", response_model=IntegrationResponse)
async def get_integration_details(
    integration_name: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> IntegrationResponse:
    """
    Get details of a specific integration.

    Returns configuration, health status, and metadata.
    """
    try:
        registry = await get_integration_registry()

        config = registry._configs.get(integration_name)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{integration_name}' not found",
            )

        integration_obj = registry.get_integration(integration_name)
        if integration_obj:
            # Get health status
            try:
                health = await integration_obj.health_check()
            except Exception as exc:
                logger.warning(
                    "Health check failed for integration",
                    integration=integration_name,
                    error=str(exc),
                    exc_info=True,
                )
                health = IntegrationHealth(
                    name=integration_name,
                    status=IntegrationStatus.ERROR,
                    message=_health_check_failure_message(exc),
                )
        else:
            health = IntegrationHealth(
                name=integration_name,
                status=IntegrationStatus.ERROR,
                message=registry.get_integration_error(integration_name)
                or "Integration not initialized. See server logs for details.",
            )

        return IntegrationResponse(
            name=config.name,
            type=config.type.value if isinstance(config.type, IntegrationType) else config.type,
            provider=config.provider,
            enabled=config.enabled,
            status=(
                health.status.value
                if isinstance(health.status, IntegrationStatus)
                else health.status
            ),
            message=health.message,
            last_check=health.last_check,
            settings_count=len(config.settings),
            has_secrets=config.secrets_path is not None,
            required_packages=config.required_packages or [],
            metadata=health.metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting integration details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get integration details",
        )


@integrations_router.post("/{integration_name}/health-check", response_model=IntegrationResponse)
async def check_integration_health(
    integration_name: str,
    current_user: Annotated[UserInfo, Depends(get_current_user)],
) -> IntegrationResponse:
    """
    Manually trigger a health check for an integration.

    Returns updated health status.
    """
    try:
        registry = await get_integration_registry()

        config = registry._configs.get(integration_name)
        if not config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{integration_name}' not found",
            )

        integration_obj = registry.get_integration(integration_name)
        if not integration_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{integration_name}' not initialized",
            )

        # Perform health check
        health = await integration_obj.health_check()

        return IntegrationResponse(
            name=config.name,
            type=config.type.value if isinstance(config.type, IntegrationType) else config.type,
            provider=config.provider,
            enabled=config.enabled,
            status=(
                health.status.value
                if isinstance(health.status, IntegrationStatus)
                else health.status
            ),
            message=health.message,
            last_check=health.last_check,
            settings_count=len(config.settings),
            has_secrets=config.secrets_path is not None,
            required_packages=config.required_packages or [],
            metadata=health.metadata,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking integration health: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check integration health",
        )


__all__ = ["integrations_router"]
