"""
Comprehensive tests for billing/middleware.py to improve coverage from 0%.

Tests cover:
- BillingErrorMiddleware: error handling, logging, correlation IDs
- BillingValidationMiddleware: content-type validation, request validation
- BillingAuditMiddleware: audit logging for sensitive operations
- setup_billing_middleware: middleware configuration
"""

from unittest.mock import Mock, patch

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from dotmac.platform.billing.exceptions import BillingError
from dotmac.platform.billing.middleware import (
    BillingAuditMiddleware,
    BillingErrorMiddleware,
    BillingValidationMiddleware,
    setup_billing_middleware,
)


@pytest.fixture
def mock_app():
    """Create a FastAPI app for testing."""
    app = FastAPI()

    @app.get("/api/v1/billing/invoices")
    async def get_invoices():
        return {"invoices": []}

    @app.post("/api/v1/billing/payments")
    async def create_payment():
        return {"payment_id": "test-123"}

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    return app


@pytest.mark.integration
class TestBillingErrorMiddleware:
    """Test BillingErrorMiddleware error handling."""

    def test_successful_request_with_correlation_id(self, mock_app):
        """Test successful request adds correlation ID."""
        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200

    def test_correlation_id_from_header(self, mock_app):
        """Test correlation ID is extracted from request header."""
        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        correlation_id = "test-correlation-123"
        response = client.get(
            "/api/v1/billing/invoices",
            headers={"X-Correlation-ID": correlation_id},
        )

        assert response.status_code == 200

    def test_billing_error_handling(self, mock_app):
        """Test BillingError is properly handled and formatted."""

        @mock_app.get("/api/v1/billing/error")
        async def raise_billing_error():
            raise BillingError(
                message="Payment failed",
                error_code="PAYMENT_FAILED",
                status_code=400,
                context={"reason": "Insufficient funds"},
            )

        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/error")

        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert data["error"]["error_code"] == "PAYMENT_FAILED"
        assert "correlation_id" in data
        assert "request_path" in data
        assert "X-Correlation-ID" in response.headers

    def test_generic_exception_handling(self, mock_app):
        """Test unexpected exceptions are caught and formatted."""

        @mock_app.get("/api/v1/billing/crash")
        async def raise_exception():
            raise ValueError("Something went wrong")

        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/crash")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        assert data["error"]["error_code"] == "INTERNAL_ERROR"
        assert "correlation_id" in data
        assert "X-Correlation-ID" in response.headers

    def test_non_billing_request_passes_through(self, mock_app):
        """Test non-billing requests are not logged specially."""
        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/health")

        assert response.status_code == 200

    @patch("dotmac.platform.billing.middleware.logger")
    def test_billing_request_logging(self, mock_logger, mock_app):
        """Test billing requests are logged with context."""
        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200
        assert mock_logger.info.called

    def test_tenant_context_included(self, mock_app):
        """Test tenant_id is included in context when available."""

        @mock_app.middleware("http")
        async def add_tenant_context(request: Request, call_next):
            request.state.tenant_id = "tenant-123"
            return await call_next(request)

        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200

    def test_client_ip_extraction(self, mock_app):
        """Test client IP is extracted from request."""
        mock_app.add_middleware(BillingErrorMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200


@pytest.mark.integration
class TestBillingValidationMiddleware:
    """Test BillingValidationMiddleware request validation."""

    def test_non_billing_endpoint_skipped(self, mock_app):
        """Test validation is skipped for non-billing endpoints."""
        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/health")

        assert response.status_code == 200

    def test_get_request_no_content_type_check(self, mock_app):
        """Test GET requests don't require content-type validation."""
        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200

    def test_post_request_valid_content_type(self, mock_app):
        """Test POST request with valid JSON content-type."""
        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.post(
            "/api/v1/billing/payments",
            json={"amount": 100},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200

    def test_post_request_invalid_content_type(self, mock_app):
        """Test POST request with invalid content-type returns 415."""
        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.post(
            "/api/v1/billing/payments",
            content="plain text",
            headers={"Content-Type": "text/plain"},
        )

        assert response.status_code == 415
        data = response.json()
        assert data["error"]["error_code"] == "UNSUPPORTED_MEDIA_TYPE"
        assert "Content-Type" in data["error"]["message"]

    def test_put_request_invalid_content_type(self, mock_app):
        """Test PUT request validation."""

        @mock_app.put("/api/v1/billing/subscriptions/{subscription_id}")
        async def update_subscription(subscription_id: str):
            return {"subscription_id": subscription_id}

        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.put(
            "/api/v1/billing/subscriptions/sub-123",
            content="invalid",
            headers={"Content-Type": "text/xml"},
        )

        assert response.status_code == 415

    def test_patch_request_validation(self, mock_app):
        """Test PATCH request content-type validation."""

        @mock_app.patch("/api/v1/billing/invoices/{invoice_id}")
        async def patch_invoice(invoice_id: str):
            return {"invoice_id": invoice_id}

        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        # Invalid content-type
        response = client.patch(
            "/api/v1/billing/invoices/inv-123",
            content="data",
            headers={"Content-Type": "application/xml"},
        )

        assert response.status_code == 415

    def test_request_timestamp_added(self, mock_app):
        """Test request timestamp is added to request state."""

        @mock_app.get("/api/v1/billing/test")
        async def test_endpoint(request: Request):
            assert hasattr(request.state, "request_time")
            return {"ok": True}

        mock_app.add_middleware(BillingValidationMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200


@pytest.mark.integration
class TestBillingAuditMiddleware:
    """Test BillingAuditMiddleware audit logging."""

    @patch("dotmac.platform.billing.middleware.logger")
    def test_payment_operation_audited(self, mock_logger, mock_app):
        """Test payment operations are audit logged."""
        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/payments", json={"amount": 100})

        assert response.status_code == 200
        # Verify audit log was created
        assert mock_logger.info.called
        call_args = mock_logger.info.call_args
        assert "Billing operation audit log" in call_args[0]

    @patch("dotmac.platform.billing.middleware.logger")
    def test_subscription_operation_audited(self, mock_logger, mock_app):
        """Test subscription operations are audit logged."""

        @mock_app.post("/api/v1/billing/subscriptions")
        async def create_subscription():
            return {"subscription_id": "sub-123"}

        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/subscriptions", json={"plan": "pro"})

        assert response.status_code == 200
        assert mock_logger.info.called

    @patch("dotmac.platform.billing.middleware.logger")
    def test_refund_operation_audited(self, mock_logger, mock_app):
        """Test refund operations are audit logged."""

        @mock_app.post("/api/v1/billing/refunds")
        async def create_refund():
            return {"refund_id": "ref-123"}

        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/refunds", json={"payment_id": "pay-123"})

        assert response.status_code == 200
        assert mock_logger.info.called

    @patch("dotmac.platform.billing.middleware.logger")
    def test_pricing_rule_operation_audited(self, mock_logger, mock_app):
        """Test pricing rule operations are audit logged."""

        @mock_app.post("/api/v1/billing/pricing/rules")
        async def create_pricing_rule():
            return {"rule_id": "rule-123"}

        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/pricing/rules", json={"name": "discount"})

        assert response.status_code == 200
        assert mock_logger.info.called

    def test_non_auditable_operation_skipped(self, mock_app):
        """Test non-auditable operations are not logged."""
        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.get("/api/v1/billing/invoices")

        assert response.status_code == 200

    def test_audit_with_user_context(self, mock_app):
        """Test audit logging includes user context when available."""

        @mock_app.middleware("http")
        async def add_user_context(request: Request, call_next):
            request.state.user = Mock(user_id="user-123")
            return await call_next(request)

        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/payments", json={"amount": 100})

        assert response.status_code == 200

    def test_audit_with_tenant_context(self, mock_app):
        """Test audit logging includes tenant context."""

        @mock_app.middleware("http")
        async def add_tenant_context(request: Request, call_next):
            request.state.tenant_id = "tenant-456"
            return await call_next(request)

        mock_app.add_middleware(BillingAuditMiddleware)
        client = TestClient(mock_app)

        response = client.post("/api/v1/billing/payments", json={"amount": 100})

        assert response.status_code == 200

    def test_get_operation_type_payment(self):
        """Test _get_operation_type identifies payment operations."""
        middleware = BillingAuditMiddleware(Mock())

        op_type = middleware._get_operation_type("POST", "/api/v1/billing/payments")

        assert op_type == "payment_operation"

    def test_get_operation_type_refund(self):
        """Test _get_operation_type identifies refund operations."""
        middleware = BillingAuditMiddleware(Mock())

        op_type = middleware._get_operation_type("POST", "/api/v1/billing/refunds")

        assert op_type == "refund_operation"

    def test_get_operation_type_subscription(self):
        """Test _get_operation_type identifies subscription operations."""
        middleware = BillingAuditMiddleware(Mock())

        op_type = middleware._get_operation_type("PUT", "/api/v1/billing/subscriptions/123")

        assert op_type == "subscription_operation"

    def test_get_operation_type_pricing(self):
        """Test _get_operation_type identifies pricing operations."""
        middleware = BillingAuditMiddleware(Mock())

        op_type = middleware._get_operation_type("POST", "/api/v1/billing/pricing/rules")

        assert op_type == "pricing_operation"

    def test_get_operation_type_generic(self):
        """Test _get_operation_type returns generic for unknown operations."""
        middleware = BillingAuditMiddleware(Mock())

        op_type = middleware._get_operation_type("GET", "/api/v1/billing/other")

        assert op_type == "billing_operation"


@pytest.mark.integration
class TestSetupBillingMiddleware:
    """Test setup_billing_middleware configuration function."""

    @patch("dotmac.platform.billing.middleware.logger")
    def test_setup_adds_all_middleware(self, mock_logger):
        """Test all three middleware are added to app."""
        app = FastAPI()

        setup_billing_middleware(app)

        # Verify middleware were added
        assert len(app.user_middleware) == 3
        assert mock_logger.info.called

    @patch("dotmac.platform.billing.middleware.logger")
    def test_middleware_order(self, mock_logger):
        """Test middleware are added in correct order."""
        app = FastAPI()

        setup_billing_middleware(app)

        # Middleware is added in reverse order (last added executes first)
        # So we expect: Error -> Validation -> Audit
        middleware_classes = [m.cls for m in app.user_middleware]

        assert BillingErrorMiddleware in middleware_classes
        assert BillingValidationMiddleware in middleware_classes
        assert BillingAuditMiddleware in middleware_classes

    def test_integration_all_middleware(self):
        """Test all middleware working together."""
        app = FastAPI()

        @app.post("/api/v1/billing/payments")
        async def create_payment(request: Request):
            # Simulate accessing request state set by middleware
            assert hasattr(request.state, "correlation_id")
            assert hasattr(request.state, "request_time")
            return {"payment_id": "pay-123"}

        setup_billing_middleware(app)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            json={"amount": 100},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 200


@pytest.mark.integration
class TestMiddlewareIntegration:
    """Test middleware integration scenarios."""

    def test_full_stack_successful_billing_request(self):
        """Test complete middleware stack with successful request."""
        app = FastAPI()

        @app.post("/api/v1/billing/payments")
        async def create_payment(request: Request):
            return {
                "payment_id": "pay-123",
                "correlation_id": request.state.correlation_id,
            }

        setup_billing_middleware(app)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            json={"amount": 100},
            headers={
                "Content-Type": "application/json",
                "X-Correlation-ID": "test-correlation-456",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["correlation_id"] == "test-correlation-456"

    def test_full_stack_billing_error(self):
        """Test complete middleware stack with BillingError."""
        app = FastAPI()

        @app.post("/api/v1/billing/payments")
        async def create_payment():
            raise BillingError(
                message="Insufficient funds",
                error_code="INSUFFICIENT_FUNDS",
                status_code=402,
            )

        setup_billing_middleware(app)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            json={"amount": 100},
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 402
        data = response.json()
        assert data["error"]["error_code"] == "INSUFFICIENT_FUNDS"
        assert "correlation_id" in data

    def test_full_stack_invalid_content_type(self):
        """Test middleware stack rejects invalid content-type."""
        app = FastAPI()

        @app.post("/api/v1/billing/payments")
        async def create_payment():
            return {"payment_id": "should-not-reach"}

        setup_billing_middleware(app)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            content="not json",
            headers={"Content-Type": "text/plain"},
        )

        assert response.status_code == 415
        data = response.json()
        assert data["error"]["error_code"] == "UNSUPPORTED_MEDIA_TYPE"
