"""
Network Monitoring Module

Provides comprehensive network device and traffic monitoring for ISP operations.
Integrates with NetBox, VOLTHA, GenieACS, Prometheus, and SNMP for unified monitoring.

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP tenant monitors
their own network infrastructure independently.

Maturity: Beta (~75%)
---------------------
- Schemas and API routes: Complete
- Device inventory: NetBox + VOLTHA + GenieACS integration
- Device health monitoring: Complete (ONU, CPE, network devices)
- Traffic statistics: Prometheus integration
- Alert management: Uses fault_management.AlarmService
- SNMP collection: Available via access.snmp module

Data Sources:
- NetBox: Device inventory, IPAM, sites
- VOLTHA: ONU/OLT metrics, PON statistics
- GenieACS: CPE device health, WiFi status
- Prometheus: Traffic rates, bytes counters
- AlarmService: Active alerts and alarm history

Configuration:
- OSS service configs (OSSService.PROMETHEUS, OSSService.NETBOX, etc.)
- Custom Prometheus query templates via ServiceConfig.extras

Alert Delivery:
Alert delivery is handled via the plugin system (AlertDeliveryProvider).
No built-in Slack/email/webhook - implement custom plugins instead.

Example plugin implementation:
    from dotmac.platform.plugins import AlertDeliveryProvider

    class PagerDutyAlertPlugin(AlertDeliveryProvider):
        async def deliver_alert(self, alert, recipients, metadata):
            # Send to PagerDuty API
            return True

See: src/dotmac/platform/plugins/interfaces.py for full interface.
"""

from dotmac.platform.network_monitoring.schemas import (
    DeviceHealthResponse,
    DeviceMetricsResponse,
    NetworkAlertResponse,
    NetworkOverviewResponse,
    TrafficStatsResponse,
)

__all__ = [
    "DeviceHealthResponse",
    "DeviceMetricsResponse",
    "NetworkAlertResponse",
    "NetworkOverviewResponse",
    "TrafficStatsResponse",
]
