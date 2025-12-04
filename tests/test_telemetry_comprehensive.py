"""
Comprehensive tests for telemetry.py to improve coverage from 30.14%.

Tests cover:
- Resource creation with service information
- Structlog configuration
- Telemetry setup and initialization
- Tracing setup with OTLP exporter
- Metrics setup with OTLP exporter
- Library instrumentation (FastAPI, SQLAlchemy, Requests)
- Tracer and meter getters
- Error recording
- Span context creation
- Test environment detection
"""

import os
from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI

from dotmac.platform.telemetry import (
    configure_structlog,
    create_resource,
    create_span_context,
    get_meter,
    get_tracer,
    instrument_libraries,
    record_error,
    setup_metrics,
    setup_telemetry,
    setup_tracing,
)
from dotmac.platform.version import get_version

CURRENT_VERSION = get_version()


@pytest.mark.integration
class TestCreateResource:
    """Test OpenTelemetry resource creation."""

    @patch("dotmac.platform.telemetry.settings")
    def test_create_resource_basic(self, mock_settings):
        """Test creating resource with basic attributes."""
        mock_settings.observability.otel_service_name = "test-service"
        mock_settings.app_version = CURRENT_VERSION
        mock_settings.environment.value = "development"
        mock_settings.observability.otel_resource_attributes = None

        resource = create_resource()

        assert resource is not None
        attrs = resource.attributes
        assert attrs["service.name"] == "test-service"
        assert attrs["service.version"] == CURRENT_VERSION
        assert attrs["deployment.environment"] == "development"

    @patch("dotmac.platform.telemetry.settings")
    def test_create_resource_with_custom_attributes(self, mock_settings):
        """Test creating resource with custom attributes."""
        mock_settings.observability.otel_service_name = "test-service"
        mock_settings.app_version = "2.0.0"
        mock_settings.environment.value = "production"
        mock_settings.observability.otel_resource_attributes = {
            "custom.attr": "value",
            "team": "platform",
        }

        resource = create_resource()

        attrs = resource.attributes
        assert attrs["service.name"] == "test-service"
        assert attrs["custom.attr"] == "value"
        assert attrs["team"] == "platform"


@pytest.mark.integration
class TestConfigureStructlog:
    """Test structlog configuration."""

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.structlog.configure")
    def test_configure_structlog_json_format(self, mock_configure, mock_settings):
        """Test structlog configuration with JSON format."""
        mock_settings.observability.log_format = "json"
        mock_settings.observability.enable_correlation_ids = False

        configure_structlog()

        mock_configure.assert_called_once()
        call_args = mock_configure.call_args
        assert "processors" in call_args.kwargs
        assert "wrapper_class" in call_args.kwargs

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.structlog.configure")
    def test_configure_structlog_console_format(self, mock_configure, mock_settings):
        """Test structlog configuration with console format."""
        mock_settings.observability.log_format = "console"
        mock_settings.observability.enable_correlation_ids = False

        configure_structlog()

        mock_configure.assert_called_once()

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.structlog.configure")
    def test_configure_structlog_with_correlation_ids(self, mock_configure, mock_settings):
        """Test structlog configuration with correlation IDs enabled."""
        mock_settings.observability.log_format = "json"
        mock_settings.observability.enable_correlation_ids = True

        configure_structlog()

        mock_configure.assert_called_once()


@pytest.mark.integration
class TestSetupTelemetry:
    """Test main telemetry setup function."""

    @patch.dict(os.environ, {"PYTEST_CURRENT_TEST": "test"}, clear=False)
    @patch("dotmac.platform.telemetry.configure_structlog")
    def test_setup_telemetry_skips_in_test(self, mock_configure):
        """Test telemetry setup is skipped in test environment."""
        setup_telemetry()

        # Should only configure structlog, skip OTEL
        mock_configure.assert_called_once()

    @patch.dict(os.environ, {"OTEL_ENABLED": "false"}, clear=False)
    @patch("dotmac.platform.telemetry.configure_structlog")
    def test_setup_telemetry_skips_when_disabled(self, mock_configure):
        """Test telemetry setup is skipped when explicitly disabled."""
        setup_telemetry()

        mock_configure.assert_called_once()

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.configure_structlog")
    def test_setup_telemetry_disabled_by_config(self, mock_configure, mock_settings):
        """Test telemetry setup when OTEL is disabled in config."""
        mock_settings.observability.otel_enabled = False
        mock_settings.observability.otel_endpoint = None

        setup_telemetry()

        mock_configure.assert_called_once()

    @patch.dict(os.environ, {}, clear=True)
    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.configure_structlog")
    @patch("dotmac.platform.telemetry.create_resource")
    @patch("dotmac.platform.telemetry.setup_tracing")
    @patch("dotmac.platform.telemetry.setup_metrics")
    @patch("dotmac.platform.telemetry.instrument_libraries")
    def test_setup_telemetry_full_setup(
        self,
        mock_instrument,
        mock_setup_metrics,
        mock_setup_tracing,
        mock_create_resource,
        mock_configure,
        mock_settings,
    ):
        """Test full telemetry setup when enabled."""
        mock_settings.observability.otel_enabled = True
        mock_settings.observability.otel_endpoint = "http://otel:4317"
        mock_settings.observability.enable_tracing = True
        mock_settings.observability.enable_metrics = True
        mock_settings.observability.otel_service_name = "test-service"

        mock_resource = Mock()
        mock_create_resource.return_value = mock_resource

        app = FastAPI()
        setup_telemetry(app)

        mock_configure.assert_called_once()
        mock_create_resource.assert_called_once()
        mock_setup_tracing.assert_called_once_with(mock_resource)
        mock_setup_metrics.assert_called_once_with(mock_resource)
        mock_instrument.assert_called_once_with(app)


@pytest.mark.integration
class TestSetupTracing:
    """Test tracing setup."""

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.TracerProvider")
    @patch("dotmac.platform.telemetry.OTLPSpanExporter")
    @patch("dotmac.platform.telemetry.BatchSpanProcessor")
    @patch("dotmac.platform.telemetry.trace.set_tracer_provider")
    def test_setup_tracing_with_endpoint(
        self,
        mock_set_provider,
        mock_batch_processor,
        mock_exporter,
        mock_tracer_provider,
        mock_settings,
    ):
        """Test tracing setup with OTLP endpoint configured."""
        mock_settings.observability.otel_endpoint = "http://otel:4317"
        mock_settings.observability.tracing_sample_rate = 1.0

        mock_resource = Mock()
        mock_provider = Mock()
        mock_tracer_provider.return_value = mock_provider

        setup_tracing(mock_resource)

        mock_tracer_provider.assert_called_once()
        mock_exporter.assert_called_once()
        mock_set_provider.assert_called_once_with(mock_provider)

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.TracerProvider")
    @patch("dotmac.platform.telemetry.trace.set_tracer_provider")
    def test_setup_tracing_without_endpoint(
        self, mock_set_provider, mock_tracer_provider, mock_settings
    ):
        """Test tracing setup without endpoint."""
        mock_settings.observability.otel_endpoint = None
        mock_settings.observability.tracing_sample_rate = 1.0

        mock_resource = Mock()
        mock_provider = Mock()
        mock_tracer_provider.return_value = mock_provider

        setup_tracing(mock_resource)

        mock_tracer_provider.assert_called_once()
        mock_set_provider.assert_called_once_with(mock_provider)

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.TracerProvider")
    def test_setup_tracing_handles_errors(self, mock_tracer_provider, mock_settings):
        """Test tracing setup handles errors gracefully."""
        mock_settings.observability.otel_endpoint = "http://otel:4317"
        mock_settings.observability.tracing_sample_rate = 1.0

        mock_tracer_provider.side_effect = Exception("Setup failed")

        # Should not raise
        setup_tracing(Mock())


@pytest.mark.integration
class TestSetupMetrics:
    """Test metrics setup."""

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.OTLPMetricExporter")
    @patch("dotmac.platform.telemetry.PeriodicExportingMetricReader")
    @patch("dotmac.platform.telemetry.MeterProvider")
    @patch("dotmac.platform.telemetry.metrics.set_meter_provider")
    def test_setup_metrics_with_endpoint(
        self,
        mock_set_provider,
        mock_meter_provider,
        mock_reader,
        mock_exporter,
        mock_settings,
    ):
        """Test metrics setup with OTLP endpoint."""
        mock_settings.observability.otel_endpoint = "http://otel:4317"

        mock_resource = Mock()
        mock_provider = Mock()
        mock_meter_provider.return_value = mock_provider

        setup_metrics(mock_resource)

        mock_exporter.assert_called_once()
        mock_reader.assert_called_once()
        mock_meter_provider.assert_called_once()
        mock_set_provider.assert_called_once_with(mock_provider)

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.MeterProvider")
    @patch("dotmac.platform.telemetry.metrics.set_meter_provider")
    def test_setup_metrics_without_endpoint(
        self, mock_set_provider, mock_meter_provider, mock_settings
    ):
        """Test metrics setup without endpoint."""
        mock_settings.observability.otel_endpoint = None

        mock_resource = Mock()
        mock_provider = Mock()
        mock_meter_provider.return_value = mock_provider

        setup_metrics(mock_resource)

        mock_meter_provider.assert_called_once()
        mock_set_provider.assert_called_once_with(mock_provider)

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.MeterProvider")
    def test_setup_metrics_handles_errors(self, mock_meter_provider, mock_settings):
        """Test metrics setup handles errors gracefully."""
        mock_settings.observability.otel_endpoint = "http://otel:4317"
        mock_meter_provider.side_effect = Exception("Setup failed")

        # Should not raise
        setup_metrics(Mock())


@pytest.mark.integration
class TestInstrumentLibraries:
    """Test library instrumentation."""

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.FastAPIInstrumentor")
    @patch("dotmac.platform.telemetry.trace.get_tracer_provider")
    def test_instrument_fastapi_enabled(self, mock_get_provider, mock_instrumentor, mock_settings):
        """Test FastAPI instrumentation when enabled."""
        mock_settings.observability.otel_instrument_fastapi = True
        mock_settings.observability.otel_instrument_sqlalchemy = False
        mock_settings.observability.otel_instrument_requests = False

        app = FastAPI()
        instrument_libraries(app)

        mock_instrumentor.instrument_app.assert_called_once()

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.SQLAlchemyInstrumentor")
    @patch("dotmac.platform.telemetry.trace.get_tracer_provider")
    def test_instrument_sqlalchemy_enabled(
        self, mock_get_provider, mock_instrumentor, mock_settings
    ):
        """Test SQLAlchemy instrumentation when enabled."""
        mock_settings.observability.otel_instrument_fastapi = False
        mock_settings.observability.otel_instrument_sqlalchemy = True
        mock_settings.observability.otel_instrument_requests = False

        mock_inst = Mock()
        mock_instrumentor.return_value = mock_inst

        instrument_libraries(None)

        mock_inst.instrument.assert_called_once()

    @patch("dotmac.platform.telemetry.settings")
    @patch("dotmac.platform.telemetry.RequestsInstrumentor")
    @patch("dotmac.platform.telemetry.trace.get_tracer_provider")
    def test_instrument_requests_enabled(self, mock_get_provider, mock_instrumentor, mock_settings):
        """Test Requests instrumentation when enabled."""
        mock_settings.observability.otel_instrument_fastapi = False
        mock_settings.observability.otel_instrument_sqlalchemy = False
        mock_settings.observability.otel_instrument_requests = True

        mock_inst = Mock()
        mock_instrumentor.return_value = mock_inst

        instrument_libraries(None)

        mock_inst.instrument.assert_called_once()

    @patch("dotmac.platform.telemetry.settings")
    def test_instrument_libraries_all_disabled(self, mock_settings):
        """Test instrumentation when all are disabled."""
        mock_settings.observability.otel_instrument_fastapi = False
        mock_settings.observability.otel_instrument_sqlalchemy = False
        mock_settings.observability.otel_instrument_requests = False

        # Should not raise
        instrument_libraries(None)


@pytest.mark.integration
class TestGetTracerAndMeter:
    """Test tracer and meter getter functions."""

    @patch("dotmac.platform.telemetry.trace.get_tracer")
    def test_get_tracer_without_version(self, mock_get_tracer):
        """Test getting tracer without version."""
        mock_tracer = Mock()
        mock_get_tracer.return_value = mock_tracer

        tracer = get_tracer("test-component")

        mock_get_tracer.assert_called_once_with("test-component", "")
        assert tracer == mock_tracer

    @patch("dotmac.platform.telemetry.trace.get_tracer")
    def test_get_tracer_with_version(self, mock_get_tracer):
        """Test getting tracer with version."""
        mock_tracer = Mock()
        mock_get_tracer.return_value = mock_tracer

        tracer = get_tracer("test-component", CURRENT_VERSION)

        mock_get_tracer.assert_called_once_with("test-component", CURRENT_VERSION)
        assert tracer == mock_tracer

    @patch("dotmac.platform.telemetry.metrics.get_meter")
    def test_get_meter_without_version(self, mock_get_meter):
        """Test getting meter without version."""
        mock_meter = Mock()
        mock_get_meter.return_value = mock_meter

        meter = get_meter("test-component")

        mock_get_meter.assert_called_once_with("test-component", "")
        assert meter == mock_meter

    @patch("dotmac.platform.telemetry.metrics.get_meter")
    def test_get_meter_with_version(self, mock_get_meter):
        """Test getting meter with version."""
        mock_meter = Mock()
        mock_get_meter.return_value = mock_meter

        meter = get_meter("test-component", "2.0.0")

        mock_get_meter.assert_called_once_with("test-component", "2.0.0")
        assert meter == mock_meter


@pytest.mark.integration
class TestRecordError:
    """Test error recording in spans."""

    @patch("dotmac.platform.telemetry.trace.Status")
    @patch("dotmac.platform.telemetry.trace.StatusCode")
    def test_record_error(self, mock_status_code, mock_status):
        """Test recording error in span."""
        mock_span = Mock()
        error = ValueError("Test error")

        mock_status_code.ERROR = "ERROR"
        mock_status_instance = Mock()
        mock_status.return_value = mock_status_instance

        record_error(mock_span, error)

        mock_span.record_exception.assert_called_once_with(error)
        mock_span.set_status.assert_called_once()


@pytest.mark.integration
class TestCreateSpanContext:
    """Test span context creation."""

    @patch("dotmac.platform.telemetry.trace.SpanContext")
    @patch("dotmac.platform.telemetry.trace.TraceFlags")
    def test_create_span_context_remote(self, mock_trace_flags, mock_span_context):
        """Test creating remote span context."""
        trace_id = "00000000000000000000000000000001"
        span_id = "0000000000000001"

        mock_flags = Mock()
        mock_trace_flags.return_value = mock_flags

        create_span_context(trace_id, span_id, is_remote=True)

        mock_span_context.assert_called_once_with(
            trace_id=1,
            span_id=1,
            is_remote=True,
            trace_flags=mock_flags,
        )

    @patch("dotmac.platform.telemetry.trace.SpanContext")
    @patch("dotmac.platform.telemetry.trace.TraceFlags")
    def test_create_span_context_local(self, mock_trace_flags, mock_span_context):
        """Test creating local span context."""
        trace_id = "0000000000000000000000000000000a"
        span_id = "000000000000000a"

        mock_flags = Mock()
        mock_trace_flags.return_value = mock_flags

        create_span_context(trace_id, span_id, is_remote=False)

        mock_span_context.assert_called_once_with(
            trace_id=10,
            span_id=10,
            is_remote=False,
            trace_flags=mock_flags,
        )
