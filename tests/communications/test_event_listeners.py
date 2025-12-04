"""
Tests for communications event listeners.

Tests event handlers that react to domain events and send notifications.
"""

from datetime import UTC, datetime
from smtplib import SMTPException
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.communications.email_service import EmailResponse
from dotmac.platform.communications.event_listeners import (
    _build_exit_survey_url,
    _email_html_message,
    init_communications_event_listeners,
    send_invoice_created_email,
    send_invoice_overdue_reminder,
    send_invoice_paid_email,
    send_payment_failed_notification,
    send_subscription_cancelled_email,
    send_subscription_welcome_email,
    send_trial_ending_reminder,
)
from dotmac.platform.events.models import Event
from dotmac.platform.settings import settings

# ============================================================================
# Helper Function Tests
# ============================================================================


pytestmark = pytest.mark.asyncio


@pytest.mark.integration
class TestEmailHtmlMessage:
    """Test the _email_html_message helper function."""

    def test_creates_email_message_with_html(self):
        """Test creating an email message with HTML content."""
        result = _email_html_message(
            recipient="user@example.com",
            subject="Test Subject",
            html_body="<p>Test HTML</p>",
        )

        assert result.to == ["user@example.com"]
        assert result.subject == "Test Subject"
        assert result.html_body == "<p>Test HTML</p>"

    def test_validates_email_address(self):
        """Test that invalid email addresses are validated by Pydantic."""
        with pytest.raises(ValueError):
            _email_html_message(
                recipient="invalid-email",
                subject="Test",
                html_body="<p>Body</p>",
            )


@pytest.mark.unit
def test_build_exit_survey_url_uses_configured_base():
    """Exit survey URLs should use the configured base domain."""
    original_base = settings.urls.exit_survey_base_url
    try:
        settings.urls.exit_survey_base_url = "https://survey.brand.test/exit"
        url = _build_exit_survey_url("abc123", "cust-42")
        assert url.startswith("https://survey.brand.test/exit")
        assert "token=abc123" in url
        assert "customer=cust-42" in url
    finally:
        settings.urls.exit_survey_base_url = original_base


# ============================================================================
# Invoice Event Handler Tests
# ============================================================================


@pytest.mark.integration
class TestInvoiceCreatedEmailHandler:
    """Test send_invoice_created_email handler."""

    async def test_sends_invoice_created_email_success(self):
        """Test successful invoice created email sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.created",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_123",
                "customer_id": "cust_456",
                "customer_email": "customer@example.com",
                "amount": "100.00",
                "currency": "USD",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_123",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_invoice_created_email(event)

            # Verify email service was called
            mock_service.send_email.assert_called_once()
            call_args = mock_service.send_email.call_args[0][0]

            assert call_args.to == ["customer@example.com"]
            assert "Invoice #inv_123" in call_args.subject
            assert "inv_123" in call_args.html_body
            assert "100.00" in call_args.html_body

    async def test_sends_invoice_created_email_with_default_email(self):
        """Test invoice created email with default customer email."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.created",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_789",
                "customer_id": "cust_999",
                "amount": "250.00",
                # No customer_email provided
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_456",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_invoice_created_email(event)

            # Verify default email was used
            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["customer-cust_999@example.com"]

    async def test_sends_invoice_created_email_smtp_failure(self):
        """Test invoice created email with SMTP failure."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.created",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_fail",
                "customer_id": "cust_fail",
                "customer_email": "fail@example.com",
                "amount": "50.00",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = SMTPException("Connection failed")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(SMTPException):
                await send_invoice_created_email(event)


@pytest.mark.integration
class TestInvoicePaidEmailHandler:
    """Test send_invoice_paid_email handler."""

    async def test_sends_invoice_paid_email_success(self):
        """Test successful invoice paid email sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.paid",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_paid_123",
                "customer_id": "cust_123",
                "customer_email": "paid@example.com",
                "amount": "150.00",
                "payment_id": "pay_789",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_paid",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_invoice_paid_email(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["paid@example.com"]
            assert "Payment Received" in call_args.subject
            assert "pay_789" in call_args.html_body
            assert "150.00" in call_args.html_body

    async def test_sends_invoice_paid_email_runtime_error(self):
        """Test invoice paid email with RuntimeError."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.paid",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_error",
                "customer_id": "cust_error",
                "amount": "100.00",
                "payment_id": "pay_error",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = RuntimeError("Service error")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(RuntimeError):
                await send_invoice_paid_email(event)


@pytest.mark.integration
class TestInvoiceOverdueReminderHandler:
    """Test send_invoice_overdue_reminder handler."""

    async def test_sends_invoice_overdue_reminder_success(self):
        """Test successful invoice overdue reminder sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.overdue",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_overdue_123",
                "customer_id": "cust_overdue",
                "customer_email": "overdue@example.com",
                "amount": "300.00",
                "days_overdue": 7,
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_overdue",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_invoice_overdue_reminder(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["overdue@example.com"]
            assert "Overdue" in call_args.subject
            assert "7" in call_args.html_body
            assert "300.00" in call_args.html_body

    async def test_sends_invoice_overdue_reminder_with_default_days(self):
        """Test overdue reminder with default days_overdue."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.overdue",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_overdue_456",
                "customer_id": "cust_456",
                "customer_email": "overdue2@example.com",
                "amount": "200.00",
                # No days_overdue provided
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_overdue2",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_invoice_overdue_reminder(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert "0" in call_args.html_body  # Default days_overdue

    async def test_sends_invoice_overdue_reminder_os_error(self):
        """Test invoice overdue reminder with OSError."""
        event = Event(
            event_id=str(uuid4()),
            event_type="invoice.overdue",
            timestamp=datetime.now(UTC),
            payload={
                "invoice_id": "inv_os_error",
                "customer_id": "cust_os_error",
                "amount": "100.00",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = OSError("Network error")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(OSError):
                await send_invoice_overdue_reminder(event)


# ============================================================================
# Payment Event Handler Tests
# ============================================================================


@pytest.mark.integration
class TestPaymentFailedNotificationHandler:
    """Test send_payment_failed_notification handler."""

    async def test_sends_payment_failed_notification_success(self):
        """Test successful payment failed notification sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="payment.failed",
            timestamp=datetime.now(UTC),
            payload={
                "payment_id": "pay_failed_123",
                "invoice_id": "inv_failed_123",
                "customer_id": "cust_failed",
                "customer_email": "failed@example.com",
                "error_message": "Insufficient funds",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_failed",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_payment_failed_notification(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["failed@example.com"]
            assert "Payment Failed" in call_args.subject
            assert "Insufficient funds" in call_args.html_body
            assert "inv_failed_123" in call_args.html_body

    async def test_sends_payment_failed_notification_default_error_message(self):
        """Test payment failed notification with default error message."""
        event = Event(
            event_id=str(uuid4()),
            event_type="payment.failed",
            timestamp=datetime.now(UTC),
            payload={
                "payment_id": "pay_failed_456",
                "invoice_id": "inv_failed_456",
                "customer_id": "cust_failed_456",
                "customer_email": "failed2@example.com",
                # No error_message provided
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_failed2",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_payment_failed_notification(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert "Payment processing failed" in call_args.html_body

    async def test_sends_payment_failed_notification_value_error(self):
        """Test payment failed notification with ValueError."""
        event = Event(
            event_id=str(uuid4()),
            event_type="payment.failed",
            timestamp=datetime.now(UTC),
            payload={
                "payment_id": "pay_value_error",
                "invoice_id": "inv_value_error",
                "customer_id": "cust_value_error",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = ValueError("Invalid email")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(ValueError):
                await send_payment_failed_notification(event)


# ============================================================================
# Subscription Event Handler Tests
# ============================================================================


@pytest.mark.integration
class TestSubscriptionWelcomeEmailHandler:
    """Test send_subscription_welcome_email handler."""

    async def test_sends_subscription_welcome_email_success(self):
        """Test successful subscription welcome email sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.created",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_123",
                "customer_id": "cust_123",
                "customer_email": "subscriber@example.com",
                "plan_id": "premium",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_welcome",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_subscription_welcome_email(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["subscriber@example.com"]
            assert "Welcome" in call_args.subject
            assert "sub_123" in call_args.html_body
            assert "premium" in call_args.html_body

    async def test_sends_subscription_welcome_email_smtp_exception(self):
        """Test subscription welcome email with SMTP exception."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.created",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_smtp_error",
                "customer_id": "cust_smtp_error",
                "plan_id": "basic",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = SMTPException("SMTP error")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(SMTPException):
                await send_subscription_welcome_email(event)


@pytest.mark.integration
class TestSubscriptionCancelledEmailHandler:
    """Test send_subscription_cancelled_email handler."""

    async def test_sends_subscription_cancelled_email_with_reason(self):
        """Test subscription cancelled email with cancellation reason."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.cancelled",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_cancelled_123",
                "customer_id": "cust_cancelled",
                "customer_email": "cancelled@example.com",
                "reason": "Too expensive",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_cancelled",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_subscription_cancelled_email(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["cancelled@example.com"]
            assert "Cancelled" in call_args.subject
            assert "Too expensive" in call_args.html_body
            assert "sub_cancelled_123" in call_args.html_body

    async def test_sends_subscription_cancelled_email_without_reason(self):
        """Test subscription cancelled email without reason."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.cancelled",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_cancelled_456",
                "customer_id": "cust_cancelled_456",
                "customer_email": "cancelled2@example.com",
                # No reason provided
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_cancelled2",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_subscription_cancelled_email(event)

            call_args = mock_service.send_email.call_args[0][0]
            # Reason should not appear in HTML when not provided
            assert "Reason:" not in call_args.html_body

    async def test_sends_subscription_cancelled_email_runtime_error(self):
        """Test subscription cancelled email with runtime error."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.cancelled",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_runtime_error",
                "customer_id": "cust_runtime_error",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = RuntimeError("Runtime error")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(RuntimeError):
                await send_subscription_cancelled_email(event)


@pytest.mark.integration
class TestTrialEndingReminderHandler:
    """Test send_trial_ending_reminder handler."""

    async def test_sends_trial_ending_reminder_success(self):
        """Test successful trial ending reminder sending."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.trial_ending",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_trial_123",
                "customer_id": "cust_trial",
                "customer_email": "trial@example.com",
                "days_remaining": 3,
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_trial",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_trial_ending_reminder(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert call_args.to == ["trial@example.com"]
            assert "3 Days" in call_args.subject
            assert "3 days" in call_args.html_body
            assert "sub_trial_123" in call_args.html_body

    async def test_sends_trial_ending_reminder_default_days(self):
        """Test trial ending reminder with default days_remaining."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.trial_ending",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_trial_456",
                "customer_id": "cust_trial_456",
                "customer_email": "trial2@example.com",
                # No days_remaining provided
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.return_value = EmailResponse(
                id="msg_trial2",
                status="sent",
                message="OK",
                recipients_count=1,
            )
            mock_email_service_class.return_value = mock_service

            await send_trial_ending_reminder(event)

            call_args = mock_service.send_email.call_args[0][0]
            assert "0 Days" in call_args.subject

    async def test_sends_trial_ending_reminder_os_error(self):
        """Test trial ending reminder with OS error."""
        event = Event(
            event_id=str(uuid4()),
            event_type="subscription.trial_ending",
            timestamp=datetime.now(UTC),
            payload={
                "subscription_id": "sub_os_error",
                "customer_id": "cust_os_error",
            },
        )

        with patch(
            "dotmac.platform.communications.event_listeners.EmailService"
        ) as mock_email_service_class:
            mock_service = AsyncMock()
            mock_service.send_email.side_effect = OSError("OS error")
            mock_email_service_class.return_value = mock_service

            with pytest.raises(OSError):
                await send_trial_ending_reminder(event)


# ============================================================================
# Initialization Tests
# ============================================================================


@pytest.mark.integration
class TestInitCommunicationsEventListeners:
    """Test init_communications_event_listeners function."""

    def test_initialization_logs_handlers(self):
        """Test that initialization logs all handler names."""
        with patch("dotmac.platform.communications.event_listeners.logger") as mock_logger:
            init_communications_event_listeners()

            # Verify logger.info was called
            mock_logger.info.assert_called_once()
            call_args = mock_logger.info.call_args

            # Verify message
            assert "Communications event listeners initialized" in call_args[0]

            # Verify handler list
            handlers = call_args[1]["handlers"]
            assert "send_invoice_created_email" in handlers
            assert "send_invoice_paid_email" in handlers
            assert "send_invoice_overdue_reminder" in handlers
            assert "send_payment_failed_notification" in handlers
            assert "send_subscription_welcome_email" in handlers
            assert "send_subscription_cancelled_email" in handlers
            assert "send_trial_ending_reminder" in handlers
