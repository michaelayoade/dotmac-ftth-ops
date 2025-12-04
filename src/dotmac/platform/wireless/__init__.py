"""
Wireless Infrastructure Module

Provides wireless network infrastructure management including
access points, radios, coverage zones, and signal monitoring.

Stack Placement: ISP-ONLY
-------------------------
This module is deployed ONLY in the ISP tenant stack (docker-compose.isp.yml).
It should NOT be included in the platform admin stack. Each ISP (especially WISPs)
manages their own wireless infrastructure.

Maturity: Beta (~65%)
---------------------
- Database models: Complete (devices, radios, coverage zones, signals, clients)
- Service layer: Full CRUD with tenant isolation
- API router: REST endpoints for all operations
- Statistics and health monitoring: Implemented
- NetBox integration field: Ready for external sync

Implemented Features:
- Device inventory management (AP, Radio, Antenna, CPE, Backhaul, Tower)
- Radio configuration tracking (frequency, channel, power, protocol)
- Coverage zone management with GeoJSON polygon support
- Signal measurement time-series data
- Client tracking with traffic statistics
- Geographic location support (lat/lng/altitude)

Missing Features (Planned):
- Controller integrations (UniFi, Mikrotik Wireless, Cambium, etc.)
- Device auto-discovery via SNMP/API
- Real-time signal monitoring push
- Spectrum analysis integration

Use Cases:
- WISP infrastructure management
- Tower site inventory
- Coverage planning and verification
- Client connection tracking
"""

from .models import (
    CoverageType,
    CoverageZone,
    DeviceStatus,
    DeviceType,
    Frequency,
    RadioProtocol,
    SignalMeasurement,
    WirelessClient,
    WirelessDevice,
    WirelessRadio,
)
from .router import router
from .schemas import (
    CoverageZoneCreate,
    CoverageZoneResponse,
    CoverageZoneUpdate,
    DeviceHealthSummary,
    SignalMeasurementCreate,
    SignalMeasurementResponse,
    WirelessClientResponse,
    WirelessDeviceCreate,
    WirelessDeviceResponse,
    WirelessDeviceUpdate,
    WirelessRadioCreate,
    WirelessRadioResponse,
    WirelessRadioUpdate,
    WirelessStatistics,
)
from .service import WirelessService

__all__ = [
    # Models
    "WirelessDevice",
    "WirelessRadio",
    "CoverageZone",
    "SignalMeasurement",
    "WirelessClient",
    "DeviceType",
    "DeviceStatus",
    "Frequency",
    "RadioProtocol",
    "CoverageType",
    # Schemas
    "WirelessDeviceCreate",
    "WirelessDeviceUpdate",
    "WirelessDeviceResponse",
    "WirelessRadioCreate",
    "WirelessRadioUpdate",
    "WirelessRadioResponse",
    "CoverageZoneCreate",
    "CoverageZoneUpdate",
    "CoverageZoneResponse",
    "SignalMeasurementCreate",
    "SignalMeasurementResponse",
    "WirelessClientResponse",
    "WirelessStatistics",
    "DeviceHealthSummary",
    # Service
    "WirelessService",
    # Router
    "router",
]
