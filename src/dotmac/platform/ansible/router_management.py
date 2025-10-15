"""
Router Configuration Management.

Provides high-level interface for managing customer routers via Ansible.
"""

from typing import Any

import structlog

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.playbook_library import PlaybookLibrary, PlaybookType

logger = structlog.get_logger(__name__)


class RouterManagementService:
    """Service for managing customer premise routers"""

    def __init__(self, awx_client: AWXClient, job_template_id: int):
        """
        Initialize router management service.

        Args:
            awx_client: AWX API client
            job_template_id: AWX job template ID for playbook execution
        """
        self.awx_client = awx_client
        self.job_template_id = job_template_id

    async def configure_router(
        self,
        router_id: str,
        customer_id: str,
        service_id: str,
        wan_config: dict[str, Any],
        lan_config: dict[str, Any] | None = None,
        wifi_config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Configure customer router.

        Args:
            router_id: Router device ID/hostname
            customer_id: Customer ID
            service_id: Service instance ID
            wan_config: WAN interface configuration
            lan_config: LAN interface configuration (optional)
            wifi_config: WiFi configuration (optional)

        Returns:
            dict with job execution results
        """
        # Build default LAN config if not provided
        if not lan_config:
            lan_config = {
                "ip": "192.168.1.1",
                "netmask": "255.255.255.0",
                "network": "192.168.1.0",
            }

        extra_vars = PlaybookLibrary.build_router_config_vars(
            router_id=router_id,
            customer_id=customer_id,
            service_id=service_id,
            wan_ip=wan_config["ip"],
            wan_netmask=wan_config.get("netmask", "255.255.255.0"),
            wan_gateway=wan_config["gateway"],
            lan_ip=lan_config["ip"],
            lan_netmask=lan_config.get("netmask", "255.255.255.0"),
            lan_network=lan_config["network"],
            vlan_id=wan_config.get("vlan_id"),
            wifi_ssid=wifi_config.get("ssid") if wifi_config else None,
            wifi_password=wifi_config.get("password") if wifi_config else None,
            dns_servers=wan_config.get("dns_servers"),
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(
            PlaybookType.ROUTER_CONFIG
        )

        try:
            job_result = await self.awx_client.launch_job_template(
                self.job_template_id, extra_vars
            )

            logger.info(
                "router.configure.started",
                router_id=router_id,
                customer_id=customer_id,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "router_id": router_id,
                "message": "Router configuration initiated",
            }

        except Exception as e:
            logger.error(
                "router.configure.failed",
                router_id=router_id,
                customer_id=customer_id,
                error=str(e),
            )

            return {
                "success": False,
                "router_id": router_id,
                "error": str(e),
                "message": "Failed to initiate router configuration",
            }

    async def update_bandwidth(
        self,
        router_id: str,
        new_download_mbps: int,
        new_upload_mbps: int,
    ) -> dict[str, Any]:
        """
        Update router bandwidth settings.

        Args:
            router_id: Router device ID/hostname
            new_download_mbps: New download speed in Mbps
            new_upload_mbps: New upload speed in Mbps

        Returns:
            dict with job execution results
        """
        extra_vars = {
            "target_router": router_id,
            "router_device_id": router_id,
            "new_download_speed_mbps": new_download_mbps,
            "new_upload_speed_mbps": new_upload_mbps,
            "playbook_path": PlaybookLibrary.get_playbook_path(PlaybookType.BANDWIDTH_CHANGE),
        }

        try:
            job_result = await self.awx_client.launch_job_template(
                self.job_template_id, extra_vars
            )

            logger.info(
                "router.bandwidth.update.started",
                router_id=router_id,
                download_mbps=new_download_mbps,
                upload_mbps=new_upload_mbps,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "router_id": router_id,
                "message": "Bandwidth update initiated",
            }

        except Exception as e:
            logger.error(
                "router.bandwidth.update.failed",
                router_id=router_id,
                error=str(e),
            )

            return {
                "success": False,
                "router_id": router_id,
                "error": str(e),
                "message": "Failed to update bandwidth",
            }

    async def change_vlan(
        self,
        router_id: str,
        old_vlan_id: int,
        new_vlan_id: int,
    ) -> dict[str, Any]:
        """
        Change router VLAN configuration.

        Args:
            router_id: Router device ID/hostname
            old_vlan_id: Current VLAN ID
            new_vlan_id: New VLAN ID

        Returns:
            dict with job execution results
        """
        extra_vars = {
            "target_router": router_id,
            "router_device_id": router_id,
            "old_vlan_id": old_vlan_id,
            "new_vlan_id": new_vlan_id,
            "playbook_path": PlaybookLibrary.get_playbook_path(PlaybookType.VLAN_CHANGE),
        }

        try:
            job_result = await self.awx_client.launch_job_template(
                self.job_template_id, extra_vars
            )

            logger.info(
                "router.vlan.change.started",
                router_id=router_id,
                old_vlan=old_vlan_id,
                new_vlan=new_vlan_id,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "router_id": router_id,
                "message": "VLAN change initiated",
            }

        except Exception as e:
            logger.error(
                "router.vlan.change.failed",
                router_id=router_id,
                error=str(e),
            )

            return {
                "success": False,
                "router_id": router_id,
                "error": str(e),
                "message": "Failed to change VLAN",
            }

    async def reboot_router(self, router_id: str) -> dict[str, Any]:
        """
        Reboot customer router.

        Args:
            router_id: Router device ID/hostname

        Returns:
            dict with job execution results
        """
        extra_vars = {
            "target_router": router_id,
            "device_id": router_id,
            "playbook_path": PlaybookLibrary.get_playbook_path(PlaybookType.DEVICE_REBOOT),
        }

        try:
            job_result = await self.awx_client.launch_job_template(
                self.job_template_id, extra_vars
            )

            logger.info(
                "router.reboot.started",
                router_id=router_id,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "router_id": router_id,
                "message": "Router reboot initiated",
            }

        except Exception as e:
            logger.error(
                "router.reboot.failed",
                router_id=router_id,
                error=str(e),
            )

            return {
                "success": False,
                "router_id": router_id,
                "error": str(e),
                "message": "Failed to reboot router",
            }

    async def backup_configuration(self, router_id: str) -> dict[str, Any]:
        """
        Backup router configuration.

        Args:
            router_id: Router device ID/hostname

        Returns:
            dict with job execution results
        """
        extra_vars = {
            "target_router": router_id,
            "device_id": router_id,
            "playbook_path": PlaybookLibrary.get_playbook_path(PlaybookType.CONFIG_BACKUP),
        }

        try:
            job_result = await self.awx_client.launch_job_template(
                self.job_template_id, extra_vars
            )

            logger.info(
                "router.backup.started",
                router_id=router_id,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": job_result.get("status"),
                "router_id": router_id,
                "message": "Configuration backup initiated",
            }

        except Exception as e:
            logger.error(
                "router.backup.failed",
                router_id=router_id,
                error=str(e),
            )

            return {
                "success": False,
                "router_id": router_id,
                "error": str(e),
                "message": "Failed to backup configuration",
            }
