"""
Telemetry-specific test fixtures and configuration.

This module provides clean telemetry configuration for tests to prevent
OTLP export warnings and create proper test isolation.
"""

import os
from collections.abc import Generator
from unittest.mock import Mock, patch

import pytest

# Telemetry fixtures for clean test environment


@pytest.fixture(scope="session", autouse=True)
def disable_telemetry_exports() -> Generator[None]:
    """
    Automatically disable OpenTelemetry exports during tests.

    This fixture runs for the entire test session and prevents the following warnings:
    - "Transient error StatusCode.UNAVAILABLE encountered while exporting traces"
    - "Cannot call collect on a MetricReader until it is registered"
    - OTLP export timeout errors
    """
    # Set environment variables to disable OTLP exports in tests
    test_env_vars = {
        "OTEL_ENABLED": "false",
        "OTEL_ENDPOINT": "",
        "FEATURES__TRACING_OPENTELEMETRY": "false",
        # Keep structured logging but disable telemetry exports
        "OBSERVABILITY__OTEL_ENABLED": "false",
        "OBSERVABILITY__ENABLE_TRACING": "false",
        "OBSERVABILITY__ENABLE_METRICS": "false",
        "OBSERVABILITY__OTEL_ENDPOINT": "",
    }

    # Store original values
    original_values = {}
    for key, value in test_env_vars.items():
        original_values[key] = os.environ.get(key)
        os.environ[key] = value

    try:
        yield
    finally:
        # Restore original environment
        for key, original_value in original_values.items():
            if original_value is not None:
                os.environ[key] = original_value
            else:
                os.environ.pop(key, None)


@pytest.fixture
def mock_otel_settings():
    """
    Mock telemetry settings for individual tests.

    Returns a mock settings object with telemetry disabled by default.
    """
    with patch("dotmac.platform.settings.settings") as mock_settings:
        # Configure observability settings to prevent exports
        mock_settings.observability.otel_enabled = False
        mock_settings.observability.enable_tracing = False
        mock_settings.observability.enable_metrics = False
        mock_settings.observability.otel_endpoint = None

        # Feature flags
        mock_settings.features.tracing_opentelemetry = False
        mock_settings.features.data_transfer_enabled = True

        # Environment
        mock_settings.environment.value = "test"
        mock_settings.debug = True

        yield mock_settings


@pytest.fixture
def mock_telemetry_disabled():
    """
    Mock telemetry module to prevent any telemetry initialization.

    Use this fixture when you need to completely disable telemetry
    for specific tests without any side effects.
    """
    with patch("dotmac.platform.telemetry.setup_telemetry") as mock_setup:
        mock_setup.return_value = None

        with patch("opentelemetry.trace.set_tracer_provider") as mock_tracer:
            mock_tracer.return_value = None

            with patch("opentelemetry.metrics.set_meter_provider") as mock_meter:
                mock_meter.return_value = None
                yield


@pytest.fixture
def mock_otel_collector():
    """
    Mock OpenTelemetry collector that doesn't attempt real exports.

    Useful for testing analytics functionality without network calls.
    """
    mock_collector = Mock()
    mock_collector.collect = Mock()
    mock_collector.collect_batch = Mock()
    mock_collector.record_metric = Mock()
    mock_collector.get_metrics_summary.return_value = {
        "counters": {},
        "gauges": {},
        "histograms": {},
    }
    mock_collector.create_span.return_value = Mock()
    mock_collector.tracer = Mock()

    return mock_collector


@pytest.fixture
def clean_otel_environment():
    """
    Ensure OpenTelemetry global state is clean for tests.

    This fixture resets OpenTelemetry global providers to prevent
    test interference and state leakage between tests.
    """
    # Store original providers
    original_tracer_provider = None
    original_meter_provider = None

    try:
        from opentelemetry import metrics, trace

        original_tracer_provider = trace.get_tracer_provider()
        original_meter_provider = metrics.get_meter_provider()
    except ImportError:
        pass

    # Reset to no-op providers for tests
    try:
        from opentelemetry import metrics, trace
        from opentelemetry.metrics import NoOpMeterProvider
        from opentelemetry.trace import NoOpTracerProvider

        trace.set_tracer_provider(NoOpTracerProvider())
        metrics.set_meter_provider(NoOpMeterProvider())
    except ImportError:
        pass

    yield

    # Restore original providers if they existed
    if original_tracer_provider:
        try:
            from opentelemetry import trace

            trace.set_tracer_provider(original_tracer_provider)
        except ImportError:
            pass

    if original_meter_provider:
        try:
            from opentelemetry import metrics

            metrics.set_meter_provider(original_meter_provider)
        except ImportError:
            pass


# Test configuration utilities


def configure_test_telemetry() -> dict:
    """
    Get test-safe telemetry configuration.

    Returns a configuration dict that can be used to create
    telemetry components without external dependencies.
    """
    return {
        "otel_enabled": False,
        "enable_tracing": False,
        "enable_metrics": False,
        "otel_endpoint": None,
        "service_name": "dotmac-test",
        "environment": "test",
    }


def is_telemetry_available() -> bool:
    """
    Check if OpenTelemetry packages are available.

    Used by tests to conditionally skip telemetry-specific tests
    when dependencies aren't installed.
    """
    try:
        import opentelemetry  # noqa: F401

        return True
    except ImportError:
        return False


# Export commonly used fixtures
__all__ = [
    "disable_telemetry_exports",
    "mock_otel_settings",
    "mock_telemetry_disabled",
    "mock_otel_collector",
    "clean_otel_environment",
    "configure_test_telemetry",
    "is_telemetry_available",
]
