"""
Email service using standard libraries.

Provides email functionality using standard smtplib.
Supports Vault integration for secure credential management.
"""

import os
import smtplib
from datetime import UTC, datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from uuid import uuid4

import structlog
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.communications.plugins import (
    EmailTransport,
    get_plugin,
    register_builtin_plugins,
)
from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


class EmailMessage(BaseModel):  # BaseModel resolves to Any in isolation
    """Email message model."""

    to: list[EmailStr] = Field(..., description="Recipient email addresses")
    subject: str = Field(..., min_length=1, description="Email subject")
    text_body: str | None = Field(default=None, description="Plain text body")
    html_body: str | None = Field(default=None, description="HTML body")
    from_email: EmailStr | None = Field(default=None, description="Sender email")
    from_name: str | None = Field(default=None, description="Sender name")
    reply_to: EmailStr | None = Field(default=None, description="Reply-to address")
    cc: list[EmailStr] = Field(default_factory=list, description="CC recipients")
    bcc: list[EmailStr] = Field(default_factory=list, description="BCC recipients")

    model_config = ConfigDict(str_strip_whitespace=True, validate_assignment=True, extra="forbid")


class EmailResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Email sending response."""

    model_config = ConfigDict()

    id: str = Field(..., description="Unique message ID")
    status: str = Field(..., description="Delivery status")
    message: str = Field(..., description="Status message")
    sent_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    recipients_count: int = Field(..., description="Number of recipients")


class EmailService:
    """Email service using standard SMTP.

    Supports Vault integration for secure credential management.
    Set SMTP_USE_VAULT=true to load credentials from Vault instead of environment variables.
    """

    def __init__(
        self,
        smtp_host: str = "localhost",
        smtp_port: int = 587,
        smtp_user: str | None = None,
        smtp_password: str | None = None,
        use_tls: bool = True,
        default_from: str | None = None,
        tenant_id: str | None = None,
        db: AsyncSession | None = None,
        use_vault: bool = False,
        vault_path: str = "secret/smtp",
        transport_plugin_id: str | None = None,
    ):
        register_builtin_plugins()
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.use_tls = use_tls
        configured_from = default_from or getattr(settings.email, "from_address", None)
        if not configured_from:
            configured_from = f"noreply@{settings.brand.notification_domain}"
        self.default_from = configured_from
        self.tenant_id = tenant_id
        self.db = db
        self.use_vault = use_vault or os.getenv("SMTP_USE_VAULT", "false").lower() == "true"
        self.vault_path = vault_path
        self._vault_credentials: dict[str, str] | None = None

        self._transport_plugin_id = transport_plugin_id or "communications.smtp"
        self._transport: EmailTransport | None = None

        # Store credentials (will be overridden if using Vault)
        self.smtp_user = smtp_user
        self.smtp_password = smtp_password

        # Log initialization without credentials (security: never log passwords)
        logger.info(
            "Email service initialized",
            host=smtp_host,
            port=smtp_port,
            use_tls=use_tls,
            use_vault=self.use_vault,
            user=smtp_user[:4] + "***" if smtp_user and len(smtp_user) > 4 else "***",
            has_password=bool(smtp_password),
        )

    async def send_email(
        self,
        message: EmailMessage,
        tenant_id: str | None = None,
        db: AsyncSession | None = None,
    ) -> EmailResponse:
        """Send a single email message."""
        message_id = f"email_{uuid4().hex[:8]}"

        try:
            transport = self._get_transport()
            await transport.send(self, message, message_id)

            recipients_count = len(message.to) + len(message.cc) + len(message.bcc)
            response = EmailResponse(
                id=message_id,
                status="sent",
                message="Email sent successfully",
                recipients_count=recipients_count,
            )

            logger.info(
                "Email sent successfully",
                message_id=message_id,
                recipients=len(message.to),
                subject=message.subject,
            )

            # Publish webhook event if DB session provided
            if db or self.db:
                try:
                    from dotmac.platform.webhooks.events import get_event_bus
                    from dotmac.platform.webhooks.models import WebhookEvent

                    await get_event_bus().publish(
                        event_type=WebhookEvent.EMAIL_SENT.value,
                        event_data={
                            "message_id": message_id,
                            "to": [str(email) for email in message.to],
                            "subject": message.subject,
                            "from_email": (
                                str(message.from_email) if message.from_email else self.default_from
                            ),
                            "recipients_count": response.recipients_count,
                            "sent_at": response.sent_at.isoformat(),
                        },
                        tenant_id=tenant_id or self.tenant_id or "system",
                        db=db or self.db,
                    )
                except (SQLAlchemyError, RuntimeError) as exc:
                    logger.warning("Failed to publish email.sent event", error=str(exc))

            return response

        except (smtplib.SMTPException, OSError, RuntimeError, ValueError) as e:
            logger.error(
                "Failed to send email", message_id=message_id, error=str(e), subject=message.subject
            )

            recipients_count = len(message.to) + len(message.cc) + len(message.bcc)
            response = EmailResponse(
                id=message_id,
                status="failed",
                message=f"Failed to send email: {str(e)}",
                recipients_count=recipients_count,
            )

            # Publish webhook event for failed email if DB session provided
            if db or self.db:
                try:
                    from dotmac.platform.webhooks.events import get_event_bus
                    from dotmac.platform.webhooks.models import WebhookEvent

                    await get_event_bus().publish(
                        event_type=WebhookEvent.EMAIL_FAILED.value,
                        event_data={
                            "message_id": message_id,
                            "to": [str(email) for email in message.to],
                            "subject": message.subject,
                            "from_email": (
                                str(message.from_email) if message.from_email else self.default_from
                            ),
                            "recipients_count": response.recipients_count,
                            "error": str(e),
                        },
                        tenant_id=tenant_id or self.tenant_id or "system",
                        db=db or self.db,
                    )
                except (SQLAlchemyError, RuntimeError) as webhook_error:
                    logger.warning("Failed to publish email.failed event", error=str(webhook_error))

            return response

    def _create_mime_message(self, message: EmailMessage, message_id: str) -> MIMEMultipart:
        """Create MIME message from EmailMessage."""
        msg = MIMEMultipart("alternative")

        # Headers
        msg["Subject"] = message.subject
        msg["From"] = self._format_from_address(message.from_email, message.from_name)
        msg["To"] = ", ".join(str(email) for email in message.to)
        message_domain = settings.brand.notification_domain or "example.com"
        msg["Message-ID"] = f"<{message_id}@{message_domain}>"
        msg["Date"] = datetime.now(UTC).strftime("%a, %d %b %Y %H:%M:%S %z")

        if message.cc:
            msg["Cc"] = ", ".join(str(email) for email in message.cc)

        if message.reply_to:
            msg["Reply-To"] = str(message.reply_to)

        # Body parts
        if message.text_body:
            text_part = MIMEText(message.text_body, "plain", "utf-8")
            msg.attach(text_part)

        if message.html_body:
            html_part = MIMEText(message.html_body, "html", "utf-8")
            msg.attach(html_part)

        # If no body provided, add minimal text
        if not message.text_body and not message.html_body:
            msg.attach(MIMEText("", "plain"))

        return msg

    def _format_from_address(self, from_email: EmailStr | None, from_name: str | None) -> str:
        """Format the From header address."""
        email = str(from_email) if from_email else self.default_from

        if from_name:
            return f'"{from_name}" <{email}>'
        return email

    def _resolve_vault_secret_path(self) -> str:
        """Normalize configured Vault path relative to the mount path."""
        path = self.vault_path.strip("/")
        mount_path = settings.vault.mount_path.strip("/") if settings.vault.mount_path else ""

        if mount_path and path.startswith(f"{mount_path}/"):
            return path[len(mount_path) + 1 :]
        return path

    def _get_smtp_credentials(self) -> tuple[str | None, str | None]:
        """Get SMTP credentials from Vault or environment."""
        if not self.use_vault or not settings.vault.enabled:
            return (self.smtp_user, self.smtp_password)

        if self._vault_credentials is None:
            secret_path = self._resolve_vault_secret_path()
            try:
                from dotmac.platform.secrets.vault_client import VaultClient, VaultError

                vault_client = VaultClient(
                    url=settings.vault.url,
                    token=settings.vault.token,
                    namespace=settings.vault.namespace,
                    mount_path=settings.vault.mount_path,
                    kv_version=settings.vault.kv_version,
                )
                try:
                    self._vault_credentials = vault_client.get_secret(secret_path) or {}
                finally:
                    vault_client.close()

                if self._vault_credentials:
                    logger.info("SMTP credentials loaded from Vault", path=secret_path)
            except VaultError as exc:
                logger.warning(
                    "Failed to load SMTP credentials from Vault, falling back to environment",
                    error=str(exc),
                )
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning(
                    "Unexpected error loading SMTP credentials from Vault, falling back to environment",
                    error=str(exc),
                )

        return (
            (self._vault_credentials or {}).get("user") or self.smtp_user,
            (self._vault_credentials or {}).get("password") or self.smtp_password,
        )

    async def _send_smtp(self, msg: MIMEMultipart, message: EmailMessage) -> None:
        """Send message via SMTP."""
        # Get all recipients
        all_recipients: list[str] = []
        all_recipients.extend(str(email) for email in message.to)
        all_recipients.extend(str(email) for email in message.cc)
        all_recipients.extend(str(email) for email in message.bcc)

        # Get credentials (from Vault or environment)
        smtp_user, smtp_password = self._get_smtp_credentials()

        # Connect and send
        with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
            if self.use_tls:
                server.starttls()

            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)

            server.send_message(msg, to_addrs=all_recipients)

    async def send_bulk_emails(self, messages: list[EmailMessage]) -> list[EmailResponse]:
        """Send multiple emails (simplified bulk processing)."""
        responses = []

        logger.info("Starting bulk email send", count=len(messages))

        for i, message in enumerate(messages):
            try:
                response = await self.send_email(message)
                responses.append(response)

                # Log progress every 10 emails
                if (i + 1) % 10 == 0:
                    logger.info(f"Bulk email progress: {i + 1}/{len(messages)}")

            except (smtplib.SMTPException, OSError, RuntimeError, ValueError) as exc:
                logger.error(
                    "Bulk email failed for message",
                    index=i,
                    error=str(exc),
                    subject=message.subject,
                )
                responses.append(
                    EmailResponse(
                        id=f"bulk_{i}_{uuid4().hex[:4]}",
                        status="failed",
                        message=f"Bulk send failed: {str(exc)}",
                        recipients_count=len(message.to),
                    )
                )

        success_count = sum(1 for r in responses if r.status == "sent")
        logger.info(
            "Bulk email completed",
            total=len(messages),
            success=success_count,
            failed=len(messages) - success_count,
        )

        return responses

    def _get_transport(self) -> EmailTransport:
        if self._transport is None:
            plugin = get_plugin(self._transport_plugin_id)
            if not plugin:
                raise RuntimeError(
                    f"Email transport plugin '{self._transport_plugin_id}' is not registered"
                )
            self._transport = plugin.create_transport(self)
        return self._transport


# Global service instance
_email_service: EmailService | None = None


def get_email_service() -> EmailService:
    """Get or create the global email service."""
    global _email_service
    if _email_service is None:
        # Load from settings in production
        _email_service = EmailService()
    return _email_service


async def send_email(
    to: list[str],
    subject: str,
    text_body: str | None = None,
    html_body: str | None = None,
    from_email: str | None = None,
) -> EmailResponse:
    """Convenience function for sending simple emails."""
    service = get_email_service()

    # EmailStr is a type annotation, not a constructor - just pass strings
    message = EmailMessage(
        to=to,  # Pydantic will validate as EmailStr
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        from_email=from_email,  # Pydantic will validate as EmailStr
    )

    return await service.send_email(message)
