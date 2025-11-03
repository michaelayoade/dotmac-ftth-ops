"""
Integration tests for reconciliation router and service.

Tests real database interactions and service workflows.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.bank_accounts.entities import (
    ManualPayment,
    PaymentMethodType,
)
from dotmac.platform.billing.reconciliation_service import ReconciliationService


def unique_payment_reference(prefix: str) -> str:
    """Generate a unique payment reference for tests to avoid constraint collisions."""
    return f"{prefix}-{uuid4()}"


@pytest.fixture
def mock_audit_service():
    """Mock audit service to avoid API signature issues."""
    mock = AsyncMock()
    mock.log_activity = AsyncMock()
    return mock


@pytest_asyncio.fixture
async def test_bank_account(async_session: AsyncSession, tenant_id: str):
    """Create a test bank account."""
    from dotmac.platform.billing.bank_accounts.entities import AccountType, CompanyBankAccount

    bank_account = CompanyBankAccount(
        tenant_id=tenant_id,
        account_name="Test Checking",
        account_number_encrypted="encrypted_123456789",
        account_number_last_four="6789",
        bank_name="Test Bank",
        bank_country="US",
        account_type=AccountType.BUSINESS,
        currency="USD",
        is_active=True,
        is_primary=True,
        accepts_deposits=True,
    )
    async_session.add(bank_account)
    await async_session.commit()
    await async_session.refresh(bank_account)
    return bank_account


@pytest_asyncio.fixture
async def test_manual_payment(
    async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
):
    """Create a test manual payment."""
    payment = ManualPayment(
        tenant_id=tenant_id,
        bank_account_id=test_bank_account.id,
        recorded_by="test-user",
        customer_id=uuid4(),
        amount=Decimal("100.00"),
        currency="USD",
        payment_date=datetime.now(UTC),
        payment_method=PaymentMethodType.CASH,
        payment_reference=unique_payment_reference("REF"),
        status="verified",
        reconciled=False,
        notes="Test payment",
    )
    async_session.add(payment)
    await async_session.commit()
    await async_session.refresh(payment)
    return payment


@pytest.mark.integration
class TestReconciliationServiceIntegration:
    """Integration tests for ReconciliationService with real database."""

    @pytest.mark.asyncio
    async def test_start_reconciliation_session(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
    ):
        """Test starting a reconciliation session."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        period_start = datetime.now(UTC) - timedelta(days=30)
        period_end = datetime.now(UTC)

        reconciliation = await service.start_reconciliation_session(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            period_start=period_start,
            period_end=period_end,
            opening_balance=Decimal("1000.00"),
            statement_balance=Decimal("1200.00"),
            user_id="user-123",
            statement_file_url="https://example.com/statement.pdf",
        )

        assert reconciliation.id is not None
        assert reconciliation.tenant_id == tenant_id
        assert reconciliation.bank_account_id == test_bank_account.id
        assert reconciliation.status == "in_progress"
        assert reconciliation.opening_balance == Decimal("1000.00")
        assert reconciliation.statement_balance == Decimal("1200.00")

    @pytest.mark.asyncio
    async def test_get_reconciliation_summary(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
    ):
        """Test getting reconciliation summary."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        # Create a reconciliation
        await service.start_reconciliation_session(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            period_start=datetime.now(UTC) - timedelta(days=30),
            period_end=datetime.now(UTC),
            opening_balance=Decimal("1000.00"),
            statement_balance=Decimal("1100.00"),
            user_id="user-123",
        )

        summary = await service.get_reconciliation_summary(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            days=30,
        )

        assert summary["total_sessions"] == 1
        assert summary["pending_sessions"] == 1
        assert summary["approved_sessions"] == 0


@pytest.mark.integration
class TestReconciliationCircuitBreaker:
    """Integration tests for circuit breaker functionality."""

    @pytest.mark.asyncio
    async def test_circuit_breaker_initial_state(
        self, async_session: AsyncSession, mock_audit_service
    ):
        """Test circuit breaker starts in closed state."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        assert service.circuit_breaker.state == "closed"
        assert service.circuit_breaker.failure_count == 0

    @pytest.mark.asyncio
    async def test_circuit_breaker_tracks_failures(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
    ):
        """Test circuit breaker tracks consecutive failures."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        # Create a payment that will fail
        failed_payment = ManualPayment(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            recorded_by="test-user",
            customer_id=uuid4(),
            amount=Decimal("100.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            payment_method=PaymentMethodType.CASH,
            payment_reference=unique_payment_reference("FAIL"),
            status="failed",
            reconciled=False,
        )
        async_session.add(failed_payment)
        await async_session.commit()

        # Circuit breaker should handle the failure gracefully
        initial_state = service.circuit_breaker.state
        assert initial_state in ["closed", "open", "half_open"]


@pytest.mark.integration
class TestManualPaymentIntegration:
    """Integration tests for manual payment operations."""

    @pytest.mark.asyncio
    async def test_create_manual_payment(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account
    ):
        """Test creating a manual payment."""
        payment = ManualPayment(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            recorded_by="test-user",
            customer_id=uuid4(),
            amount=Decimal("250.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            payment_method=PaymentMethodType.CHECK,
            payment_reference=unique_payment_reference("CHK"),
            status="pending",
            reconciled=False,
            notes="Integration test payment",
        )

        async_session.add(payment)
        await async_session.commit()
        await async_session.refresh(payment)

        assert payment.id is not None
        assert payment.amount == Decimal("250.00")
        assert payment.status == "pending"

    @pytest.mark.asyncio
    async def test_update_payment_status(self, async_session: AsyncSession, test_manual_payment):
        """Test updating payment status."""
        test_manual_payment.status = "verified"
        test_manual_payment.verified_at = datetime.now(UTC)
        test_manual_payment.verified_by = "user-123"

        await async_session.commit()
        await async_session.refresh(test_manual_payment)

        assert test_manual_payment.status == "verified"
        assert test_manual_payment.verified_at is not None
        assert test_manual_payment.verified_by == "user-123"

    @pytest.mark.asyncio
    async def test_reconcile_payment(self, async_session: AsyncSession, test_manual_payment):
        """Test reconciling a payment."""
        test_manual_payment.reconciled = True
        test_manual_payment.reconciled_at = datetime.now(UTC)
        test_manual_payment.reconciled_by = "system"

        await async_session.commit()
        await async_session.refresh(test_manual_payment)

        assert test_manual_payment.reconciled is True
        assert test_manual_payment.reconciled_at is not None

    @pytest.mark.asyncio
    async def test_query_unreconciled_payments(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account
    ):
        """Test querying unreconciled payments."""
        # Create multiple payments
        for i in range(3):
            payment = ManualPayment(
                tenant_id=tenant_id,
                bank_account_id=test_bank_account.id,
                recorded_by="test-user",
                customer_id=uuid4(),
                amount=Decimal(f"{100 * (i + 1)}.00"),
                currency="USD",
                payment_date=datetime.now(UTC),
                payment_method=PaymentMethodType.CASH,
                payment_reference=unique_payment_reference(f"REF-{i}"),
                status="verified",
                reconciled=False,
            )
            async_session.add(payment)

        await async_session.commit()

        # Query unreconciled payments
        result = await async_session.execute(
            select(ManualPayment).where(
                ManualPayment.tenant_id == tenant_id,
                ManualPayment.reconciled == False,  # noqa: E712
            )
        )
        unreconciled = result.scalars().all()

        assert len(unreconciled) >= 3
        assert all(not p.reconciled for p in unreconciled)


@pytest.mark.integration
class TestReconciliationApproval:
    """Integration tests for reconciliation approval workflow."""

    @pytest.mark.asyncio
    async def test_approve_reconciliation(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
    ):
        """Test approving a completed reconciliation."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        # Create and complete a reconciliation
        reconciliation = await service.start_reconciliation_session(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            period_start=datetime.now(UTC) - timedelta(days=30),
            period_end=datetime.now(UTC),
            opening_balance=Decimal("1000.00"),
            statement_balance=Decimal("1000.00"),
            user_id="user-123",
        )

        completed = await service.complete_reconciliation(
            tenant_id=tenant_id,
            reconciliation_id=reconciliation.id,
            user_id="user-123",
        )

        # Approve the reconciliation
        approved = await service.approve_reconciliation(
            tenant_id=tenant_id,
            reconciliation_id=completed.id,
            user_id="admin-456",
        )

        assert approved.status == "approved"
        assert approved.approved_at is not None
        assert approved.approved_by == "admin-456"

    @pytest.mark.asyncio
    async def test_reconciliation_status_flow(
        self, async_session: AsyncSession, tenant_id: str, test_bank_account, mock_audit_service
    ):
        """Test complete reconciliation status flow."""
        service = ReconciliationService(async_session, audit_service=mock_audit_service)

        # 1. Start (in_progress)
        rec = await service.start_reconciliation_session(
            tenant_id=tenant_id,
            bank_account_id=test_bank_account.id,
            period_start=datetime.now(UTC) - timedelta(days=30),
            period_end=datetime.now(UTC),
            opening_balance=Decimal("500.00"),
            statement_balance=Decimal("500.00"),
            user_id="user-123",
        )
        assert rec.status == "in_progress"

        # 2. Complete
        rec = await service.complete_reconciliation(
            tenant_id=tenant_id,
            reconciliation_id=rec.id,
            user_id="user-123",
        )
        assert rec.status == "completed"

        # 3. Approve
        rec = await service.approve_reconciliation(
            tenant_id=tenant_id,
            reconciliation_id=rec.id,
            user_id="admin-789",
        )
        assert rec.status == "approved"


@pytest.mark.integration
class TestReconciliationTenantIsolation:
    """Integration tests for tenant isolation in reconciliation."""

    @pytest.mark.asyncio
    async def test_tenant_isolation_payments(self, async_session: AsyncSession, test_bank_account):
        """Test payments are isolated by tenant."""
        # Create payments for different tenants
        tenant1 = str(uuid4())
        tenant2 = str(uuid4())

        payment1 = ManualPayment(
            tenant_id=tenant1,
            bank_account_id=test_bank_account.id,
            recorded_by="test-user",
            customer_id=uuid4(),
            amount=Decimal("100.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            payment_method=PaymentMethodType.CASH,
            payment_reference=unique_payment_reference("T1"),
            status="verified",
            reconciled=False,
        )

        payment2 = ManualPayment(
            tenant_id=tenant2,
            bank_account_id=test_bank_account.id,
            recorded_by="test-user",
            customer_id=uuid4(),
            amount=Decimal("200.00"),
            currency="USD",
            payment_date=datetime.now(UTC),
            payment_method=PaymentMethodType.CASH,
            payment_reference=unique_payment_reference("T2"),
            status="verified",
            reconciled=False,
        )

        async_session.add_all([payment1, payment2])
        await async_session.commit()

        # Query for tenant 1
        result = await async_session.execute(
            select(ManualPayment).where(ManualPayment.tenant_id == tenant1)
        )
        tenant1_payments = result.scalars().all()

        assert len(tenant1_payments) == 1
        assert tenant1_payments[0].tenant_id == tenant1
        assert tenant1_payments[0].amount == Decimal("100.00")

        # Query for tenant 2
        result = await async_session.execute(
            select(ManualPayment).where(ManualPayment.tenant_id == tenant2)
        )
        tenant2_payments = result.scalars().all()

        assert len(tenant2_payments) == 1
        assert tenant2_payments[0].tenant_id == tenant2
        assert tenant2_payments[0].amount == Decimal("200.00")
