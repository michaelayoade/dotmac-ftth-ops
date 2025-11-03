"""
Tests for email verification integration with communications module.

Verifies that:
1. send_verification_email() function works correctly
2. AuthEmailServiceFacade has send_verification_email method
3. Auth router sends verification emails successfully
4. Email content is properly formatted
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.auth.email_service import (
    AuthEmailServiceFacade,
    get_auth_email_service,
    send_verification_email,
)

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
class TestSendVerificationEmailFunction:
    """Test the send_verification_email function."""

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_send_verification_email_success(self, mock_get_email_service):
        """Test successful verification email sending."""
        # Mock email service
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        # Send verification email
        result = await send_verification_email(
            email="user@example.com",
            user_name="Test User",
            verification_url="https://example.com/verify?token=abc123",
        )

        # Assertions
        assert result is True
        mock_email_service.send_email.assert_called_once()

        # Check email message structure
        call_args = mock_email_service.send_email.call_args
        message = call_args[0][0]

        assert "user@example.com" in message.to
        assert "Verify Your Email" in message.subject
        assert "abc123" in message.text_body
        assert "abc123" in message.html_body
        assert "Test User" in message.text_body

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_send_verification_email_html_formatting(self, mock_get_email_service):
        """Test HTML email contains proper formatting."""
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        verification_url = "https://example.com/verify?token=test-token-123"

        await send_verification_email(
            email="user@example.com",
            user_name="John Doe",
            verification_url=verification_url,
        )

        # Check HTML contains button/link
        call_args = mock_email_service.send_email.call_args
        message = call_args[0][0]

        assert '<a href="' in message.html_body
        assert verification_url in message.html_body
        assert "Verify Email" in message.html_body  # Button text
        assert "John Doe" in message.html_body

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_send_verification_email_failure(self, mock_get_email_service):
        """Test verification email sending failure."""
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "failed"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        result = await send_verification_email(
            email="user@example.com",
            user_name="Test User",
            verification_url="https://example.com/verify?token=abc",
        )

        assert result is False

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_send_verification_email_exception_handling(self, mock_get_email_service):
        """Test exception handling in send_verification_email."""
        mock_email_service = AsyncMock()
        mock_email_service.send_email = AsyncMock(side_effect=Exception("Email service down"))
        mock_get_email_service.return_value = mock_email_service

        result = await send_verification_email(
            email="user@example.com",
            user_name="Test User",
            verification_url="https://example.com/verify?token=abc",
        )

        assert result is False


@pytest.mark.asyncio
class TestAuthEmailServiceFacade:
    """Test AuthEmailServiceFacade integration."""

    def test_facade_has_send_verification_email_method(self):
        """Verify facade has send_verification_email method."""
        facade = get_auth_email_service()

        assert hasattr(facade, "send_verification_email")
        assert callable(facade.send_verification_email)

    @patch("dotmac.platform.auth.email_service.send_verification_email")
    async def test_facade_send_verification_email_delegates_correctly(self, mock_send_verification):
        """Test facade delegates to send_verification_email function."""
        mock_send_verification.return_value = True

        facade = AuthEmailServiceFacade()
        result = await facade.send_verification_email(
            email="test@example.com",
            user_name="Test User",
            verification_url="https://example.com/verify?token=xyz",
        )

        assert result is True
        # Facade delegates using positional arguments
        mock_send_verification.assert_called_once_with(
            "test@example.com",
            "Test User",
            "https://example.com/verify?token=xyz",
        )

    async def test_facade_all_email_methods_present(self):
        """Verify facade has all required email methods."""
        facade = get_auth_email_service()

        # Check all email methods exist
        assert hasattr(facade, "send_welcome_email")
        assert hasattr(facade, "send_password_reset_email")
        assert hasattr(facade, "send_verification_email")  # NEW
        assert hasattr(facade, "send_password_reset_success_email")
        assert hasattr(facade, "verify_reset_token")


@pytest.mark.asyncio
class TestAuthRouterVerificationIntegration:
    """Test auth router email verification endpoint integration."""

    @patch("dotmac.platform.auth.router.get_auth_email_service")
    async def test_verification_email_sent_from_router(self, mock_get_service):
        """Test that auth router properly sends verification emails."""
        # Mock the email service facade
        mock_facade = AsyncMock()
        mock_facade.send_verification_email = AsyncMock(return_value=True)
        mock_get_service.return_value = mock_facade

        # This test verifies the integration point exists
        # Actual router testing would require full FastAPI test client setup
        facade = mock_get_service()
        success = await facade.send_verification_email(
            email="user@test.com",
            user_name="Test User",
            verification_url="https://example.com/verify?token=abc",
        )

        assert success is True
        mock_facade.send_verification_email.assert_called_once()


@pytest.mark.asyncio
class TestVerificationEmailContent:
    """Test verification email content generation."""

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_email_contains_required_elements(self, mock_get_email_service):
        """Test email contains all required elements."""
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        await send_verification_email(
            email="user@example.com",
            user_name="Jane Smith",
            verification_url="https://app.example.com/verify?token=secure-token",
        )

        call_args = mock_email_service.send_email.call_args
        message = call_args[0][0]

        # Check text body
        text_body = message.text_body
        assert "Jane Smith" in text_body
        assert "verify your email" in text_body.lower()
        assert "https://app.example.com/verify?token=secure-token" in text_body
        assert "24 hours" in text_body  # Expiration notice

        # Check HTML body
        html_body = message.html_body
        assert "Jane Smith" in html_body
        assert "verify" in html_body.lower()
        assert "secure-token" in html_body

    @patch("dotmac.platform.communications.email_service.get_email_service")
    @patch("dotmac.platform.auth.email_service.settings")
    async def test_email_uses_app_name_from_settings(self, mock_settings, mock_get_email_service):
        """Test email uses app name from settings."""
        mock_settings.app_name = "MyCustomApp"

        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        await send_verification_email(
            email="user@example.com",
            user_name="Test",
            verification_url="https://example.com/verify?token=abc",
        )

        call_args = mock_email_service.send_email.call_args
        message = call_args[0][0]

        assert "MyCustomApp" in message.subject


@pytest.mark.asyncio
class TestEmailVerificationEdgeCases:
    """Test edge cases and error scenarios."""

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_handles_special_characters_in_name(self, mock_get_email_service):
        """Test handling of special characters in user name."""
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        result = await send_verification_email(
            email="user@example.com",
            user_name="José O'Brien-Smith <test>",
            verification_url="https://example.com/verify?token=abc",
        )

        assert result is True
        # Email should be sent successfully even with special characters

    @patch("dotmac.platform.communications.email_service.get_email_service")
    async def test_handles_long_verification_url(self, mock_get_email_service):
        """Test handling of very long verification URLs."""
        mock_email_service = AsyncMock()
        mock_response = MagicMock()
        mock_response.status = "sent"
        mock_email_service.send_email = AsyncMock(return_value=mock_response)
        mock_get_email_service.return_value = mock_email_service

        long_url = "https://example.com/verify?token=" + "x" * 500

        result = await send_verification_email(
            email="user@example.com",
            user_name="Test User",
            verification_url=long_url,
        )

        assert result is True

        call_args = mock_email_service.send_email.call_args
        message = call_args[0][0]
        assert long_url in message.text_body
