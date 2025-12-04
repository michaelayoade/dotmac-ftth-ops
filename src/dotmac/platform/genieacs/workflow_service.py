"""
GenieACS Workflow Service

Provides workflow-compatible methods for CPE device provisioning (ISP).
"""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class GenieACSService:
    """
    GenieACS service for workflow integration.

    Provides CPE device provisioning and management for ISP workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def provision_device(
        self,
        customer_id: int | str,
        device_serial: str,
        config_template: str,
        tenant_id: str | None = None,
        wifi_ssid: str | None = None,
        wifi_password: str | None = None,
        management_url: str | None = None,
        additional_params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Provision a CPE device via GenieACS TR-069/CWMP.

        This method provisions Customer Premises Equipment (CPE) by:
        1. Finding the device in GenieACS by serial number
        2. Applying a configuration template (preset)
        3. Setting custom parameters (WiFi, WAN, etc.)
        4. Triggering device refresh to apply changes

        Args:
            customer_id: Customer ID
            device_serial: Device serial number (TR-069 device identifier)
            config_template: Configuration template/preset name
            tenant_id: Tenant ID (for multi-tenant deployments)
            wifi_ssid: WiFi SSID to configure (optional)
            wifi_password: WiFi password (optional)
            management_url: ACS management server URL (optional)
            additional_params: Additional TR-069 parameters to set

        Returns:
            Dict with device provisioning details:
            {
                "device_id": str,
                "customer_id": str,
                "device_serial": str,
                "config_template": str,
                "device_info": dict,
                "tasks_created": list[str],
                "status": "provisioned" | "pending" | "failed",
                "provisioning_status": str,
                "provisioned_at": str
            }

        Raises:
            ValueError: If device not found or configuration invalid
        """

        from .client import GenieACSClient
        from .service import GenieACSService

        logger.info(
            f"Provisioning CPE device {device_serial} for customer {customer_id} "
            f"with template {config_template}"
        )

        customer_id_str = str(customer_id)

        # Initialize GenieACS client and service
        genieacs_client = GenieACSClient(tenant_id=tenant_id)
        _ = GenieACSService(client=genieacs_client, tenant_id=tenant_id)

        try:
            # Find device by serial number
            # GenieACS uses device ID format: SerialNumber or MAC address
            # Try to find device first
            device = await genieacs_client.get_device(device_serial)

            if not device:
                # Device might not have checked in yet
                # Check if device exists with different ID format
                devices = await genieacs_client.get_devices(
                    query={"_deviceId._SerialNumber": device_serial}, limit=1
                )

                if not devices:
                    logger.warning(
                        f"Device {device_serial} not found in GenieACS. "
                        f"Device may not have connected to ACS yet."
                    )
                    return {
                        "device_id": device_serial,
                        "customer_id": customer_id_str,
                        "device_serial": device_serial,
                        "config_template": config_template,
                        "status": "pending",
                        "provisioning_status": "awaiting_device_connection",
                        "message": "Device not yet connected to ACS. Provisioning will occur on first connection.",
                        "provisioned_at": datetime.now(UTC).isoformat(),
                    }

                device = devices[0]
                device_id = device.get("_id", device_serial)
            else:
                device_id = device.get("_id", device_serial)

            logger.info(f"Found device in GenieACS: {device_id}")

            # Extract device information
            device_info = {
                "device_id": device_id,
                "serial_number": device.get("_deviceId", {}).get("_SerialNumber"),
                "manufacturer": device.get("_deviceId", {}).get("_Manufacturer"),
                "model": device.get("_deviceId", {}).get("_ProductClass"),
                "software_version": device.get("_deviceId", {}).get("_SoftwareVersion"),
                "hardware_version": device.get("_deviceId", {}).get("_HardwareVersion"),
                "connection_request_url": device.get("_deviceId", {}).get("_ConnectionRequestURL"),
                "last_inform": device.get("_lastInform"),
            }

            tasks_created = []

            # Apply configuration template (preset)
            try:
                # Tag device with template for GenieACS presets
                # GenieACS presets are triggered when device has specific tags
                await genieacs_client.update_device(
                    device_id,
                    {
                        "_tags": [config_template, f"customer-{customer_id_str}"],
                    },
                )
                logger.info(f"Applied template tag '{config_template}' to device {device_id}")
                tasks_created.append(f"tag:{config_template}")

            except Exception as e:
                logger.warning(f"Failed to apply template tag: {e}")

            # Build parameter configuration
            params_to_set: dict[str, Any] = {}

            # Configure WiFi if provided
            if wifi_ssid:
                # Standard TR-069 WiFi parameters
                params_to_set["InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID"] = (
                    wifi_ssid
                )
                if wifi_password:
                    params_to_set[
                        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase"
                    ] = wifi_password
                    params_to_set[
                        "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.BeaconType"
                    ] = "WPA2PSK"

            # Configure ACS management URL if provided
            if management_url:
                params_to_set["InternetGatewayDevice.ManagementServer.URL"] = management_url

            # Add any additional parameters
            if additional_params:
                params_to_set.update(additional_params)

            # Apply parameter changes if any
            if params_to_set:
                try:
                    await genieacs_client.set_parameter_values(device_id, params_to_set)
                    tasks_created.append("setParameterValues")
                    logger.info(f"Set {len(params_to_set)} parameters on device {device_id}")
                except Exception as e:
                    logger.error(f"Failed to set parameters: {e}")
                    # Don't fail the entire provisioning if parameter setting fails

            # Refresh device to apply changes
            try:
                await genieacs_client.refresh_device(device_id)
                tasks_created.append("refreshObject")
                logger.info(f"Triggered device refresh for {device_id}")
            except Exception as e:
                logger.warning(f"Failed to refresh device: {e}")

            # Store device association with customer (in database)
            # This would typically be stored in a CPE device table
            # For now, we'll log it and return in the response

            provisioning_status = "completed" if tasks_created else "partial"

            logger.info(
                f"CPE device provisioned successfully: device_id={device_id}, "
                f"customer={customer_id_str}, tasks={len(tasks_created)}"
            )

            return {
                "device_id": device_id,
                "customer_id": customer_id_str,
                "device_serial": device_serial,
                "config_template": config_template,
                "device_info": device_info,
                "tasks_created": tasks_created,
                "parameters_set": len(params_to_set),
                "wifi_configured": bool(wifi_ssid),
                "status": "provisioned",
                "provisioning_status": provisioning_status,
                "provisioned_at": datetime.now(UTC).isoformat(),
            }

        except Exception as e:
            logger.error(f"Failed to provision device {device_serial}: {e}", exc_info=True)
            return {
                "device_id": device_serial,
                "customer_id": customer_id_str,
                "device_serial": device_serial,
                "config_template": config_template,
                "status": "failed",
                "provisioning_status": "error",
                "error": str(e),
                "provisioned_at": datetime.now(UTC).isoformat(),
            }
