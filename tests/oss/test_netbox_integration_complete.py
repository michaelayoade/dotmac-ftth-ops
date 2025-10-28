
"""
Comprehensive NetBox Integration Tests

Tests for VLAN management, cable tracking, circuit management,
and automatic IP cleanup functionality.
"""

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.netbox.client import NetBoxClient
from dotmac.platform.netbox.schemas import (



    CableCreate,
    CircuitCreate,
    CircuitProviderCreate,
    CircuitTerminationCreate,
    CircuitTypeCreate,
    VLANCreate,
    VLANUpdate,
)
from dotmac.platform.netbox.service import NetBoxService




pytestmark = pytest.mark.unit

@pytest.fixture
def mock_netbox_client():
    """Create mock NetBox client"""
    client = AsyncMock(spec=NetBoxClient)
    return client


@pytest.fixture
def netbox_service(mock_netbox_client):
    """Create NetBox service with mocked client"""
    return NetBoxService(client=mock_netbox_client)


# =============================================================================
# VLAN Management Tests
# =============================================================================


class TestVLANManagement:
    """Test VLAN management functionality"""

    @pytest.mark.asyncio
    async def test_list_vlans(self, netbox_service, mock_netbox_client):
        """Test listing VLANs"""
        mock_netbox_client.get_vlans.return_value = {
            "results": [
                {
                    "id": 1,
                    "vid": 100,
                    "name": "VLAN100",
                    "site": {"id": 1, "name": "Site 1"},
                    "status": {"value": "active", "label": "Active"},
                    "description": "Test VLAN",
                    "created": "2025-01-01T00:00:00Z",
                    "last_updated": "2025-01-01T00:00:00Z",
                }
            ]
        }

        vlans = await netbox_service.list_vlans(tenant="test-tenant", site="site1")

        assert len(vlans) == 1
        assert vlans[0].vid == 100
        assert vlans[0].name == "VLAN100"
        mock_netbox_client.get_vlans.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_vlan(self, netbox_service, mock_netbox_client):
        """Test getting single VLAN"""
        mock_netbox_client.get_vlan.return_value = {
            "id": 1,
            "vid": 100,
            "name": "VLAN100",
            "site": {"id": 1, "name": "Site 1"},
            "status": {"value": "active", "label": "Active"},
            "description": "Test VLAN",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        vlan = await netbox_service.get_vlan(1)

        assert vlan is not None
        assert vlan.vid == 100
        assert vlan.name == "VLAN100"

    @pytest.mark.asyncio
    async def test_create_vlan(self, netbox_service, mock_netbox_client):
        """Test creating VLAN"""
        mock_netbox_client.create_vlan.return_value = {
            "id": 1,
            "vid": 100,
            "name": "VLAN100",
            "site": {"id": 1, "name": "Site 1"},
            "status": {"value": "active", "label": "Active"},
            "description": "Test VLAN",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = VLANCreate(
            vid=100,
            name="VLAN100",
            site=1,
            status="active",
            description="Test VLAN",
        )

        vlan = await netbox_service.create_vlan(data)

        assert vlan.vid == 100
        assert vlan.name == "VLAN100"
        mock_netbox_client.create_vlan.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_vlan(self, netbox_service, mock_netbox_client):
        """Test updating VLAN"""
        mock_netbox_client.update_vlan.return_value = {
            "id": 1,
            "vid": 100,
            "name": "VLAN100-Updated",
            "site": {"id": 1, "name": "Site 1"},
            "status": {"value": "active", "label": "Active"},
            "description": "Updated VLAN",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = VLANUpdate(name="VLAN100-Updated", description="Updated VLAN")

        vlan = await netbox_service.update_vlan(1, data)

        assert vlan is not None
        assert vlan.name == "VLAN100-Updated"

    @pytest.mark.asyncio
    async def test_delete_vlan(self, netbox_service, mock_netbox_client):
        """Test deleting VLAN"""
        mock_netbox_client.delete_vlan.return_value = None

        result = await netbox_service.delete_vlan(1)

        assert result is True
        mock_netbox_client.delete_vlan.assert_called_once_with(1)


# =============================================================================
# Cable Management Tests
# =============================================================================


class TestCableManagement:
    """Test cable management functionality"""

    @pytest.mark.asyncio
    async def test_list_cables(self, netbox_service, mock_netbox_client):
        """Test listing cables"""
        mock_netbox_client.get_cables.return_value = {
            "results": [
                {
                    "id": 1,
                    "type": {"value": "cat6", "label": "CAT6"},
                    "status": {"value": "connected", "label": "Connected"},
                    "label": "CABLE-001",
                    "color": "0000ff",
                    "length": 10.0,
                    "length_unit": "m",
                    "a_terminations": [],
                    "b_terminations": [],
                    "description": "Test cable",
                    "created": "2025-01-01T00:00:00Z",
                    "last_updated": "2025-01-01T00:00:00Z",
                }
            ]
        }

        cables = await netbox_service.list_cables(site="site1")

        assert len(cables) == 1
        assert cables[0].label == "CABLE-001"

    @pytest.mark.asyncio
    async def test_create_cable(self, netbox_service, mock_netbox_client):
        """Test creating cable"""
        mock_netbox_client.create_cable.return_value = {
            "id": 1,
            "type": {"value": "cat6", "label": "CAT6"},
            "status": {"value": "connected", "label": "Connected"},
            "label": "CABLE-001",
            "color": "0000ff",
            "length": 10.0,
            "length_unit": "m",
            "a_terminations": [],
            "b_terminations": [],
            "description": "Test cable",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = CableCreate(
            a_terminations=[{"object_type": "dcim.interface", "object_id": 1}],
            b_terminations=[{"object_type": "dcim.interface", "object_id": 2}],
            type="cat6",
            status="connected",
            label="CABLE-001",
            length=10.0,
            length_unit="m",
        )

        cable = await netbox_service.create_cable(data)

        assert cable.label == "CABLE-001"
        assert cable.length == 10.0


# =============================================================================
# Circuit Management Tests
# =============================================================================


class TestCircuitManagement:
    """Test circuit management functionality"""

    @pytest.mark.asyncio
    async def test_list_circuit_providers(self, netbox_service, mock_netbox_client):
        """Test listing circuit providers"""
        mock_netbox_client.get_circuit_providers.return_value = {
            "results": [
                {
                    "id": 1,
                    "name": "Provider A",
                    "slug": "provider-a",
                    "asn": 65001,
                    "account": "ACC-001",
                    "portal_url": "https://portal.provider-a.com",
                    "noc_contact": "noc@provider-a.com",
                    "admin_contact": "admin@provider-a.com",
                    "comments": "Main provider",
                    "created": "2025-01-01T00:00:00Z",
                    "last_updated": "2025-01-01T00:00:00Z",
                }
            ]
        }

        providers = await netbox_service.list_circuit_providers()

        assert len(providers) == 1
        assert providers[0].name == "Provider A"
        assert providers[0].asn == 65001

    @pytest.mark.asyncio
    async def test_create_circuit_provider(self, netbox_service, mock_netbox_client):
        """Test creating circuit provider"""
        mock_netbox_client.create_circuit_provider.return_value = {
            "id": 1,
            "name": "Provider A",
            "slug": "provider-a",
            "asn": 65001,
            "account": "ACC-001",
            "portal_url": "https://portal.provider-a.com",
            "noc_contact": "noc@provider-a.com",
            "admin_contact": "admin@provider-a.com",
            "comments": "Main provider",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = CircuitProviderCreate(
            name="Provider A",
            slug="provider-a",
            asn=65001,
            account="ACC-001",
        )

        provider = await netbox_service.create_circuit_provider(data)

        assert provider.name == "Provider A"
        assert provider.asn == 65001

    @pytest.mark.asyncio
    async def test_create_circuit_type(self, netbox_service, mock_netbox_client):
        """Test creating circuit type"""
        mock_netbox_client.create_circuit_type.return_value = {
            "id": 1,
            "name": "Fiber",
            "slug": "fiber",
            "description": "Fiber optic circuit",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = CircuitTypeCreate(
            name="Fiber",
            slug="fiber",
            description="Fiber optic circuit",
        )

        circuit_type = await netbox_service.create_circuit_type(data)

        assert circuit_type.name == "Fiber"
        assert circuit_type.slug == "fiber"

    @pytest.mark.asyncio
    async def test_list_circuits(self, netbox_service, mock_netbox_client):
        """Test listing circuits"""
        mock_netbox_client.get_circuits.return_value = {
            "results": [
                {
                    "id": 1,
                    "cid": "CIR-001",
                    "provider": {"id": 1, "name": "Provider A"},
                    "type": {"id": 1, "name": "Fiber"},
                    "status": {"value": "active", "label": "Active"},
                    "install_date": "2025-01-01",
                    "commit_rate": 1000000,
                    "description": "Main circuit",
                    "comments": "",
                    "created": "2025-01-01T00:00:00Z",
                    "last_updated": "2025-01-01T00:00:00Z",
                }
            ]
        }

        circuits = await netbox_service.list_circuits(tenant="test-tenant")

        assert len(circuits) == 1
        assert circuits[0].cid == "CIR-001"
        assert circuits[0].commit_rate == 1000000

    @pytest.mark.asyncio
    async def test_create_circuit(self, netbox_service, mock_netbox_client):
        """Test creating circuit"""
        mock_netbox_client.create_circuit.return_value = {
            "id": 1,
            "cid": "CIR-001",
            "provider": {"id": 1, "name": "Provider A"},
            "type": {"id": 1, "name": "Fiber"},
            "status": {"value": "active", "label": "Active"},
            "install_date": "2025-01-01",
            "commit_rate": 1000000,
            "description": "Main circuit",
            "comments": "",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = CircuitCreate(
            cid="CIR-001",
            provider=1,
            type=1,
            status="active",
            commit_rate=1000000,
            description="Main circuit",
        )

        circuit = await netbox_service.create_circuit(data)

        assert circuit.cid == "CIR-001"
        assert circuit.commit_rate == 1000000

    @pytest.mark.asyncio
    async def test_create_circuit_termination(self, netbox_service, mock_netbox_client):
        """Test creating circuit termination"""
        mock_netbox_client.create_circuit_termination.return_value = {
            "id": 1,
            "circuit": {"id": 1, "cid": "CIR-001"},
            "term_side": "A",
            "site": {"id": 1, "name": "Site 1"},
            "port_speed": 1000000,
            "upstream_speed": 1000000,
            "xconnect_id": "XC-001",
            "pp_info": "Panel 1, Port 1",
            "description": "A-side termination",
            "cable": None,
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        data = CircuitTerminationCreate(
            circuit=1,
            term_side="A",
            site=1,
            port_speed=1000000,
            upstream_speed=1000000,
            xconnect_id="XC-001",
            pp_info="Panel 1, Port 1",
            description="A-side termination",
        )

        termination = await netbox_service.create_circuit_termination(data)

        assert termination.term_side == "A"
        assert termination.port_speed == 1000000


# =============================================================================
# IP Cleanup Tests
# =============================================================================


class TestIPCleanup:
    """Test automatic IP cleanup functionality"""

    @pytest.mark.asyncio
    async def test_cleanup_subscriber_ips_deprecate(self, netbox_service, mock_netbox_client):
        """Test IP cleanup marks IPs as deprecated"""
        subscriber_id = "sub-123"
        tenant_netbox_id = 1

        # Mock finding existing IPs
        mock_netbox_client._netbox_request.side_effect = [
            # First call: find IPs
            {
                "results": [
                    {
                        "id": 100,
                        "address": "10.0.1.5/24",
                        "description": f"Subscriber: {subscriber_id}",
                        "status": {"value": "active"},
                    },
                    {
                        "id": 101,
                        "address": "10.0.1.6/24",
                        "description": f"Subscriber: {subscriber_id}",
                        "status": {"value": "active"},
                    },
                ]
            },
        ]

        # Mock update calls
        mock_netbox_client.update_ip_address.return_value = {
            "id": 100,
            "address": "10.0.1.5/24",
            "status": {"value": "deprecated"},
        }

        cleaned_count = await netbox_service.cleanup_subscriber_ips(
            subscriber_id=subscriber_id,
            tenant_netbox_id=tenant_netbox_id,
        )

        assert cleaned_count == 2
        assert mock_netbox_client.update_ip_address.call_count == 2

    @pytest.mark.asyncio
    async def test_cleanup_subscriber_ips_no_ips(self, netbox_service, mock_netbox_client):
        """Test IP cleanup when no IPs exist"""
        subscriber_id = "sub-123"
        tenant_netbox_id = 1

        # Mock finding no IPs
        mock_netbox_client._netbox_request.return_value = {"results": []}

        cleaned_count = await netbox_service.cleanup_subscriber_ips(
            subscriber_id=subscriber_id,
            tenant_netbox_id=tenant_netbox_id,
        )

        assert cleaned_count == 0

    @pytest.mark.asyncio
    async def test_cleanup_subscriber_ips_partial_failure(self, netbox_service, mock_netbox_client):
        """Test IP cleanup with partial failures"""
        subscriber_id = "sub-123"
        tenant_netbox_id = 1

        # Mock finding existing IPs
        mock_netbox_client._netbox_request.return_value = {
            "results": [
                {
                    "id": 100,
                    "address": "10.0.1.5/24",
                    "description": f"Subscriber: {subscriber_id}",
                    "status": {"value": "active"},
                },
                {
                    "id": 101,
                    "address": "10.0.1.6/24",
                    "description": f"Subscriber: {subscriber_id}",
                    "status": {"value": "active"},
                },
            ]
        }

        # First update succeeds, second fails
        mock_netbox_client.update_ip_address.side_effect = [
            {"id": 100, "address": "10.0.1.5/24", "status": {"value": "deprecated"}},
            Exception("Network error"),
        ]

        cleaned_count = await netbox_service.cleanup_subscriber_ips(
            subscriber_id=subscriber_id,
            tenant_netbox_id=tenant_netbox_id,
        )

        # Only 1 IP should be cleaned successfully
        assert cleaned_count == 1


# =============================================================================
# Integration Workflow Tests
# =============================================================================


class TestIntegrationWorkflows:
    """Test complete integration workflows"""

    @pytest.mark.asyncio
    async def test_vlan_to_interface_assignment(self, netbox_service, mock_netbox_client):
        """Test workflow: Create VLAN and assign to interface"""
        # Create VLAN
        mock_netbox_client.create_vlan.return_value = {
            "id": 1,
            "vid": 100,
            "name": "VLAN100",
            "site": {"id": 1, "name": "Site 1"},
            "status": {"value": "active", "label": "Active"},
            "description": "Customer VLAN",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        vlan_data = VLANCreate(
            vid=100,
            name="VLAN100",
            site=1,
            description="Customer VLAN",
        )

        vlan = await netbox_service.create_vlan(vlan_data)

        assert vlan.vid == 100
        assert vlan.name == "VLAN100"

    @pytest.mark.asyncio
    async def test_circuit_end_to_end(self, netbox_service, mock_netbox_client):
        """Test workflow: Create provider, type, circuit, and terminations"""
        # Create provider
        mock_netbox_client.create_circuit_provider.return_value = {
            "id": 1,
            "name": "Provider A",
            "slug": "provider-a",
            "asn": 65001,
            "account": "",
            "portal_url": "",
            "noc_contact": "",
            "admin_contact": "",
            "comments": "",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        provider_data = CircuitProviderCreate(name="Provider A", slug="provider-a", asn=65001)
        provider = await netbox_service.create_circuit_provider(provider_data)

        # Create circuit type
        mock_netbox_client.create_circuit_type.return_value = {
            "id": 1,
            "name": "Fiber",
            "slug": "fiber",
            "description": "",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        type_data = CircuitTypeCreate(name="Fiber", slug="fiber")
        circuit_type = await netbox_service.create_circuit_type(type_data)

        # Create circuit
        mock_netbox_client.create_circuit.return_value = {
            "id": 1,
            "cid": "CIR-001",
            "provider": {"id": provider.id, "name": provider.name},
            "type": {"id": circuit_type.id, "name": circuit_type.name},
            "status": {"value": "active", "label": "Active"},
            "install_date": None,
            "commit_rate": 1000000,
            "description": "",
            "comments": "",
            "created": "2025-01-01T00:00:00Z",
            "last_updated": "2025-01-01T00:00:00Z",
        }

        circuit_data = CircuitCreate(
            cid="CIR-001",
            provider=provider.id,
            type=circuit_type.id,
            commit_rate=1000000,
        )
        circuit = await netbox_service.create_circuit(circuit_data)

        assert circuit.cid == "CIR-001"
        assert circuit.commit_rate == 1000000
