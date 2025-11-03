"""
Integration Tests for Wireless GraphQL Query Resolvers

Tests all 14 wireless query resolvers with:
- Database integration
- Tenant isolation
- Pagination
- Filtering and search
- Error handling
- Data mapping
"""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio

from dotmac.platform.graphql.schema import schema
from dotmac.platform.tenant.models import Tenant
from dotmac.platform.user_management.models import User
from dotmac.platform.wireless.models import (
    CoverageType,
    DeviceStatus,
    DeviceType,
    Frequency,
    RadioProtocol,
    WirelessDevice,
    WirelessRadio,
)
from dotmac.platform.wireless.models import (
    CoverageZone as CoverageZoneModel,
)
from dotmac.platform.wireless.models import (
    WirelessClient as WirelessClientModel,
)

# ============================================================================
# Test Fixtures
# ============================================================================


pytestmark = pytest.mark.integration


@pytest.fixture
def graphql_client():
    """Create GraphQL test client using schema.execute."""
    # Use schema.execute directly instead of test client
    return schema


@pytest_asyncio.fixture
async def graphql_context(async_db_session, test_user: User):
    """Create a GraphQL context with authenticated user and real async db."""
    from dotmac.platform.auth.core import UserInfo

    # Create UserInfo from test user
    user_info = UserInfo(
        user_id=str(test_user.id),
        tenant_id=str(test_user.tenant_id),
        permissions=["wireless:read", "wireless:write"],
        email=test_user.email,
        username=test_user.username,
    )

    # Strawberry expects context to be dict-like for resolvers using [] access
    return {
        "current_user": user_info,
        "tenant_id": str(test_user.tenant_id),
        "db": async_db_session,
    }


@pytest_asyncio.fixture
async def test_tenant(async_db_session) -> Tenant:
    """Create a test tenant."""
    slug_suffix = uuid4().hex[:8]
    tenant = Tenant(
        name="Test ISP",
        slug=f"test-isp-{slug_suffix}",
        is_active=True,
    )
    async_db_session.add(tenant)
    await async_db_session.commit()
    await async_db_session.refresh(tenant)
    return tenant


@pytest_asyncio.fixture
async def test_user(async_db_session, test_tenant: Tenant) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        password_hash="hashed_password_placeholder",  # Required field
        tenant_id=test_tenant.id,
        is_active=True,
        is_verified=True,
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def sample_access_points(async_db_session, test_tenant: Tenant) -> list[WirelessDevice]:
    """Create sample access points for testing."""
    access_points = []

    for i in range(5):
        building_letter = "A" if i % 2 == 0 else "B"
        site_id = f"site-{i % 2}"
        site_display_name = f"Building {building_letter}"
        ap_name = f"AP-Building-{building_letter}-{i}"
        location_meta = {
            "building": site_display_name,
            "floor": f"{i + 1}",
            "room": f"Room {i}01",
            "mounting_type": "ceiling",
            "latitude": 40.7128 + (i * 0.001),
            "longitude": -74.0060 + (i * 0.001),
            "altitude": 10.0,
        }
        radio_frequency = Frequency.FREQ_5_GHZ if i % 3 != 0 else Frequency.FREQ_2_4_GHZ
        frequency_band_str = "5GHz" if radio_frequency == Frequency.FREQ_5_GHZ else "2.4GHz"
        channel_value = 36 + (i * 4)
        if radio_frequency == Frequency.FREQ_2_4_GHZ:
            channel_value = [1, 6, 11][i % 3]
        rf_metrics_meta = {
            "signal_strength_dbm": -45.0 - (i * 5),
            "noise_floor_dbm": -90.0,
            "snr": 45.0 - (i * 5),
            "channel_utilization_percent": 30.0 + (i * 5),
            "interference_level": 0.1 if i < 3 else 0.3,
            "tx_power_dbm": 20.0,
            "rx_power_dbm": -45.0,
        }
        performance_meta = {
            "connected_clients": 20 + (i * 5),
            "authenticated_clients": 18 + (i * 5),
            "authorized_clients": 17 + (i * 5),
            "tx_rate_mbps": 450.0,
            "rx_rate_mbps": 500.0,
            "tx_bytes": 1_000_000_000 * (i + 1),
            "rx_bytes": 2_000_000_000 * (i + 1),
            "tx_packets": 500_000 * (i + 1),
            "rx_packets": 600_000 * (i + 1),
            "tx_errors": 10 + i,
            "rx_errors": 5 + i,
            "tx_dropped": 2 + i,
            "rx_dropped": 1 + i,
            "retries": 3 + i,
            "cpu_usage_percent": 10.0 + (i * 2),
            "memory_usage_percent": 35.0 + (i * 3),
            "uptime_seconds": 86_400 + (i * 1_000),
        }
        extra_metadata = {
            "site": {"id": site_id, "name": site_display_name},
            "location": location_meta,
            "rf_metrics": rf_metrics_meta,
            "performance": performance_meta,
            "channel": channel_value,
            "channel_width": 80,
            "transmit_power": 20,
            "max_clients": 100,
            "security_type": "wpa2_wpa3",
            "frequency_band": frequency_band_str,
        }

        ap = WirelessDevice(
            tenant_id=test_tenant.id,
            name=ap_name,
            device_type=DeviceType.ACCESS_POINT,
            status=DeviceStatus.ONLINE if i < 4 else DeviceStatus.OFFLINE,
            mac_address=f"00:11:22:33:44:{i:02d}",
            ip_address=f"192.168.1.{100 + i}",
            serial_number=f"SN{i:06d}",
            manufacturer="Ubiquiti",
            model="UniFi AP AC Pro",
            firmware_version="5.60.0",
            last_seen=datetime.utcnow() if i < 4 else datetime.utcnow() - timedelta(hours=1),
            uptime_seconds=86_400 + (i * 1_000),
            site_name=site_id,
            ssid="Corporate-WiFi",
            latitude=location_meta["latitude"],
            longitude=location_meta["longitude"],
            altitude_meters=location_meta["altitude"],
            extra_metadata=extra_metadata,
        )
        async_db_session.add(ap)
        await async_db_session.flush()

        radio = WirelessRadio(
            tenant_id=test_tenant.id,
            device_id=ap.id,
            radio_name=f"{ap_name}-radio",
            radio_index=0,
            frequency=radio_frequency,
            protocol=RadioProtocol.WIFI_6,
            channel=channel_value,
            channel_width_mhz=extra_metadata["channel_width"],
            transmit_power_dbm=20.0,
            max_power_dbm=23.0,
            enabled=True,
            status=DeviceStatus.ONLINE if i < 4 else DeviceStatus.OFFLINE,
            noise_floor_dbm=rf_metrics_meta["noise_floor_dbm"],
            interference_level=rf_metrics_meta["interference_level"],
            utilization_percent=rf_metrics_meta["channel_utilization_percent"],
            connected_clients=performance_meta["connected_clients"],
            tx_bytes=performance_meta["tx_bytes"],
            rx_bytes=performance_meta["rx_bytes"],
            tx_packets=performance_meta["tx_packets"],
            rx_packets=performance_meta["rx_packets"],
            errors=performance_meta.get("tx_errors", 0) + performance_meta.get("rx_errors", 0),
            retries=performance_meta.get("retries", 0),
            extra_metadata={},
        )
        async_db_session.add(radio)
        access_points.append(ap)

    await async_db_session.commit()
    for ap in access_points:
        await async_db_session.refresh(ap)

    return access_points


@pytest_asyncio.fixture
async def sample_wireless_clients(
    async_db_session, test_tenant: Tenant, sample_access_points: list[WirelessDevice]
) -> list[WirelessClientModel]:
    """Create sample wireless clients for testing."""
    clients = []

    for i in range(10):
        ap = sample_access_points[i % len(sample_access_points)]
        frequency = Frequency.FREQ_5_GHZ if i % 3 != 0 else Frequency.FREQ_2_4_GHZ
        extra_metadata = {
            "access_point_name": ap.name,
            "connection_type": "5GHz" if frequency == Frequency.FREQ_5_GHZ else "2.4GHz",
            "is_authenticated": True,
            "is_authorized": True,
            "signal_quality": {
                "rssi_dbm": -50.0 - (i * 2),
                "snr_db": 40.0 - (i * 2),
                "noise_floor_dbm": -90.0,
                "signal_strength_percent": 80.0 - (i * 2),
                "link_quality_percent": 85.0 - (i * 2),
            },
            "noise_floor_dbm": -90.0,
            "customer": {"id": f"customer-{i % 3}", "name": f"Customer {i % 3}"},
            "manufacturer": "Apple" if i % 2 == 0 else "Samsung",
        }

        client = WirelessClientModel(
            tenant_id=test_tenant.id,
            mac_address=f"00:AA:BB:CC:DD:{i:02X}",
            hostname=f"device-{i}",
            ip_address=f"192.168.1.{200 + i}",
            device_id=ap.id,
            ssid="Corporate-WiFi",
            frequency=frequency,
            channel=36 if frequency == Frequency.FREQ_5_GHZ else 1,
            connected=True,
            first_seen=datetime.utcnow() - timedelta(hours=i + 2),
            last_seen=datetime.utcnow(),
            connection_duration_seconds=3600 * (i + 1),
            rssi_dbm=-50.0 - (i * 2),
            snr_db=40.0 - (i * 2),
            tx_rate_mbps=450.0,
            rx_rate_mbps=500.0,
            tx_bytes=500_000_000 + (i * 10_000_000),
            rx_bytes=1_000_000_000 + (i * 20_000_000),
            tx_packets=500_000 + (i * 10_000),
            rx_packets=600_000 + (i * 10_000),
            vendor="Apple" if i % 2 == 0 else "Samsung",
            device_type="laptop" if i % 2 == 0 else "phone",
            extra_metadata=extra_metadata,
        )
        async_db_session.add(client)
        clients.append(client)

    await async_db_session.commit()
    for client in clients:
        await async_db_session.refresh(client)

    return clients


@pytest_asyncio.fixture
async def sample_coverage_zones(
    async_db_session, test_tenant: Tenant, sample_access_points: list[WirelessDevice]
) -> list[CoverageZoneModel]:
    """Create sample coverage zones for testing."""
    zones = []

    for i in range(3):
        site_id = f"site-{i % 2}"
        site_display_name = f"Building {'A' if i % 2 == 0 else 'B'}"
        extra_metadata = {
            "site": {"id": site_id, "name": site_display_name},
            "floor": f"{i + 1}",
            "area_type": "office",
            "coverage_area_sqm": float(500 + (i * 100)),
            "signal_strength": {
                "min_dbm": -70.0,
                "max_dbm": -30.0,
                "avg_dbm": -50.0 - (i * 5),
            },
            "access_points": [str(ap.id) for ap in sample_access_points[i::3]],
            "connected_clients": 50 + (i * 10),
            "max_client_capacity": 200,
            "client_density_per_ap": 25.0,
            "interference_level": 0.2,
            "channel_utilization_avg": 30.0 + (i * 5),
            "noise_floor_avg_dbm": -90.0,
            "coverage_polygon": '{"type":"Polygon","coordinates":[[[0,0],[0,10],[10,10],[10,0],[0,0]]]}',
            "last_surveyed_at": (datetime.utcnow() - timedelta(days=1)).isoformat(),
        }

        zone = CoverageZoneModel(
            tenant_id=test_tenant.id,
            zone_name=f"{site_display_name} - Floor {i + 1}",
            coverage_type=CoverageType.PRIMARY,
            geometry={
                "type": "Polygon",
                "coordinates": [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
            },
            center_latitude=40.7128 + (i * 0.002),
            center_longitude=-74.0060 + (i * 0.002),
            estimated_signal_strength_dbm=-50.0 - (i * 5),
            coverage_radius_meters=100.0 + (i * 10),
            frequency=Frequency.FREQ_5_GHZ,
            description=f"Coverage zone for floor {i + 1}",
            extra_metadata=extra_metadata,
        )
        async_db_session.add(zone)
        zones.append(zone)

    await async_db_session.commit()
    for zone in zones:
        await async_db_session.refresh(zone)

    return zones


# ============================================================================
# Access Point Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_access_points_list(graphql_client, graphql_context, sample_access_points):
    """Test access_points list query."""
    query = """
        query {
            accessPoints(limit: 10, offset: 0) {
                accessPoints {
                    id
                    name
                    macAddress
                    status
                    isOnline
                }
                totalCount
                hasNextPage
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    assert result.data is not None
    assert "accessPoints" in result.data

    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 5
    assert result.data["accessPoints"]["totalCount"] == 5
    assert result.data["accessPoints"]["hasNextPage"] is False


@pytest.mark.asyncio
async def test_access_points_pagination(graphql_client, graphql_context, sample_access_points):
    """Test access_points pagination."""
    query = """
        query {
            accessPoints(limit: 2, offset: 0) {
                accessPoints {
                    id
                    name
                }
                totalCount
                hasNextPage
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 2
    assert result.data["accessPoints"]["totalCount"] == 5
    assert result.data["accessPoints"]["hasNextPage"] is True


@pytest.mark.asyncio
async def test_access_points_filter_by_status(
    graphql_client, graphql_context, sample_access_points
):
    """Test filtering access points by status."""
    query = """
        query {
            accessPoints(status: ONLINE) {
                accessPoints {
                    id
                    status
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 4
    assert all(ap["status"] == "ONLINE" for ap in access_points)


@pytest.mark.asyncio
async def test_access_points_filter_by_site(graphql_client, graphql_context, sample_access_points):
    """Test filtering access points by site."""
    query = """
        query {
            accessPoints(siteId: "site-0") {
                accessPoints {
                    id
                    siteName
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 3
    assert all(ap["siteName"] == "Building A" for ap in access_points)


@pytest.mark.asyncio
async def test_access_points_search(graphql_client, graphql_context, sample_access_points):
    """Test searching access points."""
    query = """
        query {
            accessPoints(search: "AP-Building-A-0") {
                accessPoints {
                    id
                    name
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 1
    assert access_points[0]["name"] == "AP-Building-A-0"


@pytest.mark.asyncio
async def test_access_point_detail(graphql_client, graphql_context, sample_access_points):
    """Test access_point detail query."""
    ap = sample_access_points[0]

    query = f"""
        query {{
            accessPoint(id: "{ap.id}") {{
                id
                name
                macAddress
                ipAddress
                status
                isOnline
                model
                manufacturer
                firmwareVersion
                location {{
                    siteName
                    building
                    floor
                }}
                rfMetrics {{
                    signalStrengthDbm
                    channelUtilizationPercent
                }}
                performance {{
                    connectedClients
                    cpuUsagePercent
                }}
            }}
        }}
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_point = result.data["accessPoint"]
    assert access_point["id"] == str(ap.id)
    assert access_point["name"] == ap.name
    assert access_point["macAddress"] == ap.mac_address
    assert access_point["location"]["building"] == "Building A"


@pytest.mark.asyncio
async def test_access_points_by_site(graphql_client, graphql_context, sample_access_points):
    """Test access_points_by_site query."""
    query = """
        query {
            accessPointsBySite(siteId: "site-0") {
                id
                name
                status
                isOnline
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    access_points = result.data["accessPointsBySite"]
    assert len(access_points) == 3


# ============================================================================
# Wireless Client Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_wireless_clients_list(graphql_client, graphql_context, sample_wireless_clients):
    """Test wireless_clients list query."""
    query = """
        query {
            wirelessClients(limit: 20, offset: 0) {
                clients {
                    id
                    macAddress
                    hostname
                    isAuthenticated
                }
                totalCount
                hasNextPage
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    clients = result.data["wirelessClients"]["clients"]
    assert len(clients) == 10
    assert result.data["wirelessClients"]["totalCount"] == 10


@pytest.mark.asyncio
async def test_wireless_clients_filter_by_band(
    graphql_client, graphql_context, sample_wireless_clients
):
    """Test filtering wireless clients by frequency band."""
    query = """
        query {
            wirelessClients(frequencyBand: BAND_5_GHZ) {
                clients {
                    id
                    frequencyBand
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    clients = result.data["wirelessClients"]["clients"]
    # 7 out of 10 clients use 5GHz (indices 1,2,4,5,7,8 = 6, plus edge cases)
    assert len(clients) >= 6


@pytest.mark.asyncio
async def test_wireless_client_detail(graphql_client, graphql_context, sample_wireless_clients):
    """Test wireless_client detail query."""
    client = sample_wireless_clients[0]

    query = f"""
        query {{
            wirelessClient(id: "{client.id}") {{
                id
                macAddress
                hostname
                ipAddress
                manufacturer
                accessPointName
                ssid
                signalQuality {{
                    rssiDbm
                    snrDb
                    signalStrengthPercent
                }}
            }}
        }}
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    client_data = result.data["wirelessClient"]
    assert client_data["id"] == str(client.id)
    assert client_data["macAddress"] == client.mac_address
    assert client_data["hostname"] == client.hostname


@pytest.mark.asyncio
async def test_wireless_clients_by_access_point(
    graphql_client, graphql_context, sample_access_points, sample_wireless_clients
):
    """Test wireless_clients_by_access_point query."""
    ap = sample_access_points[0]

    query = f"""
        query {{
            wirelessClientsByAccessPoint(accessPointId: "{ap.id}") {{
                id
                macAddress
                hostname
            }}
        }}
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    clients = result.data["wirelessClientsByAccessPoint"]
    # Should have 2 clients (indices 0 and 5)
    assert len(clients) == 2


@pytest.mark.asyncio
async def test_wireless_clients_by_customer(
    graphql_client, graphql_context, sample_wireless_clients
):
    """Test wireless_clients_by_customer query."""
    query = """
        query {
            wirelessClientsByCustomer(customerId: "customer-0") {
                id
                macAddress
                customerName
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    clients = result.data["wirelessClientsByCustomer"]
    # Should have 4 clients (indices 0, 3, 6, 9)
    assert len(clients) == 4
    assert all(c["customerName"] == "Customer 0" for c in clients)


# ============================================================================
# Coverage Zone Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_coverage_zones_list(graphql_client, graphql_context, sample_coverage_zones):
    """Test coverage_zones list query."""
    query = """
        query {
            coverageZones(limit: 10, offset: 0) {
                zones {
                    id
                    name
                    siteName
                    floor
                }
                totalCount
                hasNextPage
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    zones = result.data["coverageZones"]["zones"]
    assert len(zones) == 3
    assert result.data["coverageZones"]["totalCount"] == 3


@pytest.mark.asyncio
async def test_coverage_zone_detail(graphql_client, graphql_context, sample_coverage_zones):
    """Test coverage_zone detail query."""
    zone = sample_coverage_zones[0]

    query = f"""
        query {{
            coverageZone(id: "{zone.id}") {{
                id
                name
                siteName
                floor
                areaType
                coverageAreaSqm
                accessPointCount
                connectedClients
            }}
        }}
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    zone_data = result.data["coverageZone"]
    assert zone_data["id"] == str(zone.id)
    assert zone_data["name"] == zone.name


@pytest.mark.asyncio
async def test_coverage_zones_by_site(graphql_client, graphql_context, sample_coverage_zones):
    """Test coverage_zones_by_site query."""
    query = """
        query {
            coverageZonesBySite(siteId: "site-0") {
                id
                name
                floor
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    zones = result.data["coverageZonesBySite"]
    assert len(zones) == 2


# ============================================================================
# RF Analytics Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_rf_analytics(graphql_client, graphql_context, sample_access_points):
    """Test rf_analytics query."""
    query = """
        query {
            rfAnalytics(siteId: "site-0") {
                siteId
                siteName
                averageSignalStrengthDbm
                averageSnr
                coverageQualityScore
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    analytics = result.data["rfAnalytics"]
    assert analytics["siteId"] == "site-0"
    assert analytics["siteName"] == "Building A"


@pytest.mark.asyncio
async def test_channel_utilization(graphql_client, graphql_context, sample_access_points):
    """Test channel_utilization query."""
    query = """
        query {
            channelUtilization(siteId: "site-0", frequencyBand: BAND_5_GHZ) {
                channel
                frequencyMhz
                band
                utilizationPercent
                accessPointsCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    utilization = result.data["channelUtilization"]
    assert isinstance(utilization, list)


# ============================================================================
# Dashboard and Metrics Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_wireless_site_metrics(
    graphql_client, graphql_context, sample_access_points, sample_wireless_clients
):
    """Test wireless_site_metrics query."""
    query = """
        query {
            wirelessSiteMetrics(siteId: "site-0") {
                siteId
                siteName
                totalAps
                onlineAps
                offlineAps
                totalClients
                overallHealthScore
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    metrics = result.data["wirelessSiteMetrics"]
    assert metrics["siteId"] == "site-0"
    assert metrics["siteName"] == "Building A"
    assert metrics["totalAps"] == 3


@pytest.mark.asyncio
async def test_wireless_dashboard(
    graphql_client, graphql_context, sample_access_points, sample_wireless_clients
):
    """Test wireless_dashboard query."""
    query = """
        query {
            wirelessDashboard {
                totalAccessPoints
                totalClients
                onlineAps
                offlineAps
                topApsByClients {
                    id
                    name
                    performance {
                        connectedClients
                    }
                }
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    assert result.errors is None
    dashboard = result.data["wirelessDashboard"]
    assert dashboard["totalAccessPoints"] == 5
    assert dashboard["onlineAps"] == 4
    assert dashboard["offlineAps"] == 1


# ============================================================================
# Tenant Isolation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_tenant_isolation(graphql_client, async_db_session, sample_access_points):
    """Test that queries only return data for the authenticated tenant."""
    from dotmac.platform.auth.core import UserInfo

    # Create a different tenant
    other_tenant = Tenant(
        name="Other ISP",
        slug="other-isp",
        is_active=True,
    )
    async_db_session.add(other_tenant)
    await async_db_session.commit()
    await async_db_session.refresh(other_tenant)

    # Create an AP for the other tenant
    other_ap = WirelessDevice(
        tenant_id=other_tenant.id,
        name="Other-AP",
        device_type=DeviceType.ACCESS_POINT,
        status=DeviceStatus.ONLINE,
        mac_address="FF:FF:FF:FF:FF:FF",
        ip_address="10.0.0.1",
        serial_number="OTHER12345",
        manufacturer="Cisco",
        model="Aironet",
        ssid="Other-WiFi",
        site_name="other-site",
        extra_metadata={
            "site": {"id": "other-site", "name": "Building Z"},
            "location": {"building": "Building Z"},
            "rf_metrics": {
                "signal_strength_dbm": -50.0,
                "noise_floor_dbm": -90.0,
                "snr": 40.0,
                "channel_utilization_percent": 20.0,
            },
            "performance": {"connected_clients": 5},
            "channel": 44,
            "channel_width": 80,
        },
    )
    async_db_session.add(other_ap)
    await async_db_session.flush()
    other_radio = WirelessRadio(
        tenant_id=other_tenant.id,
        device_id=other_ap.id,
        radio_name="Other-AP-radio",
        radio_index=0,
        frequency=Frequency.FREQ_5_GHZ,
        protocol=RadioProtocol.WIFI_6,
        channel=44,
        channel_width_mhz=80,
        transmit_power_dbm=18.0,
        max_power_dbm=23.0,
        enabled=True,
        status=DeviceStatus.ONLINE,
        noise_floor_dbm=-90.0,
        interference_level=0.2,
        utilization_percent=25.0,
        connected_clients=5,
        tx_bytes=1000,
        rx_bytes=2000,
        tx_packets=100,
        rx_packets=200,
        errors=0,
        retries=0,
        extra_metadata={},
    )
    async_db_session.add(other_radio)
    await async_db_session.commit()

    # Create user for other tenant
    other_user = User(
        email="other@example.com",
        username="otheruser",
        password_hash="hashed_password_placeholder",
        tenant_id=other_tenant.id,
        is_active=True,
        is_verified=True,
    )
    async_db_session.add(other_user)
    await async_db_session.commit()
    await async_db_session.refresh(other_user)

    # Create UserInfo for other tenant
    other_user_info = UserInfo(
        user_id=str(other_user.id),
        tenant_id=str(other_user.tenant_id),
        permissions=["wireless:read"],
        email=other_user.email,
        username=other_user.username,
    )

    # Create context for other tenant
    other_context = {
        "current_user": other_user_info,
        "tenant_id": str(other_user.tenant_id),
        "db": async_db_session,
    }

    query = """
        query {
            accessPoints {
                accessPoints {
                    id
                    name
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=other_context)

    assert result.errors is None
    # Should only see the 1 AP from other tenant, not the 5 from test tenant
    assert result.data["accessPoints"]["totalCount"] == 1
    assert result.data["accessPoints"]["accessPoints"][0]["name"] == "Other-AP"


# ============================================================================
# Error Handling Tests
# ============================================================================


@pytest.mark.asyncio
async def test_access_point_not_found(graphql_client, graphql_context):
    """Test querying for non-existent access point."""
    query = """
        query {
            accessPoint(id: "99999999-9999-9999-9999-999999999999") {
                id
                name
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    # Should return null for non-existent resource
    assert result.data["accessPoint"] is None


@pytest.mark.asyncio
async def test_invalid_pagination_parameters(graphql_client, graphql_context, sample_access_points):
    """Test handling of invalid pagination parameters."""
    query = """
        query {
            accessPoints(limit: -1, offset: -10) {
                accessPoints {
                    id
                }
                totalCount
            }
        }
    """

    result = await graphql_client.execute(query, context_value=graphql_context)

    # Should handle invalid parameters gracefully
    # Implementation should either error or clamp values
    assert result.errors is not None or result.data["accessPoints"]["accessPoints"] == []
