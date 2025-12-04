"""
Comprehensive tests for BankAccountService and ManualPaymentService.

Tests bank account management and manual payment processing with real DB.
"""

from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from dotmac.platform.billing.bank_accounts.entities import (
    BankAccountStatus,
    PaymentMethodType,
)
from dotmac.platform.billing.bank_accounts.models import (
    BankTransferCreate,
    CashPaymentCreate,
    CheckPaymentCreate,
    CompanyBankAccountCreate,
    CompanyBankAccountUpdate,
    MobileMoneyCreate,
    PaymentSearchFilters,
)
from dotmac.platform.billing.bank_accounts.service import (
    BankAccountService,
    ManualPaymentService,
)
from dotmac.platform.billing.core.exceptions import BillingError, PaymentError

# Use the async_session fixture from tests/conftest.py
# This provides a real SQLite database session


@pytest.mark.integration
class TestBankAccountServiceCreate:
    """Test bank account creation with real database."""

    @pytest.mark.asyncio
    async def test_create_bank_account_success(self, async_session):
        """Test successful bank account creation."""
        service = BankAccountService(db=async_session)

        create_data = CompanyBankAccountCreate(
            account_name="Test Account",
            account_nickname="Test",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="123456789",
            account_type="checking",
            currency="USD",
            routing_number="123456789",
            swift_code="TEST",
            iban=None,
            is_primary=False,
            accepts_deposits=True,
            notes="Test",
        )

        result = await service.create_bank_account(
            tenant_id="tenant-123", data=create_data, created_by="user-123"
        )

        assert result.account_name == "Test Account"
        assert result.account_number_last_four == "6789"
        assert not result.is_primary
        assert result.status == BankAccountStatus.PENDING

    @pytest.mark.asyncio
    async def test_create_primary_account_unsets_others(self, async_session):
        """Test creating primary account unsets other primary accounts."""
        service = BankAccountService(db=async_session)

        # Create first primary account
        create_data1 = CompanyBankAccountCreate(
            account_name="Old Primary",
            account_nickname="Old",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="111111111",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        result1 = await service.create_bank_account(
            tenant_id="tenant-123", data=create_data1, created_by="user-123"
        )
        assert result1.is_primary

        # Create second primary account
        create_data2 = CompanyBankAccountCreate(
            account_name="New Primary",
            account_nickname="New",
            bank_name="Test Bank",
            bank_address="456 St",
            bank_country="US",
            account_number="222222222",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        result2 = await service.create_bank_account(
            tenant_id="tenant-123", data=create_data2, created_by="user-123"
        )

        # New account should be primary
        assert result2.is_primary

        # Old account should no longer be primary
        old_account = await service.get_bank_account("tenant-123", result1.id)
        assert not old_account.is_primary


class TestBankAccountServiceRead:
    """Test bank account retrieval."""

    @pytest.mark.asyncio
    async def test_get_bank_accounts_active_only(self, async_session):
        """Test getting only active bank accounts."""
        service = BankAccountService(db=async_session)

        # Create active account
        active_data = CompanyBankAccountCreate(
            account_name="Active Account",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="111111111",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )
        await service.create_bank_account("tenant-123", active_data, "user-123")

        # Create and deactivate another account
        inactive_data = CompanyBankAccountCreate(
            account_name="Inactive Account",
            bank_name="Test Bank",
            bank_address="456 St",
            bank_country="US",
            account_number="222222222",
            account_type="savings",
            currency="USD",
            is_primary=False,
            accepts_deposits=True,
        )
        inactive_account = await service.create_bank_account(
            "tenant-123", inactive_data, "user-123"
        )
        await service.deactivate_bank_account("tenant-123", inactive_account.id, "user-123")

        # Get only active accounts
        result = await service.get_bank_accounts("tenant-123", include_inactive=False)
        assert len(result) == 1
        assert result[0].account_name == "Active Account"

        # Get all accounts including inactive
        all_accounts = await service.get_bank_accounts("tenant-123", include_inactive=True)
        assert len(all_accounts) == 2

    @pytest.mark.asyncio
    async def test_get_bank_account_by_id(self, async_session):
        """Test getting specific bank account."""
        service = BankAccountService(db=async_session)

        create_data = CompanyBankAccountCreate(
            account_name="Specific Account",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="333333333",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        created = await service.create_bank_account("tenant-123", create_data, "user-123")

        result = await service.get_bank_account("tenant-123", created.id)
        assert result is not None
        assert result.account_name == "Specific Account"
        assert result.id == created.id

    @pytest.mark.asyncio
    async def test_get_bank_account_not_found(self, async_session):
        """Test getting non-existent bank account."""
        service = BankAccountService(db=async_session)

        result = await service.get_bank_account("tenant-123", 99999)
        assert result is None


class TestBankAccountServiceUpdate:
    """Test bank account updates."""

    @pytest.mark.asyncio
    async def test_update_bank_account_success(self, async_session):
        """Test successful bank account update."""
        service = BankAccountService(db=async_session)

        create_data = CompanyBankAccountCreate(
            account_name="Original Name",
            account_nickname="Original",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="444444444",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        created = await service.create_bank_account("tenant-123", create_data, "user-123")

        update_data = CompanyBankAccountUpdate(
            account_nickname="Updated Nickname",
            notes="Updated notes",
        )

        result = await service.update_bank_account(
            "tenant-123", created.id, update_data, "user-123"
        )

        assert result.account_nickname == "Updated Nickname"
        assert result.notes == "Updated notes"
        assert result.account_name == "Original Name"  # Unchanged

    @pytest.mark.asyncio
    async def test_update_bank_account_not_found(self, async_session):
        """Test updating non-existent bank account."""
        service = BankAccountService(db=async_session)

        update_data = CompanyBankAccountUpdate(notes="Test")

        with pytest.raises(BillingError, match="not found"):
            await service.update_bank_account("tenant-123", 99999, update_data, "user-123")


class TestBankAccountServiceVerification:
    """Test bank account verification."""

    @pytest.mark.asyncio
    async def test_verify_bank_account_success(self, async_session):
        """Test successful bank account verification."""
        service = BankAccountService(db=async_session)

        create_data = CompanyBankAccountCreate(
            account_name="To Verify",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="555555555",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        created = await service.create_bank_account("tenant-123", create_data, "user-123")
        assert created.status == BankAccountStatus.PENDING

        result = await service.verify_bank_account(
            "tenant-123", created.id, "admin-123", "Verified documents"
        )

        assert result.status == BankAccountStatus.VERIFIED
        assert result.verified_at is not None
        assert result.verification_notes == "Verified documents"


class TestBankAccountServiceDeactivation:
    """Test bank account deactivation."""

    @pytest.mark.asyncio
    async def test_deactivate_bank_account_success(self, async_session):
        """Test successful bank account deactivation."""
        service = BankAccountService(db=async_session)

        # Create primary account first
        primary_data = CompanyBankAccountCreate(
            account_name="Primary",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="666666666",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )
        await service.create_bank_account("tenant-123", primary_data, "user-123")

        # Create secondary account to deactivate
        secondary_data = CompanyBankAccountCreate(
            account_name="Secondary",
            bank_name="Test Bank",
            bank_address="456 St",
            bank_country="US",
            account_number="777777777",
            account_type="savings",
            currency="USD",
            is_primary=False,
            accepts_deposits=True,
        )
        secondary = await service.create_bank_account("tenant-123", secondary_data, "user-123")

        result = await service.deactivate_bank_account("tenant-123", secondary.id, "user-123")

        assert not result.is_active

    @pytest.mark.asyncio
    async def test_cannot_deactivate_primary_account(self, async_session):
        """Test cannot deactivate primary bank account."""
        service = BankAccountService(db=async_session)

        create_data = CompanyBankAccountCreate(
            account_name="Primary Account",
            bank_name="Test Bank",
            bank_address="123 St",
            bank_country="US",
            account_number="888888888",
            account_type="checking",
            currency="USD",
            is_primary=True,
            accepts_deposits=True,
        )

        created = await service.create_bank_account("tenant-123", create_data, "user-123")

        with pytest.raises(BillingError, match="Cannot deactivate primary"):
            await service.deactivate_bank_account("tenant-123", created.id, "user-123")


class TestManualPaymentServiceCash:
    """Test cash payment recording."""

    @pytest.mark.asyncio
    async def test_record_cash_payment_success(self, async_session):
        """Test recording cash payment."""
        service = ManualPaymentService(db=async_session)

        payment_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-789",
            bank_account_id=1,
            amount=Decimal("100.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-001",
            cashier_name="John Doe",
        )

        result = await service.record_cash_payment("tenant-123", payment_data, "user-123")

        assert result.payment_method == PaymentMethodType.CASH
        assert result.amount == 100.00
        assert result.status == "pending"
        assert "CASH-" in result.payment_reference
        assert result.cashier_name == "John Doe"


class TestManualPaymentServiceCheck:
    """Test check payment recording."""

    @pytest.mark.asyncio
    async def test_record_check_payment_success(self, async_session):
        """Test recording check payment."""
        service = ManualPaymentService(db=async_session)

        payment_data = CheckPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-789",
            bank_account_id=1,
            amount=Decimal("500.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            received_date=datetime.now(UTC),
            check_number="CHK-001",
            check_bank_name="Customer Bank",
        )

        result = await service.record_check_payment("tenant-123", payment_data, "user-123")

        assert result.payment_method == PaymentMethodType.CHECK
        assert result.check_number == "CHK-001"
        assert "CHK-" in result.payment_reference


class TestManualPaymentServiceBankTransfer:
    """Test bank transfer recording."""

    @pytest.mark.asyncio
    async def test_record_bank_transfer_success(self, async_session):
        """Test recording bank transfer."""
        service = ManualPaymentService(db=async_session)

        payment_data = BankTransferCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-789",
            bank_account_id=1,
            payment_method=PaymentMethodType.WIRE_TRANSFER,
            amount=Decimal("1000.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            received_date=datetime.now(UTC),
            sender_name="Customer Company",
            sender_bank="Customer Bank",
            sender_account_last_four="9876",
        )

        result = await service.record_bank_transfer("tenant-123", payment_data, "user-123")

        assert result.payment_method == PaymentMethodType.WIRE_TRANSFER
        assert result.sender_name == "Customer Company"
        assert "TRF-" in result.payment_reference


class TestManualPaymentServiceMobileMoney:
    """Test mobile money payment recording."""

    @pytest.mark.asyncio
    async def test_record_mobile_money_success(self, async_session):
        """Test recording mobile money payment."""
        service = ManualPaymentService(db=async_session)

        payment_data = MobileMoneyCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-789",
            bank_account_id=1,
            amount=Decimal("50.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            received_date=datetime.now(UTC),
            mobile_number="+1234567890",
            mobile_provider="M-Pesa",
        )

        result = await service.record_mobile_money("tenant-123", payment_data, "user-123")

        assert result.payment_method == PaymentMethodType.MOBILE_MONEY
        assert result.mobile_provider == "M-Pesa"
        assert "MOB-" in result.payment_reference


class TestManualPaymentServiceSearch:
    """Test payment search functionality."""

    @pytest.mark.asyncio
    async def test_search_payments_by_customer(self, async_session):
        """Test searching payments by customer."""
        service = ManualPaymentService(db=async_session)

        # Create customer UUID for testing
        test_customer_id = str(uuid4())

        # Create payment
        payment_data = CashPaymentCreate(
            customer_id=test_customer_id,
            invoice_id="inv-search-456",
            bank_account_id=1,
            amount=Decimal("75.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-001",
        )
        await service.record_cash_payment("tenant-123", payment_data, "user-123")

        # Search by customer
        filters = PaymentSearchFilters(customer_id=test_customer_id)
        results = await service.search_payments("tenant-123", filters)

        assert len(results) >= 1
        assert all(p.customer_id == test_customer_id for p in results)

    @pytest.mark.asyncio
    async def test_search_payments_by_status(self, async_session):
        """Test searching payments by status."""
        service = ManualPaymentService(db=async_session)

        # Create payment
        payment_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-status-456",
            bank_account_id=1,
            amount=Decimal("85.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-002",
        )
        created = await service.record_cash_payment("tenant-123", payment_data, "user-123")

        # Search by pending status
        filters = PaymentSearchFilters(status="pending")
        results = await service.search_payments("tenant-123", filters)

        assert len(results) >= 1
        assert any(p.id == created.id for p in results)


class TestManualPaymentServiceVerification:
    """Test payment verification."""

    @pytest.mark.asyncio
    async def test_verify_payment_success(self, async_session):
        """Test verifying a payment."""
        service = ManualPaymentService(db=async_session)

        # Create payment
        payment_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-verify-456",
            bank_account_id=1,
            amount=Decimal("95.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-003",
        )
        created = await service.record_cash_payment("tenant-123", payment_data, "user-123")

        # Verify payment
        result = await service.verify_payment(
            "tenant-123", created.id, "manager-123", "Verified receipt"
        )

        assert result.status == "verified"
        assert result.approved_by == "manager-123"
        assert result.approved_at is not None

    @pytest.mark.asyncio
    async def test_verify_payment_not_found(self, async_session):
        """Test verifying non-existent payment."""
        service = ManualPaymentService(db=async_session)

        with pytest.raises(PaymentError, match="not found"):
            await service.verify_payment("tenant-123", 99999, "user-123")


class TestManualPaymentServiceReconciliation:
    """Test payment reconciliation."""

    @pytest.mark.asyncio
    async def test_reconcile_payments_success(self, async_session):
        """Test reconciling multiple payments."""
        service = ManualPaymentService(db=async_session)

        # Create two payments
        payment1_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-recon-1",
            bank_account_id=1,
            amount=Decimal("100.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-004",
        )
        payment1 = await service.record_cash_payment("tenant-123", payment1_data, "user-123")

        payment2_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-recon-2",
            bank_account_id=1,
            amount=Decimal("200.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-004",
        )
        payment2 = await service.record_cash_payment("tenant-123", payment2_data, "user-123")

        # Reconcile both
        results = await service.reconcile_payments(
            "tenant-123", [payment1.id, payment2.id], "accountant-123", "Month-end reconciliation"
        )

        assert len(results) == 2
        assert all(p.status == "reconciled" for p in results)
        assert all(p.reconciled for p in results)

    @pytest.mark.asyncio
    async def test_reconcile_payments_not_all_found(self, async_session):
        """Test reconciling when some payments not found."""
        service = ManualPaymentService(db=async_session)

        # Create one payment
        payment_data = CashPaymentCreate(
            customer_id=str(uuid4()),
            invoice_id="inv-recon-partial",
            bank_account_id=1,
            amount=Decimal("50.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            cash_register_id="REG-005",
        )
        created = await service.record_cash_payment("tenant-123", payment_data, "user-123")

        # Try to reconcile with non-existent payment
        with pytest.raises(PaymentError, match="Some payments not found"):
            await service.reconcile_payments("tenant-123", [created.id, 99998, 99999], "user-123")


class TestHelperMethods:
    """Test helper methods."""

    def test_encrypt_account_number(self, async_session):
        """Test account number encryption."""
        service = BankAccountService(db=async_session)
        encrypted = service._encrypt_account_number("123456789")

        # Assert encrypted format
        assert "$" in encrypted  # Has salt separator
        assert len(encrypted) > 20  # Is sufficiently long

    def test_generate_payment_reference(self, async_session):
        """Test payment reference generation."""
        service = ManualPaymentService(db=async_session)
        ref = service._generate_payment_reference("CASH")

        # Assert format
        assert ref.startswith("CASH-")
        assert len(ref) > 10  # Has timestamp and random suffix
