"""
Automated Network Device Provisioning.

Provides high-level interface for automated discovery and provisioning
of network devices (ONTs, switches, routers).
"""

from enum import Enum
from typing import Any

import structlog

from dotmac.platform.ansible.client import AWXClient
from dotmac.platform.ansible.playbook_library import PlaybookLibrary, PlaybookType

logger = structlog.get_logger(__name__)


class DeviceType(str, Enum):
    """Network device types"""

    ONT = "ont"
    ROUTER = "router"
    SWITCH = "switch"
    OLT = "olt"


class ProvisioningStatus(str, Enum):
    """Device provisioning status"""

    PENDING = "pending"
    DISCOVERING = "discovering"
    DISCOVERED = "discovered"
    PROVISIONING = "provisioning"
    PROVISIONED = "provisioned"
    FAILED = "failed"
    ONLINE = "online"
    OFFLINE = "offline"


class DeviceProvisioningService:
    """Service for automated network device provisioning"""

    def __init__(self, awx_client: AWXClient, job_template_id: int):
        """
        Initialize device provisioning service.

        Args:
            awx_client: AWX API client
            job_template_id: AWX job template ID for playbook execution
        """
        self.awx_client = awx_client
        self.job_template_id = job_template_id

    async def provision_ont(
        self,
        ont_serial: str,
        customer_id: str,
        target_olt: str,
        service_profile: str = "default",
        auto_discover: bool = True,
    ) -> dict[str, Any]:
        """
        Provision ONT device on OLT.

        Args:
            ont_serial: ONT serial number
            customer_id: Customer ID
            target_olt: Target OLT host/group
            service_profile: Service profile name
            auto_discover: Enable auto-discovery

        Returns:
            dict with provisioning results
        """
        extra_vars = PlaybookLibrary.build_ont_provision_vars(
            ont_serial=ont_serial,
            customer_id=customer_id,
            target_olt=target_olt,
            service_profile=service_profile,
            auto_discover=auto_discover,
        )

        extra_vars["playbook_path"] = PlaybookLibrary.get_playbook_path(PlaybookType.ONT_PROVISION)

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.ont.provision.started",
                ont_serial=ont_serial,
                customer_id=customer_id,
                target_olt=target_olt,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "device_type": DeviceType.ONT.value,
                "device_serial": ont_serial,
                "awx_job_id": job_result.get("id"),
                "status": ProvisioningStatus.PROVISIONING.value,
                "message": "ONT provisioning initiated",
            }

        except Exception as e:
            logger.error(
                "device.ont.provision.failed",
                ont_serial=ont_serial,
                customer_id=customer_id,
                error=str(e),
            )

            return {
                "success": False,
                "device_type": DeviceType.ONT.value,
                "device_serial": ont_serial,
                "status": ProvisioningStatus.FAILED.value,
                "error": str(e),
                "message": "Failed to provision ONT",
            }

    async def auto_discover_devices(
        self,
        target_olt: str,
        device_type: DeviceType = DeviceType.ONT,
    ) -> dict[str, Any]:
        """
        Auto-discover devices on network.

        Args:
            target_olt: Target OLT host/group
            device_type: Type of devices to discover

        Returns:
            dict with discovered devices
        """
        extra_vars = {
            "target_olt": target_olt,
            "device_type": device_type.value,
            "discovery_mode": "auto",
            "playbook_path": "playbooks/device_management/auto_discover.yml",
        }

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.auto_discover.started",
                target=target_olt,
                device_type=device_type.value,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": ProvisioningStatus.DISCOVERING.value,
                "device_type": device_type.value,
                "message": "Device discovery initiated",
            }

        except Exception as e:
            logger.error(
                "device.auto_discover.failed",
                target=target_olt,
                device_type=device_type.value,
                error=str(e),
            )

            return {
                "success": False,
                "device_type": device_type.value,
                "error": str(e),
                "message": "Failed to initiate device discovery",
            }

    async def provision_bulk_onts(
        self,
        ont_list: list[dict[str, Any]],
        target_olt: str,
    ) -> dict[str, Any]:
        """
        Provision multiple ONTs in bulk.

        Args:
            ont_list: List of ONT configurations
            target_olt: Target OLT host/group

        Returns:
            dict with bulk provisioning results
        """
        extra_vars = {
            "target_olt": target_olt,
            "ont_devices": ont_list,
            "playbook_path": "playbooks/device_management/bulk_provision_onts.yml",
        }

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.bulk_provision.started",
                target_olt=target_olt,
                device_count=len(ont_list),
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "awx_job_id": job_result.get("id"),
                "status": ProvisioningStatus.PROVISIONING.value,
                "device_count": len(ont_list),
                "message": f"Bulk provisioning initiated for {len(ont_list)} ONTs",
            }

        except Exception as e:
            logger.error(
                "device.bulk_provision.failed",
                target_olt=target_olt,
                device_count=len(ont_list),
                error=str(e),
            )

            return {
                "success": False,
                "device_count": len(ont_list),
                "error": str(e),
                "message": "Failed to initiate bulk provisioning",
            }

    async def deprovision_ont(
        self,
        ont_serial: str,
        target_olt: str,
        release_resources: bool = True,
    ) -> dict[str, Any]:
        """
        Deprovision ONT device.

        Args:
            ont_serial: ONT serial number
            target_olt: Target OLT host/group
            release_resources: Release allocated resources

        Returns:
            dict with deprovisioning results
        """
        extra_vars = {
            "ont_serial_number": ont_serial,
            "target_olt": target_olt,
            "release_resources": release_resources,
            "playbook_path": "playbooks/device_management/deprovision_ont.yml",
        }

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.ont.deprovision.started",
                ont_serial=ont_serial,
                target_olt=target_olt,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "device_type": DeviceType.ONT.value,
                "device_serial": ont_serial,
                "awx_job_id": job_result.get("id"),
                "status": "deprovisioning",
                "message": "ONT deprovisioning initiated",
            }

        except Exception as e:
            logger.error(
                "device.ont.deprovision.failed",
                ont_serial=ont_serial,
                target_olt=target_olt,
                error=str(e),
            )

            return {
                "success": False,
                "device_type": DeviceType.ONT.value,
                "device_serial": ont_serial,
                "error": str(e),
                "message": "Failed to deprovision ONT",
            }

    async def firmware_upgrade(
        self,
        device_id: str,
        device_type: DeviceType,
        firmware_version: str,
        firmware_url: str,
    ) -> dict[str, Any]:
        """
        Upgrade device firmware.

        Args:
            device_id: Device ID/serial
            device_type: Type of device
            firmware_version: Target firmware version
            firmware_url: URL to firmware image

        Returns:
            dict with upgrade results
        """
        extra_vars = {
            "device_id": device_id,
            "device_type": device_type.value,
            "firmware_version": firmware_version,
            "firmware_url": firmware_url,
            "playbook_path": PlaybookLibrary.get_playbook_path(PlaybookType.FIRMWARE_UPGRADE),
        }

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.firmware_upgrade.started",
                device_id=device_id,
                device_type=device_type.value,
                firmware_version=firmware_version,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "device_id": device_id,
                "device_type": device_type.value,
                "awx_job_id": job_result.get("id"),
                "firmware_version": firmware_version,
                "status": "upgrading",
                "message": "Firmware upgrade initiated",
            }

        except Exception as e:
            logger.error(
                "device.firmware_upgrade.failed",
                device_id=device_id,
                device_type=device_type.value,
                error=str(e),
            )

            return {
                "success": False,
                "device_id": device_id,
                "device_type": device_type.value,
                "error": str(e),
                "message": "Failed to upgrade firmware",
            }

    async def get_device_status(
        self,
        device_id: str,
        device_type: DeviceType,
        target_host: str,
    ) -> dict[str, Any]:
        """
        Get device operational status.

        Args:
            device_id: Device ID/serial
            device_type: Type of device
            target_host: Target host (OLT for ONTs, router for others)

        Returns:
            dict with device status
        """
        extra_vars = {
            "device_id": device_id,
            "device_type": device_type.value,
            "target_host": target_host,
            "playbook_path": "playbooks/device_management/get_device_status.yml",
        }

        try:
            job_result = await self.awx_client.launch_job_template(self.job_template_id, extra_vars)

            logger.info(
                "device.status.check.started",
                device_id=device_id,
                device_type=device_type.value,
                awx_job_id=job_result.get("id"),
            )

            return {
                "success": True,
                "device_id": device_id,
                "device_type": device_type.value,
                "awx_job_id": job_result.get("id"),
                "message": "Status check initiated",
            }

        except Exception as e:
            logger.error(
                "device.status.check.failed",
                device_id=device_id,
                device_type=device_type.value,
                error=str(e),
            )

            return {
                "success": False,
                "device_id": device_id,
                "device_type": device_type.value,
                "error": str(e),
                "message": "Failed to check device status",
            }
