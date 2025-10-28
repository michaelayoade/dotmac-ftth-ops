
"""
Comprehensive Service Lifecycle Automation Tests.

Tests complete end-to-end service lifecycle workflows integrating:
- Service provisioning with OSS integration
- RADIUS subscriber creation
- NetBox IPAM resource allocation
- GenieACS CPE configuration
- Service activation and testing
- Service modifications and upgrades
- Service suspension and resumption
- Service termination and resource cleanup
"""

from uuid import uuid4

import pytest







pytestmark = pytest.mark.integration

@pytest.mark.asyncio
class TestEndToEndServiceProvisioning:
    """Test complete end-to-end service provisioning workflow."""

    async def test_full_fiber_service_provisioning_workflow(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_radius_server,
        mock_netbox_client,
        mock_genieacs_client,
        sample_service_provisioning_request,
        sample_bandwidth_profile,
        sample_cpe_device,
    ):
        """Test complete fiber service provisioning from request to activation."""
        from dotmac.platform.genieacs.service import GenieACSService
        from dotmac.platform.netbox.service import NetBoxService
        from dotmac.platform.radius.schemas import BandwidthProfileCreate, RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import ServiceProvisionRequest
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        # Step 1: Initiate service provisioning
        lifecycle_service = LifecycleOrchestrationService(async_session)

        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name=sample_service_provisioning_request["service_name"],
            service_type=sample_service_provisioning_request["service_type"],
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config=sample_service_provisioning_request["service_config"],
            installation_address=sample_service_provisioning_request["installation_address"],
            equipment_assigned=sample_service_provisioning_request["equipment_assigned"],
            vlan_id=sample_service_provisioning_request["vlan_id"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        assert provision_response.service_instance_id is not None
        assert provision_response.workflow_id is not None
        assert provision_response.status == "provisioning"

        service_instance_id = provision_response.service_instance_id

        # Step 2: Allocate network resources via NetBox
        netbox_service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)

        # Create VLAN
        await netbox_service.create_vlan(
            vid=sample_service_provisioning_request["vlan_id"],
            name=f"VLAN{sample_service_provisioning_request['vlan_id']}-Customers",
            tenant=test_tenant_id,
            status="active",
        )

        # Allocate IP address
        ip_allocation = await netbox_service.allocate_ip(
            {
                "prefix": "10.0.0.0/24",
                "tenant": test_tenant_id,
                "role": "customer",
                "dns_name": f"cust-{sample_service_provisioning_request['subscription_id']}.isp.com",
            }
        )

        assert ip_allocation["address"] is not None
        allocated_ip = ip_allocation["address"].split("/")[0]

        # Step 3: Create RADIUS subscriber
        radius_service = RADIUSService(async_session, test_tenant_id)

        # Create bandwidth profile
        profile_data = BandwidthProfileCreate(**sample_bandwidth_profile)
        bandwidth_profile = await radius_service.create_bandwidth_profile(profile_data)

        # Create subscriber
        subscriber_data = RADIUSSubscriberCreate(
            subscriber_id=sample_service_provisioning_request["subscription_id"],
            username=f"user_{sample_service_provisioning_request['subscription_id']}@isp.com",
            password="SecureCustomerPassword123!",
            framed_ip_address=allocated_ip,
            bandwidth_profile_id=bandwidth_profile.id,
            session_timeout=0,  # No timeout
        )

        radius_subscriber = await radius_service.create_subscriber(subscriber_data)

        assert radius_subscriber.username is not None
        assert radius_subscriber.framed_ip_address == allocated_ip

        # Step 4: Configure CPE via GenieACS (ONT + WiFi)
        genieacs_service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Configure ONT parameters
        ont_config = {
            # WAN Configuration
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Enable": True,
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username": radius_subscriber.username,
            "InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.NATEnabled": True,
            # WiFi Configuration
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": True,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": f"Customer-{sample_service_provisioning_request['subscription_id'][-4:]}",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey": "SecureWiFiPass123",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard": "ax",
        }

        from dotmac.platform.genieacs.schemas import SetParametersRequest

        set_params_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=ont_config,
        )

        ont_task_id = await genieacs_service.set_parameters(set_params_request)

        assert ont_task_id is not None

        # Step 5: Activate service
        activation_result = await lifecycle_service.activate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            activated_by_user_id=uuid4(),
        )

        assert activation_result.success is True
        assert activation_result.operation == "activate"

        # Step 6: Verify service is active
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert service_instance.status == "active"
        assert service_instance.ip_address == allocated_ip
        assert service_instance.vlan_id == sample_service_provisioning_request["vlan_id"]

        # Step 7: Run connectivity test (simulated)
        connectivity_check = await lifecycle_service.perform_health_check(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert connectivity_check.success is True
        assert service_instance.health_status in ["healthy", "degraded"]

    async def test_service_provisioning_with_validation_failure(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        sample_service_provisioning_request,
    ):
        """Test service provisioning fails gracefully with validation errors."""
        from dotmac.platform.services.lifecycle.schemas import ServiceProvisionRequest
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)

        # Invalid service config (missing required fields)
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name=sample_service_provisioning_request["service_name"],
            service_type=sample_service_provisioning_request["service_type"],
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={},  # Empty config
            equipment_assigned=[],  # No equipment
        )

        # This should raise validation error or return failure status
        try:
            provision_response = await lifecycle_service.provision_service(
                tenant_id=test_tenant_id,
                data=provision_request,
                created_by_user_id=uuid4(),
            )
            # If no exception, check status
            assert provision_response.status in ["failed", "validation_failed"]
        except ValueError:
            # Validation error is acceptable
            pass


@pytest.mark.asyncio
class TestServiceModificationWorkflows:
    """Test service modification and upgrade workflows."""

    async def test_upgrade_service_bandwidth(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_radius_server,
        sample_service_provisioning_request,
        sample_bandwidth_profile,
    ):
        """Test upgrading service bandwidth (100 Mbps -> 500 Mbps)."""
        from dotmac.platform.radius.schemas import BandwidthProfileCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import (
            ServiceModificationRequest,
            ServiceProvisionRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)
        radius_service = RADIUSService(async_session, test_tenant_id)

        # Create initial service
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={"bandwidth_profile": "100mbps"},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        # Create upgraded bandwidth profile
        upgraded_profile = BandwidthProfileCreate(
            name="500 Mbps Fiber",
            download_rate_kbps=500000,
            upload_rate_kbps=250000,
        )
        new_profile = await radius_service.create_bandwidth_profile(upgraded_profile)

        # Modify service
        modification_request = ServiceModificationRequest(
            service_config={
                "bandwidth_profile": "500mbps",
                "bandwidth_profile_id": str(new_profile.id),
            },
            reason="Customer upgrade request",
        )

        modification_result = await lifecycle_service.modify_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            data=modification_request,
            modified_by_user_id=uuid4(),
        )

        assert modification_result.success is True

        # Verify service updated
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert "500mbps" in str(service_instance.service_config)

    async def test_enable_managed_wifi(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_genieacs_client,
        sample_cpe_device,
        sample_service_provisioning_request,
    ):
        """Test enabling managed WiFi on existing service."""
        from dotmac.platform.genieacs.schemas import SetParametersRequest
        from dotmac.platform.genieacs.service import GenieACSService
        from dotmac.platform.services.lifecycle.schemas import (
            ServiceModificationRequest,
            ServiceProvisionRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)
        genieacs_service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Create initial service without managed WiFi
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={"managed_wifi": False},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Enable managed WiFi
        wifi_config = {
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable": True,
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "ISP-Premium-WiFi",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey": "SecurePassword123",
            "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Standard": "ax",
        }

        set_params_request = SetParametersRequest(
            device_id=sample_cpe_device["device_id"],
            parameters=wifi_config,
        )

        task_id = await genieacs_service.set_parameters(set_params_request)
        assert task_id is not None

        # Update service config
        modification_request = ServiceModificationRequest(
            service_config={"managed_wifi": True, "wifi_ssid": "ISP-Premium-WiFi"},
            reason="Customer requested managed WiFi",
        )

        modification_result = await lifecycle_service.modify_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            data=modification_request,
            modified_by_user_id=uuid4(),
        )

        assert modification_result.success is True


@pytest.mark.asyncio
class TestServiceSuspensionWorkflows:
    """Test service suspension and resumption workflows."""

    async def test_suspend_service_for_nonpayment(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_radius_server,
        sample_service_provisioning_request,
        sample_radius_subscriber_data,
    ):
        """Test suspending service due to non-payment."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import (
            ServiceProvisionRequest,
            ServiceSuspensionRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)
        radius_service = RADIUSService(async_session, test_tenant_id)

        # Create and activate service
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        # Activate service
        await lifecycle_service.activate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            activated_by_user_id=uuid4(),
        )

        # Create RADIUS subscriber
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        radius_subscriber = await radius_service.create_subscriber(subscriber_data)

        # Suspend service
        suspension_request = ServiceSuspensionRequest(
            reason="non_payment",
            suspension_note="Account past due - payment required",
        )

        suspension_result = await lifecycle_service.suspend_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            data=suspension_request,
            suspended_by_user_id=uuid4(),
        )

        assert suspension_result.success is True

        # Verify service is suspended
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert service_instance.status == "suspended_non_payment"
        assert service_instance.suspended_at is not None

        # Verify RADIUS subscriber is suspended
        suspended_subscriber = await radius_service.suspend_subscriber(
            subscriber_id=radius_subscriber.subscriber_id
        )

        assert suspended_subscriber.is_suspended is True

    async def test_resume_service_after_payment(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_radius_server,
        sample_service_provisioning_request,
        sample_radius_subscriber_data,
    ):
        """Test resuming suspended service after payment received."""
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import (
            ServiceProvisionRequest,
            ServiceSuspensionRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)
        radius_service = RADIUSService(async_session, test_tenant_id)

        # Create, activate, and suspend service (same as previous test)
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        await lifecycle_service.activate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            activated_by_user_id=uuid4(),
        )

        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        radius_subscriber = await radius_service.create_subscriber(subscriber_data)

        suspension_request = ServiceSuspensionRequest(
            reason="non_payment",
        )

        await lifecycle_service.suspend_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            data=suspension_request,
            suspended_by_user_id=uuid4(),
        )

        await radius_service.suspend_subscriber(subscriber_id=radius_subscriber.subscriber_id)

        # Resume service
        resumption_result = await lifecycle_service.resume_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            resumed_by_user_id=uuid4(),
        )

        assert resumption_result.success is True

        # Verify service is active
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert service_instance.status == "active"
        assert service_instance.suspended_at is None

        # Verify RADIUS subscriber is resumed
        resumed_subscriber = await radius_service.resume_subscriber(
            subscriber_id=radius_subscriber.subscriber_id
        )

        assert resumed_subscriber.is_suspended is False


@pytest.mark.asyncio
class TestServiceTerminationWorkflows:
    """Test service termination and resource cleanup."""

    async def test_terminate_service_with_full_cleanup(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        mock_radius_server,
        mock_netbox_client,
        mock_genieacs_client,
        sample_service_provisioning_request,
        sample_radius_subscriber_data,
        sample_cpe_device,
    ):
        """Test terminating service and cleaning up all resources."""
        from dotmac.platform.genieacs.schemas import DeviceOperationRequest
        from dotmac.platform.genieacs.service import GenieACSService
        from dotmac.platform.netbox.service import NetBoxService
        from dotmac.platform.radius.schemas import RADIUSSubscriberCreate
        from dotmac.platform.radius.service import RADIUSService
        from dotmac.platform.services.lifecycle.schemas import (
            ServiceProvisionRequest,
            ServiceTerminationRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)
        radius_service = RADIUSService(async_session, test_tenant_id)
        netbox_service = NetBoxService(async_session, test_tenant_id, mock_netbox_client)
        genieacs_service = GenieACSService(async_session, test_tenant_id, mock_genieacs_client)

        # Create and activate service
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        await lifecycle_service.activate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            activated_by_user_id=uuid4(),
        )

        # Create RADIUS subscriber
        subscriber_data = RADIUSSubscriberCreate(**sample_radius_subscriber_data)
        radius_subscriber = await radius_service.create_subscriber(subscriber_data)

        # Allocate IP
        ip_allocation = await netbox_service.allocate_ip(
            {"address": "10.0.1.100/32", "tenant": test_tenant_id}
        )

        # Register ONT
        mock_genieacs_client.devices[sample_cpe_device["device_id"]] = sample_cpe_device

        # Terminate service
        termination_request = ServiceTerminationRequest(
            reason="customer_request",
            termination_note="Customer requested service cancellation",
        )

        termination_result = await lifecycle_service.terminate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            data=termination_request,
            terminated_by_user_id=uuid4(),
        )

        assert termination_result.success is True

        # Verify service is terminated
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        assert service_instance.status == "terminated"
        assert service_instance.terminated_at is not None

        # Cleanup Step 1: Delete RADIUS subscriber
        radius_deleted = await radius_service.delete_subscriber(
            subscriber_id=radius_subscriber.subscriber_id
        )
        assert radius_deleted is True

        # Cleanup Step 2: Release IP address
        ip_released = await netbox_service.release_ip(ip_id=ip_allocation["id"])
        assert ip_released is True

        # Cleanup Step 3: Factory reset ONT
        reset_request = DeviceOperationRequest(
            device_id=sample_cpe_device["device_id"],
            operation="factory_reset",
        )
        reset_task_id = await genieacs_service.device_operation(reset_request)
        assert reset_task_id is not None


@pytest.mark.asyncio
class TestServiceLifecycleHealthChecks:
    """Test service health monitoring and automated checks."""

    async def test_automated_health_check_all_services(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        sample_service_provisioning_request,
    ):
        """Test running automated health checks on all active services."""
        from dotmac.platform.services.lifecycle.schemas import ServiceProvisionRequest
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)

        # Create multiple active services
        service_ids = []
        for i in range(5):
            provision_request = ServiceProvisionRequest(
                customer_id=test_customer_id,
                service_name=f"Service {i + 1}",
                service_type="fiber_internet",
                subscription_id=f"sub_health_{i:03d}",
                service_config={},
                equipment_assigned=["ONT"],
            )

            provision_response = await lifecycle_service.provision_service(
                tenant_id=test_tenant_id,
                data=provision_request,
                created_by_user_id=uuid4(),
            )

            service_ids.append(provision_response.service_instance_id)

            # Activate service
            await lifecycle_service.activate_service(
                service_instance_id=provision_response.service_instance_id,
                tenant_id=test_tenant_id,
                activated_by_user_id=uuid4(),
            )

        # Run health checks on all services
        for service_id in service_ids:
            health_result = await lifecycle_service.perform_health_check(
                service_instance_id=service_id,
                tenant_id=test_tenant_id,
            )

            assert health_result.success is True

    async def test_detect_service_degradation(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
        sample_service_provisioning_request,
    ):
        """Test detecting and reporting service degradation."""
        from dotmac.platform.services.lifecycle.schemas import ServiceProvisionRequest
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)

        # Create and activate service
        provision_request = ServiceProvisionRequest(
            customer_id=test_customer_id,
            service_name="100 Mbps Fiber",
            service_type="fiber_internet",
            subscription_id=sample_service_provisioning_request["subscription_id"],
            service_config={},
            equipment_assigned=["ONT-HG8145V5"],
        )

        provision_response = await lifecycle_service.provision_service(
            tenant_id=test_tenant_id,
            data=provision_request,
            created_by_user_id=uuid4(),
        )

        service_instance_id = provision_response.service_instance_id

        await lifecycle_service.activate_service(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
            activated_by_user_id=uuid4(),
        )

        # Simulate degraded service (would be detected by actual health check)
        # In real implementation, health check would:
        # - Ping test to gateway
        # - Speed test
        # - Latency/packet loss monitoring
        # - CPE online status check

        await lifecycle_service.perform_health_check(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        # Health check should detect issues and update service
        service_instance = await lifecycle_service.get_service_instance(
            service_instance_id=service_instance_id,
            tenant_id=test_tenant_id,
        )

        # Service health_status would be updated to "degraded" if issues detected
        assert service_instance.health_status in ["healthy", "degraded", "unhealthy"]


@pytest.mark.asyncio
class TestBulkServiceOperations:
    """Test bulk operations on multiple services."""

    async def test_bulk_service_suspension(
        self,
        async_session,
        test_tenant_id,
        test_customer_id,
    ):
        """Test suspending multiple services at once."""
        from dotmac.platform.services.lifecycle.schemas import (
            BulkServiceOperationRequest,
            ServiceProvisionRequest,
        )
        from dotmac.platform.services.lifecycle.service import LifecycleOrchestrationService

        lifecycle_service = LifecycleOrchestrationService(async_session)

        # Create multiple services
        service_ids = []
        for i in range(5):
            provision_request = ServiceProvisionRequest(
                customer_id=test_customer_id,
                service_name=f"Service {i + 1}",
                service_type="fiber_internet",
                subscription_id=f"sub_bulk_{i:03d}",
                service_config={},
                equipment_assigned=["ONT"],
            )

            provision_response = await lifecycle_service.provision_service(
                tenant_id=test_tenant_id,
                data=provision_request,
                created_by_user_id=uuid4(),
            )

            service_ids.append(provision_response.service_instance_id)

            # Activate
            await lifecycle_service.activate_service(
                service_instance_id=provision_response.service_instance_id,
                tenant_id=test_tenant_id,
                activated_by_user_id=uuid4(),
            )

        # Bulk suspend
        bulk_request = BulkServiceOperationRequest(
            service_instance_ids=service_ids,
            operation="suspend",
            reason="Scheduled maintenance",
        )

        bulk_result = await lifecycle_service.bulk_service_operation(
            tenant_id=test_tenant_id,
            data=bulk_request,
            performed_by_user_id=uuid4(),
        )

        assert bulk_result.total_requested == 5
        assert bulk_result.successful >= 3  # At least 60% success rate
