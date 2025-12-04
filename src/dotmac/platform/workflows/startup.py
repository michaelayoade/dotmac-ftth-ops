"""
Workflow System Initialization

Sets up workflows, event handlers, and service registry on application startup.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .builtin_workflows import get_all_builtin_workflows
from .event_handlers import register_workflow_event_handlers
from .service import WorkflowService
from .service_registry import create_default_registry

logger = logging.getLogger(__name__)


async def initialize_workflow_system(
    db_session: AsyncSession,
    event_bus: Any,
) -> None:
    """
    Initialize the workflow system on application startup.

    This function:
    1. Creates service registry
    2. Registers event handlers
    3. Seeds built-in workflows (if they don't exist)

    Args:
        db_session: Database session
        event_bus: Event bus instance
    """
    logger.info("Initializing workflow system...")

    try:
        # 1. Create service registry
        service_registry = create_default_registry(db_session)
        logger.info("Service registry created")

        # 2. Register event handlers
        await register_workflow_event_handlers(db_session, event_bus, service_registry)
        logger.info("Workflow event handlers registered")

        # 3. Seed built-in workflows
        await seed_builtin_workflows(db_session, service_registry)
        logger.info("Built-in workflows seeded")

        logger.info("Workflow system initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize workflow system: {e}", exc_info=True)
        raise


async def seed_builtin_workflows(
    db_session: AsyncSession,
    service_registry: Any = None,
) -> None:
    """
    Seed built-in workflows into the database.

    Only creates workflows that don't already exist (idempotent).

    Args:
        db_session: Database session
        service_registry: Service registry (optional)
    """
    workflow_service = WorkflowService(db_session, service_registry=service_registry)

    builtin_workflows = get_all_builtin_workflows()
    created_count = 0
    skipped_count = 0

    for workflow_def in builtin_workflows:
        workflow_name = workflow_def["name"]

        # Check if workflow already exists
        existing = await workflow_service.get_workflow_by_name(workflow_name)

        if existing:
            logger.debug(f"Workflow '{workflow_name}' already exists, skipping")
            skipped_count += 1
            continue

        # Create the workflow
        try:
            await workflow_service.create_workflow(
                name=workflow_def["name"],
                description=workflow_def["description"],
                definition=workflow_def["definition"],
                version=workflow_def["version"],
                tags=workflow_def.get("tags"),
            )
            logger.info(f"Created built-in workflow: {workflow_name}")
            created_count += 1

        except Exception as e:
            logger.error(f"Failed to create workflow '{workflow_name}': {e}")
            # Continue with other workflows even if one fails

    logger.info(f"Workflow seeding complete: {created_count} created, {skipped_count} skipped")


async def cleanup_workflow_system(db_session: AsyncSession) -> None:
    """
    Clean up workflow system on application shutdown.

    Currently a placeholder for future cleanup tasks.

    Args:
        db_session: Database session
    """
    logger.info("Cleaning up workflow system...")
    # Future: Cancel running workflows, close connections, etc.
    logger.info("Workflow system cleanup complete")
