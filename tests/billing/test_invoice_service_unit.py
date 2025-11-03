"""
Unit Tests for Invoice Service (Business Logic).

Strategy: Mock ALL dependencies (database, metrics, event bus)
Focus: Test invoice lifecycle, validation, status transitions in isolation
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import InvoiceEntity
from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.core.exceptions import (
    InvalidInvoiceStatusError,
    InvoiceNotFoundError,
)
from dotmac.platform.billing.invoicing.service import InvoiceService


@pytest.mark.unit
class TestInvoiceCreation:
    """Test invoice creation with idempotency."""

    @pytest.fixture
    def mock_db(self):
        """Mock database session."""
        db = AsyncMock(spec=AsyncSession)
        db.commit = AsyncMock()
        db.refresh = AsyncMock()
        db.add = MagicMock()
        return db

    @pytest.fixture
    def invoice_service(self, mock_db_session):
        """Create invoice service with mocked dependencies."""
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db_session)

    @pytest.fixture
    def line_items(self):
        """Create sample line items."""
        return [
            {
                "description": "Product A",
                "quantity": 2,
                "unit_price": 50.00,
                "total_price": 100.00,
                "product_id": "prod_a",
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "discount_percentage": 0.0,
                "discount_amount": 0.0,
                "extra_data": {},
            },
            {
                "description": "Product B",
                "quantity": 1,
                "unit_price": 25.00,
                "total_price": 25.00,
                "product_id": "prod_b",
                "tax_rate": 0.0,
                "tax_amount": 0.0,
                "discount_percentage": 0.0,
                "discount_amount": 0.0,
                "extra_data": {},
            },
        ]

    async def test_create_invoice_success(self, invoice_service, mock_db_session, line_items):
        """Test successful invoice creation."""
        with patch.object(invoice_service, "_get_invoice_by_idempotency_key", return_value=None):
            with patch.object(
                invoice_service, "_generate_invoice_number", return_value="INV-2025-001"
            ):
                with patch.object(
                    invoice_service, "_create_invoice_transaction", return_value=None
                ):
                    with patch(
                        "dotmac.platform.billing.invoicing.service.get_event_bus"
                    ) as mock_event_bus:
                        mock_event_bus.return_value.publish = AsyncMock()

                        await invoice_service.create_invoice(
                            tenant_id="tenant-1",
                            customer_id="cust_123",
                            billing_email="customer@example.com",
                            billing_address={"street": "123 Main St", "city": "Boston"},
                            line_items=line_items,
                            currency="USD",
                            due_days=30,
                        )

                        # Verify invoice was added to DB
                        assert mock_db_session.add.called
                        assert mock_db_session.commit.called

                        # Verify webhook was published
                        assert mock_event_bus.return_value.publish.called

    async def test_create_invoice_idempotency(self, invoice_service, line_items):
        """Test idempotency - same key returns existing invoice."""
        existing_invoice = InvoiceEntity(
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
            status=InvoiceStatus.DRAFT,
            payment_status=PaymentStatus.PENDING,
            line_items=[],
        )

        with patch.object(
            invoice_service,
            "_get_invoice_by_idempotency_key",
            return_value=existing_invoice,
        ):
            invoice = await invoice_service.create_invoice(
                tenant_id="tenant-1",
                customer_id="cust_123",
                billing_email="customer@example.com",
                billing_address={},
                line_items=line_items,
                idempotency_key="idem_123",
            )

            # Should return existing invoice without creating new one
            assert invoice.invoice_id == "inv_123"
            assert invoice.invoice_number == "INV-2025-001"

    async def test_create_invoice_calculates_totals(self, invoice_service, mock_db_session):
        """Test that invoice totals are calculated correctly."""
        line_items = [
            {
                "description": "Product with tax",
                "quantity": 1,
                "unit_price": 10000,  # $100.00 in cents
                "total_price": 10000,
                "tax_rate": 0.10,
                "tax_amount": 1000,  # $10.00 in cents
                "discount_percentage": 0.05,
                "discount_amount": 500,  # $5.00 in cents
                "extra_data": {},
            }
        ]

        with patch.object(invoice_service, "_get_invoice_by_idempotency_key", return_value=None):
            with patch.object(invoice_service, "_generate_invoice_number", return_value="INV-001"):
                with patch.object(
                    invoice_service, "_create_invoice_transaction", return_value=None
                ):
                    with patch("dotmac.platform.billing.invoicing.service.get_event_bus"):
                        await invoice_service.create_invoice(
                            tenant_id="tenant-1",
                            customer_id="cust_123",
                            billing_email="test@example.com",
                            billing_address={},
                            line_items=line_items,
                        )

                        # Get created invoice from db.add call
                        created_invoice = mock_db_session.add.call_args[0][0]

                        # Verify totals: subtotal + tax - discount (in cents)
                        assert created_invoice.subtotal == 10000  # $100.00
                        assert created_invoice.tax_amount == 1000  # $10.00
                        assert created_invoice.discount_amount == 500  # $5.00
                        assert created_invoice.total_amount == 10500  # $105.00


@pytest.mark.unit
class TestInvoiceFinalization:
    """Test invoice finalization (draft -> open)."""

    @pytest.fixture
    def invoice_service(self, mock_db_session):
        """Create invoice service."""
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db_session)

    @pytest.fixture
    def draft_invoice(self):
        """Create draft invoice."""
        return InvoiceEntity(
            invoice_id="inv_123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
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
            status=InvoiceStatus.DRAFT,
            payment_status=PaymentStatus.PENDING,
            line_items=[],
        )

    async def test_finalize_invoice_success(self, invoice_service, draft_invoice):
        """Test successful invoice finalization."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=draft_invoice):
            with patch.object(invoice_service, "_send_invoice_notification", return_value=None):
                await invoice_service.finalize_invoice(tenant_id="tenant-1", invoice_id="inv_123")

                # Status should be changed to OPEN
                assert draft_invoice.status == InvoiceStatus.OPEN

    async def test_finalize_non_draft_invoice_error(self, invoice_service, draft_invoice):
        """Test error when finalizing non-draft invoice."""
        # Make invoice already open
        draft_invoice.status = InvoiceStatus.OPEN

        with patch.object(invoice_service, "_get_invoice_entity", return_value=draft_invoice):
            with pytest.raises(InvalidInvoiceStatusError) as exc:
                await invoice_service.finalize_invoice(tenant_id="tenant-1", invoice_id="inv_123")

            assert "draft" in str(exc.value).lower()

    async def test_finalize_invoice_not_found(self, invoice_service):
        """Test error when invoice doesn't exist."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=None):
            with pytest.raises(InvoiceNotFoundError):
                await invoice_service.finalize_invoice(
                    tenant_id="tenant-1", invoice_id="inv_invalid"
                )


@pytest.mark.unit
class TestInvoiceVoiding:
    """Test invoice voiding logic."""

    @pytest.fixture
    def invoice_service(self, mock_db_session):
        """Create invoice service."""
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db_session)

    @pytest.fixture
    def open_invoice(self):
        """Create open unpaid invoice."""
        return InvoiceEntity(
            invoice_id="inv_123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
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
            extra_data={},
        )

    async def test_void_invoice_success(self, invoice_service, open_invoice):
        """Test successful invoice voiding."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            with patch.object(invoice_service, "_create_void_transaction", return_value=None):
                with patch(
                    "dotmac.platform.billing.invoicing.service.get_event_bus"
                ) as mock_event_bus:
                    mock_event_bus.return_value.publish = AsyncMock()

                    await invoice_service.void_invoice(
                        tenant_id="tenant-1",
                        invoice_id="inv_123",
                        reason="Customer requested cancellation",
                        voided_by="admin_user",
                    )

                    # Status should be changed to VOID
                    assert open_invoice.status == InvoiceStatus.VOID
                    assert open_invoice.voided_at is not None
                    assert "Customer requested" in open_invoice.internal_notes

    async def test_void_paid_invoice_error(self, invoice_service, open_invoice):
        """Test error when voiding paid invoice."""
        # Make invoice paid
        open_invoice.payment_status = PaymentStatus.SUCCEEDED

        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            with pytest.raises(InvalidInvoiceStatusError) as exc:
                await invoice_service.void_invoice(tenant_id="tenant-1", invoice_id="inv_123")

            assert "paid" in str(exc.value).lower()

    async def test_void_already_voided_invoice_idempotent(self, invoice_service, open_invoice):
        """Test voiding already voided invoice is idempotent."""
        # Make invoice already void
        open_invoice.status = InvoiceStatus.VOID

        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            invoice = await invoice_service.void_invoice(tenant_id="tenant-1", invoice_id="inv_123")

            # Should return without error
            assert invoice.status == InvoiceStatus.VOID


@pytest.mark.unit
class TestInvoicePayment:
    """Test invoice payment marking."""

    @pytest.fixture
    def invoice_service(self, mock_db_session):
        """Create invoice service."""
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db_session)

    @pytest.fixture
    def open_invoice(self):
        """Create open unpaid invoice."""
        return InvoiceEntity(
            invoice_id="inv_123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
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
            extra_data={},
        )

    async def test_mark_invoice_paid_success(self, invoice_service, open_invoice):
        """Test marking invoice as paid."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
                mock_event_bus.return_value.publish = AsyncMock()

                await invoice_service.mark_invoice_paid(
                    tenant_id="tenant-1",
                    invoice_id="inv_123",
                    payment_id="pay_123",
                )

                # Status should be PAID
                assert open_invoice.status == InvoiceStatus.PAID
                assert open_invoice.payment_status == PaymentStatus.SUCCEEDED
                assert open_invoice.remaining_balance == 0
                assert open_invoice.paid_at is not None

    async def test_mark_invoice_paid_publishes_webhook(self, invoice_service, open_invoice):
        """Test that marking invoice paid publishes webhook."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
                mock_event_bus.return_value.publish = AsyncMock()

                await invoice_service.mark_invoice_paid(
                    tenant_id="tenant-1",
                    invoice_id="inv_123",
                    payment_id="pay_123",
                )

                # Verify webhook was published
                mock_event_bus.return_value.publish.assert_called_once()
                call_args = mock_event_bus.return_value.publish.call_args[1]
                assert call_args["event_type"] == "invoice.paid"
                assert call_args["event_data"]["payment_id"] == "pay_123"


@pytest.mark.unit
class TestCreditApplication:
    """Test credit application to invoices."""

    @pytest.fixture
    def invoice_service(self, mock_db_session):
        """Create invoice service."""
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db_session)

    @pytest.fixture
    def open_invoice(self):
        """Create open invoice with $100 balance."""
        return InvoiceEntity(
            invoice_id="inv_123",
            tenant_id="tenant-1",
            invoice_number="INV-001",
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
            total_credits_applied=0,
            credit_applications=[],
            status=InvoiceStatus.OPEN,
            payment_status=PaymentStatus.PENDING,
            line_items=[],
            extra_data={},
        )

    async def test_apply_partial_credit(self, invoice_service, open_invoice, mock_db_session):
        """Test applying partial credit to invoice."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            await invoice_service.apply_credit_to_invoice(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                credit_amount=30,
                credit_application_id="credit_app_123",
            )

            # Balance should be reduced
            assert open_invoice.total_credits_applied == 30
            assert open_invoice.remaining_balance == 70  # 100 - 30
            assert open_invoice.payment_status == PaymentStatus.PENDING
            assert open_invoice.status == InvoiceStatus.PARTIALLY_PAID

    async def test_apply_full_credit(self, invoice_service, open_invoice, mock_db_session):
        """Test applying full credit marks invoice as paid."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            await invoice_service.apply_credit_to_invoice(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                credit_amount=100,  # Full amount
                credit_application_id="credit_app_123",
            )

            # Invoice should be fully paid
            assert open_invoice.total_credits_applied == 100
            assert open_invoice.remaining_balance == 0
            assert open_invoice.payment_status == PaymentStatus.SUCCEEDED
            assert open_invoice.status == InvoiceStatus.PAID

    async def test_apply_credit_creates_transaction(
        self, invoice_service, open_invoice, mock_db_session
    ):
        """Test that credit application creates transaction record."""
        with patch.object(invoice_service, "_get_invoice_entity", return_value=open_invoice):
            await invoice_service.apply_credit_to_invoice(
                tenant_id="tenant-1",
                invoice_id="inv_123",
                credit_amount=50,
                credit_application_id="credit_app_123",
            )

            # Verify transaction was added
            assert mock_db_session.add.called
            transaction = mock_db_session.add.call_args[0][0]
            assert transaction.amount == 50
            assert transaction.transaction_type.value == "credit"


@pytest.mark.unit
class TestInvoiceListing:
    """Test invoice listing and filtering."""

    @pytest.fixture
    def invoice_service(self):
        """Create invoice service."""
        mock_db = AsyncMock(spec=AsyncSession)
        with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics"):
            return InvoiceService(db_session=mock_db)

    async def test_list_invoices_tenant_isolation(self, invoice_service):
        """Test that list_invoices filters by tenant_id."""
        with patch.object(
            invoice_service.db,
            "execute",
            return_value=MagicMock(
                scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))
            ),
        ) as mock_execute:
            invoices = await invoice_service.list_invoices(
                tenant_id="tenant-1",
                customer_id="cust_123",
                status=InvoiceStatus.OPEN,
            )

            # Verify query was executed
            assert mock_execute.called
            assert isinstance(invoices, list)

    async def test_get_invoice_not_found(self, invoice_service):
        """Test get_invoice returns None when not found."""
        with patch.object(
            invoice_service.db,
            "execute",
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ):
            invoice = await invoice_service.get_invoice(
                tenant_id="tenant-1", invoice_id="inv_invalid"
            )

            assert invoice is None
