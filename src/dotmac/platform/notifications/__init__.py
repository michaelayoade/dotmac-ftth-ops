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
from dotmac.platform.notifications.plugins import (
    list_plugins as list_notification_plugins,
)
from dotmac.platform.notifications.plugins import (
    register_plugin as register_notification_plugin,
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
    # Plugin helpers
    "register_notification_plugin",
    "list_notification_plugins",
]
