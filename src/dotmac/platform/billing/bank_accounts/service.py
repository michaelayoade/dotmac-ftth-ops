"""
Bank account and manual payment service
"""

import hashlib
import logging
import secrets
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.bank_accounts.entities import (
    BankAccountStatus,
    CompanyBankAccount,
    ManualPayment,
    PaymentMethodType,
    PaymentReconciliation,
)
from dotmac.platform.billing.bank_accounts.models import AccountType as AccountTypeModel
from dotmac.platform.billing.bank_accounts.models import BankAccountStatus as BankAccountStatusModel
from dotmac.platform.billing.bank_accounts.models import (
    BankAccountSummary,
    BankTransferCreate,
    CashPaymentCreate,
    CheckPaymentCreate,
    CompanyBankAccountCreate,
    CompanyBankAccountResponse,
    CompanyBankAccountUpdate,
    ManualPaymentResponse,
    MobileMoneyCreate,
    PaymentSearchFilters,
)
from dotmac.platform.billing.bank_accounts.models import PaymentMethodType as PaymentMethodTypeModel
from dotmac.platform.billing.core.exceptions import (
    BillingError,
    PaymentError,
)
from dotmac.platform.billing.recovery import (
    BillingRetry,
    CircuitBreaker,
    ExponentialBackoff,
)

logger = logging.getLogger(__name__)


class BankAccountService:
    """Service for managing company bank accounts"""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        # Initialize recovery helpers
        self.retry_manager = BillingRetry(
            max_attempts=3, strategy=ExponentialBackoff(base_delay=1.0, max_delay=30.0)
        )
        self.circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60.0)

    async def create_bank_account(
        self, tenant_id: str, data: CompanyBankAccountCreate, created_by: str
    ) -> CompanyBankAccountResponse:
        """Create a new company bank account"""

        # Encrypt account number (in production, use proper encryption)
        account_number_encrypted = self._encrypt_account_number(data.account_number)
        account_number_last_four = data.account_number[-4:]

        # If this is marked as primary, unset other primary accounts
        if data.is_primary:
            await self._unset_primary_accounts(tenant_id)

        account = CompanyBankAccount(
            tenant_id=tenant_id,
            account_name=data.account_name,
            account_nickname=data.account_nickname,
            bank_name=data.bank_name,
            bank_address=data.bank_address,
            bank_country=data.bank_country,
            account_number_encrypted=account_number_encrypted,
            account_number_last_four=account_number_last_four,
            account_type=data.account_type,
            currency=data.currency,
            routing_number=data.routing_number,
            swift_code=data.swift_code,
            iban=data.iban,
            is_primary=data.is_primary,
            accepts_deposits=data.accepts_deposits,
            notes=data.notes,
            created_by=created_by,
            updated_by=created_by,
        )

        self.db.add(account)
        await self.db.commit()
        await self.db.refresh(account)

        logger.info(f"Created bank account {account.id} for tenant {tenant_id}")
        return self._to_response(account)

    async def get_bank_accounts(
        self, tenant_id: str, include_inactive: bool = False
    ) -> list[CompanyBankAccountResponse]:
        """Get all bank accounts for a tenant"""

        query = select(CompanyBankAccount).where(CompanyBankAccount.tenant_id == tenant_id)

        if not include_inactive:
            query = query.where(CompanyBankAccount.is_active)

        result = await self.db.execute(
            query.order_by(CompanyBankAccount.is_primary.desc(), CompanyBankAccount.account_name)
        )
        accounts = result.scalars().all()

        return [self._to_response(account) for account in accounts]

    async def get_bank_account(
        self, tenant_id: str, account_id: int
    ) -> CompanyBankAccountResponse | None:
        """Get a specific bank account"""

        result = await self.db.execute(
            select(CompanyBankAccount).where(
                and_(CompanyBankAccount.tenant_id == tenant_id, CompanyBankAccount.id == account_id)
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            return None

        return self._to_response(account)

    async def update_bank_account(
        self, tenant_id: str, account_id: int, data: CompanyBankAccountUpdate, updated_by: str
    ) -> CompanyBankAccountResponse:
        """Update a bank account"""

        result = await self.db.execute(
            select(CompanyBankAccount).where(
                and_(CompanyBankAccount.tenant_id == tenant_id, CompanyBankAccount.id == account_id)
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise BillingError(f"Bank account {account_id} not found")

        # If setting as primary, unset others
        if data.is_primary is True:
            await self._unset_primary_accounts(tenant_id, exclude_id=account_id)

        # Update fields
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(account, field, value)

        account.updated_by = updated_by
        account.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(account)

        logger.info(f"Updated bank account {account_id}")
        return self._to_response(account)

    async def verify_bank_account(
        self, tenant_id: str, account_id: int, verified_by: str, notes: str | None = None
    ) -> CompanyBankAccountResponse:
        """Mark a bank account as verified"""

        result = await self.db.execute(
            select(CompanyBankAccount).where(
                and_(CompanyBankAccount.tenant_id == tenant_id, CompanyBankAccount.id == account_id)
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise BillingError(f"Bank account {account_id} not found")

        account.status = BankAccountStatus.VERIFIED
        account.verified_at = datetime.now(UTC)
        account.verified_by = verified_by
        account.verification_notes = notes
        account.updated_by = verified_by
        account.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(account)

        logger.info(f"Verified bank account {account_id}")
        return self._to_response(account)

    async def deactivate_bank_account(
        self, tenant_id: str, account_id: int, updated_by: str
    ) -> CompanyBankAccountResponse:
        """Deactivate a bank account"""

        result = await self.db.execute(
            select(CompanyBankAccount).where(
                and_(CompanyBankAccount.tenant_id == tenant_id, CompanyBankAccount.id == account_id)
            )
        )
        account = result.scalar_one_or_none()

        if not account:
            raise BillingError(f"Bank account {account_id} not found")

        if account.is_primary:
            raise BillingError("Cannot deactivate primary bank account")

        account.is_active = False
        account.updated_by = updated_by
        account.updated_at = datetime.now(UTC)

        await self.db.commit()
        await self.db.refresh(account)

        logger.info(f"Deactivated bank account {account_id}")
        return self._to_response(account)

    async def get_bank_account_summary(self, tenant_id: str, account_id: int) -> BankAccountSummary:
        """Get bank account with summary statistics"""

        account_response = await self.get_bank_account(tenant_id, account_id)
        if not account_response:
            raise BillingError(f"Bank account {account_id} not found")

        # Calculate MTD deposits
        today = datetime.now(UTC)
        month_start = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        mtd_result = await self.db.execute(
            select(func.sum(ManualPayment.amount)).where(
                and_(
                    ManualPayment.tenant_id == tenant_id,
                    ManualPayment.bank_account_id == account_id,
                    ManualPayment.payment_date >= month_start,
                    ManualPayment.status.in_(["verified", "reconciled"]),
                )
            )
        )
        total_deposits_mtd = mtd_result.scalar() or 0.00

        # Calculate YTD deposits
        year_start = today.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

        ytd_result = await self.db.execute(
            select(func.sum(ManualPayment.amount)).where(
                and_(
                    ManualPayment.tenant_id == tenant_id,
                    ManualPayment.bank_account_id == account_id,
                    ManualPayment.payment_date >= year_start,
                    ManualPayment.status.in_(["verified", "reconciled"]),
                )
            )
        )
        total_deposits_ytd = ytd_result.scalar() or 0.00

        # Count pending payments
        pending_result = await self.db.execute(
            select(func.count(ManualPayment.id)).where(
                and_(
                    ManualPayment.tenant_id == tenant_id,
                    ManualPayment.bank_account_id == account_id,
                    ManualPayment.status == "pending",
                )
            )
        )
        pending_payments = pending_result.scalar() or 0

        # Get last reconciliation
        recon_result = await self.db.execute(
            select(PaymentReconciliation.reconciliation_date)
            .where(
                and_(
                    PaymentReconciliation.tenant_id == tenant_id,
                    PaymentReconciliation.bank_account_id == account_id,
                    PaymentReconciliation.status == "completed",
                )
            )
            .order_by(PaymentReconciliation.reconciliation_date.desc())
            .limit(1)
        )
        last_reconciliation = recon_result.scalar()

        return BankAccountSummary(
            account=account_response,
            total_deposits_mtd=float(total_deposits_mtd),
            total_deposits_ytd=float(total_deposits_ytd),
            pending_payments=pending_payments,
            last_reconciliation=last_reconciliation,
        )

    # Private helper methods
    async def _unset_primary_accounts(self, tenant_id: str, exclude_id: int | None = None) -> None:
        """Unset primary flag on all accounts except the excluded one"""

        query = select(CompanyBankAccount).where(
            and_(CompanyBankAccount.tenant_id == tenant_id, CompanyBankAccount.is_primary)
        )

        if exclude_id:
            query = query.where(CompanyBankAccount.id != exclude_id)

        result = await self.db.execute(query)
        accounts = result.scalars().all()

        for account in accounts:
            account.is_primary = False

    def _encrypt_account_number(self, account_number: str) -> str:
        """Encrypt account number (use proper encryption in production)"""
        # This is a simple hash for demo - use proper encryption in production
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac("sha256", account_number.encode(), salt.encode(), 100000)
        return f"{salt}${hashed.hex()}"

    def _to_response(self, account: CompanyBankAccount) -> CompanyBankAccountResponse:
        """Convert entity to response model"""
        tenant_id_value = account.tenant_id or ""

        try:
            account_type_model = AccountTypeModel(account.account_type.value)
        except ValueError:
            logger.warning(
                "Unknown account type value %s; defaulting for account %s",
                account.account_type,
                account.id,
            )
            account_type_model = AccountTypeModel.CHECKING

        try:
            status_model = BankAccountStatusModel(account.status.value)
        except ValueError:
            logger.warning(
                "Unknown bank account status %s; defaulting for account %s",
                account.status,
                account.id,
            )
            status_model = BankAccountStatusModel.PENDING

        return CompanyBankAccountResponse(
            id=account.id,
            tenant_id=tenant_id_value,
            account_name=account.account_name,
            account_nickname=account.account_nickname,
            bank_name=account.bank_name,
            bank_address=account.bank_address,
            bank_country=account.bank_country,
            account_number_last_four=account.account_number_last_four,
            account_type=account_type_model,
            currency=account.currency,
            routing_number=account.routing_number,
            swift_code=account.swift_code,
            iban=account.iban,
            status=status_model,
            is_primary=account.is_primary,
            is_active=account.is_active,
            accepts_deposits=account.accepts_deposits,
            verified_at=account.verified_at,
            verification_notes=account.verification_notes,
            created_at=account.created_at,
            updated_at=account.updated_at,
            notes=account.notes,
            metadata=account.meta_data or {},
        )


class ManualPaymentService:
    """Service for recording manual payments"""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        # Initialize recovery helpers
        self.retry_manager = BillingRetry(
            max_attempts=3, strategy=ExponentialBackoff(base_delay=1.0, max_delay=30.0)
        )
        self.circuit_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60.0)

    async def record_cash_payment(
        self, tenant_id: str, data: CashPaymentCreate, recorded_by: str
    ) -> ManualPaymentResponse:
        """Record a cash payment"""

        payment_reference = self._generate_payment_reference("CASH")

        # Convert customer_id to UUID if it's a string
        customer_uuid = (
            UUID(data.customer_id) if isinstance(data.customer_id, str) else data.customer_id
        )

        payment = ManualPayment(
            tenant_id=tenant_id,
            payment_reference=payment_reference,
            customer_id=customer_uuid,
            invoice_id=data.invoice_id,
            bank_account_id=data.bank_account_id,
            payment_method=PaymentMethodType.CASH,
            amount=data.amount,
            currency=data.currency,
            payment_date=data.payment_date,
            received_date=data.received_date or data.payment_date,
            external_reference=data.external_reference,
            cash_register_id=data.cash_register_id,
            cashier_name=data.cashier_name,
            notes=data.notes,
            status="pending",
            recorded_by=recorded_by,
            created_by=recorded_by,
            updated_by=recorded_by,
        )

        # Use retry logic for database operations
        async def _save_payment() -> ManualPayment:
            self.db.add(payment)
            await self.db.commit()
            await self.db.refresh(payment)
            return payment

        try:
            saved_payment = await self.retry_manager.execute(_save_payment)
            logger.info(f"Recorded cash payment {saved_payment.id} for customer {data.customer_id}")
            return self._to_payment_response(saved_payment)
        except Exception as e:
            logger.error(f"Failed to record cash payment: {e}")
            await self.db.rollback()
            raise PaymentError(f"Failed to record cash payment: {e}")

    async def record_check_payment(
        self, tenant_id: str, data: CheckPaymentCreate, recorded_by: str
    ) -> ManualPaymentResponse:
        """Record a check payment"""

        payment_reference = self._generate_payment_reference("CHK")

        # Convert customer_id to UUID if it's a string
        customer_uuid = (
            UUID(data.customer_id) if isinstance(data.customer_id, str) else data.customer_id
        )

        payment = ManualPayment(
            tenant_id=tenant_id,
            payment_reference=payment_reference,
            customer_id=customer_uuid,
            invoice_id=data.invoice_id,
            bank_account_id=data.bank_account_id,
            payment_method=PaymentMethodType.CHECK,
            amount=data.amount,
            currency=data.currency,
            payment_date=data.payment_date,
            received_date=data.received_date,
            external_reference=data.external_reference or data.check_number,
            check_number=data.check_number,
            check_bank_name=data.check_bank_name,
            notes=data.notes,
            status="pending",
            recorded_by=recorded_by,
            created_by=recorded_by,
            updated_by=recorded_by,
        )

        # Use retry logic for database operations
        async def _save_payment() -> ManualPayment:
            self.db.add(payment)
            await self.db.commit()
            await self.db.refresh(payment)
            return payment

        try:
            saved_payment = await self.retry_manager.execute(_save_payment)
            logger.info(
                f"Recorded check payment {saved_payment.id} for customer {data.customer_id}"
            )
            return self._to_payment_response(saved_payment)
        except Exception as e:
            logger.error(f"Failed to record check payment: {e}")
            await self.db.rollback()
            raise PaymentError(f"Failed to record check payment: {e}")

    async def record_bank_transfer(
        self, tenant_id: str, data: BankTransferCreate, recorded_by: str
    ) -> ManualPaymentResponse:
        """Record a bank transfer"""

        payment_reference = self._generate_payment_reference("TRF")

        # Convert customer_id to UUID if it's a string
        customer_uuid = (
            UUID(data.customer_id) if isinstance(data.customer_id, str) else data.customer_id
        )

        payment = ManualPayment(
            tenant_id=tenant_id,
            payment_reference=payment_reference,
            customer_id=customer_uuid,
            invoice_id=data.invoice_id,
            bank_account_id=data.bank_account_id,
            payment_method=data.payment_method,
            amount=data.amount,
            currency=data.currency,
            payment_date=data.payment_date,
            received_date=data.received_date,
            external_reference=data.external_reference,
            sender_name=data.sender_name,
            sender_bank=data.sender_bank,
            sender_account_last_four=data.sender_account_last_four,
            notes=data.notes,
            status="pending",
            recorded_by=recorded_by,
            created_by=recorded_by,
            updated_by=recorded_by,
        )

        # Use retry logic for database operations
        async def _save_payment() -> ManualPayment:
            self.db.add(payment)
            await self.db.commit()
            await self.db.refresh(payment)
            return payment

        try:
            saved_payment = await self.retry_manager.execute(_save_payment)
            logger.info(
                f"Recorded bank transfer {saved_payment.id} for customer {data.customer_id}"
            )
            return self._to_payment_response(saved_payment)
        except Exception as e:
            logger.error(f"Failed to record bank transfer: {e}")
            await self.db.rollback()
            raise PaymentError(f"Failed to record bank transfer: {e}")

    async def record_mobile_money(
        self, tenant_id: str, data: MobileMoneyCreate, recorded_by: str
    ) -> ManualPaymentResponse:
        """Record a mobile money payment"""

        payment_reference = self._generate_payment_reference("MOB")

        # Convert customer_id to UUID if it's a string
        customer_uuid = (
            UUID(data.customer_id) if isinstance(data.customer_id, str) else data.customer_id
        )

        payment = ManualPayment(
            tenant_id=tenant_id,
            payment_reference=payment_reference,
            customer_id=customer_uuid,
            invoice_id=data.invoice_id,
            bank_account_id=data.bank_account_id,
            payment_method=PaymentMethodType.MOBILE_MONEY,
            amount=data.amount,
            currency=data.currency,
            payment_date=data.payment_date,
            received_date=data.received_date,
            external_reference=data.external_reference,
            mobile_number=data.mobile_number,
            mobile_provider=data.mobile_provider,
            notes=data.notes,
            status="pending",
            recorded_by=recorded_by,
            created_by=recorded_by,
            updated_by=recorded_by,
        )

        # Use retry logic for database operations
        async def _save_payment() -> ManualPayment:
            self.db.add(payment)
            await self.db.commit()
            await self.db.refresh(payment)
            return payment

        try:
            saved_payment = await self.retry_manager.execute(_save_payment)
            logger.info(
                f"Recorded mobile money payment {saved_payment.id} for customer {data.customer_id}"
            )
            return self._to_payment_response(saved_payment)
        except Exception as e:
            logger.error(f"Failed to record mobile money payment: {e}")
            await self.db.rollback()
            raise PaymentError(f"Failed to record mobile money payment: {e}")

    async def search_payments(
        self, tenant_id: str, filters: PaymentSearchFilters, limit: int = 100, offset: int = 0
    ) -> list[ManualPaymentResponse]:
        """Search manual payments with filters"""

        query = select(ManualPayment).where(ManualPayment.tenant_id == tenant_id)

        if filters.customer_id:
            # Convert customer_id to UUID if it's a string
            customer_uuid = (
                UUID(filters.customer_id)
                if isinstance(filters.customer_id, str)
                else filters.customer_id
            )
            query = query.where(ManualPayment.customer_id == customer_uuid)

        if filters.invoice_id:
            query = query.where(ManualPayment.invoice_id == filters.invoice_id)

        if filters.payment_method:
            query = query.where(ManualPayment.payment_method == filters.payment_method)

        if filters.status:
            query = query.where(ManualPayment.status == filters.status)

        if filters.reconciled is not None:
            query = query.where(ManualPayment.reconciled == filters.reconciled)

        if filters.date_from:
            query = query.where(ManualPayment.payment_date >= filters.date_from)

        if filters.date_to:
            query = query.where(ManualPayment.payment_date <= filters.date_to)

        if filters.amount_min:
            query = query.where(ManualPayment.amount >= filters.amount_min)

        if filters.amount_max:
            query = query.where(ManualPayment.amount <= filters.amount_max)

        query = query.order_by(ManualPayment.payment_date.desc())
        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        payments = result.scalars().all()

        return [self._to_payment_response(payment) for payment in payments]

    async def verify_payment(
        self, tenant_id: str, payment_id: int, verified_by: str, notes: str | None = None
    ) -> ManualPaymentResponse:
        """Mark a payment as verified"""

        # Use circuit breaker for verification operations
        async def _verify() -> ManualPayment:
            result = await self.db.execute(
                select(ManualPayment).where(
                    and_(ManualPayment.tenant_id == tenant_id, ManualPayment.id == payment_id)
                )
            )
            payment = result.scalar_one_or_none()

            if not payment:
                raise PaymentError(f"Payment {payment_id} not found")

            payment.status = "verified"
            payment.approved_by = verified_by
            payment.approved_at = datetime.now(UTC)
            payment.updated_by = verified_by
            payment.updated_at = datetime.now(UTC)

            if notes:
                existing_notes = payment.notes or ""
                payment.notes = f"{existing_notes}\nVerification: {notes}".strip()

            await self.db.commit()
            await self.db.refresh(payment)
            return payment

        try:
            verified_payment = await self.circuit_breaker.call(_verify)
            logger.info(f"Verified payment {payment_id}")
            return self._to_payment_response(verified_payment)
        except Exception as e:
            logger.error(f"Failed to verify payment {payment_id}: {e}")
            await self.db.rollback()
            raise PaymentError(f"Failed to verify payment: {e}")

    async def reconcile_payments(
        self,
        tenant_id: str,
        payment_ids: list[int],
        reconciled_by: str,
        notes: str | None = None,
    ) -> list[ManualPaymentResponse]:
        """Reconcile multiple payments"""

        result = await self.db.execute(
            select(ManualPayment).where(
                and_(ManualPayment.tenant_id == tenant_id, ManualPayment.id.in_(payment_ids))
            )
        )
        payments = result.scalars().all()

        if len(payments) != len(payment_ids):
            raise PaymentError("Some payments not found")

        reconciled_payments = []
        for payment in payments:
            payment.reconciled = True
            payment.reconciled_at = datetime.now(UTC)
            payment.reconciled_by = reconciled_by
            payment.status = "reconciled"
            payment.updated_by = reconciled_by
            payment.updated_at = datetime.now(UTC)

            if notes:
                existing_notes = payment.notes or ""
                payment.notes = f"{existing_notes}\nReconciliation: {notes}".strip()

            reconciled_payments.append(payment)

        await self.db.commit()

        logger.info(f"Reconciled {len(payments)} payments")
        return [self._to_payment_response(payment) for payment in reconciled_payments]

    async def get_payment(self, tenant_id: str, payment_id: int) -> ManualPaymentResponse | None:
        """Get a specific payment"""
        result = await self.db.execute(
            select(ManualPayment).where(
                and_(ManualPayment.tenant_id == tenant_id, ManualPayment.id == payment_id)
            )
        )
        payment = result.scalar_one_or_none()
        return self._to_payment_response(payment) if payment else None

    async def add_attachment(self, tenant_id: str, payment_id: int, attachment_url: str) -> None:
        """Add attachment URL to payment"""
        result = await self.db.execute(
            select(ManualPayment).where(
                and_(ManualPayment.tenant_id == tenant_id, ManualPayment.id == payment_id)
            )
        )
        payment = result.scalar_one_or_none()

        if payment:
            if not payment.attachments:
                payment.attachments = []
            payment.attachments.append(attachment_url)
            payment.updated_at = datetime.now(UTC)
            await self.db.commit()

    def _generate_payment_reference(self, prefix: str) -> str:
        """Generate unique payment reference"""
        timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
        random_suffix = secrets.token_hex(3).upper()
        return f"{prefix}-{timestamp}-{random_suffix}"

    def _to_payment_response(self, payment: ManualPayment) -> ManualPaymentResponse:
        """Convert entity to response model"""
        tenant_id_value = payment.tenant_id or ""
        payment_method_model = PaymentMethodTypeModel(payment.payment_method.value)

        return ManualPaymentResponse(
            id=payment.id,
            tenant_id=tenant_id_value,
            payment_reference=payment.payment_reference,
            external_reference=payment.external_reference,
            customer_id=str(payment.customer_id),
            invoice_id=payment.invoice_id,
            bank_account_id=payment.bank_account_id,
            payment_method=payment_method_model,
            amount=float(payment.amount),
            currency=payment.currency,
            payment_date=payment.payment_date,
            received_date=payment.received_date,
            cleared_date=payment.cleared_date,
            cash_register_id=payment.cash_register_id,
            cashier_name=payment.cashier_name,
            check_number=payment.check_number,
            check_bank_name=payment.check_bank_name,
            sender_name=payment.sender_name,
            sender_bank=payment.sender_bank,
            sender_account_last_four=payment.sender_account_last_four,
            mobile_number=payment.mobile_number,
            mobile_provider=payment.mobile_provider,
            status=payment.status,
            reconciled=payment.reconciled,
            reconciled_at=payment.reconciled_at,
            reconciled_by=payment.reconciled_by,
            notes=payment.notes,
            receipt_url=payment.receipt_url,
            attachments=payment.attachments or [],
            recorded_by=payment.recorded_by,
            approved_by=payment.approved_by,
            approved_at=payment.approved_at,
            created_at=payment.created_at,
            updated_at=payment.updated_at,
            metadata=payment.meta_data or {},
        )
