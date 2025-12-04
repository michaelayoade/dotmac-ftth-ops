"""
Comprehensive tests for Invoice Service to achieve 90%+ coverage.

Focuses on:
- Invoice notification sending
- Invoice number generation
- Payment status updates
- Overdue invoice checking
- All edge cases and error paths
"""

import hashlib
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import InvoiceEntity, TransactionEntity
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.core.exceptions import (
    InvoiceNotFoundError,
)
from dotmac.platform.billing.invoicing.service import InvoiceService


@pytest.fixture
def mock_db():
    """Mock database session."""
    db = AsyncMock(spec=AsyncSession)
    db.commit = AsyncMock()
    db.refresh = AsyncMock()
    db.add = MagicMock()
    db.execute = AsyncMock()

    # Mock bind and dialect for database-specific code
    mock_dialect = MagicMock()
    mock_dialect.name = "postgresql"
    mock_bind = MagicMock()
    mock_bind.dialect = mock_dialect
    db.bind = mock_bind

    return db


@pytest.fixture
def invoice_service(mock_db):
    """Create invoice service with mocked dependencies."""
    with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
        return InvoiceService(db_session=mock_db)


def _build_invoice_number(tenant_id: str, year: int, sequence: int) -> str:
    """Mirror invoice number generation logic used by the service."""
    # Must match service.py which uses sha256
    tenant_suffix = hashlib.sha256(tenant_id.encode()).hexdigest()[:4].upper()
    return f"INV-{tenant_suffix}-{year}-{sequence:06d}"


@pytest.fixture
def sample_invoice_entity():
    """Create sample invoice entity."""
    tenant_id = "tenant-1"
    year = datetime.now(UTC).year
    return InvoiceEntity(
        invoice_id="inv_123",
        tenant_id=tenant_id,
        invoice_number=_build_invoice_number(tenant_id, year, 1),
        customer_id="cust_123",
        billing_email="customer@example.com",
        billing_address={"street": "123 Main St", "city": "Boston"},
        issue_date=datetime.now(UTC),
        due_date=datetime.now(UTC) + timedelta(days=30),
        currency="USD",
        subtotal=100,
        tax_amount=0,
        discount_amount=0,
        total_amount=100,
        remaining_balance=100,
        total_credits_applied=0,
        credit_applications=[],
        status=InvoiceStatus.OPEN,
        payment_status=PaymentStatus.PENDING,
        line_items=[],
        notes="Test invoice",
        internal_notes="Internal test notes",
    )


@pytest.mark.unit
class TestInvoiceNumberGeneration:
    """Test invoice number generation logic."""

    async def test_generate_first_invoice_number(self, invoice_service, mock_db):
        """Test generating first invoice number for a tenant."""
        # Mock no existing invoices
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        tenant_id = "tenant-1"
        invoice_number = await invoice_service._generate_invoice_number(tenant_id)

        year = datetime.now(UTC).year
        assert invoice_number == _build_invoice_number(tenant_id, year, 1)

    async def test_generate_sequential_invoice_number(self, invoice_service, mock_db):
        """Test generating sequential invoice number."""
        year = datetime.now(UTC).year
        # Mock existing invoice
        tenant_id = "tenant-1"
        last_invoice = MagicMock()
        last_invoice.invoice_number = _build_invoice_number(tenant_id, year, 5)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = last_invoice
        mock_db.execute.return_value = mock_result

        invoice_number = await invoice_service._generate_invoice_number(tenant_id)

        assert invoice_number == _build_invoice_number(tenant_id, year, 6)

    async def test_generate_invoice_number_new_year(self, invoice_service, mock_db):
        """Test invoice number resets for new year."""
        current_year = datetime.now(UTC).year
        tenant_id = "tenant-1"
        # Mock existing invoice from previous year
        last_invoice = MagicMock()
        last_invoice.invoice_number = _build_invoice_number(tenant_id, current_year - 1, 999)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None  # No invoices for current year
        mock_db.execute.return_value = mock_result

        invoice_number = await invoice_service._generate_invoice_number(tenant_id)

        assert invoice_number == _build_invoice_number(tenant_id, current_year, 1)


@pytest.mark.unit
class TestPaymentStatusUpdate:
    """Test invoice payment status updates."""

    async def test_update_payment_status_to_succeeded(self, invoice_service, sample_invoice_entity):
        """Test updating payment status to succeeded."""
        with patch.object(
            invoice_service, "_get_invoice_entity", return_value=sample_invoice_entity
        ):
            await invoice_service.update_invoice_payment_status(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                payment_status=PaymentStatus.SUCCEEDED,
            )

            assert sample_invoice_entity.payment_status == PaymentStatus.SUCCEEDED
            assert sample_invoice_entity.status == InvoiceStatus.PAID
            assert sample_invoice_entity.paid_at is not None
            assert sample_invoice_entity.remaining_balance == 0

    async def test_update_payment_status_to_pending_partial(
        self, invoice_service, sample_invoice_entity
    ):
        """Test updating payment status to pending for partial payments."""
        with patch.object(
            invoice_service, "_get_invoice_entity", return_value=sample_invoice_entity
        ):
            sample_invoice_entity.status = InvoiceStatus.OPEN
            sample_invoice_entity.remaining_balance = sample_invoice_entity.total_amount - 10
            await invoice_service.update_invoice_payment_status(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                payment_status=PaymentStatus.PENDING,
            )

            assert sample_invoice_entity.payment_status == PaymentStatus.PENDING
            assert sample_invoice_entity.status == InvoiceStatus.PARTIALLY_PAID

    async def test_update_payment_status_not_found(self, invoice_service):
        """Test updating payment status for non-existent invoice."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=None):
            with pytest.raises(InvoiceNotFoundError):
                await invoice_service.update_invoice_payment_status(
                    tenant_id="tenant-1",
                    invoice_id="inv_invalid",
                    payment_status=PaymentStatus.SUCCEEDED,
                )


@pytest.mark.unit
class TestOverdueInvoiceCheck:
    """Test overdue invoice checking and status updates."""

    async def test_check_overdue_invoices_finds_overdue(self, invoice_service, mock_db):
        """Test checking and updating overdue invoices."""
        # Create overdue invoice
        overdue_invoice = InvoiceEntity(
            invoice_id="inv_overdue",
            tenant_id="tenant-1",
            invoice_number="INV-2024-001",
            customer_id="cust_123",
            billing_email="customer@example.com",
            billing_address={},
            issue_date=datetime.now(UTC) - timedelta(days=60),
            due_date=datetime.now(UTC) - timedelta(days=30),  # 30 days past due
            currency="USD",
            subtotal=100,
            tax_amount=0,
            discount_amount=0,
            total_amount=100,
            remaining_balance=100,
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
            line_items=[],
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [overdue_invoice]
        mock_db.execute.return_value = mock_result

        invoices = await invoice_service.check_overdue_invoices("tenant-1")

        # Should update status to OVERDUE
        assert overdue_invoice.status == InvoiceStatus.OVERDUE
        assert len(invoices) == 1
        assert invoices[0].status == InvoiceStatus.OVERDUE

    async def test_check_overdue_invoices_no_overdue(self, invoice_service, mock_db):
        """Test checking when no overdue invoices exist."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        invoices = await invoice_service.check_overdue_invoices("tenant-1")

        assert len(invoices) == 0


@pytest.mark.unit
class TestInvoiceNotification:
    """Test invoice notification sending."""

    async def test_send_invoice_notification_success(self, invoice_service, sample_invoice_entity):
        """Test successful invoice notification sending."""
        # Mock billing settings
        with patch(
            "dotmac.platform.billing.settings.service.BillingSettingsService"
        ) as mock_settings_service:
            mock_settings = MagicMock()
            mock_settings.invoice_settings.send_invoice_emails = True
            mock_settings.notification_settings.send_invoice_notifications = True

            # Mock company_info for email sender details
            mock_company_info = MagicMock()
            mock_company_info.email = "billing@company.com"
            mock_company_info.name = "Test Company"
            mock_settings.company_info = mock_company_info

            mock_settings_service.return_value.get_settings = AsyncMock(return_value=mock_settings)

            # Mock email service at the import location used by invoice service
            with patch(
                "dotmac.platform.billing.invoicing.service.EmailService"
            ) as mock_email_service:
                mock_email_instance = MagicMock()
                mock_email_instance.send_email = AsyncMock()
                mock_email_instance.default_from = "noreply@dotmac.com"
                mock_email_service.return_value = mock_email_instance

                # Mock audit log_system_activity (not log_api_activity)
                with patch("dotmac.platform.audit.log_system_activity", new_callable=AsyncMock):
                    # Also mock ActivityType import
                    with patch("dotmac.platform.audit.ActivityType"):
                        await invoice_service._send_invoice_notification(sample_invoice_entity)

                        # Verify email was sent
                        mock_email_instance.send_email.assert_called_once()

                    # Verify email contains invoice details
                    call_args = mock_email_instance.send_email.call_args[0][0]
                    assert sample_invoice_entity.billing_email in call_args.to
                    assert sample_invoice_entity.invoice_number in call_args.subject

    async def test_send_invoice_notification_disabled_invoice_emails(
        self, invoice_service, sample_invoice_entity
    ):
        """Test notification skipped when invoice emails disabled."""
        with patch(
            "dotmac.platform.billing.settings.service.BillingSettingsService"
        ) as mock_settings_service:
            mock_settings = MagicMock()
            mock_settings.invoice_settings.send_invoice_emails = False
            mock_settings.notification_settings.send_invoice_notifications = True

            mock_settings_service.return_value.get_settings = AsyncMock(return_value=mock_settings)

            with patch(
                "dotmac.platform.communications.email_service.EmailService"
            ) as mock_email_service:
                await invoice_service._send_invoice_notification(sample_invoice_entity)

                # Email should not be sent
                mock_email_service.return_value.send_email.assert_not_called()

    async def test_send_invoice_notification_disabled_notifications(
        self, invoice_service, sample_invoice_entity
    ):
        """Test notification skipped when notifications disabled."""
        with patch(
            "dotmac.platform.billing.settings.service.BillingSettingsService"
        ) as mock_settings_service:
            mock_settings = MagicMock()
            mock_settings.invoice_settings.send_invoice_emails = True
            mock_settings.notification_settings.send_invoice_notifications = False

            mock_settings_service.return_value.get_settings = AsyncMock(return_value=mock_settings)

            with patch(
                "dotmac.platform.communications.email_service.EmailService"
            ) as mock_email_service:
                await invoice_service._send_invoice_notification(sample_invoice_entity)

                # Email should not be sent
                mock_email_service.return_value.send_email.assert_not_called()

    async def test_send_invoice_notification_with_notes(self, invoice_service):
        """Test notification includes invoice notes."""
        invoice_with_notes = InvoiceEntity(
            invoice_id="inv_123",
            tenant_id="tenant-1",
            invoice_number="INV-2025-001",
            customer_id="cust_123",
            billing_email="customer@example.com",
            billing_address={},
            issue_date=datetime.now(UTC),
            due_date=datetime.now(UTC) + timedelta(days=30),
            currency="USD",
            subtotal=100,
            tax_amount=0,
            discount_amount=0,
            total_amount=100,
            remaining_balance=100,
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
            line_items=[],
            notes="Payment due within 15 days",
        )

        with patch(
            "dotmac.platform.billing.settings.service.BillingSettingsService"
        ) as mock_settings_service:
            mock_settings = MagicMock()
            mock_settings.invoice_settings.send_invoice_emails = True
            mock_settings.notification_settings.send_invoice_notifications = True

            # Mock company_info for email sender details
            mock_company_info = MagicMock()
            mock_company_info.email = "billing@company.com"
            mock_company_info.name = "Test Company"
            mock_settings.company_info = mock_company_info

            mock_settings_service.return_value.get_settings = AsyncMock(return_value=mock_settings)

            # Mock email service at the import location used by invoice service
            with patch(
                "dotmac.platform.billing.invoicing.service.EmailService"
            ) as mock_email_service:
                mock_email_instance = MagicMock()
                mock_email_instance.send_email = AsyncMock()
                mock_email_instance.default_from = "noreply@dotmac.com"
                mock_email_service.return_value = mock_email_instance

                # Mock audit log_system_activity
                with patch("dotmac.platform.audit.log_system_activity", new_callable=AsyncMock):
                    with patch("dotmac.platform.audit.ActivityType"):
                        await invoice_service._send_invoice_notification(invoice_with_notes)

                        # Verify notes are in email
                        call_args = mock_email_instance.send_email.call_args[0][0]
                        assert "Payment due within 15 days" in call_args.html_body

    async def test_send_invoice_notification_error_handled(
        self, invoice_service, sample_invoice_entity
    ):
        """Test notification error is caught and logged."""
        with patch(
            "dotmac.platform.billing.settings.service.BillingSettingsService"
        ) as mock_settings_service:
            mock_settings = MagicMock()
            mock_settings.invoice_settings.send_invoice_emails = True
            mock_settings.notification_settings.send_invoice_notifications = True
            mock_settings_service.return_value.get_settings = AsyncMock(return_value=mock_settings)

            with patch(
                "dotmac.platform.communications.email_service.EmailService"
            ) as mock_email_service:
                # Mock email service failure
                mock_email_service.return_value.send_email = AsyncMock(
                    side_effect=Exception("Email server error")
                )

                # Should not raise exception
                await invoice_service._send_invoice_notification(sample_invoice_entity)


@pytest.mark.unit
class TestTransactionCreation:
    """Test transaction record creation."""

    async def test_create_invoice_transaction(
        self, invoice_service, sample_invoice_entity, mock_db
    ):
        """Test creating transaction for invoice."""
        await invoice_service._create_invoice_transaction(sample_invoice_entity)

        # Verify transaction was added
        assert mock_db.add.called
        transaction = mock_db.add.call_args[0][0]
        assert isinstance(transaction, TransactionEntity)
        assert transaction.amount == sample_invoice_entity.total_amount
        assert transaction.transaction_type.value == "charge"
        assert transaction.invoice_id == sample_invoice_entity.invoice_id

    async def test_create_void_transaction(self, invoice_service, sample_invoice_entity, mock_db):
        """Test creating void transaction for invoice."""
        await invoice_service._create_void_transaction(sample_invoice_entity)

        # Verify void transaction was added
        assert mock_db.add.called
        transaction = mock_db.add.call_args[0][0]
        assert isinstance(transaction, TransactionEntity)
        assert transaction.amount == -sample_invoice_entity.total_amount  # Negative amount
        assert transaction.transaction_type.value == "adjustment"


@pytest.mark.unit
class TestGetInvoiceMethods:
    """Test invoice retrieval methods."""

    async def test_get_invoice_with_line_items(
        self, invoice_service, sample_invoice_entity, mock_db
    ):
        """Test getting invoice with line items loaded."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_invoice_entity
        mock_db.execute.return_value = mock_result

        invoice = await invoice_service.get_invoice(
            tenant_id="tenant-1",
            invoice_id="inv_123",
            include_line_items=True,
        )

        assert invoice is not None
        assert invoice.invoice_id == "inv_123"

    async def test_get_invoice_without_line_items(
        self, invoice_service, sample_invoice_entity, mock_db
    ):
        """Test getting invoice without line items."""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_invoice_entity
        mock_db.execute.return_value = mock_result

        invoice = await invoice_service.get_invoice(
            tenant_id="tenant-1",
            invoice_id="inv_123",
            include_line_items=False,
        )

        assert invoice is not None

    async def test_get_invoice_by_idempotency_key(
        self, invoice_service, sample_invoice_entity, mock_db
    ):
        """Test getting invoice by idempotency key."""
        sample_invoice_entity.idempotency_key = "idem_123"

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_invoice_entity
        mock_db.execute.return_value = mock_result

        invoice = await invoice_service._get_invoice_by_idempotency_key(
            tenant_id="tenant-1",
            idempotency_key="idem_123",
        )

        assert invoice is not None
        assert invoice.idempotency_key == "idem_123"


@pytest.mark.unit
class TestListInvoicesFiltering:
    """Test invoice listing with various filters."""

    async def test_list_invoices_with_date_range(self, invoice_service, mock_db):
        """Test listing invoices with date range filter."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        start_date = datetime.now(UTC) - timedelta(days=30)
        end_date = datetime.now(UTC)

        invoices = await invoice_service.list_invoices(
            tenant_id="tenant-1",
            start_date=start_date,
            end_date=end_date,
        )

        assert isinstance(invoices, list)
        assert mock_db.execute.called

    async def test_list_invoices_with_pagination(self, invoice_service, mock_db):
        """Test listing invoices with pagination."""
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_result

        invoices = await invoice_service.list_invoices(
            tenant_id="tenant-1",
            limit=50,
            offset=100,
        )

        assert isinstance(invoices, list)


@pytest.mark.unit
class TestWebhookPublishing:
    """Test webhook event publishing for invoice operations."""

    async def test_create_invoice_publishes_webhook(self, invoice_service, mock_db):
        """Test that invoice creation publishes webhook."""
        line_items = [
            {
                "description": "Product A",
                "quantity": 1,
                "unit_price": 100.00,
                "total_price": 100.00,
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "discount_percentage": 0.0,
                "discount_amount": 0.0,
                "extra_data": {},
            }
        ]

        with patch.object(invoice_service, "_get_invoice_by_idempotency_key", return_value=None):
            with patch.object(invoice_service, "_generate_invoice_number", return_value="INV-001"):
                with patch.object(invoice_service, "_create_invoice_transaction"):
                    with patch(
                        "dotmac.platform.billing.invoicing.service.get_event_bus"
                    ) as mock_event_bus:
                        mock_event_bus.return_value.publish = AsyncMock()

                        await invoice_service.create_invoice(
                            tenant_id="tenant-1",
                            customer_id="cust_123",
                            billing_email="test@example.com",
                            billing_address={},
                            line_items=line_items,
                        )

                        # Verify webhook published
                        mock_event_bus.return_value.publish.assert_called_once()
                        call_kwargs = mock_event_bus.return_value.publish.call_args[1]
                        assert call_kwargs["event_type"] == "invoice.created"

    async def test_void_invoice_webhook_error_handled(self, invoice_service, sample_invoice_entity):
        """Test that webhook errors don't fail void operation."""
        with patch.object(
            invoice_service, "_get_invoice_entity", return_value=sample_invoice_entity
        ):
            with patch.object(invoice_service, "_create_void_transaction"):
                with patch(
                    "dotmac.platform.billing.invoicing.service.get_event_bus"
                ) as mock_event_bus:
                    # Simulate webhook failure
                    mock_event_bus.return_value.publish = AsyncMock(
                        side_effect=Exception("Webhook failed")
                    )

                    # Should not raise exception
                    invoice = await invoice_service.void_invoice(
                        tenant_id="tenant-1",
                        invoice_id="inv_123",
                    )

                    # Invoice should still be voided
                    assert invoice.status == InvoiceStatus.VOID


@pytest.mark.unit
class TestCreditApplicationComplete:
    """Complete tests for credit application."""

    async def test_apply_credit_updates_credit_applications_list(
        self, invoice_service, sample_invoice_entity, mock_db
    ):
        """Test that credit application ID is added to list."""
        with patch.object(
            invoice_service, "_get_invoice_entity", return_value=sample_invoice_entity
        ):
            await invoice_service.apply_credit_to_invoice(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                credit_amount=50,
                credit_application_id="credit_app_456",
            )

            assert "credit_app_456" in sample_invoice_entity.credit_applications

    async def test_apply_credit_not_found(self, invoice_service):
        """Test applying credit to non-existent invoice."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=None):
            with pytest.raises(InvoiceNotFoundError):
                await invoice_service.apply_credit_to_invoice(
                    tenant_id="tenant-1",
                    invoice_id="inv_invalid",
                    credit_amount=50,
                    credit_application_id="credit_app_123",
                )

    async def test_apply_overcredit(self, invoice_service, sample_invoice_entity, mock_db):
        """Test applying credit greater than invoice amount."""
        with patch.object(
            invoice_service, "_get_invoice_entity", return_value=sample_invoice_entity
        ):
            await invoice_service.apply_credit_to_invoice(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                credit_amount=150,  # More than total_amount of 100
                credit_application_id="credit_app_123",
            )

            # Remaining balance should be 0 (clamped)
            assert sample_invoice_entity.remaining_balance == 0
            assert sample_invoice_entity.payment_status == PaymentStatus.SUCCEEDED
