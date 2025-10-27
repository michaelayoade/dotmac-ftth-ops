"""
Comprehensive tests for Customer Portal Router.

Tests customer-facing endpoints with focus on auth boundaries, data isolation,
and proper error handling. Critical for customer data security.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.customer_management.models import Customer
from dotmac.platform.database import get_async_session


@pytest.fixture
def test_user():
    """Create a test user."""
    return UserInfo(
        user_id=str(uuid4()),
        tenant_id=f"test_tenant_{uuid4()}",
        email="customer@example.com",
        is_platform_admin=False,
        username="customer",
    )


@pytest.fixture
def mock_db():
    """Create a mock database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    return session


@pytest.fixture
def sample_customer(test_user: UserInfo):
    """Create a sample customer."""
    return Customer(
        id=uuid4(),
        tenant_id=test_user.tenant_id,
        first_name="John",
        last_name="Doe",
        email=test_user.email,
        phone="+1234567890",
        user_id=uuid4(),
        service_address_line1="123 Main St",
        service_city="Test City",
        service_state_province="TS",
        service_postal_code="12345",
        service_country="US",
    )


@pytest.fixture
def fastapi_app():
    """Create FastAPI app for testing."""
    from dotmac.platform.tenant_app import create_tenant_app

    return create_tenant_app()


@pytest.fixture
def client(
    fastapi_app: FastAPI,
    test_user: UserInfo,
    mock_db: AsyncMock,
):
    """Create test client with mocked dependencies."""
    # Override auth
    fastapi_app.dependency_overrides[get_current_user] = lambda: test_user

    # Override DB
    async def get_mock_db():
        yield mock_db

    fastapi_app.dependency_overrides[get_async_session] = get_mock_db

    client = TestClient(fastapi_app)
    yield client

    fastapi_app.dependency_overrides.clear()


class TestAuthenticationBoundaries:
    """Test authentication and authorization boundaries."""

    def test_usage_history_requires_auth(self, fastapi_app: FastAPI):
        """Test that usage history requires authentication."""
        client = TestClient(fastapi_app)
        response = client.get("/api/v1/customer/usage/history")

        # Should be unauthorized
        assert response.status_code in [401, 403]

    def test_payment_methods_require_auth(self, fastapi_app: FastAPI):
        """Test that payment methods require authentication."""
        client = TestClient(fastapi_app)
        response = client.get("/api/v1/customer/payment-methods")

        assert response.status_code in [401, 403]

    def test_invoice_download_requires_auth(self, fastapi_app: FastAPI):
        """Test that invoice download requires authentication."""
        client = TestClient(fastapi_app)
        response = client.get("/api/v1/customer/invoices/test-id/download")

        assert response.status_code in [401, 403]


class TestCustomerDataIsolation:
    """Test that customers can only access their own data."""

    def test_customer_cannot_access_other_customer_invoice(
        self,
        client: TestClient,
        test_user: UserInfo,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test that customers cannot download other customers' invoices."""
        from dotmac.platform.billing.domain.aggregates import Invoice

        # Setup customer lookup
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        # Create invoice for a different customer
        other_customer_id = uuid4()
        invoice = Invoice(
            id=str(uuid4()),
            tenant_id=test_user.tenant_id,
            customer_id=str(other_customer_id),  # Different customer!
            invoice_number="INV-001",
            total_amount=100.00,
            status="paid",
        )

        # Mock invoice service
        with patch("dotmac.platform.customer_portal.router.MoneyInvoiceService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_invoice = AsyncMock(return_value=invoice)
            mock_service_class.return_value = mock_service

            response = client.get(f"/api/v1/customer/invoices/{invoice.id}/download")

            # Should be forbidden
            assert response.status_code == 403
            assert "permission" in response.json()["detail"].lower()

    def test_customer_record_not_found(
        self,
        client: TestClient,
        mock_db: AsyncMock,
    ):
        """Test error when customer record doesn't exist."""
        # Customer not found
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=None)
        mock_db.execute.return_value = mock_result

        response = client.get("/api/v1/customer/usage/history")

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


class TestUsageHistoryEndpoint:
    """Test usage history endpoint."""

    def test_get_usage_history_success(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test successful usage history retrieval."""
        # Mock customer lookup
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)

        # Mock RADIUS data
        mock_usage_result = Mock()
        mock_usage_row = Mock()
        mock_usage_row.total_input = 1024**3 * 5  # 5 GB
        mock_usage_row.total_output = 1024**3 * 3  # 3 GB
        mock_usage_result.one = Mock(return_value=mock_usage_row)

        # Mock daily breakdown (empty for simplicity)
        mock_daily_result = Mock()
        mock_daily_result.__iter__ = Mock(return_value=iter([]))

        # Mock hourly breakdown (empty for simplicity)
        mock_hourly_result = Mock()
        mock_hourly_result.__iter__ = Mock(return_value=iter([]))

        mock_db.execute.side_effect = [
            mock_result,  # Customer lookup
            mock_usage_result,  # Total usage
            mock_daily_result,  # Daily breakdown
            mock_hourly_result,  # Hourly breakdown
        ]

        response = client.get("/api/v1/customer/usage/history?time_range=30d")

        assert response.status_code == 200
        data = response.json()
        assert "period_start" in data
        assert "period_end" in data
        assert "total_download_gb" in data
        assert "total_upload_gb" in data
        assert data["total_download_gb"] == 5.0
        assert data["total_upload_gb"] == 3.0
        assert data["total_gb"] == 8.0

    def test_get_usage_history_different_time_ranges(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test usage history with different time ranges."""
        for time_range in ["7d", "30d", "90d"]:
            # Mock customer lookup
            mock_result = Mock()
            mock_result.scalar_one_or_none = Mock(return_value=sample_customer)

            # Mock RADIUS data
            mock_usage_result = Mock()
            mock_usage_row = Mock()
            mock_usage_row.total_input = 1024**3 * 2
            mock_usage_row.total_output = 1024**3 * 1
            mock_usage_result.one = Mock(return_value=mock_usage_row)

            mock_daily_result = Mock()
            mock_daily_result.__iter__ = Mock(return_value=iter([]))

            mock_hourly_result = Mock()
            mock_hourly_result.__iter__ = Mock(return_value=iter([]))

            mock_db.execute.side_effect = [
                mock_result,
                mock_usage_result,
                mock_daily_result,
                mock_hourly_result,
            ]

            response = client.get(f"/api/v1/customer/usage/history?time_range={time_range}")

            assert response.status_code == 200


class TestUsageReportGeneration:
    """Test usage report PDF generation."""

    def test_generate_usage_report_success(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test successful PDF report generation."""
        # Mock customer lookup
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        report_data = {
            "period": {
                "start": "2025-10-01",
                "end": "2025-10-31",
            },
            "summary": {
                "total_gb": 100.5,
                "download_gb": 70.0,
                "upload_gb": 30.5,
                "limit_gb": "Unlimited",
                "usage_percentage": 0.0,
                "days_remaining": 5,
            },
            "daily_usage": [
                {"date": "2025-10-01", "download": 2.5, "upload": 1.0},
                {"date": "2025-10-02", "download": 3.0, "upload": 1.5},
            ],
            "hourly_usage": [],
            "time_range": "30d",
        }

        response = client.post("/api/v1/customer/usage/report", json=report_data)

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment" in response.headers["content-disposition"]
        assert len(response.content) > 0  # PDF should have content

    def test_generate_usage_report_pdf_structure(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test that generated PDF has correct structure."""
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        report_data = {
            "period": {"start": "2025-10-01", "end": "2025-10-31"},
            "summary": {
                "total_gb": 50.0,
                "download_gb": 35.0,
                "upload_gb": 15.0,
            },
            "daily_usage": [],
            "hourly_usage": [],
        }

        response = client.post("/api/v1/customer/usage/report", json=report_data)

        assert response.status_code == 200
        # PDF signature
        assert response.content[:4] == b"%PDF"


class TestInvoiceDownload:
    """Test invoice download functionality."""

    def test_download_invoice_success(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test successful invoice download."""
        from dotmac.platform.billing.domain.aggregates import Invoice

        invoice_id = uuid4()
        invoice = Invoice(
            id=str(invoice_id),
            tenant_id=sample_customer.tenant_id,
            customer_id=str(sample_customer.id),
            invoice_number="INV-2025-001",
            total_amount=150.00,
            currency="USD",
            status="paid",
        )

        # Mock customer lookup
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        # Mock invoice service
        with patch("dotmac.platform.customer_portal.router.MoneyInvoiceService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_invoice = AsyncMock(return_value=invoice)
            mock_service_class.return_value = mock_service

            # Mock PDF generator
            with patch("dotmac.platform.customer_portal.router.ReportLabInvoiceGenerator") as mock_pdf_class:
                mock_pdf = Mock()
                mock_pdf.generate_invoice_pdf = Mock(return_value=b"%PDF-1.4\ntest content")
                mock_pdf_class.return_value = mock_pdf

                response = client.get(f"/api/v1/customer/invoices/{invoice_id}/download")

                assert response.status_code == 200
                assert response.headers["content-type"] == "application/pdf"
                assert f"invoice-{invoice.invoice_number}.pdf" in response.headers["content-disposition"]

    def test_download_invoice_not_found(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test invoice download when invoice doesn't exist."""
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.MoneyInvoiceService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.get_invoice = AsyncMock(return_value=None)
            mock_service_class.return_value = mock_service

            response = client.get(f"/api/v1/customer/invoices/{uuid4()}/download")

            assert response.status_code == 404

    def test_download_invoice_invalid_id(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test invoice download with invalid ID format."""
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        response = client.get("/api/v1/customer/invoices/invalid-uuid/download")

        assert response.status_code == 400


class TestPaymentMethods:
    """Test payment method endpoints."""

    def test_list_payment_methods_success(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test listing payment methods."""
        from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.PaymentMethodService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.list_payment_methods_for_customer = AsyncMock(
                return_value=[
                    PaymentMethodResponse(
                        payment_method_id="pm_test123",
                        tenant_id=sample_customer.tenant_id,
                        method_type="card",
                        status="active",
                        is_default=True,
                        card_last4="4242",
                        card_exp_month=12,
                        card_exp_year=2025,
                        card_brand="visa",
                        auto_pay_enabled=True,
                        bank_name=None,
                        bank_account_last4=None,
                        bank_account_type=None,
                        wallet_type=None,
                        billing_name=None,
                        billing_email=None,
                        billing_country=None,
                        is_verified=True,
                        created_at=datetime.utcnow(),
                    )
                ]
            )
            mock_service_class.return_value = mock_service

            response = client.get("/api/v1/customer/payment-methods")

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["payment_method_id"] == "pm_test123"
            assert data[0]["is_default"] is True

    def test_add_payment_method_success(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test adding a payment method."""
        from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.PaymentMethodService") as mock_service_class:
            mock_service = AsyncMock()
            new_method = PaymentMethodResponse(
                payment_method_id="pm_new123",
                tenant_id=sample_customer.tenant_id,
                method_type="card",
                status="active",
                is_default=False,
                card_last4="5555",
                card_exp_month=6,
                card_exp_year=2026,
                card_brand="mastercard",
                auto_pay_enabled=False,
                bank_name=None,
                bank_account_last4=None,
                bank_account_type=None,
                wallet_type=None,
                billing_name=None,
                billing_email=None,
                billing_country=None,
                is_verified=True,
                created_at=datetime.utcnow(),
            )
            mock_service.add_payment_method = AsyncMock(return_value=new_method)
            mock_service_class.return_value = mock_service

            payload = {
                "method_type": "card",
                "card_token": "tok_test123",
                "set_as_default": False,
                "billing_name": "John Doe",
            }

            response = client.post("/api/v1/customer/payment-methods", json=payload)

            assert response.status_code == 201
            data = response.json()
            assert data["payment_method_id"] == "pm_new123"
            assert data["last_four"] == "5555"

    def test_set_default_payment_method(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test setting a payment method as default."""
        from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.PaymentMethodService") as mock_service_class:
            mock_service = AsyncMock()
            updated_method = PaymentMethodResponse(
                payment_method_id="pm_test123",
                tenant_id=sample_customer.tenant_id,
                method_type="card",
                status="active",
                is_default=True,
                card_last4="4242",
                card_exp_month=12,
                card_exp_year=2025,
                card_brand="visa",
                auto_pay_enabled=True,
                bank_name=None,
                bank_account_last4=None,
                bank_account_type=None,
                wallet_type=None,
                billing_name=None,
                billing_email=None,
                billing_country=None,
                is_verified=True,
                created_at=datetime.utcnow(),
            )
            mock_service.set_default_payment_method = AsyncMock(return_value=updated_method)
            mock_service_class.return_value = mock_service

            response = client.post("/api/v1/customer/payment-methods/pm_test123/default")

            assert response.status_code == 200
            data = response.json()
            assert data["is_default"] is True

    def test_remove_payment_method(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test removing a payment method."""
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.PaymentMethodService") as mock_service_class:
            mock_service = AsyncMock()
            mock_service.remove_payment_method = AsyncMock()
            mock_service_class.return_value = mock_service

            response = client.delete("/api/v1/customer/payment-methods/pm_test123")

            assert response.status_code == 204

    def test_toggle_autopay(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test toggling AutoPay for a payment method."""
        from dotmac.platform.billing.payment_methods.models import PaymentMethodResponse

        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.return_value = mock_result

        with patch("dotmac.platform.customer_portal.router.PaymentMethodService") as mock_service_class:
            mock_service = AsyncMock()
            updated_method = PaymentMethodResponse(
                payment_method_id="pm_test123",
                tenant_id=sample_customer.tenant_id,
                method_type="card",
                status="active",
                is_default=True,
                card_last4="4242",
                card_exp_month=12,
                card_exp_year=2025,
                card_brand="visa",
                auto_pay_enabled=True,  # Toggled on
                bank_name=None,
                bank_account_last4=None,
                bank_account_type=None,
                wallet_type=None,
                billing_name=None,
                billing_email=None,
                billing_country=None,
                is_verified=True,
                created_at=datetime.utcnow(),
            )
            mock_service.toggle_autopay = AsyncMock(return_value=updated_method)
            mock_service_class.return_value = mock_service

            response = client.post("/api/v1/customer/payment-methods/pm_test123/toggle-autopay")

            assert response.status_code == 200
            data = response.json()
            assert data["auto_pay_enabled"] is True


class TestErrorHandling:
    """Test error handling and edge cases."""

    def test_usage_history_database_error(
        self,
        client: TestClient,
        mock_db: AsyncMock,
        sample_customer: Customer,
    ):
        """Test handling of database errors."""
        mock_result = Mock()
        mock_result.scalar_one_or_none = Mock(return_value=sample_customer)
        mock_db.execute.side_effect = [mock_result, Exception("Database error")]

        response = client.get("/api/v1/customer/usage/history")

        assert response.status_code == 500
        assert "failed" in response.json()["detail"].lower()
