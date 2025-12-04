"""
OpenTelemetry setup for distributed tracing and metrics.

Configures OTLP exporters and auto-instrumentation for FastAPI, SQLAlchemy, and HTTP clients.
"""

import os
import warnings
from collections.abc import Sequence
from weakref import WeakSet

import structlog
from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import (
    DEPLOYMENT_ENVIRONMENT,
    SERVICE_NAME,
    SERVICE_VERSION,
    Resource,
)
from opentelemetry.sdk.trace import ReadableSpan, TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SpanExporter, SpanExportResult
from opentelemetry.sdk.trace.sampling import TraceIdRatioBased
from structlog.typing import Processor

from dotmac.platform.settings import settings

# Silence third-party deprecation warning (OpenTelemetry still imports pkg_resources internally)
warnings.filterwarnings(
    "ignore",
    category=UserWarning,
    message="pkg_resources is deprecated as an API",
    module="opentelemetry.instrumentation.dependencies",
)

# Track which FastAPI apps have already been instrumented to avoid duplicate middleware wiring.
_FASTAPI_INSTRUMENTED_APPS: "WeakSet[FastAPI]" = WeakSet()


class ResilientOTLPExporter(SpanExporter):
    """Wraps OTLP exporter to handle connection failures gracefully."""

    def __init__(self, exporter: SpanExporter) -> None:
        self.exporter = exporter
        self._connection_failed = False
        self._logger = structlog.get_logger(__name__)

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        try:
            result = self.exporter.export(spans)
            if self._connection_failed:
                self._logger.info("OTLP connection restored")
                self._connection_failed = False
            return result
        except Exception as e:
            if not self._connection_failed:
                self._logger.warning("OTLP export failed - spans will be dropped", error=str(e))
                self._connection_failed = True
            return SpanExportResult.FAILURE

    def shutdown(self) -> None:
        try:
            self.exporter.shutdown()
        except Exception:
            pass

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        try:
            return self.exporter.force_flush(timeout_millis)
        except Exception:
            return False


def create_resource() -> Resource:
    """Create OpenTelemetry resource with service information."""
    resource_attributes = {
        SERVICE_NAME: settings.observability.otel_service_name,
        SERVICE_VERSION: settings.app_version,
        DEPLOYMENT_ENVIRONMENT: settings.environment.value,
    }

    # Add custom resource attributes from settings
    if settings.observability.otel_resource_attributes:
        resource_attributes.update(settings.observability.otel_resource_attributes)

    return Resource.create(resource_attributes)


def configure_structlog() -> None:
    """Configure structlog for structured logging."""
    processors: list[Processor] = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    # Add correlation ID processor if enabled
    if settings.observability.enable_correlation_ids:
        processors.insert(0, structlog.contextvars.merge_contextvars)

    # Use JSON or console output based on settings
    if settings.observability.log_format == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer())

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def setup_telemetry(app: FastAPI | None = None) -> None:
    """
    Setup structured logging and OpenTelemetry tracing/metrics.

    Args:
        app: Optional FastAPI application to instrument
    """
    # Configure structured logging first
    configure_structlog()

    logger = structlog.get_logger(__name__)

    # Skip telemetry setup in test environment to prevent export warnings
    if (
        os.environ.get("PYTEST_CURRENT_TEST")
        or os.environ.get("OTEL_ENABLED") == "false"
        or os.environ.get("DOTMAC_DISABLE_OTEL") == "1"
    ):
        logger.debug("Skipping OpenTelemetry setup in test environment")
        return

    # Auto-enable if endpoint is configured but OTEL is disabled
    if settings.observability.otel_endpoint and not settings.observability.otel_enabled:
        logger.info(
            "Auto-enabling OpenTelemetry due to configured endpoint",
            endpoint=settings.observability.otel_endpoint,
        )
        # We can't modify the settings object, but we can log the recommendation
        logger.warning("Consider setting OTEL_ENABLED=true explicitly in configuration")

    if not settings.observability.otel_enabled:
        logger.debug("OpenTelemetry is disabled by configuration")
        return

    # Check if OpenTelemetry packages are available
    try:
        from opentelemetry import metrics, trace  # noqa: F401
        from opentelemetry.exporter.otlp.proto.http.metric_exporter import (  # noqa: F401
            OTLPMetricExporter,
        )
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (  # noqa: F401
            OTLPSpanExporter,
        )
    except ImportError as e:
        logger.warning(
            "OpenTelemetry packages not installed - install with: poetry install --extras observability",
            error=str(e),
        )
        return

    # Create resource for all telemetry
    resource = create_resource()

    # Setup tracing
    if settings.observability.enable_tracing:
        setup_tracing(resource)

    # Setup metrics
    if settings.observability.enable_metrics:
        setup_metrics(resource)

    # Auto-instrument libraries
    instrument_libraries(app)

    logger.info(
        "OpenTelemetry telemetry configured successfully",
        service_name=settings.observability.otel_service_name,
        endpoint=settings.observability.otel_endpoint,
        tracing_enabled=settings.observability.enable_tracing,
        metrics_enabled=settings.observability.enable_metrics,
    )


def setup_tracing(resource: Resource) -> None:
    """Configure OpenTelemetry tracing with OTLP exporter."""
    logger = structlog.get_logger(__name__)
    try:
        # Create sampler based on configuration
        sampler = TraceIdRatioBased(settings.observability.tracing_sample_rate)

        # Create tracer provider with resource and sampler
        tracer_provider = TracerProvider(
            resource=resource,
            sampler=sampler,
        )

        if settings.observability.otel_endpoint:
            # For HTTP exporters, add the protocol-specific path
            endpoint = settings.observability.otel_endpoint
            if not endpoint.endswith("/v1/traces"):
                endpoint = f"{endpoint}/v1/traces"

            try:
                # Create OTLP exporter (HTTP protocol) with shorter timeout
                otlp_exporter = OTLPSpanExporter(
                    endpoint=endpoint,
                    timeout=5,  # 5 second timeout for dev (faster failure)
                )

                # Wrap with resilient exporter to handle connection failures
                resilient_exporter = ResilientOTLPExporter(otlp_exporter)

                # Add batch processor for efficient export
                span_processor = BatchSpanProcessor(
                    resilient_exporter,
                    max_queue_size=2048,
                    max_export_batch_size=512,
                    schedule_delay_millis=5000,  # 5 seconds
                )
                tracer_provider.add_span_processor(span_processor)

                logger.info(
                    "OpenTelemetry tracing configured with resilient OTLP exporter",
                    endpoint=endpoint,
                )
            except Exception as export_error:
                # If OTLP exporter fails, use console exporter for development
                logger.warning(
                    "OTLP exporter unavailable, using console exporter for development",
                    error=str(export_error),
                )
                try:
                    from opentelemetry.sdk.trace.export import ConsoleSpanExporter

                    console_exporter = ConsoleSpanExporter()
                    console_processor = BatchSpanProcessor(console_exporter)
                    tracer_provider.add_span_processor(console_processor)
                    logger.info("Console span exporter configured as fallback")
                except ImportError:
                    logger.warning("Console exporter not available, traces will not be exported")
        else:
            logger.warning("OpenTelemetry tracing enabled but no endpoint configured")

        # Set as global tracer provider
        trace.set_tracer_provider(tracer_provider)

    except Exception as e:
        logger.error("Failed to setup OpenTelemetry tracing", error=str(e), exc_info=True)


def setup_metrics(resource: Resource) -> None:
    """Configure OpenTelemetry metrics with OTLP exporter."""
    try:
        if settings.observability.otel_endpoint:
            # For HTTP exporters, add the protocol-specific path
            endpoint = settings.observability.otel_endpoint
            if not endpoint.endswith("/v1/metrics"):
                endpoint = f"{endpoint}/v1/metrics"

            # Create OTLP metric exporter (HTTP protocol)
            metric_exporter = OTLPMetricExporter(
                endpoint=endpoint,
                timeout=30,  # 30 second timeout
            )

            # Create periodic reader with configurable interval
            metric_reader = PeriodicExportingMetricReader(
                exporter=metric_exporter,
                export_interval_millis=60000,  # 60 seconds by default
                export_timeout_millis=30000,  # 30 second timeout
            )

            # Create meter provider with resource and reader
            meter_provider = MeterProvider(
                resource=resource,
                metric_readers=[metric_reader],
            )

            # Set as global meter provider
            metrics.set_meter_provider(meter_provider)

            structlog.get_logger(__name__).info(
                "OpenTelemetry metrics configured",
                endpoint=settings.observability.otel_endpoint,
            )
        else:
            # Create basic meter provider without exporter
            meter_provider = MeterProvider(resource=resource)
            metrics.set_meter_provider(meter_provider)
            structlog.get_logger(__name__).warning(
                "OpenTelemetry metrics enabled but no endpoint configured"
            )

    except Exception as e:
        structlog.get_logger(__name__).error(
            "Failed to setup OpenTelemetry metrics", error=str(e), exc_info=True
        )


def instrument_libraries(app: FastAPI | None = None) -> None:
    """Auto-instrument supported libraries based on settings."""
    from dotmac.platform.settings import settings

    # Instrument FastAPI if app provided and enabled
    if app and settings.observability.otel_instrument_fastapi:
        if app in _FASTAPI_INSTRUMENTED_APPS:
            structlog.get_logger(__name__).debug(
                "FastAPI instrumentation already applied", app_id=id(app)
            )
        else:
            try:
                FastAPIInstrumentor.instrument_app(
                    app,
                    tracer_provider=trace.get_tracer_provider(),
                    excluded_urls="health,ready,metrics",  # Don't trace health checks
                )
                _FASTAPI_INSTRUMENTED_APPS.add(app)
                structlog.get_logger(__name__).debug("FastAPI instrumentation enabled")
            except RuntimeError as e:
                message = str(e)
                if "Cannot add middleware after an application has started" in message:
                    structlog.get_logger(__name__).warning(
                        "FastAPI instrumentation skipped because the application already started",
                        error=message,
                    )
                else:
                    structlog.get_logger(__name__).warning(
                        "Failed to instrument FastAPI", error=message
                    )
            except Exception as e:
                structlog.get_logger(__name__).warning("Failed to instrument FastAPI", error=str(e))
    elif app:
        structlog.get_logger(__name__).debug("FastAPI instrumentation disabled by settings")

    # Instrument SQLAlchemy if enabled
    if settings.observability.otel_instrument_sqlalchemy:
        try:
            SQLAlchemyInstrumentor().instrument(
                tracer_provider=trace.get_tracer_provider(),
                enable_commenter=True,  # Add trace context to SQL comments
            )
            structlog.get_logger(__name__).debug("SQLAlchemy instrumentation enabled")
        except Exception as e:
            structlog.get_logger(__name__).warning("Failed to instrument SQLAlchemy", error=str(e))
    else:
        structlog.get_logger(__name__).debug("SQLAlchemy instrumentation disabled by settings")

    # Instrument HTTP requests if enabled
    if settings.observability.otel_instrument_requests:
        try:
            RequestsInstrumentor().instrument(
                tracer_provider=trace.get_tracer_provider(),
                excluded_urls="localhost,127.0.0.1",  # Don't trace local calls
            )
            structlog.get_logger(__name__).debug("Requests instrumentation enabled")
        except Exception as e:
            structlog.get_logger(__name__).warning("Failed to instrument requests", error=str(e))
    else:
        structlog.get_logger(__name__).debug("Requests instrumentation disabled by settings")


def get_tracer(name: str, version: str | None = None) -> trace.Tracer:
    """
    Get a tracer for the given component name.

    Args:
        name: Component/module name
        version: Optional component version

    Returns:
        OpenTelemetry Tracer instance
    """
    return trace.get_tracer(name, version or "")


def get_meter(name: str, version: str | None = None) -> metrics.Meter:
    """
    Get a meter for the given component name.

    Args:
        name: Component/module name
        version: Optional component version

    Returns:
        OpenTelemetry Meter instance
    """
    return metrics.get_meter(name, version or "")


def record_error(span: trace.Span, error: Exception) -> None:
    """
    Record an error in the current span.

    Args:
        span: Current span
        error: Exception to record
    """
    span.record_exception(error)
    span.set_status(trace.Status(trace.StatusCode.ERROR, str(error)))


def create_span_context(trace_id: str, span_id: str, is_remote: bool = True) -> trace.SpanContext:
    """
    Create a span context from trace and span IDs.

    Useful for continuing traces from external systems.

    Args:
        trace_id: Trace ID (32 hex chars)
        span_id: Span ID (16 hex chars)
        is_remote: Whether this is a remote span

    Returns:
        SpanContext instance
    """
    return trace.SpanContext(
        trace_id=int(trace_id, 16),
        span_id=int(span_id, 16),
        is_remote=is_remote,
        trace_flags=trace.TraceFlags(0x01),  # Sampled
    )


# Convenience exports for direct use
__all__ = [
    "configure_structlog",
    "setup_telemetry",
    "get_tracer",
    "get_meter",
    "record_error",
    "create_span_context",
]
