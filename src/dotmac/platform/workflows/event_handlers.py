"""
Workflow Event Handlers

Event listeners that trigger workflows based on domain events.
"""

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from .service import WorkflowService

logger = logging.getLogger(__name__)


class WorkflowEventHandler:
    """
    Handles domain events and triggers appropriate workflows.
    """

    def __init__(self, db_session: AsyncSession, service_registry: Any = None):
        self.db = db_session
        self.workflow_service = WorkflowService(db_session, service_registry=service_registry)

    async def handle_quote_accepted(self, event: Any) -> None:
        """
        Handle quote.accepted event by triggering quote-to-order workflow.

        Event payload expected:
        {
            "quote_id": int,
            "customer_id": int,
            "tenant_id": str,
            "total_amount": float,
            "payment_type": str,  # "prepaid" or "postpaid"
            "payment_method": str,
            "priority": str,  # "high", "medium", "low"
            "deployment_date": str (ISO format),
            "accepted_by": int (user_id)
        }
        """
        logger.info(f"Handling quote.accepted event: {event.event_id}")

        try:
            # Extract event data
            payload = event.payload
            context = {
                "quote_id": payload.get("quote_id"),
                "customer_id": payload.get("customer_id"),
                "tenant_id": payload.get("tenant_id"),
                "total_amount": payload.get("total_amount"),
                "payment_type": payload.get("payment_type", "postpaid"),
                "payment_method": payload.get("payment_method", "invoice"),
                "priority": payload.get("priority", "medium"),
                "deployment_date": payload.get("deployment_date"),
                "accepted_by": payload.get("accepted_by"),
            }

            # Execute the quote-to-order workflow
            execution = await self.workflow_service.execute_workflow(
                workflow_name="quote_accepted_to_order",
                context=context,
                trigger_type="event",
                trigger_source=event.event_type,
                tenant_id=context.get("tenant_id"),
            )

            logger.info(
                f"Quote-to-order workflow started: execution_id={execution.id}, "
                f"quote_id={context['quote_id']}"
            )

        except Exception as e:
            logger.error(f"Failed to handle quote.accepted event: {e}", exc_info=True)
            raise

    async def handle_lead_qualified(self, event: Any) -> None:
        """
        Handle lead.qualified event by triggering lead-to-customer workflow.

        Event payload expected:
        {
            "lead_id": int,
            "customer_email": str,
            "customer_name": str,
            "tenant_id": str,
            "plan_id": int,
            "license_template_id": int,
            "deployment_type": str  # "kubernetes", "docker", "aws", etc.
        }
        """
        logger.info(f"Handling lead.qualified event: {event.event_id}")

        try:
            payload = event.payload
            context = {
                "lead_id": payload.get("lead_id"),
                "tenant_id": payload.get("tenant_id"),
                "plan_id": payload.get("plan_id"),
                "license_template_id": payload.get("license_template_id"),
                "deployment_type": payload.get("deployment_type", "kubernetes"),
                "customer_email": payload.get("customer_email"),
                "customer_name": payload.get("customer_name"),
            }

            # Execute the lead-to-customer workflow
            execution = await self.workflow_service.execute_workflow(
                workflow_name="lead_to_customer_onboarding",
                context=context,
                trigger_type="event",
                trigger_source=event.event_type,
                tenant_id=context.get("tenant_id"),
            )

            logger.info(
                f"Lead-to-customer workflow started: execution_id={execution.id}, "
                f"lead_id={context['lead_id']}"
            )

        except Exception as e:
            logger.error(f"Failed to handle lead.qualified event: {e}", exc_info=True)
            raise

    async def handle_partner_customer_created(self, event: Any) -> None:
        """
        Handle partner.customer.created event for partner provisioning.

        Event payload expected:
        {
            "partner_id": int,
            "customer_data": dict,
            "license_count": int,
            "white_label_config": dict,
            "commission_amount": float,
            "partner_email": str
        }
        """
        logger.info(f"Handling partner.customer.created event: {event.event_id}")

        try:
            payload = event.payload
            context = payload.copy()

            # Execute the partner provisioning workflow
            execution = await self.workflow_service.execute_workflow(
                workflow_name="partner_customer_provisioning",
                context=context,
                trigger_type="event",
                trigger_source=event.event_type,
                tenant_id=payload.get("tenant_id"),
            )

            logger.info(
                f"Partner provisioning workflow started: execution_id={execution.id}, "
                f"partner_id={context['partner_id']}"
            )

        except Exception as e:
            logger.error(f"Failed to handle partner.customer.created event: {e}", exc_info=True)
            raise

    async def handle_subscription_expiring(self, event: Any) -> None:
        """
        Handle subscription.expiring event to trigger renewal workflow.

        Event payload expected:
        {
            "customer_id": int,
            "subscription_id": int,
            "customer_email": str,
            "renewal_term": int,  # months
            "expiry_date": str (ISO format),
            "tenant_id": str
        }
        """
        logger.info(f"Handling subscription.expiring event: {event.event_id}")

        try:
            payload = event.payload
            context = payload.copy()

            # Execute the renewal workflow
            execution = await self.workflow_service.execute_workflow(
                workflow_name="customer_renewal_process",
                context=context,
                trigger_type="event",
                trigger_source=event.event_type,
                tenant_id=payload.get("tenant_id"),
            )

            logger.info(
                f"Renewal workflow started: execution_id={execution.id}, "
                f"subscription_id={context['subscription_id']}"
            )

        except Exception as e:
            logger.error(f"Failed to handle subscription.expiring event: {e}", exc_info=True)
            raise

    async def handle_isp_installation_scheduled(self, event: Any) -> None:
        """
        Handle isp.installation.scheduled event for ISP deployment.

        Event payload expected:
        {
            "customer_id": int,
            "service_location": dict,
            "bandwidth_plan": str,
            "installation_address": str,
            "technician_id": int,
            "installation_date": str,
            "cpe_serial": str,
            "config_template": str,
            "customer_email": str,
            "tenant_id": str
        }
        """
        logger.info(f"Handling isp.installation.scheduled event: {event.event_id}")

        try:
            payload = event.payload
            context = payload.copy()

            # Execute the ISP deployment workflow
            execution = await self.workflow_service.execute_workflow(
                workflow_name="isp_ticket_to_deployment",
                context=context,
                trigger_type="event",
                trigger_source=event.event_type,
                tenant_id=payload.get("tenant_id"),
            )

            logger.info(
                f"ISP deployment workflow started: execution_id={execution.id}, "
                f"customer_id={context['customer_id']}"
            )

        except Exception as e:
            logger.error(f"Failed to handle isp.installation.scheduled event: {e}", exc_info=True)
            raise

    async def handle_workflow_completed(self, event: Any) -> None:
        """
        Handle workflow.execution.completed event for logging and notifications.

        This is a meta-handler that processes workflow completion events.
        """
        logger.info(f"Workflow execution completed: {event.payload.get('execution_id')}")
        # Future: Send notifications, update dashboards, trigger dependent workflows

    async def handle_workflow_failed(self, event: Any) -> None:
        """
        Handle workflow.execution.failed event for error handling.

        This is a meta-handler that processes workflow failure events.
        """
        logger.error(
            f"Workflow execution failed: {event.payload.get('execution_id')}, "
            f"error: {event.payload.get('error')}"
        )
        # Future: Send alerts, create support tickets, retry logic


# Event handler registration mapping
EVENT_HANDLER_MAP = {
    "quote.accepted": "handle_quote_accepted",
    "lead.qualified": "handle_lead_qualified",
    "partner.customer.created": "handle_partner_customer_created",
    "subscription.expiring": "handle_subscription_expiring",
    "isp.installation.scheduled": "handle_isp_installation_scheduled",
    "workflow.execution.completed": "handle_workflow_completed",
    "workflow.execution.failed": "handle_workflow_failed",
}


async def register_workflow_event_handlers(
    db_session: AsyncSession, event_bus: Any, service_registry: Any = None
) -> None:
    """
    Register all workflow event handlers with the event bus.

    Args:
        db_session: Database session for workflow operations
        event_bus: Event bus instance to register handlers with
        service_registry: Service registry for workflow execution
    """
    handler = WorkflowEventHandler(db_session, service_registry)

    for event_type, method_name in EVENT_HANDLER_MAP.items():
        method = getattr(handler, method_name)
        event_bus.subscribe(event_type, method)
        logger.info(f"Registered workflow handler for event: {event_type}")

    logger.info(f"Registered {len(EVENT_HANDLER_MAP)} workflow event handlers")
