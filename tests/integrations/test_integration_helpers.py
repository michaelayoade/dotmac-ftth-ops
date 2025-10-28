"""Tests for global helper functions."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.unit
class TestGlobalHelpers:
    """Test global helper functions."""

    @pytest.mark.asyncio
    async def test_get_integration_registry(self):
        """Test get_integration_registry creates and configures registry."""
        from dotmac.platform import integrations

        # Reset global registry
        integrations._registry = None

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = False

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            registry = await integrations.get_integration_registry()

            assert registry is not None
            assert isinstance(registry, integrations.IntegrationRegistry)
            # Should be cached
            registry2 = await integrations.get_integration_registry()
            assert registry is registry2

        # Reset for other tests
        integrations._registry = None

    def test_get_integration_sync_no_registry(self):
        """Test get_integration returns None when no registry."""
        from dotmac.platform import integrations

        integrations._registry = None

        result = integrations.get_integration("test")
        assert result is None

    def test_get_integration_sync_with_registry(self):
        """Test get_integration returns integration from registry."""
        from dotmac.platform import integrations

        mock_registry = MagicMock()
        mock_integration = MagicMock()
        mock_registry.get_integration = MagicMock(return_value=mock_integration)

        integrations._registry = mock_registry

        result = integrations.get_integration("test")
        assert result == mock_integration

        # Reset
        integrations._registry = None

    @pytest.mark.asyncio
    async def test_get_integration_async(self):
        """Test get_integration_async."""
        from dotmac.platform import integrations

        integrations._registry = None

        mock_integration = MagicMock()
        mock_registry = MagicMock()
        mock_registry.get_integration = MagicMock(return_value=mock_integration)

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = False

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            with patch(
                "dotmac.platform.integrations.get_integration_registry",
                return_value=mock_registry,
            ):
                result = await integrations.get_integration_async("test")
                assert result == mock_integration

        # Reset
        integrations._registry = None

    @pytest.mark.asyncio
    async def test_integration_context_manager(self):
        """Test integration_context context manager."""
        from dotmac.platform import integrations

        integrations._registry = None

        mock_registry = MagicMock()
        mock_registry.cleanup_all = AsyncMock()

        mock_settings = MagicMock()
        mock_settings.features.email_enabled = False

        with patch("dotmac.platform.integrations.get_settings", return_value=mock_settings):
            with patch(
                "dotmac.platform.integrations.get_integration_registry",
                return_value=mock_registry,
            ):
                async with integrations.integration_context() as registry:
                    assert registry == mock_registry

                # Should have called cleanup
                mock_registry.cleanup_all.assert_called_once()

        # Reset
        integrations._registry = None
