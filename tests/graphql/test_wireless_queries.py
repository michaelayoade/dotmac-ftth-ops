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

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List

from strawberry.test import BaseGraphQLTestClient
from sqlalchemy.orm import Session

from dotmac.platform.graphql.schema import schema
from dotmac.platform.graphql.context import GraphQLContext
from dotmac.platform.wireless.models import WirelessDevice, WirelessClient as WirelessClientModel, CoverageZone as CoverageZoneModel
from dotmac.platform.auth.models import User, Tenant


# ============================================================================
# Test Fixtures
# ============================================================================

@pytest.fixture
def graphql_client(db: Session, test_user: User) -> BaseGraphQLTestClient:
    """Create a GraphQL test client with authenticated context."""

    class TestGraphQLClient(BaseGraphQLTestClient):
        def __init__(self, schema, user: User, db: Session):
            super().__init__(schema)
            self.user = user
            self.db = db

        async def get_context(self) -> GraphQLContext:
            return GraphQLContext(
                request=None,
                user=self.user,
                db=self.db,
                tenant_id=str(self.user.tenant_id),
                permissions={"wireless:read", "wireless:write"}
            )

    return TestGraphQLClient(schema, test_user, db)


@pytest.fixture
def test_tenant(db: Session) -> Tenant:
    """Create a test tenant."""
    tenant = Tenant(
        name="Test ISP",
        slug="test-isp",
        is_active=True,
    )
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant


@pytest.fixture
def test_user(db: Session, test_tenant: Tenant) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        tenant_id=test_tenant.id,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def sample_access_points(db: Session, test_tenant: Tenant) -> List[WirelessDevice]:
    """Create sample access points for testing."""
    access_points = []

    for i in range(5):
        ap = WirelessDevice(
            tenant_id=test_tenant.id,
            device_name=f"AP-Building-A-{i}",
            device_type="access_point",
            mac_address=f"00:11:22:33:44:{i:02d}",
            ip_address=f"192.168.1.{100 + i}",
            serial_number=f"SN{i:06d}",
            manufacturer="Ubiquiti",
            model="UniFi AP AC Pro",
            firmware_version="5.60.0",
            status="online" if i < 4 else "offline",
            is_online=i < 4,
            last_seen_at=datetime.utcnow() if i < 4 else datetime.utcnow() - timedelta(hours=1),
            site_id=f"site-{i % 2}",  # 2 sites
            site_name=f"Building {'A' if i % 2 == 0 else 'B'}",
            ssid="Corporate-WiFi",
            frequency_band="5GHz",
            channel=36 + (i * 4),
            channel_width=80,
            transmit_power=20,
            max_clients=100,
            security_type="WPA2-Enterprise",
            location_data={
                "building": f"Building {'A' if i % 2 == 0 else 'B'}",
                "floor": f"{i + 1}",
                "room": f"Room {i}01",
                "mounting_type": "ceiling",
                "latitude": 40.7128 + (i * 0.001),
                "longitude": -74.0060 + (i * 0.001),
                "altitude": 10.0,
            },
            rf_metrics={
                "signal_strength_dbm": -45.0 - (i * 5),
                "noise_floor_dbm": -90.0,
                "snr": 45.0 - (i * 5),
                "channel_utilization_percent": 30.0 + (i * 5),
                "interference_level": "low" if i < 3 else "medium",
                "tx_power_dbm": 20.0,
                "rx_power_dbm": -45.0,
            },
            performance_metrics={
                "tx_bytes": 1000000000 * (i + 1),
                "rx_bytes": 2000000000 * (i + 1),
                "tx_packets": 500000 * (i + 1),
                "rx_packets": 600000 * (i + 1),
                "tx_rate_mbps": 450.0,
                "rx_rate_mbps": 500.0,
                "tx_errors": 10 + i,
                "rx_errors": 5 + i,
                "connected_clients": 20 + (i * 5),
                "cpu_usage_percent": 10.0 + (i * 2),
                "memory_usage_percent": 35.0 + (i * 3),
                "uptime_seconds": 86400 + (i * 1000),
            },
            created_at=datetime.utcnow() - timedelta(days=30),
            updated_at=datetime.utcnow(),
        )
        db.add(ap)
        access_points.append(ap)

    db.commit()
    for ap in access_points:
        db.refresh(ap)

    return access_points


@pytest.fixture
def sample_wireless_clients(
    db: Session,
    test_tenant: Tenant,
    sample_access_points: List[WirelessDevice]
) -> List[WirelessClientModel]:
    """Create sample wireless clients for testing."""
    clients = []

    for i in range(10):
        ap = sample_access_points[i % len(sample_access_points)]

        client = WirelessClientModel(
            tenant_id=test_tenant.id,
            mac_address=f"00:AA:BB:CC:DD:{i:02X}",
            hostname=f"device-{i}",
            ip_address=f"192.168.1.{200 + i}",
            manufacturer="Apple" if i % 2 == 0 else "Samsung",
            device_id=ap.id,
            access_point_name=ap.device_name,
            ssid="Corporate-WiFi",
            connection_type="802.11ac",
            frequency_band="5GHz" if i % 3 != 0 else "2.4GHz",
            channel=36 if i % 3 != 0 else 1,
            is_authenticated=True,
            is_authorized=True,
            signal_strength_dbm=-50.0 - (i * 2),
            signal_quality_metrics={
                "rssi_dbm": -50.0 - (i * 2),
                "snr_db": 40.0 - (i * 2),
                "noise_floor_dbm": -90.0,
                "signal_strength_percent": 80.0 - (i * 2),
                "link_quality_percent": 85.0 - (i * 2),
            },
            noise_floor_dbm=-90.0,
            snr=40.0 - (i * 2),
            tx_rate_mbps=450.0,
            rx_rate_mbps=500.0,
            tx_bytes=500000000 + (i * 10000000),
            rx_bytes=1000000000 + (i * 20000000),
            connected_at=datetime.utcnow() - timedelta(hours=i),
            last_seen_at=datetime.utcnow(),
            uptime_seconds=3600 * (i + 1),
            customer_id=f"customer-{i % 3}",
            customer_name=f"Customer {i % 3}",
        )
        db.add(client)
        clients.append(client)

    db.commit()
    for client in clients:
        db.refresh(client)

    return clients


@pytest.fixture
def sample_coverage_zones(
    db: Session,
    test_tenant: Tenant,
    sample_access_points: List[WirelessDevice]
) -> List[CoverageZoneModel]:
    """Create sample coverage zones for testing."""
    zones = []

    for i in range(3):
        zone = CoverageZoneModel(
            tenant_id=test_tenant.id,
            name=f"Building {'A' if i % 2 == 0 else 'B'} - Floor {i + 1}",
            description=f"Coverage zone for floor {i + 1}",
            site_id=f"site-{i % 2}",
            site_name=f"Building {'A' if i % 2 == 0 else 'B'}",
            floor=f"{i + 1}",
            area_type="office",
            coverage_area_sqm=Decimal("500.0") + (Decimal(i) * Decimal("100.0")),
            signal_strength_min_dbm=Decimal("-70.0"),
            signal_strength_max_dbm=Decimal("-30.0"),
            signal_strength_avg_dbm=Decimal("-50.0") - Decimal(i * 5),
            access_point_ids=[ap.id for ap in sample_access_points[i::3]],
            access_point_count=len(sample_access_points[i::3]),
            interference_level="low",
            channel_utilization_avg=Decimal("30.0") + Decimal(i * 5),
            noise_floor_avg_dbm=Decimal("-90.0"),
            connected_clients=50 + (i * 10),
            max_client_capacity=200,
            client_density_per_ap=Decimal("25.0"),
            coverage_polygon='{"type":"Polygon","coordinates":[[[0,0],[0,10],[10,10],[10,0],[0,0]]]}',
            created_at=datetime.utcnow() - timedelta(days=30),
            updated_at=datetime.utcnow(),
            last_surveyed_at=datetime.utcnow() - timedelta(days=1),
        )
        db.add(zone)
        zones.append(zone)

    db.commit()
    for zone in zones:
        db.refresh(zone)

    return zones


# ============================================================================
# Access Point Query Tests
# ============================================================================

@pytest.mark.asyncio
async def test_access_points_list(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    assert result.data is not None
    assert "accessPoints" in result.data

    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 5
    assert result.data["accessPoints"]["totalCount"] == 5
    assert result.data["accessPoints"]["hasNextPage"] is False


@pytest.mark.asyncio
async def test_access_points_pagination(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 2
    assert result.data["accessPoints"]["totalCount"] == 5
    assert result.data["accessPoints"]["hasNextPage"] is True


@pytest.mark.asyncio
async def test_access_points_filter_by_status(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 4
    assert all(ap["status"] == "ONLINE" for ap in access_points)


@pytest.mark.asyncio
async def test_access_points_filter_by_site(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 3
    assert all(ap["siteName"] == "Building A" for ap in access_points)


@pytest.mark.asyncio
async def test_access_points_search(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_points = result.data["accessPoints"]["accessPoints"]
    assert len(access_points) == 1
    assert access_points[0]["name"] == "AP-Building-A-0"


@pytest.mark.asyncio
async def test_access_point_detail(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_point = result.data["accessPoint"]
    assert access_point["id"] == str(ap.id)
    assert access_point["name"] == ap.device_name
    assert access_point["macAddress"] == ap.mac_address
    assert access_point["location"]["building"] == "Building A"


@pytest.mark.asyncio
async def test_access_points_by_site(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    access_points = result.data["accessPointsBySite"]
    assert len(access_points) == 3


# ============================================================================
# Wireless Client Query Tests
# ============================================================================

@pytest.mark.asyncio
async def test_wireless_clients_list(graphql_client: BaseGraphQLTestClient, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    clients = result.data["wirelessClients"]["clients"]
    assert len(clients) == 10
    assert result.data["wirelessClients"]["totalCount"] == 10


@pytest.mark.asyncio
async def test_wireless_clients_filter_by_band(graphql_client: BaseGraphQLTestClient, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    clients = result.data["wirelessClients"]["clients"]
    # 7 out of 10 clients use 5GHz (indices 1,2,4,5,7,8 = 6, plus edge cases)
    assert len(clients) >= 6


@pytest.mark.asyncio
async def test_wireless_client_detail(graphql_client: BaseGraphQLTestClient, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    client_data = result.data["wirelessClient"]
    assert client_data["id"] == str(client.id)
    assert client_data["macAddress"] == client.mac_address
    assert client_data["hostname"] == client.hostname


@pytest.mark.asyncio
async def test_wireless_clients_by_access_point(
    graphql_client: BaseGraphQLTestClient,
    sample_access_points,
    sample_wireless_clients
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

    result = await graphql_client.query(query)

    assert result.errors is None
    clients = result.data["wirelessClientsByAccessPoint"]
    # Should have 2 clients (indices 0 and 5)
    assert len(clients) == 2


@pytest.mark.asyncio
async def test_wireless_clients_by_customer(graphql_client: BaseGraphQLTestClient, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    clients = result.data["wirelessClientsByCustomer"]
    # Should have 4 clients (indices 0, 3, 6, 9)
    assert len(clients) == 4
    assert all(c["customerName"] == "Customer 0" for c in clients)


# ============================================================================
# Coverage Zone Query Tests
# ============================================================================

@pytest.mark.asyncio
async def test_coverage_zones_list(graphql_client: BaseGraphQLTestClient, sample_coverage_zones):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    zones = result.data["coverageZones"]["zones"]
    assert len(zones) == 3
    assert result.data["coverageZones"]["totalCount"] == 3


@pytest.mark.asyncio
async def test_coverage_zone_detail(graphql_client: BaseGraphQLTestClient, sample_coverage_zones):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    zone_data = result.data["coverageZone"]
    assert zone_data["id"] == str(zone.id)
    assert zone_data["name"] == zone.name


@pytest.mark.asyncio
async def test_coverage_zones_by_site(graphql_client: BaseGraphQLTestClient, sample_coverage_zones):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    zones = result.data["coverageZonesBySite"]
    assert len(zones) == 2


# ============================================================================
# RF Analytics Query Tests
# ============================================================================

@pytest.mark.asyncio
async def test_rf_analytics(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    analytics = result.data["rfAnalytics"]
    assert analytics["siteId"] == "site-0"
    assert analytics["siteName"] == "Building A"


@pytest.mark.asyncio
async def test_channel_utilization(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    utilization = result.data["channelUtilization"]
    assert isinstance(utilization, list)


# ============================================================================
# Dashboard and Metrics Query Tests
# ============================================================================

@pytest.mark.asyncio
async def test_wireless_site_metrics(graphql_client: BaseGraphQLTestClient, sample_access_points, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    metrics = result.data["wirelessSiteMetrics"]
    assert metrics["siteId"] == "site-0"
    assert metrics["siteName"] == "Building A"
    assert metrics["totalAps"] == 3


@pytest.mark.asyncio
async def test_wireless_dashboard(graphql_client: BaseGraphQLTestClient, sample_access_points, sample_wireless_clients):
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

    result = await graphql_client.query(query)

    assert result.errors is None
    dashboard = result.data["wirelessDashboard"]
    assert dashboard["totalAccessPoints"] == 5
    assert dashboard["onlineAps"] == 4
    assert dashboard["offlineAps"] == 1


# ============================================================================
# Tenant Isolation Tests
# ============================================================================

@pytest.mark.asyncio
async def test_tenant_isolation(db: Session, sample_access_points):
    """Test that queries only return data for the authenticated tenant."""
    # Create a different tenant
    other_tenant = Tenant(
        name="Other ISP",
        slug="other-isp",
        is_active=True,
    )
    db.add(other_tenant)
    db.commit()
    db.refresh(other_tenant)

    # Create an AP for the other tenant
    other_ap = WirelessDevice(
        tenant_id=other_tenant.id,
        device_name="Other-AP",
        device_type="access_point",
        mac_address="FF:FF:FF:FF:FF:FF",
        ip_address="10.0.0.1",
        status="online",
        is_online=True,
    )
    db.add(other_ap)
    db.commit()

    # Create user for other tenant
    other_user = User(
        email="other@example.com",
        username="otheruser",
        tenant_id=other_tenant.id,
        is_active=True,
        is_verified=True,
    )
    db.add(other_user)
    db.commit()
    db.refresh(other_user)

    # Create GraphQL client for other tenant
    class TestGraphQLClient(BaseGraphQLTestClient):
        def __init__(self, schema, user: User, db: Session):
            super().__init__(schema)
            self.user = user
            self.db = db

        async def get_context(self) -> GraphQLContext:
            return GraphQLContext(
                request=None,
                user=self.user,
                db=self.db,
                tenant_id=str(self.user.tenant_id),
                permissions={"wireless:read"}
            )

    other_client = TestGraphQLClient(schema, other_user, db)

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

    result = await other_client.query(query)

    assert result.errors is None
    # Should only see the 1 AP from other tenant, not the 5 from test tenant
    assert result.data["accessPoints"]["totalCount"] == 1
    assert result.data["accessPoints"]["accessPoints"][0]["name"] == "Other-AP"


# ============================================================================
# Error Handling Tests
# ============================================================================

@pytest.mark.asyncio
async def test_access_point_not_found(graphql_client: BaseGraphQLTestClient):
    """Test querying for non-existent access point."""
    query = """
        query {
            accessPoint(id: "99999999-9999-9999-9999-999999999999") {
                id
                name
            }
        }
    """

    result = await graphql_client.query(query)

    # Should return null for non-existent resource
    assert result.data["accessPoint"] is None


@pytest.mark.asyncio
async def test_invalid_pagination_parameters(graphql_client: BaseGraphQLTestClient, sample_access_points):
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

    result = await graphql_client.query(query)

    # Should handle invalid parameters gracefully
    # Implementation should either error or clamp values
    assert result.errors is not None or result.data["accessPoints"]["accessPoints"] == []
