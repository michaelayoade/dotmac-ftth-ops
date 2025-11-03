"""
Cash register service for managing physical cash points.

Provides functionality for:
- Cash register management
- Daily float tracking
- Cash reconciliation
- Cashier shift management
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.bank_accounts.entities import CashReconciliation, CashRegister
from dotmac.platform.billing.bank_accounts.models import (
    CashRegisterCreate,
    CashRegisterReconciliationCreate,
    CashRegisterReconciliationResponse,
    CashRegisterResponse,
)
from dotmac.platform.billing.exceptions import BillingError

logger = structlog.get_logger(__name__)


class CashRegisterService:
    """Service for managing cash registers and cash transactions."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize cash register service."""
        self.db = db

    async def create_cash_register(
        self,
        tenant_id: str,
        data: CashRegisterCreate,
        created_by: str,
    ) -> CashRegisterResponse:
        """
        Create a new cash register.

        Args:
            tenant_id: Tenant identifier
            data: Cash register creation data
            created_by: User creating the register

        Returns:
            Created cash register details
        """
        try:
            # Check if register_id already exists for tenant
            existing = await self.db.execute(
                select(CashRegister).where(
                    and_(
                        CashRegister.tenant_id == tenant_id,
                        CashRegister.register_id == data.register_id,
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise BillingError(
                    f"Cash register with ID {data.register_id} already exists",
                    error_code="DUPLICATE_REGISTER",
                    status_code=409,
                )

            # Create cash register
            cash_register = CashRegister(
                tenant_id=tenant_id,
                register_id=data.register_id,
                register_name=data.register_name,
                location=data.location,
                current_float=Decimal(str(data.initial_float)),
                initial_float=Decimal(str(data.initial_float)),
                requires_daily_reconciliation=data.requires_daily_reconciliation,
                max_cash_limit=Decimal(str(data.max_cash_limit)) if data.max_cash_limit else None,
                is_active=True,
                last_reconciled=None,
                created_by=created_by,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
                meta_data={},
            )

            self.db.add(cash_register)
            await self.db.commit()
            await self.db.refresh(cash_register)

            logger.info(
                "Cash register created",
                tenant_id=tenant_id,
                register_id=data.register_id,
                created_by=created_by,
            )

            return self._to_response(cash_register)

        except BillingError:
            raise
        except Exception as e:
            logger.error(f"Error creating cash register: {str(e)}")
            await self.db.rollback()
            raise BillingError(
                "Failed to create cash register",
                error_code="REGISTER_CREATION_FAILED",
                status_code=500,
            )

    async def get_cash_registers(
        self,
        tenant_id: str,
        include_inactive: bool = False,
    ) -> list[CashRegisterResponse]:
        """
        Get all cash registers for a tenant.

        Args:
            tenant_id: Tenant identifier
            include_inactive: Whether to include inactive registers

        Returns:
            List of cash registers
        """
        try:
            query = select(CashRegister).where(CashRegister.tenant_id == tenant_id)

            if not include_inactive:
                query = query.where(CashRegister.is_active)

            result = await self.db.execute(query)
            registers = result.scalars().all()

            return [self._to_response(reg) for reg in registers]

        except Exception as e:
            logger.error(f"Error listing cash registers: {str(e)}")
            raise BillingError(
                "Failed to list cash registers",
                error_code="REGISTER_LIST_FAILED",
                status_code=500,
            )

    async def get_cash_register(
        self,
        tenant_id: str,
        register_id: str,
    ) -> CashRegisterResponse | None:
        """
        Get a specific cash register.

        Args:
            tenant_id: Tenant identifier
            register_id: Register identifier

        Returns:
            Cash register details if found
        """
        try:
            result = await self.db.execute(
                select(CashRegister).where(
                    and_(
                        CashRegister.tenant_id == tenant_id,
                        CashRegister.register_id == register_id,
                    )
                )
            )
            register = result.scalar_one_or_none()

            return self._to_response(register) if register else None

        except Exception as e:
            logger.error(f"Error getting cash register: {str(e)}")
            raise BillingError(
                "Failed to get cash register",
                error_code="REGISTER_GET_FAILED",
                status_code=500,
            )

    async def update_float(
        self,
        tenant_id: str,
        register_id: str,
        new_float: float,
        reason: str,
        updated_by: str,
    ) -> CashRegisterResponse:
        """
        Update cash register float amount.

        Args:
            tenant_id: Tenant identifier
            register_id: Register identifier
            new_float: New float amount
            reason: Reason for float change
            updated_by: User updating the float

        Returns:
            Updated cash register
        """
        try:
            # Get register
            result = await self.db.execute(
                select(CashRegister).where(
                    and_(
                        CashRegister.tenant_id == tenant_id,
                        CashRegister.register_id == register_id,
                        CashRegister.is_active,
                    )
                )
            )
            register = result.scalar_one_or_none()

            if not register:
                raise BillingError(
                    f"Cash register {register_id} not found",
                    error_code="REGISTER_NOT_FOUND",
                    status_code=404,
                )

            # Check max cash limit
            if register.max_cash_limit and new_float > float(register.max_cash_limit):
                raise BillingError(
                    f"Float amount exceeds maximum limit of {register.max_cash_limit}",
                    error_code="FLOAT_EXCEEDS_LIMIT",
                    status_code=400,
                )

            # Update float
            old_float = float(register.current_float)
            register.current_float = float(new_float)
            register.updated_at = datetime.now(UTC)

            # Add to metadata
            if not register.meta_data:
                register.meta_data = {}
            float_history = register.meta_data.setdefault("float_history", [])
            float_history.append(
                {
                    "old_float": old_float,
                    "new_float": new_float,
                    "reason": reason,
                    "updated_by": updated_by,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )

            await self.db.commit()
            await self.db.refresh(register)

            logger.info(
                "Cash register float updated",
                tenant_id=tenant_id,
                register_id=register_id,
                old_float=old_float,
                new_float=new_float,
            )

            return self._to_response(register)

        except BillingError:
            raise
        except Exception as e:
            logger.error(f"Error updating float: {str(e)}")
            await self.db.rollback()
            raise BillingError(
                "Failed to update float",
                error_code="FLOAT_UPDATE_FAILED",
                status_code=500,
            )

    async def reconcile_register(
        self,
        tenant_id: str,
        register_id: str,
        data: CashRegisterReconciliationCreate,
        reconciled_by: str,
    ) -> CashRegisterReconciliationResponse:
        """
        Reconcile a cash register.

        Args:
            tenant_id: Tenant identifier
            register_id: Register identifier
            data: Reconciliation data
            reconciled_by: User performing reconciliation

        Returns:
            Reconciliation details
        """
        try:
            # Get register
            result = await self.db.execute(
                select(CashRegister).where(
                    and_(
                        CashRegister.tenant_id == tenant_id,
                        CashRegister.register_id == register_id,
                        CashRegister.is_active,
                    )
                )
            )
            register = result.scalar_one_or_none()

            if not register:
                raise BillingError(
                    f"Cash register {register_id} not found",
                    error_code="REGISTER_NOT_FOUND",
                    status_code=404,
                )

            # Calculate expected vs actual
            expected_cash = float(register.current_float)
            actual_cash = float(data.actual_cash)
            discrepancy = actual_cash - expected_cash
            opening_float_decimal = Decimal(str(expected_cash))
            actual_cash_decimal = Decimal(str(actual_cash))
            created_timestamp = datetime.now(UTC)

            # Create reconciliation record
            reconciliation = CashReconciliation(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                register_id=register_id,
                reconciliation_date=data.reconciliation_date or created_timestamp,
                opening_float=opening_float_decimal,
                closing_float=actual_cash_decimal,
                expected_cash=opening_float_decimal,
                actual_cash=actual_cash_decimal,
                discrepancy=Decimal(str(discrepancy)),
                reconciled_by=reconciled_by,
                notes=data.notes,
                shift_id=data.shift_id,
                meta_data=data.metadata or {},
            )

            self.db.add(reconciliation)

            # Update register last reconciled
            register.last_reconciled = created_timestamp
            register.current_float = actual_cash  # Reset to actual

            await self.db.commit()

            logger.info(
                "Cash register reconciled",
                tenant_id=tenant_id,
                register_id=register_id,
                discrepancy=discrepancy,
            )

            return CashRegisterReconciliationResponse(
                id=reconciliation.id,
                register_id=register_id,
                reconciliation_date=reconciliation.reconciliation_date,
                opening_float=float(reconciliation.opening_float),
                closing_float=float(reconciliation.closing_float),
                expected_cash=float(reconciliation.expected_cash),
                actual_cash=float(reconciliation.actual_cash),
                discrepancy=float(reconciliation.discrepancy),
                reconciled_by=reconciliation.reconciled_by,
                notes=reconciliation.notes,
                shift_id=reconciliation.shift_id,
                created_at=created_timestamp,
                metadata=reconciliation.meta_data,
            )

        except BillingError:
            raise
        except Exception as e:
            logger.error(f"Error reconciling register: {str(e)}")
            await self.db.rollback()
            raise BillingError(
                "Failed to reconcile register",
                error_code="RECONCILIATION_FAILED",
                status_code=500,
            )

    async def deactivate_register(
        self,
        tenant_id: str,
        register_id: str,
        deactivated_by: str,
    ) -> CashRegisterResponse:
        """
        Deactivate a cash register.

        Args:
            tenant_id: Tenant identifier
            register_id: Register identifier
            deactivated_by: User deactivating the register

        Returns:
            Updated cash register
        """
        try:
            # Get register
            result = await self.db.execute(
                select(CashRegister).where(
                    and_(
                        CashRegister.tenant_id == tenant_id,
                        CashRegister.register_id == register_id,
                    )
                )
            )
            register = result.scalar_one_or_none()

            if not register:
                raise BillingError(
                    f"Cash register {register_id} not found",
                    error_code="REGISTER_NOT_FOUND",
                    status_code=404,
                )

            # Check if already inactive
            if not register.is_active:
                raise BillingError(
                    f"Cash register {register_id} is already inactive",
                    error_code="REGISTER_ALREADY_INACTIVE",
                    status_code=400,
                )

            # Deactivate
            register.is_active = False
            register.updated_at = datetime.now(UTC)

            if not register.meta_data:
                register.meta_data = {}
            register.meta_data["deactivated_at"] = datetime.now(UTC).isoformat()
            register.meta_data["deactivated_by"] = deactivated_by

            await self.db.commit()
            await self.db.refresh(register)

            logger.info(
                "Cash register deactivated",
                tenant_id=tenant_id,
                register_id=register_id,
                deactivated_by=deactivated_by,
            )

            return self._to_response(register)

        except BillingError:
            raise
        except Exception as e:
            logger.error(f"Error deactivating register: {str(e)}")
            await self.db.rollback()
            raise BillingError(
                "Failed to deactivate register",
                error_code="DEACTIVATION_FAILED",
                status_code=500,
            )

    def _to_response(self, register: CashRegister) -> CashRegisterResponse:
        """Convert entity to response model."""
        return CashRegisterResponse(
            id=register.id,
            register_id=register.register_id,
            register_name=register.register_name,
            location=register.location,
            is_active=register.is_active,
            current_float=float(register.current_float),
            last_reconciled=register.last_reconciled,
            requires_daily_reconciliation=register.requires_daily_reconciliation,
            max_cash_limit=float(register.max_cash_limit) if register.max_cash_limit else None,
            created_at=register.created_at,
            updated_at=register.updated_at,
            metadata=register.meta_data or {},
        )
