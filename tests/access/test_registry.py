from pathlib import Path

import pytest

from dotmac.platform.access.drivers.base import (
    BaseOLTDriver,
    DeviceDiscovery,
    DriverCapabilities,
    DriverConfig,
    DriverContext,
    OltMetrics,
    ONUProvisionRequest,
    ONUProvisionResult,
)
from dotmac.platform.access.registry import AccessDriverRegistry, DriverDescriptor


class DummyDriver(BaseOLTDriver):
    async def discover_onus(self):
        return [
            DeviceDiscovery(onu_id="0/1/1/1", serial_number="TEST1234", state="online"),
        ]

    async def get_capabilities(self):
        return DriverCapabilities()

    async def list_logical_devices(self):
        """Return logical device (OLT) information."""
        return [{"id": self.config.olt_id, "type": "olt", "state": "active"}]

    async def list_devices(self):
        """Return physical device/ONU information."""
        return [{"id": "0/1/1/1", "serial": "TEST1234", "state": "online"}]

    async def get_device(self, device_id: str):
        """Return a specific device."""
        if device_id == "0/1/1/1":
            return {"id": device_id, "serial": "TEST1234", "state": "online"}
        return None

    async def provision_onu(self, request: ONUProvisionRequest):
        return ONUProvisionResult(success=True)

    async def remove_onu(self, onu_id: str) -> bool:
        return True

    async def apply_service_profile(self, onu_id: str, service_profile: dict):
        return ONUProvisionResult(success=True)

    async def collect_metrics(self):
        return OltMetrics(
            olt_id=self.config.olt_id,
            pon_ports_up=0,
            pon_ports_total=0,
            onu_online=1,
            onu_total=1,
        )

    async def fetch_alarms(self):
        return []

    async def backup_configuration(self):
        return b""

    async def restore_configuration(self, payload: bytes):
        return None

    async def operate_device(self, device_id: str, operation: str) -> bool:
        """Perform a device operation (enable/disable/reboot)."""
        return True

    async def get_health(self):
        """Return health information."""
        return {"status": "healthy", "olt_id": self.config.olt_id}


@pytest.mark.asyncio
async def test_registry_manual_registration():
    registry = AccessDriverRegistry()
    descriptor = DriverDescriptor(
        driver_cls=DummyDriver,
        config=DriverConfig(olt_id="olt-1", host="127.0.0.1"),
        context=DriverContext(),
    )
    registry.register(descriptor)

    driver_descriptor = registry.get("olt-1")
    driver = driver_descriptor.driver_cls(driver_descriptor.config, driver_descriptor.context)
    discovery = await driver.discover_onus()
    assert discovery[0].serial_number == "TEST1234"


def test_registry_from_config_file(tmp_path: Path):
    config = """
olts:
  - olt_id: olt-1
    driver: tests.access.test_registry.DummyDriver
    host: 192.0.2.1
"""
    file = tmp_path / "drivers.yaml"
    file.write_text(config, encoding="utf-8")

    registry = AccessDriverRegistry.from_config_file(file)
    descriptor = registry.get("olt-1")
    assert descriptor.config.host == "192.0.2.1"
