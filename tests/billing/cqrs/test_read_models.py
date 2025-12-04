"""Tests for CQRS Read Models (Pydantic Validation)"""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from dotmac.platform.billing.read_models.invoice_read_models import (
    CustomerInvoiceSummary,
    InvoiceDetail,
    InvoiceListItem,
    InvoiceStatistics,
    OverdueInvoicesSummary,
)
from dotmac.platform.billing.read_models.payment_read_models import (
    PaymentDetail,
    PaymentListItem,
    PaymentStatistics,
)
from dotmac.platform.billing.read_models.subscription_read_models import (
    SubscriptionDetail,
    SubscriptionListItem,
    SubscriptionStatistics,
)


@pytest.mark.unit
class TestInvoiceReadModels:
    """Test Invoice Read Models Pydantic validation"""

    def test_invoice_list_item_creation(self):
        """Test InvoiceListItem model creation"""
        now = datetime.now(UTC)
        invoice = InvoiceListItem(
            invoice_id="inv-123",
            invoice_number="INV-001",
            customer_id="cust-456",
            customer_name="John Doe",
            customer_email="john@example.com",
            total_amount=10000,
            remaining_balance=5000,
            currency="USD",
            status="open",
            is_overdue=False,
            created_at=now,
            due_date=now + timedelta(days=30),
            paid_at=None,
            line_item_count=3,
            payment_count=1,
            formatted_total="$100.00",
            formatted_balance="$50.00",
            days_until_due=30,
        )

        assert invoice.invoice_id == "inv-123"
        assert invoice.customer_name == "John Doe"
        assert invoice.total_amount == 10000
        assert invoice.remaining_balance == 5000
        assert invoice.formatted_total == "$100.00"
        assert invoice.days_until_due == 30

    def test_invoice_detail_creation(self):
        """Test InvoiceDetail model creation"""
        now = datetime.now(UTC)
        invoice = InvoiceDetail(
            invoice_id="inv-123",
            invoice_number="INV-001",
            tenant_id="tenant-1",
            customer_id="cust-456",
            customer_name="John Doe",
            customer_email="john@example.com",
            billing_address={"street": "123 Main St", "city": "Boston"},
            line_items=[
                {
                    "description": "Product A",
                    "quantity": 2,
                    "unit_price": 5000,
                    "total_price": 10000,
                }
            ],
            subtotal=10000,
            tax_amount=1000,
            discount_amount=500,
            total_amount=10500,
            remaining_balance=10500,
            currency="USD",
            status="open",
            created_at=now,
            updated_at=now,
            issue_date=now,
            due_date=now + timedelta(days=30),
            finalized_at=now,
            paid_at=None,
            voided_at=None,
            payments=[],
            total_paid=0,
            notes="Customer notes",
            internal_notes="Internal notes",
            subscription_id=None,
            idempotency_key="idem-key-123",
            created_by="user-123",
            extra_data={"custom": "value"},
            is_overdue=False,
        )

        assert invoice.invoice_id == "inv-123"
        assert invoice.tenant_id == "tenant-1"
        assert invoice.subtotal == 10000
        assert invoice.tax_amount == 1000
        assert invoice.total_amount == 10500
        assert len(invoice.line_items) == 1
        assert invoice.extra_data == {"custom": "value"}

    def test_invoice_statistics_creation(self):
        """Test InvoiceStatistics model creation"""
        now = datetime.now(UTC)
        stats = InvoiceStatistics(
            total_count=100,
            draft_count=10,
            open_count=30,
            paid_count=60,
            void_count=0,
            overdue_count=5,
            total_amount=1000000,
            paid_amount=600000,
            outstanding_amount=400000,
            overdue_amount=50000,
            average_invoice_amount=10000,
            average_payment_time_days=15.5,
            period_start=now - timedelta(days=30),
            period_end=now,
            currency="USD",
            growth_rate=0.1,
            formatted_total="$10,000.00",
            formatted_outstanding="$4,000.00",
        )

        assert stats.total_count == 100
        assert stats.paid_count == 60
        assert stats.void_count == 0
        assert stats.overdue_count == 5
        assert stats.average_invoice_amount == 10000
        assert stats.average_payment_time_days == 15.5

    def test_customer_invoice_summary_creation(self):
        """Test CustomerInvoiceSummary model creation"""
        now = datetime.now(UTC)
        summary = CustomerInvoiceSummary(
            customer_id="cust-456",
            customer_name="John Doe",
            customer_email="john@example.com",
            total_invoices=10,
            paid_invoices=6,
            unpaid_invoices=4,
            overdue_invoices=1,
            lifetime_value=60000,
            outstanding_balance=40000,
            overdue_balance=10000,
            currency="USD",
            first_invoice_date=now - timedelta(days=365),
            last_invoice_date=now - timedelta(days=5),
            last_payment_date=now - timedelta(days=2),
            average_days_to_pay=15.0,
            on_time_payment_rate=0.85,
            payment_reliability_score=85,
        )

        assert summary.customer_id == "cust-456"
        assert summary.total_invoices == 10
        assert summary.outstanding_balance == 40000
        assert summary.payment_reliability_score == 85

    def test_overdue_invoices_summary_creation(self):
        """Test OverdueInvoicesSummary model creation"""
        summary = OverdueInvoicesSummary(
            total_overdue=25,
            total_amount_overdue=250000,
            currency="USD",
            by_age={
                "1-30": 10,
                "31-60": 8,
                "61-90": 5,
                "90+": 2,
            },
            top_customers=[
                {"customer_id": "cust-1", "customer_name": "Customer 1", "amount": 50000},
                {"customer_id": "cust-2", "customer_name": "Customer 2", "amount": 40000},
            ],
        )

        assert summary.total_overdue == 25
        assert summary.total_amount_overdue == 250000
        assert len(summary.by_age) == 4
        assert len(summary.top_customers) == 2


@pytest.mark.unit
class TestPaymentReadModels:
    """Test Payment Read Models Pydantic validation"""

    def test_payment_list_item_creation(self):
        """Test PaymentListItem model creation"""
        now = datetime.now(UTC)
        payment = PaymentListItem(
            payment_id="pay-123",
            invoice_id="inv-456",
            customer_id="cust-789",
            customer_name="Jane Smith",
            amount=10000,
            currency="USD",
            status="succeeded",
            payment_method="card",
            created_at=now,
            formatted_amount="$100.00",
        )

        assert payment.payment_id == "pay-123"
        assert payment.customer_name == "Jane Smith"
        assert payment.amount == 10000
        assert payment.formatted_amount == "$100.00"

    def test_payment_detail_creation(self):
        """Test PaymentDetail model creation"""
        now = datetime.now(UTC)
        payment = PaymentDetail(
            payment_id="pay-123",
            tenant_id="tenant-1",
            invoice_id="inv-456",
            customer_id="cust-789",
            amount=10000,
            currency="USD",
            status="succeeded",
            payment_method_id="pm-123",
            payment_method="card",
            provider="stripe",
            external_payment_id="pi_123",
            created_at=now,
            captured_at=now,
            refunded_at=None,
            refund_amount=0,
            description="Payment for invoice",
            failure_reason=None,
        )

        assert payment.payment_id == "pay-123"
        assert payment.tenant_id == "tenant-1"
        assert payment.amount == 10000
        assert payment.status == "succeeded"
        assert payment.refund_amount == 0
        assert payment.provider == "stripe"

    def test_payment_statistics_creation(self):
        """Test PaymentStatistics model creation"""
        now = datetime.now(UTC)
        stats = PaymentStatistics(
            total_count=100,
            succeeded_count=90,
            failed_count=10,
            refunded_count=5,
            total_amount=1000000,
            refunded_amount=50000,
            success_rate=0.9,
            period_start=now - timedelta(days=30),
            period_end=now,
        )

        assert stats.total_count == 100
        assert stats.succeeded_count == 90
        assert stats.success_rate == 0.9
        assert stats.refunded_amount == 50000


@pytest.mark.unit
class TestSubscriptionReadModels:
    """Test Subscription Read Models Pydantic validation"""

    def test_subscription_list_item_creation(self):
        """Test SubscriptionListItem model creation"""
        now = datetime.now(UTC)
        subscription = SubscriptionListItem(
            subscription_id="sub-123",
            customer_id="cust-456",
            customer_name="Company ABC",
            plan_id="plan-789",
            plan_name="Pro Plan",
            status="active",
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            cancel_at_period_end=False,
            monthly_amount=5000,
            currency="USD",
            created_at=now,
        )

        assert subscription.subscription_id == "sub-123"
        assert subscription.customer_name == "Company ABC"
        assert subscription.plan_name == "Pro Plan"
        assert subscription.monthly_amount == 5000
        assert subscription.cancel_at_period_end is False

    def test_subscription_detail_creation(self):
        """Test SubscriptionDetail model creation"""
        now = datetime.now(UTC)
        subscription = SubscriptionDetail(
            subscription_id="sub-123",
            tenant_id="tenant-1",
            customer_id="cust-456",
            plan_id="plan-789",
            status="active",
            quantity=5,
            billing_cycle_anchor=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            trial_start=None,
            trial_end=None,
            cancel_at_period_end=False,
            cancelled_at=None,
            ended_at=None,
            created_at=now,
            items=[{"plan_id": "plan-789", "quantity": 5}],
            latest_invoice_id="inv-latest",
        )

        assert subscription.subscription_id == "sub-123"
        assert subscription.tenant_id == "tenant-1"
        assert subscription.quantity == 5
        assert subscription.status == "active"
        assert len(subscription.items) == 1

    def test_subscription_statistics_creation(self):
        """Test SubscriptionStatistics model creation"""
        now = datetime.now(UTC)
        stats = SubscriptionStatistics(
            total_count=100,
            active_count=80,
            cancelled_count=15,
            trial_count=5,
            mrr=500000,  # Monthly Recurring Revenue
            arr=6000000,  # Annual Recurring Revenue
            churn_rate=0.05,
            growth_rate=0.10,
            currency="USD",
            period_start=now - timedelta(days=30),
            period_end=now,
        )

        assert stats.total_count == 100
        assert stats.active_count == 80
        assert stats.mrr == 500000
        assert stats.arr == 6000000
        assert stats.churn_rate == 0.05
        assert stats.growth_rate == 0.10


@pytest.mark.unit
class TestReadModelDefaults:
    """Test read model default values"""

    def test_invoice_statistics_defaults(self):
        """Test InvoiceStatistics default values"""
        now = datetime.now(UTC)
        stats = InvoiceStatistics(
            period_start=now - timedelta(days=30),
            period_end=now,
        )

        assert stats.total_count == 0
        assert stats.draft_count == 0
        assert stats.open_count == 0
        assert stats.paid_count == 0
        assert stats.void_count == 0
        assert stats.overdue_count == 0
        assert stats.total_amount == 0
        assert stats.paid_amount == 0
        assert stats.outstanding_amount == 0
        assert stats.overdue_amount == 0
        assert stats.average_invoice_amount == 0
        assert stats.currency == "USD"
        assert stats.formatted_total == "$0.00"
        assert stats.formatted_outstanding == "$0.00"

    def test_payment_statistics_defaults(self):
        """Test PaymentStatistics default values"""
        now = datetime.now(UTC)
        stats = PaymentStatistics(period_start=now - timedelta(days=30), period_end=now)

        assert stats.total_count == 0
        assert stats.succeeded_count == 0
        assert stats.failed_count == 0
        assert stats.refunded_count == 0
        assert stats.total_amount == 0
        assert stats.refunded_amount == 0

    def test_subscription_statistics_defaults(self):
        """Test SubscriptionStatistics default values"""
        now = datetime.now(UTC)
        stats = SubscriptionStatistics(period_start=now - timedelta(days=30), period_end=now)

        assert stats.total_count == 0
        assert stats.active_count == 0
        assert stats.cancelled_count == 0
        assert stats.trial_count == 0
        assert stats.mrr == 0
        assert stats.arr == 0
        assert stats.churn_rate == 0.0
        assert stats.growth_rate == 0.0
        assert stats.currency == "USD"


@pytest.mark.unit
class TestReadModelValidation:
    """Test Pydantic validation on read models"""

    def test_invoice_list_item_required_fields(self):
        """Test InvoiceListItem requires all non-optional fields"""
        with pytest.raises(ValidationError):
            InvoiceListItem()  # Missing required fields

    def test_payment_detail_from_attributes(self):
        """Test PaymentDetail can be created from entity attributes"""
        # Simulate entity attributes
        entity_data = {
            "payment_id": "pay-123",
            "tenant_id": "tenant-1",
            "invoice_id": "inv-456",
            "customer_id": "cust-789",
            "amount": 10000,
            "currency": "USD",
            "status": "succeeded",
            "payment_method_id": "pm-123",
            "payment_method": "card",
            "provider": "stripe",
            "external_payment_id": "pi_123",
            "created_at": datetime.now(UTC),
            "captured_at": datetime.now(UTC),
            "refunded_at": None,
            "refund_amount": 0,
            "description": "Test payment",
            "failure_reason": None,
        }

        payment = PaymentDetail.model_validate(entity_data)
        assert payment.payment_id == "pay-123"
        assert payment.amount == 10000

    def test_subscription_detail_items_default_factory(self):
        """Test SubscriptionDetail items defaults to empty list"""
        now = datetime.now(UTC)
        subscription = SubscriptionDetail(
            subscription_id="sub-123",
            tenant_id="tenant-1",
            customer_id="cust-456",
            plan_id="plan-789",
            status="active",
            quantity=1,
            billing_cycle_anchor=now,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
            trial_start=None,
            trial_end=None,
            cancel_at_period_end=False,
            cancelled_at=None,
            ended_at=None,
            created_at=now,
            latest_invoice_id=None,
        )

        assert subscription.items == []
