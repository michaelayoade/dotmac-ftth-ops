"""
Analytics request and response models with proper validation.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import ConfigDict, Field, field_validator, model_validator
from pydantic.functional_serializers import field_serializer

from ..core.models import BaseModel


class EventType(str, Enum):
    """Valid event types for analytics."""

    PAGE_VIEW = "page_view"
    USER_ACTION = "user_action"
    API_CALL = "api_call"
    ERROR = "error"
    CUSTOM = "custom"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"
    BULK_OPERATION = "bulk_operation"


def _format_datetime(value: datetime) -> str:
    """Format datetimes in UTC with a trailing Z for consistent API responses."""

    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    else:
        value = value.astimezone(UTC)
    return value.isoformat().replace("+00:00", "Z")


def format_datetime(value: datetime) -> str:
    """Public helper for consistent datetime formatting."""

    return _format_datetime(value)


class MetricUnit(str, Enum):
    """Valid metric units."""

    COUNT = "count"
    MILLISECONDS = "milliseconds"
    SECONDS = "seconds"
    BYTES = "bytes"
    PERCENTAGE = "percentage"
    REQUESTS_PER_SECOND = "requests_per_second"


class AggregationType(str, Enum):
    """Valid aggregation types."""

    AVG = "avg"
    SUM = "sum"
    MIN = "min"
    MAX = "max"
    COUNT = "count"
    P50 = "p50"
    P95 = "p95"
    P99 = "p99"


class TimeInterval(str, Enum):
    """Valid time intervals for metrics."""

    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class ReportType(str, Enum):
    """Valid report types."""

    SUMMARY = "summary"
    USAGE = "usage"
    PERFORMANCE = "performance"
    USER_ACTIVITY = "user_activity"
    ERROR_ANALYSIS = "error_analysis"


class DashboardPeriod(str, Enum):
    """Valid dashboard periods."""

    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"
    QUARTER = "quarter"


# ========================================
# Request Models
# ========================================


class EventTrackRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Event tracking request with validation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    event_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z][a-zA-Z0-9_.-]*$",
        description="Event name (alphanumeric, dots, dashes, underscores)",
    )
    event_type: EventType = Field(EventType.CUSTOM, description="Event type")
    properties: dict[str, Any] = Field(
        default_factory=dict,
        description="Event properties (max 50 properties)",
    )
    user_id: str | None = Field(None, max_length=255, description="User ID")
    session_id: str | None = Field(None, max_length=255, description="Session ID")
    timestamp: datetime | None = Field(None, description="Event timestamp (defaults to now)")

    @field_validator("properties")
    @classmethod
    def validate_properties(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate event properties."""
        if len(v) > 50:
            raise ValueError("Maximum 50 properties allowed")

        # Ensure property values are serializable
        for key, value in v.items():
            if not isinstance(key, str):
                raise ValueError(f"Property key must be string, got {type(key)}")
            if not isinstance(value, (str, int, float, bool, type(None))):
                # Convert complex types to string
                v[key] = str(value)

        return v


class MetricRecordRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Metric recording request with validation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    metric_name: str = Field(
        ...,
        min_length=1,
        max_length=100,
        pattern=r"^[a-zA-Z][a-zA-Z0-9_.-]*$",
        description="Metric name",
    )
    value: float = Field(..., description="Metric value")
    unit: MetricUnit = Field(MetricUnit.COUNT, description="Metric unit")
    tags: dict[str, str] = Field(
        default_factory=dict,
        description="Metric tags (max 20 tags)",
    )
    timestamp: datetime | None = Field(None, description="Metric timestamp")

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: float) -> float:
        """Validate metric value."""
        if not isinstance(v, (int, float)):
            raise ValueError("Metric value must be numeric")
        return float(v)

    @model_validator(mode="after")
    def validate_negative_values(self) -> "MetricRecordRequest":
        """Validate that negative values are only allowed for count metrics."""
        if self.value < 0 and self.unit != MetricUnit.COUNT:
            raise ValueError("Negative values only allowed for count metrics")
        return self

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: dict[str, str]) -> dict[str, str]:
        """Validate metric tags."""
        if len(v) > 20:
            raise ValueError("Maximum 20 tags allowed")

        for key, value in v.items():
            if not isinstance(key, str) or not isinstance(value, str):
                raise ValueError("Tag keys and values must be strings")
            if len(key) > 50 or len(value) > 100:
                raise ValueError("Tag key max 50 chars, value max 100 chars")

        return v


class AnalyticsQueryRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Analytics query request with validation."""

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True)

    query_type: str = Field(
        ...,
        pattern=r"^(events|metrics|aggregations)$",
        description="Query type",
    )
    filters: dict[str, Any] = Field(
        default_factory=dict,
        description="Query filters",
    )
    group_by: list[str] | None = Field(
        None,
        max_length=10,
        description="Fields to group by (max 10)",
    )
    order_by: str | None = Field(
        None,
        max_length=50,
        description="Order by field",
    )
    limit: int = Field(
        100,
        ge=1,
        le=10000,
        description="Result limit",
    )
    offset: int = Field(
        0,
        ge=0,
        description="Result offset for pagination",
    )


# ========================================
# Response Models
# ========================================


class EventTrackResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Event tracking response."""

    model_config = ConfigDict(from_attributes=True)

    event_id: str = Field(..., description="Unique event ID")
    event_name: str = Field(..., description="Event name")
    timestamp: datetime = Field(..., description="Event timestamp")
    status: str = Field("tracked", description="Tracking status")
    message: str | None = Field(None, description="Optional status message")

    @field_serializer("timestamp")
    def _serialize_timestamp(self, value: datetime) -> str:
        return _format_datetime(value)


class MetricRecordResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Metric recording response."""

    model_config = ConfigDict(from_attributes=True)

    metric_id: str = Field(..., description="Unique metric ID")
    metric_name: str = Field(..., description="Metric name")
    value: float = Field(..., description="Recorded value")
    unit: str = Field(..., description="Metric unit")
    timestamp: datetime = Field(..., description="Recording timestamp")
    status: str = Field("recorded", description="Recording status")

    @field_serializer("timestamp")
    def _serialize_timestamp(self, value: datetime) -> str:
        return _format_datetime(value)


class MetricDataPoint(BaseModel):  # BaseModel resolves to Any in isolation
    """Single metric data point."""

    model_config = ConfigDict()

    timestamp: datetime = Field(..., description="Data point timestamp")
    value: float = Field(..., description="Metric value")
    tags: dict[str, str] | None = Field(None, description="Associated tags")

    @field_serializer("timestamp")
    def _serialize_timestamp(self, value: datetime) -> str:
        return _format_datetime(value)


class MetricSeries(BaseModel):  # BaseModel resolves to Any in isolation
    """Time series of metric data."""

    model_config = ConfigDict()

    metric_name: str = Field(..., description="Metric name")
    unit: str = Field(..., description="Metric unit")
    data_points: list[MetricDataPoint] = Field(..., description="Time series data")
    aggregation: str | None = Field(None, description="Aggregation applied")


class EventData(BaseModel):
    """Event data in query response."""

    model_config = ConfigDict()

    event_id: str = Field(..., description="Event ID")
    event_name: str = Field(..., description="Event name")
    event_type: str = Field(..., description="Event type")
    timestamp: datetime = Field(..., description="Event timestamp")
    user_id: str | None = Field(None, description="User ID")
    session_id: str | None = Field(None, description="Session ID")
    properties: dict[str, Any] = Field(default_factory=dict, description="Event properties")


class EventsQueryResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Events query response."""

    model_config = ConfigDict(from_attributes=True)

    events: list[EventData] = Field(..., description="Event records")
    total: int = Field(..., description="Total events matching query")
    page: int = Field(1, description="Current page")
    page_size: int = Field(100, description="Page size")
    has_more: bool = Field(False, description="More results available")
    query_time_ms: float | None = Field(None, description="Query execution time")


class MetricsQueryResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Metrics query response."""

    model_config = ConfigDict(from_attributes=True)

    metrics: list[MetricSeries] = Field(..., description="Metric time series data")
    period: dict[str, Any] = Field(..., description="Query time period")
    total_series: int = Field(..., description="Total metric series")
    query_time_ms: float | None = Field(None, description="Query execution time")

    @field_serializer("period")
    def _serialize_period(self, value: dict[str, Any]) -> dict[str, Any]:
        return {
            key: _format_datetime(val) if isinstance(val, datetime) else val
            for key, val in value.items()
        }


class AggregationResult(BaseModel):  # BaseModel resolves to Any in isolation
    """Single aggregation result."""

    model_config = ConfigDict()

    group_key: dict[str, Any] | None = Field(None, description="Group by key values")
    aggregation: str = Field(..., description="Aggregation type")
    value: float = Field(..., description="Aggregated value")
    count: int = Field(..., description="Number of records in aggregation")


class AggregationQueryResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Aggregation query response."""

    model_config = ConfigDict(from_attributes=True)

    results: list[AggregationResult] = Field(..., description="Aggregation results")
    total_records: int = Field(..., description="Total records processed")
    query_time_ms: float = Field(..., description="Query execution time")
    metadata: dict[str, Any] | None = Field(None, description="Additional metadata")


class ReportSection(BaseModel):  # BaseModel resolves to Any in isolation
    """Section of an analytics report."""

    model_config = ConfigDict()

    title: str = Field(..., description="Section title")
    data: dict[str, Any] = Field(..., description="Section data")
    charts: list[dict[str, Any]] | None = Field(None, description="Chart configurations")


class ReportResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Analytics report response."""

    model_config = ConfigDict(from_attributes=True)

    report_id: str = Field(..., description="Unique report ID")
    report_type: ReportType = Field(..., description="Type of report")
    title: str = Field(..., description="Report title")
    sections: list[ReportSection] = Field(..., description="Report sections")
    generated_at: datetime = Field(..., description="Report generation timestamp")
    period: dict[str, datetime] = Field(..., description="Report time period")
    metadata: dict[str, Any] | None = Field(None, description="Report metadata")

    @field_serializer("generated_at")
    def _serialize_generated_at(self, value: datetime) -> str:
        return _format_datetime(value)

    @field_serializer("period")
    def _serialize_report_period(self, value: dict[str, datetime]) -> dict[str, str]:
        return {key: _format_datetime(val) for key, val in value.items()}


class DashboardWidget(BaseModel):  # BaseModel resolves to Any in isolation
    """Dashboard widget data."""

    model_config = ConfigDict()

    widget_id: str = Field(..., description="Widget identifier")
    widget_type: str = Field(..., description="Widget type (chart, metric, table)")
    title: str = Field(..., description="Widget title")
    data: dict[str, Any] = Field(..., description="Widget data")
    config: dict[str, Any] | None = Field(None, description="Widget configuration")


class DashboardResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Dashboard data response."""

    model_config = ConfigDict(from_attributes=True)

    dashboard_id: str = Field(..., description="Dashboard ID")
    period: DashboardPeriod = Field(..., description="Dashboard time period")
    widgets: list[DashboardWidget] = Field(..., description="Dashboard widgets")
    generated_at: datetime = Field(..., description="Dashboard generation timestamp")
    refresh_interval: int | None = Field(60, description="Refresh interval in seconds")

    @field_serializer("generated_at")
    def _serialize_dashboard_generated_at(self, value: datetime) -> str:
        return _format_datetime(value)


# ========================================
# Error Response Models
# ========================================


class AnalyticsErrorResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Analytics error response."""

    model_config = ConfigDict()

    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    details: dict[str, Any] | None = Field(None, description="Error details")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC), description="Error timestamp"
    )
    request_id: str | None = Field(None, description="Request ID for debugging")


__all__ = [
    # Enums
    "EventType",
    "MetricUnit",
    "AggregationType",
    "TimeInterval",
    "ReportType",
    "DashboardPeriod",
    # Request Models
    "EventTrackRequest",
    "MetricRecordRequest",
    "AnalyticsQueryRequest",
    # Response Models
    "EventTrackResponse",
    "MetricRecordResponse",
    "MetricDataPoint",
    "MetricSeries",
    "EventData",
    "EventsQueryResponse",
    "MetricsQueryResponse",
    "AggregationResult",
    "AggregationQueryResponse",
    "ReportSection",
    "ReportResponse",
    "DashboardWidget",
    "DashboardResponse",
    "AnalyticsErrorResponse",
    "format_datetime",
]
