"""
Usage billing domain service.

Provides a cohesive API for creating and managing usage records,
handling billing state transitions, computing aggregates, and
generating usage reports for metered ISP services.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

import structlog
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.settings.service import BillingSettingsService
from dotmac.platform.billing.usage.models import (
    BilledStatus,
    UsageAggregate,
    UsageRecord,
    UsageType,
)
from dotmac.platform.billing.usage.schemas import (
    UsageRecordCreate,
    UsageRecordUpdate,
    UsageReport,
    UsageReportRequest,
    UsageStats,
    UsageSummary,
)
from dotmac.platform.core.exceptions import EntityNotFoundError, ValidationError

UTC = UTC
logger = structlog.get_logger(__name__)


class UsageBillingService:
    """Service that encapsulates usage-record lifecycle and reporting logic."""

    def __init__(
        self,
        db_session: AsyncSession,
        *,
        billing_settings_service: BillingSettingsService | None = None,
        default_currency: str = "USD",
    ) -> None:
        self.db = db_session
        self._billing_settings_service = billing_settings_service
        self._default_currency = default_currency

    # ------------------------------------------------------------------ #
    # Creation & Mutation
    # ------------------------------------------------------------------ #

    async def create_usage_record(
        self,
        tenant_id: str,
        data: UsageRecordCreate,
        *,
        currency: str | None = None,
        created_by: str | None = None,
    ) -> UsageRecord:
        """Create a usage record with validation and rating."""
        self._validate_usage_record_input(data)

        resolved_currency = await self._resolve_currency(tenant_id, currency)
        total_amount = self._calculate_total_amount(data.quantity, data.unit_price)

        record = UsageRecord(
            tenant_id=tenant_id,
            subscription_id=data.subscription_id,
            customer_id=data.customer_id,
            usage_type=data.usage_type,
            quantity=Decimal(data.quantity),
            unit=data.unit,
            unit_price=Decimal(data.unit_price),
            total_amount=total_amount,
            currency=resolved_currency,
            period_start=data.period_start,
            period_end=data.period_end,
            billed_status=BilledStatus.PENDING,
            source_system=data.source_system,
            source_record_id=data.source_record_id,
            description=data.description,
            device_id=data.device_id,
            service_location=data.service_location,
        )

        if created_by and hasattr(record, "created_by"):
            record.created_by = created_by  # type: ignore[attr-defined]

        self.db.add(record)
        await self.db.flush()
        return record

    async def update_usage_record(
        self,
        tenant_id: str,
        record_id: UUID,
        update: UsageRecordUpdate,
        *,
        updated_by: str | None = None,
    ) -> UsageRecord:
        """Update an existing usage record."""
        record = await self.get_usage_record(record_id, tenant_id)

        if update.quantity is not None:
            if update.quantity < 0:
                raise ValidationError("quantity must be positive")
            record.quantity = Decimal(update.quantity)

        if update.unit_price is not None:
            if update.unit_price < 0:
                raise ValidationError("unit_price must be non-negative")
            record.unit_price = Decimal(update.unit_price)

        if update.quantity is not None or update.unit_price is not None:
            record.total_amount = self._calculate_total_amount(record.quantity, record.unit_price)

        if update.billed_status is not None:
            record.billed_status = update.billed_status
            if record.billed_status == BilledStatus.BILLED:
                record.billed_at = datetime.now(UTC)

        if update.invoice_id is not None:
            record.invoice_id = update.invoice_id

        if update.description is not None:
            record.description = update.description

        if updated_by and hasattr(record, "updated_by"):
            record.updated_by = updated_by  # type: ignore[attr-defined]

        await self.db.flush()
        return record

    async def delete_usage_record(self, tenant_id: str, record_id: UUID) -> None:
        """Delete a usage record if it hasn't been billed."""
        record = await self.get_usage_record(record_id, tenant_id)

        if record.billed_status == BilledStatus.BILLED:
            raise ValidationError("Cannot delete billed usage records. Mark as excluded instead.")

        await self.db.delete(record)
        await self.db.flush()

    # ------------------------------------------------------------------ #
    # Retrieval helpers
    # ------------------------------------------------------------------ #

    async def get_usage_record(self, record_id: UUID, tenant_id: str) -> UsageRecord:
        """Fetch a single usage record."""
        stmt = select(UsageRecord).where(
            and_(UsageRecord.id == record_id, UsageRecord.tenant_id == tenant_id)
        )
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()
        if not record:
            raise EntityNotFoundError(f"Usage record {record_id} not found")
        return record

    async def list_usage_records(
        self,
        tenant_id: str,
        *,
        subscription_id: str | None = None,
        customer_id: UUID | None = None,
        usage_type: UsageType | None = None,
        billed_status: BilledStatus | None = None,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> list[UsageRecord]:
        """List usage records with optional filters."""
        stmt = select(UsageRecord).where(UsageRecord.tenant_id == tenant_id)

        if subscription_id:
            stmt = stmt.where(UsageRecord.subscription_id == subscription_id)
        if customer_id:
            stmt = stmt.where(UsageRecord.customer_id == customer_id)
        if usage_type:
            stmt = stmt.where(UsageRecord.usage_type == usage_type)
        if billed_status:
            stmt = stmt.where(UsageRecord.billed_status == billed_status)
        if period_start:
            stmt = stmt.where(UsageRecord.period_start >= period_start)
        if period_end:
            stmt = stmt.where(UsageRecord.period_end <= period_end)

        stmt = stmt.order_by(UsageRecord.created_at.desc())
        if limit is not None:
            stmt = stmt.limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_usage(
        self,
        tenant_id: str,
        *,
        subscription_id: str | None = None,
        customer_id: UUID | None = None,
    ) -> list[UsageRecord]:
        """Return usage records that are pending billing."""
        return await self.list_usage_records(
            tenant_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            billed_status=BilledStatus.PENDING,
        )

    # ------------------------------------------------------------------ #
    # Billing transitions
    # ------------------------------------------------------------------ #

    async def mark_usage_as_billed(
        self,
        record_id: UUID,
        tenant_id: str,
        *,
        invoice_id: str | None = None,
        billed_at: datetime | None = None,
    ) -> UsageRecord:
        """Mark a single usage record as billed."""
        record = await self.get_usage_record(record_id, tenant_id)
        record.billed_status = BilledStatus.BILLED
        record.invoice_id = invoice_id
        record.billed_at = billed_at or datetime.now(UTC)
        await self.db.flush()
        return record

    async def bulk_mark_as_billed(
        self,
        record_ids: Sequence[UUID],
        tenant_id: str,
        *,
        invoice_id: str | None = None,
        billed_at: datetime | None = None,
    ) -> list[UsageRecord]:
        """Mark multiple usage records as billed."""
        if not record_ids:
            return []

        stmt = select(UsageRecord).where(
            and_(UsageRecord.tenant_id == tenant_id, UsageRecord.id.in_(record_ids))
        )
        result = await self.db.execute(stmt)
        records = list(result.scalars().all())

        target_time = billed_at or datetime.now(UTC)
        for record in records:
            record.billed_status = BilledStatus.BILLED
            record.invoice_id = invoice_id
            record.billed_at = target_time

        await self.db.flush()
        return records

    # ------------------------------------------------------------------ #
    # Aggregation & Reporting
    # ------------------------------------------------------------------ #

    async def aggregate_usage(
        self,
        tenant_id: str,
        subscription_id: str | None,
        period_type: str,
        period_start: datetime,
        period_end: datetime,
        *,
        customer_id: UUID | None = None,
        usage_type: UsageType | None = None,
    ) -> UsageAggregate | None:
        """
        Aggregate usage for a period and persist/update UsageAggregate.

        Returns the aggregate record or None when no usage matches.
        """
        records = await self.list_usage_records(
            tenant_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            usage_type=usage_type,
            period_start=period_start,
            period_end=period_end,
        )

        if not records:
            return None

        aggregate_usage_type = usage_type or records[0].usage_type
        total_quantity = sum((record.quantity for record in records), Decimal("0"))
        total_amount = sum(int(record.total_amount) for record in records)
        record_count = len(records)
        min_quantity = min((record.quantity for record in records), default=None)
        max_quantity = max((record.quantity for record in records), default=None)

        stmt = select(UsageAggregate).where(
            and_(
                UsageAggregate.tenant_id == tenant_id,
                UsageAggregate.subscription_id == subscription_id,
                UsageAggregate.customer_id == customer_id,
                UsageAggregate.usage_type == aggregate_usage_type,
                UsageAggregate.period_start == period_start,
                UsageAggregate.period_type == period_type,
            )
        )
        existing_result = await self.db.execute(stmt)
        aggregate = existing_result.scalar_one_or_none()

        if not aggregate:
            aggregate = UsageAggregate(
                tenant_id=tenant_id,
                subscription_id=subscription_id,
                customer_id=customer_id,
                usage_type=aggregate_usage_type,
                period_type=period_type,
                period_start=period_start,
                period_end=period_end,
                total_quantity=Decimal("0"),
                total_amount=0,
                record_count=0,
            )
            self.db.add(aggregate)

        aggregate.total_quantity = total_quantity
        aggregate.total_amount = total_amount
        aggregate.record_count = record_count
        aggregate.period_end = period_end
        aggregate.min_quantity = min_quantity
        aggregate.max_quantity = max_quantity

        await self.db.flush()
        return aggregate

    async def generate_usage_report(
        self,
        tenant_id: str,
        request: UsageReportRequest,
    ) -> UsageReport:
        """Generate usage report for the specified window."""
        records = await self.list_usage_records(
            tenant_id,
            subscription_id=request.subscription_id,
            customer_id=request.customer_id,
            period_start=request.period_start,
            period_end=request.period_end,
        )

        if request.usage_types:
            records = [r for r in records if r.usage_type in request.usage_types]

        usage_by_type: dict[UsageType, UsageSummary] = {}
        total_quantity = Decimal("0")
        total_amount = 0
        currency = self._default_currency

        for record in records:
            total_quantity += Decimal(record.quantity)
            total_amount += int(record.total_amount)
            currency = record.currency or self._default_currency

            summary = usage_by_type.get(record.usage_type)
            if not summary:
                summary = UsageSummary(
                    usage_type=record.usage_type,
                    total_quantity=Decimal("0"),
                    total_amount=0,
                    currency=currency,
                    record_count=0,
                    period_start=request.period_start,
                    period_end=request.period_end,
                )
                usage_by_type[record.usage_type] = summary

            summary.total_quantity += Decimal(record.quantity)
            summary.total_amount += int(record.total_amount)
            summary.record_count += 1

        return UsageReport(
            tenant_id=tenant_id,
            subscription_id=request.subscription_id,
            customer_id=request.customer_id,
            period_start=request.period_start,
            period_end=request.period_end,
            total_quantity=total_quantity,
            total_amount=total_amount,
            currency=currency,
            usage_by_type=usage_by_type,
        )

    async def get_usage_summary(
        self,
        tenant_id: str,
        *,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
        customer_id: UUID | None = None,
        subscription_id: str | None = None,
    ) -> UsageStats:
        """Return usage statistics for dashboards."""
        records = await self.list_usage_records(
            tenant_id,
            customer_id=customer_id,
            subscription_id=subscription_id,
            period_start=period_start,
            period_end=period_end,
        )

        total_records = len(records)
        total_amount = sum(int(r.total_amount) for r in records)
        pending_amount = sum(
            int(r.total_amount) for r in records if r.billed_status == BilledStatus.PENDING
        )
        billed_amount = sum(
            int(r.total_amount) for r in records if r.billed_status == BilledStatus.BILLED
        )

        by_type: dict[str, UsageSummary] = {}
        for record in records:
            key = record.usage_type.value
            currency = (record.currency or self._default_currency).upper()
            if key not in by_type:
                by_type[key] = UsageSummary(
                    usage_type=record.usage_type,
                    total_quantity=Decimal("0"),
                    total_amount=0,
                    currency=currency,
                    record_count=0,
                    period_start=period_start or record.period_start,
                    period_end=period_end or record.period_end,
                )
            summary = by_type[key]
            summary.total_quantity += Decimal(record.quantity)
            summary.total_amount += int(record.total_amount)
            summary.record_count += 1

        return UsageStats(
            total_records=total_records,
            total_amount=total_amount,
            pending_amount=pending_amount,
            billed_amount=billed_amount,
            by_type=by_type,
            period_start=period_start or datetime.now(UTC),
            period_end=period_end or datetime.now(UTC),
        )

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    async def _resolve_currency(self, tenant_id: str, override: str | None) -> str:
        """Determine currency for a usage record."""
        if override:
            return override.upper()

        service = self._billing_settings_service
        if service is None:
            service = BillingSettingsService(self.db)
            self._billing_settings_service = service

        if service is not None:
            try:
                settings = await service.get_settings(tenant_id)
                default_currency = getattr(
                    getattr(settings, "payment_settings", None), "default_currency", None
                )
                if default_currency:
                    return str(default_currency).upper()
            except Exception:  # pragma: no cover - defensive fallback
                logger.warning(
                    "Failed to resolve tenant currency, defaulting to fallback",
                    tenant_id=tenant_id,
                    exc_info=True,
                )

        return self._default_currency

    @staticmethod
    def _calculate_total_amount(quantity: Decimal, unit_price: Decimal) -> int:
        """Convert quantity * unit_price to cents using bankers rounding."""
        total = (Decimal(quantity) * Decimal(unit_price) * Decimal("100")).quantize(
            Decimal("1"), rounding=ROUND_HALF_UP
        )
        return int(total)

    @staticmethod
    def _validate_usage_record_input(data: UsageRecordCreate) -> None:
        """Validate business rules prior to persisting."""
        if data.quantity < 0:
            raise ValidationError("quantity must be positive")
        if data.unit_price < 0:
            raise ValidationError("unit_price must be non-negative")
        if data.period_end < data.period_start:
            raise ValidationError("period_end must be after period_start")
