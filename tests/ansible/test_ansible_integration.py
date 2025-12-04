"""
Comprehensive tests for Ansible automation integration.

Tests playbook library, lifecycle integration, router management,
and device provisioning.
"""

from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.device_provisioning import (
    DeviceProvisioningService,
    DeviceType,
    ProvisioningStatus,
)
from dotmac.platform.ansible.lifecycle_integration import AnsibleLifecycleIntegration
from dotmac.platform.ansible.playbook_library import PlaybookLibrary, PlaybookType
from dotmac.platform.ansible.router_management import RouterManagementService
from dotmac.platform.services.lifecycle.models import (
    ServiceInstance,
    ServiceStatus,
    ServiceType,
)

pytestmark = pytest.mark.integration


class TestPlaybookLibrary:
    """Test Playbook Library functionality"""

    def test_get_playbook_path(self):
        """Test retrieving playbook paths"""
        path = PlaybookLibrary.get_playbook_path(PlaybookType.FIBER_PROVISION)
        assert path == "playbooks/provisioning/fiber_service_provision.yml"

        path = PlaybookLibrary.get_playbook_path(PlaybookType.ROUTER_CONFIG)
        assert path == "playbooks/router_config/configure_router.yml"

    def test_build_fiber_provision_vars(self):
        """Test building fiber provisioning variables"""
        vars_dict = PlaybookLibrary.build_fiber_provision_vars(
            service_instance_id="svc-123",
            customer_id="cust-456",
            ont_serial="HWTC12345678",
            vlan_id=100,
            download_speed_mbps=1000,
            upload_speed_mbps=500,
            target_olt="olt-1",
            callback_url="https://api.example.com",
            api_token="token123",
        )

        assert vars_dict["service_instance_id"] == "svc-123"
        assert vars_dict["customer_id"] == "cust-456"
        assert vars_dict["ont_serial_number"] == "HWTC12345678"
        assert vars_dict["service_vlan"] == 100
        assert vars_dict["download_speed_kbps"] == 1000000
        assert vars_dict["upload_speed_kbps"] == 500000
        assert vars_dict["bandwidth_profile_name"] == "BP_1000M_500M"
        assert vars_dict["target_olt"] == "olt-1"
        assert vars_dict["callback_url"] == "https://api.example.com"

    def test_build_router_config_vars(self):
        """Test building router configuration variables"""
        vars_dict = PlaybookLibrary.build_router_config_vars(
            router_id="router-001",
            customer_id="cust-456",
            service_id="svc-123",
            wan_ip="203.0.113.10",
            wan_netmask="255.255.255.0",
            wan_gateway="203.0.113.1",
            lan_ip="192.168.1.1",
            lan_netmask="255.255.255.0",
            lan_network="192.168.1.0",
            vlan_id=100,
            wifi_ssid="MyFiber",
            wifi_password="SecurePass123",
            dns_servers=["8.8.8.8", "8.8.4.4"],
        )

        assert vars_dict["router_device_id"] == "router-001"
        assert vars_dict["customer_id"] == "cust-456"
        assert vars_dict["service_id"] == "svc-123"
        assert vars_dict["assigned_wan_ip"] == "203.0.113.10"
        assert vars_dict["isp_gateway_ip"] == "203.0.113.1"
        assert vars_dict["service_vlan"] == 100
        assert vars_dict["enable_wifi"] is True
        assert vars_dict["wifi_network_name"] == "MyFiber"
        assert vars_dict["lan_wildcard"] == "0.0.0.255"
        assert vars_dict["dns_server_list"] == ["8.8.8.8", "8.8.4.4"]

    def test_build_ont_provision_vars(self):
        """Test building ONT provisioning variables"""
        vars_dict = PlaybookLibrary.build_ont_provision_vars(
            ont_serial="HWTC12345678",
            customer_id="cust-456",
            target_olt="olt-1",
            service_profile="premium",
            auto_discover=True,
        )

        assert vars_dict["ont_serial_number"] == "HWTC12345678"
        assert vars_dict["customer_id"] == "cust-456"
        assert vars_dict["target_olt"] == "olt-1"
        assert vars_dict["service_profile_name"] == "premium"
        assert vars_dict["enable_auto_discovery"] is True

    def test_calculate_wildcard(self):
        """Test wildcard mask calculation"""
        wildcard = PlaybookLibrary._calculate_wildcard("255.255.255.0")
        assert wildcard == "0.0.0.255"

        wildcard = PlaybookLibrary._calculate_wildcard("255.255.0.0")
        assert wildcard == "0.0.255.255"


@pytest.mark.asyncio
class TestLifecycleIntegration:
    """Test Ansible-Lifecycle Integration"""

    @pytest.fixture
    def mock_awx_client(self):
        """Create mock AWX client"""
        client = AsyncMock(spec=AWXClient)
        client.launch_job_template = AsyncMock(
            return_value={
                "id": 123,
                "status": "pending",
                "name": "Test Job",
            }
        )
        return client

    @pytest_asyncio.fixture(autouse=True)
    async def _clean_service_instances(self, async_session: AsyncSession):
        await async_session.execute(delete(ServiceInstance))
        await async_session.commit()
        yield
        try:
            await async_session.execute(delete(ServiceInstance))
            await async_session.commit()
        except Exception:
            await async_session.rollback()

    @pytest_asyncio.fixture
    async def service_instance(self, async_session):
        """Create test service instance"""
        service = ServiceInstance(
            id=uuid4(),
            tenant_id="test-tenant",
            service_identifier="SVC-TEST-001",
            service_name="Test Fiber Service",
            service_type=ServiceType.FIBER_INTERNET,
            customer_id=uuid4(),
            status=ServiceStatus.PROVISIONING,
            service_config={
                "download_speed_mbps": 1000,
                "upload_speed_mbps": 500,
            },
            vlan_id=100,
            service_metadata={},
        )

        async_session.add(service)
        await async_session.commit()
        await async_session.refresh(service)

        return service

    async def test_provision_fiber_service(self, async_session, mock_awx_client, service_instance):
        """Test fiber service provisioning via Ansible"""
        integration = AnsibleLifecycleIntegration(
            session=async_session,
            awx_client=mock_awx_client,
            job_template_id=1,
            callback_base_url="https://api.example.com",
            api_token="token123",
        )

        result = await integration.provision_fiber_service(
            service_instance=service_instance,
            ont_serial="HWTC12345678",
            target_olt="olt-1",
        )

        assert result["success"] is True
        assert result["awx_job_id"] == 123
        assert "Fiber provisioning playbook launched" in result["message"]

        # Verify AWX client was called
        mock_awx_client.launch_job_template.assert_called_once()
        call_args = mock_awx_client.launch_job_template.call_args
        assert call_args[0][0] == 1  # template_id
        extra_vars = call_args[0][1]
        assert extra_vars["ont_serial_number"] == "HWTC12345678"
        assert extra_vars["service_vlan"] == 100

    async def test_configure_router(self, async_session, mock_awx_client, service_instance):
        """Test router configuration via Ansible"""
        integration = AnsibleLifecycleIntegration(
            session=async_session,
            awx_client=mock_awx_client,
            job_template_id=1,
            callback_base_url="https://api.example.com",
            api_token="token123",
        )

        router_config = {
            "wan_ip": "203.0.113.10",
            "wan_gateway": "203.0.113.1",
            "wifi_ssid": "TestFiber",
            "wifi_password": "SecurePass",
        }

        result = await integration.configure_router(
            service_instance=service_instance,
            router_id="router-001",
            router_config=router_config,
        )

        assert result["success"] is True
        assert result["awx_job_id"] == 123
        assert "Router configuration playbook launched" in result["message"]

    async def test_provision_ont_device(self, async_session, mock_awx_client, service_instance):
        """Test ONT device provisioning via Ansible"""
        integration = AnsibleLifecycleIntegration(
            session=async_session,
            awx_client=mock_awx_client,
            job_template_id=1,
            callback_base_url="https://api.example.com",
            api_token="token123",
        )

        result = await integration.provision_ont_device(
            service_instance=service_instance,
            ont_serial="HWTC12345678",
            target_olt="olt-1",
            service_profile="premium",
        )

        assert result["success"] is True
        assert result["awx_job_id"] == 123
        assert "ONT provisioning playbook launched" in result["message"]


@pytest.mark.asyncio
class TestRouterManagement:
    """Test Router Management Service"""

    @pytest.fixture
    def mock_awx_client(self):
        """Create mock AWX client"""
        client = AsyncMock(spec=AWXClient)
        client.launch_job_template = AsyncMock(return_value={"id": 456, "status": "pending"})
        return client

    async def test_configure_router(self, mock_awx_client):
        """Test router configuration"""
        service = RouterManagementService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        wan_config = {
            "ip": "203.0.113.10",
            "gateway": "203.0.113.1",
            "vlan_id": 100,
        }

        wifi_config = {
            "ssid": "MyFiber",
            "password": "SecurePass123",
        }

        result = await service.configure_router(
            router_id="router-001",
            customer_id="cust-456",
            service_id="svc-123",
            wan_config=wan_config,
            wifi_config=wifi_config,
        )

        assert result["success"] is True
        assert result["router_id"] == "router-001"
        assert result["awx_job_id"] == 456

    async def test_update_bandwidth(self, mock_awx_client):
        """Test bandwidth update"""
        service = RouterManagementService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.update_bandwidth(
            router_id="router-001",
            new_download_mbps=2000,
            new_upload_mbps=1000,
        )

        assert result["success"] is True
        assert result["router_id"] == "router-001"
        assert "Bandwidth update initiated" in result["message"]

    async def test_change_vlan(self, mock_awx_client):
        """Test VLAN change"""
        service = RouterManagementService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.change_vlan(
            router_id="router-001",
            old_vlan_id=100,
            new_vlan_id=200,
        )

        assert result["success"] is True
        assert result["router_id"] == "router-001"
        assert "VLAN change initiated" in result["message"]

    async def test_reboot_router(self, mock_awx_client):
        """Test router reboot"""
        service = RouterManagementService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.reboot_router(router_id="router-001")

        assert result["success"] is True
        assert result["router_id"] == "router-001"
        assert "Router reboot initiated" in result["message"]


@pytest.mark.asyncio
class TestDeviceProvisioning:
    """Test Device Provisioning Service"""

    @pytest.fixture
    def mock_awx_client(self):
        """Create mock AWX client"""
        client = AsyncMock(spec=AWXClient)
        client.launch_job_template = AsyncMock(return_value={"id": 789, "status": "pending"})
        return client

    async def test_provision_ont(self, mock_awx_client):
        """Test ONT provisioning"""
        service = DeviceProvisioningService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.provision_ont(
            ont_serial="HWTC12345678",
            customer_id="cust-456",
            target_olt="olt-1",
            service_profile="premium",
        )

        assert result["success"] is True
        assert result["device_type"] == DeviceType.ONT.value
        assert result["device_serial"] == "HWTC12345678"
        assert result["status"] == ProvisioningStatus.PROVISIONING.value
        assert result["awx_job_id"] == 789

    async def test_auto_discover_devices(self, mock_awx_client):
        """Test auto-discovery"""
        service = DeviceProvisioningService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.auto_discover_devices(
            target_olt="olt-1",
            device_type=DeviceType.ONT,
        )

        assert result["success"] is True
        assert result["device_type"] == DeviceType.ONT.value
        assert result["status"] == ProvisioningStatus.DISCOVERING.value
        assert result["awx_job_id"] == 789

    async def test_provision_bulk_onts(self, mock_awx_client):
        """Test bulk ONT provisioning"""
        service = DeviceProvisioningService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        ont_list = [
            {"serial": "HWTC12345678", "customer_id": "cust-1"},
            {"serial": "HWTC87654321", "customer_id": "cust-2"},
            {"serial": "HWTC11112222", "customer_id": "cust-3"},
        ]

        result = await service.provision_bulk_onts(
            ont_list=ont_list,
            target_olt="olt-1",
        )

        assert result["success"] is True
        assert result["device_count"] == 3
        assert result["status"] == ProvisioningStatus.PROVISIONING.value
        assert "3 ONTs" in result["message"]

    async def test_deprovision_ont(self, mock_awx_client):
        """Test ONT deprovisioning"""
        service = DeviceProvisioningService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.deprovision_ont(
            ont_serial="HWTC12345678",
            target_olt="olt-1",
            release_resources=True,
        )

        assert result["success"] is True
        assert result["device_type"] == DeviceType.ONT.value
        assert result["device_serial"] == "HWTC12345678"
        assert result["status"] == "deprovisioning"

    async def test_firmware_upgrade(self, mock_awx_client):
        """Test firmware upgrade"""
        service = DeviceProvisioningService(
            awx_client=mock_awx_client,
            job_template_id=1,
        )

        result = await service.firmware_upgrade(
            device_id="ONT-12345",
            device_type=DeviceType.ONT,
            firmware_version="v2.3.4",
            firmware_url="https://firmware.example.com/ont-v2.3.4.bin",
        )

        assert result["success"] is True
        assert result["device_id"] == "ONT-12345"
        assert result["firmware_version"] == "v2.3.4"
        assert result["status"] == "upgrading"
