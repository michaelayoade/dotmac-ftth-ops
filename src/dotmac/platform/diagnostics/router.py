"""
Diagnostics Router.

API endpoints for network diagnostics and troubleshooting.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import get_current_user
from dotmac.platform.database import get_async_session
from dotmac.platform.diagnostics.models import (
    DiagnosticRun,
    DiagnosticSeverity,
    DiagnosticStatus,
    DiagnosticType,
)
from dotmac.platform.diagnostics.service import DiagnosticsService
from dotmac.platform.user_management.models import User

router = APIRouter(prefix="", )


# Request/Response Models


class DiagnosticRunResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for diagnostic run."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    diagnostic_type: DiagnosticType
    status: DiagnosticStatus
    severity: DiagnosticSeverity | None
    subscriber_id: str | None
    customer_id: UUID | None
    started_at: str | None
    completed_at: str | None
    duration_ms: int | None
    success: bool
    summary: str | None
    error_message: str | None
    results: dict[str, Any]
    recommendations: list[dict[str, Any]]
    diagnostic_metadata: dict[str, Any]
    created_at: str


class DiagnosticRunListResponse(BaseModel):  # BaseModel resolves to Any in isolation
    """Response model for diagnostic runs list."""

    model_config = ConfigDict()

    total: int
    items: list[DiagnosticRunResponse]
    limit: int
    offset: int


# API Endpoints


@router.post(
    "/diagnostics/subscribers/{subscriber_id}/connectivity",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Check subscriber connectivity",
    description="Check overall subscriber connectivity status including RADIUS auth and IP allocation",
)
async def check_subscriber_connectivity(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Check subscriber connectivity."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.check_subscriber_connectivity(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/subscribers/{subscriber_id}/radius-sessions",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Get RADIUS sessions",
    description="Get active RADIUS sessions for subscriber",
)
async def get_radius_sessions(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Get RADIUS sessions."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.get_radius_sessions(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/subscribers/{subscriber_id}/onu-status",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Check ONU status",
    description="Check ONU optical signal level and operational status via VOLTHA",
)
async def check_onu_status(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Check ONU status."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.check_onu_status(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/subscribers/{subscriber_id}/cpe-status",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Check CPE status",
    description="Check CPE online status and firmware version via GenieACS TR-069",
)
async def check_cpe_status(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Check CPE status."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.check_cpe_status(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/subscribers/{subscriber_id}/ip-verification",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Verify IP allocation",
    description="Verify IP allocation consistency between subscriber record and NetBox IPAM",
)
async def verify_ip_allocation(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Verify IP allocation."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.verify_ip_allocation(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/diagnostics/subscribers/{subscriber_id}/restart-cpe",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Restart CPE",
    description="Trigger CPE device restart via GenieACS TR-069",
)
async def restart_cpe(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Restart CPE."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.restart_cpe(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/subscribers/{subscriber_id}/health-check",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Run comprehensive health check",
    description="Run all diagnostic checks in parallel and provide overall health assessment",
)
async def run_health_check(
    subscriber_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Run comprehensive health check."""
    service = DiagnosticsService(db)

    try:
        diagnostic = await service.run_health_check(
            tenant_id=current_user.tenant_id,
            subscriber_id=subscriber_id,
            created_by_id=current_user.id,
        )
        await db.commit()
        return diagnostic
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/diagnostics/runs/{diagnostic_id}",
    response_model=DiagnosticRunResponse,
    status_code=status.HTTP_200_OK,
    summary="Get diagnostic run",
    description="Get diagnostic run by ID",
)
async def get_diagnostic_run(
    diagnostic_id: UUID,
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRun:
    """Get diagnostic run."""
    service = DiagnosticsService(db)

    diagnostic = await service.get_diagnostic_run(
        tenant_id=current_user.tenant_id, diagnostic_id=diagnostic_id
    )

    if not diagnostic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Diagnostic run {diagnostic_id} not found",
        )

    return diagnostic


@router.get(
    "/diagnostics/runs",
    response_model=DiagnosticRunListResponse,
    status_code=status.HTTP_200_OK,
    summary="List diagnostic runs",
    description="List diagnostic runs with optional filters",
)
async def list_diagnostic_runs(
    subscriber_id: str | None = Query(None, description="Filter by subscriber ID"),
    diagnostic_type: DiagnosticType | None = Query(None, description="Filter by diagnostic type"),
    limit: int = Query(50, ge=1, le=100, description="Number of items to return"),
    offset: int = Query(0, ge=0, description="Number of items to skip"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user),
) -> DiagnosticRunListResponse:
    """List diagnostic runs."""
    service = DiagnosticsService(db)

    diagnostics = await service.list_diagnostic_runs(
        tenant_id=current_user.tenant_id,
        subscriber_id=subscriber_id,
        diagnostic_type=diagnostic_type,
        limit=limit,
        offset=offset,
    )

    return DiagnosticRunListResponse(
        total=len(diagnostics),
        items=[DiagnosticRunResponse.model_validate(d) for d in diagnostics],
        limit=limit,
        offset=offset,
    )
