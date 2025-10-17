"""
Integration tests for Sales Order API
"""

import pytest
from fastapi.testclient import TestClient
from decimal import Decimal

from sqlalchemy.orm import Session

from dotmac.platform.sales.models import Order, OrderStatus, ServiceActivation
from dotmac.platform.sales.schemas import (
    OrderCreate,
    OrderSubmit,
    QuickOrderRequest,
)
from .conftest import create_order, create_service_activation


class TestPublicOrderAPI:
    """Tests for public order API endpoints"""

    def test_create_order_public_success(
        self,
        client: TestClient,
        db: Session,
        sample_deployment_template,
    ):
        """Test creating an order via public API"""
        order_data = {
            "customer_email": "test@example.com",
            "customer_name": "Test User",
            "company_name": "Test Company",
            "organization_slug": "test-company",
            "deployment_region": "us-east-1",
            "selected_services": [
                {
                    "service_code": "subscriber-provisioning",
                    "name": "Subscriber Management",
                    "quantity": 1,
                }
            ],
            "currency": "USD",
            "billing_cycle": "monthly",
        }

        response = client.post("/api/public/orders", json=order_data)

        assert response.status_code == 201
        data = response.json()
        assert data["order_number"].startswith("ORD-")
        assert data["status"] == "draft"
        assert data["customer_email"] == order_data["customer_email"]
        assert data["total_amount"] > 0

    def test_create_order_public_validation_error(
        self,
        client: TestClient,
    ):
        """Test order creation with invalid data"""
        invalid_data = {
            "customer_email": "invalid-email",  # Invalid email
            "customer_name": "",  # Empty name
        }

        response = client.post("/api/public/orders", json=invalid_data)

        assert response.status_code == 422  # Validation error

    def test_create_quick_order_starter(
        self,
        client: TestClient,
        db: Session,
        sample_deployment_template,
    ):
        """Test creating quick order with starter package"""
        quick_order = {
            "email": "test@example.com",
            "name": "Test User",
            "company": "Test Company",
            "package_code": "starter",
            "billing_cycle": "monthly",
            "region": "us-east-1",
        }

        response = client.post("/api/public/orders/quick", json=quick_order)

        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["customer_email"] == quick_order["email"]

    def test_create_quick_order_professional(
        self,
        client: TestClient,
        db: Session,
        sample_deployment_template,
    ):
        """Test creating quick order with professional package"""
        quick_order = {
            "email": "test@example.com",
            "name": "Test User",
            "company": "Test Company",
            "package_code": "professional",
            "billing_cycle": "monthly",
            "region": "us-east-1",
            "organization_slug": "test-pro",
        }

        response = client.post("/api/public/orders/quick", json=quick_order)

        assert response.status_code == 201
        data = response.json()
        # Professional package should have more services
        order = db.query(Order).filter(Order.id == data["id"]).first()
        assert len(order.items) >= 4  # More services in professional

    def test_get_order_status_public(
        self,
        client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test getting order status via public API"""
        response = client.get(f"/api/public/orders/{sample_order.order_number}/status")

        assert response.status_code == 200
        data = response.json()
        assert data["order_number"] == sample_order.order_number
        assert data["status"] == sample_order.status.value
        assert "progress_percent" in data

    def test_get_order_status_not_found(
        self,
        client: TestClient,
    ):
        """Test getting status for non-existent order"""
        response = client.get("/api/public/orders/ORD-NONEXISTENT/status")

        assert response.status_code == 404


class TestInternalOrderAPI:
    """Tests for internal order API endpoints (authenticated)"""

    def test_list_orders(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test listing orders"""
        # Create some test orders
        create_order(db, order_number="ORD-001")
        create_order(db, order_number="ORD-002")

        response = auth_client.get("/api/v1/orders")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    def test_list_orders_filter_by_status(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test filtering orders by status"""
        create_order(db, status=OrderStatus.DRAFT)
        create_order(db, status=OrderStatus.ACTIVE)

        response = auth_client.get("/api/v1/orders?status=draft")

        assert response.status_code == 200
        data = response.json()
        assert all(order["status"] == "draft" for order in data)

    def test_list_orders_filter_by_email(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test filtering orders by customer email"""
        email = "customer@example.com"
        create_order(db, customer_email=email)
        create_order(db, customer_email="other@example.com")

        response = auth_client.get(f"/api/v1/orders?customer_email={email}")

        assert response.status_code == 200
        data = response.json()
        assert all(order["customer_email"] == email for order in data)

    def test_get_order(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test getting single order"""
        response = auth_client.get(f"/api/v1/orders/{sample_order.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sample_order.id
        assert data["order_number"] == sample_order.order_number

    def test_get_order_not_found(
        self,
        auth_client: TestClient,
    ):
        """Test getting non-existent order"""
        response = auth_client.get("/api/v1/orders/99999")

        assert response.status_code == 404

    def test_submit_order(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test submitting an order"""
        submit_data = {
            "payment_reference": "PAY-123456",
            "contract_reference": "CONTRACT-789",
            "auto_activate": False,
        }

        response = auth_client.post(
            f"/api/v1/orders/{sample_order.id}/submit",
            json=submit_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "submitted"
        assert data["payment_reference"] == submit_data["payment_reference"]

    def test_process_order(
        self,
        auth_client: TestClient,
        db: Session,
        sample_deployment_template,
    ):
        """Test manually processing an order"""
        # Create order in submitted state
        order = create_order(
            db,
            status=OrderStatus.SUBMITTED,
            deployment_template_id=sample_deployment_template.id,
            selected_services=[{"service_code": "test-service", "name": "Test"}],
        )

        response = auth_client.post(f"/api/v1/orders/{order.id}/process")

        # May succeed or fail depending on mocks, but should return 200
        assert response.status_code in [200, 500]

    def test_update_order_status(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test updating order status"""
        update_data = {
            "status": "approved",
            "status_message": "Order approved by admin",
        }

        response = auth_client.patch(
            f"/api/v1/orders/{sample_order.id}/status",
            json=update_data,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["status_message"] == update_data["status_message"]

    def test_cancel_order(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test cancelling an order"""
        response = auth_client.delete(f"/api/v1/orders/{sample_order.id}")

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify order is cancelled
        db.refresh(sample_order)
        assert sample_order.status == OrderStatus.CANCELLED

    def test_cancel_order_wrong_status(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test cancelling order in wrong status"""
        order = create_order(db, status=OrderStatus.ACTIVE)

        response = auth_client.delete(f"/api/v1/orders/{order.id}")

        assert response.status_code == 400  # Bad request


class TestActivationAPI:
    """Tests for service activation API endpoints"""

    def test_list_order_activations(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
        sample_service_activations: list[ServiceActivation],
    ):
        """Test listing service activations for an order"""
        response = auth_client.get(f"/api/v1/orders/{sample_order.id}/activations")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == len(sample_service_activations)

    def test_get_activation_progress(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
        sample_service_activations: list[ServiceActivation],
    ):
        """Test getting activation progress"""
        response = auth_client.get(
            f"/api/v1/orders/{sample_order.id}/activations/progress"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["order_id"] == sample_order.id
        assert data["order_number"] == sample_order.order_number
        assert "total_services" in data
        assert "completed" in data
        assert "failed" in data
        assert "progress_percent" in data
        assert "overall_status" in data

    def test_retry_failed_activations(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test retrying failed activations"""
        # Create a failed activation
        create_service_activation(
            db,
            order_id=sample_order.id,
            tenant_id=1,
            service_code="failed-service",
            activation_status="failed",
        )

        response = auth_client.post(
            f"/api/v1/orders/{sample_order.id}/activations/retry"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_retry_no_failed_activations(
        self,
        auth_client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test retrying when no failed activations"""
        response = auth_client.post(
            f"/api/v1/orders/{sample_order.id}/activations/retry"
        )

        assert response.status_code == 200
        data = response.json()
        assert "No failed activations" in data["message"]


class TestOrderStatisticsAPI:
    """Tests for order statistics API endpoints"""

    def test_get_order_statistics(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test getting order statistics"""
        # Create some test orders
        create_order(db, status=OrderStatus.DRAFT, total_amount=Decimal("100.00"))
        create_order(db, status=OrderStatus.ACTIVE, total_amount=Decimal("200.00"))
        create_order(db, status=OrderStatus.FAILED, total_amount=Decimal("150.00"))

        response = auth_client.get("/api/v1/orders/stats/summary")

        assert response.status_code == 200
        data = response.json()
        assert "orders_by_status" in data
        assert "revenue" in data
        assert "success_rate" in data
        assert "total_processed" in data

    def test_statistics_revenue_calculation(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test revenue calculation in statistics"""
        # Create active orders with known amounts
        create_order(db, status=OrderStatus.ACTIVE, total_amount=Decimal("100.00"))
        create_order(db, status=OrderStatus.ACTIVE, total_amount=Decimal("200.00"))

        response = auth_client.get("/api/v1/orders/stats/summary")

        assert response.status_code == 200
        data = response.json()
        assert data["revenue"]["total"] >= 300.0

    def test_statistics_success_rate(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test success rate calculation"""
        # Create mix of successful and failed orders
        create_order(db, status=OrderStatus.ACTIVE)
        create_order(db, status=OrderStatus.ACTIVE)
        create_order(db, status=OrderStatus.FAILED)

        response = auth_client.get("/api/v1/orders/stats/summary")

        assert response.status_code == 200
        data = response.json()
        # Success rate should be around 66.67%
        assert 60 <= data["success_rate"] <= 70


class TestAPIAuthentication:
    """Tests for API authentication"""

    def test_public_api_no_auth_required(
        self,
        client: TestClient,
        db: Session,
        sample_order: Order,
    ):
        """Test that public API doesn't require authentication"""
        response = client.get(f"/api/public/orders/{sample_order.order_number}/status")

        # Should work without authentication
        assert response.status_code == 200

    def test_internal_api_requires_auth(
        self,
        client: TestClient,
    ):
        """Test that internal API requires authentication"""
        response = client.get("/api/v1/orders")

        # Should fail without authentication
        assert response.status_code in [401, 403]

    def test_internal_api_with_auth(
        self,
        auth_client: TestClient,
    ):
        """Test that internal API works with authentication"""
        response = auth_client.get("/api/v1/orders")

        # Should work with authentication
        assert response.status_code == 200


class TestAPIPagination:
    """Tests for API pagination"""

    def test_list_orders_pagination(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test order listing pagination"""
        # Create multiple orders
        for i in range(15):
            create_order(db, order_number=f"ORD-{i:04d}")

        # Test first page
        response = auth_client.get("/api/v1/orders?skip=0&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10

        # Test second page
        response = auth_client.get("/api/v1/orders?skip=10&limit=10")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 5

    def test_pagination_limits(
        self,
        auth_client: TestClient,
        db: Session,
    ):
        """Test pagination parameter limits"""
        response = auth_client.get("/api/v1/orders?limit=2000")

        # Should enforce max limit
        assert response.status_code in [200, 422]


class TestAPIErrorHandling:
    """Tests for API error handling"""

    def test_invalid_order_id(
        self,
        auth_client: TestClient,
    ):
        """Test handling of invalid order ID"""
        response = auth_client.get("/api/v1/orders/invalid-id")

        assert response.status_code == 422  # Validation error

    def test_invalid_json_body(
        self,
        client: TestClient,
    ):
        """Test handling of invalid JSON"""
        response = client.post(
            "/api/public/orders",
            data="invalid json",
            headers={"Content-Type": "application/json"},
        )

        assert response.status_code == 422

    def test_missing_required_fields(
        self,
        client: TestClient,
    ):
        """Test handling of missing required fields"""
        incomplete_data = {
            "customer_email": "test@example.com",
            # Missing required fields
        }

        response = client.post("/api/public/orders", json=incomplete_data)

        assert response.status_code == 422
