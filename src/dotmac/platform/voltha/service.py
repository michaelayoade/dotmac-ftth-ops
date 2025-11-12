"""
VOLTHA Service Layer

Business logic for PON network management via VOLTHA.
"""

import base64
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import HTTPException

from dotmac.platform.voltha.client import VOLTHAClient
from dotmac.platform.voltha.schemas import (
    Adapter,
    AlarmAcknowledgeRequest,
    AlarmClearRequest,
    AlarmOperationResponse,
    Device,
    DeviceDetailResponse,
    DeviceListResponse,
    DeviceOperationResponse,
    DeviceType,
    DiscoveredONU,
    LogicalDevice,
    LogicalDeviceDetailResponse,
    LogicalDeviceListResponse,
    ONUDiscoveryResponse,
    ONUProvisionRequest,
    ONUProvisionResponse,
    PONStatistics,
    Port,
    VOLTHAAlarm,
    VOLTHAAlarmListResponse,
    VOLTHAEvent,
    VOLTHAEventStreamResponse,
    VOLTHAHealthResponse,
)

# Python 3.9/3.10 compatibility: UTC was added in 3.11
UTC = UTC

logger = structlog.get_logger(__name__)


def _decode_maybe_base64(payload: bytes | str) -> bytes:
    if isinstance(payload, bytes):
        return payload

    data = payload.strip()
    try:
        padding = len(data) % 4
        if padding:
            data += "=" * (4 - padding)
        return base64.b64decode(data, validate=True)
    except Exception:
        return data.encode("utf-8", errors="ignore")


class VOLTHAService:
    """Service for VOLTHA PON management"""

    @staticmethod
    def _coerce_mapping(payload: Any) -> dict[str, Any]:
        if isinstance(payload, Mapping):
            return dict(payload)
        return {}

    @staticmethod
    def _coerce_int(value: Any) -> int | None:
        try:
            return int(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return None

    def __init__(
        self,
        client: VOLTHAClient | None = None,
        tenant_id: str | None = None,
    ):
        """
        Initialize VOLTHA service

        Args:
            client: VOLTHA client instance (creates new if not provided)
            tenant_id: Tenant ID for multi-tenancy support
        """
        self.client = client or VOLTHAClient(tenant_id=tenant_id)
        self.tenant_id = tenant_id

    # =========================================================================
    # Health and Status
    # =========================================================================

    async def health_check(self) -> VOLTHAHealthResponse:
        """Check VOLTHA health"""
        try:
            health = await self.client.health_check()
            state = health.get("state", "UNKNOWN")
            is_healthy = state == "HEALTHY"

            devices = await self.client.get_devices()
            total_devices = len(devices)

            return VOLTHAHealthResponse(
                healthy=is_healthy,
                state=state,
                message=f"VOLTHA is {state.lower()}",
                total_devices=total_devices,
            )
        except Exception as e:
            logger.error("voltha.health_check.error", error=str(e))
            return VOLTHAHealthResponse(
                healthy=False,
                state="ERROR",
                message=f"Health check failed: {str(e)}",
            )

    # =========================================================================
    # Physical Device Operations (ONUs)
    # =========================================================================

    async def list_devices(self) -> DeviceListResponse:
        """List all physical devices (ONUs)"""
        devices_raw = await self.client.get_devices()
        devices = [Device(**dev) for dev in devices_raw]

        return DeviceListResponse(
            devices=devices,
            total=len(devices),
        )

    async def get_device(self, device_id: str) -> DeviceDetailResponse | None:
        """Get device details"""
        device_raw = await self.client.get_device(device_id)
        if not device_raw:
            return None

        device = Device(**device_raw)
        ports_raw = await self.client.get_device_ports(device_id)
        ports = [Port(**port) for port in ports_raw]

        return DeviceDetailResponse(
            device=device,
            ports=ports,
        )

    async def enable_device(self, device_id: str) -> DeviceOperationResponse:
        """Enable device"""
        try:
            await self.client.enable_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} enabled successfully",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.enable_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to enable device: {str(e)}",
                device_id=device_id,
            )

    async def disable_device(self, device_id: str) -> DeviceOperationResponse:
        """Disable device"""
        try:
            await self.client.disable_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} disabled successfully",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.disable_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to disable device: {str(e)}",
                device_id=device_id,
            )

    async def reboot_device(self, device_id: str) -> DeviceOperationResponse:
        """Reboot device"""
        try:
            await self.client.reboot_device(device_id)
            return DeviceOperationResponse(
                success=True,
                message=f"Device {device_id} reboot initiated",
                device_id=device_id,
            )
        except Exception as e:
            logger.error("voltha.reboot_device.failed", device_id=device_id, error=str(e))
            return DeviceOperationResponse(
                success=False,
                message=f"Failed to reboot device: {str(e)}",
                device_id=device_id,
            )

    async def delete_device(self, device_id: str) -> bool:
        """Delete device"""
        result = await self.client.delete_device(device_id)
        return bool(result)

    async def delete_onu(self, device_id: str) -> bool:
        """Backward-compatible alias for deleting an ONU device."""
        return await self.delete_device(device_id)

    # =========================================================================
    # Logical Device Operations (OLTs)
    # =========================================================================

    async def list_logical_devices(self) -> LogicalDeviceListResponse:
        """List all logical devices (OLTs)"""
        devices_raw = await self.client.get_logical_devices()
        devices = [LogicalDevice(**dev) for dev in devices_raw]

        return LogicalDeviceListResponse(
            devices=devices,
            total=len(devices),
        )

    async def get_logical_device(self, device_id: str) -> LogicalDeviceDetailResponse | None:
        """Get logical device details"""
        device_raw = await self.client.get_logical_device(device_id)
        if not device_raw:
            return None

        device = LogicalDevice(**device_raw)
        ports_raw = await self.client.get_logical_device_ports(device_id)
        flows_raw = await self.client.get_logical_device_flows(device_id)

        return LogicalDeviceDetailResponse(
            device=device,
            ports=ports_raw,
            flows=flows_raw,
        )

    # =========================================================================
    # Statistics and Information
    # =========================================================================

    async def get_pon_statistics(self) -> PONStatistics:
        """Get PON network statistics"""
        logical_devices = await self.client.get_logical_devices()
        physical_devices = await self.client.get_devices()

        online_count = sum(
            1
            for d in physical_devices
            if d.get("connect_status") == "REACHABLE" or d.get("oper_status") == "ACTIVE"
        )
        offline_count = len(physical_devices) - online_count

        # Count flows
        total_flows = 0
        for ld in logical_devices:
            flows = await self.client.get_logical_device_flows(ld.get("id", ""))
            total_flows += len(flows)

        # Get adapters
        adapters_raw = await self.client.get_adapters()
        adapter_ids = [a.get("id", "") for a in adapters_raw]

        return PONStatistics(
            total_olts=len(logical_devices),
            total_onus=len(physical_devices),
            online_onus=online_count,
            offline_onus=offline_count,
            total_flows=total_flows,
            adapters=adapter_ids,
        )

    async def get_adapters(self) -> list[Adapter]:
        """Get all adapters"""
        adapters_raw = await self.client.get_adapters()
        return [Adapter(**adapter) for adapter in adapters_raw]

    async def get_device_types(self) -> list[DeviceType]:
        """Get all device types"""
        types_raw = await self.client.get_device_types()
        return [DeviceType(**dt) for dt in types_raw]

    # =========================================================================
    # Configuration backups
    # =========================================================================

    async def backup_device_configuration(self, device_id: str) -> bytes:
        """Download device configuration snapshot."""
        try:
            response = await self.client.backup_device_configuration(device_id)
        except Exception as exc:  # pragma: no cover - logging path
            logger.error(
                "voltha.backup_configuration.failed",
                device_id=device_id,
                error=str(exc),
            )
            raise

        if isinstance(response, bytes):
            return response
        if isinstance(response, str):
            return _decode_maybe_base64(response)
        if isinstance(response, dict):
            for key in ("content", "config", "data", "payload"):
                payload = response.get(key)
                if isinstance(payload, (bytes, str)):
                    return _decode_maybe_base64(payload)
        # Last resort: convert the repr to bytes for diagnostics.
        return repr(response).encode("utf-8", errors="ignore")

    async def restore_device_configuration(self, device_id: str, payload: bytes | str) -> None:
        """Restore configuration from snapshot payload."""
        data = payload.encode("utf-8") if isinstance(payload, str) else payload
        try:
            await self.client.restore_device_configuration(device_id, data)
        except Exception as exc:  # pragma: no cover - logging path
            logger.error(
                "voltha.restore_configuration.failed",
                device_id=device_id,
                error=str(exc),
            )
            raise

    # =========================================================================
    # ONU Auto-Discovery
    # =========================================================================

    async def discover_onus(self, olt_device_id: str | None = None) -> ONUDiscoveryResponse:
        """
        Discover ONUs on PON network.

        This method scans PON ports for discovered but not yet provisioned ONUs.

        Args:
            olt_device_id: Optional OLT device ID to scan. If None, scans all OLTs.

        Returns:
            ONUDiscoveryResponse with list of discovered ONUs
        """
        from datetime import datetime

        discovered_onus: list[DiscoveredONU] = []
        devices_raw = await self.client.get_devices()
        devices = [self._coerce_mapping(device) for device in devices_raw]
        devices_by_parent: dict[str, list[dict[str, Any]]] = {}

        for device in devices:
            parent_id = device.get("parent_id")
            if parent_id is None:
                continue
            parent_key = str(parent_id)
            devices_by_parent.setdefault(parent_key, []).append(device)

        # Get all logical devices (OLTs) or specific OLT
        if olt_device_id:
            olt_raw = await self.client.get_logical_device(olt_device_id)
            olts = [self._coerce_mapping(olt_raw)] if olt_raw else []
        else:
            olts = [self._coerce_mapping(olt) for olt in await self.client.get_logical_devices()]

        for olt in olts:
            olt_id = olt.get("id")
            if not olt_id:
                continue

            root_device_id = olt.get("root_device_id")
            if root_device_id is None:
                continue

            # Get ports for this OLT
            ports = [
                self._coerce_mapping(port)
                for port in await self.client.get_logical_device_ports(olt_id)
            ]
            olt_devices = devices_by_parent.get(str(root_device_id), [])

            for port in ports:
                port_no = port.get("device_port_no")
                if port_no is None:
                    continue
                try:
                    port_no_int = int(port_no)
                except (TypeError, ValueError):
                    continue

                # Find ONUs connected to this port that are discovered but not provisioned
                for device in olt_devices:
                    # Check if device is child of this OLT and on this port
                    parent_id = device.get("parent_id")
                    parent_port = device.get("parent_port_no")

                    parent_port_int = self._coerce_int(parent_port)
                    if parent_port_int is None:
                        continue

                    if (
                        str(parent_id) == str(olt.get("root_device_id"))
                        and parent_port_int == port_no_int
                    ):
                        serial_value = device.get("serial_number")
                        serial = str(serial_value) if serial_value is not None else ""
                        admin_state = device.get("admin_state")
                        oper_status = device.get("oper_status")

                        # ONU is discovered if it has serial number but is not fully activated
                        if serial and (admin_state != "ENABLED" or oper_status != "ACTIVE"):
                            # Extract vendor ID and vendor specific from serial number
                            # Format is typically: VENDORSPECIFIC (e.g., ALCL12345678)
                            vendor_id = serial[:4] if len(serial) >= 4 else None
                            vendor_specific = serial[4:] if len(serial) > 4 else None

                            proxy_address = self._coerce_mapping(device.get("proxy_address"))
                            onu_id = proxy_address.get("onu_id")

                            discovered_onus.append(
                                DiscoveredONU(
                                    serial_number=serial,
                                    vendor_id=vendor_id,
                                    vendor_specific=vendor_specific,
                                    olt_device_id=str(parent_id),
                                    pon_port=port_no_int,
                                    onu_id=onu_id,
                                    discovered_at=datetime.now(UTC).isoformat(),
                                    status="discovered",
                                )
                            )

        logger.info(
            "voltha.discover_onus",
            olt_device_id=olt_device_id,
            discovered_count=len(discovered_onus),
        )

        return ONUDiscoveryResponse(
            discovered=discovered_onus,
            total=len(discovered_onus),
            olt_device_id=olt_device_id,
        )

    async def provision_onu(
        self,
        provision_request: ONUProvisionRequest | dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> ONUProvisionResponse:
        """
        Provision a discovered ONU.

        This activates the ONU and configures it with the specified parameters.

        Args:
            provision_request: ONU provisioning parameters

        Returns:
            ONUProvisionResponse with provisioning result
        """
        if provision_request is None:
            if not kwargs:
                raise ValueError("provision_request or keyword arguments required")
            provision_request = ONUProvisionRequest(**kwargs)
        elif not isinstance(provision_request, ONUProvisionRequest):
            provision_request = ONUProvisionRequest(**provision_request)

        try:
            # Find the device by serial number
            devices_raw = await self.client.get_devices()
            target_device: dict[str, Any] | None = None

            for raw_device in devices_raw:
                device = self._coerce_mapping(raw_device)
                if device.get("serial_number") == provision_request.serial_number:
                    parent_id = device.get("parent_id")
                    parent_port = device.get("parent_port_no")

                    parent_port_int = self._coerce_int(parent_port)
                    if parent_port_int is None:
                        continue

                    # Verify OLT and port match
                    if (
                        str(parent_id) == str(provision_request.olt_device_id)
                        and parent_port_int == provision_request.pon_port
                    ):
                        target_device = device
                        break

            if not target_device:
                return ONUProvisionResponse(
                    success=False,
                    message=f"ONU with serial {provision_request.serial_number} not found on specified OLT/port",
                    device_id=None,
                    serial_number=provision_request.serial_number,
                    olt_device_id=provision_request.olt_device_id,
                    pon_port=provision_request.pon_port,
                )

            device_id_value = target_device.get("id")
            if not device_id_value:
                raise ValueError("ONU device missing identifier")

            device_id = str(device_id_value)

            # Enable the device
            await self.client.enable_device(device_id)

            # Configure VLAN and bandwidth profile if provided
            config_errors = []

            if provision_request.vlan is not None or provision_request.bandwidth_profile:
                try:
                    await self._configure_onu_service(
                        device_id=device_id,
                        parent_id=provision_request.olt_device_id,
                        vlan=provision_request.vlan,
                        bandwidth_profile=provision_request.bandwidth_profile,
                        qinq_enabled=provision_request.qinq_enabled,
                        inner_vlan=provision_request.inner_vlan,
                    )
                    logger.info(
                        "voltha.provision_onu.service_configured",
                        device_id=device_id,
                        vlan=provision_request.vlan,
                        bandwidth_profile=provision_request.bandwidth_profile,
                        qinq_enabled=provision_request.qinq_enabled,
                        inner_vlan=provision_request.inner_vlan,
                    )
                except Exception as e:
                    error_msg = f"Service configuration failed: {str(e)}"
                    config_errors.append(error_msg)
                    logger.warning(
                        "voltha.provision_onu.service_config_failed",
                        device_id=device_id,
                        error=str(e),
                    )

            logger.info(
                "voltha.provision_onu.success",
                device_id=device_id,
                serial_number=provision_request.serial_number,
                subscriber_id=provision_request.subscriber_id,
                config_errors=config_errors if config_errors else None,
            )

            return ONUProvisionResponse(
                success=True,
                message=f"ONU {provision_request.serial_number} provisioned successfully",
                device_id=device_id,
                serial_number=provision_request.serial_number,
                olt_device_id=provision_request.olt_device_id,
                pon_port=provision_request.pon_port,
            )

        except Exception as e:
            logger.error(
                "voltha.provision_onu.error",
                serial_number=provision_request.serial_number,
                error=str(e),
            )
            return ONUProvisionResponse(
                success=False,
                message=f"Provisioning failed: {str(e)}",
                device_id=None,
                serial_number=provision_request.serial_number,
                olt_device_id=provision_request.olt_device_id,
                pon_port=provision_request.pon_port,
            )

    # =========================================================================
    # Service Configuration (VLAN/Bandwidth)
    # =========================================================================

    async def _configure_onu_service(
        self,
        device_id: str,
        parent_id: str,
        vlan: int | None = None,
        bandwidth_profile: str | None = None,
        technology_profile_id: int = 64,
        qinq_enabled: bool = False,
        inner_vlan: int | None = None,
    ) -> None:
        """
        Configure ONU service parameters (VLAN, bandwidth profile, tech profile).

        This is an internal method called during ONU provisioning to set up:
        1. Technology Profile - Defines GEM ports, schedulers, QoS
        2. VLAN Configuration - Sets up C-TAG/S-TAG for traffic segregation
           - Single VLAN (802.1q): Uses vlan parameter
           - QinQ (802.1ad): Uses vlan (S-VLAN) + inner_vlan (C-VLAN)
        3. Bandwidth Profile - Configures CIR/PIR for traffic shaping

        Args:
            device_id: ONU device ID
            parent_id: Parent OLT device ID
            vlan: Service VLAN (C-TAG for single VLAN, S-VLAN for QinQ)
            bandwidth_profile: Bandwidth profile name
            technology_profile_id: Technology profile ID (default 64)
            qinq_enabled: Enable QinQ (802.1ad) double VLAN tagging
            inner_vlan: Customer VLAN (C-VLAN) for QinQ mode

        Raises:
            Exception: If configuration fails
        """
        # Step 1: Assign Technology Profile
        # Technology profiles define the PON layer parameters
        if technology_profile_id:
            try:
                tp_instance_path = f"service/XGSPON/{technology_profile_id}"
                await self.client.set_technology_profile(
                    device_id=device_id,
                    tp_instance_path=tp_instance_path,
                    tp_id=technology_profile_id,
                )
                logger.info(
                    "voltha.configure_service.tech_profile_assigned",
                    device_id=device_id,
                    tp_id=technology_profile_id,
                )
            except Exception as e:
                logger.warning(
                    "voltha.configure_service.tech_profile_failed",
                    device_id=device_id,
                    error=str(e),
                )
                # Continue with other configuration even if tech profile fails

        # Step 2: Configure VLAN if provided
        # VLAN tagging enables service segregation and subscriber identification
        if vlan is not None:
            try:
                # Phase 2: QinQ (802.1ad) double VLAN tagging
                if qinq_enabled and inner_vlan is not None:
                    await self._configure_qinq_flows(
                        device_id=device_id,
                        parent_id=parent_id,
                        service_vlan=vlan,  # S-VLAN (outer)
                        inner_vlan=inner_vlan,  # C-VLAN (inner)
                    )
                    logger.info(
                        "voltha.configure_service.qinq_configured",
                        device_id=device_id,
                        service_vlan=vlan,
                        inner_vlan=inner_vlan,
                        vlan_type="802.1ad_qinq",
                    )
                else:
                    # Standard single VLAN (802.1q)
                    await self._configure_vlan_flow(
                        device_id=device_id,
                        parent_id=parent_id,
                        vlan=vlan,
                    )
                    logger.info(
                        "voltha.configure_service.vlan_configured",
                        device_id=device_id,
                        vlan=vlan,
                        vlan_type="802.1q_single",
                    )
            except Exception as e:
                logger.error(
                    "voltha.configure_service.vlan_failed",
                    device_id=device_id,
                    vlan=vlan,
                    inner_vlan=inner_vlan,
                    qinq_enabled=qinq_enabled,
                    error=str(e),
                )
                raise

        # Step 3: Configure Bandwidth Profile if provided
        # Bandwidth profiles control traffic shaping (CIR/PIR)
        if bandwidth_profile:
            try:
                await self._configure_bandwidth_profile(
                    device_id=device_id,
                    parent_id=parent_id,
                    profile_name=bandwidth_profile,
                )
                logger.info(
                    "voltha.configure_service.bandwidth_configured",
                    device_id=device_id,
                    profile=bandwidth_profile,
                )
            except Exception as e:
                logger.error(
                    "voltha.configure_service.bandwidth_failed",
                    device_id=device_id,
                    profile=bandwidth_profile,
                    error=str(e),
                )
                raise

    async def _configure_vlan_flow(
        self,
        device_id: str,
        parent_id: str,
        vlan: int,
    ) -> None:
        """
        Configure VLAN flow rules for ONU.

        Creates OpenFlow rules on the OLT to:
        - Tag upstream traffic with specified VLAN
        - Match downstream traffic by VLAN and forward to ONU

        Args:
            device_id: ONU device ID
            parent_id: Parent OLT device ID
            vlan: VLAN tag (C-TAG)
        """
        # Get logical device for the OLT
        logical_devices = await self.client.get_logical_devices()
        logical_device_id = None

        for ld in logical_devices:
            if ld.get("root_device_id") == parent_id:
                logical_device_id = ld.get("id")
                break

        if not logical_device_id:
            raise ValueError(f"Logical device not found for OLT {parent_id}")

        # Get device ports to find the UNI port
        ports = await self.client.get_device_ports(device_id)
        uni_port = None
        for port in ports:
            if port.get("type") == "ETHERNET_UNI":
                uni_port = port.get("port_no")
                break

        if uni_port is None:
            raise ValueError(f"UNI port not found for device {device_id}")

        # Create upstream flow (ONU -> OLT): Add VLAN tag
        upstream_flow = {
            "table_id": 0,
            "priority": 1000,
            "match": {
                "in_port": uni_port,
                "vlan_vid": 0,  # Untagged
            },
            "instructions": [
                {
                    "type": "APPLY_ACTIONS",
                    "actions": [
                        {
                            "type": "PUSH_VLAN",
                            "ethertype": 0x8100,
                        },
                        {
                            "type": "SET_FIELD",
                            "field": "vlan_vid",
                            "value": vlan | 0x1000,  # Set VLAN with present bit
                        },
                        {
                            "type": "OUTPUT",
                            "port": "CONTROLLER",
                        },
                    ],
                }
            ],
        }

        # Create downstream flow (OLT -> ONU): Strip VLAN tag
        downstream_flow = {
            "table_id": 0,
            "priority": 1000,
            "match": {
                "vlan_vid": vlan | 0x1000,  # Match VLAN with present bit
            },
            "instructions": [
                {
                    "type": "APPLY_ACTIONS",
                    "actions": [
                        {
                            "type": "POP_VLAN",
                        },
                        {
                            "type": "OUTPUT",
                            "port": uni_port,
                        },
                    ],
                }
            ],
        }

        # Add flows to logical device
        await self.client.add_flow(logical_device_id, upstream_flow)
        await self.client.add_flow(logical_device_id, downstream_flow)

        logger.info(
            "voltha.vlan_flows_created",
            device_id=device_id,
            logical_device_id=logical_device_id,
            vlan=vlan,
            uni_port=uni_port,
        )

    async def _configure_qinq_flows(
        self,
        device_id: str,
        parent_id: str,
        service_vlan: int,
        inner_vlan: int,
    ) -> None:
        """
        Configure QinQ (802.1ad) double VLAN tagging flows for ONU.

        QinQ provides two levels of VLAN encapsulation:
        - S-VLAN (Service/Outer): Provider's VLAN, uses 802.1ad (ethertype 0x88a8)
        - C-VLAN (Customer/Inner): Customer's VLAN, uses 802.1q (ethertype 0x8100)

        This is used for:
        - Multi-tenant service isolation
        - Hierarchical service provider networks
        - Preserving customer VLAN transparency

        Args:
            device_id: ONU device ID
            parent_id: Parent OLT device ID
            service_vlan: S-VLAN (outer tag, provider VLAN)
            inner_vlan: C-VLAN (inner tag, customer VLAN)

        Flow Configuration:
            Upstream (ONU -> OLT):
                1. Match: Untagged or C-VLAN tagged traffic from UNI port
                2. Action: Push C-VLAN (0x8100), Push S-VLAN (0x88a8)
                3. Forward: To controller/OLT

            Downstream (OLT -> ONU):
                1. Match: Traffic with S-VLAN + C-VLAN
                2. Action: Pop S-VLAN, Pop C-VLAN (deliver untagged to subscriber)
                3. Forward: To UNI port
        """
        # Get logical device for the OLT
        logical_devices = await self.client.get_logical_devices()
        logical_device_id = None

        for ld in logical_devices:
            if ld.get("root_device_id") == parent_id:
                logical_device_id = ld.get("id")
                break

        if not logical_device_id:
            raise ValueError(f"Logical device not found for OLT {parent_id}")

        # Get device ports to find the UNI port
        ports = await self.client.get_device_ports(device_id)
        uni_port = None
        for port in ports:
            if port.get("type") == "ETHERNET_UNI":
                uni_port = port.get("port_no")
                break

        if uni_port is None:
            raise ValueError(f"UNI port not found for device {device_id}")

        # Create upstream QinQ flow (ONU -> OLT): Push C-VLAN then S-VLAN
        upstream_flow = {
            "table_id": 0,
            "priority": 1000,
            "match": {
                "in_port": uni_port,
                "vlan_vid": 0,  # Untagged traffic from subscriber
            },
            "instructions": [
                {
                    "type": "APPLY_ACTIONS",
                    "actions": [
                        # Step 1: Push C-VLAN (customer/inner VLAN) using 802.1q
                        {
                            "type": "PUSH_VLAN",
                            "ethertype": 0x8100,  # 802.1q
                        },
                        {
                            "type": "SET_FIELD",
                            "field": "vlan_vid",
                            "value": inner_vlan | 0x1000,  # Set C-VLAN with present bit
                        },
                        # Step 2: Push S-VLAN (service/outer VLAN) using 802.1ad
                        {
                            "type": "PUSH_VLAN",
                            "ethertype": 0x88A8,  # 802.1ad (QinQ)
                        },
                        {
                            "type": "SET_FIELD",
                            "field": "vlan_vid",
                            "value": service_vlan | 0x1000,  # Set S-VLAN with present bit
                        },
                        {
                            "type": "OUTPUT",
                            "port": "CONTROLLER",
                        },
                    ],
                }
            ],
        }

        # Create downstream QinQ flow (OLT -> ONU): Strip both VLANs
        downstream_flow = {
            "table_id": 0,
            "priority": 1000,
            "match": {
                # Match on outer S-VLAN
                "vlan_vid": service_vlan | 0x1000,  # S-VLAN with present bit
                # Note: Some implementations may need to also match C-VLAN
                # This depends on the VOLTHA/OLT implementation
            },
            "instructions": [
                {
                    "type": "APPLY_ACTIONS",
                    "actions": [
                        # Step 1: Pop S-VLAN (outer tag)
                        {
                            "type": "POP_VLAN",
                        },
                        # Step 2: Pop C-VLAN (inner tag) - deliver untagged to subscriber
                        {
                            "type": "POP_VLAN",
                        },
                        {
                            "type": "OUTPUT",
                            "port": uni_port,
                        },
                    ],
                }
            ],
        }

        # Add flows to logical device
        await self.client.add_flow(logical_device_id, upstream_flow)
        await self.client.add_flow(logical_device_id, downstream_flow)

        logger.info(
            "voltha.qinq_flows_created",
            device_id=device_id,
            logical_device_id=logical_device_id,
            service_vlan=service_vlan,
            inner_vlan=inner_vlan,
            uni_port=uni_port,
            flow_type="802.1ad_qinq",
        )

    async def _configure_bandwidth_profile(
        self,
        device_id: str,
        parent_id: str,
        profile_name: str,
    ) -> None:
        """
        Configure bandwidth profile (meter) for ONU.

        Bandwidth profiles define traffic shaping parameters:
        - CIR (Committed Information Rate): Guaranteed bandwidth
        - CBS (Committed Burst Size): Burst allowance at CIR
        - PIR (Peak Information Rate): Maximum bandwidth
        - PBS (Peak Burst Size): Burst allowance at PIR

        Args:
            device_id: ONU device ID
            parent_id: Parent OLT device ID
            profile_name: Bandwidth profile name (e.g., "100M", "1G")

        Note:
            This is a simplified implementation. In production, bandwidth profiles
            would be looked up from a database or configuration store.
        """
        # Get logical device for the OLT
        logical_devices = await self.client.get_logical_devices()
        logical_device_id = None

        for ld in logical_devices:
            if ld.get("root_device_id") == parent_id:
                logical_device_id = ld.get("id")
                break

        if not logical_device_id:
            raise ValueError(f"Logical device not found for OLT {parent_id}")

        # Parse bandwidth profile name to get rates
        # Format: "XG" where X is the bandwidth in Mbps/Gbps
        # Examples: "100M", "1G", "10G"
        bandwidth_kbps = self._parse_bandwidth_profile(profile_name)

        # Create meter (bandwidth profile) configuration
        # Using Two Rate Three Color Marker (TR-TCM) algorithm
        meter = {
            "flags": ["PKTPS", "BURST", "STATS"],
            "bands": [
                {
                    "type": "DROP",
                    "rate": bandwidth_kbps,  # CIR in kbps
                    "burst_size": bandwidth_kbps * 10,  # CBS in bytes (10ms burst)
                },
                {
                    "type": "DROP",
                    "rate": bandwidth_kbps * 2,  # PIR in kbps (2x CIR)
                    "burst_size": bandwidth_kbps * 20,  # PBS in bytes (20ms burst)
                },
            ],
        }

        # Add meter to logical device
        result = await self.client.add_meter(logical_device_id, meter)
        meter_id = result.get("meter_id")

        logger.info(
            "voltha.bandwidth_profile_created",
            device_id=device_id,
            logical_device_id=logical_device_id,
            profile_name=profile_name,
            bandwidth_kbps=bandwidth_kbps,
            meter_id=meter_id,
        )

    def _parse_bandwidth_profile(self, profile_name: str) -> int:
        """
        Parse bandwidth profile name to get bandwidth in kbps.

        Args:
            profile_name: Profile name (e.g., "100M", "1G", "10G")

        Returns:
            Bandwidth in kbps

        Examples:
            "100M" -> 100000 kbps (100 Mbps)
            "1G" -> 1000000 kbps (1 Gbps)
            "10G" -> 10000000 kbps (10 Gbps)
        """
        profile_name = profile_name.upper().strip()

        # Extract number and unit
        import re

        match = re.match(r"(\d+(?:\.\d+)?)\s*([MG])?", profile_name)
        if not match:
            # Default to 100 Mbps if parsing fails
            logger.warning(
                "voltha.parse_bandwidth_profile.failed",
                profile_name=profile_name,
                default="100M",
            )
            return 100000

        value = float(match.group(1))
        unit = match.group(2) or "M"  # Default to Mbps

        if unit == "G":
            return int(value * 1000000)  # Gbps to kbps
        else:  # "M"
            return int(value * 1000)  # Mbps to kbps

    # =========================================================================
    # Alarms and Events
    # =========================================================================

    async def get_alarms(
        self,
        device_id: str | None = None,
        severity: str | None = None,
        state: str | None = None,
    ) -> VOLTHAAlarmListResponse:
        """
        Get VOLTHA alarms.

        Args:
            device_id: Filter by device ID
            severity: Filter by severity (MINOR, MAJOR, CRITICAL)
            state: Filter by state (RAISED, CLEARED)

        Returns:
            VOLTHAAlarmListResponse with alarms list
        """
        try:
            # VOLTHA API call to get alarms
            alarms_raw = await self.client.get_alarms(
                device_id=device_id,
                severity=severity,
                state=state,
            )

            if isinstance(alarms_raw, dict):
                alarm_items = alarms_raw.get("items", [])
            elif isinstance(alarms_raw, list):
                alarm_items = alarms_raw
            else:
                alarm_items = []

            alarms = []
            for alarm_data in alarm_items:
                # Apply filters
                if severity and alarm_data.get("severity") != severity:
                    continue
                if state and alarm_data.get("state") != state:
                    continue

                alarms.append(VOLTHAAlarm(**alarm_data))

            active_count = sum(1 for a in alarms if a.state == "RAISED")
            cleared_count = sum(1 for a in alarms if a.state == "CLEARED")

            return VOLTHAAlarmListResponse(
                alarms=alarms,
                total=len(alarms),
                active=active_count,
                cleared=cleared_count,
            )

        except Exception as e:
            logger.error("voltha.get_alarms.error", error=str(e))
            return VOLTHAAlarmListResponse(alarms=[], total=0, active=0, cleared=0)

    async def get_events(
        self,
        device_id: str | None = None,
        event_type: str | None = None,
        limit: int = 100,
    ) -> VOLTHAEventStreamResponse:
        """
        Get VOLTHA events.

        Args:
            device_id: Filter by device ID
            event_type: Filter by event type
            limit: Maximum number of events to return

        Returns:
            VOLTHAEventStreamResponse with events list
        """
        try:
            # VOLTHA API call to get events
            events_raw = await self.client.get_events(
                device_id=device_id,
                event_type=event_type,
                limit=limit,
            )

            if isinstance(events_raw, dict):
                event_items = events_raw.get("items", [])
            elif isinstance(events_raw, list):
                event_items = events_raw
            else:
                event_items = []

            events = []
            for event_data in event_items:
                # Apply filters
                if event_type and event_data.get("event_type") != event_type:
                    continue

                events.append(VOLTHAEvent(**event_data))

            return VOLTHAEventStreamResponse(events=events, total=len(events))

        except Exception as e:
            logger.error("voltha.get_events.error", error=str(e))
            return VOLTHAEventStreamResponse(events=[], total=0)

    async def get_alarm(self, alarm_id: str) -> VOLTHAAlarm:
        """
        Get a specific alarm by ID.

        Args:
            alarm_id: The alarm ID to retrieve

        Returns:
            VOLTHAAlarm instance

        Raises:
            HTTPException: If alarm not found or VOLTHA error
        """
        try:
            alarm_data = await self.client.get_alarm(alarm_id)
            return VOLTHAAlarm(**alarm_data)

        except Exception as e:
            logger.error("voltha.get_alarm.error", alarm_id=alarm_id, error=str(e))
            raise HTTPException(status_code=404, detail=f"Alarm {alarm_id} not found") from e

    async def acknowledge_alarm(
        self,
        alarm_id: str,
        request: AlarmAcknowledgeRequest,
    ) -> AlarmOperationResponse:
        """
        Acknowledge an alarm.

        Args:
            alarm_id: The alarm ID to acknowledge
            request: Acknowledgement request with user and optional note

        Returns:
            AlarmOperationResponse with operation status

        Raises:
            HTTPException: If VOLTHA API error occurs
        """
        logger.info(
            "voltha.acknowledge_alarm.attempt",
            alarm_id=alarm_id,
            acknowledged_by=request.acknowledged_by,
        )

        try:
            await self.client.acknowledge_alarm(
                alarm_id=alarm_id,
                acknowledged_by=request.acknowledged_by,
                note=request.note,
            )

            return AlarmOperationResponse(
                success=True,
                message=f"Alarm {alarm_id} acknowledged by {request.acknowledged_by}",
                alarm_id=alarm_id,
                operation="acknowledge",
                timestamp=datetime.now(UTC).isoformat(),
            )

        except Exception as e:
            logger.error("voltha.acknowledge_alarm.error", alarm_id=alarm_id, error=str(e))
            raise HTTPException(
                status_code=500, detail=f"Failed to acknowledge alarm: {str(e)}"
            ) from e

    async def clear_alarm(
        self,
        alarm_id: str,
        request: AlarmClearRequest,
    ) -> AlarmOperationResponse:
        """
        Clear an alarm.

        Args:
            alarm_id: The alarm ID to clear
            request: Clear request with user and optional note

        Returns:
            AlarmOperationResponse with operation status

        Raises:
            HTTPException: If VOLTHA API error occurs
        """
        logger.info(
            "voltha.clear_alarm.attempt",
            alarm_id=alarm_id,
            cleared_by=request.cleared_by,
        )

        try:
            await self.client.clear_alarm(
                alarm_id=alarm_id,
                cleared_by=request.cleared_by,
                note=request.note,
            )

            return AlarmOperationResponse(
                success=True,
                message=f"Alarm {alarm_id} cleared by {request.cleared_by}",
                alarm_id=alarm_id,
                operation="clear",
                timestamp=datetime.now(UTC).isoformat(),
            )

        except Exception as e:
            logger.error("voltha.clear_alarm.error", alarm_id=alarm_id, error=str(e))
            raise HTTPException(status_code=500, detail=f"Failed to clear alarm: {str(e)}") from e
