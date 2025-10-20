"""
Orchestration Service

High-level service for managing workflows and orchestrations.
"""

import logging
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import (
    OrchestrationWorkflow,
    WorkflowStatus,
    WorkflowStepStatus,
    WorkflowType,
)

# Alias for convenience in queries
Workflow = OrchestrationWorkflow
from .saga import SagaOrchestrator
from .schemas import (
    ActivateServiceRequest,
    DeprovisionSubscriberRequest,
    ProvisionSubscriberRequest,
    ProvisionSubscriberResponse,
    SuspendServiceRequest,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowStatsResponse,
)
from .workflows.activate_service import (
    get_activate_service_workflow,
)
from .workflows.activate_service import (
    register_handlers as register_activate_handlers,
)
from .workflows.deprovision_subscriber import (
    get_deprovision_subscriber_workflow,
)
from .workflows.deprovision_subscriber import (
    register_handlers as register_deprovision_handlers,
)
from .workflows.provision_subscriber import (
    get_provision_subscriber_workflow,
)
from .workflows.provision_subscriber import (
    register_handlers as register_provision_handlers,
)
from .workflows.suspend_service import (
    get_suspend_service_workflow,
)
from .workflows.suspend_service import (
    register_handlers as register_suspend_handlers,
)

logger = logging.getLogger(__name__)


class OrchestrationService:
    """Service for orchestrating multi-system operations."""

    def __init__(self, db: Session, tenant_id: str):
        """
        Initialize orchestration service.

        Args:
            db: Database session
            tenant_id: Tenant identifier for isolation
        """
        self.db = db
        self.tenant_id = tenant_id
        self.saga = SagaOrchestrator(db)

        # Register workflow handlers
        self._register_all_handlers()

    def _register_all_handlers(self) -> None:
        """Register all workflow handlers."""
        register_provision_handlers(self.saga)
        register_deprovision_handlers(self.saga)
        register_activate_handlers(self.saga)
        register_suspend_handlers(self.saga)
        logger.info("All workflow handlers registered")

    async def provision_subscriber(
        self,
        request: ProvisionSubscriberRequest,
        initiator_id: str | None = None,
        initiator_type: str = "api",
    ) -> ProvisionSubscriberResponse:
        """
        Provision a new subscriber across all systems atomically.

        This is the main entry point for subscriber provisioning. It:
        1. Creates a workflow record
        2. Executes all provisioning steps via the Saga orchestrator
        3. Automatically rolls back if any step fails
        4. Returns the final result

        Args:
            request: Provisioning request
            initiator_id: User/system that initiated the request
            initiator_type: Type of initiator ('user', 'api', 'system')

        Returns:
            ProvisionSubscriberResponse with workflow details

        Raises:
            Exception: If workflow creation fails
        """
        logger.info(
            f"Starting subscriber provisioning workflow "
            f"(tenant={self.tenant_id}, email={request.email})"
        )

        # Create workflow record
        workflow = OrchestrationWorkflow(
            workflow_id=f"wf_{uuid4().hex}",
            workflow_type=WorkflowType.PROVISION_SUBSCRIBER,
            status=WorkflowStatus.PENDING,
            tenant_id=self.tenant_id,
            initiator_id=initiator_id,
            initiator_type=initiator_type,
            input_data=request.model_dump(),
            context={},
        )

        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)

        logger.info(f"Created workflow: {workflow.workflow_id}")

        # Get workflow definition
        workflow_definition = get_provision_subscriber_workflow()

        # Execute workflow via Saga orchestrator
        try:
            workflow = await self.saga.execute_workflow(
                workflow=workflow,
                workflow_definition=workflow_definition,
                context={},
            )

            # Build response
            response = self._build_provision_response(workflow)
            logger.info(
                f"Workflow {workflow.workflow_id} completed with status: {workflow.status}"
            )
            return response

        except Exception as e:
            logger.exception(f"Workflow {workflow.workflow_id} failed: {e}")
            # Workflow is already updated by saga orchestrator
            raise

    def _build_provision_response(self, workflow: OrchestrationWorkflow) -> ProvisionSubscriberResponse:
        """Build provisioning response from workflow."""
        _ = workflow.output_data or {}
        context = workflow.context or {}

        # Count steps
        completed_steps = sum(
            1 for step in workflow.steps
            if step.status == WorkflowStepStatus.COMPLETED
        )
        total_steps = len(workflow.steps)

        return ProvisionSubscriberResponse(
            workflow_id=workflow.workflow_id,
            subscriber_id=context.get("subscriber_id", ""),
            customer_id=context.get("customer_id", ""),
            status=workflow.status,
            radius_username=context.get("radius_username"),
            ipv4_address=context.get("ipv4_address"),
            vlan_id=workflow.input_data.get("vlan_id"),
            onu_id=context.get("onu_id"),
            cpe_id=context.get("cpe_id"),
            service_id=context.get("service_id"),
            steps_completed=completed_steps,
            total_steps=total_steps,
            error_message=workflow.error_message,
            created_at=workflow.created_at,
            completed_at=workflow.completed_at,
        )

    async def get_workflow(self, workflow_id: str) -> WorkflowResponse | None:
        """
        Get workflow by ID.

        Args:
            workflow_id: Workflow identifier

        Returns:
            WorkflowResponse or None if not found
        """
        workflow = (
            self.db.query(Workflow)
            .filter(
                Workflow.workflow_id == workflow_id,
                Workflow.tenant_id == self.tenant_id,
            )
            .first()
        )

        if not workflow:
            return None

        return WorkflowResponse.model_validate(workflow)

    async def list_workflows(
        self,
        workflow_type: WorkflowType | None = None,
        status: WorkflowStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> WorkflowListResponse:
        """
        List workflows with filtering.

        Args:
            workflow_type: Filter by workflow type
            status: Filter by status
            limit: Maximum number of results
            offset: Pagination offset

        Returns:
            WorkflowListResponse with workflows
        """
        query = self.db.query(Workflow).filter(Workflow.tenant_id == self.tenant_id)

        if workflow_type:
            query = query.filter(Workflow.workflow_type == workflow_type)

        if status:
            query = query.filter(Workflow.status == status)

        total = query.count()

        workflows = (
            query.order_by(Workflow.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )

        return WorkflowListResponse(
            workflows=[WorkflowResponse.model_validate(w) for w in workflows],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def retry_workflow(self, workflow_id: str) -> WorkflowResponse:
        """
        Retry a failed workflow.

        Args:
            workflow_id: Workflow identifier

        Returns:
            Updated WorkflowResponse

        Raises:
            ValueError: If workflow cannot be retried
        """
        workflow = (
            self.db.query(Workflow)
            .filter(
                Workflow.workflow_id == workflow_id,
                Workflow.tenant_id == self.tenant_id,
            )
            .first()
        )

        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")

        logger.info(f"Retrying workflow: {workflow_id}")

        workflow = await self.saga.retry_failed_workflow(workflow)

        # Re-execute the workflow
        workflow_definition = self._get_workflow_definition(workflow.workflow_type)
        if not workflow_definition:
            raise ValueError(f"Unknown workflow type: {workflow.workflow_type}")

        workflow = await self.saga.execute_workflow(
            workflow=workflow,
            workflow_definition=workflow_definition,
            context=workflow.context or {},
        )

        return WorkflowResponse.model_validate(workflow)

    async def cancel_workflow(self, workflow_id: str) -> WorkflowResponse:
        """
        Cancel a running workflow.

        Args:
            workflow_id: Workflow identifier

        Returns:
            Updated WorkflowResponse

        Raises:
            ValueError: If workflow cannot be cancelled
        """
        workflow = (
            self.db.query(Workflow)
            .filter(
                Workflow.workflow_id == workflow_id,
                Workflow.tenant_id == self.tenant_id,
            )
            .first()
        )

        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")

        if workflow.status not in [WorkflowStatus.PENDING, WorkflowStatus.RUNNING]:
            raise ValueError(
                f"Cannot cancel workflow in status: {workflow.status}"
            )

        logger.info(f"Cancelling workflow: {workflow_id}")

        # Trigger compensation for completed steps
        await self.saga._compensate_workflow(workflow)

        return WorkflowResponse.model_validate(workflow)

    async def get_workflow_statistics(self) -> WorkflowStatsResponse:
        """
        Get workflow statistics for the tenant.

        Returns:
            WorkflowStatsResponse with aggregated statistics
        """
        # Count by status
        status_counts = (
            self.db.query(
                Workflow.status,
                func.count(Workflow.id),
            )
            .filter(Workflow.tenant_id == self.tenant_id)
            .group_by(Workflow.status)
            .all()
        )

        by_status = {str(status): count for status, count in status_counts}

        # Count by type
        type_counts = (
            self.db.query(
                Workflow.workflow_type,
                func.count(Workflow.id),
            )
            .filter(Workflow.tenant_id == self.tenant_id)
            .group_by(Workflow.workflow_type)
            .all()
        )

        by_type = {str(wf_type): count for wf_type, count in type_counts}

        # Calculate success rate
        total = sum(by_status.values())
        completed = by_status.get(str(WorkflowStatus.COMPLETED), 0)
        success_rate = (completed / total * 100) if total > 0 else 0.0

        # Calculate average duration
        completed_workflows = (
            self.db.query(Workflow)
            .filter(
                Workflow.tenant_id == self.tenant_id,
                Workflow.status == WorkflowStatus.COMPLETED,
                Workflow.completed_at.isnot(None),
                Workflow.started_at.isnot(None),
            )
            .all()
        )

        if completed_workflows:
            durations = [
                (w.completed_at - w.started_at).total_seconds()
                for w in completed_workflows
            ]
            avg_duration = sum(durations) / len(durations)
        else:
            avg_duration = 0.0

        # Count compensations
        compensated = by_status.get(str(WorkflowStatus.ROLLED_BACK), 0)
        compensated += by_status.get(str(WorkflowStatus.COMPENSATED), 0)

        return WorkflowStatsResponse(
            total_workflows=total,
            pending_workflows=by_status.get(str(WorkflowStatus.PENDING), 0),
            running_workflows=by_status.get(str(WorkflowStatus.RUNNING), 0),
            completed_workflows=completed,
            failed_workflows=by_status.get(str(WorkflowStatus.FAILED), 0),
            rolled_back_workflows=by_status.get(str(WorkflowStatus.ROLLED_BACK), 0),
            success_rate=success_rate,
            average_duration_seconds=avg_duration,
            total_compensations=compensated,
            by_type=by_type,
            by_status=by_status,
        )

    async def deprovision_subscriber(
        self,
        request: DeprovisionSubscriberRequest,
        initiator_id: str | None = None,
        initiator_type: str = "api",
    ) -> WorkflowResponse:
        """
        Deprovision a subscriber across all systems atomically.

        This orchestrates the complete deprovisioning process:
        1. Verify subscriber exists
        2. Suspend billing service
        3. Deactivate ONU in VOLTHA
        4. Unconfigure CPE in GenieACS
        5. Release IP address in NetBox
        6. Delete RADIUS account
        7. Archive subscriber record (soft delete)

        Args:
            request: Deprovisioning request
            initiator_id: User/system that initiated the request
            initiator_type: Type of initiator ('user', 'api', 'system')

        Returns:
            WorkflowResponse with workflow details

        Raises:
            Exception: If workflow creation fails
        """
        logger.info(
            f"Starting subscriber deprovisioning workflow "
            f"(tenant={self.tenant_id}, subscriber_id={request.subscriber_id})"
        )

        # Create workflow record
        workflow = OrchestrationWorkflow(
            workflow_id=f"wf_{uuid4().hex}",
            workflow_type=WorkflowType.DEPROVISION_SUBSCRIBER,
            status=WorkflowStatus.PENDING,
            tenant_id=self.tenant_id,
            initiator_id=initiator_id,
            initiator_type=initiator_type,
            input_data=request.model_dump(),
            context={},
        )

        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)

        logger.info(f"Created workflow: {workflow.workflow_id}")

        # Get workflow definition
        workflow_definition = get_deprovision_subscriber_workflow()

        # Execute workflow via Saga orchestrator
        try:
            workflow = await self.saga.execute_workflow(
                workflow=workflow,
                workflow_definition=workflow_definition,
                context={},
            )

            logger.info(
                f"Workflow {workflow.workflow_id} completed with status: {workflow.status}"
            )
            return WorkflowResponse.model_validate(workflow)

        except Exception as e:
            logger.exception(f"Workflow {workflow.workflow_id} failed: {e}")
            # Workflow is already updated by saga orchestrator
            raise

    async def activate_service(
        self,
        request: ActivateServiceRequest,
        initiator_id: str | None = None,
        initiator_type: str = "api",
    ) -> WorkflowResponse:
        """
        Activate a subscriber service across all systems atomically.

        This orchestrates the complete activation process:
        1. Verify subscriber exists and can be activated
        2. Activate billing service
        3. Enable RADIUS authentication
        4. Activate ONU in VOLTHA
        5. Enable CPE in GenieACS
        6. Update subscriber status to active

        Args:
            request: Activation request
            initiator_id: User/system that initiated the request
            initiator_type: Type of initiator ('user', 'api', 'system')

        Returns:
            WorkflowResponse with workflow details

        Raises:
            Exception: If workflow creation fails
        """
        logger.info(
            f"Starting service activation workflow "
            f"(tenant={self.tenant_id}, subscriber_id={request.subscriber_id})"
        )

        # Create workflow record
        workflow = OrchestrationWorkflow(
            workflow_id=f"wf_{uuid4().hex}",
            workflow_type=WorkflowType.ACTIVATE_SERVICE,
            status=WorkflowStatus.PENDING,
            tenant_id=self.tenant_id,
            initiator_id=initiator_id,
            initiator_type=initiator_type,
            input_data=request.model_dump(),
            context={},
        )

        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)

        logger.info(f"Created workflow: {workflow.workflow_id}")

        # Get workflow definition
        workflow_definition = get_activate_service_workflow()

        # Execute workflow via Saga orchestrator
        try:
            workflow = await self.saga.execute_workflow(
                workflow=workflow,
                workflow_definition=workflow_definition,
                context={},
            )

            logger.info(
                f"Workflow {workflow.workflow_id} completed with status: {workflow.status}"
            )
            return WorkflowResponse.model_validate(workflow)

        except Exception as e:
            logger.exception(f"Workflow {workflow.workflow_id} failed: {e}")
            # Workflow is already updated by saga orchestrator
            raise

    async def suspend_service(
        self,
        request: SuspendServiceRequest,
        initiator_id: str | None = None,
        initiator_type: str = "api",
    ) -> WorkflowResponse:
        """
        Suspend a subscriber service across all systems atomically.

        This orchestrates the complete suspension process:
        1. Verify subscriber exists and can be suspended
        2. Suspend billing service
        3. Disable RADIUS authentication
        4. Disable ONU in VOLTHA
        5. Disable CPE in GenieACS
        6. Update subscriber status to suspended

        Args:
            request: Suspension request
            initiator_id: User/system that initiated the request
            initiator_type: Type of initiator ('user', 'api', 'system')

        Returns:
            WorkflowResponse with workflow details

        Raises:
            Exception: If workflow creation fails
        """
        logger.info(
            f"Starting service suspension workflow "
            f"(tenant={self.tenant_id}, subscriber_id={request.subscriber_id})"
        )

        # Create workflow record
        workflow = OrchestrationWorkflow(
            workflow_id=f"wf_{uuid4().hex}",
            workflow_type=WorkflowType.SUSPEND_SERVICE,
            status=WorkflowStatus.PENDING,
            tenant_id=self.tenant_id,
            initiator_id=initiator_id,
            initiator_type=initiator_type,
            input_data=request.model_dump(),
            context={},
        )

        self.db.add(workflow)
        self.db.commit()
        self.db.refresh(workflow)

        logger.info(f"Created workflow: {workflow.workflow_id}")

        # Get workflow definition
        workflow_definition = get_suspend_service_workflow()

        # Execute workflow via Saga orchestrator
        try:
            workflow = await self.saga.execute_workflow(
                workflow=workflow,
                workflow_definition=workflow_definition,
                context={},
            )

            logger.info(
                f"Workflow {workflow.workflow_id} completed with status: {workflow.status}"
            )
            return WorkflowResponse.model_validate(workflow)

        except Exception as e:
            logger.exception(f"Workflow {workflow.workflow_id} failed: {e}")
            # Workflow is already updated by saga orchestrator
            raise

    def _get_workflow_definition(self, workflow_type: WorkflowType):
        """Get workflow definition by type."""
        if workflow_type == WorkflowType.PROVISION_SUBSCRIBER:
            return get_provision_subscriber_workflow()
        elif workflow_type == WorkflowType.DEPROVISION_SUBSCRIBER:
            return get_deprovision_subscriber_workflow()
        elif workflow_type == WorkflowType.ACTIVATE_SERVICE:
            return get_activate_service_workflow()
        elif workflow_type == WorkflowType.SUSPEND_SERVICE:
            return get_suspend_service_workflow()
        # Add other workflow types here
        return None
