"""
Notification Channel Provider Factory.

Creates and manages notification channel provider instances based on configuration.
"""

import structlog

from ..models import NotificationChannel
from ..plugins import get_plugin, register_builtin_plugins
from .base import NotificationChannelProvider

logger = structlog.get_logger(__name__)


class ChannelProviderFactory:
    """
    Factory for creating notification channel providers.

    Provides singleton instances of channel providers based on configuration.
    """

    # Ensure builtin plugins registered once
    register_builtin_plugins()

    # Singleton instances
    _instances: dict[NotificationChannel, NotificationChannelProvider] = {}

    @classmethod
    def get_provider(cls, channel: NotificationChannel) -> NotificationChannelProvider | None:
        """
        Get provider instance for a channel.

        Args:
            channel: Notification channel type

        Returns:
            Provider instance, or None if channel not supported/configured
        """
        # IN_APP is handled by NotificationService, not a channel provider
        if channel == NotificationChannel.IN_APP:
            return None

        # Return cached instance if available
        if channel in cls._instances:
            return cls._instances[channel]

        plugin = get_plugin(channel)
        if not plugin:
            logger.warning("No notification plugin registered", channel=channel.value)
            return None

        config = plugin.build_config()

        # Check if channel is enabled
        if not config.get("enabled", False):
            logger.debug(f"Channel {channel.value} is disabled")
            return None

        # Create provider instance
        try:
            provider = plugin.create_provider(config)
            cls._instances[channel] = provider

            logger.info(
                "channel_provider.initialized",
                channel=channel.value,
                provider_class=provider.__class__.__name__,
            )

            return provider

        except Exception as e:
            logger.error(
                "channel_provider.init_failed",
                channel=channel.value,
                error=str(e),
                exc_info=True,
            )
            return None

    @classmethod
    async def validate_all_providers(cls) -> dict[str, bool]:
        """
        Validate all configured providers.

        Returns:
            Dictionary mapping channel names to validation status
        """
        results = {}

        for channel in NotificationChannel:
            if channel == NotificationChannel.IN_APP:
                results[channel.value] = True  # Always available
                continue

            provider = cls.get_provider(channel)
            if provider:
                try:
                    is_valid = await provider.validate_config()
                    results[channel.value] = is_valid
                except Exception as e:
                    logger.error(
                        "channel_provider.validation_failed",
                        channel=channel.value,
                        error=str(e),
                    )
                    results[channel.value] = False
            else:
                results[channel.value] = False

        return results

    @classmethod
    def get_available_channels(cls) -> list[NotificationChannel]:
        """
        Get list of available (configured and enabled) channels.

        Returns:
            List of available notification channels
        """
        available = [NotificationChannel.IN_APP]  # Always available

        for channel in NotificationChannel:
            if channel == NotificationChannel.IN_APP:
                continue

            provider = cls.get_provider(channel)
            if provider:
                available.append(channel)

        return available

    @classmethod
    def clear_cache(cls) -> None:
        """
        Clear cached provider instances.

        Useful for testing or when configuration changes.
        """
        cls._instances.clear()
        logger.info("channel_provider.cache_cleared")
