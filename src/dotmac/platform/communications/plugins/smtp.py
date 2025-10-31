"""Builtin SMTP email transport plugin."""

from __future__ import annotations

from typing import TYPE_CHECKING

from ..plugins import EmailTransport, EmailTransportPlugin, register_plugin

if TYPE_CHECKING:  # pragma: no cover
    from ..email_service import EmailMessage, EmailService


class SMTPEmailTransport(EmailTransport):
    def __init__(self, service: EmailService) -> None:
        self.service = service

    async def send(
        self,
        service: EmailService,
        message: EmailMessage,
        message_id: str,
    ) -> None:
        mime_message = service._create_mime_message(message, message_id)
        await service._send_smtp(mime_message, message)


class SMTPEmailTransportPlugin(EmailTransportPlugin):
    plugin_id = "communications.smtp"

    def create_transport(self, service: EmailService) -> EmailTransport:
        return SMTPEmailTransport(service)


register_plugin(SMTPEmailTransportPlugin())


__all__ = ["SMTPEmailTransportPlugin"]
