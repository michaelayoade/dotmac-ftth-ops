"""
Deployment Registry

Central registry for tracking and managing deployment instances.
Provides fast lookups and state management.
"""

import logging
from collections.abc import Awaitable, Callable
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, desc, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from .models import (
    DeploymentExecution,
    DeploymentHealth,
    DeploymentInstance,
    DeploymentState,
    DeploymentTemplate,
)

logger = logging.getLogger(__name__)


class DeploymentRegistry:
    """
    Deployment Registry

    Central registry for managing deployment instances with efficient
    lookups and state tracking.
    """

    def __init__(self, db: Session):
        """
        Initialize registry

        Args:
            db: Database session
        """
        self.db = db

    # Instance Management

    def get_instance(self, instance_id: int) -> DeploymentInstance | None:
        """Get deployment instance by ID"""
        return (
            self.db.query(DeploymentInstance).filter(DeploymentInstance.id == instance_id).first()
        )

    def get_instance_by_tenant(self, tenant_id: int, environment: str) -> DeploymentInstance | None:
        """Get deployment instance for tenant and environment"""
        return (
            self.db.query(DeploymentInstance)
            .filter(
                and_(
                    DeploymentInstance.tenant_id == tenant_id,
                    DeploymentInstance.environment == environment,
                )
            )
            .first()
        )

    def list_instances(
        self,
        tenant_id: int | None = None,
        state: DeploymentState | None = None,
        environment: str | None = None,
        region: str | None = None,
        template_id: int | None = None,
        health_status: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[DeploymentInstance], int]:
        """
        List deployment instances with filters

        Returns:
            Tuple of (instances, total_count)
        """
        query = self.db.query(DeploymentInstance)

        # Apply filters
        if tenant_id:
            query = query.filter(DeploymentInstance.tenant_id == tenant_id)
        if state:
            query = query.filter(DeploymentInstance.state == state)
        if environment:
            query = query.filter(DeploymentInstance.environment == environment)
        if region:
            query = query.filter(DeploymentInstance.region == region)
        if template_id:
            query = query.filter(DeploymentInstance.template_id == template_id)
        if health_status:
            query = query.filter(DeploymentInstance.health_status == health_status)

        # Get total count
        total = query.count()

        # Apply pagination and ordering
        instances = (
            query.order_by(desc(DeploymentInstance.created_at)).offset(skip).limit(limit).all()
        )

        return instances, total

    def create_instance(self, instance: DeploymentInstance) -> DeploymentInstance:
        """Create new deployment instance"""
        self.db.add(instance)
        self.db.commit()
        self.db.refresh(instance)
        logger.info(f"Created deployment instance {instance.id} for tenant {instance.tenant_id}")
        return instance

    def update_instance(self, instance_id: int, **updates: Any) -> DeploymentInstance | None:
        """Update deployment instance"""
        instance = self.get_instance(instance_id)
        if not instance:
            return None

        for key, value in updates.items():
            if hasattr(instance, key):
                setattr(instance, key, value)

        self.db.commit()
        self.db.refresh(instance)
        logger.info(f"Updated deployment instance {instance_id}: {list(updates.keys())}")
        return instance

    def update_instance_state(
        self, instance_id: int, state: DeploymentState, reason: str | None = None
    ) -> DeploymentInstance | None:
        """Update instance state"""
        instance = self.get_instance(instance_id)
        if not instance:
            return None

        instance.state = state
        instance.state_reason = reason
        instance.last_state_change = datetime.utcnow()

        self.db.commit()
        self.db.refresh(instance)
        logger.info(f"Instance {instance_id} state changed to {state.value}")
        return instance

    def delete_instance(self, instance_id: int) -> bool:
        """Delete deployment instance"""
        instance = self.get_instance(instance_id)
        if not instance:
            return False

        self.db.delete(instance)
        self.db.commit()
        logger.info(f"Deleted deployment instance {instance_id}")
        return True

    # Template Management

    def get_template(self, template_id: int) -> DeploymentTemplate | None:
        """Get deployment template by ID"""
        return (
            self.db.query(DeploymentTemplate).filter(DeploymentTemplate.id == template_id).first()
        )

    def get_template_by_name(self, name: str) -> DeploymentTemplate | None:
        """Get deployment template by name"""
        return self.db.query(DeploymentTemplate).filter(DeploymentTemplate.name == name).first()

    def list_templates(
        self, is_active: bool | None = None, skip: int = 0, limit: int = 100
    ) -> tuple[list[DeploymentTemplate], int]:
        """List deployment templates"""
        query = self.db.query(DeploymentTemplate)

        if is_active is not None:
            query = query.filter(DeploymentTemplate.is_active == is_active)

        total = query.count()
        templates = query.order_by(DeploymentTemplate.name).offset(skip).limit(limit).all()

        return templates, total

    def create_template(self, template: DeploymentTemplate) -> DeploymentTemplate:
        """Create deployment template"""
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        logger.info(f"Created deployment template {template.name}")
        return template

    def update_template(self, template_id: int, **updates: Any) -> DeploymentTemplate | None:
        """Update deployment template"""
        template = self.get_template(template_id)
        if not template:
            return None

        for key, value in updates.items():
            if hasattr(template, key):
                setattr(template, key, value)

        self.db.commit()
        self.db.refresh(template)
        logger.info(f"Updated deployment template {template_id}")
        return template

    # Execution Tracking

    def create_execution(self, execution: DeploymentExecution) -> DeploymentExecution:
        """Create deployment execution record"""
        self.db.add(execution)
        self.db.commit()
        self.db.refresh(execution)
        logger.info(f"Created execution {execution.id} for instance {execution.instance_id}")
        return execution

    def get_execution(self, execution_id: int) -> DeploymentExecution | None:
        """Get execution by ID"""
        return (
            self.db.query(DeploymentExecution)
            .filter(DeploymentExecution.id == execution_id)
            .first()
        )

    def update_execution(self, execution_id: int, **updates: Any) -> DeploymentExecution | None:
        """Update execution record"""
        execution = self.get_execution(execution_id)
        if not execution:
            return None

        for key, value in updates.items():
            if hasattr(execution, key):
                setattr(execution, key, value)

        # Calculate duration if completed
        if (
            "completed_at" in updates
            and execution.started_at is not None
            and execution.completed_at is not None
        ):
            execution.duration_seconds = int(
                (execution.completed_at - execution.started_at).total_seconds()
            )

        self.db.commit()
        self.db.refresh(execution)
        return execution

    def list_executions(
        self,
        instance_id: int | None = None,
        operation: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[DeploymentExecution], int]:
        """List executions with filters"""
        query = self.db.query(DeploymentExecution)

        if instance_id:
            query = query.filter(DeploymentExecution.instance_id == instance_id)
        if operation:
            query = query.filter(DeploymentExecution.operation == operation)

        total = query.count()
        executions = (
            query.order_by(desc(DeploymentExecution.started_at)).offset(skip).limit(limit).all()
        )

        return executions, total

    def get_latest_execution(
        self, instance_id: int, operation: str | None = None
    ) -> DeploymentExecution | None:
        """Get latest execution for instance"""
        query = self.db.query(DeploymentExecution).filter(
            DeploymentExecution.instance_id == instance_id
        )

        if operation:
            query = query.filter(DeploymentExecution.operation == operation)

        return query.order_by(desc(DeploymentExecution.started_at)).first()

    # Health Tracking

    def record_health(self, health: DeploymentHealth) -> DeploymentHealth:
        """Record health check result"""
        self.db.add(health)
        self.db.commit()
        self.db.refresh(health)
        return health

    def get_latest_health(self, instance_id: int) -> DeploymentHealth | None:
        """Get latest health check for instance"""
        return (
            self.db.query(DeploymentHealth)
            .filter(DeploymentHealth.instance_id == instance_id)
            .order_by(desc(DeploymentHealth.checked_at))
            .first()
        )

    def list_health_records(
        self, instance_id: int, skip: int = 0, limit: int = 100
    ) -> tuple[list[DeploymentHealth], int]:
        """List health records for instance"""
        query = self.db.query(DeploymentHealth).filter(DeploymentHealth.instance_id == instance_id)

        total = query.count()
        records = query.order_by(desc(DeploymentHealth.checked_at)).offset(skip).limit(limit).all()

        return records, total

    def get_unhealthy_instances(self) -> list[DeploymentInstance]:
        """Get all instances with unhealthy status"""
        return (
            self.db.query(DeploymentInstance)
            .filter(
                and_(
                    DeploymentInstance.state == DeploymentState.ACTIVE,
                    or_(
                        DeploymentInstance.health_status == "unhealthy",
                        DeploymentInstance.health_status == "degraded",
                    ),
                )
            )
            .all()
        )

    def update_instance_health(
        self, instance_id: int, health: DeploymentHealth
    ) -> DeploymentInstance | None:
        """Update instance health status from health check"""
        instance = self.get_instance(instance_id)
        if not instance:
            return None

        instance.last_health_check = health.checked_at
        instance.health_status = health.status
        instance.health_details = health.details

        # Update instance state based on health
        if instance.state == DeploymentState.ACTIVE:
            if health.status == "unhealthy":
                instance.state = DeploymentState.DEGRADED
                instance.state_reason = health.error_message
                instance.last_state_change = datetime.utcnow()

        self.db.commit()
        self.db.refresh(instance)
        return instance

    # Statistics

    def get_deployment_stats(self, tenant_id: int | None = None) -> dict[str, Any]:
        """Get deployment statistics"""
        query = self.db.query(DeploymentInstance)

        if tenant_id:
            query = query.filter(DeploymentInstance.tenant_id == tenant_id)

        total = query.count()
        active = query.filter(DeploymentInstance.state == DeploymentState.ACTIVE).count()
        provisioning = query.filter(
            DeploymentInstance.state == DeploymentState.PROVISIONING
        ).count()
        failed = query.filter(DeploymentInstance.state == DeploymentState.FAILED).count()
        suspended = query.filter(DeploymentInstance.state == DeploymentState.SUSPENDED).count()

        healthy = query.filter(DeploymentInstance.health_status == "healthy").count()
        degraded = query.filter(DeploymentInstance.health_status == "degraded").count()
        unhealthy = query.filter(DeploymentInstance.health_status == "unhealthy").count()

        return {
            "total_instances": total,
            "states": {
                "active": active,
                "provisioning": provisioning,
                "failed": failed,
                "suspended": suspended,
            },
            "health": {
                "healthy": healthy,
                "degraded": degraded,
                "unhealthy": unhealthy,
            },
        }

    def get_template_usage_stats(self) -> dict[str, Any]:
        """Get usage statistics by template"""
        results = (
            self.db.query(
                DeploymentTemplate.name,
                DeploymentTemplate.display_name,
                func.count(DeploymentInstance.id).label("instance_count"),
            )
            .join(DeploymentInstance, DeploymentInstance.template_id == DeploymentTemplate.id)
            .group_by(
                DeploymentTemplate.id, DeploymentTemplate.name, DeploymentTemplate.display_name
            )
            .all()
        )

        templates: list[dict[str, Any]] = [
            {
                "template_name": r.name,
                "display_name": r.display_name,
                "instances": int(r.instance_count),
            }
            for r in results
        ]

        return {
            "templates": templates,
            "total_templates": len(templates),
            "total_instances": sum(t["instances"] for t in templates),
        }

    def get_resource_allocation(self, tenant_id: int | None = None) -> dict[str, Any]:
        """Get total resource allocation"""
        query = self.db.query(DeploymentInstance).filter(
            DeploymentInstance.state.in_([DeploymentState.ACTIVE, DeploymentState.PROVISIONING])
        )

        if tenant_id:
            query = query.filter(DeploymentInstance.tenant_id == tenant_id)

        total_cpu = int(
            query.with_entities(func.sum(DeploymentInstance.allocated_cpu)).scalar() or 0
        )
        total_memory = int(
            query.with_entities(func.sum(DeploymentInstance.allocated_memory_gb)).scalar() or 0
        )
        total_storage = int(
            query.with_entities(func.sum(DeploymentInstance.allocated_storage_gb)).scalar() or 0
        )

        return {
            "total_cpu": total_cpu,
            "total_memory": total_memory,
            "total_storage": total_storage,
        }

    # Bulk Operations

    def bulk_update_state(
        self, instance_ids: list[int], state: DeploymentState, reason: str | None = None
    ) -> int:
        """Bulk update instance states"""
        updated = (
            self.db.query(DeploymentInstance)
            .filter(DeploymentInstance.id.in_(instance_ids))
            .update(
                {
                    "state": state,
                    "state_reason": reason,
                    "last_state_change": datetime.utcnow(),
                },
                synchronize_session=False,
            )
        )

        self.db.commit()
        logger.info(f"Bulk updated {updated} instances to state {state.value}")
        return updated

    def cleanup_old_health_records(self, days: int = 30) -> int:
        """Delete health records older than specified days"""
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        deleted = (
            self.db.query(DeploymentHealth)
            .filter(DeploymentHealth.checked_at < cutoff_date)
            .delete(synchronize_session=False)
        )

        self.db.commit()
        logger.info(f"Cleaned up {deleted} health records older than {days} days")
        return deleted


# Async version for async contexts
class AsyncDeploymentRegistry:
    """Async wrapper around the synchronous DeploymentRegistry."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _run(self, method_name: str, *args: Any, **kwargs: Any) -> Any:
        """Execute DeploymentRegistry method within sync session context."""

        def sync_call(sync_session: Session) -> Any:
            registry = DeploymentRegistry(sync_session)
            method = getattr(registry, method_name)
            return method(*args, **kwargs)

        return await self.db.run_sync(sync_call)

    def __getattr__(self, name: str) -> Callable[..., Awaitable[Any]]:
        attr = getattr(DeploymentRegistry, name, None)
        if attr is None or not callable(attr):
            raise AttributeError(name)

        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            return await self._run(name, *args, **kwargs)

        return async_wrapper
