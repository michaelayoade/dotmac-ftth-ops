"""
Integration Tests for Payment DDD Flow.

Tests complete payment lifecycle with mocked dependencies:
- Payment creation and processing
- Payment refunds
- Payment-invoice linking
- Event propagation

NOTE: These are INTEGRATION tests (not true E2E) because they use mocked
database sessions and event bus. True E2E tests should use real database
and real services without mocking.

All imports are done lazily inside test methods to avoid event bus
initialization during pytest collection phase.
"""

import pytest


@pytest.mark.integration
class TestPaymentCreationIntegration:
    """Integration tests for payment creation flow with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_create_payment_integration_flow(self):
        """
        Integration: Create payment → Process → Persist → Publish events

        Flow:
        1. CreatePaymentCommand executed
        2. Payment aggregate created
        3. Payment processed (if capture_immediately=True)
        4. Domain events raised
        5. Integration events published
        6. Payment persisted
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            CreatePaymentCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Create payment command
            command = CreatePaymentCommand(
                tenant_id="tenant-123",
                user_id="user-456",
                customer_id="cust-789",
                amount=15000,  # $150.00
                currency="USD",
                payment_method_id="pm-card-123",
                invoice_id="inv-456",
                capture_immediately=True,
            )

            # Execute command
            payment = await handler.handle_create_payment(command)

            # Verify payment state
            assert payment.customer_id == "cust-789"
            assert payment.amount.amount == 150.00
            assert payment.amount.currency == "USD"
            assert payment.status == "succeeded"  # Captured immediately
            assert payment.invoice_id == "inv-456"

            # Verify persistence
            mock_db_session.add.assert_called()
            mock_db_session.flush.assert_called()
            mock_db_session.commit.assert_called()

            # Verify event published
            mock_event_bus.publish.assert_called_once()
            event_call = mock_event_bus.publish.call_args
            assert event_call[1]["event_type"] == "billing.payment.succeeded"

    @pytest.mark.asyncio
    async def test_create_payment_with_authorization_only(self):
        """
        Integration: Create payment with authorization (no capture)

        Tests two-step payment flow:
        1. Authorize payment (capture_immediately=False)
        2. Payment stays in pending state
        3. Can be captured later
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            CreatePaymentCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            command = CreatePaymentCommand(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=10000,
                currency="USD",
                payment_method_id="pm-card-123",
                capture_immediately=False,  # Authorize only
            )

            payment = await handler.handle_create_payment(command)

            # Payment should be in pending state
            assert payment.status == "pending"
            assert payment.processed_at is None


@pytest.mark.integration
class TestPaymentRefundIntegration:
    """Integration tests for payment refund flow with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_refund_payment_integration_flow(self):
        """
        Integration: Process payment → Refund → Persist → Events

        Flow:
        1. Create and process payment
        2. Issue refund command
        3. Payment aggregate updated
        4. Refund events raised
        5. Database updated
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            RefundPaymentCommand,
        )
        from dotmac.platform.billing.domain import Payment
        from dotmac.platform.core import Money

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Step 1: Create payment
            payment = Payment.create(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=Money(amount=100.00, currency="USD"),
                payment_method="card",
            )
            payment.process(transaction_id="txn-stripe-123")
            payment.id = "pay-123"

            assert payment.status == "succeeded"

            # Reset event bus
            mock_event_bus.reset_mock()

            # Step 2: Refund payment
            with patch.object(handler.payment_repo, "get", return_value=payment):
                with patch.object(handler.payment_repo, "save"):
                    refund_command = RefundPaymentCommand(
                        tenant_id="tenant-123",
                        payment_id="pay-123",
                        amount=5000,  # Partial refund $50
                        reason="Customer requested partial refund",
                    )

                    refunded_payment = await handler.handle_refund_payment(refund_command)

                    # Verify refund state
                    assert refunded_payment.status == "refunded"

                    # Verify refund event published
                    mock_event_bus.publish.assert_called_once()
                    event_call = mock_event_bus.publish.call_args
                    assert event_call[1]["event_type"] == "billing.payment.refunded"

    @pytest.mark.asyncio
    async def test_cannot_refund_pending_payment(self):
        """
        Integration: Business rule - cannot refund pending payment

        Validates:
        1. Payment in pending state
        2. Refund attempt fails
        3. Business rule error raised
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            RefundPaymentCommand,
        )
        from dotmac.platform.billing.domain import Payment
        from dotmac.platform.core import Money
        from dotmac.platform.core.exceptions import BusinessRuleError

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Create pending payment
            payment = Payment.create(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=Money(amount=100.00, currency="USD"),
                payment_method="card",
            )
            assert payment.status == "pending"

            # Attempt refund
            with patch.object(handler.payment_repo, "get", return_value=payment):
                refund_command = RefundPaymentCommand(
                    tenant_id="tenant-123",
                    payment_id="pay-123",
                    reason="Should fail",
                )

                with pytest.raises(BusinessRuleError, match="Can only refund succeeded payments"):
                    await handler.handle_refund_payment(refund_command)


@pytest.mark.integration
class TestPaymentInvoiceLinkingIntegration:
    """Integration tests for payment-invoice integration with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_payment_updates_invoice_integration(self):
        """
        Integration: Payment → Invoice update flow

        In a complete system:
        1. Payment created and linked to invoice
        2. Payment succeeded event published
        3. Event handler applies payment to invoice
        4. Invoice status updated to paid
        5. Invoice paid event published

        This test simulates the command flow.
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            ApplyPaymentToInvoiceCommand,
            CreateInvoiceCommand,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            CreatePaymentCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            invoice_handler = AggregateInvoiceCommandHandler(mock_db_session)
            payment_handler = AggregatePaymentCommandHandler(mock_db_session)

            # Step 1: Create invoice
            create_invoice = CreateInvoiceCommand(
                tenant_id="tenant-123",
                customer_id="cust-789",
                billing_email="customer@example.com",
                billing_address={},
                line_items=[
                    {
                        "description": "Service",
                        "quantity": 1,
                        "unit_price": 100.00,
                        "product_id": "prod-1",
                    }
                ],
                currency="USD",
            )

            invoice = await invoice_handler.handle_create_invoice(create_invoice)
            assert invoice.remaining_balance.amount == 100.00

            # Step 2: Create payment
            create_payment = CreatePaymentCommand(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=10000,
                currency="USD",
                payment_method_id="pm-123",
                invoice_id=invoice.id,
                capture_immediately=True,
            )

            payment = await payment_handler.handle_create_payment(create_payment)
            assert payment.status == "succeeded"

            # Step 3: Apply payment to invoice
            with patch.object(invoice_handler.invoice_repo, "get", return_value=invoice):
                with patch.object(invoice_handler.invoice_repo, "save"):
                    apply_payment = ApplyPaymentToInvoiceCommand(
                        tenant_id="tenant-123",
                        invoice_id=invoice.id,
                        payment_id=payment.id,
                        amount=10000,
                    )

                    mock_event_bus.reset_mock()
                    updated_invoice = await invoice_handler.handle_apply_payment(apply_payment)

                    # Verify invoice updated
                    assert updated_invoice.status == "paid"
                    assert updated_invoice.remaining_balance.amount == 0
                    assert updated_invoice.paid_at is not None

                    # Verify events published
                    assert mock_event_bus.publish.call_count >= 1


@pytest.mark.integration
class TestPaymentEventPropagationIntegration:
    """Integration tests for payment event flows with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_payment_succeeded_event_flow(self):
        """
        Integration: Payment success event triggers side effects

        Complete flow:
        1. Payment created and processed
        2. payment.succeeded event published
        3. Side effects triggered:
           - Email confirmation sent
           - Webhook posted
           - Analytics tracked
           - Invoice updated
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            CreatePaymentCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            command = CreatePaymentCommand(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=10000,
                currency="USD",
                payment_method_id="pm-123",
                invoice_id="inv-456",
                capture_immediately=True,
            )

            payment = await handler.handle_create_payment(command)

            # Verify event published
            mock_event_bus.publish.assert_called_once()
            event_call = mock_event_bus.publish.call_args

            assert event_call[1]["event_type"] == "billing.payment.succeeded"
            assert event_call[1]["metadata"]["tenant_id"] == "tenant-123"

            payload = event_call[1]["payload"]
            assert payload["payment_id"] == payment.id
            assert payload["customer_id"] == "cust-789"
            assert payload["amount"] == 10000
            assert payload["currency"] == "USD"
            assert payload["invoice_id"] == "inv-456"

    @pytest.mark.asyncio
    async def test_payment_refunded_event_flow(self):
        """
        Integration: Payment refund event triggers side effects

        Flow:
        1. Payment refunded
        2. payment.refunded event published
        3. Side effects:
           - Email notification
           - Webhook posted
           - Invoice balance updated
           - Analytics tracked
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregatePaymentCommandHandler,
        )
        from dotmac.platform.billing.commands.payment_commands import (
            RefundPaymentCommand,
        )
        from dotmac.platform.billing.domain import Payment
        from dotmac.platform.core import Money

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregatePaymentCommandHandler(mock_db_session)

            # Create processed payment
            payment = Payment.create(
                tenant_id="tenant-123",
                customer_id="cust-789",
                amount=Money(amount=100.00, currency="USD"),
                payment_method="card",
            )
            payment.process(transaction_id="txn-123")
            payment.id = "pay-123"

            # Refund
            with patch.object(handler.payment_repo, "get", return_value=payment):
                with patch.object(handler.payment_repo, "save"):
                    refund_command = RefundPaymentCommand(
                        tenant_id="tenant-123",
                        payment_id="pay-123",
                        reason="Customer request",
                    )

                    await handler.handle_refund_payment(refund_command)

                    # Verify refund event
                    mock_event_bus.publish.assert_called_once()
                    event_call = mock_event_bus.publish.call_args
                    assert event_call[1]["event_type"] == "billing.payment.refunded"

                    payload = event_call[1]["payload"]
                    assert payload["payment_id"] == "pay-123"
                    assert payload["reason"] == "Customer request"
