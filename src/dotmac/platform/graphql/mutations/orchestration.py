"""
GraphQL mutations for Orchestration Service.

Provides mutations for subscriber provisioning and workflow management.
"""

import strawberry
import structlog

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.orchestration import (
    ProvisionSubscriberInput,
    ProvisionSubscriberResult,
    Workflow,
    WorkflowStatus,
)
from dotmac.platform.orchestration.schemas import ProvisionSubscriberRequest
from dotmac.platform.orchestration.service import OrchestrationService

logger = structlog.get_logger(__name__)


@strawberry.type
class OrchestrationMutations:
    """GraphQL mutations for orchestration service."""

    @strawberry.mutation(description="Provision new subscriber atomically")  # type: ignore[misc]
    async def provision_subscriber(
        self,
        info: strawberry.Info[Context],
        input: ProvisionSubscriberInput,
    ) -> ProvisionSubscriberResult:
        """
        Provision a new subscriber across all systems atomically.

        This orchestrated workflow:
        1. Creates customer record (if needed)
        2. Creates subscriber record
        3. Creates RADIUS authentication account
        4. Allocates IP address from NetBox
        5. Activates ONU in VOLTHA
        6. Configures CPE in GenieACS
        7. Creates billing service record

        **Automatic Rollback:** If any step fails, all completed steps are
        automatically rolled back to maintain data consistency.

        Args:
            input: Subscriber provisioning input

        Returns:
            ProvisionSubscriberResult with workflow details

        Raises:
            Exception: If provisioning fails (workflow is automatically rolled back)
        """
        db = info.context.db
        current_user = info.context.current_user

        # Require authentication for provisioning
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required for subscriber provisioning")

        tenant_id = current_user.tenant_id
        user_id = current_user.user_id

        try:
            # Convert GraphQL input to request schema
            request = ProvisionSubscriberRequest(
                customer_id=input.customer_id,
                plan_id=None,
                subscriber_id=None,
                first_name=input.first_name,
                last_name=input.last_name,
                email=input.email,
                phone=input.phone,
                secondary_phone=input.secondary_phone,
                service_address=input.service_address,
                service_city=input.service_city,
                service_state=input.service_state,
                service_postal_code=input.service_postal_code,
                service_country=input.service_country,
                service_plan_id=input.service_plan_id,
                bandwidth_mbps=input.bandwidth_mbps,
                connection_type=input.connection_type,
                onu_serial=input.onu_serial,
                onu_mac=input.onu_mac,
                cpe_mac=input.cpe_mac,
                vlan_id=input.vlan_id,
                ipv4_address=input.ipv4_address,
                ipv6_prefix=input.ipv6_prefix,
                installation_date=input.installation_date,
                installation_notes=input.installation_notes,
                auto_activate=input.auto_activate,
                send_welcome_email=input.send_welcome_email,
                create_radius_account=input.create_radius_account,
                allocate_ip_from_netbox=input.allocate_ip_from_netbox,
                configure_voltha=input.configure_voltha,
                configure_genieacs=input.configure_genieacs,
                notes=input.notes,
                username=None,
                password=None,
            )

            # Execute provisioning workflow
            service = OrchestrationService(db=db, tenant_id=tenant_id)
            result = await service.provision_subscriber(
                request=request,
                initiator_id=user_id,
                initiator_type="graphql",
            )

            # Convert to GraphQL result
            status_value = getattr(result.status, "value", result.status)

            return ProvisionSubscriberResult(
                workflow_id=result.workflow_id,
                subscriber_id=result.subscriber_id,
                customer_id=result.customer_id,
                status=WorkflowStatus(status_value),
                radius_username=result.radius_username,
                ipv4_address=result.ipv4_address,
                vlan_id=result.vlan_id,
                onu_id=result.onu_id,
                cpe_id=result.cpe_id,
                service_id=result.service_id,
                steps_completed=result.steps_completed,
                total_steps=result.total_steps,
                error_message=result.error_message,
                created_at=result.created_at,
                completed_at=result.completed_at,
            )

        except ValueError as e:
            logger.error("Validation error in provisioning", error=str(e))
            raise Exception(f"Validation error: {str(e)}")

        except Exception as e:
            logger.exception("Error provisioning subscriber", error=str(e))
            raise Exception(f"Failed to provision subscriber: {str(e)}")

    @strawberry.mutation(description="Retry a failed workflow")  # type: ignore[misc]
    async def retry_workflow(
        self,
        info: strawberry.Info[Context],
        workflow_id: str,
    ) -> Workflow:
        """
        Retry a failed workflow from the failed step.

        Args:
            workflow_id: Workflow identifier

        Returns:
            Updated Workflow

        Raises:
            Exception: If workflow cannot be retried
        """
        db = info.context.db
        current_user = info.context.current_user

        # Require authentication
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")

        tenant_id = current_user.tenant_id

        try:
            service = OrchestrationService(db=db, tenant_id=tenant_id)
            workflow_response = await service.retry_workflow(workflow_id)

            return Workflow.from_response(workflow_response)

        except ValueError as e:
            logger.error("Cannot retry workflow", workflow_id=workflow_id, error=str(e))
            raise Exception(str(e))

        except Exception as e:
            logger.exception("Error retrying workflow", workflow_id=workflow_id, error=str(e))
            raise Exception(f"Failed to retry workflow: {str(e)}")

    @strawberry.mutation(description="Cancel a running workflow")  # type: ignore[misc]
    async def cancel_workflow(
        self,
        info: strawberry.Info[Context],
        workflow_id: str,
    ) -> Workflow:
        """
        Cancel a running workflow and roll back completed steps.

        Args:
            workflow_id: Workflow identifier

        Returns:
            Updated Workflow

        Raises:
            Exception: If workflow cannot be cancelled
        """
        db = info.context.db
        current_user = info.context.current_user

        # Require authentication
        if not current_user or not current_user.tenant_id:
            raise Exception("Authentication required")

        tenant_id = current_user.tenant_id

        try:
            service = OrchestrationService(db=db, tenant_id=tenant_id)
            workflow_response = await service.cancel_workflow(workflow_id)

            return Workflow.from_response(workflow_response)

        except ValueError as e:
            logger.error("Cannot cancel workflow", workflow_id=workflow_id, error=str(e))
            raise Exception(str(e))

        except Exception as e:
            logger.exception("Error cancelling workflow", workflow_id=workflow_id, error=str(e))
            raise Exception(f"Failed to cancel workflow: {str(e)}")
