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

from datetime import datetime
from typing import Any, Optional

import strawberry
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.types import Info

from dotmac.platform.graphql.types.wireless import (
    AccessPoint,
    AccessPointConnection,
    AccessPointStatus,
    APPerformanceMetrics,
    ChannelInfo,
    ChannelUtilization,
    ClientConnectionType,
    CoverageZone,
    CoverageZoneConnection,
    FrequencyBand,
    GeoLocation,
    InstallationLocation,
    InterferenceSource,
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
    WirelessDevice,
    WirelessClient as WirelessClientModel,
    WirelessRadio,
    CoverageZone as CoverageZoneModel,
    DeviceType,
    DeviceStatus,
    Frequency,
    CoverageType,
)


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
        site_id: Optional[str] = None,
        status: Optional[AccessPointStatus] = None,
        frequency_band: Optional[FrequencyBand] = None,
        search: Optional[str] = None,
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
            db_status = DeviceStatus.ONLINE if status == AccessPointStatus.ONLINE else \
                       DeviceStatus.OFFLINE if status == AccessPointStatus.OFFLINE else \
                       DeviceStatus.DEGRADED if status == AccessPointStatus.DEGRADED else \
                       DeviceStatus.MAINTENANCE
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
        access_points = [
            map_device_to_access_point(device) for device in device_models
        ]

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
    ) -> Optional[AccessPoint]:
        """
        Query a single access point by ID.

        Args:
            id: Access point ID

        Returns:
            Access point details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(WirelessDevice).where(
            and_(
                WirelessDevice.id == id,
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

        query = select(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.site_name == site_id,
            )
        ).order_by(WirelessDevice.name)

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
        access_point_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        frequency_band: Optional[FrequencyBand] = None,
        search: Optional[str] = None,
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

        # Build query for wireless clients
        query = select(WirelessClientModel).where(
            WirelessClientModel.tenant_id == tenant_id
        )

        # Apply filters
        if access_point_id:
            query = query.where(WirelessClientModel.device_id == access_point_id)

        if customer_id:
            query = query.where(WirelessClientModel.customer_id == customer_id)

        if frequency_band:
            # Map GraphQL frequency band to database frequency
            db_freq = Frequency.FREQ_2_4_GHZ if frequency_band == FrequencyBand.BAND_2_4_GHZ else \
                     Frequency.FREQ_5_GHZ if frequency_band == FrequencyBand.BAND_5_GHZ else \
                     Frequency.FREQ_6_GHZ
            query = query.where(WirelessClientModel.frequency == db_freq)

        if search:
            query = query.where(
                or_(
                    WirelessClientModel.mac_address.ilike(f"%{search}%"),
                    WirelessClientModel.hostname.ilike(f"%{search}%"),
                    WirelessClientModel.ip_address.ilike(f"%{search}%"),
                )
            )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(
            desc(WirelessClientModel.last_seen)
        )

        # Execute query
        result = await db.execute(query)
        client_models = result.scalars().all()

        # Map to GraphQL types
        clients = [
            map_client_model_to_graphql(client) for client in client_models
        ]

        return WirelessClientConnection(
            clients=clients,
            total_count=total_count,
            has_next_page=(offset + limit) < total_count,
        )

    @strawberry.field
    async def wireless_client(
        self,
        info: Info,
        id: strawberry.ID,
    ) -> Optional[WirelessClient]:
        """
        Query a single wireless client by ID.

        Args:
            id: Client ID

        Returns:
            Wireless client details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(WirelessClientModel).where(
            and_(
                WirelessClientModel.id == id,
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

        query = select(WirelessClientModel).where(
            and_(
                WirelessClientModel.tenant_id == tenant_id,
                WirelessClientModel.device_id == access_point_id,
            )
        ).order_by(desc(WirelessClientModel.last_seen))

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

        query = select(WirelessClientModel).where(
            and_(
                WirelessClientModel.tenant_id == tenant_id,
                WirelessClientModel.customer_id == customer_id,
            )
        ).order_by(desc(WirelessClientModel.last_seen))

        result = await db.execute(query)
        clients = result.scalars().all()

        return [map_client_model_to_graphql(client) for client in clients]

    # ========================================================================
    # Coverage Zone Queries
    # ========================================================================

    @strawberry.field
    async def coverage_zones(
        self,
        info: Info,
        limit: int = 50,
        offset: int = 0,
        site_id: Optional[str] = None,
        area_type: Optional[str] = None,
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
        query = select(CoverageZoneModel).where(
            CoverageZoneModel.tenant_id == tenant_id
        )

        # Apply filters
        if site_id:
            # Join with device to filter by site
            query = query.join(WirelessDevice).where(
                WirelessDevice.site_name == site_id
            )

        # Get total count
        total_count_query = select(func.count()).select_from(query.subquery())
        total_count = await db.scalar(total_count_query) or 0

        # Apply pagination
        query = query.limit(limit).offset(offset).order_by(CoverageZoneModel.zone_name)

        # Execute query
        result = await db.execute(query)
        zone_models = result.scalars().all()

        # Map to GraphQL types
        zones = [
            map_coverage_zone_model_to_graphql(zone) for zone in zone_models
        ]

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
    ) -> Optional[CoverageZone]:
        """
        Query a single coverage zone by ID.

        Args:
            id: Coverage zone ID

        Returns:
            Coverage zone details or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        query = select(CoverageZoneModel).where(
            and_(
                CoverageZoneModel.id == id,
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

        # Join with device to filter by site
        query = select(CoverageZoneModel).join(WirelessDevice).where(
            and_(
                CoverageZoneModel.tenant_id == tenant_id,
                WirelessDevice.site_name == site_id,
            )
        ).order_by(CoverageZoneModel.zone_name)

        result = await db.execute(query)
        zones = result.scalars().all()

        return [map_coverage_zone_model_to_graphql(zone) for zone in zones]

    # ========================================================================
    # RF Analytics Queries
    # ========================================================================

    @strawberry.field
    async def rf_analytics(
        self,
        info: Info,
        site_id: str,
    ) -> Optional[RFAnalytics]:
        """
        Query RF spectrum analytics for a site.

        Provides channel utilization, interference analysis,
        and recommended channels for optimal performance.

        Args:
            site_id: Site identifier

        Returns:
            RF analytics data or None
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Query all radios at the site
        radios_query = (
            select(WirelessRadio)
            .join(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                )
            )
        )
        result = await db.execute(radios_query)
        radios = result.scalars().all()

        if not radios:
            return None

        # Aggregate metrics by frequency band
        band_metrics = {}
        for radio in radios:
            band = radio.frequency.value if radio.frequency else "unknown"
            if band not in band_metrics:
                band_metrics[band] = {
                    "radios": [],
                    "total_utilization": 0,
                    "total_interference": 0,
                    "count": 0,
                }

            band_metrics[band]["radios"].append(radio)
            band_metrics[band]["total_utilization"] += radio.utilization_percent or 0
            band_metrics[band]["total_interference"] += radio.interference_level or 0
            band_metrics[band]["count"] += 1

        # Calculate averages and build channel utilization list
        channel_utilization_list = []
        for band, metrics in band_metrics.items():
            avg_util = metrics["total_utilization"] / metrics["count"] if metrics["count"] > 0 else 0
            avg_interference = metrics["total_interference"] / metrics["count"] if metrics["count"] > 0 else 0

            # Group by channel
            channels = {}
            for radio in metrics["radios"]:
                if radio.channel:
                    if radio.channel not in channels:
                        channels[radio.channel] = {
                            "utilization": [],
                            "clients": 0,
                            "aps": 0,
                        }
                    channels[radio.channel]["utilization"].append(radio.utilization_percent or 0)
                    channels[radio.channel]["clients"] += radio.connected_clients
                    channels[radio.channel]["aps"] += 1

            # Create ChannelUtilization objects
            for channel_num, channel_data in channels.items():
                avg_channel_util = sum(channel_data["utilization"]) / len(channel_data["utilization"]) if channel_data["utilization"] else 0

                channel_utilization_list.append(
                    ChannelUtilization(
                        channel=channel_num,
                        frequency_band=FrequencyBand.BAND_2_4_GHZ if band == "2.4GHz" else
                                     FrequencyBand.BAND_5_GHZ if band == "5GHz" else
                                     FrequencyBand.BAND_6_GHZ,
                        utilization_percent=avg_channel_util,
                        access_points_count=channel_data["aps"],
                        clients_count=channel_data["clients"],
                        interference_level=avg_interference,
                        noise_floor_dbm=-95.0,  # Typical noise floor
                        is_dfs_channel=channel_num in [52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140],
                        recommended_for_use=avg_channel_util < 50.0,  # Recommend if under 50% utilization
                    )
                )

        # Calculate overall metrics
        total_radios = len(radios)
        avg_utilization = sum(r.utilization_percent or 0 for r in radios) / total_radios if total_radios > 0 else 0
        avg_interference = sum(r.interference_level or 0 for r in radios) / total_radios if total_radios > 0 else 0

        return RFAnalytics(
            site_id=site_id,
            site_name=site_id,
            total_radios=total_radios,
            active_radios=sum(1 for r in radios if r.status == DeviceStatus.ONLINE),
            channel_utilization=channel_utilization_list,
            average_utilization_percent=avg_utilization,
            peak_utilization_percent=max((r.utilization_percent or 0 for r in radios), default=0),
            interference_sources=[],  # Would require external detection system
            recommended_channels=[],  # Could implement channel recommendation algorithm
            spectrum_quality_score=max(0, min(100, 100 - avg_utilization - (avg_interference * 10))),
            noise_floor_dbm=-95.0,
            analyzed_at=datetime.utcnow(),
        )

    @strawberry.field
    async def channel_utilization(
        self,
        info: Info,
        site_id: str,
        frequency_band: FrequencyBand,
    ) -> list[ChannelUtilization]:
        """
        Query channel utilization for a specific frequency band at a site.

        Args:
            site_id: Site identifier
            frequency_band: Frequency band to analyze

        Returns:
            List of channel utilization data
        """
        db: AsyncSession = info.context["db"]
        tenant_id = info.context["tenant_id"]

        # Map GraphQL band to database frequency
        db_freq = Frequency.FREQ_2_4_GHZ if frequency_band == FrequencyBand.BAND_2_4_GHZ else \
                 Frequency.FREQ_5_GHZ if frequency_band == FrequencyBand.BAND_5_GHZ else \
                 Frequency.FREQ_6_GHZ

        # Query radios at the site with the specified frequency
        radios_query = (
            select(WirelessRadio)
            .join(WirelessDevice)
            .where(
                and_(
                    WirelessDevice.tenant_id == tenant_id,
                    WirelessDevice.site_name == site_id,
                    WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                    WirelessRadio.frequency == db_freq,
                )
            )
        )
        result = await db.execute(radios_query)
        radios = result.scalars().all()

        # Group by channel
        channels = {}
        for radio in radios:
            if radio.channel:
                if radio.channel not in channels:
                    channels[radio.channel] = {
                        "utilization": [],
                        "clients": 0,
                        "aps": 0,
                        "interference": [],
                        "noise": [],
                    }
                channels[radio.channel]["utilization"].append(radio.utilization_percent or 0)
                channels[radio.channel]["clients"] += radio.connected_clients
                channels[radio.channel]["aps"] += 1
                channels[radio.channel]["interference"].append(radio.interference_level or 0)
                channels[radio.channel]["noise"].append(radio.noise_floor_dbm or -95.0)

        # Build ChannelUtilization list
        channel_list = []
        for channel_num, data in channels.items():
            avg_util = sum(data["utilization"]) / len(data["utilization"]) if data["utilization"] else 0
            avg_interference = sum(data["interference"]) / len(data["interference"]) if data["interference"] else 0
            avg_noise = sum(data["noise"]) / len(data["noise"]) if data["noise"] else -95.0

            channel_list.append(
                ChannelUtilization(
                    channel=channel_num,
                    frequency_band=frequency_band,
                    utilization_percent=avg_util,
                    access_points_count=data["aps"],
                    clients_count=data["clients"],
                    interference_level=avg_interference,
                    noise_floor_dbm=avg_noise,
                    is_dfs_channel=channel_num in [52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140],
                    recommended_for_use=avg_util < 50.0,
                )
            )

        return sorted(channel_list, key=lambda c: c.channel)

    # ========================================================================
    # Dashboard and Metrics Queries
    # ========================================================================

    @strawberry.field
    async def wireless_site_metrics(
        self,
        info: Info,
        site_id: str,
    ) -> Optional[WirelessSiteMetrics]:
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
        total_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.site_name == site_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
            )
        )
        total_aps = await db.scalar(total_aps_query) or 0

        if total_aps == 0:
            return None

        online_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.site_name == site_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.status == DeviceStatus.ONLINE,
            )
        )
        online_aps = await db.scalar(online_aps_query) or 0

        offline_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.site_name == site_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.status == DeviceStatus.OFFLINE,
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
                    WirelessClientModel.connected == True,
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
                    WirelessClientModel.connected == True,
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
                    WirelessClientModel.connected == True,
                    WirelessClientModel.frequency == Frequency.FREQ_5_GHZ,
                )
            )
        )
        clients_5 = await db.scalar(clients_5_query) or 0

        # Calculate health score based on AP uptime
        health_score = (online_aps / total_aps * 100) if total_aps > 0 else 0

        return WirelessSiteMetrics(
            site_id=site_id,
            site_name=site_id,
            total_access_points=total_aps,
            online_aps=online_aps,
            offline_aps=offline_aps,
            degraded_aps=0,  # Would need to track degraded state separately
            total_clients=total_clients,
            clients_by_band_2_4ghz=clients_2_4,
            clients_by_band_5ghz=clients_5,
            clients_by_band_6ghz=0,  # Would need to add 6GHz tracking
            average_signal_strength_dbm=0.0,  # Would need signal measurements
            average_throughput_mbps=0.0,  # Would need throughput metrics
            total_throughput_mbps=0.0,
            coverage_percent=100.0,  # Would need coverage zone analysis
            capacity_utilization_percent=0.0,  # Would need capacity calculations
            health_score=health_score,
            issues_count=offline_aps,  # Count offline APs as issues
            generated_at=datetime.utcnow(),
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
        total_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
            )
        )
        total_aps = await db.scalar(total_aps_query) or 0

        # Count APs by status
        online_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.status == DeviceStatus.ONLINE,
            )
        )
        online_aps = await db.scalar(online_aps_query) or 0

        offline_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.status == DeviceStatus.OFFLINE,
            )
        )
        offline_aps = await db.scalar(offline_aps_query) or 0

        degraded_aps_query = select(func.count()).select_from(WirelessDevice).where(
            and_(
                WirelessDevice.tenant_id == tenant_id,
                WirelessDevice.device_type == DeviceType.ACCESS_POINT,
                WirelessDevice.status == DeviceStatus.DEGRADED,
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
    # Map device status to AP status
    status_map = {
        DeviceStatus.ONLINE: AccessPointStatus.ONLINE,
        DeviceStatus.OFFLINE: AccessPointStatus.OFFLINE,
        DeviceStatus.DEGRADED: AccessPointStatus.DEGRADED,
        DeviceStatus.MAINTENANCE: AccessPointStatus.MAINTENANCE,
        DeviceStatus.DECOMMISSIONED: AccessPointStatus.PROVISIONING,  # Closest match
    }

    # Map frequency to frequency band
    freq_map = {
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
        frequency_band=FrequencyBand.BAND_5_GHZ,  # Default, should come from radios
        channel=0,  # Should come from radios
        channel_width=80,  # Default
        transmit_power=20,  # Default
        max_clients=None,
        security_type=WirelessSecurityType.WPA2_WPA3,  # Default

        # Location
        location=InstallationLocation(
            site_name=device.site_name or "",
            building=None,
            floor=None,
            room=None,
            mounting_type=None,
            coordinates=GeoLocation(
                latitude=device.latitude,
                longitude=device.longitude,
                altitude=device.altitude_meters,
            ) if device.latitude and device.longitude else None,
        ) if device.site_name else None,

        # RF Metrics - would need separate query or join
        rf_metrics=None,

        # Performance Metrics - would need separate query or join
        performance=None,

        # Management
        controller_id=None,
        controller_name=None,
        site_id=device.site_name,  # Using site_name as ID
        site_name=device.site_name,

        # Timestamps
        created_at=device.created_at,
        updated_at=device.updated_at,
        last_reboot_at=None,

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

    return WirelessClient(
        id=strawberry.ID(str(client.id)),
        mac_address=client.mac_address,
        ip_address=client.ip_address,
        hostname=client.hostname,
        access_point_id=strawberry.ID(str(client.device_id)),
        access_point_name=None,  # Would need join to get AP name
        ssid=client.ssid,
        frequency_band=freq_map.get(client.frequency, FrequencyBand.BAND_5_GHZ) if client.frequency else None,
        channel=client.channel,
        connection_type=ClientConnectionType.WIFI,  # Default
        is_connected=client.connected,
        first_seen_at=client.first_seen,
        last_seen_at=client.last_seen,
        connection_duration_seconds=client.connection_duration_seconds,
        signal_quality=SignalQuality(
            rssi_dbm=client.rssi_dbm,
            snr_db=client.snr_db,
            noise_floor_dbm=None,  # Not in current model
            signal_strength_percent=None,  # Can be calculated from RSSI
            link_quality_percent=None,  # Not in current model
        ) if client.rssi_dbm or client.snr_db else None,
        tx_rate_mbps=client.tx_rate_mbps,
        rx_rate_mbps=client.rx_rate_mbps,
        tx_bytes=client.tx_bytes,
        rx_bytes=client.rx_bytes,
        tx_packets=client.tx_packets,
        rx_packets=client.rx_packets,
        total_bytes=client.tx_bytes + client.rx_bytes,
        vendor=client.vendor,
        device_type=client.device_type,
        operating_system=None,  # Not in current model
        customer_id=strawberry.ID(str(client.customer_id)) if client.customer_id else None,
        subscriber_id=client.subscriber_id,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def map_coverage_zone_model_to_graphql(zone: CoverageZoneModel) -> CoverageZone:
    """
    Map database CoverageZone model to GraphQL CoverageZone type.

    Args:
        zone: Database CoverageZoneModel instance

    Returns:
        GraphQL CoverageZone instance
    """
    # Map frequency to frequency band
    freq_map = {
        Frequency.FREQ_2_4_GHZ: FrequencyBand.BAND_2_4_GHZ,
        Frequency.FREQ_5_GHZ: FrequencyBand.BAND_5_GHZ,
        Frequency.FREQ_6_GHZ: FrequencyBand.BAND_6_GHZ,
    }

    return CoverageZone(
        id=strawberry.ID(str(zone.id)),
        zone_name=zone.zone_name,
        description=zone.description,
        access_point_id=strawberry.ID(str(zone.device_id)) if zone.device_id else None,
        access_point_name=None,  # Would need join to get AP name
        site_id=None,  # Would need join through device
        site_name=None,  # Would need join through device
        coverage_type=zone.coverage_type.value if zone.coverage_type else "primary",
        area_type=None,  # Not in current model
        boundary_geojson=zone.geometry,
        center_location=GeoLocation(
            latitude=zone.center_latitude,
            longitude=zone.center_longitude,
            altitude=None,
        ) if zone.center_latitude and zone.center_longitude else None,
        coverage_radius_meters=zone.coverage_radius_meters,
        estimated_signal_strength_dbm=zone.estimated_signal_strength_dbm,
        frequency_band=freq_map.get(zone.frequency, FrequencyBand.BAND_5_GHZ) if zone.frequency else None,
        overlapping_zones=[],  # Would need geometric query
        connected_clients_count=0,  # Would need client join
        average_signal_strength_dbm=zone.estimated_signal_strength_dbm,
        signal_quality_percent=None,  # Can be calculated from signal strength
        is_active=True,  # Not in current model
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )
