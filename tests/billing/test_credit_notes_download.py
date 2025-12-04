"""Tests for credit note download endpoint."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.billing.core.enums import CreditNoteStatus, CreditReason, CreditType
from dotmac.platform.billing.core.models import CreditNote, CreditNoteLineItem
from dotmac.platform.billing.credit_notes.router import router

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app with dependency overrides."""

    app = FastAPI()
    app.include_router(router, prefix="/billing")

    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.billing.credit_notes.router import get_async_session, get_current_user

    async def mock_user():
        return UserInfo(
            user_id="test-user",
            tenant_id="test-tenant",
            email="test@example.com",
            roles=["admin"],
            permissions=["*"],
        )

    async def mock_session():
        return AsyncMock()

    app.dependency_overrides[get_current_user] = mock_user
    app.dependency_overrides[get_async_session] = mock_session

    return app


@pytest.fixture
def client(app):
    """FastAPI test client."""
    return TestClient(app)


def _sample_credit_note() -> CreditNote:
    """Build a sample credit note for testing."""
    line_item = CreditNoteLineItem(
        description="Service refund",
        quantity=1,
        unit_price=5000,
        total_price=5000,
        tax_rate=0.0,
        tax_amount=0,
    )

    return CreditNote(
        credit_note_id="cn-001",
        credit_note_number="CN-1001",
        tenant_id="test-tenant",
        created_by="accounting@dotmac.io",
        customer_id="cust-123",
        invoice_id="inv-456",
        issue_date=datetime.now(UTC),
        currency="USD",
        subtotal=5000,
        tax_amount=0,
        total_amount=5000,
        credit_type=CreditType.REFUND,
        reason=CreditReason.BILLING_ERROR,
        reason_description="Billing adjustment",
        status=CreditNoteStatus.ISSUED,
        line_items=[line_item],
        auto_apply_to_invoice=True,
        remaining_credit_amount=2500,
        notes="Applied due to overcharge",
        internal_notes="Verified by finance",
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@patch("dotmac.platform.billing.credit_notes.router.CreditNoteService")
def test_download_credit_note_success(mock_service_class, client):
    """Downloading a credit note returns a CSV attachment."""
    mock_service = AsyncMock()
    mock_service.get_credit_note = AsyncMock(return_value=_sample_credit_note())
    mock_service_class.return_value = mock_service

    response = client.get(
        "/billing/credit-notes/cn-001/download", headers={"X-Tenant-ID": "test-tenant"}
    )

    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/csv")
    assert "attachment" in response.headers["Content-Disposition"]
    assert "credit_note_CN-1001.csv" in response.headers["Content-Disposition"]
    body = response.text
    assert "Credit Note ID" in body
    assert "Service refund" in body
    mock_service.get_credit_note.assert_awaited_once()


@patch("dotmac.platform.billing.credit_notes.router.CreditNoteService")
def test_download_credit_note_not_found(mock_service_class, client):
    """Returns 404 when credit note is missing."""
    mock_service = AsyncMock()
    mock_service.get_credit_note = AsyncMock(return_value=None)
    mock_service_class.return_value = mock_service

    response = client.get(
        "/billing/credit-notes/unknown/download", headers={"X-Tenant-ID": "test-tenant"}
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Credit note not found"
