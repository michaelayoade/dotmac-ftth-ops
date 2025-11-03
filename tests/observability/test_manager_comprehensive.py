"""Comprehensive tests for ObservabilityManager."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI

from dotmac.platform.observability.manager import (
    ObservabilityManager,
    ObservabilityMetricsRegistry,
)
from dotmac.platform.version import get_version

pytestmark = pytest.mark.unit

CURRENT_VERSION = get_version()


@pytest.fixture
def mock_app():
    """Mock FastAPI application."""

    return FastAPI(title="Test App")


@pytest.fixture
def observability_manager():
    """Create ObservabilityManager instance."""
    return ObservabilityManager()


class TestObservabilityMetricsRegistry:
    """Test ObservabilityMetricsRegistry."""

    def test_metrics_registry_initialization(self):
        """Test metrics registry initialization."""
        registry = ObservabilityMetricsRegistry(service_name="test-service")

        assert registry._service_name == "test-service"
        assert registry._meter is not None

    def test_metrics_registry_default_service_name(self):
        """Test metrics registry with default service name."""
        registry = ObservabilityMetricsRegistry()

        assert registry._service_name is not None
        assert registry._meter is not None

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_create_counter(self, mock_get_meter):
        """Test creating counter metric."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        registry = ObservabilityMetricsRegistry(service_name="test-service")
        registry.create_counter(
            name="test_counter", description="Test counter metric", unit="requests"
        )

        mock_meter.create_counter.assert_called_once_with(
            "test_counter", description="Test counter metric", unit="requests"
        )

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_create_histogram(self, mock_get_meter):
        """Test creating histogram metric."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        registry = ObservabilityMetricsRegistry(service_name="test-service")
        registry.create_histogram(
            name="test_histogram", description="Test histogram metric", unit="ms"
        )

        mock_meter.create_histogram.assert_called_once_with(
            "test_histogram", description="Test histogram metric", unit="ms"
        )

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_create_up_down_counter(self, mock_get_meter):
        """Test creating up-down counter metric."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        registry = ObservabilityMetricsRegistry(service_name="test-service")
        registry.create_up_down_counter(
            name="test_updown", description="Test up-down counter", unit="connections"
        )

        mock_meter.create_up_down_counter.assert_called_once_with(
            "test_updown", description="Test up-down counter", unit="connections"
        )


class TestObservabilityManagerInitialization:
    """Test ObservabilityManager initialization."""

    def test_manager_initialization_no_app(self):
        """Test manager initialization without app."""
        manager = ObservabilityManager()

        assert manager.app is None
        assert manager._initialized is False
        assert manager._metrics_registry is None

    def test_manager_initialization_with_app(self, mock_app):
        """Test manager initialization with app."""
        manager = ObservabilityManager(app=mock_app)

        assert manager.app == mock_app
        assert manager._initialized is False

    def test_manager_initialization_with_config(self):
        """Test manager initialization with configuration."""
        manager = ObservabilityManager(
            service_name="test-service",
            environment="development",
            enable_tracing=True,
            enable_metrics=True,
        )

        assert manager.service_name == "test-service"
        assert manager.environment == "development"
        assert manager.enable_tracing is True
        assert manager.enable_metrics is True

    def test_manager_auto_initialize(self, mock_app):
        """Test manager with auto initialization."""
        with patch.object(ObservabilityManager, "initialize") as mock_init:
            ObservabilityManager(app=mock_app, auto_initialize=True)

            mock_init.assert_called_once()


class TestObservabilityManagerConfiguration:
    """Test ObservabilityManager configuration."""

    def test_merge_overrides(self):
        """Test merging configuration overrides."""
        manager = ObservabilityManager(service_name="original-service")

        overrides = {"service_name": "overridden-service", "environment": "production"}

        manager._merge_overrides(overrides)

        assert manager.service_name == "overridden-service"
        assert manager.environment == "production"

    def test_apply_settings_overrides(self):
        """Test applying settings overrides."""
        manager = ObservabilityManager(otlp_endpoint="http://localhost:4317", log_level="DEBUG")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability.otel_endpoint = "http://original:4317"

            manager._apply_settings_overrides()

            # Should override settings
            assert mock_settings.observability.otel_endpoint == "http://localhost:4317"

    def test_extra_options_preserved(self):
        """Test that extra options are preserved."""
        manager = ObservabilityManager(
            service_name="test-service", custom_option="custom_value", another_option=123
        )

        assert "custom_option" in manager.extra_options
        assert manager.extra_options["custom_option"] == "custom_value"
        assert manager.extra_options["another_option"] == 123


class TestObservabilityManagerInitialize:
    """Test ObservabilityManager initialize method."""

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_initialize_without_app(self, mock_setup):
        """Test initializing without app."""
        manager = ObservabilityManager()

        result = manager.initialize()

        assert result == manager
        assert manager._initialized is True
        mock_setup.assert_called_once()

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_initialize_with_app(self, mock_setup, mock_app):
        """Test initializing with app."""
        manager = ObservabilityManager()

        result = manager.initialize(app=mock_app)

        assert result == manager
        assert manager.app == mock_app
        assert manager._initialized is True

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_initialize_with_overrides(self, mock_setup):
        """Test initializing with overrides."""
        manager = ObservabilityManager(service_name="original")

        manager.initialize(service_name="overridden")

        assert manager.service_name == "overridden"
        assert manager._initialized is True


class TestObservabilityManagerInstrumentation:
    """Test ObservabilityManager instrumentation."""

    def test_instrument_none(self):
        """Test instrumenting with None."""
        manager = ObservabilityManager()

        # Should not raise exception
        with patch("dotmac.platform.observability.manager.setup_telemetry"):
            manager._instrument(None)

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_instrument_app(self, mock_setup, mock_app):
        """Test instrumenting FastAPI app."""
        manager = ObservabilityManager()

        manager._instrument(mock_app)

        # Should track instrumented app with key format ("app", id(app))
        assert ("app", id(mock_app)) in manager._instrumented_keys

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_instrument_app_twice(self, mock_setup, mock_app):
        """Test instrumenting same app twice."""
        manager = ObservabilityManager()

        manager._instrument(mock_app)
        manager._instrument(mock_app)

        # Should only instrument once - key is ("app", id(app))
        app_key = ("app", id(mock_app))
        instrumented_count = sum(1 for key in manager._instrumented_keys if key == app_key)
        assert instrumented_count == 1


class TestObservabilityManagerMetrics:
    """Test ObservabilityManager metrics methods."""

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_get_metrics_registry(self, mock_get_meter):
        """Test getting metrics registry."""
        manager = ObservabilityManager(service_name="test-service")

        registry = manager.get_metrics_registry()

        assert isinstance(registry, ObservabilityMetricsRegistry)
        assert registry._service_name == "test-service"

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_get_metrics_registry_cached(self, mock_get_meter):
        """Test that metrics registry is cached."""
        manager = ObservabilityManager(service_name="test-service")

        registry1 = manager.get_metrics_registry()
        registry2 = manager.get_metrics_registry()

        assert registry1 is registry2


class TestObservabilityManagerTracing:
    """Test ObservabilityManager tracing methods."""

    @patch("dotmac.platform.observability.manager.get_tracer")
    def test_get_tracer(self, mock_get_tracer):
        """Test getting tracer."""
        mock_tracer = MagicMock()
        mock_get_tracer.return_value = mock_tracer

        manager = ObservabilityManager(service_name="test-service")

        # get_tracer requires a name parameter
        tracer = manager.get_tracer(name="test-component")

        assert tracer == mock_tracer
        mock_get_tracer.assert_called_once_with("test-component", None)

    def test_get_tracing_manager(self):
        """Test getting tracing manager."""
        manager = ObservabilityManager()

        tracing_manager = manager.get_tracing_manager()

        # Should return the global tracer provider
        assert tracing_manager is not None


class TestObservabilityManagerLogging:
    """Test ObservabilityManager logging configuration."""

    def test_configure_logging(self):
        """Test logging configuration."""
        manager = ObservabilityManager(log_level="DEBUG", enable_logging=True)

        # Should set configuration
        assert manager.log_level == "DEBUG"
        assert manager.enable_logging is True

    def test_configure_correlation_ids(self):
        """Test correlation ID configuration."""
        manager = ObservabilityManager(enable_correlation_ids=True)

        assert manager.enable_correlation_ids is True


class TestObservabilityManagerPrometheus:
    """Test ObservabilityManager Prometheus configuration."""

    def test_configure_prometheus(self):
        """Test Prometheus configuration."""
        manager = ObservabilityManager(prometheus_enabled=True, prometheus_port=9090)

        assert manager.prometheus_enabled is True
        assert manager.prometheus_port == 9090

    def test_configure_prometheus_defaults(self):
        """Test Prometheus with default values."""
        manager = ObservabilityManager()

        assert manager.prometheus_enabled is None
        assert manager.prometheus_port is None


class TestObservabilityManagerSampling:
    """Test ObservabilityManager sampling configuration."""

    def test_configure_trace_sampler(self):
        """Test trace sampler configuration."""
        manager = ObservabilityManager(trace_sampler_ratio=0.5)

        assert manager.trace_sampler_ratio == 0.5

    def test_configure_slow_request_threshold(self):
        """Test slow request threshold configuration."""
        manager = ObservabilityManager(slow_request_threshold=2.0)

        assert manager.slow_request_threshold == 2.0


class TestObservabilityManagerMiddleware:
    """Test ObservabilityManager middleware methods."""

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_apply_middleware(self, mock_setup, mock_app):
        """Test applying middleware to FastAPI app."""
        manager = ObservabilityManager()

        result = manager.apply_middleware(mock_app)

        assert result == mock_app
        assert manager.app == mock_app
        # Should instrument the app
        assert ("app", id(mock_app)) in manager._instrumented_keys

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_apply_middleware_returns_app(self, mock_setup, mock_app):
        """Test that apply_middleware returns the app for chaining."""
        manager = ObservabilityManager()

        result = manager.apply_middleware(mock_app)

        assert result is mock_app


class TestObservabilityManagerShutdown:
    """Test ObservabilityManager shutdown procedures."""

    @patch("dotmac.platform.observability.manager.trace.get_tracer_provider")
    @patch("dotmac.platform.observability.manager.metrics.get_meter_provider")
    def test_shutdown_success(self, mock_get_meter_provider, mock_get_tracer_provider):
        """Test successful shutdown."""
        mock_tracer_provider = MagicMock()
        mock_tracer_provider.shutdown = MagicMock()
        mock_get_tracer_provider.return_value = mock_tracer_provider

        mock_meter_provider = MagicMock()
        mock_meter_provider.shutdown = MagicMock()
        mock_get_meter_provider.return_value = mock_meter_provider

        manager = ObservabilityManager()
        manager._initialized = True

        manager.shutdown()

        assert manager._initialized is False
        mock_tracer_provider.shutdown.assert_called_once()
        mock_meter_provider.shutdown.assert_called_once()

    @patch("dotmac.platform.observability.manager.trace.get_tracer_provider")
    @patch("dotmac.platform.observability.manager.metrics.get_meter_provider")
    def test_shutdown_handles_exceptions(self, mock_get_meter_provider, mock_get_tracer_provider):
        """Test shutdown handles exceptions gracefully."""
        mock_tracer_provider = MagicMock()
        mock_tracer_provider.shutdown = MagicMock(side_effect=Exception("Shutdown error"))
        mock_get_tracer_provider.return_value = mock_tracer_provider

        mock_meter_provider = MagicMock()
        mock_meter_provider.shutdown = MagicMock()
        mock_get_meter_provider.return_value = mock_meter_provider

        manager = ObservabilityManager()
        manager._initialized = True

        # Should not raise exception
        manager.shutdown()

        assert manager._initialized is False

    @patch("dotmac.platform.observability.manager.trace.get_tracer_provider")
    @patch("dotmac.platform.observability.manager.metrics.get_meter_provider")
    def test_shutdown_without_shutdown_method(
        self, mock_get_meter_provider, mock_get_tracer_provider
    ):
        """Test shutdown when providers don't have shutdown method."""
        mock_tracer_provider = MagicMock(spec=[])  # No shutdown method
        mock_get_tracer_provider.return_value = mock_tracer_provider

        mock_meter_provider = MagicMock(spec=[])  # No shutdown method
        mock_get_meter_provider.return_value = mock_meter_provider

        manager = ObservabilityManager()
        manager._initialized = True

        # Should handle gracefully
        manager.shutdown()

        assert manager._initialized is False


class TestObservabilityManagerHelpers:
    """Test ObservabilityManager helper methods."""

    @patch("dotmac.platform.observability.manager.structlog.get_logger")
    def test_get_logger_with_name(self, mock_get_logger):
        """Test getting logger with custom name."""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger

        manager = ObservabilityManager(service_name="test-service")

        logger = manager.get_logger(name="custom-component")

        mock_get_logger.assert_called_once_with("custom-component")
        assert logger == mock_logger

    @patch("dotmac.platform.observability.manager.structlog.get_logger")
    def test_get_logger_default_name(self, mock_get_logger):
        """Test getting logger with default name."""
        mock_logger = MagicMock()
        mock_get_logger.return_value = mock_logger

        manager = ObservabilityManager(service_name="test-service")

        logger = manager.get_logger()

        mock_get_logger.assert_called_once_with("test-service")
        assert logger == mock_logger

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_get_meter_helper(self, mock_get_meter):
        """Test get_meter helper method."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        manager = ObservabilityManager()

        meter = manager.get_meter(name="test-meter", version=CURRENT_VERSION)

        mock_get_meter.assert_called_once_with("test-meter", CURRENT_VERSION)
        assert meter == mock_meter

    @patch("dotmac.platform.observability.manager.get_meter")
    def test_get_meter_without_version(self, mock_get_meter):
        """Test get_meter without version."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        manager = ObservabilityManager()

        manager.get_meter(name="test-meter")

        mock_get_meter.assert_called_once_with("test-meter", None)


class TestObservabilityManagerSettingsOverrides:
    """Test detailed settings override behavior."""

    def test_apply_log_level_override(self):
        """Test applying log level override."""
        manager = ObservabilityManager(log_level="DEBUG")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import LogLevel

            mock_settings.observability.log_level = LogLevel.INFO

            manager._apply_settings_overrides()

            assert mock_settings.observability.log_level == LogLevel.DEBUG

    def test_apply_invalid_log_level(self):
        """Test applying invalid log level defaults to INFO."""
        manager = ObservabilityManager(log_level="INVALID")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import LogLevel

            mock_settings.observability.log_level = LogLevel.INFO

            manager._apply_settings_overrides()

            assert mock_settings.observability.log_level == LogLevel.INFO

    def test_apply_environment_override(self):
        """Test applying environment override."""
        manager = ObservabilityManager(environment="production")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import Environment

            mock_settings.environment = Environment.DEVELOPMENT

            manager._apply_settings_overrides()

            assert mock_settings.environment == Environment.PRODUCTION

    def test_apply_invalid_environment(self):
        """Test applying invalid environment is ignored."""
        manager = ObservabilityManager(environment="invalid")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import Environment

            original_env = Environment.DEVELOPMENT
            mock_settings.environment = original_env

            manager._apply_settings_overrides()

            # Should remain unchanged
            assert mock_settings.environment == original_env


class TestObservabilityManagerIntegration:
    """Test ObservabilityManager integration scenarios."""

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    @patch("dotmac.platform.observability.manager.get_meter")
    @patch("dotmac.platform.observability.manager.get_tracer")
    def test_full_initialization_flow(self, mock_get_tracer, mock_get_meter, mock_setup, mock_app):
        """Test complete initialization flow."""
        manager = ObservabilityManager(
            app=mock_app,
            service_name="test-service",
            environment="development",
            enable_tracing=True,
            enable_metrics=True,
            enable_logging=True,
            prometheus_enabled=True,
            prometheus_port=9090,
        )

        manager.initialize()

        assert manager._initialized is True
        assert manager.service_name == "test-service"
        assert manager.environment == "development"
        # Called twice: once for None (global), once for the app
        assert mock_setup.call_count == 2

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    @patch("dotmac.platform.observability.manager.get_meter")
    def test_metrics_creation_flow(self, mock_get_meter, mock_setup):
        """Test creating metrics after initialization."""
        mock_meter = MagicMock()
        mock_get_meter.return_value = mock_meter

        manager = ObservabilityManager(service_name="test-service")
        manager.initialize()

        registry = manager.get_metrics_registry()
        registry.create_counter(name="requests_total")

        mock_meter.create_counter.assert_called_once()

    @patch("dotmac.platform.observability.manager.setup_telemetry")
    def test_add_observability_middleware_helper(self, mock_setup, mock_app):
        """Test convenience helper function."""
        from dotmac.platform.observability.manager import add_observability_middleware

        manager = add_observability_middleware(
            mock_app, service_name="test-service", enable_tracing=True
        )

        assert isinstance(manager, ObservabilityManager)
        assert manager.app == mock_app
        assert manager.service_name == "test-service"
        assert manager._initialized is True
