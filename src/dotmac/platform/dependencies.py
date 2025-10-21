"""
Dependency management with clear error messages and feature flag integration.

This module provides utilities for checking optional dependencies and providing
helpful error messages when they're missing.
"""

import importlib
from collections.abc import Callable
from typing import Any, TypeVar, cast

from .settings import settings

F = TypeVar("F", bound=Callable[..., Any])


class DependencyError(ImportError):
    """Raised when a required dependency is missing."""

    def __init__(
        self, feature: str, packages: str | list[str], install_cmd: str | None = None
    ) -> None:
        if isinstance(packages, str):
            packages = [packages]

        pkg_list = ", ".join(packages)
        message = f"Feature '{feature}' requires: {pkg_list}"

        if install_cmd:
            message += f"\nInstall with: {install_cmd}"
        elif len(packages) == 1:
            message += f"\nInstall with: pip install {packages[0]}"
        else:
            message += f"\nInstall with: pip install {' '.join(packages)}"

        super().__init__(message)


class DependencyChecker:
    """Utility for checking and managing optional dependencies."""

    # Mapping of feature flags to required packages
    FEATURE_DEPENDENCIES: dict[str, dict[str, str | list[str]]] = {
        # Storage - MinIO only
        "storage_enabled": {
            "packages": ["minio"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Legacy alias for storage
        "storage_s3_enabled": {
            "packages": ["minio"],
            "install_cmd": "poetry install",
        },
        # Search
        "search_enabled": {
            "packages": ["meilisearch"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Legacy alias for search
        "search_meilisearch_enabled": {
            "packages": ["meilisearch"],
            "install_cmd": "poetry install",
        },
        # Observability (OpenTelemetry and Prometheus)
        "otel_enabled": {
            "packages": ["opentelemetry-api", "opentelemetry-sdk"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        "prometheus_enabled": {
            "packages": ["prometheus-client"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Encryption and secrets
        "encryption_fernet": {
            "packages": ["cryptography"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        "secrets_vault": {
            "packages": ["hvac"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Data transfer
        "data_transfer_excel": {
            "packages": ["openpyxl", "xlsxwriter"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # File processing
        "file_processing_pdf": {
            "packages": ["pypdf2"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        "file_processing_images": {
            "packages": ["Pillow"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Task queue
        "celery_enabled": {
            "packages": ["celery"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        # Database
        "db_postgresql": {
            "packages": ["asyncpg"],
            "install_cmd": "poetry install",  # Core dependency now
        },
        "db_sqlite": {
            "packages": ["aiosqlite"],
            "install_cmd": "poetry install",  # Core dependency now
        },
    }

    @classmethod
    def check_feature_dependency(cls, feature_flag: str) -> bool:
        """
        Check if a feature's dependencies are available.

        Args:
            feature_flag: The feature flag name (e.g., 'storage_s3_enabled')

        Returns:
            True if all dependencies are available, False otherwise
        """
        if feature_flag not in cls.FEATURE_DEPENDENCIES:
            return True  # No dependencies required

        dep_info = cls.FEATURE_DEPENDENCIES[feature_flag]
        packages = dep_info["packages"]
        if isinstance(packages, str):
            packages = [packages]

        for package in packages:
            try:
                importlib.import_module(package)
            except ImportError:
                return False
        return True

    @classmethod
    def require_feature_dependency(cls, feature_flag: str) -> None:
        """
        Require that a feature's dependencies are available, raise DependencyError if not.

        Args:
            feature_flag: The feature flag name

        Raises:
            DependencyError: If dependencies are missing
        """
        if feature_flag not in cls.FEATURE_DEPENDENCIES:
            return  # No dependencies required

        dep_info = cls.FEATURE_DEPENDENCIES[feature_flag]
        packages = dep_info["packages"]
        install_cmd_raw = dep_info.get("install_cmd")
        install_cmd: str | None
        if isinstance(install_cmd_raw, (list, tuple)):
            install_cmd = " ".join(str(part) for part in install_cmd_raw)
        elif install_cmd_raw is None:
            install_cmd = None
        else:
            install_cmd = str(install_cmd_raw)

        if isinstance(packages, str):
            packages = [packages]

        missing = []
        for package in packages:
            try:
                importlib.import_module(package)
            except ImportError:
                missing.append(package)

        if missing:
            raise DependencyError(feature_flag, missing, install_cmd)

    @classmethod
    def check_enabled_features(cls) -> dict[str, bool]:
        """
        Check all enabled features and their dependency status.

        Returns:
            Dict mapping feature names to whether their dependencies are available
        """
        results = {}

        for feature_flag, _dep_info in cls.FEATURE_DEPENDENCIES.items():
            # Check if feature is enabled in settings
            feature_enabled = getattr(settings.features, feature_flag, False)
            if feature_enabled:
                results[feature_flag] = cls.check_feature_dependency(feature_flag)

        return results

    @classmethod
    def validate_enabled_features(cls) -> None:
        """
        Validate all enabled features have their dependencies available.

        Raises:
            DependencyError: If any enabled feature has missing dependencies
        """
        for feature_flag, _dep_info in cls.FEATURE_DEPENDENCIES.items():
            # Check if feature is enabled in settings
            feature_enabled = getattr(settings.features, feature_flag, False)
            if feature_enabled:
                cls.require_feature_dependency(feature_flag)


def require_dependency(feature_flag: str) -> Callable[[F], F]:
    """
    Decorator to require dependencies for a function/class.

    Args:
        feature_flag: The feature flag name

    Example:
        @require_dependency("storage_enabled")
        def create_minio_client():
            from minio import Minio
            return Minio(...)
    """

    def decorator(func: F) -> F:
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Check if feature is enabled
            if not getattr(settings.features, feature_flag, False):
                raise ValueError(f"Feature '{feature_flag}' is not enabled in settings")

            # Check dependencies
            DependencyChecker.require_feature_dependency(feature_flag)
            return func(*args, **kwargs)

        return cast(F, wrapper)

    return decorator


def _is_feature_enabled(feature_flag: str) -> bool:
    """Best-effort check for feature toggles across settings."""

    features = getattr(settings, "features", None)
    if features and hasattr(features, feature_flag):
        return bool(getattr(features, feature_flag))

    observability = getattr(settings, "observability", None)
    if observability and hasattr(observability, feature_flag):
        return bool(getattr(observability, feature_flag))

    rate_limit = getattr(settings, "rate_limit", None)
    if rate_limit and hasattr(rate_limit, feature_flag):
        return bool(getattr(rate_limit, feature_flag))

    return False


def safe_import(
    module_name: str,
    feature_flag: str | None = None,
    *,
    error_if_missing: bool = True,
) -> Any:
    """
    Safely import a module with helpful error messages.

    Args:
        module_name: The module to import
        feature_flag: Optional feature flag that controls this import
        error_if_missing: When True, raise a dependency error if the module is
            missing and the associated feature flag is enabled. When False,
            return ``None`` silently.

    Returns:
        The imported module or None if not available

    Raises:
        DependencyError: If feature is enabled but dependency is missing
    """
    try:
        return importlib.import_module(module_name)
    except ImportError:
        if feature_flag and error_if_missing and _is_feature_enabled(feature_flag):
            # Feature is enabled but dependency is missing - surface helpful error
            DependencyChecker.require_feature_dependency(feature_flag)
        return None


# Convenience functions for common dependencies
def require_minio() -> Any:
    """Require minio for storage operations."""
    if settings.features.storage_enabled:
        DependencyChecker.require_feature_dependency("storage_enabled")
        import minio

        return minio
    else:
        raise ValueError("Storage is not enabled. Set FEATURES__STORAGE_ENABLED=true")


def require_meilisearch() -> Any:
    """Require meilisearch for search operations."""
    if settings.features.search_enabled:
        DependencyChecker.require_feature_dependency("search_enabled")
        import meilisearch

        return meilisearch
    else:
        raise ValueError("Search is not enabled. Set FEATURES__SEARCH_ENABLED=true")


def require_cryptography() -> Any:
    """Require cryptography for Fernet encryption."""
    if settings.features.encryption_fernet:
        DependencyChecker.require_feature_dependency("encryption_fernet")
        from cryptography.fernet import Fernet

        return Fernet
    else:
        raise ValueError("Fernet encryption is not enabled. Set FEATURES__ENCRYPTION_FERNET=true")


# Re-export common FastAPI dependencies for routers
from .auth.core import get_current_user  # noqa: E402, F401

# Re-export service factory dependencies
from .communications.email_service import get_email_service  # noqa: E402, F401
from .db import get_async_session, get_db  # noqa: E402, F401
from .events.dependencies import get_event_bus_dependency as get_event_bus  # noqa: E402, F401
from .tenant.dependencies import get_tenant_service  # noqa: E402, F401


# Deployment service factory
def get_deployment_service(db=None):
    """
    Get deployment service instance.

    This is a re-export wrapper for the deployment service factory.
    Import the actual factory from deployment.router for full functionality.
    """

    from .deployment.service import DeploymentService

    if db is None:
        # If no db provided, this is being used as a factory reference
        # Return a lambda that creates the service when called with db
        return lambda session: DeploymentService(session)

    return DeploymentService(db)


# Notification service factory
def get_notification_service(db=None):
    """
    Get notification service instance.

    Args:
        db: AsyncSession instance (optional)

    Returns:
        NotificationService instance or factory function
    """
    from .notifications.service import NotificationService

    if db is None:
        # Return factory function
        return lambda session: NotificationService(session)

    return NotificationService(db)


__all__ = [
    "DependencyChecker",
    "DependencyError",
    "require_dependency",
    "safe_import",
    "require_minio",
    "require_meilisearch",
    "require_cryptography",
    # FastAPI dependencies
    "get_db",
    "get_async_session",
    "get_current_user",
    # Service factories
    "get_deployment_service",
    "get_email_service",
    "get_event_bus",
    "get_notification_service",
    "get_tenant_service",
]
