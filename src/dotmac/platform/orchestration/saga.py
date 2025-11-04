"""
Saga Pattern Implementation

Implements the Saga pattern for distributed transactions with automatic compensation.

The Saga pattern coordinates transactions across multiple services by:
1. Executing steps sequentially
2. Storing compensation data for each step
3. Automatically rolling back (compensating) completed steps if a later step fails

Reference: https://microservices.io/patterns/data/saga.html
"""

# mypy: disable-error-code="type-arg,assignment,no-overload-impl,no-any-return"

import logging
from collections.abc import Callable
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from .models import (
    OrchestrationWorkflow,
    OrchestrationWorkflowStep,
    WorkflowStatus,
    WorkflowStepStatus,
)
from .schemas import StepDefinition, WorkflowDefinition

logger = logging.getLogger(__name__)


class SagaOrchestrator:
    """
    Saga pattern orchestrator for distributed transactions.

    Manages workflow execution with automatic rollback capabilities.
    """

    def __init__(self, db: Session):
        """Initialize the saga orchestrator."""
        self.db = db
        self.step_handlers: dict[str, Callable] = {}
        self.compensation_handlers: dict[str, Callable] = {}

    def register_step_handler(self, name: str, handler: Callable) -> None:
        """
        Register a step execution handler.

        Args:
            name: Handler name
            handler: Callable that executes the step
        """
        self.step_handlers[name] = handler
        logger.info(f"Registered step handler: {name}")

    def register_compensation_handler(self, name: str, handler: Callable) -> None:
        """
        Register a compensation (rollback) handler.

        Args:
            name: Handler name
            handler: Callable that compensates/rolls back the step
        """
        self.compensation_handlers[name] = handler
        logger.info(f"Registered compensation handler: {name}")

    @property
    def handlers(self) -> dict[str, Callable]:
        """
        Backwards compatible accessor for registered step handlers.

        Some tests reference saga.handlers to ensure registration occurred.
        """
        return self.step_handlers

    async def execute_workflow(
        self,
        workflow: OrchestrationWorkflow,
        workflow_definition: WorkflowDefinition,
        context: dict[str, Any] | None = None,
    ) -> OrchestrationWorkflow:
        """
        Execute a complete workflow with saga pattern.

        Args:
            workflow: OrchestrationWorkflow database model
            workflow_definition: Definition of steps to execute
            context: Execution context (shared data between steps)

        Returns:
            Updated workflow model
        """
        if context is None:
            context = {}

        # Update workflow status
        workflow.status = WorkflowStatus.RUNNING
        workflow.started_at = datetime.utcnow()
        workflow.context = context
        self.db.commit()

        logger.info(
            f"Starting workflow execution: {workflow.workflow_id} "
            f"(type={workflow.workflow_type}, steps={len(workflow_definition.steps)})"
        )

        try:
            # Execute each step in order
            for step_idx, step_def in enumerate(workflow_definition.steps):
                step = self._get_or_create_step(workflow, step_def, step_idx)

                # Execute the step
                success = await self._execute_step(step, step_def, context)

                if not success:
                    # Step failed - trigger compensation
                    logger.error(
                        f"Step {step.step_name} failed, starting compensation for "
                        f"workflow {workflow.workflow_id}"
                    )
                    await self._compensate_workflow(workflow)
                    return workflow

            # All steps completed successfully
            workflow.status = WorkflowStatus.COMPLETED
            workflow.completed_at = datetime.utcnow()
            workflow.output_data = context.get("output_data", {})
            self.db.commit()

            logger.info(f"Workflow {workflow.workflow_id} completed successfully")
            return workflow

        except Exception as e:
            logger.exception(f"Workflow {workflow.workflow_id} failed with exception: {e}")
            workflow.status = WorkflowStatus.FAILED
            workflow.failed_at = datetime.utcnow()
            workflow.error_message = str(e)
            workflow.error_details = {"exception_type": type(e).__name__}
            self.db.commit()

            # Attempt compensation
            await self._compensate_workflow(workflow)
            return workflow

    async def _execute_step(
        self,
        step: OrchestrationWorkflowStep,
        step_def: StepDefinition,
        context: dict[str, Any],
    ) -> bool:
        """
        Execute a single workflow step with retry logic.

        Args:
            step: Step database model
            step_def: Step definition
            context: Execution context

        Returns:
            True if step succeeded, False otherwise
        """
        logger.info(
            f"Executing step {step.step_name} (order={step.step_order}, "
            f"system={step.target_system})"
        )

        step.status = WorkflowStepStatus.RUNNING
        step.started_at = datetime.utcnow()
        self.db.commit()

        # Get the handler
        handler = self.step_handlers.get(step_def.handler)
        if not handler:
            logger.error(f"No handler found for: {step_def.handler}")
            step.status = WorkflowStepStatus.FAILED
            step.failed_at = datetime.utcnow()
            step.error_message = f"Handler not found: {step_def.handler}"
            self.db.commit()
            return False

        # Retry logic
        max_retries = step_def.max_retries
        for attempt in range(max_retries + 1):
            try:
                # Execute the handler
                result = await handler(
                    input_data=step.input_data,
                    context=context,
                    db=self.db,
                )

                # Store the result
                step.output_data = result.get("output_data", {})
                step.compensation_data = result.get("compensation_data", {})
                step.status = WorkflowStepStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                self.db.commit()

                # Update context for next steps
                if "context_updates" in result:
                    context.update(result["context_updates"])

                logger.info(f"Step {step.step_name} completed successfully")
                return True

            except Exception as e:
                step.retry_count = attempt
                error_msg = f"Attempt {attempt + 1}/{max_retries + 1} failed: {str(e)}"
                logger.warning(f"Step {step.step_name} - {error_msg}")

                if attempt >= max_retries:
                    # Final failure
                    step.status = WorkflowStepStatus.FAILED
                    step.failed_at = datetime.utcnow()
                    step.error_message = str(e)
                    step.error_details = {
                        "exception_type": type(e).__name__,
                        "attempts": attempt + 1,
                    }
                    self.db.commit()
                    logger.error(f"Step {step.step_name} failed after {max_retries + 1} attempts")
                    return False

                # Retry after a delay (exponential backoff could be added here)
                self.db.commit()

        return False

    async def _compensate_workflow(self, workflow: OrchestrationWorkflow) -> None:
        """
        Compensate (rollback) all completed steps in reverse order.

        Args:
            workflow: OrchestrationWorkflow to compensate
        """
        logger.info(f"Starting compensation for workflow {workflow.workflow_id}")

        workflow.status = WorkflowStatus.ROLLING_BACK
        workflow.compensation_started_at = datetime.utcnow()
        self.db.commit()

        # Get completed steps in reverse order
        completed_steps = [
            step for step in workflow.steps if step.status == WorkflowStepStatus.COMPLETED
        ]
        completed_steps.reverse()

        compensation_errors = []

        for step in completed_steps:
            try:
                success = await self._compensate_step(step)
                if not success:
                    compensation_errors.append(f"Step {step.step_name} compensation failed")
            except Exception as e:
                logger.exception(f"Exception during compensation of step {step.step_name}: {e}")
                compensation_errors.append(
                    f"Step {step.step_name} compensation exception: {str(e)}"
                )

        # Update workflow status
        if compensation_errors:
            workflow.status = WorkflowStatus.FAILED
            workflow.compensation_error = "; ".join(compensation_errors)
            logger.error(
                f"Workflow {workflow.workflow_id} compensation had errors: "
                f"{len(compensation_errors)} step(s) failed"
            )
        else:
            workflow.status = WorkflowStatus.ROLLED_BACK
            logger.info(f"Workflow {workflow.workflow_id} successfully rolled back")

        workflow.compensation_completed_at = datetime.utcnow()
        self.db.commit()

    async def _compensate_step(self, step: OrchestrationWorkflowStep) -> bool:
        """
        Compensate (rollback) a single step.

        Args:
            step: Step to compensate

        Returns:
            True if compensation succeeded, False otherwise
        """
        logger.info(f"Compensating step {step.step_name}")

        step.status = WorkflowStepStatus.COMPENSATING
        step.compensation_started_at = datetime.utcnow()
        self.db.commit()

        # Get the compensation handler
        if not step.compensation_handler:
            logger.warning(
                f"No compensation handler for step {step.step_name}, marking as compensated"
            )
            step.status = WorkflowStepStatus.COMPENSATED
            step.compensation_completed_at = datetime.utcnow()
            self.db.commit()
            return True

        handler = self.compensation_handlers.get(step.compensation_handler)  # type: ignore[call-overload]
        if not handler:
            logger.error(f"Compensation handler not found: {step.compensation_handler}")
            step.status = WorkflowStepStatus.COMPENSATION_FAILED
            step.compensation_completed_at = datetime.utcnow()
            self.db.commit()
            return False

        # Execute compensation with retry
        max_retries = step.max_retries
        for attempt in range(max_retries + 1):
            try:
                await handler(
                    step_data=step.output_data,
                    compensation_data=step.compensation_data,
                    db=self.db,
                )

                step.status = WorkflowStepStatus.COMPENSATED
                step.compensation_completed_at = datetime.utcnow()
                self.db.commit()

                logger.info(f"Step {step.step_name} compensated successfully")
                return True

            except Exception as e:
                error_msg = f"Compensation attempt {attempt + 1}/{max_retries + 1} failed: {str(e)}"
                logger.warning(f"Step {step.step_name} - {error_msg}")

                if attempt >= max_retries:
                    step.status = WorkflowStepStatus.COMPENSATION_FAILED
                    step.compensation_completed_at = datetime.utcnow()
                    self.db.commit()
                    logger.error(
                        f"Step {step.step_name} compensation failed after "
                        f"{max_retries + 1} attempts"
                    )
                    return False

                self.db.commit()

        return False

    def _get_or_create_step(
        self,
        workflow: OrchestrationWorkflow,
        step_def: StepDefinition,
        step_order: int,
    ) -> OrchestrationWorkflowStep:
        """
        Get existing step or create new one.

        Args:
            workflow: Parent workflow
            step_def: Step definition
            step_order: Step execution order

        Returns:
            OrchestrationWorkflowStep model
        """
        # Try to find existing step
        existing_step = next(
            (s for s in workflow.steps if s.step_order == step_order),
            None,
        )

        if existing_step:
            return existing_step

        # Create new step
        step = OrchestrationWorkflowStep(
            workflow_id=workflow.id,
            step_id=f"{workflow.workflow_id}_step_{step_order}",
            step_order=step_order,
            step_name=step_def.step_name,
            step_type=step_def.step_type,
            target_system=step_def.target_system,
            status=WorkflowStepStatus.PENDING,
            input_data=workflow.input_data,
            max_retries=step_def.max_retries,
            compensation_handler=step_def.compensation_handler,
            tenant_id=workflow.tenant_id,
        )

        self.db.add(step)
        self.db.commit()
        self.db.refresh(step)

        return step

    async def retry_failed_workflow(self, workflow: OrchestrationWorkflow) -> OrchestrationWorkflow:
        """
        Retry a failed workflow from the failed step.

        Args:
            workflow: Failed workflow to retry

        Returns:
            Updated workflow model
        """
        if workflow.status not in [WorkflowStatus.FAILED, WorkflowStatus.ROLLED_BACK]:
            raise ValueError(f"Cannot retry workflow in status: {workflow.status}")

        if workflow.retry_count >= workflow.max_retries:
            raise ValueError(f"Max retries ({workflow.max_retries}) exceeded")

        logger.info(
            f"Retrying workflow {workflow.workflow_id} "
            f"(attempt {workflow.retry_count + 1}/{workflow.max_retries})"
        )

        workflow.retry_count += 1
        workflow.status = WorkflowStatus.PENDING
        workflow.error_message = None
        workflow.error_details = None
        self.db.commit()

        # Note: The actual retry would be triggered by the service layer
        # This just prepares the workflow for retry
        return workflow

    async def retry_workflow(self, workflow: OrchestrationWorkflow) -> OrchestrationWorkflow:
        """
        Backwards compatible alias for retry_failed_workflow.
        """
        return await self.retry_failed_workflow(workflow)

    async def cancel_workflow(self, workflow: OrchestrationWorkflow) -> OrchestrationWorkflow:
        """
        Cancel a running workflow and trigger compensation.

        Args:
            workflow: Workflow to cancel

        Returns:
            Updated workflow model
        """
        if workflow.status not in [WorkflowStatus.PENDING, WorkflowStatus.RUNNING]:
            raise ValueError(f"Cannot cancel workflow in status: {workflow.status}")

        workflow.status = WorkflowStatus.ROLLING_BACK
        self.db.commit()

        await self._compensate_workflow(workflow)

        workflow.status = WorkflowStatus.ROLLED_BACK
        workflow.failed_at = datetime.utcnow()
        self.db.commit()

        return workflow
