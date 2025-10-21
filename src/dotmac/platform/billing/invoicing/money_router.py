"""
Invoice API router with PDF generation and Money model support.

Extends the existing invoice router with PDF generation capabilities
and Money-based invoice creation for accurate currency handling.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.invoicing.money_service import (
    MoneyInvoiceService,
)
from dotmac.platform.billing.money_models import MoneyInvoice
from dotmac.platform.database import get_async_session

# ============================================================================
# Request/Response Models
# ============================================================================


class MoneyLineItemRequest(BaseModel):
    """Line item request using decimal amounts instead of cents."""

    model_config = ConfigDict()

    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(..., ge=1)
    unit_price: str = Field(..., description="Unit price as decimal string (e.g., '19.99')")
    tax_rate: float = Field(0, ge=0, le=1, description="Tax rate (0-1, e.g., 0.1 for 10%)")
    discount_percentage: float = Field(
        0, ge=0, le=1, description="Discount (0-1, e.g., 0.2 for 20%)"
    )
    product_id: str | None = None


class CreateMoneyInvoiceRequest(BaseModel):
    """Create invoice request using Money models."""

    model_config = ConfigDict()

    customer_id: str = Field(..., description="Customer identifier")
    billing_email: str = Field(..., description="Billing email address")
    billing_address: dict[str, str] = Field(..., description="Billing address")
    line_items: list[MoneyLineItemRequest] = Field(..., min_length=1)
    currency: str = Field("USD", min_length=3, max_length=3)
    due_days: int | None = Field(None, ge=1, le=365)
    due_date: datetime | None = None
    notes: str | None = Field(None, max_length=2000)
    internal_notes: str | None = Field(None, max_length=2000)
    subscription_id: str | None = None
    idempotency_key: str | None = None


class PDFGenerationRequest(BaseModel):
    """PDF generation options."""

    model_config = ConfigDict()

    company_info: dict[str, Any] | None = Field(None, description="Company information for invoice")
    customer_info: dict[str, Any] | None = Field(
        None, description="Additional customer information"
    )
    payment_instructions: str | None = Field(None, description="Payment instructions text")
    locale: str = Field("en_US", description="Locale for currency formatting")
    include_qr_code: bool = Field(False, description="Include QR code for payment")


class BatchPDFRequest(BaseModel):
    """Batch PDF generation request."""

    model_config = ConfigDict()

    invoice_ids: list[str] = Field(..., min_length=1, max_length=100)
    company_info: dict[str, Any] | None = None
    locale: str = Field("en_US")


class InvoiceDiscountRequest(BaseModel):
    """Apply discount to invoice."""

    model_config = ConfigDict()

    discount_percentage: float = Field(..., gt=0, le=100, description="Discount percentage (0-100)")
    reason: str = Field(..., min_length=1, max_length=500)


# ============================================================================
# Router Definition
# ============================================================================

router = APIRouter(prefix="/money")


def get_tenant_id_from_request(request: Request) -> str:
    """Extract tenant ID from request."""
    if hasattr(request.state, "tenant_id"):
        tenant_id: str = request.state.tenant_id
        return tenant_id

    tenant_id_header = request.headers.get("X-Tenant-ID")
    if tenant_id_header:
        return tenant_id_header

    tenant_id_query = request.query_params.get("tenant_id")
    if tenant_id_query:
        return tenant_id_query

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Tenant ID is required. Provide via X-Tenant-ID header or tenant_id query param.",
    )


# ============================================================================
# Money Invoice Endpoints
# ============================================================================


@router.post("/invoices", response_model=MoneyInvoice, status_code=status.HTTP_201_CREATED)
async def create_money_invoice(
    invoice_data: CreateMoneyInvoiceRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> MoneyInvoice:
    """
    Create a new invoice using Money models for accurate currency handling.

    This endpoint uses decimal strings for amounts instead of cents,
    providing better precision for currency calculations.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    # Convert line items to dict format
    line_items = []
    for item in invoice_data.line_items:
        line_items.append(
            {
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "discount_percentage": item.discount_percentage,
                "product_id": item.product_id,
            }
        )

    try:
        invoice = await service.create_money_invoice(
            tenant_id=tenant_id,
            customer_id=invoice_data.customer_id,
            billing_email=invoice_data.billing_email,
            billing_address=invoice_data.billing_address,
            line_items=line_items,
            currency=invoice_data.currency,
            due_days=invoice_data.due_days,
            due_date=invoice_data.due_date,
            notes=invoice_data.notes,
            internal_notes=invoice_data.internal_notes,
            subscription_id=invoice_data.subscription_id,
            created_by=current_user.user_id,
            idempotency_key=invoice_data.idempotency_key,
        )
        return invoice
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create invoice: {str(e)}",
        )


@router.get("/invoices/{invoice_id}", response_model=MoneyInvoice)
async def get_money_invoice(
    invoice_id: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> MoneyInvoice:
    """Get invoice with Money model format."""
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    invoice = await service.get_money_invoice(tenant_id, invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Invoice {invoice_id} not found"
        )

    return invoice


# ============================================================================
# PDF Generation Endpoints
# ============================================================================


@router.post("/invoices/{invoice_id}/pdf")
async def generate_invoice_pdf(
    invoice_id: str,
    pdf_options: PDFGenerationRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Response:
    """
    Generate PDF for an invoice.

    Returns the PDF as a binary response that can be downloaded or displayed.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    try:
        pdf_bytes = await service.generate_invoice_pdf(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            company_info=pdf_options.company_info,
            customer_info=pdf_options.customer_info,
            payment_instructions=pdf_options.payment_instructions,
            locale=pdf_options.locale,
        )

        # Get invoice for filename
        invoice = await service.get_money_invoice(tenant_id, invoice_id)
        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invoice {invoice_id} not found",
            )
        filename = f"invoice_{invoice.invoice_number}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF: {str(e)}",
        )


@router.get("/invoices/{invoice_id}/pdf/preview")
async def preview_invoice_pdf(
    invoice_id: str,
    request: Request,
    locale: str = Query("en_US"),
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> Response:
    """
    Preview invoice PDF in browser.

    Returns PDF with inline disposition for browser viewing.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    try:
        pdf_bytes = await service.generate_invoice_pdf(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            locale=locale,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate PDF preview: {str(e)}",
        )


@router.post("/invoices/batch/pdf")
async def generate_batch_pdfs(
    batch_request: BatchPDFRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Generate PDFs for multiple invoices.

    This endpoint is useful for batch processing and reporting.
    Returns a list of generated file paths or download URLs.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    # Create temporary directory for batch PDFs
    import os
    import tempfile

    temp_dir = tempfile.mkdtemp(prefix="invoice_batch_")

    try:
        output_paths = await service.generate_batch_invoices_pdf(
            tenant_id=tenant_id,
            invoice_ids=batch_request.invoice_ids,
            output_dir=temp_dir,
            company_info=batch_request.company_info,
            locale=batch_request.locale,
        )

        # In production, you might upload these to S3 and return URLs
        # For now, return the count and temp directory
        return {
            "success": True,
            "count": len(output_paths),
            "message": f"Generated {len(output_paths)} PDF files",
            "temp_directory": temp_dir,
            "files": [os.path.basename(path) for path in output_paths],
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate batch PDFs: {str(e)}",
        )


# ============================================================================
# Invoice Operations with Money Precision
# ============================================================================


@router.post("/invoices/{invoice_id}/discount")
async def apply_discount(
    invoice_id: str,
    discount_request: InvoiceDiscountRequest,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> MoneyInvoice:
    """
    Apply a percentage discount to an invoice.

    Uses Money calculations for accurate discount computation.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    try:
        invoice = await service.apply_percentage_discount(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            discount_percentage=discount_request.discount_percentage,
            reason=discount_request.reason,
        )
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to apply discount: {str(e)}",
        )


@router.post("/invoices/{invoice_id}/recalculate-tax")
async def recalculate_tax(
    invoice_id: str,
    tax_jurisdiction: str,
    request: Request,
    db: AsyncSession = Depends(get_async_session),
    current_user: UserInfo = Depends(get_current_user),
) -> MoneyInvoice:
    """
    Recalculate tax for an invoice based on jurisdiction.

    Uses Money calculations for precise tax computation.
    """
    tenant_id = get_tenant_id_from_request(request)
    service = MoneyInvoiceService(db)

    # Default tax rates - in production, would look up from tax service
    tax_rates = {
        "default": 0.10,  # 10% default
        "CA": 0.0875,  # California
        "NY": 0.08,  # New York
        "TX": 0.0625,  # Texas
    }

    try:
        invoice = await service.calculate_tax_for_jurisdiction(
            tenant_id=tenant_id,
            invoice_id=invoice_id,
            tax_jurisdiction=tax_jurisdiction,
            tax_rates={"default": tax_rates.get(tax_jurisdiction, 0.10)},
        )
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate tax: {str(e)}",
        )


# Export router
__all__ = ["router"]
