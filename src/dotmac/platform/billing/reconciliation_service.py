"""
Billing reconciliation service.

Orchestrates payment reconciliation, retry logic, circuit breaking, and recovery workflows.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.audit import ActivityType
from dotmac.platform.audit.service import AuditService
from dotmac.platform.billing.bank_accounts.entities import (
    CompanyBankAccount,
    ManualPayment,
    PaymentReconciliation,
)
from dotmac.platform.billing.recovery import (
    BillingRetry,
    CircuitBreaker,
    ExponentialBackoff,
    IdempotencyManager,
    RecoveryContext,
)

logger = structlog.get_logger(__name__)


class ReconciliationService:
    """
    Service for managing payment reconciliation and recovery workflows.

    Handles:
    - Payment reconciliation sessions
    - Retry logic with circuit breaking
    - Idempotency for billing operations
    - Discrepancy detection and resolution
    - Audit trail for all reconciliation activities
    """

    def __init__(
        self,
        db: AsyncSession,
        audit_service: AuditService | None = None,
        retry_manager: BillingRetry | None = None,
        circuit_breaker: CircuitBreaker | None = None,
        idempotency_manager: IdempotencyManager | None = None,
    ):
        self.db = db
        self.audit_service = audit_service or AuditService(db)

        # Initialize recovery helpers
        self.retry_manager = retry_manager or BillingRetry(
            max_attempts=3, strategy=ExponentialBackoff(base_delay=1.0, max_delay=30.0)
        )
        self.circuit_breaker = circuit_breaker or CircuitBreaker(
            failure_threshold=5, recovery_timeout=60.0
        )
        self.idempotency_manager = idempotency_manager or IdempotencyManager(cache_ttl=3600)

    # ==================== Reconciliation Session Management ====================

    async def start_reconciliation_session(
        self,
        tenant_id: str,
        bank_account_id: int,
        period_start: datetime,
        period_end: datetime,
        opening_balance: Decimal,
        statement_balance: Decimal,
        user_id: str,
        statement_file_url: str | None = None,
    ) -> PaymentReconciliation:
        """
        Start a new reconciliation session.

        Args:
            tenant_id: Tenant ID for isolation
            bank_account_id: Bank account being reconciled
            period_start: Start of reconciliation period
            period_end: End of reconciliation period
            opening_balance: Opening balance from previous reconciliation
            statement_balance: Balance from bank statement
            user_id: User starting the reconciliation
            statement_file_url: Optional URL to bank statement file

        Returns:
            Created PaymentReconciliation record
        """
        # Verify bank account exists
        stmt = select(CompanyBankAccount).where(
            and_(
                CompanyBankAccount.id == bank_account_id,
                CompanyBankAccount.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        bank_account = result.scalar_one_or_none()

        if not bank_account:
            raise ValueError(f"Bank account {bank_account_id} not found for tenant {tenant_id}")

        # Create reconciliation record
        reconciliation = PaymentReconciliation(
            tenant_id=tenant_id,
            reconciliation_date=datetime.now(UTC),
            period_start=period_start,
            period_end=period_end,
            bank_account_id=bank_account_id,
            opening_balance=float(opening_balance),
            closing_balance=float(opening_balance),  # Will be calculated
            statement_balance=float(statement_balance),
            total_deposits=0.0,
            total_withdrawals=0.0,
            unreconciled_count=0,
            discrepancy_amount=0.0,
            status="in_progress",
            statement_file_url=statement_file_url,
            notes=f"Reconciliation session started by {user_id}",
            reconciled_items=[],
            meta_data={"started_by": user_id, "started_at": datetime.now(UTC).isoformat()},
        )

        self.db.add(reconciliation)
        await self.db.commit()
        await self.db.refresh(reconciliation)

        # Audit log
        await self.audit_service.log_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            activity_type=ActivityType.API_REQUEST,
            description="Reconciliation session started",
            action="reconciliation.started",
            resource_type="payment_reconciliation",
            resource_id=str(reconciliation.id),
            details={
                "bank_account_id": bank_account_id,
                "period_start": period_start.isoformat(),
                "period_end": period_end.isoformat(),
                "opening_balance": str(opening_balance),
                "statement_balance": str(statement_balance),
            },
        )

        logger.info(
            "Reconciliation session started",
            reconciliation_id=reconciliation.id,
            bank_account_id=bank_account_id,
            tenant_id=tenant_id,
        )

        return reconciliation

    async def add_reconciled_payment(
        self,
        tenant_id: str,
        reconciliation_id: int,
        payment_id: int,
        user_id: str,
        notes: str | None = None,
    ) -> PaymentReconciliation:
        """
        Add a payment to reconciliation session.

        Args:
            tenant_id: Tenant ID for isolation
            reconciliation_id: Reconciliation session ID
            payment_id: Payment to reconcile
            user_id: User performing reconciliation
            notes: Optional notes

        Returns:
            Updated PaymentReconciliation record
        """
        # Get reconciliation
        reconciliation = await self._get_reconciliation(tenant_id, reconciliation_id)

        if reconciliation.status != "in_progress":
            raise ValueError(f"Reconciliation {reconciliation_id} is not in progress")

        # Get payment
        stmt = select(ManualPayment).where(
            and_(ManualPayment.id == payment_id, ManualPayment.tenant_id == tenant_id)
        )
        result = await self.db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            raise ValueError(f"Payment {payment_id} not found")

        # Mark payment as reconciled
        payment.reconciled = True
        payment.reconciled_at = datetime.now(UTC)
        payment.reconciled_by = user_id
        payment.status = "reconciled"

        # Update reconciliation totals
        if payment.amount > 0:
            reconciliation.total_deposits += float(payment.amount)
        else:
            reconciliation.total_withdrawals += abs(float(payment.amount))

        # Add to reconciled items list
        reconciled_items = reconciliation.reconciled_items or []
        reconciled_items.append(
            {
                "payment_id": payment_id,
                "payment_reference": payment.payment_reference,
                "amount": float(payment.amount),
                "reconciled_at": datetime.now(UTC).isoformat(),
                "reconciled_by": user_id,
                "notes": notes,
            }
        )
        reconciliation.reconciled_items = reconciled_items

        # Update closing balance
        reconciliation.closing_balance = (
            reconciliation.opening_balance
            + reconciliation.total_deposits
            - reconciliation.total_withdrawals
        )

        await self.db.commit()
        await self.db.refresh(reconciliation)

        logger.info(
            "Payment added to reconciliation",
            reconciliation_id=reconciliation_id,
            payment_id=payment_id,
        )

        return reconciliation

    async def complete_reconciliation(
        self, tenant_id: str, reconciliation_id: int, user_id: str, notes: str | None = None
    ) -> PaymentReconciliation:
        """
        Complete reconciliation session and calculate discrepancies.

        Args:
            tenant_id: Tenant ID for isolation
            reconciliation_id: Reconciliation session ID
            user_id: User completing reconciliation
            notes: Optional completion notes

        Returns:
            Completed PaymentReconciliation record
        """
        reconciliation = await self._get_reconciliation(tenant_id, reconciliation_id)

        if reconciliation.status != "in_progress":
            raise ValueError(f"Reconciliation {reconciliation_id} is not in progress")

        # Get unreconciled payments count
        stmt = (
            select(func.count())
            .select_from(ManualPayment)
            .where(
                and_(
                    ManualPayment.tenant_id == tenant_id,
                    ManualPayment.bank_account_id == reconciliation.bank_account_id,
                    ManualPayment.payment_date >= reconciliation.period_start,
                    ManualPayment.payment_date <= reconciliation.period_end,
                    or_(
                        ManualPayment.reconciled.is_(False),
                        ManualPayment.reconciled.is_(None),
                    ),  # noqa: E712
                )
            )
        )
        unreconciled_count = await self.db.scalar(stmt) or 0

        # Calculate discrepancy
        discrepancy = reconciliation.closing_balance - reconciliation.statement_balance

        # Update reconciliation
        reconciliation.status = "completed"
        reconciliation.completed_by = user_id
        reconciliation.completed_at = datetime.now(UTC)
        reconciliation.unreconciled_count = unreconciled_count
        reconciliation.discrepancy_amount = float(discrepancy)

        if notes:
            existing_notes = reconciliation.notes or ""
            reconciliation.notes = f"{existing_notes}\n\nCompletion notes: {notes}".strip()

        await self.db.commit()
        await self.db.refresh(reconciliation)

        # Audit log
        await self.audit_service.log_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            activity_type=ActivityType.API_REQUEST,
            description="Reconciliation completed",
            action="reconciliation.completed",
            resource_type="payment_reconciliation",
            resource_id=str(reconciliation_id),
            details={
                "total_deposits": reconciliation.total_deposits,
                "total_withdrawals": reconciliation.total_withdrawals,
                "closing_balance": reconciliation.closing_balance,
                "statement_balance": reconciliation.statement_balance,
                "discrepancy": float(discrepancy),
                "unreconciled_count": unreconciled_count,
                "reconciled_items_count": len(reconciliation.reconciled_items or []),
            },
        )

        logger.info(
            "Reconciliation completed",
            reconciliation_id=reconciliation_id,
            discrepancy=float(discrepancy),
            unreconciled_count=unreconciled_count,
        )

        return reconciliation

    async def approve_reconciliation(
        self, tenant_id: str, reconciliation_id: int, user_id: str, notes: str | None = None
    ) -> PaymentReconciliation:
        """
        Approve completed reconciliation (finance team).

        Args:
            tenant_id: Tenant ID for isolation
            reconciliation_id: Reconciliation session ID
            user_id: User approving reconciliation
            notes: Optional approval notes

        Returns:
            Approved PaymentReconciliation record
        """
        reconciliation = await self._get_reconciliation(tenant_id, reconciliation_id)

        if reconciliation.status != "completed":
            raise ValueError(
                f"Reconciliation {reconciliation_id} must be completed before approval"
            )

        reconciliation.status = "approved"
        reconciliation.approved_by = user_id
        reconciliation.approved_at = datetime.now(UTC)

        if notes:
            existing_notes = reconciliation.notes or ""
            reconciliation.notes = f"{existing_notes}\n\nApproval notes: {notes}".strip()

        await self.db.commit()
        await self.db.refresh(reconciliation)

        # Audit log
        await self.audit_service.log_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            activity_type=ActivityType.API_REQUEST,
            description="Reconciliation approved",
            action="reconciliation.approved",
            resource_type="payment_reconciliation",
            resource_id=str(reconciliation_id),
            details={"approved_by": user_id, "approved_at": datetime.now(UTC).isoformat()},
        )

        logger.info("Reconciliation approved", reconciliation_id=reconciliation_id, user_id=user_id)

        return reconciliation

    async def list_reconciliations(
        self,
        tenant_id: str,
        bank_account_id: int | None = None,
        status: str | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> dict[str, Any]:
        """
        List reconciliation sessions with filtering and pagination.

        Args:
            tenant_id: Tenant ID for isolation
            bank_account_id: Optional filter by bank account
            status: Optional filter by status
            start_date: Optional filter by reconciliation date start
            end_date: Optional filter by reconciliation date end
            page: Page number
            page_size: Items per page

        Returns:
            Dict with reconciliations list and pagination info
        """
        # Build query
        query = select(PaymentReconciliation).where(PaymentReconciliation.tenant_id == tenant_id)

        if bank_account_id:
            query = query.where(PaymentReconciliation.bank_account_id == bank_account_id)

        if status:
            query = query.where(PaymentReconciliation.status == status)

        if start_date:
            query = query.where(PaymentReconciliation.reconciliation_date >= start_date)

        if end_date:
            query = query.where(PaymentReconciliation.reconciliation_date <= end_date)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0

        # Apply pagination
        query = query.order_by(PaymentReconciliation.reconciliation_date.desc())
        query = query.limit(page_size).offset((page - 1) * page_size)

        # Execute
        result = await self.db.execute(query)
        reconciliations = result.scalars().all()

        return {
            "reconciliations": reconciliations,
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": (total + page_size - 1) // page_size if total > 0 else 1,
        }

    async def get_reconciliation_summary(
        self, tenant_id: str, bank_account_id: int | None = None, days: int = 30
    ) -> dict[str, Any]:
        """
        Get reconciliation summary statistics.

        Args:
            tenant_id: Tenant ID for isolation
            bank_account_id: Optional filter by bank account
            days: Number of days to include in summary

        Returns:
            Summary statistics
        """
        start_date = datetime.now(UTC) - timedelta(days=days)

        query = select(PaymentReconciliation).where(
            and_(
                PaymentReconciliation.tenant_id == tenant_id,
                PaymentReconciliation.reconciliation_date >= start_date,
            )
        )

        if bank_account_id:
            query = query.where(PaymentReconciliation.bank_account_id == bank_account_id)

        result = await self.db.execute(query)
        reconciliations = result.scalars().all()

        # Calculate summary
        total_sessions = len(reconciliations)
        approved_sessions = sum(1 for r in reconciliations if r.status == "approved")
        pending_sessions = sum(
            1 for r in reconciliations if r.status in ("in_progress", "completed")
        )
        total_discrepancies = sum(abs(r.discrepancy_amount or 0) for r in reconciliations)
        total_reconciled_items = sum(len(r.reconciled_items or []) for r in reconciliations)

        return {
            "period_days": days,
            "total_sessions": total_sessions,
            "approved_sessions": approved_sessions,
            "pending_sessions": pending_sessions,
            "total_discrepancies": float(total_discrepancies),
            "total_reconciled_items": total_reconciled_items,
            "average_discrepancy": (
                float(total_discrepancies / total_sessions) if total_sessions > 0 else 0.0
            ),
        }

    # ==================== Recovery & Retry Operations ====================

    async def retry_failed_payment_with_recovery(
        self, tenant_id: str, payment_id: int, user_id: str, max_attempts: int = 3
    ) -> dict[str, Any]:
        """
        Retry a failed payment with circuit breaker and recovery context.

        Args:
            tenant_id: Tenant ID for isolation
            payment_id: Payment to retry
            user_id: User requesting retry
            max_attempts: Maximum retry attempts

        Returns:
            Recovery result with attempt details
        """
        async with RecoveryContext(save_state=True, state_key=f"payment_retry_{payment_id}") as ctx:

            async def process_payment() -> ManualPayment:
                stmt = select(ManualPayment).where(
                    and_(ManualPayment.id == payment_id, ManualPayment.tenant_id == tenant_id)
                )
                result = await self.db.execute(stmt)
                payment = result.scalar_one_or_none()

                if not payment:
                    raise ValueError(f"Payment {payment_id} not found")

                # Use circuit breaker
                return await self.circuit_breaker.call(self._process_payment_internal, payment)

            # Use retry manager
            await self.retry_manager.execute(process_payment)

            # Log successful recovery
            await self.audit_service.log_activity(
                tenant_id=tenant_id,
                user_id=user_id,
                activity_type=ActivityType.API_REQUEST,
                description="Payment retry succeeded during reconciliation",
                action="payment.retry.success",
                resource_type="manual_payment",
                resource_id=str(payment_id),
                details={
                    "attempts": len(ctx.attempts),
                    "circuit_breaker_state": self.circuit_breaker.state,
                },
            )

            return {
                "success": True,
                "payment_id": payment_id,
                "attempts": len(ctx.attempts),
                "circuit_breaker_state": self.circuit_breaker.state,
                "recovery_context": ctx.state,
            }

    async def execute_with_idempotency(
        self,
        idempotency_key: str,
        operation: str,
        tenant_id: str,
        user_id: str,
        operation_func: Any,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """
        Execute billing operation with idempotency guarantee.

        Args:
            idempotency_key: Unique key for operation
            operation: Operation name for auditing
            tenant_id: Tenant ID for isolation
            user_id: User executing operation
            operation_func: Async function to execute
            *args: Positional arguments for operation_func
            **kwargs: Keyword arguments for operation_func

        Returns:
            Result from operation_func
        """
        result = await self.idempotency_manager.ensure_idempotent(
            idempotency_key, operation_func, *args, **kwargs
        )

        # Log idempotent operation
        await self.audit_service.log_activity(
            tenant_id=tenant_id,
            user_id=user_id,
            activity_type=ActivityType.API_REQUEST,
            description=f"Idempotent execution for operation '{operation}'",
            action=f"{operation}.idempotent",
            resource_type="billing_operation",
            resource_id=idempotency_key,
            details={"operation": operation, "idempotency_key": idempotency_key},
        )

        return result

    # ==================== Internal Helpers ====================

    async def _get_reconciliation(
        self, tenant_id: str, reconciliation_id: int
    ) -> PaymentReconciliation:
        """Get reconciliation with tenant isolation."""
        stmt = select(PaymentReconciliation).where(
            and_(
                PaymentReconciliation.id == reconciliation_id,
                PaymentReconciliation.tenant_id == tenant_id,
            )
        )
        result = await self.db.execute(stmt)
        reconciliation = result.scalar_one_or_none()

        if not reconciliation:
            raise ValueError(f"Reconciliation {reconciliation_id} not found")

        return reconciliation

    async def _process_payment_internal(self, payment: ManualPayment) -> ManualPayment:
        """Internal payment processing (placeholder for actual logic)."""
        # This would contain actual payment processing logic
        # For now, just update status
        payment.status = "processed"
        payment.updated_at = datetime.now(UTC)
        await self.db.commit()
        await self.db.refresh(payment)
        return payment
