"""
Tests for NetBox router dependencies.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from dotmac.platform.netbox.router import get_netbox_service

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_get_netbox_service_includes_tenant_id():
    """NetBox client should be initialised with the active tenant id."""
    tenant = SimpleNamespace(id="tenant-123")
    tenant_access = (None, tenant)
    mock_session = AsyncMock()

    config = SimpleNamespace(
        url="http://netbox:8080",
        api_token="token-abc",
        verify_ssl=True,
        timeout_seconds=30.0,
        max_retries=3,
    )

    with (
        patch(
            "dotmac.platform.netbox.router.get_service_config",
            new=AsyncMock(return_value=config),
        ) as mock_get_config,
        patch("dotmac.platform.netbox.router.NetBoxClient") as mock_client,
    ):
        mock_service_instance = object()
        mock_client.return_value = mock_service_instance

        service = await get_netbox_service(tenant_access, mock_session)

        mock_get_config.assert_awaited_once()
        mock_client.assert_called_once_with(
            base_url=config.url,
            api_token=config.api_token,
            tenant_id=tenant.id,
            verify_ssl=config.verify_ssl,
            timeout_seconds=config.timeout_seconds,
            max_retries=config.max_retries,
        )
        assert service.client is mock_service_instance
