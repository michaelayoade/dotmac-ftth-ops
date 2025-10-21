"""
Ansible Integration with Service Lifecycle.

Connects Ansible automation workflows with service lifecycle operations.
"""

from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.playbook_library import PlaybookLibrary, PlaybookType
from dotmac.platform.services.lifecycle.models import (
    LifecycleEvent,
    LifecycleEventType,
    ServiceInstance,
    ServiceStatus,
)

logger = structlog.get_logger(__name__)


class AnsibleLifecycleIntegration:
    """Integration layer between Ansible and Service Lifecycle"""

    def __init__(
        self,
        session: AsyncSession,
        awx_client: AWXClient,
        job_template_id: int,
        callback_base_url: str,
        api_token: str,
    ):
        """
        Initialize integration.

        Args:
            session: Database session
            awx_client: AWX API client
            job_template_id: AWX job template ID for running playbooks
            callback_base_url: Base URL for playbook callbacks
            api_token: API token for callback authentication
        """
        self.session = session
        self.awx_client = awx_client
        self.job_template_id = job_template_id
        self.callback_base_url = callback_base_url
        self.api_token = api_token

    async def provision_fiber_service(
        self,
        service_instance: ServiceInstance,
        ont_serial: str,
        target_olt: str,
    ) -> dict[str, Any]:
        """
        Execute Ansible playbook to provision fiber service.

        Args:
            service_instance: Service instance to provision
            ont_serial: ONT serial number
            target_olt: Target OLT host/group

        Returns:
            dict with job execution results
        """
        # Build playbook variables
        service_config = service_instance.service_config or {}
        download_speed = service_config.get("download_speed_mbps", 100)
        upload_speed = service_config.get("upload_speed_mbps", 50)
        vlan_id = service_instance.vlan_id or 100

        extra_vars = PlaybookLibrary.build_fiber_provision_vars(
            service_instance_id=str(service_instance.id),
            customer_id=str(service_instance.customer_id),
            ont_serial=ont_serial,
            vlan_id=vlan_id,
            download_speed_mbps=download_speed,
            upload_speed_mbps=upload_speed,
            target_olt=target_olt,
            callback_url=self.callback_base_url,
            api_token=self.api_token,
        )

        # Add playbook path
        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(
            PlaybookType.FIBER_PROVISION
        )

        # Launch AWX job
        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            # Create lifecycle event
            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.PROVISION_STARTED,
                description=f"Ansible provisioning started - Job ID: {job_result.get('id')}",
                event_data={
                    "awx_job_id": job_result.get("id"),
                    "playbook_type": PlaybookType.FIBER_PROVISION.value,
                    "ont_serial": ont_serial,
                    "target_olt": target_olt,
                },
                external_system_response=job_result,
            )

            await self.session.commit()

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "message": "Fiber provisioning playbook launched",
            }

        except Exception as e:
            logger.error(
                "ansible.provision_fiber.failed",
                service_id=str(service_instance.id),
                error=str(e),
            )

            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.PROVISION_FAILED,
                description=f"Ansible provisioning failed: {str(e)}",
                success=False,
                error_message=str(e),
            )

            await self.session.commit()

            return {
                "success": False,
                "error": str(e),
                "message": "Failed to launch provisioning playbook",
            }

    async def configure_router(
        self,
        service_instance: ServiceInstance,
        router_id: str,
        router_config: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Execute Ansible playbook to configure customer router.

        Args:
            service_instance: Service instance
            router_id: Router device ID/hostname
            router_config: Router configuration parameters

        Returns:
            dict with job execution results
        """
        extra_vars = PlaybookLibrary.build_router_config_vars(
            router_id=router_id,
            customer_id=str(service_instance.customer_id),
            service_id=str(service_instance.id),
            wan_ip=router_config.get("wan_ip"),
            wan_netmask=router_config.get("wan_netmask", "255.255.255.0"),
            wan_gateway=router_config.get("wan_gateway"),
            lan_ip=router_config.get("lan_ip", "192.168.1.1"),
            lan_netmask=router_config.get("lan_netmask", "255.255.255.0"),
            lan_network=router_config.get("lan_network", "192.168.1.0"),
            vlan_id=service_instance.vlan_id,
            wifi_ssid=router_config.get("wifi_ssid"),
            wifi_password=router_config.get("wifi_password"),
            dns_servers=router_config.get("dns_servers"),
            callback_url=self.callback_base_url,
            api_token=self.api_token,
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(PlaybookType.ROUTER_CONFIG)

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.MODIFICATION_COMPLETED,
                description=f"Router configuration started - Job ID: {job_result.get('id')}",
                event_data={
                    "awx_job_id": job_result.get("id"),
                    "playbook_type": PlaybookType.ROUTER_CONFIG.value,
                    "router_id": router_id,
                },
                external_system_response=job_result,
            )

            await self.session.commit()

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "message": "Router configuration playbook launched",
            }

        except Exception as e:
            logger.error(
                "ansible.configure_router.failed",
                service_id=str(service_instance.id),
                router_id=router_id,
                error=str(e),
            )

            return {
                "success": False,
                "error": str(e),
                "message": "Failed to launch router configuration playbook",
            }

    async def provision_ont_device(
        self,
        service_instance: ServiceInstance,
        ont_serial: str,
        target_olt: str,
        service_profile: str = "default",
    ) -> dict[str, Any]:
        """
        Execute Ansible playbook to provision ONT device.

        Args:
            service_instance: Service instance
            ont_serial: ONT serial number
            target_olt: Target OLT host/group
            service_profile: ONT service profile name

        Returns:
            dict with job execution results
        """
        extra_vars = PlaybookLibrary.build_ont_provision_vars(
            ont_serial=ont_serial,
            customer_id=str(service_instance.customer_id),
            target_olt=target_olt,
            service_profile=service_profile,
            auto_discover=True,
            callback_url=self.callback_base_url,
            api_token=self.api_token,
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(PlaybookType.ONT_PROVISION)

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.PROVISION_STARTED,
                description=f"ONT provisioning started - Job ID: {job_result.get('id')}",
                event_data={
                    "awx_job_id": job_result.get("id"),
                    "playbook_type": PlaybookType.ONT_PROVISION.value,
                    "ont_serial": ont_serial,
                    "target_olt": target_olt,
                },
                external_system_response=job_result,
            )

            await self.session.commit()

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "message": "ONT provisioning playbook launched",
            }

        except Exception as e:
            logger.error(
                "ansible.provision_ont.failed",
                service_id=str(service_instance.id),
                ont_serial=ont_serial,
                error=str(e),
            )

            return {
                "success": False,
                "error": str(e),
                "message": "Failed to launch ONT provisioning playbook",
            }

    async def suspend_service(
        self,
        service_instance: ServiceInstance,
        ont_serial: str,
        target_olt: str,
        suspension_reason: str,
    ) -> dict[str, Any]:
        """
        Execute Ansible playbook to suspend service.

        Args:
            service_instance: Service instance to suspend
            ont_serial: ONT serial number
            target_olt: Target OLT host/group
            suspension_reason: Reason for suspension

        Returns:
            dict with job execution results
        """
        extra_vars = PlaybookLibrary.build_service_suspend_vars(
            service_instance_id=str(service_instance.id),
            ont_serial=ont_serial,
            target_olt=target_olt,
            suspension_reason=suspension_reason,
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(
            PlaybookType.SERVICE_SUSPEND
        )

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.SUSPENSION_REQUESTED,
                previous_status=service_instance.status,
                new_status=ServiceStatus.SUSPENDED,
                description=f"Service suspension started - Job ID: {job_result.get('id')}",
                event_data={
                    "awx_job_id": job_result.get("id"),
                    "playbook_type": PlaybookType.SERVICE_SUSPEND.value,
                    "suspension_reason": suspension_reason,
                },
                external_system_response=job_result,
            )

            await self.session.commit()

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "message": "Service suspension playbook launched",
            }

        except Exception as e:
            logger.error(
                "ansible.suspend_service.failed",
                service_id=str(service_instance.id),
                error=str(e),
            )

            return {
                "success": False,
                "error": str(e),
                "message": "Failed to launch service suspension playbook",
            }

    async def terminate_service(
        self,
        service_instance: ServiceInstance,
        ont_serial: str,
        target_olt: str,
        release_resources: bool = True,
    ) -> dict[str, Any]:
        """
        Execute Ansible playbook to terminate service.

        Args:
            service_instance: Service instance to terminate
            ont_serial: ONT serial number
            target_olt: Target OLT host/group
            release_resources: Whether to release network resources

        Returns:
            dict with job execution results
        """
        extra_vars = PlaybookLibrary.build_service_terminate_vars(
            service_instance_id=str(service_instance.id),
            ont_serial=ont_serial,
            vlan_id=service_instance.vlan_id or 0,
            target_olt=target_olt,
            release_resources=release_resources,
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(
            PlaybookType.SERVICE_TERMINATE
        )

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            await self._create_lifecycle_event(
                service_instance=service_instance,
                event_type=LifecycleEventType.TERMINATION_STARTED,
                previous_status=service_instance.status,
                new_status=ServiceStatus.TERMINATING,
                description=f"Service termination started - Job ID: {job_result.get('id')}",
                event_data={
                    "awx_job_id": job_result.get("id"),
                    "playbook_type": PlaybookType.SERVICE_TERMINATE.value,
                    "release_resources": release_resources,
                },
                external_system_response=job_result,
            )

            await self.session.commit()

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "message": "Service termination playbook launched",
            }

        except Exception as e:
            logger.error(
                "ansible.terminate_service.failed",
                service_id=str(service_instance.id),
                error=str(e),
            )

            return {
                "success": False,
                "error": str(e),
                "message": "Failed to launch service termination playbook",
            }

    async def _create_lifecycle_event(
        self,
        service_instance: ServiceInstance,
        event_type: LifecycleEventType,
        description: str,
        previous_status: ServiceStatus | None = None,
        new_status: ServiceStatus | None = None,
        success: bool = True,
        error_message: str | None = None,
        event_data: dict[str, Any] | None = None,
        external_system_response: dict[str, Any] | None = None,
    ) -> LifecycleEvent:
        """Create a lifecycle event for Ansible automation"""
        event = LifecycleEvent(
            tenant_id=service_instance.tenant_id,
            service_instance_id=service_instance.id,
            event_type=event_type,
            description=description,
            previous_status=previous_status,
            new_status=new_status,
            success=success,
            error_message=error_message,
            triggered_by_system="ansible_automation",
            event_data=event_data or {},
            external_system_response=external_system_response,
        )

        self.session.add(event)
        await self.session.flush()
        return event

    async def get_job_status(self, awx_job_id: int) -> dict[str, Any] | None:
        """Get status of AWX job"""
        try:
            job = await self.awx_client.get_job(awx_job_id)
            return job if job is not None else None
        except Exception as e:
            logger.error("ansible.get_job_status.failed", job_id=awx_job_id, error=str(e))
            return None

    async def cancel_job(self, awx_job_id: int) -> bool:
        """Cancel running AWX job"""
        try:
            await self.awx_client.cancel_job(awx_job_id)
            return True
        except Exception as e:
            logger.error("ansible.cancel_job.failed", job_id=awx_job_id, error=str(e))
            return False
