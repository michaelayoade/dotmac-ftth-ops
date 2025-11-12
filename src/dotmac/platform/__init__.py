from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - typings only
    from .observability import ObservabilityManager as _ObservabilityManager

from .version import get_version as _load_version

"""
DotMac Platform Services - Unified platform infrastructure.

This package provides core platform services for DotMac applications:
- Authentication and authorization (JWT, RBAC, sessions, MFA)
- Secrets management (Vault integration, encryption, rotation)
- Observability (tracing, metrics, logging, health checks)

Design Principles:
1. DRY: Leverages dotmac-core for shared utilities
2. Logical Grouping: Related functionality organized together
3. Production Ready: Battle-tested with comprehensive testing
4. Clear Dependencies: core → platform-services → business-logic
5. Extensible: Plugin architecture for custom providers
"""

__version__ = _load_version()
__author__ = "DotMac Team"
__email__ = "dev@dotmac.com"

# Platform services registry
_services_registry: dict[str, Any] = {}
_initialized_services: set[str] = set()


def get_version() -> str:
    """Get platform services version."""
    return __version__


def register_service(name: str, service: Any) -> None:
    """Register a platform service."""
    _services_registry[name] = service


def get_service(name: str) -> Any | None:
    """Get a registered platform service."""
    return _services_registry.get(name)


def is_service_available(name: str) -> bool:
    """Check if a service is available."""
    return name in _services_registry


def get_available_services() -> list[str]:
    """Get list of available services."""
    return list(_services_registry.keys())


# Configuration management
class PlatformConfig:
    """Platform services configuration management."""

    def __init__(self) -> None:
        self._config: dict[str, Any] = {}
        self._load_from_environment()

    def _load_from_environment(self) -> None:
        """Load configuration from environment variables."""
        # Authentication configuration
        self._config.update(
            {
                "auth": {
                    "jwt_secret_key": os.getenv("DOTMAC_JWT_SECRET_KEY"),
                    "jwt_algorithm": os.getenv("DOTMAC_JWT_ALGORITHM", "HS256"),
                    "access_token_expire_minutes": int(
                        os.getenv("DOTMAC_JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15")
                    ),
                    "refresh_token_expire_days": int(
                        os.getenv("DOTMAC_JWT_REFRESH_TOKEN_EXPIRE_DAYS", "30")
                    ),
                    "session_backend": os.getenv("DOTMAC_SESSION_BACKEND", "memory"),
                    # Use centralized Redis URL from settings (Phase 1 implementation)
                    "redis_url": os.getenv(
                        "DOTMAC_REDIS_URL",
                        os.getenv(
                            "SESSION_REDIS_URL", os.getenv("REDIS_URL", "redis://localhost:6379")
                        ),
                    ),
                },
                # Secrets management configuration
                "secrets": {
                    "vault_url": os.getenv("DOTMAC_VAULT_URL"),
                    "vault_token": os.getenv("DOTMAC_VAULT_TOKEN"),
                    "vault_mount_point": os.getenv("DOTMAC_VAULT_MOUNT_POINT", "secret"),
                    "encryption_key": os.getenv("DOTMAC_ENCRYPTION_KEY"),
                    "auto_rotation": os.getenv("DOTMAC_SECRETS_AUTO_ROTATION", "false").lower()
                    == "true",
                },
                # Observability configuration
                "observability": {
                    "service_name": os.getenv("DOTMAC_SERVICE_NAME", "dotmac-service"),
                    "otlp_endpoint": os.getenv("DOTMAC_OTLP_ENDPOINT"),
                    "log_level": os.getenv("DOTMAC_LOG_LEVEL", "INFO"),
                    "correlation_id_header": os.getenv(
                        "DOTMAC_CORRELATION_ID_HEADER", "X-Correlation-ID"
                    ),
                    "tracing_enabled": os.getenv("DOTMAC_TRACING_ENABLED", "true").lower()
                    == "true",
                    "metrics_enabled": os.getenv("DOTMAC_METRICS_ENABLED", "true").lower()
                    == "true",
                },
            }
        )

    def get(self, key: str, default: Any | None = None) -> Any:
        """Get configuration value by key path (e.g., 'auth.jwt_secret_key')."""
        keys = key.split(".")
        value = self._config

        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default

        return value

    def update(self, updates: dict[str, Any]) -> None:
        """Update configuration with new values."""
        self._merge_config(self._config, updates)

    def _merge_config(self, target: dict[str, Any], source: dict[str, Any]) -> None:
        """Recursively merge configuration dictionaries."""
        for key, value in source.items():
            if key in target and isinstance(target[key], dict) and isinstance(value, dict):
                self._merge_config(target[key], value)
            else:
                target[key] = value


# Global configuration instance
config = PlatformConfig()


def initialize_platform_services(
    auth_config: dict[str, Any] | None = None,
    secrets_config: dict[str, Any] | None = None,
    observability_config: dict[str, Any] | None = None,
    auto_discover: bool = True,
) -> None:
    """
    Initialize platform services with optional configuration.

    Args:
        auth_config: Authentication service configuration
        secrets_config: Secrets management configuration
        observability_config: Observability configuration
        auto_discover: Whether to auto-discover and initialize available services
    """
    # Update global configuration
    if auth_config:
        config.update({"auth": auth_config})
    if secrets_config:
        config.update({"secrets": secrets_config})
    if observability_config:
        config.update({"observability": observability_config})

    if auto_discover:
        # Import and initialize available services
        _initialize_available_services()


def _initialize_available_services() -> None:
    """Initialize available platform services."""
    import importlib.util

    # Check if auth module is available
    if importlib.util.find_spec("dotmac.platform.auth"):
        _initialized_services.add("auth")

    # Check if secrets service is available
    if importlib.util.find_spec("dotmac.platform.secrets"):
        # Note: There's no initialize_secrets_service function in the current secrets module
        # The secrets module provides VaultClient, SymmetricEncryptionService, etc.
        _initialized_services.add("secrets")

    # Observability module doesn't exist yet - commented out for now
    # try:
    #     from .observability import initialize
    #     initialize(config.get("observability", {}))
    #     _initialized_services.add("observability")
    # except ImportError:
    #     pass


def get_initialized_services() -> set[str]:
    """Get set of initialized services."""
    return _initialized_services.copy()


# Quick access functions
def create_jwt_service(**kwargs: Any) -> Any:
    """Quick create JWT service with configuration.

    Maps flat auth config keys (e.g., jwt_secret_key, jwt_algorithm) to the
    JWTService/create_jwt_service_from_config schema.
    """
    try:
        from .auth import JWTService

        cfg = dict(config.get("auth", {}))
        cfg.update(kwargs)

        secret = cfg.get("jwt_secret_key") or cfg.get("secret")
        algorithm = cfg.get("jwt_algorithm") or cfg.get("algorithm")
        redis_url = cfg.get("redis_url")

        return JWTService(secret=secret, algorithm=algorithm, redis_url=redis_url)
    except ImportError:
        raise ImportError(
            "Auth service not available. Ensure core dependencies are installed. "
            "For running a server, optionally install extras: "
            "pip install 'dotmac-platform-services[server]' or use '[all]'"
        )


def create_secrets_manager(backend: str | None = None, **kwargs: Any) -> Any:
    """
    Create a secrets manager with clean factory pattern.

    Args:
        backend: 'vault', 'local', or None for auto-detection
        **kwargs: Backend-specific configuration

    Returns:
        SecretsManager instance following the protocol

    Example:
        # Auto-select best backend
        manager = create_secrets_manager()

        # Explicit Vault backend
        manager = create_secrets_manager("vault", vault_url="...", vault_token="...")

        # Local development backend
        manager = create_secrets_manager("local")
    """
    try:
        from .secrets.factory import create_secrets_manager as factory_create

        secrets_config = config.get("secrets", {})
        secrets_config.update(kwargs)

        # Handle None backend by using auto-detection
        if backend is None:
            return factory_create(**secrets_config)
        else:
            return factory_create(backend, **secrets_config)
    except ImportError as e:
        raise ImportError(
            f"Secrets service error: {e}. "
            "For Vault support, install: pip install 'dotmac-platform-services[vault]'"
        )


def create_observability_manager(
    app: Any | None = None,
    *,
    auto_initialize: bool = False,
    **kwargs: Any,
) -> _ObservabilityManager:
    """Create an observability manager backed by the telemetry helpers."""

    try:
        from .observability import ObservabilityManager
    except ImportError as exc:  # pragma: no cover - safety net
        raise ImportError(
            "Observability services unavailable. Install telemetry extras or check dependencies."
        ) from exc

    return ObservabilityManager(app=app, auto_initialize=auto_initialize, **kwargs)


# Re-export selected components for convenience
# Use the proper factory pattern instead of confusing aliases
try:
    from .secrets.factory import SecretsManager  # Protocol interface
except Exception:  # pragma: no cover - optional
    SecretsManager = None  # type: ignore

try:
    from .core import create_application, get_application  # type: ignore
except Exception:  # pragma: no cover - optional

    def create_application(*args, **kwargs: Any):  # type: ignore
        raise ImportError("core.create_application unavailable")

    def get_application(*args, **kwargs: Any):  # type: ignore
        return None


# Export main components
__all__ = [
    "PlatformConfig",
    "__version__",
    "SecretsManager",
    "create_application",
    "get_application",
    "config",
    "create_jwt_service",
    "create_observability_manager",
    "create_secrets_manager",
    "get_available_services",
    "get_initialized_services",
    "get_service",
    "initialize_platform_services",
    "is_service_available",
    "register_service",
]
