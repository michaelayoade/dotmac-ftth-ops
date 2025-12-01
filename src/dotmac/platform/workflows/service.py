"""
Workflow Service

High-level service layer for workflow management and execution.
"""

import logging
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .engine import WorkflowEngine
from .models import Workflow, WorkflowExecution, WorkflowStatus

logger = logging.getLogger(__name__)


class WorkflowService:
    """
    Workflow Service

    Provides high-level operations for:
    - Creating and managing workflow templates
    - Executing workflows
    - Querying execution history
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

    async def create_workflow(
        self,
        name: str,
        definition: dict[str, Any],
        description: str | None = None,
        version: str = "1.0.0",
        tags: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> Workflow:
        """
        Create a new workflow template.

        Args:
            name: Unique workflow name
            definition: Workflow definition with steps
            description: Optional description
            version: Workflow version (default: 1.0.0)
            tags: Optional metadata tags

        Returns:
            Created Workflow instance
        """
        workflow = Workflow(
            name=name,
            description=description,
            definition=definition,
            version=version,
            tags=tags,
            is_active=True,
            tenant_id=tenant_id,
        )
        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(f"Created workflow '{name}' v{version}")
        return workflow

    async def update_workflow(
        self,
        workflow_id: int,
        definition: dict[str, Any] | None = None,
        description: str | None = None,
        is_active: bool | None = None,
        tags: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> Workflow:
        """
        Update an existing workflow template.

        Args:
            workflow_id: ID of workflow to update
            definition: New workflow definition
            description: New description
            is_active: Active status
            tags: New tags

        Returns:
            Updated Workflow instance
        """
        workflow = await self.get_workflow(workflow_id, tenant_id=tenant_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if definition is not None:
            workflow.definition = definition
        if description is not None:
            workflow.description = description
        if is_active is not None:
            workflow.is_active = is_active
        if tags is not None:
            workflow.tags = tags

        await self.db.commit()
        await self.db.refresh(workflow)

        logger.info(f"Updated workflow {workflow_id} '{workflow.name}'")
        return workflow

    async def get_workflow(
        self,
        workflow_id: int,
        tenant_id: str | None = None,
        include_global: bool = False,
    ) -> Workflow | None:
        """
        Get workflow by ID.

        Args:
            workflow_id: Workflow ID
            tenant_id: Tenant ID for filtering (required for tenant isolation)
            include_global: If True, also include global workflows (tenant_id IS NULL).
                           Only platform admins should set this to True.

        Returns:
            Workflow instance or None
        """
        query = select(Workflow).where(Workflow.id == workflow_id)
        if tenant_id is not None:
            if include_global:
                # Include both tenant-specific and global workflows
                query = query.where((Workflow.tenant_id == tenant_id) | (Workflow.tenant_id.is_(None)))
            else:
                # Strict tenant isolation - only return tenant's own workflows
                query = query.where(Workflow.tenant_id == tenant_id)

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_workflow_by_name(
        self,
        name: str,
        tenant_id: str | None = None,
        include_global: bool = False,
    ) -> Workflow | None:
        """
        Get workflow by name.

        Args:
            name: Workflow name
            tenant_id: Tenant ID for filtering (required for tenant isolation)
            include_global: If True, also include global workflows (tenant_id IS NULL).
                           Only platform admins should set this to True.

        Returns:
            Workflow instance or None
        """
        query = select(Workflow).where(Workflow.name == name)
        if tenant_id is not None:
            if include_global:
                query = query.where((Workflow.tenant_id == tenant_id) | (Workflow.tenant_id.is_(None)))
            else:
                # Strict tenant isolation
                query = query.where(Workflow.tenant_id == tenant_id)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_workflows(
        self,
        is_active: bool | None = None,
        tags: dict[str, Any] | None = None,
        tenant_id: str | None = None,
        include_global: bool = False,
    ) -> list[Workflow]:
        """
        List all workflows with optional filtering.

        Args:
            is_active: Filter by active status
            tags: Filter by tags (exact match)
            tenant_id: Tenant ID for filtering (required for tenant isolation)
            include_global: If True, also include global workflows (tenant_id IS NULL).
                           Only platform admins should set this to True.

        Returns:
            List of Workflow instances
        """
        query = select(Workflow)

        if is_active is not None:
            query = query.where(Workflow.is_active == is_active)

        if tags is not None:
            # Note: PostgreSQL JSON containment operator
            query = query.where(Workflow.tags.contains(tags))

        if tenant_id is not None:
            if include_global:
                query = query.where((Workflow.tenant_id == tenant_id) | (Workflow.tenant_id.is_(None)))
            else:
                # Strict tenant isolation - only return tenant's own workflows
                query = query.where(Workflow.tenant_id == tenant_id)

        result = await self.db.execute(query.order_by(Workflow.created_at.desc()))
        return list(result.scalars().all())

    async def delete_workflow(self, workflow_id: int, tenant_id: str | None = None) -> None:
        """
        Delete a workflow template.

        Args:
            workflow_id: ID of workflow to delete

        Note:
            This will cascade delete all associated executions.
        """
        workflow = await self.get_workflow(workflow_id, tenant_id=tenant_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        await self.db.delete(workflow)
        await self.db.commit()

        logger.info(f"Deleted workflow {workflow_id} '{workflow.name}'")

    async def execute_workflow(
        self,
        workflow_name: str,
        context: dict[str, Any],
        trigger_type: str = "manual",
        trigger_source: str | None = None,
        tenant_id: str | None = None,
    ) -> WorkflowExecution:
        """
        Execute a workflow by name.

        Args:
            workflow_name: Name of workflow to execute
            context: Input context for the workflow
            trigger_type: How the workflow was triggered
            trigger_source: Source identifier
            tenant_id: Tenant context

        Returns:
            WorkflowExecution instance

        Raises:
            ValueError: If workflow not found or not active
        """
        workflow = await self.get_workflow_by_name(workflow_name, tenant_id=tenant_id)
        if not workflow:
            raise ValueError(f"Workflow '{workflow_name}' not found")

        if not workflow.is_active:
            raise ValueError(f"Workflow '{workflow_name}' is not active")

        # Create engine and execute
        engine = WorkflowEngine(self.db, self.event_publisher, self.service_registry)
        execution = await engine.execute_workflow(
            workflow=workflow,
            context=context,
            trigger_type=trigger_type,
            trigger_source=trigger_source,
            tenant_id=tenant_id,
        )

        return execution

    async def execute_workflow_by_id(
        self,
        workflow_id: int,
        context: dict[str, Any],
        trigger_type: str = "manual",
        trigger_source: str | None = None,
        tenant_id: str | None = None,
    ) -> WorkflowExecution:
        """
        Execute a workflow by ID.

        Args:
            workflow_id: ID of workflow to execute
            context: Input context for the workflow
            trigger_type: How the workflow was triggered
            trigger_source: Source identifier
            tenant_id: Tenant context

        Returns:
            WorkflowExecution instance

        Raises:
            ValueError: If workflow not found or not active
        """
        workflow = await self.get_workflow(workflow_id, tenant_id=tenant_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")

        if not workflow.is_active:
            raise ValueError(f"Workflow {workflow_id} is not active")

        # Create engine and execute
        engine = WorkflowEngine(self.db, self.event_publisher, self.service_registry)
        execution = await engine.execute_workflow(
            workflow=workflow,
            context=context,
            trigger_type=trigger_type,
            trigger_source=trigger_source,
            tenant_id=tenant_id,
        )

        return execution

    async def get_execution(
        self,
        execution_id: int,
        include_steps: bool = False,
        tenant_id: str | None = None,
    ) -> WorkflowExecution | None:
        """
        Get workflow execution by ID.

        Args:
            execution_id: Execution ID
            include_steps: Whether to load related steps

        Returns:
            WorkflowExecution instance or None
        """
        query = select(WorkflowExecution).where(WorkflowExecution.id == execution_id)

        if tenant_id is not None:
            query = query.where(WorkflowExecution.tenant_id == tenant_id)

        if include_steps:
            query = query.options(selectinload(WorkflowExecution.steps))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def list_executions(
        self,
        workflow_id: int | None = None,
        status: WorkflowStatus | None = None,
        tenant_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WorkflowExecution]:
        """
        List workflow executions with filtering.

        Args:
            workflow_id: Filter by workflow
            status: Filter by status
            tenant_id: Filter by tenant
            limit: Maximum results to return
            offset: Number of results to skip

        Returns:
            List of WorkflowExecution instances
        """
        query = select(WorkflowExecution).order_by(WorkflowExecution.created_at.desc())

        if workflow_id is not None:
            query = query.where(WorkflowExecution.workflow_id == workflow_id)

        if status is not None:
            query = query.where(WorkflowExecution.status == status)

        if tenant_id is not None:
            query = query.where(WorkflowExecution.tenant_id == tenant_id)

        query = query.limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def cancel_execution(self, execution_id: int, tenant_id: str | None = None) -> None:
        """
        Cancel a running workflow execution.

        Args:
            execution_id: ID of execution to cancel

        Raises:
            ValueError: If execution not found or not cancellable
        """
        # Ensure execution belongs to tenant (if provided) before canceling
        if tenant_id is not None:
            execution = await self.get_execution(execution_id, tenant_id=tenant_id)
            if execution is None:
                raise ValueError(f"Execution {execution_id} not found")

        engine = WorkflowEngine(self.db, self.event_publisher, self.service_registry)
        await engine.cancel_execution(execution_id)

    async def get_execution_stats(
        self,
        workflow_id: int | None = None,
        tenant_id: str | None = None,
    ) -> dict[str, Any]:
        """
        Get execution statistics.

        Args:
            workflow_id: Filter by workflow
            tenant_id: Filter by tenant

        Returns:
            Dictionary with execution statistics
        """
        from sqlalchemy import func

        query = select(
            WorkflowExecution.status,
            func.count(WorkflowExecution.id).label("count"),
        ).group_by(WorkflowExecution.status)

        if workflow_id is not None:
            query = query.where(WorkflowExecution.workflow_id == workflow_id)

        if tenant_id is not None:
            query = query.where(WorkflowExecution.tenant_id == tenant_id)

        result = await self.db.execute(query)
        rows = result.all()

        stats = {
            "total": sum(int(cast(int, row._mapping["count"])) for row in rows),
            "by_status": {
                cast(WorkflowStatus, row._mapping["status"]).value: int(
                    cast(int, row._mapping["count"])
                )
                for row in rows
            },
        }

        return stats
