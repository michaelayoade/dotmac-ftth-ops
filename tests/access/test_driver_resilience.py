from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from dotmac.platform.access.drivers.base import DeviceDiscovery, DriverContext
from dotmac.platform.access.drivers.huawei import HuaweiCLIDriver, HuaweiDriverConfig
from dotmac.platform.access.drivers.voltha import VolthaDriver, VolthaDriverConfig
from dotmac.platform.voltha.schemas import PONStatistics

pytestmark = pytest.mark.unit


@pytest.mark.asyncio
async def test_huawei_collect_metrics_prefers_snmp(
    huawei_driver_config: HuaweiDriverConfig,
    huawei_driver_context,
):
    driver = HuaweiCLIDriver(huawei_driver_config, huawei_driver_context)
    metrics = await driver.collect_metrics()

    assert metrics.pon_ports_total == 16
    assert metrics.pon_ports_up == 14
    assert metrics.onu_total == 512
    assert metrics.onu_online == 480
    assert metrics.upstream_rate_mbps == pytest.approx(1024.0)
    assert metrics.downstream_rate_mbps == pytest.approx(2048.0)
    assert metrics.raw["source"] == "snmp"


@pytest.mark.asyncio
async def test_huawei_collect_metrics_falls_back_to_cli(
    huawei_driver_config: HuaweiDriverConfig,
    huawei_driver_context,
    monkeypatch: pytest.MonkeyPatch,
):
    # Replace SNMP collector to raise so fallback path is executed.
    huawei_driver_context.hooks["snmp_collector"] = AsyncMock(side_effect=RuntimeError("boom"))

    driver = HuaweiCLIDriver(huawei_driver_config, huawei_driver_context)
    discovery = [
        DeviceDiscovery(onu_id="0/1/0/1", serial_number="HW001", state="online"),
        DeviceDiscovery(onu_id="0/1/0/2", serial_number="HW002", state="offline"),
    ]
    monkeypatch.setattr(driver, "discover_onus", AsyncMock(return_value=discovery))

    metrics = await driver.collect_metrics()

    assert metrics.onu_total == 2
    assert metrics.onu_online == 1
    assert metrics.raw["source"] == "cli"
    assert any("snmp_collection_failed" in warning for warning in metrics.raw.get("warnings", []))


@pytest.mark.asyncio
async def test_huawei_restore_configuration_invokes_cli(
    huawei_driver_config: HuaweiDriverConfig,
    huawei_driver_context,
    monkeypatch: pytest.MonkeyPatch,
):
    driver = HuaweiCLIDriver(huawei_driver_config, huawei_driver_context)
    run_config = AsyncMock()
    monkeypatch.setattr(driver, "_run_config_commands", run_config)

    payload = "\n".join(
        [
            "# backup generated on 2024-01-01",
            "sysname OLT-1",
            "interface gpon 0/1",
            "  description To-ISP",
            "quit",
        ]
    ).encode("utf-8")

    await driver.restore_configuration(payload)

    run_config.assert_awaited_once()
    commands = list(run_config.await_args.args[0])
    assert commands[0] == "system-view"
    assert commands[1] == "sysname OLT-1"
    assert commands[-1] == "quit"


@pytest.mark.asyncio
async def test_huawei_backup_configuration_encodes_cli_output(
    huawei_driver_config: HuaweiDriverConfig,
    huawei_driver_context,
    monkeypatch: pytest.MonkeyPatch,
):
    driver = HuaweiCLIDriver(huawei_driver_config, huawei_driver_context)
    monkeypatch.setattr(
        driver,
        "_run_exec_command",
        AsyncMock(return_value="sysname OLT-1\ninterface gpon 0/1\n"),
    )

    payload = await driver.backup_configuration()
    assert payload.startswith(b"sysname OLT-1")


@pytest.mark.asyncio
async def test_voltha_collect_metrics_combines_sources(
    voltha_driver_config: VolthaDriverConfig,
    voltha_driver_context,
):
    driver = VolthaDriver(voltha_driver_config, voltha_driver_context)
    stats = PONStatistics(
        total_olts=1,
        total_onus=64,
        online_onus=60,
        offline_onus=4,
        total_flows=128,
        adapters=["openolt"],
    )
    driver.service.get_pon_statistics = AsyncMock(return_value=stats)

    metrics = await driver.collect_metrics()

    assert metrics.onu_total == 64
    assert metrics.onu_online == 60
    assert metrics.pon_ports_up == 7
    assert metrics.pon_ports_total == 8
    assert metrics.upstream_rate_mbps == pytest.approx(1000.0)
    assert metrics.downstream_rate_mbps == pytest.approx(2000.0)
    assert "voltha" in metrics.raw and "snmp" in metrics.raw


@pytest.mark.asyncio
async def test_voltha_collect_metrics_without_snmp(
    voltha_driver_config: VolthaDriverConfig,
):
    config = voltha_driver_config.model_copy()
    config.snmp = None
    driver = VolthaDriver(config, DriverContext())
    stats = PONStatistics(
        total_olts=1,
        total_onus=8,
        online_onus=6,
        offline_onus=2,
        total_flows=32,
        adapters=["openolt"],
    )
    driver.service.get_pon_statistics = AsyncMock(return_value=stats)

    metrics = await driver.collect_metrics()

    assert metrics.onu_total == 8
    assert metrics.onu_online == 6
    assert metrics.raw["voltha"]["total_onus"] == 8


@pytest.mark.asyncio
async def test_voltha_backup_restore_delegate_service(
    voltha_driver_config: VolthaDriverConfig,
    voltha_driver_context,
):
    driver = VolthaDriver(voltha_driver_config, voltha_driver_context)
    driver.service.backup_device_configuration = AsyncMock(return_value=b"config")
    driver.service.restore_device_configuration = AsyncMock()

    payload = await driver.backup_configuration()
    assert payload == b"config"
    driver.service.backup_device_configuration.assert_awaited_once_with(
        voltha_driver_config.olt_device_id
    )

    await driver.restore_configuration(b"restored")
    driver.service.restore_device_configuration.assert_awaited_once_with(
        voltha_driver_config.olt_device_id, b"restored"
    )
