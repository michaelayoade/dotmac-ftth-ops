"""
Orchestration API Router.

Provides REST API endpoints for service lifecycle management and provisioning workflows.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.core.exceptions import NotFoundError, ValidationError
from dotmac.platform.database import get_async_session as get_db
from dotmac.platform.services.orchestration import OrchestrationService
from dotmac.platform.services.tasks import (
    convert_lead_to_customer_async,
    deprovision_subscriber_async,
    provision_subscriber_async,
)

router = APIRouter(prefix="/orchestration", tags=["Orchestration"])


def _require_tenant_id(current_user: UserInfo) -> str:
    """Ensure operations have a tenant context."""
    tenant_id = current_user.tenant_id
    if tenant_id is None:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Tenant context is required to perform orchestration operations.",
        )
    return tenant_id


# Request/Response Schemas
class ConvertLeadRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to convert lead to customer."""

    model_config = ConfigDict()

    lead_id: UUID
    accepted_quote_id: UUID


class ConvertLeadResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for lead conversion."""

    model_config = ConfigDict()

    customer_id: UUID
    lead_id: UUID
    quote_id: UUID
    conversion_date: str


class ProvisionSubscriberRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to provision a new subscriber."""

    model_config = ConfigDict()

    customer_id: UUID
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8)
    service_plan: str
    download_speed_kbps: int = Field(..., gt=0)
    upload_speed_kbps: int = Field(..., gt=0)
    onu_serial: str | None = None
    cpe_mac_address: str | None = None
    site_id: str | None = None


class ProvisionSubscriberResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for subscriber provisioning."""

    model_config = ConfigDict()

    subscriber_id: str
    customer_id: UUID
    username: str
    status: str
    ip_address: str | None = None
    provisioning_date: str


class DeprovisionSubscriberRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to deprovision a subscriber."""

    model_config = ConfigDict()

    reason: str = Field(..., min_length=1)


class DeprovisionSubscriberResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for subscriber deprovisioning."""

    model_config = ConfigDict()

    subscriber_id: str
    status: str
    deprovisioning_date: str


class SuspendSubscriberRequest(BaseModel):  # BaseModel resolves to Any in isolation
    """Request to suspend a subscriber."""

    model_config = ConfigDict()

    reason: str = Field(..., min_length=1)


class SuspendSubscriberResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response for subscriber suspension."""

    model_config = ConfigDict()

    subscriber_id: str
    status: str
    suspension_date: str


# Endpoints
@router.post("/leads/convert", response_model=ConvertLeadResponse)
async def convert_lead_to_customer(
    request: ConvertLeadRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Convert an accepted lead to a customer.

    This endpoint handles the complete workflow:
    1. Verifies lead and accepted quote exist
    2. Creates customer record from lead data
    3. Updates lead status to WON
    4. Links customer to quote for billing setup
    """
    service = OrchestrationService(db)
    tenant_id = _require_tenant_id(current_user)

    try:
        result = await service.convert_lead_to_customer(
            tenant_id=tenant_id,
            lead_id=request.lead_id,
            accepted_quote_id=request.accepted_quote_id,
            user_id=UUID(current_user.user_id),
        )
        await db.commit()

        return ConvertLeadResponse(
            customer_id=result["customer"].id,
            lead_id=result["lead"].id,
            quote_id=result["quote"].id,
            conversion_date=result["conversion_date"].isoformat(),
        )
    except (NotFoundError, ValidationError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
                if isinstance(e, ValidationError)
                else status.HTTP_404_NOT_FOUND
            ),
            detail=str(e),
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/leads/convert/async", status_code=status.HTTP_202_ACCEPTED)
async def convert_lead_to_customer_background(
    request: ConvertLeadRequest,
    background_tasks: BackgroundTasks,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, str]:
    """
    Convert lead to customer asynchronously (background task).

    Returns immediately with task ID for status tracking.
    """
    tenant_id = _require_tenant_id(current_user)
    task = convert_lead_to_customer_async.delay(
        tenant_id=tenant_id,
        lead_id=str(request.lead_id),
        accepted_quote_id=str(request.accepted_quote_id),
        user_id=current_user.user_id,
    )

    return {"task_id": task.id, "status": "processing", "message": "Lead conversion started"}


@router.post(
    "/subscribers/provision",
    response_model=ProvisionSubscriberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def provision_subscriber(
    request: ProvisionSubscriberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Provision a new subscriber across all systems.

    This endpoint orchestrates:
    1. Subscriber record creation
    2. IP address allocation from NetBox
    3. RADIUS authentication setup
    4. ONU provisioning in VOLTHA (if provided)
    5. CPE provisioning in GenieACS (if provided)
    6. Service activation

    This is a synchronous operation that may take 10-30 seconds.
    For background processing, use /subscribers/provision/async instead.
    """
    service = OrchestrationService(db)
    tenant_id = _require_tenant_id(current_user)

    try:
        result = await service.provision_subscriber(
            tenant_id=tenant_id,
            customer_id=request.customer_id,
            username=request.username,
            password=request.password,
            service_plan=request.service_plan,
            download_speed_kbps=request.download_speed_kbps,
            upload_speed_kbps=request.upload_speed_kbps,
            onu_serial=request.onu_serial,
            cpe_mac_address=request.cpe_mac_address,
            site_id=request.site_id,
            user_id=UUID(current_user.user_id),
        )
        await db.commit()

        return ProvisionSubscriberResponse(
            subscriber_id=result["subscriber"].id,
            customer_id=result["customer"].id,
            username=result["subscriber"].username,
            status=result["subscriber"].status.value,
            ip_address=(
                result["ip_allocation"].get("address") if result.get("ip_allocation") else None
            ),
            provisioning_date=result["provisioning_date"].isoformat(),
        )
    except (NotFoundError, ValidationError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
                if isinstance(e, ValidationError)
                else status.HTTP_404_NOT_FOUND
            ),
            detail=str(e),
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/subscribers/provision/async", status_code=status.HTTP_202_ACCEPTED)
async def provision_subscriber_background(
    request: ProvisionSubscriberRequest,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, str]:
    """
    Provision subscriber asynchronously (background task).

    Returns immediately with task ID. Use /tasks/{task_id} to check status.
    Recommended for production use to avoid timeout issues.
    """
    tenant_id = _require_tenant_id(current_user)
    task = provision_subscriber_async.delay(
        tenant_id=tenant_id,
        customer_id=str(request.customer_id),
        username=request.username,
        password=request.password,
        service_plan=request.service_plan,
        download_speed_kbps=request.download_speed_kbps,
        upload_speed_kbps=request.upload_speed_kbps,
        onu_serial=request.onu_serial,
        cpe_mac_address=request.cpe_mac_address,
        site_id=request.site_id,
        user_id=current_user.user_id,
    )

    return {
        "task_id": task.id,
        "status": "processing",
        "message": "Subscriber provisioning started",
    }


@router.post(
    "/subscribers/{subscriber_id}/deprovision", response_model=DeprovisionSubscriberResponse
)
async def deprovision_subscriber(
    subscriber_id: str,
    request: DeprovisionSubscriberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Deprovision a subscriber across all systems.

    This endpoint handles:
    1. RADIUS session termination
    2. CPE removal from GenieACS
    3. ONU removal from VOLTHA
    4. IP address release in NetBox
    5. RADIUS authentication removal
    6. Subscriber termination

    This is a synchronous operation that may take 10-30 seconds.
    """
    service = OrchestrationService(db)
    tenant_id = _require_tenant_id(current_user)

    try:
        result = await service.deprovision_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason=request.reason,
            user_id=UUID(current_user.user_id),
        )
        await db.commit()

        return DeprovisionSubscriberResponse(
            subscriber_id=result["subscriber"].id,
            status=result["subscriber"].status.value,
            deprovisioning_date=result["deprovisioning_date"].isoformat(),
        )
    except NotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/subscribers/{subscriber_id}/deprovision/async", status_code=status.HTTP_202_ACCEPTED)
async def deprovision_subscriber_background(
    subscriber_id: str,
    request: DeprovisionSubscriberRequest,
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, str]:
    """
    Deprovision subscriber asynchronously (background task).

    Returns immediately with task ID.
    """
    tenant_id = _require_tenant_id(current_user)
    task = deprovision_subscriber_async.delay(
        tenant_id=tenant_id,
        subscriber_id=subscriber_id,
        reason=request.reason,
        user_id=current_user.user_id,
    )

    return {
        "task_id": task.id,
        "status": "processing",
        "message": "Subscriber deprovisioning started",
    }


@router.post("/subscribers/{subscriber_id}/suspend", response_model=SuspendSubscriberResponse)
async def suspend_subscriber(
    subscriber_id: str,
    request: SuspendSubscriberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Suspend a subscriber temporarily.

    This endpoint:
    1. Disconnects active sessions
    2. Updates RADIUS to deny authentication
    3. Marks subscriber as suspended
    """
    service = OrchestrationService(db)
    tenant_id = _require_tenant_id(current_user)

    try:
        result = await service.suspend_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            reason=request.reason,
            user_id=UUID(current_user.user_id),
        )
        await db.commit()

        return SuspendSubscriberResponse(
            subscriber_id=result["subscriber"].id,
            status=result["subscriber"].status.value,
            suspension_date=result["suspension_date"].isoformat(),
        )
    except NotFoundError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/subscribers/{subscriber_id}/reactivate", response_model=SuspendSubscriberResponse)
async def reactivate_subscriber(
    subscriber_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> Any:
    """
    Reactivate a suspended subscriber.

    This endpoint:
    1. Restores RADIUS authentication
    2. Marks subscriber as active
    3. Clears suspension metadata
    """
    service = OrchestrationService(db)
    tenant_id = _require_tenant_id(current_user)

    try:
        result = await service.reactivate_subscriber(
            tenant_id=tenant_id,
            subscriber_id=subscriber_id,
            user_id=UUID(current_user.user_id),
        )
        await db.commit()

        return SuspendSubscriberResponse(
            subscriber_id=result["subscriber"].id,
            status=result["subscriber"].status.value,
            suspension_date=result["reactivation_date"].isoformat(),
        )
    except (NotFoundError, ValidationError) as e:
        await db.rollback()
        raise HTTPException(
            status_code=(
                status.HTTP_400_BAD_REQUEST
                if isinstance(e, ValidationError)
                else status.HTTP_404_NOT_FOUND
            ),
            detail=str(e),
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))
