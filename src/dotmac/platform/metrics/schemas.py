"""
Metrics API Schemas

Pydantic models for ISP metrics and KPIs.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SubscriberMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Subscriber-related metrics."""

    model_config = ConfigDict()

    total: int = Field(..., description="Total subscribers")
    active: int = Field(..., description="Active subscribers")
    suspended: int = Field(..., description="Suspended subscribers")
    pending: int = Field(..., description="Pending activation")
    disconnected: int = Field(..., description="Disconnected subscribers")
    terminated: int = Field(..., description="Terminated subscribers")
    quarantined: int = Field(..., description="Quarantined subscribers")
    growth_this_month: int = Field(..., description="Net new subscribers this month")
    churn_rate: float = Field(..., description="Churn rate percentage")
    arpu: float = Field(..., description="Average revenue per user")


class NetworkMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Network infrastructure metrics."""

    model_config = ConfigDict()

    olt_count: int = Field(..., description="Total OLT count")
    olts_online: int = Field(..., description="OLTs currently online")
    pon_ports_total: int = Field(..., description="Total PON ports")
    pon_ports_utilized: int = Field(..., description="PON ports in use")
    utilization_percent: float = Field(..., description="PON port utilization %")
    onu_count: int = Field(..., description="Total ONU count")
    onus_online: int = Field(..., description="ONUs currently online")
    onus_offline: int = Field(..., description="ONUs offline")
    avg_signal_strength_dbm: float | None = Field(
        default=None, description="Average ONU signal strength"
    )
    degraded_onus: int = Field(..., description="ONUs with degraded signal")


class SupportMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Support and ticketing metrics."""

    model_config = ConfigDict()

    open_tickets: int = Field(..., description="Currently open tickets")
    avg_response_time_minutes: float = Field(..., description="Average first response time")
    avg_resolution_time_hours: float = Field(..., description="Average resolution time")
    sla_compliance_percent: float = Field(..., description="SLA compliance percentage")
    tickets_this_week: int = Field(..., description="Tickets opened this week")
    tickets_last_week: int = Field(..., description="Tickets opened last week")


class RevenueMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Revenue and financial metrics."""

    model_config = ConfigDict()

    mrr: float = Field(..., description="Monthly recurring revenue")
    arr: float = Field(..., description="Annual recurring revenue")
    outstanding_ar: float = Field(..., description="Outstanding accounts receivable")
    overdue_30_days: float = Field(..., description="Overdue >30 days")


class DashboardMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Aggregated dashboard metrics for ISP operations."""

    model_config = ConfigDict()

    subscriber_metrics: SubscriberMetrics
    network_metrics: NetworkMetrics
    support_metrics: SupportMetrics
    revenue_metrics: RevenueMetrics
    timestamp: datetime = Field(..., description="Metrics snapshot timestamp")
    cache_ttl_seconds: int = Field(300, description="Cache TTL in seconds")


class SubscriberByPlan(BaseModel):  # BaseModel resolves to Any in isolation
    """Subscriber count by service plan."""

    model_config = ConfigDict()

    plan: str
    count: int
    percentage: float


class SubscriberByStatus(BaseModel):  # BaseModel resolves to Any in isolation
    """Subscriber count by status."""

    model_config = ConfigDict()

    status: str
    count: int
    percentage: float


class DailyActivation(BaseModel):  # BaseModel resolves to Any in isolation
    """Daily subscriber activation count."""

    model_config = ConfigDict()

    date: str  # ISO date format
    count: int


class SubscriberKPIs(BaseModel):  # BaseModel resolves to Any in isolation
    """Detailed subscriber KPIs with trends."""

    model_config = ConfigDict()

    total_subscribers: int
    active_subscribers: int
    new_subscribers_this_period: int
    churned_subscribers_this_period: int
    net_growth: int
    churn_rate: float
    subscriber_by_plan: list[SubscriberByPlan]
    subscriber_by_status: list[SubscriberByStatus]
    daily_activations: list[DailyActivation]


class SignalQualityBand(BaseModel):  # BaseModel resolves to Any in isolation
    """ONU count by signal strength band."""

    model_config = ConfigDict()

    range: str  # e.g., "-20 to -25 dBm"
    count: int
    status: str  # excellent, good, degraded, critical


class NetworkUptimeMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Network uptime statistics."""

    model_config = ConfigDict()

    olt_uptime_percent: float
    onu_uptime_percent: float
    average_session_duration_hours: float


class NetworkDeviceHealth(BaseModel):  # BaseModel resolves to Any in isolation
    """Device health statistics."""

    model_config = ConfigDict()

    onus_online: int
    onus_offline: int
    onus_rebooting: int
    onus_degraded_signal: int
    cpe_online: int
    cpe_offline: int
    cpe_firmware_outdated: int


class NetworkCapacity(BaseModel):  # BaseModel resolves to Any in isolation
    """Network capacity metrics."""

    model_config = ConfigDict()

    pon_ports_total: int
    pon_ports_used: int
    pon_ports_available: int
    utilization_percent: float
    estimated_months_to_full: int | None


class NetworkAlert(BaseModel):  # BaseModel resolves to Any in isolation
    """Network alert summary."""

    model_config = ConfigDict()

    type: str
    count: int
    severity: str


class NetworkHealthMetrics(BaseModel):
    """Detailed network health and capacity metrics."""

    model_config = ConfigDict()

    uptime: NetworkUptimeMetrics
    signal_quality: dict[str, Any]  # Contains onus_by_signal list
    device_health: NetworkDeviceHealth
    capacity: NetworkCapacity
    top_alerts: list[NetworkAlert]


class TicketVolume(BaseModel):
    """Ticket volume statistics."""

    model_config = ConfigDict()

    total_tickets: int
    open_tickets: int
    closed_tickets: int
    avg_daily_tickets: float


class SLAMetric(BaseModel):  # BaseModel resolves to Any in isolation
    """SLA compliance metric."""

    model_config = ConfigDict()

    target_minutes: int | None = None
    target_hours: int | None = None
    avg_actual_minutes: float | None = None
    avg_actual_hours: float | None = None
    compliance_percent: float
    breached_count: int


class TicketCategory(BaseModel):  # BaseModel resolves to Any in isolation
    """Ticket count by category."""

    model_config = ConfigDict()

    category: str
    count: int
    percentage: float


class TicketPriority(BaseModel):  # BaseModel resolves to Any in isolation
    """Ticket count by priority."""

    model_config = ConfigDict()

    priority: str
    count: int


class AgentPerformance(BaseModel):  # BaseModel resolves to Any in isolation
    """Support agent performance metrics."""

    model_config = ConfigDict()

    agent: str
    tickets_resolved: int
    avg_resolution_hours: float
    csat: float  # Customer satisfaction score


class SupportKPIs(BaseModel):
    """Detailed support and ticketing KPIs."""

    model_config = ConfigDict()

    ticket_volume: TicketVolume
    sla_compliance: dict[str, SLAMetric]
    tickets_by_category: list[TicketCategory]
    tickets_by_priority: list[TicketPriority]
    agent_performance: list[AgentPerformance]


class RevenueTrend(BaseModel):  # BaseModel resolves to Any in isolation
    """Monthly revenue trend."""

    model_config = ConfigDict()

    month: str  # YYYY-MM format
    mrr: float
    new_mrr: float
    churned_mrr: float


class RevenueByPlan(BaseModel):  # BaseModel resolves to Any in isolation
    """Revenue breakdown by service plan."""

    model_config = ConfigDict()

    plan: str
    mrr: float
    subscribers: int


class CollectionsMetrics(BaseModel):  # BaseModel resolves to Any in isolation
    """Collections and accounts receivable metrics."""

    model_config = ConfigDict()

    current_ar: float
    overdue_0_30_days: float
    overdue_30_60_days: float
    overdue_60_90_days: float
    overdue_90_plus_days: float
    collection_rate_percent: float


class RevenueKPIs(BaseModel):  # BaseModel resolves to Any in isolation
    """Detailed revenue and financial KPIs."""

    model_config = ConfigDict()

    mrr: float
    arr: float
    arpu: float
    revenue_trend: list[RevenueTrend]
    revenue_by_plan: list[RevenueByPlan]
    collections: CollectionsMetrics
