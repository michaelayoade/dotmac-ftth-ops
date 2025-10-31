"""Observability manager backed by the telemetry module.

Provides a thin wrapper around the OpenTelemetry setup helpers so callers can
configure tracing/metrics/logging in a single place without reaching into
module-level globals.
"""

from __future__ import annotations

import os
from contextlib import suppress
from typing import Any

import structlog
from fastapi import FastAPI
from opentelemetry import metrics, trace

from dotmac.platform.settings import Environment, LogLevel, settings
from dotmac.platform.telemetry import get_meter, get_tracer, setup_telemetry

_GLOBAL_INSTRUMENTED_KEYS: set[tuple[str, int]] = set()


class ObservabilityMetricsRegistry:
    """Simple adapter around the global OpenTelemetry meter provider."""

    def __init__(self, service_name: str | None = None) -> None:
        self._service_name = service_name or settings.observability.otel_service_name
        self._meter = get_meter(self._service_name)

    def create_counter(self, name: str, *, description: str = "", unit: str = "1") -> Any:
        """Create a Counter instrument."""

        return self._meter.create_counter(name, description=description, unit=unit)

    def create_histogram(self, name: str, *, description: str = "", unit: str = "1") -> Any:
        """Create a Histogram instrument."""

        return self._meter.create_histogram(name, description=description, unit=unit)

    def create_up_down_counter(self, name: str, *, description: str = "", unit: str = "1") -> Any:
        """Create an UpDownCounter instrument."""

        return self._meter.create_up_down_counter(name, description=description, unit=unit)


class ObservabilityManager:
    """Coordinator for telemetry setup and runtime helpers."""

    def __init__(
        self,
        app: FastAPI | None = None,
        *,
        auto_initialize: bool = False,
        **config: Any,
    ) -> None:
        self.app = app
        self._initialized = False
        self._metrics_registry: ObservabilityMetricsRegistry | None = None
        self._instrumented_keys = _GLOBAL_INSTRUMENTED_KEYS
        self._original_settings: dict[str, Any] | None = None

        if os.getenv("PYTEST_CURRENT_TEST"):
            self._instrumented_keys.clear()

        # Configurable attributes documented in examples/docs
        self.service_name: str | None = config.pop("service_name", None)
        self.environment: str | None = config.pop("environment", None)
        self.otlp_endpoint: str | None = config.pop("otlp_endpoint", None)
        self.log_level: str | None = config.pop("log_level", None)
        self.enable_tracing: bool | None = config.pop("enable_tracing", None)
        self.enable_metrics: bool | None = config.pop("enable_metrics", None)
        self.enable_logging: bool | None = config.pop("enable_logging", None)
        self.enable_correlation_ids: bool | None = config.pop("enable_correlation_ids", None)
        self.prometheus_enabled: bool | None = config.pop("prometheus_enabled", None)
        self.prometheus_port: int | None = config.pop("prometheus_port", None)
        self.trace_sampler_ratio: float | None = config.pop("trace_sampler_ratio", None)
        self.slow_request_threshold: float | None = config.pop("slow_request_threshold", None)

        # Preserve any additional options for future extensibility
        self.extra_options: dict[str, Any] = dict(config)

        if auto_initialize:
            self.initialize(app=app)

    # ---------------------------------------------------------------------
    # Lifecycle management
    # ---------------------------------------------------------------------

    def initialize(self, app: FastAPI | None = None, **overrides: Any) -> ObservabilityManager:
        """Apply configuration overrides and bootstrap telemetry."""

        if overrides:
            self._merge_overrides(overrides)

        self._snapshot_settings()
        self._apply_settings_overrides()

        # Configure global providers first, then optionally instrument an app
        self._instrument(None)

        target_app = app or self.app
        if target_app is not None:
            self._instrument(target_app)
            self.app = target_app

        self._initialized = True
        return self

    def apply_middleware(self, app: FastAPI) -> FastAPI:
        """Ensure telemetry is wired up for the provided FastAPI app."""

        self.app = app
        # Always instrument the app – helper avoids duplicate work
        self._instrument(app)
        return app

    def shutdown(self) -> None:
        """Attempt to flush telemetry providers on shutdown."""

        tracer_provider = trace.get_tracer_provider()
        with suppress(Exception):
            shutdown = getattr(tracer_provider, "shutdown", None)
            if callable(shutdown):
                shutdown()

        meter_provider = metrics.get_meter_provider()
        with suppress(Exception):
            shutdown = getattr(meter_provider, "shutdown", None)
            if callable(shutdown):
                shutdown()

        if self._original_settings is not None:
            self._restore_settings_overrides()
            self._original_settings = None

        self._initialized = False

    # ---------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------

    def get_logger(self, name: str | None = None) -> Any:
        """Return a structlog logger with a sensible default name."""

        logger_name = name or self.service_name or settings.observability.otel_service_name
        return structlog.get_logger(logger_name)

    def get_tracer(self, name: str, version: str | None = None) -> Any:
        """Shortcut to the telemetry helper."""

        return get_tracer(name, version)

    def get_meter(self, name: str, version: str | None = None) -> Any:
        """Shortcut to the telemetry helper."""

        return get_meter(name, version)

    def get_metrics_registry(self) -> ObservabilityMetricsRegistry:
        """Return a thin wrapper around the meter provider for convenience."""

        if self._metrics_registry is None:
            self._metrics_registry = ObservabilityMetricsRegistry(self.service_name)
        return self._metrics_registry

    def get_tracing_manager(self) -> Any:
        """Expose the global tracer provider for integration scenarios."""

        return trace.get_tracer_provider()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _merge_overrides(self, overrides: dict[str, Any]) -> None:
        """Update configuration attributes from method calls."""

        for key, value in overrides.items():
            if not hasattr(self, key):
                self.extra_options[key] = value
            else:
                setattr(self, key, value)

    def _apply_basic_overrides(self, obs: Any) -> None:
        """Apply basic observability setting overrides."""
        if self.service_name:
            obs.otel_service_name = self.service_name

        if self.enable_tracing is not None:
            obs.enable_tracing = self.enable_tracing

        if self.enable_metrics is not None:
            obs.enable_metrics = self.enable_metrics

        if self.enable_logging is not None:
            obs.enable_structured_logging = self.enable_logging

        if self.enable_correlation_ids is not None:
            obs.enable_correlation_ids = self.enable_correlation_ids

    def _apply_otlp_overrides(self, obs: Any) -> None:
        """Apply OTLP endpoint overrides."""
        if self.otlp_endpoint is not None:
            obs.otel_endpoint = self.otlp_endpoint
            obs.otel_enabled = bool(self.otlp_endpoint)

        if self.trace_sampler_ratio is not None:
            obs.tracing_sample_rate = float(self.trace_sampler_ratio)

    def _apply_prometheus_overrides(self, obs: Any) -> None:
        """Apply Prometheus-specific overrides."""
        if self.prometheus_enabled is not None:
            obs.prometheus_enabled = self.prometheus_enabled

        if self.prometheus_port is not None:
            obs.prometheus_port = self.prometheus_port

    def _apply_log_level_override(self, obs: Any) -> None:
        """Apply log level override with validation."""
        if isinstance(self.log_level, str):
            try:
                level_enum = LogLevel(self.log_level.upper())
                obs.log_level = level_enum.value
            except ValueError:
                obs.log_level = LogLevel.INFO.value

    def _apply_environment_override(self) -> None:
        """Apply environment override with validation."""
        if isinstance(self.environment, str):
            try:
                settings.environment = Environment(self.environment.lower())
            except (ValueError, AttributeError):
                pass

    def _apply_settings_overrides(self) -> None:
        """Write configuration overrides into the shared settings object."""
        obs = settings.observability

        self._apply_basic_overrides(obs)
        self._apply_otlp_overrides(obs)
        self._apply_prometheus_overrides(obs)
        self._apply_log_level_override(obs)
        self._apply_environment_override()

    def _instrument(self, app: FastAPI | None) -> None:
        """Call the telemetry helper once per app/global context."""

        key = ("app", id(app)) if app is not None else ("global", 0)
        if key in self._instrumented_keys:
            return

        setup_telemetry(app)
        self._instrumented_keys.add(key)

    def _snapshot_settings(self) -> None:
        """Remember original observability settings for later restore."""
        if self._original_settings is not None:
            return

        obs = settings.observability
        self._original_settings = {
            "otel_service_name": obs.otel_service_name,
            "enable_tracing": obs.enable_tracing,
            "enable_metrics": obs.enable_metrics,
            "enable_structured_logging": obs.enable_structured_logging,
            "enable_correlation_ids": obs.enable_correlation_ids,
            "otel_endpoint": obs.otel_endpoint,
            "otel_enabled": obs.otel_enabled,
            "prometheus_enabled": obs.prometheus_enabled,
            "prometheus_port": obs.prometheus_port,
            "tracing_sample_rate": obs.tracing_sample_rate,
            "log_level": obs.log_level,
            "environment": settings.environment,
        }

    def _restore_settings_overrides(self) -> None:
        """Restore observability settings to their snapshot values."""
        if not self._original_settings:
            return

        obs = settings.observability
        obs.otel_service_name = self._original_settings.get(
            "otel_service_name", obs.otel_service_name
        )
        obs.enable_tracing = self._original_settings.get("enable_tracing", obs.enable_tracing)
        obs.enable_metrics = self._original_settings.get("enable_metrics", obs.enable_metrics)
        obs.enable_structured_logging = self._original_settings.get(
            "enable_structured_logging", obs.enable_structured_logging
        )
        obs.enable_correlation_ids = self._original_settings.get(
            "enable_correlation_ids", obs.enable_correlation_ids
        )
        obs.otel_endpoint = self._original_settings.get("otel_endpoint", obs.otel_endpoint)
        obs.otel_enabled = self._original_settings.get("otel_enabled", obs.otel_enabled)
        obs.prometheus_enabled = self._original_settings.get(
            "prometheus_enabled", obs.prometheus_enabled
        )
        obs.prometheus_port = self._original_settings.get("prometheus_port", obs.prometheus_port)
        obs.tracing_sample_rate = self._original_settings.get(
            "tracing_sample_rate", obs.tracing_sample_rate
        )
        obs.log_level = self._original_settings.get("log_level", obs.log_level)
        settings.environment = self._original_settings.get("environment", settings.environment)


def add_observability_middleware(app: FastAPI, **config: Any) -> ObservabilityManager:
    """Convenience helper to configure observability for a FastAPI app."""

    manager = ObservabilityManager(app=app, **config)
    manager.initialize(app=app)
    return manager
