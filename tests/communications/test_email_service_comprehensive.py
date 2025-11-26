"""
Comprehensive tests for email service to improve coverage.
"""

import smtplib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.communications.email_service import (
    EmailMessage,
    EmailResponse,
    EmailService,
    get_email_service,
    send_email,
)
from dotmac.platform.settings import settings

pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestEmailServiceSMTP:
    """Test SMTP operations in email service."""

    async def test_send_email_success_with_tls(self):
        """Test successful email send with TLS."""
        service = EmailService(
            smtp_host="smtp.example.com",
            smtp_port=587,
            smtp_user="user@example.com",
            smtp_password="password",
            use_tls=True,
        )

        message = EmailMessage(
            to=["recipient@example.com"], subject="Test Subject", text_body="Test body"
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            response = await service.send_email(message)

            assert response.status == "sent"
            assert response.recipients_count == 1
            mock_server.starttls.assert_called_once()
            mock_server.login.assert_called_once_with("user@example.com", "password")
            mock_server.send_message.assert_called_once()

    async def test_send_email_without_tls(self):
        """Test email send without TLS."""
        service = EmailService(smtp_host="localhost", smtp_port=25, use_tls=False)

        message = EmailMessage(to=["recipient@example.com"], subject="Test", text_body="Body")

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            response = await service.send_email(message)

            assert response.status == "sent"
            mock_server.starttls.assert_not_called()
            mock_server.login.assert_not_called()

    async def test_send_email_smtp_failure(self):
        """Test handling of SMTP failure."""
        service = EmailService()

        message = EmailMessage(to=["recipient@example.com"], subject="Test", text_body="Body")

        with patch("smtplib.SMTP") as mock_smtp:
            mock_smtp.return_value.__enter__.side_effect = smtplib.SMTPException(
                "Connection failed"
            )

            response = await service.send_email(message)

            assert response.status == "failed"
            assert "Connection failed" in response.message

    async def test_send_email_with_cc_and_bcc(self):
        """Test sending email with CC and BCC recipients."""
        service = EmailService()

        message = EmailMessage(
            to=["to@example.com"],
            subject="Test",
            text_body="Body",
            cc=["cc@example.com"],
            bcc=["bcc@example.com"],
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            response = await service.send_email(message)

            assert response.status == "sent"
            assert response.recipients_count == 3
            # Verify all recipients were included
            call_args = mock_server.send_message.call_args
            recipients = call_args[1]["to_addrs"]
            assert len(recipients) == 3


@pytest.mark.integration
class TestEmailServiceMIME:
    """Test MIME message creation."""

    async def test_create_mime_with_text_only(self):
        """Test MIME creation with text body only."""
        service = EmailService(default_from="sender@example.com")
        message = EmailMessage(
            to=["recipient@example.com"], subject="Test", text_body="Plain text body"
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await service.send_email(message)

            # Verify MIME message was created properly
            call_args = mock_server.send_message.call_args
            mime_msg = call_args[0][0]
            assert mime_msg["Subject"] == "Test"
            assert mime_msg["From"] == "sender@example.com"

    async def test_create_mime_with_html_only(self):
        """Test MIME creation with HTML body only."""
        service = EmailService()
        message = EmailMessage(
            to=["recipient@example.com"], subject="HTML Test", html_body="<p>HTML body</p>"
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await service.send_email(message)

            call_args = mock_server.send_message.call_args
            mime_msg = call_args[0][0]
            assert mime_msg["Subject"] == "HTML Test"

    async def test_create_mime_with_custom_from(self):
        """Test MIME creation with custom from address and name."""
        service = EmailService(default_from="default@example.com")
        message = EmailMessage(
            to=["recipient@example.com"],
            subject="Custom From",
            text_body="Body",
            from_email="custom@example.com",
            from_name="Custom Sender",
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await service.send_email(message)

            call_args = mock_server.send_message.call_args
            mime_msg = call_args[0][0]
            assert '"Custom Sender" <custom@example.com>' in mime_msg["From"]

    async def test_create_mime_with_reply_to(self):
        """Test MIME creation with reply-to address."""
        service = EmailService()
        message = EmailMessage(
            to=["recipient@example.com"],
            subject="Reply To Test",
            text_body="Body",
            reply_to="replyto@example.com",
        )

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await service.send_email(message)

            call_args = mock_server.send_message.call_args
            mime_msg = call_args[0][0]
            assert mime_msg["Reply-To"] == "replyto@example.com"

    async def test_create_mime_no_body(self):
        """Test MIME creation with no body (minimal email)."""
        service = EmailService()
        message = EmailMessage(to=["recipient@example.com"], subject="No Body")

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            await service.send_email(message)
            call_args = mock_server.send_message.call_args
            mime_msg = call_args[0][0]
            # Should add empty text part
            assert mime_msg["Subject"] == "No Body"

    # Branding tests removed - feature not implemented
    # test_default_from_falls_back_to_brand_domain
    # test_message_id_uses_brand_notification_domain


@pytest.mark.integration
class TestEmailServiceBulk:
    """Test bulk email operations."""

    async def test_send_bulk_emails_all_success(self):
        """Test bulk sending with all messages succeeding."""
        service = EmailService()

        messages = [
            EmailMessage(to=[f"user{i}@example.com"], subject=f"Test {i}", text_body="Body")
            for i in range(5)
        ]

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            responses = await service.send_bulk_emails(messages)

            assert len(responses) == 5
            assert all(r.status == "sent" for r in responses)

    async def test_send_bulk_emails_with_failures(self):
        """Test bulk sending with some failures."""
        service = EmailService()

        messages = [
            EmailMessage(to=[f"user{i}@example.com"], subject=f"Test {i}", text_body="Body")
            for i in range(3)
        ]

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            # First two succeed, third fails
            mock_smtp.return_value.__enter__.side_effect = [
                mock_server,
                mock_server,
                smtplib.SMTPException("Failed"),
            ]

            responses = await service.send_bulk_emails(messages)

            assert len(responses) == 3
            assert responses[0].status == "sent"
            assert responses[1].status == "sent"
            assert responses[2].status == "failed"

    async def test_send_bulk_emails_progress_logging(self):
        """Test that bulk sending logs progress every 10 emails."""
        service = EmailService()

        messages = [
            EmailMessage(to=[f"user{i}@example.com"], subject=f"Test {i}", text_body="Body")
            for i in range(15)
        ]

        with patch("smtplib.SMTP") as mock_smtp:
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            with patch("dotmac.platform.communications.email_service.logger") as mock_logger:
                responses = await service.send_bulk_emails(messages)

                assert len(responses) == 15
                # Should log at message 10
                info_calls = list(mock_logger.info.call_args_list)
                assert any("Bulk email progress: 10/15" in str(call) for call in info_calls)


@pytest.mark.integration
class TestEmailServiceFactory:
    """Test factory functions."""

    def test_get_email_service_singleton(self):
        """Test that get_email_service returns singleton."""
        service1 = get_email_service()
        service2 = get_email_service()

        assert service1 is service2

    async def test_send_email_convenience_function(self):
        """Test the convenience send_email function."""
        with patch(
            "dotmac.platform.communications.email_service.get_email_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_123", status="sent", message="OK", recipients_count=1
            )
            mock_get_service.return_value = mock_service

            response = await send_email(to=["user@example.com"], subject="Test", text_body="Body")

            assert response.id == "msg_123"
            assert response.status == "sent"
            mock_service.send_email.assert_called_once()

    async def test_send_email_convenience_with_html(self):
        """Test convenience function with HTML body."""
        with patch(
            "dotmac.platform.communications.email_service.get_email_service"
        ) as mock_get_service:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_456", status="sent", message="OK", recipients_count=1
            )
            mock_get_service.return_value = mock_service

            response = await send_email(
                to=["user@example.com"],
                subject="HTML Test",
                text_body="Plain",
                html_body="<p>HTML</p>",
                from_email="custom@example.com",
            )

            assert response.status == "sent"
            # Verify the message had both bodies
            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.text_body == "Plain"
            assert call_args.html_body == "<p>HTML</p>"
            assert call_args.from_email == "custom@example.com"
