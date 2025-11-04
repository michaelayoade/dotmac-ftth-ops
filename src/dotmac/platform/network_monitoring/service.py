"""Network Monitoring Service

Aggregates monitoring data from NetBox, VOLTHA, GenieACS, and RADIUS to provide
unified network health and performance monitoring.
"""

import asyncio
import math
from datetime import datetime
from typing import TYPE_CHECKING, Any, cast

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.caching import cache_get, cache_set
from dotmac.platform.fault_management.models import AlarmSeverity as FMAlarmSeverity
from dotmac.platform.fault_management.models import AlarmStatus as FMAlarmStatus
from dotmac.platform.fault_management.schemas import AlarmQueryParams
from dotmac.platform.fault_management.service import AlarmService
from dotmac.platform.genieacs.client import GenieACSClient
from dotmac.platform.monitoring.prometheus_client import PrometheusClient, PrometheusQueryError
from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.network_monitoring.schemas import (
    AlertSeverity,
    CPEMetrics,
    DeviceHealthResponse,
    DeviceMetricsResponse,
    DeviceStatus,
    DeviceType,
    DeviceTypeSummary,
    NetworkAlertResponse,
    NetworkOverviewResponse,
    ONUMetrics,
    TrafficStatsResponse,
)
from dotmac.platform.tenant.oss_config import OSSService, ServiceConfig, get_service_config

logger = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from dotmac.platform.voltha.client import VOLTHAClient

DEFAULT_PROMETHEUS_TRAFFIC_QUERIES = {
    "rx_rate": 'sum(rate(node_network_receive_bytes_total{instance="<<device_id>>"}[5m]))',
    "tx_rate": 'sum(rate(node_network_transmit_bytes_total{instance="<<device_id>>"}[5m]))',
    "rx_bytes": 'sum(increase(node_network_receive_bytes_total{instance="<<device_id>>"}[1h]))',
    "tx_bytes": 'sum(increase(node_network_transmit_bytes_total{instance="<<device_id>>"}[1h]))',
    "rx_packets": 'sum(increase(node_network_receive_packets_total{instance="<<device_id>>"}[1h]))',
    "tx_packets": 'sum(increase(node_network_transmit_packets_total{instance="<<device_id>>"}[1h]))',
}


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
        tenant_id: str,
        session: AsyncSession | None = None,
        netbox_client: NetBoxClient | None = None,
        voltha_client: "VOLTHAClient | None" = None,
        genieacs_client: GenieACSClient | None = None,
    ):
        if not tenant_id:
            raise ValueError("tenant_id is required for NetworkMonitoringService")

        self.tenant_id = tenant_id
        self.session = session
        self.netbox = netbox_client or NetBoxClient(tenant_id=tenant_id)
        self.voltha = voltha_client or self._create_voltha_client()
        self.genieacs = genieacs_client or GenieACSClient(tenant_id=tenant_id)
        self._inventory_status: dict[str, str] = {}
        self._alert_status: dict[str, str] = {}
        self._prometheus_client: PrometheusClient | None = None
        self._prometheus_config: ServiceConfig | None = None

    # --------------------------------------------------------------------
    # Tenant helpers
    # --------------------------------------------------------------------

    def _ensure_tenant_scope(self, tenant_id: str | None) -> str:
        """
        Enforce tenant scope for service methods.

        Returns the effective tenant identifier used for downstream calls.
        """
        if tenant_id is None:
            return self.tenant_id

        if tenant_id != self.tenant_id:
            logger.warning(
                "network_monitoring.tenant_mismatch",
                requested_tenant=tenant_id,
                service_tenant=self.tenant_id,
            )
        return self.tenant_id

    # --------------------------------------------------------------------
    # Prometheus helpers
    # --------------------------------------------------------------------

    def _create_voltha_client(self) -> "VOLTHAClient | None":
        """Lazily import and construct VOLTHA client to avoid circular imports."""

        try:
            from dotmac.platform.voltha.client import VOLTHAClient as _VOLTHAClient
        except ImportError as exc:  # pragma: no cover - defensive guard
            logger.warning(
                "network_monitoring.voltha.import_failed",
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            return None

        return _VOLTHAClient(tenant_id=self.tenant_id)

    async def _get_prometheus_client(self) -> PrometheusClient | None:
        """Initialise Prometheus client using tenant-specific configuration."""

        if self._prometheus_client is not None:
            return self._prometheus_client

        if self.session is None:
            logger.warning(
                "network_monitoring.prometheus.no_session",
                tenant_id=self.tenant_id,
            )
            return None

        try:
            config = await get_service_config(
                self.session,
                self.tenant_id,
                OSSService.PROMETHEUS,
            )
        except ValueError as exc:
            logger.warning(
                "network_monitoring.prometheus.config_missing",
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            return None

        self._prometheus_config = config
        self._prometheus_client = PrometheusClient(
            base_url=config.url,
            tenant_id=self.tenant_id,
            api_token=config.api_token,
            username=config.username,
            password=config.password,
            verify_ssl=config.verify_ssl,
            timeout_seconds=config.timeout_seconds,
            max_retries=config.max_retries,
        )
        return self._prometheus_client

    def _render_prometheus_query(
        self, template: str, device_id: str, extras: dict[str, Any]
    ) -> str:
        """Substitute placeholders in Prometheus query templates."""

        if not template:
            return ""

        placeholder = str(extras.get("device_placeholder", "<<device_id>>"))
        query = template.replace(placeholder, device_id)
        # Backwards compatibility placeholders
        query = query.replace("<<device>>", device_id)
        return query

    async def _execute_prometheus_query(self, client: PrometheusClient, query: str) -> float:
        if not query:
            return 0.0

        try:
            payload = await client.query(query)
        except PrometheusQueryError as exc:
            logger.warning(
                "network_monitoring.prometheus.query_error",
                tenant_id=self.tenant_id,
                query=query,
                error=str(exc),
            )
            return 0.0
        except Exception as exc:  # pragma: no cover - defensive guard
            logger.warning(
                "network_monitoring.prometheus.query_failed",
                tenant_id=self.tenant_id,
                query=query,
                error=str(exc),
            )
            return 0.0

        return self._extract_prometheus_value(payload)

    @staticmethod
    def _extract_prometheus_value(payload: Any) -> float:
        """Extract numeric value from Prometheus query payload."""

        try:
            data = payload.get("data", {})
            result = data.get("result") or []
            if not result:
                return 0.0

            sample = result[0]
            if "value" in sample:
                _, raw_value = sample["value"]
            elif "values" in sample and sample["values"]:
                _, raw_value = sample["values"][-1]
            else:
                return 0.0

            value = float(raw_value)
            if math.isnan(value) or math.isinf(value):
                return 0.0
            return value
        except (TypeError, ValueError, KeyError):
            return 0.0

    # --------------------------------------------------------------------
    # Data normalization helpers
    # --------------------------------------------------------------------

    @staticmethod
    def _map_netbox_status(status_data: Any) -> DeviceStatus:
        raw_status = status_data
        if isinstance(status_data, dict):
            raw_status = (
                status_data.get("value")
                or status_data.get("slug")
                or status_data.get("name")
                or status_data.get("label")
            )

        status_value = str(raw_status or "").lower()
        if status_value in {"active", "online", "in-service", "production"}:
            return DeviceStatus.ONLINE
        if status_value in {"offline", "offline-standby", "decommissioned"}:
            return DeviceStatus.OFFLINE
        if status_value in {"failed", "maintenance", "planned", "staged"}:
            return DeviceStatus.DEGRADED
        return DeviceStatus.UNKNOWN

    @staticmethod
    def _parse_timestamp(value: Any) -> datetime | None:
        if not value:
            return None

        if isinstance(value, datetime):
            return value.replace(tzinfo=None) if value.tzinfo else value

        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
        return parsed.replace(tzinfo=None)

    @staticmethod
    def _extract_management_ips(device_data: dict[str, Any]) -> tuple[str | None, str | None]:
        def _clean(ip_value: Any) -> str | None:
            if not ip_value:
                return None
            if isinstance(ip_value, dict):
                address = ip_value.get("address")
            else:
                address = ip_value
            if not address:
                return None
            return str(address).split("/")[0]

        ipv4 = _clean(device_data.get("primary_ip4"))
        ipv6 = _clean(device_data.get("primary_ip6"))

        primary_clean = _clean(device_data.get("primary_ip"))
        if primary_clean:
            if ":" in primary_clean:
                ipv6 = ipv6 or primary_clean
            else:
                ipv4 = ipv4 or primary_clean

        return ipv4, ipv6

    @staticmethod
    def _map_netbox_device_type(device_data: dict[str, Any]) -> DeviceType:
        candidates: list[str] = []
        for key in ("device_role", "role", "device_type"):
            value = device_data.get(key)
            if isinstance(value, dict):
                candidates.extend(
                    [
                        str(item).lower()
                        for item in (
                            value.get("slug"),
                            value.get("name"),
                            value.get("model"),
                            value.get("value"),
                        )
                        if item
                    ]
                )
            elif isinstance(value, str):
                candidates.append(value.lower())

        combined = " ".join(candidates)
        if "olt" in combined:
            return DeviceType.OLT
        if "onu" in combined or "ont" in combined:
            return DeviceType.ONU
        if any(term in combined for term in ("cpe", "gateway", "customer-premises")):
            return DeviceType.CPE
        if "router" in combined:
            return DeviceType.ROUTER
        if any(term in combined for term in ("switch", "aggregation")):
            return DeviceType.SWITCH
        if "firewall" in combined:
            return DeviceType.FIREWALL
        return DeviceType.OTHER

    @staticmethod
    def _normalize_collection(response: Any) -> list[dict[str, Any]]:
        if isinstance(response, list):
            return [item for item in response if isinstance(item, dict)]

        if isinstance(response, dict):
            for key in ("results", "items", "data", "devices"):
                value = response.get(key)
                if isinstance(value, list):
                    return [item for item in value if isinstance(item, dict)]
        return []

    @staticmethod
    def _map_onu_status(onu: dict[str, Any]) -> DeviceStatus:
        admin_state = str(onu.get("admin_state", "")).upper()
        oper_status = str(onu.get("oper_status", "")).upper()

        if admin_state == "ENABLED" and oper_status in {"ACTIVE", "UP", "RUNNING"}:
            return DeviceStatus.ONLINE
        if admin_state == "DISABLED" or oper_status in {"DISABLED", "DOWN"}:
            return DeviceStatus.OFFLINE
        if oper_status in {"INIT", "CREATING", "UNKNOWN"}:
            return DeviceStatus.DEGRADED
        return DeviceStatus.UNKNOWN

    @staticmethod
    def _map_alarm_severity(severity: Any) -> AlertSeverity:
        if isinstance(severity, FMAlarmSeverity):
            severity_value = severity.value
        else:
            severity_value = str(severity or "").lower()

        if severity_value in {"critical", "major"}:
            return AlertSeverity.CRITICAL
        if severity_value in {"minor", "warning"}:
            return AlertSeverity.WARNING
        return AlertSeverity.INFO

    @staticmethod
    def _map_alarm_resource_type(resource_type: Any) -> DeviceType | None:
        if not resource_type:
            return None

        normalized = str(resource_type).lower()
        if normalized in DeviceType._value2member_map_:  # type: ignore[attr-defined]
            return DeviceType(normalized)
        if "olt" in normalized:
            return DeviceType.OLT
        if "onu" in normalized or "ont" in normalized:
            return DeviceType.ONU
        if any(term in normalized for term in ("cpe", "gateway")):
            return DeviceType.CPE
        if "router" in normalized:
            return DeviceType.ROUTER
        if "switch" in normalized:
            return DeviceType.SWITCH
        if "firewall" in normalized:
            return DeviceType.FIREWALL
        return None

    def _convert_alarm_to_network_alert(self, alarm: Any) -> NetworkAlertResponse:
        severity = self._map_alarm_severity(getattr(alarm, "severity", None))
        device_type = self._map_alarm_resource_type(getattr(alarm, "resource_type", None))

        triggered_at = (
            self._parse_timestamp(getattr(alarm, "first_occurrence", None)) or datetime.utcnow()
        )
        acknowledged_at = self._parse_timestamp(getattr(alarm, "acknowledged_at", None))
        resolved_at = self._parse_timestamp(getattr(alarm, "resolved_at", None))

        status = getattr(alarm, "status", None)
        is_active = status in {FMAlarmStatus.ACTIVE, FMAlarmStatus.SUPPRESSED}
        is_acknowledged = status == FMAlarmStatus.ACKNOWLEDGED

        description = getattr(alarm, "description", None) or getattr(alarm, "message", "") or ""

        return NetworkAlertResponse(
            alert_id=str(getattr(alarm, "alarm_id", None) or alarm.id),
            severity=severity,
            title=str(getattr(alarm, "title", "Alarm")),
            description=str(description),
            device_id=getattr(alarm, "resource_id", None),
            device_name=getattr(alarm, "resource_name", None),
            device_type=device_type,
            triggered_at=triggered_at,
            acknowledged_at=acknowledged_at,
            resolved_at=resolved_at,
            is_active=is_active,
            is_acknowledged=is_acknowledged,
            metric_name=getattr(alarm, "alarm_type", None),
            tenant_id=str(getattr(alarm, "tenant_id", self.tenant_id)),
            alert_rule_id=(
                str(alarm.correlation_id) if getattr(alarm, "correlation_id", None) else None
            ),
            threshold_value=None,
            current_value=None,
        )

    # ========================================================================
    # Device Health Monitoring
    # ========================================================================

    async def get_device_health(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> DeviceHealthResponse:
        """Get health status for a specific device"""

        tenant_scope = self._ensure_tenant_scope(tenant_id)

        # Check cache first
        cache_key = f"device_health:{tenant_scope}:{device_id}"
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
                tenant_id=self.tenant_id,
            )

    def _require_voltha(self) -> Any:
        """Return configured VOLTHA client or raise."""
        if self.voltha is None:
            raise RuntimeError("VOLTHA client is not configured")
        return self.voltha

    async def _get_onu_health(self, onu_id: str) -> DeviceHealthResponse:
        """Get ONU health from VOLTHA"""
        try:
            voltha_client = self._require_voltha()
            onu_data = await voltha_client.get_onu(onu_id)
            onu_payload = self._device_payload(onu_data)

            return DeviceHealthResponse(
                device_id=onu_id,
                device_name=onu_payload.get("serial_number", onu_id),
                device_type=DeviceType.ONU,
                status=(
                    DeviceStatus.ONLINE
                    if onu_payload.get("admin_state") == "ENABLED"
                    and onu_payload.get("oper_status") == "ACTIVE"
                    else DeviceStatus.OFFLINE
                ),
                last_seen=datetime.utcnow(),
                # Optical metrics
                temperature_celsius=onu_payload.get("temperature"),
                firmware_version=onu_payload.get("software_version"),
                model=onu_payload.get("device_type"),
                tenant_id=self.tenant_id,
            )
        except Exception as e:
            logger.warning("Failed to get ONU health", onu_id=onu_id, error=str(e))
            raise

    async def _get_cpe_health(self, cpe_id: str) -> DeviceHealthResponse:
        """Get CPE health from GenieACS"""
        try:
            cpe_raw = await self.genieacs.get_device(cpe_id)
            cpe_data = self._device_payload(cpe_raw)

            # Calculate status based on last inform
            last_inform = cpe_data.get("_lastInform")
            last_inform_dt = None
            if last_inform:
                last_inform_dt = datetime.fromisoformat(last_inform.replace("Z", "+00:00"))
                minutes_since = (
                    datetime.utcnow() - last_inform_dt.replace(tzinfo=None)
                ).total_seconds() / 60
                status = DeviceStatus.ONLINE if minutes_since < 10 else DeviceStatus.OFFLINE
            else:
                status = DeviceStatus.UNKNOWN

            wan_ipv4 = (
                cpe_data.get("InternetGatewayDevice", {})
                .get("WANDevice", {})
                .get("1", {})
                .get("WANConnectionDevice", {})
                .get("1", {})
                .get("WANIPConnection", {})
                .get("1", {})
                .get("ExternalIPAddress")
            )

            return DeviceHealthResponse(
                device_id=cpe_id,
                device_name=cpe_data.get("_deviceId", {}).get("_ProductClass", cpe_id),
                device_type=DeviceType.CPE,
                status=status,
                management_ipv4=wan_ipv4,
                last_seen=last_inform_dt.replace(tzinfo=None) if last_inform_dt else None,
                cpu_usage_percent=cpe_data.get("Device", {})
                .get("DeviceInfo", {})
                .get("ProcessStatus", {})
                .get("CPUUsage"),
                memory_usage_percent=cpe_data.get("Device", {})
                .get("DeviceInfo", {})
                .get("MemoryStatus", {})
                .get("Total"),
                firmware_version=cpe_data.get("Device", {})
                .get("DeviceInfo", {})
                .get("SoftwareVersion"),
                model=cpe_data.get("Device", {}).get("DeviceInfo", {}).get("ModelName"),
                tenant_id=self.tenant_id,
            )
        except Exception as e:
            logger.warning("Failed to get CPE health", cpe_id=cpe_id, error=str(e))
            raise

    async def _get_network_device_health(self, device_id: str) -> DeviceHealthResponse:
        """Get network device health from NetBox metadata."""
        try:
            device_identifier = int(device_id)
            device_raw = await self.netbox.get_device(device_identifier)
            device_data = self._device_payload(device_raw)
        except Exception as exc:
            logger.warning(
                "Failed to load network device from NetBox",
                device_id=device_id,
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            raise

        status = self._map_netbox_status(device_data.get("status"))
        management_ipv4, management_ipv6 = self._extract_management_ips(device_data)
        last_seen = self._parse_timestamp(
            device_data.get("last_updated") or device_data.get("last_seen")
        )
        device_type = self._map_netbox_device_type(device_data)

        custom_fields = device_data.get("custom_fields") or {}
        firmware_version = custom_fields.get("firmware_version")
        cpu_usage = custom_fields.get("cpu_usage")
        memory_usage = custom_fields.get("memory_usage")
        temperature = custom_fields.get("temperature_celsius")

        return DeviceHealthResponse(
            device_id=str(device_data.get("id", device_id)),
            device_name=device_data.get("name", device_id),
            device_type=device_type,
            status=status,
            management_ipv4=management_ipv4,
            management_ipv6=management_ipv6,
            last_seen=last_seen,
            cpu_usage_percent=cpu_usage,
            memory_usage_percent=memory_usage,
            temperature_celsius=temperature,
            firmware_version=firmware_version,
            model=(device_data.get("device_type") or {}).get("model"),
            location=(device_data.get("site") or {}).get("name"),
            tenant_id=self.tenant_id,
        )

    async def _get_generic_device_health(self, device_id: str) -> DeviceHealthResponse:
        """Get generic device health"""
        return DeviceHealthResponse(
            device_id=device_id,
            device_name=f"Device {device_id}",
            device_type=DeviceType.OTHER,
            status=DeviceStatus.UNKNOWN,
            tenant_id=self.tenant_id,
        )

    # ========================================================================
    # Traffic/Bandwidth Monitoring
    # ========================================================================

    async def get_traffic_stats(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> TrafficStatsResponse:
        """Get traffic statistics for a device"""

        tenant_scope = self._ensure_tenant_scope(tenant_id)

        cache_key = f"traffic_stats:{tenant_scope}:{device_id}"
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
                stats = TrafficStatsResponse(device_id=device_id, device_name=f"Device {device_id}")

            # Cache for 30 seconds
            cache_set(cache_key, stats.model_dump(), ttl=30)
            return stats

        except Exception as e:
            logger.error("Failed to get traffic stats", device_id=device_id, error=str(e))
            return TrafficStatsResponse(device_id=device_id, device_name=f"Device {device_id}")

    async def _get_onu_traffic(self, onu_id: str) -> TrafficStatsResponse:
        """Get ONU traffic stats from VOLTHA"""
        get_stats = getattr(self.voltha, "get_onu_stats", None)
        if not callable(get_stats):
            logger.info(
                "VOLTHA client does not expose get_onu_stats",
                onu_id=onu_id,
                tenant_id=self.tenant_id,
            )
            return TrafficStatsResponse(device_id=onu_id, device_name=f"ONU {onu_id}")

        try:
            stats_data = await get_stats(onu_id)
        except Exception as exc:
            logger.warning(
                "Failed to get ONU traffic",
                onu_id=onu_id,
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            return TrafficStatsResponse(device_id=onu_id, device_name=f"ONU {onu_id}")

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

    async def _get_network_device_traffic(self, device_id: str) -> TrafficStatsResponse:
        """Get network device traffic from Prometheus metrics."""
        client = await self._get_prometheus_client()
        if client is None:
            return TrafficStatsResponse(device_id=device_id, device_name=f"Device {device_id}")

        extras = {}
        if isinstance(self._prometheus_config, ServiceConfig):
            extras = dict(self._prometheus_config.extras or {})

        query_overrides = extras.get("traffic_queries") if isinstance(extras, dict) else None
        queries = dict(DEFAULT_PROMETHEUS_TRAFFIC_QUERIES)
        if isinstance(query_overrides, dict):
            for key, template in query_overrides.items():
                if template:
                    queries[key] = template

        rendered_queries = {
            key: self._render_prometheus_query(template, device_id, extras)
            for key, template in queries.items()
            if template
        }

        results: dict[str, float] = {}
        if rendered_queries:
            query_items = list(rendered_queries.items())
            values = await asyncio.gather(
                *[self._execute_prometheus_query(client, query) for _, query in query_items]
            )
            results = {name: value for (name, _), value in zip(query_items, values, strict=False)}

        def _metric(name: str) -> float:
            value = results.get(name, 0.0)
            if math.isnan(value) or math.isinf(value):
                return 0.0
            return value

        return TrafficStatsResponse(
            device_id=device_id,
            device_name=f"Device {device_id}",
            total_bytes_in=max(int(_metric("rx_bytes")), 0),
            total_bytes_out=max(int(_metric("tx_bytes")), 0),
            total_packets_in=max(int(_metric("rx_packets")), 0),
            total_packets_out=max(int(_metric("tx_packets")), 0),
            current_rate_in_bps=max(_metric("rx_rate"), 0.0),
            current_rate_out_bps=max(_metric("tx_rate"), 0.0),
        )

    # ========================================================================
    # Comprehensive Device Metrics
    # ========================================================================

    async def get_device_metrics(
        self, device_id: str, device_type: DeviceType, tenant_id: str
    ) -> DeviceMetricsResponse:
        """Get comprehensive metrics for a device"""

        # Get health and traffic in parallel
        health_result, traffic_result = await asyncio.gather(
            self.get_device_health(device_id, device_type, tenant_id),
            self.get_traffic_stats(device_id, device_type, tenant_id),
            return_exceptions=True,
        )

        # Handle exceptions
        if isinstance(health_result, Exception):
            logger.error("Failed to get device health", error=str(health_result))
            health = DeviceHealthResponse(
                device_id=device_id,
                device_name=f"Device {device_id}",
                device_type=device_type,
                status=DeviceStatus.UNKNOWN,
            )
        else:
            health = cast(DeviceHealthResponse, health_result)

        if isinstance(traffic_result, Exception):
            logger.error("Failed to get traffic stats", error=str(traffic_result))
            traffic = TrafficStatsResponse(
                device_id=device_id,
                device_name=f"Device {device_id}",
            )
        else:
            traffic = cast(TrafficStatsResponse, traffic_result)

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
            voltha_client = self._require_voltha()
            onu_raw = await voltha_client.get_onu(onu_id)
            onu_data = self._device_payload(onu_raw)
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
            cpe_raw = await self.genieacs.get_device(cpe_id)
            cpe_data = self._device_payload(cpe_raw)
            wifi_data = cpe_data.get("Device", {}).get("WiFi", {}) or {}

            host_section = cpe_data.get("Device", {}).get("Hosts", {}).get("Host", {})
            if isinstance(host_section, dict):
                connected_clients = len(host_section)
            elif isinstance(host_section, list):
                connected_clients = len(host_section)
            else:
                connected_clients = 0

            return CPEMetrics(
                mac_address=cpe_data.get("_deviceId", {}).get("_SerialNumber", cpe_id),
                wifi_enabled=wifi_data.get("Radio", {}).get("1", {}).get("Enable", False),
                connected_clients=connected_clients,
                last_inform=(
                    datetime.fromisoformat(
                        cpe_data.get("_lastInform", "").replace("Z", "+00:00")
                    ).replace(tzinfo=None)
                    if cpe_data.get("_lastInform")
                    else None
                ),
            )
        except Exception as e:
            logger.warning("Failed to get CPE metrics", cpe_id=cpe_id, error=str(e))
            return None

    # ========================================================================
    # Network Overview/Dashboard
    # ========================================================================

    async def get_network_overview(self, tenant_id: str) -> NetworkOverviewResponse:
        """Get comprehensive network overview for dashboard"""

        tenant_scope = self._ensure_tenant_scope(tenant_id)

        cache_key = f"network_overview:{tenant_scope}"
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
            recent_offline = [d["id"] for d in devices if d["status"] == "offline"][:5]

            data_source_status = {
                **self._inventory_status,
                **self._alert_status,
            }

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
                data_source_status=data_source_status,
            )

            # Cache for 30 seconds
            cache_set(cache_key, overview.model_dump(), ttl=30)
            return overview

        except Exception as e:
            logger.error("Failed to get network overview", tenant_id=tenant_id, error=str(e))
            # Return empty overview on error
            return NetworkOverviewResponse(tenant_id=self.tenant_id)

    async def _get_tenant_devices(self, tenant_id: str) -> list[dict[str, Any]]:
        """Get all devices for a tenant using upstream inventory systems."""
        tenant_scope = self._ensure_tenant_scope(tenant_id)

        inventory: list[dict[str, Any]] = []
        status_notes: dict[str, str] = {}

        # ------------------------------------------------------------------
        # NetBox inventory
        # ------------------------------------------------------------------
        try:
            netbox_response = await self.netbox.get_devices(tenant=tenant_scope, limit=500)
            netbox_devices = self._normalize_collection(netbox_response)
            mapped_devices: list[dict[str, Any]] = []

            for device in netbox_devices:
                status_enum = self._map_netbox_status(device.get("status"))
                device_type_enum = self._map_netbox_device_type(device)
                management_ipv4, management_ipv6 = self._extract_management_ips(device)
                mapped_devices.append(
                    {
                        "id": str(device.get("id")),
                        "name": device.get("name") or f"Device {device.get('id')}",
                        "type": device_type_enum.value,
                        "status": status_enum.value,
                        "management_ipv4": management_ipv4,
                        "management_ipv6": management_ipv6,
                        "source": "netbox",
                        "site": (device.get("site") or {}).get("name"),
                        "tenant_id": self.tenant_id,
                    }
                )

            inventory.extend(mapped_devices)
            status_notes["inventory.netbox"] = (
                f"{len(mapped_devices)} device(s) from NetBox"
                if mapped_devices
                else "NetBox returned no devices for tenant"
            )
        except Exception as exc:
            logger.warning(
                "Failed to load devices from NetBox",
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            status_notes["inventory.netbox"] = f"error: {exc}"

        # ------------------------------------------------------------------
        # VOLTHA inventory (tenant-aware if metadata available)
        # ------------------------------------------------------------------
        voltha_added = 0
        try:
            voltha_client = self.voltha
            if voltha_client and hasattr(voltha_client, "get_devices"):
                get_devices = getattr(voltha_client, "get_devices")
                voltha_devices = await get_devices()
                for onu in self._normalize_collection(voltha_devices):
                    if not isinstance(onu, dict):
                        continue

                    onu_tenant = (
                        onu.get("tenant_id")
                        or (onu.get("metadata") or {}).get("tenant_id")
                        or (onu.get("custom") or {}).get("tenant_id")
                    )
                    if onu_tenant and str(onu_tenant) != tenant_scope:
                        continue
                    if onu_tenant is None:
                        # Cannot safely attribute ONU without tenant metadata
                        continue

                    status_enum = self._map_onu_status(onu)
                    host = onu.get("host_and_port") or ""
                    management_ipv4 = host.split(":")[0] if host else None
                    voltha_added += 1
                    inventory.append(
                        {
                            "id": str(
                                onu.get("id")
                                or onu.get("device_id")
                                or onu.get("serial_number")
                                or onu.get("port_id")
                            ),
                            "name": onu.get("serial_number")
                            or onu.get("device_type")
                            or f"ONU {onu.get('id', '')}",
                            "type": DeviceType.ONU.value,
                            "status": status_enum.value,
                            "management_ipv4": management_ipv4,
                            "source": "voltha",
                            "tenant_id": self.tenant_id,
                        }
                    )

        except Exception as exc:
            logger.warning(
                "Failed to load devices from VOLTHA",
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            status_notes["inventory.voltha"] = f"error: {exc}"
        else:
            if voltha_added:
                status_notes["inventory.voltha"] = f"{voltha_added} ONU device(s) from VOLTHA"
            else:
                status_notes.setdefault(
                    "inventory.voltha",
                    "No VOLTHA devices attributed to tenant",
                )

        self._inventory_status = status_notes
        return inventory

    async def _get_active_alerts(self, tenant_id: str) -> list[NetworkAlertResponse]:
        """Get active alerts for tenant"""
        tenant_scope = self._ensure_tenant_scope(tenant_id)

        if not self.session:
            logger.info(
                "Skipping alert lookup: database session unavailable",
                tenant_id=self.tenant_id,
            )
            self._alert_status = {"alerts.alarm_service": "database session unavailable"}
            return []

        alarm_service = AlarmService(self.session, tenant_scope)
        params = AlarmQueryParams(
            status=[FMAlarmStatus.ACTIVE, FMAlarmStatus.ACKNOWLEDGED],
            limit=200,
        )

        try:
            alarms = await alarm_service.query(params)
        except Exception as exc:
            logger.warning(
                "Failed to load active alerts",
                tenant_id=self.tenant_id,
                error=str(exc),
            )
            self._alert_status = {"alerts.alarm_service": f"error: {exc}"}
            return []

        alerts = [self._convert_alarm_to_network_alert(alarm) for alarm in alarms]
        self._alert_status = {
            "alerts.alarm_service": (
                f"{len(alerts)} active/acknowledged alarm(s)" if alerts else "No active alarms"
            )
        }
        return alerts

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
                health = await self.get_device_health(device_data["id"], dev_type, tenant_id)
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

    @staticmethod
    def _device_payload(data: Any) -> dict[str, Any]:
        """Normalise device payloads returned by external services."""
        if data is None:
            return {}
        if hasattr(data, "model_dump"):
            return cast(dict[str, Any], data.model_dump())
        if isinstance(data, dict):
            return data
        return {}
