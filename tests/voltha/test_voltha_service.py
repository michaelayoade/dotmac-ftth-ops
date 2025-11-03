"""
Unit tests for VOLTHA Service layer
"""

from __future__ import annotations

import base64
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from dotmac.platform.voltha.client import VOLTHAClient
from dotmac.platform.voltha.schemas import ONUProvisionRequest
from dotmac.platform.voltha.service import VOLTHAService


def make_service_with_client() -> tuple[VOLTHAService, MagicMock]:
    """Helper to create service with mocked client."""
    mock_client = MagicMock(spec=VOLTHAClient)
    return VOLTHAService(client=mock_client), mock_client


@pytest.mark.integration
class TestVOLTHAServiceStatistics:
    """Tests covering statistics aggregation."""

    @pytest.mark.asyncio
    async def test_get_pon_statistics_aggregates_values(self):
        service, client = make_service_with_client()

        client.get_logical_devices = AsyncMock(return_value=[{"id": "olt-1"}, {"id": "olt-2"}])
        client.get_devices = AsyncMock(
            return_value=[
                {"id": "onu-1", "connect_status": "REACHABLE"},
                {"id": "onu-2", "oper_status": "ACTIVE"},
                {"id": "onu-3", "connect_status": "UNREACHABLE"},
            ]
        )
        client.get_logical_device_flows = AsyncMock(
            side_effect=[[{"id": "flow-1"}], [{"id": "flow-2"}, {"id": "flow-3"}]]
        )
        client.get_adapters = AsyncMock(return_value=[{"id": "openolt"}, {"id": "onu"}])

        stats = await service.get_pon_statistics()

        assert stats.total_olts == 2
        assert stats.total_onus == 3
        assert stats.online_onus == 2
        assert stats.offline_onus == 1
        assert stats.total_flows == 3
        assert stats.adapters == ["openolt", "onu"]

        client.get_logical_device_flows.assert_awaited()


@pytest.mark.integration
class TestVOLTHAServiceDiscovery:
    """Tests for ONU discovery logic."""

    @pytest.mark.asyncio
    async def test_discover_onus_uses_cached_devices(self):
        service, client = make_service_with_client()

        client.get_devices = AsyncMock(
            return_value=[
                {
                    "id": "onu-1",
                    "parent_id": "olt-root-1",
                    "parent_port_no": 1,
                    "serial_number": "ALCL12345678",
                    "admin_state": "DISABLED",
                    "oper_status": "DISCOVERED",
                    "proxy_address": {"onu_id": 10},
                },
                {
                    "id": "onu-2",
                    "parent_id": "olt-root-1",
                    "parent_port_no": 2,
                    "serial_number": "ALCL87654321",
                    "admin_state": "ENABLED",
                    "oper_status": "ACTIVE",
                },
            ]
        )
        client.get_logical_devices = AsyncMock(
            return_value=[
                {
                    "id": "olt-1",
                    "root_device_id": "olt-root-1",
                }
            ]
        )
        client.get_logical_device_ports = AsyncMock(
            return_value=[
                {"device_port_no": 1},
                {"device_port_no": 2},
            ]
        )

        response = await service.discover_onus()

        client.get_devices.assert_awaited_once()
        client.get_logical_devices.assert_awaited_once()
        client.get_logical_device_ports.assert_awaited_once_with("olt-1")

        assert response.total == 1
        discovered = response.discovered[0]
        assert discovered.serial_number == "ALCL12345678"
        assert discovered.vendor_id == "ALCL"
        assert discovered.vendor_specific == "12345678"
        assert discovered.pon_port == 1
        assert discovered.onu_id == 10


@pytest.mark.integration
class TestVOLTHAServiceAlarms:
    """Tests for alarm aggregation and filtering."""

    @pytest.mark.asyncio
    async def test_get_alarms_filters_and_counts(self):
        service, client = make_service_with_client()

        client.get_alarms = AsyncMock(
            return_value={
                "items": [
                    {
                        "id": "1",
                        "type": "onu_los",
                        "category": "ONU",
                        "severity": "CRITICAL",
                        "state": "RAISED",
                        "resource_id": "onu-1",
                        "raised_ts": "2024-01-01T00:00:00Z",
                    },
                    {
                        "id": "2",
                        "type": "onu_los",
                        "category": "ONU",
                        "severity": "MINOR",
                        "state": "CLEARED",
                        "resource_id": "onu-2",
                        "raised_ts": "2024-01-01T01:00:00Z",
                    },
                ]
            }
        )

        result = await service.get_alarms(severity="CRITICAL", state="RAISED")

        client.get_alarms.assert_awaited_once_with(
            device_id=None,
            severity="CRITICAL",
            state="RAISED",
        )

        assert result.total == 1
        assert result.active == 1
        assert result.cleared == 0
        assert result.alarms[0].severity == "CRITICAL"

    @pytest.mark.asyncio
    async def test_get_alarms_handles_list_payload(self):
        service, client = make_service_with_client()

        client.get_alarms = AsyncMock(
            return_value=[
                {
                    "id": "3",
                    "type": "olt_port_down",
                    "category": "OLT",
                    "severity": "MAJOR",
                    "state": "RAISED",
                    "resource_id": "olt-1",
                    "raised_ts": "2024-01-02T00:00:00Z",
                }
            ]
        )

        result = await service.get_alarms()

        assert result.total == 1
        assert result.active == 1
        assert result.alarms[0].category == "OLT"


@pytest.mark.integration
class TestVOLTHAServiceEvents:
    """Tests for event stream handling."""

    @pytest.mark.asyncio
    async def test_get_events_filters_event_type(self):
        service, client = make_service_with_client()

        client.get_events = AsyncMock(
            return_value={
                "items": [
                    {
                        "id": "evt-1",
                        "event_type": "onu_discovered",
                        "category": "ONU",
                        "resource_id": "onu-1",
                        "timestamp": "2024-01-01T00:00:00Z",
                    },
                    {
                        "id": "evt-2",
                        "event_type": "olt_port_down",
                        "category": "OLT",
                        "resource_id": "olt-1",
                        "timestamp": "2024-01-01T00:05:00Z",
                    },
                ]
            }
        )

        result = await service.get_events(event_type="onu_discovered")

        client.get_events.assert_awaited_once_with(
            device_id=None,
            event_type="onu_discovered",
            limit=100,
        )

        assert result.total == 1
        assert all(event.event_type == "onu_discovered" for event in result.events)

    @pytest.mark.asyncio
    async def test_get_events_handles_list_payload(self):
        service, client = make_service_with_client()

        client.get_events = AsyncMock(
            return_value=[
                {
                    "id": "evt-3",
                    "event_type": "onu_activated",
                    "category": "ONU",
                    "resource_id": "onu-5",
                    "timestamp": "2024-01-03T00:00:00Z",
                }
            ]
        )

        result = await service.get_events()

        assert result.total == 1
        assert result.events[0].event_type == "onu_activated"


@pytest.mark.integration
class TestVOLTHAServiceConfiguration:
    """Tests for configuration backup and restore helpers."""

    @pytest.mark.asyncio
    async def test_backup_device_configuration_decodes_base64(self):
        service, client = make_service_with_client()
        payload = base64.b64encode(b"config-bytes").decode("ascii")
        client.backup_device_configuration = AsyncMock(return_value={"content": payload})

        result = await service.backup_device_configuration("device-1")

        assert result == b"config-bytes"
        client.backup_device_configuration.assert_awaited_once_with("device-1")

    @pytest.mark.asyncio
    async def test_restore_device_configuration_passes_bytes(self):
        service, client = make_service_with_client()
        client.restore_device_configuration = AsyncMock()

        await service.restore_device_configuration("device-1", "config-text")

        client.restore_device_configuration.assert_awaited_once_with("device-1", b"config-text")


@pytest.mark.integration
class TestVOLTHAServiceCoreOperations:
    """Tests for core VOLTHA service operations."""

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        service, client = make_service_with_client()

        client.health_check = AsyncMock(return_value={"state": "HEALTHY"})
        client.get_devices = AsyncMock(return_value=[{}, {}])

        response = await service.health_check()

        assert response.healthy is True
        assert response.state == "HEALTHY"
        assert response.total_devices == 2
        client.get_devices.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        service, client = make_service_with_client()

        client.health_check = AsyncMock(side_effect=Exception("boom"))

        response = await service.health_check()

        assert response.healthy is False
        assert response.state == "ERROR"
        assert "boom" in response.message

    @pytest.mark.asyncio
    async def test_get_device_returns_detail(self):
        service, client = make_service_with_client()

        client.get_device = AsyncMock(return_value={"id": "onu-1"})
        client.get_device_ports = AsyncMock(return_value=[{"port_no": 1}])

        detail = await service.get_device("onu-1")

        assert detail is not None
        assert detail.device.id == "onu-1"
        assert detail.ports[0].port_no == 1

    @pytest.mark.asyncio
    async def test_get_device_returns_none_when_missing(self):
        service, client = make_service_with_client()

        client.get_device = AsyncMock(return_value=None)

        detail = await service.get_device("missing")

        assert detail is None
        client.get_device_ports.assert_not_called()

    @pytest.mark.asyncio
    async def test_enable_device_success(self):
        service, client = make_service_with_client()
        client.enable_device = AsyncMock()

        result = await service.enable_device("onu-1")

        assert result.success is True
        assert "enabled" in result.message
        client.enable_device.assert_awaited_once_with("onu-1")

    @pytest.mark.asyncio
    async def test_enable_device_failure(self):
        service, client = make_service_with_client()
        client.enable_device = AsyncMock(side_effect=Exception("nope"))

        result = await service.enable_device("onu-1")

        assert result.success is False
        assert "Failed" in result.message

    @pytest.mark.asyncio
    async def test_disable_device_failure(self):
        service, client = make_service_with_client()
        client.disable_device = AsyncMock(side_effect=Exception("bad"))

        result = await service.disable_device("onu-1")

        assert result.success is False
        assert result.device_id == "onu-1"

    @pytest.mark.asyncio
    async def test_reboot_device_failure(self):
        service, client = make_service_with_client()
        client.reboot_device = AsyncMock(side_effect=Exception("boom"))

        result = await service.reboot_device("onu-1")

        assert result.success is False
        assert "Failed" in result.message

    @pytest.mark.asyncio
    async def test_delete_device(self):
        service, client = make_service_with_client()
        client.delete_device = AsyncMock(return_value=True)

        result = await service.delete_device("onu-1")

        assert result is True
        client.delete_device.assert_awaited_once_with("onu-1")

    @pytest.mark.asyncio
    async def test_list_logical_devices(self):
        service, client = make_service_with_client()
        client.get_logical_devices = AsyncMock(return_value=[{"id": "olt-1"}])

        response = await service.list_logical_devices()

        assert response.total == 1
        assert response.devices[0].id == "olt-1"

    @pytest.mark.asyncio
    async def test_get_logical_device_returns_detail(self):
        service, client = make_service_with_client()

        client.get_logical_device = AsyncMock(return_value={"id": "olt-1"})
        client.get_logical_device_ports = AsyncMock(return_value=[{"id": "port-1"}])
        client.get_logical_device_flows = AsyncMock(return_value=[{"id": "flow-1"}])

        detail = await service.get_logical_device("olt-1")

        assert detail is not None
        assert detail.device.id == "olt-1"
        assert detail.flows[0]["id"] == "flow-1"

    @pytest.mark.asyncio
    async def test_get_logical_device_returns_none(self):
        service, client = make_service_with_client()
        client.get_logical_device = AsyncMock(return_value=None)

        detail = await service.get_logical_device("missing")

        assert detail is None
        client.get_logical_device_ports.assert_not_called()

    @pytest.mark.asyncio
    async def test_provision_onu_success(self):
        service, client = make_service_with_client()

        client.get_devices = AsyncMock(
            return_value=[
                {
                    "id": "onu-1",
                    "serial_number": "ALCL12345678",
                    "parent_id": "olt-root-1",
                    "parent_port_no": 1,
                }
            ]
        )
        client.enable_device = AsyncMock()

        with patch.object(service, "_configure_onu_service", new_callable=AsyncMock) as mock_cfg:
            request = ONUProvisionRequest(
                serial_number="ALCL12345678",
                olt_device_id="olt-root-1",
                pon_port=1,
                subscriber_id=None,
                vlan=100,
                bandwidth_profile="100M",
            )

            response = await service.provision_onu(request)

        assert response.success is True
        assert response.device_id == "onu-1"
        mock_cfg.assert_awaited_once()
        client.enable_device.assert_awaited_once_with("onu-1")

    @pytest.mark.asyncio
    async def test_provision_onu_not_found(self):
        service, client = make_service_with_client()

        client.get_devices = AsyncMock(
            return_value=[{"serial_number": "OTHER", "parent_id": "olt", "parent_port_no": 1}]
        )

        request = ONUProvisionRequest(
            serial_number="ALCL12345678",
            olt_device_id="olt-root-1",
            pon_port=1,
        )

        response = await service.provision_onu(request)

        assert response.success is False
        assert response.device_id is None


@pytest.mark.integration
class TestVOLTHAServiceAlarmOperations:
    """Tests for alarm acknowledge/clear operations."""

    @pytest.mark.asyncio
    async def test_get_alarm_success(self):
        """Test getting a specific alarm by ID."""
        service, client = make_service_with_client()

        client.get_alarm = AsyncMock(
            return_value={
                "id": "alarm-123",
                "type": "onu_los",
                "category": "ONU",
                "severity": "MAJOR",
                "state": "RAISED",
                "resource_id": "onu-1",
                "description": "ONU loss of signal",
                "context": {},
                "raised_ts": "2025-10-24T10:00:00Z",
            }
        )

        alarm = await service.get_alarm("alarm-123")

        assert alarm.id == "alarm-123"
        assert alarm.type == "onu_los"
        assert alarm.severity == "MAJOR"
        assert alarm.state == "RAISED"
        client.get_alarm.assert_awaited_once_with("alarm-123")

    @pytest.mark.asyncio
    async def test_get_alarm_not_found(self):
        """Test getting a non-existent alarm raises HTTPException."""
        from fastapi import HTTPException

        service, client = make_service_with_client()

        client.get_alarm = AsyncMock(side_effect=Exception("Alarm not found"))

        with pytest.raises(HTTPException) as exc_info:
            await service.get_alarm("alarm-999")

        assert exc_info.value.status_code == 404
        assert "not found" in str(exc_info.value.detail).lower()

    @pytest.mark.asyncio
    async def test_acknowledge_alarm_success(self):
        """Test that acknowledge_alarm works successfully."""
        from dotmac.platform.voltha.schemas import AlarmAcknowledgeRequest

        service, client = make_service_with_client()

        client.acknowledge_alarm = AsyncMock(
            return_value={
                "success": True,
                "message": "Alarm acknowledged",
            }
        )

        request = AlarmAcknowledgeRequest(
            acknowledged_by="admin@example.com",
            note="Investigating issue",
        )

        response = await service.acknowledge_alarm("alarm-123", request)

        assert response.success is True
        assert response.alarm_id == "alarm-123"
        assert response.operation == "acknowledge"
        assert "admin@example.com" in response.message
        assert response.timestamp is not None
        client.acknowledge_alarm.assert_awaited_once_with(
            alarm_id="alarm-123",
            acknowledged_by="admin@example.com",
            note="Investigating issue",
        )

    @pytest.mark.asyncio
    async def test_acknowledge_alarm_error(self):
        """Test that acknowledge_alarm handles errors properly."""
        from fastapi import HTTPException

        from dotmac.platform.voltha.schemas import AlarmAcknowledgeRequest

        service, client = make_service_with_client()

        client.acknowledge_alarm = AsyncMock(side_effect=Exception("VOLTHA API error"))

        request = AlarmAcknowledgeRequest(
            acknowledged_by="admin@example.com",
            note="Investigating issue",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.acknowledge_alarm("alarm-123", request)

        assert exc_info.value.status_code == 500
        assert "Failed to acknowledge alarm" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_clear_alarm_success(self):
        """Test that clear_alarm works successfully."""
        from dotmac.platform.voltha.schemas import AlarmClearRequest

        service, client = make_service_with_client()

        client.clear_alarm = AsyncMock(
            return_value={
                "success": True,
                "message": "Alarm cleared",
            }
        )

        request = AlarmClearRequest(
            cleared_by="admin@example.com",
            note="Issue resolved",
        )

        response = await service.clear_alarm("alarm-123", request)

        assert response.success is True
        assert response.alarm_id == "alarm-123"
        assert response.operation == "clear"
        assert "admin@example.com" in response.message
        assert response.timestamp is not None
        client.clear_alarm.assert_awaited_once_with(
            alarm_id="alarm-123",
            cleared_by="admin@example.com",
            note="Issue resolved",
        )

    @pytest.mark.asyncio
    async def test_clear_alarm_error(self):
        """Test that clear_alarm handles errors properly."""
        from fastapi import HTTPException

        from dotmac.platform.voltha.schemas import AlarmClearRequest

        service, client = make_service_with_client()

        client.clear_alarm = AsyncMock(side_effect=Exception("VOLTHA API error"))

        request = AlarmClearRequest(
            cleared_by="admin@example.com",
            note="Issue resolved",
        )

        with pytest.raises(HTTPException) as exc_info:
            await service.clear_alarm("alarm-123", request)

        assert exc_info.value.status_code == 500
        assert "Failed to clear alarm" in exc_info.value.detail
