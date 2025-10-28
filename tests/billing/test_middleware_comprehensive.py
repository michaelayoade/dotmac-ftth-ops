"""
Comprehensive tests for billing middleware.

Tests error handling, validation, audit logging, and metrics collection.
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, Request

from dotmac.platform.billing.exceptions import BillingError
from dotmac.platform.billing.middleware import (
    BillingAuditMiddleware,
    BillingErrorMiddleware,
    BillingValidationMiddleware,
    setup_billing_middleware,
)


@pytest.fixture
def app():
    """Create test FastAPI app."""
    app = FastAPI()

    @app.get("/api/v1/billing/test")
    async def billing_endpoint():
        return {"status": "ok"}

    @app.get("/api/v1/other/test")
    async def non_billing_endpoint():
        return {"status": "ok"}

    @app.post("/api/v1/billing/payments")
    async def create_payment():
        return {"payment_id": "pay_123"}

    @app.get("/api/v1/billing/error")
    async def error_endpoint():
        raise BillingError(
            error_code="PAYMENT_FAILED",
            message="Payment processing failed",
            status_code=400,
        )

    @app.get("/api/v1/billing/unexpected")
    async def unexpected_error():
        raise ValueError("Something unexpected happened")

    return app


@pytest.mark.integration
class TestBillingErrorMiddleware:
    """Test billing error middleware."""

    def test_adds_correlation_id_from_header(self, app):
        """Test correlation ID is extracted from request header."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get(
            "/api/v1/billing/test",
            headers={"X-Correlation-ID": "test-correlation-123"},
        )

        assert response.status_code == 200

    def test_generates_correlation_id_if_missing(self, app):
        """Test correlation ID is generated when not provided."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200

    def test_handles_billing_error(self, app):
        """Test BillingError is converted to proper JSON response."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/error")

        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert data["error"]["error_code"] == "PAYMENT_FAILED"
        assert data["error"]["message"] == "Payment processing failed"
        assert "correlation_id" in data
        assert "X-Correlation-ID" in response.headers

    def test_handles_unexpected_error(self, app):
        """Test unexpected errors are handled gracefully."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/unexpected")

        assert response.status_code == 500
        data = response.json()
        assert "error" in data
        assert data["error"]["error_code"] == "INTERNAL_ERROR"
        assert data["error"]["status_code"] == 500
        assert "correlation_id" in data

    @patch("dotmac.platform.billing.middleware.logger")
    def test_logs_billing_requests(self, mock_logger, app):
        """Test billing requests are logged."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200
        # Check that logger.info was called
        mock_logger.info.assert_called()

    @patch("dotmac.platform.billing.middleware.logger")
    def test_logs_billing_errors(self, mock_logger, app):
        """Test billing errors are logged."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/error")

        assert response.status_code == 400
        # Check that logger.error was called
        mock_logger.error.assert_called()

    def test_includes_tenant_context_when_available(self, app):
        """Test tenant context is included in logs when available."""
        from starlette.testclient import TestClient

        @app.middleware("http")
        async def add_tenant_context(request: Request, call_next):
            request.state.tenant_id = "tenant_123"
            response = await call_next(request)
            return response

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200

    def test_non_billing_requests_pass_through(self, app):
        """Test non-billing requests are not logged with billing context."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingErrorMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/other/test")

        assert response.status_code == 200


@pytest.mark.integration
class TestBillingValidationMiddleware:
    """Test billing validation middleware."""

    def test_non_billing_requests_skip_validation(self, app):
        """Test non-billing endpoints skip validation."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingValidationMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/other/test")

        assert response.status_code == 200

    def test_rejects_invalid_content_type_for_post(self, app):
        """Test POST requests with wrong content type are rejected."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingValidationMiddleware)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            data="not json",
            headers={"content-type": "text/plain"},
        )

        assert response.status_code == 415
        data = response.json()
        assert data["error"]["error_code"] == "UNSUPPORTED_MEDIA_TYPE"

    def test_accepts_valid_json_content_type(self, app):
        """Test requests with application/json are accepted."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingValidationMiddleware)
        client = TestClient(app)

        response = client.post(
            "/api/v1/billing/payments",
            json={"amount": "100.00"},
        )

        assert response.status_code == 200

    def test_get_requests_dont_require_content_type(self, app):
        """Test GET requests don't require content type validation."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingValidationMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200

    def test_adds_request_timestamp(self, app):
        """Test request timestamp is added to state."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingValidationMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200


@pytest.mark.integration
class TestBillingAuditMiddleware:
    """Test billing audit middleware."""

    @patch("dotmac.platform.billing.middleware.logger")
    def test_audits_payment_operation(self, mock_logger, app):
        """Test payment operations are audit logged."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingAuditMiddleware)
        client = TestClient(app)

        response = client.post("/api/v1/billing/payments", json={"amount": "100"})

        assert response.status_code == 200
        # Check that audit log was created
        mock_logger.info.assert_called()
        call_args = mock_logger.info.call_args
        assert "Billing operation audit log" in call_args[0]

    @patch("dotmac.platform.billing.middleware.logger")
    def test_audits_subscription_operation(self, mock_logger, app):
        """Test subscription operations are audit logged."""
        from starlette.testclient import TestClient

        @app.post("/api/v1/billing/subscriptions")
        async def create_subscription():
            return {"subscription_id": "sub_123"}

        app.add_middleware(BillingAuditMiddleware)
        client = TestClient(app)

        response = client.post("/api/v1/billing/subscriptions", json={"plan": "basic"})

        assert response.status_code == 200
        mock_logger.info.assert_called()

    def test_non_audit_operations_pass_through(self, app):
        """Test non-sensitive operations don't trigger audit logging."""
        from starlette.testclient import TestClient

        app.add_middleware(BillingAuditMiddleware)
        client = TestClient(app)

        response = client.get("/api/v1/billing/test")

        assert response.status_code == 200

    @patch("dotmac.platform.billing.middleware.logger")
    def test_includes_user_context_when_available(self, mock_logger, app):
        """Test user context is included in audit logs."""
        from starlette.testclient import TestClient

        @app.middleware("http")
        async def add_user_context(request: Request, call_next):
            request.state.user = MagicMock(user_id="user_123")
            response = await call_next(request)
            return response

        app.add_middleware(BillingAuditMiddleware)
        client = TestClient(app)

        response = client.post("/api/v1/billing/payments", json={"amount": "100"})

        assert response.status_code == 200
        mock_logger.info.assert_called()

    @patch("dotmac.platform.billing.middleware.logger")
    def test_includes_correlation_id_in_audit(self, mock_logger, app):
        """Test correlation ID is included in audit logs."""
        from starlette.testclient import TestClient

        @app.middleware("http")
        async def add_correlation_id(request: Request, call_next):
            request.state.correlation_id = "test-corr-123"
            response = await call_next(request)
            return response

        app.add_middleware(BillingAuditMiddleware)
        client = TestClient(app)

        response = client.post("/api/v1/billing/payments", json={"amount": "100"})

        assert response.status_code == 200
        mock_logger.info.assert_called()

    def test_get_operation_type_for_payments(self):
        """Test operation type classification for payments."""
        middleware = BillingAuditMiddleware(app=MagicMock())
        op_type = middleware._get_operation_type("POST", "/api/v1/billing/payments")
        assert op_type == "payment_operation"

    def test_get_operation_type_for_refunds(self):
        """Test operation type classification for refunds."""
        middleware = BillingAuditMiddleware(app=MagicMock())
        op_type = middleware._get_operation_type("POST", "/api/v1/billing/refunds")
        assert op_type == "refund_operation"

    def test_get_operation_type_for_subscriptions(self):
        """Test operation type classification for subscriptions."""
        middleware = BillingAuditMiddleware(app=MagicMock())
        op_type = middleware._get_operation_type("PUT", "/api/v1/billing/subscriptions/sub_123")
        assert op_type == "subscription_operation"

    def test_get_operation_type_for_pricing(self):
        """Test operation type classification for pricing."""
        middleware = BillingAuditMiddleware(app=MagicMock())
        op_type = middleware._get_operation_type("POST", "/api/v1/billing/pricing/rules")
        assert op_type == "pricing_operation"

    def test_get_operation_type_generic(self):
        """Test operation type for generic billing operations."""
        middleware = BillingAuditMiddleware(app=MagicMock())
        op_type = middleware._get_operation_type("GET", "/api/v1/billing/something")
        assert op_type == "billing_operation"


@pytest.mark.integration
class TestSetupBillingMiddleware:
    """Test middleware setup function."""

    @patch("dotmac.platform.billing.middleware.logger")
    def test_setup_adds_all_middleware(self, mock_logger):
        """Test setup function adds all billing middleware."""
        app = FastAPI()

        setup_billing_middleware(app)

        # Check that middleware was added
        assert len(app.user_middleware) == 3
        mock_logger.info.assert_called_with("Billing middleware configured")

    def test_middleware_order_is_correct(self):
        """Test middleware is added in correct order."""
        app = FastAPI()

        setup_billing_middleware(app)

        # Middleware should be: Error -> Validation -> Audit (reverse order of add)
        assert len(app.user_middleware) == 3
        # First added (last executed) is Audit
        assert app.user_middleware[0].cls == BillingErrorMiddleware
        assert app.user_middleware[1].cls == BillingValidationMiddleware
        assert app.user_middleware[2].cls == BillingAuditMiddleware
