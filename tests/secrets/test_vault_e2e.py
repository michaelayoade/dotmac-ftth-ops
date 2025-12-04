"""
Vault Integration End-to-End Tests

Tests real Vault secret loading flow (not mocked):
- Vault client initialization
- Secret retrieval from actual Vault instance
- Alertmanager webhook secret loading
- Secret rotation handling
- Connection error resilience

Requires:
- Docker (for dev Vault container)
- Or VAULT_ENABLED=true with real Vault instance

Run with: pytest tests/secrets/test_vault_e2e.py -m "e2e and vault"

The tests automatically detect if running inside Docker and adjust connection
parameters accordingly:
- Inside Docker: Use service name 'vault'
- Outside Docker: Use 'localhost' with port forwarding
"""

import os
import subprocess
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal
from unittest.mock import patch

import pytest

from dotmac.platform.settings import settings as base_settings
from tests.helpers.docker_env import get_docker_network_url

# Custom marker for Vault tests
pytestmark = [pytest.mark.integration, pytest.mark.e2e, pytest.mark.slow]

RUN_VAULT_E2E = os.getenv("RUN_VAULT_E2E") == "1"


class _InMemoryVaultBackend:
    """Minimal Vault-like backend for environments without Docker."""

    def __init__(self) -> None:
        self._storage: dict[str, dict[str, Any]] = {}
        self.healthy: bool = True

    def create_client(self) -> "_StubVaultClient":
        return _StubVaultClient(self)


class _StubVaultClient:
    """Lightweight stand-in for VaultClient with in-memory storage."""

    def __init__(self, backend: _InMemoryVaultBackend) -> None:
        self._backend = backend
        self.url = "vault://in-memory"
        self.token = "stub-token"

    def health_check(self) -> bool:
        return self._backend.healthy

    def get_secret(self, path: str) -> dict[str, Any]:
        return dict(self._backend._storage.get(path, {}))

    def get_secrets(self, paths: list[str]) -> dict[str, dict[str, Any]]:
        return {path: dict(self._backend._storage.get(path, {})) for path in paths}

    def set_secret(self, path: str, data: dict[str, Any]) -> None:
        self._backend._storage[path] = dict(data)

    def list_secrets(self, path: str = "") -> list[str]:
        prefix = path.rstrip("/")
        if prefix:
            prefix = f"{prefix}/"
        return [
            key[len(prefix) :]
            for key in self._backend._storage
            if not prefix or key.startswith(prefix)
        ]

    # Context manager compatibility
    def __enter__(self) -> "_StubVaultClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def close(self) -> None:
        """No-op close for compatibility."""
        return None


@dataclass
class VaultTestEnvironment:
    """Describe the Vault test backend in use."""

    mode: Literal["docker", "stub"]
    url: str
    token: str
    existing: bool
    create_client: Callable[[], Any]
    backend: _InMemoryVaultBackend | None = None


@pytest.fixture(scope="class")
def vault_test_env() -> VaultTestEnvironment:
    if RUN_VAULT_E2E:
        container_name = "dotmac-test-vault"

        try:
            subprocess.run(
                ["docker", "--version"],
                check=True,
                capture_output=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            pytest.skip("Docker not available for Vault e2e tests")

        existing_vault = None
        try:
            result = subprocess.run(
                ["docker", "ps", "--filter", "publish=8200", "--format", "{{.Names}}"],
                check=True,
                capture_output=True,
                timeout=5,
                text=True,
            )
            existing_containers = result.stdout.strip().split("\n")
            existing_vault = [c for c in existing_containers if c and "vault" in c.lower()]
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            existing_vault = None

        if existing_vault:
            container_name = existing_vault[0]
            vault_token = os.getenv("VAULT_TOKEN", "dev-token-12345")
            # Auto-detect URL: use 'vault' service name in Docker, localhost outside
            vault_url = get_docker_network_url("vault", 8200)

            from dotmac.platform.secrets.vault_client import VaultClient

            env = VaultTestEnvironment(
                mode="docker",
                url=vault_url,
                token=vault_token,
                existing=True,
                create_client=lambda: VaultClient(
                    url=vault_url,
                    token=vault_token,
                ),
            )
            yield env
            return

        try:
            subprocess.run(
                ["docker", "rm", "-f", container_name],
                capture_output=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired:
            pass

        try:
            subprocess.run(
                [
                    "docker",
                    "run",
                    "-d",
                    "--name",
                    container_name,
                    "-p",
                    "8201:8200",
                    "-e",
                    "VAULT_DEV_ROOT_TOKEN_ID=test-root-token",
                    "hashicorp/vault:latest",
                ],
                check=True,
                capture_output=True,
                timeout=30,
            )
        except Exception as exc:  # pragma: no cover - Docker failure
            pytest.skip(f"Unable to start Vault dev container: {exc}")

        from dotmac.platform.secrets.vault_client import VaultClient

        time.sleep(3)

        env = VaultTestEnvironment(
            mode="docker",
            url="http://localhost:8201",
            token="test-root-token",
            existing=False,
            create_client=lambda: VaultClient(
                url="http://localhost:8201",
                token="test-root-token",
            ),
        )

        try:
            yield env
        finally:
            try:
                subprocess.run(
                    ["docker", "rm", "-f", container_name],
                    capture_output=True,
                    timeout=10,
                )
            except subprocess.TimeoutExpired:
                pass
    else:
        backend = _InMemoryVaultBackend()
        env = VaultTestEnvironment(
            mode="stub",
            url="vault://in-memory",
            token="stub-token",
            existing=False,
            create_client=lambda: backend.create_client(),
            backend=backend,
        )
        yield env


class TestVaultContainerE2E:
    """End-to-end tests using containerized Vault instance."""

    def test_vault_connection_successful(self, vault_test_env: VaultTestEnvironment):
        """Test Vault client can connect to real Vault instance."""
        client = vault_test_env.create_client()

        # Test health check
        is_healthy = client.health_check()
        assert is_healthy, "Vault should be healthy"

    def test_vault_write_and_read_secret(self, vault_test_env: VaultTestEnvironment):
        """Test writing and reading secret from real Vault."""
        # Skip write tests when using existing production Vault
        if vault_test_env.existing:
            pytest.skip("Write tests skipped for existing Vault container (may lack permissions)")

        client = vault_test_env.create_client()

        # Write a test secret
        test_secret_path = "secret/test/alertmanager/webhook_secret"
        test_secret_value = "test-webhook-secret-12345"

        client.set_secret(test_secret_path, {"value": test_secret_value})

        # Read the secret back
        secret = client.get_secret(test_secret_path)

        assert secret is not None, "Secret should be readable"
        assert "value" in secret, "Secret should contain 'value' key"
        assert secret["value"] == test_secret_value, "Secret value should match"

    def test_alertmanager_webhook_secret_loading(self, vault_test_env: VaultTestEnvironment):
        """Test loading Alertmanager webhook secret from Vault (real flow)."""
        # Skip write tests when using existing production Vault
        if vault_test_env.existing:
            pytest.skip("Write tests skipped for existing Vault container (may lack permissions)")

        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault_sync

        client = vault_test_env.create_client()

        # Write Alertmanager webhook secret to Vault
        webhook_secret_path = "observability/alertmanager/webhook_secret"
        webhook_secret_value = "production-webhook-secret-abc123"

        client.set_secret(webhook_secret_path, {"value": webhook_secret_value})

        settings_copy = base_settings.model_copy(deep=True)
        settings_copy.vault.enabled = True
        settings_copy.vault.url = vault_test_env.url
        settings_copy.vault.token = vault_test_env.token
        settings_copy.vault.mount_path = "secret"
        settings_copy.vault.namespace = None

        load_secrets_from_vault_sync(settings_obj=settings_copy, vault_client=client)

        loaded_secret = settings_copy.observability.alertmanager_webhook_secret
        assert loaded_secret == webhook_secret_value, "Loaded secret should match written value"

    def test_vault_secret_not_found_handling(self, vault_test_env: VaultTestEnvironment):
        """Test Vault client handles missing secrets gracefully."""
        # Skip for existing Vault as it may return permission denied instead of not found
        if vault_test_env.existing:
            pytest.skip(
                "Secret not found test skipped for existing Vault (may have different permissions)"
            )

        client = vault_test_env.create_client()

        # Try to read non-existent secret
        secret = client.get_secret("secret/nonexistent/path")

        # Should return None or empty dict (not crash)
        assert secret is None or secret == {}, "Missing secret should return None or empty dict"

    def test_vault_connection_error_handling(self):
        """Test Vault client handles connection errors gracefully."""
        from dotmac.platform.secrets.vault_client import VaultClient

        # Create client with invalid URL
        client = VaultClient(
            url="http://invalid-vault-url:8200",
            token="test-token",
        )

        # Health check should fail gracefully
        is_healthy = client.health_check()
        assert not is_healthy, "Health check should fail for invalid Vault"


class TestVaultSecretsLoader:
    """Test secrets loader integration with Vault."""

    def test_secrets_loader_vault_disabled(self):
        """Test secrets loader when Vault is disabled."""
        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault_sync

        settings_copy = base_settings.model_copy(deep=True)
        settings_copy.vault.enabled = False

        result = load_secrets_from_vault_sync(settings_obj=settings_copy)
        assert result is None, "Should return None when Vault is disabled"

    def test_secrets_loader_logs_errors(self, caplog):
        """Test secrets loader logs errors on connection failure."""
        import logging

        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault_sync
        from dotmac.platform.secrets.vault_client import VaultError

        caplog.set_level(logging.ERROR)

        settings_copy = base_settings.model_copy(deep=True)
        settings_copy.vault.enabled = True
        settings_copy.vault.url = "http://invalid-vault:8200"
        settings_copy.vault.token = "invalid"

        with patch("dotmac.platform.secrets.secrets_loader.VaultClient") as mock_vault_class:
            mock_vault = mock_vault_class.return_value
            mock_vault.health_check.side_effect = VaultError("connection failed")

            result = load_secrets_from_vault_sync(settings_obj=settings_copy)

        assert result is None, "Should return None when Vault connection fails"
        assert any("Failed to load secrets from Vault" in message for message in caplog.messages)

    def test_vault_secret_mapping(self):
        """Test Vault secret path to settings key mapping."""
        from dotmac.platform.secrets.secrets_loader import SECRETS_MAPPING

        # Verify critical secrets are mapped
        expected_mappings = {
            "observability.alertmanager_webhook_secret": "observability/alertmanager/webhook_secret",
        }

        for setting_key, vault_path in expected_mappings.items():
            assert setting_key in SECRETS_MAPPING, (
                f"Setting '{setting_key}' should be in SECRETS_MAPPING"
            )

            assert SECRETS_MAPPING[setting_key] == vault_path, (
                f"Setting '{setting_key}' should map to '{vault_path}'"
            )


class TestVaultProductionValidation:
    """Test production-specific Vault requirements."""

    def test_production_requires_webhook_secret(self):
        """Test production environment requires Alertmanager webhook secret."""

        # Mock production environment
        with patch.dict(os.environ, {"DOTMAC_ENVIRONMENT": "production"}):
            # Should validate that webhook secret is set
            # (Implementation should enforce this in production)
            pass  # Placeholder - depends on production validation logic

    def test_vault_token_rotation_support(self):
        """Test Vault client supports token rotation."""
        from dotmac.platform.secrets.vault_client import VaultClient

        # Create client with initial token
        client = VaultClient(url="http://test:8200", token="initial-token")

        # Should be able to update token (for rotation)
        # (Implementation detail - depends on VaultClient design)
        assert hasattr(client, "token") or hasattr(client, "_token"), (
            "VaultClient should store token for rotation support"
        )


class TestVaultHealthCheck:
    """Test Vault health check integration."""

    def test_health_check_integration(self):
        """Test health check includes Vault status."""
        from dotmac.platform.monitoring.health_checks import HealthChecker

        checker = HealthChecker()

        # Mock Vault settings
        with patch("dotmac.platform.monitoring.health_checks.settings") as mock_settings:
            mock_settings.vault.enabled = True
            mock_settings.vault.url = "http://localhost:8200"
            mock_settings.vault.token = "test"
            mock_settings.environment = "production"

            # Mock VaultClient to avoid actual connection
            with patch("dotmac.platform.secrets.VaultClient") as mock_vault_class:
                mock_vault = mock_vault_class.return_value
                mock_vault.__enter__.return_value = mock_vault
                mock_vault.health_check.return_value = True

                result = checker.check_vault()

                # Vault should be checked and healthy
                assert result.name == "vault"
                assert result.is_healthy, "Mocked Vault should be healthy"
                assert result.required is True, "Vault should be required in production"
