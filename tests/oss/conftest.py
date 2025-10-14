"""
OSS Test Fixtures and Utilities.

Provides test fixtures for OSS integration testing including:
- RADIUS server mocks
- NetBox API mocks
- GenieACS server mocks
- Service lifecycle test data
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from dotmac.platform.base_model import Base


@pytest.fixture(scope="function")
async def async_session():
    """Create an async database session for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        yield session

    await engine.dispose()


@pytest.fixture
def test_tenant_id() -> str:
    """Test tenant identifier."""
    return "test-tenant-oss"


@pytest.fixture
def test_user_id():
    """Test user ID for audit trails."""
    return uuid4()


@pytest.fixture
def test_customer_id():
    """Test customer ID."""
    return uuid4()


@pytest.fixture
def test_subscription_id() -> str:
    """Test subscription ID."""
    return "sub_oss_test_001"


# ============================================================================
# RADIUS Test Fixtures
# ============================================================================


@pytest.fixture
def sample_radius_subscriber_data():
    """Sample RADIUS subscriber creation data."""
    return {
        "subscriber_id": "sub_radius_001",
        "username": "testuser@isp.com",
        "password": "SecurePassword123!",
        "framed_ip_address": "10.0.1.100",
        "session_timeout": 3600,
        "idle_timeout": 600,
    }


@pytest.fixture
def sample_bandwidth_profile():
    """Sample bandwidth profile for RADIUS."""
    return {
        "name": "100 Mbps Fiber",
        "download_rate_kbps": 100000,
        "upload_rate_kbps": 50000,
        "download_burst_kbps": 120000,
        "upload_burst_kbps": 60000,
    }


@pytest.fixture
def sample_nas_server():
    """Sample NAS (Network Access Server) configuration."""
    return {
        "nas_name": "bras-01.isp.com",
        "short_name": "bras01",
        "nas_type": "cisco",
        "ports": 1812,
        "secret": "RadiusSecret123!",
        "server_ip": "192.168.1.1",
        "community": "public",
        "description": "Primary BRAS server",
    }


@pytest.fixture
def sample_radius_session():
    """Sample active RADIUS session data."""
    now = datetime.now(UTC)
    return {
        "session_id": f"sess_{uuid4().hex[:16]}",
        "username": "testuser@isp.com",
        "nas_ip_address": "192.168.1.1",
        "nas_port_id": "eth0/1",
        "framed_ip_address": "10.0.1.100",
        "calling_station_id": "00:11:22:33:44:55",
        "acct_session_time": 1800,  # 30 minutes
        "acct_input_octets": 1024 * 1024 * 500,  # 500 MB downloaded
        "acct_output_octets": 1024 * 1024 * 100,  # 100 MB uploaded
        "acct_start_time": now - timedelta(minutes=30),
        "last_update": now,
    }


# ============================================================================
# NetBox/IPAM Test Fixtures
# ============================================================================


@pytest.fixture
def sample_ip_allocation():
    """Sample IP address allocation from IPAM."""
    return {
        "address": "10.0.1.100/32",
        "vrf": None,
        "tenant": "test-tenant-oss",
        "status": "active",
        "role": "customer",
        "dns_name": "cust001.isp.com",
        "description": "Customer fiber connection",
        "tags": ["fiber", "residential"],
    }


@pytest.fixture
def sample_vlan_assignment():
    """Sample VLAN assignment."""
    return {
        "vid": 100,
        "name": "VLAN100-Customers",
        "tenant": "test-tenant-oss",
        "status": "active",
        "role": "customer-access",
        "description": "Customer VLAN for fiber subscribers",
    }


@pytest.fixture
def sample_prefix_allocation():
    """Sample prefix allocation for customer."""
    return {
        "prefix": "10.0.0.0/24",
        "vrf": None,
        "tenant": "test-tenant-oss",
        "status": "active",
        "is_pool": True,
        "description": "Customer pool for fiber services",
        "tags": ["fiber", "ipv4"],
    }


@pytest.fixture
def sample_device_interface():
    """Sample network device interface."""
    return {
        "device": "olt-01",
        "name": "eth1/1/1",
        "type": "1000base-x-sfp",
        "enabled": True,
        "mtu": 1500,
        "mac_address": "00:11:22:33:44:55",
        "description": "ONT connection - Customer 001",
        "mode": "access",
        "untagged_vlan": 100,
    }


# ============================================================================
# GenieACS/TR-069 Test Fixtures
# ============================================================================


@pytest.fixture
def sample_cpe_device():
    """Sample CPE (Customer Premises Equipment) device."""
    return {
        "device_id": "ABCD-1234-5678-9012",
        "serial_number": "SN123456789",
        "oui": "ABCDEF",
        "product_class": "Fiber ONT",
        "manufacturer": "Huawei",
        "model": "EG8145V5",
        "software_version": "V5R019C10S115",
        "hardware_version": "V5.0",
        "last_inform": datetime.now(UTC).isoformat(),
        "connection_request_url": "http://10.0.1.100:7547",
    }


@pytest.fixture
def sample_tr069_parameters():
    """Sample TR-069 parameters for CPE configuration."""
    return {
        "InternetGatewayDevice.ManagementServer.ConnectionRequestUsername": "admin",
        "InternetGatewayDevice.ManagementServer.ConnectionRequestPassword": "admin123",
        "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable": True,
        "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": "testuser@isp.com",
        "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password": "password123",
        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "ISP-Customer-WiFi",
        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey": "WiFiPassword123",
    }


@pytest.fixture
def sample_tr069_task():
    """Sample TR-069 task for CPE management."""
    return {
        "name": "provision_wifi",
        "device_id": "ABCD-1234-5678-9012",
        "task_type": "setParameterValues",
        "parameters": {
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "Customer-WiFi-001",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": True,
        },
        "status": "pending",
    }


@pytest.fixture
def sample_firmware_upgrade():
    """Sample firmware upgrade task."""
    return {
        "device_id": "ABCD-1234-5678-9012",
        "firmware_version": "V5R019C10S120",
        "download_url": "http://firmware.isp.com/ont/HG8145V5_V5R019C10S120.bin",
        "file_type": "3 Vendor Configuration File",
        "target_filename": "firmware.bin",
        "schedule_time": (datetime.now(UTC) + timedelta(hours=2)).isoformat(),
    }


# ============================================================================
# Service Lifecycle Test Fixtures
# ============================================================================


@pytest.fixture
def sample_service_provisioning_request():
    """Sample service provisioning request for lifecycle testing."""
    return {
        "customer_id": uuid4(),
        "service_name": "100 Mbps Fiber Internet",
        "service_type": "fiber_internet",
        "subscription_id": "sub_lifecycle_001",
        "service_config": {
            "bandwidth_profile": "100mbps",
            "static_ip": False,
            "managed_wifi": True,
        },
        "installation_address": "123 Main St, City, State 12345",
        "installation_scheduled_date": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
        "equipment_assigned": ["ONT-HG8145V5", "Router-AX3000"],
        "vlan_id": 100,
    }


@pytest.fixture
def sample_provisioning_workflow():
    """Sample multi-step provisioning workflow."""
    return {
        "workflow_id": f"WF-{uuid4().hex[:12].upper()}",
        "service_instance_id": uuid4(),
        "steps": [
            {
                "step": 1,
                "name": "validate_config",
                "status": "pending",
                "description": "Validate service configuration",
            },
            {
                "step": 2,
                "name": "allocate_resources",
                "status": "pending",
                "description": "Allocate IP, VLAN, bandwidth",
            },
            {
                "step": 3,
                "name": "configure_radius",
                "status": "pending",
                "description": "Create RADIUS subscriber",
            },
            {
                "step": 4,
                "name": "provision_cpe",
                "status": "pending",
                "description": "Configure ONT via TR-069",
            },
            {
                "step": 5,
                "name": "test_connectivity",
                "status": "pending",
                "description": "Verify service connectivity",
            },
            {
                "step": 6,
                "name": "activate_service",
                "status": "pending",
                "description": "Activate service for customer",
            },
        ],
    }


# ============================================================================
# Mock Helpers
# ============================================================================


class MockRADIUSServer:
    """Mock RADIUS server for testing."""

    def __init__(self):
        self.subscribers = {}
        self.sessions = {}
        self.accounting_data = []

    def authenticate(self, username: str, password: str) -> bool:
        """Mock RADIUS authentication."""
        subscriber = self.subscribers.get(username)
        if not subscriber:
            return False
        return subscriber["password"] == password

    def start_session(self, username: str, session_data: dict[str, Any]) -> str:
        """Start a new RADIUS session."""
        session_id = f"sess_{uuid4().hex[:16]}"
        self.sessions[session_id] = {
            **session_data,
            "username": username,
            "start_time": datetime.now(UTC),
        }
        return session_id

    def record_accounting(self, session_id: str, acct_data: dict[str, Any]) -> None:
        """Record accounting data."""
        self.accounting_data.append(
            {"session_id": session_id, "timestamp": datetime.now(UTC), "data": acct_data}
        )


class MockNetBoxClient:
    """Mock NetBox API client for testing."""

    def __init__(self):
        self.prefixes = {}
        self.ip_addresses = {}
        self.vlans = {}
        self.devices = {}

    def allocate_ip(self, prefix: str, tenant: str) -> dict[str, Any]:
        """Allocate IP from prefix pool."""
        # Simplified IP allocation
        ip_id = len(self.ip_addresses) + 1
        ip_address = f"10.0.{ip_id // 256}.{ip_id % 256}"
        ip_data = {
            "id": ip_id,
            "address": f"{ip_address}/32",
            "tenant": tenant,
            "status": "active",
        }
        self.ip_addresses[ip_id] = ip_data
        return ip_data

    def assign_vlan(self, vid: int, tenant: str) -> dict[str, Any]:
        """Assign VLAN to tenant."""
        vlan_data = {"id": vid, "vid": vid, "tenant": tenant, "status": "active"}
        self.vlans[vid] = vlan_data
        return vlan_data


class MockGenieACSClient:
    """Mock GenieACS API client for testing."""

    def __init__(self):
        self.devices = {}
        self.tasks = []
        self.parameters = {}

    def get_device(self, device_id: str) -> dict[str, Any] | None:
        """Get device by ID."""
        return self.devices.get(device_id)

    def set_parameters(self, device_id: str, parameters: dict[str, Any]) -> str:
        """Set device parameters via TR-069."""
        task_id = f"task_{uuid4().hex[:8]}"
        self.tasks.append(
            {
                "id": task_id,
                "device_id": device_id,
                "type": "setParameterValues",
                "parameters": parameters,
                "status": "pending",
            }
        )
        return task_id

    def trigger_firmware_upgrade(self, device_id: str, firmware_url: str) -> str:
        """Trigger firmware upgrade."""
        task_id = f"task_{uuid4().hex[:8]}"
        self.tasks.append(
            {
                "id": task_id,
                "device_id": device_id,
                "type": "download",
                "url": firmware_url,
                "status": "pending",
            }
        )
        return task_id


@pytest.fixture
def mock_radius_server():
    """Provide mock RADIUS server."""
    return MockRADIUSServer()


@pytest.fixture
def mock_netbox_client():
    """Provide mock NetBox client."""
    return MockNetBoxClient()


@pytest.fixture
def mock_genieacs_client():
    """Provide mock GenieACS client."""
    return MockGenieACSClient()
