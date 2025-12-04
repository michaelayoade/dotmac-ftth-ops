"""
Analytics service factory and management.
"""

from typing import Any

import structlog

from .base import BaseAnalyticsCollector
from .otel_collector import create_otel_collector

logger = structlog.get_logger(__name__)

_collector_cache: dict[str, BaseAnalyticsCollector] = {}


class _AnalyticsServiceCache(dict[str, "AnalyticsService"]):
    def clear(self) -> None:  # noqa: D401 - standard dict clear semantics
        super().clear()
        _collector_cache.clear()


_service_cache: _AnalyticsServiceCache = _AnalyticsServiceCache()
# Backwards compatibility alias for tests and legacy code
_analytics_instances = _service_cache


class AnalyticsService:
    """Unified analytics service wrapper."""

    def __init__(self, collector: BaseAnalyticsCollector | None = None) -> None:
        self.collector = collector or create_otel_collector(
            tenant_id="default", service_name="platform"
        )
        self._events_store: list[dict[str, Any]] = []

    async def track_api_request(self, **kwargs: Any) -> None:
        """Track API request metrics."""
        await self.collector.record_metric(
            name="api_request", value=1, metric_type="counter", labels=kwargs
        )

    async def track_circuit_breaker(self, **kwargs: Any) -> None:
        """Track circuit breaker state."""
        await self.collector.record_metric(
            name="circuit_breaker_state", value=1, metric_type="gauge", labels=kwargs
        )

    async def track_rate_limit(self, **kwargs: Any) -> None:
        """Track rate limit metrics."""
        await self.collector.record_metric(
            name="rate_limit", value=kwargs.get("remaining", 0), metric_type="gauge", labels=kwargs
        )

    def get_aggregated_metrics(self, aggregation_type: str, time_window_seconds: int) -> Any:
        """Get aggregated metrics."""
        return self.collector.get_metrics_summary()

    async def track_event(self, **kwargs: Any) -> Any:
        """Track an analytics event."""
        event_id = f"event_{len(self._events_store) + 1}"
        self._events_store.append({"event_id": event_id, **kwargs})
        return event_id

    async def record_metric(self, **kwargs: Any) -> None:
        """
        Record a metric.

        Fixed: Now properly passes metric_type and unit parameters to collector
        instead of hardcoding everything as a gauge.

        Supported kwargs:
        - metric_name: Name of the metric
        - value: Numeric value
        - metric_type: Type of metric ("counter", "gauge", or "histogram")
        - unit: Unit of measurement (e.g., "ms", "bytes", "requests")
        - tags/labels: Dict of labels for the metric
        """
        metric_name = kwargs.get("metric_name", "custom_metric")
        value = kwargs.get("value", 1.0)
        metric_type = kwargs.get("metric_type", "gauge")  # Default to gauge for backwards compat
        unit = kwargs.get("unit")  # Optional unit
        labels = kwargs.get("tags", kwargs.get("labels", {}))  # Support both "tags" and "labels"

        await self.collector.record_metric(
            name=metric_name,
            value=value,
            metric_type=metric_type,  # Pass the actual type
            unit=unit,  # Pass the unit
            labels=labels,
        )

    async def query_events(self, **kwargs: Any) -> Any:
        """Query stored events."""
        from datetime import datetime

        # Simple filtering for demo
        events = self._events_store
        if "user_id" in kwargs:
            events = [e for e in events if e.get("user_id") == kwargs["user_id"]]
        if "event_type" in kwargs:
            events = [e for e in events if e.get("event_type") == kwargs["event_type"]]

        # Filter by date range
        if "start_date" in kwargs and kwargs["start_date"]:
            start_date = kwargs["start_date"]
            events = [
                e
                for e in events
                if e.get("timestamp")
                and (
                    isinstance(e["timestamp"], datetime)
                    and e["timestamp"] >= start_date
                    or isinstance(e["timestamp"], str)
                    and datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")) >= start_date
                )
            ]
        if "end_date" in kwargs and kwargs["end_date"]:
            end_date = kwargs["end_date"]
            events = [
                e
                for e in events
                if e.get("timestamp")
                and (
                    isinstance(e["timestamp"], datetime)
                    and e["timestamp"] <= end_date
                    or isinstance(e["timestamp"], str)
                    and datetime.fromisoformat(e["timestamp"].replace("Z", "+00:00")) <= end_date
                )
            ]

        return events[: kwargs.get("limit", 100)]

    async def query_metrics(self, **kwargs: Any) -> Any:
        """
        Query metrics with optional filtering.

        Fixed: Now respects query parameters instead of ignoring them.

        Supported kwargs:
        - metric_name: Filter to specific metric name (partial match)
        - start_date: Start of time range (TODO: requires time-series storage)
        - end_date: End of time range (TODO: requires time-series storage)
        - aggregation: Aggregation type (TODO: requires time-series storage)
        - interval: Time interval (TODO: requires time-series storage)

        Returns:
            Metrics summary, optionally filtered by metric_name
        """
        # Get full summary from collector
        summary = self.collector.get_metrics_summary()

        # If no metric_name filter, return everything
        metric_name_filter = kwargs.get("metric_name")
        if not metric_name_filter:
            # Note: start_date, end_date, aggregation, interval are not yet supported
            # without time-series storage. For now, return the current snapshot.
            if kwargs.get("start_date") or kwargs.get("end_date"):
                # Log warning that time-series filtering is not implemented
                import structlog

                logger = structlog.get_logger(__name__)
                logger.warning(
                    "Time-series filtering not yet implemented in query_metrics",
                    start_date=kwargs.get("start_date"),
                    end_date=kwargs.get("end_date"),
                    note="Returning current snapshot only",
                )
            return summary

        # Filter by metric_name (partial match, case-insensitive)
        filtered_summary: dict[str, Any] = {
            "timestamp": summary.get("timestamp"),
            "service": summary.get("service"),
            "tenant": summary.get("tenant"),
            "counters": {},
            "gauges": {},
            "histograms": {},
        }

        metric_name_lower = metric_name_filter.lower()

        # Filter counters
        counters = summary.get("counters", {})
        if isinstance(counters, dict):
            filtered_summary["counters"] = {
                name: value for name, value in counters.items() if metric_name_lower in name.lower()
            }

        # Filter gauges
        gauges = summary.get("gauges", {})
        if isinstance(gauges, dict):
            filtered_summary["gauges"] = {
                name: value for name, value in gauges.items() if metric_name_lower in name.lower()
            }

        # Filter histograms
        histograms = summary.get("histograms", {})
        if isinstance(histograms, dict):
            filtered_summary["histograms"] = {
                name: value
                for name, value in histograms.items()
                if metric_name_lower in name.lower()
            }

        return filtered_summary

    async def aggregate_data(self, **kwargs: Any) -> Any:
        """Aggregate analytics data."""
        return {
            "total_events": len(self._events_store),
            "metrics_summary": self.collector.get_metrics_summary(),
        }

    async def generate_report(self, **kwargs: Any) -> Any:
        """Generate analytics report."""
        return {
            "type": kwargs.get("report_type", "summary"),
            "data": {
                "events_count": len(self._events_store),
                "metrics": self.collector.get_metrics_summary(),
            },
        }

    async def get_dashboard_data(self, **kwargs: Any) -> Any:
        """Get dashboard data."""
        return {
            "widgets": [
                {"type": "counter", "value": len(self._events_store), "label": "Total Events"},
                {"type": "metrics", "data": self.collector.get_metrics_summary()},
            ]
        }

    async def close(self) -> None:
        """Close the analytics service."""
        await self.collector.flush()

    def create_request_span(self, endpoint: str, method: str, attributes: dict[str, Any]) -> Any:
        """Create a request span for tracing."""
        return self.collector.tracer.start_span(name=f"{method} {endpoint}", attributes=attributes)


def get_analytics_service(
    tenant_id: str = "default",
    service_name: str = "platform",
    signoz_endpoint: str | None = None,
    **kwargs: Any,
) -> AnalyticsService:
    """
    Get or create an analytics service instance.

    Args:
        tenant_id: Tenant identifier
        service_name: Service name for telemetry
        signoz_endpoint: Optional SigNoz endpoint

    Returns:
        AnalyticsService instance
    """
    cache_key = f"{tenant_id}:{service_name}"

    if cache_key in _service_cache:
        return _service_cache[cache_key]

    if cache_key not in _collector_cache:
        endpoint = signoz_endpoint or kwargs.get("otlp_endpoint")
        environment = kwargs.get("environment", "development")

        collector = create_otel_collector(
            tenant_id=tenant_id,
            service_name=f"{service_name}-{tenant_id}",
            endpoint=endpoint,
            environment=environment,
        )
        _collector_cache[cache_key] = collector
        logger.info(f"Created analytics service for {cache_key}")

    service = AnalyticsService(_collector_cache[cache_key])
    _service_cache[cache_key] = service
    return service
