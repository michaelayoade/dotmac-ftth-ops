"""Builtin notification channel plugins."""

from __future__ import annotations

from typing import Any

from dotmac.platform.settings import settings

from ..channels.base import NotificationChannelProvider
from ..channels.email import EmailChannelProvider
from ..channels.push import PushChannelProvider
from ..channels.sms import SMSChannelProvider
from ..channels.webhook import WebhookChannelProvider
from ..models import NotificationChannel
from . import NotificationChannelPlugin, register_plugin


class _BasePlugin(NotificationChannelPlugin):
    provider_class: type[NotificationChannelProvider]

    def create_provider(self, config: dict[str, Any]) -> NotificationChannelProvider:
        return self.provider_class(config=config)


class EmailPlugin(_BasePlugin):
    plugin_id = "notifications.email"
    channel = NotificationChannel.EMAIL
    provider_class = EmailChannelProvider

    def build_config(self) -> dict[str, Any]:
        return {
            "enabled": settings.notifications.email_enabled,
        }


class SMSPlugin(_BasePlugin):
    plugin_id = "notifications.sms"
    channel = NotificationChannel.SMS
    provider_class = SMSChannelProvider

    def build_config(self) -> dict[str, Any]:
        return {
            "enabled": settings.notifications.sms_enabled,
            "provider": settings.notifications.sms_provider,
            "twilio_account_sid": settings.notifications.twilio_account_sid,
            "twilio_auth_token": settings.notifications.twilio_auth_token,
            "twilio_from_number": settings.notifications.twilio_from_number,
            "aws_region": settings.notifications.aws_region,
            "http_api_url": settings.notifications.sms_http_api_url,
            "http_api_key": settings.notifications.sms_http_api_key,
            "max_length": settings.notifications.sms_max_length,
            "min_priority": settings.notifications.sms_min_priority,
            "max_retries": settings.notifications.sms_max_retries,
        }


class PushPlugin(_BasePlugin):
    plugin_id = "notifications.push"
    channel = NotificationChannel.PUSH
    provider_class = PushChannelProvider

    def build_config(self) -> dict[str, Any]:
        return {
            "enabled": settings.notifications.push_enabled,
            "provider": settings.notifications.push_provider,
            "fcm_credentials_path": settings.notifications.fcm_credentials_path,
            "onesignal_app_id": settings.notifications.onesignal_app_id,
            "onesignal_api_key": settings.notifications.onesignal_api_key,
            "aws_region": settings.notifications.aws_region,
            "http_api_url": settings.notifications.push_http_api_url,
            "http_api_key": settings.notifications.push_http_api_key,
            "min_priority": settings.notifications.push_min_priority,
            "max_retries": settings.notifications.push_max_retries,
        }


class WebhookPlugin(_BasePlugin):
    plugin_id = "notifications.webhook"
    channel = NotificationChannel.WEBHOOK
    provider_class = WebhookChannelProvider

    def build_config(self) -> dict[str, Any]:
        return {
            "enabled": settings.notifications.webhook_enabled,
            "urls": settings.notifications.webhook_urls,
            "format": settings.notifications.webhook_format,
            "secret": settings.notifications.webhook_secret,
            "headers": settings.notifications.webhook_headers,
            "timeout": settings.notifications.webhook_timeout,
            "max_retries": settings.notifications.webhook_max_retries,
        }


register_plugin(EmailPlugin())
register_plugin(SMSPlugin())
register_plugin(PushPlugin())
register_plugin(WebhookPlugin())


__all__ = ["EmailPlugin", "SMSPlugin", "PushPlugin", "WebhookPlugin"]
