"""
Diagnostics Service.

Network troubleshooting and diagnostic operations for ISP services.
"""

from collections.abc import Awaitable
from datetime import datetime, timedelta, timezone
from decimal import Decimal

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = timezone.utc
from typing import TYPE_CHECKING, Any
from uuid import UUID

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.diagnostics.models import (
    DiagnosticRun,
    DiagnosticSeverity,
    DiagnosticStatus,
    DiagnosticType,
)
from dotmac.platform.settings import settings

# Optional TimescaleDB imports
try:
    from dotmac.platform.timeseries import TimeSeriesSessionLocal
    from dotmac.platform.timeseries.repository import RadiusTimeSeriesRepository

    TIMESCALEDB_AVAILABLE = True
except ImportError:
    TIMESCALEDB_AVAILABLE = False

if TYPE_CHECKING:
    from dotmac.platform.genieacs.service import GenieACSService
    from dotmac.platform.netbox.service import NetBoxService
    from dotmac.platform.radius.service import RADIUSService
    from dotmac.platform.subscribers.models import Subscriber
    from dotmac.platform.voltha.service import VOLTHAService

logger = structlog.get_logger(__name__)


class DiagnosticsService:
    """Service for network diagnostics and troubleshooting."""

    def __init__(
        self,
        db: AsyncSession,
        radius_service: "RADIUSService | None" = None,
        netbox_service: "NetBoxService | None" = None,
        voltha_service: "VOLTHAService | None" = None,
        genieacs_service: "GenieACSService | None" = None,
    ):
        """Initialize diagnostics service."""
        self.db = db

        # Import at runtime to avoid circular imports
        if radius_service is None:
            from dotmac.platform.radius.service import RADIUSService

            self.radius_service = RADIUSService(db)
        else:
            self.radius_service = radius_service

        if netbox_service is None:
            from dotmac.platform.netbox.service import NetBoxService

            self.netbox_service = NetBoxService()
        else:
            self.netbox_service = netbox_service

        if voltha_service is None:
            from dotmac.platform.voltha.service import VOLTHAService

            self.voltha_service = VOLTHAService()
        else:
            self.voltha_service = voltha_service

        if genieacs_service is None:
            from dotmac.platform.genieacs.service import GenieACSService

            self.genieacs_service = GenieACSService()
        else:
            self.genieacs_service = genieacs_service

    async def _get_subscriber(self, tenant_id: str, subscriber_id: str) -> "Subscriber":
        """Get subscriber by ID."""
        from dotmac.platform.subscribers.models import Subscriber

        stmt = select(Subscriber).where(
            Subscriber.tenant_id == tenant_id,
            Subscriber.id == subscriber_id,
            Subscriber.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        subscriber = result.scalar_one_or_none()

        if not subscriber:
            raise ValueError(f"Subscriber {subscriber_id} not found")

        return subscriber

    async def _create_diagnostic_run(
        self,
        tenant_id: str,
        diagnostic_type: DiagnosticType,
        subscriber_id: str | None = None,
        customer_id: UUID | None = None,
        created_by_id: UUID | None = None,
    ) -> DiagnosticRun:
        """Create a new diagnostic run."""
        diagnostic = DiagnosticRun(
            tenant_id=tenant_id,
            diagnostic_type=diagnostic_type,
            status=DiagnosticStatus.PENDING,
            subscriber_id=subscriber_id,
            customer_id=customer_id,
            created_by_id=created_by_id,
        )
        self.db.add(diagnostic)
        await self.db.flush()
        return diagnostic

    async def _update_diagnostic_run(
        self,
        diagnostic: DiagnosticRun,
        status: DiagnosticStatus,
        success: bool = False,
        results: dict[str, Any] | None = None,
        recommendations: list[dict[str, Any]] | None = None,
        error_message: str | None = None,
        severity: DiagnosticSeverity | None = None,
    ) -> DiagnosticRun:
        """Update diagnostic run with results."""
        diagnostic.status = status
        diagnostic.success = success

        if results is not None:
            diagnostic.results = results

        if recommendations is not None:
            diagnostic.recommendations = recommendations

        if error_message is not None:
            diagnostic.error_message = error_message

        if severity is not None:
            diagnostic.severity = severity

        if status == DiagnosticStatus.RUNNING and diagnostic.started_at is None:
            diagnostic.started_at = datetime.now(UTC)

        if status in (
            DiagnosticStatus.COMPLETED,
            DiagnosticStatus.FAILED,
            DiagnosticStatus.TIMEOUT,
        ):
            diagnostic.completed_at = datetime.now(UTC)
            if diagnostic.started_at:
                delta = diagnostic.completed_at - diagnostic.started_at
                diagnostic.duration_ms = int(delta.total_seconds() * 1000)

        # Generate summary
        if status == DiagnosticStatus.COMPLETED:
            diagnostic.summary = self._generate_summary(diagnostic.diagnostic_type, results or {})

        await self.db.flush()
        return diagnostic

    def _generate_summary(self, diagnostic_type: DiagnosticType, results: dict[str, Any]) -> str:
        """Generate human-readable summary of diagnostic results."""
        if diagnostic_type == DiagnosticType.CONNECTIVITY_CHECK:
            return f"Connectivity: {results.get('status', 'unknown').upper()}"
        elif diagnostic_type == DiagnosticType.RADIUS_SESSION:
            sessions = results.get("active_sessions", 0)
            return f"{sessions} active RADIUS session(s)"
        elif diagnostic_type == DiagnosticType.ONU_STATUS:
            signal = results.get("optical_signal_level", "N/A")
            return f"ONU Signal: {signal} dBm"
        elif diagnostic_type == DiagnosticType.CPE_STATUS:
            status = results.get("status", "unknown")
            return f"CPE Status: {status.upper()}"
        elif diagnostic_type == DiagnosticType.HEALTH_CHECK:
            checks_passed = results.get("checks_passed", 0)
            total_checks = results.get("total_checks", 0)
            return f"Health: {checks_passed}/{total_checks} checks passed"
        elif diagnostic_type == DiagnosticType.BANDWIDTH_TEST:
            download = results.get("download_mbps", 0)
            upload = results.get("upload_mbps", 0)
            return f"Bandwidth: {download:.1f}/{upload:.1f} Mbps (down/up)"
        else:
            return f"{diagnostic_type.value} completed"

    async def check_subscriber_connectivity(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Check overall subscriber connectivity status."""
        from dotmac.platform.subscribers.models import SubscriberStatus

        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.CONNECTIVITY_CHECK,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            results: dict[str, Any] = {
                "subscriber_status": subscriber.status.value,
                "username": subscriber.username,
                "checks": {},
            }
            recommendations: list[dict[str, Any]] = []

            # Check subscriber status
            if subscriber.status != SubscriberStatus.ACTIVE:
                results["status"] = "inactive"
                results["checks"]["subscriber_active"] = False
                recommendations.append(
                    {
                        "severity": "error",
                        "message": f"Subscriber status is {subscriber.status.value}, expected active",
                        "action": "Activate subscriber to restore service",
                    }
                )
                severity = DiagnosticSeverity.ERROR
            else:
                results["status"] = "online"
                results["checks"]["subscriber_active"] = True
                severity = DiagnosticSeverity.INFO

            # Check RADIUS authentication
            try:
                radius_check = await self.radius_service.get_subscriber_auth(
                    tenant_id, subscriber_id
                )
                if radius_check:
                    results["checks"]["radius_auth"] = True
                else:
                    results["checks"]["radius_auth"] = False
                    recommendations.append(
                        {
                            "severity": "error",
                            "message": "RADIUS authentication not configured",
                            "action": "Create RADIUS authentication entry",
                        }
                    )
                    severity = DiagnosticSeverity.ERROR
            except Exception as e:
                logger.warning("RADIUS check failed", error=str(e))
                results["checks"]["radius_auth"] = False

            # Check IP allocation
            if subscriber.static_ipv4:
                results["checks"]["ip_allocated"] = True
                results["ip_address"] = str(subscriber.static_ipv4)
            else:
                results["checks"]["ip_allocated"] = False
                recommendations.append(
                    {
                        "severity": "warning",
                        "message": "No static IP allocated",
                        "action": "Allocate static IP from NetBox",
                    }
                )
                if severity == DiagnosticSeverity.INFO:
                    severity = DiagnosticSeverity.WARNING

            # Check last online
            if subscriber.last_online:
                delta = datetime.now(UTC) - subscriber.last_online.replace(tzinfo=UTC)
                results["last_seen_seconds"] = int(delta.total_seconds())
                results["last_seen_hours"] = delta.total_seconds() / 3600

                if delta.total_seconds() > 86400:  # 24 hours
                    recommendations.append(
                        {
                            "severity": "warning",
                            "message": f"Subscriber last seen {delta.days} days ago",
                            "action": "Check physical connectivity and CPE status",
                        }
                    )
            else:
                results["last_seen_seconds"] = None
                recommendations.append(
                    {
                        "severity": "info",
                        "message": "Subscriber has never connected",
                        "action": "Verify installation and configuration",
                    }
                )

            # Get usage statistics from TimescaleDB
            usage_stats = await self._get_usage_statistics(tenant_id, subscriber.id, lookback_days=7)
            results["usage_statistics"] = usage_stats

            # Add usage-based recommendations
            if usage_stats.get("available"):
                trend = usage_stats.get("trend")
                if trend == "increasing_rapidly":
                    recommendations.append(
                        {
                            "severity": "info",
                            "message": f"Bandwidth usage increased significantly (avg: {usage_stats.get('avg_daily_bandwidth_gb', 0):.1f} GB/day)",
                            "action": "Monitor for data cap issues or consider plan upgrade",
                        }
                    )
                elif trend == "decreasing" and usage_stats.get("total_bandwidth_gb", 0) > 0:
                    recommendations.append(
                        {
                            "severity": "info",
                            "message": "Bandwidth usage has decreased significantly",
                            "action": "May indicate connectivity issues or reduced service usage",
                        }
                    )

                # Check for very high usage
                if usage_stats.get("avg_daily_bandwidth_gb", 0) > 50:
                    recommendations.append(
                        {
                            "severity": "info",
                            "message": f"High bandwidth usage detected ({usage_stats.get('avg_daily_bandwidth_gb', 0):.1f} GB/day avg)",
                            "action": "Subscriber may benefit from higher speed tier or unlimited plan",
                        }
                    )

            success = all(results["checks"].values())

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=success,
                results=results,
                recommendations=recommendations,
                severity=severity,
            )

        except Exception as e:
            logger.error("Connectivity check failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def get_radius_sessions(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Get active RADIUS sessions for subscriber."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.RADIUS_SESSION,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            # Get active sessions
            sessions = await self.radius_service.get_active_sessions(tenant_id, subscriber.username)

            results: dict[str, Any] = {
                "username": subscriber.username,
                "active_sessions": len(sessions),
                "sessions": sessions,
                "simultaneous_use_limit": subscriber.simultaneous_use,
            }
            recommendations: list[dict[str, Any]] = []

            # Check for issues
            if len(sessions) == 0:
                recommendations.append(
                    {
                        "severity": "warning",
                        "message": "No active RADIUS sessions",
                        "action": "Subscriber may be offline or unable to authenticate",
                    }
                )
                severity = DiagnosticSeverity.WARNING
            elif len(sessions) > subscriber.simultaneous_use:
                recommendations.append(
                    {
                        "severity": "error",
                        "message": f"Too many concurrent sessions ({len(sessions)} > {subscriber.simultaneous_use})",
                        "action": "Check for credential sharing or increase simultaneous_use limit",
                    }
                )
                severity = DiagnosticSeverity.ERROR
            else:
                severity = DiagnosticSeverity.INFO

            # Get usage statistics from TimescaleDB
            usage_stats = await self._get_usage_statistics(tenant_id, subscriber.id, lookback_days=7)
            results["usage_statistics"] = usage_stats

            # Correlate session issues with usage patterns
            if usage_stats.get("available"):
                # If no sessions but recent usage data, may indicate new issue
                if len(sessions) == 0 and usage_stats.get("total_bandwidth_gb", 0) > 0:
                    recommendations.append(
                        {
                            "severity": "warning",
                            "message": f"Recent usage detected ({usage_stats.get('total_bandwidth_gb', 0):.1f} GB in last 7 days) but no current session",
                            "action": "Possible authentication failure or recent service disruption",
                        }
                    )

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=True,
                results=results,
                recommendations=recommendations,
                severity=severity,
            )

        except Exception as e:
            logger.error("RADIUS session check failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def check_onu_status(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Check ONU status via VOLTHA."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.ONU_STATUS,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            if not subscriber.onu_serial:
                raise ValueError("No ONU serial number configured for subscriber")

            # Get ONU status from VOLTHA
            onu_status = await self.voltha_service.get_onu_status(subscriber.onu_serial)

            results: dict[str, Any] = {
                "onu_serial": subscriber.onu_serial,
                "onu_status": onu_status.get("status", "unknown"),
                "optical_signal_level": onu_status.get("optical_signal_level"),
                "firmware_version": onu_status.get("firmware_version"),
                "registration_id": onu_status.get("registration_id"),
                "operational_state": onu_status.get("operational_state"),
            }
            recommendations: list[dict[str, Any]] = []

            # Analyze signal level
            signal_level = onu_status.get("optical_signal_level")
            if signal_level is not None:
                if signal_level < -28:
                    recommendations.append(
                        {
                            "severity": "critical",
                            "message": f"Very weak optical signal ({signal_level} dBm)",
                            "action": "Check fiber connection and splitter losses",
                        }
                    )
                    severity = DiagnosticSeverity.CRITICAL
                elif signal_level < -25:
                    recommendations.append(
                        {
                            "severity": "warning",
                            "message": f"Weak optical signal ({signal_level} dBm)",
                            "action": "Monitor signal quality",
                        }
                    )
                    severity = DiagnosticSeverity.WARNING
                else:
                    severity = DiagnosticSeverity.INFO
            else:
                severity = DiagnosticSeverity.WARNING

            # Check operational state
            if onu_status.get("operational_state") != "active":
                recommendations.append(
                    {
                        "severity": "error",
                        "message": f"ONU not operational (state: {onu_status.get('operational_state')})",
                        "action": "Check ONU power and fiber connection",
                    }
                )
                severity = DiagnosticSeverity.ERROR

            success = onu_status.get("operational_state") == "active" and (
                signal_level is None or signal_level >= -25
            )

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=success,
                results=results,
                recommendations=recommendations,
                severity=severity,
            )

        except Exception as e:
            logger.error("ONU status check failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def check_cpe_status(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Check CPE status via GenieACS."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.CPE_STATUS,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            if not subscriber.cpe_mac_address:
                raise ValueError("No CPE MAC address configured for subscriber")

            # Get CPE status from GenieACS
            cpe_status = await self.genieacs_service.get_device_status(subscriber.cpe_mac_address)

            results: dict[str, Any] = {
                "cpe_mac": subscriber.cpe_mac_address,
                "status": cpe_status.get("status", "unknown"),
                "last_inform": cpe_status.get("last_inform"),
                "firmware_version": cpe_status.get("firmware_version"),
                "model": cpe_status.get("model"),
                "uptime": cpe_status.get("uptime"),
                "wan_ip": cpe_status.get("wan_ip"),
                "wifi_enabled": cpe_status.get("wifi_enabled"),
            }
            recommendations: list[dict[str, Any]] = []

            # Check last inform time
            last_inform = cpe_status.get("last_inform")
            if last_inform:
                try:
                    last_inform_dt = datetime.fromisoformat(last_inform)
                    delta = datetime.now(UTC) - last_inform_dt.replace(tzinfo=UTC)
                    results["last_inform_seconds"] = int(delta.total_seconds())

                    if delta.total_seconds() > 3600:  # 1 hour
                        recommendations.append(
                            {
                                "severity": "warning",
                                "message": f"CPE last contacted server {int(delta.total_seconds() / 60)} minutes ago",
                                "action": "Check CPE connectivity",
                            }
                        )
                        severity = DiagnosticSeverity.WARNING
                    else:
                        severity = DiagnosticSeverity.INFO
                except Exception:
                    severity = DiagnosticSeverity.WARNING
            else:
                recommendations.append(
                    {
                        "severity": "error",
                        "message": "CPE has never contacted server",
                        "action": "Verify CPE configuration and internet connectivity",
                    }
                )
                severity = DiagnosticSeverity.ERROR

            # Check firmware
            if cpe_status.get("firmware_outdated"):
                recommendations.append(
                    {
                        "severity": "info",
                        "message": "CPE firmware is outdated",
                        "action": "Schedule firmware upgrade",
                    }
                )

            success = cpe_status.get("status") == "online"

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=success,
                results=results,
                recommendations=recommendations,
                severity=severity,
            )

        except Exception as e:
            logger.error("CPE status check failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def verify_ip_allocation(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Verify IP allocation in NetBox."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.IP_VERIFICATION,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            results: dict[str, Any] = {
                "subscriber_ip": str(subscriber.static_ipv4) if subscriber.static_ipv4 else None,
                "subscriber_ipv6": subscriber.ipv6_prefix,
            }
            recommendations: list[dict[str, Any]] = []

            # Check NetBox IP allocation
            if subscriber.netbox_ip_id:
                netbox_ip = await self.netbox_service.get_ip_address(subscriber.netbox_ip_id)
                results["netbox_ip"] = netbox_ip.get("address")
                results["netbox_status"] = netbox_ip.get("status")
                results["netbox_vrf"] = netbox_ip.get("vrf")

                # Verify consistency
                if subscriber.static_ipv4 and str(subscriber.static_ipv4) != netbox_ip.get(
                    "address"
                ):
                    recommendations.append(
                        {
                            "severity": "error",
                            "message": "IP mismatch between subscriber and NetBox",
                            "action": f"Update subscriber IP to {netbox_ip.get('address')} or fix NetBox",
                        }
                    )
                    severity = DiagnosticSeverity.ERROR
                    success = False
                else:
                    severity = DiagnosticSeverity.INFO
                    success = True
            elif subscriber.static_ipv4:
                recommendations.append(
                    {
                        "severity": "warning",
                        "message": "IP configured but not tracked in NetBox",
                        "action": "Create NetBox IP allocation record",
                    }
                )
                severity = DiagnosticSeverity.WARNING
                success = False
            else:
                recommendations.append(
                    {
                        "severity": "info",
                        "message": "No static IP allocated",
                        "action": "Allocate IP if required for service",
                    }
                )
                severity = DiagnosticSeverity.INFO
                success = True

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=success,
                results=results,
                recommendations=recommendations,
                severity=severity,
            )

        except Exception as e:
            logger.error("IP verification failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def restart_cpe(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Restart CPE device."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.CPE_RESTART,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            if not subscriber.cpe_mac_address:
                raise ValueError("No CPE MAC address configured for subscriber")

            # Trigger CPE reboot via GenieACS
            reboot_result = await self.genieacs_service.reboot_device(subscriber.cpe_mac_address)

            results: dict[str, Any] = {
                "cpe_mac": subscriber.cpe_mac_address,
                "reboot_initiated": reboot_result.get("success", False),
                "task_id": reboot_result.get("task_id"),
            }
            recommendations: list[dict[str, Any]] = [
                {
                    "severity": "info",
                    "message": "CPE restart initiated",
                    "action": "Wait 2-5 minutes for device to come back online",
                }
            ]

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=reboot_result.get("success", False),
                results=results,
                recommendations=recommendations,
                severity=DiagnosticSeverity.INFO,
            )

        except Exception as e:
            logger.error("CPE restart failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def run_health_check(
        self, tenant_id: str, subscriber_id: str, created_by_id: UUID | None = None
    ) -> DiagnosticRun:
        """Run comprehensive health check on subscriber."""
        subscriber = await self._get_subscriber(tenant_id, subscriber_id)
        diagnostic = await self._create_diagnostic_run(
            tenant_id=tenant_id,
            diagnostic_type=DiagnosticType.HEALTH_CHECK,
            subscriber_id=subscriber_id,
            customer_id=subscriber.customer_id,
            created_by_id=created_by_id,
        )

        try:
            await self._update_diagnostic_run(diagnostic, DiagnosticStatus.RUNNING)

            checks_to_run: list[tuple[str, Awaitable[DiagnosticRun | dict[str, Any]]]] = [
                ("connectivity", self.check_subscriber_connectivity(tenant_id, subscriber_id)),
                ("radius", self.get_radius_sessions(tenant_id, subscriber_id)),
            ]

            if subscriber.onu_serial:
                checks_to_run.append(("onu", self.check_onu_status(tenant_id, subscriber_id)))
            else:
                checks_to_run.append(
                    ("onu", self._create_skipped_check("ONU check skipped (no ONU configured)"))
                )

            if subscriber.cpe_mac_address:
                checks_to_run.append(("cpe", self.check_cpe_status(tenant_id, subscriber_id)))
            else:
                checks_to_run.append(
                    ("cpe", self._create_skipped_check("CPE check skipped (no CPE configured)"))
                )

            checks_to_run.append(("ip", self.verify_ip_allocation(tenant_id, subscriber_id)))

            # Aggregate results
            results: dict[str, Any] = {
                "checks": {},
                "total_checks": 0,
                "checks_passed": 0,
                "checks_failed": 0,
                "checks_skipped": 0,
            }
            recommendations: list[dict[str, Any]] = []
            highest_severity = DiagnosticSeverity.INFO

            for check_name, check_coro in checks_to_run:
                try:
                    check_result = await check_coro
                except Exception as check_error:
                    results["checks"][check_name] = {"status": "error", "error": str(check_error)}
                    results["checks_failed"] += 1
                    highest_severity = DiagnosticSeverity.CRITICAL
                else:
                    if isinstance(check_result, dict) and check_result.get("skipped"):
                        results["checks"][check_name] = {"status": "skipped"}
                        results["checks_skipped"] += 1
                    elif isinstance(check_result, DiagnosticRun):
                        results["checks"][check_name] = {
                            "status": "passed" if check_result.success else "failed",
                            "summary": check_result.summary,
                            "severity": (
                                check_result.severity.value if check_result.severity else "info"
                            ),
                        }
                        if check_result.success:
                            results["checks_passed"] += 1
                        else:
                            results["checks_failed"] += 1

                        if check_result.recommendations:
                            recommendations.extend(check_result.recommendations)

                        if check_result.severity:
                            severity_order = {
                                DiagnosticSeverity.INFO: 0,
                                DiagnosticSeverity.WARNING: 1,
                                DiagnosticSeverity.ERROR: 2,
                                DiagnosticSeverity.CRITICAL: 3,
                            }
                            if severity_order.get(check_result.severity, 0) > severity_order.get(
                                highest_severity, 0
                            ):
                                highest_severity = check_result.severity
                    else:
                        results["checks"][check_name] = {"status": "unknown"}

                results["total_checks"] += 1

            # Overall health assessment
            if results["checks_failed"] == 0:
                results["overall_health"] = "healthy"
                success = True
            elif results["checks_passed"] > results["checks_failed"]:
                results["overall_health"] = "degraded"
                success = False
            else:
                results["overall_health"] = "unhealthy"
                success = False

            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.COMPLETED,
                success=success,
                results=results,
                recommendations=recommendations,
                severity=highest_severity,
            )

        except Exception as e:
            logger.error("Health check failed", error=str(e), subscriber_id=subscriber_id)
            await self._update_diagnostic_run(
                diagnostic,
                DiagnosticStatus.FAILED,
                error_message=str(e),
                severity=DiagnosticSeverity.CRITICAL,
            )

        return diagnostic

    async def _create_skipped_check(self, reason: str) -> dict[str, Any]:
        """Create a skipped check result."""
        return {"skipped": True, "reason": reason}

    async def _get_usage_statistics(
        self, tenant_id: str, subscriber_id: str, lookback_days: int = 7
    ) -> dict[str, Any]:
        """
        Get bandwidth usage statistics from TimescaleDB for troubleshooting.

        Args:
            tenant_id: Tenant ID
            subscriber_id: RADIUS subscriber ID (from subscribers table)
            lookback_days: Number of days to look back (default: 7)

        Returns:
            Dictionary with usage statistics and trends
        """
        if not TIMESCALEDB_AVAILABLE or not settings.timescaledb.is_configured:
            logger.debug("TimescaleDB not available, skipping usage statistics")
            return {"available": False, "reason": "timescaledb_not_configured"}

        try:
            end_date = datetime.now(UTC)
            start_date = end_date - timedelta(days=lookback_days)

            async with TimeSeriesSessionLocal() as ts_session:
                repo = RadiusTimeSeriesRepository()

                # Get overall usage
                usage_data = await repo.get_subscriber_usage(
                    ts_session, tenant_id, subscriber_id, start_date, end_date
                )

                # Get daily breakdown
                daily_data = await repo.get_daily_bandwidth(
                    ts_session, tenant_id, subscriber_id, start_date, end_date
                )

                # Calculate statistics
                total_bytes = usage_data["total_bandwidth"]
                total_gb = Decimal(total_bytes) / Decimal(1024**3)
                avg_daily_gb = total_gb / Decimal(lookback_days) if lookback_days > 0 else Decimal(0)

                # Detect trends
                if len(daily_data) >= 2:
                    recent_days = daily_data[-3:] if len(daily_data) >= 3 else daily_data
                    older_days = daily_data[:-3] if len(daily_data) >= 6 else daily_data[:-len(recent_days)]

                    if older_days:
                        recent_avg = sum(d["total_bandwidth"] for d in recent_days) / len(recent_days)
                        older_avg = sum(d["total_bandwidth"] for d in older_days) / len(older_days)

                        if older_avg > 0:
                            trend_pct = ((recent_avg - older_avg) / older_avg) * 100
                            if trend_pct > 50:
                                trend = "increasing_rapidly"
                            elif trend_pct > 20:
                                trend = "increasing"
                            elif trend_pct < -20:
                                trend = "decreasing"
                            else:
                                trend = "stable"
                        else:
                            trend = "stable"
                    else:
                        trend = "insufficient_data"
                else:
                    trend = "insufficient_data"

                # Find peak usage day
                peak_day = None
                peak_usage_gb = Decimal(0)
                if daily_data:
                    for day_data in daily_data:
                        day_gb = Decimal(day_data["total_bandwidth"]) / Decimal(1024**3)
                        if day_gb > peak_usage_gb:
                            peak_usage_gb = day_gb
                            peak_day = day_data["day"]

                # Convert daily data for output
                daily_breakdown = [
                    {
                        "date": day["day"].date().isoformat() if hasattr(day["day"], "date") else str(day["day"]),
                        "bandwidth_gb": float(Decimal(day["total_bandwidth"]) / Decimal(1024**3)),
                        "session_count": day["session_count"],
                    }
                    for day in daily_data
                ]

                return {
                    "available": True,
                    "period_days": lookback_days,
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "total_bandwidth_gb": float(total_gb),
                    "avg_daily_bandwidth_gb": float(avg_daily_gb),
                    "total_sessions": usage_data["session_count"],
                    "total_duration_hours": float(usage_data["total_duration"] / 3600),
                    "trend": trend,
                    "peak_day": peak_day.date().isoformat() if peak_day and hasattr(peak_day, "date") else str(peak_day) if peak_day else None,
                    "peak_usage_gb": float(peak_usage_gb),
                    "daily_breakdown": daily_breakdown,
                }

        except Exception as e:
            logger.error("Failed to query usage statistics", error=str(e), tenant_id=tenant_id, username=username)
            return {"available": False, "reason": "query_failed", "error": str(e)}

    async def get_diagnostic_run(self, tenant_id: str, diagnostic_id: UUID) -> DiagnosticRun | None:
        """Get diagnostic run by ID."""
        stmt = select(DiagnosticRun).where(
            DiagnosticRun.tenant_id == tenant_id,
            DiagnosticRun.id == diagnostic_id,
            DiagnosticRun.deleted_at.is_(None),
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_diagnostic_runs(
        self,
        tenant_id: str,
        subscriber_id: str | None = None,
        diagnostic_type: DiagnosticType | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[DiagnosticRun]:
        """List diagnostic runs with filters."""
        stmt = select(DiagnosticRun).where(
            DiagnosticRun.tenant_id == tenant_id, DiagnosticRun.deleted_at.is_(None)
        )

        if subscriber_id:
            stmt = stmt.where(DiagnosticRun.subscriber_id == subscriber_id)

        if diagnostic_type:
            stmt = stmt.where(DiagnosticRun.diagnostic_type == diagnostic_type)

        stmt = stmt.order_by(DiagnosticRun.created_at.desc()).limit(limit).offset(offset)

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
