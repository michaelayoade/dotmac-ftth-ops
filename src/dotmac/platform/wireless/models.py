"""
Wireless Infrastructure Models

Database models for wireless network infrastructure management including
access points, radio equipment, coverage zones, and signal monitoring.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from dotmac.platform.db import AuditMixin, Base, TenantMixin, TimestampMixin

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as BaseModel
else:
    BaseModel = Base

# ============================================================================
# Enums
# ============================================================================


class DeviceType(str, Enum):
    """Wireless device types"""

    ACCESS_POINT = "access_point"
    RADIO = "radio"
    ANTENNA = "antenna"
    CPE = "cpe"
    BACKHAUL = "backhaul"
    TOWER = "tower"


class DeviceStatus(str, Enum):
    """Device operational status"""

    ONLINE = "online"
    OFFLINE = "offline"
    DEGRADED = "degraded"
    MAINTENANCE = "maintenance"
    DECOMMISSIONED = "decommissioned"


class Frequency(str, Enum):
    """Wireless frequency bands"""

    FREQ_2_4_GHZ = "2.4GHz"
    FREQ_5_GHZ = "5GHz"
    FREQ_6_GHZ = "6GHz"
    FREQ_60_GHZ = "60GHz"
    CUSTOM = "custom"


class RadioProtocol(str, Enum):
    """Wireless protocols"""

    WIFI_4 = "802.11n"  # WiFi 4
    WIFI_5 = "802.11ac"  # WiFi 5
    WIFI_6 = "802.11ax"  # WiFi 6
    WIFI_6E = "802.11ax_6ghz"  # WiFi 6E
    WIFI_7 = "802.11be"  # WiFi 7
    WIMAX = "wimax"
    LTE = "lte"
    CUSTOM = "custom"


class CoverageType(str, Enum):
    """Coverage zone types"""

    PRIMARY = "primary"
    SECONDARY = "secondary"
    DEAD_ZONE = "dead_zone"
    INTERFERENCE = "interference"


# ============================================================================
# Models
# ============================================================================


class WirelessDevice(BaseModel, TimestampMixin, TenantMixin, AuditMixin):  # type: ignore[misc]
    """
    Wireless network device (AP, Radio, CPE, etc.)

    Tracks physical wireless infrastructure devices with location,
    configuration, and operational status.
    """

    __tablename__ = "wireless_devices"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    # Identification
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    device_type: Mapped[DeviceType] = mapped_column(
        SQLEnum(DeviceType),
        nullable=False,
        index=True,
    )
    status: Mapped[DeviceStatus] = mapped_column(
        SQLEnum(DeviceStatus),
        default=DeviceStatus.OFFLINE,
        nullable=False,
        index=True,
    )

    # Hardware info
    manufacturer: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    serial_number: Mapped[str | None] = mapped_column(String(100), unique=True)
    mac_address: Mapped[str | None] = mapped_column(String(17))
    firmware_version: Mapped[str | None] = mapped_column(String(50))

    # Network configuration
    ip_address: Mapped[str | None] = mapped_column(String(45))  # IPv6 support
    management_url: Mapped[str | None] = mapped_column(String(255))
    ssid: Mapped[str | None] = mapped_column(String(32))  # Primary SSID

    # Location (geographic coordinates)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    altitude_meters: Mapped[float | None] = mapped_column(Float)
    address: Mapped[str | None] = mapped_column(String(500))
    site_name: Mapped[str | None] = mapped_column(String(255), index=True)

    # Physical mounting
    tower_height_meters: Mapped[float | None] = mapped_column(Float)
    mounting_height_meters: Mapped[float | None] = mapped_column(Float)
    azimuth_degrees: Mapped[float | None] = mapped_column(Float)  # Antenna direction
    tilt_degrees: Mapped[float | None] = mapped_column(Float)  # Antenna tilt

    # Operational data
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    uptime_seconds: Mapped[int | None] = mapped_column(Integer)

    # External references
    netbox_device_id: Mapped[int | None] = mapped_column(Integer)
    external_id: Mapped[str | None] = mapped_column(String(255))

    # Metadata
    notes: Mapped[str | None] = mapped_column(Text)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    # Relationships
    radios: Mapped[list[WirelessRadio]] = relationship(
        "WirelessRadio",
        back_populates="device",
        cascade="all, delete-orphan",
    )
    coverage_zones: Mapped[list[CoverageZone]] = relationship(
        "CoverageZone",
        back_populates="device",
        cascade="all, delete-orphan",
    )
    signal_measurements: Mapped[list[SignalMeasurement]] = relationship(
        "SignalMeasurement",
        back_populates="device",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_wireless_devices_tenant_status", "tenant_id", "status"),
        Index("ix_wireless_devices_tenant_type", "tenant_id", "device_type"),
        Index("ix_wireless_devices_location", "latitude", "longitude"),
    )


class WirelessRadio(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Radio interface on a wireless device

    Represents individual radio transmitters/receivers with frequency,
    channel, and power settings.
    """

    __tablename__ = "wireless_radios"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("wireless_devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Radio identification
    radio_name: Mapped[str] = mapped_column(String(100), nullable=False)
    radio_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Radio configuration
    frequency: Mapped[Frequency] = mapped_column(
        SQLEnum(Frequency),
        nullable=False,
        index=True,
    )
    protocol: Mapped[RadioProtocol] = mapped_column(
        SQLEnum(RadioProtocol),
        nullable=False,
    )
    channel: Mapped[int | None] = mapped_column(Integer)
    channel_width_mhz: Mapped[int | None] = mapped_column(Integer)  # 20, 40, 80, 160

    # Power settings
    transmit_power_dbm: Mapped[float | None] = mapped_column(Float)
    max_power_dbm: Mapped[float | None] = mapped_column(Float)

    # Status
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[DeviceStatus] = mapped_column(
        SQLEnum(DeviceStatus),
        default=DeviceStatus.OFFLINE,
        nullable=False,
    )

    # Performance metrics (latest values)
    noise_floor_dbm: Mapped[float | None] = mapped_column(Float)
    interference_level: Mapped[float | None] = mapped_column(Float)
    utilization_percent: Mapped[float | None] = mapped_column(Float)
    connected_clients: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Statistics
    tx_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rx_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tx_packets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rx_packets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    retries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Metadata
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    device: Mapped[WirelessDevice] = relationship(
        "WirelessDevice",
        back_populates="radios",
    )

    __table_args__ = (
        Index("ix_wireless_radios_tenant_device", "tenant_id", "device_id"),
        # Note: frequency field already has index=True on line 209
    )


class CoverageZone(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Wireless coverage zone

    Represents areas of wireless coverage, dead zones, or interference zones
    defined by geographic polygons.
    """

    __tablename__ = "wireless_coverage_zones"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("wireless_devices.id", ondelete="SET NULL"),
        index=True,
    )

    # Zone identification
    zone_name: Mapped[str] = mapped_column(String(255), nullable=False)
    coverage_type: Mapped[CoverageType] = mapped_column(
        SQLEnum(CoverageType),
        default=CoverageType.PRIMARY,
        nullable=False,
        index=True,
    )

    # Geographic data (GeoJSON polygon)
    # Format: {"type": "Polygon", "coordinates": [[[lng, lat], ...]]}
    geometry: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)

    # Coverage center point
    center_latitude: Mapped[float | None] = mapped_column(Float)
    center_longitude: Mapped[float | None] = mapped_column(Float)

    # Signal characteristics
    estimated_signal_strength_dbm: Mapped[float | None] = mapped_column(Float)
    coverage_radius_meters: Mapped[float | None] = mapped_column(Float)

    # Frequency/protocol
    frequency: Mapped[Frequency | None] = mapped_column(SQLEnum(Frequency))

    # Metadata
    description: Mapped[str | None] = mapped_column(Text)
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    device: Mapped[WirelessDevice | None] = relationship(
        "WirelessDevice",
        back_populates="coverage_zones",
    )

    __table_args__ = (
        Index("ix_coverage_zones_tenant_type", "tenant_id", "coverage_type"),
        Index("ix_coverage_zones_center", "center_latitude", "center_longitude"),
    )

    @property
    def name(self) -> str:
        """Alias for zone_name to match GraphQL expectations."""
        return self.zone_name


class SignalMeasurement(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Signal strength measurement

    Time-series data for signal strength, noise, and quality metrics
    collected from devices or measurement points.
    """

    __tablename__ = "wireless_signal_measurements"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("wireless_devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Measurement time
    measured_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )

    # Location (where measurement was taken)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    # Signal metrics
    rssi_dbm: Mapped[float | None] = mapped_column(Float)  # Received Signal Strength
    snr_db: Mapped[float | None] = mapped_column(Float)  # Signal-to-Noise Ratio
    noise_floor_dbm: Mapped[float | None] = mapped_column(Float)
    link_quality_percent: Mapped[float | None] = mapped_column(Float)

    # Performance metrics
    throughput_mbps: Mapped[float | None] = mapped_column(Float)
    latency_ms: Mapped[float | None] = mapped_column(Float)
    packet_loss_percent: Mapped[float | None] = mapped_column(Float)
    jitter_ms: Mapped[float | None] = mapped_column(Float)

    # Connection info
    frequency: Mapped[Frequency | None] = mapped_column(SQLEnum(Frequency))
    channel: Mapped[int | None] = mapped_column(Integer)
    client_mac: Mapped[str | None] = mapped_column(String(17))

    # Metadata
    measurement_type: Mapped[str | None] = mapped_column(String(50))  # speed_test, ping, survey
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    # Relationships
    device: Mapped[WirelessDevice] = relationship(
        "WirelessDevice",
        back_populates="signal_measurements",
    )

    __table_args__ = (
        Index("ix_signal_measurements_tenant_device", "tenant_id", "device_id"),
        Index("ix_signal_measurements_measured_at", "measured_at"),
        Index("ix_signal_measurements_location", "latitude", "longitude"),
    )


class WirelessClient(BaseModel, TimestampMixin, TenantMixin):  # type: ignore[misc]
    """
    Connected wireless client

    Tracks devices currently connected or previously connected to
    wireless infrastructure.
    """

    __tablename__ = "wireless_clients"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    device_id: Mapped[UUID] = mapped_column(
        PostgresUUID(as_uuid=True),
        ForeignKey("wireless_devices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Client identification
    # Note: mac_address is indexed via ix_wireless_clients_mac in __table_args__ (line 453)
    mac_address: Mapped[str] = mapped_column(String(17), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    hostname: Mapped[str | None] = mapped_column(String(255))

    # Connection info
    ssid: Mapped[str | None] = mapped_column(String(32))
    frequency: Mapped[Frequency | None] = mapped_column(SQLEnum(Frequency))
    channel: Mapped[int | None] = mapped_column(Integer)

    # Connection status
    # Note: connected field is indexed via composite index in __table_args__ (line 454)
    connected: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    connection_duration_seconds: Mapped[int | None] = mapped_column(Integer)

    # Signal quality
    rssi_dbm: Mapped[float | None] = mapped_column(Float)
    snr_db: Mapped[float | None] = mapped_column(Float)
    tx_rate_mbps: Mapped[float | None] = mapped_column(Float)
    rx_rate_mbps: Mapped[float | None] = mapped_column(Float)

    # Traffic statistics
    tx_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rx_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tx_packets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rx_packets: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Device info (vendor lookup from MAC)
    vendor: Mapped[str | None] = mapped_column(String(255))
    device_type: Mapped[str | None] = mapped_column(String(100))  # phone, laptop, tablet, etc

    # Subscriber reference
    subscriber_id: Mapped[str | None] = mapped_column(String(255), index=True)
    customer_id: Mapped[UUID | None] = mapped_column(PostgresUUID(as_uuid=True))

    # Metadata
    extra_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    __table_args__ = (
        Index("ix_wireless_clients_tenant_device", "tenant_id", "device_id"),
        Index("ix_wireless_clients_mac", "mac_address"),
        Index("ix_wireless_clients_connected", "connected", "last_seen"),
    )


__all__ = [
    "DeviceType",
    "DeviceStatus",
    "Frequency",
    "RadioProtocol",
    "CoverageType",
    "WirelessDevice",
    "WirelessRadio",
    "CoverageZone",
    "SignalMeasurement",
    "WirelessClient",
]
