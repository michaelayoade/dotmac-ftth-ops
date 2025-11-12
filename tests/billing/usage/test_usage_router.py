"""Tests for the usage billing router."""

from datetime import UTC, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID, uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.auth.dependencies import get_current_user
from dotmac.platform.billing.settings.service import BillingSettingsService
from dotmac.platform.billing.usage.models import UsageRecord, UsageType
from dotmac.platform.billing.usage.router import router
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.database import get_async_session

pytestmark = pytest.mark.integration


@pytest_asyncio.fixture
async def usage_test_client(async_db_session: AsyncSession):
    """Create a test client with dependency overrides."""

    from httpx import ASGITransport

    tenant_id = f"usage-test-tenant-{uuid4().hex[:8]}"
    app = FastAPI()

    def override_current_user() -> UserInfo:
        return UserInfo(
            user_id=str(uuid4()),
            email="usage-test@example.com",
            username="usage-test",
            tenant_id=tenant_id,
            roles=["admin"],
            permissions=["billing:usage:write"],
        )

    async def override_session():
        yield async_db_session

    app.dependency_overrides[get_current_user] = override_current_user
    app.dependency_overrides[get_async_session] = override_session
    app.include_router(router, prefix="/billing")

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={
            "Authorization": "Bearer test-token",
            "X-Tenant-ID": tenant_id,
        },
    ) as client:
        yield client, tenant_id

    app.dependency_overrides.clear()


async def _create_customer(session: AsyncSession, tenant_id: str) -> UUID:
    """Insert a minimal customer record for usage tests."""
    customer = Customer(
        tenant_id=tenant_id,
        customer_number=f"CUST-{uuid4().hex[:8]}",
        first_name="Usage",
        last_name="Tester",
        email=f"usage-{uuid4().hex[:6]}@example.com",
    )
    session.add(customer)
    await session.commit()
    await session.refresh(customer)
    return customer.id


async def _set_tenant_currency(session: AsyncSession, tenant_id: str, currency: str) -> None:
    """Persist a tenant payment currency for tests."""
    service = BillingSettingsService(session)
    settings = await service.get_settings(tenant_id)
    payment_settings = settings.payment_settings.model_copy()
    payment_settings.default_currency = currency
    if currency not in payment_settings.supported_currencies:
        payment_settings.supported_currencies.append(currency)
    await service.update_payment_settings(tenant_id, payment_settings)


def _expected_total(quantity: str, unit_price: str) -> int:
    """Helper for expected cents calculation."""
    result = (Decimal(quantity) * Decimal(unit_price) * Decimal("100")).quantize(
        Decimal("1"), rounding=ROUND_HALF_UP
    )
    return int(result)


@pytest.mark.asyncio
async def test_create_usage_record_uses_tenant_currency(
    usage_test_client, async_db_session: AsyncSession
):
    client, tenant_id = usage_test_client
    customer_id = await _create_customer(async_db_session, tenant_id)
    await _set_tenant_currency(async_db_session, tenant_id, "EUR")

    now = datetime.now(UTC)
    payload = {
        "subscription_id": "sub-usage-eur",
        "customer_id": str(customer_id),
        "usage_type": UsageType.DATA_TRANSFER.value,
        "quantity": "2.5",
        "unit": "GB",
        "unit_price": "1.23",
        "period_start": (now - timedelta(hours=1)).isoformat(),
        "period_end": now.isoformat(),
        "source_system": "api",
        "description": "Test usage record",
    }

    response = await client.post(
        "/billing/usage/records",
        json=payload,
        headers={"X-Tenant-ID": tenant_id},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["currency"] == "EUR"
    assert data["total_amount"] == _expected_total(payload["quantity"], payload["unit_price"])

    db_record = await async_db_session.get(UsageRecord, UUID(data["id"]))
    assert db_record is not None
    assert db_record.currency == "EUR"
    assert db_record.total_amount == data["total_amount"]


@pytest.mark.asyncio
async def test_create_usage_record_allows_currency_override_header(
    usage_test_client, async_db_session: AsyncSession
):
    client, tenant_id = usage_test_client
    customer_id = await _create_customer(async_db_session, tenant_id)
    await _set_tenant_currency(async_db_session, tenant_id, "EUR")

    now = datetime.now(UTC)
    payload = {
        "subscription_id": "sub-usage-override",
        "customer_id": str(customer_id),
        "usage_type": UsageType.VOICE_MINUTES.value,
        "quantity": "1.235",
        "unit": "minute",
        "unit_price": "2.005",
        "period_start": (now - timedelta(minutes=30)).isoformat(),
        "period_end": now.isoformat(),
        "source_system": "api",
        "description": "Override currency record",
    }

    response = await client.post(
        "/billing/usage/records",
        json=payload,
        headers={"X-Tenant-ID": tenant_id, "X-Currency": "NGN"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["currency"] == "NGN"
    assert data["total_amount"] == _expected_total(payload["quantity"], payload["unit_price"])

    db_record = await async_db_session.get(UsageRecord, UUID(data["id"]))
    assert db_record is not None
    assert db_record.currency == "NGN"
    assert db_record.total_amount == data["total_amount"]
