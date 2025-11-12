"""
Notification Service.

Handles user notification creation, delivery, and preference management.
"""

# mypy: ignore-errors

import asyncio
from datetime import datetime
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.communications.branding_utils import (
    derive_brand_tokens,
    render_branded_email_html,
    render_branded_sms_text,
)
from dotmac.platform.communications.task_service import queue_email
from dotmac.platform.communications.template_service import TemplateService
from dotmac.platform.core.exceptions import NotFoundError
from dotmac.platform.notifications.channels.base import NotificationContext
from dotmac.platform.notifications.channels.factory import ChannelProviderFactory
from dotmac.platform.notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationPriority,
    NotificationTemplate,
    NotificationType,
)
from dotmac.platform.tenant.schemas import TenantBrandingConfig
from dotmac.platform.tenant.service import TenantNotFoundError, TenantService

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
        from jinja2 import DictLoader, Environment, select_autoescape

        env = Environment(
            loader=DictLoader(
                {
                    "title": template.title_template,
                    "message": template.message_template,
                    "action_url": template.action_url_template or "",
                }
            ),
            autoescape=select_autoescape(
                enabled_extensions=("html", "xml"),
                default_for_string=True,
            ),
        )

        title = env.get_template("title").render(**variables)
        message = env.get_template("message").render(**variables)
        action_url = (
            env.get_template("action_url").render(**variables)
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

    async def delete_notification(
        self, tenant_id: str, user_id: UUID, notification_id: UUID
    ) -> Notification:
        """Soft delete a notification."""
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

        if not notification.deleted_at:
            notification.deleted_at = datetime.utcnow()
            notification.is_active = False

        await self.db.flush()
        return notification

    async def get_user_preferences(self, tenant_id: str, user_id: UUID) -> NotificationPreference:
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
        scalar = result.scalar_one_or_none()
        if asyncio.iscoroutine(scalar):
            scalar = await scalar
        if not isinstance(scalar, NotificationTemplate):
            return None
        return scalar

    async def create_template(
        self,
        tenant_id: str,
        notification_type: NotificationType,
        name: str,
        title_template: str,
        message_template: str,
        *,
        description: str | None = None,
        action_url_template: str | None = None,
        action_label: str | None = None,
        default_priority: NotificationPriority = NotificationPriority.MEDIUM,
        default_channels: list[str | NotificationChannel] | None = None,
        email_template_name: str | None = None,
        sms_template: str | None = None,
        push_title_template: str | None = None,
        push_body_template: str | None = None,
        required_variables: list[str] | None = None,
    ) -> NotificationTemplate:
        """Create a notification template."""
        channels = default_channels or [NotificationChannel.IN_APP]
        normalized_channels = [
            channel.value if isinstance(channel, NotificationChannel) else str(channel)
            for channel in channels
        ]

        template = NotificationTemplate(
            tenant_id=tenant_id,
            type=notification_type,
            name=name,
            description=description,
            title_template=title_template,
            message_template=message_template,
            action_url_template=action_url_template,
            action_label=action_label,
            email_template_name=email_template_name,
            sms_template=sms_template,
            push_title_template=push_title_template,
            push_body_template=push_body_template,
            default_priority=default_priority,
            default_channels=normalized_channels,
            required_variables=required_variables or [],
        )

        self.db.add(template)
        await self.db.flush()
        await self.db.refresh(template)

        return template

    async def update_template(
        self,
        tenant_id: str,
        notification_type: NotificationType,
        *,
        name: str | None = None,
        title_template: str | None = None,
        message_template: str | None = None,
        action_url_template: str | None = None,
        action_label: str | None = None,
        default_priority: NotificationPriority | None = None,
        default_channels: list[str | NotificationChannel] | None = None,
        description: str | None = None,
        email_template_name: str | None = None,
        sms_template: str | None = None,
        push_title_template: str | None = None,
        push_body_template: str | None = None,
        required_variables: list[str] | None = None,
        is_active: bool | None = None,
    ) -> NotificationTemplate:
        """Update an existing notification template."""
        template = await self.get_template(tenant_id, notification_type)
        if not template:
            raise NotFoundError(
                f"Template for type {notification_type.value} not found for tenant {tenant_id}"
            )

        if name is not None:
            template.name = name
        if description is not None:
            template.description = description
        if title_template is not None:
            template.title_template = title_template
        if message_template is not None:
            template.message_template = message_template
        if action_url_template is not None:
            template.action_url_template = action_url_template
        if action_label is not None:
            template.action_label = action_label
        if email_template_name is not None:
            template.email_template_name = email_template_name
        if sms_template is not None:
            template.sms_template = sms_template
        if push_title_template is not None:
            template.push_title_template = push_title_template
        if push_body_template is not None:
            template.push_body_template = push_body_template
        if default_priority is not None:
            template.default_priority = default_priority
        if default_channels is not None:
            template.default_channels = [
                channel.value if isinstance(channel, NotificationChannel) else str(channel)
                for channel in default_channels
            ]
        if required_variables is not None:
            template.required_variables = required_variables
        if is_active is not None:
            template.is_active = is_active

        await self.db.flush()
        await self.db.refresh(template)
        return template

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

        if NotificationChannel.WEBHOOK in channels:
            try:
                await self._send_webhook(notification)
            except Exception as e:
                logger.error("Failed to send webhook notification", error=str(e))

        await self.db.flush()

    async def _send_email(self, notification: Notification) -> None:
        """Send notification via email."""
        # Get user email
        from dotmac.platform.user_management.models import User

        stmt = select(User).where(User.id == notification.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.email:
            logger.warning(
                "Cannot send email notification - user has no email",
                user_id=str(notification.user_id),
            )
            return

        branding = await self._get_tenant_branding(notification.tenant_id)
        html_body = self._render_html_email(notification, branding)

        queue_email(
            to=[user.email],
            subject=notification.title,
            text_body=notification.message,
            html_body=html_body,
        )

        logger.info(
            "Email notification queued", notification_id=str(notification.id), email=user.email
        )

    async def _send_sms(self, notification: Notification) -> None:
        """Send notification via SMS using configured provider (Twilio, AWS SNS, etc.)."""
        # Get SMS channel provider
        sms_provider = ChannelProviderFactory.get_provider(NotificationChannel.SMS)
        if not sms_provider:
            logger.warning(
                "SMS provider not configured or disabled",
                notification_id=str(notification.id),
            )
            return

        # Get user phone number
        from dotmac.platform.user_management.models import User

        stmt = select(User).where(User.id == notification.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.phone:
            logger.warning(
                "Cannot send SMS notification - user has no phone number",
                user_id=str(notification.user_id),
                notification_id=str(notification.id),
            )
            return

        # Create notification context
        branding = await self._get_tenant_branding(notification.tenant_id)
        product_name, _, support_email = derive_brand_tokens(branding)
        branded_message = render_branded_sms_text(notification.message, branding)

        context = NotificationContext(
            notification_id=notification.id,
            tenant_id=notification.tenant_id,
            user_id=notification.user_id,
            notification_type=notification.type,
            priority=notification.priority,
            title=notification.title,
            message=branded_message,
            action_url=notification.action_url,
            action_label=notification.action_label,
            recipient_phone=user.phone,
            recipient_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            metadata=notification.metadata,
            created_at=notification.created_at,
            related_entity_type=notification.related_entity_type,
            related_entity_id=notification.related_entity_id,
            branding=branding.model_dump(),
            product_name=product_name,
            support_email=support_email,
        )

        # Send via SMS provider
        await sms_provider.send(context)

        logger.info(
            "SMS notification sent",
            notification_id=str(notification.id),
            phone_masked=self._mask_phone(user.phone),
        )

    async def _send_push(self, notification: Notification) -> None:
        """Send push notification using configured provider (Firebase FCM, OneSignal, AWS SNS, etc.)."""
        # Get push channel provider
        push_provider = ChannelProviderFactory.get_provider(NotificationChannel.PUSH)
        if not push_provider:
            logger.warning(
                "Push provider not configured or disabled",
                notification_id=str(notification.id),
            )
            return

        # Get user information
        from dotmac.platform.user_management.models import User, UserDevice

        stmt = select(User).where(User.id == notification.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            logger.warning(
                "Cannot send push notification - user not found",
                user_id=str(notification.user_id),
                notification_id=str(notification.id),
            )
            return

        # Get user's active push tokens from device registration table
        device_stmt = select(UserDevice).where(
            and_(
                UserDevice.user_id == notification.user_id,
                UserDevice.tenant_id == notification.tenant_id,
                UserDevice.is_active == True,  # noqa: E712
            )
        )
        device_result = await self.db.execute(device_stmt)
        devices = device_result.scalars().all()

        if not devices:
            logger.debug(
                "No active devices registered for user - skipping push notification",
                user_id=str(notification.user_id),
                notification_id=str(notification.id),
            )
            return

        # Extract device tokens
        push_tokens = [device.device_token for device in devices]

        # Create notification context
        branding = await self._get_tenant_branding(notification.tenant_id)
        product_name, _, support_email = derive_brand_tokens(branding)

        context = NotificationContext(
            notification_id=notification.id,
            tenant_id=notification.tenant_id,
            user_id=notification.user_id,
            notification_type=notification.type,
            priority=notification.priority,
            title=notification.title,
            message=notification.message,
            action_url=notification.action_url,
            action_label=notification.action_label,
            recipient_push_tokens=push_tokens,
            recipient_name=f"{user.first_name} {user.last_name}".strip() or user.email,
            recipient_email=user.email,
            metadata=notification.metadata,
            created_at=notification.created_at,
            related_entity_type=notification.related_entity_type,
            related_entity_id=notification.related_entity_id,
            branding=branding.model_dump(),
            product_name=product_name,
            support_email=support_email,
        )

        # Send via push provider
        await push_provider.send(context)

        logger.info(
            "Push notification sent",
            notification_id=str(notification.id),
            device_count=len(push_tokens),
        )

    async def _send_webhook(self, notification: Notification) -> None:
        """Send webhook notification via configured provider."""
        provider = ChannelProviderFactory.get_provider(NotificationChannel.WEBHOOK)
        if not provider:
            logger.warning(
                "Webhook provider not configured or disabled",
                notification_id=str(notification.id),
            )
            return

        from dotmac.platform.user_management.models import User

        stmt = select(User).where(User.id == notification.user_id)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()

        branding = await self._get_tenant_branding(notification.tenant_id)
        product_name, _, support_email = derive_brand_tokens(branding)

        context = NotificationContext(
            notification_id=notification.id,
            tenant_id=notification.tenant_id,
            user_id=notification.user_id,
            notification_type=notification.type,
            priority=notification.priority,
            title=notification.title,
            message=notification.message,
            action_url=notification.action_url,
            action_label=notification.action_label,
            recipient_email=user.email if user else None,
            recipient_phone=user.phone if user else None,
            recipient_name=f"{(user.first_name if user else '')} {(user.last_name if user else '')}".strip()
            if user
            else None,
            metadata=notification.metadata,
            created_at=notification.created_at,
            related_entity_type=notification.related_entity_type,
            related_entity_id=notification.related_entity_id,
            branding=branding.model_dump(),
            product_name=product_name,
            support_email=support_email,
        )

        await provider.send(context)

    async def notify_team(
        self,
        tenant_id: str,
        team_members: list[UUID] | None = None,
        role_filter: str | None = None,
        notification_type: NotificationType = NotificationType.SYSTEM_ALERT,
        title: str = "",
        message: str = "",
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        action_url: str | None = None,
        action_label: str | None = None,
        related_entity_type: str | None = None,
        related_entity_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        auto_send: bool = True,
    ) -> list[Notification]:
        """
        Send notifications to a team of users.

        Supports two modes:
        1. Specific team members: Pass list of user UUIDs
        2. Role-based: Pass role_filter to notify all users with that role

        Args:
            tenant_id: Tenant identifier
            team_members: Specific list of user IDs to notify (optional)
            role_filter: Role name to filter users (optional, e.g., "admin", "support_agent")
            notification_type: Type of notification
            title: Notification title
            message: Notification message
            priority: Priority level
            action_url: Optional action URL
            action_label: Optional action button label
            related_entity_type: Type of related entity
            related_entity_id: ID of related entity
            metadata: Additional metadata
            auto_send: Automatically send via configured channels

        Returns:
            List of created notifications (one per team member)

        Raises:
            ValueError: If neither team_members nor role_filter is provided
        """
        from dotmac.platform.user_management.models import User

        logger.info(
            "Notifying team",
            tenant_id=tenant_id,
            team_size=len(team_members) if team_members else "role-based",
            role_filter=role_filter,
            type=notification_type.value,
        )

        # Determine target users
        target_users: list[UUID] = []

        if team_members:
            # Use explicitly provided team members
            target_users = team_members
        elif role_filter:
            # Query users by role
            stmt = select(User).where(
                and_(
                    User.tenant_id == tenant_id,
                    User.is_active == True,  # noqa: E712
                    User.deleted_at.is_(None),
                )
            )

            result = await self.db.execute(stmt)
            users = result.scalars().all()

            # Filter by role (roles is JSON array)
            target_users = [user.id for user in users if role_filter in (user.roles or [])]

            logger.info(
                "Role-based team notification",
                role=role_filter,
                matching_users=len(target_users),
            )
        else:
            raise ValueError("Either team_members or role_filter must be provided")

        if not target_users:
            logger.warning(
                "No users found for team notification",
                tenant_id=tenant_id,
                role_filter=role_filter,
            )
            return []

        # Create notification for each team member
        notifications: list[Notification] = []

        # Add team context to metadata
        team_metadata = metadata or {}
        team_metadata.update(
            {
                "team_notification": True,
                "team_size": len(target_users),
                "role_filter": role_filter,
            }
        )

        for user_id in target_users:
            try:
                notification = await self.create_notification(
                    tenant_id=tenant_id,
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    message=message,
                    priority=priority,
                    action_url=action_url,
                    action_label=action_label,
                    related_entity_type=related_entity_type,
                    related_entity_id=related_entity_id,
                    metadata=team_metadata,
                    auto_send=auto_send,
                )
                notifications.append(notification)
            except Exception as e:
                logger.error(
                    "Failed to notify team member",
                    user_id=str(user_id),
                    error=str(e),
                )
                # Continue with other team members

        logger.info(
            "Team notification complete",
            tenant_id=tenant_id,
            notifications_created=len(notifications),
            target_count=len(target_users),
        )

        return notifications

    def _render_html_email(self, notification: Notification, branding: TenantBrandingConfig) -> str:
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

        content = f"""
        <div style="border-left: 4px solid {priority_color[notification.priority]}; padding-left: 15px; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #0f172a;">{notification.title}</h2>
            <p style="margin: 5px 0 0; color: #475569; font-size: 0.9em;">
                Priority: {notification.priority.value.upper()}
            </p>
        </div>
        <div style="margin: 20px 0;">
            <p style="white-space: pre-line; color: #0f172a;">{notification.message}</p>
        </div>
        {action_button}
        """

        return render_branded_email_html(branding, content)

    async def _get_tenant_branding(self, tenant_id: str | None) -> TenantBrandingConfig:
        """Resolve tenant branding data."""
        service = TenantService(self.db)
        if tenant_id:
            try:
                return (await service.get_tenant_branding(tenant_id)).branding
            except TenantNotFoundError:
                logger.warning(
                    "Tenant not found while resolving notification branding",
                    tenant_id=tenant_id,
                )
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.error(
                    "Failed to resolve tenant branding for notifications",
                    tenant_id=tenant_id,
                    error=str(exc),
                )
        return TenantService.get_default_branding_config()

    @staticmethod
    def _mask_phone(phone: str) -> str:
        """
        Mask phone number for privacy in logs.

        Args:
            phone: Phone number to mask

        Returns:
            Masked phone number (e.g., +234***1234)
        """
        if not phone or len(phone) < 4:
            return "***"

        # Keep first 4 and last 4 characters, mask the rest
        if len(phone) <= 8:
            return phone[:2] + "***" + phone[-2:]

        return phone[:4] + "***" + phone[-4:]
