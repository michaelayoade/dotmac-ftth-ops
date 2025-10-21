"""
Secrets management factory with feature flag integration.

This module provides a clean factory pattern for creating secrets managers
based on feature flags, replacing the confusing alias pattern.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from ..dependencies import DependencyChecker, require_dependency
from ..settings import settings


@runtime_checkable
class SecretsManager(Protocol):
    """Protocol defining the secrets manager interface."""

    def get_secret(self, path: str) -> dict[str, Any]:
        """Retrieve a secret from the backend."""
        ...

    def set_secret(self, path: str, data: dict[str, Any]) -> None:
        """Store a secret in the backend."""
        ...

    def health_check(self) -> bool:
        """Check if the secrets backend is healthy."""
        ...


class LocalSecretsManager:
    """Local file-based secrets manager for development."""

    def __init__(self, secrets_file: str = ".env") -> None:
        self.secrets_file = secrets_file
        self._secrets: dict[str, dict[str, Any]] = {}

    def get_secret(self, path: str) -> dict[str, Any]:
        """Get secret from local storage."""
        return self._secrets.get(path, {}).copy()

    def set_secret(self, path: str, data: dict[str, Any]) -> None:
        """Set secret in local storage."""
        self._secrets[path] = data.copy()

    def health_check(self) -> bool:
        """Local storage is always healthy."""
        return True


class SecretsManagerFactory:
    """Factory for creating secrets manager instances."""

    @staticmethod
    def create_secrets_manager(backend: str | None = None, **kwargs: Any) -> SecretsManager:
        """
        Create a secrets manager instance.

        Args:
            backend: Backend type ('vault', 'local', or auto-detect)
            **kwargs: Backend-specific configuration

        Returns:
            SecretsManager instance

        Raises:
            ValueError: If backend is not enabled
            DependencyError: If backend dependencies are missing
        """
        if backend is None:
            backend = SecretsManagerFactory._auto_select_backend()

        if backend == "vault":
            if not settings.features.secrets_vault:
                raise ValueError(
                    "Vault secrets backend not enabled. Set FEATURES__SECRETS_VAULT=true"
                )

            DependencyChecker.require_feature_dependency("secrets_vault")
            from .vault_client import VaultClient

            return VaultClient(**kwargs)

        elif backend == "local":
            # Filter out vault-specific config for local backend
            local_kwargs = {k: v for k, v in kwargs.items() if not k.startswith("vault_")}
            # Only pass known local parameters
            allowed_params = {"secrets_file"}
            filtered_kwargs = {k: v for k, v in local_kwargs.items() if k in allowed_params}
            return LocalSecretsManager(**filtered_kwargs)

        else:
            available = ["vault", "local"]
            raise ValueError(f"Unknown secrets backend '{backend}'. Available: {available}")

    @staticmethod
    def _auto_select_backend() -> str:
        """Auto-select the best available secrets backend."""
        # Prefer Vault in production
        if settings.features.secrets_vault and DependencyChecker.check_feature_dependency(
            "secrets_vault"
        ):
            return "vault"

        # Fallback to local
        return "local"

    @staticmethod
    def list_available_backends() -> list[str]:
        """List all available secrets backends."""
        backends = ["local"]  # Always available

        if settings.features.secrets_vault and DependencyChecker.check_feature_dependency(
            "secrets_vault"
        ):
            backends.append("vault")

        return backends


# Convenience functions
def create_secrets_manager(backend: str | None = None, **kwargs: Any) -> SecretsManager:
    """Create a secrets manager instance. Convenience function."""
    return SecretsManagerFactory.create_secrets_manager(backend, **kwargs)


def get_default_secrets_manager(**kwargs: Any) -> SecretsManager:
    """Get the default secrets manager (auto-selected)."""
    return SecretsManagerFactory.create_secrets_manager(**kwargs)


@require_dependency("secrets_vault")  # Untyped decorator
def create_vault_secrets_manager(**kwargs: Any) -> SecretsManager:
    """Create a Vault secrets manager (requires Vault to be enabled)."""
    return SecretsManagerFactory.create_secrets_manager("vault", **kwargs)


def create_local_secrets_manager(**kwargs: Any) -> SecretsManager:
    """Create a local secrets manager (always available)."""
    return SecretsManagerFactory.create_secrets_manager("local", **kwargs)
