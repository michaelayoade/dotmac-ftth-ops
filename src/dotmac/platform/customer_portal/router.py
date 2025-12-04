"""
Customer Portal API Router.

Provides customer-facing endpoints for usage tracking, billing, and invoice management.
"""

import io
from collections.abc import Callable
from contextlib import AbstractAsyncContextManager
from datetime import datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.invoicing.money_service import MoneyInvoiceService
from dotmac.platform.billing.payment_methods.models import (
    AddPaymentMethodRequest,
    PaymentMethodResponse,
)
from dotmac.platform.billing.payment_methods.service import PaymentMethodService
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.database import get_async_session
from dotmac.platform.radius.models import RadAcct
from dotmac.platform.settings import settings

# TimescaleDB imports (optional - will fallback to PostgreSQL if not available)
TimeSeriesSessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]

try:
    from dotmac.platform.timeseries import TimeSeriesSessionLocal as _TimeSeriesSessionLocal

    TimeSeriesSessionLocal: TimeSeriesSessionFactory | None = _TimeSeriesSessionLocal
    TIMESCALEDB_AVAILABLE = True
except ImportError:
    TimeSeriesSessionLocal = None
    TIMESCALEDB_AVAILABLE = False

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/customer", tags=["Customer Portal"])


# ============================================================================
# Schemas
# ============================================================================


class UsageDataPoint(BaseModel):
    """Single data point in usage history."""

    model_config = ConfigDict()

    date: str = Field(..., description="Date or hour label")
    download: float = Field(..., description="Download in GB")
    upload: float = Field(..., description="Upload in GB")
    total: float = Field(..., description="Total usage in GB")


class UsageHistoryResponse(BaseModel):
    """Usage history with daily/hourly breakdown."""

    model_config = ConfigDict()

    period_start: datetime
    period_end: datetime
    total_download_gb: float
    total_upload_gb: float
    total_gb: float
    daily_usage: list[UsageDataPoint]
    hourly_usage: list[UsageDataPoint]
    # Trend analysis fields
    highest_usage_day_gb: float | None = Field(None, description="Highest usage day in GB")
    highest_usage_date: str | None = Field(None, description="Date of highest usage")
    usage_trend_percent: float | None = Field(
        None, description="Usage trend: last 7 days vs prior 7 days (percentage change)"
    )
    overage_gb: float | None = Field(None, description="Overage GB if exceeding plan limit")


class UsageReportRequest(BaseModel):
    """Request to generate usage report PDF."""

    model_config = ConfigDict()

    period: dict[str, Any] = Field(..., description="Period start/end dates")
    summary: dict[str, Any] = Field(..., description="Summary statistics")
    daily_usage: list[dict[str, Any]] = Field(default_factory=list)
    hourly_usage: list[dict[str, Any]] = Field(default_factory=list)
    time_range: str = Field("30d", description="Time range label")


# ============================================================================
# Helper Functions
# ============================================================================


async def get_customer_from_user(
    user: UserInfo,
    db: AsyncSession,
) -> Customer:
    """Get customer record from authenticated user."""
    # Try to find customer by email
    result = await db.execute(
        select(Customer).where(
            and_(
                Customer.email == user.email,
                Customer.deleted_at.is_(None),
            )
        )
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer record not found. Please contact support.",
        )

    return customer


async def calculate_usage_from_radius(
    customer: Customer,
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession,
) -> tuple[float, float]:
    """
    Calculate total usage from RADIUS accounting records.

    Uses TimescaleDB for fast queries when available, falls back to PostgreSQL.

    Returns:
        Tuple of (download_gb, upload_gb)
    """
    username = customer.email  # Or get from related subscriber

    # Try TimescaleDB first for 10-100x better performance
    if TIMESCALEDB_AVAILABLE and settings.timescaledb.is_configured:
        try:
            session_factory = TimeSeriesSessionLocal
            if session_factory is None:
                raise RuntimeError("Timescale session factory unavailable")
            async with session_factory() as ts_session:
                from sqlalchemy import text

                query = """
                    SELECT
                        COALESCE(SUM(input_octets), 0) as total_input,
                        COALESCE(SUM(output_octets), 0) as total_output
                    FROM radacct_timeseries
                    WHERE tenant_id = :tenant_id
                        AND username = :username
                        AND time >= :start_date
                        AND time < :end_date
                """

                result = await ts_session.execute(
                    text(query),
                    {
                        "tenant_id": customer.tenant_id,
                        "username": username,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )
                row = result.first()

                if row:
                    total_input_bytes = row[0] or 0
                    total_output_bytes = row[1] or 0

                    download_gb = total_input_bytes / (1024**3)
                    upload_gb = total_output_bytes / (1024**3)

                    logger.debug(
                        "customer_portal.usage.timescaledb",
                        customer_id=customer.id,
                        download_gb=download_gb,
                        upload_gb=upload_gb,
                    )

                    return download_gb, upload_gb
        except Exception as e:
            logger.warning(
                "customer_portal.usage.timescaledb_failed",
                error=str(e),
                fallback="postgresql",
            )

    # Fallback to PostgreSQL RadAcct table
    result = await db.execute(
        select(
            func.coalesce(func.sum(RadAcct.acctinputoctets), 0).label("total_input"),
            func.coalesce(func.sum(RadAcct.acctoutputoctets), 0).label("total_output"),
        ).where(
            and_(
                RadAcct.username == username,
                RadAcct.acctstarttime >= start_date,
                RadAcct.acctstarttime < end_date,
                RadAcct.tenant_id == customer.tenant_id,
            )
        )
    )

    row = result.one()
    total_input_bytes = row.total_input or 0
    total_output_bytes = row.total_output or 0

    # Convert bytes to GB
    download_gb = total_input_bytes / (1024**3)
    upload_gb = total_output_bytes / (1024**3)

    return download_gb, upload_gb


async def get_daily_usage_breakdown(
    customer: Customer,
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession,
) -> list[UsageDataPoint]:
    """
    Get daily usage breakdown for the period.

    Uses TimescaleDB continuous aggregates for fast queries when available.
    """
    username = customer.email

    # Try TimescaleDB continuous aggregate (pre-computed daily stats - MUCH faster)
    if TIMESCALEDB_AVAILABLE and settings.timescaledb.is_configured:
        try:
            session_factory = TimeSeriesSessionLocal
            if session_factory is None:
                raise RuntimeError("Timescale session factory unavailable")
            async with session_factory() as ts_session:
                from sqlalchemy import text

                # Use the daily continuous aggregate view
                query = """
                    SELECT
                        day,
                        COALESCE(SUM(input_octets), 0) as download_bytes,
                        COALESCE(SUM(output_octets), 0) as upload_bytes
                    FROM radacct_timeseries
                    WHERE tenant_id = :tenant_id
                        AND username = :username
                        AND time >= :start_date
                        AND time < :end_date
                    GROUP BY DATE_TRUNC('day', time)
                    ORDER BY DATE_TRUNC('day', time)
                """

                result = await ts_session.execute(
                    text(query),
                    {
                        "tenant_id": customer.tenant_id,
                        "username": username,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )

                daily_data = []
                for row in result:
                    download_gb = (row[1] or 0) / (1024**3)
                    upload_gb = (row[2] or 0) / (1024**3)
                    daily_data.append(
                        UsageDataPoint(
                            date=row[0].strftime("%Y-%m-%d"),
                            download=round(download_gb, 2),
                            upload=round(upload_gb, 2),
                            total=round(download_gb + upload_gb, 2),
                        )
                    )

                logger.debug(
                    "customer_portal.daily_usage.timescaledb",
                    customer_id=customer.id,
                    days=len(daily_data),
                )

                return daily_data
        except Exception as e:
            logger.warning(
                "customer_portal.daily_usage.timescaledb_failed",
                error=str(e),
                fallback="postgresql",
            )

    # Fallback to PostgreSQL
    result = await db.execute(
        select(
            func.date_trunc("day", RadAcct.acctstarttime).label("day"),
            func.coalesce(func.sum(RadAcct.acctinputoctets), 0).label("download_bytes"),
            func.coalesce(func.sum(RadAcct.acctoutputoctets), 0).label("upload_bytes"),
        )
        .where(
            and_(
                RadAcct.username == username,
                RadAcct.acctstarttime >= start_date,
                RadAcct.acctstarttime < end_date,
                RadAcct.tenant_id == customer.tenant_id,
            )
        )
        .group_by("day")
        .order_by("day")
    )

    daily_data = []
    for row in result:
        download_gb = (row.download_bytes or 0) / (1024**3)
        upload_gb = (row.upload_bytes or 0) / (1024**3)
        daily_data.append(
            UsageDataPoint(
                date=row.day.strftime("%Y-%m-%d"),
                download=round(download_gb, 2),
                upload=round(upload_gb, 2),
                total=round(download_gb + upload_gb, 2),
            )
        )

    return daily_data


async def get_hourly_usage_breakdown(
    customer: Customer,
    start_date: datetime,
    end_date: datetime,
    db: AsyncSession,
) -> list[UsageDataPoint]:
    """
    Get hourly usage breakdown for last 24 hours.
    Uses TimescaleDB for fast queries when available, falls back to PostgreSQL.
    """
    username = customer.email

    # Get last 24 hours
    now = datetime.utcnow()
    day_ago = now - timedelta(days=1)

    # Try TimescaleDB first for 10-100x better performance
    if TIMESCALEDB_AVAILABLE and settings.timescaledb.is_configured:
        try:
            session_factory = TimeSeriesSessionLocal
            if session_factory is None:
                raise RuntimeError("Timescale session factory unavailable")
            async with session_factory() as ts_session:
                from sqlalchemy import text

                query = """
                    SELECT
                        DATE_TRUNC('hour', time) as hour,
                        COALESCE(SUM(input_octets), 0) as download_bytes,
                        COALESCE(SUM(output_octets), 0) as upload_bytes
                    FROM radacct_timeseries
                    WHERE tenant_id = :tenant_id
                        AND username = :username
                        AND time >= :day_ago
                        AND time < :now
                    GROUP BY DATE_TRUNC('hour', time)
                    ORDER BY DATE_TRUNC('hour', time)
                """

                result = await ts_session.execute(
                    text(query),
                    {
                        "tenant_id": customer.tenant_id,
                        "username": username,
                        "day_ago": day_ago,
                        "now": now,
                    },
                )

                hourly_data = []
                for row in result:
                    download_gb = (row[1] or 0) / (1024**3)
                    upload_gb = (row[2] or 0) / (1024**3)
                    hourly_data.append(
                        UsageDataPoint(
                            date=row[0].strftime("%H:%M"),
                            download=round(download_gb, 3),
                            upload=round(upload_gb, 3),
                            total=round(download_gb + upload_gb, 3),
                        )
                    )

                logger.debug(
                    "customer_portal.hourly_usage.timescaledb",
                    customer_id=customer.id,
                    hours=len(hourly_data),
                )
                return hourly_data

        except Exception as e:
            logger.warning(
                "customer_portal.hourly_usage.timescaledb_failed",
                error=str(e),
                fallback="postgresql",
            )

    # Fallback to PostgreSQL RadAcct table
    result = await db.execute(
        select(
            func.date_trunc("hour", RadAcct.acctstarttime).label("hour"),
            func.coalesce(func.sum(RadAcct.acctinputoctets), 0).label("download_bytes"),
            func.coalesce(func.sum(RadAcct.acctoutputoctets), 0).label("upload_bytes"),
        )
        .where(
            and_(
                RadAcct.username == username,
                RadAcct.acctstarttime >= day_ago,
                RadAcct.acctstarttime < now,
                RadAcct.tenant_id == customer.tenant_id,
            )
        )
        .group_by("hour")
        .order_by("hour")
    )

    hourly_data = []
    for row in result:
        download_gb = (row.download_bytes or 0) / (1024**3)
        upload_gb = (row.upload_bytes or 0) / (1024**3)
        hourly_data.append(
            UsageDataPoint(
                date=row.hour.strftime("%H:%M"),
                download=round(download_gb, 3),
                upload=round(upload_gb, 3),
                total=round(download_gb + upload_gb, 3),
            )
        )

    return hourly_data


def generate_usage_report_pdf(
    report_data: UsageReportRequest,
    customer: Customer,
) -> bytes:
    """Generate PDF usage report."""
    buffer = io.BytesIO()

    # Create document
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title="Usage Report",
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#2563eb"),
        spaceAfter=12,
    )

    heading_style = ParagraphStyle(
        "CustomHeading",
        parent=styles["Heading2"],
        fontSize=14,
        textColor=colors.HexColor("#1f2937"),
        spaceAfter=6,
        spaceBefore=12,
    )

    # Title
    story.append(Paragraph("Internet Usage Report", title_style))
    story.append(Spacer(1, 0.2 * inch))

    # Customer info
    customer_info = f"""
    <b>Customer:</b> {customer.first_name} {customer.last_name}<br/>
    <b>Email:</b> {customer.email}<br/>
    <b>Report Period:</b> {report_data.period.get("start", "N/A")} to {report_data.period.get("end", "N/A")}<br/>
    <b>Generated:</b> {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    """
    story.append(Paragraph(customer_info, styles["Normal"]))
    story.append(Spacer(1, 0.3 * inch))

    # Summary section
    story.append(Paragraph("Usage Summary", heading_style))
    summary = report_data.summary

    summary_data = [
        ["Metric", "Value"],
        ["Total Usage", f"{summary.get('total_gb', 0):.2f} GB"],
        ["Downloaded", f"{summary.get('download_gb', 0):.2f} GB"],
        ["Uploaded", f"{summary.get('upload_gb', 0):.2f} GB"],
        ["Data Cap", f"{summary.get('limit_gb', 'Unlimited')} GB"],
        ["Usage %", f"{summary.get('usage_percentage', 0):.1f}%"],
        ["Days Remaining", str(summary.get("days_remaining", "N/A"))],
    ]

    summary_table = Table(summary_data, colWidths=[2.5 * inch, 2.5 * inch])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e5e7eb")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 11),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
                ("BACKGROUND", (0, 1), (-1, -1), colors.white),
                ("GRID", (0, 0), (-1, -1), 1, colors.grey),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 1), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 1), (-1, -1), 8),
            ]
        )
    )

    story.append(summary_table)
    story.append(Spacer(1, 0.4 * inch))

    # Daily usage section (if available)
    if report_data.daily_usage:
        story.append(Paragraph("Daily Usage Breakdown", heading_style))

        daily_data = [["Date", "Download (GB)", "Upload (GB)", "Total (GB)"]]
        for entry in report_data.daily_usage[:30]:  # Limit to 30 days
            daily_data.append(
                [
                    entry.get("date", ""),
                    f"{entry.get('download', 0):.2f}",
                    f"{entry.get('upload', 0):.2f}",
                    f"{entry.get('download', 0) + entry.get('upload', 0):.2f}",
                ]
            )

        daily_table = Table(daily_data, colWidths=[1.5 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
        daily_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dbeafe")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#1e40af")),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                    ("ALIGN", (0, 0), (0, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )

        story.append(daily_table)

    # Build PDF
    doc.build(story)

    pdf_bytes = buffer.getvalue()
    buffer.close()

    return pdf_bytes


# ============================================================================
# Endpoints
# ============================================================================


@router.get(
    "/usage/history",
    response_model=UsageHistoryResponse,
    summary="Get usage history",
    description="Retrieve daily and hourly usage data for the authenticated customer",
)
async def get_usage_history(
    time_range: str = Query("30d", description="Time range: 7d, 30d, or 90d"),
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> UsageHistoryResponse:
    """
    Get usage history with daily and hourly breakdowns.

    Returns RADIUS accounting data aggregated by day and hour.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Parse time range
        days_map = {"7d": 7, "30d": 30, "90d": 90}
        days = days_map.get(time_range, 30)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Calculate total usage
        download_gb, upload_gb = await calculate_usage_from_radius(
            customer, start_date, end_date, db
        )

        # Get daily breakdown
        daily_usage = await get_daily_usage_breakdown(customer, start_date, end_date, db)

        # Get hourly breakdown (last 24h)
        hourly_usage = await get_hourly_usage_breakdown(customer, start_date, end_date, db)

        # Calculate trend analysis metrics
        highest_day_gb = None
        highest_date = None
        if daily_usage:
            highest_day = max(daily_usage, key=lambda d: d.total)
            highest_day_gb = round(highest_day.total, 2)
            highest_date = highest_day.date

        # Calculate usage trend (last 7 days vs prior 7 days)
        usage_trend_percent = None
        if len(daily_usage) >= 14:
            # Last 7 days
            last_7_days = daily_usage[-7:]
            last_7_total = sum(d.total for d in last_7_days)

            # Prior 7 days
            prior_7_days = daily_usage[-14:-7]
            prior_7_total = sum(d.total for d in prior_7_days)

            if prior_7_total > 0:
                usage_trend_percent = round(
                    ((last_7_total - prior_7_total) / prior_7_total) * 100, 2
                )

        # Calculate overage (placeholder - would need plan limit from subscription)
        # For now, we'll leave it as None unless we have a plan limit
        overage_gb = None

        return UsageHistoryResponse(
            period_start=start_date,
            period_end=end_date,
            total_download_gb=round(download_gb, 2),
            total_upload_gb=round(upload_gb, 2),
            total_gb=round(download_gb + upload_gb, 2),
            daily_usage=daily_usage,
            hourly_usage=hourly_usage,
            highest_usage_day_gb=highest_day_gb,
            highest_usage_date=highest_date,
            usage_trend_percent=usage_trend_percent,
            overage_gb=overage_gb,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to retrieve usage history", error=str(e), user=user.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve usage history. Please try again later.",
        )


@router.post(
    "/usage/report",
    summary="Generate usage report PDF",
    description="Generate a PDF report of customer usage data",
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF usage report",
        }
    },
)
async def generate_usage_report(
    report_request: UsageReportRequest,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> Response:
    """
    Generate PDF usage report.

    Accepts usage data and generates a formatted PDF report.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Generate PDF
        pdf_bytes = generate_usage_report_pdf(report_request, customer)

        # Return PDF response
        filename = f"usage-report-{datetime.now().strftime('%Y%m%d')}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to generate usage report", error=str(e), user=user.email)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate usage report. Please try again later.",
        )


@router.get(
    "/invoices/{invoice_id}/download",
    summary="Download invoice PDF",
    description="Download invoice as PDF file",
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "Invoice PDF file",
        }
    },
)
async def download_invoice_pdf(
    invoice_id: str,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> Response:
    """
    Download invoice as PDF.

    Retrieves the invoice and generates a PDF using ReportLab.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize invoice service
        invoice_service = MoneyInvoiceService(db)

        # Get invoice
        invoice = await invoice_service.get_money_invoice(customer.tenant_id, invoice_id)

        if not invoice:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invoice not found",
            )

        # Verify customer owns this invoice
        if str(invoice.customer_id) != str(customer.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this invoice",
            )

        # Prepare company info (you may want to load this from settings)
        company_info = {
            "name": "Your ISP Company",
            "address": {
                "street": "123 Network Drive",
                "city": "Tech City",
                "state": "TC",
                "postal_code": "12345",
                "country": "US",
            },
            "email": "billing@yourisp.com",
            "phone": "+1 (555) 123-4567",
            "website": "www.yourisp.com",
            "tax_id": "XX-XXXXXXX",
        }

        # Customer info
        customer_info = {
            "name": f"{customer.first_name} {customer.last_name}",
        }

        pdf_bytes = await invoice_service.generate_invoice_pdf(
            tenant_id=customer.tenant_id,
            invoice_id=invoice_id,
            company_info=company_info,
            customer_info=customer_info,
            locale="en_US",
        )

        # Return PDF
        filename = f"invoice-{invoice.invoice_number}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to download invoice PDF",
            error=str(e),
            invoice_id=invoice_id,
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate invoice PDF. Please try again later.",
        )


# ============================================================================
# Payment Methods Endpoints
# ============================================================================


@router.get(
    "/payment-methods",
    response_model=list[PaymentMethodResponse],
    summary="List payment methods",
    description="List all payment methods for the authenticated customer",
)
async def list_payment_methods(
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> list[PaymentMethodResponse]:
    """
    List all payment methods for the customer.

    Returns all active payment methods associated with the customer's account.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize payment method service
        service = PaymentMethodService(db)

        # Get payment methods for the customer
        payment_methods = await service.list_payment_methods_for_customer(
            tenant_id=customer.tenant_id,
            customer_id=str(customer.id),
        )

        logger.info(
            "Customer payment methods retrieved",
            customer_id=str(customer.id),
            count=len(payment_methods),
            user=user.email,
        )

        return payment_methods

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to retrieve payment methods",
            error=str(e),
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment methods. Please try again later.",
        )


@router.post(
    "/payment-methods",
    response_model=PaymentMethodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add payment method",
    description="Add a new payment method for the authenticated customer",
)
async def add_payment_method(
    request: AddPaymentMethodRequest,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> PaymentMethodResponse:
    """
    Add a new payment method for the customer.

    Supports credit/debit cards, bank accounts, and digital wallets.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize payment method service
        service = PaymentMethodService(db)

        # Determine which token to use based on method type
        token = ""
        if request.method_type.value == "card":
            token = request.card_token or ""
        elif request.method_type.value == "bank_account":
            token = request.bank_token or ""
        elif request.method_type.value == "wallet":
            token = request.wallet_token or ""

        # Build billing details dict
        billing_details = {
            "billing_name": request.billing_name,
            "billing_email": request.billing_email,
            "billing_phone": request.billing_phone,
            "billing_address_line1": request.billing_address_line1,
            "billing_address_line2": request.billing_address_line2,
            "billing_city": request.billing_city,
            "billing_state": request.billing_state,
            "billing_postal_code": request.billing_postal_code,
            "billing_country": request.billing_country,
        }

        # Add payment method
        payment_method = await service.add_payment_method(
            tenant_id=customer.tenant_id,
            method_type=request.method_type,
            token=token,
            billing_details=billing_details,
            set_as_default=request.set_as_default,
            added_by_user_id=user.user_id,
        )

        await db.commit()

        logger.info(
            "Payment method added",
            customer_id=str(customer.id),
            payment_method_id=payment_method.payment_method_id,
            method_type=request.method_type,
            user=user.email,
        )

        return payment_method

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to add payment method",
            error=str(e),
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add payment method. Please try again later.",
        )


@router.post(
    "/payment-methods/{payment_method_id}/default",
    response_model=PaymentMethodResponse,
    summary="Set default payment method",
    description="Set a payment method as the default for the customer",
)
async def set_default_payment_method(
    payment_method_id: str,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> PaymentMethodResponse:
    """
    Set a payment method as the default.

    The default payment method is used for automatic payments and quick checkout.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize payment method service
        service = PaymentMethodService(db)

        # Set as default
        payment_method = await service.set_default_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=str(customer.tenant_id),
            set_by_user_id=user.user_id,
        )

        await db.commit()

        logger.info(
            "Default payment method set",
            customer_id=str(customer.id),
            payment_method_id=payment_method_id,
            user=user.email,
        )

        return payment_method

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to set default payment method",
            error=str(e),
            payment_method_id=payment_method_id,
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to set default payment method. Please try again later.",
        )


@router.delete(
    "/payment-methods/{payment_method_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove payment method",
    description="Remove a payment method from the customer's account",
)
async def remove_payment_method(
    payment_method_id: str,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> None:
    """
    Remove a payment method.

    Note: Cannot remove the default payment method if there are active subscriptions.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize payment method service
        service = PaymentMethodService(db)

        # Remove payment method
        await service.remove_payment_method(
            payment_method_id=payment_method_id,
            tenant_id=str(customer.tenant_id),
            removed_by_user_id=user.user_id,
        )

        await db.commit()

        logger.info(
            "Payment method removed",
            customer_id=str(customer.id),
            payment_method_id=payment_method_id,
            user=user.email,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to remove payment method",
            error=str(e),
            payment_method_id=payment_method_id,
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove payment method. Please try again later.",
        )


@router.post(
    "/payment-methods/{payment_method_id}/toggle-autopay",
    response_model=PaymentMethodResponse,
    summary="Toggle AutoPay",
    description="Enable or disable automatic payments for a payment method",
)
async def toggle_autopay(
    payment_method_id: str,
    user: UserInfo = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> PaymentMethodResponse:
    """
    Toggle AutoPay for a payment method.

    When AutoPay is enabled, invoices will be automatically paid using this payment method.
    """
    try:
        # Get customer record
        customer = await get_customer_from_user(user, db)

        # Initialize payment method service
        service = PaymentMethodService(db)

        # Toggle autopay
        payment_method = await service.toggle_autopay(
            payment_method_id=payment_method_id,
            tenant_id=customer.tenant_id,
            updated_by_user_id=user.user_id,
        )

        await db.commit()

        logger.info(
            "AutoPay toggled",
            customer_id=str(customer.id),
            payment_method_id=payment_method_id,
            autopay_enabled=payment_method.auto_pay_enabled,
            user=user.email,
        )

        return payment_method

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to toggle AutoPay",
            error=str(e),
            payment_method_id=payment_method_id,
            user=user.email,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle AutoPay. Please try again later.",
        )
