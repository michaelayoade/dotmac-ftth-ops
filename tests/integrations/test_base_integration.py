"""Tests for BaseIntegration base class."""

import json
from unittest.mock import patch

import pytest

from dotmac.platform.integrations import (
    BaseIntegration,
    IntegrationConfig,
    IntegrationHealth,
    IntegrationStatus,
    IntegrationType,
)


@pytest.mark.unit
class TestBaseIntegration:
    """Test BaseIntegration base class."""

    def test_base_integration_is_abstract(self):
        """Test BaseIntegration cannot be instantiated directly."""
        config = IntegrationConfig(
            name="test", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
        )

        # BaseIntegration is abstract, so we need to create a concrete implementation
        with pytest.raises(TypeError):
            BaseIntegration(config)

    def test_concrete_integration_can_be_created(self, basic_config):
        """Test concrete integration implementation."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.config.name, status=IntegrationStatus.READY)

            async def shutdown(self):
                pass

        integration = TestIntegration(basic_config)
        assert integration.config.name == "test"

    @pytest.mark.asyncio
    async def test_integration_lifecycle(self, basic_config):
        """Test integration initialization and shutdown."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            def __init__(self, config):
                super().__init__(config)
                self.initialized = False
                self.shutdown_called = False

            async def initialize(self):
                self.initialized = True

            async def health_check(self):
                return IntegrationHealth(
                    name=self.config.name,
                    status=(
                        IntegrationStatus.READY
                        if self.initialized
                        else IntegrationStatus.CONFIGURING
                    ),
                )

            async def shutdown(self):
                self.shutdown_called = True

        integration = TestIntegration(basic_config)
        assert not integration.initialized

        await integration.initialize()
        assert integration.initialized

        health = await integration.health_check()
        assert health.status == IntegrationStatus.READY

        await integration.shutdown()
        assert integration.shutdown_called

    @pytest.mark.asyncio
    async def test_integration_error_handling(self):
        """Test integration error handling."""
        config = IntegrationConfig(
            name="failing", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
        )

        class FailingIntegration(BaseIntegration):
            async def initialize(self):
                raise ValueError("Initialization failed")

            async def health_check(self):
                return IntegrationHealth(
                    name=self.config.name,
                    status=IntegrationStatus.ERROR,
                    message="Health check failed",
                )

            async def shutdown(self):
                pass

        integration = FailingIntegration(config)

        with pytest.raises(ValueError, match="Initialization failed"):
            await integration.initialize()

        health = await integration.health_check()
        assert health.status == IntegrationStatus.ERROR

    def test_base_integration_status_property(self, basic_config):
        """Test status property."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                self._status = IntegrationStatus.READY

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=self.status)

        integration = TestIntegration(basic_config)
        assert integration.status == IntegrationStatus.CONFIGURING

    @pytest.mark.asyncio
    async def test_base_integration_load_secrets_no_path(self, basic_config):
        """Test load_secrets when no secrets_path is configured."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(basic_config)
        # Should not raise error when no secrets_path
        await integration.load_secrets()
        assert len(integration._secrets) == 0

    @pytest.mark.asyncio
    async def test_base_integration_load_secrets_with_path(self, mock_vault_secret):
        """Test load_secrets loads secrets from Vault."""
        config = IntegrationConfig(
            name="test",
            type=IntegrationType.EMAIL,
            provider="test",
            enabled=True,
            settings={},
            secrets_path="test/path",
        )

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:
            mock_get_secret.side_effect = mock_vault_secret

            await integration.load_secrets()

            assert integration.get_secret("api_key") == "test-api-key"
            assert integration.get_secret("token") == "test-token-value"

    @pytest.mark.asyncio
    async def test_base_integration_load_secrets_dict_without_value(self):
        """Test load_secrets handles dict secrets without 'value' key."""
        config = IntegrationConfig(
            name="test",
            type=IntegrationType.EMAIL,
            provider="test",
            enabled=True,
            settings={},
            secrets_path="test/path",
        )

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:
            # Return dict without 'value' key - should be converted to JSON
            async def get_secret_mock(path):
                if "api_key" in path:
                    return {"key": "test-key", "secret": "test-secret"}
                from dotmac.platform.secrets import VaultError

                raise VaultError("Not found")

            mock_get_secret.side_effect = get_secret_mock

            await integration.load_secrets()

            # Should be stored as JSON string
            secret_data = json.loads(integration.get_secret("api_key"))
            assert secret_data["key"] == "test-key"

    @pytest.mark.asyncio
    async def test_base_integration_load_secrets_error(self):
        """Test load_secrets handles errors gracefully."""
        config = IntegrationConfig(
            name="test",
            type=IntegrationType.EMAIL,
            provider="test",
            enabled=True,
            settings={},
            secrets_path="test/path",
        )

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(config)

        with patch("dotmac.platform.integrations.get_vault_secret_async") as mock_get_secret:
            mock_get_secret.side_effect = Exception("Vault connection failed")

            with pytest.raises(Exception, match="Vault connection failed"):
                await integration.load_secrets()

    def test_base_integration_get_secret(self, basic_config):
        """Test get_secret method."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(basic_config)
        integration._secrets = {"api_key": "test-key"}

        assert integration.get_secret("api_key") == "test-key"
        assert integration.get_secret("missing") is None
        assert integration.get_secret("missing", "default") == "default"

    @pytest.mark.asyncio
    async def test_base_integration_cleanup(self, basic_config):
        """Test cleanup method."""

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(basic_config)
        # Default cleanup should not raise
        await integration.cleanup()

    def test_base_integration_str(self):
        """Test string representation."""
        config = IntegrationConfig(
            name="test-email",
            type=IntegrationType.EMAIL,
            provider="sendgrid",
            enabled=True,
            settings={},
        )

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(config)
        str_repr = str(integration)
        assert "TestIntegration" in str_repr
        assert "test-email" in str_repr
        assert "sendgrid" in str_repr
