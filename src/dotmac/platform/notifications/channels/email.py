"""
Email Channel Provider.

Sends notifications via email using the existing communications email service.
"""

from dotmac.platform.communications.email_service import EmailMessage
from dotmac.platform.communications.task_service import queue_email

from ..models import NotificationPriority
from .base import NotificationChannelProvider, NotificationContext


class EmailChannelProvider(NotificationChannelProvider):
    """Email notification channel using communications service."""

    @property
    def channel_name(self) -> str:
        return "email"

    async def send(self, context: NotificationContext) -> bool:
        """
        Send notification via email.

        Args:
            context: Notification context with recipient email

        Returns:
            True if email queued successfully

        Raises:
            ValueError: If recipient email is missing
        """
        if not context.recipient_email:
            raise ValueError(
                f"Cannot send email notification - no recipient email provided "
                f"(notification_id={context.notification_id})"
            )

        # Render HTML email
        html_body = self._render_html_email(context)

        # Create email message
        EmailMessage(
            to=[context.recipient_email],
            subject=context.title,
            text_body=context.message,
            html_body=html_body,
        )

        # Queue for async delivery via communications service
        queue_email(
            to=[context.recipient_email],
            subject=context.title,
            text_body=context.message,
            html_body=html_body,
        )

        self.logger.info(
            "email.notification.queued",
            notification_id=str(context.notification_id),
            email=context.recipient_email,
            priority=context.priority.value,
        )

        return True

    def _render_html_email(self, context: NotificationContext) -> str:
        """
        Render HTML email for notification.

        Args:
            context: Notification context

        Returns:
            Rendered HTML string
        """
        action_button = ""
        if context.action_url and context.action_label:
            action_button = f"""
            <div style="margin: 20px 0;">
                <a href="{context.action_url}"
                   style="background-color: #007bff; color: white; padding: 10px 20px;
                          text-decoration: none; border-radius: 5px; display: inline-block;">
                    {context.action_label}
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
                <div style="border-left: 4px solid {priority_color[context.priority]}; padding-left: 15px; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333;">{context.title}</h2>
                    <p style="margin: 5px 0 0; color: #666; font-size: 0.9em;">
                        Priority: {context.priority.value.upper()}
                    </p>
                </div>
                <div style="margin: 20px 0;">
                    <p style="white-space: pre-wrap;">{context.message}</p>
                </div>
                {action_button}
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 0.85em; color: #666;">
                    <p>This is an automated notification from your ISP Operations Platform.</p>
                </div>
            </div>
        </body>
        </html>
        """

    async def validate_config(self) -> bool:
        """
        Validate email provider configuration.

        Returns:
            True if email service is configured
        """
        # Email is handled by communications service, which has its own validation
        return True

    def supports_priority(self, priority: NotificationPriority) -> bool:
        """
        Email supports all priority levels.

        Args:
            priority: Notification priority

        Returns:
            Always True
        """
        return True
