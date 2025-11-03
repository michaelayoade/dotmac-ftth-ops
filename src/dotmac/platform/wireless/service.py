"""
Wireless Infrastructure Service

Business logic for wireless network infrastructure management.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

import structlog
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from .models import (
    CoverageType,
    CoverageZone,
    DeviceStatus,
    DeviceType,
    SignalMeasurement,
    WirelessClient,
    WirelessDevice,
    WirelessRadio,
)
from .schemas import (
    CoverageZoneCreate,
    CoverageZoneUpdate,
    DeviceHealthSummary,
    SignalMeasurementCreate,
    WirelessDeviceCreate,
    WirelessDeviceUpdate,
    WirelessRadioCreate,
    WirelessRadioUpdate,
    WirelessStatistics,
)

logger = structlog.get_logger(__name__)


class WirelessService:
    """Service for wireless infrastructure management"""

    def __init__(self, db: Session, tenant_id: str):
        self.db = db
        self.tenant_id = tenant_id

    # ========================================================================
    # Wireless Device Methods
    # ========================================================================

    def create_device(self, data: WirelessDeviceCreate) -> WirelessDevice:
        """Create a new wireless device"""
        device = WirelessDevice(
            tenant_id=self.tenant_id,
            **data.model_dump(),
        )
        self.db.add(device)
        self.db.commit()
        self.db.refresh(device)

        logger.info(
            "wireless.device.created",
            device_id=str(device.id),
            device_name=device.name,
            device_type=device.device_type.value,
            tenant_id=self.tenant_id,
        )

        return device

    def get_device(self, device_id: UUID, include_radios: bool = False) -> WirelessDevice | None:
        """Get wireless device by ID"""
        query = self.db.query(WirelessDevice).filter(
            WirelessDevice.id == device_id,
            WirelessDevice.tenant_id == self.tenant_id,
        )

        if include_radios:
            query = query.options(joinedload(WirelessDevice.radios))

        return query.first()

    def list_devices(
        self,
        device_type: DeviceType | None = None,
        status: DeviceStatus | None = None,
        site_name: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WirelessDevice]:
        """List wireless devices with filters"""
        query = self.db.query(WirelessDevice).filter(
            WirelessDevice.tenant_id == self.tenant_id,
        )

        if device_type:
            query = query.filter(WirelessDevice.device_type == device_type)

        if status:
            query = query.filter(WirelessDevice.status == status)

        if site_name:
            query = query.filter(WirelessDevice.site_name.ilike(f"%{site_name}%"))

        return query.order_by(WirelessDevice.created_at.desc()).limit(limit).offset(offset).all()

    def update_device(self, device_id: UUID, data: WirelessDeviceUpdate) -> WirelessDevice | None:
        """Update wireless device"""
        device = self.get_device(device_id)
        if not device:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(device, field, value)

        self.db.commit()
        self.db.refresh(device)

        logger.info(
            "wireless.device.updated",
            device_id=str(device.id),
            updates=list(update_data.keys()),
            tenant_id=self.tenant_id,
        )

        return device

    def delete_device(self, device_id: UUID) -> bool:
        """Delete wireless device"""
        device = self.get_device(device_id)
        if not device:
            return False

        self.db.delete(device)
        self.db.commit()

        logger.info(
            "wireless.device.deleted",
            device_id=str(device_id),
            tenant_id=self.tenant_id,
        )

        return True

    def update_device_status(
        self, device_id: UUID, status: DeviceStatus, last_seen: datetime | None = None
    ) -> WirelessDevice | None:
        """Update device status and last seen timestamp"""
        device = self.get_device(device_id)
        if not device:
            return None

        device.status = status
        if last_seen:
            device.last_seen = last_seen

        self.db.commit()
        self.db.refresh(device)

        return device

    # ========================================================================
    # Wireless Radio Methods
    # ========================================================================

    def create_radio(self, data: WirelessRadioCreate) -> WirelessRadio:
        """Create a new wireless radio"""
        # Verify device exists and belongs to tenant
        device = self.get_device(data.device_id)
        if not device:
            raise ValueError(f"Device {data.device_id} not found")

        radio = WirelessRadio(
            tenant_id=self.tenant_id,
            **data.model_dump(),
        )
        self.db.add(radio)
        self.db.commit()
        self.db.refresh(radio)

        logger.info(
            "wireless.radio.created",
            radio_id=str(radio.id),
            device_id=str(radio.device_id),
            frequency=radio.frequency.value,
            tenant_id=self.tenant_id,
        )

        return radio

    def get_radio(self, radio_id: UUID) -> WirelessRadio | None:
        """Get wireless radio by ID"""
        return (
            self.db.query(WirelessRadio)
            .filter(
                WirelessRadio.id == radio_id,
                WirelessRadio.tenant_id == self.tenant_id,
            )
            .first()
        )

    def list_radios(
        self,
        device_id: UUID | None = None,
        enabled: bool | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[WirelessRadio]:
        """List wireless radios with filters"""
        query = self.db.query(WirelessRadio).filter(
            WirelessRadio.tenant_id == self.tenant_id,
        )

        if device_id:
            query = query.filter(WirelessRadio.device_id == device_id)

        if enabled is not None:
            query = query.filter(WirelessRadio.enabled == enabled)

        return query.order_by(WirelessRadio.created_at.desc()).limit(limit).offset(offset).all()

    def update_radio(self, radio_id: UUID, data: WirelessRadioUpdate) -> WirelessRadio | None:
        """Update wireless radio"""
        radio = self.get_radio(radio_id)
        if not radio:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(radio, field, value)

        self.db.commit()
        self.db.refresh(radio)

        logger.info(
            "wireless.radio.updated",
            radio_id=str(radio.id),
            updates=list(update_data.keys()),
            tenant_id=self.tenant_id,
        )

        return radio

    def delete_radio(self, radio_id: UUID) -> bool:
        """Delete wireless radio"""
        radio = self.get_radio(radio_id)
        if not radio:
            return False

        self.db.delete(radio)
        self.db.commit()

        logger.info(
            "wireless.radio.deleted",
            radio_id=str(radio_id),
            tenant_id=self.tenant_id,
        )

        return True

    # ========================================================================
    # Coverage Zone Methods
    # ========================================================================

    def create_coverage_zone(self, data: CoverageZoneCreate) -> CoverageZone:
        """Create a new coverage zone"""
        # Verify device exists if provided
        if data.device_id:
            device = self.get_device(data.device_id)
            if not device:
                raise ValueError(f"Device {data.device_id} not found")

        zone = CoverageZone(
            tenant_id=self.tenant_id,
            **data.model_dump(),
        )
        self.db.add(zone)
        self.db.commit()
        self.db.refresh(zone)

        logger.info(
            "wireless.coverage_zone.created",
            zone_id=str(zone.id),
            zone_name=zone.zone_name,
            coverage_type=zone.coverage_type.value,
            tenant_id=self.tenant_id,
        )

        return zone

    def get_coverage_zone(self, zone_id: UUID) -> CoverageZone | None:
        """Get coverage zone by ID"""
        return (
            self.db.query(CoverageZone)
            .filter(
                CoverageZone.id == zone_id,
                CoverageZone.tenant_id == self.tenant_id,
            )
            .first()
        )

    def list_coverage_zones(
        self,
        device_id: UUID | None = None,
        coverage_type: CoverageType | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CoverageZone]:
        """List coverage zones with filters"""
        query = self.db.query(CoverageZone).filter(
            CoverageZone.tenant_id == self.tenant_id,
        )

        if device_id:
            query = query.filter(CoverageZone.device_id == device_id)

        if coverage_type:
            query = query.filter(CoverageZone.coverage_type == coverage_type)

        return query.order_by(CoverageZone.created_at.desc()).limit(limit).offset(offset).all()

    def update_coverage_zone(self, zone_id: UUID, data: CoverageZoneUpdate) -> CoverageZone | None:
        """Update coverage zone"""
        zone = self.get_coverage_zone(zone_id)
        if not zone:
            return None

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(zone, field, value)

        self.db.commit()
        self.db.refresh(zone)

        logger.info(
            "wireless.coverage_zone.updated",
            zone_id=str(zone.id),
            updates=list(update_data.keys()),
            tenant_id=self.tenant_id,
        )

        return zone

    def delete_coverage_zone(self, zone_id: UUID) -> bool:
        """Delete coverage zone"""
        zone = self.get_coverage_zone(zone_id)
        if not zone:
            return False

        self.db.delete(zone)
        self.db.commit()

        logger.info(
            "wireless.coverage_zone.deleted",
            zone_id=str(zone_id),
            tenant_id=self.tenant_id,
        )

        return True

    # ========================================================================
    # Signal Measurement Methods
    # ========================================================================

    def create_signal_measurement(self, data: SignalMeasurementCreate) -> SignalMeasurement:
        """Create a new signal measurement"""
        # Verify device exists
        device = self.get_device(data.device_id)
        if not device:
            raise ValueError(f"Device {data.device_id} not found")

        measurement_data = data.model_dump()
        if not measurement_data.get("measured_at"):
            measurement_data["measured_at"] = datetime.now(UTC)

        measurement = SignalMeasurement(
            tenant_id=self.tenant_id,
            **measurement_data,
        )
        self.db.add(measurement)
        self.db.commit()
        self.db.refresh(measurement)

        return measurement

    def list_signal_measurements(
        self,
        device_id: UUID | None = None,
        since: datetime | None = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> list[SignalMeasurement]:
        """List signal measurements with filters"""
        query = self.db.query(SignalMeasurement).filter(
            SignalMeasurement.tenant_id == self.tenant_id,
        )

        if device_id:
            query = query.filter(SignalMeasurement.device_id == device_id)

        if since:
            query = query.filter(SignalMeasurement.measured_at >= since)

        return (
            query.order_by(SignalMeasurement.measured_at.desc()).limit(limit).offset(offset).all()
        )

    # ========================================================================
    # Wireless Client Methods
    # ========================================================================

    def list_connected_clients(
        self,
        device_id: UUID | None = None,
        connected_only: bool = True,
        limit: int = 500,
        offset: int = 0,
    ) -> list[WirelessClient]:
        """List wireless clients"""
        query = self.db.query(WirelessClient).filter(
            WirelessClient.tenant_id == self.tenant_id,
        )

        if device_id:
            query = query.filter(WirelessClient.device_id == device_id)

        if connected_only:
            query = query.filter(WirelessClient.connected)

        return query.order_by(WirelessClient.last_seen.desc()).limit(limit).offset(offset).all()

    # ========================================================================
    # Statistics & Analytics Methods
    # ========================================================================

    def get_statistics(self) -> WirelessStatistics:
        """Get wireless infrastructure statistics"""
        # Device counts by status
        total_devices = (
            self.db.query(func.count(WirelessDevice.id))
            .filter(WirelessDevice.tenant_id == self.tenant_id)
            .scalar()
            or 0
        )

        online_devices = (
            self.db.query(func.count(WirelessDevice.id))
            .filter(
                WirelessDevice.tenant_id == self.tenant_id,
                WirelessDevice.status == DeviceStatus.ONLINE,
            )
            .scalar()
            or 0
        )

        offline_devices = (
            self.db.query(func.count(WirelessDevice.id))
            .filter(
                WirelessDevice.tenant_id == self.tenant_id,
                WirelessDevice.status == DeviceStatus.OFFLINE,
            )
            .scalar()
            or 0
        )

        degraded_devices = (
            self.db.query(func.count(WirelessDevice.id))
            .filter(
                WirelessDevice.tenant_id == self.tenant_id,
                WirelessDevice.status == DeviceStatus.DEGRADED,
            )
            .scalar()
            or 0
        )

        # Radio counts
        total_radios = (
            self.db.query(func.count(WirelessRadio.id))
            .filter(WirelessRadio.tenant_id == self.tenant_id)
            .scalar()
            or 0
        )

        active_radios = (
            self.db.query(func.count(WirelessRadio.id))
            .filter(
                WirelessRadio.tenant_id == self.tenant_id,
                WirelessRadio.enabled,
                WirelessRadio.status == DeviceStatus.ONLINE,
            )
            .scalar()
            or 0
        )

        # Coverage zones
        total_coverage_zones = (
            self.db.query(func.count(CoverageZone.id))
            .filter(CoverageZone.tenant_id == self.tenant_id)
            .scalar()
            or 0
        )

        # Client counts
        total_connected_clients = (
            self.db.query(func.count(WirelessClient.id))
            .filter(
                WirelessClient.tenant_id == self.tenant_id,
                WirelessClient.connected,
            )
            .scalar()
            or 0
        )

        since_24h = datetime.now(UTC) - timedelta(hours=24)
        total_clients_seen_24h = (
            self.db.query(func.count(WirelessClient.id))
            .filter(
                WirelessClient.tenant_id == self.tenant_id,
                WirelessClient.last_seen >= since_24h,
            )
            .scalar()
            or 0
        )

        # Group by device type
        by_device_type_results = (
            self.db.query(
                WirelessDevice.device_type,
                func.count(WirelessDevice.id),
            )
            .filter(WirelessDevice.tenant_id == self.tenant_id)
            .group_by(WirelessDevice.device_type)
            .all()
        )

        by_device_type = {str(dt.value): count for dt, count in by_device_type_results}

        # Group by frequency
        by_frequency_results = (
            self.db.query(
                WirelessRadio.frequency,
                func.count(WirelessRadio.id),
            )
            .filter(WirelessRadio.tenant_id == self.tenant_id)
            .group_by(WirelessRadio.frequency)
            .all()
        )

        by_frequency = {str(freq.value): count for freq, count in by_frequency_results}

        # Group by site
        by_site_results = (
            self.db.query(
                WirelessDevice.site_name,
                func.count(WirelessDevice.id),
            )
            .filter(
                WirelessDevice.tenant_id == self.tenant_id,
                WirelessDevice.site_name.isnot(None),
            )
            .group_by(WirelessDevice.site_name)
            .all()
        )

        by_site = {site: count for site, count in by_site_results if site}

        # Average signal strength from recent measurements
        since_1h = datetime.now(UTC) - timedelta(hours=1)
        avg_signal = (
            self.db.query(func.avg(SignalMeasurement.rssi_dbm))
            .filter(
                SignalMeasurement.tenant_id == self.tenant_id,
                SignalMeasurement.measured_at >= since_1h,
                SignalMeasurement.rssi_dbm.isnot(None),
            )
            .scalar()
        )

        avg_throughput = (
            self.db.query(func.avg(SignalMeasurement.throughput_mbps))
            .filter(
                SignalMeasurement.tenant_id == self.tenant_id,
                SignalMeasurement.measured_at >= since_1h,
                SignalMeasurement.throughput_mbps.isnot(None),
            )
            .scalar()
        )

        # Calculate total coverage area from coverage zones
        coverage_area_km2 = None
        if total_coverage_zones > 0:
            coverage_zones = (
                self.db.query(CoverageZone)
                .filter(
                    CoverageZone.tenant_id == self.tenant_id,
                    CoverageZone.coverage_type
                    == CoverageType.PRIMARY,  # Only count primary coverage
                )
                .all()
            )

            total_area = 0.0
            for zone in coverage_zones:
                if zone.geometry and zone.geometry.get("type") == "Polygon":
                    # Calculate polygon area using Shoelace formula (geographic approximation)
                    area_km2 = self._calculate_polygon_area_km2(zone.geometry["coordinates"])
                    total_area += area_km2

            coverage_area_km2 = total_area if total_area > 0 else None

        return WirelessStatistics(
            total_devices=total_devices,
            online_devices=online_devices,
            offline_devices=offline_devices,
            degraded_devices=degraded_devices,
            total_radios=total_radios,
            active_radios=active_radios,
            total_coverage_zones=total_coverage_zones,
            coverage_area_km2=coverage_area_km2,
            total_connected_clients=total_connected_clients,
            total_clients_seen_24h=total_clients_seen_24h,
            by_device_type=by_device_type,
            by_frequency=by_frequency,
            by_site=by_site,
            avg_signal_strength_dbm=float(avg_signal) if avg_signal else None,
            avg_client_throughput_mbps=float(avg_throughput) if avg_throughput else None,
        )

    def get_device_health(self, device_id: UUID) -> DeviceHealthSummary | None:
        """Get device health summary"""
        device = self.get_device(device_id, include_radios=True)
        if not device:
            return None

        # Count radios
        total_radios = len(device.radios)
        active_radios = sum(
            1 for r in device.radios if r.enabled and r.status == DeviceStatus.ONLINE
        )

        # Count connected clients
        connected_clients = (
            self.db.query(func.count(WirelessClient.id))
            .filter(
                WirelessClient.tenant_id == self.tenant_id,
                WirelessClient.device_id == device_id,
                WirelessClient.connected,
            )
            .scalar()
            or 0
        )

        # Average metrics from radios
        radio_metrics = (
            self.db.query(
                func.avg(WirelessRadio.utilization_percent),
            )
            .filter(
                WirelessRadio.tenant_id == self.tenant_id,
                WirelessRadio.device_id == device_id,
                WirelessRadio.enabled,
            )
            .first()
        )

        avg_utilization = float(radio_metrics[0]) if radio_metrics and radio_metrics[0] else None

        # Recent signal measurements
        since_1h = datetime.now(UTC) - timedelta(hours=1)
        signal_metrics = (
            self.db.query(
                func.avg(SignalMeasurement.rssi_dbm),
                func.avg(SignalMeasurement.snr_db),
            )
            .filter(
                SignalMeasurement.tenant_id == self.tenant_id,
                SignalMeasurement.device_id == device_id,
                SignalMeasurement.measured_at >= since_1h,
            )
            .first()
        )

        avg_rssi = float(signal_metrics[0]) if signal_metrics and signal_metrics[0] else None
        avg_snr = float(signal_metrics[1]) if signal_metrics and signal_metrics[1] else None

        # Total traffic
        traffic_stats = (
            self.db.query(
                func.sum(WirelessRadio.tx_bytes),
                func.sum(WirelessRadio.rx_bytes),
            )
            .filter(
                WirelessRadio.tenant_id == self.tenant_id,
                WirelessRadio.device_id == device_id,
            )
            .first()
        )

        total_tx_bytes = int(traffic_stats[0]) if traffic_stats and traffic_stats[0] else 0
        total_rx_bytes = int(traffic_stats[1]) if traffic_stats and traffic_stats[1] else 0

        return DeviceHealthSummary(
            device_id=device.id,
            device_name=device.name,
            device_type=device.device_type,
            status=device.status,
            total_radios=total_radios,
            active_radios=active_radios,
            connected_clients=connected_clients,
            avg_rssi_dbm=avg_rssi,
            avg_snr_db=avg_snr,
            avg_utilization_percent=avg_utilization,
            total_tx_bytes=total_tx_bytes,
            total_rx_bytes=total_rx_bytes,
            last_seen=device.last_seen,
            uptime_seconds=device.uptime_seconds,
        )

    def _calculate_polygon_area_km2(self, coordinates: list) -> float:
        """
        Calculate approximate area of a polygon in square kilometers.

        Uses the Shoelace formula with spherical correction for geographic coordinates.
        This is an approximation suitable for small to medium-sized areas.

        Args:
            coordinates: GeoJSON polygon coordinates [[[lng, lat], ...]]

        Returns:
            Area in square kilometers
        """
        import math

        if not coordinates or len(coordinates) == 0:
            return 0.0

        # Get outer ring (first element in coordinates)
        ring = coordinates[0]
        if len(ring) < 3:
            return 0.0

        # Earth's radius in km
        R = 6371.0

        # Calculate area using spherical excess formula for better accuracy
        # For simplicity, using planar approximation with latitude correction
        total_area = 0.0

        # Get average latitude for correction factor
        avg_lat = sum(point[1] for point in ring) / len(ring)
        lat_correction = math.cos(math.radians(avg_lat))

        # Shoelace formula
        for i in range(len(ring) - 1):
            lon1, lat1 = ring[i][0], ring[i][1]
            lon2, lat2 = ring[i + 1][0], ring[i + 1][1]

            # Convert to radians and apply correction
            x1 = math.radians(lon1) * lat_correction
            y1 = math.radians(lat1)
            x2 = math.radians(lon2) * lat_correction
            y2 = math.radians(lat2)

            total_area += x1 * y2 - x2 * y1

        # Complete the formula
        area_rad2 = abs(total_area) / 2.0

        # Convert to km² (R² * area in steradians)
        area_km2 = area_rad2 * (R**2)

        return area_km2


__all__ = ["WirelessService"]
