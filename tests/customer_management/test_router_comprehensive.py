"""
Comprehensive router tests for customer management to achieve 90% coverage.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi import HTTPException

from dotmac.platform.customer_management.models import (
    ActivityType,
    Customer,
    CustomerActivity,
    CustomerNote,
    CustomerSegment,
    CustomerStatus,
)
from dotmac.platform.customer_management.router import (
    _handle_status_lifecycle_events,
    add_customer_activity,
    add_customer_note,
    create_customer,
    create_segment,
    delete_customer,
    get_customer,
    get_customer_activities,
    get_customer_by_number,
    get_customer_metrics,
    get_customer_notes,
    get_customer_service,
    recalculate_segment,
    record_purchase,
    search_customers,
    update_customer,
)
from dotmac.platform.customer_management.schemas import (
    CustomerActivityCreate,
    CustomerActivityResponse,
    CustomerCreate,
    CustomerMetrics,
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerSegmentResponse,
    CustomerUpdate,
)
from dotmac.platform.customer_management.service import CustomerService
from tests.customer_management.conftest import _build_customer_kwargs

# Fixtures are now in conftest.py


pytestmark = pytest.mark.integration


@pytest.fixture
def sample_customer():
    """Deterministic customer fixture for router tests."""
    overrides = {
        "customer_number": "CUST-001",
        "email": "customer@example.com",
        "first_name": "John",
        "middle_name": "Quincy",
        "last_name": "Doe",
        "display_name": "John Q. Doe",
        "metadata_": {"loyalty_level": "gold", "segment": "enterprise"},
        "custom_fields": {"account_manager": "Alice Smith", "csat": 9.8},
        "tags": ["vip", "fiber"],
    }
    return Customer(**_build_customer_kwargs(index=1, overrides=overrides))


@pytest.fixture
def sample_customers():
    """Deterministic customer list for router tests."""
    customers = []
    for idx in range(1, 4):
        overrides = {
            "customer_number": f"CUST-{idx:03d}",
            "email": f"customer{idx}@example.com",
            "first_name": f"Customer{idx}",
            "display_name": f"Customer{idx} Example",
        }
        customers.append(Customer(**_build_customer_kwargs(index=idx, overrides=overrides)))
    return customers


pytestmark = pytest.mark.asyncio


class TestRouterDependencies:
    """Test router dependencies."""

    @pytest.mark.asyncio
    async def test_get_customer_service(self, mock_session):
        """Test getting customer service dependency."""
        service = await get_customer_service(mock_session)
        assert isinstance(service, CustomerService)
        assert service.session == mock_session


class TestCustomerCRUD:
    """Test CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_customer(self, mock_service, mock_user, sample_customer):
        """Test POST /customers endpoint."""
        create_data = CustomerCreate(
            email="new@example.com",
            first_name="New",
            last_name="User",
            phone="+9876543210",
        )

        # Mock the email check to return None (no existing customer)
        mock_service.get_customer_by_email.return_value = None
        mock_service.create_customer.return_value = sample_customer

        result = await create_customer(
            data=create_data,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerResponse)
        assert result.email == sample_customer.email
        mock_service.get_customer_by_email.assert_called_once_with(create_data.email)

    @pytest.mark.asyncio
    async def test_get_customer_success(self, mock_service, mock_user, sample_customer):
        """Test GET /customers/{customer_id} endpoint."""
        customer_id = sample_customer.id
        mock_service.get_customer.return_value = sample_customer

        result = await get_customer(
            customer_id=customer_id,
            service=mock_service,
            current_user=mock_user,
            include_activities=False,
            include_notes=False,
        )

        assert isinstance(result, CustomerResponse)
        assert result.id == customer_id
        mock_service.get_customer.assert_called_once_with(
            customer_id=customer_id,
            include_activities=False,
            include_notes=False,
        )

    @pytest.mark.asyncio
    async def test_get_customer_not_found(self, mock_service, mock_user):
        """Test GET /customers/{customer_id} when customer doesn't exist."""
        customer_id = uuid4()
        mock_service.get_customer.return_value = None

        with pytest.raises(HTTPException) as exc:
            await get_customer(
                customer_id=customer_id,
                service=mock_service,
                current_user=mock_user,
                include_activities=False,
                include_notes=False,
            )

        assert exc.value.status_code == 404
        assert "not found" in str(exc.value.detail)

    @pytest.mark.asyncio
    async def test_update_customer_success(self, mock_service, mock_user, sample_customer):
        """Test PUT /customers/{customer_id} endpoint."""
        customer_id = sample_customer.id
        update_data = CustomerUpdate(
            first_name="Updated",
            phone="+1111111111",
        )

        updated_customer = sample_customer
        updated_customer.first_name = "Updated"
        updated_customer.phone = "+1111111111"
        mock_service.update_customer.return_value = updated_customer

        result = await update_customer(
            customer_id=customer_id,
            data=update_data,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerResponse)
        assert result.first_name == "Updated"
        mock_service.update_customer.assert_called_once_with(
            customer_id=customer_id,
            data=update_data,
            updated_by=mock_user.user_id,
        )

    @pytest.mark.asyncio
    async def test_update_customer_not_found(self, mock_service, mock_user):
        """Test PUT /customers/{customer_id} when customer doesn't exist."""
        customer_id = uuid4()
        update_data = CustomerUpdate(first_name="Test")
        mock_service.update_customer.return_value = None

        with pytest.raises(HTTPException) as exc:
            await update_customer(
                customer_id=customer_id,
                data=update_data,
                service=mock_service,
                current_user=mock_user,
            )

        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_customer_success(self, mock_service, mock_user):
        """Test DELETE /customers/{customer_id} endpoint."""
        customer_id = uuid4()
        mock_service.delete_customer.return_value = True

        result = await delete_customer(
            customer_id=customer_id,
            hard_delete=False,
            service=mock_service,
            current_user=mock_user,
        )

        # Router returns None (status 204 No Content)
        assert result is None
        mock_service.delete_customer.assert_called_once_with(
            customer_id=customer_id,
            hard_delete=False,
        )

    @pytest.mark.asyncio
    async def test_delete_customer_not_found(self, mock_service, mock_user):
        """Test DELETE /customers/{customer_id} when customer doesn't exist."""
        customer_id = uuid4()
        mock_service.delete_customer.return_value = False

        with pytest.raises(HTTPException) as exc:
            await delete_customer(
                customer_id=customer_id,
                hard_delete=False,
                service=mock_service,
                current_user=mock_user,
            )

        assert exc.value.status_code == 404


class TestCustomerList:
    """Test customer listing endpoints."""

    @pytest.mark.asyncio
    async def test_search_customers(self, mock_service, mock_user, sample_customers):
        """Test POST /customers/search endpoint."""
        search_params = CustomerSearchParams(
            query="john",
            status=CustomerStatus.ACTIVE,
            page=1,
            page_size=10,
        )

        # Use actual customer objects instead of MagicMock
        mock_service.search_customers.return_value = (sample_customers[:2], 2)

        result = await search_customers(
            params=search_params,
            service=mock_service,
            _current_user=mock_user,
        )

        assert result.total == 2
        assert len(result.customers) == 2
        mock_service.search_customers.assert_called_once_with(search_params)

    @pytest.mark.asyncio
    async def test_get_customer_by_number(self, mock_service, mock_user, sample_customer):
        """Test GET /customers/by-number/{customer_number} endpoint."""
        customer_number = "CUST-001"
        mock_service.get_customer_by_number.return_value = sample_customer

        result = await get_customer_by_number(
            customer_number=customer_number,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerResponse)
        assert result.customer_number == customer_number
        mock_service.get_customer_by_number.assert_called_once_with(customer_number)


class TestCustomerActivities:
    """Test customer activity endpoints."""

    @pytest.mark.asyncio
    async def test_add_activity(self, mock_service, mock_user, sample_customer):
        """Test POST /customers/{customer_id}/activities endpoint."""
        customer_id = sample_customer.id
        activity_data = CustomerActivityCreate(
            activity_type=ActivityType.UPDATED,
            title="Profile Updated",
            description="Customer updated their profile",
        )

        mock_activity = CustomerActivity(
            id=uuid4(),
            customer_id=customer_id,
            tenant_id="test-tenant",
            activity_type=ActivityType.UPDATED,
            title="Profile Updated",
            description="Customer updated their profile",
            metadata_={},  # Add required metadata field
            created_at=datetime.now(UTC),
        )

        mock_service.add_activity.return_value = mock_activity

        result = await add_customer_activity(
            customer_id=customer_id,
            data=activity_data,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerActivityResponse)
        assert result.activity_type == ActivityType.UPDATED
        # Router passes user_id as string, service handles UUID conversion
        mock_service.add_activity.assert_called_once()
        call_args = mock_service.add_activity.call_args
        assert call_args.kwargs["customer_id"] == customer_id
        assert call_args.kwargs["data"] == activity_data
        assert isinstance(call_args.kwargs["performed_by"], str)

    @pytest.mark.asyncio
    async def test_get_activities(self, mock_service, mock_user):
        """Test GET /customers/{customer_id}/activities endpoint."""
        customer_id = uuid4()
        mock_activities = [
            CustomerActivity(
                id=uuid4(),
                customer_id=customer_id,
                tenant_id="test-tenant",
                activity_type=ActivityType.CREATED,
                title=f"Activity {i}",
                metadata_={},  # Add required metadata field
                created_at=datetime.now(UTC),
            )
            for i in range(3)
        ]

        mock_service.get_customer_activities.return_value = mock_activities

        result = await get_customer_activities(
            customer_id=customer_id,
            limit=50,
            offset=0,
            service=mock_service,
            current_user=mock_user,
        )

        assert len(result) == 3
        mock_service.get_customer_activities.assert_called_once_with(
            customer_id=customer_id,
            limit=50,
            offset=0,
        )


class TestCustomerNotes:
    """Test customer note endpoints."""

    @pytest.mark.asyncio
    async def test_add_note(self, mock_service, mock_user):
        """Test POST /customers/{customer_id}/notes endpoint."""
        customer_id = uuid4()
        note_data = CustomerNoteCreate(
            subject="Support Request",
            content="Customer needs help with billing",
        )

        mock_note = CustomerNote(
            id=uuid4(),
            customer_id=customer_id,
            tenant_id="test-tenant",
            subject="Support Request",
            content="Customer needs help with billing",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        mock_service.add_note.return_value = mock_note

        result = await add_customer_note(
            customer_id=customer_id,
            data=note_data,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerNoteResponse)
        assert result.subject == "Support Request"
        mock_service.add_note.assert_called_once_with(
            customer_id=customer_id,
            data=note_data,
            created_by=mock_user.user_id,
        )

    @pytest.mark.asyncio
    async def test_get_notes(self, mock_service, mock_user):
        """Test GET /customers/{customer_id}/notes endpoint."""
        customer_id = uuid4()
        mock_notes = [
            CustomerNote(
                id=uuid4(),
                customer_id=customer_id,
                tenant_id="test-tenant",
                subject=f"Note {i}",
                content=f"Content {i}",
                is_internal=i % 2 == 0,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            for i in range(3)
        ]

        mock_service.get_customer_notes.return_value = mock_notes

        result = await get_customer_notes(
            customer_id=customer_id,
            include_internal=True,
            limit=50,
            offset=0,
            service=mock_service,
            current_user=mock_user,
        )

        assert len(result) == 3
        mock_service.get_customer_notes.assert_called_once_with(
            customer_id=customer_id,
            include_internal=True,
            limit=50,
            offset=0,
        )


class TestCustomerMetrics:
    """Test customer metrics endpoints."""

    @pytest.mark.asyncio
    async def test_record_purchase(self, mock_service, mock_user):
        """Test POST /customers/{customer_id}/purchase endpoint."""
        customer_id = uuid4()
        amount = 150.00  # Float, not Decimal

        mock_service.update_metrics.return_value = None

        result = await record_purchase(
            customer_id=customer_id,
            amount=amount,
            service=mock_service,
            current_user=mock_user,
        )

        # Router returns None (status 204 No Content)
        assert result is None
        mock_service.update_metrics.assert_called_once_with(
            customer_id=customer_id,
            purchase_amount=amount,
        )

    @pytest.mark.asyncio
    async def test_get_metrics(self, mock_service, mock_user):
        """Test GET /metrics endpoint for aggregated customer metrics."""
        # get_customer_metrics returns aggregate metrics, not per-customer
        mock_metrics = {
            "total_customers": 100,
            "active_customers": 85,
            "new_customers_this_month": 10,
            "churn_rate": 0.05,
            "average_lifetime_value": 1500.00,
            "total_revenue": 150000.00,
        }
        mock_service.get_customer_metrics.return_value = mock_metrics

        result = await get_customer_metrics(
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerMetrics)
        assert result.total_customers == 100
        assert result.active_customers == 85
        assert result.average_lifetime_value == 1500.00
        assert result.total_revenue == 150000.00
        mock_service.get_customer_metrics.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_metrics_handles_missing_fields(self, mock_service, mock_user):
        """Test GET /metrics handles missing optional fields."""
        mock_metrics = {
            "total_customers": 50,
            "active_customers": 40,
            "churn_rate": 0.1,
            "average_lifetime_value": 1200.00,
            "total_revenue": 60000.00,
            # new_customers_this_month is optional, defaults to 0
        }
        mock_service.get_customer_metrics.return_value = mock_metrics

        result = await get_customer_metrics(
            service=mock_service,
            current_user=mock_user,
        )

        assert result.new_customers_this_month == 0  # Default value
        assert result.total_customers == 50


class TestCustomerSegments:
    """Test customer segment endpoints."""

    @pytest.mark.asyncio
    async def test_create_segment(self, mock_service, mock_user):
        """Test POST /segments endpoint."""
        segment_data = CustomerSegmentCreate(
            name="VIP Customers",
            description="High value customers",
            criteria={"min_lifetime_value": 5000},
        )

        mock_segment = CustomerSegment(
            id=uuid4(),
            tenant_id="test-tenant",
            name="VIP Customers",
            description="High value customers",
            criteria={"min_lifetime_value": 5000},
            is_dynamic=False,
            priority=0,
            member_count=0,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

        mock_service.create_segment.return_value = mock_segment

        result = await create_segment(
            data=segment_data,
            service=mock_service,
            current_user=mock_user,
        )

        assert isinstance(result, CustomerSegmentResponse)
        assert result.name == "VIP Customers"
        mock_service.create_segment.assert_called_once_with(segment_data)

    @pytest.mark.asyncio
    async def test_recalculate_segment(self, mock_service, mock_user):
        """Test POST /segments/{segment_id}/recalculate endpoint."""
        segment_id = uuid4()

        mock_service.recalculate_segment.return_value = 10

        result = await recalculate_segment(
            segment_id=segment_id,
            service=mock_service,
            current_user=mock_user,
        )

        # Router returns {"segment_id": str(segment_id), "member_count": member_count}
        assert result == {
            "segment_id": str(segment_id),
            "member_count": 10,
        }
        mock_service.recalculate_segment.assert_called_once_with(segment_id)


class TestStatusLifecycleEvents:
    """Tests for customer status lifecycle helper."""

    @pytest.mark.asyncio
    async def test_status_lifecycle_events_publish_payload(self, monkeypatch):
        """Verify lifecycle events emit payload instead of data."""

        class EmptyResult:
            """Stub scalar result returning no rows."""

            def scalars(self):
                return self

            def all(self):
                return []

        fake_session = AsyncMock()
        fake_session.execute.return_value = EmptyResult()
        fake_session.commit = AsyncMock()

        event_bus = AsyncMock()
        monkeypatch.setattr(
            "dotmac.platform.events.bus.get_event_bus",
            lambda *_, **__: event_bus,
        )
        from dotmac.platform.events.bus import reset_event_bus

        reset_event_bus()

        customer_id = uuid4()

        await _handle_status_lifecycle_events(
            customer_id=customer_id,
            old_status=CustomerStatus.ACTIVE.value,
            new_status=CustomerStatus.SUSPENDED.value,
            customer_email="payload-test@example.com",
            session=fake_session,
        )

        event_bus.publish.assert_awaited()
        publish_kwargs = event_bus.publish.await_args.kwargs
        assert "payload" in publish_kwargs
        assert publish_kwargs["payload"]["customer_id"] == str(customer_id)
