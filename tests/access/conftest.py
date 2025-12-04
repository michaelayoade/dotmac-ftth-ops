from __future__ import annotations

from typing import Any

import pytest

from dotmac.platform.access.drivers.base import DriverContext
from dotmac.platform.access.drivers.huawei import HuaweiDriverConfig
from dotmac.platform.access.drivers.voltha import VolthaDriverConfig


@pytest.fixture
def huawei_snmp_collector() -> Any:
    async def _collector(
        *,
        host: str,
        community: str,
        oids: dict[str, str],
        port: int,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        return {
            "pon_ports_total": 16,
            "pon_ports_up": 14,
            "onu_total": 512,
            "onu_online": 480,
            "upstream_rate_kbps": 1_024_000,
            "downstream_rate_kbps": 2_048_000,
        }

    return _collector


@pytest.fixture
def voltha_snmp_collector() -> Any:
    async def _collector(
        *,
        host: str,
        community: str,
        oids: dict[str, str],
        port: int,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        return {
            "pon_ports_total": 8,
            "pon_ports_up": 7,
            "onu_total": 64,
            "onu_online": 60,
            "upstream_rate_bps": 1_000_000_000,
            "downstream_rate_bps": 2_000_000_000,
        }

    return _collector


@pytest.fixture
def huawei_driver_config() -> HuaweiDriverConfig:
    return HuaweiDriverConfig(
        olt_id="olt-huawei-1",
        host="192.0.2.10",
        username="admin",
        password="password",
        snmp={"community": "public", "port": 161},
    )


@pytest.fixture
def huawei_driver_context(huawei_snmp_collector: Any) -> DriverContext:
    return DriverContext(
        tenant_id="tenant-huawei",
        hooks={"snmp_collector": huawei_snmp_collector},
    )


@pytest.fixture
def voltha_driver_config() -> VolthaDriverConfig:
    return VolthaDriverConfig(
        olt_id="olt-voltha-1",
        olt_device_id="olt-device-1",
        host="198.51.100.20",
        snmp={"community": "public", "port": 161},
    )


@pytest.fixture
def voltha_driver_context(voltha_snmp_collector: Any) -> DriverContext:
    return DriverContext(
        tenant_id="tenant-voltha",
        hooks={"snmp_collector": voltha_snmp_collector},
    )
