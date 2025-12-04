"""
Shared fixtures for invoice service tests.

Pytest fixtures for billing invoicing router tests.
"""

import hashlib
from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
import pytest_asyncio
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.billing.core.entities import (
    InvoiceEntity,
    InvoiceLineItemEntity,
)
from dotmac.platform.billing.core.enums import (
    InvoiceStatus,
    PaymentStatus,
)
from dotmac.platform.billing.invoicing.service import InvoiceService


def _build_invoice_number(tenant_id: str, year: int | None = None, sequence: int = 1) -> str:
    year = year or datetime.now(UTC).year
    suffix = hashlib.sha1(tenant_id.encode()).hexdigest()[:4].upper()
    return f"INV-{suffix}-{year}-{sequence:06d}"


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()

    # Mock bind and dialect for database-specific code
    mock_dialect = MagicMock()
    mock_dialect.name = "postgresql"
    mock_bind = MagicMock()
    mock_bind.dialect = mock_dialect
    session.bind = mock_bind

    return session


@pytest.fixture
def mock_metrics():
    """Mock billing metrics"""
    with patch("dotmac.platform.billing.invoicing.service.get_billing_metrics") as mock:
        metrics = MagicMock()
        metrics.record_invoice_created = MagicMock()
        metrics.record_invoice_finalized = MagicMock()
        metrics.record_invoice_voided = MagicMock()
        metrics.record_invoice_paid = MagicMock()
        mock.return_value = metrics
        yield metrics


@pytest.fixture
def invoice_service(mock_db_session, mock_metrics):
    """Invoice service instance with mocked dependencies"""
    return InvoiceService(mock_db_session)


@pytest.fixture
def sample_tenant_id():
    """Sample tenant ID"""
    return "tenant-123"


@pytest.fixture
def sample_customer_id():
    """Sample customer ID"""
    return "550e8400-e29b-41d4-a716-446655440003"


@pytest.fixture
def sample_line_items():
    """Sample invoice line items"""
    return [
        {
            "description": "Product A",
            "quantity": 2,
            "unit_price": 5000,
            "total_price": 10000,
            "tax_rate": 10.0,
            "tax_amount": 1000,
            "discount_percentage": 0.0,
            "discount_amount": 0,
        },
        {
            "description": "Service B",
            "quantity": 1,
            "unit_price": 7500,
            "total_price": 7500,
            "tax_rate": 10.0,
            "tax_amount": 750,
            "discount_percentage": 5.0,
            "discount_amount": 375,
        },
    ]


@pytest.fixture
def sample_billing_address():
    """Sample billing address"""
    return {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "country": "US",
    }


@pytest.fixture
def mock_invoice_entity(sample_tenant_id, sample_customer_id):
    """Create a mock invoice entity with all required attributes"""
    entity = MagicMock(spec=InvoiceEntity)
    entity.tenant_id = sample_tenant_id
    entity.invoice_id = str(uuid4())
    entity.invoice_number = _build_invoice_number(sample_tenant_id, sequence=1)
    entity.idempotency_key = None
    entity.created_by = "system"
    entity.customer_id = sample_customer_id
    entity.billing_email = "customer@example.com"
    entity.billing_address = {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "postal_code": "94105",
        "country": "US",
    }
    entity.issue_date = datetime.now(UTC)
    entity.due_date = datetime.now(UTC) + timedelta(days=30)
    entity.currency = "USD"
    entity.subtotal = 17500
    entity.tax_amount = 1750
    entity.discount_amount = 375
    entity.total_amount = 18875
    entity.remaining_balance = 18875
    entity.total_credits_applied = 0
    entity.credit_applications = []
    entity.status = InvoiceStatus.DRAFT
    entity.payment_status = PaymentStatus.PENDING
    entity.subscription_id = None
    entity.proforma_invoice_id = None
    entity.notes = None
    entity.internal_notes = None
    entity.extra_data = {}
    entity.created_at = datetime.now(UTC)
    entity.updated_at = datetime.now(UTC)
    entity.updated_by = "system"
    entity.paid_at = None
    entity.voided_at = None
    entity.line_items = []

    # Add line items
    for i in range(2):
        line_item = MagicMock(spec=InvoiceLineItemEntity)
        line_item.line_item_id = str(uuid4())
        line_item.invoice_id = entity.invoice_id
        line_item.description = f"Item {i + 1}"
        line_item.quantity = 2 if i == 0 else 1
        line_item.unit_price = 5000 if i == 0 else 7500
        line_item.total_price = 10000 if i == 0 else 7500
        line_item.product_id = None
        line_item.subscription_id = None
        line_item.tax_rate = 10.0
        line_item.tax_amount = 1000 if i == 0 else 750
        line_item.discount_percentage = 0.0 if i == 0 else 5.0
        line_item.discount_amount = 0 if i == 0 else 375
        line_item.extra_data = {}
        entity.line_items.append(line_item)

    return entity


class MockObject:
    """Helper class to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any):
        for key, value in kwargs.items():
            setattr(self, key, value)


@pytest.fixture
def sample_invoice() -> dict[str, Any]:
    """Sample invoice for testing."""
    return {
        "invoice_id": "inv-123",
        "invoice_number": _build_invoice_number("tenant-1"),
        "tenant_id": "tenant-1",
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
    from dotmac.platform.auth.dependencies import get_current_user
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

    app.include_router(invoicing_router, prefix="/api/v1/billing")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
