"""
Pytest fixtures for billing invoicing router tests.
"""

import hashlib
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient


class MockObject:
    """Helper class to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any):
        for key, value in kwargs.items():
            setattr(self, key, value)


def _build_invoice_number(tenant_id: str, sequence: int = 1, *, year: int | None = None) -> str:
    year = year or datetime.utcnow().year
    suffix = hashlib.sha1(tenant_id.encode()).hexdigest()[:4].upper()
    return f"INV-{suffix}-{year}-{sequence:06d}"


@pytest.fixture
def sample_invoice() -> dict[str, Any]:
    """Sample invoice for testing."""
    tenant_id = "tenant-1"
    return {
        "invoice_id": "inv-123",
        "invoice_number": _build_invoice_number(tenant_id),
        "tenant_id": tenant_id,
        "customer_id": "cust-456",
        "billing_email": "customer@example.com",
        "billing_address": {
            "street": "123 Main St",
            "city": "San Francisco",
            "state": "CA",
            "postal_code": "94105",
            "country": "US",
        },
        "issue_date": datetime.utcnow().isoformat(),
        "due_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
        "currency": "USD",
        "subtotal": 10000,
        "tax_amount": 800,
        "discount_amount": 0,
        "total_amount": 10800,
        "remaining_balance": 10800,
        "status": "draft",
        "payment_status": "pending",
        "line_items": [
            {
                "line_item_id": "li-1",
                "description": "Subscription - Pro Plan",
                "quantity": 1,
                "unit_price": 10000,
                "total_price": 10000,
                "tax_rate": 8.0,
                "tax_amount": 800,
                "discount_percentage": 0.0,
                "discount_amount": 0,
                "extra_data": {},
            }
        ],
        "subscription_id": "sub-789",
        "notes": "Payment due within 30 days",
        "internal_notes": "Created from subscription renewal",
        "extra_data": {},
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
        "paid_at": None,
        "voided_at": None,
        "created_by": "user-123",
        "idempotency_key": "idempotency-123",
    }


@pytest.fixture
def mock_invoice_service():
    """Mock InvoiceService for testing."""
    service = MagicMock()

    # Make all methods async
    service.create_invoice = AsyncMock()
    service.list_invoices = AsyncMock(return_value=[])
    service.get_invoice = AsyncMock()
    service.finalize_invoice = AsyncMock()
    service.void_invoice = AsyncMock()
    service.mark_invoice_paid = AsyncMock()
    service.apply_credit_to_invoice = AsyncMock()
    service.check_overdue_invoices = AsyncMock(return_value=[])

    return service


@pytest.fixture
def mock_current_user():
    """Mock current user for authentication."""
    from dotmac.platform.auth.core import UserInfo

    return UserInfo(
        user_id="00000000-0000-0000-0000-000000000001",
        email="test@example.com",
        tenant_id="1",
        roles=["admin"],
        permissions=[
            "billing.invoices.read",
            "billing.invoices.create",
            "billing.invoices.update",
            "billing.invoices.delete",
        ],
        is_platform_admin=False,
    )


@pytest.fixture
def mock_rbac_service():
    """Mock RBAC service that always allows access."""
    from dotmac.platform.auth.rbac_service import RBACService

    mock_rbac = MagicMock(spec=RBACService)
    mock_rbac.user_has_all_permissions = AsyncMock(return_value=True)
    mock_rbac.user_has_any_permission = AsyncMock(return_value=True)
    mock_rbac.get_user_permissions = AsyncMock(return_value=set())
    mock_rbac.get_user_roles = AsyncMock(return_value=[])
    return mock_rbac


@pytest_asyncio.fixture
async def async_client(mock_invoice_service, mock_current_user, mock_rbac_service, monkeypatch):
    """Async HTTP client with billing invoicing router registered and dependencies mocked."""
    import dotmac.platform.auth.rbac_dependencies
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.billing.dependencies import get_tenant_id
    from dotmac.platform.billing.invoicing.router import router as invoicing_router
    from dotmac.platform.dependencies import get_db

    # Monkeypatch RBACService class to return our mock instance
    monkeypatch.setattr(
        dotmac.platform.auth.rbac_dependencies, "RBACService", lambda db: mock_rbac_service
    )

    app = FastAPI()

    # Override dependencies
    def override_get_current_user():
        return mock_current_user

    def override_get_db():
        return MagicMock()

    def override_get_tenant_id():
        return "1"

    # Mock the service creation in the router
    # Since the router creates service inline, we'll mock at router module level
    from dotmac.platform.billing.invoicing import router as router_module

    monkeypatch.setattr(router_module, "InvoiceService", lambda db: mock_invoice_service)

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_tenant_id] = override_get_tenant_id

    app.include_router(invoicing_router, prefix="/api/v1/billing/invoices")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
