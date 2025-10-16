"""
Network Monitoring Service

Aggregates monitoring data from NetBox, VOLTHA, GenieACS, and RADIUS to provide
unified network health and performance monitoring.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any

import httpx
import structlog

from dotmac.platform.core.caching import cache_get, cache_set
from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.network_monitoring.schemas import (
    AlertSeverity,
    CPEMetrics,
    DeviceHealthResponse,
    DeviceMetricsResponse,
    DeviceStatus,
    DeviceType,
    DeviceTypeSummary,
    InterfaceStats,
    NetworkAlertResponse,
    NetworkOverviewResponse,
    ONUMetrics,
    TrafficStatsResponse,
)
from dotmac.platform.voltha.client import VOLTHAClient

logger = structlog.get_logger(__name__)


class NetworkMonitoringService:
    """
    Network monitoring service that aggregates data from multiple sources.

    Provides unified monitoring across:
    - NetBox: Device inventory and IPAM
    - VOLTHA: OLT/ONU status and metrics
    - GenieACS: CPE device management
    - RADIUS: Accounting and session data
    """

    def __init__(
        self,
        netbox_client: NetBoxClient | None = None,
        voltha_client: VOLTHAClient | None = None,
        genieacs_client: GenieACSClient | None = None,
    ):
        self.netbox = netbox_client or NetBoxClient()
        self.voltha = voltha_client or VOLTHAClient()
        self.genieacs = genieacs_client or GenieACSClient()

    # ========================================================================
    # Device Health Monitoring
    # ========================================================================

    async def get_device_health(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> DeviceHealthResponse:
        """Get health status for a specific device"""

        # Check cache first
        cache_key = f"device_health:{tenant_id}:{device_id}"
        cached = cache_get(cache_key)
        if cached:
            return DeviceHealthResponse(**cached)

        try:
            if device_type == DeviceType.ONU:
                health = await self._get_onu_health(device_id)
            elif device_type == DeviceType.CPE:
                health = await self._get_cpe_health(device_id)
            elif device_type in (DeviceType.OLT, DeviceType.ROUTER, DeviceType.SWITCH):
                health = await self._get_network_device_health(device_id)
            else:
                health = await self._get_generic_device_health(device_id)

            # Cache for 1 minute
            cache_set(cache_key, health.model_dump(), ttl=60)
            return health

        except Exception as e:
            logger.error("Failed to get device health", device_id=device_id, error=str(e))
            # Return degraded status on error
            return DeviceHealthResponse(
                device_id=device_id,
                device_name=f"Device {device_id}",
                device_type=device_type,
                status=DeviceStatus.UNKNOWN,
            )

    async def _get_onu_health(self, onu_id: str) -> DeviceHealthResponse:
        """Get ONU health from VOLTHA"""
        try:
            onu_data = await self.voltha.get_onu(onu_id)

            return DeviceHealthResponse(
                device_id=onu_id,
                device_name=onu_data.get("serial_number", onu_id),
                device_type=DeviceType.ONU,
                status=(
                    DeviceStatus.ONLINE
                    if onu_data.get("admin_state") == "ENABLED"
                    and onu_data.get("oper_status") == "ACTIVE"
                    else DeviceStatus.OFFLINE
                ),
                last_seen=datetime.utcnow(),
                # Optical metrics
                temperature_celsius=onu_data.get("temperature"),
                firmware_version=onu_data.get("software_version"),
                model=onu_data.get("device_type"),
            )
        except Exception as e:
            logger.warning("Failed to get ONU health", onu_id=onu_id, error=str(e))
            raise

    async def _get_cpe_health(self, cpe_id: str) -> DeviceHealthResponse:
        """Get CPE health from GenieACS"""
        try:
            cpe_data = await self.genieacs.get_device(cpe_id)

            # Calculate status based on last inform
            last_inform = cpe_data.get("_lastInform")
            if last_inform:
                last_inform_dt = datetime.fromisoformat(last_inform.replace("Z", "+00:00"))
                minutes_since = (datetime.utcnow() - last_inform_dt.replace(tzinfo=None)).total_seconds() / 60
                status = DeviceStatus.ONLINE if minutes_since < 10 else DeviceStatus.OFFLINE
            else:
                status = DeviceStatus.UNKNOWN

            return DeviceHealthResponse(
                device_id=cpe_id,
                device_name=cpe_data.get("_deviceId", {}).get("_ProductClass", cpe_id),
                device_type=DeviceType.CPE,
                status=status,
                ip_address=cpe_data.get("InternetGatewayDevice", {})
                .get("WANDevice", {})
                .get("1", {})
                .get("WANConnectionDevice", {})
                .get("1", {})
                .get("WANIPConnection", {})
                .get("1", {})
                .get("ExternalIPAddress"),
                last_seen=last_inform_dt.replace(tzinfo=None) if last_inform else None,
                cpu_usage_percent=cpe_data.get("Device", {})
                .get("DeviceInfo", {})
                .get("ProcessStatus", {})
                .get("CPUUsage"),
                memory_usage_percent=cpe_data.get("Device", {})
                .get("DeviceInfo", {})
                .get("MemoryStatus", {})
                .get("Total"),
                firmware_version=cpe_data.get("Device", {}).get("DeviceInfo", {}).get("SoftwareVersion"),
                model=cpe_data.get("Device", {}).get("DeviceInfo", {}).get("ModelName"),
            )
        except Exception as e:
            logger.warning("Failed to get CPE health", cpe_id=cpe_id, error=str(e))
            raise

    async def _get_network_device_health(self, device_id: str) -> DeviceHealthResponse:
        """Get network device health from NetBox + SNMP"""
        try:
            device_data = await self.netbox.get_device(device_id)

            # Perform basic ping check
            status = DeviceStatus.ONLINE
            ping_latency = None
            if device_data.get("primary_ip"):
                ip = device_data["primary_ip"]["address"].split("/")[0]
                try:
                    async with httpx.AsyncClient() as client:
                        start = datetime.utcnow()
                        # Simple TCP check (ICMP requires root)
                        await asyncio.wait_for(client.get(f"http://{ip}"), timeout=2.0)
                        ping_latency = (datetime.utcnow() - start).total_seconds() * 1000
                except:
                    status = DeviceStatus.OFFLINE

            return DeviceHealthResponse(
                device_id=str(device_data.get("id", device_id)),
                device_name=device_data.get("name", device_id),
                device_type=DeviceType.ROUTER,  # Map from NetBox device type
                status=status,
                ip_address=device_data.get("primary_ip", {}).get("address", "").split("/")[0]
                if device_data.get("primary_ip")
                else None,
                last_seen=datetime.utcnow() if status == DeviceStatus.ONLINE else None,
                ping_latency_ms=ping_latency,
                firmware_version=device_data.get("custom_fields", {}).get("firmware_version"),
                model=device_data.get("device_type", {}).get("model"),
                location=device_data.get("site", {}).get("name"),
            )
        except Exception as e:
            logger.warning("Failed to get network device health", device_id=device_id, error=str(e))
            raise

    async def _get_generic_device_health(self, device_id: str) -> DeviceHealthResponse:
        """Get generic device health"""
        return DeviceHealthResponse(
            device_id=device_id,
            device_name=f"Device {device_id}",
            device_type=DeviceType.OTHER,
            status=DeviceStatus.UNKNOWN,
        )

    # ========================================================================
    # Traffic/Bandwidth Monitoring
    # ========================================================================

    async def get_traffic_stats(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> TrafficStatsResponse:
        """Get traffic statistics for a device"""

        cache_key = f"traffic_stats:{tenant_id}:{device_id}"
        cached = cache_get(cache_key)
        if cached:
            return TrafficStatsResponse(**cached)

        try:
            if device_type == DeviceType.ONU:
                stats = await self._get_onu_traffic(device_id)
            elif device_type in (DeviceType.OLT, DeviceType.ROUTER, DeviceType.SWITCH):
                stats = await self._get_network_device_traffic(device_id)
            else:
                # Return empty stats for unsupported types
                stats = TrafficStatsResponse(
                    device_id=device_id, device_name=f"Device {device_id}"
                )

            # Cache for 30 seconds
            cache_set(cache_key, stats.model_dump(), ttl=30)
            return stats

        except Exception as e:
            logger.error("Failed to get traffic stats", device_id=device_id, error=str(e))
            return TrafficStatsResponse(device_id=device_id, device_name=f"Device {device_id}")

    async def _get_onu_traffic(self, onu_id: str) -> TrafficStatsResponse:
        """Get ONU traffic stats from VOLTHA"""
        try:
            stats_data = await self.voltha.get_onu_stats(onu_id)

            return TrafficStatsResponse(
                device_id=onu_id,
                device_name=stats_data.get("serial_number", onu_id),
                total_bytes_in=stats_data.get("rx_bytes", 0),
                total_bytes_out=stats_data.get("tx_bytes", 0),
                total_packets_in=stats_data.get("rx_packets", 0),
                total_packets_out=stats_data.get("tx_packets", 0),
                current_rate_in_bps=stats_data.get("rx_rate_bps", 0.0),
                current_rate_out_bps=stats_data.get("tx_rate_bps", 0.0),
            )
        except Exception as e:
            logger.warning("Failed to get ONU traffic", onu_id=onu_id, error=str(e))
            raise

    async def _get_network_device_traffic(self, device_id: str) -> TrafficStatsResponse:
        """Get network device traffic from NetBox/SNMP"""
        # This would typically query SNMP or other monitoring system
        # For now, return placeholder
        return TrafficStatsResponse(device_id=device_id, device_name=f"Device {device_id}")

    # ========================================================================
    # Comprehensive Device Metrics
    # ========================================================================

    async def get_device_metrics(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> DeviceMetricsResponse:
        """Get comprehensive metrics for a device"""

        # Get health and traffic in parallel
        health, traffic = await asyncio.gather(
            self.get_device_health(device_id, device_type, tenant_id),
            self.get_traffic_stats(device_id, device_type, tenant_id),
            return_exceptions=True,
        )

        # Handle exceptions
        if isinstance(health, Exception):
            logger.error("Failed to get device health", error=str(health))
            health = DeviceHealthResponse(
                device_id=device_id,
                device_name=f"Device {device_id}",
                device_type=device_type,
                status=DeviceStatus.UNKNOWN,
            )

        if isinstance(traffic, Exception):
            logger.error("Failed to get traffic stats", error=str(traffic))
            traffic = None

        # Get device-specific metrics
        onu_metrics = None
        cpe_metrics = None

        if device_type == DeviceType.ONU:
            onu_metrics = await self._get_onu_metrics(device_id)
        elif device_type == DeviceType.CPE:
            cpe_metrics = await self._get_cpe_metrics(device_id)

        return DeviceMetricsResponse(
            device_id=device_id,
            device_name=health.device_name,
            device_type=device_type,
            health=health,
            traffic=traffic,
            onu_metrics=onu_metrics,
            cpe_metrics=cpe_metrics,
        )

    async def _get_onu_metrics(self, onu_id: str) -> ONUMetrics | None:
        """Get ONU-specific metrics"""
        try:
            onu_data = await self.voltha.get_onu(onu_id)
            return ONUMetrics(
                serial_number=onu_data.get("serial_number", onu_id),
                optical_power_rx_dbm=onu_data.get("optical_power_rx"),
                optical_power_tx_dbm=onu_data.get("optical_power_tx"),
                olt_rx_power_dbm=onu_data.get("olt_rx_power"),
                distance_meters=onu_data.get("distance"),
                state=onu_data.get("oper_status"),
            )
        except Exception as e:
            logger.warning("Failed to get ONU metrics", onu_id=onu_id, error=str(e))
            return None

    async def _get_cpe_metrics(self, cpe_id: str) -> CPEMetrics | None:
        """Get CPE-specific metrics"""
        try:
            cpe_data = await self.genieacs.get_device(cpe_id)
            wifi_data = cpe_data.get("Device", {}).get("WiFi", {})

            return CPEMetrics(
                mac_address=cpe_data.get("_deviceId", {}).get("_SerialNumber", cpe_id),
                wifi_enabled=wifi_data.get("Radio", {}).get("1", {}).get("Enable", False),
                connected_clients=len(
                    cpe_data.get("Device", {})
                    .get("Hosts", {})
                    .get("Host", {})
                    .values()
                ),
                last_inform=datetime.fromisoformat(
                    cpe_data.get("_lastInform", "").replace("Z", "+00:00")
                ).replace(tzinfo=None)
                if cpe_data.get("_lastInform")
                else None,
            )
        except Exception as e:
            logger.warning("Failed to get CPE metrics", cpe_id=cpe_id, error=str(e))
            return None

    # ========================================================================
    # Network Overview/Dashboard
    # ========================================================================

    async def get_network_overview(self, tenant_id: str) -> NetworkOverviewResponse:
        """Get comprehensive network overview for dashboard"""

        cache_key = f"network_overview:{tenant_id}"
        cached = cache_get(cache_key)
        if cached:
            return NetworkOverviewResponse(**cached)

        try:
            # Get all devices for tenant
            devices = await self._get_tenant_devices(tenant_id)

            # Calculate summary statistics
            total_devices = len(devices)
            online_devices = sum(1 for d in devices if d["status"] == "online")
            offline_devices = sum(1 for d in devices if d["status"] == "offline")
            degraded_devices = sum(1 for d in devices if d["status"] == "degraded")

            # Get active alerts
            alerts = await self._get_active_alerts(tenant_id)
            critical_alerts = sum(1 for a in alerts if a.severity == AlertSeverity.CRITICAL)
            warning_alerts = sum(1 for a in alerts if a.severity == AlertSeverity.WARNING)

            # Calculate device type summaries
            device_type_summary = self._calculate_device_type_summary(devices)

            # Get recent offline devices
            recent_offline = [
                d["id"] for d in devices if d["status"] == "offline"
            ][:5]

            overview = NetworkOverviewResponse(
                tenant_id=tenant_id,
                total_devices=total_devices,
                online_devices=online_devices,
                offline_devices=offline_devices,
                degraded_devices=degraded_devices,
                active_alerts=len(alerts),
                critical_alerts=critical_alerts,
                warning_alerts=warning_alerts,
                device_type_summary=device_type_summary,
                recent_offline_devices=recent_offline,
                recent_alerts=alerts[:10],  # Last 10 alerts
            )

            # Cache for 30 seconds
            cache_set(cache_key, overview.model_dump(), ttl=30)
            return overview

        except Exception as e:
            logger.error("Failed to get network overview", tenant_id=tenant_id, error=str(e))
            # Return empty overview on error
            return NetworkOverviewResponse(tenant_id=tenant_id)

    async def _get_tenant_devices(self, tenant_id: str) -> list[dict[str, Any]]:
        """Get all devices for a tenant"""
        # This would query NetBox, VOLTHA, GenieACS filtered by tenant
        # For now, return empty list
        return []

    async def _get_active_alerts(self, tenant_id: str) -> list[NetworkAlertResponse]:
        """Get active alerts for tenant"""
        # This would query alert storage
        # For now, return empty list
        return []

    def _calculate_device_type_summary(
        self, devices: list[dict[str, Any]]
    ) -> list[DeviceTypeSummary]:
        """Calculate summary statistics by device type"""
        summaries = {}

        for device in devices:
            device_type = device.get("type", "other")
            if device_type not in summaries:
                summaries[device_type] = {
                    "device_type": device_type,
                    "total_count": 0,
                    "online_count": 0,
                    "offline_count": 0,
                    "degraded_count": 0,
                }

            summaries[device_type]["total_count"] += 1
            status = device.get("status", "unknown")
            if status == "online":
                summaries[device_type]["online_count"] += 1
            elif status == "offline":
                summaries[device_type]["offline_count"] += 1
            elif status == "degraded":
                summaries[device_type]["degraded_count"] += 1

        return [DeviceTypeSummary(**s) for s in summaries.values()]

    # ========================================================================
    # Alert Management
    # ========================================================================

    async def get_all_devices(
        self, tenant_id: str, device_type: DeviceType | None = None
    ) -> list[DeviceHealthResponse]:
        """Get all devices for tenant with optional type filter"""
        # Get devices from tenant inventory
        devices_data = await self._get_tenant_devices(tenant_id)

        # Convert to health responses
        devices = []
        for device_data in devices_data:
            dev_type = DeviceType(device_data.get("type", "other"))
            if device_type and dev_type != device_type:
                continue

            # Get health for each device
            try:
                health = await self.get_device_health(
                    device_data["id"], dev_type, tenant_id
                )
                devices.append(health)
            except Exception as e:
                logger.error(
                    "Failed to get device health",
                    device_id=device_data["id"],
                    error=str(e),
                )

        return devices

    async def get_alerts(
        self,
        tenant_id: str,
        severity: AlertSeverity | None = None,
        active_only: bool = True,
        device_id: str | None = None,
        limit: int = 100,
    ) -> list[NetworkAlertResponse]:
        """Get alerts with filtering"""
        # Get all alerts from storage
        alerts = await self._get_active_alerts(tenant_id)

        # Apply filters
        filtered = alerts
        if severity:
            filtered = [a for a in filtered if a.severity == severity]
        if active_only:
            filtered = [a for a in filtered if a.is_active]
        if device_id:
            filtered = [a for a in filtered if a.device_id == device_id]

        # Apply limit
        return filtered[:limit]

    async def acknowledge_alert(
        self,
        alert_id: str,
        tenant_id: str,
        user_id: str,
        note: str | None = None,
    ) -> NetworkAlertResponse | None:
        """Acknowledge an alert"""
        # In production, this would update alert in database
        # For now, return a mock acknowledged alert
        return NetworkAlertResponse(
            alert_id=alert_id,
            severity=AlertSeverity.WARNING,
            title="Alert acknowledged",
            description=f"Alert {alert_id} acknowledged by user {user_id}",
            tenant_id=tenant_id,
            is_active=True,
            is_acknowledged=True,
            acknowledged_at=datetime.utcnow(),
        )

    async def create_alert_rule(
        self,
        tenant_id: str,
        name: str,
        description: str | None,
        device_type: DeviceType | None,
        metric_name: str,
        condition: str,
        threshold: float,
        severity: AlertSeverity,
        enabled: bool,
    ) -> dict:
        """Create a new alert rule"""
        # In production, this would create rule in database
        # For now, return mock rule
        import uuid

        rule_id = str(uuid.uuid4())
        return {
            "rule_id": rule_id,
            "tenant_id": tenant_id,
            "name": name,
            "description": description,
            "device_type": device_type.value if device_type else None,
            "metric_name": metric_name,
            "condition": condition,
            "threshold": threshold,
            "severity": severity.value,
            "enabled": enabled,
            "created_at": datetime.utcnow().isoformat(),
        }

    async def get_alert_rules(self, tenant_id: str) -> list[dict]:
        """Get all alert rules for tenant"""
        # In production, this would query database
        # For now, return empty list
        return []
