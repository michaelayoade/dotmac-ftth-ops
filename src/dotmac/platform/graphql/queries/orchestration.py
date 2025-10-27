"""
GraphQL queries for Orchestration Service.

Provides queries for workflows, provisioning status, and statistics.
"""

from typing import cast

import strawberry
import structlog

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.orchestration import (
    Workflow,
    WorkflowConnection,
    WorkflowFilterInput,
    WorkflowStatistics,
)
from dotmac.platform.orchestration.models import (
    OrchestrationWorkflow as WorkflowModel,
)
from dotmac.platform.orchestration.models import (
    WorkflowStatus as DBWorkflowStatus,
)
from dotmac.platform.orchestration.models import (
    WorkflowType as DBWorkflowType,
)
from dotmac.platform.orchestration.service import OrchestrationService

logger = structlog.get_logger(__name__)


@strawberry.type
class OrchestrationQueries:
    """GraphQL queries for orchestration service."""

    @strawberry.field(description="Get workflow by ID")  # type: ignore[misc]
    async def workflow(
        self,
        info: strawberry.Info[Context],
        workflow_id: str,
    ) -> Workflow | None:
        """
        Fetch a single workflow by ID.

        Args:
            workflow_id: Workflow identifier

        Returns:
            Workflow with all steps, or None if not found
        """
        db = info.context.db
        current_user = info.context.current_user
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")
        tenant_id = current_user.tenant_id

        try:
            # Query workflow with steps
            workflow_model = (
                db.query(WorkflowModel)
                .filter(
                    WorkflowModel.workflow_id == workflow_id,
                    WorkflowModel.tenant_id == tenant_id,
                )
                .first()
            )

            if not workflow_model:
                return None

            return Workflow.from_model(workflow_model)

        except Exception as e:
            logger.error("Error fetching workflow", workflow_id=workflow_id, error=str(e))
            return None

    @strawberry.field(description="List workflows with filtering")  # type: ignore[misc]
    async def workflows(
        self,
        info: strawberry.Info[Context],
        filter: WorkflowFilterInput | None = None,
    ) -> WorkflowConnection:
        """
        Fetch a list of workflows with optional filtering.

        Args:
            filter: Optional filter criteria (type, status, pagination)

        Returns:
            WorkflowConnection with workflows and pagination info
        """
        db = info.context.db
        current_user = info.context.current_user
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")
        tenant_id = current_user.tenant_id

        if filter is None:
            filter = WorkflowFilterInput()

        try:
            service = OrchestrationService(db=db, tenant_id=tenant_id)

            # Convert GraphQL enums to database enums
            workflow_type = (
                DBWorkflowType(filter.workflow_type.value) if filter.workflow_type else None
            )
            status = DBWorkflowStatus(filter.status.value) if filter.status else None

            # Fetch workflows
            result = await service.list_workflows(
                workflow_type=workflow_type,
                status=status,
                limit=filter.limit,
                offset=filter.offset,
            )

            # Convert to GraphQL types
            workflows = []
            for wf_response in result.workflows:
                # Fetch full model for conversion
                workflow_model = (
                    db.query(WorkflowModel)
                    .filter(WorkflowModel.workflow_id == wf_response.workflow_id)
                    .first()
                )
                if workflow_model:
                    workflows.append(Workflow.from_model(workflow_model))

            return WorkflowConnection(
                workflows=workflows,
                total_count=result.total,
                has_next_page=(filter.offset + filter.limit) < result.total,
            )

        except Exception as e:
            logger.error("Error listing workflows", error=str(e))
            return WorkflowConnection(
                workflows=[],
                total_count=0,
                has_next_page=False,
            )

    @strawberry.field(description="Get workflow statistics")  # type: ignore[misc]
    async def workflow_statistics(
        self,
        info: strawberry.Info[Context],
    ) -> WorkflowStatistics:
        """
        Get aggregated workflow statistics.

        Returns:
            WorkflowStatistics with counts and metrics
        """
        db = info.context.db
        current_user = info.context.current_user
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")
        tenant_id = current_user.tenant_id

        try:
            service = OrchestrationService(db=db, tenant_id=tenant_id)
            stats = await service.get_workflow_statistics()

            return WorkflowStatistics(
                total_workflows=stats.total_workflows,
                pending_workflows=stats.pending_workflows,
                running_workflows=stats.running_workflows,
                completed_workflows=stats.completed_workflows,
                failed_workflows=stats.failed_workflows,
                rolled_back_workflows=stats.rolled_back_workflows,
                success_rate=stats.success_rate,
                average_duration_seconds=stats.average_duration_seconds,
                total_compensations=stats.total_compensations,
            )

        except Exception as e:
            logger.error("Error fetching workflow statistics", error=str(e))
            # Return empty statistics
            return WorkflowStatistics(
                total_workflows=0,
                pending_workflows=0,
                running_workflows=0,
                completed_workflows=0,
                failed_workflows=0,
                rolled_back_workflows=0,
                success_rate=0.0,
                average_duration_seconds=0.0,
                total_compensations=0,
            )

    @strawberry.field(description="Get running workflows count")  # type: ignore[misc]
    async def running_workflows_count(self, info: strawberry.Info[Context]) -> int:
        """
        Get count of currently running workflows.

        Returns:
            Number of workflows in RUNNING status
        """
        db = info.context.db
        current_user = info.context.current_user
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")
        tenant_id = current_user.tenant_id

        try:
            count = cast(
                int,
                db.query(WorkflowModel)
                .filter(
                    WorkflowModel.tenant_id == tenant_id,
                    WorkflowModel.status == DBWorkflowStatus.RUNNING,
                )
                .count(),
            )
            return count

        except Exception as e:
            logger.error("Error counting running workflows", error=str(e))
            return 0

    @strawberry.field(description="Check if a workflow is running for a specific customer")  # type: ignore[misc]
    async def has_running_workflow_for_customer(
        self,
        info: strawberry.Info[Context],
        customer_id: str,
    ) -> bool:
        """
        Check if there's a running workflow for a specific customer.

        Useful for preventing duplicate provisioning operations.

        Args:
            customer_id: Customer identifier

        Returns:
            True if there's a running workflow, False otherwise
        """
        db = info.context.db
        current_user = info.context.current_user
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")
        tenant_id = current_user.tenant_id

        try:
            from sqlalchemy import func

            # Check for running workflows where input_data contains customer_id
            count_result = cast(
                int | None,
                db.query(func.count(WorkflowModel.id))
                .filter(
                    WorkflowModel.tenant_id == tenant_id,
                    WorkflowModel.status.in_(
                        [
                            DBWorkflowStatus.PENDING,
                            DBWorkflowStatus.RUNNING,
                        ]
                    ),
                    WorkflowModel.input_data["customer_id"].astext == customer_id,
                )
                .scalar(),
            )

            return bool(count_result and count_result > 0)

        except Exception as e:
            logger.error("Error checking running workflows", customer_id=customer_id, error=str(e))
            return False
