"""
Notifications Module.

User notification system with multi-channel delivery support.
"""

# Import event listeners to register them with the event bus
from dotmac.platform.notifications import event_listeners  # noqa: F401
from dotmac.platform.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationPriority,
    NotificationTemplate,
    NotificationType,
)
from dotmac.platform.notifications.service import NotificationService

__all__ = [
    # Models
    "Notification",
    "NotificationPreference",
    "NotificationTemplate",
    "NotificationType",
    "NotificationPriority",
    "NotificationChannel",
    # Services
    "NotificationService",
]
