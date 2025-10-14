"""
Notification Service.

Handles user notification creation, delivery, and preference management.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.communications.email_service import EmailMessage, get_email_service
from dotmac.platform.communications.models import CommunicationType
from dotmac.platform.communications.task_service import queue_email
from dotmac.platform.communications.template_service import TemplateService
from dotmac.platform.core.exceptions import NotFoundError, ValidationError
from dotmac.platform.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationPriority,
    NotificationTemplate,
    NotificationType,
)

logger = structlog.get_logger(__name__)


class NotificationService:
    """Service for creating and managing user notifications."""

    def __init__(self, db: AsyncSession, template_service: TemplateService | None = None) -> None:
        self.db = db
        self.template_service = template_service or TemplateService()

    async def create_notification(
        self,
        tenant_id: str,
        user_id: UUID,
        notification_type: NotificationType,
        title: str,
        message: str,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        action_url: str | None = None,
        action_label: str | None = None,
        related_entity_type: str | None = None,
        related_entity_id: str | None = None,
        channels: list[NotificationChannel] | None = None,
        metadata: dict[str, Any] | None = None,
        auto_send: bool = True,
    ) -> Notification:
        """
        Create a new notification for a user.

        Args:
            tenant_id: Tenant identifier
            user_id: User to notify
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            priority: Priority level
            action_url: Optional action URL
            action_label: Optional action button label
            related_entity_type: Type of related entity
            related_entity_id: ID of related entity
            channels: Delivery channels to use
            metadata: Additional metadata
            auto_send: Automatically send via configured channels

        Returns:
            Created notification
        """
        logger.info(
            "Creating notification",
            tenant_id=tenant_id,
            user_id=str(user_id),
            type=notification_type.value,
        )

        # Get user preferences
        preferences = await self.get_user_preferences(tenant_id, user_id)

        # Determine channels to use
        if channels is None:
            channels = await self._determine_channels(preferences, notification_type, priority)

        # Create notification
        notification = Notification(
            tenant_id=tenant_id,
            user_id=user_id,
            type=notification_type,
            priority=priority,
            title=title,
            message=message,
            action_url=action_url,
            action_label=action_label,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            channels=[c.value for c in channels],
            notification_metadata=metadata or {},
        )

        self.db.add(notification)
        await self.db.flush()
        await self.db.refresh(notification)

        # Send notification via configured channels
        if auto_send:
            await self._send_notification(notification, channels, preferences)

        logger.info(
            "Notification created",
            notification_id=str(notification.id),
            channels=[c.value for c in channels],
        )

        return notification

    async def create_from_template(
        self,
        tenant_id: str,
        user_id: UUID,
        notification_type: NotificationType,
        variables: dict[str, Any],
        auto_send: bool = True,
    ) -> Notification:
        """
        Create a notification from a template.

        Args:
            tenant_id: Tenant identifier
            user_id: User to notify
            notification_type: Type of notification
            variables: Template variables
            auto_send: Automatically send via configured channels

        Returns:
            Created notification
        """
        # Get template
        template = await self.get_template(tenant_id, notification_type)

        if not template:
            raise NotFoundError(f"Template for {notification_type.value} not found")

        # Render templates using TemplateService
        # Create temporary in-memory templates for rendering
        from jinja2 import Environment, DictLoader

        env = Environment(loader=DictLoader({
            'title': template.title_template,
            'message': template.message_template,
            'action_url': template.action_url_template or '',
        }))

        title = env.get_template('title').render(**variables)
        message = env.get_template('message').render(**variables)
        action_url = (
            env.get_template('action_url').render(**variables)
            if template.action_url_template
            else None
        )

        # Determine channels from template defaults
        channels = [NotificationChannel(c) for c in template.default_channels]

        return await self.create_notification(
            tenant_id=tenant_id,
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            priority=template.default_priority,
            action_url=action_url,
            action_label=template.action_label,
            channels=channels,
            metadata={"variables": variables},  # Parameter name stays as 'metadata'
            auto_send=auto_send,
        )

    async def get_user_notifications(
        self,
        tenant_id: str,
        user_id: UUID,
        unread_only: bool = False,
        priority: NotificationPriority | None = None,
        notification_type: NotificationType | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> list[Notification]:
        """Get notifications for a user with filters."""
        stmt = select(Notification).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.deleted_at.is_(None),
                Notification.is_archived == False,  # noqa: E712
            )
        )

        if unread_only:
            stmt = stmt.where(Notification.is_read == False)  # noqa: E712

        if priority:
            stmt = stmt.where(Notification.priority == priority)

        if notification_type:
            stmt = stmt.where(Notification.type == notification_type)

        stmt = stmt.order_by(Notification.created_at.desc())
        stmt = stmt.offset(offset).limit(limit)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_unread_count(self, tenant_id: str, user_id: UUID) -> int:
        """Get count of unread notifications for a user."""
        stmt = select(func.count(Notification.id)).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
                Notification.deleted_at.is_(None),
                Notification.is_archived == False,  # noqa: E712
            )
        )

        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def mark_as_read(
        self, tenant_id: str, user_id: UUID, notification_id: UUID
    ) -> Notification:
        """Mark a notification as read."""
        stmt = select(Notification).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.id == notification_id,
            )
        )

        result = await self.db.execute(stmt)
        notification = result.scalar_one_or_none()

        if not notification:
            raise NotFoundError(f"Notification {notification_id} not found")

        if not notification.is_read:
            notification.is_read = True
            notification.read_at = datetime.utcnow()
            await self.db.flush()

        return notification

    async def mark_all_as_read(self, tenant_id: str, user_id: UUID) -> int:
        """Mark all notifications as read for a user."""
        stmt = select(Notification).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.is_read == False,  # noqa: E712
                Notification.deleted_at.is_(None),
            )
        )

        result = await self.db.execute(stmt)
        notifications = result.scalars().all()

        count = 0
        now = datetime.utcnow()
        for notification in notifications:
            notification.is_read = True
            notification.read_at = now
            count += 1

        await self.db.flush()
        return count

    async def archive_notification(
        self, tenant_id: str, user_id: UUID, notification_id: UUID
    ) -> Notification:
        """Archive a notification."""
        stmt = select(Notification).where(
            and_(
                Notification.tenant_id == tenant_id,
                Notification.user_id == user_id,
                Notification.id == notification_id,
            )
        )

        result = await self.db.execute(stmt)
        notification = result.scalar_one_or_none()

        if not notification:
            raise NotFoundError(f"Notification {notification_id} not found")

        notification.is_archived = True
        notification.archived_at = datetime.utcnow()
        await self.db.flush()

        return notification

    async def get_user_preferences(
        self, tenant_id: str, user_id: UUID
    ) -> NotificationPreference:
        """Get or create user notification preferences."""
        stmt = select(NotificationPreference).where(
            and_(
                NotificationPreference.tenant_id == tenant_id,
                NotificationPreference.user_id == user_id,
            )
        )

        result = await self.db.execute(stmt)
        preferences = result.scalar_one_or_none()

        # Create default preferences if they don't exist
        if not preferences:
            preferences = NotificationPreference(
                tenant_id=tenant_id,
                user_id=user_id,
                enabled=True,
                email_enabled=True,
                sms_enabled=False,
                push_enabled=True,
                type_preferences={},
            )
            self.db.add(preferences)
            await self.db.flush()
            await self.db.refresh(preferences)

        return preferences

    async def update_user_preferences(
        self,
        tenant_id: str,
        user_id: UUID,
        enabled: bool | None = None,
        email_enabled: bool | None = None,
        sms_enabled: bool | None = None,
        push_enabled: bool | None = None,
        quiet_hours_enabled: bool | None = None,
        quiet_hours_start: str | None = None,
        quiet_hours_end: str | None = None,
        type_preferences: dict[str, Any] | None = None,
        minimum_priority: NotificationPriority | None = None,
    ) -> NotificationPreference:
        """Update user notification preferences."""
        preferences = await self.get_user_preferences(tenant_id, user_id)

        if enabled is not None:
            preferences.enabled = enabled
        if email_enabled is not None:
            preferences.email_enabled = email_enabled
        if sms_enabled is not None:
            preferences.sms_enabled = sms_enabled
        if push_enabled is not None:
            preferences.push_enabled = push_enabled
        if quiet_hours_enabled is not None:
            preferences.quiet_hours_enabled = quiet_hours_enabled
        if quiet_hours_start is not None:
            preferences.quiet_hours_start = quiet_hours_start
        if quiet_hours_end is not None:
            preferences.quiet_hours_end = quiet_hours_end
        if type_preferences is not None:
            preferences.type_preferences = type_preferences
        if minimum_priority is not None:
            preferences.minimum_priority = minimum_priority

        await self.db.flush()
        await self.db.refresh(preferences)

        return preferences

    async def get_template(
        self, tenant_id: str, notification_type: NotificationType
    ) -> NotificationTemplate | None:
        """Get notification template by type."""
        stmt = select(NotificationTemplate).where(
            and_(
                NotificationTemplate.tenant_id == tenant_id,
                NotificationTemplate.type == notification_type,
                NotificationTemplate.is_active == True,  # noqa: E712
            )
        )

        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _determine_channels(
        self,
        preferences: NotificationPreference,
        notification_type: NotificationType,
        priority: NotificationPriority,
    ) -> list[NotificationChannel]:
        """Determine which channels to use based on preferences."""
        channels: list[NotificationChannel] = [NotificationChannel.IN_APP]

        # Check if notifications are globally disabled
        if not preferences.enabled:
            return [NotificationChannel.IN_APP]  # Always show in-app

        # Check priority threshold
        priority_order = {
            NotificationPriority.LOW: 0,
            NotificationPriority.MEDIUM: 1,
            NotificationPriority.HIGH: 2,
            NotificationPriority.URGENT: 3,
        }

        if priority_order[priority] < priority_order[preferences.minimum_priority]:
            return [NotificationChannel.IN_APP]

        # Check per-type preferences
        type_prefs = preferences.type_preferences.get(notification_type.value, {})

        # Email
        if preferences.email_enabled and type_prefs.get("email", True):
            channels.append(NotificationChannel.EMAIL)

        # SMS
        if preferences.sms_enabled and type_prefs.get("sms", False):
            channels.append(NotificationChannel.SMS)

        # Push
        if preferences.push_enabled and type_prefs.get("push", True):
            channels.append(NotificationChannel.PUSH)

        return channels

    async def _send_notification(
        self,
        notification: Notification,
        channels: list[NotificationChannel],
        preferences: NotificationPreference,
    ) -> None:
        """Send notification via configured channels."""
        # Email delivery
        if NotificationChannel.EMAIL in channels:
            try:
                await self._send_email(notification)
                notification.email_sent = True
                notification.email_sent_at = datetime.utcnow()
            except Exception as e:
                logger.error("Failed to send email notification", error=str(e))

        # SMS delivery (placeholder - requires SMS provider)
        if NotificationChannel.SMS in channels:
            try:
                await self._send_sms(notification)
                notification.sms_sent = True
                notification.sms_sent_at = datetime.utcnow()
            except Exception as e:
                logger.error("Failed to send SMS notification", error=str(e))

        # Push notification (placeholder - requires push provider)
        if NotificationChannel.PUSH in channels:
            try:
                await self._send_push(notification)
                notification.push_sent = True
                notification.push_sent_at = datetime.utcnow()
            except Exception as e:
                logger.error("Failed to send push notification", error=str(e))

        await self.db.flush()

    async def _send_email(self, notification: Notification) -> None:
        """Send notification via email."""
        # Get user email
        from dotmac.platform.user_management.models import User

        stmt = select(User).where(User.id == notification.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.email:
            logger.warning("Cannot send email notification - user has no email", user_id=str(notification.user_id))
            return

        # Queue email for async delivery
        email_message = EmailMessage(
            to=[user.email],
            subject=notification.title,
            text_body=notification.message,
            html_body=self._render_html_email(notification),
        )

        # Use communications service to send
        queue_email(email_message)

        logger.info("Email notification queued", notification_id=str(notification.id), email=user.email)

    async def _send_sms(self, notification: Notification) -> None:
        """Send notification via SMS (placeholder)."""
        # TODO: Integrate with SMS provider (Twilio, AWS SNS, etc.)
        logger.info("SMS notification (placeholder)", notification_id=str(notification.id))

    async def _send_push(self, notification: Notification) -> None:
        """Send push notification (placeholder)."""
        # TODO: Integrate with push provider (Firebase, OneSignal, etc.)
        logger.info("Push notification (placeholder)", notification_id=str(notification.id))

    def _render_html_email(self, notification: Notification) -> str:
        """Render HTML email for notification."""
        action_button = ""
        if notification.action_url and notification.action_label:
            action_button = f"""
            <div style="margin: 20px 0;">
                <a href="{notification.action_url}"
                   style="background-color: #007bff; color: white; padding: 10px 20px;
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    {notification.action_label}
                </a>
            </div>
            """

        priority_color = {
            NotificationPriority.LOW: "#6c757d",
            NotificationPriority.MEDIUM: "#0dcaf0",
            NotificationPriority.HIGH: "#fd7e14",
            NotificationPriority.URGENT: "#dc3545",
        }

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                <div style="border-left: 4px solid {priority_color[notification.priority]}; padding-left: 15px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333;">{notification.title}</h2>
                    <p style="margin: 5px 0 0; color: #666; font-size: 0.9em;">
                        Priority: {notification.priority.value.upper()}
                    </p>
                </div>
                <div style="margin: 20px 0;">
                    <p style="white-space: pre-line;">{notification.message}</p>
                </div>
                {action_button}
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.85em;">
                    <p>This is an automated notification from your ISP platform.</p>
                </div>
            </div>
        </body>
        </html>
        """
