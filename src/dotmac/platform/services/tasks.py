"""
Orchestration Celery Tasks.

Background tasks for async subscriber provisioning and lifecycle management.
"""

from typing import Any
from uuid import UUID

import structlog
from celery import shared_task

from dotmac.platform.core.database import get_async_session
from dotmac.platform.services.orchestration import OrchestrationService

logger = structlog.get_logger(__name__)


@shared_task(bind=True, max_retries=3)
def provision_subscriber_async(
    self: Any,
    tenant_id: str,
    customer_id: str,
    username: str,
    password: str,
    service_plan: str,
    download_speed_kbps: int,
    upload_speed_kbps: int,
    onu_serial: str | None = None,
    cpe_mac_address: str | None = None,
    site_id: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Asynchronously provision a subscriber across all systems.

    This is a Celery task wrapper around OrchestrationService.provision_subscriber.

    Args:
        self: Celery task instance
        tenant_id: Tenant identifier
        customer_id: Customer UUID as string
        username: RADIUS username
        password: RADIUS password
        service_plan: Service plan name
        download_speed_kbps: Download bandwidth
        upload_speed_kbps: Upload bandwidth
        onu_serial: ONU serial (optional)
        cpe_mac_address: CPE MAC (optional)
        site_id: Site ID (optional)
        user_id: User ID as string (optional)

    Returns:
        Provisioning result dictionary
    """
    logger.info(
        "Starting async subscriber provisioning",
        task_id=self.request.id,
        tenant_id=tenant_id,
        username=username,
    )

    try:
        # Create async session
        import asyncio

        async def _provision() -> dict[str, Any]:
            async for session in get_async_session():
                service = OrchestrationService(session)
                result = await service.provision_subscriber(
                    tenant_id=tenant_id,
                    customer_id=UUID(customer_id),
                    username=username,
                    password=password,
                    service_plan=service_plan,
                    download_speed_kbps=download_speed_kbps,
                    upload_speed_kbps=upload_speed_kbps,
                    onu_serial=onu_serial,
                    cpe_mac_address=cpe_mac_address,
                    site_id=site_id,
                    user_id=UUID(user_id) if user_id else None,
                )
                # Convert non-serializable objects to dicts
                return {
                    "subscriber_id": result["subscriber"].id,
                    "customer_id": str(result["customer"].id),
                    "ip_allocation": result.get("ip_allocation"),
                    "voltha_status": result.get("voltha_status"),
                    "genieacs_status": result.get("genieacs_status"),
                    "provisioning_date": result["provisioning_date"].isoformat(),
                }
            # This should never be reached, but mypy needs it
            raise RuntimeError("Failed to get database session")

        result = asyncio.run(_provision())

        logger.info(
            "Async subscriber provisioning completed",
            task_id=self.request.id,
            subscriber_id=result["subscriber_id"],
        )

        return result

    except Exception as e:
        logger.error(
            "Async subscriber provisioning failed",
            task_id=self.request.id,
            error=str(e),
            retry=self.request.retries,
        )
        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


@shared_task(bind=True, max_retries=3)
def deprovision_subscriber_async(
    self: Any,
    tenant_id: str,
    subscriber_id: str,
    reason: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Asynchronously deprovision a subscriber.

    Args:
        self: Celery task instance
        tenant_id: Tenant identifier
        subscriber_id: Subscriber ID
        reason: Deprovisioning reason
        user_id: User ID as string (optional)

    Returns:
        Deprovisioning result dictionary
    """
    logger.info(
        "Starting async subscriber deprovisioning",
        task_id=self.request.id,
        tenant_id=tenant_id,
        subscriber_id=subscriber_id,
    )

    try:
        import asyncio

        async def _deprovision() -> dict[str, Any]:
            async for session in get_async_session():
                service = OrchestrationService(session)
                result = await service.deprovision_subscriber(
                    tenant_id=tenant_id,
                    subscriber_id=subscriber_id,
                    reason=reason,
                    user_id=UUID(user_id) if user_id else None,
                )
                return {
                    "subscriber_id": result["subscriber"].id,
                    "session_termination": result.get("session_termination"),
                    "cpe_removal": result.get("cpe_removal"),
                    "onu_removal": result.get("onu_removal"),
                    "ip_release": result.get("ip_release"),
                    "deprovisioning_date": result["deprovisioning_date"].isoformat(),
                }
            raise RuntimeError("Failed to get database session")

        result = asyncio.run(_deprovision())

        logger.info(
            "Async subscriber deprovisioning completed",
            task_id=self.request.id,
            subscriber_id=subscriber_id,
        )

        return result

    except Exception as e:
        logger.error(
            "Async subscriber deprovisioning failed",
            task_id=self.request.id,
            error=str(e),
            retry=self.request.retries,
        )
        raise self.retry(exc=e, countdown=60 * (2**self.request.retries))


@shared_task(bind=True)
def convert_lead_to_customer_async(
    self: Any,
    tenant_id: str,
    lead_id: str,
    accepted_quote_id: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Asynchronously convert lead to customer.

    Args:
        self: Celery task instance
        tenant_id: Tenant identifier
        lead_id: Lead UUID as string
        accepted_quote_id: Quote UUID as string
        user_id: User ID as string (optional)

    Returns:
        Conversion result dictionary
    """
    logger.info(
        "Starting async lead conversion",
        task_id=self.request.id,
        tenant_id=tenant_id,
        lead_id=lead_id,
    )

    try:
        import asyncio

        async def _convert() -> dict[str, Any]:
            async for session in get_async_session():
                service = OrchestrationService(session)
                result = await service.convert_lead_to_customer(
                    tenant_id=tenant_id,
                    lead_id=UUID(lead_id),
                    accepted_quote_id=UUID(accepted_quote_id),
                    user_id=UUID(user_id) if user_id else None,
                )
                return {
                    "customer_id": str(result["customer"].id),
                    "lead_id": str(result["lead"].id),
                    "quote_id": str(result["quote"].id),
                    "conversion_date": result["conversion_date"].isoformat(),
                }
            raise RuntimeError("Failed to get database session")

        result = asyncio.run(_convert())

        logger.info(
            "Async lead conversion completed",
            task_id=self.request.id,
            customer_id=result["customer_id"],
        )

        return result

    except Exception as e:
        logger.error(
            "Async lead conversion failed", task_id=self.request.id, error=str(e)
        )
        raise
