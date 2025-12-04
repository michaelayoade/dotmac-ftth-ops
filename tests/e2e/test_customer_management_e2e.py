"""
End-to-End tests for Customer Management API.

Tests complete workflows through API endpoints using the real FastAPI app
with a test database, validating the full request-response cycle.
"""

from uuid import uuid4

import pytest

# Note: auth_headers fixture is provided by tests/e2e/conftest.py
# It includes both Authorization and X-Tenant-ID headers


pytestmark = [pytest.mark.asyncio, pytest.mark.e2e]


class TestCustomerCreationE2E:
    """Test customer creation workflows."""

    async def test_create_customer_success(self, async_client, auth_headers):
        """Test successful customer creation."""
        customer_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": f"john.doe.{uuid4()}@example.com",  # Unique email
            "phone": "+1-555-0123",
            "customer_type": "individual",
            "tier": "free",
            "country": "US",
        }

        response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["first_name"] == "John"
        assert data["last_name"] == "Doe"
        assert data["email"] == customer_data["email"]
        assert "customer_number" in data
        assert "status" in data  # Status can be prospect or active

    async def test_create_customer_duplicate_email(self, async_client, auth_headers):
        """Test creating customer with duplicate email."""
        email = f"duplicate.{uuid4()}@example.com"

        customer_data = {
            "first_name": "Jane",
            "last_name": "Smith",
            "email": email,
        }

        # Create first customer
        response1 = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert response1.status_code == 201

        # Try to create duplicate
        response2 = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )

        assert response2.status_code == 400
        assert "already exists" in response2.json()["detail"].lower()

    async def test_create_business_customer(self, async_client, auth_headers):
        """Test creating a business customer."""
        customer_data = {
            "first_name": "Robert",
            "last_name": "Johnson",
            "email": f"robert.{uuid4()}@acmecorp.com",
            "company_name": "ACME Corporation",
            "customer_type": "business",
            "tier": "enterprise",
            "tax_id": "12-3456789",
            "industry": "Technology",
        }

        response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["company_name"] == "ACME Corporation"
        assert data["customer_type"] == "business"
        assert data["tier"] == "enterprise"


class TestCustomerRetrievalE2E:
    """Test customer retrieval workflows."""

    async def test_get_customer_by_id(self, async_client, auth_headers):
        """Test retrieving customer by ID."""
        # Create a customer first
        customer_data = {
            "first_name": "Alice",
            "last_name": "Williams",
            "email": f"alice.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Retrieve the customer
        response = await async_client.get(
            f"/api/v1/customers/{customer_id}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == customer_id
        assert data["first_name"] == "Alice"
        assert data["email"] == customer_data["email"]

    async def test_get_customer_not_found(self, async_client, auth_headers):
        """Test retrieving non-existent customer."""
        customer_id = uuid4()

        response = await async_client.get(
            f"/api/v1/customers/{customer_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    async def test_get_customer_by_number(self, async_client, auth_headers):
        """Test retrieving customer by customer number."""
        # Create a customer
        customer_data = {
            "first_name": "Bob",
            "last_name": "Brown",
            "email": f"bob.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_number = create_response.json()["customer_number"]

        # Retrieve by customer number
        response = await async_client.get(
            f"/api/v1/customers/by-number/{customer_number}",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["customer_number"] == customer_number
        assert data["first_name"] == "Bob"


class TestCustomerUpdateE2E:
    """Test customer update workflows."""

    async def test_update_customer_success(self, async_client, auth_headers):
        """Test successful customer update."""
        # Create a customer
        customer_data = {
            "first_name": "John",
            "last_name": "Doe",
            "email": f"john.update.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Update the customer
        update_data = {
            "first_name": "John Updated",
            "tier": "premium",
            "opt_in_marketing": True,
        }

        response = await async_client.patch(
            f"/api/v1/customers/{customer_id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["first_name"] == "John Updated"
        assert data["tier"] == "premium"
        assert data["opt_in_marketing"] is True

    async def test_update_customer_not_found(self, async_client, auth_headers):
        """Test updating non-existent customer."""
        customer_id = uuid4()
        update_data = {"first_name": "Updated"}

        response = await async_client.patch(
            f"/api/v1/customers/{customer_id}",
            json=update_data,
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestCustomerDeletionE2E:
    """Test customer deletion workflows."""

    async def test_delete_customer_soft(self, async_client, auth_headers):
        """Test soft delete customer (default)."""
        # Create a customer
        customer_data = {
            "first_name": "Delete",
            "last_name": "Test",
            "email": f"delete.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Delete the customer (soft delete)
        response = await async_client.delete(
            f"/api/v1/customers/{customer_id}",
            headers=auth_headers,
        )

        assert response.status_code == 204

    async def test_delete_customer_not_found(self, async_client, auth_headers):
        """Test deleting non-existent customer."""
        customer_id = uuid4()

        response = await async_client.delete(
            f"/api/v1/customers/{customer_id}",
            headers=auth_headers,
        )

        assert response.status_code == 404


class TestCustomerSearchE2E:
    """Test customer search and filtering workflows."""

    async def test_search_customers_basic(self, async_client, auth_headers):
        """Test basic customer search."""
        # Create some test customers
        for i in range(3):
            customer_data = {
                "first_name": f"Search{i}",
                "last_name": "Test",
                "email": f"search{i}.{uuid4()}@example.com",
            }
            await async_client.post(
                "/api/v1/customers/",
                json=customer_data,
                headers=auth_headers,
            )

        # Search for customers
        search_params = {
            "query": "Search",
            "page": 1,
            "page_size": 20,
        }

        response = await async_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 3
        assert data["page"] == 1
        assert data["page_size"] == 20

    async def test_search_customers_with_filters(self, async_client, auth_headers):
        """Test customer search with filters."""
        # Create premium and non-premium customers to validate filtering
        premium_emails = []
        for suffix in ("A", "B"):
            customer = {
                "first_name": f"Premium{suffix}",
                "last_name": "Customer",
                "email": f"premium{suffix}.{uuid4()}@example.com",
                "tier": "premium",
            }
            premium_emails.append(customer["email"])
            response = await async_client.post(
                "/api/v1/customers/",
                json=customer,
                headers=auth_headers,
            )
            assert response.status_code == 201
            assert response.json()["email"] == customer["email"]

        non_matching_email = f"basic.{uuid4()}@example.com"
        non_matching_response = await async_client.post(
            "/api/v1/customers/",
            json={
                "first_name": "Basic",
                "last_name": "Customer",
                "email": non_matching_email,
                "tier": "standard",
            },
            headers=auth_headers,
        )
        assert non_matching_response.status_code == 201
        assert non_matching_response.json()["email"] == non_matching_email

        search_params = {
            "tier": "premium",
            "page": 1,
            "page_size": 10,
        }

        response = await async_client.post(
            "/api/v1/customers/search",
            json=search_params,
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "customers" in data
        assert data["total"] >= len(premium_emails)

        returned_emails = {customer["email"] for customer in data["customers"]}
        assert set(premium_emails).issubset(returned_emails)
        assert non_matching_email not in returned_emails
        assert all(customer["tier"] == "premium" for customer in data["customers"])


class TestCustomerActivitiesE2E:
    """Test customer activity management workflows."""

    async def test_add_customer_activity(self, async_client, auth_headers):
        """Test adding activity to customer timeline."""
        # Create a customer
        customer_data = {
            "first_name": "Activity",
            "last_name": "Test",
            "email": f"activity.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Add activity
        activity_data = {
            "activity_type": "purchase",
            "title": "Purchased Premium Plan",
            "description": "Customer upgraded to premium tier",
            "metadata": {"plan_id": "premium-monthly", "amount": "99.99"},
        }

        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/activities",
            json=activity_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Purchased Premium Plan"
        assert data["activity_type"] == "purchase"

    async def test_get_customer_activities(self, async_client, auth_headers):
        """Test retrieving customer activity timeline."""
        # Create a customer
        customer_data = {
            "first_name": "Timeline",
            "last_name": "Test",
            "email": f"timeline.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Add some activities
        for i in range(3):
            activity_data = {
                "activity_type": "login",
                "title": f"Activity {i}",
            }
            await async_client.post(
                f"/api/v1/customers/{customer_id}/activities",
                json=activity_data,
                headers=auth_headers,
            )

        # Get activities
        response = await async_client.get(
            f"/api/v1/customers/{customer_id}/activities?limit=10",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3


class TestCustomerNotesE2E:
    """Test customer notes management workflows."""

    async def test_add_customer_note(self, async_client, auth_headers):
        """Test adding note to customer."""
        # Create a customer
        customer_data = {
            "first_name": "Note",
            "last_name": "Test",
            "email": f"note.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Add note
        note_data = {
            "subject": "Follow-up Required",
            "content": "Customer requested callback regarding billing issue",
            "is_internal": True,
        }

        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/notes",
            json=note_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["subject"] == "Follow-up Required"
        assert data["is_internal"] is True

    async def test_get_customer_notes(self, async_client, auth_headers):
        """Test retrieving customer notes."""
        # Create a customer
        customer_data = {
            "first_name": "Notes",
            "last_name": "Test",
            "email": f"notes.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Add some notes
        for i in range(3):
            note_data = {
                "subject": f"Note {i}",
                "content": f"Content {i}",
                "is_internal": i % 2 == 0,
            }
            await async_client.post(
                f"/api/v1/customers/{customer_id}/notes",
                json=note_data,
                headers=auth_headers,
            )

        # Get notes
        response = await async_client.get(
            f"/api/v1/customers/{customer_id}/notes?include_internal=true",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 3


class TestCustomerMetricsE2E:
    """Test customer metrics and analytics workflows."""

    async def test_record_purchase(self, async_client, auth_headers):
        """Test recording customer purchase."""
        # Create a customer
        customer_data = {
            "first_name": "Purchase",
            "last_name": "Test",
            "email": f"purchase.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=customer_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Record purchase
        amount = 250.50
        response = await async_client.post(
            f"/api/v1/customers/{customer_id}/metrics/purchase?amount={amount}",
            headers=auth_headers,
        )

        assert response.status_code == 204

    async def test_get_customer_metrics_overview(self, async_client, auth_headers):
        """Test retrieving aggregated customer metrics."""
        response = await async_client.get(
            "/api/v1/customers/metrics/overview",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_customers" in data
        assert "active_customers" in data
        assert "average_lifetime_value" in data


class TestCustomerSegmentationE2E:
    """Test customer segmentation workflows."""

    async def test_create_segment(self, async_client, auth_headers):
        """Test creating customer segment."""
        segment_data = {
            "name": f"High Value {uuid4()}",
            "description": "Customers with LTV > $1000",
            "criteria": {"min_lifetime_value": 1000},
            "is_dynamic": True,
            "priority": 10,
        }

        response = await async_client.post(
            "/api/v1/customers/segments",
            json=segment_data,
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert "High Value" in data["name"]
        assert data["is_dynamic"] is True
        assert data["priority"] == 10

    async def test_recalculate_segment(self, async_client, auth_headers):
        """Test recalculating dynamic segment membership."""
        # Create a segment first
        segment_data = {
            "name": f"Test Segment {uuid4()}",
            "criteria": {"status": "active"},
            "is_dynamic": True,
        }

        create_response = await async_client.post(
            "/api/v1/customers/segments",
            json=segment_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        segment_id = create_response.json()["id"]

        # Recalculate
        response = await async_client.post(
            f"/api/v1/customers/segments/{segment_id}/recalculate",
            headers=auth_headers,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["segment_id"] == segment_id
        assert "member_count" in data


class TestCompleteWorkflowsE2E:
    """Test complete customer management workflows."""

    async def test_complete_customer_lifecycle(self, async_client, auth_headers):
        """Test complete customer lifecycle: create, update, add activity, delete."""
        # Step 1: Create customer
        create_data = {
            "first_name": "Lifecycle",
            "last_name": "Customer",
            "email": f"lifecycle.{uuid4()}@example.com",
        }

        create_response = await async_client.post(
            "/api/v1/customers/",
            json=create_data,
            headers=auth_headers,
        )
        assert create_response.status_code == 201
        customer_id = create_response.json()["id"]

        # Step 2: Update customer
        update_response = await async_client.patch(
            f"/api/v1/customers/{customer_id}",
            json={"tier": "premium"},
            headers=auth_headers,
        )
        assert update_response.status_code == 200

        # Step 3: Add activity
        activity_response = await async_client.post(
            f"/api/v1/customers/{customer_id}/activities",
            json={
                "activity_type": "purchase",
                "title": "First Purchase",
            },
            headers=auth_headers,
        )
        assert activity_response.status_code == 201

        # Step 4: Delete customer
        delete_response = await async_client.delete(
            f"/api/v1/customers/{customer_id}",
            headers=auth_headers,
        )
        assert delete_response.status_code == 204
