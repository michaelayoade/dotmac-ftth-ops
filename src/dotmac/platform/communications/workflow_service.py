"""
Communications Workflow Service

Provides workflow-compatible methods for communication operations.
"""

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class CommunicationsService:
    """
    Communications service for workflow integration.

    Provides email, SMS, and template-based communication for workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def send_template_email(
        self,
        template: str,
        recipient: str,
        variables: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Send a templated email.

        Args:
            template: Template name (e.g., "customer_welcome", "order_confirmation")
            recipient: Recipient email address
            variables: Template variables dict

        Returns:
            Dict with message_id, status
        """
        from datetime import datetime

        from ..settings import settings
        from .email_service import EmailMessage, EmailService
        from .models import CommunicationTemplate
        from .template_service import TemplateService

        logger.info(
            f"Sending template email '{template}' to {recipient} with variables: {list(variables.keys())}"
        )

        # 1. Load template from database
        stmt = select(CommunicationTemplate).where(
            CommunicationTemplate.name == template,
            CommunicationTemplate.is_active,
        )
        result = await self.db.execute(stmt)
        template_record = result.scalar_one_or_none()

        if not template_record:
            logger.warning(f"Template '{template}' not found, using fallback")
            # Fallback to simple email with no template
            return await self._send_fallback_email(template, recipient, variables)

        # 2. Render template with variables
        _ = TemplateService()

        try:
            # Render subject
            from jinja2 import Template as JinjaTemplate

            subject_template = JinjaTemplate(template_record.subject_template or "{{subject}}")
            subject = subject_template.render(**variables)

            # Render text body
            text_body = None
            if template_record.text_template:
                text_template = JinjaTemplate(template_record.text_template)
                text_body = text_template.render(**variables)

            # Render HTML body
            html_body = None
            if template_record.html_template:
                html_template = JinjaTemplate(template_record.html_template)
                html_body = html_template.render(**variables)

        except Exception as e:
            logger.error(f"Error rendering template '{template}': {e}", exc_info=True)
            return await self._send_fallback_email(template, recipient, variables)

        # 3. Send email via email service (with Vault integration)
        email_service = EmailService(
            smtp_host=getattr(settings, "SMTP_HOST", "localhost"),
            smtp_port=getattr(settings, "SMTP_PORT", 587),
            smtp_user=getattr(settings, "SMTP_USER", None),
            smtp_password=getattr(settings, "SMTP_PASSWORD", None),
            use_tls=getattr(settings, "SMTP_USE_TLS", True),
            default_from=getattr(settings, "SMTP_DEFAULT_FROM", "noreply@dotmac.com"),
            db=self.db,
            use_vault=getattr(settings, "SMTP_USE_VAULT", True),  # Enable Vault by default
            vault_path=getattr(settings, "SMTP_VAULT_PATH", "secret/smtp"),
        )

        email_message = EmailMessage(
            to=[recipient],
            subject=subject,
            text_body=text_body,
            html_body=html_body,
        )

        try:
            # Send the email
            response = await email_service.send_email(email_message)

            # Update template usage stats
            template_record.usage_count += 1
            template_record.last_used_at = datetime.utcnow()
            await self.db.commit()

            logger.info(
                f"Email sent successfully: template='{template}', recipient={recipient}, message_id={response.id}"
            )

            return {
                "message_id": response.id,
                "template": template,
                "recipient": recipient,
                "variables": variables,
                "status": response.status,
                "sent_at": response.sent_at.isoformat(),
            }

        except Exception as e:
            logger.error(f"Error sending email with template '{template}': {e}", exc_info=True)
            # Return error status but don't fail the workflow
            return {
                "message_id": f"failed-{uuid4().hex[:12]}",
                "template": template,
                "recipient": recipient,
                "variables": variables,
                "status": "failed",
                "error": str(e),
                "sent_at": datetime.utcnow().isoformat(),
            }

    async def _send_fallback_email(
        self,
        template_name: str,
        recipient: str,
        variables: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Send a simple fallback email when template is not found.

        Args:
            template_name: Name of the template that wasn't found
            recipient: Recipient email address
            variables: Variables that would have been used

        Returns:
            Dict with message details
        """
        from datetime import datetime

        from ..settings import settings
        from .email_service import EmailMessage, EmailService

        logger.info(f"Sending fallback email for template '{template_name}' to {recipient}")

        # Create simple fallback email (with Vault integration)
        email_service = EmailService(
            smtp_host=getattr(settings, "SMTP_HOST", "localhost"),
            smtp_port=getattr(settings, "SMTP_PORT", 587),
            smtp_user=getattr(settings, "SMTP_USER", None),
            smtp_password=getattr(settings, "SMTP_PASSWORD", None),
            use_tls=getattr(settings, "SMTP_USE_TLS", True),
            default_from=getattr(settings, "SMTP_DEFAULT_FROM", "noreply@dotmac.com"),
            db=self.db,
            use_vault=getattr(settings, "SMTP_USE_VAULT", True),  # Enable Vault by default
            vault_path=getattr(settings, "SMTP_VAULT_PATH", "secret/smtp"),
        )

        # Use variables to create a simple subject and body
        subject = variables.get("subject", f"Notification: {template_name}")
        message_content = variables.get("message", "You have a new notification.")

        email_message = EmailMessage(
            to=[recipient],
            subject=subject,
            text_body=f"Hello,\n\n{message_content}\n\nBest regards,\nDotMac Platform",
            html_body=f"<p>Hello,</p><p>{message_content}</p><p>Best regards,<br>DotMac Platform</p>",
        )

        try:
            response = await email_service.send_email(email_message)

            logger.info(f"Fallback email sent: recipient={recipient}, message_id={response.id}")

            return {
                "message_id": response.id,
                "template": template_name,
                "recipient": recipient,
                "variables": variables,
                "status": response.status,
                "sent_at": response.sent_at.isoformat(),
                "fallback": True,
            }

        except Exception as e:
            logger.error(f"Error sending fallback email: {e}", exc_info=True)
            return {
                "message_id": f"failed-{uuid4().hex[:12]}",
                "template": template_name,
                "recipient": recipient,
                "variables": variables,
                "status": "failed",
                "error": str(e),
                "sent_at": datetime.utcnow().isoformat(),
                "fallback": True,
            }
