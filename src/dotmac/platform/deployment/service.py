"""
Deployment Service

High-level orchestration service for deployment operations.
Coordinates adapters, registry, and business logic.
"""

import inspect
import logging
from copy import deepcopy
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from .adapters.base import DeploymentAdapter, ExecutionContext
from .adapters.factory import AdapterFactory
from .models import (
    DeploymentBackend,
    DeploymentExecution,
    DeploymentHealth,
    DeploymentInstance,
    DeploymentState,
)
from .registry import AsyncDeploymentRegistry, DeploymentRegistry
from .schemas import ProvisionRequest, ScaleRequest, UpgradeRequest

logger = logging.getLogger(__name__)


class DeploymentService:
    """
    Deployment Orchestration Service

    High-level service for managing deployment lifecycle operations.
    Coordinates between adapters, registry, and business logic.
    """

    def __init__(
        self,
        db: Session | AsyncSession,
        adapter_configs: dict[DeploymentBackend, dict[str, Any]] | None = None,
    ):
        """
        Initialize deployment service

        Args:
            db: Database session
            adapter_configs: Configuration for each backend adapter
        """
        self.db = db
        self.registry: DeploymentRegistry | AsyncDeploymentRegistry
        if isinstance(db, AsyncSession):
            self.registry = AsyncDeploymentRegistry(db)
        else:
            self.registry = DeploymentRegistry(db)
        self.adapter_configs = adapter_configs or {}
        self._adapter_cache: dict[DeploymentBackend, DeploymentAdapter] = {}

    async def _registry_call(self, method: str, *args: Any, **kwargs: Any) -> Any:
        """Invoke registry method and await when necessary."""
        attr = getattr(self.registry, method)
        result = attr(*args, **kwargs)
        if inspect.isawaitable(result):
            return await result
        return result

    async def _get_previous_successful_upgrade(
        self, instance_id: int, failed_execution_id: int
    ) -> DeploymentExecution | None:
        """Fetch the most recent successful upgrade prior to the failed execution."""
        if isinstance(self.db, AsyncSession):
            stmt = (
                select(DeploymentExecution)
                .where(
                    DeploymentExecution.instance_id == instance_id,
                    DeploymentExecution.operation == "upgrade",
                    DeploymentExecution.result == "success",
                    DeploymentExecution.id < failed_execution_id,
                )
                .order_by(DeploymentExecution.id.desc())
                .limit(1)
            )
            result = await self.db.execute(stmt)
            return result.scalars().first()

        return (
            self.db.query(DeploymentExecution)
            .filter(
                DeploymentExecution.instance_id == instance_id,
                DeploymentExecution.operation == "upgrade",
                DeploymentExecution.result == "success",
                DeploymentExecution.id < failed_execution_id,
            )
            .order_by(DeploymentExecution.id.desc())
            .first()
        )

    def _get_adapter(self, backend: DeploymentBackend) -> DeploymentAdapter:
        """Get or create adapter for backend"""
        if backend not in self._adapter_cache:
            config = self.adapter_configs.get(backend, {})
            self._adapter_cache[backend] = AdapterFactory.create_adapter(backend, config)
        return self._adapter_cache[backend]

    async def _create_execution_context(
        self, instance: DeploymentInstance, operation: str, **kwargs: Any
    ) -> ExecutionContext:
        """Create execution context from instance"""
        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")

        config = deepcopy(instance.config) if instance.config is not None else {}
        config_updates: dict[str, Any] | None = kwargs.get("config_updates")
        if config_updates:
            config.update(config_updates)

        return ExecutionContext(
            tenant_id=instance.tenant_id,
            instance_id=instance.id,
            execution_id=kwargs.get("execution_id", 0),
            operation=operation,
            template_name=template.name,
            template_version=instance.version,
            config=config,
            secrets=kwargs.get("secrets", {}),
            cpu_cores=kwargs.get("cpu_cores", instance.allocated_cpu),
            memory_gb=kwargs.get("memory_gb", instance.allocated_memory_gb),
            storage_gb=kwargs.get("storage_gb", instance.allocated_storage_gb),
            environment=instance.environment,
            region=instance.region,
            availability_zone=instance.availability_zone,
            namespace=instance.namespace,
            cluster_name=instance.cluster_name,
            from_version=instance.version,
            to_version=kwargs.get("to_version", instance.version),
            tags=instance.tags or {},
            triggered_by=kwargs.get("triggered_by"),
        )

    async def provision_deployment(
        self,
        tenant_id: int,
        request: ProvisionRequest,
        triggered_by: int | None = None,
        secrets: dict[str, Any] | None = None,
    ) -> tuple[DeploymentInstance, DeploymentExecution]:
        """
        Provision new deployment

        Args:
            tenant_id: Tenant ID
            request: Provision request
            triggered_by: User ID who triggered operation
            secrets: Deployment secrets

        Returns:
            Tuple of (instance, execution)
        """
        logger.info(
            f"Provisioning deployment for tenant {tenant_id}, template {request.template_id}"
        )

        # Get template
        template = await self._registry_call("get_template", request.template_id)
        if not template:
            raise ValueError(f"Template {request.template_id} not found")

        if not template.is_active:
            raise ValueError(f"Template {template.name} is not active")

        # Check if instance already exists
        existing = await self._registry_call(
            "get_instance_by_tenant", tenant_id, request.environment
        )
        if existing:
            raise ValueError(
                f"Deployment already exists for tenant {tenant_id} in {request.environment}"
            )

        # Create instance record
        instance = DeploymentInstance(
            tenant_id=tenant_id,
            template_id=template.id,
            environment=request.environment,
            region=request.region,
            config=request.config,
            version=template.version,
            state=DeploymentState.PENDING,
            allocated_cpu=request.allocated_cpu or template.cpu_cores,
            allocated_memory_gb=request.allocated_memory_gb or template.memory_gb,
            allocated_storage_gb=request.allocated_storage_gb or template.storage_gb,
            tags=request.tags,
            notes=request.notes,
            deployed_by=triggered_by,
        )
        instance = await self._registry_call("create_instance", instance)

        # Create execution record
        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="provision",
            state="running",
            triggered_by=triggered_by,
            trigger_type="manual" if triggered_by else "automated",
        )
        execution = await self._registry_call("create_execution", execution)

        # Update instance state to provisioning
        await self._registry_call(
            "update_instance_state", instance.id, DeploymentState.PROVISIONING
        )

        try:
            # Get adapter
            adapter = self._get_adapter(template.backend)

            # Create execution context
            context = await self._create_execution_context(
                instance,
                "provision",
                execution_id=execution.id,
                secrets=secrets or {},
                triggered_by=triggered_by,
            )

            # Execute provision
            result = await adapter.provision(context)

            # Update execution with result
            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
                backend_job_id=result.backend_job_id,
                backend_job_url=result.backend_job_url,
                backend_logs=result.logs,
                error_message=result.message if result.is_failure() else None,
            )

            # Update instance with result
            if result.is_success():
                await self._registry_call(
                    "update_instance",
                    instance.id,
                    state=DeploymentState.ACTIVE,
                    endpoints=result.endpoints,
                    namespace=result.metadata.get("namespace"),
                    cluster_name=result.metadata.get("cluster"),
                    backend_job_id=result.backend_job_id,
                )
                logger.info(f"Successfully provisioned deployment {instance.id}")
            else:
                await self._registry_call(
                    "update_instance_state",
                    instance.id,
                    DeploymentState.FAILED,
                    reason=result.message,
                )
                logger.error(f"Failed to provision deployment {instance.id}: {result.message}")

            # Refresh instance
            refreshed_instance = await self._registry_call("get_instance", instance.id)
            if not refreshed_instance:
                raise ValueError(f"Instance {instance.id} not found after provision")

            return refreshed_instance, execution

        except Exception as e:
            logger.error(f"Error provisioning deployment: {e}", exc_info=True)

            # Update execution as failed
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                result="failure",
                error_message=str(e),
            )

            # Update instance state
            await self._registry_call(
                "update_instance_state", instance.id, DeploymentState.FAILED, reason=str(e)
            )

            raise

    async def upgrade_deployment(
        self,
        instance_id: int,
        request: UpgradeRequest,
        triggered_by: int | None = None,
        secrets: dict[str, Any] | None = None,
    ) -> DeploymentExecution:
        """
        Upgrade deployment to new version

        Args:
            instance_id: Instance ID
            request: Upgrade request
            triggered_by: User ID
            secrets: Updated secrets

        Returns:
            Execution record
        """
        logger.info(f"Upgrading deployment {instance_id} to version {request.to_version}")

        # Get instance
        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        if instance.state != DeploymentState.ACTIVE:
            raise ValueError(f"Cannot upgrade instance in state {instance.state.value}")

        # Get template
        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")

        # Create execution
        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="upgrade",
            state="running",
            from_version=instance.version,
            to_version=request.to_version,
            operation_config=request.config_updates or {},
            triggered_by=triggered_by,
            trigger_type="manual" if triggered_by else "automated",
        )
        execution = await self._registry_call("create_execution", execution)

        # Update instance state
        await self._registry_call("update_instance_state", instance.id, DeploymentState.UPGRADING)

        try:
            # Get adapter
            adapter = self._get_adapter(template.backend)

            original_config = deepcopy(instance.config) if instance.config is not None else None

            # Create context
            context = await self._create_execution_context(
                instance,
                "upgrade",
                execution_id=execution.id,
                to_version=request.to_version,
                config_updates=request.config_updates or {},
                secrets=secrets or {},
                triggered_by=triggered_by,
            )

            # Execute upgrade
            result = await adapter.upgrade(context)

            # Update execution
            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
                backend_job_id=result.backend_job_id,
                backend_job_url=result.backend_job_url,
                backend_logs=result.logs,
                error_message=result.message if result.is_failure() else None,
            )

            # Update instance
            if result.is_success():
                updates: dict[str, Any] = {
                    "state": DeploymentState.ACTIVE,
                    "version": request.to_version,
                }
                if request.config_updates:
                    base_config = original_config or {}
                    updated_config = deepcopy(base_config)
                    updated_config.update(request.config_updates)
                    updates["config"] = updated_config
                await self._registry_call("update_instance", instance.id, **updates)
                logger.info(
                    f"Successfully upgraded deployment {instance.id} to {request.to_version}"
                )
            else:
                # Handle rollback if enabled
                if request.rollback_on_failure:
                    logger.warning(
                        f"Upgrade failed, initiating rollback for instance {instance.id}"
                    )
                    await self.rollback_deployment(instance.id, execution.id, triggered_by)
                else:
                    await self._registry_call(
                        "update_instance_state",
                        instance.id,
                        DeploymentState.FAILED,
                        reason=result.message,
                    )

            return execution

        except Exception as e:
            logger.error(f"Error upgrading deployment: {e}", exc_info=True)

            # Update execution
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                result="failure",
                error_message=str(e),
            )

            # Rollback if enabled
            if request.rollback_on_failure:
                await self.rollback_deployment(instance.id, execution.id, triggered_by)
            else:
                await self._registry_call(
                    "update_instance_state",
                    instance.id,
                    DeploymentState.FAILED,
                    reason=str(e),
                )

            raise

    async def scale_deployment(
        self, instance_id: int, request: ScaleRequest, triggered_by: int | None = None
    ) -> DeploymentExecution:
        """Scale deployment resources"""
        logger.info(f"Scaling deployment {instance_id}")

        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")

        # Create execution
        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="scale",
            state="running",
            operation_config={
                "cpu_cores": request.cpu_cores,
                "memory_gb": request.memory_gb,
                "storage_gb": request.storage_gb,
            },
            triggered_by=triggered_by,
            trigger_type="manual",
        )
        execution = await self._registry_call("create_execution", execution)

        try:
            # Get adapter
            adapter = self._get_adapter(template.backend)

            target_cpu = (
                request.cpu_cores if request.cpu_cores is not None else instance.allocated_cpu
            )
            target_memory = (
                request.memory_gb if request.memory_gb is not None else instance.allocated_memory_gb
            )
            target_storage = (
                request.storage_gb
                if request.storage_gb is not None
                else instance.allocated_storage_gb
            )

            # Create context
            context = await self._create_execution_context(
                instance,
                "scale",
                execution_id=execution.id,
                triggered_by=triggered_by,
                cpu_cores=target_cpu,
                memory_gb=target_memory,
                storage_gb=target_storage,
            )

            # Execute scale
            result = await adapter.scale(context)

            # Update execution
            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
                backend_logs=result.logs,
            )

            # Update instance
            if result.is_success():
                await self._registry_call(
                    "update_instance",
                    instance.id,
                    allocated_cpu=target_cpu,
                    allocated_memory_gb=target_memory,
                    allocated_storage_gb=target_storage,
                )

            return execution

        except Exception as e:
            logger.error(f"Error scaling deployment: {e}", exc_info=True)
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            raise

    async def suspend_deployment(
        self, instance_id: int, reason: str, triggered_by: int | None = None
    ) -> DeploymentExecution:
        """Suspend deployment"""
        logger.info(f"Suspending deployment {instance_id}")

        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")
        adapter = self._get_adapter(template.backend)

        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="suspend",
            state="running",
            operation_config={"reason": reason},
            triggered_by=triggered_by,
            trigger_type="manual",
        )
        execution = await self._registry_call("create_execution", execution)

        try:
            context = await self._create_execution_context(
                instance, "suspend", execution_id=execution.id, triggered_by=triggered_by
            )
            result = await adapter.suspend(context)

            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
            )

            if result.is_success():
                await self._registry_call(
                    "update_instance_state", instance.id, DeploymentState.SUSPENDED, reason=reason
                )

            return execution

        except Exception as e:
            logger.error(f"Error suspending deployment: {e}", exc_info=True)
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            raise

    async def resume_deployment(
        self, instance_id: int, reason: str, triggered_by: int | None = None
    ) -> DeploymentExecution:
        """Resume suspended deployment"""
        logger.info(f"Resuming deployment {instance_id}")

        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        if instance.state != DeploymentState.SUSPENDED:
            raise ValueError(f"Cannot resume instance in state {instance.state.value}")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")
        adapter = self._get_adapter(template.backend)

        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="resume",
            state="running",
            operation_config={"reason": reason},
            triggered_by=triggered_by,
            trigger_type="manual",
        )
        execution = await self._registry_call("create_execution", execution)

        try:
            context = await self._create_execution_context(
                instance, "resume", execution_id=execution.id, triggered_by=triggered_by
            )
            result = await adapter.resume(context)

            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
            )

            if result.is_success():
                await self._registry_call(
                    "update_instance_state", instance.id, DeploymentState.ACTIVE, reason=reason
                )

            return execution

        except Exception as e:
            logger.error(f"Error resuming deployment: {e}", exc_info=True)
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            raise

    async def destroy_deployment(
        self,
        instance_id: int,
        reason: str,
        backup_data: bool = True,
        triggered_by: int | None = None,
    ) -> DeploymentExecution:
        """Destroy deployment"""
        logger.info(f"Destroying deployment {instance_id}")

        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")
        adapter = self._get_adapter(template.backend)

        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="destroy",
            state="running",
            operation_config={"reason": reason, "backup_data": backup_data},
            triggered_by=triggered_by,
            trigger_type="manual",
        )
        execution = await self._registry_call("create_execution", execution)

        await self._registry_call("update_instance_state", instance.id, DeploymentState.DESTROYING)

        try:
            context = await self._create_execution_context(
                instance, "destroy", execution_id=execution.id, triggered_by=triggered_by
            )
            result = await adapter.destroy(context)

            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
            )

            if result.is_success():
                await self._registry_call(
                    "update_instance_state", instance.id, DeploymentState.DESTROYED, reason=reason
                )

            return execution

        except Exception as e:
            logger.error(f"Error destroying deployment: {e}", exc_info=True)
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            await self._registry_call(
                "update_instance_state", instance.id, DeploymentState.FAILED, reason=str(e)
            )
            raise

    async def rollback_deployment(
        self, instance_id: int, failed_execution_id: int, triggered_by: int | None = None
    ) -> DeploymentExecution:
        """Rollback deployment to previous version"""
        logger.info(f"Rolling back deployment {instance_id}")

        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        previous_upgrade = await self._get_previous_successful_upgrade(
            instance_id, failed_execution_id
        )

        if not previous_upgrade:
            raise ValueError("No previous version to rollback to")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")
        adapter = self._get_adapter(template.backend)

        execution = DeploymentExecution(
            instance_id=instance.id,
            operation="rollback",
            state="running",
            from_version=instance.version,
            to_version=previous_upgrade.from_version,
            rollback_execution_id=failed_execution_id,
            triggered_by=triggered_by,
            trigger_type="automated",
        )
        execution = await self._registry_call("create_execution", execution)

        await self._registry_call(
            "update_instance_state", instance.id, DeploymentState.ROLLING_BACK
        )

        try:
            context = await self._create_execution_context(
                instance,
                "rollback",
                execution_id=execution.id,
                to_version=previous_upgrade.from_version,
                triggered_by=triggered_by,
            )
            result = await adapter.rollback(context)

            await self._registry_call(
                "update_execution",
                execution.id,
                state="succeeded" if result.is_success() else "failed",
                completed_at=result.completed_at,
                result="success" if result.is_success() else "failure",
            )

            if result.is_success():
                await self._registry_call(
                    "update_instance",
                    instance.id,
                    state=DeploymentState.ACTIVE,
                    version=previous_upgrade.from_version,
                )
            else:
                await self._registry_call(
                    "update_instance_state", instance.id, DeploymentState.FAILED
                )

            return execution

        except Exception as e:
            logger.error(f"Error rolling back deployment: {e}", exc_info=True)
            await self._registry_call(
                "update_execution",
                execution.id,
                state="failed",
                completed_at=datetime.utcnow(),
                error_message=str(e),
            )
            await self._registry_call(
                "update_instance_state", instance.id, DeploymentState.FAILED, reason=str(e)
            )
            raise

    async def schedule_deployment(
        self,
        tenant_id: int,
        operation: str,
        scheduled_at: datetime,
        provision_request: ProvisionRequest | None = None,
        upgrade_request: UpgradeRequest | None = None,
        scale_request: ScaleRequest | None = None,
        instance_id: int | None = None,
        triggered_by: int | None = None,
        cron_expression: str | None = None,
        interval_seconds: int | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Schedule a deployment operation for future execution.

        Supports one-time scheduled deployments or recurring schedules via cron/interval.

        Args:
            tenant_id: Tenant ID
            operation: Operation type (provision, upgrade, scale, suspend, resume, destroy)
            scheduled_at: When to execute (for one-time schedules)
            provision_request: Provision parameters (for provision operation)
            upgrade_request: Upgrade parameters (for upgrade operation)
            scale_request: Scale parameters (for scale operation)
            instance_id: Instance ID (required for upgrade/scale/suspend/resume/destroy)
            triggered_by: User ID who scheduled the operation
            cron_expression: Cron schedule for recurring operations (optional)
            interval_seconds: Interval for recurring operations (optional)
            metadata: Additional scheduling metadata

        Returns:
            Dictionary with schedule details including schedule_id

        Raises:
            ValueError: If operation parameters are invalid
        """
        from dotmac.platform.jobs.models import JobPriority
        from dotmac.platform.jobs.scheduler_service import SchedulerService

        logger.info(
            f"Scheduling deployment operation: tenant_id={tenant_id}, operation={operation}, "
            f"scheduled_at={scheduled_at}, instance_id={instance_id}, "
            f"is_recurring={bool(cron_expression or interval_seconds)}"
        )

        # Validate operation and parameters
        valid_operations = ["provision", "upgrade", "scale", "suspend", "resume", "destroy"]
        if operation not in valid_operations:
            raise ValueError(f"Invalid operation: {operation}. Must be one of {valid_operations}")

        # Validate operation-specific requirements
        if operation == "provision" and not provision_request:
            raise ValueError("provision_request is required for provision operation")

        if operation in ["upgrade", "scale", "suspend", "resume", "destroy"] and not instance_id:
            raise ValueError(f"instance_id is required for {operation} operation")

        if operation == "upgrade" and not upgrade_request:
            raise ValueError("upgrade_request is required for upgrade operation")

        if operation == "scale" and not scale_request:
            raise ValueError("scale_request is required for scale operation")

        # Prepare job parameters
        job_parameters: dict[str, Any] = {
            "tenant_id": tenant_id,
            "operation": operation,
            "triggered_by": triggered_by,
            "metadata": metadata or {},
        }

        # Add operation-specific parameters
        if provision_request:
            job_parameters["provision_request"] = {
                "template_id": provision_request.template_id,
                "environment": provision_request.environment,
                "region": provision_request.region,
                "config": provision_request.config,
                "allocated_cpu": provision_request.allocated_cpu,
                "allocated_memory_gb": provision_request.allocated_memory_gb,
                "allocated_storage_gb": provision_request.allocated_storage_gb,
                "tags": provision_request.tags,
                "notes": provision_request.notes,
            }

        if upgrade_request:
            job_parameters["upgrade_request"] = {
                "to_version": upgrade_request.to_version,
                "config_updates": upgrade_request.config_updates,
                "rollback_on_failure": upgrade_request.rollback_on_failure,
            }
            job_parameters["instance_id"] = instance_id

        if scale_request:
            job_parameters["scale_request"] = {
                "cpu_cores": scale_request.cpu_cores,
                "memory_gb": scale_request.memory_gb,
                "storage_gb": scale_request.storage_gb,
            }
            job_parameters["instance_id"] = instance_id

        if instance_id and operation in ["suspend", "resume", "destroy"]:
            job_parameters["instance_id"] = instance_id

        # Create scheduled job
        scheduler = SchedulerService(self.db)

        # Determine if this is a one-time or recurring schedule
        if cron_expression or interval_seconds:
            # Recurring schedule
            scheduled_job = await scheduler.create_scheduled_job(
                tenant_id=str(tenant_id),
                created_by=str(triggered_by) if triggered_by else "system",
                name=f"deployment_{operation}_{instance_id or 'new'}",
                job_type=f"deployment_{operation}",
                cron_expression=cron_expression,
                interval_seconds=interval_seconds,
                description=f"Scheduled {operation} deployment for tenant {tenant_id}",
                parameters=job_parameters,
                priority=JobPriority.NORMAL,
                max_retries=2,
                retry_delay_seconds=300,  # 5 minutes
                max_concurrent_runs=1,
                timeout_seconds=3600,  # 1 hour
            )

            logger.info(
                f"Created recurring deployment schedule: schedule_id={scheduled_job.id}, "
                f"operation={operation}, cron={cron_expression}, interval={interval_seconds}"
            )

            return {
                "schedule_id": scheduled_job.id,
                "schedule_type": "recurring",
                "operation": operation,
                "cron_expression": cron_expression,
                "interval_seconds": interval_seconds,
                "next_run_at": scheduled_job.next_run_at,
                "parameters": job_parameters,
            }
        else:
            # One-time schedule - calculate delay from now
            now = datetime.utcnow()
            if scheduled_at <= now:
                raise ValueError("scheduled_at must be in the future")

            # For one-time schedules, we'll use interval-based with a flag to run once
            delay_seconds = int((scheduled_at - now).total_seconds())

            scheduled_job = await scheduler.create_scheduled_job(
                tenant_id=str(tenant_id),
                created_by=str(triggered_by) if triggered_by else "system",
                name=f"deployment_{operation}_{instance_id or 'new'}_{scheduled_at.isoformat()}",
                job_type=f"deployment_{operation}",
                interval_seconds=delay_seconds,  # Will trigger once after delay
                description=f"One-time {operation} deployment scheduled for {scheduled_at.isoformat()}",
                parameters={**job_parameters, "one_time_schedule": True},
                priority=JobPriority.NORMAL,
                max_retries=2,
                retry_delay_seconds=300,
                max_concurrent_runs=1,
                timeout_seconds=3600,
            )

            # Deactivate after first run by setting flag in parameters
            logger.info(
                f"Created one-time deployment schedule: schedule_id={scheduled_job.id}, "
                f"operation={operation}, scheduled_at={scheduled_at}"
            )

            return {
                "schedule_id": scheduled_job.id,
                "schedule_type": "one_time",
                "operation": operation,
                "scheduled_at": scheduled_at,
                "parameters": job_parameters,
            }

    async def check_health(self, instance_id: int) -> DeploymentHealth:
        """Perform health check on deployment"""
        instance = await self._registry_call("get_instance", instance_id)
        if not instance:
            raise ValueError(f"Instance {instance_id} not found")

        template = await self._registry_call("get_template", instance.template_id)
        if not template:
            raise ValueError(f"Template {instance.template_id} not found")
        adapter = self._get_adapter(template.backend)

        context = await self._create_execution_context(instance, "health_check")

        try:
            health_result = await adapter.health_check(context)

            health = DeploymentHealth(
                instance_id=instance.id,
                check_type="http",
                endpoint=instance.health_check_url or "",
                status=health_result.get("status", "unknown"),
                details=health_result.get("details"),
                checked_at=datetime.utcnow(),
            )

            health = await self._registry_call("record_health", health)
            await self._registry_call("update_instance_health", instance.id, health)

            return health

        except Exception as e:
            logger.error(f"Health check failed for instance {instance_id}: {e}")

            health = DeploymentHealth(
                instance_id=instance.id,
                check_type="http",
                endpoint=instance.health_check_url or "",
                status="unhealthy",
                error_message=str(e),
                checked_at=datetime.utcnow(),
            )

            health = await self._registry_call("record_health", health)
            await self._registry_call("update_instance_health", instance.id, health)

            return health
