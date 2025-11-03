"""
Service Lifecycle Orchestration Service.

Comprehensive service layer for managing ISP service lifecycle including
provisioning, activation, suspension, resumption, and termination workflows.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID, uuid4

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes

from dotmac.platform.core.exceptions import BusinessRuleError, ValidationError
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

User: Any | None
try:  # pragma: no cover - optional dependency during minimized installs
    from dotmac.platform.user_management.models import User
except Exception:  # pragma: no cover - optional dependency
    User = None


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
        auto_activate: bool = True,
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
        if not data.service_name or len(data.service_name.strip()) < 3:
            raise ValidationError("Service name must be at least 3 characters")
        # Allow provisioning to proceed even if equipment will be assigned later.
        equipment_assigned = list(data.equipment_assigned or [])

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
            equipment_assigned=equipment_assigned,
            vlan_id=data.vlan_id,
            external_service_id=data.external_service_id,
            network_element_id=data.network_element_id,
            service_metadata=data.metadata,
            notes=data.notes,
            created_by=str(created_by_user_id) if created_by_user_id else None,
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
                "equipment_count": len(equipment_assigned),
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

        if auto_activate:
            await self._auto_progress_provisioning(
                tenant_id=tenant_id,
                service_instance=service_instance,
                workflow=workflow,
                triggered_by_user_id=created_by_user_id,
            )
            await self.session.refresh(service_instance)
            await self.session.refresh(workflow)

        return ServiceProvisioningResponse(
            service_instance_id=service_instance.id,
            service_identifier=service_identifier,
            workflow_id=workflow_id,
            status=service_instance.status,
            provisioning_status=service_instance.provisioning_status or ProvisioningStatus.PENDING,
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

    async def _auto_progress_provisioning(
        self,
        tenant_id: str,
        service_instance: ServiceInstance,
        workflow: ProvisioningWorkflow,
        triggered_by_user_id: UUID | None,
    ) -> None:
        """Automatically mark provisioning workflow as completed and activate service."""
        now = datetime.now(UTC)

        # Move to provisioning state and record start event
        service_instance.workflow_id = workflow.workflow_id
        service_instance.provisioning_started_at = now
        service_instance.status = ServiceStatus.PROVISIONING
        service_instance.provisioning_status = ProvisioningStatus.ACTIVATING_SERVICE

        workflow.status = ProvisioningStatus.ACTIVATING_SERVICE
        workflow.started_at = workflow.started_at or now
        workflow.current_step = max(workflow.current_step, 1)

        await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service_instance.id,
            event_type=LifecycleEventType.PROVISION_STARTED,
            previous_status=ServiceStatus.PENDING,
            new_status=ServiceStatus.PROVISIONING,
            description="Provisioning workflow started",
            triggered_by_user_id=triggered_by_user_id,
            workflow_id=workflow.workflow_id,
        )

        await self.session.commit()

        # Activate service using existing activation flow
        activation_result = cast(
            ServiceOperationResult,
            await self.activate_service(
                tenant_id=tenant_id,
                data=ServiceActivationRequest(service_instance_id=service_instance.id),
                activated_by_user_id=triggered_by_user_id,
            ),
        )

        if not activation_result.success:
            raise ValidationError(activation_result.message)

        await self.session.refresh(service_instance)

        completion_time = datetime.now(UTC)
        service_instance.provisioning_status = ProvisioningStatus.COMPLETED
        service_instance.provisioned_at = completion_time
        service_instance.notification_sent = True

        workflow.status = ProvisioningStatus.COMPLETED
        workflow.completed_at = completion_time
        workflow.current_step = workflow.total_steps
        workflow.failed_steps = []
        if "auto_activation" not in workflow.completed_steps:
            workflow.completed_steps.append("auto_activation")
        workflow.last_error = None
        workflow.retry_count = 0

        await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service_instance.id,
            event_type=LifecycleEventType.PROVISION_COMPLETED,
            previous_status=ServiceStatus.PROVISIONING,
            new_status=service_instance.status,
            description="Provisioning workflow completed",
            triggered_by_user_id=triggered_by_user_id,
            workflow_id=workflow.workflow_id,
        )

        await self.session.commit()
        await self.session.refresh(service_instance)
        await self.session.refresh(workflow)

    # ==========================================
    # Service Activation
    # ==========================================

    async def activate_service(
        self,
        tenant_id: str,
        data: ServiceActivationRequest | None = None,
        activated_by_user_id: UUID | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        activation_note: str | None = None,
        send_notification: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ServiceOperationResult | ServiceInstance:
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
        legacy_mode = data is None
        if data is None:
            resolved_id = service_instance_id or service_id
            if resolved_id is None:
                raise ValueError(
                    "service_id or service_instance_id is required when data is not provided"
                )
            data = ServiceActivationRequest(
                service_instance_id=resolved_id,
                activation_note=activation_note,
                send_notification=send_notification if send_notification is not None else True,
                metadata=metadata or {},
            )
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            raise ValueError("service_instance_id is required for service activation")

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
        if not service:
            return ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="activate",
                message="Service instance not found",
                error="NOT_FOUND",
            )

        # Allow activation from pending by transitioning to provisioning
        if service.status == ServiceStatus.PENDING:
            service.provisioning_started_at = service.provisioning_started_at or datetime.now(UTC)
            service.status = ServiceStatus.PROVISIONING
            service.provisioning_status = ProvisioningStatus.ACTIVATING_SERVICE

        # Validate status
        if service.status not in [ServiceStatus.PROVISIONING, ServiceStatus.SUSPENDED]:
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="activate",
                message=f"Cannot activate service in {service.status.value} status",
                error="INVALID_STATUS",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

        # Update service status
        previous_status = service.status
        service.status = ServiceStatus.ACTIVE
        service.activated_at = datetime.now(UTC)
        service.notification_sent = data.send_notification
        if data.metadata:
            service.service_metadata.update(data.metadata)
            attributes.flag_modified(service, "service_metadata")

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

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="activate",
            message="Service activated successfully",
            event_id=event.id,
        )
        await self.session.refresh(service)
        if legacy_mode:
            return service
        return result

    # ==========================================
    # Service Suspension
    # ==========================================

    async def suspend_service(
        self,
        tenant_id: str,
        data: ServiceSuspensionRequest | None = None,
        suspended_by_user_id: UUID | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        reason: str | None = None,
        suspension_type: str | None = None,
        auto_resume_at: datetime | None = None,
        send_notification: bool | None = None,
        metadata: dict[str, Any] | None = None,
        fraud_suspension: bool | None = None,
    ) -> ServiceOperationResult | ServiceInstance:
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
        legacy_mode = data is None
        if data is None:
            resolved_id = service_instance_id or service_id
            if resolved_id is None or reason is None:
                raise ValueError(
                    "service_id/service_instance_id and reason are required when data is not provided"
                )
            effective_type = suspension_type
            if fraud_suspension:
                effective_type = "fraud"
            normalized_reason = reason or "Service suspension"
            if len(normalized_reason.strip()) < 5:
                normalized_reason = f"{normalized_reason.strip()} reason"

            payload = {
                "service_instance_id": resolved_id,
                "reason": normalized_reason,
                "auto_resume_at": auto_resume_at,
                "send_notification": True if send_notification is None else send_notification,
                "metadata": metadata or {},
                "suspension_note": None,
            }
            if effective_type is not None:
                payload["suspension_type"] = effective_type

            data = ServiceSuspensionRequest.model_validate(payload)
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        # Check if service_instance_id is provided
        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            return ServiceOperationResult(
                success=False,
                service_instance_id=None,
                operation="suspend",
                message="Service instance ID is required",
                error="MISSING_ID",
            )

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
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
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="suspend",
                message=f"Cannot suspend service in {service.status.value} status",
                error="INVALID_STATUS",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

        # Update service status
        previous_status = service.status
        if data.suspension_type == "fraud":
            service.status = ServiceStatus.SUSPENDED_FRAUD
        elif (data.suspension_type or "").lower() == "non_payment" or (
            data.suspension_reason or ""
        ).lower().startswith("non_payment"):
            service.status = ServiceStatus.SUSPENDED_NON_PAYMENT
        else:
            service.status = ServiceStatus.SUSPENDED
        service.suspended_at = datetime.now(UTC)
        service.suspension_reason = data.suspension_reason
        service.auto_resume_at = data.auto_resume_at
        service.notification_sent = data.send_notification
        if data.metadata:
            service.service_metadata.update(data.metadata)
            attributes.flag_modified(service, "service_metadata")

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
                "note": data.suspension_note,
            },
        )

        await self.session.commit()

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="suspend",
            message="Service suspended successfully",
            event_id=event.id,
        )
        await self.session.refresh(service)
        if legacy_mode:
            return service
        return result

    # ==========================================
    # Service Resumption
    # ==========================================

    async def resume_service(
        self,
        tenant_id: str,
        data: ServiceResumptionRequest | None = None,
        resumed_by_user_id: UUID | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        resumption_note: str | None = None,
        send_notification: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ServiceOperationResult | ServiceInstance:
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
        legacy_mode = data is None
        if data is None:
            resolved_id = service_instance_id or service_id
            if resolved_id is None:
                raise ValueError(
                    "service_id or service_instance_id is required when data is not provided"
                )
            data = ServiceResumptionRequest.model_validate(
                {
                    "service_instance_id": resolved_id,
                    "resumption_note": resumption_note,
                    "send_notification": True if send_notification is None else send_notification,
                    "metadata": metadata or {},
                }
            )
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        # Check if service_instance_id is provided
        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            return ServiceOperationResult(
                success=False,
                service_instance_id=None,
                operation="resume",
                message="Service instance ID is required",
                error="MISSING_ID",
            )

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
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
            ServiceStatus.SUSPENDED_NON_PAYMENT,
        ]:
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="resume",
                message=f"Cannot resume service in {service.status.value} status",
                error="INVALID_STATUS",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

        # Update service status
        previous_status = service.status
        service.status = ServiceStatus.ACTIVE
        service.suspended_at = None
        service.suspension_reason = None
        service.auto_resume_at = None
        service.notification_sent = data.send_notification
        if data.metadata:
            service.service_metadata.update(data.metadata)
            attributes.flag_modified(service, "service_metadata")

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

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="resume",
            message="Service resumed successfully",
            event_id=event.id,
        )
        await self.session.refresh(service)
        if legacy_mode:
            return service
        return result

    # ==========================================
    # Service Termination
    # ==========================================

    async def terminate_service(
        self,
        tenant_id: str,
        data: ServiceTerminationRequest | None = None,
        terminated_by_user_id: UUID | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        termination_reason: str | None = None,
        reason: str | None = None,
        termination_type: str | None = None,
        termination_date: datetime | None = None,
        send_notification: bool | None = None,
        return_equipment: bool | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ServiceOperationResult | ServiceInstance:
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
        legacy_mode = data is None
        if data is None:
            resolved_reason = termination_reason or reason or "Customer request"
            if len(resolved_reason.strip()) < 5:
                resolved_reason = f"{resolved_reason.strip()} request"
            resolved_id = service_instance_id or service_id
            if resolved_id is None:
                raise ValueError(
                    "service_id or service_instance_id is required when data is not provided"
                )
            payload = {
                "service_instance_id": resolved_id,
                "reason": resolved_reason,
                "termination_date": termination_date,
                "send_notification": True if send_notification is None else send_notification,
                "return_equipment": False if return_equipment is None else return_equipment,
                "metadata": metadata or {},
            }
            if termination_type is not None:
                payload["termination_type"] = termination_type

            data = ServiceTerminationRequest.model_validate(payload)
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        # Check if service_instance_id is provided
        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            return ServiceOperationResult(
                success=False,
                service_instance_id=None,
                operation="terminate",
                message="Service instance ID is required",
                error="MISSING_ID",
            )

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
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
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="terminate",
                message="Service is already terminated",
                error="ALREADY_TERMINATED",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

        # Update service status
        previous_status = service.status
        termination_date = data.termination_date or datetime.now(UTC)

        if termination_date > datetime.now(UTC):
            # Schedule for future termination
            service.status = ServiceStatus.TERMINATING
            service.service_metadata.update(
                {
                    "scheduled_termination_date": termination_date.isoformat(),
                    "termination_reason": data.termination_reason,
                    "termination_type": data.termination_type,
                }
            )
            attributes.flag_modified(service, "service_metadata")
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
            service.service_metadata.update(data.metadata)
            attributes.flag_modified(service, "service_metadata")

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

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="terminate",
            message=message,
            event_id=event.id,
        )
        await self.session.refresh(service)
        if legacy_mode:
            return service
        return result

    # ==========================================
    # Service Modification
    # ==========================================

    async def modify_service(
        self,
        tenant_id: str,
        data: ServiceModificationRequest | None = None,
        modified_by_user_id: UUID | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        changes: dict[str, Any] | None = None,
    ) -> ServiceOperationResult | ServiceInstance:
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
        legacy_mode = data is None
        if data is None:
            resolved_id = service_instance_id or service_id
            if resolved_id is None:
                raise ValueError(
                    "service_id or service_instance_id is required when data is not provided"
                )
            payload = changes or {}
            data = ServiceModificationRequest.model_validate(
                {
                    "service_instance_id": resolved_id,
                    "service_config": payload.get("service_config"),
                    "service_name": payload.get("service_name"),
                    "installation_address": payload.get("installation_address"),
                    "equipment_assigned": payload.get("equipment_assigned"),
                    "vlan_id": payload.get("vlan_id"),
                    "metadata": payload.get("metadata"),
                    "notes": payload.get("notes"),
                    "modification_reason": payload.get("modification_reason", "Manual update"),
                    "send_notification": payload.get("send_notification", True),
                }
            )
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            return ServiceOperationResult(
                success=False,
                service_instance_id=None,
                operation="modify",
                message="Service instance ID is required",
                error="MISSING_ID",
            )

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
        if not service:
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="modify",
                message="Service instance not found",
                error="NOT_FOUND",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

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
            for key, new_value in data.service_config.items():
                old_value = service.service_config.get(key)
                if old_value != new_value:
                    changes[key] = {"old": old_value, "new": new_value}
                service.service_config[key] = new_value
            attributes.flag_modified(service, "service_config")

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
            service.service_metadata.update(data.metadata)
            attributes.flag_modified(service, "service_metadata")

        if data.notes is not None:
            service.notes = data.notes

        if modified_by_user_id is not None:
            service.updated_by = str(modified_by_user_id)

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

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="modify",
            message="Service modified successfully",
            event_id=event.id,
        )
        await self.session.refresh(service)
        return result

    # ==========================================
    # Health Checks
    # ==========================================

    async def perform_health_check(
        self,
        tenant_id: str,
        data: ServiceHealthCheckRequest | None = None,
        *,
        service_id: UUID | None = None,
        service_instance_id: UUID | None = None,
        check_type: str | None = None,
    ) -> ServiceOperationResult | Any:
        """
        Perform health check on a service.

        Checks service connectivity and performance.

        Args:
            tenant_id: Tenant identifier
            data: Health check request data

        Returns:
            ServiceOperationResult with health check results
        """
        legacy_mode = data is None
        if data is None:
            resolved_id = service_instance_id or service_id
            if resolved_id is None:
                raise ValueError(
                    "service_id or service_instance_id is required when data is not provided"
                )
            data = ServiceHealthCheckRequest.model_validate(
                {
                    "service_instance_id": resolved_id,
                    "check_type": check_type,
                }
            )
        elif service_instance_id is not None and not data.service_instance_id:
            data.service_instance_id = service_instance_id

        service_instance_id_value = data.service_instance_id
        if service_instance_id_value is None:
            return ServiceOperationResult(
                success=False,
                service_instance_id=None,
                operation="health_check",
                message="Service instance ID is required",
                error="MISSING_ID",
            )

        # Get service instance
        service = await self.get_service_instance(service_instance_id_value, tenant_id)
        if not service:
            result = ServiceOperationResult(
                success=False,
                service_instance_id=data.service_instance_id,
                operation="health_check",
                message="Service instance not found",
                error="NOT_FOUND",
            )
            if legacy_mode:
                raise BusinessRuleError(result.message)
            return result

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

        result = ServiceOperationResult(
            success=True,
            service_instance_id=service.id,
            operation="health_check",
            message=f"Health check completed: {health_status}",
            event_id=event.id,
        )
        await self.session.refresh(service)
        if legacy_mode:
            return SimpleNamespace(
                is_healthy=health_status == "healthy",
                checks_performed=1,
                status=service.status,
                details=health_data,
            )
        return result

    # ==========================================
    # Bulk Operations
    # ==========================================

    async def bulk_service_operation(
        self,
        tenant_id: str,
        data: BulkServiceOperationRequest | None = None,
        user_id: UUID | None = None,
        *,
        service_ids: list[UUID] | None = None,
        operation: str | None = None,
        operation_params: dict[str, Any] | None = None,
        **legacy_kwargs: Any,
    ) -> BulkServiceOperationResult | list[ServiceInstance]:
        """
        Perform bulk operations on multiple services.

        Args:
            tenant_id: Tenant identifier
            data: Bulk operation request
            user_id: User performing the operation

        Returns:
            BulkServiceOperationResult with individual results
        """
        if "performed_by_user_id" in legacy_kwargs and user_id is None:
            user_id = legacy_kwargs.pop("performed_by_user_id")

        if data is None:
            if service_ids is None or operation is None:
                raise ValueError("service_ids and operation are required when data is not provided")
            params = dict(operation_params or {})
            params.update(legacy_kwargs)
            results: list[Any] = []
            for service_id in service_ids:
                try:
                    if operation == "suspend":
                        svc = await self.suspend_service(
                            tenant_id,
                            service_instance_id=service_id,
                            reason=params.get("reason"),
                            suspension_type=params.get("suspension_type"),
                            auto_resume_at=params.get("auto_resume_at"),
                            send_notification=params.get("send_notification"),
                            metadata=params.get("metadata"),
                            fraud_suspension=params.get("fraud_suspension"),
                            suspended_by_user_id=user_id,
                        )
                    elif operation == "resume":
                        svc = await self.resume_service(
                            tenant_id,
                            service_instance_id=service_id,
                            resumption_note=params.get("resumption_note"),
                            send_notification=params.get("send_notification"),
                            metadata=params.get("metadata"),
                            resumed_by_user_id=user_id,
                        )
                    elif operation == "terminate":
                        svc = await self.terminate_service(
                            tenant_id,
                            service_instance_id=service_id,
                            reason=params.get("reason"),
                            termination_type=params.get("termination_type"),
                            termination_date=params.get("termination_date"),
                            send_notification=params.get("send_notification"),
                            return_equipment=params.get("return_equipment"),
                            metadata=params.get("metadata"),
                            terminated_by_user_id=user_id,
                        )
                    elif operation == "health_check":
                        svc = await self.perform_health_check(
                            tenant_id,
                            service_instance_id=service_id,
                            check_type=params.get("check_type"),
                        )
                    else:
                        raise ValueError("Unknown operation")
                    results.append(svc)
                except BusinessRuleError:
                    raise
                except Exception as exc:
                    raise BusinessRuleError(f"Operation failed: {exc}") from exc
            return results
        elif legacy_kwargs:
            raise ValueError("Unexpected keyword arguments for bulk operation")

        start_time = datetime.now(UTC)
        operation_results: list[ServiceOperationResult] = []

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

                if isinstance(result, ServiceOperationResult):
                    operation_results.append(result)
                elif isinstance(result, ServiceInstance):
                    operation_results.append(
                        ServiceOperationResult(
                            success=True,
                            service_instance_id=result.id,
                            operation=data.operation,
                            message="Operation completed successfully",
                        )
                    )
                else:
                    operation_results.append(
                        ServiceOperationResult(
                            success=False,
                            service_instance_id=service_id,
                            operation=data.operation,
                            message="Unsupported result type from operation",
                            error="UNEXPECTED_RESULT",
                        )
                    )
            except Exception as e:
                operation_results.append(
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

        successful = sum(1 for r in operation_results if r.success)
        failed = len(operation_results) - successful

        bulk_result = BulkServiceOperationResult(
            total_requested=len(data.service_instance_ids),
            total_successful=successful,
            total_failed=failed,
            results=operation_results,
            execution_time_seconds=execution_time,
        )
        return bulk_result

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
        tenant_id: str,
        service_instance_id: UUID | None = None,
        event_type: LifecycleEventType | None = None,
        limit: int = 50,
        *,
        service_id: UUID | None = None,
    ) -> list[LifecycleEvent]:
        """Get lifecycle events for a service instance."""
        if service_instance_id is None:
            if service_id is None:
                raise ValueError("service_instance_id is required")
            service_instance_id = service_id
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

        status_rows = status_counts.all()
        status_map: dict[ServiceStatus, int] = {status: int(count) for status, count in status_rows}

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

        # Random segment keeps identifiers globally unique across tenants
        unique_segment = uuid4().hex[:6].upper()

        # Get count for this tenant
        result = await self.session.execute(
            select(func.count(ServiceInstance.id)).where(ServiceInstance.tenant_id == tenant_id)
        )
        count = result.scalar_one() + 1

        return f"SVC-{type_prefix}-{unique_segment}-{count:06d}"

    def _get_provisioning_steps_count(self, service_type: ServiceType) -> int:
        """Get number of provisioning steps for service type."""
        # Simplified - in production, this would vary by service type
        base_steps = 5  # Validation, allocation, configuration, activation, testing
        if service_type in [ServiceType.FIBER_INTERNET, ServiceType.TRIPLE_PLAY]:
            return base_steps + 2  # Additional steps for complex services
        return base_steps

    # ==========================================
    # Workflow Rollback
    # ==========================================

    async def rollback_provisioning_workflow(
        self,
        service_instance_id: UUID,
        tenant_id: str,
        rollback_reason: str,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Rollback a failed provisioning workflow.

        This method reverses changes made during provisioning, including:
        - Releasing allocated network resources (IP, VLAN)
        - Removing equipment configurations
        - Cleaning up external system entries (RADIUS, etc.)
        - Marking service instance as rolled back

        Args:
            service_instance_id: Service instance ID
            tenant_id: Tenant identifier
            rollback_reason: Reason for rollback
            user_id: User initiating rollback

        Returns:
            dict with rollback results
        """
        # Get service instance
        service = await self.get_service_instance(service_instance_id, tenant_id)
        if not service:
            return {
                "success": False,
                "error": "Service instance not found",
                "service_instance_id": str(service_instance_id),
            }

        # Get workflow
        result = await self.session.execute(
            select(ProvisioningWorkflow).where(
                and_(
                    ProvisioningWorkflow.tenant_id == tenant_id,
                    ProvisioningWorkflow.service_instance_id == service_instance_id,
                    ProvisioningWorkflow.status == ProvisioningStatus.FAILED,
                )
            )
        )
        workflow = result.scalar_one_or_none()
        if not workflow:
            return {
                "success": False,
                "error": "No failed workflow found for rollback",
                "service_instance_id": str(service_instance_id),
            }

        start_time = datetime.now(UTC)
        rollback_steps = []
        rollback_errors = []

        try:
            # Mark workflow as rolling back
            workflow.status = ProvisioningStatus.ROLLED_BACK
            workflow.rollback_required = True

            # Step 1: Release IP address
            if service.ip_address:
                try:
                    service.ip_address = None
                    rollback_steps.append("ip_address_released")
                except Exception as e:
                    rollback_errors.append(f"IP release failed: {str(e)}")

            # Step 2: Release VLAN
            if service.vlan_id:
                try:
                    service.vlan_id = None
                    rollback_steps.append("vlan_released")
                except Exception as e:
                    rollback_errors.append(f"VLAN release failed: {str(e)}")

            # Step 3: Remove external service ID
            if service.external_service_id:
                try:
                    service.external_service_id = None
                    rollback_steps.append("external_service_removed")
                except Exception as e:
                    rollback_errors.append(f"External service removal failed: {str(e)}")

            # Step 4: Clear equipment assignments
            if service.equipment_assigned:
                try:
                    service.equipment_assigned = []
                    rollback_steps.append("equipment_cleared")
                except Exception as e:
                    rollback_errors.append(f"Equipment clear failed: {str(e)}")

            # Step 5: Reset service status
            previous_status = service.status
            service.status = ServiceStatus.FAILED
            service.provisioning_status = ProvisioningStatus.ROLLED_BACK
            service.service_metadata.update(
                {
                    "rollback_reason": rollback_reason,
                    "rollback_timestamp": datetime.now(UTC).isoformat(),
                    "rollback_steps": rollback_steps,
                    "rollback_errors": rollback_errors,
                }
            )
            attributes.flag_modified(service, "service_metadata")

            # Mark workflow rollback as completed
            workflow.rollback_completed = True

            # Create lifecycle event
            await self._create_lifecycle_event(
                tenant_id=tenant_id,
                service_instance_id=service_instance_id,
                event_type=LifecycleEventType.PROVISION_FAILED,
                previous_status=previous_status,
                new_status=ServiceStatus.FAILED,
                description=f"Provisioning rolled back: {rollback_reason}",
                triggered_by_user_id=user_id,
                triggered_by_system="rollback_system" if not user_id else None,
                duration_seconds=(datetime.now(UTC) - start_time).total_seconds(),
                event_data={
                    "rollback_reason": rollback_reason,
                    "rollback_steps": rollback_steps,
                    "rollback_errors": rollback_errors,
                },
            )

            await self.session.commit()

            return {
                "success": True,
                "service_instance_id": str(service_instance_id),
                "workflow_id": workflow.workflow_id,
                "rollback_steps": rollback_steps,
                "rollback_errors": rollback_errors,
                "duration_seconds": (datetime.now(UTC) - start_time).total_seconds(),
            }

        except Exception as e:
            await self.session.rollback()
            return {
                "success": False,
                "error": str(e),
                "service_instance_id": str(service_instance_id),
                "rollback_steps": rollback_steps,
                "rollback_errors": rollback_errors,
            }

    async def get_failed_workflows_for_rollback(
        self, tenant_id: str, limit: int = 50
    ) -> list[ProvisioningWorkflow]:
        """
        Get failed workflows that require rollback.

        Args:
            tenant_id: Tenant identifier
            limit: Maximum number of workflows to return

        Returns:
            List of failed workflows
        """
        result = await self.session.execute(
            select(ProvisioningWorkflow)
            .where(
                and_(
                    ProvisioningWorkflow.tenant_id == tenant_id,
                    ProvisioningWorkflow.status == ProvisioningStatus.FAILED,
                    ProvisioningWorkflow.rollback_completed.is_(False),
                )
            )
            .order_by(ProvisioningWorkflow.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    # ==========================================
    # Scheduled Workflow Execution
    # ==========================================

    async def schedule_service_activation(
        self,
        service_instance_id: UUID,
        tenant_id: str,
        activation_datetime: datetime,
        user_id: UUID | None = None,
    ) -> dict[str, Any]:
        """
        Schedule a service for future activation.

        Creates a scheduled job that will automatically activate the service
        at the specified datetime.

        Args:
            service_instance_id: Service instance ID
            tenant_id: Tenant identifier
            activation_datetime: When to activate the service
            user_id: User scheduling the activation

        Returns:
            dict with scheduling details
        """
        # Get service instance
        service = await self.get_service_instance(service_instance_id, tenant_id)
        if not service:
            return {
                "success": False,
                "error": "Service instance not found",
                "service_instance_id": str(service_instance_id),
            }

        # Validate service status
        if service.status != ServiceStatus.PROVISIONING:
            return {
                "success": False,
                "error": f"Cannot schedule activation for service in {service.status.value} status",
                "service_instance_id": str(service_instance_id),
            }

        # Update service metadata with scheduled activation
        service.service_metadata.update(
            {
                "scheduled_activation_datetime": activation_datetime.isoformat(),
                "activation_scheduled_by": str(user_id) if user_id else None,
                "activation_scheduled_at": datetime.now(UTC).isoformat(),
            }
        )
        attributes.flag_modified(service, "service_metadata")

        # Create lifecycle event
        await self._create_lifecycle_event(
            tenant_id=tenant_id,
            service_instance_id=service_instance_id,
            event_type=LifecycleEventType.ACTIVATION_REQUESTED,
            description=f"Service activation scheduled for {activation_datetime.isoformat()}",
            triggered_by_user_id=user_id,
            event_data={
                "scheduled_activation_datetime": activation_datetime.isoformat(),
            },
        )

        await self.session.commit()

        return {
            "success": True,
            "service_instance_id": str(service_instance_id),
            "service_identifier": service.service_identifier,
            "scheduled_activation_datetime": activation_datetime.isoformat(),
            "message": f"Service activation scheduled for {activation_datetime.isoformat()}",
        }

    async def get_services_due_for_activation(
        self, tenant_id: str | None = None
    ) -> list[ServiceInstance]:
        """
        Get services that are due for scheduled activation.

        Args:
            tenant_id: Optional tenant filter

        Returns:
            List of service instances due for activation
        """

        now = datetime.now(UTC)

        query = select(ServiceInstance).where(
            and_(
                ServiceInstance.status == ServiceStatus.PROVISIONING,
                ServiceInstance.deleted_at.is_(None),
            )
        )

        if tenant_id:
            query = query.where(ServiceInstance.tenant_id == tenant_id)

        result = await self.session.execute(query)
        services = list(result.scalars().all())

        # Filter services with scheduled activation
        due_services = []
        for service in services:
            scheduled_time_str = service.service_metadata.get("scheduled_activation_datetime")
            if scheduled_time_str:
                scheduled_time = datetime.fromisoformat(scheduled_time_str)
                if scheduled_time <= now:
                    due_services.append(service)

        return due_services

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
        resolved_user_id = triggered_by_user_id
        if triggered_by_user_id and User is not None:
            existing_user = await self.session.get(User, triggered_by_user_id)
            if existing_user is None:
                resolved_user_id = None

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
            triggered_by_user_id=resolved_user_id,
            triggered_by_system=triggered_by_system,
            event_data=event_data or {},
            external_system_response=external_system_response,
        )

        self.session.add(event)
        await self.session.flush()
        return event
