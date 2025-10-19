"""
Platform Configuration Router.

Exposes public platform configuration for frontend consumption.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from ..settings import Settings, get_settings

router = APIRouter(prefix="/platform")

# Separate router for endpoints without /platform prefix
health_router = APIRouter(prefix="/api/v1", )


@router.get("/config")
async def get_platform_config(
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict[str, Any]:
    """
    Get public platform configuration.

    Returns sanitized configuration for frontend consumption including:
    - Feature flags
    - API endpoints
    - Application metadata
    - Branding configuration

    Note: Sensitive settings (secrets, passwords) are NOT included.
    """
    return {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment.value,
        },
        "features": {
            # Core features
            "mfa_enabled": settings.features.mfa_enabled,
            "audit_logging": settings.features.audit_logging,
            # Communications
            "email_enabled": settings.features.email_enabled,
            "communications_enabled": settings.features.communications_enabled,
            "sms_enabled": settings.features.sms_enabled,
            # Storage
            "storage_enabled": settings.features.storage_enabled,
            # Search
            "search_enabled": settings.features.search_enabled,
            # Data handling
            "data_transfer_enabled": settings.features.data_transfer_enabled,
            "data_transfer_excel": settings.features.data_transfer_excel,
            "data_transfer_compression": settings.features.data_transfer_compression,
            "data_transfer_streaming": settings.features.data_transfer_streaming,
            # File processing
            "file_processing_enabled": settings.features.file_processing_enabled,
            "file_processing_pdf": settings.features.file_processing_pdf,
            "file_processing_images": settings.features.file_processing_images,
            "file_processing_office": settings.features.file_processing_office,
            # Background tasks
            "celery_enabled": settings.features.celery_enabled,
            # OSS/BSS Domain Features
            "graphql_enabled": settings.features.graphql_enabled,
            "analytics_enabled": settings.features.analytics_enabled,
            "banking_enabled": settings.features.banking_enabled,
            "payments_enabled": settings.features.payments_enabled,
            "radius_enabled": settings.features.radius_enabled,
            "network_enabled": settings.features.network_enabled,
            "automation_enabled": settings.features.automation_enabled,
            "wireless_enabled": settings.features.wireless_enabled,
            "fiber_enabled": settings.features.fiber_enabled,
            "orchestration_enabled": settings.features.orchestration_enabled,
            "dunning_enabled": settings.features.dunning_enabled,
            "ticketing_enabled": settings.features.ticketing_enabled,
            "crm_enabled": settings.features.crm_enabled,
            "notification_enabled": settings.features.notification_enabled,
        },
        "api": {
            "rest_url": "/api/v1",
            "graphql_url": "/api/v1/graphql",
            "realtime_sse_url": "/api/v1/realtime",
            "realtime_ws_url": "/api/v1/realtime/ws",
        },
        "auth": {
            "cookie_based": True,  # Using HttpOnly cookies for auth
            "supports_mfa": settings.features.mfa_enabled,
        },
    }


@router.get("/health")
async def platform_health() -> dict[str, str]:
    """
    Basic platform health check.

    Returns:
        dict with status indicator
    """
    return {"status": "healthy"}


@health_router.get("/health")
async def api_health_check(
    settings: Annotated[Settings, Depends(get_settings)]
) -> dict[str, Any]:
    """
    Health check endpoint at /api/v1/health for frontend compatibility.

    Returns:
        dict with status, version, and environment info
    """
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment.value,
    }
