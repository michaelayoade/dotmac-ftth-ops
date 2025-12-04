"""Tests for observability manager."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI

from dotmac.platform.observability.manager import ObservabilityManager, ObservabilityMetricsRegistry

pytestmark = pytest.mark.unit


class TestObservabilityMetricsRegistry:
    """Test ObservabilityMetricsRegistry."""

    @pytest.fixture
    def mock_meter(self):
        """Create mock meter."""
        meter = MagicMock()
        meter.create_counter = MagicMock(return_value=MagicMock())
        meter.create_histogram = MagicMock(return_value=MagicMock())
        meter.create_up_down_counter = MagicMock(return_value=MagicMock())
        return meter

    def test_registry_initialization(self, mock_meter):
        """Test registry can be initialized."""
        with patch("dotmac.platform.observability.manager.get_meter", return_value=mock_meter):
            registry = ObservabilityMetricsRegistry(service_name="test-service")
            assert registry._service_name == "test-service"
            assert registry._meter == mock_meter

    def test_create_counter(self, mock_meter):
        """Test creating a counter."""
        with patch("dotmac.platform.observability.manager.get_meter", return_value=mock_meter):
            registry = ObservabilityMetricsRegistry()
            counter = registry.create_counter(
                "test_counter", description="Test counter", unit="requests"
            )

            assert counter is not None
            mock_meter.create_counter.assert_called_once_with(
                "test_counter", description="Test counter", unit="requests"
            )

    def test_create_histogram(self, mock_meter):
        """Test creating a histogram."""
        with patch("dotmac.platform.observability.manager.get_meter", return_value=mock_meter):
            registry = ObservabilityMetricsRegistry()
            histogram = registry.create_histogram(
                "test_histogram", description="Test histogram", unit="ms"
            )

            assert histogram is not None
            mock_meter.create_histogram.assert_called_once_with(
                "test_histogram", description="Test histogram", unit="ms"
            )

    def test_create_up_down_counter(self, mock_meter):
        """Test creating an up/down counter."""
        with patch("dotmac.platform.observability.manager.get_meter", return_value=mock_meter):
            registry = ObservabilityMetricsRegistry()
            up_down_counter = registry.create_up_down_counter(
                "test_gauge", description="Test gauge", unit="connections"
            )

            assert up_down_counter is not None
            mock_meter.create_up_down_counter.assert_called_once_with(
                "test_gauge", description="Test gauge", unit="connections"
            )


class TestObservabilityManager:
    """Test ObservabilityManager."""

    def test_manager_initialization_no_app(self):
        """Test manager initialization without app."""
        manager = ObservabilityManager()
        assert manager.app is None
        assert not manager._initialized

    def test_manager_initialization_with_app(self):
        """Test manager initialization with FastAPI app."""
        app = FastAPI()
        manager = ObservabilityManager(app=app)
        assert manager.app == app
        assert not manager._initialized

    def test_manager_initialization_with_config(self):
        """Test manager initialization with configuration."""
        manager = ObservabilityManager(
            service_name="test-service",
            environment="test",
            otlp_endpoint="http://localhost:4317",
            log_level="DEBUG",
            enable_tracing=True,
            enable_metrics=True,
            enable_logging=True,
            enable_correlation_ids=True,
            prometheus_enabled=True,
        )

        assert manager.service_name == "test-service"
        assert manager.environment == "test"
        assert manager.otlp_endpoint == "http://localhost:4317"
        assert manager.log_level == "DEBUG"
        assert manager.enable_tracing is True
        assert manager.enable_metrics is True
        assert manager.enable_logging is True
        assert manager.enable_correlation_ids is True
        assert manager.prometheus_enabled is True

    def test_manager_auto_initialize_false(self):
        """Test manager does not auto-initialize by default."""
        manager = ObservabilityManager(auto_initialize=False)
        assert not manager._initialized

    def test_manager_state_tracking(self):
        """Test manager tracks initialization state."""
        manager = ObservabilityManager()
        assert not manager._initialized
        assert manager._metrics_registry is None
        assert isinstance(manager._instrumented_keys, set)
        assert len(manager._instrumented_keys) == 0

    def test_manager_with_custom_service_name(self):
        """Test manager with custom service name."""
        manager = ObservabilityManager(service_name="my-custom-service")
        assert manager.service_name == "my-custom-service"

    def test_manager_with_tracing_disabled(self):
        """Test manager with tracing disabled."""
        manager = ObservabilityManager(enable_tracing=False)
        assert manager.enable_tracing is False

    def test_manager_with_metrics_disabled(self):
        """Test manager with metrics disabled."""
        manager = ObservabilityManager(enable_metrics=False)
        assert manager.enable_metrics is False

    def test_manager_with_logging_disabled(self):
        """Test manager with logging disabled."""
        manager = ObservabilityManager(enable_logging=False)
        assert manager.enable_logging is False

    def test_manager_instrumented_keys_set(self):
        """Test manager maintains instrumented keys set."""
        manager = ObservabilityManager()
        assert hasattr(manager, "_instrumented_keys")
        assert isinstance(manager._instrumented_keys, set)

        # Simulate adding instrumentation keys
        manager._instrumented_keys.add(("test", 1))
        assert ("test", 1) in manager._instrumented_keys

    def test_manager_metrics_registry_lazy_init(self):
        """Test metrics registry is lazy initialized."""
        manager = ObservabilityManager()
        assert manager._metrics_registry is None

    def test_manager_configuration_options(self):
        """Test all configuration options are accepted."""
        config = {
            "service_name": "test",
            "environment": "dev",
            "otlp_endpoint": "http://localhost:4317",
            "log_level": "INFO",
            "enable_tracing": True,
            "enable_metrics": True,
            "enable_logging": True,
            "enable_correlation_ids": True,
            "prometheus_enabled": False,
        }

        manager = ObservabilityManager(**config)

        assert manager.service_name == config["service_name"]
        assert manager.environment == config["environment"]
        assert manager.otlp_endpoint == config["otlp_endpoint"]
        assert manager.log_level == config["log_level"]
        assert manager.enable_tracing == config["enable_tracing"]
        assert manager.enable_metrics == config["enable_metrics"]
        assert manager.enable_logging == config["enable_logging"]
        assert manager.enable_correlation_ids == config["enable_correlation_ids"]
        assert manager.prometheus_enabled == config["prometheus_enabled"]

    def test_manager_partial_configuration(self):
        """Test manager with partial configuration."""
        manager = ObservabilityManager(service_name="test", enable_tracing=True)

        assert manager.service_name == "test"
        assert manager.enable_tracing is True
        # Other options should be None
        assert manager.environment is None
        assert manager.otlp_endpoint is None

    def test_manager_default_values(self):
        """Test manager default values."""
        manager = ObservabilityManager()

        # Check defaults
        assert manager.service_name is None
        assert manager.environment is None
        assert manager.otlp_endpoint is None
        assert manager.log_level is None
        assert manager.enable_tracing is None
        assert manager.enable_metrics is None
        assert manager.enable_logging is None


class TestObservabilityManagerLifecycle:
    """Test ObservabilityManager lifecycle methods."""

    def test_initialize_without_overrides(self):
        """Test initialize without overrides."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            result = manager.initialize()

            assert result is manager  # Returns self
            assert manager._initialized is True
            mock_setup.assert_called()

    def test_initialize_with_overrides(self):
        """Test initialize with configuration overrides."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry"):
            manager.initialize(
                service_name="override-service",
                enable_tracing=True,
                otlp_endpoint="http://override:4317",
            )

            assert manager.service_name == "override-service"
            assert manager.enable_tracing is True
            assert manager.otlp_endpoint == "http://override:4317"
            assert manager._initialized is True

    def test_initialize_with_app(self):
        """Test initialize with FastAPI app."""
        app = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager.initialize(app=app)

            assert manager.app == app
            assert manager._initialized is True
            # Should instrument both global (None) and app
            assert mock_setup.call_count == 2

    def test_initialize_idempotent(self):
        """Test initialize is idempotent - doesn't reinstrument."""
        app = FastAPI()
        manager = ObservabilityManager(app=app)

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager.initialize()
            first_count = mock_setup.call_count

            # Second initialize should not re-instrument
            manager.initialize()
            assert mock_setup.call_count == first_count

    def test_apply_middleware(self):
        """Test apply_middleware method."""
        app = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            result = manager.apply_middleware(app)

            assert result == app  # Returns app
            assert manager.app == app
            mock_setup.assert_called_with(app)

    def test_apply_middleware_idempotent(self):
        """Test apply_middleware is idempotent."""
        app = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager.apply_middleware(app)
            first_count = mock_setup.call_count

            # Second call should not re-instrument
            manager.apply_middleware(app)
            assert mock_setup.call_count == first_count

    def test_shutdown_with_providers(self):
        """Test shutdown calls provider shutdown methods."""
        manager = ObservabilityManager()

        # Mock tracer and meter providers with shutdown methods
        mock_tracer_provider = MagicMock()
        mock_tracer_provider.shutdown = MagicMock()

        mock_meter_provider = MagicMock()
        mock_meter_provider.shutdown = MagicMock()

        with (
            patch(
                "dotmac.platform.observability.manager.trace.get_tracer_provider",
                return_value=mock_tracer_provider,
            ),
            patch(
                "dotmac.platform.observability.manager.metrics.get_meter_provider",
                return_value=mock_meter_provider,
            ),
        ):
            manager._initialized = True
            manager.shutdown()

            mock_tracer_provider.shutdown.assert_called_once()
            mock_meter_provider.shutdown.assert_called_once()
            assert manager._initialized is False

    def test_shutdown_without_shutdown_methods(self):
        """Test shutdown handles providers without shutdown methods gracefully."""
        manager = ObservabilityManager()

        # Mock providers without shutdown methods
        mock_provider = MagicMock(spec=[])  # No shutdown method

        with (
            patch(
                "dotmac.platform.observability.manager.trace.get_tracer_provider",
                return_value=mock_provider,
            ),
            patch(
                "dotmac.platform.observability.manager.metrics.get_meter_provider",
                return_value=mock_provider,
            ),
        ):
            manager._initialized = True
            # Should not raise exception
            manager.shutdown()

            assert manager._initialized is False

    def test_shutdown_handles_exceptions(self):
        """Test shutdown suppresses exceptions from provider shutdown."""
        manager = ObservabilityManager()

        mock_tracer_provider = MagicMock()
        mock_tracer_provider.shutdown = MagicMock(side_effect=Exception("Shutdown error"))

        with (
            patch(
                "dotmac.platform.observability.manager.trace.get_tracer_provider",
                return_value=mock_tracer_provider,
            ),
            patch(
                "dotmac.platform.observability.manager.metrics.get_meter_provider",
                return_value=MagicMock(),
            ),
        ):
            manager._initialized = True
            # Should not raise exception
            manager.shutdown()

            assert manager._initialized is False


class TestObservabilityManagerHelpers:
    """Test ObservabilityManager helper methods."""

    def test_get_logger_default(self):
        """Test get_logger with default name."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.structlog.get_logger") as mock_get_logger:
            with patch("dotmac.platform.observability.manager.settings") as mock_settings:
                mock_settings.observability.otel_service_name = "default-service"

                manager.get_logger()

                mock_get_logger.assert_called_once_with("default-service")

    def test_get_logger_custom_name(self):
        """Test get_logger with custom name."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.structlog.get_logger") as mock_get_logger:
            manager.get_logger("custom-logger")

            mock_get_logger.assert_called_once_with("custom-logger")

    def test_get_logger_with_service_name(self):
        """Test get_logger uses service_name when set."""
        manager = ObservabilityManager(service_name="my-service")

        with patch("dotmac.platform.observability.manager.structlog.get_logger") as mock_get_logger:
            manager.get_logger()

            mock_get_logger.assert_called_once_with("my-service")

    def test_get_tracer(self):
        """Test get_tracer delegates to telemetry helper."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.get_tracer") as mock_get_tracer:
            mock_tracer = MagicMock()
            mock_get_tracer.return_value = mock_tracer

            tracer = manager.get_tracer("test-tracer", version="1.0")

            assert tracer == mock_tracer
            mock_get_tracer.assert_called_once_with("test-tracer", "1.0")

    def test_get_tracer_no_version(self):
        """Test get_tracer without version."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.get_tracer") as mock_get_tracer:
            manager.get_tracer("test-tracer")

            mock_get_tracer.assert_called_once_with("test-tracer", None)

    def test_get_meter(self):
        """Test get_meter delegates to telemetry helper."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.get_meter") as mock_get_meter:
            mock_meter = MagicMock()
            mock_get_meter.return_value = mock_meter

            meter = manager.get_meter("test-meter", version="2.0")

            assert meter == mock_meter
            mock_get_meter.assert_called_once_with("test-meter", "2.0")

    def test_get_meter_no_version(self):
        """Test get_meter without version."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.get_meter") as mock_get_meter:
            manager.get_meter("test-meter")

            mock_get_meter.assert_called_once_with("test-meter", None)

    def test_get_metrics_registry_lazy_creation(self):
        """Test get_metrics_registry creates registry on first call."""
        manager = ObservabilityManager(service_name="test-service")

        assert manager._metrics_registry is None

        with patch("dotmac.platform.observability.manager.get_meter"):
            registry = manager.get_metrics_registry()

            assert registry is not None
            assert manager._metrics_registry is registry
            assert isinstance(registry, ObservabilityMetricsRegistry)

    def test_get_metrics_registry_cached(self):
        """Test get_metrics_registry returns cached instance."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.get_meter"):
            registry1 = manager.get_metrics_registry()
            registry2 = manager.get_metrics_registry()

            assert registry1 is registry2  # Same instance

    def test_get_tracing_manager(self):
        """Test get_tracing_manager returns tracer provider."""
        manager = ObservabilityManager()

        mock_provider = MagicMock()
        with patch(
            "dotmac.platform.observability.manager.trace.get_tracer_provider",
            return_value=mock_provider,
        ):
            provider = manager.get_tracing_manager()

            assert provider == mock_provider


class TestObservabilityManagerInternalMethods:
    """Test ObservabilityManager internal methods."""

    def test_merge_overrides_existing_attributes(self):
        """Test _merge_overrides updates existing attributes."""
        manager = ObservabilityManager()

        overrides = {
            "service_name": "new-service",
            "enable_tracing": True,
            "otlp_endpoint": "http://new:4317",
        }

        manager._merge_overrides(overrides)

        assert manager.service_name == "new-service"
        assert manager.enable_tracing is True
        assert manager.otlp_endpoint == "http://new:4317"

    def test_merge_overrides_unknown_attributes(self):
        """Test _merge_overrides adds unknown attributes to extra_options."""
        manager = ObservabilityManager()

        overrides = {"custom_option": "value", "another_option": 123}

        manager._merge_overrides(overrides)

        assert manager.extra_options["custom_option"] == "value"
        assert manager.extra_options["another_option"] == 123

    def test_merge_overrides_mixed_attributes(self):
        """Test _merge_overrides handles both known and unknown attributes."""
        manager = ObservabilityManager()

        overrides = {"service_name": "test", "custom_field": "custom_value"}

        manager._merge_overrides(overrides)

        assert manager.service_name == "test"
        assert manager.extra_options["custom_field"] == "custom_value"

    def test_apply_settings_overrides_service_name(self):
        """Test _apply_settings_overrides sets service name."""
        manager = ObservabilityManager(service_name="my-service")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.otel_service_name == "my-service"

    def test_apply_settings_overrides_otlp_endpoint(self):
        """Test _apply_settings_overrides sets OTLP endpoint."""
        manager = ObservabilityManager(otlp_endpoint="http://localhost:4317")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.otel_endpoint == "http://localhost:4317"
            assert mock_settings.observability.otel_enabled is True

    def test_apply_settings_overrides_otlp_endpoint_empty(self):
        """Test _apply_settings_overrides disables OTel with empty endpoint."""
        manager = ObservabilityManager(otlp_endpoint="")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.otel_enabled is False

    def test_apply_settings_overrides_tracing(self):
        """Test _apply_settings_overrides sets tracing flag."""
        manager = ObservabilityManager(enable_tracing=True)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.enable_tracing is True

    def test_apply_settings_overrides_metrics(self):
        """Test _apply_settings_overrides sets metrics flag."""
        manager = ObservabilityManager(enable_metrics=False)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.enable_metrics is False

    def test_apply_settings_overrides_logging(self):
        """Test _apply_settings_overrides sets logging flag."""
        manager = ObservabilityManager(enable_logging=True)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.enable_structured_logging is True

    def test_apply_settings_overrides_correlation_ids(self):
        """Test _apply_settings_overrides sets correlation IDs flag."""
        manager = ObservabilityManager(enable_correlation_ids=True)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.enable_correlation_ids is True

    def test_apply_settings_overrides_prometheus(self):
        """Test _apply_settings_overrides sets Prometheus settings."""
        manager = ObservabilityManager(prometheus_enabled=True, prometheus_port=9090)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.prometheus_enabled is True
            assert mock_settings.observability.prometheus_port == 9090

    def test_apply_settings_overrides_trace_sampler_ratio(self):
        """Test _apply_settings_overrides sets trace sampler ratio."""
        manager = ObservabilityManager(trace_sampler_ratio=0.5)

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.tracing_sample_rate == 0.5

    def test_apply_settings_overrides_log_level_valid(self):
        """Test _apply_settings_overrides sets valid log level."""
        manager = ObservabilityManager(log_level="DEBUG")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import LogLevel

            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.log_level == LogLevel.DEBUG

    def test_apply_settings_overrides_log_level_invalid(self):
        """Test _apply_settings_overrides handles invalid log level."""
        manager = ObservabilityManager(log_level="INVALID")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import LogLevel

            mock_settings.observability = MagicMock()

            manager._apply_settings_overrides()

            assert mock_settings.observability.log_level == LogLevel.INFO

    def test_apply_settings_overrides_environment_valid(self):
        """Test _apply_settings_overrides sets valid environment."""
        manager = ObservabilityManager(environment="production")

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            from dotmac.platform.settings import Environment

            manager._apply_settings_overrides()

            assert mock_settings.environment == Environment.PRODUCTION

    def test_apply_settings_overrides_environment_invalid(self):
        """Test _apply_settings_overrides handles invalid environment."""
        manager = ObservabilityManager(environment="invalid")

        with patch("dotmac.platform.observability.manager.settings"):
            # Should not raise exception
            manager._apply_settings_overrides()

    def test_apply_settings_overrides_none_values_skipped(self):
        """Test _apply_settings_overrides skips None values."""
        manager = ObservabilityManager()  # All defaults are None

        with patch("dotmac.platform.observability.manager.settings") as mock_settings:
            mock_settings.observability = MagicMock()
            original_service_name = mock_settings.observability.otel_service_name

            manager._apply_settings_overrides()

            # Should not have been changed since manager.service_name is None
            assert mock_settings.observability.otel_service_name == original_service_name

    def test_instrument_global_context(self):
        """Test _instrument for global context."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager._instrument(None)

            mock_setup.assert_called_once_with(None)
            assert ("global", 0) in manager._instrumented_keys

    def test_instrument_app_context(self):
        """Test _instrument for app context."""
        app = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager._instrument(app)

            mock_setup.assert_called_once_with(app)
            assert ("app", id(app)) in manager._instrumented_keys

    def test_instrument_idempotent_global(self):
        """Test _instrument is idempotent for global context."""
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager._instrument(None)
            first_count = mock_setup.call_count

            # Second call should be skipped
            manager._instrument(None)
            assert mock_setup.call_count == first_count

    def test_instrument_idempotent_app(self):
        """Test _instrument is idempotent for same app."""
        app = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager._instrument(app)
            first_count = mock_setup.call_count

            # Second call should be skipped
            manager._instrument(app)
            assert mock_setup.call_count == first_count

    def test_instrument_different_apps(self):
        """Test _instrument instruments different apps separately."""
        app1 = FastAPI()
        app2 = FastAPI()
        manager = ObservabilityManager()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager._instrument(app1)
            manager._instrument(app2)

            # Should have been called twice
            assert mock_setup.call_count == 2
            assert ("app", id(app1)) in manager._instrumented_keys
            assert ("app", id(app2)) in manager._instrumented_keys


class TestAddObservabilityMiddleware:
    """Test add_observability_middleware convenience function."""

    def test_add_observability_middleware_basic(self):
        """Test add_observability_middleware creates and initializes manager."""
        from dotmac.platform.observability.manager import add_observability_middleware

        app = FastAPI()

        with patch("dotmac.platform.observability.manager.setup_telemetry") as mock_setup:
            manager = add_observability_middleware(app)

            assert isinstance(manager, ObservabilityManager)
            assert manager.app == app
            assert manager._initialized is True
            mock_setup.assert_called()

    def test_add_observability_middleware_with_config(self):
        """Test add_observability_middleware with configuration."""
        from dotmac.platform.observability.manager import add_observability_middleware

        app = FastAPI()

        with patch("dotmac.platform.observability.manager.setup_telemetry"):
            manager = add_observability_middleware(
                app,
                service_name="test-service",
                enable_tracing=True,
                otlp_endpoint="http://localhost:4317",
            )

            assert manager.service_name == "test-service"
            assert manager.enable_tracing is True
            assert manager.otlp_endpoint == "http://localhost:4317"
            assert manager._initialized is True
