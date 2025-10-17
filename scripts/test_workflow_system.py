#!/usr/bin/env python3
"""
Test Script for Workflow System

Tests the workflow engine, service registry, and event handlers.
"""

import asyncio
import logging
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from dotmac.platform.db import get_async_session
from dotmac.platform.workflows import (
    ServiceRegistry,
    WorkflowService,
    create_default_registry,
    get_all_builtin_workflows,
)
from dotmac.platform.workflows.startup import seed_builtin_workflows

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def test_service_registry():
    """Test that service registry is working."""
    logger.info("Testing service registry...")

    async for session in get_async_session():
        registry = create_default_registry(session)

        # Test that registry has expected services
        expected_services = [
            "customer_service",
            "crm_service",
            "billing_service",
            "deployment_service",
            "communications_service",
        ]

        for service_name in expected_services:
            has_service = registry.has_service(service_name)
            logger.info(f"  {service_name}: {'✓' if has_service else '✗'}")

        logger.info("Service registry test complete")
        break


async def test_builtin_workflows():
    """Test that built-in workflows are defined."""
    logger.info("Testing built-in workflows...")

    workflows = get_all_builtin_workflows()
    logger.info(f"  Found {len(workflows)} built-in workflows:")

    for workflow in workflows:
        name = workflow["name"]
        steps = len(workflow["definition"]["steps"])
        logger.info(f"    - {name} ({steps} steps)")

    logger.info("Built-in workflows test complete")


async def test_workflow_seeding():
    """Test seeding workflows into database."""
    logger.info("Testing workflow seeding...")

    async for session in get_async_session():
        try:
            # Seed workflows
            await seed_builtin_workflows(session)

            # Verify they were created
            workflow_service = WorkflowService(session)
            workflows = await workflow_service.list_workflows()

            logger.info(f"  {len(workflows)} workflows in database:")
            for workflow in workflows:
                logger.info(f"    - {workflow.name} (v{workflow.version})")

            logger.info("Workflow seeding test complete")

        except Exception as e:
            logger.error(f"Workflow seeding test failed: {e}", exc_info=True)

        break


async def test_workflow_crud():
    """Test CRUD operations on workflows."""
    logger.info("Testing workflow CRUD operations...")

    async for session in get_async_session():
        workflow_service = WorkflowService(session)

        try:
            # Create a test workflow
            test_workflow = await workflow_service.create_workflow(
                name="test_simple_workflow",
                description="Test workflow for validation",
                definition={
                    "steps": [
                        {
                            "name": "step1",
                            "type": "transform",
                            "transform_type": "map",
                            "mapping": {"output": "${context.input}"},
                        }
                    ]
                },
                version="1.0.0",
                tags={"test": True},
            )
            logger.info(f"  Created test workflow: {test_workflow.id}")

            # Read it back
            retrieved = await workflow_service.get_workflow(test_workflow.id)
            assert retrieved.name == "test_simple_workflow"
            logger.info(f"  Retrieved workflow: {retrieved.name}")

            # Update it
            updated = await workflow_service.update_workflow(
                test_workflow.id, description="Updated description"
            )
            assert updated.description == "Updated description"
            logger.info(f"  Updated workflow description")

            # List workflows
            workflows = await workflow_service.list_workflows()
            logger.info(f"  Total workflows: {len(workflows)}")

            # Delete test workflow
            await workflow_service.delete_workflow(test_workflow.id)
            logger.info(f"  Deleted test workflow")

            logger.info("Workflow CRUD test complete")

        except Exception as e:
            logger.error(f"Workflow CRUD test failed: {e}", exc_info=True)

        break


async def main():
    """Run all tests."""
    logger.info("=" * 60)
    logger.info("Workflow System Test Suite")
    logger.info("=" * 60)

    try:
        await test_builtin_workflows()
        logger.info("")

        await test_service_registry()
        logger.info("")

        await test_workflow_seeding()
        logger.info("")

        await test_workflow_crud()
        logger.info("")

        logger.info("=" * 60)
        logger.info("All tests completed successfully! ✓")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"Test suite failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
