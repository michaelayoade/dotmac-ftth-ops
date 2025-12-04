"""
Wireless Infrastructure Schemas

Pydantic schemas for wireless API requests and responses.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from dotmac.platform.core.ip_validation import (
    IPv4AddressValidator,
    IPv6AddressValidator,
)

from .models import CoverageType, DeviceStatus, DeviceType, Frequency, RadioProtocol

# ============================================================================
# Wireless Device Schemas
# ============================================================================


class WirelessDeviceCreate(BaseModel):
    """Create wireless device request"""

    name: str = Field(..., min_length=1, max_length=255)
    device_type: DeviceType
    status: DeviceStatus = DeviceStatus.OFFLINE

    # Hardware
    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    mac_address: str | None = Field(None, pattern=r"^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$")
    firmware_version: str | None = None

    # Network (dual-stack support)
    management_ipv4: str | None = Field(None, description="Management IPv4 address")
    management_ipv6: str | None = Field(None, description="Management IPv6 address")
    management_url: str | None = None
    ssid: str | None = Field(None, max_length=32)

    # Backward compatibility
    ip_address: str | None = Field(None, description="[DEPRECATED] Use management_ipv4 instead")

    @field_validator("management_ipv4")
    @classmethod
    def validate_management_ipv4(cls, v: str | None) -> str | None:
        """Validate management IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("management_ipv6")
    @classmethod
    def validate_management_ipv6(cls, v: str | None) -> str | None:
        """Validate management IPv6 address"""
        return IPv6AddressValidator.validate(v)

    def model_post_init(self, __context: Any) -> None:
        """Handle backward compatibility for ip_address"""
        if self.ip_address and not self.management_ipv4:
            self.management_ipv4 = self.ip_address

    # Location
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    altitude_meters: float | None = None
    address: str | None = Field(None, max_length=500)
    site_name: str | None = Field(None, max_length=255)

    # Physical mounting
    tower_height_meters: float | None = Field(None, ge=0)
    mounting_height_meters: float | None = Field(None, ge=0)
    azimuth_degrees: float | None = Field(None, ge=0, lt=360)
    tilt_degrees: float | None = Field(None, ge=-90, le=90)

    # External references
    netbox_device_id: int | None = None
    external_id: str | None = None

    # Metadata
    notes: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class WirelessDeviceUpdate(BaseModel):
    """Update wireless device request"""

    name: str | None = None
    device_type: DeviceType | None = None
    status: DeviceStatus | None = None

    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    firmware_version: str | None = None

    # Network (dual-stack support)
    management_ipv4: str | None = None
    management_ipv6: str | None = None
    management_url: str | None = None
    ssid: str | None = None

    # Backward compatibility
    ip_address: str | None = Field(None, description="[DEPRECATED] Use management_ipv4 instead")

    @field_validator("management_ipv4")
    @classmethod
    def validate_management_ipv4(cls, v: str | None) -> str | None:
        """Validate management IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("management_ipv6")
    @classmethod
    def validate_management_ipv6(cls, v: str | None) -> str | None:
        """Validate management IPv6 address"""
        return IPv6AddressValidator.validate(v)

    def model_post_init(self, __context: Any) -> None:
        """Handle backward compatibility for ip_address"""
        if self.ip_address and not self.management_ipv4:
            self.management_ipv4 = self.ip_address

    latitude: float | None = None
    longitude: float | None = None
    altitude_meters: float | None = None
    address: str | None = None
    site_name: str | None = None

    tower_height_meters: float | None = None
    mounting_height_meters: float | None = None
    azimuth_degrees: float | None = None
    tilt_degrees: float | None = None

    netbox_device_id: int | None = None
    external_id: str | None = None

    notes: str | None = None
    extra_metadata: dict[str, Any] | None = None
    tags: list[str] | None = None


class WirelessDeviceResponse(BaseModel):
    """Wireless device response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    name: str
    device_type: DeviceType
    status: DeviceStatus

    manufacturer: str | None = None
    model: str | None = None
    serial_number: str | None = None
    mac_address: str | None = None
    firmware_version: str | None = None

    # Network (dual-stack support)
    management_ipv4: str | None = None
    management_ipv6: str | None = None
    management_url: str | None = None
    ssid: str | None = None

    # Backward compatibility - computed field
    @property
    def ip_address(self) -> str | None:
        """Backward compatibility: return IPv4 management address"""
        return self.management_ipv4

    latitude: float | None = None
    longitude: float | None = None
    altitude_meters: float | None = None
    address: str | None = None
    site_name: str | None = None

    tower_height_meters: float | None = None
    mounting_height_meters: float | None = None
    azimuth_degrees: float | None = None
    tilt_degrees: float | None = None

    last_seen: datetime | None = None
    uptime_seconds: int | None = None

    netbox_device_id: int | None = None
    external_id: str | None = None

    notes: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)

    created_at: datetime
    updated_at: datetime


# ============================================================================
# Wireless Radio Schemas
# ============================================================================


class WirelessRadioCreate(BaseModel):
    """Create wireless radio request"""

    device_id: UUID
    radio_name: str = Field(..., min_length=1, max_length=100)
    radio_index: int = Field(default=0, ge=0)

    frequency: Frequency
    protocol: RadioProtocol
    channel: int | None = Field(None, ge=1, le=196)
    channel_width_mhz: int | None = Field(None, ge=20, le=160)

    transmit_power_dbm: float | None = Field(None, ge=-10, le=30)
    max_power_dbm: float | None = Field(None, ge=-10, le=30)

    enabled: bool = True
    status: DeviceStatus = DeviceStatus.OFFLINE

    extra_metadata: dict[str, Any] = Field(default_factory=dict)


class WirelessRadioUpdate(BaseModel):
    """Update wireless radio request"""

    radio_name: str | None = None
    radio_index: int | None = None

    frequency: Frequency | None = None
    protocol: RadioProtocol | None = None
    channel: int | None = None
    channel_width_mhz: int | None = None

    transmit_power_dbm: float | None = None
    max_power_dbm: float | None = None

    enabled: bool | None = None
    status: DeviceStatus | None = None

    # Performance metrics update
    noise_floor_dbm: float | None = None
    interference_level: float | None = None
    utilization_percent: float | None = None
    connected_clients: int | None = None

    extra_metadata: dict[str, Any] | None = None


class WirelessRadioResponse(BaseModel):
    """Wireless radio response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    device_id: UUID

    radio_name: str
    radio_index: int

    frequency: Frequency
    protocol: RadioProtocol
    channel: int | None = None
    channel_width_mhz: int | None = None

    transmit_power_dbm: float | None = None
    max_power_dbm: float | None = None

    enabled: bool
    status: DeviceStatus

    noise_floor_dbm: float | None = None
    interference_level: float | None = None
    utilization_percent: float | None = None
    connected_clients: int = 0

    tx_bytes: int = 0
    rx_bytes: int = 0
    tx_packets: int = 0
    rx_packets: int = 0
    errors: int = 0
    retries: int = 0

    extra_metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime
    updated_at: datetime


# ============================================================================
# Coverage Zone Schemas
# ============================================================================


class CoverageZoneCreate(BaseModel):
    """Create coverage zone request"""

    device_id: UUID | None = None
    zone_name: str = Field(..., min_length=1, max_length=255)
    coverage_type: CoverageType = CoverageType.PRIMARY

    # GeoJSON polygon
    geometry: dict[str, Any] = Field(
        ...,
        description="GeoJSON polygon geometry",
    )

    center_latitude: float | None = Field(None, ge=-90, le=90)
    center_longitude: float | None = Field(None, ge=-180, le=180)

    estimated_signal_strength_dbm: float | None = Field(None, ge=-120, le=0)
    coverage_radius_meters: float | None = Field(None, ge=0)

    frequency: Frequency | None = None

    description: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)


class CoverageZoneUpdate(BaseModel):
    """Update coverage zone request"""

    device_id: UUID | None = None
    zone_name: str | None = None
    coverage_type: CoverageType | None = None

    geometry: dict[str, Any] | None = None

    center_latitude: float | None = None
    center_longitude: float | None = None

    estimated_signal_strength_dbm: float | None = None
    coverage_radius_meters: float | None = None

    frequency: Frequency | None = None

    description: str | None = None
    extra_metadata: dict[str, Any] | None = None


class CoverageZoneResponse(BaseModel):
    """Coverage zone response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    device_id: UUID | None = None

    zone_name: str
    coverage_type: CoverageType

    geometry: dict[str, Any]

    center_latitude: float | None = None
    center_longitude: float | None = None

    estimated_signal_strength_dbm: float | None = None
    coverage_radius_meters: float | None = None

    frequency: Frequency | None = None

    description: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime
    updated_at: datetime


# ============================================================================
# Signal Measurement Schemas
# ============================================================================


class SignalMeasurementCreate(BaseModel):
    """Create signal measurement request"""

    device_id: UUID
    measured_at: datetime | None = None

    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)

    rssi_dbm: float | None = Field(None, ge=-120, le=0)
    snr_db: float | None = Field(None, ge=-20, le=100)
    noise_floor_dbm: float | None = Field(None, ge=-120, le=0)
    link_quality_percent: float | None = Field(None, ge=0, le=100)

    throughput_mbps: float | None = Field(None, ge=0)
    latency_ms: float | None = Field(None, ge=0)
    packet_loss_percent: float | None = Field(None, ge=0, le=100)
    jitter_ms: float | None = Field(None, ge=0)

    frequency: Frequency | None = None
    channel: int | None = None
    client_mac: str | None = None

    measurement_type: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)


class SignalMeasurementResponse(BaseModel):
    """Signal measurement response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    device_id: UUID

    measured_at: datetime

    latitude: float | None = None
    longitude: float | None = None

    rssi_dbm: float | None = None
    snr_db: float | None = None
    noise_floor_dbm: float | None = None
    link_quality_percent: float | None = None

    throughput_mbps: float | None = None
    latency_ms: float | None = None
    packet_loss_percent: float | None = None
    jitter_ms: float | None = None

    frequency: Frequency | None = None
    channel: int | None = None
    client_mac: str | None = None

    measurement_type: str | None = None
    extra_metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime


# ============================================================================
# Wireless Client Schemas
# ============================================================================


class WirelessClientResponse(BaseModel):
    """Wireless client response"""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    tenant_id: str
    device_id: UUID

    mac_address: str

    # Client IP addresses (dual-stack support)
    ipv4_address: str | None = Field(None, description="Client IPv4 address")
    ipv6_address: str | None = Field(None, description="Client IPv6 address")

    # Backward compatibility
    @property
    def ip_address(self) -> str | None:
        """Backward compatibility: return IPv4 address"""
        return self.ipv4_address

    hostname: str | None = None

    @field_validator("ipv4_address")
    @classmethod
    def validate_ipv4(cls, v: str | None) -> str | None:
        """Validate client IPv4 address"""
        return IPv4AddressValidator.validate(v)

    @field_validator("ipv6_address")
    @classmethod
    def validate_ipv6(cls, v: str | None) -> str | None:
        """Validate client IPv6 address"""
        return IPv6AddressValidator.validate(v)

    ssid: str | None = None
    frequency: Frequency | None = None
    channel: int | None = None

    connected: bool
    first_seen: datetime
    last_seen: datetime
    connection_duration_seconds: int | None = None

    rssi_dbm: float | None = None
    snr_db: float | None = None
    tx_rate_mbps: float | None = None
    rx_rate_mbps: float | None = None

    tx_bytes: int = 0
    rx_bytes: int = 0
    tx_packets: int = 0
    rx_packets: int = 0

    vendor: str | None = None
    device_type: str | None = None

    subscriber_id: str | None = None
    customer_id: UUID | None = None

    extra_metadata: dict[str, Any] = Field(default_factory=dict)

    created_at: datetime
    updated_at: datetime


# ============================================================================
# Statistics Schemas
# ============================================================================


class WirelessStatistics(BaseModel):
    """Wireless infrastructure statistics"""

    total_devices: int
    online_devices: int
    offline_devices: int
    degraded_devices: int

    total_radios: int
    active_radios: int

    total_coverage_zones: int
    coverage_area_km2: float | None = None

    total_connected_clients: int
    total_clients_seen_24h: int

    by_device_type: dict[str, int]
    by_frequency: dict[str, int]
    by_site: dict[str, int]

    avg_signal_strength_dbm: float | None = None
    avg_client_throughput_mbps: float | None = None


class DeviceHealthSummary(BaseModel):
    """Device health summary"""

    device_id: UUID
    device_name: str
    device_type: DeviceType
    status: DeviceStatus

    total_radios: int
    active_radios: int
    connected_clients: int

    avg_rssi_dbm: float | None = None
    avg_snr_db: float | None = None
    avg_utilization_percent: float | None = None

    total_tx_bytes: int
    total_rx_bytes: int

    last_seen: datetime | None = None
    uptime_seconds: int | None = None


__all__ = [
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
]
