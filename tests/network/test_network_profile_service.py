import pytest

from dotmac.platform.network.models import IPv6AssignmentMode, Option82Policy
from dotmac.platform.network.profile_service import SubscriberNetworkProfileService
from dotmac.platform.network.schemas import NetworkProfileUpdate

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_upsert_creates_profile(async_db_session, subscriber_factory):
    subscriber = await subscriber_factory.create()
    service = SubscriberNetworkProfileService(async_db_session, subscriber.tenant_id)

    payload = NetworkProfileUpdate(
        circuit_id="OLT1:1/1/1",
        remote_id="OLT1",
        service_vlan=1200,
        inner_vlan=210,
        qinq_enabled=True,
        static_ipv4="10.10.10.5",
        static_ipv6="2001:db8::5",
        delegated_ipv6_prefix="2001:db8:100::/56",
        ipv6_pd_size=56,
        ipv6_assignment_mode=IPv6AssignmentMode.DUAL_STACK,
        option82_policy=Option82Policy.ENFORCE,
        metadata={"olt_port": "1/1/1"},
    )

    response = await service.upsert_profile(subscriber.id, payload)

    assert response.service_vlan == 1200
    assert response.inner_vlan == 210
    assert response.qinq_enabled is True
    assert str(response.static_ipv4) == "10.10.10.5"
    assert str(response.static_ipv6) == "2001:db8::5"
    assert response.delegated_ipv6_prefix == "2001:db8:100::/56"
    assert response.option82_policy == Option82Policy.ENFORCE
    assert response.ipv6_assignment_mode == IPv6AssignmentMode.DUAL_STACK

    fetched = await service.get_profile(subscriber.id)
    assert fetched is not None
    assert fetched.service_vlan == 1200


@pytest.mark.asyncio
async def test_upsert_updates_existing_profile(async_db_session, subscriber_factory):
    subscriber = await subscriber_factory.create()
    service = SubscriberNetworkProfileService(async_db_session, subscriber.tenant_id)

    first = NetworkProfileUpdate(service_vlan=100)
    await service.upsert_profile(subscriber.id, first)

    update = NetworkProfileUpdate(
        service_vlan=150,
        inner_vlan=30,
        option82_policy=Option82Policy.LOG,
    )
    await service.upsert_profile(subscriber.id, update)

    profile = await service.get_profile(subscriber.id)
    assert profile is not None
    assert profile.service_vlan == 150
    assert profile.inner_vlan == 30
    assert profile.option82_policy == Option82Policy.LOG
