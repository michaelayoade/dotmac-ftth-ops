"""
Ansible Playbook Library for ISP Workflows.

Manages playbook templates and execution for common ISP operations.
"""

from enum import Enum
from pathlib import Path
from typing import Any

import structlog

logger = structlog.get_logger(__name__)


class PlaybookType(str, Enum):
    """Types of ISP playbooks"""

    FIBER_PROVISION = "fiber_service_provision"
    ONT_PROVISION = "provision_ont"
    ROUTER_CONFIG = "configure_router"
    SERVICE_SUSPEND = "suspend_service"
    SERVICE_RESUME = "resume_service"
    SERVICE_TERMINATE = "terminate_service"
    BANDWIDTH_CHANGE = "change_bandwidth"
    VLAN_CHANGE = "change_vlan"
    DEVICE_REBOOT = "reboot_device"
    CONFIG_BACKUP = "backup_configuration"
    FIRMWARE_UPGRADE = "upgrade_firmware"


class PlaybookLibrary:
    """Library of ISP automation playbooks"""

    # Playbook paths relative to ansible directory
    PLAYBOOK_PATHS = {
        PlaybookType.FIBER_PROVISION: "playbooks/provisioning/fiber_service_provision.yml",
        PlaybookType.ONT_PROVISION: "playbooks/device_management/provision_ont.yml",
        PlaybookType.ROUTER_CONFIG: "playbooks/router_config/configure_router.yml",
        PlaybookType.SERVICE_SUSPEND: "playbooks/provisioning/suspend_service.yml",
        PlaybookType.SERVICE_RESUME: "playbooks/provisioning/resume_service.yml",
        PlaybookType.SERVICE_TERMINATE: "playbooks/provisioning/terminate_service.yml",
        PlaybookType.BANDWIDTH_CHANGE: "playbooks/router_config/change_bandwidth.yml",
        PlaybookType.VLAN_CHANGE: "playbooks/router_config/change_vlan.yml",
        PlaybookType.DEVICE_REBOOT: "playbooks/device_management/reboot_device.yml",
        PlaybookType.CONFIG_BACKUP: "playbooks/device_management/backup_config.yml",
        PlaybookType.FIRMWARE_UPGRADE: "playbooks/device_management/firmware_upgrade.yml",
    }

    @classmethod
    def get_playbook_path(cls, playbook_type: PlaybookType) -> str:
        """Get full path to playbook"""
        return cls.PLAYBOOK_PATHS.get(playbook_type, "")

    @classmethod
    def build_fiber_provision_vars(
        cls,
        service_instance_id: str,
        customer_id: str,
        ont_serial: str,
        vlan_id: int,
        download_speed_mbps: int,
        upload_speed_mbps: int,
        target_olt: str,
        callback_url: str | None = None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """Build variables for fiber provisioning playbook"""
        return {
            "service_instance_id": service_instance_id,
            "customer_id": customer_id,
            "ont_serial_number": ont_serial,
            "service_vlan": vlan_id,
            "bandwidth_profile_name": f"BP_{download_speed_mbps}M_{upload_speed_mbps}M",
            "download_speed_kbps": download_speed_mbps * 1000,
            "upload_speed_kbps": upload_speed_mbps * 1000,
            "target_olt": target_olt,
            "callback_url": callback_url,
            "api_token": api_token,
        }

    @classmethod
    def build_router_config_vars(
        cls,
        router_id: str,
        customer_id: str,
        service_id: str,
        wan_ip: str,
        wan_netmask: str,
        wan_gateway: str,
        lan_ip: str,
        lan_netmask: str,
        lan_network: str,
        vlan_id: int | None = None,
        wifi_ssid: str | None = None,
        wifi_password: str | None = None,
        dns_servers: list[str] | None = None,
        callback_url: str | None = None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """Build variables for router configuration playbook"""
        vars_dict: dict[str, Any] = {
            "router_device_id": router_id,
            "customer_id": customer_id,
            "service_id": service_id,
            "assigned_wan_ip": wan_ip,
            "wan_netmask": wan_netmask,
            "isp_gateway_ip": wan_gateway,
            "lan_ip": lan_ip,
            "lan_netmask": lan_netmask,
            "lan_network": lan_network,
            "lan_wildcard": cls._calculate_wildcard(lan_netmask),
            "target_router": router_id,
            "callback_url": callback_url,
            "api_token": api_token,
        }

        if vlan_id:
            vars_dict["service_vlan"] = vlan_id

        if wifi_ssid:
            vars_dict["enable_wifi"] = True
            vars_dict["wifi_network_name"] = wifi_ssid
            vars_dict["wifi_network_password"] = wifi_password or ""

        if dns_servers:
            vars_dict["dns_server_list"] = dns_servers

        return vars_dict

    @classmethod
    def build_ont_provision_vars(
        cls,
        ont_serial: str,
        customer_id: str,
        target_olt: str,
        service_profile: str = "default",
        auto_discover: bool = True,
        callback_url: str | None = None,
        api_token: str | None = None,
    ) -> dict[str, Any]:
        """Build variables for ONT provisioning playbook"""
        return {
            "ont_serial_number": ont_serial,
            "customer_id": customer_id,
            "target_olt": target_olt,
            "service_profile_name": service_profile,
            "enable_auto_discovery": auto_discover,
            "callback_url": callback_url,
            "api_token": api_token,
        }

    @classmethod
    def build_service_suspend_vars(
        cls,
        service_instance_id: str,
        ont_serial: str,
        target_olt: str,
        suspension_reason: str,
    ) -> dict[str, Any]:
        """Build variables for service suspension playbook"""
        return {
            "service_instance_id": service_instance_id,
            "ont_serial_number": ont_serial,
            "target_olt": target_olt,
            "suspension_reason": suspension_reason,
        }

    @classmethod
    def build_service_terminate_vars(
        cls,
        service_instance_id: str,
        ont_serial: str,
        vlan_id: int,
        target_olt: str,
        release_resources: bool = True,
    ) -> dict[str, Any]:
        """Build variables for service termination playbook"""
        return {
            "service_instance_id": service_instance_id,
            "ont_serial_number": ont_serial,
            "service_vlan": vlan_id,
            "target_olt": target_olt,
            "release_network_resources": release_resources,
        }

    @staticmethod
    def _calculate_wildcard(netmask: str) -> str:
        """Calculate wildcard mask from netmask"""
        # Convert netmask to wildcard (255.255.255.0 -> 0.0.0.255)
        octets = netmask.split(".")
        wildcard_octets = [str(255 - int(octet)) for octet in octets]
        return ".".join(wildcard_octets)

    @classmethod
    def validate_playbook_exists(cls, playbook_type: PlaybookType, base_path: Path) -> bool:
        """Check if playbook file exists"""
        playbook_rel_path = cls.get_playbook_path(playbook_type)
        if not playbook_rel_path:
            return False

        full_path = base_path / playbook_rel_path
        exists = full_path.exists()

        if not exists:
            logger.warning(
                "playbook.not_found",
                playbook_type=playbook_type.value,
                expected_path=str(full_path),
            )

        return exists

    @classmethod
    def list_available_playbooks(cls, base_path: Path) -> list[PlaybookType]:
        """List all available playbooks"""
        available = []
        for playbook_type in PlaybookType:
            if cls.validate_playbook_exists(playbook_type, base_path):
                available.append(playbook_type)
        return available
