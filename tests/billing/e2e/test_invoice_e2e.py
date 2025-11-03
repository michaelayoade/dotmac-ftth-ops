"""
Integration Tests for Invoice DDD Flow.

Tests the complete flow with mocked dependencies:
1. Command → Aggregate Handler
2. Aggregate → Business Rules
3. Domain Events → Event Handlers
4. Repository → Database Persistence
5. Query Handler → Read Models

NOTE: These are INTEGRATION tests (not true E2E) because they use mocked
database sessions and event bus. True E2E tests should use real database
and real services without mocking.

All imports are done lazily inside test methods to avoid event bus
initialization during pytest collection phase.
"""

from datetime import UTC, datetime, timedelta

import pytest


@pytest.mark.integration
class TestInvoiceIntegrationFlow:
    """Integration tests for complete invoice lifecycle with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_create_invoice_integration_flow(self):
        """
        Integration: Create invoice → Persist → Query back

        Flow:
        1. CreateInvoiceCommand executed
        2. Invoice aggregate created with business rules
        3. Domain events raised
        4. Integration events published
        5. Invoice persisted to database
        6. Query handler retrieves invoice
        """
        # Lazy imports to avoid event bus initialization during collection
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            CreateInvoiceCommand,
        )

        # Mock dependencies
        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            # Step 1: Execute command
            command_handler = AggregateInvoiceCommandHandler(mock_db_session)

            command = CreateInvoiceCommand(
                tenant_id="tenant-123",
                user_id="user-456",
                customer_id="cust-789",
                billing_email="customer@example.com",
                billing_address={"name": "Acme Corp", "street": "123 Main St"},
                line_items=[
                    {
                        "description": "Professional Services",
                        "quantity": 10,
                        "unit_price": 150.00,
                        "product_id": "prod-services",
                    },
                    {
                        "description": "Consulting Hours",
                        "quantity": 5,
                        "unit_price": 200.00,
                        "product_id": "prod-consulting",
                    },
                ],
                currency="USD",
                due_days=30,
            )

            # Step 2: Create invoice through aggregate
            invoice = await command_handler.handle_create_invoice(command)

            # Step 3: Verify aggregate state
            assert invoice.customer_id == "cust-789"
            assert invoice.billing_email == "customer@example.com"
            assert invoice.total_amount.amount == 2500.00  # (10*150) + (5*200)
            assert invoice.total_amount.currency == "USD"
            assert invoice.status == "draft"
            assert len(invoice.line_items_data) == 2  # Aggregate stores as line_items_data

            # Step 4: Verify database persistence called
            mock_db_session.add.assert_called()
            mock_db_session.flush.assert_called()
            mock_db_session.commit.assert_called()

            # Step 5: Verify integration event published
            mock_event_bus.publish.assert_called_once()
            event_call = mock_event_bus.publish.call_args
            assert event_call[1]["event_type"] == "billing.invoice.created"
            assert event_call[1]["payload"]["customer_id"] == "cust-789"
            assert event_call[1]["payload"]["total_amount"] == 250000  # cents

            # Step 6: Query back (simulated)
            # In a real E2E test, this would query the actual database
            # For now, we verify the flow completes successfully
            assert invoice.id is not None

    @pytest.mark.asyncio
    async def test_invoice_payment_integration_flow(self):
        """
        Integration: Apply payment → Update aggregate → Persist → Query

        Flow:
        1. Create invoice
        2. Apply payment command
        3. Invoice aggregate updated
        4. Payment applied event raised
        5. Invoice status changed to paid
        6. Events published
        7. Database updated
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            ApplyPaymentToInvoiceCommand,
            CreateInvoiceCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Step 1: Create invoice
            create_command = CreateInvoiceCommand(
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

            invoice = await handler.handle_create_invoice(create_command)
            initial_invoice_id = invoice.id

            # Reset mocks
            mock_event_bus.reset_mock()

            # Step 2: Apply payment
            with patch.object(handler.invoice_repo, "get", return_value=invoice):
                with patch.object(handler.invoice_repo, "save"):
                    payment_command = ApplyPaymentToInvoiceCommand(
                        tenant_id="tenant-123",
                        invoice_id=initial_invoice_id,
                        payment_id="pay-123",
                        amount=10000,  # $100.00 in cents
                    )

                    # Step 3: Execute payment
                    updated_invoice = await handler.handle_apply_payment(payment_command)

                    # Step 4: Verify state changes
                    assert updated_invoice.status == "paid"
                    assert updated_invoice.paid_at is not None
                    assert updated_invoice.payment_status == "paid"
                    assert updated_invoice.remaining_balance.amount == 0

                    # Step 5: Verify events published
                    # Should publish both payment_applied and invoice_paid events
                    assert mock_event_bus.publish.call_count == 2

                    event_types = [
                        call[1]["event_type"] for call in mock_event_bus.publish.call_args_list
                    ]
                    assert "billing.invoice.payment_applied" in event_types
                    assert "billing.invoice.paid" in event_types

    @pytest.mark.asyncio
    async def test_invoice_void_integration_flow(self):
        """
        Integration: Void invoice → Business rule validation → Persist

        Flow:
        1. Create invoice
        2. Attempt to void
        3. Business rules enforced (cannot void paid invoice)
        4. Void succeeds for draft invoice
        5. Events published
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            CreateInvoiceCommand,
            VoidInvoiceCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create invoice
            create_command = CreateInvoiceCommand(
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

            invoice = await handler.handle_create_invoice(create_command)
            mock_event_bus.reset_mock()

            # Void invoice
            with patch.object(handler.invoice_repo, "get", return_value=invoice):
                with patch.object(handler.invoice_repo, "save"):
                    void_command = VoidInvoiceCommand(
                        tenant_id="tenant-123",
                        invoice_id=invoice.id,
                        void_reason="Customer requested cancellation",
                    )

                    voided_invoice = await handler.handle_void_invoice(void_command)

                    # Verify state
                    assert voided_invoice.status == "void"
                    assert voided_invoice.voided_at is not None

                    # Verify event
                    mock_event_bus.publish.assert_called_once()
                    event_call = mock_event_bus.publish.call_args
                    assert event_call[1]["event_type"] == "billing.invoice.voided"


@pytest.mark.integration
class TestInvoiceQueryIntegration:
    """Integration tests for invoice query flows with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_query_invoice_after_creation(self):
        """
        Integration: Create → Query single invoice

        Simulates:
        1. Invoice created and persisted
        2. Query handler retrieves from database
        3. Returns proper read model
        """
        # Lazy imports
        from unittest.mock import AsyncMock, MagicMock

        from dotmac.platform.billing.queries.handlers import InvoiceQueryHandler
        from dotmac.platform.billing.queries.invoice_queries import GetInvoiceQuery

        mock_db_session = AsyncMock()
        query_handler = InvoiceQueryHandler(mock_db_session)

        # Simulate persisted invoice entity
        mock_invoice = MagicMock()
        mock_invoice.invoice_id = "inv-123"
        mock_invoice.invoice_number = "INV-2025-001"
        mock_invoice.tenant_id = "tenant-123"
        mock_invoice.customer_id = "cust-789"
        mock_invoice.billing_email = "customer@example.com"
        mock_invoice.billing_address = {"name": "Acme Corp"}
        mock_invoice.line_items = []
        mock_invoice.subtotal = 100000
        mock_invoice.tax_amount = 0
        mock_invoice.discount_amount = 0
        mock_invoice.total_amount = 100000
        mock_invoice.remaining_balance = 100000
        mock_invoice.currency = "USD"
        mock_invoice.status = "draft"
        mock_invoice.created_at = datetime.now(UTC)
        mock_invoice.updated_at = datetime.now(UTC)
        mock_invoice.issue_date = datetime.now(UTC)
        mock_invoice.due_date = datetime.now(UTC) + timedelta(days=30)
        mock_invoice.finalized_at = None
        mock_invoice.paid_at = None
        mock_invoice.voided_at = None
        mock_invoice.notes = None
        mock_invoice.internal_notes = None
        mock_invoice.subscription_id = None
        mock_invoice.idempotency_key = None
        mock_invoice.created_by = "user-456"
        mock_invoice.extra_data = {}

        # Mock database query
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_invoice
        mock_db_session.execute.return_value = mock_result

        # Execute query
        query = GetInvoiceQuery(
            tenant_id="tenant-123",
            invoice_id="inv-123",
            include_line_items=True,
        )

        invoice_detail = await query_handler.handle_get_invoice(query)

        # Verify read model
        assert invoice_detail is not None
        assert invoice_detail.invoice_id == "inv-123"
        assert invoice_detail.customer_id == "cust-789"
        assert invoice_detail.total_amount == 100000
        assert invoice_detail.status == "draft"

    @pytest.mark.asyncio
    async def test_list_invoices_with_pagination(self):
        """
        Integration: List invoices with filters and pagination

        Tests:
        1. Database query with filters
        2. Pagination logic
        3. Read model transformation
        """
        # Lazy imports
        from unittest.mock import AsyncMock, MagicMock

        from dotmac.platform.billing.queries.handlers import InvoiceQueryHandler
        from dotmac.platform.billing.queries.invoice_queries import ListInvoicesQuery

        mock_db_session = AsyncMock()
        query_handler = InvoiceQueryHandler(mock_db_session)

        # Mock count
        mock_db_session.scalar.return_value = 25

        # Mock results
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db_session.execute.return_value = mock_result

        # Execute query
        query = ListInvoicesQuery(
            tenant_id="tenant-123",
            customer_id="cust-789",
            status="open",
            page=1,
            page_size=10,
        )

        result = await query_handler.handle_list_invoices(query)

        # Verify pagination metadata
        assert result["total"] == 25
        assert result["page"] == 1
        assert result["page_size"] == 10
        assert result["total_pages"] == 3
        assert "items" in result


@pytest.mark.integration
class TestInvoiceBusinessRulesIntegration:
    """Integration tests validating business rules are enforced throughout the flow."""

    @pytest.mark.asyncio
    async def test_cannot_void_paid_invoice_integration(self):
        """
        Integration: Business rule enforcement across layers

        Validates:
        1. Create invoice
        2. Mark as paid
        3. Attempt to void (should fail)
        4. Business rule exception propagates correctly
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            CreateInvoiceCommand,
            VoidInvoiceCommand,
        )
        from dotmac.platform.core import Money
        from dotmac.platform.core.exceptions import BusinessRuleError

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create and pay invoice
            create_command = CreateInvoiceCommand(
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

            invoice = await handler.handle_create_invoice(create_command)

            # Mark as paid
            invoice.apply_payment("pay-123", Money(amount=100.00, currency="USD"))
            assert invoice.status == "paid"

            # Attempt to void paid invoice
            with patch.object(handler.invoice_repo, "get", return_value=invoice):
                void_command = VoidInvoiceCommand(
                    tenant_id="tenant-123",
                    invoice_id=invoice.id,
                    void_reason="This should fail because invoice is paid",
                )

                # Should raise business rule error
                with pytest.raises(BusinessRuleError, match="Cannot void paid invoice"):
                    await handler.handle_void_invoice(void_command)

    @pytest.mark.asyncio
    async def test_payment_currency_must_match_integration(self):
        """
        Integration: Currency validation across the flow

        Validates:
        1. Invoice created in USD
        2. Attempt payment in EUR (should fail)
        3. Business rule enforced at aggregate level
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            CreateInvoiceCommand,
        )
        from dotmac.platform.core import Money
        from dotmac.platform.core.exceptions import BusinessRuleError

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            # Create USD invoice
            create_command = CreateInvoiceCommand(
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

            invoice = await handler.handle_create_invoice(create_command)

            # Attempt EUR payment (should fail)
            with pytest.raises(
                BusinessRuleError, match="Payment currency .* does not match invoice currency"
            ):
                invoice.apply_payment("pay-123", Money(amount=100.00, currency="EUR"))


@pytest.mark.integration
class TestInvoiceEventFlowIntegration:
    """Integration tests for event propagation through the system with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_invoice_created_event_triggers_side_effects(self):
        """
        Integration: Event propagation and side effects

        Flow:
        1. Invoice created
        2. Domain event raised
        3. Integration event published
        4. Side effects triggered (notifications, webhooks, analytics)
        """
        # Lazy imports
        from unittest.mock import AsyncMock, patch

        from dotmac.platform.billing.commands.aggregate_handlers import (
            AggregateInvoiceCommandHandler,
        )
        from dotmac.platform.billing.commands.invoice_commands import (
            CreateInvoiceCommand,
        )

        mock_db_session = AsyncMock()
        mock_event_bus = AsyncMock()

        with patch(
            "dotmac.platform.billing.commands.aggregate_handlers.get_event_bus"
        ) as mock_get_bus:
            mock_get_bus.return_value = mock_event_bus

            handler = AggregateInvoiceCommandHandler(mock_db_session)

            command = CreateInvoiceCommand(
                tenant_id="tenant-123",
                customer_id="cust-789",
                billing_email="customer@example.com",
                billing_address={"name": "Acme Corp"},
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

            invoice = await handler.handle_create_invoice(command)

            # Verify integration event published
            mock_event_bus.publish.assert_called_once()
            event_call = mock_event_bus.publish.call_args

            # Verify event structure
            assert event_call[1]["event_type"] == "billing.invoice.created"
            assert event_call[1]["metadata"]["tenant_id"] == "tenant-123"

            payload = event_call[1]["payload"]
            assert payload["invoice_id"] == invoice.id
            assert payload["customer_id"] == "cust-789"
            assert payload["total_amount"] == 10000  # cents
            assert payload["currency"] == "USD"
            assert "issue_date" in payload
            assert "due_date" in payload

            # In a real system, this event would trigger:
            # - Email notification to customer
            # - Webhook to external systems
            # - Analytics tracking
            # - Audit log entry
