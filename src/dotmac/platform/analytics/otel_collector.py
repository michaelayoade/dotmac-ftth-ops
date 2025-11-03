"""
OpenTelemetry collector implementation for SigNoz integration.
"""

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import structlog

# Optional OpenTelemetry imports
from ..dependencies import safe_import
from ..settings import settings
from ..version import get_version
from .base import (
    BaseAnalyticsCollector,
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    Metric,
)

# Only import OpenTelemetry if enabled and available
metrics: Any = None
trace: Any = None
Tracer: Any = None
OTLPMetricExporter: Any = None
OTLPSpanExporter: Any = None
CallbackOptions: Any = None
Observation: Any = None
MeterProvider: Any = None
PeriodicExportingMetricReader: Any = None
Resource: Any = None
TracerProvider: Any = None
BatchSpanProcessor: Any = None
Status: Any = None
StatusCode: Any = None

if settings.observability.otel_enabled:
    metrics_module = safe_import(
        "opentelemetry.metrics",
        "otel_enabled",
        error_if_missing=False,
    )
    if metrics_module:
        metrics = metrics_module
        CallbackOptions = metrics_module.CallbackOptions
        Observation = metrics_module.Observation

    trace_module = safe_import(
        "opentelemetry.trace",
        "otel_enabled",
        error_if_missing=False,
    )
    if trace_module:
        trace = trace_module
        Tracer = trace_module.Tracer
        Status = trace_module.Status
        StatusCode = trace_module.StatusCode

    metric_exporter_module = safe_import(
        "opentelemetry.exporter.otlp.proto.grpc.metric_exporter",
        "otel_enabled",
        error_if_missing=False,
    )
    if metric_exporter_module:
        OTLPMetricExporter = metric_exporter_module.OTLPMetricExporter

    trace_exporter_module = safe_import(
        "opentelemetry.exporter.otlp.proto.grpc.trace_exporter",
        "otel_enabled",
        error_if_missing=False,
    )
    if trace_exporter_module:
        OTLPSpanExporter = trace_exporter_module.OTLPSpanExporter

    sdk_metrics = safe_import(
        "opentelemetry.sdk.metrics",
        "otel_enabled",
        error_if_missing=False,
    )
    if sdk_metrics:
        MeterProvider = sdk_metrics.MeterProvider

    metrics_export = safe_import(
        "opentelemetry.sdk.metrics.export",
        "otel_enabled",
        error_if_missing=False,
    )
    if metrics_export:
        PeriodicExportingMetricReader = metrics_export.PeriodicExportingMetricReader

    sdk_resources = safe_import(
        "opentelemetry.sdk.resources",
        "otel_enabled",
        error_if_missing=False,
    )
    if sdk_resources:
        Resource = sdk_resources.Resource

    sdk_trace = safe_import(
        "opentelemetry.sdk.trace",
        "otel_enabled",
        error_if_missing=False,
    )
    if sdk_trace:
        TracerProvider = sdk_trace.TracerProvider

    sdk_trace_export = safe_import(
        "opentelemetry.sdk.trace.export",
        "otel_enabled",
        error_if_missing=False,
    )
    if sdk_trace_export:
        BatchSpanProcessor = sdk_trace_export.BatchSpanProcessor

logger = structlog.get_logger(__name__)


@dataclass
class OTelConfig:
    """OpenTelemetry configuration for SigNoz."""

    endpoint: str = "localhost:4317"
    service_name: str = "dotmac-business-services"
    environment: str = "development"
    insecure: bool = True
    headers: dict[str, str] | str | None = None
    export_interval_millis: int = 5000
    max_export_batch_size: int = 512
    max_queue_size: int = 2048
    signoz_endpoint: str | None = None
    otlp_endpoint: str | None = None

    def __post_init__(self) -> None:
        """Normalize endpoint aliases and header formats."""
        if self.endpoint == "localhost:4317":
            if self.signoz_endpoint:
                self.endpoint = self.signoz_endpoint
            elif self.otlp_endpoint:
                self.endpoint = self.otlp_endpoint

        if isinstance(self.headers, str):
            parsed_headers: dict[str, str] = {}
            for item in self.headers.split(","):
                if "=" not in item:
                    continue
                key, value = item.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key:
                    parsed_headers[key] = value
            self.headers = parsed_headers or None


class OpenTelemetryCollector(BaseAnalyticsCollector):
    """
    OpenTelemetry collector for sending metrics and traces to SigNoz.
    """

    def __init__(
        self,
        tenant_id: str,
        service_name: str,
        config: OTelConfig,
    ):
        """
        Initialize OpenTelemetry collector.

        Args:
            tenant_id: Tenant identifier
            service_name: Service name for identification
            config: OpenTelemetry configuration
        """
        super().__init__(tenant_id, service_name)
        self.config = config
        self.meter: Any | None = None
        self._tracer: Any = None  # Will be set during initialization
        self._version = get_version()

        # Initialize resource attributes
        if Resource:
            resource = Resource.create(
                {
                    "service.name": service_name,
                    "service.namespace": "dotmac",
                    "service.version": self._version,
                    "deployment.environment": config.environment,
                    "tenant.id": tenant_id,
                }
            )

            # Initialize metrics
            if metrics and MeterProvider:
                self._init_metrics(resource)
            else:
                self.meter = None

            # Initialize tracing
            if trace and TracerProvider:
                self._init_tracing(resource)
            else:
                self._tracer = DummyTracer()
        else:
            # Fallback if Resource is not available
            self.meter = None
            self._tracer = DummyTracer()

        # Metric instruments cache
        self._counters: dict[str, Any] = {}
        self._gauges: dict[str, Any] = {}
        self._histograms: dict[str, Any] = {}
        self._updown_counters: dict[str, Any] = {}
        self._gauge_values: dict[str, dict[tuple[Any, ...], float]] = {}

        # Lightweight in-memory summary for quick aggregation in tests and admin endpoints
        self._metrics_summary: dict[str, dict[str, Any]] = {
            "counters": {},
            "gauges": {},
            "histograms": {},
        }

    def _init_metrics(self, resource: Any) -> None:
        """Initialize OpenTelemetry metrics."""
        # Skip OTLP export in test environment to prevent connection warnings
        import os

        if metrics is None or MeterProvider is None:
            logger.warning("OpenTelemetry metrics unavailable; skipping meter initialization")
            self.meter = None
            return

        is_test_env = (
            os.environ.get("PYTEST_CURRENT_TEST")
            or os.environ.get("OTEL_ENABLED") == "false"
            or self.config.environment == "test"
        )

        provider: Any
        if is_test_env or not self.config.endpoint or self.config.endpoint == "localhost:4317":
            # Use in-memory provider for tests
            logger.debug("Using in-memory metrics provider for test environment")
            provider = MeterProvider(resource=resource)
        else:
            # Create OTLP metric exporter for SigNoz
            if OTLPMetricExporter is None or PeriodicExportingMetricReader is None:
                logger.warning(
                    "OTLP metric exporter not available; falling back to in-memory provider"
                )
                provider = MeterProvider(resource=resource)
            else:
                try:
                    metric_exporter = OTLPMetricExporter(
                        endpoint=self.config.endpoint,
                        insecure=self.config.insecure,
                        headers=self.config.headers,
                    )

                    metric_reader = PeriodicExportingMetricReader(
                        exporter=metric_exporter,
                        export_interval_millis=self.config.export_interval_millis,
                    )

                    provider = MeterProvider(
                        resource=resource,
                        metric_readers=[metric_reader],
                    )
                except Exception as exc:  # pragma: no cover - defensive guard for tests
                    logger.warning(f"Falling back to in-memory metrics provider: {exc}")
                    provider = MeterProvider(resource=resource)

        metrics.set_meter_provider(provider)

        # Get meter for this service
        self.meter = metrics.get_meter(
            name=self.service_name,
            version=self._version,
        )

    def _init_tracing(self, resource: Any) -> None:
        """Initialize OpenTelemetry tracing."""
        # Skip OTLP export in test environment to prevent connection warnings
        import os

        if trace is None or TracerProvider is None:
            logger.warning("OpenTelemetry tracing unavailable; using dummy tracer")
            self._tracer = DummyTracer()
            return

        is_test_env = (
            os.environ.get("PYTEST_CURRENT_TEST")
            or os.environ.get("OTEL_ENABLED") == "false"
            or self.config.environment == "test"
        )

        provider: Any
        if is_test_env or not self.config.endpoint or self.config.endpoint == "localhost:4317":
            # Use in-memory provider for tests
            logger.debug("Using in-memory tracing provider for test environment")
            provider = TracerProvider(resource=resource)
        else:
            # Create OTLP span exporter for SigNoz
            if OTLPSpanExporter is None or BatchSpanProcessor is None:
                logger.warning(
                    "OTLP span exporter not available; falling back to in-memory tracing provider"
                )
                provider = TracerProvider(resource=resource)
            else:
                try:
                    span_exporter = OTLPSpanExporter(
                        endpoint=self.config.endpoint,
                        insecure=self.config.insecure,
                        headers=self.config.headers,
                    )

                    provider = TracerProvider(resource=resource)
                    span_processor = BatchSpanProcessor(
                        span_exporter,
                        max_queue_size=self.config.max_queue_size,
                        max_export_batch_size=self.config.max_export_batch_size,
                    )
                    provider.add_span_processor(span_processor)
                except Exception as exc:  # pragma: no cover - defensive guard for tests
                    logger.warning(f"Falling back to in-memory tracing provider: {exc}")
                    provider = TracerProvider(resource=resource)

        # Set global tracer provider
        trace.set_tracer_provider(provider)

        # Get tracer for this service
        self._tracer = trace.get_tracer(
            instrumenting_module_name=self.service_name,
            instrumenting_library_version=self._version,
        )

    def _get_or_create_counter(self, metric: CounterMetric) -> Any:
        """Get or create a counter instrument."""
        if self.meter is None:
            raise RuntimeError("Meter not initialized")
        if metric.name not in self._counters:
            self._counters[metric.name] = self.meter.create_counter(
                name=metric.name,
                unit=metric.unit or "1",
                description=metric.description or f"Counter for {metric.name}",
            )
        return self._counters[metric.name]

    def _get_or_create_gauge(self, metric: GaugeMetric) -> Any:
        """Get or create a gauge instrument."""
        if self.meter is None:
            raise RuntimeError("Meter not initialized")
        if metric.name not in self._gauges:
            # Store gauge values for async callback
            self._gauge_values[metric.name] = {}

            def gauge_callback(options: Any) -> list[Any]:
                """Callback for observable gauge."""
                observations = []
                if Observation:
                    for attrs_key, value in self._gauge_values.get(metric.name, {}).items():
                        observations.append(Observation(value=value, attributes=dict(attrs_key)))
                return observations

            self._gauges[metric.name] = self.meter.create_observable_gauge(
                name=metric.name,
                callbacks=[gauge_callback],
                unit=metric.unit or "1",
                description=metric.description or f"Gauge for {metric.name}",
            )
        return self._gauges[metric.name]

    def _get_or_create_histogram(self, metric: HistogramMetric) -> Any:
        """Get or create a histogram instrument."""
        if self.meter is None:
            raise RuntimeError("Meter not initialized")
        if metric.name not in self._histograms:
            self._histograms[metric.name] = self.meter.create_histogram(
                name=metric.name,
                unit=metric.unit or "1",
                description=metric.description or f"Histogram for {metric.name}",
            )
        return self._histograms[metric.name]

    async def collect(self, metric: Metric) -> None:
        """
        Collect a single metric and send to SigNoz.

        Args:
            metric: Metric to collect
        """
        # Enrich metric with context
        metric = self._enrich_metric(metric)

        # Convert to OpenTelemetry attributes
        attributes = metric.to_otel_attributes()

        try:
            if isinstance(metric, HistogramMetric):
                summary = self._metrics_summary["histograms"].setdefault(
                    metric.name,
                    {"count": 0, "sum": 0.0, "min": None, "max": None},
                )
                summary["count"] += 1
                summary["sum"] += metric.value
                summary["avg"] = summary["sum"] / summary["count"]
                summary["min"] = (
                    metric.value if summary["min"] is None else min(summary["min"], metric.value)
                )
                summary["max"] = (
                    metric.value if summary["max"] is None else max(summary["max"], metric.value)
                )

            if self.meter is None:
                return

            if isinstance(metric, CounterMetric):
                counter = self._get_or_create_counter(metric)
                counter.add(metric.delta, attributes)

            elif isinstance(metric, GaugeMetric):
                # Store value for async callback
                attrs_key = tuple(sorted(attributes.items()))
                self._gauge_values.setdefault(metric.name, {})[attrs_key] = metric.value

            elif isinstance(metric, HistogramMetric):
                histogram = self._get_or_create_histogram(metric)
                histogram.record(metric.value, attributes)

            else:
                logger.warning(f"Unsupported metric type: {metric.type}")

        except Exception as e:
            logger.error(f"Failed to collect metric {metric.name}: {e}")

    async def collect_batch(self, metrics: list[Metric]) -> None:
        """
        Collect multiple metrics in batch.

        Args:
            metrics: List of metrics to collect
        """
        for metric in metrics:
            await self.collect(metric)

    async def record_metric(
        self,
        name: str,
        value: float | int,
        metric_type: str = "gauge",
        labels: dict[str, Any] | None = None,
        unit: str | None = None,
        description: str | None = None,
    ) -> None:
        """Convenience helper for recording ad-hoc metrics.

        Args:
            name: Metric name
            value: Metric value (interpreted per metric_type)
            metric_type: counter | gauge | histogram
            labels: Optional attributes for the metric
            unit: Optional measurement unit
            description: Optional metric description
        """

        metric_type = (metric_type or "gauge").lower()
        labels = labels or {}

        try:
            if metric_type == "counter":
                delta = float(value)
                if delta < 0:
                    raise ValueError("Counter metrics require non-negative values")
                metric_obj: Metric = CounterMetric(
                    name=name,
                    delta=delta,
                    tenant_id=self.tenant_id,
                    unit=unit,
                    description=description,
                    attributes=labels,
                )
                summary = self._metrics_summary["counters"]
                summary[name] = summary.get(name, 0.0) + delta

            elif metric_type == "histogram":
                metric_obj = HistogramMetric(
                    name=name,
                    value=float(value),
                    tenant_id=self.tenant_id,
                    unit=unit,
                    description=description,
                    attributes=labels,
                )

            else:
                metric_obj = GaugeMetric(
                    name=name,
                    value=float(value),
                    tenant_id=self.tenant_id,
                    unit=unit,
                    description=description,
                    attributes=labels,
                )
                self._metrics_summary["gauges"][name] = {
                    "value": float(value),
                    "labels": labels,
                }

            await self.collect(metric_obj)

        except Exception as exc:
            logger.error(f"Failed to record metric {name}: {exc}")

    def get_metrics_summary(self) -> dict[str, Any]:
        """Return a snapshot of recently recorded metrics."""

        histogram_snapshot: dict[str, Any] = {}
        for key, stats in self._metrics_summary["histograms"].items():
            histogram_snapshot[key] = {
                "count": stats.get("count", 0),
                "sum": stats.get("sum", 0.0),
                "avg": stats.get("avg", 0.0),
                "min": stats.get("min"),
                "max": stats.get("max"),
            }

        return {
            "timestamp": datetime.now(UTC).isoformat(),
            "service": self.service_name,
            "tenant": self.tenant_id,
            "counters": dict(self._metrics_summary["counters"]),
            "gauges": {
                key: {
                    "value": payload.get("value"),
                    "labels": payload.get("labels", {}),
                }
                for key, payload in self._metrics_summary["gauges"].items()
            },
            "histograms": histogram_snapshot,
        }

    @property
    def tracer(self) -> Any:
        """Get the tracer for distributed tracing."""
        return self._tracer

    def create_span(
        self,
        name: str,
        attributes: dict[str, Any] | None = None,
        kind: Any | None = None,
    ) -> Any:
        """
        Create a new span for distributed tracing.

        Args:
            name: Span name
            attributes: Span attributes
            kind: Span kind

        Returns:
            OpenTelemetry span
        """
        if not kind and trace:
            kind = trace.SpanKind.INTERNAL if hasattr(trace, "SpanKind") else None

        span = self._tracer.start_span(
            name=name,
            attributes=attributes or {},
            kind=kind,
        )
        return span

    def record_exception(self, span: Any, exception: Exception) -> None:
        """
        Record an exception in a span.

        Args:
            span: Current span
            exception: Exception to record
        """
        if hasattr(span, "record_exception"):
            span.record_exception(exception)
        if Status and StatusCode and hasattr(span, "set_status"):
            span.set_status(Status(StatusCode.ERROR, str(exception)))

    async def close(self) -> None:
        """Close the collector and flush pending data."""
        await self.flush()

        meter_provider = None
        if metrics and hasattr(metrics, "get_meter_provider"):
            try:
                meter_provider = metrics.get_meter_provider()
            except Exception:  # pragma: no cover - defensive guard
                meter_provider = None

        tracer_provider = None
        if trace and hasattr(trace, "get_tracer_provider"):
            try:
                tracer_provider = trace.get_tracer_provider()
            except Exception:  # pragma: no cover - defensive guard
                tracer_provider = None

        in_test_mode = (
            os.environ.get("PYTEST_CURRENT_TEST")
            or getattr(self.config, "environment", "") == "test"
            or os.environ.get("OTEL_ENABLED") == "false"
        )

        if not in_test_mode:
            if meter_provider and hasattr(meter_provider, "shutdown"):
                meter_provider.shutdown()
            if tracer_provider and hasattr(tracer_provider, "shutdown"):
                tracer_provider.shutdown()
        else:
            # Avoid shutting down global providers during tests; just flush buffers.
            if meter_provider and hasattr(meter_provider, "force_flush"):
                meter_provider.force_flush()
            if tracer_provider and hasattr(tracer_provider, "force_flush"):
                tracer_provider.force_flush()


class SimpleAnalyticsCollector(BaseAnalyticsCollector):
    """Simple in-memory analytics collector for when OpenTelemetry is not available."""

    def __init__(self, tenant_id: str, service_name: str) -> None:
        super().__init__(tenant_id, service_name)
        self.metrics_store: list[Metric] = []
        self._metrics_summary: dict[str, dict[str, Any]] = {
            "counters": {},
            "gauges": {},
            "histograms": {},
        }

    async def collect(self, metric: Metric) -> None:
        """Collect a single metric."""
        enriched = self._enrich_metric(metric)
        self.metrics_store.append(enriched)

    async def collect_batch(self, metrics: list[Metric]) -> None:
        """Collect multiple metrics."""
        for metric in metrics:
            await self.collect(metric)

    def get_metrics_summary(self) -> dict[str, Any]:
        """Get a summary of collected metrics."""
        return {
            "tenant": self.tenant_id,
            "counters": dict(self._metrics_summary["counters"]),
            "gauges": dict(self._metrics_summary["gauges"]),
            "histograms": dict(self._metrics_summary["histograms"]),
        }

    async def record_metric(
        self,
        name: str,
        value: float,
        metric_type: str = "gauge",
        labels: dict[str, Any] | None = None,
        unit: str | None = None,
        description: str | None = None,
    ) -> None:
        """Record a metric."""
        metric_obj: Metric
        if metric_type == "counter":
            self._metrics_summary["counters"][name] = (
                self._metrics_summary["counters"].get(name, 0) + value
            )
            metric_obj = CounterMetric(
                name=name,
                delta=value,
                tenant_id=self.tenant_id,
                unit=unit,
                description=description,
                attributes=labels or {},
            )
        else:
            self._metrics_summary["gauges"][name] = {
                "value": float(value),
                "labels": labels or {},
            }
            metric_obj = GaugeMetric(
                name=name,
                value=value,
                tenant_id=self.tenant_id,
                unit=unit,
                description=description,
                attributes=labels or {},
            )

        await self.collect(metric_obj)

    @property
    def tracer(self) -> Any:
        """Return a dummy tracer for compatibility."""
        return DummyTracer()

    def create_span(
        self, name: str, attributes: dict[str, Any] | None = None, kind: Any | None = None
    ) -> "DummySpan":
        """Create a dummy span."""
        return DummySpan(name, attributes)

    def record_exception(self, span: Any, exception: Exception) -> None:
        """Record an exception in a span - no-op for simple collector."""
        pass


class DummyTracer:
    """Dummy tracer for when OpenTelemetry is not available."""

    def start_span(
        self, name: str, attributes: dict[str, Any] | None = None, kind: Any | None = None
    ) -> "DummySpan":
        """Create a dummy span."""
        return DummySpan(name, attributes)


class DummySpan:
    """Dummy span for when OpenTelemetry is not available."""

    def __init__(self, name: str, attributes: dict[str, Any] | None = None) -> None:
        self.name = name
        self.attributes = attributes or {}

    def __enter__(self) -> "DummySpan":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: Any,
    ) -> None:
        pass

    def set_attribute(self, key: str, value: Any) -> None:
        self.attributes[key] = value

    def set_status(self, status: Any) -> None:
        pass

    def record_exception(self, exception: Exception) -> None:
        pass


def create_otel_collector(
    tenant_id: str,
    service_name: str = "dotmac-business",
    endpoint: str | None = None,
    environment: str | None = None,
) -> BaseAnalyticsCollector:
    """
    Create an analytics collector with default configuration.

    Args:
        tenant_id: Tenant identifier
        service_name: Service name
        endpoint: SigNoz endpoint (default: localhost:4317)
        environment: Environment name (default: development)

    Returns:
        Configured analytics collector (OpenTelemetryCollector or SimpleAnalyticsCollector)
    """
    # Check if OpenTelemetry is available and enabled
    if trace and metrics and Resource and settings.observability.otel_enabled:
        config = OTelConfig(
            endpoint=endpoint or "localhost:4317",
            service_name=service_name,
            environment=environment or "development",
        )

        return OpenTelemetryCollector(
            tenant_id=tenant_id,
            service_name=service_name,
            config=config,
        )
    else:
        # Return a simple in-memory collector as fallback
        logger.info("OpenTelemetry not available, using simple in-memory collector")
        return SimpleAnalyticsCollector(
            tenant_id=tenant_id,
            service_name=service_name,
        )
