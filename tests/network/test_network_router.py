"""
Integration tests for the subscriber network profile API.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.integration

pytest_plugins = [
    "tests.billing._fixtures.shared",
    "tests.subscribers.conftest",
]


@pytest.mark.asyncio
async def test_upsert_and_get_profile(
    router_client: AsyncClient,
    auth_headers: dict[str, str],
    subscriber_factory,
    tenant_id: str,
):
    subscriber = await subscriber_factory.create(tenant_id=tenant_id)

    payload = {
        "serviceVlan": 2200,
        "innerVlan": 52,
        "qinqEnabled": True,
        "staticIpv4": "192.168.50.9",
        "staticIpv6": "2001:db8::99",
        "delegatedIpv6Prefix": "2001:db8:ffff::/56",
    }

    put_response = await router_client.put(
        f"/api/v1/network/subscribers/{subscriber.id}/profile",
        json=payload,
        headers=auth_headers,
    )
    assert put_response.status_code == 200
    data = put_response.json()
    assert data["serviceVlan"] == 2200
    assert data["innerVlan"] == 52
    assert data["qinqEnabled"] is True
    assert data["staticIpv4"] == "192.168.50.9"
    assert data["delegatedIpv6Prefix"] == "2001:db8:ffff::/56"

    get_response = await router_client.get(
        f"/api/v1/network/subscribers/{subscriber.id}/profile",
        headers=auth_headers,
    )
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert fetched["serviceVlan"] == 2200
    assert fetched["staticIpv6"] == "2001:db8::99"


@pytest.mark.asyncio
async def test_delete_profile(
    router_client: AsyncClient,
    auth_headers: dict[str, str],
    subscriber_factory,
    tenant_id: str,
):
    subscriber = await subscriber_factory.create(tenant_id=tenant_id)

    await router_client.put(
        f"/api/v1/network/subscribers/{subscriber.id}/profile",
        json={"serviceVlan": 3001},
        headers=auth_headers,
    )

    delete_response = await router_client.delete(
        f"/api/v1/network/subscribers/{subscriber.id}/profile",
        headers=auth_headers,
    )
    assert delete_response.status_code == 204

    get_response = await router_client.get(
        f"/api/v1/network/subscribers/{subscriber.id}/profile",
        headers=auth_headers,
    )
    assert get_response.status_code == 404
