"""
Service Lifecycle Celery Tasks.

Background tasks for asynchronous service lifecycle operations including
provisioning workflows, scheduled terminations, and automated health checks.
"""

import asyncio
from datetime import datetime, timedelta, timezone

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from typing import Any
from uuid import UUID

from celery import Task

from dotmac.platform.celery_app import celery_app
from dotmac.platform.db import get_async_session_context
from dotmac.platform.services.lifecycle.models import (
    LifecycleEventType,
    ProvisioningStatus,
    ServiceInstance,
    ServiceStatus,
)
from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService


def _run_async(coro: Any) -> Any:
    """Helper to run async code in sync Celery tasks."""
    loop = asyncio.get_event_loop()
    if loop.is_running():
        # If loop is already running, create a new one
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(coro)


async def _execute_provisioning_workflow(
    service_instance_id: str, tenant_id: str
) -> dict[str, Any]:
    """
    Execute multi-step provisioning workflow.

    Steps:
    1. Validate service configuration
    2. Allocate network resources (IP, VLAN, etc.)
    3. Configure network equipment (ONT, router, switches)
    4. Activate service in provisioning systems (RADIUS, etc.)
    5. Test connectivity and performance
    6. Complete provisioning

    Args:
        service_instance_id: Service instance UUID
        tenant_id: Tenant identifier

    Returns:
        dict with execution results
    """
    async with get_async_session_context() as session:
        service = LifecycleOrchestrationService(session)

        service_id = UUID(service_instance_id)
        service_instance = await service.get_service_instance(service_id, tenant_id)

        if not service_instance:
            return {
                "success": False,
                "error": "Service instance not found",
                "service_instance_id": service_instance_id,
            }

        start_time = datetime.now(UTC)
        steps_completed = []
        steps_failed = []

        try:
            # Step 1: Validation
            service_instance.provisioning_status = ProvisioningStatus.VALIDATING
            await session.commit()

            validation_result = await _validate_service_config(service_instance, session)
            if not validation_result["success"]:
                steps_failed.append("validation")
                raise Exception(f"Validation failed: {validation_result['error']}")

            steps_completed.append("validation")

            # Step 2: Resource Allocation
            service_instance.provisioning_status = ProvisioningStatus.ALLOCATING_RESOURCES
            await session.commit()

            allocation_result = await _allocate_network_resources(service_instance, session)
            if not allocation_result["success"]:
                steps_failed.append("allocation")
                raise Exception(f"Allocation failed: {allocation_result['error']}")

            steps_completed.append("allocation")

            # Step 3: Equipment Configuration
            service_instance.provisioning_status = ProvisioningStatus.CONFIGURING_EQUIPMENT
            await session.commit()

            config_result = await _configure_equipment(service_instance, session)
            if not config_result["success"]:
                steps_failed.append("configuration")
                raise Exception(f"Configuration failed: {config_result['error']}")

            steps_completed.append("configuration")

            # Step 4: Service Activation
            service_instance.provisioning_status = ProvisioningStatus.ACTIVATING_SERVICE
            await session.commit()

            activation_result = await _activate_in_provisioning_systems(service_instance, session)
            if not activation_result["success"]:
                steps_failed.append("activation")
                raise Exception(f"Activation failed: {activation_result['error']}")

            steps_completed.append("activation")

            # Step 5: Testing
            service_instance.provisioning_status = ProvisioningStatus.TESTING
            await session.commit()

            test_result = await _test_service_connectivity(service_instance, session)
            if not test_result["success"]:
                steps_failed.append("testing")
                raise Exception(f"Testing failed: {test_result['error']}")

            steps_completed.append("testing")

            # Step 6: Complete provisioning
            service_instance.provisioning_status = ProvisioningStatus.COMPLETED
            service_instance.provisioned_at = datetime.now(UTC)
            service_instance.status = ServiceStatus.ACTIVE  # Auto-activate
            service_instance.activated_at = datetime.now(UTC)

            # Create success event
            await service._create_lifecycle_event(
                tenant_id=tenant_id,
                service_instance_id=service_id,
                event_type=LifecycleEventType.PROVISION_COMPLETED,
                new_status=ServiceStatus.ACTIVE,
                description="Service provisioning completed successfully",
                duration_seconds=(datetime.now(UTC) - start_time).total_seconds(),
                event_data={
                    "steps_completed": steps_completed,
                    "total_steps": len(steps_completed),
                },
            )

            await session.commit()

            return {
                "success": True,
                "service_instance_id": service_instance_id,
                "steps_completed": steps_completed,
                "duration_seconds": (datetime.now(UTC) - start_time).total_seconds(),
            }

        except Exception as e:
            # Mark provisioning as failed
            service_instance.provisioning_status = ProvisioningStatus.FAILED
            service_instance.status = ServiceStatus.PROVISIONING_FAILED

            # Create failure event
            await service._create_lifecycle_event(
                tenant_id=tenant_id,
                service_instance_id=service_id,
                event_type=LifecycleEventType.PROVISION_FAILED,
                new_status=ServiceStatus.PROVISIONING_FAILED,
                description="Service provisioning failed",
                success=False,
                error_message=str(e),
                error_code="PROVISIONING_FAILED",
                duration_seconds=(datetime.now(UTC) - start_time).total_seconds(),
                event_data={
                    "steps_completed": steps_completed,
                    "steps_failed": steps_failed,
                    "total_steps": len(steps_completed) + len(steps_failed),
                },
            )

            await session.commit()

            return {
                "success": False,
                "error": str(e),
                "service_instance_id": service_instance_id,
                "steps_completed": steps_completed,
                "steps_failed": steps_failed,
            }


# Provisioning workflow helper functions


async def _validate_service_config(
    service_instance: ServiceInstance, session: Any
) -> dict[str, Any]:
    """Validate service configuration."""
    # Simplified validation - in production, this would check:
    # - Customer account status
    # - Service plan compatibility
    # - Network capacity
    # - Equipment availability
    await asyncio.sleep(1)  # Simulate validation time

    if not service_instance.customer_id:
        return {"success": False, "error": "Customer ID is required"}

    if not service_instance.service_config:
        return {"success": False, "error": "Service configuration is required"}

    return {"success": True}


async def _allocate_network_resources(
    service_instance: ServiceInstance, session: Any
) -> dict[str, Any]:
    """Allocate network resources (IP, VLAN, etc.)."""
    # Simplified allocation - in production, this would:
    # - Query IPAM for available IPs
    # - Allocate VLAN from pool
    # - Reserve bandwidth
    await asyncio.sleep(2)  # Simulate allocation time

    if not service_instance.ip_address:
        # Allocate IP (simplified)
        service_instance.ip_address = (
            f"10.0.{service_instance.id.hex[:2]}.{service_instance.id.hex[2:4]}"
        )

    if not service_instance.vlan_id:
        # Allocate VLAN (simplified)
        service_instance.vlan_id = 100

    return {
        "success": True,
        "allocated": {
            "ip_address": service_instance.ip_address,
            "vlan_id": service_instance.vlan_id,
        },
    }


async def _configure_equipment(service_instance: ServiceInstance, session: Any) -> dict[str, Any]:
    """Configure network equipment."""
    # Simplified configuration - in production, this would:
    # - Connect to OLT/DSLAM/switch via NETCONF/SNMP
    # - Configure ONT/CPE
    # - Set bandwidth profiles
    # - Configure VLANs
    await asyncio.sleep(3)  # Simulate configuration time

    return {"success": True, "configured_devices": service_instance.equipment_assigned}


async def _activate_in_provisioning_systems(
    service_instance: ServiceInstance, session: Any
) -> dict[str, Any]:
    """Activate service in provisioning systems (RADIUS, BSS, etc.)."""
    # Simplified activation - in production, this would:
    # - Create RADIUS user
    # - Update BSS
    # - Configure firewall rules
    # - Enable DHCP lease
    await asyncio.sleep(2)  # Simulate activation time

    # Store external system ID
    if not service_instance.external_service_id:
        service_instance.external_service_id = f"EXT-{service_instance.id.hex[:12].upper()}"

    return {"success": True, "external_id": service_instance.external_service_id}


async def _test_service_connectivity(
    service_instance: ServiceInstance, session: Any
) -> dict[str, Any]:
    """Test service connectivity and performance."""
    # Simplified testing - in production, this would:
    # - Ping test
    # - Speed test
    # - DNS resolution test
    # - Service-specific tests
    await asyncio.sleep(2)  # Simulate testing time

    # Update health metrics
    service_instance.health_status = "healthy"
    service_instance.uptime_percentage = 100.0
    service_instance.last_health_check_at = datetime.now(UTC)

    return {"success": True, "tests_passed": ["ping", "speed", "dns"]}


# Celery Tasks


@celery_app.task(  # type: ignore[misc]  # Celery decorator is untyped
    name="lifecycle.execute_provisioning_workflow",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
)  # 5 minutes
def execute_provisioning_workflow_task(
    self: Task, service_instance_id: str, tenant_id: str
) -> dict[str, Any]:
    """
    Execute provisioning workflow for a service instance.

    This task is triggered after a service provisioning is requested.

    Args:
        service_instance_id: Service instance UUID string
        tenant_id: Tenant identifier

    Returns:
        dict with execution results
    """
    try:
        result: dict[str, Any] = _run_async(
            _execute_provisioning_workflow(service_instance_id, tenant_id)
        )
        return result
    except Exception as exc:
        # Retry on failure
        raise self.retry(exc=exc)


@celery_app.task(name="lifecycle.process_scheduled_terminations", bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def process_scheduled_terminations_task(self: Task) -> dict[str, Any]:
    """
    Process services scheduled for termination.

    Runs periodically to find and execute scheduled terminations.

    Returns:
        dict with processing results
    """

    async def _process_terminations() -> dict[str, Any]:
        processed = 0
        successful = 0
        failed = 0

        async with get_async_session_context() as session:
            service = LifecycleOrchestrationService(session)

            # Find services scheduled for termination
            from sqlalchemy import and_, select

            result = await session.execute(
                select(ServiceInstance).where(
                    and_(
                        ServiceInstance.status == ServiceStatus.TERMINATING,
                        ServiceInstance.deleted_at.is_(None),
                    )
                )
            )

            services = result.scalars().all()

            for service_instance in services:
                processed += 1

                # Check if termination date has passed
                termination_date_str = service_instance.metadata.get("scheduled_termination_date")
                if not termination_date_str:
                    continue

                termination_date = datetime.fromisoformat(termination_date_str)
                if termination_date > datetime.now(UTC):
                    continue  # Not yet time

                try:
                    # Execute termination
                    service_instance.status = ServiceStatus.TERMINATED
                    service_instance.terminated_at = datetime.now(UTC)

                    await service._create_lifecycle_event(
                        tenant_id=service_instance.tenant_id,
                        service_instance_id=service_instance.id,
                        event_type=LifecycleEventType.TERMINATION_COMPLETED,
                        new_status=ServiceStatus.TERMINATED,
                        description="Scheduled termination executed",
                        triggered_by_system="scheduler",
                    )

                    await session.commit()
                    successful += 1

                except Exception:
                    failed += 1
                    # Log error but continue processing

            return {
                "processed": processed,
                "successful": successful,
                "failed": failed,
            }

    result: dict[str, Any] = _run_async(_process_terminations())
    return result


@celery_app.task(name="lifecycle.process_auto_resume", bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def process_auto_resume_task(self: Task) -> dict[str, Any]:
    """
    Process services scheduled for automatic resumption.

    Runs periodically to find and resume suspended services.

    Returns:
        dict with processing results
    """

    async def _process_auto_resume() -> dict[str, Any]:
        processed = 0
        successful = 0
        failed = 0

        async with get_async_session_context() as session:
            service = LifecycleOrchestrationService(session)

            # Find suspended services with auto-resume date
            from sqlalchemy import and_, select

            result = await session.execute(
                select(ServiceInstance).where(
                    and_(
                        ServiceInstance.status.in_(
                            [ServiceStatus.SUSPENDED, ServiceStatus.SUSPENDED_FRAUD]
                        ),
                        ServiceInstance.auto_resume_at.is_not(None),
                        ServiceInstance.auto_resume_at <= datetime.now(UTC),
                        ServiceInstance.deleted_at.is_(None),
                    )
                )
            )

            services = result.scalars().all()

            for service_instance in services:
                processed += 1

                try:
                    # Execute resumption
                    previous_status = service_instance.status
                    service_instance.status = ServiceStatus.ACTIVE
                    service_instance.suspended_at = None
                    service_instance.suspension_reason = None
                    service_instance.auto_resume_at = None

                    await service._create_lifecycle_event(
                        tenant_id=service_instance.tenant_id,
                        service_instance_id=service_instance.id,
                        event_type=LifecycleEventType.RESUMPTION_COMPLETED,
                        previous_status=previous_status,
                        new_status=ServiceStatus.ACTIVE,
                        description="Automatic resumption executed",
                        triggered_by_system="scheduler",
                    )

                    await session.commit()
                    successful += 1

                except Exception:
                    failed += 1
                    # Log error but continue processing

            return {
                "processed": processed,
                "successful": successful,
                "failed": failed,
            }

    result: dict[str, Any] = _run_async(_process_auto_resume())
    return result


@celery_app.task(name="lifecycle.perform_health_checks", bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def perform_health_checks_task(self: Task) -> dict[str, Any]:
    """
    Perform automated health checks on active services.

    Runs periodically to check service health and update metrics.

    Returns:
        dict with health check results
    """

    async def _perform_health_checks() -> dict[str, Any]:
        checked = 0
        healthy = 0
        degraded = 0
        unhealthy = 0

        async with get_async_session_context() as session:
            service = LifecycleOrchestrationService(session)

            # Find active services that need health check
            from sqlalchemy import and_, or_, select

            one_hour_ago = datetime.now(UTC) - timedelta(hours=1)

            result = await session.execute(
                select(ServiceInstance)
                .where(
                    and_(
                        ServiceInstance.status == ServiceStatus.ACTIVE,
                        or_(
                            ServiceInstance.last_health_check_at.is_(None),
                            ServiceInstance.last_health_check_at < one_hour_ago,
                        ),
                        ServiceInstance.deleted_at.is_(None),
                    )
                )
                .limit(100)  # Limit to prevent overwhelming the system
            )

            services = result.scalars().all()

            for service_instance in services:
                checked += 1

                try:
                    # Perform health check (simplified)
                    health_status = "healthy"  # In production, actually test connectivity

                    service_instance.last_health_check_at = datetime.now(UTC)
                    service_instance.health_status = health_status

                    if health_status == "healthy":
                        healthy += 1
                    elif health_status == "degraded":
                        degraded += 1
                    else:
                        unhealthy += 1

                    await service._create_lifecycle_event(
                        tenant_id=service_instance.tenant_id,
                        service_instance_id=service_instance.id,
                        event_type=LifecycleEventType.HEALTH_CHECK_COMPLETED,
                        description=f"Automated health check: {health_status}",
                        triggered_by_system="health_checker",
                        event_data={"health_status": health_status},
                    )

                    await session.commit()

                except Exception:
                    # Log error but continue checking other services
                    pass

            return {
                "checked": checked,
                "healthy": healthy,
                "degraded": degraded,
                "unhealthy": unhealthy,
            }

    result: dict[str, Any] = _run_async(_perform_health_checks())
    return result


@celery_app.task(name="lifecycle.process_scheduled_activations", bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def process_scheduled_activations_task(self: Task) -> dict[str, Any]:
    """
    Process services scheduled for activation.

    Runs periodically to find and activate services that are due.

    Returns:
        dict with processing results
    """

    async def _process_scheduled_activations() -> dict[str, Any]:
        processed = 0
        successful = 0
        failed = 0

        async with get_async_session_context() as session:
            service = LifecycleOrchestrationService(session)

            # Find services due for activation
            due_services = await service.get_services_due_for_activation()

            for service_instance in due_services:
                processed += 1

                try:
                    # Execute activation
                    previous_status = service_instance.status
                    service_instance.status = ServiceStatus.ACTIVE
                    service_instance.activated_at = datetime.now(UTC)

                    # Clear scheduled activation metadata
                    if "scheduled_activation_datetime" in service_instance.service_metadata:
                        del service_instance.service_metadata["scheduled_activation_datetime"]
                        from sqlalchemy.orm import attributes

                        attributes.flag_modified(service_instance, "service_metadata")

                    await service._create_lifecycle_event(
                        tenant_id=service_instance.tenant_id,
                        service_instance_id=service_instance.id,
                        event_type=LifecycleEventType.ACTIVATION_COMPLETED,
                        previous_status=previous_status,
                        new_status=ServiceStatus.ACTIVE,
                        description="Scheduled activation executed",
                        triggered_by_system="scheduler",
                    )

                    await session.commit()
                    successful += 1

                except Exception:
                    failed += 1
                    # Log error but continue processing

            return {
                "processed": processed,
                "successful": successful,
                "failed": failed,
            }

    result: dict[str, Any] = _run_async(_process_scheduled_activations())
    return result


@celery_app.task(name="lifecycle.rollback_failed_workflows", bind=True)  # type: ignore[misc]  # Celery decorator is untyped
def rollback_failed_workflows_task(self: Task, tenant_id: str | None = None) -> dict[str, Any]:
    """
    Automatically rollback failed provisioning workflows.

    Runs periodically to clean up failed workflows.

    Args:
        tenant_id: Optional tenant filter

    Returns:
        dict with rollback results
    """

    async def _rollback_workflows() -> dict[str, Any]:
        processed = 0
        successful = 0
        failed = 0
        rollback_details = []

        async with get_async_session_context() as session:
            service_obj = LifecycleOrchestrationService(session)

            # Find all tenants if not specified
            if tenant_id:
                tenants = [tenant_id]
            else:
                # Get all unique tenants with failed workflows
                from sqlalchemy import select

                from dotmac.platform.services.lifecycle.models import ProvisioningWorkflow

                result = await session.execute(
                    select(ProvisioningWorkflow.tenant_id)
                    .where(
                        ProvisioningWorkflow.status == ProvisioningStatus.FAILED,
                        ProvisioningWorkflow.rollback_completed.is_(False),
                    )
                    .distinct()
                )
                tenants = [row[0] for row in result.all()]

            # Process each tenant
            for tid in tenants:
                failed_workflows = await service_obj.get_failed_workflows_for_rollback(
                    tenant_id=tid, limit=10
                )

                for workflow in failed_workflows:
                    processed += 1

                    try:
                        # Execute rollback
                        rollback_result = await service_obj.rollback_provisioning_workflow(
                            service_instance_id=workflow.service_instance_id,
                            tenant_id=tid,
                            rollback_reason="Automatic rollback of failed provisioning",
                            user_id=None,
                        )

                        if rollback_result["success"]:
                            successful += 1
                            rollback_details.append(
                                {
                                    "service_instance_id": str(workflow.service_instance_id),
                                    "workflow_id": workflow.workflow_id,
                                    "status": "success",
                                }
                            )
                        else:
                            failed += 1
                            rollback_details.append(
                                {
                                    "service_instance_id": str(workflow.service_instance_id),
                                    "workflow_id": workflow.workflow_id,
                                    "status": "failed",
                                    "error": rollback_result.get("error"),
                                }
                            )

                    except Exception as e:
                        failed += 1
                        rollback_details.append(
                            {
                                "service_instance_id": str(workflow.service_instance_id),
                                "workflow_id": workflow.workflow_id,
                                "status": "error",
                                "error": str(e),
                            }
                        )

            return {
                "processed": processed,
                "successful": successful,
                "failed": failed,
                "rollback_details": rollback_details,
            }

    result: dict[str, Any] = _run_async(_rollback_workflows())
    return result
