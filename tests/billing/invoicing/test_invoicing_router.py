"""
Tests for Billing Invoicing Router

Tests HTTP endpoints, request validation, response formatting, and error handling
for the invoice management API.
"""

from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi import status
from httpx import AsyncClient

from dotmac.platform.billing.core.exceptions import InvoiceNotFoundError

pytestmark = pytest.mark.integration


class MockObject:
    """Helper to convert dict to object with attributes."""

    def __init__(self, **kwargs: Any):
        for key, value in kwargs.items():
            setattr(self, key, value)


class TestInvoiceCRUD:
    """Test invoice CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_invoice_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test successful invoice creation."""
        # Arrange
        invoice_obj = MockObject(**sample_invoice)
        mock_invoice_service.create_invoice.return_value = invoice_obj

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices",
            json={
                "customer_id": "cust-456",
                "billing_email": "customer@example.com",
                "billing_address": {
                    "street": "123 Main St",
                    "city": "San Francisco",
                    "state": "CA",
                    "postal_code": "94105",
                    "country": "US",
                },
                "line_items": [
                    {
                        "description": "Subscription - Pro Plan",
                        "quantity": 1,
                        "unit_price": 10000,
                        "total_price": 10000,
                    }
                ],
                "currency": "USD",
                "due_days": 30,
            },
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["customer_id"] == "cust-456"
        assert data["status"] == "draft"
        assert data["total_amount"] == 10800

    @pytest.mark.asyncio
    async def test_create_invoice_validation_error(self, async_client: AsyncClient):
        """Test invoice creation with invalid data."""
        # Act - missing required field 'line_items'
        response = await async_client.post(
            "/api/v1/billing/invoices",
            json={
                "customer_id": "cust-456",
                "billing_email": "customer@example.com",
                "billing_address": {},
                # Missing 'line_items'
            },
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    @pytest.mark.asyncio
    async def test_get_invoice_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test get invoice by ID."""
        # Arrange
        invoice_obj = MockObject(**sample_invoice)
        mock_invoice_service.get_invoice.return_value = invoice_obj

        # Act
        response = await async_client.get(
            "/api/v1/billing/invoices/inv-123", headers={"X-Tenant-ID": "tenant-1"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["invoice_number"].startswith("INV-")

    @pytest.mark.asyncio
    async def test_get_invoice_not_found(self, async_client: AsyncClient, mock_invoice_service):
        """Test get non-existent invoice."""
        # Arrange
        mock_invoice_service.get_invoice.return_value = None

        # Act
        response = await async_client.get(
            "/api/v1/billing/invoices/inv-999", headers={"X-Tenant-ID": "tenant-1"}
        )

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert "not found" in data["detail"].lower()

    @pytest.mark.asyncio
    async def test_list_invoices_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test list all invoices."""
        # Arrange
        invoice1 = MockObject(**sample_invoice)
        invoice2_data = {
            **sample_invoice,
            "invoice_id": "inv-456",
            "invoice_number": "INV-2025-002",
        }
        invoice2 = MockObject(**invoice2_data)
        mock_invoice_service.list_invoices.return_value = [invoice1, invoice2]

        # Act
        response = await async_client.get(
            "/api/v1/billing/invoices", headers={"X-Tenant-ID": "tenant-1"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 2
        assert len(data["invoices"]) == 2
        assert data["has_more"] is False

    @pytest.mark.asyncio
    async def test_list_invoices_with_filters(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test list invoices with filtering."""
        # Arrange
        invoice_obj = MockObject(**sample_invoice)
        mock_invoice_service.list_invoices.return_value = [invoice_obj]

        # Act
        response = await async_client.get(
            "/api/v1/billing/invoices",
            params={"customer_id": "cust-456", "status": "draft", "limit": 10, "offset": 0},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        mock_invoice_service.list_invoices.assert_called_once()


class TestInvoiceLifecycle:
    """Test invoice lifecycle endpoints."""

    @pytest.mark.asyncio
    async def test_finalize_invoice_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test successful invoice finalization."""
        # Arrange
        finalized_invoice = {**sample_invoice, "status": "open"}
        invoice_obj = MockObject(**finalized_invoice)
        mock_invoice_service.finalize_invoice.return_value = invoice_obj

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/inv-123/finalize",
            json={"send_email": True},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["status"] == "open"

    @pytest.mark.asyncio
    async def test_finalize_invoice_not_found(
        self, async_client: AsyncClient, mock_invoice_service
    ):
        """Test finalize non-existent invoice."""
        # Arrange
        invoice_id = "inv-missing"
        mock_invoice_service.finalize_invoice.side_effect = InvoiceNotFoundError(
            "Invoice not found"
        )

        # Act
        response = await async_client.post(
            f"/api/v1/billing/invoices/{invoice_id}/finalize",
            json={"send_email": False},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Invoice not found"
        mock_invoice_service.finalize_invoice.assert_awaited_once_with("tenant-1", invoice_id)

    @pytest.mark.asyncio
    async def test_void_invoice_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test successful invoice voiding."""
        # Arrange
        voided_invoice = {
            **sample_invoice,
            "status": "void",
            "voided_at": datetime.utcnow().isoformat(),
        }
        invoice_obj = MockObject(**voided_invoice)
        mock_invoice_service.void_invoice.return_value = invoice_obj

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/inv-123/void",
            json={"reason": "Customer requested cancellation"},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["status"] == "void"
        assert data["voided_at"] is not None

    @pytest.mark.asyncio
    async def test_mark_invoice_paid_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test marking invoice as paid."""
        # Arrange
        paid_invoice = {
            **sample_invoice,
            "status": "paid",
            "payment_status": "paid",
            "remaining_balance": 0,
            "paid_at": datetime.utcnow().isoformat(),
        }
        invoice_obj = MockObject(**paid_invoice)
        mock_invoice_service.mark_invoice_paid.return_value = invoice_obj

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/inv-123/mark-paid",
            params={"payment_id": "pay-123"},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["status"] == "paid"
        assert data["payment_status"] == "paid"
        assert data["remaining_balance"] == 0


class TestInvoiceCredits:
    """Test invoice credit application endpoints."""

    @pytest.mark.asyncio
    async def test_apply_credit_to_invoice_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test applying credit to invoice."""
        # Arrange
        credited_invoice = {
            **sample_invoice,
            "total_credits_applied": 2000,
            "remaining_balance": 8800,
        }
        invoice_obj = MockObject(**credited_invoice)
        mock_invoice_service.apply_credit_to_invoice.return_value = invoice_obj

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/inv-123/apply-credit",
            json={"credit_amount": 2000, "credit_application_id": "cred-app-123"},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["invoice_id"] == "inv-123"
        assert data["total_credits_applied"] == 2000
        assert data["remaining_balance"] == 8800

    @pytest.mark.asyncio
    async def test_apply_credit_invoice_not_found(
        self, async_client: AsyncClient, mock_invoice_service
    ):
        """Test applying credit to non-existent invoice."""
        # Arrange
        invoice_id = "inv-missing"
        mock_invoice_service.apply_credit_to_invoice.side_effect = InvoiceNotFoundError(
            "Invoice not found"
        )

        # Act
        response = await async_client.post(
            f"/api/v1/billing/invoices/{invoice_id}/apply-credit",
            json={"credit_amount": 1000, "credit_application_id": "cred-001"},
            headers={"X-Tenant-ID": "tenant-1"},
        )

        # Assert
        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert response.json()["detail"] == "Invoice not found"
        mock_invoice_service.apply_credit_to_invoice.assert_awaited_once_with(
            "tenant-1", invoice_id, 1000, "cred-001"
        )


class TestInvoiceUtilities:
    """Test invoice utility endpoints."""

    @pytest.mark.asyncio
    async def test_check_overdue_invoices_success(
        self, async_client: AsyncClient, mock_invoice_service, sample_invoice: dict[str, Any]
    ):
        """Test checking for overdue invoices."""
        # Arrange
        overdue_invoice = {
            **sample_invoice,
            "invoice_id": "inv-overdue",
            "status": "overdue",
            "due_date": (datetime.utcnow() - timedelta(days=5)).isoformat(),
        }
        invoice_obj = MockObject(**overdue_invoice)
        mock_invoice_service.check_overdue_invoices.return_value = [invoice_obj]

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/check-overdue", headers={"X-Tenant-ID": "tenant-1"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]["invoice_id"] == "inv-overdue"
        assert data[0]["status"] == "overdue"

    @pytest.mark.asyncio
    async def test_check_overdue_invoices_none_overdue(
        self, async_client: AsyncClient, mock_invoice_service
    ):
        """Test checking for overdue invoices when none are overdue."""
        # Arrange
        mock_invoice_service.check_overdue_invoices.return_value = []

        # Act
        response = await async_client.post(
            "/api/v1/billing/invoices/check-overdue", headers={"X-Tenant-ID": "tenant-1"}
        )

        # Assert
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0
