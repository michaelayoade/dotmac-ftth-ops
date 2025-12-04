"""
Workflow Engine

Core execution engine for orchestrating multi-step workflows across modules.
"""

import logging
from datetime import datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .models import StepStatus, Workflow, WorkflowExecution, WorkflowStatus, WorkflowStep

logger = logging.getLogger(__name__)


class WorkflowEngineError(Exception):
    """Base exception for workflow engine errors"""

    pass


class StepExecutionError(WorkflowEngineError):
    """Exception raised when a step fails execution"""

    pass


class WorkflowEngine:
    """
    Workflow Execution Engine

    Orchestrates the execution of workflows by:
    1. Managing workflow state transitions
    2. Executing steps sequentially
    3. Handling retries and error recovery
    4. Publishing domain events
    """

    def __init__(
        self,
        db_session: AsyncSession,
        event_publisher: Any | None = None,
        service_registry: Any | None = None,
    ):
        self.db = db_session
        self.event_publisher = event_publisher
        self.service_registry = service_registry

    async def execute_workflow(
        self,
        workflow: Workflow,
        context: dict[str, Any],
        trigger_type: str = "manual",
        trigger_source: str | None = None,
        tenant_id: int | None = None,
    ) -> WorkflowExecution:
        """
        Execute a workflow with the given context.

        Args:
            workflow: The workflow template to execute
            context: Input data/variables for the workflow
            trigger_type: How the workflow was triggered (manual, event, scheduled, api)
            trigger_source: Source identifier (event name, user ID, endpoint)
            tenant_id: Tenant context for multi-tenancy

        Returns:
            WorkflowExecution: The completed execution record
        """
        # Create execution record
        execution = WorkflowExecution(
            workflow_id=workflow.id,
            status=WorkflowStatus.PENDING,
            context=context,
            trigger_type=trigger_type,
            trigger_source=trigger_source,
            tenant_id=tenant_id,
        )
        self.db.add(execution)
        await self.db.flush()

        logger.info(
            f"Starting workflow execution {execution.id} for workflow '{workflow.name}' "
            f"(trigger: {trigger_type})"
        )

        try:
            # Update status to running
            execution.status = WorkflowStatus.RUNNING
            execution.started_at = datetime.utcnow()
            await self.db.flush()

            # Execute workflow steps
            result = await self._execute_steps(execution, workflow.definition, context)

            # Mark as completed
            execution.status = WorkflowStatus.COMPLETED
            execution.completed_at = datetime.utcnow()
            execution.result = result

            logger.info(f"Workflow execution {execution.id} completed successfully")

            # Publish success event
            if self.event_publisher:
                await self.event_publisher.publish(
                    "workflow.execution.completed",
                    {
                        "execution_id": execution.id,
                        "workflow_name": workflow.name,
                        "result": result,
                        "tenant_id": tenant_id,
                    },
                )

        except Exception as e:
            # Mark as failed
            execution.status = WorkflowStatus.FAILED
            execution.completed_at = datetime.utcnow()
            execution.error_message = str(e)

            logger.error(
                f"Workflow execution {execution.id} failed: {e}",
                exc_info=True,
            )

            # Publish failure event
            if self.event_publisher:
                await self.event_publisher.publish(
                    "workflow.execution.failed",
                    {
                        "execution_id": execution.id,
                        "workflow_name": workflow.name,
                        "error": str(e),
                        "tenant_id": tenant_id,
                    },
                )

            raise

        finally:
            await self.db.commit()

        return execution

    async def _execute_steps(
        self,
        execution: WorkflowExecution,
        definition: dict[str, Any],
        context: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute workflow steps sequentially.

        Args:
            execution: The execution record
            definition: Workflow definition with steps
            context: Current execution context

        Returns:
            Dict containing the final workflow result
        """
        steps = definition.get("steps", [])
        workflow_context = context.copy()
        results = {}

        for idx, step_def in enumerate(steps):
            step_name = step_def.get("name", f"step_{idx}")
            step_type = step_def.get("type")
            max_retries = step_def.get("max_retries", 3)

            # Create step record
            step = WorkflowStep(
                execution_id=execution.id,
                step_name=step_name,
                step_type=step_type,
                sequence_number=idx,
                status=StepStatus.PENDING,
                max_retries=max_retries,
                input_data=self._resolve_params(step_def.get("input", {}), workflow_context),
            )
            self.db.add(step)
            await self.db.flush()

            # Execute step with retry logic
            step_result = await self._execute_step_with_retry(step, step_def, workflow_context)

            # Store result in context for subsequent steps
            results[step_name] = step_result
            workflow_context[f"step_{step_name}_result"] = step_result

            # Check for conditional branching
            if step_def.get("condition"):
                condition_met = self._evaluate_condition(step_def["condition"], workflow_context)
                if not condition_met:
                    logger.info(f"Step {step_name} condition not met, skipping remaining steps")
                    break

        return {"steps": results, "final_context": workflow_context}

    async def _execute_step_with_retry(
        self,
        step: WorkflowStep,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> Any:
        """
        Execute a single step with retry logic.

        Args:
            step: The step record
            step_def: Step definition from workflow
            context: Current execution context

        Returns:
            The step execution result
        """
        last_error = None

        for attempt in range(step.max_retries + 1):
            try:
                # Update step status
                step.status = StepStatus.RUNNING
                step.started_at = datetime.utcnow()
                step.retry_count = attempt
                await self.db.flush()

                # Execute the step
                result = await self._execute_step(step_def, context)

                # Mark as completed
                step.status = StepStatus.COMPLETED
                step.completed_at = datetime.utcnow()
                step.output_data = result
                step.duration_seconds = int((step.completed_at - step.started_at).total_seconds())
                await self.db.flush()

                logger.info(
                    f"Step {step.step_name} completed successfully "
                    f"(attempt {attempt + 1}/{step.max_retries + 1})"
                )

                return result

            except Exception as e:
                last_error = e
                logger.warning(
                    f"Step {step.step_name} failed on attempt {attempt + 1}/{step.max_retries + 1}: {e}"
                )

                # Store error details
                step.error_message = str(e)
                step.error_details = {"attempt": attempt + 1, "error_type": type(e).__name__}

                # Check if we should retry
                if attempt < step.max_retries:
                    await self.db.flush()
                    continue
                else:
                    # Max retries reached, mark as failed
                    step.status = StepStatus.FAILED
                    step.completed_at = datetime.utcnow()
                    await self.db.flush()

                    logger.error(f"Step {step.step_name} failed after {attempt + 1} attempts")
                    raise StepExecutionError(
                        f"Step {step.step_name} failed after {attempt + 1} attempts: {e}"
                    ) from e

        # Should never reach here, but just in case
        raise StepExecutionError(f"Step {step.step_name} failed: {last_error}")

    async def _execute_step(
        self,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> Any:
        """
        Execute a single workflow step based on its type.

        Args:
            step_def: Step definition from workflow
            context: Current execution context

        Returns:
            The step execution result
        """
        step_type = step_def.get("type")
        step_name = step_def.get("name")

        logger.debug(f"Executing step {step_name} of type {step_type}")

        if step_type == "service_call":
            return await self._execute_service_call(step_def, context)
        elif step_type == "transform":
            return self._execute_transform(step_def, context)
        elif step_type == "condition":
            return self._execute_condition(step_def, context)
        elif step_type == "wait":
            return await self._execute_wait(step_def, context)
        else:
            raise ValueError(f"Unknown step type: {step_type}")

    async def _execute_service_call(
        self,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> Any:
        """
        Execute a service call step (call another module/service).

        Args:
            step_def: Step definition
            context: Current execution context

        Returns:
            The service call result
        """
        service_name = step_def.get("service")
        method_name = step_def.get("method")
        params = self._resolve_params(step_def.get("params", {}), context)

        logger.info(f"Calling service {service_name}.{method_name} with params: {params}")

        # Get the service instance (this will be injected via dependency injection)
        service = await self._get_service(service_name)

        if not hasattr(service, method_name):
            raise AttributeError(f"Service {service_name} does not have method {method_name}")

        # Call the service method
        method = getattr(service, method_name)
        result = await method(**params)

        logger.debug(f"Service call result: {result}")
        return result

    def _execute_transform(
        self,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> Any:
        """
        Execute a data transformation step.

        Args:
            step_def: Step definition
            context: Current execution context

        Returns:
            Transformed data
        """
        transform_type = step_def.get("transform_type", "map")
        source = self._resolve_params(step_def.get("source"), context)
        mapping = step_def.get("mapping", {})

        if transform_type == "map":
            # Simple key mapping
            result = {}
            for target_key, source_path in mapping.items():
                result[target_key] = self._resolve_params(source_path, context)
            return result
        elif transform_type == "filter":
            # Filter array/list based on condition
            condition = step_def.get("condition")
            return [item for item in source if self._evaluate_condition(condition, item)]
        else:
            raise ValueError(f"Unknown transform type: {transform_type}")

    def _execute_condition(
        self,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> bool:
        """
        Execute a conditional step.

        Args:
            step_def: Step definition
            context: Current execution context

        Returns:
            Boolean result of condition evaluation
        """
        condition = step_def.get("condition")
        return self._evaluate_condition(condition, context)

    async def _execute_wait(
        self,
        step_def: dict[str, Any],
        context: dict[str, Any],
    ) -> None:
        """
        Execute a wait/delay step.

        Args:
            step_def: Step definition
            context: Current execution context
        """
        import asyncio

        duration = step_def.get("duration", 0)
        logger.info(f"Waiting for {duration} seconds")
        await asyncio.sleep(duration)

    def _resolve_params(
        self,
        params: Any,
        context: dict[str, Any],
    ) -> Any:
        """
        Resolve parameter values from context using template syntax.

        Supports syntax like: ${context.lead_id} or ${step_create_customer_result.id}

        Args:
            params: Parameter value or dict of parameters
            context: Current execution context

        Returns:
            Resolved parameter value(s)
        """
        if isinstance(params, str):
            # Simple string template resolution
            if params.startswith("${") and params.endswith("}"):
                path = params[2:-1]  # Remove ${ and }
                return self._get_nested_value(context, path)
            return params
        elif isinstance(params, dict):
            # Recursively resolve all values in dict
            return {k: self._resolve_params(v, context) for k, v in params.items()}
        elif isinstance(params, list):
            # Recursively resolve all values in list
            return [self._resolve_params(v, context) for v in params]
        else:
            return params

    def _get_nested_value(self, obj: dict[str, Any], path: str) -> Any:
        """
        Get nested value from dict using dot notation.

        Example: "context.lead_id" -> obj["context"]["lead_id"]

        Args:
            obj: Dictionary to traverse
            path: Dot-separated path

        Returns:
            The value at the path
        """
        parts = path.split(".")
        current: Any = obj
        for part in parts:
            if isinstance(current, dict):
                current = current.get(part)
            elif isinstance(current, list) and part.isdigit():
                index = int(part)
                if 0 <= index < len(current):
                    current = current[index]
                else:
                    return None
            else:
                return None
        return current

    def _evaluate_condition(
        self,
        condition: dict[str, Any],
        context: dict[str, Any],
    ) -> bool:
        """
        Evaluate a conditional expression.

        Supports simple operators: eq, ne, gt, lt, gte, lte, in, not_in

        Args:
            condition: Condition definition
            context: Current execution context

        Returns:
            Boolean result
        """
        operator = condition.get("operator")
        left = self._resolve_params(condition.get("left"), context)
        right = self._resolve_params(condition.get("right"), context)

        if operator == "eq":
            return left == right
        elif operator == "ne":
            return left != right
        elif operator == "gt":
            return left > right
        elif operator == "lt":
            return left < right
        elif operator == "gte":
            return left >= right
        elif operator == "lte":
            return left <= right
        elif operator == "in":
            return left in right
        elif operator == "not_in":
            return left not in right
        else:
            raise ValueError(f"Unknown operator: {operator}")

    async def _get_service(self, service_name: str) -> Any:
        """
        Get service instance for service calls.

        Uses the service registry for dependency injection.

        Args:
            service_name: Name of the service to retrieve

        Returns:
            Service instance

        Raises:
            ValueError: If service not found in registry
        """
        if self.service_registry is None:
            raise ValueError(f"Service registry not configured. Cannot get service: {service_name}")

        try:
            return self.service_registry.get_service(service_name)
        except Exception as e:
            logger.error(f"Failed to resolve service {service_name}: {e}")
            raise ValueError(f"Service {service_name} not available: {e}") from e

    async def cancel_execution(self, execution_id: int) -> None:
        """
        Cancel a running workflow execution.

        Args:
            execution_id: ID of the execution to cancel
        """
        execution = await self.db.get(WorkflowExecution, execution_id)
        if not execution:
            raise ValueError(f"Execution {execution_id} not found")

        if execution.status not in (WorkflowStatus.PENDING, WorkflowStatus.RUNNING):
            raise ValueError(
                f"Cannot cancel execution {execution_id} with status {execution.status}"
            )

        execution.status = WorkflowStatus.CANCELLED
        execution.completed_at = datetime.utcnow()
        await self.db.commit()

        logger.info(f"Workflow execution {execution_id} cancelled")

        # Publish cancellation event
        if self.event_publisher:
            await self.event_publisher.publish(
                "workflow.execution.cancelled",
                {"execution_id": execution_id},
            )
