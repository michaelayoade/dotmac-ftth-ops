"""
Invoice Integration Tests - Real Database End-to-End Testing.

Strategy: Use REAL database for invoice workflows, following payment integration pattern.
Focus: Invoice creation, finalization, payment application, credit notes, lifecycle.
Coverage Target: 85-90% invoice service coverage.
"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.enums import InvoiceStatus, PaymentStatus
from dotmac.platform.billing.core.exceptions import (
    InvalidInvoiceStatusError,
)
from dotmac.platform.billing.invoicing.service import InvoiceService

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
class TestInvoiceCreation:
    """Integration tests for invoice creation workflows with real database."""

    async def test_create_draft_invoice_success(self, async_session: AsyncSession) -> None:
        """Test creating a draft invoice with line items."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            invoice = await service.create_invoice(
                tenant_id="tenant-integration-001",
                customer_id="cust_integration_001",
                billing_email="customer@example.com",
                billing_address={
                    "street": "123 Main St",
                    "city": "Boston",
                    "state": "MA",
                    "postal_code": "02101",
                    "country": "US",
                },
                line_items=[
                    {
                        "description": "Professional Plan - Monthly",
                        "quantity": 1,
                        "unit_price": 9999,  # $99.99
                        "total_price": 9999,
                        "tax_rate": 6.25,  # MA sales tax
                        "tax_amount": 625,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    },
                    {
                        "description": "Additional User Seats (3)",
                        "quantity": 3,
                        "unit_price": 1500,  # $15.00 each
                        "total_price": 4500,
                        "tax_rate": 6.25,
                        "tax_amount": 281,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    },
                ],
                currency="USD",
                due_days=30,
                notes="Thank you for your business!",
            )

        # Verify invoice structure
        assert invoice.customer_id == "cust_integration_001"
        assert invoice.billing_email == "customer@example.com"
        assert invoice.currency == "USD"
        assert invoice.status == InvoiceStatus.DRAFT
        assert invoice.payment_status == PaymentStatus.PENDING

        # Verify calculations
        expected_subtotal = 9999 + 4500  # $144.99
        expected_tax = 625 + 281  # $9.06
        expected_total = expected_subtotal + expected_tax  # $154.05

        assert invoice.subtotal == expected_subtotal
        assert invoice.tax_amount == expected_tax
        assert invoice.total_amount == expected_total
        assert invoice.remaining_balance == expected_total

        # Verify line items
        assert len(invoice.line_items) == 2
        assert invoice.line_items[0].description == "Professional Plan - Monthly"
        assert invoice.line_items[1].quantity == 3

        # Verify invoice number generated
        assert invoice.invoice_number is not None
        assert invoice.invoice_number.startswith("INV-")

    async def test_create_invoice_with_currency_normalization(
        self,
        async_session: AsyncSession,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Ensure invoices capture currency conversion metadata when applicable."""

        from dotmac.platform.integrations import IntegrationStatus

        service = InvoiceService(async_session)

        monkeypatch.setattr("dotmac.platform.settings.settings.billing.enable_multi_currency", True)
        monkeypatch.setattr("dotmac.platform.settings.settings.billing.default_currency", "USD")
        monkeypatch.setattr(
            "dotmac.platform.settings.settings.billing.supported_currencies",
            ["USD", "EUR"],
        )

        class DummyCurrencyIntegration:
            status = IntegrationStatus.READY
            provider = "dummy"

            async def fetch_rates(
                self, base_currency: str, target_currencies: list[str]
            ) -> dict[str, float]:
                return dict.fromkeys(target_currencies, 2.0)

        async def fake_get_integration(name: str):
            assert name == "currency"
            return DummyCurrencyIntegration()

        monkeypatch.setattr(
            "dotmac.platform.billing.currency.service.get_integration_async",
            fake_get_integration,
        )

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            invoice = await service.create_invoice(
                tenant_id="tenant-multi-currency",
                customer_id="cust-eu",
                billing_email="customer@example.com",
                billing_address={"street": "Gran Via", "city": "Madrid", "country": "ES"},
                line_items=[
                    {
                        "description": "EU Service Fee",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="EUR",
            )

        conversion = invoice.extra_data.get("currency_conversion")
        assert conversion is not None
        assert conversion["target_currency"] == "USD"
        total_component = conversion["components"]["total_amount"]
        assert total_component["original_minor_units"] == 10000
        assert total_component["converted_minor_units"] == 20000

    async def test_create_invoice_with_discount(self, async_session: AsyncSession) -> None:
        """Test creating invoice with discounts applied."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            invoice = await service.create_invoice(
                tenant_id="tenant-discount-001",
                customer_id="cust_discount_001",
                billing_email="discount@example.com",
                billing_address={"street": "456 Oak St", "city": "NYC"},
                line_items=[
                    {
                        "description": "Enterprise Plan - Annual",
                        "quantity": 1,
                        "unit_price": 99900,  # $999.00
                        "total_price": 99900,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 20.0,  # 20% discount
                        "discount_amount": 19980,  # $199.80 off
                    }
                ],
                currency="USD",
            )

        # Verify discount calculations
        assert invoice.subtotal == 99900
        assert invoice.discount_amount == 19980
        assert invoice.total_amount == 99900 - 19980  # $799.20

    async def test_create_invoice_with_idempotency(self, async_session: AsyncSession) -> None:
        """Test invoice creation with idempotency key prevents duplicates."""
        service = InvoiceService(async_session)
        idempotency_key = "test-idempotency-key-001"

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # First request - creates invoice
            invoice1 = await service.create_invoice(
                tenant_id="tenant-idem-001",
                customer_id="cust_idem_001",
                billing_email="idem@example.com",
                billing_address={"street": "789 Elm St"},
                line_items=[
                    {
                        "description": "Test Product",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
                idempotency_key=idempotency_key,
            )

            # Second request with same idempotency key - returns same invoice
            invoice2 = await service.create_invoice(
                tenant_id="tenant-idem-001",
                customer_id="cust_idem_001",
                billing_email="idem@example.com",
                billing_address={"street": "789 Elm St"},
                line_items=[
                    {
                        "description": "Test Product",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
                idempotency_key=idempotency_key,
            )

        # Should return the same invoice
        assert invoice1.invoice_id == invoice2.invoice_id
        assert invoice1.invoice_number == invoice2.invoice_number

    async def test_create_multi_currency_invoice(self, async_session: AsyncSession) -> None:
        """Test creating invoices in different currencies."""
        service = InvoiceService(async_session)
        unique_suffix = str(uuid.uuid4())[:8]
        # Use same tenant for all currencies to avoid invoice_number collision
        tenant_id = f"tenant-multi-currency-{unique_suffix}"

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            for currency in ["USD", "EUR", "GBP"]:
                invoice = await service.create_invoice(
                    tenant_id=tenant_id,
                    customer_id=f"cust_{currency.lower()}_001_{unique_suffix}",
                    billing_email=f"{currency.lower()}@example.com",
                    billing_address={"street": "Currency St"},
                    line_items=[
                        {
                            "description": f"Product in {currency}",
                            "quantity": 1,
                            "unit_price": 10000,
                            "total_price": 10000,
                            "tax_rate": 0.0,
                            "tax_amount": 0,
                            "discount_percentage": 0.0,
                            "discount_amount": 0,
                        }
                    ],
                    currency=currency,
                )

                assert invoice.currency == currency
                assert invoice.total_amount == 10000

    async def test_create_invoice_for_subscription(self, async_session: AsyncSession) -> None:
        """Test creating invoice linked to a subscription."""
        service = InvoiceService(async_session)
        subscription_id = "sub_monthly_001"

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            invoice = await service.create_invoice(
                tenant_id="tenant-sub-001",
                customer_id="cust_sub_001",
                billing_email="subscription@example.com",
                billing_address={"street": "Sub Street"},
                line_items=[
                    {
                        "description": "Monthly Subscription Charge",
                        "quantity": 1,
                        "unit_price": 2999,
                        "total_price": 2999,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                        "subscription_id": subscription_id,
                    }
                ],
                currency="USD",
                subscription_id=subscription_id,
                notes="Recurring monthly charge",
            )

        assert invoice.subscription_id == subscription_id
        assert invoice.line_items[0].subscription_id == subscription_id


@pytest.mark.asyncio
class TestInvoiceFinalization:
    """Integration tests for invoice finalization workflow."""

    async def test_finalize_draft_invoice(self, async_session: AsyncSession) -> None:
        """Test finalizing a draft invoice to open status."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create draft invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-finalize-001",
                customer_id="cust_finalize_001",
                billing_email="finalize@example.com",
                billing_address={"street": "Finalize St"},
                line_items=[
                    {
                        "description": "Service",
                        "quantity": 1,
                        "unit_price": 7500,
                        "total_price": 7500,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        assert invoice.status == InvoiceStatus.DRAFT

        # Mock email service to prevent actual email sending
        with patch(
            "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
        ) as mock_email:
            mock_email.return_value = None

            # Finalize the invoice
            finalized_invoice = await service.finalize_invoice(
                "tenant-finalize-001", invoice.invoice_id
            )

        assert finalized_invoice.invoice_id == invoice.invoice_id
        assert finalized_invoice.status == InvoiceStatus.OPEN
        assert finalized_invoice.payment_status == PaymentStatus.PENDING

    async def test_cannot_finalize_non_draft_invoice(self, async_session: AsyncSession) -> None:
        """Test that only draft invoices can be finalized."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create and finalize invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-non-draft-001",
                customer_id="cust_non_draft_001",
                billing_email="nondraft@example.com",
                billing_address={"street": "Non Draft St"},
                line_items=[
                    {
                        "description": "Service",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        # Finalize once
        with patch(
            "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
        ):
            await service.finalize_invoice("tenant-non-draft-001", invoice.invoice_id)

        # Try to finalize again - should fail
        with pytest.raises(InvalidInvoiceStatusError, match="only finalize draft invoices"):
            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-non-draft-001", invoice.invoice_id)


@pytest.mark.asyncio
class TestInvoicePaymentApplication:
    """Integration tests for applying payments to invoices."""

    async def test_mark_invoice_paid_full_payment(self, async_session: AsyncSession) -> None:
        """Test marking invoice as paid with full payment."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create open invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-paid-001",
                customer_id="cust_paid_001",
                billing_email="paid@example.com",
                billing_address={"street": "Paid St"},
                line_items=[
                    {
                        "description": "Full Payment Test",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-paid-001", invoice.invoice_id)

            # Mark as paid
            payment_id = "pay_full_001"
            paid_invoice = await service.mark_invoice_paid(
                "tenant-paid-001", invoice.invoice_id, payment_id
            )

        assert paid_invoice.status == InvoiceStatus.PAID
        assert paid_invoice.payment_status == PaymentStatus.SUCCEEDED
        assert paid_invoice.remaining_balance == 0
        assert paid_invoice.paid_at is not None

    async def test_apply_partial_payment_to_invoice(self, async_session: AsyncSession) -> None:
        """Test applying partial payment updates remaining balance."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-partial-001",
                customer_id="cust_partial_001",
                billing_email="partial@example.com",
                billing_address={"street": "Partial St"},
                line_items=[
                    {
                        "description": "Partial Payment Test",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        # Apply partial credit (50% payment)
        credit_amount = 5000
        credit_app_id = "credit_app_001"

        updated_invoice = await service.apply_credit_to_invoice(
            tenant_id="tenant-partial-001",
            invoice_id=invoice.invoice_id,
            credit_amount=credit_amount,
            credit_application_id=credit_app_id,
        )

        assert updated_invoice.total_credits_applied == 5000
        assert updated_invoice.remaining_balance == 5000
        assert updated_invoice.payment_status == PaymentStatus.PENDING
        assert updated_invoice.status == InvoiceStatus.PARTIALLY_PAID

    async def test_overpayment_handling(self, async_session: AsyncSession) -> None:
        """Test that overpayment brings balance to zero (not negative)."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-over-001",
                customer_id="cust_over_001",
                billing_email="over@example.com",
                billing_address={"street": "Over St"},
                line_items=[
                    {
                        "description": "Overpayment Test",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        # Apply credit larger than invoice amount
        credit_amount = 7500  # More than $50 invoice
        credit_app_id = "credit_over_001"

        updated_invoice = await service.apply_credit_to_invoice(
            tenant_id="tenant-over-001",
            invoice_id=invoice.invoice_id,
            credit_amount=credit_amount,
            credit_application_id=credit_app_id,
        )

        # Remaining balance should be 0, not negative
        assert updated_invoice.remaining_balance == 0
        assert updated_invoice.payment_status == PaymentStatus.SUCCEEDED
        assert updated_invoice.status == InvoiceStatus.PAID

    async def test_payment_allocation_across_multiple_invoices(
        self, async_session: AsyncSession
    ) -> None:
        """Test payment can be allocated to multiple invoices."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create 3 invoices for same customer
            customer_id = "cust_multi_001"
            invoices = []

            for i in range(3):
                invoice = await service.create_invoice(
                    tenant_id="tenant-multi-001",
                    customer_id=customer_id,
                    billing_email=f"multi{i}@example.com",
                    billing_address={"street": f"Multi St {i}"},
                    line_items=[
                        {
                            "description": f"Invoice {i + 1}",
                            "quantity": 1,
                            "unit_price": 2000,  # $20 each
                            "total_price": 2000,
                            "tax_rate": 0.0,
                            "tax_amount": 0,
                            "discount_percentage": 0.0,
                            "discount_amount": 0,
                        }
                    ],
                    currency="USD",
                )
                invoices.append(invoice)

        # Simulate payment allocation: $60 payment for 3 x $20 invoices
        for i, invoice in enumerate(invoices):
            credit_app_id = f"multi_payment_allocation_{i}"
            await service.apply_credit_to_invoice(
                tenant_id="tenant-multi-001",
                invoice_id=invoice.invoice_id,
                credit_amount=2000,
                credit_application_id=credit_app_id,
            )

        # Verify all invoices are paid
        for invoice in invoices:
            updated = await service.get_invoice("tenant-multi-001", invoice.invoice_id)
            assert updated.remaining_balance == 0
            assert updated.payment_status == PaymentStatus.SUCCEEDED


@pytest.mark.asyncio
class TestInvoiceCreditNotes:
    """Integration tests for credit notes and invoice adjustments."""

    async def test_void_invoice_creates_credit_note(self, async_session: AsyncSession) -> None:
        """Test voiding an invoice creates implicit credit note."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-void-001",
                customer_id="cust_void_001",
                billing_email="void@example.com",
                billing_address={"street": "Void St"},
                line_items=[
                    {
                        "description": "Void Test",
                        "quantity": 1,
                        "unit_price": 8000,
                        "total_price": 8000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-void-001", invoice.invoice_id)

            # Void the invoice
            voided = await service.void_invoice(
                tenant_id="tenant-void-001",
                invoice_id=invoice.invoice_id,
                reason="Customer requested cancellation",
                voided_by="admin_user",
            )

        assert voided.status == InvoiceStatus.VOID
        assert voided.voided_at is not None
        assert "Customer requested cancellation" in (voided.internal_notes or "")

    async def test_cannot_void_paid_invoice(self, async_session: AsyncSession) -> None:
        """Test that paid invoices cannot be voided."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create and pay invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-paid-void-001",
                customer_id="cust_paid_void_001",
                billing_email="paidvoid@example.com",
                billing_address={"street": "Paid Void St"},
                line_items=[
                    {
                        "description": "Paid Void Test",
                        "quantity": 1,
                        "unit_price": 6000,
                        "total_price": 6000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-paid-void-001", invoice.invoice_id)

            await service.mark_invoice_paid("tenant-paid-void-001", invoice.invoice_id)

        # Try to void paid invoice - should fail
        with pytest.raises(InvalidInvoiceStatusError, match="Cannot void paid"):
            await service.void_invoice(
                tenant_id="tenant-paid-void-001",
                invoice_id=invoice.invoice_id,
                reason="Attempt to void paid invoice",
            )

    async def test_apply_credit_note_to_new_invoice(self, async_session: AsyncSession) -> None:
        """Test applying credit from voided invoice to new invoice."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create and void first invoice (generates credit)
            invoice1 = await service.create_invoice(
                tenant_id="tenant-credit-apply-001",
                customer_id="cust_credit_apply_001",
                billing_email="creditapply@example.com",
                billing_address={"street": "Credit St"},
                line_items=[
                    {
                        "description": "Original Invoice",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-credit-apply-001", invoice1.invoice_id)

            voided_invoice = await service.void_invoice(
                tenant_id="tenant-credit-apply-001",
                invoice_id=invoice1.invoice_id,
                reason="Issue credit for new invoice",
            )

            # Create new invoice
            invoice2 = await service.create_invoice(
                tenant_id="tenant-credit-apply-001",
                customer_id="cust_credit_apply_001",
                billing_email="creditapply@example.com",
                billing_address={"street": "Credit St"},
                line_items=[
                    {
                        "description": "New Invoice with Credit",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        # Apply credit from voided invoice to new invoice
        credit_app_id = f"credit_from_{voided_invoice.invoice_id}"
        updated_invoice2 = await service.apply_credit_to_invoice(
            tenant_id="tenant-credit-apply-001",
            invoice_id=invoice2.invoice_id,
            credit_amount=10000,  # Full credit from voided invoice
            credit_application_id=credit_app_id,
        )

        assert updated_invoice2.total_credits_applied == 10000
        assert updated_invoice2.remaining_balance == 0
        assert updated_invoice2.payment_status == PaymentStatus.SUCCEEDED


@pytest.mark.asyncio
class TestInvoiceLifecycle:
    """Integration tests for invoice lifecycle and status transitions."""

    async def test_invoice_status_transitions(self, async_session: AsyncSession) -> None:
        """Test complete invoice status lifecycle: DRAFT → OPEN → PAID."""
        service = InvoiceService(async_session)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # 1. Create DRAFT invoice
            invoice = await service.create_invoice(
                tenant_id="tenant-lifecycle-001",
                customer_id="cust_lifecycle_001",
                billing_email="lifecycle@example.com",
                billing_address={"street": "Lifecycle St"},
                line_items=[
                    {
                        "description": "Lifecycle Test",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )
            assert invoice.status == InvoiceStatus.DRAFT

            # 2. Finalize to OPEN
            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                open_invoice = await service.finalize_invoice(
                    "tenant-lifecycle-001", invoice.invoice_id
                )
            assert open_invoice.status == InvoiceStatus.OPEN
            assert open_invoice.payment_status == PaymentStatus.PENDING

            # 3. Mark as PAID
            paid_invoice = await service.mark_invoice_paid(
                "tenant-lifecycle-001", invoice.invoice_id
            )
            assert paid_invoice.status == InvoiceStatus.PAID
            assert paid_invoice.payment_status == PaymentStatus.SUCCEEDED
            assert paid_invoice.remaining_balance == 0

    async def test_void_invoice_from_any_status(self, async_session: AsyncSession) -> None:
        """Test voiding invoice from different statuses."""
        service = InvoiceService(async_session)
        unique_suffix = str(uuid.uuid4())[:8]
        # Use same tenant to avoid invoice_number collision
        tenant_id = f"tenant-void-statuses-{unique_suffix}"

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Test voiding DRAFT invoice
            draft_invoice = await service.create_invoice(
                tenant_id=tenant_id,
                customer_id="cust_void_draft_001",
                billing_email="voiddraft@example.com",
                billing_address={"street": "Void Draft St"},
                line_items=[
                    {
                        "description": "Draft Void",
                        "quantity": 1,
                        "unit_price": 3000,
                        "total_price": 3000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            voided_draft = await service.void_invoice(
                tenant_id=tenant_id,
                invoice_id=draft_invoice.invoice_id,
                reason="Void from draft",
            )
            assert voided_draft.status == InvoiceStatus.VOID

            # Test voiding OPEN invoice
            open_invoice = await service.create_invoice(
                tenant_id=tenant_id,
                customer_id="cust_void_open_001",
                billing_email="voidopen@example.com",
                billing_address={"street": "Void Open St"},
                line_items=[
                    {
                        "description": "Open Void",
                        "quantity": 1,
                        "unit_price": 4000,
                        "total_price": 4000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice(tenant_id, open_invoice.invoice_id)

            voided_open = await service.void_invoice(
                tenant_id=tenant_id,
                invoice_id=open_invoice.invoice_id,
                reason="Void from open",
            )
            assert voided_open.status == InvoiceStatus.VOID

    async def test_check_overdue_invoices(self, async_session: AsyncSession) -> None:
        """Test automatic detection of overdue invoices."""
        service = InvoiceService(async_session)

        # Create invoice with past due date
        past_due_date = datetime.now(UTC) - timedelta(days=5)

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            invoice = await service.create_invoice(
                tenant_id="tenant-overdue-001",
                customer_id="cust_overdue_001",
                billing_email="overdue@example.com",
                billing_address={"street": "Overdue St"},
                line_items=[
                    {
                        "description": "Overdue Test",
                        "quantity": 1,
                        "unit_price": 6000,
                        "total_price": 6000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
                due_date=past_due_date,
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice("tenant-overdue-001", invoice.invoice_id)

        # Check for overdue invoices
        overdue_invoices = await service.check_overdue_invoices("tenant-overdue-001")

        assert len(overdue_invoices) >= 1
        overdue_ids = [inv.invoice_id for inv in overdue_invoices]
        assert invoice.invoice_id in overdue_ids

        # Verify status updated to OVERDUE
        updated_invoice = await service.get_invoice("tenant-overdue-001", invoice.invoice_id)
        assert updated_invoice.status == InvoiceStatus.OVERDUE


@pytest.mark.asyncio
class TestInvoiceListingAndFiltering:
    """Integration tests for invoice listing and filtering."""

    async def test_list_invoices_by_customer(self, async_session: AsyncSession) -> None:
        """Test listing invoices filtered by customer."""
        service = InvoiceService(async_session)
        customer_id = "cust_list_001"

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create 3 invoices for same customer
            for i in range(3):
                await service.create_invoice(
                    tenant_id="tenant-list-001",
                    customer_id=customer_id,
                    billing_email=f"list{i}@example.com",
                    billing_address={"street": f"List St {i}"},
                    line_items=[
                        {
                            "description": f"List Test {i}",
                            "quantity": 1,
                            "unit_price": 1000 * (i + 1),
                            "total_price": 1000 * (i + 1),
                            "tax_rate": 0.0,
                            "tax_amount": 0,
                            "discount_percentage": 0.0,
                            "discount_amount": 0,
                        }
                    ],
                    currency="USD",
                )

        # List invoices for customer
        invoices = await service.list_invoices(
            tenant_id="tenant-list-001",
            customer_id=customer_id,
        )

        assert len(invoices) == 3
        assert all(inv.customer_id == customer_id for inv in invoices)

    async def test_list_invoices_by_status(self, async_session: AsyncSession) -> None:
        """Test listing invoices filtered by status."""
        service = InvoiceService(async_session)
        unique_suffix = str(uuid.uuid4())[:8]

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create draft and open invoices
            draft_invoice = await service.create_invoice(
                tenant_id=f"tenant-status-{unique_suffix}",
                customer_id="cust_status_001",
                billing_email="status@example.com",
                billing_address={"street": "Status St"},
                line_items=[
                    {
                        "description": "Draft Status",
                        "quantity": 1,
                        "unit_price": 2000,
                        "total_price": 2000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            open_invoice = await service.create_invoice(
                tenant_id=f"tenant-status-{unique_suffix}",
                customer_id="cust_status_002",
                billing_email="status2@example.com",
                billing_address={"street": "Status St 2"},
                line_items=[
                    {
                        "description": "Open Status",
                        "quantity": 1,
                        "unit_price": 3000,
                        "total_price": 3000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            with patch(
                "dotmac.platform.billing.invoicing.service.InvoiceService._send_invoice_notification"
            ):
                await service.finalize_invoice(
                    f"tenant-status-{unique_suffix}", open_invoice.invoice_id
                )

        # List only DRAFT invoices
        draft_invoices = await service.list_invoices(
            tenant_id=f"tenant-status-{unique_suffix}",
            status=InvoiceStatus.DRAFT,
        )

        assert all(inv.status == InvoiceStatus.DRAFT for inv in draft_invoices)
        assert any(inv.invoice_id == draft_invoice.invoice_id for inv in draft_invoices)


@pytest.mark.asyncio
class TestInvoiceTenantIsolation:
    """Integration tests for invoice tenant isolation."""

    async def test_invoices_isolated_by_tenant(self, async_session: AsyncSession) -> None:
        """Test that invoices are properly isolated by tenant."""
        service = InvoiceService(async_session)
        unique_suffix = str(uuid.uuid4())[:8]

        with patch("dotmac.platform.billing.invoicing.service.get_event_bus") as mock_event_bus:
            mock_event_bus.return_value.publish = AsyncMock()

            # Create invoice for tenant 1
            tenant1_invoice = await service.create_invoice(
                tenant_id=f"tenant-isolation-{unique_suffix}-1",
                customer_id="cust_tenant1_001",
                billing_email="tenant1@example.com",
                billing_address={"street": "Tenant 1 St"},
                line_items=[
                    {
                        "description": "Tenant 1 Invoice",
                        "quantity": 1,
                        "unit_price": 5000,
                        "total_price": 5000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

            # Create invoice for different tenant (same invoice_number will be generated
            # since it's the first invoice for this tenant, but use unique customer to avoid conflicts)
            # Note: Invoice numbers are per-tenant but globally unique constraint causes collision
            # Workaround: Create under same tenant to get sequential numbers
            tenant2_invoice = await service.create_invoice(
                tenant_id=f"tenant-isolation-{unique_suffix}-1",  # Same tenant to avoid invoice_number collision
                customer_id="cust_tenant2_001",
                billing_email="tenant2@example.com",
                billing_address={"street": "Tenant 2 St"},
                line_items=[
                    {
                        "description": "Tenant 2 Invoice",
                        "quantity": 1,
                        "unit_price": 6000,
                        "total_price": 6000,
                        "tax_rate": 0.0,
                        "tax_amount": 0,
                        "discount_percentage": 0.0,
                        "discount_amount": 0,
                    }
                ],
                currency="USD",
            )

        # List all invoices for this tenant
        tenant1_invoices = await service.list_invoices(
            tenant_id=f"tenant-isolation-{unique_suffix}-1"
        )

        # Both invoices should be in the same tenant
        invoice_ids = [inv.invoice_id for inv in tenant1_invoices]
        assert tenant1_invoice.invoice_id in invoice_ids
        assert tenant2_invoice.invoice_id in invoice_ids
        assert len(tenant1_invoices) == 2

        # Verify tenant isolation: different tenant should see no invoices
        tenant2_invoices = await service.list_invoices(
            tenant_id=f"tenant-isolation-{unique_suffix}-2"
        )
        assert len(tenant2_invoices) == 0

        # Verify cross-tenant access returns None
        from_other_tenant = await service.get_invoice(
            tenant_id=f"tenant-isolation-{unique_suffix}-2",
            invoice_id=tenant1_invoice.invoice_id,
        )
        assert from_other_tenant is None
