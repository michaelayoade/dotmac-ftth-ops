"""
Plugin management API endpoints.

This module provides REST API endpoints for managing plugins,
their configurations, and testing connections.
"""

from datetime import UTC
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict

from ..auth.core import UserInfo
from ..auth.dependencies import get_current_user
from .registry import PluginRegistry, get_plugin_registry
from .schema import (
    PluginConfig,
    PluginConfigurationResponse,
    PluginHealthCheck,
    PluginInstance,
    PluginListResponse,
    PluginSchemaResponse,
    PluginTestResult,
)

router = APIRouter(
    tags=["Plugin Management"],
    dependencies=[Depends(get_current_user)],  # Proper auth enabled
)


# Request/Response Models


class CreatePluginInstanceRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to create a plugin instance."""

    model_config = ConfigDict()

    plugin_name: str
    instance_name: str
    configuration: dict[str, Any] = {}


class UpdatePluginConfigurationRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to update plugin configuration."""

    model_config = ConfigDict()

    configuration: dict[str, Any]


class TestConnectionRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to test plugin connection."""

    model_config = ConfigDict()

    configuration: dict[str, Any] | None = None


# Dependencies


async def get_registry() -> PluginRegistry:
    """Get the plugin registry."""
    registry = get_plugin_registry()
    # Ensure it's initialized
    if not hasattr(registry, "_plugins"):
        await registry.initialize()
    return registry


# Endpoints


@router.get("/", response_model=list[PluginConfig])
async def list_available_plugins(
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> list[PluginConfig]:
    """
    List all available plugins with their configuration schemas.

    Returns the configuration schema for each registered plugin,
    allowing the UI to understand what fields need to be configured.
    """
    return registry.list_available_plugins()


@router.get("/instances", response_model=PluginListResponse)
async def list_plugin_instances(
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginListResponse:
    """
    List all configured plugin instances.

    Returns all plugin instances that have been created,
    along with their current status and configuration metadata.
    """
    instances = registry.list_plugin_instances()
    return PluginListResponse(plugins=instances, total=len(instances))


@router.get("/{plugin_name}/schema", response_model=PluginSchemaResponse)
async def get_plugin_schema(
    plugin_name: str,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginSchemaResponse:
    """
    Get the configuration schema for a specific plugin.

    Returns the detailed field specifications that the UI
    can use to render appropriate form controls.
    """
    schema = registry.get_plugin_schema(plugin_name)
    if not schema:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Plugin '{plugin_name}' not found"
        )

    return PluginSchemaResponse(schema=schema, instance_id=None)


@router.post("/instances", response_model=PluginInstance, status_code=status.HTTP_201_CREATED)
async def create_plugin_instance(
    request: CreatePluginInstanceRequest,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginInstance:
    """
    Create a new plugin instance with configuration.

    Creates a configured instance of a plugin. The configuration
    is validated against the plugin's schema and secrets are
    automatically stored in Vault.
    """
    try:
        instance = await registry.create_plugin_instance(
            plugin_name=request.plugin_name,
            instance_name=request.instance_name,
            configuration=request.configuration,
        )
        return instance
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/instances/{instance_id}", response_model=PluginInstance)
async def get_plugin_instance(
    instance_id: UUID,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginInstance:
    """
    Get details of a specific plugin instance.

    Returns the plugin instance metadata and current status,
    but not the sensitive configuration values.
    """
    instance = await registry.get_plugin_instance(instance_id)
    if not instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plugin instance '{instance_id}' not found",
        )
    return instance


@router.get("/instances/{instance_id}/configuration", response_model=PluginConfigurationResponse)
async def get_plugin_configuration(
    instance_id: UUID,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginConfigurationResponse:
    """
    Get plugin configuration with secrets masked.

    Returns the plugin configuration suitable for display in the UI,
    with secret fields masked but showing whether they have values.
    """
    try:
        instance = await registry.get_plugin_instance(instance_id)
        if not instance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Plugin instance '{instance_id}' not found",
            )

        configuration = await registry.get_plugin_configuration(instance_id)

        return PluginConfigurationResponse(
            plugin_instance_id=instance_id,
            configuration=configuration,
            schema=instance.config_schema,
            status=instance.status,
            last_updated=instance.last_health_check,  # Proxy for last updated
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/instances/{instance_id}/configuration", response_model=dict)
async def update_plugin_configuration(
    instance_id: UUID,
    request: UpdatePluginConfigurationRequest,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Update plugin configuration.

    Updates the plugin configuration and automatically
    reconfigures the plugin provider. Secrets are stored
    securely in Vault.
    """
    try:
        await registry.update_plugin_configuration(
            instance_id=instance_id,
            configuration=request.configuration,
        )
        return {"message": "Configuration updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plugin_instance(
    instance_id: UUID,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> None:
    """
    Delete a plugin instance and its configuration.

    Removes the plugin instance and cleans up all associated
    configuration data, including secrets stored in Vault.
    """
    try:
        await registry.delete_plugin_instance(instance_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/instances/{instance_id}/health", response_model=PluginHealthCheck)
async def check_plugin_health(
    instance_id: UUID,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginHealthCheck:
    """
    Perform health check on a plugin instance.

    Executes the plugin's health check method and returns
    the current health status and any diagnostic information.
    """
    try:
        return await registry.health_check_plugin(instance_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/instances/{instance_id}/test", response_model=PluginTestResult)
async def test_plugin_connection(
    instance_id: UUID,
    request: TestConnectionRequest,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> PluginTestResult:
    """
    Test plugin connection.

    Tests the plugin connection using either the provided
    configuration or the stored configuration. This allows
    testing new configurations before saving them.
    """
    try:
        return await registry.test_plugin_connection(
            instance_id=instance_id,
            test_config=request.configuration,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# Bulk operations


@router.post("/instances/health-check", response_model=list[PluginHealthCheck])
async def bulk_health_check(
    instance_ids: list[UUID] | None = None,
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> list[PluginHealthCheck]:
    """
    Perform health checks on multiple plugin instances.

    If instance_ids is not provided, checks all active instances.
    Useful for dashboard health monitoring.
    """
    if instance_ids is None:
        instances = registry.list_plugin_instances()
        instance_ids = [instance.id for instance in instances]

    results = []
    for instance_id in instance_ids:
        try:
            health_check = await registry.health_check_plugin(instance_id)
            results.append(health_check)
        except Exception as e:
            from datetime import datetime

            # Create error health check result
            results.append(
                PluginHealthCheck(
                    plugin_instance_id=instance_id,
                    status="error",
                    message=f"Health check failed: {str(e)}",
                    details={"error": str(e)},
                    timestamp=datetime.now(UTC).isoformat(),
                    response_time_ms=0,
                )
            )

    return results


# Plugin discovery and management


@router.post("/refresh", response_model=dict)
async def refresh_plugins(
    registry: PluginRegistry = Depends(get_registry),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Refresh plugin discovery.

    Re-scans plugin directories and loads any new plugins
    that have been added since startup.
    """
    try:
        await registry._discover_plugins()  # Re-run discovery
        available_plugins = registry.list_available_plugins()
        return {
            "message": "Plugin discovery refreshed",
            "available_plugins": len(available_plugins),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to refresh plugins: {str(e)}",
        )
