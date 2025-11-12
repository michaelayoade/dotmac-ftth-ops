"""Pydantic schemas for partner multi-tenant API endpoints."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

# ============================================
# Tenant Management Schemas
# ============================================


class ManagedTenantMetrics(BaseModel):
    """Metrics for a managed tenant."""

    total_subscribers: int = Field(description="Total active subscribers")
    total_revenue_mtd: Decimal = Field(description="Month-to-date revenue")
    accounts_receivable: Decimal = Field(description="Outstanding AR")
    overdue_invoices_count: int = Field(description="Number of overdue invoices")
    open_tickets_count: int = Field(description="Number of open support tickets")
    sla_compliance_pct: Decimal | None = Field(
        default=None, description="SLA compliance percentage"
    )


class ManagedTenantSummary(BaseModel):
    """Summary information for a managed tenant."""

    tenant_id: str
    tenant_name: str
    tenant_slug: str
    status: str
    access_role: str = Field(description="Partner's access role to this tenant")
    relationship_type: str = Field(description="Type of partner-tenant relationship")
    start_date: datetime
    end_date: datetime | None = None
    is_active: bool
    is_expired: bool
    metrics: ManagedTenantMetrics | None = None
    last_accessed: datetime | None = Field(
        default=None, description="Last time partner accessed this tenant"
    )


class ManagedTenantListResponse(BaseModel):
    """Response for listing managed tenants."""

    tenants: list[ManagedTenantSummary]
    total: int
    offset: int
    limit: int


class ManagedTenantDetail(BaseModel):
    """Detailed information for a specific managed tenant."""

    tenant_id: str
    tenant_name: str
    tenant_slug: str
    status: str
    access_role: str
    relationship_type: str
    start_date: datetime
    end_date: datetime | None
    is_active: bool
    is_expired: bool

    # SLA configuration
    sla_response_hours: int | None
    sla_uptime_target: Decimal | None

    # Alert configuration
    notify_on_sla_breach: bool
    notify_on_billing_threshold: bool
    billing_alert_threshold: Decimal | None

    # Custom permissions
    custom_permissions: dict[str, bool] = Field(default_factory=dict)

    # Metadata
    notes: str | None
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Metrics
    metrics: ManagedTenantMetrics | None = None


# ============================================
# Billing Schemas
# ============================================


class BillingTenantSummary(BaseModel):
    """Billing summary for a single tenant."""

    tenant_id: str
    tenant_name: str
    total_revenue: Decimal
    accounts_receivable: Decimal
    overdue_amount: Decimal
    overdue_invoices_count: int
    total_invoices_count: int
    oldest_overdue_days: int | None = None


class ConsolidatedBillingSummary(BaseModel):
    """Consolidated billing summary across all managed tenants."""

    total_revenue: Decimal = Field(description="Total revenue across all tenants")
    total_ar: Decimal = Field(description="Total accounts receivable")
    total_overdue: Decimal = Field(description="Total overdue amount")
    overdue_invoices_count: int = Field(description="Total overdue invoices")
    tenants_count: int = Field(description="Number of tenants included")
    tenants: list[BillingTenantSummary] = Field(description="Per-tenant breakdown")
    as_of_date: datetime = Field(description="Data snapshot timestamp")


class InvoiceListItem(BaseModel):
    """Invoice item in list response."""

    invoice_id: str
    tenant_id: str
    tenant_name: str
    invoice_number: str
    invoice_date: datetime
    due_date: datetime
    amount: Decimal
    paid_amount: Decimal
    balance: Decimal
    status: str
    is_overdue: bool
    days_overdue: int | None = None


class InvoiceListResponse(BaseModel):
    """Response for listing invoices across tenants."""

    invoices: list[InvoiceListItem]
    total: int
    offset: int
    limit: int
    filters_applied: dict[str, Any] = Field(default_factory=dict)


class InvoiceExportRequest(BaseModel):
    """Request to export invoices."""

    tenant_ids: list[str] | None = Field(default=None, description="Filter by tenant IDs")
    status: str | None = Field(default=None, description="Filter by status")
    from_date: datetime | None = None
    to_date: datetime | None = None
    format: str = Field(default="csv", description="Export format: csv or pdf")


class InvoiceExportResponse(BaseModel):
    """Response for invoice export request."""

    export_id: str = Field(description="Unique export job ID")
    status: str = Field(description="Export status: pending, processing, completed, failed")
    download_url: str | None = Field(default=None, description="Download URL when ready")
    expires_at: datetime | None = Field(default=None, description="Download link expiration")
    estimated_completion: datetime | None = None


# ============================================
# Support/Ticketing Schemas
# ============================================


class TicketListItem(BaseModel):
    """Ticket item in list response."""

    ticket_id: str
    tenant_id: str
    tenant_name: str
    ticket_number: str
    subject: str
    status: str
    priority: str
    created_at: datetime
    updated_at: datetime
    assigned_to: str | None = None
    customer_name: str | None = None


class TicketListResponse(BaseModel):
    """Response for listing tickets across tenants."""

    tickets: list[TicketListItem]
    total: int
    offset: int
    limit: int
    filters_applied: dict[str, Any] = Field(default_factory=dict)


class CreateTicketRequest(BaseModel):
    """Request to create a ticket on behalf of a managed tenant."""

    subject: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1)
    priority: str = Field(default="normal", description="low, normal, high, urgent")
    category: str | None = None
    customer_id: str | None = Field(
        default=None, description="Optional customer ID if ticket is for specific customer"
    )


class CreateTicketResponse(BaseModel):
    """Response after creating a ticket."""

    ticket_id: str
    ticket_number: str
    tenant_id: str
    status: str
    created_at: datetime


class UpdateTicketRequest(BaseModel):
    """Request to update a ticket."""

    status: str | None = None
    priority: str | None = None
    assigned_to: str | None = None
    notes: str | None = None


# ============================================
# Reporting Schemas
# ============================================


class UsageTenantSummary(BaseModel):
    """Usage summary for a single tenant."""

    tenant_id: str
    tenant_name: str
    total_data_gb: Decimal
    peak_concurrent_users: int
    average_daily_users: int
    total_sessions: int


class UsageReportResponse(BaseModel):
    """Response for usage report across tenants."""

    period_start: datetime
    period_end: datetime
    tenants: list[UsageTenantSummary]
    total_data_gb: Decimal
    total_sessions: int


class SLATenantSummary(BaseModel):
    """SLA summary for a single tenant."""

    tenant_id: str
    tenant_name: str
    uptime_pct: Decimal
    average_response_hours: Decimal
    sla_target_uptime: Decimal | None
    sla_target_response_hours: int | None
    is_compliant: bool
    breach_count: int


class SLAReportResponse(BaseModel):
    """Response for SLA report across tenants."""

    period_start: datetime
    period_end: datetime
    tenants: list[SLATenantSummary]
    overall_compliance_pct: Decimal


# ============================================
# Alert Schemas
# ============================================


class SLAAlert(BaseModel):
    """SLA breach alert."""

    alert_id: str
    tenant_id: str
    tenant_name: str
    alert_type: str = Field(description="uptime_breach, response_time_breach")
    severity: str
    message: str
    detected_at: datetime
    acknowledged: bool = False
    acknowledged_at: datetime | None = None


class SLAAlertListResponse(BaseModel):
    """Response for listing SLA alerts."""

    alerts: list[SLAAlert]
    total: int
    unacknowledged_count: int


class BillingAlert(BaseModel):
    """Billing threshold alert."""

    alert_id: str
    tenant_id: str
    tenant_name: str
    alert_type: str = Field(description="ar_threshold, overdue_threshold")
    current_amount: Decimal
    threshold_amount: Decimal
    severity: str
    message: str
    detected_at: datetime
    acknowledged: bool = False


class BillingAlertListResponse(BaseModel):
    """Response for listing billing alerts."""

    alerts: list[BillingAlert]
    total: int
    unacknowledged_count: int
