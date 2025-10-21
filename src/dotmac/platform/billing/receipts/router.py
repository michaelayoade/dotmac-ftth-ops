"""
Receipt API router
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.invoicing.router import get_tenant_id_from_request
from dotmac.platform.billing.receipts.models import Receipt
from dotmac.platform.billing.receipts.service import ReceiptService
from dotmac.platform.database import get_async_session

# ============================================================================
# Request/Response Models
# ============================================================================


class GenerateReceiptForPaymentRequest(BaseModel):
    """Generate receipt for payment request"""

    model_config = ConfigDict()

    payment_id: str = Field(..., description="Payment ID to generate receipt for")
    include_pdf: bool = Field(True, description="Include PDF generation")
    include_html: bool = Field(True, description="Include HTML generation")
    send_email: bool = Field(False, description="Send receipt via email")


class GenerateReceiptForInvoiceRequest(BaseModel):
    """Generate receipt for invoice payment request"""

    model_config = ConfigDict()

    invoice_id: str = Field(..., description="Invoice ID to generate receipt for")
    payment_details: dict[str, Any] = Field(..., description="Payment details")
    include_pdf: bool = Field(True, description="Include PDF generation")
    include_html: bool = Field(True, description="Include HTML generation")


class ReceiptListResponse(BaseModel):
    """Receipt list response"""

    model_config = ConfigDict()

    receipts: list[Receipt]
    total_count: int
    has_more: bool


# ============================================================================
# Router Definition
# ============================================================================

router = APIRouter(prefix="/receipts", tags=["Billing - Receipts"])


# ============================================================================
# Receipt Endpoints
# ============================================================================


@router.post("/generate/payment", response_model=Receipt, status_code=status.HTTP_201_CREATED)
async def generate_receipt_for_payment(
    receipt_data: GenerateReceiptForPaymentRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Receipt:
    """Generate receipt for a payment"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    try:
        receipt = await service.generate_receipt_for_payment(
            tenant_id=tenant_id,
            payment_id=receipt_data.payment_id,
            include_pdf=receipt_data.include_pdf,
            include_html=receipt_data.include_html,
            send_email=receipt_data.send_email,
        )
        return receipt
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate receipt: {str(e)}",
        )


@router.post("/generate/invoice", response_model=Receipt, status_code=status.HTTP_201_CREATED)
async def generate_receipt_for_invoice(
    receipt_data: GenerateReceiptForInvoiceRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Receipt:
    """Generate receipt for an invoice payment"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    try:
        receipt = await service.generate_receipt_for_invoice(
            tenant_id=tenant_id,
            invoice_id=receipt_data.invoice_id,
            payment_details=receipt_data.payment_details,
            include_pdf=receipt_data.include_pdf,
            include_html=receipt_data.include_html,
        )
        return receipt
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate receipt: {str(e)}",
        )


@router.get("/{receipt_id}", response_model=Receipt)
async def get_receipt(
    receipt_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Receipt:
    """Get receipt by ID"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    receipt = await service.get_receipt(tenant_id, receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    return receipt


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    request: Request,
    customer_id: str | None = Query(None, description="Filter by customer ID"),
    payment_id: str | None = Query(None, description="Filter by payment ID"),
    invoice_id: str | None = Query(None, description="Filter by invoice ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number to return"),
    offset: int = Query(0, ge=0, description="Number to skip"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> ReceiptListResponse:
    """List receipts with filtering"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    receipts = await service.list_receipts(
        tenant_id=tenant_id,
        customer_id=customer_id,
        payment_id=payment_id,
        invoice_id=invoice_id,
        limit=limit + 1,
        offset=offset,
    )

    has_more = len(receipts) > limit
    if has_more:
        receipts = receipts[:limit]

    return ReceiptListResponse(
        receipts=receipts,
        total_count=len(receipts),
        has_more=has_more,
    )


@router.get("/{receipt_id}/html", response_class=HTMLResponse)
async def get_receipt_html(
    receipt_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> HTMLResponse:
    """Get receipt as HTML"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    receipt = await service.get_receipt(tenant_id, receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    if not receipt.html_content:
        # Generate HTML on demand
        receipt.html_content = await service.html_generator.generate_html(receipt)

    return HTMLResponse(content=receipt.html_content)


@router.get("/{receipt_id}/pdf")
async def get_receipt_pdf(
    receipt_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Response:
    """Get receipt as PDF"""

    tenant_id = get_tenant_id_from_request(request)
    service = ReceiptService(db)

    receipt = await service.get_receipt(tenant_id, receipt_id)
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found",
        )

    # Generate PDF on demand
    pdf_content = await service.pdf_generator.generate_pdf(receipt)

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=receipt_{receipt.receipt_number}.pdf"
        },
    )
