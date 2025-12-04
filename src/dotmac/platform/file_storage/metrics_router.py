"""
File Storage Metrics Router.

Provides file storage statistics endpoints for monitoring
storage usage, upload/download counts, and file distribution.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.cache import CacheTier, cached_result
from dotmac.platform.file_storage.service import FileStorageService, get_storage_service

logger = structlog.get_logger(__name__)

# Cache TTL (in seconds)
FILES_STATS_CACHE_TTL = 300  # 5 minutes

router = APIRouter(prefix="/metrics/files", tags=["File Storage Metrics"])


# ============================================================================
# Response Models
# ============================================================================


class FileStatsResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """File storage statistics response."""

    model_config = ConfigDict(from_attributes=True)

    # Total counts
    total_files: int = Field(description="Total number of files")
    total_size_bytes: int = Field(description="Total storage used in bytes")
    total_size_mb: float = Field(description="Total storage used in MB")

    # File types
    images_count: int = Field(description="Number of image files")
    documents_count: int = Field(description="Number of document files")
    videos_count: int = Field(description="Number of video files")
    other_count: int = Field(description="Number of other files")

    # Storage by type
    images_size_mb: float = Field(description="Storage used by images (MB)")
    documents_size_mb: float = Field(description="Storage used by documents (MB)")
    videos_size_mb: float = Field(description="Storage used by videos (MB)")
    other_size_mb: float = Field(description="Storage used by other files (MB)")

    # Averages
    avg_file_size_mb: float = Field(description="Average file size in MB")

    # Time period
    period: str = Field(description="Metrics calculation period")
    timestamp: datetime = Field(description="Metrics generation timestamp")


# ============================================================================
# Helper Functions
# ============================================================================


def _categorize_content_type(content_type: str) -> str:
    """Categorize content type into broad categories."""
    content_type = content_type.lower()

    if content_type.startswith("image/"):
        return "image"
    elif content_type.startswith("video/"):
        return "video"
    elif content_type in [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
    ]:
        return "document"
    else:
        return "other"


# ============================================================================
# Cached Helper Function
# ============================================================================


@cached_result(  # type: ignore[misc]  # Cache decorator is untyped
    ttl=FILES_STATS_CACHE_TTL,
    key_prefix="files:stats",
    key_params=["period_days", "tenant_id"],
    tier=CacheTier.L2_REDIS,
)
async def _get_file_stats_cached(
    period_days: int,
    tenant_id: str | None,
    storage_service: FileStorageService,
) -> dict[str, Any]:
    """
    Cached helper function for file storage stats calculation.
    """
    now = datetime.now(UTC)
    period_start = now - timedelta(days=period_days)

    # Initialize counters
    total_files = 0
    total_size_bytes = 0

    images_count = 0
    documents_count = 0
    videos_count = 0
    other_count = 0

    images_size = 0
    documents_size = 0
    videos_size = 0
    other_size = 0

    batch_size = 500
    offset = 0

    while True:
        batch = await storage_service.list_files(
            tenant_id=tenant_id,
            limit=batch_size,
            offset=offset,
        )
        if not batch:
            break

        offset += len(batch)

        for file in batch:
            if getattr(file, "created_at", None) and file.created_at < period_start:
                continue

            size = file.file_size
            total_files += 1
            total_size_bytes += size

            category = _categorize_content_type(file.content_type)

            if category == "image":
                images_count += 1
                images_size += size
            elif category == "document":
                documents_count += 1
                documents_size += size
            elif category == "video":
                videos_count += 1
                videos_size += size
            else:
                other_count += 1
                other_size += size

        if len(batch) < batch_size:
            break

    # Convert to MB
    total_size_mb = total_size_bytes / (1024 * 1024)
    images_size_mb = images_size / (1024 * 1024)
    documents_size_mb = documents_size / (1024 * 1024)
    videos_size_mb = videos_size / (1024 * 1024)
    other_size_mb = other_size / (1024 * 1024)

    # Calculate averages
    avg_file_size_mb = total_size_mb / total_files if total_files > 0 else 0.0

    return {
        "total_files": total_files,
        "total_size_bytes": total_size_bytes,
        "total_size_mb": round(total_size_mb, 2),
        "images_count": images_count,
        "documents_count": documents_count,
        "videos_count": videos_count,
        "other_count": other_count,
        "images_size_mb": round(images_size_mb, 2),
        "documents_size_mb": round(documents_size_mb, 2),
        "videos_size_mb": round(videos_size_mb, 2),
        "other_size_mb": round(other_size_mb, 2),
        "avg_file_size_mb": round(avg_file_size_mb, 2),
        "period": f"{period_days}d",
        "timestamp": now,
    }


# Ensure tests can access the uncached function even if the cache decorator
# is patched to a no-op (e.g., tests/file_storage/test_metrics_router_real.py).
if not hasattr(_get_file_stats_cached, "__wrapped__"):
    _get_file_stats_cached.__wrapped__ = _get_file_stats_cached  # type: ignore[attr-defined]


# ============================================================================
# File Storage Stats Endpoint
# ============================================================================


@router.get("/stats", response_model=FileStatsResponse)
async def get_file_storage_stats(
    request: Request,
    period_days: int = Query(default=30, ge=1, le=365, description="Time period in days"),
    current_user: UserInfo = Depends(get_current_user),
    storage_service: FileStorageService = Depends(get_storage_service),
) -> FileStatsResponse:
    """
    Get file storage statistics with Redis caching.

    Returns storage usage metrics, file counts by type, and size distribution
    with tenant isolation.

    **Caching**: Results cached for 5 minutes per tenant/period combination.
    **Rate Limit**: 100 requests per hour per IP.
    **Required Permission**: files:stats:read (enforced by get_current_user)
    """
    try:
        tenant_header = request.headers.get("X-Tenant-ID") if request else None
        tenant_query = request.query_params.get("tenant_id") if request else None
        tenant_id = tenant_header or tenant_query

        if not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant context is required via X-Tenant-ID header or tenant_id query parameter.",
            )

        if not getattr(current_user, "is_platform_admin", False):
            user_tenant = getattr(current_user, "tenant_id", None)
            if not user_tenant:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is not associated with a tenant.",
                )
            if tenant_id != str(user_tenant):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions for requested tenant.",
                )

        stats_data = await _get_file_stats_cached(
            period_days=period_days,
            tenant_id=tenant_id,
            storage_service=storage_service,
        )

        return FileStatsResponse(**stats_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch file storage stats", error=str(e), exc_info=True)
        # Return safe defaults on error
        return FileStatsResponse(
            total_files=0,
            total_size_bytes=0,
            total_size_mb=0.0,
            images_count=0,
            documents_count=0,
            videos_count=0,
            other_count=0,
            images_size_mb=0.0,
            documents_size_mb=0.0,
            videos_size_mb=0.0,
            other_size_mb=0.0,
            avg_file_size_mb=0.0,
            period=f"{period_days}d",
            timestamp=datetime.now(UTC),
        )


__all__ = ["router"]
