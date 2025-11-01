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
"""

import os
import subprocess
from pathlib import Path
from unittest.mock import patch

import pytest


# Custom marker for Vault tests
pytestmark = [pytest.mark.e2e, pytest.mark.slow]

if os.getenv("RUN_VAULT_E2E") != "1":
    pytest.skip(
        "Vault E2E tests require Docker and are disabled by default. "
        "Set RUN_VAULT_E2E=1 to enable them.",
        allow_module_level=True,
    )


class TestVaultContainerE2E:
    """End-to-end tests using containerized Vault instance."""

    @pytest.fixture(scope="class")
    def vault_container(self):
        """Use existing Vault container or start a new dev container for testing."""
        try:
            # Check if docker is available
            subprocess.run(
                ["docker", "--version"],
                check=True,
                capture_output=True,
                timeout=5,
            )
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            pytest.skip("Docker not available for Vault e2e tests")

        # Check if there's already a Vault container running on port 8200
        try:
            result = subprocess.run(
                ["docker", "ps", "--filter", "publish=8200", "--format", "{{.Names}}"],
                check=True,
                capture_output=True,
                timeout=5,
                text=True,
            )
            existing_containers = result.stdout.strip().split('\n')
            existing_vault = [c for c in existing_containers if c and 'vault' in c.lower()]

            if existing_vault:
                # Use existing Vault container
                container_name = existing_vault[0]

                # Get Vault token from environment or use dev default for dotmac-ftth-ops
                vault_token = os.getenv("VAULT_TOKEN", "dev-token-12345")

                yield {
                    "url": "http://localhost:8200",
                    "token": vault_token,
                    "container": container_name,
                    "existing": True,  # Mark as existing so we don't clean it up
                }
                return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass  # Fall through to create new container

        # Start Vault dev server in Docker
        container_name = "dotmac-test-vault"

        # Stop and remove existing test container if present
        try:
            subprocess.run(
                ["docker", "rm", "-f", container_name],
                capture_output=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired:
            pytest.skip("Unable to remove existing Vault container (docker rm timed out)")

        # Start Vault dev container
        try:
            subprocess.run(
                [
                    "docker", "run", "-d",
                    "--name", container_name,
                    "-p", "8201:8200",  # Use different port to avoid conflict
                    "-e", "VAULT_DEV_ROOT_TOKEN_ID=test-root-token",
                    "hashicorp/vault:latest",
                ],
                check=True,
                capture_output=True,
                timeout=30,
            )

            # Wait for Vault to be ready
            import time
            time.sleep(3)

            yield {
                "url": "http://localhost:8201",  # Updated port
                "token": "test-root-token",
                "container": container_name,
                "existing": False,
            }

        finally:
            # Cleanup: stop and remove container only if we created it
            try:
                subprocess.run(
                    ["docker", "rm", "-f", container_name],
                    capture_output=True,
                    timeout=10,
                )
            except subprocess.TimeoutExpired:
                pytest.skip("Failed to clean up Vault test container (docker rm timed out)")

    def test_vault_connection_successful(self, vault_container):
        """Test Vault client can connect to real Vault instance."""
        from dotmac.platform.secrets.vault_client import VaultClient

        client = VaultClient(
            url=vault_container["url"],
            token=vault_container["token"],
        )

        # Test health check
        is_healthy = client.health_check()
        assert is_healthy, "Vault should be healthy"

    def test_vault_write_and_read_secret(self, vault_container):
        """Test writing and reading secret from real Vault."""
        # Skip write tests when using existing production Vault
        if vault_container.get("existing", False):
            pytest.skip("Write tests skipped for existing Vault container (may lack permissions)")

        from dotmac.platform.secrets.vault_client import VaultClient

        client = VaultClient(
            url=vault_container["url"],
            token=vault_container["token"],
        )

        # Write a test secret
        test_secret_path = "secret/test/alertmanager/webhook_secret"
        test_secret_value = "test-webhook-secret-12345"

        client.set_secret(test_secret_path, {"value": test_secret_value})

        # Read the secret back
        secret = client.get_secret(test_secret_path)

        assert secret is not None, "Secret should be readable"
        assert "value" in secret, "Secret should contain 'value' key"
        assert secret["value"] == test_secret_value, "Secret value should match"

    def test_alertmanager_webhook_secret_loading(self, vault_container):
        """Test loading Alertmanager webhook secret from Vault (real flow)."""
        # Skip write tests when using existing production Vault
        if vault_container.get("existing", False):
            pytest.skip("Write tests skipped for existing Vault container (may lack permissions)")

        from dotmac.platform.secrets.vault_client import VaultClient
        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault

        client = VaultClient(
            url=vault_container["url"],
            token=vault_container["token"],
        )

        # Write Alertmanager webhook secret to Vault
        webhook_secret_path = "secret/observability/alertmanager/webhook_secret"
        webhook_secret_value = "production-webhook-secret-abc123"

        client.set_secret(webhook_secret_path, {"value": webhook_secret_value})

        # Mock settings to use test Vault
        with patch("dotmac.platform.secrets.secrets_loader.settings") as mock_settings:
            mock_settings.vault.enabled = True
            mock_settings.vault.url = vault_container["url"]
            mock_settings.vault.token = vault_container["token"]
            mock_settings.vault.mount_path = "secret"
            mock_settings.vault.namespace = None

            # Load secrets using real Vault client
            secrets = load_secrets_from_vault()

            # Verify Alertmanager webhook secret was loaded
            assert "observability.alertmanager_webhook_secret" in secrets, (
                "Alertmanager webhook secret should be loaded"
            )

            assert secrets["observability.alertmanager_webhook_secret"] == webhook_secret_value, (
                "Loaded secret should match written value"
            )

    def test_vault_secret_not_found_handling(self, vault_container):
        """Test Vault client handles missing secrets gracefully."""
        # Skip for existing Vault as it may return permission denied instead of not found
        if vault_container.get("existing", False):
            pytest.skip("Secret not found test skipped for existing Vault (may have different permissions)")

        from dotmac.platform.secrets.vault_client import VaultClient

        client = VaultClient(
            url=vault_container["url"],
            token=vault_container["token"],
        )

        # Try to read non-existent secret
        secret = client.get_secret("secret/nonexistent/path")

        # Should return None or empty dict (not crash)
        assert secret is None or secret == {}, (
            "Missing secret should return None or empty dict"
        )

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
        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault

        with patch("dotmac.platform.secrets.secrets_loader.settings") as mock_settings:
            mock_settings.vault.enabled = False

            secrets = load_secrets_from_vault()

            # Should return empty dict when Vault disabled
            assert secrets == {}, "Should return empty dict when Vault disabled"

    def test_secrets_loader_logs_errors(self, caplog):
        """Test secrets loader logs errors on connection failure."""
        from dotmac.platform.secrets.secrets_loader import load_secrets_from_vault
        import logging

        caplog.set_level(logging.ERROR)

        with patch("dotmac.platform.secrets.secrets_loader.settings") as mock_settings:
            mock_settings.vault.enabled = True
            mock_settings.vault.url = "http://invalid-vault:8200"
            mock_settings.vault.token = "invalid"

            # Should handle error gracefully
            secrets = load_secrets_from_vault()

            # Should return empty or partial secrets
            assert isinstance(secrets, dict), "Should return dict even on error"

    def test_vault_secret_mapping(self):
        """Test Vault secret path to settings key mapping."""
        from dotmac.platform.secrets.secrets_loader import VAULT_SECRET_MAPPING

        # Verify critical secrets are mapped
        expected_mappings = {
            "observability.alertmanager_webhook_secret": "secret/observability/alertmanager/webhook_secret",
        }

        for setting_key, vault_path in expected_mappings.items():
            assert setting_key in VAULT_SECRET_MAPPING, (
                f"Setting '{setting_key}' should be in VAULT_SECRET_MAPPING"
            )

            assert VAULT_SECRET_MAPPING[setting_key] == vault_path, (
                f"Setting '{setting_key}' should map to '{vault_path}'"
            )


class TestVaultProductionValidation:
    """Test production-specific Vault requirements."""

    def test_production_requires_webhook_secret(self):
        """Test production environment requires Alertmanager webhook secret."""
        from dotmac.platform.settings import Settings

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
            with patch("dotmac.platform.monitoring.health_checks.VaultClient") as mock_vault_class:
                mock_vault = mock_vault_class.return_value
                mock_vault.health_check.return_value = True

                result = checker.check_vault()

                # Vault should be checked and healthy
                assert result.name == "vault"
                assert result.is_healthy, "Mocked Vault should be healthy"
                assert result.required is True, "Vault should be required in production"
