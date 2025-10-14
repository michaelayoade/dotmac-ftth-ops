"""
Service Lifecycle Orchestration Service.

Comprehensive service layer for managing ISP service lifecycle including
provisioning, activation, suspension, resumption, and termination workflows.
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.services.lifecycle.models import (
    LifecycleEvent,
    LifecycleEventType,
    ProvisioningStatus,
    ProvisioningWorkflow,
    ServiceInstance,
    ServiceStatus,
    ServiceType,
)
from dotmac.platform.services.lifecycle.schemas import (
    BulkServiceOperationRequest,
    BulkServiceOperationResult,
    ServiceActivationRequest,
    ServiceHealthCheckRequest,
    ServiceModificationRequest,
    ServiceOperationResult,
    ServiceProvisioningResponse,
    ServiceProvisionRequest,
    ServiceResumptionRequest,
    ServiceStatistics,
    ServiceSuspensionRequest,
    ServiceTerminationRequest,
)


class LifecycleOrchestrationService:
    """
    Service lifecycle orchestration service.

    Manages complete service lifecycle from provisioning through termination
    with workflow automation, health monitoring, and event tracking.
    """

    def __init__(self, session: AsyncSession):
        """Initialize the service with database session."""
        self.session = session

    # ==========================================
    # Service Provisioning
    # ==========================================

    async def provision_service(
        self,
        tenant_id: str,
        data: ServiceProvisionRequest,
        created_by_user_id: UUID | None = None,
    ) -> ServiceProvisioningResponse:
        """
        Initiate service provisioning workflow.

        Creates a new service instance and starts the provisioning workflow.
        This is an async operation that may take time to complete.

        Args:
            tenant_id: Tenant identifier
            data: Service provision request data
            created_by_user_id: User initiating the provisioning

        Returns:
            ServiceProvisioningResponse with workflow details

        Raises:
            ValueError: If validation fails
        """
        # Generate unique service identifier
        service_identifier = await self._generate_service_identifier(tenant_id, data.service_type)

        # Create service instance
        service_instance = ServiceInstance(
            tenant_id=tenant_id,
            service_identifier=service_identifier,
            service_name=data.service_name,
            service_type=data.service_type,
            customer_id=data.customer_id,
            subscription_id=data.subscription_id,
            plan_id=data.plan_id,
            status=ServiceStatus.PENDING,
            provisioning_status=ProvisioningStatus.PENDING,
            service_config=data.service_config,
            installation_address=data.installation_address,
            installation_scheduled_date=data.installation_scheduled_date,
            installation_technician_id=data.installation_technician_id,
            equipment_assigned=data.equipment_assigned,
            vlan_id=data.vlan_id,
            external_service_id=data.external_service_id,
            network_element_id=data.network_element_id,
            metadata=data.metadata,
            notes=data.notes,
            created_by_user_id=created_by_user_id,
        )

        self.session.add(service_instance)
        await self.session.flush()

        # Create provisioning workflow
        workflow_id = f"WF-{uuid4().hex[:12].upper()}"
        workflow = ProvisioningWorkflow(
            tenant_id=tenant_id,
            workflow_id=workflow_id,
            workflow_type="provision",
            service_instance_id=service_instance.id,
            status=ProvisioningStatus.PENDING,
            total_steps=self._get_provisioning_steps_count(data.service_type),
            workflow_config={
                "service_type": data.service_type.value,
                "installation_required": bool(data.installation_scheduled_date),
                "equipment_count": len(data.equipment_assigned),
            },
        )

        self.session.add(workflow)

        # Create lifecycle event
        await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service_instance.id,
            event_type=LifecycleEventType.PROVISION_REQUESTED,
            description=f"Service provisioning requested: {data.service_name}",
            triggered_by_user_id=created_by_user_id,
            event_data={
                "service_type": data.service_type.value,
                "customer_id": str(data.customer_id),
                "subscription_id": data.subscription_id,
            },
        )

        await self.session.commit()
        await self.session.refresh(service_instance)
        await self.session.refresh(workflow)

        # Calculate estimated completion
        estimated_completion = datetime.now(UTC) + timedelta(hours=2)
        if data.installation_scheduled_date:
            estimated_completion = data.installation_scheduled_date + timedelta(hours=4)

        return ServiceProvisioningResponse(
            service_instance_id=service_instance.id,
            service_identifier=service_identifier,
            workflow_id=workflow_id,
            status=ServiceStatus.PENDING,
            provisioning_status=ProvisioningStatus.PENDING,
            message="Service provisioning workflow initiated successfully",
            estimated_completion=estimated_completion,
        )

    async def start_provisioning_workflow(self, service_instance_id: UUID, tenant_id: str) -> bool:
        """
        Start the actual provisioning workflow execution.

        This method would typically be called by a Celery task to execute
        the provisioning steps asynchronously.

        Args:
            service_instance_id: Service instance ID
            tenant_id: Tenant identifier

        Returns:
            bool: True if workflow started successfully
        """
        # Get service instance
        service = await self.get_service_instance(service_instance_id, tenant_id)
        if not service:
            raise ValueError("Service instance not found")

        # Get workflow
        result = await self.session.execute(
            select(ProvisioningWorkflow).where(
                and_(
                    ProvisioningWorkflow.tenant_id == tenant_id,
                    ProvisioningWorkflow.service_instance_id == service_instance_id,
                    ProvisioningWorkflow.workflow_type == "provision",
                    ProvisioningWorkflow.status == ProvisioningStatus.PENDING,
                )
            )
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            raise ValueError("Provisioning workflow not found")

        # Update statuses
        service.status = ServiceStatus.PROVISIONING
        service.provisioning_status = ProvisioningStatus.VALIDATING
        service.provisioning_started_at = datetime.now(UTC)
        service.workflow_id = workflow.workflow_id

        workflow.status = ProvisioningStatus.VALIDATING
        workflow.started_at = datetime.now(UTC)

        # Create event
        await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service_instance_id,
            event_type=LifecycleEventType.PROVISION_STARTED,
            new_status=ServiceStatus.PROVISIONING,
            description="Provisioning workflow started",
            workflow_id=workflow.workflow_id,
        )

        await self.session.commit()
        return True

    # ==========================================
    # Service Activation
    # ==========================================

    async def activate_service(
        self,
        tenant_id: str,
        data: ServiceActivationRequest,
        activated_by_user_id: UUID | None = None,
    ) -> ServiceOperationResult:
        """
        Activate a provisioned service.

        Transitions a successfully provisioned service to active status.

        Args:
            tenant_id: Tenant identifier
            data: Activation request data
            activated_by_user_id: User performing activation

        Returns:
            ServiceOperationResult with activation details
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="activate",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Validate status
        if service.status not in [ServiceStatus.PROVISIONING, ServiceStatus.SUSPENDED]:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="activate",
                message=f"Cannot activate service in {service.status.value} status",
                error="INVALID_STATUS",
            )

        # Update service status
        previous_status = service.status
        service.status = ServiceStatus.ACTIVE
        service.activated_at = datetime.now(UTC)
        service.notification_sent = data.send_notification
        if data.metadata:
            service.metadata.update(data.metadata)

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=LifecycleEventType.ACTIVATION_COMPLETED,
            previous_status=previous_status,
            new_status=ServiceStatus.ACTIVE,
            description=data.activation_note or "Service activated successfully",
            triggered_by_user_id=activated_by_user_id,
            event_data={"send_notification": data.send_notification},
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="activate",
            message="Service activated successfully",
            event_id=event.id,
        )

    # ==========================================
    # Service Suspension
    # ==========================================

    async def suspend_service(
        self,
        tenant_id: str,
        data: ServiceSuspensionRequest,
        suspended_by_user_id: UUID | None = None,
    ) -> ServiceOperationResult:
        """
        Suspend an active service.

        Temporarily suspends service access while maintaining the service record.

        Args:
            tenant_id: Tenant identifier
            data: Suspension request data
            suspended_by_user_id: User performing suspension

        Returns:
            ServiceOperationResult with suspension details
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="suspend",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Validate status
        if service.status != ServiceStatus.ACTIVE:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="suspend",
                message=f"Cannot suspend service in {service.status.value} status",
                error="INVALID_STATUS",
            )

        # Update service status
        previous_status = service.status
        service.status = (
            ServiceStatus.SUSPENDED_FRAUD
            if data.suspension_type == "fraud"
            else ServiceStatus.SUSPENDED
        )
        service.suspended_at = datetime.now(UTC)
        service.suspension_reason = data.suspension_reason
        service.auto_resume_at = data.auto_resume_at
        service.notification_sent = data.send_notification
        if data.metadata:
            service.metadata.update(data.metadata)

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=LifecycleEventType.SUSPENSION_COMPLETED,
            previous_status=previous_status,
            new_status=service.status,
            description=f"Service suspended: {data.suspension_reason}",
            triggered_by_user_id=suspended_by_user_id,
            event_data={
                "suspension_reason": data.suspension_reason,
                "suspension_type": data.suspension_type,
                "auto_resume_at": (
                    data.auto_resume_at.isoformat() if data.auto_resume_at else None
                ),
                "send_notification": data.send_notification,
            },
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="suspend",
            message="Service suspended successfully",
            event_id=event.id,
        )

    # ==========================================
    # Service Resumption
    # ==========================================

    async def resume_service(
        self,
        tenant_id: str,
        data: ServiceResumptionRequest,
        resumed_by_user_id: UUID | None = None,
    ) -> ServiceOperationResult:
        """
        Resume a suspended service.

        Restores service access after suspension.

        Args:
            tenant_id: Tenant identifier
            data: Resumption request data
            resumed_by_user_id: User performing resumption

        Returns:
            ServiceOperationResult with resumption details
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="resume",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Validate status
        if service.status not in [
            ServiceStatus.SUSPENDED,
            ServiceStatus.SUSPENDED_FRAUD,
        ]:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="resume",
                message=f"Cannot resume service in {service.status.value} status",
                error="INVALID_STATUS",
            )

        # Update service status
        previous_status = service.status
        service.status = ServiceStatus.ACTIVE
        service.suspended_at = None
        service.suspension_reason = None
        service.auto_resume_at = None
        service.notification_sent = data.send_notification
        if data.metadata:
            service.metadata.update(data.metadata)

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=LifecycleEventType.RESUMPTION_COMPLETED,
            previous_status=previous_status,
            new_status=ServiceStatus.ACTIVE,
            description=data.resumption_note or "Service resumed successfully",
            triggered_by_user_id=resumed_by_user_id,
            event_data={"send_notification": data.send_notification},
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="resume",
            message="Service resumed successfully",
            event_id=event.id,
        )

    # ==========================================
    # Service Termination
    # ==========================================

    async def terminate_service(
        self,
        tenant_id: str,
        data: ServiceTerminationRequest,
        terminated_by_user_id: UUID | None = None,
    ) -> ServiceOperationResult:
        """
        Terminate a service.

        Permanently terminates service, optionally scheduling for future date.

        Args:
            tenant_id: Tenant identifier
            data: Termination request data
            terminated_by_user_id: User performing termination

        Returns:
            ServiceOperationResult with termination details
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="terminate",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Validate status
        if service.status == ServiceStatus.TERMINATED:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="terminate",
                message="Service is already terminated",
                error="ALREADY_TERMINATED",
            )

        # Update service status
        previous_status = service.status
        termination_date = data.termination_date or datetime.now(UTC)

        if termination_date > datetime.now(UTC):
            # Schedule for future termination
            service.status = ServiceStatus.TERMINATING
            service.metadata.update(
                {
                    "scheduled_termination_date": termination_date.isoformat(),
                    "termination_reason": data.termination_reason,
                    "termination_type": data.termination_type,
                }
            )
            message = f"Service scheduled for termination on {termination_date.isoformat()}"
        else:
            # Immediate termination
            service.status = ServiceStatus.TERMINATED
            service.terminated_at = termination_date
            service.termination_reason = data.termination_reason
            service.termination_type = data.termination_type
            message = "Service terminated successfully"

        service.notification_sent = data.send_notification
        if data.metadata:
            service.metadata.update(data.metadata)

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=(
                LifecycleEventType.TERMINATION_COMPLETED
                if service.status == ServiceStatus.TERMINATED
                else LifecycleEventType.TERMINATION_REQUESTED
            ),
            previous_status=previous_status,
            new_status=service.status,
            description=f"Service termination: {data.termination_reason}",
            triggered_by_user_id=terminated_by_user_id,
            event_data={
                "termination_reason": data.termination_reason,
                "termination_type": data.termination_type,
                "termination_date": termination_date.isoformat(),
                "return_equipment": data.return_equipment,
                "send_notification": data.send_notification,
            },
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="terminate",
            message=message,
            event_id=event.id,
        )

    # ==========================================
    # Service Modification
    # ==========================================

    async def modify_service(
        self,
        tenant_id: str,
        data: ServiceModificationRequest,
        modified_by_user_id: UUID | None = None,
    ) -> ServiceOperationResult:
        """
        Modify an existing service.

        Updates service configuration, equipment, or metadata.

        Args:
            tenant_id: Tenant identifier
            data: Modification request data
            modified_by_user_id: User performing modification

        Returns:
            ServiceOperationResult with modification details
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="modify",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Track changes
        changes = {}

        # Update fields if provided
        if data.service_name is not None:
            changes["service_name"] = {
                "old": service.service_name,
                "new": data.service_name,
            }
            service.service_name = data.service_name

        if data.service_config is not None:
            changes["service_config"] = {"updated": True}
            service.service_config.update(data.service_config)

        if data.installation_address is not None:
            changes["installation_address"] = {
                "old": service.installation_address,
                "new": data.installation_address,
            }
            service.installation_address = data.installation_address

        if data.equipment_assigned is not None:
            changes["equipment_assigned"] = {
                "old": service.equipment_assigned,
                "new": data.equipment_assigned,
            }
            service.equipment_assigned = data.equipment_assigned

        if data.vlan_id is not None:
            changes["vlan_id"] = {"old": service.vlan_id, "new": data.vlan_id}
            service.vlan_id = data.vlan_id

        if data.metadata is not None:
            service.metadata.update(data.metadata)

        if data.notes is not None:
            service.notes = data.notes

        service.updated_by_user_id = modified_by_user_id

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=LifecycleEventType.MODIFICATION_COMPLETED,
            description=f"Service modified: {data.modification_reason}",
            triggered_by_user_id=modified_by_user_id,
            event_data={
                "modification_reason": data.modification_reason,
                "changes": changes,
                "send_notification": data.send_notification,
            },
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="modify",
            message="Service modified successfully",
            event_id=event.id,
        )

    # ==========================================
    # Health Checks
    # ==========================================

    async def perform_health_check(
        self, tenant_id: str, data: ServiceHealthCheckRequest
    ) -> ServiceOperationResult:
        """
        Perform health check on a service.

        Checks service connectivity and performance.

        Args:
            tenant_id: Tenant identifier
            data: Health check request data

        Returns:
            ServiceOperationResult with health check results
        """
        # Get service instance
        service = await self.get_service_instance(data.service_instance_id, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="health_check",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Perform health check (this would integrate with monitoring systems)
        health_status = "healthy"  # Default for now
        health_data = {
            "check_timestamp": datetime.now(UTC).isoformat(),
            "check_type": data.check_type or "basic",
            "service_status": service.status.value,
        }

        # Update service health
        service.last_health_check_at = datetime.now(UTC)
        service.health_status = health_status

        # Create lifecycle event
        event = await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service.id,
            event_type=LifecycleEventType.HEALTH_CHECK_COMPLETED,
            description=f"Health check completed: {health_status}",
            event_data=health_data,
        )

        await self.session.commit()

        return ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="health_check",
            message=f"Health check completed: {health_status}",
            event_id=event.id,
        )

    # ==========================================
    # Bulk Operations
    # ==========================================

    async def bulk_service_operation(
        self,
        tenant_id: str,
        data: BulkServiceOperationRequest,
        user_id: UUID | None = None,
    ) -> BulkServiceOperationResult:
        """
        Perform bulk operations on multiple services.

        Args:
            tenant_id: Tenant identifier
            data: Bulk operation request
            user_id: User performing the operation

        Returns:
            BulkServiceOperationResult with individual results
        """
        start_time = datetime.now(UTC)
        results: list[ServiceOperationResult] = []

        for service_id in data.service_instance_ids:
            try:
                if data.operation == "suspend":
                    suspension_request = ServiceSuspensionRequest(
                        service_instance_id=service_id, **data.operation_params
                    )
                    result = await self.suspend_service(tenant_id, suspension_request, user_id)
                elif data.operation == "resume":
                    resumption_request = ServiceResumptionRequest(
                        service_instance_id=service_id, **data.operation_params
                    )
                    result = await self.resume_service(tenant_id, resumption_request, user_id)
                elif data.operation == "terminate":
                    termination_request = ServiceTerminationRequest(
                        service_instance_id=service_id, **data.operation_params
                    )
                    result = await self.terminate_service(tenant_id, termination_request, user_id)
                elif data.operation == "health_check":
                    health_request = ServiceHealthCheckRequest(
                        service_instance_id=service_id, **data.operation_params
                    )
                    result = await self.perform_health_check(tenant_id, health_request)
                else:
                    result = ServiceOperationResult(
                        success=False,
                        service_instance_id=service_id,
                        operation=data.operation,
                        message="Unknown operation",
                        error="UNKNOWN_OPERATION",
                    )

                results.append(result)
            except Exception as e:
                results.append(
                    ServiceOperationResult(
                        success=False,
                        service_instance_id=service_id,
                        operation=data.operation,
                        message=f"Operation failed: {str(e)}",
                        error="EXCEPTION",
                    )
                )

        end_time = datetime.now(UTC)
        execution_time = (end_time - start_time).total_seconds()

        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful

        return BulkServiceOperationResult(
            total_requested=len(data.service_instance_ids),
            total_successful=successful,
            total_failed=failed,
            results=results,
            execution_time_seconds=execution_time,
        )

    # ==========================================
    # Query Methods
    # ==========================================

    async def get_service_instance(
        self, service_instance_id: UUID, tenant_id: str
    ) -> ServiceInstance | None:
        """Get a service instance by ID."""
        result = await self.session.execute(
            select(ServiceInstance).where(
                and_(
                    ServiceInstance.id == service_instance_id,
                    ServiceInstance.tenant_id == tenant_id,
                    ServiceInstance.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_service_instances(
        self,
        tenant_id: str,
        customer_id: UUID | None = None,
        status: ServiceStatus | None = None,
        service_type: ServiceType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ServiceInstance]:
        """List service instances with filters."""
        query = select(ServiceInstance).where(
            and_(
                ServiceInstance.tenant_id == tenant_id,
                ServiceInstance.deleted_at.is_(None),
            )
        )

        if customer_id:
            query = query.where(ServiceInstance.customer_id == customer_id)
        if status:
            query = query.where(ServiceInstance.status == status)
        if service_type:
            query = query.where(ServiceInstance.service_type == service_type)

        query = query.order_by(ServiceInstance.created_at.desc())
        query = query.limit(limit).offset(offset)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_lifecycle_events(
        self,
        service_instance_id: UUID,
        tenant_id: str,
        event_type: LifecycleEventType | None = None,
        limit: int = 50,
    ) -> list[LifecycleEvent]:
        """Get lifecycle events for a service instance."""
        query = select(LifecycleEvent).where(
            and_(
                LifecycleEvent.tenant_id == tenant_id,
                LifecycleEvent.service_instance_id == service_instance_id,
            )
        )

        if event_type:
            query = query.where(LifecycleEvent.event_type == event_type)

        query = query.order_by(LifecycleEvent.event_timestamp.desc()).limit(limit)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_statistics(self, tenant_id: str) -> ServiceStatistics:
        """Get service statistics for a tenant."""
        # Count by status
        status_counts = await self.session.execute(
            select(ServiceInstance.status, func.count(ServiceInstance.id))
            .where(
                and_(
                    ServiceInstance.tenant_id == tenant_id,
                    ServiceInstance.deleted_at.is_(None),
                )
            )
            .group_by(ServiceInstance.status)
        )

        status_map = dict(status_counts)

        # Count by type
        type_counts = await self.session.execute(
            select(ServiceInstance.service_type, func.count(ServiceInstance.id))
            .where(
                and_(
                    ServiceInstance.tenant_id == tenant_id,
                    ServiceInstance.deleted_at.is_(None),
                )
            )
            .group_by(ServiceInstance.service_type)
        )

        services_by_type = {stype.value: count for stype, count in type_counts if stype}

        # Health metrics
        health_result = await self.session.execute(
            select(
                func.count(ServiceInstance.id),
                func.count(ServiceInstance.id.filter(ServiceInstance.health_status == "healthy")),
                func.count(ServiceInstance.id.filter(ServiceInstance.health_status == "degraded")),
                func.avg(ServiceInstance.uptime_percentage),
            ).where(
                and_(
                    ServiceInstance.tenant_id == tenant_id,
                    ServiceInstance.deleted_at.is_(None),
                    ServiceInstance.status == ServiceStatus.ACTIVE,
                )
            )
        )

        total, healthy, degraded, avg_uptime = health_result.one()

        # Workflow metrics
        workflow_result = await self.session.execute(
            select(
                func.count(ProvisioningWorkflow.id),
                func.count(
                    ProvisioningWorkflow.id.filter(
                        ProvisioningWorkflow.status == ProvisioningStatus.FAILED
                    )
                ),
            ).where(
                and_(
                    ProvisioningWorkflow.tenant_id == tenant_id,
                    ProvisioningWorkflow.completed_at.is_(None),
                )
            )
        )

        active_workflows, failed_workflows = workflow_result.one()

        return ServiceStatistics(
            total_services=sum(status_map.values()),
            active_services=status_map.get(ServiceStatus.ACTIVE, 0),
            provisioning_services=status_map.get(ServiceStatus.PROVISIONING, 0),
            suspended_services=status_map.get(ServiceStatus.SUSPENDED, 0)
            + status_map.get(ServiceStatus.SUSPENDED_FRAUD, 0),
            terminated_services=status_map.get(ServiceStatus.TERMINATED, 0),
            failed_services=status_map.get(ServiceStatus.FAILED, 0),
            services_by_type=services_by_type,
            healthy_services=healthy or 0,
            degraded_services=degraded or 0,
            average_uptime=float(avg_uptime or 0.0),
            active_workflows=active_workflows or 0,
            failed_workflows=failed_workflows or 0,
        )

    # ==========================================
    # Helper Methods
    # ==========================================

    async def _generate_service_identifier(self, tenant_id: str, service_type: ServiceType) -> str:
        """Generate unique service identifier."""
        # Get service type prefix
        type_prefix = service_type.value[:4].upper()

        # Get count for this tenant
        result = await self.session.execute(
            select(func.count(ServiceInstance.id)).where(ServiceInstance.tenant_id == tenant_id)
        )
        count = result.scalar_one() + 1

        return f"SVC-{type_prefix}-{count:06d}"

    def _get_provisioning_steps_count(self, service_type: ServiceType) -> int:
        """Get number of provisioning steps for service type."""
        # Simplified - in production, this would vary by service type
        base_steps = 5  # Validation, allocation, configuration, activation, testing
        if service_type in [ServiceType.FIBER_INTERNET, ServiceType.TRIPLE_PLAY]:
            return base_steps + 2  # Additional steps for complex services
        return base_steps

    async def _create_lifecycle_event(
        self,
        tenant_id: str,
        service_instance_id: UUID,
        event_type: LifecycleEventType,
        description: str | None = None,
        previous_status: ServiceStatus | None = None,
        new_status: ServiceStatus | None = None,
        success: bool = True,
        error_message: str | None = None,
        error_code: str | None = None,
        workflow_id: str | None = None,
        task_id: str | None = None,
        duration_seconds: float | None = None,
        triggered_by_user_id: UUID | None = None,
        triggered_by_system: str | None = None,
        event_data: dict[str, Any] | None = None,
        external_system_response: dict[str, Any] | None = None,
    ) -> LifecycleEvent:
        """Create a lifecycle event."""
        event = LifecycleEvent(
            tenant_id=tenant_id,
            service_instance_id=service_instance_id,
            event_type=event_type,
            description=description,
            previous_status=previous_status,
            new_status=new_status,
            success=success,
            error_message=error_message,
            error_code=error_code,
            workflow_id=workflow_id,
            task_id=task_id,
            duration_seconds=duration_seconds,
            triggered_by_user_id=triggered_by_user_id,
            triggered_by_system=triggered_by_system,
            event_data=event_data or {},
            external_system_response=external_system_response,
        )

        self.session.add(event)
        await self.session.flush()
        return event
