"""
Communications Workflow Service

Provides workflow-compatible methods for communication operations.
"""

import logging
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.communications.branding_utils import (
    derive_brand_tokens,
    render_branded_email_html,
)
from dotmac.platform.tenant.schemas import TenantBrandingConfig
from dotmac.platform.tenant.service import TenantNotFoundError, TenantService

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
        tenant_id: str | None = None,
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

        from jinja2 import Template as JinjaTemplate

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

        branding = await self._resolve_branding(tenant_id)
        branding_payload = branding.model_dump()
        render_context = dict(variables)
        render_context.setdefault("branding", branding_payload)
        product_name, _, support_email = derive_brand_tokens(branding)
        render_context.setdefault("product_name", product_name)
        render_context.setdefault("support_email", support_email)

        if not template_record:
            logger.warning(f"Template '{template}' not found, using fallback")
            # Fallback to simple email with no template
            return await self._send_fallback_email(template, recipient, render_context, branding)

        # 2. Render template with variables
        _ = TemplateService()

        try:
            # Render subject
            subject_template = JinjaTemplate(template_record.subject_template or "{{subject}}")
            subject = subject_template.render(**render_context)

            # Render text body
            text_body = None
            if template_record.text_template:
                text_template = JinjaTemplate(template_record.text_template)
                text_body = text_template.render(**render_context)

            # Render HTML body
            html_body = None
            if template_record.html_template:
                html_template = JinjaTemplate(template_record.html_template)
                html_body = html_template.render(**render_context)

        except Exception as e:
            logger.error(f"Error rendering template '{template}': {e}", exc_info=True)
            return await self._send_fallback_email(template, recipient, render_context, branding)

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
        branding: TenantBrandingConfig,
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
        product_name, company_name, support_email = derive_brand_tokens(branding)

        email_message = EmailMessage(
            to=[recipient],
            subject=subject,
            text_body=(
                f"Hello,\n\n{message_content}\n\nBest regards,\n{product_name}\n"
                f"Need assistance? Contact {support_email}."
            ),
            html_body=render_branded_email_html(
                branding,
                f"<p>Hello,</p><p>{message_content}</p><p>Best regards,<br>{company_name} Team</p>",
            ),
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

    async def _resolve_branding(self, tenant_id: str | None) -> TenantBrandingConfig:
        """Fetch tenant-specific branding or fall back to global defaults."""
        service = TenantService(self.db)
        if tenant_id:
            try:
                return (await service.get_tenant_branding(tenant_id)).branding
            except TenantNotFoundError:
                logger.warning(
                    "Tenant not found while resolving branding for communications service",
                    tenant_id=tenant_id,
                )
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.error(
                    "Failed to resolve tenant branding, defaulting to globals",
                    tenant_id=tenant_id,
                    error=str(exc),
                )
        return TenantService.get_default_branding_config()
