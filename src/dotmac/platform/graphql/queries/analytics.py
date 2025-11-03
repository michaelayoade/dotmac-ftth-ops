"""
Analytics and metrics GraphQL queries.

Provides GraphQL queries for dashboard data, metrics, and analytics.
Reuses existing REST endpoint logic with caching.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import strawberry
import structlog
from sqlalchemy import select

from dotmac.platform.auth.api_keys_metrics_router import _get_api_key_metrics_cached
from dotmac.platform.auth.metrics_router import _get_auth_metrics_cached
from dotmac.platform.billing.metrics_router import (
    _get_billing_metrics_cached,
    _get_customer_metrics_cached,
)
from dotmac.platform.communications.metrics_router import _get_communication_stats_cached
from dotmac.platform.file_storage.metrics_router import _get_file_stats_cached
from dotmac.platform.file_storage.service import get_storage_service
from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.metrics import (
    APIKeyMetrics,
    APIKeyScopeUsage,
    AuthMetrics,
    BillingMetrics,
    CommunicationsMetrics,
    CustomerMetrics,
    DashboardOverview,
    FileStorageMetrics,
    HighFrequencyUser,
    InfrastructureHealth,
    InfrastructureMetrics,
    InfrastructureServiceStatus,
    LogMetricsSummary,
    MonitoringMetrics,
    PerformanceMetricsDetail,
    ResourceUsageMetrics,
    SecretAccessSummary,
    SecretsMetrics,
    SecurityOverview,
)
from dotmac.platform.monitoring.health_checks import HealthChecker
from dotmac.platform.monitoring.metrics_router import (
    _get_log_stats_cached,
    _get_monitoring_metrics_cached,
)
from dotmac.platform.secrets.metrics_router import _get_secrets_metrics_cached

logger = structlog.get_logger(__name__)


@strawberry.type
class AnalyticsQueries:
    """Analytics and metrics queries optimized for dashboards and charts."""

    @strawberry.field(description="Get billing overview metrics")  # type: ignore[misc]
    async def billing_metrics(
        self,
        info: strawberry.Info[Context],
        period: str = "30d",
    ) -> BillingMetrics:
        """
        Get billing metrics including MRR, ARR, invoices, and payments.

        Args:
            period: Time period for metrics (e.g., "7d", "30d", "90d")

        Returns:
            BillingMetrics with revenue and payment data
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Parse period to days
        period_days = int(period.replace("d", ""))

        # Reuse existing cached service
        result = await _get_billing_metrics_cached(
            period_days=period_days,
            tenant_id=info.context.current_user.tenant_id,
            session=info.context.db,
        )

        return BillingMetrics(**result)

    @strawberry.field(description="Get customer analytics metrics")  # type: ignore[misc]
    async def customer_metrics(
        self,
        info: strawberry.Info[Context],
        period: str = "30d",
    ) -> CustomerMetrics:
        """
        Get customer metrics including growth, churn, and retention rates.

        Args:
            period: Time period for metrics (e.g., "7d", "30d", "90d")

        Returns:
            CustomerMetrics with customer analytics
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        period_days = int(period.replace("d", ""))

        # Reuse existing cached service
        result = await _get_customer_metrics_cached(
            period_days=period_days,
            tenant_id=info.context.current_user.tenant_id,
            session=info.context.db,
        )

        # Calculate additional fields needed for GraphQL type
        total_value = result.get("active_customers", 0) * 1000  # Placeholder calculation
        avg_value = total_value / max(result.get("total_customers", 1), 1)

        return CustomerMetrics(
            total_customers=result["total_customers"],
            active_customers=result["active_customers"],
            new_customers=result["new_customers_this_month"],
            churned_customers=result["churned_customers_this_month"],
            customer_growth_rate=result["customer_growth_rate"],
            churn_rate=result["churn_rate"],
            retention_rate=100 - result["churn_rate"],
            average_customer_value=avg_value,
            total_customer_value=total_value,
            period=result["period"],
            timestamp=result["timestamp"],
        )

    @strawberry.field(description="Get system monitoring metrics")  # type: ignore[misc]
    async def monitoring_metrics(
        self,
        info: strawberry.Info[Context],
        period: str = "1h",
    ) -> MonitoringMetrics:
        """
        Get system health and monitoring metrics.

        Args:
            period: Time period for metrics (e.g., "1h", "24h", "7d")

        Returns:
            MonitoringMetrics with system health data
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Calculate period boundaries
        now = datetime.now(UTC)
        if period.endswith("h"):
            hours = int(period.replace("h", ""))
            period_start = now - timedelta(hours=hours)
        else:
            days = int(period.replace("d", ""))
            period_start = now - timedelta(days=days)

        # Query audit logs for monitoring data
        from sqlalchemy import case, func

        from dotmac.platform.audit.models import ActivitySeverity, ActivityType, AuditActivity

        # Query activity counts and error rates
        activity_query = select(
            func.count(AuditActivity.id).label("total"),
            func.sum(
                case(
                    (AuditActivity.severity == ActivitySeverity.CRITICAL, 1),
                    else_=0,
                )
            ).label("critical"),
            func.sum(
                case(
                    (AuditActivity.severity == ActivitySeverity.HIGH, 1),
                    else_=0,
                )
            ).label("warnings"),
            func.sum(
                case(
                    (AuditActivity.activity_type == ActivityType.API_REQUEST, 1),
                    else_=0,
                )
            ).label("api_requests"),
            func.sum(
                case(
                    (AuditActivity.activity_type.like("user.%"), 1),
                    else_=0,
                )
            ).label("user_activities"),
            func.sum(
                case(
                    (AuditActivity.activity_type.like("system.%"), 1),
                    else_=0,
                )
            ).label("system_activities"),
        ).where(AuditActivity.created_at >= period_start)

        if info.context.current_user.tenant_id:
            activity_query = activity_query.where(
                AuditActivity.tenant_id == info.context.current_user.tenant_id
            )

        result = await info.context.db.execute(activity_query)
        row = result.one()

        total_requests = row.total or 0
        critical_errors = row.critical or 0
        warnings = row.warnings or 0

        # Calculate error rate
        error_rate = (critical_errors / max(total_requests, 1)) * 100

        # Placeholder performance metrics (would come from OpenTelemetry in production)
        return MonitoringMetrics(
            error_rate=round(error_rate, 2),
            critical_errors=critical_errors,
            warning_count=warnings,
            avg_response_time_ms=125.5,  # Placeholder
            p95_response_time_ms=250.0,  # Placeholder
            p99_response_time_ms=500.0,  # Placeholder
            total_requests=total_requests,
            successful_requests=total_requests - critical_errors,
            failed_requests=critical_errors,
            api_requests=row.api_requests or 0,
            user_activities=row.user_activities or 0,
            system_activities=row.system_activities or 0,
            high_latency_requests=0,  # Placeholder
            timeout_count=0,  # Placeholder
            period=period,
            timestamp=now,
        )

    @strawberry.field(description="Get complete dashboard overview in one query")  # type: ignore[misc]
    async def dashboard_overview(
        self,
        info: strawberry.Info[Context],
        period: str = "30d",
    ) -> DashboardOverview:
        """
        Get all dashboard metrics in a single optimized query.

        This is the power of GraphQL - fetch all related data in one request
        with parallel execution.

        Args:
            period: Time period for metrics

        Returns:
            DashboardOverview with all metrics
        """
        if not info.context.current_user:
            raise Exception("Authentication required")

        # Determine cache period in days for helper functions
        if period.endswith("h"):
            hours = int(period.replace("h", ""))
            period_days = max(1, hours // 24) or 1
        else:
            period_days = int(period.replace("d", ""))

        tenant_id = info.context.current_user.tenant_id
        storage_service = get_storage_service()

        (
            billing_data,
            customer_data,
            communications_data,
            file_data,
            auth_data,
            monitoring_data,
        ) = await asyncio.gather(
            _get_billing_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_customer_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_communication_stats_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_file_stats_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                storage_service=storage_service,
            ),
            _get_auth_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_monitoring_metrics_cached(
                period_days=max(period_days, 1),
                tenant_id=tenant_id,
                session=info.context.db,
            ),
        )

        billing = BillingMetrics(**billing_data)

        customer_total_value = customer_data.get("active_customers", 0) * 1000
        customers = CustomerMetrics(
            total_customers=customer_data["total_customers"],
            active_customers=customer_data["active_customers"],
            new_customers=customer_data["new_customers_this_month"],
            churned_customers=customer_data["churned_customers_this_month"],
            customer_growth_rate=customer_data["customer_growth_rate"],
            churn_rate=customer_data["churn_rate"],
            retention_rate=100 - customer_data["churn_rate"],
            average_customer_value=customer_total_value / max(customer_data["total_customers"], 1),
            total_customer_value=customer_total_value,
            period=customer_data["period"],
            timestamp=customer_data["timestamp"],
        )

        monitoring = MonitoringMetrics(
            error_rate=round(monitoring_data["error_rate"], 2),
            critical_errors=monitoring_data["critical_errors"],
            warning_count=monitoring_data["warning_count"],
            avg_response_time_ms=monitoring_data["avg_response_time_ms"],
            p95_response_time_ms=monitoring_data["p95_response_time_ms"],
            p99_response_time_ms=monitoring_data["p99_response_time_ms"],
            total_requests=monitoring_data["total_requests"],
            successful_requests=monitoring_data["successful_requests"],
            failed_requests=monitoring_data["failed_requests"],
            api_requests=monitoring_data["api_requests"],
            user_activities=monitoring_data["user_activities"],
            system_activities=monitoring_data["system_activities"],
            high_latency_requests=monitoring_data["high_latency_requests"],
            timeout_count=monitoring_data["timeout_count"],
            period=monitoring_data["period"],
            timestamp=monitoring_data["timestamp"],
        )

        communications_metrics = CommunicationsMetrics(
            total_sent=communications_data.get("total_sent", 0),
            delivered=communications_data.get("total_delivered", 0),
            failed=communications_data.get("total_failed", 0),
            bounced=communications_data.get("total_bounced", 0),
            delivery_rate=communications_data.get("delivery_rate", 0.0),
            opened=communications_data.get("total_delivered", 0),
            clicked=communications_data.get("total_sent", 0),
            open_rate=communications_data.get("open_rate", 0.0),
            click_rate=communications_data.get("click_rate", 0.0),
            email_sent=communications_data.get("emails_sent", 0),
            sms_sent=communications_data.get("sms_sent", 0),
            period=communications_data.get("period", f"{period_days}d"),
            timestamp=communications_data.get("timestamp", datetime.now(UTC)),
        )

        file_type_counts = [
            ("Images", file_data.get("images_count", 0)),
            ("Documents", file_data.get("documents_count", 0)),
            ("Videos", file_data.get("videos_count", 0)),
            ("Other", file_data.get("other_count", 0)),
        ]
        top_file_types = [
            label
            for label, count in sorted(file_type_counts, key=lambda item: item[1], reverse=True)
            if count > 0
        ]

        file_storage_metrics = FileStorageMetrics(
            total_files=file_data.get("total_files", 0),
            total_size_bytes=int(file_data.get("total_size_bytes", 0)),
            total_size_mb=float(file_data.get("total_size_mb", 0.0)),
            uploads_count=file_data.get("total_files", 0),
            downloads_count=0,
            deletes_count=0,
            top_file_types=top_file_types,
            period=file_data.get("period", f"{period_days}d"),
            timestamp=file_data.get("timestamp", datetime.now(UTC)),
        )

        auth_metrics = AuthMetrics(
            total_logins=auth_data.get("total_logins", 0),
            successful_logins=auth_data.get("successful_logins", 0),
            failed_logins=auth_data.get("failed_logins", 0),
            login_success_rate=auth_data.get("login_success_rate", 0.0),
            active_users=auth_data.get("active_users", 0),
            new_users=auth_data.get("new_users_this_period", 0),
            mfa_enabled_users=auth_data.get("mfa_enabled_users", 0),
            mfa_adoption_rate=auth_data.get("mfa_adoption_rate", 0.0),
            password_resets=auth_data.get("password_reset_requests", 0),
            suspicious_activities=auth_data.get("account_lockouts", 0),
            period=auth_data.get("period", f"{period_days}d"),
            timestamp=auth_data.get("timestamp", datetime.now(UTC)),
        )

        return DashboardOverview(
            billing=billing,
            customers=customers,
            monitoring=monitoring,
            analytics=None,
            auth=auth_metrics,
            communications=communications_metrics,
            file_storage=file_storage_metrics,
        )

    @strawberry.field(description="Get security metrics overview")  # type: ignore[misc]
    async def security_metrics(
        self,
        info: strawberry.Info[Context],
        period: str = "30d",
    ) -> SecurityOverview:
        """Return authentication, API key, and secrets metrics."""
        if not info.context.current_user:
            raise Exception("Authentication required")

        period_days = int(period.replace("d", ""))
        tenant_id = info.context.current_user.tenant_id

        auth_data, api_keys_data, secrets_data = await asyncio.gather(
            _get_auth_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_api_key_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
            ),
            _get_secrets_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
        )

        auth_metrics = AuthMetrics(
            total_logins=auth_data.get("total_logins", 0),
            successful_logins=auth_data.get("successful_logins", 0),
            failed_logins=auth_data.get("failed_logins", 0),
            login_success_rate=auth_data.get("login_success_rate", 0.0),
            active_users=auth_data.get("active_users", 0),
            new_users=auth_data.get("new_users_this_period", 0),
            mfa_enabled_users=auth_data.get("mfa_enabled_users", 0),
            mfa_adoption_rate=auth_data.get("mfa_adoption_rate", 0.0),
            password_resets=auth_data.get("password_reset_requests", 0),
            suspicious_activities=auth_data.get("account_lockouts", 0),
            period=auth_data.get("period", f"{period_days}d"),
            timestamp=auth_data.get("timestamp", datetime.now(UTC)),
        )

        top_scopes = [
            APIKeyScopeUsage(scope=item.get("scope", ""), count=item.get("count", 0))
            for item in api_keys_data.get("top_scopes", [])
        ]
        api_key_metrics = APIKeyMetrics(
            total_keys=api_keys_data.get("total_keys", 0),
            active_keys=api_keys_data.get("active_keys", 0),
            inactive_keys=api_keys_data.get("inactive_keys", 0),
            expired_keys=api_keys_data.get("expired_keys", 0),
            keys_created_last_30d=api_keys_data.get("keys_created_last_30d", 0),
            keys_used_last_7d=api_keys_data.get("keys_used_last_7d", 0),
            keys_expiring_soon=api_keys_data.get("keys_expiring_soon", 0),
            total_api_requests=api_keys_data.get("total_api_requests", 0),
            avg_requests_per_key=api_keys_data.get("avg_requests_per_key", 0.0),
            never_used_keys=api_keys_data.get("never_used_keys", 0),
            keys_without_expiry=api_keys_data.get("keys_without_expiry", 0),
            top_scopes=top_scopes,
            period=api_keys_data.get("period", f"{period_days}d"),
            timestamp=api_keys_data.get("timestamp", datetime.now(UTC)),
        )

        high_frequency_users = [
            HighFrequencyUser(
                user_id=str(item.get("user_id") or ""),
                access_count=item.get("access_count", 0),
            )
            for item in secrets_data.get("high_frequency_users", [])
        ]
        most_accessed_secrets = [
            SecretAccessSummary(
                secret_path=str(item.get("secret_path") or ""),
                access_count=item.get("access_count", 0),
            )
            for item in secrets_data.get("most_accessed_secrets", [])
        ]
        secrets_metrics = SecretsMetrics(
            total_secrets_accessed=secrets_data.get("total_secrets_accessed", 0),
            total_secrets_created=secrets_data.get("total_secrets_created", 0),
            total_secrets_updated=secrets_data.get("total_secrets_updated", 0),
            total_secrets_deleted=secrets_data.get("total_secrets_deleted", 0),
            unique_secrets_accessed=secrets_data.get("unique_secrets_accessed", 0),
            unique_users_accessing=secrets_data.get("unique_users_accessing", 0),
            avg_accesses_per_secret=secrets_data.get("avg_accesses_per_secret", 0.0),
            failed_access_attempts=secrets_data.get("failed_access_attempts", 0),
            after_hours_accesses=secrets_data.get("after_hours_accesses", 0),
            high_frequency_users=high_frequency_users,
            most_accessed_secrets=most_accessed_secrets,
            secrets_created_last_7d=secrets_data.get("secrets_created_last_7d", 0),
            secrets_deleted_last_7d=secrets_data.get("secrets_deleted_last_7d", 0),
            period=secrets_data.get("period", f"{period_days}d"),
            timestamp=secrets_data.get("timestamp", datetime.now(UTC)),
        )

        return SecurityOverview(
            auth=auth_metrics,
            api_keys=api_key_metrics,
            secrets=secrets_metrics,
        )

    @strawberry.field(description="Get infrastructure metrics overview")  # type: ignore[misc]
    async def infrastructure_metrics(
        self,
        info: strawberry.Info[Context],
        period: str = "1d",
    ) -> InfrastructureMetrics:
        """Return infrastructure health, resource, performance, and log data."""
        if not info.context.current_user:
            raise Exception("Authentication required")

        period_days = int(period.replace("d", "")) if period.endswith("d") else 1
        tenant_id = info.context.current_user.tenant_id

        monitoring_data, logs_data = await asyncio.gather(
            _get_monitoring_metrics_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
            _get_log_stats_cached(
                period_days=period_days,
                tenant_id=tenant_id,
                session=info.context.db,
            ),
        )

        # Health summary
        checker = HealthChecker()
        summary = checker.get_summary()
        services = [
            InfrastructureServiceStatus(
                name=service.get("name", ""),
                status=service.get("status", ""),
                message=service.get("message"),
            )
            for service in summary.get("services", [])
        ]
        overall_status = "healthy" if summary.get("healthy", False) else "degraded"

        health = InfrastructureHealth(
            status=overall_status,
            uptime=100.0 if summary.get("healthy") else 90.0,
            services=services,
        )

        # Resource metrics using psutil
        try:
            import psutil

            cpu_usage = float(psutil.cpu_percent(interval=0.5))
            memory_usage = float(psutil.virtual_memory().percent)
            disk_usage = float(psutil.disk_usage("/").percent)
            net_io = psutil.net_io_counters()
            network_in_mb = round(net_io.bytes_recv / (1024 * 1024), 2)
            network_out_mb = round(net_io.bytes_sent / (1024 * 1024), 2)
        except Exception:
            cpu_usage = memory_usage = disk_usage = network_in_mb = network_out_mb = 0.0

        resources = ResourceUsageMetrics(
            cpu_usage=cpu_usage,
            memory_usage=memory_usage,
            disk_usage=disk_usage,
            network_in_mb=network_in_mb,
            network_out_mb=network_out_mb,
        )

        # Performance metrics
        total_requests = monitoring_data.get("total_requests", 0)
        time_window_seconds = max(period_days, 1) * 24 * 60 * 60
        requests_per_second = (
            total_requests / time_window_seconds if time_window_seconds > 0 else 0.0
        )

        performance = PerformanceMetricsDetail(
            avg_response_time_ms=monitoring_data.get("avg_response_time_ms", 0.0),
            p95_response_time_ms=monitoring_data.get("p95_response_time_ms", 0.0),
            p99_response_time_ms=monitoring_data.get("p99_response_time_ms", 0.0),
            total_requests=total_requests,
            successful_requests=monitoring_data.get("successful_requests", 0),
            failed_requests=monitoring_data.get("failed_requests", 0),
            requests_per_second=round(requests_per_second, 2),
            error_rate=monitoring_data.get("error_rate", 0.0),
            high_latency_requests=monitoring_data.get("high_latency_requests", 0),
            timeout_count=monitoring_data.get("timeout_count", 0),
        )

        warning_logs = logs_data.get("high_logs", 0) + logs_data.get("medium_logs", 0)
        log_error_rate = (
            (logs_data.get("error_logs", 0) / max(logs_data.get("total_logs", 1), 1)) * 100
            if logs_data.get("total_logs")
            else 0.0
        )
        logs_summary = LogMetricsSummary(
            total_logs=logs_data.get("total_logs", 0),
            critical_logs=logs_data.get("critical_logs", 0),
            warning_logs=warning_logs,
            info_logs=logs_data.get("low_logs", 0),
            error_rate=round(log_error_rate, 2),
        )

        return InfrastructureMetrics(
            health=health,
            resources=resources,
            performance=performance,
            logs=logs_summary,
            period=f"{period_days}d",
            timestamp=monitoring_data.get("timestamp", datetime.now(UTC)),
        )
