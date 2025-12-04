"""
Unified Analytics Core Infrastructure with OpenTelemetry.

This module provides the foundational components for centralized analytics
collection, processing, and export to SigNoz via OpenTelemetry.
"""

from .aggregators import (
    MetricAggregator,
    StatisticalAggregator,
    TimeWindowAggregator,
)
from .base import (
    AnalyticsCollector,
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    Metric,
    MetricType,
    SpanContext,
)
from .otel_collector import (
    OpenTelemetryCollector,
    OTelConfig,
    create_otel_collector,
)
from .service import AnalyticsService, get_analytics_service

__all__ = [
    # Base classes
    "AnalyticsCollector",
    "MetricType",
    "Metric",
    "CounterMetric",
    "GaugeMetric",
    "HistogramMetric",
    "SpanContext",
    # OpenTelemetry
    "OpenTelemetryCollector",
    "OTelConfig",
    "create_otel_collector",
    # Aggregators
    "MetricAggregator",
    "TimeWindowAggregator",
    "StatisticalAggregator",
    # Service
    "get_analytics_service",
    "AnalyticsService",
]
