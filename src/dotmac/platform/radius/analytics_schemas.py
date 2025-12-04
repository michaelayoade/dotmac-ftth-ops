"""
RADIUS Analytics Schemas.

Pydantic models for RADIUS analytics API endpoints.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class UsageQueryParams(BaseModel):
    """Query parameters for usage analytics."""

    start_date: datetime = Field(..., description="Start date for usage query")
    end_date: datetime = Field(..., description="End date for usage query")
    subscriber_id: str | None = Field(None, description="Filter by subscriber ID")


class SubscriberUsageResponse(BaseModel):
    """Subscriber usage analytics response."""

    subscriber_id: str = Field(..., description="Subscriber ID")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")
    total_bandwidth_bytes: int = Field(..., description="Total bandwidth used (bytes)")
    total_bandwidth_gb: float = Field(..., description="Total bandwidth used (GB)")
    total_duration_seconds: int = Field(..., description="Total session duration (seconds)")
    total_duration_hours: float = Field(..., description="Total session duration (hours)")
    session_count: int = Field(..., description="Number of sessions")
    avg_session_duration_seconds: float = Field(
        ..., description="Average session duration (seconds)"
    )
    peak_bandwidth_bytes: int = Field(..., description="Peak single session bandwidth (bytes)")

    class Config:
        json_schema_extra = {
            "example": {
                "subscriber_id": "sub_123456",
                "start_date": "2025-10-01T00:00:00Z",
                "end_date": "2025-10-31T23:59:59Z",
                "total_bandwidth_bytes": 107374182400,
                "total_bandwidth_gb": 100.0,
                "total_duration_seconds": 86400,
                "total_duration_hours": 24.0,
                "session_count": 45,
                "avg_session_duration_seconds": 1920.0,
                "peak_bandwidth_bytes": 5368709120,
            }
        }


class TenantUsageResponse(BaseModel):
    """Tenant-wide usage analytics response."""

    tenant_id: str = Field(..., description="Tenant ID")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")
    total_bandwidth_bytes: int = Field(..., description="Total bandwidth used (bytes)")
    total_bandwidth_gb: float = Field(..., description="Total bandwidth used (GB)")
    total_duration_seconds: int = Field(..., description="Total session duration (seconds)")
    total_duration_hours: float = Field(..., description="Total session duration (hours)")
    session_count: int = Field(..., description="Number of sessions")
    unique_subscribers: int = Field(..., description="Number of unique subscribers")

    class Config:
        json_schema_extra = {
            "example": {
                "tenant_id": "tenant_123",
                "start_date": "2025-10-01T00:00:00Z",
                "end_date": "2025-10-31T23:59:59Z",
                "total_bandwidth_bytes": 10737418240000,
                "total_bandwidth_gb": 10000.0,
                "total_duration_seconds": 8640000,
                "total_duration_hours": 2400.0,
                "session_count": 4500,
                "unique_subscribers": 150,
            }
        }


class HourlyBandwidthPoint(BaseModel):
    """Single data point for hourly bandwidth."""

    hour: datetime = Field(..., description="Hour timestamp")
    session_count: int = Field(..., description="Number of sessions")
    total_bandwidth_bytes: int = Field(..., description="Total bandwidth (bytes)")
    total_bandwidth_mb: float = Field(..., description="Total bandwidth (MB)")
    total_duration_seconds: int = Field(..., description="Total duration (seconds)")


class HourlyBandwidthResponse(BaseModel):
    """Hourly bandwidth analytics response."""

    subscriber_id: str | None = Field(None, description="Subscriber ID (if filtered)")
    tenant_id: str = Field(..., description="Tenant ID")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")
    data_points: list[HourlyBandwidthPoint] = Field(..., description="Hourly data points")

    class Config:
        json_schema_extra = {
            "example": {
                "subscriber_id": "sub_123456",
                "tenant_id": "tenant_123",
                "start_date": "2025-10-28T00:00:00Z",
                "end_date": "2025-10-28T23:59:59Z",
                "data_points": [
                    {
                        "hour": "2025-10-28T00:00:00Z",
                        "session_count": 5,
                        "total_bandwidth_bytes": 5368709120,
                        "total_bandwidth_mb": 5120.0,
                        "total_duration_seconds": 18000,
                    },
                    {
                        "hour": "2025-10-28T01:00:00Z",
                        "session_count": 3,
                        "total_bandwidth_bytes": 3221225472,
                        "total_bandwidth_mb": 3072.0,
                        "total_duration_seconds": 10800,
                    },
                ],
            }
        }


class DailyBandwidthPoint(BaseModel):
    """Single data point for daily bandwidth."""

    day: datetime = Field(..., description="Day timestamp")
    session_count: int = Field(..., description="Number of sessions")
    total_bandwidth_bytes: int = Field(..., description="Total bandwidth (bytes)")
    total_bandwidth_gb: float = Field(..., description="Total bandwidth (GB)")
    total_duration_seconds: int = Field(..., description="Total duration (seconds)")


class DailyBandwidthResponse(BaseModel):
    """Daily bandwidth analytics response."""

    subscriber_id: str | None = Field(None, description="Subscriber ID (if filtered)")
    tenant_id: str = Field(..., description="Tenant ID")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")
    data_points: list[DailyBandwidthPoint] = Field(..., description="Daily data points")

    class Config:
        json_schema_extra = {
            "example": {
                "subscriber_id": "sub_123456",
                "tenant_id": "tenant_123",
                "start_date": "2025-10-01T00:00:00Z",
                "end_date": "2025-10-31T23:59:59Z",
                "data_points": [
                    {
                        "day": "2025-10-01T00:00:00Z",
                        "session_count": 45,
                        "total_bandwidth_bytes": 107374182400,
                        "total_bandwidth_gb": 100.0,
                        "total_duration_seconds": 86400,
                    },
                    {
                        "day": "2025-10-02T00:00:00Z",
                        "session_count": 38,
                        "total_bandwidth_bytes": 85899345920,
                        "total_bandwidth_gb": 80.0,
                        "total_duration_seconds": 72000,
                    },
                ],
            }
        }


class TopSubscribersRequest(BaseModel):
    """Request for top subscribers by bandwidth."""

    start_date: datetime = Field(..., description="Start date")
    end_date: datetime = Field(..., description="End date")
    limit: int = Field(10, ge=1, le=100, description="Number of top subscribers to return")
    metric: str = Field("bandwidth", description="Metric to sort by (bandwidth or duration)")


class TopSubscriberEntry(BaseModel):
    """Single entry in top subscribers list."""

    subscriber_id: str = Field(..., description="Subscriber ID")
    username: str | None = Field(None, description="Username")
    total_bandwidth_bytes: int = Field(..., description="Total bandwidth (bytes)")
    total_bandwidth_gb: float = Field(..., description="Total bandwidth (GB)")
    total_duration_seconds: int = Field(..., description="Total duration (seconds)")
    session_count: int = Field(..., description="Number of sessions")


class TopSubscribersResponse(BaseModel):
    """Top subscribers analytics response."""

    tenant_id: str = Field(..., description="Tenant ID")
    start_date: datetime = Field(..., description="Query start date")
    end_date: datetime = Field(..., description="Query end date")
    metric: str = Field(..., description="Metric used for sorting")
    top_subscribers: list[TopSubscriberEntry] = Field(..., description="Top subscribers list")
