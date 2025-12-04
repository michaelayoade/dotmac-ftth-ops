"""Tests for IntegrationRegistry."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.integrations import (
    BaseIntegration,
    IntegrationConfig,
    IntegrationHealth,
    IntegrationRegistry,
    IntegrationStatus,
    IntegrationType,
)


@pytest.mark.unit
class TestIntegrationRegistry:
    """Test IntegrationRegistry."""

    def test_registry_initialization(self):
        """Test registry initialization."""
        registry = IntegrationRegistry()

        assert isinstance(registry._integrations, dict)
        assert isinstance(registry._configs, dict)
        assert isinstance(registry._providers, dict)
        # Should have default providers
        assert "email:sendgrid" in registry._providers
        assert "sms:twilio" in registry._providers

    def test_register_provider(self):
        """Test registering a custom provider."""
        registry = IntegrationRegistry()

        class CustomIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        registry.register_provider("storage", "s3", CustomIntegration)

        assert "storage:s3" in registry._providers
        assert registry._providers["storage:s3"] == CustomIntegration

    @pytest.mark.asyncio
    async def test_register_integration_disabled(self):
        """Test registering disabled integration is skipped."""
        registry = IntegrationRegistry()

        config = IntegrationConfig(
            name="test", type=IntegrationType.EMAIL, provider="sendgrid", enabled=False, settings={}
        )

        await registry.register_integration(config)

        assert "test" not in registry._integrations

    @pytest.mark.asyncio
    async def test_register_integration_unknown_provider(self):
        """Test registering integration with unknown provider."""
        registry = IntegrationRegistry()

        config = IntegrationConfig(
            name="test",
            type=IntegrationType.STORAGE,
            provider="unknown",
            enabled=True,
            settings={},
        )

        # Should log warning but not raise
        await registry.register_integration(config)

        assert "test" not in registry._integrations
        assert "test" in registry._configs
        assert (
            registry.get_integration_error("test")
            == "Provider 'unknown' not registered. See server logs for details."
        )

    @pytest.mark.asyncio
    async def test_register_integration_success(self):
        """Test successful integration registration."""
        registry = IntegrationRegistry()

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                self._status = IntegrationStatus.READY

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        registry.register_provider("test", "provider", TestIntegration)

        config = IntegrationConfig(
            name="test-integration",
            type="test",
            provider="provider",
            enabled=True,
            settings={},
        )

        await registry.register_integration(config)

        assert "test-integration" in registry._integrations
        assert isinstance(registry._integrations["test-integration"], TestIntegration)

    @pytest.mark.asyncio
    async def test_register_integration_initialization_failure(self):
        """Test integration registration handles initialization errors."""
        registry = IntegrationRegistry()

        class FailingIntegration(BaseIntegration):
            async def initialize(self):
                raise Exception("Initialization failed")

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.ERROR)

        registry.register_provider("test", "failing", FailingIntegration)

        config = IntegrationConfig(
            name="failing-integration", type="test", provider="failing", enabled=True, settings={}
        )

        # Should log error but not raise
        await registry.register_integration(config)

        # Integration should not be registered
        assert "failing-integration" not in registry._integrations
        assert "failing-integration" in registry._configs
        error_message = registry.get_integration_error("failing-integration")
        assert error_message == "Exception during initialization. See server logs for details."

    def test_get_integration(self):
        """Test getting integration by name."""
        registry = IntegrationRegistry()

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration = TestIntegration(
            IntegrationConfig(
                name="test", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
            )
        )

        registry._integrations["test"] = integration

        assert registry.get_integration("test") == integration
        assert registry.get_integration("nonexistent") is None

    @pytest.mark.asyncio
    async def test_health_check_all(self):
        """Test health check for all integrations."""
        registry = IntegrationRegistry()

        @pytest.mark.unit
        class TestIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

        integration1 = TestIntegration(
            IntegrationConfig(
                name="test1", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
            )
        )
        integration2 = TestIntegration(
            IntegrationConfig(
                name="test2", type=IntegrationType.SMS, provider="test", enabled=True, settings={}
            )
        )

        registry._integrations["test1"] = integration1
        registry._integrations["test2"] = integration2

        results = await registry.health_check_all()

        assert "test1" in results
        assert "test2" in results
        assert results["test1"].status == IntegrationStatus.READY
        assert results["test2"].status == IntegrationStatus.READY

    @pytest.mark.asyncio
    async def test_health_check_all_with_errors(self):
        """Test health check handles integration errors."""
        registry = IntegrationRegistry()

        class FailingIntegration(BaseIntegration):
            async def initialize(self):
                pass

            async def health_check(self):
                raise Exception("Health check failed")

        integration = FailingIntegration(
            IntegrationConfig(
                name="failing",
                type=IntegrationType.EMAIL,
                provider="test",
                enabled=True,
                settings={},
            )
        )

        registry._integrations["failing"] = integration

        results = await registry.health_check_all()

        assert "failing" in results
        assert results["failing"].status == IntegrationStatus.ERROR
        assert "Health check failed" in results["failing"].message

    @pytest.mark.asyncio
    async def test_cleanup_all(self):
        """Test cleanup all integrations."""
        registry = IntegrationRegistry()

        class TestIntegration(BaseIntegration):
            def __init__(self, config):
                super().__init__(config)
                self.cleaned_up = False

            async def initialize(self):
                pass

            async def health_check(self):
                return IntegrationHealth(name=self.name, status=IntegrationStatus.READY)

            async def cleanup(self):
                self.cleaned_up = True

        integration = TestIntegration(
            IntegrationConfig(
                name="test", type=IntegrationType.EMAIL, provider="test", enabled=True, settings={}
            )
        )

        registry._integrations["test"] = integration

        await registry.cleanup_all()

        assert integration.cleaned_up

    @pytest.mark.asyncio
    async def test_cleanup_all_empty_registry(self):
        """Test cleanup when no integrations registered."""
        registry = IntegrationRegistry()

        # Should not raise
        await registry.cleanup_all()

    @pytest.mark.asyncio
    async def test_configure_from_settings_email_enabled(self):
        """Test configuring from settings with email enabled."""
        registry = IntegrationRegistry()

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = True
        mock_settings.features.sms_enabled = False
        mock_settings.features.communications_enabled = False
        mock_settings.email.provider = "sendgrid"
        mock_settings.email.from_address = "test@example.com"
        mock_settings.email.from_name = "Test Sender"

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            with patch.object(
                registry, "register_integration", new_callable=AsyncMock
            ) as mock_register:
                await registry.configure_from_settings()

                # Should have called register_integration for email
                assert mock_register.called
                # Check all calls to find email configuration
                email_calls = [
                    call
                    for call in mock_register.call_args_list
                    if call[0][0].type == IntegrationType.EMAIL
                ]
                assert len(email_calls) > 0
                email_config = email_calls[0][0][0]
                assert email_config.name == "email"
                assert email_config.type == IntegrationType.EMAIL

    @pytest.mark.asyncio
    async def test_configure_from_settings_sms_enabled(self):
        """Test configuring from settings with SMS enabled."""
        registry = IntegrationRegistry()

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = False
        mock_settings.features.sms_enabled = True
        mock_settings.sms_from_number = "+1234567890"

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            with patch.object(
                registry, "register_integration", new_callable=AsyncMock
            ) as mock_register:
                await registry.configure_from_settings()

                # Should have called register_integration for SMS
                configs = [call[0][0] for call in mock_register.call_args_list]
                sms_configs = [c for c in configs if c.type == IntegrationType.SMS]
                assert len(sms_configs) > 0

    @pytest.mark.asyncio
    async def test_configure_from_settings_communications_enabled(self):
        """Test configuring from settings with communications enabled."""
        registry = IntegrationRegistry()

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = False
        mock_settings.features.sms_enabled = False
        mock_settings.features.communications_enabled = True

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            with patch.object(
                registry, "register_integration", new_callable=AsyncMock
            ) as mock_register:
                await registry.configure_from_settings()

                # Should have called register_integration for SMS (via communications)
                if mock_register.called:
                    configs = [call[0][0] for call in mock_register.call_args_list]
                    sms_configs = [c for c in configs if c.type == IntegrationType.SMS]
                    assert len(sms_configs) > 0
