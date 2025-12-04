"""
Router for billing reports and analytics endpoints.

Provides endpoints for:
- Blocked/suspended customers dashboard
- Enriched aging reports (by partner, by region)
- Services export (CSV/JSON)
- SLA breach reports
"""

from datetime import datetime, timedelta
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.token_with_rbac import get_current_user_with_rbac
from dotmac.platform.database import get_async_session
from dotmac.platform.user_management.models import User

from .generators import AgingReportGenerator, BlockedCustomersReportGenerator

router = APIRouter(prefix="/reports", tags=["Billing - Reports"])


# ============================================================================
# SLA Breach Reports
# ============================================================================


@router.get("/sla-breaches")
async def get_sla_breach_report(
    resolved: bool | None = Query(None, description="Filter by resolved status"),
    min_credit_amount: float = Query(0.0, description="Minimum auto-credit amount"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> dict[str, Any]:
    """
    Get SLA breach report with auto-credit visibility.

    Returns all SLA breaches with:
    - Breach details (type, severity, deviation)
    - SLA instance and customer information
    - Auto-credit amounts issued
    - Resolution status

    Useful for tracking service quality and customer credits.
    """
    from sqlalchemy import func, select

    from dotmac.platform.fault_management.models import SLABreach, SLAInstance

    try:
        # Build query for SLA breaches
        stmt = (
            select(
                SLABreach.id.label("breach_id"),
                SLABreach.breach_type,
                SLABreach.severity,
                SLABreach.detected_at,
                SLABreach.resolved_at,
                SLABreach.resolved,
                SLABreach.target_value,
                SLABreach.actual_value,
                SLABreach.deviation_percent,
                SLABreach.credit_amount,
                SLAInstance.id.label("instance_id"),
                SLAInstance.customer_id,
                SLAInstance.customer_name,
                SLAInstance.service_id,
                SLAInstance.service_name,
                SLAInstance.status.label("sla_status"),
            )
            .join(SLAInstance, SLABreach.sla_instance_id == SLAInstance.id)
            .where(SLABreach.tenant_id == current_user.tenant_id)
        )

        if resolved is not None:
            stmt = stmt.where(SLABreach.resolved == resolved)

        if min_credit_amount > 0:
            stmt = stmt.where(SLABreach.credit_amount >= min_credit_amount)

        stmt = stmt.order_by(SLABreach.detected_at.desc())

        result = await db.execute(stmt)
        rows = result.all()

        # Convert to dict format
        breaches = []
        total_credits = 0.0
        for row in rows:
            breaches.append(
                {
                    "breach_id": str(row.breach_id),
                    "breach_type": row.breach_type,
                    "severity": row.severity,
                    "detected_at": row.detected_at.isoformat() if row.detected_at else None,
                    "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
                    "resolved": row.resolved,
                    "target_value": float(row.target_value),
                    "actual_value": float(row.actual_value),
                    "deviation_percent": float(row.deviation_percent),
                    "credit_amount": float(row.credit_amount),
                    "instance_id": str(row.instance_id),
                    "customer_id": str(row.customer_id) if row.customer_id else None,
                    "customer_name": row.customer_name,
                    "service_id": str(row.service_id) if row.service_id else None,
                    "service_name": row.service_name,
                    "sla_status": row.sla_status.value if row.sla_status else None,
                }
            )
            total_credits += float(row.credit_amount)

        # Calculate summary statistics
        stmt_summary = select(
            func.count(SLABreach.id).label("total_breaches"),
            func.count(SLABreach.id)
            .filter(SLABreach.resolved.is_(True))
            .label("resolved_breaches"),
            func.count(SLABreach.id)
            .filter(SLABreach.resolved.is_(False))
            .label("unresolved_breaches"),
            func.sum(SLABreach.credit_amount).label("total_credits"),
        ).where(SLABreach.tenant_id == current_user.tenant_id)

        if resolved is not None:
            stmt_summary = stmt_summary.where(SLABreach.resolved == resolved)

        result_summary = await db.execute(stmt_summary)
        summary_row = result_summary.one()

        return {
            "summary": {
                "total_breaches": summary_row.total_breaches or 0,
                "resolved_breaches": summary_row.resolved_breaches or 0,
                "unresolved_breaches": summary_row.unresolved_breaches or 0,
                "total_credits_issued": float(summary_row.total_credits or 0),
            },
            "breaches": breaches,
            "generated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate SLA breach report: {str(e)}",
        )


router_section_marker = "# " + "=" * 76


# ============================================================================
# Blocked Customers Dashboard
# ============================================================================


@router.get("/blocked-customers")
async def get_blocked_customers(
    min_days_blocked: int = Query(0, description="Minimum days in suspended state"),
    max_days_blocked: int | None = Query(None, description="Maximum days in suspended state"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> list[dict[str, Any]]:
    """
    Get dashboard of blocked/suspended customers.

    Returns suspended subscribers with:
    - Outstanding balance and overdue invoices
    - Days in suspended state
    - Recommended next action for collections
    - Priority level (critical, high, medium, low)

    Useful for collections teams to prioritize follow-up actions.
    """
    generator = BlockedCustomersReportGenerator(db)

    try:
        blocked_customers = await generator.get_blocked_customers_summary(
            tenant_id=current_user.tenant_id,
            min_days_blocked=min_days_blocked,
            max_days_blocked=max_days_blocked,
        )

        return blocked_customers

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate blocked customers report: {str(e)}",
        )


# ============================================================================
# Enriched Aging Reports
# ============================================================================


@router.get("/aging/by-partner")
async def get_aging_by_partner(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> list[dict[str, Any]]:
    """
    Get accounts receivable aging breakdown by partner.

    Returns aging buckets (current, 1-30, 31-60, 61-90, 90+ days)
    grouped by partner_id for multi-partner operators.

    Useful for identifying which partners have collection issues.
    """
    generator = AgingReportGenerator(db)

    try:
        aging_data = await generator.get_aging_by_partner(
            tenant_id=current_user.tenant_id,
        )

        return aging_data

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate aging by partner report: {str(e)}",
        )


@router.get("/aging/by-region")
async def get_aging_by_region(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> list[dict[str, Any]]:
    """
    Get accounts receivable aging breakdown by billing region/country.

    Returns aging buckets (current, 1-30, 31-60, 61-90, 90+ days)
    grouped by billing_country.

    Useful for identifying geographic regions with collection challenges.
    """
    generator = AgingReportGenerator(db)

    try:
        aging_data = await generator.get_aging_by_region(
            tenant_id=current_user.tenant_id,
        )

        return aging_data

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate aging by region report: {str(e)}",
        )


# ============================================================================
# Services Export
# ============================================================================


@router.get("/services/export")
async def export_services(
    format: Literal["csv", "json"] = Query("csv", description="Export format"),
    include_suspended: bool = Query(False, description="Include suspended services"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> Response:
    """
    Export active services for accounting sync.

    Returns all active subscriber services with:
    - Subscriber details
    - Service plan information
    - Billing amounts
    - Status

    Format options:
    - CSV: Standard CSV file for spreadsheet import
    - JSON: Structured JSON for system integration
    """
    from sqlalchemy import select

    from dotmac.platform.subscribers.models import Subscriber, SubscriberStatus

    try:
        # Build query for active services
        stmt = select(Subscriber).where(
            Subscriber.tenant_id == current_user.tenant_id,
        )

        if not include_suspended:
            stmt = stmt.where(Subscriber.status == SubscriberStatus.ACTIVE)

        result = await db.execute(stmt)
        subscribers = result.scalars().all()

        # Convert to export format
        services_data = []
        for sub in subscribers:
            services_data.append(
                {
                    "subscriber_id": sub.id,
                    "username": sub.username,
                    "status": sub.status.value,
                    "created_at": sub.created_at.isoformat() if sub.created_at else None,
                    "suspended_at": sub.suspended_at.isoformat() if sub.suspended_at else None,
                }
            )

        if format == "csv":
            import csv
            import io

            output = io.StringIO()
            if services_data:
                writer = csv.DictWriter(output, fieldnames=services_data[0].keys())
                writer.writeheader()
                writer.writerows(services_data)

            csv_content = output.getvalue()
            return Response(
                content=csv_content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=services_export_{datetime.now().strftime('%Y%m%d')}.csv"
                },
            )
        else:  # json
            import json

            json_content = json.dumps(services_data, indent=2)
            return Response(
                content=json_content,
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=services_export_{datetime.now().strftime('%Y%m%d')}.json"
                },
            )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to export services: {str(e)}",
        )


# ============================================================================
# Session History Explorer
# ============================================================================


@router.get("/sessions/history")
async def get_session_history(
    subscriber_id: str | None = Query(None, description="Filter by subscriber ID"),
    username: str | None = Query(None, description="Filter by username"),
    start_date: datetime | None = Query(None, description="Start date for history"),
    end_date: datetime | None = Query(None, description="End date for history"),
    limit: int = Query(100, description="Maximum results to return", le=1000),
    offset: int = Query(0, description="Pagination offset"),
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_with_rbac),
) -> dict[str, Any]:
    """
    Explore RADIUS session history (12+ months of accounting data).

    Returns session records with:
    - Session timing (start, stop, duration)
    - Data usage (upload, download, total)
    - IP addresses assigned
    - NAS and termination details

    Useful for:
    - Customer usage analysis
    - Billing verification
    - Capacity planning
    - Troubleshooting connectivity issues
    """
    from sqlalchemy import desc, func, select

    from dotmac.platform.timeseries.models import RadAcctTimeSeries

    try:
        # Calculate date range (default to last 30 days)
        if not end_date:
            end_date = datetime.now()
        if not start_date:
            start_date = end_date - timedelta(days=30)

        # Query historical sessions from TimescaleDB hypertable
        stmt = select(
            RadAcctTimeSeries.time,
            RadAcctTimeSeries.subscriber_id,
            RadAcctTimeSeries.username,
            RadAcctTimeSeries.session_id,
            RadAcctTimeSeries.nas_ip_address,
            RadAcctTimeSeries.framed_ip_address,
            RadAcctTimeSeries.framed_ipv6_address,
            RadAcctTimeSeries.session_start_time,
            RadAcctTimeSeries.session_stop_time,
            RadAcctTimeSeries.session_duration,
            RadAcctTimeSeries.total_bytes,
            RadAcctTimeSeries.input_octets,
            RadAcctTimeSeries.output_octets,
            RadAcctTimeSeries.terminate_cause,
        ).where(
            RadAcctTimeSeries.tenant_id == current_user.tenant_id,
            RadAcctTimeSeries.time >= start_date,
            RadAcctTimeSeries.time <= end_date,
        )

        if subscriber_id:
            stmt = stmt.where(RadAcctTimeSeries.subscriber_id == subscriber_id)

        if username:
            stmt = stmt.where(RadAcctTimeSeries.username == username)

        stmt = stmt.order_by(desc(RadAcctTimeSeries.time)).limit(limit).offset(offset)

        result = await db.execute(stmt)
        rows = result.all()

        # Convert to dict format
        sessions = []
        total_bytes_sum = 0
        total_duration_sum = 0

        for row in rows:
            session_data = {
                "time": row.time.isoformat() if row.time else None,
                "subscriber_id": row.subscriber_id,
                "username": row.username,
                "session_id": row.session_id,
                "nas_ip_address": str(row.nas_ip_address) if row.nas_ip_address else None,
                "framed_ip_address": str(row.framed_ip_address) if row.framed_ip_address else None,
                "framed_ipv6_address": str(row.framed_ipv6_address)
                if row.framed_ipv6_address
                else None,
                "session_start_time": row.session_start_time.isoformat()
                if row.session_start_time
                else None,
                "session_stop_time": row.session_stop_time.isoformat()
                if row.session_stop_time
                else None,
                "session_duration_seconds": row.session_duration or 0,
                "session_duration_hours": round((row.session_duration or 0) / 3600, 2),
                "total_bytes": row.total_bytes or 0,
                "total_gb": round((row.total_bytes or 0) / (1024**3), 3),
                "input_octets": row.input_octets or 0,
                "output_octets": row.output_octets or 0,
                "upload_gb": round((row.input_octets or 0) / (1024**3), 3),
                "download_gb": round((row.output_octets or 0) / (1024**3), 3),
                "terminate_cause": row.terminate_cause,
            }
            sessions.append(session_data)

            total_bytes_sum += row.total_bytes or 0
            total_duration_sum += row.session_duration or 0

        # Get total count for pagination
        count_stmt = (
            select(func.count())
            .select_from(RadAcctTimeSeries)
            .where(
                RadAcctTimeSeries.tenant_id == current_user.tenant_id,
                RadAcctTimeSeries.time >= start_date,
                RadAcctTimeSeries.time <= end_date,
            )
        )

        if subscriber_id:
            count_stmt = count_stmt.where(RadAcctTimeSeries.subscriber_id == subscriber_id)

        if username:
            count_stmt = count_stmt.where(RadAcctTimeSeries.username == username)

        result_count = await db.execute(count_stmt)
        total_count = result_count.scalar() or 0

        return {
            "summary": {
                "total_sessions": total_count,
                "returned_sessions": len(sessions),
                "total_data_usage_gb": round(total_bytes_sum / (1024**3), 3),
                "total_duration_hours": round(total_duration_sum / 3600, 2),
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat(),
            },
            "pagination": {
                "limit": limit,
                "offset": offset,
                "has_more": (offset + len(sessions)) < total_count,
            },
            "sessions": sessions,
            "generated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve session history: {str(e)}",
        )


__all__ = ["router"]
