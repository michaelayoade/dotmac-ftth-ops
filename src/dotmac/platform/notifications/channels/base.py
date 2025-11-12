"""
Base Notification Channel Provider.

Abstract base class for all notification channel implementations.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog

from ..models import NotificationPriority, NotificationType

logger = structlog.get_logger(__name__)


@dataclass
class NotificationContext:
    """
    Context for notification delivery.

    Contains all information needed by channel providers to deliver notifications.
    """

    # Core notification data
    notification_id: UUID
    tenant_id: str
    user_id: UUID
    notification_type: NotificationType
    priority: NotificationPriority

    # Content
    title: str
    message: str
    action_url: str | None = None
    action_label: str | None = None

    # Recipient information (provided by NotificationService)
    recipient_email: str | None = None
    recipient_phone: str | None = None
    recipient_push_tokens: list[str] | None = None
    recipient_name: str | None = None

    # Branding metadata for channel renderers
    branding: dict[str, Any] | None = None
    product_name: str | None = None
    support_email: str | None = None

    # Metadata
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None

    # Related entities (for context)
    related_entity_type: str | None = None
    related_entity_id: str | None = None


class NotificationChannelProvider(ABC):
    """
    Abstract base class for notification channel providers.

    All notification channels (Email, SMS, Push, Slack, etc.) must implement this interface.
    """

    def __init__(self, config: dict[str, Any] | None = None):
        """
        Initialize channel provider.

        Args:
            config: Provider-specific configuration
        """
        self.config = config or {}
        self.logger = structlog.get_logger(self.__class__.__name__)

    @property
    @abstractmethod
    def channel_name(self) -> str:
        """Return the name of this channel (e.g., 'email', 'sms', 'push')."""
        pass

    @abstractmethod
    async def send(self, context: NotificationContext) -> bool:
        """
        Send notification via this channel.

        Args:
            context: Notification context with all delivery information

        Returns:
            True if sent successfully, False otherwise

        Raises:
            Exception: If send operation fails critically
        """
        pass

    async def validate_config(self) -> bool:
        """
        Validate provider configuration.

        Returns:
            True if configuration is valid, False otherwise
        """
        return True

    async def is_available(self) -> bool:
        """
        Check if this channel is currently available.

        Returns:
            True if channel can send notifications, False otherwise
        """
        return True

    def supports_priority(self, priority: NotificationPriority) -> bool:
        """
        Check if this channel supports the given priority level.

        Some channels may only be used for high-priority notifications.

        Args:
            priority: Notification priority level

        Returns:
            True if this channel should be used for this priority
        """
        return True  # By default, support all priorities

    def get_retry_config(self) -> dict[str, Any]:
        """
        Get retry configuration for this channel.

        Returns:
            Retry configuration dict with keys: max_retries, retry_delay, backoff_multiplier
        """
        return {
            "max_retries": self.config.get("max_retries", 3),
            "retry_delay": self.config.get("retry_delay", 60),  # seconds
            "backoff_multiplier": self.config.get("backoff_multiplier", 2),
        }

    async def on_send_success(self, context: NotificationContext) -> None:
        """
        Callback invoked after successful send.

        Can be overridden for custom success handling (logging, metrics, etc.).

        Args:
            context: Notification context
        """
        self.logger.info(
            f"{self.channel_name}.send.success",
            notification_id=str(context.notification_id),
            tenant_id=context.tenant_id,
        )

    async def on_send_failure(self, context: NotificationContext, error: Exception) -> None:
        """
        Callback invoked after failed send.

        Can be overridden for custom error handling (alerting, fallback, etc.).

        Args:
            context: Notification context
            error: Exception that occurred
        """
        self.logger.error(
            f"{self.channel_name}.send.failure",
            notification_id=str(context.notification_id),
            tenant_id=context.tenant_id,
            error=str(error),
            exc_info=True,
        )
