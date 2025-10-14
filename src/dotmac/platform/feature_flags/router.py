"""
Feature flags management API router.

Provides REST API endpoints for managing feature flags with proper authentication,
validation, and comprehensive management capabilities.
"""

from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.auth.core import UserInfo, get_current_user_optional
from dotmac.platform.feature_flags import (
    clear_cache,
    delete_flag,
    get_flag_status,
    get_variant,
    is_enabled,
    list_flags,
    set_flag,
    sync_from_redis,
)

logger = structlog.get_logger(__name__)

feature_flags_router = APIRouter(tags=["Feature Flags"])


def _require_authenticated_user(current_user: UserInfo | None) -> UserInfo:
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user


# Request/Response Models
class FeatureFlagRequest(BaseModel):
    """Request model for creating/updating feature flags."""

    model_config = ConfigDict()

    enabled: bool = Field(description="Whether the flag is enabled")
    context: dict[str, Any] | None = Field(None, description="Context conditions for the flag")
    description: str | None = Field(
        None, max_length=500, description="Human-readable description of the flag"
    )

    @field_validator("context")
    @classmethod
    def validate_context(cls, v: dict[str, Any] | None) -> dict[str, Any] | None:
        if v is not None and len(v) > 10:
            raise ValueError("Context cannot have more than 10 keys")
        return v


class FeatureFlagResponse(BaseModel):
    """Response model for feature flag data."""

    model_config = ConfigDict()

    name: str = Field(description="Flag name")
    enabled: bool = Field(description="Whether the flag is enabled")
    context: dict[str, Any] = Field(description="Context conditions")
    description: str | None = Field(None, description="Flag description")
    updated_at: int = Field(description="Last updated timestamp")
    created_at: int | None = Field(None, description="Creation timestamp")


class FeatureFlagCheckRequest(BaseModel):
    """Request model for checking feature flags."""

    model_config = ConfigDict()

    flag_name: str = Field(description="Name of the flag to check")
    context: dict[str, Any] | None = Field(None, description="Context for flag evaluation")


class FeatureFlagCheckResponse(BaseModel):
    """Response model for flag check results."""

    model_config = ConfigDict()

    flag_name: str = Field(description="Flag name")
    enabled: bool = Field(description="Whether the flag is enabled")
    variant: str = Field(description="A/B test variant")
    checked_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class FlagStatusResponse(BaseModel):
    """Response model for feature flag system status."""

    model_config = ConfigDict()

    redis_available: bool = Field(description="Whether Redis is available")
    redis_url: str | None = Field(None, description="Redis URL (masked)")
    cache_size: int = Field(description="Number of flags in cache")
    cache_maxsize: int = Field(description="Maximum cache size")
    cache_ttl: int = Field(description="Cache TTL in seconds")
    redis_flags: int | None = Field(None, description="Number of flags in Redis")
    total_flags: int = Field(description="Total number of flags")
    healthy: bool = Field(description="Overall system health")


class BulkFlagUpdateRequest(BaseModel):
    """Request model for bulk flag operations."""

    model_config = ConfigDict()

    flags: dict[str, FeatureFlagRequest] = Field(description="Dictionary of flag name to flag data")

    @field_validator("flags")
    @classmethod
    def validate_flags_count(
        cls, v: dict[str, FeatureFlagRequest]
    ) -> dict[str, FeatureFlagRequest]:
        if len(v) > 100:
            raise ValueError("Cannot update more than 100 flags at once")
        return v


# API Endpoints
# NOTE: Specific routes MUST come before parameterized routes to avoid conflicts


@feature_flags_router.post("/flags/check", response_model=FeatureFlagCheckResponse)
async def check_flag(
    request: FeatureFlagCheckRequest,
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> FeatureFlagCheckResponse:
    """Check if a feature flag is enabled with context."""
    try:
        # Add user context if available
        context = request.context or {}
        if current_user:
            context["user_id"] = current_user.user_id
            context["user_roles"] = current_user.roles

        enabled = await is_enabled(request.flag_name, context)
        variant = await get_variant(request.flag_name, context)

        return FeatureFlagCheckResponse(
            flag_name=request.flag_name, enabled=enabled, variant=variant
        )

    except Exception as e:
        logger.error("Failed to check feature flag", flag=request.flag_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to check feature flag"
        )


@feature_flags_router.post("/flags/bulk", response_model=dict[str, Any])
async def bulk_update_flags(
    request: BulkFlagUpdateRequest,
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Bulk create/update feature flags (admin only)."""
    try:
        user = _require_authenticated_user(current_user)

        if "admin" not in user.roles and "feature_flag_admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for bulk operations",
            )

        success_count = 0
        failed_flags = []

        for flag_name, flag_request in request.flags.items():
            try:
                # Validate flag name
                if not flag_name.replace("_", "").replace("-", "").isalnum():
                    failed_flags.append({"flag": flag_name, "error": "Invalid flag name"})
                    continue

                # Create enhanced context
                enhanced_context = flag_request.context or {}
                if flag_request.description:
                    enhanced_context["_description"] = flag_request.description

                enhanced_context["_created_by"] = user.user_id
                enhanced_context["_bulk_updated_at"] = int(datetime.now(UTC).timestamp())

                await set_flag(flag_name, flag_request.enabled, enhanced_context)
                success_count += 1

            except Exception as e:
                failed_flags.append({"flag": flag_name, "error": str(e)})

        logger.info(
            "Bulk feature flag update completed",
            success=success_count,
            failed=len(failed_flags),
            user=user.user_id,
        )

        return {
            "message": f"Bulk update completed: {success_count} succeeded, {len(failed_flags)} failed",
            "success_count": success_count,
            "failed_count": len(failed_flags),
            "failed_flags": failed_flags,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed bulk flag update", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform bulk update",
        )


@feature_flags_router.post("/flags/{flag_name}", response_model=FeatureFlagResponse)
async def create_or_update_flag(
    flag_name: str,
    request: FeatureFlagRequest,
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> FeatureFlagResponse:
    """Create or update a feature flag."""
    try:
        # Check if user has permission to manage feature flags
        user = _require_authenticated_user(current_user)

        if "admin" not in user.roles and "feature_flag_admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to manage feature flags",
            )

        # Validate flag name
        if not flag_name.replace("_", "").replace("-", "").isalnum():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Flag name must contain only alphanumeric characters, hyphens, and underscores",
            )

        # Create enhanced context with metadata
        enhanced_context = request.context or {}
        if request.description:
            enhanced_context["_description"] = request.description

        enhanced_context["_created_by"] = user.user_id
        enhanced_context["_created_at"] = int(datetime.now(UTC).timestamp())

        await set_flag(flag_name, request.enabled, enhanced_context)

        logger.info(
            "Feature flag created/updated",
            flag=flag_name,
            enabled=request.enabled,
            user=user.user_id,
        )

        return FeatureFlagResponse(
            name=flag_name,
            enabled=request.enabled,
            context=enhanced_context,
            description=request.description,
            updated_at=enhanced_context["_created_at"],
            created_at=enhanced_context.get("_created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create/update feature flag", flag=flag_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create/update feature flag",
        )


@feature_flags_router.get("/flags/{flag_name}", response_model=FeatureFlagResponse)
async def get_flag(
    flag_name: str,
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> FeatureFlagResponse:
    """Get a specific feature flag."""
    try:
        user = _require_authenticated_user(current_user)

        flags = await list_flags()

        if flag_name not in flags:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Feature flag '{flag_name}' not found",
            )

        flag_data = flags[flag_name]

        return FeatureFlagResponse(
            name=flag_name,
            enabled=flag_data.get("enabled", False),
            context=flag_data.get("context", {}),
            description=flag_data.get("context", {}).get("_description"),
            updated_at=flag_data.get("updated_at", 0),
            created_at=flag_data.get("context", {}).get("_created_at"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get feature flag", flag=flag_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get feature flag"
        )


@feature_flags_router.get("/flags", response_model=list[FeatureFlagResponse])
async def list_all_flags(
    enabled_only: bool = Query(False, description="Return only enabled flags"),
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> list[FeatureFlagResponse]:
    """List all feature flags."""
    try:
        user = _require_authenticated_user(current_user)

        flags = await list_flags()

        result = []
        for flag_name, flag_data in flags.items():
            flag_enabled = flag_data.get("enabled", False)

            if enabled_only and not flag_enabled:
                continue

            result.append(
                FeatureFlagResponse(
                    name=flag_name,
                    enabled=flag_enabled,
                    context=flag_data.get("context", {}),
                    description=flag_data.get("context", {}).get("_description"),
                    updated_at=flag_data.get("updated_at", 0),
                    created_at=flag_data.get("context", {}).get("_created_at"),
                )
            )

        logger.info("Listed feature flags", count=len(result), user=user.user_id)
        return result

    except Exception as e:
        logger.error("Failed to list feature flags", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to list feature flags"
        )


@feature_flags_router.delete("/flags/{flag_name}")
async def delete_feature_flag(
    flag_name: str,
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> dict[str, str]:
    """Delete a feature flag."""
    try:
        # Check permissions
        user = _require_authenticated_user(current_user)

        if "admin" not in user.roles and "feature_flag_admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions to delete feature flags",
            )

        success = await delete_flag(flag_name)

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Feature flag '{flag_name}' not found",
            )

        logger.info("Feature flag deleted", flag=flag_name, user=user.user_id)
        return {"message": f"Feature flag '{flag_name}' deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete feature flag", flag=flag_name, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete feature flag",
        )


@feature_flags_router.get("/status", response_model=FlagStatusResponse)
async def get_status(
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> FlagStatusResponse:
    """Get feature flag system status."""
    try:
        _require_authenticated_user(current_user)

        status_data = await get_flag_status()

        # Mask Redis URL for security
        redis_url = status_data.get("redis_url")
        if redis_url:
            # Show only the protocol and host, hide auth details
            masked_url = redis_url.split("@")[-1] if "@" in redis_url else redis_url
            masked_url = (
                f"redis://{masked_url.split('://')[1] if '://' in masked_url else masked_url}"
            )
        else:
            masked_url = None

        return FlagStatusResponse(
            redis_available=status_data["redis_available"],
            redis_url=masked_url,
            cache_size=status_data["cache_size"],
            cache_maxsize=status_data["cache_maxsize"],
            cache_ttl=status_data["cache_ttl"],
            redis_flags=status_data.get("redis_flags"),
            total_flags=status_data["total_flags"],
            healthy=status_data["redis_available"] or status_data["cache_size"] > 0,
        )

    except Exception as e:
        logger.error("Failed to get feature flag status", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to get system status"
        )


@feature_flags_router.post("/admin/clear-cache")
async def clear_flag_cache(
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> dict[str, str]:
    """Clear the feature flag cache (admin only)."""
    try:
        user = _require_authenticated_user(current_user)

        if "admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required to clear cache"
            )

        await clear_cache()
        logger.info("Feature flag cache cleared", user=user.user_id)
        return {"message": "Cache cleared successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to clear cache", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to clear cache"
        )


@feature_flags_router.post("/admin/sync-redis")
async def sync_flags_from_redis(
    current_user: UserInfo | None = Depends(get_current_user_optional),
) -> dict[str, Any]:
    """Sync feature flags from Redis to cache (admin only)."""
    try:
        user = _require_authenticated_user(current_user)

        if "admin" not in user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required to sync from Redis",
            )

        synced_count = await sync_from_redis()

        logger.info("Feature flags synced from Redis", count=synced_count, user=user.user_id)
        return {
            "message": f"Synced {synced_count} flags from Redis to cache",
            "synced_count": synced_count,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to sync from Redis", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to sync from Redis"
        )


__all__ = ["feature_flags_router"]
