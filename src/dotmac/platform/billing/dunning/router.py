"""
Dunning & Collections API router.

Provides REST endpoints for managing dunning campaigns and executions.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing._typing_helpers import rate_limit
from dotmac.platform.core.exceptions import EntityNotFoundError
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

router = APIRouter(prefix="/billing/dunning", tags=["Billing - Dunning"])


# Campaign Management


@router.post(
    "/campaigns",
    response_model=DunningCampaignResponse,
    status_code=status.HTTP_201_CREATED,
)
@rate_limit("20/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def create_campaign(
    request: Request,
    campaign_payload: dict[str, Any],
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Create a new dunning campaign.

    A dunning campaign defines automated collection workflows with multiple
    actions (email, SMS, service suspension, etc.) triggered after specific delays.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    try:
        campaign_data = DunningCampaignCreate.model_validate(campaign_payload)
    except ValidationError as exc:
        errors = exc.errors()
        actions_errors = [err for err in errors if err.get("loc", [])[0] == "actions"]
        if actions_errors and len(errors) == len(actions_errors):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Campaign must have at least one action",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=errors
        ) from exc

    service = DunningService(db_session)
    try:
        campaign = await service.create_campaign(
            tenant_id=tenant_id,
            data=campaign_data,
            created_by_user_id=current_user.user_id,
        )
        # Convert SQLAlchemy model to Pydantic schema
        response = DunningCampaignResponse.model_validate(campaign)
        return response.model_dump(mode="json")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create campaign: {str(e)}",
        )


@router.get("/campaigns", response_model=list[DunningCampaignResponse])
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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
        is_active=True if active_only else None,
        skip=skip,
        limit=limit,
    )
    return [DunningCampaignResponse.model_validate(c).model_dump(mode="json") for c in campaigns]


@router.get("/campaigns/{campaign_id}", response_model=DunningCampaignResponse)
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def get_campaign(
    request: Request,
    campaign_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Get a specific dunning campaign by ID."""
    service = DunningService(db_session)
    try:
        campaign = await service.get_campaign(campaign_id=campaign_id, tenant_id=tenant_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )

    response = DunningCampaignResponse.model_validate(campaign)
    return response.model_dump(mode="json")


@router.patch("/campaigns/{campaign_id}", response_model=DunningCampaignResponse)
@rate_limit("20/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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

        response = DunningCampaignResponse.model_validate(campaign)
        return response.model_dump(mode="json")
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update campaign: {str(e)}",
        )


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
@rate_limit("10/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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
    try:
        success = await service.delete_campaign(
            campaign_id=campaign_id,
            tenant_id=tenant_id,
            deleted_by_user_id=current_user.user_id,
        )
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Campaign {campaign_id} not found",
        )


@router.get("/campaigns/{campaign_id}/stats", response_model=DunningCampaignStats)
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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

    try:
        stats = await service.get_campaign_stats(campaign_id=campaign_id, tenant_id=tenant_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return stats.model_dump(mode="json")  # type: ignore[no-any-return]


# Execution Management


@router.post(
    "/executions",
    response_model=DunningExecutionResponse,
    status_code=status.HTTP_201_CREATED,
)
@rate_limit("50/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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

    Returns 400 if an active execution already exists for the subscription.
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
        return response.model_dump(mode="json")
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start execution: {str(e)}",
        )


@router.get("/executions", response_model=list[DunningExecutionResponse])
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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

    return [DunningExecutionResponse.model_validate(e).model_dump(mode="json") for e in executions]


@router.get("/executions/{execution_id}", response_model=DunningExecutionResponse)
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def get_execution(
    request: Request,
    execution_id: UUID,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """Get a specific dunning execution by ID with full details."""
    service = DunningService(db_session)
    try:
        execution = await service.get_execution(execution_id=execution_id, tenant_id=tenant_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    if execution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution {execution_id} not found",
        )

    response = DunningExecutionResponse.model_validate(execution)
    return response.model_dump(mode="json")


@router.post(
    "/executions/{execution_id}/cancel",
    response_model=DunningExecutionResponse,
    status_code=status.HTTP_200_OK,
)
@rate_limit("20/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
async def cancel_execution(
    request: Request,
    execution_id: UUID,
    cancel_data: DunningCancelRequest,
    db_session: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
    tenant_id: str = Depends(get_current_tenant_id),
) -> dict[str, Any]:
    """
    Cancel an active dunning execution.

    Stops all pending actions for the execution. Already executed actions
    are not reversed (e.g., sent emails cannot be unsent).

    Returns 400 if execution is already completed or canceled.
    """
    service = DunningService(db_session)
    try:
        try:
            canceled_by_uuid = UUID(str(current_user.user_id)) if current_user.user_id else None
        except (ValueError, TypeError):
            canceled_by_uuid = None

        success = await service.cancel_execution(
            execution_id=execution_id,
            tenant_id=tenant_id,
            reason=cancel_data.reason,
            canceled_by_user_id=canceled_by_uuid,
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found",
            )

        execution = await service.get_execution(execution_id=execution_id, tenant_id=tenant_id)
        if execution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found",
            )
        response = DunningExecutionResponse.model_validate(execution)
        return response.model_dump(mode="json")
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel execution: {str(e)}",
        )


@router.get("/executions/{execution_id}/logs", response_model=list[DunningActionLogResponse])
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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
    try:
        execution = await service.get_execution(execution_id=execution_id, tenant_id=tenant_id)
        if execution is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Execution {execution_id} not found",
            )
        logs = await service.get_execution_logs(execution_id=execution_id, tenant_id=tenant_id)
    except EntityNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [DunningActionLogResponse.model_validate(log).model_dump(mode="json") for log in logs]


# Statistics & Monitoring


@router.get("/stats", response_model=DunningStats)
@rate_limit("100/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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
    return stats.model_dump(mode="json")  # type: ignore[no-any-return]


# Background Processing (for Celery integration)


@router.get("/pending-actions", response_model=list[DunningExecutionResponse])
@rate_limit("10/minute")  # type: ignore[misc]  # Rate limit decorator is untyped
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
    return [DunningExecutionResponse.model_validate(e).model_dump(mode="json") for e in executions]
