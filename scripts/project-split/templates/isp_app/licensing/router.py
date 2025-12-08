"""
License Router for ISP App

Endpoints for:
- Receiving license pushes from Control Plane
- Checking current license status
- Usage dashboard data
"""

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from isp_app.licensing.enforcement import get_license_enforcer, LicenseEnforcer
from isp_app.settings import settings

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/license", tags=["License"])


# ============================================================================
# Request/Response Models
# ============================================================================

class LicenseSyncRequest(BaseModel):
    """Request body for license sync from Control Plane."""
    license_token: str


class LicenseStatusResponse(BaseModel):
    """Current license status."""
    current_subscribers: int
    max_subscribers: int
    usage_percent: float
    status: str  # ok, warning, critical
    overage_policy: str
    can_add_subscribers: bool
    warn_threshold: int
    critical_threshold: int
    version: int
    expires_at: str


class FeatureCheckResponse(BaseModel):
    """Feature availability check."""
    feature: str
    enabled: bool


# ============================================================================
# Dependencies
# ============================================================================

async def verify_platform_api_key(
    x_platform_api_key: Annotated[str, Header()]
) -> str:
    """Verify the request is from the Control Plane."""
    if x_platform_api_key != settings.platform_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid platform API key",
        )
    return x_platform_api_key


def get_enforcer() -> LicenseEnforcer:
    """Get the license enforcer dependency."""
    return get_license_enforcer()


# ============================================================================
# Endpoints - Control Plane -> ISP Instance
# ============================================================================

@router.post(
    "/sync",
    summary="Receive license push from Control Plane",
    description="Called by Control Plane when license is updated (plan change, renewal).",
)
async def sync_license(
    request: LicenseSyncRequest,
    _api_key: Annotated[str, Depends(verify_platform_api_key)],
    enforcer: Annotated[LicenseEnforcer, Depends(get_enforcer)],
):
    """
    Receive pushed license from Control Plane.

    This endpoint is called when:
    - Tenant upgrades/downgrades plan
    - License is renewed
    - Feature flags change
    """
    try:
        license_token = await enforcer.receive_license_push(request.license_token)

        logger.info(
            "license_synced",
            version=license_token.version,
            max_subscribers=license_token.max_subscribers,
        )

        return {
            "status": "accepted",
            "version": license_token.version,
            "max_subscribers": license_token.max_subscribers,
        }

    except Exception as e:
        logger.error("license_sync_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to sync license: {e}",
        )


# ============================================================================
# Endpoints - ISP Instance Internal
# ============================================================================

@router.get(
    "/status",
    response_model=LicenseStatusResponse,
    summary="Get current license status",
    description="Returns current subscriber count, limits, and usage status.",
)
async def get_license_status(
    enforcer: Annotated[LicenseEnforcer, Depends(get_enforcer)],
):
    """
    Get current license status for dashboard display.

    Returns:
    - Current subscriber count vs max
    - Usage percentage
    - Status (ok/warning/critical)
    - Whether new subscribers can be added
    """
    try:
        license_token = await enforcer.get_license()
        status_info = await enforcer.check_subscriber_cap()

        return LicenseStatusResponse(
            current_subscribers=status_info["current_subscribers"],
            max_subscribers=status_info["max_subscribers"],
            usage_percent=status_info["usage_percent"],
            status=status_info["status"],
            overage_policy=status_info["overage_policy"],
            can_add_subscribers=status_info["can_add_subscribers"],
            warn_threshold=status_info["warn_threshold"],
            critical_threshold=status_info["critical_threshold"],
            version=license_token.version,
            expires_at=license_token.expires_at.isoformat(),
        )

    except Exception as e:
        logger.error("license_status_check_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to check license status: {e}",
        )


@router.get(
    "/features/{feature}",
    response_model=FeatureCheckResponse,
    summary="Check if a feature is enabled",
    description="Check if a specific feature is included in the current license.",
)
async def check_feature(
    feature: str,
    enforcer: Annotated[LicenseEnforcer, Depends(get_enforcer)],
):
    """
    Check if a feature is enabled in the current license.

    Common features:
    - radius: RADIUS/AAA integration
    - field_service: Field technician tracking
    - advanced_analytics: Advanced reporting
    - multi_site: Multi-site management
    - api_access: External API access
    - white_label: White-label branding
    """
    try:
        license_token = await enforcer.get_license()
        enabled = license_token.is_feature_enabled(feature)

        return FeatureCheckResponse(
            feature=feature,
            enabled=enabled,
        )

    except Exception as e:
        logger.error("feature_check_failed", feature=feature, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to check feature: {e}",
        )


@router.get(
    "/features",
    summary="Get all enabled features",
    description="Returns a list of all features and their enabled status.",
)
async def list_features(
    enforcer: Annotated[LicenseEnforcer, Depends(get_enforcer)],
):
    """Get all features and their enabled status."""
    try:
        license_token = await enforcer.get_license()

        return {
            "features": license_token.features,
            "version": license_token.version,
        }

    except Exception as e:
        logger.error("feature_list_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to list features: {e}",
        )
