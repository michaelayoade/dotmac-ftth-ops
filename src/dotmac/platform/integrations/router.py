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
integrations_router = APIRouter(prefix="/api/v1/integrations", )


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
            if not integration_obj:
                continue

            # Get health status
            try:
                health = await integration_obj.health_check()
            except Exception as e:
                logger.warning(f"Health check failed for {name}: {e}")
                health = IntegrationHealth(
                    name=name,
                    status=IntegrationStatus.ERROR,
                    message=f"Health check failed: {str(e)}",
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
        if not integration_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration '{integration_name}' not initialized",
            )

        # Get health status
        try:
            health = await integration_obj.health_check()
        except Exception as e:
            logger.warning(f"Health check failed for {integration_name}: {e}")
            health = IntegrationHealth(
                name=integration_name,
                status=IntegrationStatus.ERROR,
                message=f"Health check failed: {str(e)}",
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
