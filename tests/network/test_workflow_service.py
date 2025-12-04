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

pytestmark = pytest.mark.unit


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
    assert allocation["inner_vlan"] is None
    assert allocation["qinq_enabled"] is False
    assert allocation["ipv6_address"] is None
    assert allocation["delegated_ipv6_prefix"] is None


@pytest.mark.asyncio
async def test_allocate_resources_uses_network_profile_static_ip(monkeypatch: pytest.MonkeyPatch):
    session = create_async_session_mock()
    customer = SimpleNamespace(email="profile.user@example.com", tenant_id="tenant-xyz")
    result_mock = AsyncMock()
    result_mock.scalar_one_or_none = Mock(return_value=customer)
    session.execute = AsyncMock(return_value=result_mock)

    profile = SimpleNamespace(
        static_ipv4="172.16.1.10",
        static_ipv6="2001:db8::10",
        delegated_ipv6_prefix="2001:db8:ffff::/56",
        service_vlan=3100,
        inner_vlan=25,
        qinq_enabled=True,
    )

    class DummyProfileService:
        def __init__(self, db, tenant_id):
            assert tenant_id == "tenant-xyz"

        async def get_profile(self, subscriber_id):
            assert subscriber_id == "sub-100"
            return profile

    monkeypatch.setattr(
        "dotmac.platform.network.workflow_service.SubscriberNetworkProfileService",
        DummyProfileService,
    )

    service = NetworkService(session)
    allocation = await service.allocate_resources(
        customer_id="cust-999",
        service_location="Test HQ",
        bandwidth_plan="Fiber_1Gbps",
        tenant_id=None,
        subscriber_id="sub-100",
    )

    assert allocation["allocation_method"] == "profile"
    assert allocation["ip_address"] == "172.16.1.10"
    assert allocation["subnet"] == "172.16.1.10/32"
    assert allocation["vlan_id"] == 3100
    assert allocation["inner_vlan"] == 25
    assert allocation["qinq_enabled"] is True
    assert allocation["ipv6_address"] == "2001:db8::10"
    assert allocation["delegated_ipv6_prefix"] == "2001:db8:ffff::/56"
