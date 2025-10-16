"""
Wireless Infrastructure Module

Provides wireless network infrastructure management including
access points, radios, coverage zones, and signal monitoring.
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
