"""
Comprehensive GenieACS TR-069 Flow Tests.

Tests complete TR-069/CWMP workflows including:
- CPE device management and discovery
- Parameter configuration (WiFi, WAN, management)
- Firmware upgrades and file transfers
- Diagnostic tasks (ping, traceroute, speed test)
- Bulk operations on multiple devices
- Integration with service provisioning
"""

from datetime import timezone, datetime, timedelta

import pytest


@pytest.mark.asyncio
class TestGenieACSDeviceManagement:
    """Test CPE device management via GenieACS."""

    async def test_discover_cpe_device(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test discovering and registering CPE device."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Simulate device inform
        device = await service.register_device(**sample_cpe_device)

        assert device["device_id"] == "ABCD-1234-5678-9012"
        assert device["serial_number"] == "SN123456789"
        assert device["manufacturer"] == "Huawei"
        assert device["model"] == "EG8145V5"
        assert device["last_inform"] is not None

    async def test_get_device_info(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test retrieving device information."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Get device info
        device_info = await service.get_device(device_id=sample_cpe_device["device_id"])

        assert device_info is not None
        assert device_info["device_id"] == "ABCD-1234-5678-9012"
        assert device_info["software_version"] == "V5R019C10S115"

    async def test_list_devices_by_tenant(
        self, async_session, test_tenant_id, mock_genieacs_client
    ):
        """Test listing all devices for tenant."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register multiple devices
        for i in range(5):
            device_data = {
                "device_id": f"DEVICE-{i:04d}",
                "serial_number": f"SN{i:09d}",
                "manufacturer": "Huawei",
                "model": "EG8145V5",
                "last_inform": datetime.now(timezone.utc).isoformat(),
            }
            await service.register_device(**device_data)

        # List all devices
        devices = await service.list_devices()

        assert len(devices) >= 5

    async def test_delete_device(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test removing device from management."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        device = await service.register_device(**sample_cpe_device)

        # Delete device
        deleted = await service.delete_device(device_id=device["device_id"])

        assert deleted is True

        # Verify device is removed
        device_info = await service.get_device(device_id=device["device_id"])
        assert device_info is None


@pytest.mark.asyncio
class TestGenieACSParameterConfiguration:
    """Test TR-069 parameter configuration."""

    async def test_configure_wifi_parameters(
        self,
        async_session,
        test_tenant_id,
        mock_genieacs_client,
        sample_cpe_device,
        sample_tr069_parameters,
    ):
        """Test configuring WiFi parameters."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Configure WiFi
        wifi_params = {
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "Customer-WiFi-001",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey": "SecurePassword123",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": True,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard": "n",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel": 6,
        }

        set_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=wifi_params,
        )

        task_id = await service.set_parameters(set_request)

        assert task_id is not None
        # Verify task was created
        task = next((t for t in mock_genieacs_client.tasks if t["id"] == task_id), None)
        assert task is not None
        assert task["type"] == "setParameterValues"

    async def test_configure_wan_connection(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test configuring WAN connection parameters."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Configure WAN (PPPoE)
        wan_params = {
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable": True,
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": "user@isp.com",
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password": "password123",
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.NATEnabled": True,
        }

        set_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=wan_params,
        )

        task_id = await service.set_parameters(set_request)
        assert task_id is not None

    async def test_configure_management_server(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test configuring TR-069 management server parameters."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Configure management server
        mgmt_params = {
            "InternetGatewayDevice.ManagementServer.PeriodicInformEnable": True,
            "InternetGatewayDevice.ManagementServer.PeriodicInformInterval": 300,  # 5 minutes
            "InternetGatewayDevice.ManagementServer.ConnectionRequestUsername": "admin",
            "InternetGatewayDevice.ManagementServer.ConnectionRequestPassword": "SecureAdmin123",
        }

        set_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=mgmt_params,
        )

        task_id = await service.set_parameters(set_request)
        assert task_id is not None

    async def test_get_device_parameters(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test retrieving device parameters."""
        from dotmac.platform.genieacs.schemas import GetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Get specific parameters
        get_request = GetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameter_names=[
                "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID",
                "InternetGatewayDevice.DeviceInfo.SoftwareVersion",
                "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANIPConnection.1.ExternalIPAddress",
            ],
        )

        parameters = await service.get_parameters(get_request)

        assert isinstance(parameters, dict)
        # In real implementation, would return actual parameter values


@pytest.mark.asyncio
class TestGenieACSFirmwareManagement:
    """Test firmware upgrades via TR-069."""

    async def test_trigger_firmware_upgrade(
        self,
        async_session,
        test_tenant_id,
        mock_genieacs_client,
        sample_cpe_device,
        sample_firmware_upgrade,
    ):
        """Test triggering firmware upgrade on device."""
        from dotmac.platform.genieacs.schemas import FirmwareUpgradeRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Trigger firmware upgrade
        upgrade_request = FirmwareUpgradeRequest(**sample_firmware_upgrade)

        task_id = await service.trigger_firmware_upgrade(upgrade_request)

        assert task_id is not None
        # Verify download task was created
        task = next((t for t in mock_genieacs_client.tasks if t["id"] == task_id), None)
        assert task is not None
        assert task["type"] == "download"
        assert "firmware" in task["url"]

    async def test_schedule_firmware_upgrade(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test scheduling firmware upgrade for future time."""
        from dotmac.platform.genieacs.schemas import FirmwareUpgradeRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Schedule upgrade for 2 hours from now
        scheduled_time = datetime.now(timezone.utc) + timedelta(hours=2)

        upgrade_request = FirmwareUpgradeRequest(
            device_id=sample_cpe_device["device_id"],
            firmware_version="V5R019C10S120",
            download_url="http://firmware.isp.com/ont/firmware.bin",
            file_type="3 Vendor Configuration File",
            schedule_time=scheduled_time.isoformat(),
        )

        task_id = await service.schedule_firmware_upgrade(upgrade_request)
        assert task_id is not None

    async def test_bulk_firmware_upgrade(self, async_session, test_tenant_id, mock_genieacs_client):
        """Test upgrading firmware on multiple devices."""
        from dotmac.platform.genieacs.schemas import BulkFirmwareUpgradeRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register multiple devices
        device_ids = []
        for i in range(10):
            device_data = {
                "device_id": f"DEVICE-{i:04d}",
                "serial_number": f"SN{i:09d}",
                "manufacturer": "Huawei",
                "model": "EG8145V5",
                "software_version": "V5R019C10S115",  # Old version
                "last_inform": datetime.now(timezone.utc).isoformat(),
            }
            device = await service.register_device(**device_data)
            device_ids.append(device["device_id"])
            mock_genieacs_client.devices[device["device_id"]] = device_data

        # Bulk upgrade
        bulk_request = BulkFirmwareUpgradeRequest(
            device_ids=device_ids,
            firmware_version="V5R019C10S120",
            download_url="http://firmware.isp.com/ont/firmware.bin",
        )

        task_ids = await service.bulk_firmware_upgrade(bulk_request)

        assert len(task_ids) == 10
        assert all(task_id is not None for task_id in task_ids)


@pytest.mark.asyncio
class TestGenieACSDiagnostics:
    """Test diagnostic operations via TR-069."""

    async def test_ping_diagnostic(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test running ping diagnostic on CPE."""
        from dotmac.platform.genieacs.schemas import DiagnosticRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Run ping diagnostic
        ping_request = DiagnosticRequest(
            device_id=sample_cpe_device["device_id"],
            diagnostic_type="ping",
            target="8.8.8.8",
            count=4,
        )

        task_id = await service.run_diagnostic(ping_request)
        assert task_id is not None

        # In real implementation, would wait for results and return:
        # {
        #     "success_count": 4,
        #     "failure_count": 0,
        #     "average_response_time": 15.3,
        #     "min_response_time": 14.2,
        #     "max_response_time": 17.8,
        # }

    async def test_traceroute_diagnostic(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test running traceroute diagnostic on CPE."""
        from dotmac.platform.genieacs.schemas import DiagnosticRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Run traceroute
        traceroute_request = DiagnosticRequest(
            device_id=sample_cpe_device["device_id"],
            diagnostic_type="traceroute",
            target="8.8.8.8",
            max_hop_count=30,
        )

        task_id = await service.run_diagnostic(traceroute_request)
        assert task_id is not None

    async def test_speed_test_diagnostic(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test running speed test diagnostic on CPE."""
        from dotmac.platform.genieacs.schemas import DiagnosticRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Run speed test
        speedtest_request = DiagnosticRequest(
            device_id=sample_cpe_device["device_id"],
            diagnostic_type="speed_test",
            test_server="speedtest.isp.com",
        )

        task_id = await service.run_diagnostic(speedtest_request)
        assert task_id is not None

        # In real implementation, would return:
        # {
        #     "download_speed_mbps": 98.5,
        #     "upload_speed_mbps": 47.3,
        #     "latency_ms": 12.4,
        #     "jitter_ms": 2.1,
        # }


@pytest.mark.asyncio
class TestGenieACSBulkOperations:
    """Test bulk operations on multiple CPE devices."""

    async def test_bulk_parameter_update(self, async_session, test_tenant_id, mock_genieacs_client):
        """Test updating parameters on multiple devices."""
        from dotmac.platform.genieacs.schemas import BulkSetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register multiple devices
        device_ids = []
        for i in range(5):
            device_data = {
                "device_id": f"DEVICE-{i:04d}",
                "serial_number": f"SN{i:09d}",
                "manufacturer": "Huawei",
                "model": "EG8145V5",
                "last_inform": datetime.now(timezone.utc).isoformat(),
            }
            device = await service.register_device(**device_data)
            device_ids.append(device["device_id"])
            mock_genieacs_client.devices[device["device_id"]] = device_data

        # Bulk update (e.g., change WiFi channel on all devices)
        bulk_request = BulkSetParametersRequest(
            device_ids=device_ids,
            parameters={
                "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel": 11,
            },
        )

        task_ids = await service.bulk_set_parameters(bulk_request)

        assert len(task_ids) == 5
        assert all(task_id is not None for task_id in task_ids)

    async def test_bulk_reboot(self, async_session, test_tenant_id, mock_genieacs_client):
        """Test rebooting multiple devices."""
        from dotmac.platform.genieacs.schemas import BulkOperationRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register multiple devices
        device_ids = []
        for i in range(5):
            device_data = {
                "device_id": f"DEVICE-{i:04d}",
                "serial_number": f"SN{i:09d}",
                "manufacturer": "Huawei",
                "model": "EG8145V5",
                "last_inform": datetime.now(timezone.utc).isoformat(),
            }
            device = await service.register_device(**device_data)
            device_ids.append(device["device_id"])
            mock_genieacs_client.devices[device["device_id"]] = device_data

        # Bulk reboot
        bulk_request = BulkOperationRequest(
            device_ids=device_ids,
            operation="reboot",
        )

        task_ids = await service.bulk_operation(bulk_request)

        assert len(task_ids) == 5

    async def test_bulk_factory_reset(self, async_session, test_tenant_id, mock_genieacs_client):
        """Test factory reset on multiple devices."""
        from dotmac.platform.genieacs.schemas import BulkOperationRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register devices
        device_ids = []
        for i in range(3):
            device_data = {
                "device_id": f"DEVICE-{i:04d}",
                "serial_number": f"SN{i:09d}",
                "manufacturer": "Huawei",
                "model": "EG8145V5",
                "last_inform": datetime.now(timezone.utc).isoformat(),
            }
            device = await service.register_device(**device_data)
            device_ids.append(device["device_id"])
            mock_genieacs_client.devices[device["device_id"]] = device_data

        # Bulk factory reset
        bulk_request = BulkOperationRequest(
            device_ids=device_ids,
            operation="factory_reset",
        )

        task_ids = await service.bulk_operation(bulk_request)
        assert len(task_ids) == 3


@pytest.mark.asyncio
class TestGenieACSServiceIntegration:
    """Test GenieACS integration with service provisioning."""

    async def test_provision_ont_for_new_service(
        self,
        async_session,
        test_tenant_id,
        mock_genieacs_client,
        sample_cpe_device,
        sample_service_provisioning_request,
    ):
        """Test provisioning ONT as part of service activation."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Configure ONT for customer service
        service_config = sample_service_provisioning_request["service_config"]
        ont_params = {
            # WAN Configuration
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable": True,
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": f"customer_{sample_service_provisioning_request['subscription_id']}",
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.NATEnabled": True,
            # WiFi Configuration (if managed WiFi enabled)
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": service_config.get(
                "managed_wifi", False
            ),
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": f"ISP-Customer-{sample_service_provisioning_request['subscription_id'][-4:]}",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard": "ac",
            # Management
            "InternetGatewayDevice.ManagementServer.PeriodicInformEnable": True,
            "InternetGatewayDevice.ManagementServer.PeriodicInformInterval": 300,
        }

        set_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=ont_params,
        )

        task_id = await service.set_parameters(set_request)
        assert task_id is not None

    async def test_update_ont_on_service_modification(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test updating ONT configuration when service is modified."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Update WiFi settings (service upgrade)
        updated_params = {
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "NEW-SSID-Premium",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard": "ax",  # WiFi 6
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel": "auto",
        }

        set_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=updated_params,
        )

        task_id = await service.set_parameters(set_request)
        assert task_id is not None

    async def test_reset_ont_on_service_termination(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test resetting ONT when service is terminated."""
        from dotmac.platform.genieacs.schemas import DeviceOperationRequest
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Factory reset ONT
        reset_request = DeviceOperationRequest(
            device_id=sample_cpe_device["device_id"],
            operation="factory_reset",
        )

        task_id = await service.device_operation(reset_request)
        assert task_id is not None

        # After reset, device should be removed from management
        # or marked for reconfiguration


@pytest.mark.asyncio
class TestGenieACSMonitoring:
    """Test CPE monitoring and health checks."""

    async def test_check_device_online_status(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test checking if device is online."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device with recent inform
        sample_cpe_device["last_inform"] = datetime.now(timezone.utc).isoformat()
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Check online status
        is_online = await service.is_device_online(device_id=sample_cpe_device["device_id"])

        assert is_online is True

        # Test offline detection (no inform for > 15 minutes)
        sample_cpe_device["last_inform"] = (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()
        is_online = await service.is_device_online(device_id=sample_cpe_device["device_id"])

        assert is_online is False

    async def test_get_device_statistics(
        self, async_session, test_tenant_id, mock_genieacs_client, sample_cpe_device
    ):
        """Test retrieving device statistics."""
        from dotmac.platform.genieacs.service import GenieACSService

        service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register device
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Get statistics
        stats = await service.get_device_statistics(device_id=sample_cpe_device["device_id"])

        # In real implementation, would return:
        # {
        #     "uptime_seconds": 86400,
        #     "cpu_usage_percent": 45.2,
        #     "memory_usage_percent": 62.8,
        #     "wan_rx_bytes": 1024 * 1024 * 1024 * 50,
        #     "wan_tx_bytes": 1024 * 1024 * 1024 * 10,
        #     "wan_rx_packets": 50000000,
        #     "wan_tx_packets": 10000000,
        # }

        assert isinstance(stats, dict)
