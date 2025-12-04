"""
GraphQL types for metrics and analytics data.

Defines types for dashboards, charts, and analytics queries.
"""

from datetime import datetime

import strawberry


@strawberry.type
class BillingMetrics:
    """Billing overview metrics for dashboards."""

    # Revenue metrics
    mrr: float = strawberry.field(description="Monthly Recurring Revenue")
    arr: float = strawberry.field(description="Annual Recurring Revenue")

    # Counts
    active_subscriptions: int = strawberry.field(description="Number of active subscriptions")
    total_invoices: int = strawberry.field(description="Total invoices this period")
    paid_invoices: int = strawberry.field(description="Paid invoices this period")
    overdue_invoices: int = strawberry.field(description="Overdue invoices")

    # Payment metrics
    total_payments: int = strawberry.field(description="Total payments this period")
    successful_payments: int = strawberry.field(description="Successful payments")
    failed_payments: int = strawberry.field(description="Failed payments")
    total_payment_amount: float = strawberry.field(
        description="Total payment amount in major units"
    )

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class CustomerMetrics:
    """Customer analytics metrics."""

    # Customer counts
    total_customers: int = strawberry.field(description="Total number of customers")
    active_customers: int = strawberry.field(description="Active customers")
    new_customers: int = strawberry.field(description="New customers this period")
    churned_customers: int = strawberry.field(description="Churned customers this period")

    # Growth metrics
    customer_growth_rate: float = strawberry.field(description="Customer growth rate (%)")
    churn_rate: float = strawberry.field(description="Churn rate (%)")
    retention_rate: float = strawberry.field(description="Retention rate (%)")

    # Value metrics
    average_customer_value: float = strawberry.field(description="Average customer LTV")
    total_customer_value: float = strawberry.field(description="Total customer value")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class MonitoringMetrics:
    """System health and monitoring metrics."""

    # System health
    error_rate: float = strawberry.field(description="Current error rate (%)")
    critical_errors: int = strawberry.field(description="Number of critical errors")
    warning_count: int = strawberry.field(description="Number of warnings")

    # Performance metrics
    avg_response_time_ms: float = strawberry.field(description="Average response time (ms)")
    p95_response_time_ms: float = strawberry.field(description="P95 response time (ms)")
    p99_response_time_ms: float = strawberry.field(description="P99 response time (ms)")

    # Request metrics
    total_requests: int = strawberry.field(description="Total requests processed")
    successful_requests: int = strawberry.field(description="Successful requests")
    failed_requests: int = strawberry.field(description="Failed requests")

    # Activity breakdown
    api_requests: int = strawberry.field(description="API request count")
    user_activities: int = strawberry.field(description="User activity count")
    system_activities: int = strawberry.field(description="System activity count")

    # Resource indicators
    high_latency_requests: int = strawberry.field(description="Requests with >1s latency")
    timeout_count: int = strawberry.field(description="Request timeouts")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class AnalyticsMetrics:
    """Analytics activity metrics."""

    # Event metrics
    total_events: int = strawberry.field(description="Total events tracked")
    unique_users: int = strawberry.field(description="Unique users")
    unique_sessions: int = strawberry.field(description="Unique sessions")

    # Event breakdown
    page_views: int = strawberry.field(description="Page view events")
    user_actions: int = strawberry.field(description="User action events")
    system_events: int = strawberry.field(description="System events")
    conversion_events: int = strawberry.field(description="Conversion events")

    # Top events
    top_events: list[str] = strawberry.field(description="Most frequent event names")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class AuthMetrics:
    """Authentication and security metrics."""

    # Login metrics
    total_logins: int = strawberry.field(description="Total login attempts")
    successful_logins: int = strawberry.field(description="Successful logins")
    failed_logins: int = strawberry.field(description="Failed login attempts")
    login_success_rate: float = strawberry.field(description="Login success rate (%)")

    # User metrics
    active_users: int = strawberry.field(description="Active users this period")
    new_users: int = strawberry.field(description="New user registrations")
    mfa_enabled_users: int = strawberry.field(description="Users with MFA enabled")
    mfa_adoption_rate: float = strawberry.field(description="MFA adoption rate (%)")

    # Security metrics
    password_resets: int = strawberry.field(description="Password reset requests")
    suspicious_activities: int = strawberry.field(description="Suspicious activity count")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class CommunicationsMetrics:
    """Communications metrics (email, SMS, etc.)."""

    # Delivery metrics
    total_sent: int = strawberry.field(description="Total messages sent")
    delivered: int = strawberry.field(description="Successfully delivered")
    failed: int = strawberry.field(description="Failed deliveries")
    bounced: int = strawberry.field(description="Bounced messages")
    delivery_rate: float = strawberry.field(description="Delivery rate (%)")

    # Engagement metrics
    opened: int = strawberry.field(description="Messages opened")
    clicked: int = strawberry.field(description="Links clicked")
    open_rate: float = strawberry.field(description="Open rate (%)")
    click_rate: float = strawberry.field(description="Click rate (%)")

    # Channel breakdown
    email_sent: int = strawberry.field(description="Emails sent")
    sms_sent: int = strawberry.field(description="SMS sent")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class FileStorageMetrics:
    """File storage metrics."""

    # Storage metrics
    total_files: int = strawberry.field(description="Total files stored")
    total_size_bytes: int = strawberry.field(description="Total storage used (bytes)")
    total_size_mb: float = strawberry.field(description="Total storage used (MB)")

    # Activity metrics
    uploads_count: int = strawberry.field(description="File uploads this period")
    downloads_count: int = strawberry.field(description="File downloads this period")
    deletes_count: int = strawberry.field(description="File deletions this period")

    # File type breakdown
    top_file_types: list[str] = strawberry.field(description="Most common file types")

    # Time period
    period: str = strawberry.field(description="Metrics calculation period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class TimeSeriesDataPoint:
    """Single data point in a time series."""

    timestamp: datetime = strawberry.field(description="Data point timestamp")
    value: float = strawberry.field(description="Metric value")
    label: str | None = strawberry.field(default=None, description="Optional label for this point")


@strawberry.type
class MetricTimeSeries:
    """Time series data for charts and graphs."""

    metric_name: str = strawberry.field(description="Name of the metric")
    data_points: list[TimeSeriesDataPoint] = strawberry.field(description="Time series data points")
    unit: str = strawberry.field(description="Unit of measurement")
    aggregation: str = strawberry.field(description="Aggregation method (sum, avg, count)")


@strawberry.type
class DashboardOverview:
    """Complete dashboard overview - all metrics in one query."""

    billing: BillingMetrics = strawberry.field(description="Billing metrics")
    customers: CustomerMetrics = strawberry.field(description="Customer metrics")
    monitoring: MonitoringMetrics = strawberry.field(description="System monitoring metrics")
    analytics: AnalyticsMetrics | None = strawberry.field(
        default=None, description="Analytics metrics"
    )
    auth: AuthMetrics | None = strawberry.field(default=None, description="Authentication metrics")
    communications: CommunicationsMetrics | None = strawberry.field(
        default=None, description="Communications metrics"
    )
    file_storage: FileStorageMetrics | None = strawberry.field(
        default=None, description="File storage metrics"
    )


@strawberry.type
class InfrastructureServiceStatus:
    """Health status for an individual infrastructure service."""

    name: str = strawberry.field(description="Service name")
    status: str = strawberry.field(description="Service status (healthy/degraded/unhealthy)")
    message: str | None = strawberry.field(
        default=None, description="Optional diagnostic message for the service"
    )


@strawberry.type
class InfrastructureHealth:
    """Overall infrastructure health summary."""

    status: str = strawberry.field(description="Overall health status")
    uptime: float = strawberry.field(description="Overall system uptime percentage")
    services: list[InfrastructureServiceStatus] = strawberry.field(
        description="Individual service health statuses"
    )


@strawberry.type
class ResourceUsageMetrics:
    """Real-time resource usage metrics."""

    cpu_usage: float = strawberry.field(description="CPU usage percentage")
    memory_usage: float = strawberry.field(description="Memory usage percentage")
    disk_usage: float = strawberry.field(description="Disk usage percentage")
    network_in_mb: float = strawberry.field(description="Network ingress (MB)")
    network_out_mb: float = strawberry.field(description="Network egress (MB)")


@strawberry.type
class PerformanceMetricsDetail:
    """Detailed performance metrics for infrastructure."""

    avg_response_time_ms: float = strawberry.field(description="Average response time (ms)")
    p95_response_time_ms: float = strawberry.field(description="P95 response time (ms)")
    p99_response_time_ms: float = strawberry.field(description="P99 response time (ms)")
    total_requests: int = strawberry.field(description="Total requests processed")
    successful_requests: int = strawberry.field(description="Successful requests")
    failed_requests: int = strawberry.field(description="Failed requests")
    requests_per_second: float = strawberry.field(description="Requests per second")
    error_rate: float = strawberry.field(description="Error rate (%)")
    high_latency_requests: int = strawberry.field(description="Requests over 1s latency")
    timeout_count: int = strawberry.field(description="Request timeouts")


@strawberry.type
class LogMetricsSummary:
    """Aggregated log metrics for infrastructure monitoring."""

    total_logs: int = strawberry.field(description="Total logs in period")
    critical_logs: int = strawberry.field(description="Critical severity logs")
    warning_logs: int = strawberry.field(description="Warning severity logs")
    info_logs: int = strawberry.field(description="Informational logs")
    error_rate: float = strawberry.field(description="Error rate based on logs (%)")


@strawberry.type
class InfrastructureMetrics:
    """Comprehensive infrastructure metrics for dashboard."""

    health: InfrastructureHealth = strawberry.field(description="Overall health summary")
    resources: ResourceUsageMetrics = strawberry.field(description="Resource usage metrics")
    performance: PerformanceMetricsDetail = strawberry.field(description="Performance statistics")
    logs: LogMetricsSummary = strawberry.field(description="Log summary metrics")
    period: str = strawberry.field(description="Metrics period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class APIKeyScopeUsage:
    """Usage statistics for API key scopes."""

    scope: str = strawberry.field(description="Scope name")
    count: int = strawberry.field(description="Usage count for the scope")


@strawberry.type
class APIKeyMetrics:
    """API key usage and security metrics."""

    total_keys: int = strawberry.field(description="Total number of API keys")
    active_keys: int = strawberry.field(description="Active keys")
    inactive_keys: int = strawberry.field(description="Inactive keys")
    expired_keys: int = strawberry.field(description="Expired keys")
    keys_created_last_30d: int = strawberry.field(description="Keys created in last 30 days")
    keys_used_last_7d: int = strawberry.field(description="Keys used in last 7 days")
    keys_expiring_soon: int = strawberry.field(description="Keys expiring within 30 days")
    total_api_requests: int = strawberry.field(description="Total API requests made with keys")
    avg_requests_per_key: float = strawberry.field(description="Average requests per key")
    never_used_keys: int = strawberry.field(description="Keys never used")
    keys_without_expiry: int = strawberry.field(description="Keys without expiration date")
    top_scopes: list[APIKeyScopeUsage] = strawberry.field(description="Top scopes by usage")
    period: str = strawberry.field(description="Metrics period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class HighFrequencyUser:
    """User with high secret access frequency."""

    user_id: str = strawberry.field(description="User identifier")
    access_count: int = strawberry.field(description="Number of accesses by the user")


@strawberry.type
class SecretAccessSummary:
    """Summary of secret access counts."""

    secret_path: str = strawberry.field(description="Secret path/name")
    access_count: int = strawberry.field(description="Access count for the secret")


@strawberry.type
class SecretsMetrics:
    """Secrets management metrics."""

    total_secrets_accessed: int = strawberry.field(description="Secrets accessed count")
    total_secrets_created: int = strawberry.field(description="Secrets created count")
    total_secrets_updated: int = strawberry.field(description="Secrets updated count")
    total_secrets_deleted: int = strawberry.field(description="Secrets deleted count")
    unique_secrets_accessed: int = strawberry.field(description="Unique secrets accessed")
    unique_users_accessing: int = strawberry.field(description="Unique users accessing secrets")
    avg_accesses_per_secret: float = strawberry.field(description="Average accesses per secret")
    failed_access_attempts: int = strawberry.field(description="Failed access attempts")
    after_hours_accesses: int = strawberry.field(description="After-hours accesses")
    high_frequency_users: list[HighFrequencyUser] = strawberry.field(
        description="Top users by access count"
    )
    most_accessed_secrets: list[SecretAccessSummary] = strawberry.field(
        description="Top accessed secrets"
    )
    secrets_created_last_7d: int = strawberry.field(description="Secrets created in last 7 days")
    secrets_deleted_last_7d: int = strawberry.field(description="Secrets deleted in last 7 days")
    period: str = strawberry.field(description="Metrics period")
    timestamp: datetime = strawberry.field(description="Metrics generation timestamp")


@strawberry.type
class SecurityOverview:
    """Security metrics overview including auth, API keys, and secrets."""

    auth: AuthMetrics = strawberry.field(description="Authentication metrics")
    api_keys: APIKeyMetrics = strawberry.field(description="API key metrics")
    secrets: SecretsMetrics = strawberry.field(description="Secrets management metrics")
