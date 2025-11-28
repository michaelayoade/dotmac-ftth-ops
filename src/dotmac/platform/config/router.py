"""
Platform Configuration Router.

Exposes public platform configuration for frontend consumption.
"""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response

from ..settings import Settings, get_settings
from ..settings import settings as runtime_settings
from ..tenant.schemas import TenantBrandingConfig, TenantBrandingResponse

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
    "pon_alarm_actions_enabled",
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

_RUNTIME_CONFIG_CACHE_SECONDS = 60
_DEFAULT_API_PREFIX = "/api/v1"


def _sanitize_base_url(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.strip()
    if not cleaned:
        return ""
    return cleaned.rstrip("/")


def _join_url(base_url: str, path: str) -> str:
    if not path:
        return base_url or "/"
    if not base_url:
        return path if path.startswith("/") else f"/{path}"
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{base_url}{normalized_path}"


def _as_websocket_url(url: str | None) -> str:
    if not url:
        return ""
    if url.startswith("http://"):
        return f"ws://{url.removeprefix('http://')}"
    if url.startswith("https://"):
        return f"wss://{url.removeprefix('https://')}"
    return url


def _build_branding_payload(settings: Settings) -> dict[str, Any]:
    brand = settings.brand
    return {
        "companyName": brand.company_name,
        "productName": brand.product_name,
        "productTagline": brand.product_tagline,
        "supportEmail": brand.support_email,
        "successEmail": brand.success_email,
        "operationsEmail": brand.operations_email,
        "partnerSupportEmail": brand.partner_support_email,
        "notificationDomain": brand.notification_domain,
    }


def _build_tenant_branding_from_settings(settings: Settings) -> TenantBrandingConfig:
    """Build tenant-friendly branding config from runtime settings."""
    return TenantBrandingConfig(
        product_name=settings.brand.product_name,
        product_tagline=settings.brand.product_tagline,
        company_name=settings.brand.company_name,
        support_email=settings.brand.support_email,
        success_email=settings.brand.success_email,
        operations_email=settings.brand.operations_email,
        partner_support_email=settings.brand.partner_support_email,
    )


@router.get("/runtime-config", include_in_schema=False)
async def get_runtime_frontend_config(
    response: Response,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    """
    Return tenant-aware runtime configuration for frontend apps.

    This allows shipping a single artifact while injecting tenant metadata,
    feature flags, and API endpoints at deploy time.
    """

    features_payload = {flag: getattr(settings.features, flag) for flag in PUBLIC_FEATURE_FLAGS}

    api_base = _sanitize_base_url(settings.frontend_api_base_url)
    api_prefix = _DEFAULT_API_PREFIX
    rest_url = _join_url(api_base, api_prefix) if api_base else api_prefix
    graphql_url = settings.tenant_graphql_url or _join_url(rest_url, "/graphql")
    realtime_ws = ""
    if api_base:
        realtime_ws = _join_url(_as_websocket_url(api_base), "/realtime/ws")
    if not realtime_ws:
        base_from_graphql = (
            graphql_url.rsplit("/graphql", 1)[0] if "/graphql" in graphql_url else ""
        )
        websocket_base = _as_websocket_url(base_from_graphql or api_base)
        realtime_ws = _join_url(websocket_base, "/realtime/ws")

    tenant_slug = settings.tenant_slug or settings.tenant.default_tenant_id
    tenant_name = settings.tenant_display_name or settings.brand.product_name

    sse_url = _join_url(rest_url, "/realtime/events")

    runtime_payload = {
        "version": settings.app_version,
        "generated_at": datetime.now(UTC).isoformat(),
        "cache_ttl_seconds": _RUNTIME_CONFIG_CACHE_SECONDS,
        "tenant": {
            "id": settings.TENANT_ID or settings.tenant.default_tenant_id,
            "slug": tenant_slug,
            "name": tenant_name,
        },
        "api": {
            "base_url": api_base,
            "rest_path": api_prefix,
            "rest_url": rest_url,
            "graphql_url": graphql_url,
            "websocket_url": realtime_ws,
        },
        "realtime": {
            "ws_url": realtime_ws,
            "sse_url": sse_url,
            "alerts_channel": f"tenant-{tenant_slug or 'global'}",
        },
        "deployment": {
            "mode": settings.DEPLOYMENT_MODE,
            "tenant_id": settings.TENANT_ID,
            "platform_routes_enabled": settings.ENABLE_PLATFORM_ROUTES,
        },
        "license": {
            "allow_multi_tenant": settings.DEPLOYMENT_MODE != "single_tenant",
            "enforce_platform_admin": settings.ENABLE_PLATFORM_ROUTES,
        },
        "features": features_payload,
        "branding": _build_branding_payload(settings),
        "app": {
            "name": settings.app_name,
            "environment": settings.environment.value,
        },
    }

    response.headers["Cache-Control"] = f"public, max-age={_RUNTIME_CONFIG_CACHE_SECONDS}"
    return runtime_payload


@router.get("/config")
async def get_platform_config(
    settings: Annotated[Settings, Depends(get_settings)],
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
    features_payload = {flag: getattr(settings.features, flag) for flag in PUBLIC_FEATURE_FLAGS}

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


@health_router.get(
    "/branding",
    response_model=TenantBrandingResponse,
    include_in_schema=False,
)
async def get_public_branding(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TenantBrandingResponse:
    """
    Public branding endpoint that does not require tenant context.

    Returns the same runtime branding defaults used by /platform/runtime-config.
    """
    branding = _build_tenant_branding_from_settings(settings)
    tenant_id = settings.TENANT_ID or settings.tenant.default_tenant_id
    return TenantBrandingResponse(tenant_id=tenant_id, branding=branding, updated_at=None)


@health_router.get("/health")
async def api_health_check() -> dict[str, Any]:
    """
    Health check endpoint at /api/v1/health for frontend compatibility.

    Returns:
        dict with status, version, environment info, and service health
    """
    from ..monitoring.health_checks import HealthChecker

    checker = HealthChecker()
    health_summary = checker.get_summary()

    response = _PLATFORM_HEALTH_SUMMARY.copy()
    response.update(
        {
            "services": health_summary["services"],
            "healthy": health_summary["healthy"],
        }
    )

    return response


@health_router.get("/health/redis")
async def redis_health_check() -> dict[str, Any]:
    """
    Dedicated Redis health check endpoint.

    Returns detailed Redis connection status including:
    - Connection status
    - Redis version
    - Connected clients
    - Memory usage
    - Uptime

    Returns 503 if Redis is unavailable.
    """
    from fastapi import HTTPException

    from ..redis_client import redis_manager

    try:
        health_info = await redis_manager.health_check()

        if health_info["status"] != "healthy":
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Redis unavailable",
                    "info": health_info,
                },
            )

        return health_info

    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Redis health check failed",
                "message": str(e),
            },
        )
