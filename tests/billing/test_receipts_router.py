"""Tests for billing receipts router."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.billing.receipts.models import Receipt
from dotmac.platform.billing.receipts.router import router

pytestmark = pytest.mark.integration


@pytest.fixture
def app():
    """Create FastAPI app."""
    app = FastAPI()
    app.include_router(router, prefix="/billing")
    return app


@pytest.fixture
def client(app):
    """Create test client with auth bypass."""
    from dotmac.platform.auth.core import UserInfo
    from dotmac.platform.auth.dependencies import get_current_user

    # Override auth dependency to bypass authentication
    async def mock_get_current_user():
        return UserInfo(
            user_id="test-user",
            tenant_id="test-tenant",
            email="test@example.com",
            roles=["admin"],
            permissions=["*"],
        )

    app.dependency_overrides[get_current_user] = mock_get_current_user
    return TestClient(app)


@pytest.fixture
def mock_receipt():
    """Create mock receipt."""
    receipt = MagicMock(spec=Receipt)
    receipt.id = str(uuid4())
    receipt.receipt_number = "RCT-001"
    receipt.tenant_id = "test-tenant"
    receipt.customer_id = "customer-123"
    receipt.payment_id = "payment-123"
    receipt.invoice_id = "invoice-123"
    receipt.amount = 1000
    receipt.currency = "USD"
    receipt.html_content = "<html>Receipt</html>"
    receipt.pdf_url = "https://example.com/receipt.pdf"
    return receipt


@pytest.fixture
def mock_request():
    """Create mock request with tenant."""
    request = MagicMock()
    request.headers = {"X-Tenant-ID": "test-tenant"}
    return request


class TestGenerateReceiptForPayment:
    """Test POST /generate/payment endpoint."""

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_payment_success(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test successful receipt generation for payment."""
        mock_service = AsyncMock()
        mock_service.generate_receipt_for_payment = AsyncMock(return_value=mock_receipt)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.post(
            "/billing/receipts/generate/payment",
            json={
                "payment_id": "payment-123",
                "include_pdf": True,
                "include_html": True,
                "send_email": False,
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["receipt_number"] == "RCT-001"

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_payment_value_error(
        self, mock_service_class, mock_get_tenant, mock_auth, client
    ):
        """Test receipt generation with value error."""
        mock_service = AsyncMock()
        mock_service.generate_receipt_for_payment = AsyncMock(
            side_effect=ValueError("Invalid payment ID")
        )
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.post(
            "/billing/receipts/generate/payment",
            json={"payment_id": "invalid", "include_pdf": True, "include_html": True},
        )

        assert response.status_code == 400
        assert "Invalid payment ID" in response.json()["detail"]

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_payment_exception(
        self, mock_service_class, mock_get_tenant, mock_auth, client
    ):
        """Test receipt generation with unexpected exception."""
        mock_service = AsyncMock()
        mock_service.generate_receipt_for_payment = AsyncMock(
            side_effect=Exception("Database error")
        )
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.post(
            "/billing/receipts/generate/payment",
            json={"payment_id": "payment-123", "include_pdf": True, "include_html": True},
        )

        assert response.status_code == 500
        assert "Failed to generate receipt" in response.json()["detail"]


class TestGenerateReceiptForInvoice:
    """Test POST /generate/invoice endpoint."""

    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_invoice_success(self, mock_service_class, app, mock_receipt):
        """Test successful receipt generation for invoice."""
        from dotmac.platform.billing.receipts.router import (
            get_current_user,
            get_tenant_id_from_request,
        )

        # Override dependencies
        def mock_auth():
            return MagicMock(user_id="test-user", tenant_id="test-tenant")

        def mock_tenant():
            return "test-tenant"

        app.dependency_overrides[get_current_user] = mock_auth
        app.dependency_overrides[get_tenant_id_from_request] = mock_tenant

        mock_service = AsyncMock()
        mock_service.generate_receipt_for_invoice = AsyncMock(return_value=mock_receipt)
        mock_service_class.return_value = mock_service

        client = TestClient(app)
        response = client.post(
            "/billing/receipts/generate/invoice",
            json={
                "invoice_id": "invoice-123",
                "payment_details": {"method": "credit_card", "amount": 1000},
                "include_pdf": True,
                "include_html": True,
            },
            headers={"X-Tenant-ID": "test-tenant"},
        )

        # Clean up overrides
        app.dependency_overrides.clear()

        assert response.status_code == 201
        data = response.json()
        assert data["receipt_number"] == "RCT-001"

    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_invoice_value_error(self, mock_service_class, app):
        """Test receipt generation for invoice with value error."""
        from dotmac.platform.billing.receipts.router import (
            get_current_user,
            get_tenant_id_from_request,
        )

        # Override dependencies
        app.dependency_overrides[get_current_user] = lambda: MagicMock(
            user_id="test-user", tenant_id="test-tenant"
        )
        app.dependency_overrides[get_tenant_id_from_request] = lambda: "test-tenant"

        mock_service = AsyncMock()
        mock_service.generate_receipt_for_invoice = AsyncMock(
            side_effect=ValueError("Invalid invoice ID")
        )
        mock_service_class.return_value = mock_service

        client = TestClient(app)
        response = client.post(
            "/billing/receipts/generate/invoice",
            json={
                "invoice_id": "invalid",
                "payment_details": {},
                "include_pdf": True,
                "include_html": True,
            },
            headers={"X-Tenant-ID": "test-tenant"},
        )

        app.dependency_overrides.clear()
        assert response.status_code == 400

    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_generate_receipt_for_invoice_exception(self, mock_service_class, app):
        """Test receipt generation for invoice with exception."""
        from dotmac.platform.billing.receipts.router import (
            get_current_user,
            get_tenant_id_from_request,
        )

        # Override dependencies
        app.dependency_overrides[get_current_user] = lambda: MagicMock(
            user_id="test-user", tenant_id="test-tenant"
        )
        app.dependency_overrides[get_tenant_id_from_request] = lambda: "test-tenant"

        mock_service = AsyncMock()
        mock_service.generate_receipt_for_invoice = AsyncMock(
            side_effect=Exception("Service error")
        )
        mock_service_class.return_value = mock_service

        client = TestClient(app)
        response = client.post(
            "/billing/receipts/generate/invoice",
            json={
                "invoice_id": "invoice-123",
                "payment_details": {},
                "include_pdf": True,
                "include_html": True,
            },
            headers={"X-Tenant-ID": "test-tenant"},
        )

        app.dependency_overrides.clear()
        assert response.status_code == 500


class TestGetReceipt:
    """Test GET /{receipt_id} endpoint."""

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_success(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test successful receipt retrieval."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=mock_receipt)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/receipt-123")

        assert response.status_code == 200
        data = response.json()
        assert data["receipt_number"] == "RCT-001"

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_not_found(self, mock_service_class, mock_get_tenant, mock_auth, client):
        """Test receipt not found."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=None)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/nonexistent")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestListReceipts:
    """Test GET / endpoint."""

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_list_receipts_success(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test successful receipt listing."""
        mock_service = AsyncMock()
        mock_service.list_receipts = AsyncMock(return_value=[mock_receipt])
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts")

        assert response.status_code == 200
        data = response.json()
        assert "receipts" in data
        assert len(data["receipts"]) == 1
        assert data["total_count"] == 1
        assert data["has_more"] is False

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_list_receipts_with_filters(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test receipt listing with filters."""
        mock_service = AsyncMock()
        mock_service.list_receipts = AsyncMock(return_value=[mock_receipt])
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get(
            "/billing/receipts?customer_id=customer-123&payment_id=payment-123&limit=50"
        )

        assert response.status_code == 200

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_list_receipts_has_more(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test receipt listing with has_more flag."""
        # Return limit + 1 receipts to trigger has_more
        receipts = [mock_receipt] * 11
        mock_service = AsyncMock()
        mock_service.list_receipts = AsyncMock(return_value=receipts)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts?limit=10")

        assert response.status_code == 200
        data = response.json()
        assert data["has_more"] is True
        assert len(data["receipts"]) == 10  # Trimmed to limit


class TestGetReceiptHTML:
    """Test GET /{receipt_id}/html endpoint."""

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_html_success(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test successful HTML receipt retrieval."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=mock_receipt)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/receipt-123/html")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_html_not_found(
        self, mock_service_class, mock_get_tenant, mock_auth, client
    ):
        """Test HTML receipt not found."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=None)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/nonexistent/html")

        assert response.status_code == 404

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_html_generate_on_demand(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test HTML generation on demand."""
        mock_receipt.html_content = None
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=mock_receipt)
        mock_service.html_generator = AsyncMock()
        mock_service.html_generator.generate_html = AsyncMock(return_value="<html>Generated</html>")
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/receipt-123/html")

        assert response.status_code == 200


class TestGetReceiptPDF:
    """Test GET /{receipt_id}/pdf endpoint."""

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_pdf_success(
        self, mock_service_class, mock_get_tenant, mock_auth, client, mock_receipt
    ):
        """Test successful PDF receipt retrieval."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=mock_receipt)
        mock_service.pdf_generator = AsyncMock()
        mock_service.pdf_generator.generate_pdf = AsyncMock(return_value=b"PDF content")
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/receipt-123/pdf")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers["content-disposition"]
        assert "RCT-001" in response.headers["content-disposition"]

    @patch("dotmac.platform.billing.receipts.router.get_current_user")
    @patch("dotmac.platform.billing.receipts.router.get_tenant_id_from_request")
    @patch("dotmac.platform.billing.receipts.router.ReceiptService")
    def test_get_receipt_pdf_not_found(
        self, mock_service_class, mock_get_tenant, mock_auth, client
    ):
        """Test PDF receipt not found."""
        mock_service = AsyncMock()
        mock_service.get_receipt = AsyncMock(return_value=None)
        mock_service_class.return_value = mock_service
        mock_get_tenant.return_value = "test-tenant"
        mock_auth.return_value = MagicMock()

        response = client.get("/billing/receipts/nonexistent/pdf")

        assert response.status_code == 404
