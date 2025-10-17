"""
Billing reconciliation and recovery router.

Provides endpoints for finance teams to manage payment reconciliation,
view recovery status, and approve reconciliation sessions.
"""

from datetime import datetime
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.rbac_dependencies import require_permission
from dotmac.platform.billing.reconciliation_schemas import (
    PaymentRetryRequest,
    PaymentRetryResponse,
    ReconcilePaymentRequest,
    ReconciliationApprove,
    ReconciliationComplete,
    ReconciliationListResponse,
    ReconciliationResponse,
    ReconciliationStart,
    ReconciliationSummary,
)
from dotmac.platform.billing.reconciliation_service import ReconciliationService
from dotmac.platform.db import get_async_session

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/reconciliations")


def get_reconciliation_service(
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> ReconciliationService:
    """Dependency to get ReconciliationService instance."""
    return ReconciliationService(db)


# ==================== Reconciliation Session Endpoints ====================


@router.post("", response_model=ReconciliationResponse, status_code=status.HTTP_201_CREATED)
async def start_reconciliation(
    reconciliation_data: ReconciliationStart,
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.create"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> ReconciliationResponse:
    """
    Start a new reconciliation session.

    Requires: billing.reconciliation.create permission
    """
    try:
        reconciliation = await service.start_reconciliation_session(
            tenant_id=current_user.tenant_id,
            bank_account_id=reconciliation_data.bank_account_id,
            period_start=reconciliation_data.period_start,
            period_end=reconciliation_data.period_end,
            opening_balance=reconciliation_data.opening_balance,
            statement_balance=reconciliation_data.statement_balance,
            user_id=current_user.user_id,
            statement_file_url=reconciliation_data.statement_file_url,
        )
        return ReconciliationResponse.model_validate(reconciliation)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to start reconciliation", error=str(e), tenant_id=current_user.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to start reconciliation",
        )


@router.get("", response_model=ReconciliationListResponse)
async def list_reconciliations(
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.read"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
    bank_account_id: int | None = Query(None, description="Filter by bank account"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    start_date: datetime | None = Query(None, description="Filter by start date"),
    end_date: datetime | None = Query(None, description="Filter by end date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> ReconciliationListResponse:
    """
    List reconciliation sessions with filtering and pagination.

    Requires: billing.reconciliation.read permission
    """
    try:
        result = await service.list_reconciliations(
            tenant_id=current_user.tenant_id,
            bank_account_id=bank_account_id,
            status=status_filter,
            start_date=start_date,
            end_date=end_date,
            page=page,
            page_size=page_size,
        )

        return ReconciliationListResponse(
            reconciliations=[
                ReconciliationResponse.model_validate(r) for r in result["reconciliations"]
            ],
            total=result["total"],
            page=result["page"],
            page_size=result["page_size"],
            pages=result["pages"],
        )
    except Exception as e:
        logger.error(
            "Failed to list reconciliations", error=str(e), tenant_id=current_user.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list reconciliations",
        )


@router.get("/summary", response_model=ReconciliationSummary)
async def get_reconciliation_summary(
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.read"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
    bank_account_id: int | None = Query(None, description="Filter by bank account"),
    days: int = Query(30, ge=1, le=365, description="Number of days to include"),
) -> ReconciliationSummary:
    """
    Get reconciliation summary statistics.

    Requires: billing.reconciliation.read permission
    """
    try:
        summary = await service.get_reconciliation_summary(
            tenant_id=current_user.tenant_id, bank_account_id=bank_account_id, days=days
        )
        return ReconciliationSummary(**summary)
    except Exception as e:
        logger.error(
            "Failed to get reconciliation summary", error=str(e), tenant_id=current_user.tenant_id
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reconciliation summary",
        )


@router.get("/{reconciliation_id}", response_model=ReconciliationResponse)
async def get_reconciliation(
    reconciliation_id: int,
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.read"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> ReconciliationResponse:
    """
    Get a specific reconciliation session.

    Requires: billing.reconciliation.read permission
    """
    try:
        reconciliation = await service._get_reconciliation(
            tenant_id=current_user.tenant_id, reconciliation_id=reconciliation_id
        )
        return ReconciliationResponse.model_validate(reconciliation)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to get reconciliation",
            error=str(e),
            reconciliation_id=reconciliation_id,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get reconciliation",
        )


# ==================== Reconciliation Operations ====================


@router.post("/{reconciliation_id}/payments", response_model=ReconciliationResponse)
async def add_reconciled_payment(
    reconciliation_id: int,
    payment_data: ReconcilePaymentRequest,
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.update"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> ReconciliationResponse:
    """
    Add a payment to reconciliation session.

    Requires: billing.reconciliation.update permission
    """
    try:
        reconciliation = await service.add_reconciled_payment(
            tenant_id=current_user.tenant_id,
            reconciliation_id=reconciliation_id,
            payment_id=payment_data.payment_id,
            user_id=current_user.user_id,
            notes=payment_data.notes,
        )
        return ReconciliationResponse.model_validate(reconciliation)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to add reconciled payment",
            error=str(e),
            reconciliation_id=reconciliation_id,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add reconciled payment",
        )


@router.post("/{reconciliation_id}/complete", response_model=ReconciliationResponse)
async def complete_reconciliation(
    reconciliation_id: int,
    completion_data: ReconciliationComplete,
    current_user: Annotated[UserInfo, Depends(require_permission("billing.reconciliation.update"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> ReconciliationResponse:
    """
    Complete reconciliation session and calculate discrepancies.

    Requires: billing.reconciliation.update permission
    """
    try:
        reconciliation = await service.complete_reconciliation(
            tenant_id=current_user.tenant_id,
            reconciliation_id=reconciliation_id,
            user_id=current_user.user_id,
            notes=completion_data.notes,
        )
        return ReconciliationResponse.model_validate(reconciliation)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to complete reconciliation",
            error=str(e),
            reconciliation_id=reconciliation_id,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete reconciliation",
        )


@router.post("/{reconciliation_id}/approve", response_model=ReconciliationResponse)
async def approve_reconciliation(
    reconciliation_id: int,
    approval_data: ReconciliationApprove,
    current_user: Annotated[
        UserInfo, Depends(require_permission("billing.reconciliation.approve"))
    ],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> ReconciliationResponse:
    """
    Approve completed reconciliation (finance team only).

    Requires: billing.reconciliation.approve permission
    """
    try:
        reconciliation = await service.approve_reconciliation(
            tenant_id=current_user.tenant_id,
            reconciliation_id=reconciliation_id,
            user_id=current_user.user_id,
            notes=approval_data.notes,
        )
        return ReconciliationResponse.model_validate(reconciliation)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to approve reconciliation",
            error=str(e),
            reconciliation_id=reconciliation_id,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to approve reconciliation",
        )


# ==================== Recovery & Retry Endpoints ====================


@router.post("/retry-payment", response_model=PaymentRetryResponse)
async def retry_failed_payment(
    retry_request: PaymentRetryRequest,
    current_user: Annotated[UserInfo, Depends(require_permission("billing.payment.retry"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> PaymentRetryResponse:
    """
    Retry a failed payment with circuit breaker and recovery.

    Requires: billing.payment.retry permission
    """
    try:
        result = await service.retry_failed_payment_with_recovery(
            tenant_id=current_user.tenant_id,
            payment_id=retry_request.payment_id,
            user_id=current_user.user_id,
            max_attempts=retry_request.max_attempts,
        )
        return PaymentRetryResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to retry payment",
            error=str(e),
            payment_id=retry_request.payment_id,
            tenant_id=current_user.tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retry payment",
        )


@router.get("/circuit-breaker/status")
async def get_circuit_breaker_status(
    current_user: Annotated[UserInfo, Depends(require_permission("billing.admin"))],
    service: Annotated[ReconciliationService, Depends(get_reconciliation_service)],
) -> dict[str, Any]:
    """
    Get circuit breaker status.

    Requires: billing.admin permission
    """
    return {
        "state": service.circuit_breaker.state,
        "failure_count": service.circuit_breaker.failure_count,
        "failure_threshold": service.circuit_breaker.failure_threshold,
        "last_failure_time": service.circuit_breaker.last_failure_time,
        "recovery_timeout": service.circuit_breaker.recovery_timeout,
    }
