"""
Unit tests for the network workflow service.
"""

import ipaddress
import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from dotmac.platform.network.workflow_service import NetworkService
from tests.test_utils import create_async_session_mock


@pytest.mark.asyncio
async def test_allocate_resources_filters_by_tenant():
    session = create_async_session_mock()
    result_mock = AsyncMock()
    result_mock.scalar_one_or_none = Mock(return_value=None)
    session.execute = AsyncMock(return_value=result_mock)

    service = NetworkService(session)

    with pytest.raises(ValueError) as error:
        await service.allocate_resources(
            customer_id="cust-123",
            service_location="Downtown HQ",
            bandwidth_plan="100mbps",
            tenant_id="tenant-abc",
        )

    assert "tenant tenant-abc" in str(error.value)
    executed_stmt = session.execute.await_args_list[0].args[0]
    criteria = executed_stmt._where_criteria
    assert any(getattr(clause.left, "key", None) == "tenant_id" for clause in criteria)


@pytest.mark.asyncio
async def test_allocate_resources_uses_fallback_when_netbox_unavailable(
    monkeypatch: pytest.MonkeyPatch,
):
    session = create_async_session_mock()
    customer = SimpleNamespace(email="tenant.user@example.com", tenant_id="tenant-abc")
    result_mock = AsyncMock()
    result_mock.scalar_one_or_none = Mock(return_value=customer)
    session.execute = AsyncMock(return_value=result_mock)

    fake_netbox_module = ModuleType("dotmac.platform.netbox.client")
    monkeypatch.setitem(sys.modules, "dotmac.platform.netbox.client", fake_netbox_module)

    fallback_ip = "10.200.1.50"
    fallback_int = int(ipaddress.IPv4Address(fallback_ip))
    monkeypatch.setattr("random.randint", lambda _a, _b: fallback_int)

    service = NetworkService(session)
    allocation = await service.allocate_resources(
        customer_id="cust-123",
        service_location="Downtown HQ",
        bandwidth_plan="100mbps",
        tenant_id="tenant-abc",
    )

    assert allocation["allocation_method"] == "fallback"
    assert allocation["ip_address"] == fallback_ip
    assert allocation["subnet"] == f"{fallback_ip}/24"
    assert allocation["gateway"] == "10.200.1.1"
    assert allocation["vlan_id"] == 102
    assert allocation["username"] == "tenant.user"
    assert allocation["netbox_ip_id"] is None
