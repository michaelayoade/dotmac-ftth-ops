"""
Platform Configuration Router.

Exposes public platform configuration for frontend consumption.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from ..settings import Settings, get_settings, settings as runtime_settings

router = APIRouter(prefix="/platform")

# Separate router for endpoints without /platform prefix
health_router = APIRouter(prefix="")

# Explicit allowlist of feature flags we expose publicly.
PUBLIC_FEATURE_FLAGS: tuple[str, ...] = (
    # Core features
    "mfa_enabled",
    "audit_logging",
    # Communications
    "email_enabled",
    "communications_enabled",
    "sms_enabled",
    # Storage
    "storage_enabled",
    # Search
    "search_enabled",
    # Data handling
    "data_transfer_enabled",
    "data_transfer_excel",
    "data_transfer_compression",
    "data_transfer_streaming",
    # File processing
    "file_processing_enabled",
    "file_processing_pdf",
    "file_processing_images",
    "file_processing_office",
    # Background tasks
    "celery_enabled",
    # OSS/BSS Domain Features
    "graphql_enabled",
    "analytics_enabled",
    "banking_enabled",
    "payments_enabled",
    "radius_enabled",
    "network_enabled",
    "automation_enabled",
    "wireless_enabled",
    "fiber_enabled",
    "orchestration_enabled",
    "dunning_enabled",
    "ticketing_enabled",
    "crm_enabled",
    "notification_enabled",
)

PRIVATE_FEATURE_FLAGS: tuple[str, ...] = (
    "celery_redis",
    "encryption_fernet",
    "secrets_vault",
    "db_migrations",
    "db_postgresql",
    "db_sqlite",
)

_PLATFORM_HEALTH_SUMMARY: dict[str, str] = {
    "status": "healthy",
    "version": runtime_settings.app_version,
    "environment": runtime_settings.environment.value,
}


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
    features_payload = {
        flag: getattr(settings.features, flag) for flag in PUBLIC_FEATURE_FLAGS
    }

    return {
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment.value,
        },
        "features": features_payload,
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
async def api_health_check() -> dict[str, str]:
    """
    Health check endpoint at /api/v1/health for frontend compatibility.

    Returns:
        dict with status, version, and environment info
    """
    return _PLATFORM_HEALTH_SUMMARY.copy()
