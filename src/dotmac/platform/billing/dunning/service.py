"""
Dunning & Collections Service Layer.

Handles business logic for automated collection workflows.
"""

from collections.abc import Sequence
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.dunning.models import (
    DunningActionLog,
    DunningActionType,
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
            raise ValueError("Campaign must have at least one action")

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
        stmt = select(DunningCampaign).where(DunningCampaign.id == campaign_id)

        result = await self.session.execute(stmt)
        campaign = result.scalar_one_or_none()

        if not campaign:
            raise EntityNotFoundError("Campaign", campaign_id)

        if campaign.tenant_id != tenant_id:
            raise EntityNotFoundError("Campaign", campaign_id)

        return campaign

    async def list_campaigns(
        self,
        tenant_id: str,
        active_only: bool | None = None,
        *,
        is_active: bool | None = None,
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

        active_filter = is_active if is_active is not None else active_only

        if active_filter is True:
            stmt = stmt.where(DunningCampaign.is_active.is_(True))
        elif active_filter is False:
            stmt = stmt.where(DunningCampaign.is_active.is_(False))

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
        if campaign is None:
            raise EntityNotFoundError("Campaign", campaign_id)

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

        if deleted_by_user_id is None:
            # Hard delete when performed by system automation (no user context).
            await self.session.delete(campaign)
        else:
            # Soft delete for user-initiated actions to preserve history.
            campaign.is_active = False
            campaign.updated_by = str(deleted_by_user_id)

        await self.session.flush()

        return True

    async def record_payment_recovery(
        self,
        execution_id: UUID,
        tenant_id: str,
        recovered_amount: int,
        recorded_by_user_id: UUID | None = None,
    ) -> DunningExecution:
        """
        Record a recovered payment for an execution and update campaign stats.
        """
        if recovered_amount <= 0:
            raise ValueError("Recovered amount must be greater than zero")

        execution = await self.get_execution(execution_id, tenant_id)
        if execution is None:
            raise EntityNotFoundError("Execution", execution_id)

        campaign = await self.get_campaign(execution.campaign_id, tenant_id)
        if campaign is None:
            raise EntityNotFoundError("Campaign", execution.campaign_id)

        previous_recovered = execution.recovered_amount
        execution.recovered_amount += recovered_amount
        if execution.recovered_amount > execution.outstanding_amount:
            execution.recovered_amount = execution.outstanding_amount
        effective_recovery = execution.recovered_amount - previous_recovered
        recorded_at = datetime.now(UTC)
        execution_log = list(execution.execution_log or [])
        execution_log.append(
            {
                "step": execution.current_step,
                "action_type": "payment_recovery",
                "executed_at": recorded_at.isoformat(),
                "status": "success",
                "details": {
                    "recovered_amount": effective_recovery,
                    "recorded_by": str(recorded_by_user_id) if recorded_by_user_id else None,
                },
            }
        )
        execution.execution_log = execution_log

        if execution.recovered_amount >= execution.outstanding_amount:
            execution.status = DunningExecutionStatus.COMPLETED
            execution.completed_at = recorded_at
            execution.next_action_at = None
        else:
            execution.status = DunningExecutionStatus.IN_PROGRESS

        campaign.total_recovered_amount += effective_recovery
        if (
            execution.status == DunningExecutionStatus.COMPLETED
            and previous_recovered == 0
            and effective_recovery > 0
        ):
            campaign.successful_executions += 1

        await self.session.flush()

        return execution

    # Execution Management

    async def start_execution(
        self,
        campaign_id: UUID,
        tenant_id: str,
        subscription_id: str,
        customer_id: UUID,
        outstanding_amount: int,
        invoice_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> DunningExecution:
        """
        Start a new dunning execution for a subscription.

        Args:
            campaign_id: Campaign to execute
            tenant_id: Tenant identifier
            subscription_id: Subscription ID
            customer_id: Customer ID
            outstanding_amount: Amount owed in cents
            invoice_id: Invoice ID (optional)
            metadata: Additional metadata

        Returns:
            Created DunningExecution

        Raises:
            EntityNotFoundError: If campaign not found
            ValidationError: If execution already exists
        """
        # Get campaign
        campaign = await self.get_campaign(campaign_id, tenant_id)
        if campaign is None:
            raise EntityNotFoundError("Campaign", campaign_id)

        if not campaign.is_active:
            raise ValueError("Cannot start execution for inactive campaign")

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
            raise ValueError(f"Subscription {subscription_id} already has an active execution")

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

    async def execute_next_action(
        self,
        execution_id: UUID,
        tenant_id: str,
        performed_by: UUID | None = None,
    ) -> DunningActionLog:
        """
        Execute the next action in a dunning execution sequence.

        Simulates action processing for testing purposes by recording a
        successful action log entry and advancing execution progress.
        """
        execution = await self.get_execution(execution_id, tenant_id)
        if execution is None:
            raise EntityNotFoundError("Execution", execution_id)

        if execution.status in (
            DunningExecutionStatus.COMPLETED,
            DunningExecutionStatus.CANCELED,
            DunningExecutionStatus.FAILED,
        ):
            raise ValueError(f"Execution {execution_id} is no longer active")

        campaign = await self.get_campaign(execution.campaign_id, tenant_id)
        if campaign is None:
            raise EntityNotFoundError("Campaign", execution.campaign_id)

        actions: Sequence[dict[str, Any]] = campaign.actions or []
        if execution.current_step >= len(actions):
            execution.status = DunningExecutionStatus.COMPLETED
            execution.completed_at = datetime.now(UTC)
            execution.next_action_at = None
            await self.session.flush()
            raise ValueError("Execution has no pending actions")

        action_config = actions[execution.current_step]
        action_type_value = action_config.get("type")
        try:
            action_type = DunningActionType(action_type_value)
        except ValueError as exc:  # pragma: no cover - defensive guard for invalid data
            raise ValueError(f"Unsupported dunning action type: {action_type_value}") from exc

        executed_at = datetime.now(UTC)

        log_entry = DunningActionLog(
            id=uuid4(),
            tenant_id=tenant_id,
            execution_id=execution.id,
            action_type=action_type,
            action_config=action_config,
            step_number=execution.current_step,
            executed_at=executed_at,
            status="success",
            result={"message": "Action executed successfully"},
            error_message=None,
            external_id=None,
        )
        self.session.add(log_entry)

        execution_log = list(execution.execution_log or [])
        execution_log.append(
            {
                "step": execution.current_step,
                "action_type": action_type.value,
                "executed_at": executed_at.isoformat(),
                "status": "success",
                "details": {
                    "config": action_config,
                    "performed_by": str(performed_by) if performed_by else None,
                },
            }
        )
        execution.execution_log = execution_log
        execution.current_step += 1
        if execution.current_step >= execution.total_steps:
            execution.status = DunningExecutionStatus.COMPLETED
            execution.completed_at = executed_at
            execution.next_action_at = None
        else:
            execution.status = DunningExecutionStatus.IN_PROGRESS
            next_action_config = actions[execution.current_step]
            delay_days = next_action_config.get("delay_days", 0) or 0
            execution.next_action_at = executed_at + timedelta(days=delay_days)

        await self.session.flush()

        return log_entry

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
        stmt = select(DunningExecution).where(DunningExecution.id == execution_id)

        result = await self.session.execute(stmt)
        execution = result.scalar_one_or_none()

        if not execution:
            raise EntityNotFoundError("Execution", execution_id)

        if execution.tenant_id != tenant_id:
            raise EntityNotFoundError("Execution", execution_id)

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
    ) -> bool:
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
        if execution is None:
            raise EntityNotFoundError("Execution", execution_id)

        if execution.status not in [
            DunningExecutionStatus.PENDING,
            DunningExecutionStatus.IN_PROGRESS,
        ]:
            raise ValueError(f"Cannot cancel execution with status {execution.status}")

        execution.status = DunningExecutionStatus.CANCELED
        execution.canceled_reason = reason
        execution.canceled_by_user_id = canceled_by_user_id
        execution.completed_at = datetime.now(UTC)

        # Log cancellation
        execution_log = list(execution.execution_log or [])
        execution_log.append(
            {
                "step": execution.current_step,
                "action_type": "canceled",
                "executed_at": datetime.now(UTC).isoformat(),
                "status": "canceled",
                "details": {"reason": reason, "canceled_by": str(canceled_by_user_id)},
            }
        )
        execution.execution_log = execution_log

        await self.session.flush()

        return True

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
            .order_by(DunningActionLog.executed_at.desc())
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
        if campaign is None:
            raise EntityNotFoundError("Campaign", campaign_id)

        # Count executions by status and amounts
        stmt = select(
            func.count().label("total"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.IN_PROGRESS)
            .label("active"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.COMPLETED)
            .label("completed"),
            func.count().filter(DunningExecution.recovered_amount > 0).label("successful"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.FAILED)
            .label("failed"),
            func.count()
            .filter(DunningExecution.status == DunningExecutionStatus.CANCELED)
            .label("canceled"),
            func.sum(DunningExecution.recovered_amount).label("recovered"),
            func.sum(DunningExecution.outstanding_amount).label("outstanding"),
            func.avg(DunningExecution.recovered_amount)
            .filter(DunningExecution.recovered_amount > 0)
            .label("avg_recovery"),
            func.avg(
                func.extract("epoch", DunningExecution.completed_at - DunningExecution.started_at)
                / 3600
            )
            .filter(DunningExecution.completed_at.isnot(None))
            .label("avg_hours"),
        ).where(
            DunningExecution.campaign_id == campaign_id,
            DunningExecution.tenant_id == tenant_id,
        )

        result = await self.session.execute(stmt)
        row = result.one()

        # Calculate rates
        total_completed = row.completed or 0
        successful = row.successful or 0
        total_failed = row.failed or 0
        total_attempted = row.total or 0
        success_rate = (successful / total_attempted * 100) if total_attempted > 0 else 0.0

        total_recovered = row.recovered or 0
        total_outstanding = row.outstanding or 0
        recovery_rate = (
            (total_recovered / total_outstanding * 100) if total_outstanding > 0 else 0.0
        )
        avg_recovery_amount = float(row.avg_recovery or 0.0)

        return DunningCampaignStats(
            campaign_id=campaign_id,
            campaign_name=campaign.name,
            total_executions=row.total or 0,
            active_executions=row.active or 0,
            completed_executions=total_completed,
            successful_executions=successful,
            failed_executions=total_failed,
            canceled_executions=row.canceled or 0,
            total_recovered_amount=total_recovered,
            total_outstanding_amount=total_outstanding,
            success_rate=round(success_rate, 2),
            recovery_rate=round(recovery_rate, 2),
            average_recovery_amount=round(avg_recovery_amount, 2),
            average_completion_time_hours=round(row.avg_hours or 0.0, 2),
        )

    async def get_dunning_stats(self, tenant_id: str) -> DunningStats:
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
        total_campaigns = campaign_row.total or 0
        active_campaigns = campaign_row.active or 0

        # Execution counts
        execution_stmt = select(
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
            func.count().filter(DunningExecution.recovered_amount > 0).label("successful"),
            func.avg(DunningExecution.recovered_amount)
            .filter(DunningExecution.recovered_amount > 0)
            .label("avg_recovery"),
            func.avg(
                func.extract("epoch", DunningExecution.completed_at - DunningExecution.started_at)
                / 3600
            )
            .filter(DunningExecution.completed_at.isnot(None))
            .label("avg_hours"),
        ).where(DunningExecution.tenant_id == tenant_id)

        execution_result = await self.session.execute(execution_stmt)
        execution_row = execution_result.one()

        total_executions = execution_row.total or 0
        successful_recoveries = execution_row.successful or 0
        total_recovered_amount = execution_row.recovered or 0
        average_recovery_amount = float(execution_row.avg_recovery or 0.0)
        average_recovery_rate = (
            successful_recoveries / total_executions * 100 if total_executions > 0 else 0.0
        )
        average_completion_time_hours = round(execution_row.avg_hours or 0.0, 2)

        return DunningStats(
            total_campaigns=total_campaigns,
            active_campaigns=active_campaigns,
            total_executions=total_executions,
            active_executions=execution_row.active or 0,
            completed_executions=execution_row.completed or 0,
            successful_recoveries=successful_recoveries,
            failed_executions=execution_row.failed or 0,
            canceled_executions=execution_row.canceled or 0,
            total_recovered_amount=total_recovered_amount,
            average_recovery_amount=round(average_recovery_amount, 2),
            average_recovery_rate=round(average_recovery_rate, 2),
            average_completion_time_hours=average_completion_time_hours,
        )

    async def get_tenant_stats(self, tenant_id: str) -> DunningStats:
        """
        Backwards compatible alias for ``get_dunning_stats``.
        """
        return await self.get_dunning_stats(tenant_id)


__all__ = ["DunningService"]
