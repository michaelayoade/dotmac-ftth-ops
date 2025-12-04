"""
Comprehensive tests for secrets/secrets_loader.py to improve coverage from 12.21%.

Tests cover:
- Async and sync secret loading from Vault
- Setting nested attributes
- Getting nested attributes
- Production secrets validation
- Vault client integration
- Error handling and fallback behavior
- Secrets mapping and configuration
"""

from unittest.mock import AsyncMock, Mock, patch

import pytest

from dotmac.platform.secrets.secrets_loader import (
    SECRETS_MAPPING,
    get_nested_attr,
    get_vault_secret,
    get_vault_secret_async,
    load_secrets_from_vault,
    load_secrets_from_vault_sync,
    set_nested_attr,
    validate_production_secrets,
)
from dotmac.platform.secrets.vault_client import VaultError


@pytest.mark.unit
class TestNestedAttributeHelpers:
    """Test nested attribute getter/setter functions."""

    def test_set_nested_attr_single_level(self):
        """Test setting a single-level attribute."""

        @pytest.mark.unit
        class TestObj:
            value = "old"

        obj = TestObj()
        set_nested_attr(obj, "value", "new")
        assert obj.value == "new"

    def test_set_nested_attr_two_levels(self):
        """Test setting a two-level nested attribute."""

        class Inner:
            password = "old_password"

        class Outer:
            database = Inner()

        obj = Outer()
        set_nested_attr(obj, "database.password", "new_password")
        assert obj.database.password == "new_password"

    def test_set_nested_attr_three_levels(self):
        """Test setting a three-level nested attribute."""

        class Level3:
            key = "old"

        class Level2:
            level3 = Level3()

        class Level1:
            level2 = Level2()

        obj = Level1()
        set_nested_attr(obj, "level2.level3.key", "new_key")
        assert obj.level2.level3.key == "new_key"

    def test_get_nested_attr_single_level(self):
        """Test getting a single-level attribute."""

        @pytest.mark.unit
        class TestObj:
            value = "test_value"

        obj = TestObj()
        result = get_nested_attr(obj, "value")
        assert result == "test_value"

    def test_get_nested_attr_two_levels(self):
        """Test getting a two-level nested attribute."""

        class Inner:
            password = "secret"

        class Outer:
            database = Inner()

        obj = Outer()
        result = get_nested_attr(obj, "database.password")
        assert result == "secret"

    def test_get_nested_attr_with_default(self):
        """Test getting non-existent attribute returns default."""

        @pytest.mark.unit
        class TestObj:
            pass

        obj = TestObj()
        result = get_nested_attr(obj, "non.existent.path", default="default_value")
        assert result == "default_value"

    def test_get_nested_attr_missing_no_default(self):
        """Test getting non-existent attribute returns None by default."""

        @pytest.mark.unit
        class TestObj:
            pass

        obj = TestObj()
        result = get_nested_attr(obj, "missing.path")
        assert result is None


@pytest.mark.unit
class TestSecretsMapping:
    """Test secrets mapping constants."""

    def test_secrets_mapping_exists(self):
        """Test SECRETS_MAPPING constant exists and is not empty."""
        assert SECRETS_MAPPING is not None
        assert len(SECRETS_MAPPING) > 0

    def test_secrets_mapping_has_critical_keys(self):
        """Test mapping contains critical secret keys."""
        critical_keys = [
            "database.password",
            "jwt.secret_key",
            "secret_key",
        ]

        for key in critical_keys:
            assert key in SECRETS_MAPPING

    def test_secrets_mapping_structure(self):
        """Test mapping has valid structure (dot notation -> vault paths)."""
        for setting_path, vault_path in SECRETS_MAPPING.items():
            # Setting paths may have dots
            assert isinstance(setting_path, str)
            assert len(setting_path) > 0

            # Vault paths should be strings
            assert isinstance(vault_path, str)
            assert len(vault_path) > 0


@pytest.mark.asyncio
@pytest.mark.unit
class TestLoadSecretsFromVault:
    """Test async load_secrets_from_vault function."""

    async def test_load_secrets_vault_disabled(self):
        """Test loading secrets when Vault is disabled."""
        mock_settings = Mock()
        mock_settings.vault.enabled = False

        # Should return early without errors
        await load_secrets_from_vault(settings_obj=mock_settings)

    async def test_load_secrets_health_check_fails(self):
        """Test loading secrets when Vault health check fails."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=False)

        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

        # Should return early when health check fails
        mock_client.health_check.assert_called_once()

    async def test_load_secrets_success(self):
        """Test successfully loading secrets from Vault."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"

        # Create simple nested structure
        mock_settings.database = Mock()
        mock_settings.database.password = "old_password"
        mock_settings.jwt = Mock()
        mock_settings.jwt.secret_key = "old_key"
        mock_settings.observability = Mock()
        mock_settings.observability.alertmanager_webhook_secret = "old_webhook_secret"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(
            return_value={
                "database/password": {"value": "new_db_password"},
                "auth/jwt_secret": {"value": "new_jwt_secret"},
                "app/secret_key": {"value": "new_app_secret"},
                "observability/alertmanager/webhook_secret": {"value": "vault-webhook"},
            }
        )
        mock_client.close = AsyncMock()

        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

        # Verify secrets were fetched
        mock_client.get_secrets.assert_called_once()

        # Verify settings were updated
        assert mock_settings.database.password == "new_db_password"
        assert mock_settings.jwt.secret_key == "new_jwt_secret"
        assert mock_settings.observability.alertmanager_webhook_secret == "vault-webhook"

    async def test_load_secrets_with_dict_without_value_key(self):
        """Test loading secrets when dict doesn't have 'value' key."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"
        mock_settings.database = Mock()
        mock_settings.database.password = "old"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        # Return dict with different structure (first value will be taken)
        mock_client.get_secrets = AsyncMock(
            return_value={"database/password": {"password": "secret123"}}
        )
        mock_client.close = AsyncMock()

        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

        assert mock_settings.database.password == "secret123"

    async def test_load_secrets_with_string_value(self):
        """Test loading secrets when value is a direct string."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"
        mock_settings.secret_key = "old_key"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(return_value={"app/secret_key": "direct_string_secret"})
        mock_client.close = AsyncMock()

        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

        assert mock_settings.secret_key == "direct_string_secret"

    async def test_load_secrets_vault_error_development(self):
        """Test VaultError in development doesn't raise."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(side_effect=VaultError("Connection failed"))
        mock_client.close = AsyncMock()

        # Should not raise in development
        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

    async def test_load_secrets_vault_error_production(self):
        """Test VaultError in production raises."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "production"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(side_effect=VaultError("Connection failed"))
        mock_client.close = AsyncMock()

        # Should raise in production
        with pytest.raises(VaultError):
            await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

    async def test_load_secrets_closes_client(self):
        """Test client is closed after loading secrets."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"

        mock_client = AsyncMock()
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(return_value={})
        mock_client.close = AsyncMock()

        await load_secrets_from_vault(settings_obj=mock_settings, vault_client=mock_client)

        mock_client.close.assert_called_once()


@pytest.mark.unit
class TestLoadSecretsFromVaultSync:
    """Test synchronous load_secrets_from_vault_sync function."""

    def test_load_secrets_sync_vault_disabled(self):
        """Test sync loading when Vault is disabled."""
        mock_settings = Mock()
        mock_settings.vault.enabled = False

        load_secrets_from_vault_sync(settings_obj=mock_settings)
        # Should return without error

    def test_load_secrets_sync_health_check_fails(self):
        """Test sync loading when health check fails."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=False)

        load_secrets_from_vault_sync(settings_obj=mock_settings, vault_client=mock_client)

        mock_client.health_check.assert_called_once()

    def test_load_secrets_sync_success(self):
        """Test successfully loading secrets synchronously."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.environment = "development"
        mock_settings.database = Mock()
        mock_settings.database.password = "old_password"

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(
            return_value={"database/password": {"value": "new_password"}}
        )
        mock_client.close = Mock()

        load_secrets_from_vault_sync(settings_obj=mock_settings, vault_client=mock_client)

        assert mock_settings.database.password == "new_password"
        mock_client.get_secrets.assert_called_once()


@pytest.mark.unit
class TestValidateProductionSecrets:
    """Test production secrets validation."""

    def test_validate_production_secrets_all_valid(self):
        """Test validation passes with valid production secrets."""
        mock_settings = Mock()
        mock_settings.secret_key = "very-secure-secret-key-123"
        mock_settings.jwt.secret_key = "secure-jwt-key-456"
        mock_settings.database.password = "very-secure-password-123"
        mock_settings.observability = Mock()
        mock_settings.observability.alertmanager_webhook_secret = "webhook-secret"

        # Should not raise
        validate_production_secrets(mock_settings)

    def test_validate_production_default_secret_key(self):
        """Test validation fails with default secret_key."""
        mock_settings = Mock()
        mock_settings.secret_key = "change-me-in-production"
        mock_settings.jwt.secret_key = "valid-key"
        mock_settings.database.password = "valid-password-123"
        mock_settings.observability = Mock()
        mock_settings.observability.alertmanager_webhook_secret = "webhook-secret"

        with pytest.raises(ValueError, match="secret_key must be changed"):
            validate_production_secrets(mock_settings)

    def test_validate_production_default_jwt_secret(self):
        """Test validation fails with default JWT secret."""
        mock_settings = Mock()
        mock_settings.secret_key = "valid-key"
        mock_settings.jwt.secret_key = "change-me"
        mock_settings.database.password = "valid-password-123"
        mock_settings.observability = Mock()
        mock_settings.observability.alertmanager_webhook_secret = "webhook-secret"

        with pytest.raises(ValueError, match="JWT secret_key must be changed"):
            validate_production_secrets(mock_settings)

    def test_validate_production_missing_alertmanager_secret(self):
        """Test validation fails when Alertmanager webhook secret is missing."""
        mock_settings = Mock()
        mock_settings.secret_key = "secure-app-key"
        mock_settings.jwt.secret_key = "secure-jwt-key"
        mock_settings.database.password = "secure-db-password"
        mock_settings.observability = Mock()
        mock_settings.observability.alertmanager_webhook_secret = ""

        with pytest.raises(ValueError, match="Alertmanager webhook secret must be set"):
            validate_production_secrets(mock_settings)

    def test_validate_production_no_database_password(self):
        """Test validation fails with no database password."""
        mock_settings = Mock()
        mock_settings.secret_key = "valid-key"
        mock_settings.jwt.secret_key = "valid-jwt-key"
        mock_settings.database.password = None

        with pytest.raises(ValueError, match="Database password is not set"):
            validate_production_secrets(mock_settings)

    def test_validate_production_weak_database_password(self):
        """Test validation fails with weak database password."""
        mock_settings = Mock()
        mock_settings.secret_key = "valid-key"
        mock_settings.jwt.secret_key = "valid-jwt-key"
        mock_settings.database.password = "short"  # Less than 12 chars

        with pytest.raises(ValueError, match="Database password is too short"):
            validate_production_secrets(mock_settings)

    def test_validate_production_multiple_errors(self):
        """Test validation reports multiple errors."""
        mock_settings = Mock()
        mock_settings.secret_key = "change-me-in-production"
        mock_settings.jwt.secret_key = "change-me"
        mock_settings.database.password = None

        with pytest.raises(ValueError) as exc_info:
            validate_production_secrets(mock_settings)

        error_message = str(exc_info.value)
        assert "secret_key" in error_message
        assert "JWT secret_key" in error_message
        assert "Database password" in error_message


@pytest.mark.unit
class TestGetVaultSecret:
    """Test convenience function get_vault_secret."""

    @patch("dotmac.platform.secrets.secrets_loader.settings")
    def test_get_vault_secret_disabled(self, mock_settings):
        """Test get_vault_secret returns None when Vault is disabled."""
        mock_settings.vault.enabled = False

        result = get_vault_secret("test/path")
        assert result is None

    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    def test_get_vault_secret_success(self, mock_settings, mock_client_class):
        """Test successfully getting a secret."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = Mock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get_secret = Mock(return_value={"key": "value"})
        mock_client_class.return_value = mock_client

        result = get_vault_secret("test/path")

        assert result == {"key": "value"}
        mock_client.get_secret.assert_called_once_with("test/path")

    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    def test_get_vault_secret_error(self, mock_settings, mock_client_class):
        """Test get_vault_secret returns None on error."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = Mock()
        mock_client.__enter__ = Mock(return_value=mock_client)
        mock_client.__exit__ = Mock(return_value=False)
        mock_client.get_secret = Mock(side_effect=VaultError("Connection failed"))
        mock_client_class.return_value = mock_client

        result = get_vault_secret("test/path")

        assert result is None


@pytest.mark.asyncio
@pytest.mark.unit
class TestGetVaultSecretAsync:
    """Test async convenience function get_vault_secret_async."""

    @patch("dotmac.platform.secrets.secrets_loader.settings")
    async def test_get_vault_secret_async_disabled(self, mock_settings):
        """Test async get_vault_secret returns None when Vault is disabled."""
        mock_settings.vault.enabled = False

        result = await get_vault_secret_async("test/path")
        assert result is None

    @patch("dotmac.platform.secrets.secrets_loader.AsyncVaultClient")
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    async def test_get_vault_secret_async_success(self, mock_settings, mock_client_class):
        """Test successfully getting a secret asynchronously."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get_secret = AsyncMock(return_value={"key": "value"})
        mock_client_class.return_value = mock_client

        result = await get_vault_secret_async("test/path")

        assert result == {"key": "value"}
        mock_client.get_secret.assert_called_once_with("test/path")

    @patch("dotmac.platform.secrets.secrets_loader.AsyncVaultClient")
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    async def test_get_vault_secret_async_error(self, mock_settings, mock_client_class):
        """Test async get_vault_secret returns None on error."""
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get_secret = AsyncMock(side_effect=VaultError("Connection failed"))
        mock_client_class.return_value = mock_client

        result = await get_vault_secret_async("test/path")

        assert result is None


@pytest.mark.unit
class TestEdgeCasesCoverage:
    """Tests to cover edge cases and missing lines for 90% coverage."""

    def test_update_settings_with_secrets_exception_handling(self):
        """Test exception handling when setting attributes fails."""
        from dotmac.platform.secrets.secrets_loader import _update_settings_with_secrets

        class FailingSetting:
            """A setting that raises exception when set."""

            def __setattr__(self, name, value):
                # Raise exception for any attribute setting
                raise RuntimeError(f"Cannot set {name}")

        settings_obj = FailingSetting()
        # Provide secrets for paths that SECRETS_MAPPING looks for
        secrets = {
            "app/secret_key": "new_secret",
            "database/password": "new_password",
        }

        # Should handle exception gracefully - all attempts to set attributes will fail
        count = _update_settings_with_secrets(settings_obj, secrets)
        assert count == 0  # No settings updated due to exceptions

    @pytest.mark.asyncio
    async def test_cleanup_vault_client_async_with_close_method(self):
        """Test async cleanup of vault client with close method."""
        from dotmac.platform.secrets.secrets_loader import _cleanup_vault_client_async

        mock_client = AsyncMock()
        mock_client.close = AsyncMock()

        await _cleanup_vault_client_async(mock_client)

        mock_client.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_vault_client_async_sync_close(self):
        """Test async cleanup with synchronous close method."""
        from dotmac.platform.secrets.secrets_loader import _cleanup_vault_client_async

        mock_client = Mock()
        mock_client.close = Mock()

        await _cleanup_vault_client_async(mock_client)

        mock_client.close.assert_called_once()

    def test_cleanup_vault_client_sync_with_close_method(self):
        """Test sync cleanup of vault client with close method."""
        from dotmac.platform.secrets.secrets_loader import _cleanup_vault_client_sync

        mock_client = Mock()
        mock_client.close = Mock()

        _cleanup_vault_client_sync(mock_client)

        mock_client.close.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    @patch("dotmac.platform.secrets.secrets_loader.AsyncVaultClient")
    async def test_load_secrets_with_default_settings_obj(
        self, mock_client_class, mock_global_settings
    ):
        """Test load_secrets_from_vault with default settings object."""
        mock_global_settings.vault.enabled = True
        mock_global_settings.vault.url = "http://localhost:8200"
        mock_global_settings.vault.token = "test-token"
        mock_global_settings.vault.namespace = None
        mock_global_settings.vault.mount_path = "secret"
        mock_global_settings.vault.kv_version = 2
        mock_global_settings.environment = "development"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(return_value={})
        mock_client_class.return_value = mock_client

        # Call without settings_obj parameter (uses default)
        await load_secrets_from_vault(settings_obj=None, vault_client=mock_client)

        mock_client.health_check.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.secrets.secrets_loader.HAS_VAULT_CONFIG", True)
    @patch("dotmac.platform.secrets.secrets_loader.get_async_vault_client")
    @patch("dotmac.platform.secrets.secrets_loader.settings")
    async def test_load_secrets_uses_vault_config_client(
        self, mock_global_settings, mock_get_client
    ):
        """Test that load_secrets uses get_async_vault_client when available."""
        mock_global_settings.vault.enabled = True
        mock_global_settings.environment = "development"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(return_value={})
        mock_client.close = AsyncMock()
        mock_get_client.return_value = mock_client

        # Call without vault_client parameter
        await load_secrets_from_vault(mock_global_settings, vault_client=None)

        # Should use get_async_vault_client
        mock_get_client.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.secrets.secrets_loader.HAS_VAULT_CONFIG", False)
    @patch("dotmac.platform.secrets.secrets_loader.AsyncVaultClient")
    async def test_load_secrets_fallback_to_direct_client(self, mock_client_class):
        """Test fallback to creating AsyncVaultClient directly."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "development"

        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.health_check = AsyncMock(return_value=True)
        mock_client.get_secrets = AsyncMock(return_value={})
        mock_client.close = AsyncMock()
        mock_client_class.return_value = mock_client

        # Call without vault_client parameter
        await load_secrets_from_vault(mock_settings, vault_client=None)

        # Should create client directly
        mock_client_class.assert_called_once()

    @pytest.mark.asyncio
    @patch("dotmac.platform.secrets.secrets_loader.validate_production_secrets")
    @patch("dotmac.platform.secrets.secrets_loader.AsyncVaultClient")
    @patch("dotmac.platform.secrets.secrets_loader.HAS_VAULT_CONFIG", False)
    async def test_load_secrets_validates_production_secrets(
        self, mock_client_class, mock_validate
    ):
        """Test that production secrets are validated."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "production"  # Production mode

        # Create mock client with all required async methods
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.health_check = AsyncMock(return_value=True)  # MUST return True!
        mock_client.get_secrets = AsyncMock(return_value={})
        mock_client.close = AsyncMock()

        # Mock the class constructor to return our mock client
        mock_client_class.return_value = mock_client

        await load_secrets_from_vault(mock_settings, vault_client=None)

        # ASSERTION: Health check should be called
        mock_client.health_check.assert_called_once()

        # ASSERTION: Should call validate_production_secrets
        mock_validate.assert_called_once_with(mock_settings)

    @patch("dotmac.platform.secrets.secrets_loader.settings")
    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    def test_load_secrets_sync_with_default_settings_obj(
        self, mock_client_class, mock_global_settings
    ):
        """Test sync load_secrets with default settings object."""
        mock_global_settings.vault.enabled = True
        mock_global_settings.vault.url = "http://localhost:8200"
        mock_global_settings.vault.token = "test-token"
        mock_global_settings.vault.namespace = None
        mock_global_settings.vault.mount_path = "secret"
        mock_global_settings.vault.kv_version = 2
        mock_global_settings.environment = "development"

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(return_value={})
        mock_client.close = Mock()
        mock_client_class.return_value = mock_client

        # Call without settings_obj parameter (uses default)
        load_secrets_from_vault_sync(settings_obj=None, vault_client=mock_client)

        mock_client.health_check.assert_called_once()

    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    def test_load_secrets_sync_creates_vault_client(self, mock_client_class):
        """Test sync version creates VaultClient when not provided."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "development"

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(return_value={})
        mock_client.close = Mock()
        mock_client_class.return_value = mock_client

        # Call without vault_client parameter
        load_secrets_from_vault_sync(mock_settings, vault_client=None)

        # Should create VaultClient
        mock_client_class.assert_called_once_with(
            url="http://localhost:8200",
            token="test-token",
            namespace=None,
            mount_path="secret",
            kv_version=2,
        )

    @patch("dotmac.platform.secrets.secrets_loader.validate_production_secrets")
    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    def test_load_secrets_sync_validates_production(self, mock_client_class, mock_validate):
        """Test sync version validates production secrets."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "production"  # Production mode

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(return_value={})
        mock_client.close = Mock()
        mock_client_class.return_value = mock_client

        load_secrets_from_vault_sync(mock_settings, vault_client=None)

        # Should call validate_production_secrets
        mock_validate.assert_called_once_with(mock_settings)

    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    def test_load_secrets_sync_raises_in_production_on_vault_error(self, mock_client_class):
        """Test sync version raises exception in production on VaultError."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "production"

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(side_effect=VaultError("Connection failed"))
        mock_client.close = Mock()
        mock_client_class.return_value = mock_client

        # Should raise VaultError in production
        with pytest.raises(VaultError):
            load_secrets_from_vault_sync(mock_settings, vault_client=None)

    @patch("dotmac.platform.secrets.secrets_loader.VaultClient")
    def test_load_secrets_sync_swallows_error_in_development(self, mock_client_class):
        """Test sync version logs but doesn't raise in development."""
        mock_settings = Mock()
        mock_settings.vault.enabled = True
        mock_settings.vault.url = "http://localhost:8200"
        mock_settings.vault.token = "test-token"
        mock_settings.vault.namespace = None
        mock_settings.vault.mount_path = "secret"
        mock_settings.vault.kv_version = 2
        mock_settings.environment = "development"

        mock_client = Mock()
        mock_client.health_check = Mock(return_value=True)
        mock_client.get_secrets = Mock(side_effect=VaultError("Connection failed"))
        mock_client.close = Mock()
        mock_client_class.return_value = mock_client

        # Should not raise in development - just logs error
        load_secrets_from_vault_sync(mock_settings, vault_client=None)  # No exception
