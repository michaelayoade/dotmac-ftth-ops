"""
Shared fixtures for invoice service tests.
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
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


@pytest.fixture
def mock_db_session():
    """Mock database session"""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.execute = AsyncMock()
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
    entity.invoice_number = "INV-2024-000001"
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
