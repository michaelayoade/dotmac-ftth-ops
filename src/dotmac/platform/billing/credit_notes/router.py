"""
Credit note API router
"""

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.core.enums import CreditNoteStatus, CreditReason
from dotmac.platform.billing.core.exceptions import (
    CreditNoteNotFoundError,
    InsufficientCreditError,
    InvalidCreditNoteStatusError,
)
from dotmac.platform.billing.core.models import CreditNote
from dotmac.platform.billing.credit_notes.service import CreditNoteService
from dotmac.platform.billing.invoicing.router import get_tenant_id_from_request
from dotmac.platform.billing.money_utils import format_money, money_handler
from dotmac.platform.database import get_async_session

# ============================================================================
# Request/Response Models
# ============================================================================


class CreateCreditNoteRequest(BaseModel):
    """Create credit note request"""

    model_config = ConfigDict()

    invoice_id: str = Field(..., description="Invoice to credit")
    reason: CreditReason = Field(..., description="Reason for credit")
    line_items: list[dict[str, Any]] = Field(..., min_length=1, description="Credit line items")
    notes: str | None = Field(None, max_length=2000, description="Customer-visible notes")
    internal_notes: str | None = Field(None, max_length=2000, description="Internal notes")
    auto_apply: bool = Field(True, description="Auto-apply credit to invoice")


class IssueCreditNoteRequest(BaseModel):
    """Issue credit note request"""

    model_config = ConfigDict()

    send_notification: bool = Field(True, description="Send notification to customer")


class VoidCreditNoteRequest(BaseModel):
    """Void credit note request"""

    model_config = ConfigDict()

    reason: str = Field(..., min_length=1, max_length=500, description="Void reason")


class ApplyCreditRequest(BaseModel):
    """Apply credit request"""

    model_config = ConfigDict()

    invoice_id: str = Field(..., description="Invoice to apply credit to")
    amount: int = Field(..., gt=0, description="Amount to apply in minor currency units")


class CreditNoteListResponse(BaseModel):
    """Credit note list response"""

    model_config = ConfigDict()

    credit_notes: list[CreditNote]
    total_count: int
    has_more: bool
    total_available_credit: int = Field(0, description="Total available credit in minor units")


def _format_minor_units(amount: int | None, currency: str) -> str:
    """Format minor currency units to human-readable string."""
    money = money_handler.money_from_minor_units(amount or 0, currency)
    return str(format_money(money))


# ============================================================================
# Router Definition
# ============================================================================

router = APIRouter(prefix="/credit-notes", tags=["Billing - Credit Notes"])


# ============================================================================
# Credit Note Endpoints
# ============================================================================


@router.post("", response_model=CreditNote, status_code=status.HTTP_201_CREATED)
async def create_credit_note(
    credit_data: CreateCreditNoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNote:
    """Create a new credit note"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    try:
        credit_note = await service.create_credit_note(
            tenant_id=tenant_id,
            invoice_id=credit_data.invoice_id,
            reason=credit_data.reason,
            line_items=credit_data.line_items,
            notes=credit_data.notes,
            internal_notes=credit_data.internal_notes,
            created_by=current_user.user_id,
            auto_apply=credit_data.auto_apply,
        )
        return credit_note
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create credit note: {str(e)}",
        )


@router.get("/{credit_note_id}", response_model=CreditNote)
async def get_credit_note(
    credit_note_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNote:
    """Get credit note by ID"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    credit_note = await service.get_credit_note(tenant_id, credit_note_id)
    if not credit_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit note not found",
        )

    return credit_note


@router.get("", response_model=CreditNoteListResponse)
async def list_credit_notes(
    request: Request,
    customer_id: str | None = Query(None, description="Filter by customer ID"),
    invoice_id: str | None = Query(None, description="Filter by invoice ID"),
    status: CreditNoteStatus | None = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNoteListResponse:
    """List credit notes with filtering"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    credit_notes = await service.list_credit_notes(
        tenant_id=tenant_id,
        customer_id=customer_id,
        invoice_id=invoice_id,
        status=status,
        limit=limit + 1,
        offset=offset,
    )

    has_more = len(credit_notes) > limit
    if has_more:
        credit_notes = credit_notes[:limit]

    # Calculate total available credit
    total_available = sum(
        cn.remaining_credit_amount
        for cn in credit_notes
        if cn.status in [CreditNoteStatus.ISSUED, CreditNoteStatus.PARTIALLY_APPLIED]
    )

    return CreditNoteListResponse(
        credit_notes=credit_notes,
        total_count=len(credit_notes),
        has_more=has_more,
        total_available_credit=total_available,
    )


@router.get("/{credit_note_id}/download")
async def download_credit_note(
    credit_note_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Response:
    """Download a credit note summary as CSV."""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    credit_note = await service.get_credit_note(tenant_id, credit_note_id)
    if not credit_note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit note not found",
        )

    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["Field", "Value"])
    writer.writerow(["Credit Note ID", credit_note.credit_note_id])
    writer.writerow(["Credit Note Number", credit_note.credit_note_number or "-"])
    writer.writerow(["Invoice ID", credit_note.invoice_id or "-"])
    writer.writerow(["Customer ID", credit_note.customer_id])
    writer.writerow(["Issue Date", credit_note.issue_date.isoformat()])
    status_value = (
        credit_note.status.value
        if hasattr(credit_note.status, "value")
        else str(credit_note.status)
    )
    reason_value = (
        credit_note.reason.value
        if hasattr(credit_note.reason, "value")
        else str(credit_note.reason)
    )
    writer.writerow(["Status", status_value])
    writer.writerow(["Reason", reason_value])
    writer.writerow(["Subtotal", _format_minor_units(credit_note.subtotal, credit_note.currency)])
    writer.writerow(
        ["Tax Amount", _format_minor_units(credit_note.tax_amount, credit_note.currency)]
    )
    writer.writerow(
        ["Total Amount", _format_minor_units(credit_note.total_amount, credit_note.currency)]
    )
    writer.writerow(
        [
            "Remaining Credit",
            _format_minor_units(credit_note.remaining_credit_amount, credit_note.currency),
        ]
    )
    writer.writerow(["Auto Apply", "Yes" if credit_note.auto_apply_to_invoice else "No"])
    writer.writerow(["Notes", credit_note.notes or ""])
    writer.writerow(["Internal Notes", credit_note.internal_notes or ""])
    writer.writerow(["Created By", credit_note.created_by])
    writer.writerow([])
    writer.writerow(
        ["Line Item Description", "Quantity", "Unit Price", "Total Price", "Tax Rate", "Tax Amount"]
    )

    for item in credit_note.line_items:
        writer.writerow(
            [
                item.description,
                item.quantity,
                _format_minor_units(item.unit_price, credit_note.currency),
                _format_minor_units(item.total_price, credit_note.currency),
                f"{item.tax_rate:.2f}%",
                _format_minor_units(item.tax_amount, credit_note.currency),
            ]
        )

    csv_data = buffer.getvalue()
    filename_base = credit_note.credit_note_number or credit_note.credit_note_id
    filename = f"credit_note_{filename_base}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(csv_data.encode("utf-8"))),
        },
    )


@router.post("/{credit_note_id}/issue", response_model=CreditNote)
async def issue_credit_note(
    credit_note_id: str,
    issue_data: IssueCreditNoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNote:
    """Issue a draft credit note"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    try:
        credit_note = await service.issue_credit_note(tenant_id, credit_note_id)
        return credit_note
    except CreditNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit note not found",
        )
    except InvalidCreditNoteStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{credit_note_id}/void", response_model=CreditNote)
async def void_credit_note(
    credit_note_id: str,
    void_data: VoidCreditNoteRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNote:
    """Void a credit note"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    try:
        credit_note = await service.void_credit_note(
            tenant_id,
            credit_note_id,
            reason=void_data.reason,
            voided_by=current_user.user_id,
        )
        return credit_note
    except CreditNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit note not found",
        )
    except InvalidCreditNoteStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/{credit_note_id}/apply", response_model=CreditNote)
async def apply_credit_note(
    credit_note_id: str,
    apply_data: ApplyCreditRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> CreditNote:
    """Apply credit note to an invoice"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    try:
        credit_note = await service.apply_credit_to_invoice(
            tenant_id,
            credit_note_id,
            apply_data.invoice_id,
            apply_data.amount,
        )
        return credit_note
    except CreditNoteNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credit note not found",
        )
    except (InvalidCreditNoteStatusError, InsufficientCreditError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get("/customer/{customer_id}/available", response_model=list[CreditNote])
async def get_available_credits(
    customer_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> list[CreditNote]:
    """Get available credit notes for a customer"""

    tenant_id = get_tenant_id_from_request(request)
    service = CreditNoteService(db)

    credit_notes: list[CreditNote] = await service.get_available_credits(tenant_id, customer_id)
    return credit_notes
