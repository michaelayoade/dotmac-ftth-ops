"""
Tests for the customer management workflow adapter service.
"""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from dotmac.platform.customer_management.models import CustomerStatus
from dotmac.platform.customer_management.schemas import CustomerCreate
from dotmac.platform.customer_management.workflow_service import (
    CustomerService as WorkflowCustomerService,
)
from dotmac.platform.tenant import get_current_tenant_id, set_current_tenant_id

pytestmark = pytest.mark.integration


class _ScalarResult:
    """Helper to mimic SQLAlchemy AsyncResult.scalar_one_or_none()."""

    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


@pytest.mark.asyncio
async def test_create_from_lead_uses_core_service(monkeypatch):
    """Ensure the workflow adapter delegates to the core customer service."""
    session = AsyncMock()
    lead_id = uuid4()
    tenant_id = "tenant-workflow"

    lead = SimpleNamespace(
        id=lead_id,
        tenant_id=tenant_id,
        first_name="Alice",
        last_name="Smith",
        email="alice@example.com",
        phone="+1234567890",
        company_name="Example Corp",
        source=SimpleNamespace(value="referral"),
        service_address_line1="123 Main St",
        service_address_line2=None,
        service_city="Metropolis",
        service_state_province="CA",
        service_postal_code="94016",
        service_country="US",
        service_coordinates={"lat": 37.7749, "lon": -122.4194},
    )

    # First execute returns lead, second returns no existing customer
    session.execute = AsyncMock(side_effect=[_ScalarResult(lead), _ScalarResult(None)])

    workflow_service = WorkflowCustomerService(session)
    workflow_service.customer_service = AsyncMock()

    created_customer = SimpleNamespace(
        id=uuid4(),
        full_name="Alice Smith",
        email="alice@example.com",
        customer_number="CUST-1234",
        first_name="Alice",
        last_name="Smith",
        phone="+1234567890",
        company_name="Example Corp",
        created_at=datetime.now(UTC),
    )

    workflow_service.customer_service.create_customer = AsyncMock(return_value=created_customer)
    workflow_service.customer_service.update_customer = AsyncMock(return_value=created_customer)

    set_current_tenant_id("original-context")

    result = await workflow_service.create_from_lead(str(lead_id), tenant_id)

    # Ensure the core service was invoked with a CustomerCreate payload
    workflow_service.customer_service.create_customer.assert_awaited_once()
    create_call = workflow_service.customer_service.create_customer.await_args
    assert isinstance(create_call.kwargs["data"], CustomerCreate)
    assert create_call.kwargs["data"].email == lead.email

    # Status should be updated to ACTIVE
    workflow_service.customer_service.update_customer.assert_awaited_once()
    update_call = workflow_service.customer_service.update_customer.await_args
    assert update_call.kwargs["data"].status == CustomerStatus.ACTIVE

    assert result["customer_id"] == created_customer.id
    assert result["name"] == created_customer.full_name
    assert get_current_tenant_id() == "original-context"

    # Clean up context
    set_current_tenant_id(None)
