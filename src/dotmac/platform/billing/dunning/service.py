"""
Dunning & Collections Service Layer.

Handles business logic for automated collection workflows.
"""

from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.dunning.models import (
    DunningActionLog,
    DunningCampaign,
    DunningExecution,
    DunningExecutionStatus,
)
from dotmac.platform.billing.dunning.schemas import (
    DunningCampaignCreate,
    DunningCampaignStats,
    DunningCampaignUpdate,
    DunningStats,
)
from dotmac.platform.core.exceptions import EntityNotFoundError, ValidationError


class DunningService:
    """Service for managing dunning campaigns and executions."""

    def __init__(self, session: AsyncSession):
        """Initialize service with database session."""
        self.session = session

    # Campaign Management

    async def create_campaign(
        self,
        tenant_id: str,
        data: DunningCampaignCreate,
        created_by_user_id: UUID | None = None,
    ) -> DunningCampaign:
        """
        Create a new dunning campaign.

        Args:
            tenant_id: Tenant identifier
            data: Campaign creation data
            created_by_user_id: User creating the campaign

        Returns:
            Created DunningCampaign

        Raises:
            ValidationError: If campaign data is invalid
        """
        # Validate action sequence
        if not data.actions:
            raise ValidationError("Campaign must have at least one action")

        # Convert Pydantic models to dict for JSON storage
        actions_json = [action.model_dump() for action in data.actions]
        exclusion_rules_json = data.exclusion_rules.model_dump()

        campaign = DunningCampaign(
            id=uuid4(),
            tenant_id=tenant_id,
            name=data.name,
            description=data.description,
            trigger_after_days=data.trigger_after_days,
            max_retries=data.max_retries,
            retry_interval_days=data.retry_interval_days,
            actions=actions_json,
            exclusion_rules=exclusion_rules_json,
            priority=data.priority,
            is_active=data.is_active,
            created_by=str(created_by_user_id) if created_by_user_id else None,
        )

        self.session.add(campaign)
        await self.session.flush()

        return campaign

    async def get_campaign(self, campaign_id: UUID, tenant_id: str) -> DunningCampaign:
        """
        Get a dunning campaign by ID.

        Args:
            campaign_id: Campaign ID
            tenant_id: Tenant identifier

        Returns:
            DunningCampaign

        Raises:
            EntityNotFoundError: If campaign not found
        """
        stmt = select(DunningCampaign).where(
            DunningCampaign.id == campaign_id,
            DunningCampaign.tenant_id == tenant_id,
        )

        result = await self.session.execute(stmt)
        campaign = result.scalar_one_or_none()

        if not campaign:
            raise EntityNotFoundError(f"Campaign {campaign_id} not found")

        return campaign

    async def list_campaigns(
        self,
        tenant_id: str,
        active_only: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> list[DunningCampaign]:
        """
        List dunning campaigns for a tenant.

        Args:
            tenant_id: Tenant identifier
            active_only: Filter to only active campaigns
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of DunningCampaign
        """
        stmt = select(DunningCampaign).where(DunningCampaign.tenant_id == tenant_id)

        if active_only:
            stmt = stmt.where(DunningCampaign.is_active)

        stmt = stmt.order_by(DunningCampaign.priority.desc(), DunningCampaign.created_at)
        stmt = stmt.offset(skip).limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def update_campaign(
        self,
        campaign_id: UUID,
        tenant_id: str,
        data: DunningCampaignUpdate,
        updated_by_user_id: UUID | None = None,
    ) -> DunningCampaign:
        """
        Update a dunning campaign.

        Args:
            campaign_id: Campaign ID
            tenant_id: Tenant identifier
            data: Update data
            updated_by_user_id: User updating the campaign

        Returns:
            Updated DunningCampaign

        Raises:
            EntityNotFoundError: If campaign not found
        """
        campaign = await self.get_campaign(campaign_id, tenant_id)

        # Update fields
        update_data = data.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "actions" and value is not None:
                # Convert Pydantic models to dict
                setattr(campaign, field, [action.model_dump() for action in value])
            elif field == "exclusion_rules" and value is not None:
                setattr(campaign, field, value.model_dump())
            else:
                setattr(campaign, field, value)

        campaign.updated_by = str(updated_by_user_id) if updated_by_user_id else None
        await self.session.flush()

        return campaign

    async def delete_campaign(
        self, campaign_id: UUID, tenant_id: str, deleted_by_user_id: UUID | None = None
    ) -> bool:
        """
        Delete a dunning campaign (soft delete by marking as inactive).

        Args:
            campaign_id: Campaign ID
            tenant_id: Tenant identifier
            deleted_by_user_id: User who deleted the campaign

        Returns:
            True if deleted successfully

        Raises:
            EntityNotFoundError: If campaign not found
            ValidationError: If campaign has active executions
        """
        campaign = await self.get_campaign(campaign_id, tenant_id)

        # Check for active executions
        stmt = (
            select(func.count())
            .select_from(DunningExecution)
            .where(
                DunningExecution.campaign_id == campaign_id,
                DunningExecution.status.in_(
                    [
                        DunningExecutionStatus.PENDING,
                        DunningExecutionStatus.IN_PROGRESS,
                    ]
                ),
            )
        )

        result = await self.session.execute(stmt)
        active_count = result.scalar() or 0

        if active_count > 0:
            raise ValidationError(
                f"Cannot delete campaign with {active_count} active executions. "
                "Cancel them first or wait for completion."
            )

        # Soft delete by marking as inactive
        campaign.is_active = False
        if deleted_by_user_id:
            campaign.updated_by = str(deleted_by_user_id)

        await self.session.flush()

        return True

    # Execution Management

    async def start_execution(
        self,
        campaign_id: UUID,
        tenant_id: str,
        subscription_id: str,
        customer_id: UUID,
        invoice_id: str | None,
        outstanding_amount: int,
        metadata: dict[str, Any] | None = None,
    ) -> DunningExecution:
        """
        Start a new dunning execution for a subscription.

        Args:
            campaign_id: Campaign to execute
            tenant_id: Tenant identifier
            subscription_id: Subscription ID
            customer_id: Customer ID
            invoice_id: Invoice ID (optional)
            outstanding_amount: Amount owed in cents
            metadata: Additional metadata

        Returns:
            Created DunningExecution

        Raises:
            EntityNotFoundError: If campaign not found
            ValidationError: If execution already exists
        """
        # Get campaign
        campaign = await self.get_campaign(campaign_id, tenant_id)

        if not campaign.is_active:
            raise ValidationError("Cannot start execution for inactive campaign")

        # Check for existing active execution
        stmt = select(DunningExecution).where(
            DunningExecution.subscription_id == subscription_id,
            DunningExecution.status.in_(
                [
                    DunningExecutionStatus.PENDING,
                    DunningExecutionStatus.IN_PROGRESS,
                ]
            ),
        )

        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            raise ValidationError(
                f"Active dunning execution already exists for subscription {subscription_id}"
            )

        # Calculate next action time (first action delay)
        first_action_delay = campaign.actions[0].get("delay_days", 0) if campaign.actions else 0
        next_action_at = datetime.now(UTC) + timedelta(days=first_action_delay)

        # Create execution
        execution = DunningExecution(
            id=uuid4(),
            tenant_id=tenant_id,
            campaign_id=campaign_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            invoice_id=invoice_id,
            status=DunningExecutionStatus.PENDING,
            current_step=0,
            total_steps=len(campaign.actions),
            retry_count=0,
            started_at=datetime.now(UTC),
            next_action_at=next_action_at,
            outstanding_amount=outstanding_amount,
            recovered_amount=0,
            execution_log=[],
            metadata_=metadata or {},
        )

        self.session.add(execution)

        # Update campaign statistics
        campaign.total_executions += 1

        await self.session.flush()

        return execution

    async def get_execution(self, execution_id: UUID, tenant_id: str) -> DunningExecution:
        """
        Get a dunning execution by ID.

        Args:
            execution_id: Execution ID
            tenant_id: Tenant identifier

        Returns:
            DunningExecution

        Raises:
            EntityNotFoundError: If execution not found
        """
        stmt = select(DunningExecution).where(
            DunningExecution.id == execution_id,
            DunningExecution.tenant_id == tenant_id,
        )

        result = await self.session.execute(stmt)
        execution = result.scalar_one_or_none()

        if not execution:
            raise EntityNotFoundError(f"Execution {execution_id} not found")

        return execution

    async def list_executions(
        self,
        tenant_id: str,
        campaign_id: UUID | None = None,
        subscription_id: str | None = None,
        customer_id: UUID | None = None,
        status: DunningExecutionStatus | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[DunningExecution]:
        """
        List dunning executions with filters.

        Args:
            tenant_id: Tenant identifier
            campaign_id: Filter by campaign
            subscription_id: Filter by subscription
            customer_id: Filter by customer
            status: Filter by status
            skip: Number of records to skip
            limit: Maximum number of records to return

        Returns:
            List of DunningExecution
        """
        stmt = select(DunningExecution).where(DunningExecution.tenant_id == tenant_id)

        if campaign_id:
            stmt = stmt.where(DunningExecution.campaign_id == campaign_id)
        if subscription_id:
            stmt = stmt.where(DunningExecution.subscription_id == subscription_id)
        if customer_id:
            stmt = stmt.where(DunningExecution.customer_id == customer_id)
        if status:
            stmt = stmt.where(DunningExecution.status == status)

        stmt = stmt.order_by(DunningExecution.created_at.desc())
        stmt = stmt.offset(skip).limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def cancel_execution(
        self,
        execution_id: UUID,
        tenant_id: str,
        reason: str,
        canceled_by_user_id: UUID | None = None,
    ) -> DunningExecution:
        """
        Cancel a dunning execution.

        Args:
            execution_id: Execution ID
            tenant_id: Tenant identifier
            reason: Cancellation reason
            canceled_by_user_id: User canceling the execution

        Returns:
            Canceled DunningExecution

        Raises:
            EntityNotFoundError: If execution not found
            ValidationError: If execution cannot be canceled
        """
        execution = await self.get_execution(execution_id, tenant_id)

        if execution.status not in [
            DunningExecutionStatus.PENDING,
            DunningExecutionStatus.IN_PROGRESS,
        ]:
            raise ValidationError(f"Cannot cancel execution with status {execution.status}")

        execution.status = DunningExecutionStatus.CANCELED
        execution.canceled_reason = reason
        execution.canceled_by_user_id = canceled_by_user_id
        execution.completed_at = datetime.now(UTC)

        # Log cancellation
        execution.execution_log.append(
            {
                "step": execution.current_step,
                "action_type": "canceled",
                "executed_at": datetime.now(UTC).isoformat(),
                "status": "canceled",
                "details": {"reason": reason, "canceled_by": str(canceled_by_user_id)},
            }
        )

        await self.session.flush()

        return execution

    async def get_execution_logs(
        self, execution_id: UUID, tenant_id: str
    ) -> list[DunningActionLog]:
        """
        Get action logs for an execution.

        Args:
            execution_id: Execution ID
            tenant_id: Tenant identifier

        Returns:
            List of DunningActionLog records
        """
        stmt = (
            select(DunningActionLog)
            .where(
                DunningActionLog.execution_id == execution_id,
                DunningActionLog.tenant_id == tenant_id,
            )
            .order_by(DunningActionLog.attempted_at.desc())
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_actions(
        self, tenant_id: str | None = None, limit: int = 100
    ) -> list[DunningExecution]:
        """
        Get executions with pending actions (for scheduled processing).

        Args:
            tenant_id: Optional tenant filter
            limit: Maximum number to return

        Returns:
            List of DunningExecution ready for processing
        """
        now = datetime.now(UTC)

        stmt = select(DunningExecution).where(
            DunningExecution.status.in_(
                [
                    DunningExecutionStatus.PENDING,
                    DunningExecutionStatus.IN_PROGRESS,
                ]
            ),
            DunningExecution.next_action_at <= now,
        )

        if tenant_id:
            stmt = stmt.where(DunningExecution.tenant_id == tenant_id)

        stmt = stmt.order_by(DunningExecution.next_action_at).limit(limit)

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    # Statistics

    async def get_campaign_stats(self, campaign_id: UUID, tenant_id: str) -> DunningCampaignStats:
        """
        Get statistics for a specific campaign.

        Args:
            campaign_id: Campaign ID
            tenant_id: Tenant identifier

        Returns:
            DunningCampaignStats
        """
        campaign = await self.get_campaign(campaign_id, tenant_id)

        # Count executions by status and amounts
        stmt = select(
            func.count().label("total"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.IN_PROGRESS)
            .label("active"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.COMPLETED)
            .label("completed"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.FAILED)
            .label("failed"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.CANCELED)
            .label("canceled"),
            func.sum(DunningExecution.recovered_amount).label("recovered"),
            func.sum(DunningExecution.outstanding_amount).label("outstanding"),
            func.avg(
                func.extract("epoch", DunningExecution.completed_at - DunningExecution.started_at)
                / 3600
            )
            .filter(DunningExecution.completed_at.isnot(None))
            .label("avg_hours"),
        ).where(DunningExecution.campaign_id == campaign_id)

        result = await self.session.execute(stmt)
        row = result.one()

        # Calculate rates
        total_completed = row.completed or 0
        total_failed = row.failed or 0
        total_finished = total_completed + total_failed
        success_rate = (total_completed / total_finished * 100) if total_finished > 0 else 0.0

        total_recovered = row.recovered or 0
        total_outstanding = row.outstanding or 0
        recovery_rate = (
            (total_recovered / total_outstanding * 100) if total_outstanding > 0 else 0.0
        )

        return DunningCampaignStats(
            campaign_id=campaign_id,
            campaign_name=campaign.name,
            total_executions=row.total or 0,
            active_executions=row.active or 0,
            completed_executions=total_completed,
            failed_executions=total_failed,
            canceled_executions=row.canceled or 0,
            total_recovered_amount=total_recovered,
            total_outstanding_amount=total_outstanding,
            success_rate=round(success_rate, 2),
            recovery_rate=round(recovery_rate, 2),
            average_completion_time_hours=round(row.avg_hours or 0.0, 2),
        )

    async def get_tenant_stats(self, tenant_id: str) -> DunningStats:
        """
        Get overall dunning statistics for a tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            DunningStats
        """
        # Campaign counts
        campaign_stmt = select(
            func.count().label("total"),
            func.count().filter(DunningCampaign.is_active).label("active"),
        ).where(DunningCampaign.tenant_id == tenant_id)

        campaign_result = await self.session.execute(campaign_stmt)
        campaign_row = campaign_result.one()

        # Execution counts
        execution_stmt = select(
            func.count().label("total"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.PENDING)
            .label("pending"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.IN_PROGRESS)
            .label("active"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.COMPLETED)
            .label("completed"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.FAILED)
            .label("failed"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.CANCELED)
            .label("canceled"),
            func.sum(DunningExecution.recovered_amount).label("recovered"),
            func.sum(DunningExecution.outstanding_amount).label("outstanding"),
        ).where(DunningExecution.tenant_id == tenant_id)

        execution_result = await self.session.execute(execution_stmt)
        execution_row = execution_result.one()

        # Calculate recovery rate
        total_outstanding = execution_row.outstanding or 0
        total_recovered = execution_row.recovered or 0
        recovery_rate = (total_recovered / total_outstanding * 100) if total_outstanding > 0 else 0

        # Calculate average completion time (for completed executions)
        avg_time_stmt = select(
            func.avg(
                func.extract("epoch", DunningExecution.completed_at - DunningExecution.started_at)
                / 3600
            )
        ).where(
            DunningExecution.tenant_id == tenant_id,
            DunningExecution.status == DunningExecutionStatus.COMPLETED,
            DunningExecution.completed_at.isnot(None),
        )

        avg_time_result = await self.session.execute(avg_time_stmt)
        avg_completion_time = avg_time_result.scalar() or 0

        return DunningStats(
            total_campaigns=campaign_row.total,
            active_campaigns=campaign_row.active,
            total_executions=execution_row.total,
            active_executions=execution_row.active,
            completed_executions=execution_row.completed,
            failed_executions=execution_row.failed,
            canceled_executions=execution_row.canceled,
            total_recovered_amount=total_recovered,
            average_recovery_rate=round(recovery_rate, 2),
            average_completion_time_hours=round(avg_completion_time, 2),
        )


__all__ = ["DunningService"]
