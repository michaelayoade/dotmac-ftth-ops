"""
Notification Channel Provider Factory.

Creates and manages notification channel provider instances based on configuration.
"""

from typing import Any

import structlog

from ...settings import settings
from ..models import NotificationChannel
from .base import NotificationChannelProvider
from .email import EmailChannelProvider
from .push import PushChannelProvider
from .sms import SMSChannelProvider
from .webhook import WebhookChannelProvider

logger = structlog.get_logger(__name__)


class ChannelProviderFactory:
    """
    Factory for creating notification channel providers.

    Provides singleton instances of channel providers based on configuration.
    """

    # Singleton instances
    _instances: dict[NotificationChannel, NotificationChannelProvider] = {}

    # Provider class mapping
    _provider_classes: dict[NotificationChannel, type[NotificationChannelProvider]] = {
        NotificationChannel.EMAIL: EmailChannelProvider,
        NotificationChannel.SMS: SMSChannelProvider,
        NotificationChannel.PUSH: PushChannelProvider,
        NotificationChannel.WEBHOOK: WebhookChannelProvider,
        # IN_APP is handled directly by NotificationService (database)
    }

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

        # Create new instance
        provider_class = cls._provider_classes.get(channel)
        if not provider_class:
            logger.warning(f"No provider class for channel: {channel.value}")
            return None

        # Get configuration for this channel
        config = cls._get_channel_config(channel)

        # Check if channel is enabled
        if not config.get("enabled", False):
            logger.debug(f"Channel {channel.value} is disabled")
            return None

        # Create provider instance
        try:
            provider = provider_class(config=config)
            cls._instances[channel] = provider

            logger.info(
                "channel_provider.initialized",
                channel=channel.value,
                provider_class=provider_class.__name__,
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
    def _get_channel_config(cls, channel: NotificationChannel) -> dict[str, Any]:
        """
        Get configuration for a specific channel.

        Args:
            channel: Notification channel

        Returns:
            Configuration dictionary
        """
        if channel == NotificationChannel.EMAIL:
            return {
                "enabled": settings.notifications.email_enabled,
                # Email uses communications service config
            }

        elif channel == NotificationChannel.SMS:
            return {
                "enabled": settings.notifications.sms_enabled,
                "provider": settings.notifications.sms_provider,
                # Twilio config
                "twilio_account_sid": settings.notifications.twilio_account_sid,
                "twilio_auth_token": settings.notifications.twilio_auth_token,
                "twilio_from_number": settings.notifications.twilio_from_number,
                # AWS SNS config
                "aws_region": settings.notifications.aws_region,
                # HTTP API config
                "http_api_url": settings.notifications.sms_http_api_url,
                "http_api_key": settings.notifications.sms_http_api_key,
                # SMS-specific settings
                "max_length": settings.notifications.sms_max_length,
                "min_priority": settings.notifications.sms_min_priority,
                "max_retries": settings.notifications.sms_max_retries,
            }

        elif channel == NotificationChannel.PUSH:
            return {
                "enabled": settings.notifications.push_enabled,
                "provider": settings.notifications.push_provider,
                # Firebase config
                "fcm_credentials_path": settings.notifications.fcm_credentials_path,
                # OneSignal config
                "onesignal_app_id": settings.notifications.onesignal_app_id,
                "onesignal_api_key": settings.notifications.onesignal_api_key,
                # AWS SNS config
                "aws_region": settings.notifications.aws_region,
                # HTTP API config
                "http_api_url": settings.notifications.push_http_api_url,
                "http_api_key": settings.notifications.push_http_api_key,
                # Push-specific settings
                "min_priority": settings.notifications.push_min_priority,
                "max_retries": settings.notifications.push_max_retries,
            }

        elif channel == NotificationChannel.WEBHOOK:
            return {
                "enabled": settings.notifications.webhook_enabled,
                "urls": settings.notifications.webhook_urls,
                "format": settings.notifications.webhook_format,
                "secret": settings.notifications.webhook_secret,
                "headers": settings.notifications.webhook_headers,
                "timeout": settings.notifications.webhook_timeout,
                "max_retries": settings.notifications.webhook_max_retries,
            }

        return {"enabled": False}

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
