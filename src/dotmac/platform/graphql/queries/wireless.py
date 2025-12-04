"""
Wireless Infrastructure GraphQL Query Resolvers

Implements GraphQL query resolvers for wireless network management:
- Access Point queries (list, detail, by site)
- Wireless Client queries (list, by AP, by customer)
- Coverage Zone queries (list, by site)
- RF Analytics queries (spectrum analysis, channel utilization)
- Wireless Dashboard (aggregated metrics)

Created: 2025-10-16
"""

import json
import uuid
from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime
from statistics import mean
from typing import Any

import strawberry
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from strawberry.types import Info

from dotmac.platform.graphql.types.wireless import (
    AccessPoint,
    AccessPointConnection,
    AccessPointStatus,
    APPerformanceMetrics,
    ChannelUtilization,
    ClientConnectionType,
    CoverageZone,
    CoverageZoneConnection,
    FrequencyBand,
    GeoLocation,
    InstallationLocation,
    RFAnalytics,
    RFMetrics,
    SignalQuality,
    WirelessClient,
    WirelessClientConnection,
    WirelessDashboard,
    WirelessSecurityType,
    WirelessSiteMetrics,
)
from dotmac.platform.wireless.models import (
    CoverageZone as CoverageZoneModel,
)
from dotmac.platform.wireless.models import (
    DeviceStatus,
    DeviceType,
    Frequency,
    WirelessDevice,
    WirelessRadio,
)
from dotmac.platform.wireless.models import (
    WirelessClient as WirelessClientModel,
)


async def _fetch_site_radios(db: AsyncSession, tenant_id: str, site_id: str) -> list[WirelessRadio]:
    radios_query = (
        select(WirelessRadio)
        .join(WirelessDevice)
        .options(selectinload(WirelessRadio.device))
        .where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.site_name == site_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
            )
        )
    )
    result = await db.execute(radios_query)
    radios_sequence: Sequence[WirelessRadio] = result.unique().scalars().all()
    return list(radios_sequence)


def _channel_to_frequency_mhz(channel: int | None, frequency: Frequency) -> int:
    if channel is None:
        return 0
    if frequency == Frequency.FREQ_2_4_GHZ:
        return 2407 + channel * 5
    if frequency == Frequency.FREQ_5_GHZ:
        return 5000 + channel * 5
    if frequency == Frequency.FREQ_6_GHZ:
        return 5950 + channel * 5
    return 0


@strawberry.type
class WirelessQueries:
    """Wireless infrastructure GraphQL queries."""

    # ========================================================================
    # Access Point Queries
    # ========================================================================

    @strawberry.field
    async def access_points(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        site_id: str | None = None,
        status: AccessPointStatus | None = None,
        frequency_band: FrequencyBand | None = None,
        search: str | None = None,
    ) -> AccessPointConnection:
        """
        Query access points with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            site_id: Filter by site ID
            status: Filter by operational status
            frequency_band: Filter by frequency band
            search: Search by name, MAC address, or IP

        Returns:
            Paginated access points list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit is None or limit <= 0 or offset < 0:
            return AccessPointConnection(
                access_points=[],
                total_count=0,
                has_next_page=False,
            )

        # Build query for access points (device_type = ACCESS_POINT)
        query = select(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
            )
        )

        # Apply filters
        if site_id:
            query = query.where(WirelessDevice.site_name == site_id)

        if status:
            # Map GraphQL status to database status
            db_status = (
                DeviceStatus.ONLINE
                if status == AccessPointStatus.ONLINE
                else (
                    DeviceStatus.OFFLINE
                    if status == AccessPointStatus.OFFLINE
                    else (
                        DeviceStatus.DEGRADED
                        if status == AccessPointStatus.DEGRADED
                        else DeviceStatus.MAINTENANCE
                    )
                )
            )
            query = query.where(WirelessDevice.status == db_status)

        if search:
            query = query.where(
                or_(
                    WirelessDevice.name.ilike(f"%{search}%"),
                    WirelessDevice.mac_address.ilike(f"%{search}%"),
                    WirelessDevice.ip_address.ilike(f"%{search}%"),
                )
            )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(WirelessDevice.name)

        # Execute query
        result = await db.execute(query)
        device_models = result.scalars().all()

        # Map to GraphQL types
        access_points = [map_device_to_access_point(device) for device in device_models]

        return AccessPointConnection(
            access_points=access_points,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def access_point(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> AccessPoint | None:
        """
        Query a single access point by ID.

        Args:
            id: Access point ID

        Returns:
            Access point details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        lookup_id: uuid.UUID | str
        try:
            lookup_id = uuid.UUID(str(id))
        except ValueError:
            lookup_id = str(id)

        query = select(WirelessDevice).where(
            and_(
                WirelessDevice.id == lookup_id,
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
            )
        )
        result = await db.execute(query)
        device = result.scalar_one_or_none()

        if not device:
            return None

        return map_device_to_access_point(device)

    @strawberry.field
    async def access_points_by_site(
        self,
        info: Info,
        site_id: str,
    ) -> list[AccessPoint]:
        """
        Query all access points at a specific site.

        Args:
            site_id: Site identifier

        Returns:
            List of access points at the site
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = (
            select(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.site_name == site_id,
                )
            )
            .order_by(WirelessDevice.name)
        )

        result = await db.execute(query)
        devices = result.scalars().all()

        return [map_device_to_access_point(device) for device in devices]

    # ========================================================================
    # Wireless Client Queries
    # ========================================================================

    @strawberry.field
    async def wireless_clients(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        access_point_id: str | None = None,
        customer_id: str | None = None,
        frequency_band: FrequencyBand | None = None,
        search: str | None = None,
    ) -> WirelessClientConnection:
        """
        Query wireless clients with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            access_point_id: Filter by access point
            customer_id: Filter by customer
            frequency_band: Filter by frequency band
            search: Search by MAC, hostname, or IP

        Returns:
            Paginated wireless clients list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        if limit is None or limit < 0 or offset < 0:
            return WirelessClientConnection(
                clients=[],
                total_count=0,
                has_next_page=False,
            )

        # Base query for wireless clients
        query = (
            select(WirelessClientModel)
            .where(WirelessClientModel.tenant_id == tenant_id)
            .order_by(desc(WirelessClientModel.last_seen))
        )

        if access_point_id:
            try:
                ap_uuid = uuid.UUID(str(access_point_id))
            except ValueError:
                # Invalid UUID -> no results
                return WirelessClientConnection(
                    clients=[],
                    total_count=0,
                    has_next_page=False,
                )
            query = query.where(WirelessClientModel.device_id == ap_uuid)

        if frequency_band:
            db_freq = (
                Frequency.FREQ_2_4_GHZ
                if frequency_band == FrequencyBand.BAND_2_4_GHZ
                else (
                    Frequency.FREQ_5_GHZ
                    if frequency_band == FrequencyBand.BAND_5_GHZ
                    else Frequency.FREQ_6_GHZ
                )
            )
            query = query.where(WirelessClientModel.frequency == db_freq)

        if search:
            query = query.where(
                or_(
                    WirelessClientModel.mac_address.ilike(f"%{search}%"),
                    WirelessClientModel.hostname.ilike(f"%{search}%"),
                    WirelessClientModel.ip_address.ilike(f"%{search}%"),
                )
            )

        result = await db.execute(query)
        client_models_seq = result.scalars().all()
        client_models: list[WirelessClientModel] = list(client_models_seq)

        if customer_id:
            filtered_clients: list[WirelessClientModel] = []
            for client in client_models:
                matches = False
                if client.customer_id and str(client.customer_id) == customer_id:
                    matches = True
                else:
                    metadata = client.extra_metadata or {}
                    customer_meta = metadata.get("customer") or {}
                    if customer_meta.get("id") == customer_id:
                        matches = True
                if matches:
                    filtered_clients.append(client)
            client_models = filtered_clients

        total_count = len(client_models)

        if offset >= total_count or limit == 0:
            paginated_models: list[WirelessClientModel] = []
        else:
            end = offset + limit if limit else None
            paginated_models = client_models[offset:end]

        clients = [map_client_model_to_graphql(client) for client in paginated_models]

        has_next_page = (offset + len(paginated_models)) < total_count

        return WirelessClientConnection(
            clients=clients,
            total_count=total_count,
            has_next_page=has_next_page,
        )

    @strawberry.field
    async def wireless_client(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> WirelessClient | None:
        """
        Query a single wireless client by ID.

        Args:
            id: Client ID

        Returns:
            Wireless client details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            client_id = uuid.UUID(str(id))
        except ValueError:
            return None

        query = select(WirelessClientModel).where(
            and_(
                WirelessClientModel.id == client_id,
                WirelessClientModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        client = result.scalar_one_or_none()

        if not client:
            return None

        return map_client_model_to_graphql(client)

    @strawberry.field
    async def wireless_clients_by_access_point(
        self,
        info: Info,
        access_point_id: str,
    ) -> list[WirelessClient]:
        """
        Query all clients connected to a specific access point.

        Args:
            access_point_id: Access point identifier

        Returns:
            List of connected clients
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            ap_uuid = uuid.UUID(str(access_point_id))
        except ValueError:
            return []

        query = (
            select(WirelessClientModel)
            .where(
                and_(
                    WirelessClientModel.tenant_id == tenant_id,
                    WirelessClientModel.device_id == ap_uuid,
                )
            )
            .order_by(desc(WirelessClientModel.last_seen))
        )

        result = await db.execute(query)
        clients = result.scalars().all()

        return [map_client_model_to_graphql(client) for client in clients]

    @strawberry.field
    async def wireless_clients_by_customer(
        self,
        info: Info,
        customer_id: str,
    ) -> list[WirelessClient]:
        """
        Query all wireless clients for a specific customer.

        Args:
            customer_id: Customer identifier

        Returns:
            List of customer's wireless clients
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = (
            select(WirelessClientModel)
            .where(WirelessClientModel.tenant_id == tenant_id)
            .order_by(desc(WirelessClientModel.last_seen))
        )

        result = await db.execute(query)
        clients = result.scalars().all()

        filtered_clients: list[WirelessClientModel] = []
        for client in clients:
            matches = False
            if client.customer_id and str(client.customer_id) == customer_id:
                matches = True
            else:
                metadata = client.extra_metadata or {}
                customer_meta = metadata.get("customer") or {}
                if customer_meta.get("id") == customer_id:
                    matches = True

            if matches:
                filtered_clients.append(client)

        return [map_client_model_to_graphql(client) for client in filtered_clients]

    # ========================================================================
    # Coverage Zone Queries
    # ========================================================================

    @strawberry.field
    async def coverage_zones(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        site_id: str | None = None,
        area_type: str | None = None,
    ) -> CoverageZoneConnection:
        """
        Query coverage zones with filtering and pagination.

        Args:
            limit: Maximum number of results (default: 50)
            offset: Number of results to skip (default: 0)
            site_id: Filter by site ID
            area_type: Filter by area type (indoor/outdoor/mixed)

        Returns:
            Paginated coverage zones list
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Build query for coverage zones
        query = select(CoverageZoneModel).where(CoverageZoneModel.tenant_id == tenant_id)

        # Apply filters
        if site_id:
            # Join with device to filter by site
            query = query.join(WirelessDevice).where(WirelessDevice.site_name == site_id)

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(CoverageZoneModel.zone_name)

        # Execute query
        result = await db.execute(query)
        zone_models = result.scalars().all()

        # Map to GraphQL types
        zones = [map_coverage_zone_model_to_graphql(zone) for zone in zone_models]

        return CoverageZoneConnection(
            zones=zones,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def coverage_zone(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> CoverageZone | None:
        """
        Query a single coverage zone by ID.

        Args:
            id: Coverage zone ID

        Returns:
            Coverage zone details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        try:
            zone_id = uuid.UUID(str(id))
        except ValueError:
            return None

        query = select(CoverageZoneModel).where(
            and_(
                CoverageZoneModel.id == zone_id,
                CoverageZoneModel.tenant_id == tenant_id,
            )
        )
        result = await db.execute(query)
        zone = result.scalar_one_or_none()

        if not zone:
            return None

        return map_coverage_zone_model_to_graphql(zone)

    @strawberry.field
    async def coverage_zones_by_site(
        self,
        info: Info,
        site_id: str,
    ) -> list[CoverageZone]:
        """
        Query all coverage zones for a specific site.

        Args:
            site_id: Site identifier

        Returns:
            List of coverage zones at the site
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = (
            select(CoverageZoneModel)
            .where(CoverageZoneModel.tenant_id == tenant_id)
            .order_by(CoverageZoneModel.zone_name)
        )

        result = await db.execute(query)
        zone_models = result.scalars().all()

        filtered_zones: list[CoverageZoneModel] = []
        for zone in zone_models:
            metadata = zone.extra_metadata or {}
            site_meta = metadata.get("site") or {}
            site_match = site_meta.get("id") == site_id or site_meta.get("name") == site_id

            device = getattr(zone, "device", None)
            device_match = device.site_name == site_id if device else False

            if site_match or device_match:
                filtered_zones.append(zone)

        return [map_coverage_zone_model_to_graphql(zone) for zone in filtered_zones]

    # ========================================================================
    # RF Analytics Queries
    # ========================================================================

    @strawberry.field
    async def rf_analytics(
        self,
        info: Info,
        site_id: str,
    ) -> RFAnalytics:
        """Query RF spectrum analytics for a site."""
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        radios = await _fetch_site_radios(db, tenant_id, site_id)

        site_display_name = site_id
        for radio in radios:
            device = getattr(radio, "device", None)
            if device and device.extra_metadata:
                metadata_site = (device.extra_metadata or {}).get("site") or {}
                site_display_name = metadata_site.get("name", site_display_name)
                break

        if not radios:
            return RFAnalytics(
                site_id=site_id,
                site_name=site_display_name,
                analysis_timestamp=datetime.utcnow(),
                channel_utilization_2_4ghz=[],
                channel_utilization_5ghz=[],
                channel_utilization_6ghz=[],
                recommended_channels_2_4ghz=[],
                recommended_channels_5ghz=[],
                recommended_channels_6ghz=[],
                interference_sources=[],
                total_interference_score=0.0,
                average_signal_strength_dbm=-60.0,
                average_snr=30.0,
                coverage_quality_score=75.0,
                clients_per_band_2_4ghz=0,
                clients_per_band_5ghz=0,
                clients_per_band_6ghz=0,
                band_utilization_balance_score=100.0,
            )

        frequency_band_map = {
            Frequency.FREQ_2_4_GHZ: FrequencyBand.BAND_2_4_GHZ,
            Frequency.FREQ_5_GHZ: FrequencyBand.BAND_5_GHZ,
            Frequency.FREQ_6_GHZ: FrequencyBand.BAND_6_GHZ,
        }

        band_to_channels: defaultdict[Frequency, list[ChannelUtilization]] = defaultdict(list)
        clients_per_band: defaultdict[Frequency, int] = defaultdict(int)
        interference_values: list[float] = []
        signal_values: list[float] = []
        snr_values: list[float] = []

        for radio in radios:
            band_enum = radio.frequency
            strawberry_band = frequency_band_map.get(band_enum, FrequencyBand.BAND_5_GHZ)
            band_to_channels[band_enum].append(
                ChannelUtilization(
                    channel=radio.channel or 0,
                    frequency_mhz=_channel_to_frequency_mhz(radio.channel, band_enum),
                    band=strawberry_band,
                    utilization_percent=radio.utilization_percent or 0.0,
                    interference_level=radio.interference_level or 0.0,
                    access_points_count=1,
                )
            )
            clients_per_band[band_enum] += radio.connected_clients

            if radio.interference_level is not None:
                interference_values.append(radio.interference_level)

            device = getattr(radio, "device", None)
            if device:
                metadata = device.extra_metadata or {}
                metrics = metadata.get("rf_metrics") or {}
                if metrics.get("signal_strength_dbm") is not None:
                    signal_values.append(metrics["signal_strength_dbm"])
                if metrics.get("snr") is not None:
                    snr_values.append(metrics["snr"])

        def _recommended_channels(band: Frequency) -> list[int]:
            infos = band_to_channels.get(band, [])
            if not infos:
                return []
            sorted_infos = sorted(infos, key=lambda info: info.utilization_percent)
            return [info.channel for info in sorted_infos[:3]]

        average_signal_strength = mean(signal_values) if signal_values else -60.0
        average_snr = mean(snr_values) if snr_values else 30.0
        avg_interference = mean(interference_values) if interference_values else 0.0
        total_interference_score = min(100.0, avg_interference * 100.0)

        utilization_values = [
            info.utilization_percent for infos in band_to_channels.values() for info in infos
        ]
        mean(utilization_values) if utilization_values else 0.0
        coverage_quality_score = max(
            0.0,
            min(100.0, 80.0 + (average_snr / 2.0) - (avg_interference * 20.0)),
        )

        total_clients = sum(clients_per_band.values())
        if total_clients:
            non_zero_counts = [count for count in clients_per_band.values() if count > 0]
            ideal = total_clients / max(len(non_zero_counts), 1)
            imbalance = sum(abs(count - ideal) for count in clients_per_band.values())
            band_utilization_balance_score = max(0.0, 100.0 - (imbalance / total_clients) * 100.0)
        else:
            band_utilization_balance_score = 100.0

        return RFAnalytics(
            site_id=site_id,
            site_name=site_display_name,
            analysis_timestamp=datetime.utcnow(),
            channel_utilization_2_4ghz=band_to_channels.get(Frequency.FREQ_2_4_GHZ, []),
            channel_utilization_5ghz=band_to_channels.get(Frequency.FREQ_5_GHZ, []),
            channel_utilization_6ghz=band_to_channels.get(Frequency.FREQ_6_GHZ, []),
            recommended_channels_2_4ghz=_recommended_channels(Frequency.FREQ_2_4_GHZ),
            recommended_channels_5ghz=_recommended_channels(Frequency.FREQ_5_GHZ),
            recommended_channels_6ghz=_recommended_channels(Frequency.FREQ_6_GHZ),
            interference_sources=[],
            total_interference_score=total_interference_score,
            average_signal_strength_dbm=average_signal_strength,
            average_snr=average_snr,
            coverage_quality_score=coverage_quality_score,
            clients_per_band_2_4ghz=clients_per_band.get(Frequency.FREQ_2_4_GHZ, 0),
            clients_per_band_5ghz=clients_per_band.get(Frequency.FREQ_5_GHZ, 0),
            clients_per_band_6ghz=clients_per_band.get(Frequency.FREQ_6_GHZ, 0),
            band_utilization_balance_score=band_utilization_balance_score,
        )

    @strawberry.field
    async def channel_utilization(
        self,
        info: Info,
        site_id: str,
        frequency_band: FrequencyBand,
    ) -> list[ChannelUtilization]:
        """Query channel utilization for a specific band."""
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        band_map = {
            FrequencyBand.BAND_2_4_GHZ: Frequency.FREQ_2_4_GHZ,
            FrequencyBand.BAND_5_GHZ: Frequency.FREQ_5_GHZ,
            FrequencyBand.BAND_6_GHZ: Frequency.FREQ_6_GHZ,
        }
        target_frequency = band_map.get(frequency_band, Frequency.FREQ_5_GHZ)

        radios = await _fetch_site_radios(db, tenant_id, site_id)

        channel_infos: list[ChannelUtilization] = []
        for radio in radios:
            if radio.frequency != target_frequency:
                continue
            channel_infos.append(
                ChannelUtilization(
                    channel=radio.channel or 0,
                    frequency_mhz=_channel_to_frequency_mhz(radio.channel, radio.frequency),
                    band=frequency_band,
                    utilization_percent=radio.utilization_percent or 0.0,
                    interference_level=radio.interference_level or 0.0,
                    access_points_count=1,
                )
            )

        return channel_infos

    @strawberry.field
    async def wireless_site_metrics(
        self,
        info: Info,
        site_id: str,
    ) -> WirelessSiteMetrics | None:
        """
        Query aggregated wireless metrics for a site.

        Args:
            site_id: Site identifier

        Returns:
            Site wireless metrics or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Count APs by status
        total_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                )
            )
        )
        total_aps = await db.scalar(total_aps_query) or 0

        if total_aps == 0:
            return None

        online_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.status == DeviceStatus.ONLINE,
                )
            )
        )
        online_aps = await db.scalar(online_aps_query) or 0

        offline_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.status == DeviceStatus.OFFLINE,
                )
            )
        )
        offline_aps = await db.scalar(offline_aps_query) or 0

        # Count clients (need to join through devices)
        clients_query = (
            select(func.count())
            .select_from(WirelessClientModel)
            .join(WirelessDevice, WirelessClientModel.device_id == WirelessDevice.id)
            .where(
                and_(
                    WirelessClientModel.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessClientModel.connected,
                )
            )
        )
        total_clients = await db.scalar(clients_query) or 0

        # Count clients by band
        clients_2_4_query = (
            select(func.count())
            .select_from(WirelessClientModel)
            .join(WirelessDevice, WirelessClientModel.device_id == WirelessDevice.id)
            .where(
                and_(
                    WirelessClientModel.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessClientModel.connected,
                    WirelessClientModel.frequency == Frequency.FREQ_2_4_GHZ,
                )
            )
        )
        clients_2_4 = await db.scalar(clients_2_4_query) or 0

        clients_5_query = (
            select(func.count())
            .select_from(WirelessClientModel)
            .join(WirelessDevice, WirelessClientModel.device_id == WirelessDevice.id)
            .where(
                and_(
                    WirelessClientModel.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessClientModel.connected,
                    WirelessClientModel.frequency == Frequency.FREQ_5_GHZ,
                )
            )
        )
        clients_5 = await db.scalar(clients_5_query) or 0

        # Calculate health score based on AP uptime
        health_score = (online_aps / total_aps * 100) if total_aps > 0 else 0

        capacity = total_aps * 100  # Assume 100 clients per AP for now
        utilization = (total_clients / capacity * 100) if capacity else 0.0

        site_display_name = site_id
        metadata_query = (
            select(WirelessDevice.extra_metadata)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                )
            )
            .limit(1)
        )
        metadata_row = await db.execute(metadata_query)
        metadata_raw = metadata_row.scalar_one_or_none()
        metadata_dict: dict[str, Any] = metadata_raw if isinstance(metadata_raw, dict) else {}
        site_meta = metadata_dict.get("site", {}) if isinstance(metadata_dict, dict) else {}
        site_display_name = site_meta.get("name", site_display_name)

        # Calculate 6 GHz clients
        clients_6_query = (
            select(func.count())
            .select_from(WirelessClientModel)
            .where(
                and_(
                    WirelessClientModel.tenant_id == tenant_id,
                    WirelessClientModel.device_id.in_(
                        select(WirelessDevice.id).where(
                            and_(
                                WirelessDevice.tenant_id == tenant_id,
                                WirelessDevice.site_name == site_id,
                                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                            )
                        )
                    ),
                    WirelessClientModel.frequency == Frequency.FREQ_6_GHZ,
                    WirelessClientModel.connected == True,  # noqa: E712
                )
            )
        )
        clients_6_row = await db.execute(clients_6_query)
        clients_6 = clients_6_row.scalar() or 0

        # Calculate average signal strength and SNR from connected clients
        signal_query = select(
            func.avg(WirelessClientModel.rssi_dbm),
            func.avg(WirelessClientModel.snr_db),
        ).where(
            and_(
                WirelessClientModel.tenant_id == tenant_id,
                WirelessClientModel.device_id.in_(
                    select(WirelessDevice.id).where(
                        and_(
                            WirelessDevice.tenant_id == tenant_id,
                            WirelessDevice.site_name == site_id,
                            WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                        )
                    )
                ),
                WirelessClientModel.connected == True,  # noqa: E712
                WirelessClientModel.rssi_dbm.isnot(None),
            )
        )
        signal_row = await db.execute(signal_query)
        signal_data = signal_row.one()
        avg_rssi = float(signal_data[0]) if signal_data[0] is not None else 0.0
        avg_snr = float(signal_data[1]) if signal_data[1] is not None else 0.0

        return WirelessSiteMetrics(
            site_id=site_id,
            site_name=site_display_name,
            total_aps=total_aps,
            online_aps=online_aps,
            offline_aps=offline_aps,
            degraded_aps=0,  # Would need to track degraded state separately
            total_clients=total_clients,
            clients_2_4ghz=clients_2_4,
            clients_5ghz=clients_5,
            clients_6ghz=clients_6,
            average_signal_strength_dbm=avg_rssi,
            average_snr=avg_snr,
            total_throughput_mbps=0.0,
            total_capacity=capacity,
            capacity_utilization_percent=utilization,
            overall_health_score=health_score,
            rf_health_score=health_score,
            client_experience_score=health_score,
        )

    @strawberry.field
    async def wireless_dashboard(
        self,
        info: Info,
    ) -> WirelessDashboard:
        """
        Query complete wireless network dashboard data.

        Provides network-wide overview, top performers,
        issues, and trends.

        Returns:
            Complete dashboard data
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Count total APs
        total_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                )
            )
        )
        total_aps = await db.scalar(total_aps_query) or 0

        # Count APs by status
        online_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.status == DeviceStatus.ONLINE,
                )
            )
        )
        online_aps = await db.scalar(online_aps_query) or 0

        offline_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.status == DeviceStatus.OFFLINE,
                )
            )
        )
        offline_aps = await db.scalar(offline_aps_query) or 0

        degraded_aps_query = (
            select(func.count())
            .select_from(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessDevice.status == DeviceStatus.DEGRADED,
                )
            )
        )
        degraded_aps = await db.scalar(degraded_aps_query) or 0

        # Count unique sites
        sites_query = select(func.count(func.distinct(WirelessDevice.site_name))).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.site_name.isnot(None),
            )
        )
        total_sites = await db.scalar(sites_query) or 0

        return WirelessDashboard(
            total_sites=total_sites,
            total_access_points=total_aps,
            total_clients=0,  # Would need wireless_clients table
            total_coverage_zones=0,  # Would need coverage_zones table
            online_aps=online_aps,
            offline_aps=offline_aps,
            degraded_aps=degraded_aps,
            clients_by_band_2_4ghz=0,  # Would need client data
            clients_by_band_5ghz=0,
            clients_by_band_6ghz=0,
            top_aps_by_clients=[],  # Would need client associations
            top_aps_by_throughput=[],  # Would need metrics data
            sites_with_issues=[],  # Can be computed from AP status
            total_throughput_mbps=0.0,
            average_signal_strength_dbm=0.0,
            average_client_experience_score=0.0,
            client_count_trend=[],  # Would need time-series data
            throughput_trend_mbps=[],
            offline_events_count=offline_aps,
            generated_at=datetime.utcnow(),
        )


# ============================================================================
# Helper Functions for Mapping Models to GraphQL Types
# ============================================================================


def map_device_to_access_point(device: WirelessDevice) -> AccessPoint:
    """
    Map database WirelessDevice model to GraphQL AccessPoint type.

    Args:
        device: Database WirelessDevice instance

    Returns:
        GraphQL AccessPoint instance
    """
    metadata = device.extra_metadata or {}
    site_info = metadata.get("site", {})
    site_id = site_info.get("id") or device.site_name
    site_name = site_info.get("name") or device.site_name

    location_meta = metadata.get("location", {})
    latitude = location_meta.get("latitude", device.latitude)
    longitude = location_meta.get("longitude", device.longitude)
    altitude = location_meta.get("altitude", device.altitude_meters)
    location = None
    if site_name or location_meta:
        coordinates = None
        if latitude is not None and longitude is not None:
            coordinates = GeoLocation(
                latitude=latitude,
                longitude=longitude,
                altitude=altitude,
                accuracy=location_meta.get("accuracy"),
            )
        location = InstallationLocation(
            site_name=site_name or "",
            building=location_meta.get("building"),
            floor=location_meta.get("floor"),
            room=location_meta.get("room"),
            mounting_type=location_meta.get("mounting_type"),
            coordinates=coordinates,
        )

    frequency_band_value = str(metadata.get("frequency_band", "5GHz")).lower()
    frequency_band_map = {
        "2.4ghz": FrequencyBand.BAND_2_4_GHZ,
        "2.4": FrequencyBand.BAND_2_4_GHZ,
        "5ghz": FrequencyBand.BAND_5_GHZ,
        "5": FrequencyBand.BAND_5_GHZ,
        "6ghz": FrequencyBand.BAND_6_GHZ,
        "6": FrequencyBand.BAND_6_GHZ,
    }
    frequency_band = frequency_band_map.get(frequency_band_value, FrequencyBand.BAND_5_GHZ)

    channel = int(metadata.get("channel", 0))
    channel_width = int(metadata.get("channel_width", 80))
    transmit_power = int(metadata.get("transmit_power", 20))
    max_clients = metadata.get("max_clients")

    security_type_value = str(
        metadata.get("security_type", WirelessSecurityType.WPA2_WPA3.value)
    ).lower()
    try:
        security_type = WirelessSecurityType(security_type_value)
    except ValueError:
        security_type = WirelessSecurityType.WPA2_WPA3

    rf_metrics_data = metadata.get("rf_metrics") or {}
    rf_metrics = None
    if rf_metrics_data:
        rf_metrics = RFMetrics(
            signal_strength_dbm=rf_metrics_data.get("signal_strength_dbm"),
            noise_floor_dbm=rf_metrics_data.get("noise_floor_dbm"),
            signal_to_noise_ratio=rf_metrics_data.get("snr"),
            channel_utilization_percent=rf_metrics_data.get("channel_utilization_percent"),
            interference_level=rf_metrics_data.get("interference_level"),
            tx_power_dbm=rf_metrics_data.get("tx_power_dbm"),
            rx_power_dbm=rf_metrics_data.get("rx_power_dbm"),
        )

    performance_data = metadata.get("performance") or {}
    performance = None
    if performance_data:
        performance = APPerformanceMetrics(
            tx_bytes=int(performance_data.get("tx_bytes", 0)),
            rx_bytes=int(performance_data.get("rx_bytes", 0)),
            tx_packets=int(performance_data.get("tx_packets", 0)),
            rx_packets=int(performance_data.get("rx_packets", 0)),
            tx_rate_mbps=performance_data.get("tx_rate_mbps"),
            rx_rate_mbps=performance_data.get("rx_rate_mbps"),
            tx_errors=int(performance_data.get("tx_errors", 0)),
            rx_errors=int(performance_data.get("rx_errors", 0)),
            tx_dropped=int(performance_data.get("tx_dropped", 0)),
            rx_dropped=int(performance_data.get("rx_dropped", 0)),
            retries=int(performance_data.get("retries", 0)),
            retry_rate_percent=performance_data.get("retry_rate_percent"),
            connected_clients=int(performance_data.get("connected_clients", 0)),
            authenticated_clients=int(performance_data.get("authenticated_clients", 0)),
            authorized_clients=int(performance_data.get("authorized_clients", 0)),
            cpu_usage_percent=performance_data.get("cpu_usage_percent"),
            memory_usage_percent=performance_data.get("memory_usage_percent"),
            uptime_seconds=performance_data.get("uptime_seconds"),
        )

    last_reboot_raw = metadata.get("last_reboot_at")
    last_reboot_at = None
    if isinstance(last_reboot_raw, datetime):
        last_reboot_at = last_reboot_raw
    elif isinstance(last_reboot_raw, str):
        try:
            last_reboot_at = datetime.fromisoformat(last_reboot_raw)
        except ValueError:
            last_reboot_at = None

    # Map device status to AP status
    status_map = {
        DeviceStatus.ONLINE: AccessPointStatus.ONLINE,
        DeviceStatus.OFFLINE: AccessPointStatus.OFFLINE,
        DeviceStatus.DEGRADED: AccessPointStatus.DEGRADED,
        DeviceStatus.MAINTENANCE: AccessPointStatus.MAINTENANCE,
        DeviceStatus.DECOMMISSIONED: AccessPointStatus.PROVISIONING,  # Closest match
    }

    # Map frequency to frequency band
    _ = {
        Frequency.FREQ_2_4_GHZ: FrequencyBand.BAND_2_4_GHZ,
        Frequency.FREQ_5_GHZ: FrequencyBand.BAND_5_GHZ,
        Frequency.FREQ_6_GHZ: FrequencyBand.BAND_6_GHZ,
    }

    return AccessPoint(
        id=strawberry.ID(str(device.id)),
        name=device.name,
        mac_address=device.mac_address or "",
        ip_address=device.ip_address,
        serial_number=device.serial_number,
        status=status_map.get(device.status, AccessPointStatus.OFFLINE),
        is_online=device.status == DeviceStatus.ONLINE,
        last_seen_at=device.last_seen,
        model=device.model,
        manufacturer=device.manufacturer,
        firmware_version=device.firmware_version,
        hardware_revision=None,  # Not in current model
        ssid=device.ssid or "",
        frequency_band=frequency_band,
        channel=channel,
        channel_width=channel_width,
        transmit_power=transmit_power,
        max_clients=max_clients,
        security_type=security_type,
        # Location
        location=location,
        # RF Metrics
        rf_metrics=rf_metrics,
        # Performance Metrics
        performance=performance,
        # Management
        controller_id=None,
        controller_name=None,
        site_id=site_id,
        site_name=site_name,
        # Timestamps
        created_at=device.created_at,
        updated_at=device.updated_at,
        last_reboot_at=last_reboot_at,
        # Configuration
        is_mesh_enabled=False,
        is_band_steering_enabled=False,
        is_load_balancing_enabled=False,
    )


def map_client_model_to_graphql(client: WirelessClientModel) -> WirelessClient:
    """
    Map database WirelessClient model to GraphQL WirelessClient type.

    Args:
        client: Database WirelessClientModel instance

    Returns:
        GraphQL WirelessClient instance
    """
    # Map frequency to frequency band
    freq_map = {
        Frequency.FREQ_2_4_GHZ: FrequencyBand.BAND_2_4_GHZ,
        Frequency.FREQ_5_GHZ: FrequencyBand.BAND_5_GHZ,
        Frequency.FREQ_6_GHZ: FrequencyBand.BAND_6_GHZ,
    }

    metadata = client.extra_metadata or {}
    access_point_name = metadata.get("access_point_name") or ""

    connection_type_value = str(
        metadata.get(
            "connection_type",
            client.frequency.value if client.frequency else "5GHz",
        )
    ).lower()
    connection_type_map = {
        "2.4ghz": ClientConnectionType.WIFI_2_4,
        "2.4": ClientConnectionType.WIFI_2_4,
        "5ghz": ClientConnectionType.WIFI_5,
        "5": ClientConnectionType.WIFI_5,
        "6ghz": ClientConnectionType.WIFI_6,
        "6": ClientConnectionType.WIFI_6,
        "6e": ClientConnectionType.WIFI_6E,
    }
    connection_type = connection_type_map.get(connection_type_value, ClientConnectionType.WIFI_5)

    client_frequency = client.frequency or Frequency.FREQ_5_GHZ
    frequency_band = freq_map.get(client_frequency, FrequencyBand.BAND_5_GHZ)

    is_authenticated = bool(metadata.get("is_authenticated", client.connected))
    is_authorized = bool(metadata.get("is_authorized", client.connected))

    signal_quality_meta = metadata.get("signal_quality") or {}
    noise_floor_dbm = metadata.get("noise_floor_dbm", signal_quality_meta.get("noise_floor_dbm"))
    signal_quality = None
    if client.rssi_dbm is not None or client.snr_db is not None or signal_quality_meta:
        signal_quality = SignalQuality(
            rssi_dbm=signal_quality_meta.get("rssi_dbm", client.rssi_dbm),
            snr_db=signal_quality_meta.get("snr_db", client.snr_db),
            noise_floor_dbm=noise_floor_dbm,
            signal_strength_percent=signal_quality_meta.get("signal_strength_percent"),
            link_quality_percent=signal_quality_meta.get("link_quality_percent"),
        )

    manufacturer = metadata.get("manufacturer", client.vendor)

    customer_meta = metadata.get("customer") or {}
    customer_id = customer_meta.get("id")
    customer_name = customer_meta.get("name")

    return WirelessClient(
        id=strawberry.ID(str(client.id)),
        mac_address=client.mac_address,
        hostname=client.hostname,
        ip_address=client.ip_address,
        manufacturer=manufacturer,
        access_point_id=str(client.device_id),
        access_point_name=access_point_name,
        ssid=client.ssid or "",
        connection_type=connection_type,
        frequency_band=frequency_band,
        channel=client.channel or 0,
        is_authenticated=is_authenticated,
        is_authorized=is_authorized,
        auth_method=metadata.get("auth_method"),
        signal_strength_dbm=client.rssi_dbm,
        signal_quality=signal_quality,
        noise_floor_dbm=noise_floor_dbm,
        snr=client.snr_db,
        tx_rate_mbps=client.tx_rate_mbps,
        rx_rate_mbps=client.rx_rate_mbps,
        tx_bytes=client.tx_bytes,
        rx_bytes=client.rx_bytes,
        tx_packets=client.tx_packets,
        rx_packets=client.rx_packets,
        tx_retries=int(metadata.get("tx_retries", 0)),
        rx_retries=int(metadata.get("rx_retries", 0)),
        connected_at=client.first_seen,
        last_seen_at=client.last_seen,
        uptime_seconds=client.connection_duration_seconds or 0,
        idle_time_seconds=metadata.get("idle_time_seconds"),
        supports_80211k=bool(metadata.get("supports_80211k", False)),
        supports_80211r=bool(metadata.get("supports_80211r", False)),
        supports_80211v=bool(metadata.get("supports_80211v", False)),
        max_phy_rate_mbps=metadata.get("max_phy_rate_mbps"),
        customer_id=customer_id,
        customer_name=customer_name,
    )


def map_coverage_zone_model_to_graphql(zone: CoverageZoneModel) -> CoverageZone:
    """
    Map database CoverageZone model to GraphQL CoverageZone type.

    Args:
        zone: Database CoverageZoneModel instance

    Returns:
        GraphQL CoverageZone instance
    """
    metadata = zone.extra_metadata or {}
    site_info = metadata.get("site", {})
    site_id = site_info.get("id", "unknown")
    site_name = site_info.get("name", site_id)

    floor = metadata.get("floor")
    area_type = metadata.get("area_type", "indoor")

    signal_strength_meta = metadata.get("signal_strength") or {}

    access_point_ids = [str(ap_id) for ap_id in metadata.get("access_points", [])]
    access_point_count = int(metadata.get("access_point_count", len(access_point_ids)))

    connected_clients = int(metadata.get("connected_clients", 0))
    max_client_capacity = int(metadata.get("max_client_capacity", 0))
    client_density_per_ap = metadata.get("client_density_per_ap")

    interference_level = metadata.get("interference_level")
    channel_utilization_avg = metadata.get("channel_utilization_avg")
    noise_floor_avg_dbm = metadata.get("noise_floor_avg_dbm")

    coverage_polygon = metadata.get("coverage_polygon")
    if coverage_polygon is None and zone.geometry:
        coverage_polygon = json.dumps(zone.geometry)

    last_surveyed_raw = metadata.get("last_surveyed_at")
    last_surveyed_at = None
    if isinstance(last_surveyed_raw, datetime):
        last_surveyed_at = last_surveyed_raw
    elif isinstance(last_surveyed_raw, str):
        try:
            last_surveyed_at = datetime.fromisoformat(last_surveyed_raw)
        except ValueError:
            last_surveyed_at = None

    return CoverageZone(
        id=strawberry.ID(str(zone.id)),
        name=zone.zone_name,
        description=zone.description,
        site_id=site_id,
        site_name=site_name,
        floor=floor,
        area_type=area_type,
        coverage_area_sqm=metadata.get("coverage_area_sqm"),
        signal_strength_min_dbm=signal_strength_meta.get("min_dbm"),
        signal_strength_max_dbm=signal_strength_meta.get("max_dbm"),
        signal_strength_avg_dbm=signal_strength_meta.get("avg_dbm"),
        access_point_ids=access_point_ids,
        access_point_count=access_point_count,
        interference_level=interference_level,
        channel_utilization_avg=channel_utilization_avg,
        noise_floor_avg_dbm=noise_floor_avg_dbm,
        connected_clients=connected_clients,
        max_client_capacity=max_client_capacity,
        client_density_per_ap=client_density_per_ap,
        coverage_polygon=coverage_polygon,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
        last_surveyed_at=last_surveyed_at,
    )
    # Map frequency to frequency band
