"""Tests for communications event listeners."""

from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.billing.events import (
    emit_invoice_created,
    emit_invoice_paid,
    emit_payment_failed,
)
from dotmac.platform.events import get_event_bus, reset_event_bus

# Mark all tests as integration - these test cross-module event handling


pytestmark = pytest.mark.unit


class TestCommunicationsEventListeners:
    """Test communications module event listeners."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown for each test."""
        # Reset event bus and clear cached module before each test
        reset_event_bus()

        # Clear event_listeners from module cache to force fresh registration
        import sys

        if "dotmac.platform.communications.event_listeners" in sys.modules:
            del sys.modules["dotmac.platform.communications.event_listeners"]

        yield

        # Reset again after test
        reset_event_bus()

        # Clear module cache after test too
        if "dotmac.platform.communications.event_listeners" in sys.modules:
            del sys.modules["dotmac.platform.communications.event_listeners"]

    @pytest.mark.asyncio
    async def test_invoice_created_sends_email(self):
        """Test that invoice created event triggers email."""
        # Reset event bus and create new one BEFORE patching
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            # Import event_listeners module to register handlers with the new event bus
            # Module was deleted from sys.modules in fixture, so this is a fresh import
            # This happens INSIDE the patch context so EmailService is mocked
            import dotmac.platform.communications.event_listeners  # noqa: F401

            await emit_invoice_created(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=150.00,
                currency="USD",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.1)

            # Verify email was sent
            mock_email_service.send_email.assert_called_once()
            call_args = mock_email_service.send_email.call_args

            # send_email is called with EmailMessage object as first argument
            email_message = call_args[0][0] if call_args[0] else call_args.kwargs.get("message")

            assert "customer@example.com" in email_message.to
            assert "Invoice" in email_message.subject
            assert "INV-001" in email_message.html_body

    @pytest.mark.asyncio
    async def test_invoice_paid_sends_confirmation(self):
        """Test that invoice paid event sends confirmation email."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            import dotmac.platform.communications.event_listeners  # noqa: F401

            await emit_invoice_paid(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=150.00,
                payment_id="PAY-001",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.1)

            mock_email_service.send_email.assert_called_once()
            call_args = mock_email_service.send_email.call_args

            email_message = call_args[0][0] if call_args[0] else call_args.kwargs.get("message")

            assert "customer@example.com" in email_message.to
            assert "Payment" in email_message.subject
            assert "PAY-001" in email_message.html_body

    @pytest.mark.asyncio
    async def test_payment_failed_sends_notification(self):
        """Test that payment failed event sends notification."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            import dotmac.platform.communications.event_listeners  # noqa: F401

            await emit_payment_failed(
                payment_id="PAY-001",
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=150.00,
                error_message="Card declined",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.1)

            mock_email_service.send_email.assert_called_once()
            call_args = mock_email_service.send_email.call_args

            email_message = call_args[0][0] if call_args[0] else call_args.kwargs.get("message")

            assert "customer@example.com" in email_message.to
            assert "Failed" in email_message.subject
            assert "Card declined" in email_message.html_body

    @pytest.mark.asyncio
    async def test_multiple_event_types(self):
        """Test handling multiple different event types."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            import dotmac.platform.communications.event_listeners  # noqa: F401

            # Emit different events
            await emit_invoice_created(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=100.00,
                currency="USD",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            await emit_invoice_paid(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=100.00,
                payment_id="PAY-001",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.2)

            # Should have called send_email twice
            assert mock_email_service.send_email.call_count == 2

    @pytest.mark.asyncio
    async def test_listener_error_handling(self):
        """Test that listener errors are logged but don't prevent event publishing."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()
        mock_email_service.send_email.side_effect = Exception("SMTP error")

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            import dotmac.platform.communications.event_listeners  # noqa: F401

            # Emit event - handler will raise exception after logging
            # Event bus catches and logs the exception but doesn't re-raise
            # This allows event processing to continue gracefully
            await emit_invoice_created(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=100.00,
                currency="USD",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.1)

            # Email service was called (exception occurred during send)
            # Event bus retries failed handlers, so may be called multiple times
            assert mock_email_service.send_email.called
            # Error was logged (visible in test output) but system continued
            # Event bus handled the exception gracefully without crashing


class TestEventListenerIntegration:
    """Integration tests for event listeners."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup and teardown."""
        reset_event_bus()

        # Clear event_listeners from module cache
        import sys

        if "dotmac.platform.communications.event_listeners" in sys.modules:
            del sys.modules["dotmac.platform.communications.event_listeners"]

        yield

        reset_event_bus()

        if "dotmac.platform.communications.event_listeners" in sys.modules:
            del sys.modules["dotmac.platform.communications.event_listeners"]

    @pytest.mark.asyncio
    async def test_end_to_end_invoice_flow(self):
        """Test complete invoice flow with communications."""
        reset_event_bus()
        event_bus = get_event_bus(redis_client=None, enable_persistence=False)

        mock_email_service = AsyncMock()

        with patch(
            "dotmac.platform.communications.email_service.EmailService"
        ) as mock_email_service_class:
            mock_email_service_class.return_value = mock_email_service

            import dotmac.platform.communications.event_listeners  # noqa: F401

            # 1. Invoice created
            await emit_invoice_created(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=250.00,
                currency="USD",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            import asyncio

            await asyncio.sleep(0.1)

            # 2. Invoice paid
            await emit_invoice_paid(
                invoice_id="INV-001",
                customer_id="CUST-001",
                amount=250.00,
                payment_id="PAY-001",
                customer_email="customer@example.com",
                event_bus=event_bus,
            )

            await asyncio.sleep(0.1)

            # Should have sent 2 emails
            assert mock_email_service.send_email.call_count == 2

            # Verify both emails were for correct recipient
            calls = mock_email_service.send_email.call_args_list
            for call in calls:
                email_message = call[0][0] if call[0] else call.kwargs.get("message")
                assert "customer@example.com" in email_message.to
