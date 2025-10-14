"""
Dunning & Collections API router.

Provides REST endpoints for managing dunning campaigns and executions.
"""

from typing import Any, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.core.rate_limiting import limiter
from dotmac.platform.db import get_async_session
from dotmac.platform.tenant import get_current_tenant_id

from .models import DunningExecutionStatus
from .schemas import (
    DunningActionLogResponse,
    DunningCampaignCreate,
    DunningCampaignResponse,
    DunningCampaignStats,
    DunningCampaignUpdate,
    DunningCancelRequest,
    DunningExecutionResponse,
    DunningExecutionStart,
    DunningStats,
)
from .service import DunningService

router = APIRouter(tags=["Billing - Dunning"])


# Campaign Management


@router.post(
    "/campaigns",
    response_model=DunningCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("20/minute")
async def create_campaign(
    request: Request,
    campaign_data: DunningCampaignCreate,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Create a new dunning campaign.

    A dunning campaign defines automated collection workflows with multiple
    actions (email, SMS, service suspension, etc.) triggered after specific delays.
    """
    service = DunningService(db_session)
    try:
        campaign = await service.create_campaign(
            tenant_id=tenant_id,
            data=campaign_data,
            created_by_user_id=current_user.user_id,
        )
        # Convert SQLAlchemy model to Pydantic schema
        response = DunningCampaignResponse.model_validate(campaign)
        return cast(dict[str, Any], response.model_dump(mode="json"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create campaign: {str(e)}",
        )


@router.get("/campaigns", response_model=list[DunningCampaignResponse])
@limiter.limit("100/minute")
async def list_campaigns(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    active_only: bool = Query(True, description="Show only active campaigns"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
) -> list[dict[str, Any]]:
    """
    List all dunning campaigns for the tenant.

    Returns campaigns ordered by priority (highest first).
    """
    service = DunningService(db_session)
    campaigns = await service.list_campaigns(
        tenant_id=tenant_id,
        active_only=active_only,
        skip=skip,
        limit=limit,
    )
    return [
        cast(dict[str, Any], DunningCampaignResponse.model_validate(c).model_dump(mode="json"))
        for c in campaigns
    ]


@router.get("/campaigns/{campaign_id}", response_model=DunningCampaignResponse)
@limiter.limit("100/minute")
async def get_campaign(
    request: Request,
    campaign_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Get a specific dunning campaign by ID."""
    service = DunningService(db_session)
    campaign = await service.get_campaign(campaign_id=campaign_id, tenant_id=tenant_id)

    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    response = DunningCampaignResponse.model_validate(campaign)
    return cast(dict[str, Any], response.model_dump(mode="json"))


@router.patch("/campaigns/{campaign_id}", response_model=DunningCampaignResponse)
@limiter.limit("20/minute")
async def update_campaign(
    request: Request,
    campaign_id: UUID,
    campaign_data: DunningCampaignUpdate,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Update a dunning campaign.

    Can modify campaign settings, actions, exclusion rules, and active status.
    Changes only affect future executions, not in-progress ones.
    """
    service = DunningService(db_session)
    try:
        campaign = await service.update_campaign(
            campaign_id=campaign_id,
            tenant_id=tenant_id,
            data=campaign_data,
            updated_by_user_id=current_user.user_id,
        )

        if not campaign:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Campaign {campaign_id} not found",
            )

        response = DunningCampaignResponse.model_validate(campaign)
        return cast(dict[str, Any], response.model_dump(mode="json"))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update campaign: {str(e)}",
        )


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def delete_campaign(
    request: Request,
    campaign_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> None:
    """
    Delete a dunning campaign.

    This is a soft delete. The campaign is marked as inactive.
    In-progress executions will be canceled.
    """
    service = DunningService(db_session)
    success = await service.delete_campaign(
        campaign_id=campaign_id,
        tenant_id=tenant_id,
        deleted_by_user_id=current_user.user_id,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )


@router.get("/campaigns/{campaign_id}/stats", response_model=DunningCampaignStats)
@limiter.limit("100/minute")
async def get_campaign_stats(
    request: Request,
    campaign_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Get statistics for a specific campaign.

    Returns execution counts, success rates, recovery amounts, and completion times.
    """
    service = DunningService(db_session)

    # First verify campaign exists and belongs to tenant
    campaign = await service.get_campaign(campaign_id=campaign_id, tenant_id=tenant_id)
    if not campaign:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    stats = await service.get_campaign_stats(campaign_id=campaign_id, tenant_id=tenant_id)
    return cast(dict[str, Any], stats.model_dump(mode="json"))


# Execution Management


@router.post(
    "/executions",
    response_model=DunningExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("50/minute")
async def start_execution(
    request: Request,
    execution_data: DunningExecutionStart,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Start a new dunning execution for a subscription.

    Creates a new execution workflow for an overdue subscription. The execution
    will proceed through all configured campaign actions based on their delays.

    Returns 409 if an active execution already exists for the subscription.
    """
    service = DunningService(db_session)
    try:
        execution = await service.start_execution(
            campaign_id=execution_data.campaign_id,
            tenant_id=tenant_id,
            subscription_id=execution_data.subscription_id,
            customer_id=execution_data.customer_id,
            invoice_id=execution_data.invoice_id,
            outstanding_amount=execution_data.outstanding_amount,
            metadata=execution_data.metadata,
        )
        response = DunningExecutionResponse.model_validate(execution)
        return cast(dict[str, Any], response.model_dump(mode="json"))
    except ValueError as e:
        # Check if it's an "already exists" error
        if "already has an active execution" in str(e):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start execution: {str(e)}",
        )


@router.get("/executions", response_model=list[DunningExecutionResponse])
@limiter.limit("100/minute")
async def list_executions(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    campaign_id: UUID | None = Query(None, description="Filter by campaign ID"),
    subscription_id: str | None = Query(None, description="Filter by subscription ID"),
    customer_id: UUID | None = Query(None, description="Filter by customer ID"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum records to return"),
) -> list[dict[str, Any]]:
    """
    List dunning executions with optional filters.

    Returns executions ordered by creation date (most recent first).
    """
    service = DunningService(db_session)

    # Convert string status to enum if provided
    status_enum: DunningExecutionStatus | None = None
    if status_filter:
        try:
            status_enum = DunningExecutionStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {[s.value for s in DunningExecutionStatus]}",
            )

    executions = await service.list_executions(
        tenant_id=tenant_id,
        campaign_id=campaign_id,
        subscription_id=subscription_id,
        customer_id=customer_id,
        status=status_enum,
        skip=skip,
        limit=limit,
    )

    return [
        cast(dict[str, Any], DunningExecutionResponse.model_validate(e).model_dump(mode="json"))
        for e in executions
    ]


@router.get("/executions/{execution_id}", response_model=DunningExecutionResponse)
@limiter.limit("100/minute")
async def get_execution(
    request: Request,
    execution_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Get a specific dunning execution by ID with full details."""
    service = DunningService(db_session)
    execution = await service.get_execution(execution_id=execution_id, tenant_id=tenant_id)

    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )

    response = DunningExecutionResponse.model_validate(execution)
    return cast(dict[str, Any], response.model_dump(mode="json"))


@router.post("/executions/{execution_id}/cancel", status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
async def cancel_execution(
    request: Request,
    execution_id: UUID,
    cancel_data: DunningCancelRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> JSONResponse:
    """
    Cancel an active dunning execution.

    Stops all pending actions for the execution. Already executed actions
    are not reversed (e.g., sent emails cannot be unsent).

    Returns 400 if execution is already completed or canceled.
    """
    service = DunningService(db_session)
    try:
        success = await service.cancel_execution(
            execution_id=execution_id,
            tenant_id=tenant_id,
            reason=cancel_data.reason,
            canceled_by_user_id=current_user.user_id,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found",
            )

        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "message": "Execution canceled successfully",
                "execution_id": str(execution_id),
                "reason": cancel_data.reason,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel execution: {str(e)}",
        )


@router.get("/executions/{execution_id}/logs", response_model=list[DunningActionLogResponse])
@limiter.limit("100/minute")
async def get_execution_logs(
    request: Request,
    execution_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> list[dict[str, Any]]:
    """
    Get action logs for a specific execution.

    Returns detailed audit trail of all actions attempted/executed
    in the dunning workflow.
    """
    service = DunningService(db_session)

    # First verify execution exists and belongs to tenant
    execution = await service.get_execution(execution_id=execution_id, tenant_id=tenant_id)
    if not execution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )

    logs = await service.get_execution_logs(execution_id=execution_id, tenant_id=tenant_id)
    return [
        cast(dict[str, Any], DunningActionLogResponse.model_validate(log).model_dump(mode="json"))
        for log in logs
    ]


# Statistics & Monitoring


@router.get("/stats", response_model=DunningStats)
@limiter.limit("100/minute")
async def get_tenant_stats(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Get overall dunning statistics for the tenant.

    Returns aggregate metrics across all campaigns and executions including
    recovery rates, success rates, and outstanding amounts.
    """
    service = DunningService(db_session)
    stats = await service.get_tenant_stats(tenant_id=tenant_id)
    return cast(dict[str, Any], stats.model_dump(mode="json"))


# Background Processing (for Celery integration)


@router.get("/pending-actions", response_model=list[DunningExecutionResponse])
@limiter.limit("10/minute")
async def get_pending_actions(
    request: Request,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
    limit: int = Query(100, ge=1, le=1000, description="Maximum executions to return"),
) -> list[dict[str, Any]]:
    """
    Get executions with pending actions ready to process.

    This endpoint is designed for background task processors (Celery) to poll
    for executions that have actions ready to execute based on their delay times.

    Returns executions where next_action_at is in the past.
    """
    service = DunningService(db_session)
    executions = await service.get_pending_actions(tenant_id=tenant_id, limit=limit)
    return [
        cast(dict[str, Any], DunningExecutionResponse.model_validate(e).model_dump(mode="json"))
        for e in executions
    ]
