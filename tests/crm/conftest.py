"""Test fixtures for CRM module."""

import pytest_asyncio


@pytest_asyncio.fixture
async def async_client(test_app):
    """Async HTTP client for CRM API tests.

    Creates an httpx AsyncClient for testing async endpoints.
    Inherits auth_headers from parent conftest which includes X-Tenant-ID.
    """
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
