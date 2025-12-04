"""
Comprehensive tests for Customer Management Router.

Tests all endpoints with proper mocking to achieve high coverage.
"""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException, status

# Import the router module to ensure it's loaded for coverage
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.customer_management.router import (
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
    router,
    search_customers,
    update_customer,
)
from dotmac.platform.customer_management.schemas import (
    CustomerActivityCreate,
    CustomerActivityResponse,
    CustomerCreate,
    CustomerListResponse,
    CustomerMetrics,
    CustomerNoteCreate,
    CustomerNoteResponse,
    CustomerResponse,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerUpdate,
)

pytestmark = pytest.mark.integration


class TestCustomerServiceDependency:
    """Test customer service dependency function."""

    @pytest.mark.asyncio
    async def test_get_customer_service(self):
        """Test customer service dependency."""
        mock_session = AsyncMock()

        with patch("dotmac.platform.customer_management.router.CustomerService") as MockService:
            mock_service_instance = MagicMock()
            MockService.return_value = mock_service_instance

            result = await get_customer_service(session=mock_session)

            MockService.assert_called_once_with(mock_session)
            assert result == mock_service_instance


class TestCreateCustomerEndpoint:
    """Test create customer endpoint."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.fixture
    def customer_create_data(self):
        """Sample customer create data."""
        return CustomerCreate(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            customer_type="individual",
            tier="basic",
        )

    @pytest.mark.asyncio
    async def test_create_customer_success(self, mock_current_user, customer_create_data):
        """Test successful customer creation."""
        mock_service = AsyncMock()
        mock_service.get_customer_by_email.return_value = None  # No existing customer

        mock_customer = MagicMock()
        mock_customer.id = uuid4()
        mock_customer.first_name = "John"
        mock_customer.last_name = "Doe"
        mock_customer.email = "john.doe@example.com"
        mock_customer.customer_type = "individual"
        mock_customer.tier = "basic"

        mock_service.create_customer.return_value = mock_customer

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"
        ) as mock_validate:
            mock_response = MagicMock()
            mock_validate.return_value = mock_response

            result = await create_customer(customer_create_data, mock_service, mock_current_user)

            assert result == mock_response
            mock_service.get_customer_by_email.assert_called_once_with("john.doe@example.com")
            mock_service.create_customer.assert_called_once_with(
                data=customer_create_data, created_by="1440baf0-92cb-4a7e-8af1-53a2905b4651"
            )

    @pytest.mark.asyncio
    async def test_create_customer_duplicate_email(self, mock_current_user, customer_create_data):
        """Test creating customer with existing email."""
        mock_service = AsyncMock()
        mock_existing_customer = MagicMock()
        mock_service.get_customer_by_email.return_value = mock_existing_customer

        with pytest.raises(HTTPException) as exc_info:
            await create_customer(customer_create_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_create_customer_value_error(self, mock_current_user, customer_create_data):
        """Test creating customer with ValueError from service."""
        mock_service = AsyncMock()
        mock_service.get_customer_by_email.return_value = None
        mock_service.create_customer.side_effect = ValueError("Invalid data")

        with pytest.raises(HTTPException) as exc_info:
            await create_customer(customer_create_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid data" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_create_customer_general_exception(self, mock_current_user, customer_create_data):
        """Test creating customer with general exception."""
        mock_service = AsyncMock()
        mock_service.get_customer_by_email.return_value = None
        mock_service.create_customer.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await create_customer(customer_create_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to create customer" in str(exc_info.value.detail)


class TestGetCustomerEndpoints:
    """Test get customer endpoints."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_get_customer_success(self, mock_current_user):
        """Test successful customer retrieval."""
        customer_id = uuid4()
        mock_service = AsyncMock()

        mock_customer = MagicMock()
        mock_customer.id = customer_id
        mock_service.get_customer.return_value = mock_customer

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"
        ) as mock_validate:
            mock_response = MagicMock()
            mock_validate.return_value = mock_response

            result = await get_customer(
                customer_id=customer_id,
                service=mock_service,
                current_user=mock_current_user,
                include_activities=False,
                include_notes=False,
            )

            assert result == mock_response
            mock_service.get_customer.assert_called_once_with(
                customer_id=customer_id, include_activities=False, include_notes=False
            )

    @pytest.mark.asyncio
    async def test_get_customer_with_includes(self, mock_current_user):
        """Test customer retrieval with includes."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_customer.return_value = MagicMock()

        with patch("dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"):
            await get_customer(
                customer_id=customer_id,
                service=mock_service,
                current_user=mock_current_user,
                include_activities=True,
                include_notes=True,
            )

            mock_service.get_customer.assert_called_once_with(
                customer_id=customer_id, include_activities=True, include_notes=True
            )

    @pytest.mark.asyncio
    async def test_get_customer_not_found(self, mock_current_user):
        """Test getting non-existent customer."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_customer.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_customer(customer_id, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert str(customer_id) in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_customer_by_number_success(self, mock_current_user):
        """Test successful customer retrieval by number."""
        customer_number = "CUST001"
        mock_service = AsyncMock()
        mock_customer = MagicMock()
        mock_service.get_customer_by_number.return_value = mock_customer

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"
        ) as mock_validate:
            now = datetime.now(UTC)
            mock_response = CustomerResponse(
                id=uuid4(),
                customer_number=customer_number,
                first_name="John",
                last_name="Doe",
                email="john@example.com",
                customer_type="individual",
                tier="basic",
                status="prospect",
                # Required verification fields
                email_verified=True,
                phone_verified=False,
                # Required metrics
                lifetime_value=Decimal("100.00"),
                total_purchases=2,
                average_order_value=Decimal("50.00"),
                # Required scoring
                risk_score=10,
                # Required dates
                acquisition_date=now,
                created_at=now,
                updated_at=now,
                # Required collections
                tags=[],
                metadata={},
                custom_fields={},
            )
            mock_validate.return_value = mock_response

            result = await get_customer_by_number(customer_number, mock_service, mock_current_user)

            assert result == mock_response
            mock_service.get_customer_by_number.assert_called_once_with(customer_number)

    @pytest.mark.asyncio
    async def test_get_customer_by_number_not_found(self, mock_current_user):
        """Test getting customer by non-existent number."""
        customer_number = "NONEXISTENT"
        mock_service = AsyncMock()
        mock_service.get_customer_by_number.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_customer_by_number(customer_number, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert customer_number in str(exc_info.value.detail)


class TestUpdateCustomerEndpoint:
    """Test update customer endpoint."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_update_customer_success(self, mock_current_user):
        """Test successful customer update."""
        customer_id = uuid4()
        update_data = CustomerUpdate(first_name="Jane", tier="premium")

        mock_service = AsyncMock()
        mock_customer = MagicMock()
        mock_service.update_customer.return_value = mock_customer

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"
        ) as mock_validate:
            now = datetime.now(UTC)
            mock_response = CustomerResponse(
                id=customer_id,
                customer_number="CUST001",
                first_name="Jane",
                last_name="Doe",
                email="jane@example.com",
                customer_type="individual",
                tier="premium",
                status="prospect",
                # Required verification fields
                email_verified=True,
                phone_verified=False,
                # Required metrics
                lifetime_value=Decimal("150.00"),
                total_purchases=3,
                average_order_value=Decimal("50.00"),
                # Required scoring
                risk_score=5,
                # Required dates
                acquisition_date=now,
                created_at=now,
                updated_at=now,
                # Required collections
                tags=[],
                metadata={},
                custom_fields={},
            )
            mock_validate.return_value = mock_response

            result = await update_customer(
                customer_id, update_data, mock_service, mock_current_user
            )

            assert result == mock_response
            mock_service.update_customer.assert_called_once_with(
                customer_id=customer_id,
                data=update_data,
                updated_by="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            )

    @pytest.mark.asyncio
    async def test_update_customer_not_found(self, mock_current_user):
        """Test updating non-existent customer."""
        customer_id = uuid4()
        update_data = CustomerUpdate(first_name="Jane")

        mock_service = AsyncMock()
        mock_service.update_customer.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await update_customer(customer_id, update_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert str(customer_id) in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_customer_value_error(self, mock_current_user):
        """Test updating customer with ValueError."""
        customer_id = uuid4()
        update_data = CustomerUpdate(first_name="Jane")

        mock_service = AsyncMock()
        mock_service.update_customer.side_effect = ValueError("Invalid update")

        with pytest.raises(HTTPException) as exc_info:
            await update_customer(customer_id, update_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid update" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_update_customer_general_exception(self, mock_current_user):
        """Test updating customer with general exception."""
        customer_id = uuid4()
        update_data = CustomerUpdate(first_name="Jane")

        mock_service = AsyncMock()
        mock_service.update_customer.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await update_customer(customer_id, update_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to update customer" in str(exc_info.value.detail)


class TestDeleteCustomerEndpoint:
    """Test delete customer endpoint."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_delete_customer_success(self, mock_current_user):
        """Test successful customer deletion."""

        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.delete_customer.return_value = True

        result = await delete_customer(customer_id, mock_service, mock_current_user)

        assert result is None  # Should return None (204 status)
        # Check that delete_customer was called with the customer_id
        # hard_delete will be a Query object when called directly, but FastAPI resolves it
        mock_service.delete_customer.assert_called_once()
        call_args = mock_service.delete_customer.call_args
        assert call_args.kwargs["customer_id"] == customer_id

    @pytest.mark.asyncio
    async def test_delete_customer_hard_delete(self, mock_current_user):
        """Test hard delete customer."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.delete_customer.return_value = True

        result = await delete_customer(
            customer_id, mock_service, mock_current_user, hard_delete=True
        )

        assert result is None
        mock_service.delete_customer.assert_called_once_with(
            customer_id=customer_id, hard_delete=True
        )

    @pytest.mark.asyncio
    async def test_delete_customer_not_found(self, mock_current_user):
        """Test deleting non-existent customer."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.delete_customer.return_value = False

        with pytest.raises(HTTPException) as exc_info:
            await delete_customer(customer_id, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert str(customer_id) in str(exc_info.value.detail)


class TestSearchCustomersEndpoint:
    """Test search customers endpoint."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_search_customers_success(self, mock_current_user):
        """Test successful customer search."""
        search_params = CustomerSearchParams(query="john", page=1, page_size=10)

        mock_service = AsyncMock()
        mock_customers = [MagicMock(), MagicMock()]
        mock_service.search_customers.return_value = (mock_customers, 15)

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"
        ) as mock_validate:
            now = datetime.now(UTC)
            mock_response = CustomerResponse(
                id=uuid4(),
                customer_number="CUST001",
                first_name="John",
                last_name="Doe",
                email="john@example.com",
                customer_type="individual",
                tier="basic",
                status="prospect",
                # Required verification fields
                email_verified=True,
                phone_verified=False,
                # Required metrics
                lifetime_value=Decimal("100.00"),
                total_purchases=2,
                average_order_value=Decimal("50.00"),
                # Required scoring
                risk_score=10,
                # Required dates
                acquisition_date=now,
                created_at=now,
                updated_at=now,
                # Required collections
                tags=[],
                metadata={},
                custom_fields={},
            )
            mock_validate.return_value = mock_response

            result = await search_customers(search_params, mock_service, mock_current_user)

            assert isinstance(result, CustomerListResponse)
            assert len(result.customers) == 2
            assert result.total == 15
            assert result.page == 1
            assert result.page_size == 10
            assert result.has_next is True  # (1 * 10) < 15
            assert result.has_prev is False  # page > 1

            mock_service.search_customers.assert_called_once_with(search_params)

    @pytest.mark.asyncio
    async def test_search_customers_pagination_logic(self, mock_current_user):
        """Test search pagination logic."""
        # Test page 2 of results
        search_params = CustomerSearchParams(query="test", page=2, page_size=10)

        mock_service = AsyncMock()
        mock_service.search_customers.return_value = ([], 25)

        with patch("dotmac.platform.customer_management.schemas.CustomerResponse.model_validate"):
            result = await search_customers(search_params, mock_service, mock_current_user)

            assert result.page == 2
            assert result.has_next is True  # (2 * 10) < 25
            assert result.has_prev is True  # page > 1

    @pytest.mark.asyncio
    async def test_search_customers_exception(self, mock_current_user):
        """Test search customers with exception."""
        search_params = CustomerSearchParams(query="test", page=1, page_size=10)

        mock_service = AsyncMock()
        mock_service.search_customers.side_effect = Exception("Search failed")

        with pytest.raises(HTTPException) as exc_info:
            await search_customers(search_params, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to search customers" in str(exc_info.value.detail)


class TestCustomerActivitiesEndpoints:
    """Test customer activities endpoints."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_add_customer_activity_success(self, mock_current_user):
        """Test adding customer activity."""
        customer_id = uuid4()
        activity_data = CustomerActivityCreate(
            activity_type="contact_made", title="Phone call", description="Follow-up call"
        )

        mock_service = AsyncMock()
        mock_activity = MagicMock()
        mock_service.add_activity.return_value = mock_activity

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerActivityResponse.model_validate"
        ) as mock_validate:
            mock_response = CustomerActivityResponse(
                id=uuid4(),
                customer_id=customer_id,
                activity_type="contact_made",
                title="Phone call",
                description="Follow-up call",
                metadata={},
                performed_by=UUID("1440baf0-92cb-4a7e-8af1-53a2905b4651"),
                created_at=datetime.now(UTC),
            )
            mock_validate.return_value = mock_response

            result = await add_customer_activity(
                customer_id, activity_data, mock_service, mock_current_user
            )

            assert result == mock_response
            mock_service.add_activity.assert_called_once_with(
                customer_id=customer_id,
                data=activity_data,
                performed_by="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            )

    @pytest.mark.asyncio
    async def test_add_activity_customer_not_found(self, mock_current_user):
        """Test adding activity to non-existent customer."""
        customer_id = uuid4()
        activity_data = CustomerActivityCreate(activity_type="contact_made", title="Test activity")

        mock_service = AsyncMock()
        mock_service.add_activity.side_effect = ValueError("Customer not found")

        with pytest.raises(HTTPException) as exc_info:
            await add_customer_activity(customer_id, activity_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "Customer not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_add_activity_general_exception(self, mock_current_user):
        """Test adding activity with general exception."""
        customer_id = uuid4()
        activity_data = CustomerActivityCreate(activity_type="contact_made", title="Test activity")

        mock_service = AsyncMock()
        mock_service.add_activity.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await add_customer_activity(customer_id, activity_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to add activity" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_customer_activities(self, mock_current_user):
        """Test getting customer activities."""
        customer_id = uuid4()
        mock_service = AsyncMock()

        mock_activities = [MagicMock(), MagicMock()]
        mock_service.get_customer_activities.return_value = mock_activities

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerActivityResponse.model_validate"
        ) as mock_validate:
            mock_response = CustomerActivityResponse(
                id=uuid4(),
                customer_id=customer_id,
                activity_type="contact_made",
                title="Phone call",
                description="Follow-up call",
                metadata={},
                performed_by=UUID("1440baf0-92cb-4a7e-8af1-53a2905b4651"),
                created_at=datetime.now(UTC),
            )
            mock_validate.return_value = mock_response

            result = await get_customer_activities(customer_id, mock_service, mock_current_user)

            assert len(result) == 2
            assert all(isinstance(r, CustomerActivityResponse) for r in result)
            # Check that get_customer_activities was called
            mock_service.get_customer_activities.assert_called_once()
            call_args = mock_service.get_customer_activities.call_args
            assert call_args.kwargs["customer_id"] == customer_id

    @pytest.mark.asyncio
    async def test_get_activities_with_pagination(self, mock_current_user):
        """Test getting activities with pagination."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_customer_activities.return_value = []

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerActivityResponse.model_validate"
        ):
            await get_customer_activities(
                customer_id, mock_service, mock_current_user, limit=25, offset=10
            )

            mock_service.get_customer_activities.assert_called_once_with(
                customer_id=customer_id, limit=25, offset=10
            )


class TestCustomerNotesEndpoints:
    """Test customer notes endpoints."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_add_customer_note_success(self, mock_current_user):
        """Test adding customer note."""
        customer_id = uuid4()
        note_data = CustomerNoteCreate(
            subject="Follow-up needed", content="Customer interested in premium", is_internal=True
        )

        mock_service = AsyncMock()
        mock_note = MagicMock()
        mock_service.add_note.return_value = mock_note

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerNoteResponse.model_validate"
        ) as mock_validate:
            now = datetime.now(UTC)
            mock_response = CustomerNoteResponse(
                id=uuid4(),
                customer_id=customer_id,
                subject="Follow-up needed",
                content="Customer interested in premium",
                is_internal=True,
                created_by_id=UUID("1440baf0-92cb-4a7e-8af1-53a2905b4651"),
                created_at=now,
                updated_at=now,
            )
            mock_validate.return_value = mock_response

            result = await add_customer_note(
                customer_id, note_data, mock_service, mock_current_user
            )

            assert result == mock_response
            mock_service.add_note.assert_called_once_with(
                customer_id=customer_id,
                data=note_data,
                created_by="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            )

    @pytest.mark.asyncio
    async def test_add_note_customer_not_found(self, mock_current_user):
        """Test adding note to non-existent customer."""
        customer_id = uuid4()
        note_data = CustomerNoteCreate(subject="Test note", content="Test content")

        mock_service = AsyncMock()
        mock_service.add_note.side_effect = ValueError("Customer not found")

        with pytest.raises(HTTPException) as exc_info:
            await add_customer_note(customer_id, note_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND
        assert "Customer not found" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_add_note_general_exception(self, mock_current_user):
        """Test adding note with general exception."""
        customer_id = uuid4()
        note_data = CustomerNoteCreate(subject="Test note", content="Test content")

        mock_service = AsyncMock()
        mock_service.add_note.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await add_customer_note(customer_id, note_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to add note" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_get_customer_notes(self, mock_current_user):
        """Test getting customer notes."""
        customer_id = uuid4()
        mock_service = AsyncMock()

        mock_notes = [MagicMock(), MagicMock()]
        mock_service.get_customer_notes.return_value = mock_notes

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerNoteResponse.model_validate"
        ) as mock_validate:
            now = datetime.now(UTC)
            mock_response = CustomerNoteResponse(
                id=uuid4(),
                customer_id=customer_id,
                subject="Test note",
                content="Test content",
                is_internal=False,
                created_by_id=UUID("1440baf0-92cb-4a7e-8af1-53a2905b4651"),
                created_at=now,
                updated_at=now,
            )
            mock_validate.return_value = mock_response

            result = await get_customer_notes(customer_id, mock_service, mock_current_user)

            assert len(result) == 2
            assert all(isinstance(r, CustomerNoteResponse) for r in result)
            # Check that get_customer_notes was called
            mock_service.get_customer_notes.assert_called_once()
            call_args = mock_service.get_customer_notes.call_args
            assert call_args.kwargs["customer_id"] == customer_id

    @pytest.mark.asyncio
    async def test_get_notes_with_filters_and_pagination(self, mock_current_user):
        """Test getting notes with filters and pagination."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.get_customer_notes.return_value = []

        with patch(
            "dotmac.platform.customer_management.schemas.CustomerNoteResponse.model_validate"
        ):
            await get_customer_notes(
                customer_id,
                mock_service,
                mock_current_user,
                include_internal=False,
                limit=25,
                offset=10,
            )

            mock_service.get_customer_notes.assert_called_once_with(
                customer_id=customer_id, include_internal=False, limit=25, offset=10
            )


class TestCustomerMetricsEndpoints:
    """Test customer metrics endpoints."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_record_purchase(self, mock_current_user):
        """Test recording customer purchase."""
        customer_id = uuid4()
        mock_service = AsyncMock()
        mock_service.update_metrics = AsyncMock()

        result = await record_purchase(customer_id, mock_service, mock_current_user, amount=150.0)

        assert result is None  # Should return None (204 status)
        mock_service.update_metrics.assert_called_once_with(
            customer_id=customer_id, purchase_amount=150.0
        )

    @pytest.mark.asyncio
    async def test_get_customer_metrics_overview(self, mock_current_user):
        """Test getting customer metrics overview."""
        mock_service = AsyncMock()
        mock_metrics_data = {
            "total_customers": 100,
            "active_customers": 75,
            "churn_rate": 5.5,
            "average_lifetime_value": 1250.0,
            "total_revenue": 125000.0,
        }
        mock_service.get_customer_metrics.return_value = mock_metrics_data

        result = await get_customer_metrics(mock_service, mock_current_user)

        assert isinstance(result, CustomerMetrics)
        assert result.total_customers == 100
        assert result.active_customers == 75
        assert result.churn_rate == 5.5
        assert result.average_lifetime_value == 1250.0
        assert result.total_revenue == 125000.0
        assert result.new_customers_this_month == 0  # Simplified implementation
        assert result.customers_by_status == {}
        assert result.customers_by_tier == {}
        assert result.customers_by_type == {}
        assert result.top_segments == []

        mock_service.get_customer_metrics.assert_called_once()


class TestCustomerSegmentsEndpoints:
    """Test customer segments endpoints."""

    @pytest.fixture
    def mock_current_user(self):
        """Mock current user."""
        return UserInfo(
            user_id="1440baf0-92cb-4a7e-8af1-53a2905b4651",
            username="testuser",
            email="user@example.com",
            roles=["user"],
        )

    @pytest.mark.asyncio
    async def test_create_segment_success(self, mock_current_user):
        """Test creating customer segment."""
        segment_data = CustomerSegmentCreate(
            name="High Value Customers",
            description="Customers with high LTV",
            criteria={"min_ltv": 1000},
            is_dynamic=True,
        )

        mock_service = AsyncMock()
        # Create a mock segment with all required attributes
        mock_segment = MagicMock()
        segment_id = uuid4()
        now = datetime.now(UTC)

        # Set all the attributes that the router will access
        mock_segment.id = segment_id
        mock_segment.name = "High Value Customers"
        mock_segment.description = "Customers with high LTV"
        mock_segment.criteria = {"min_ltv": 1000}
        mock_segment.is_dynamic = True
        mock_segment.priority = 1
        mock_segment.member_count = 25
        mock_segment.last_calculated = now
        mock_segment.created_at = now
        mock_segment.updated_at = now

        mock_service.create_segment.return_value = mock_segment

        result = await create_segment(segment_data, mock_service, mock_current_user)

        assert result.id == segment_id
        assert result.name == "High Value Customers"
        assert result.is_dynamic is True
        assert result.member_count == 25
        mock_service.create_segment.assert_called_once_with(segment_data)

    @pytest.mark.asyncio
    async def test_create_segment_exception(self, mock_current_user):
        """Test creating segment with exception."""
        segment_data = CustomerSegmentCreate(name="Test Segment", is_dynamic=True)

        mock_service = AsyncMock()
        mock_service.create_segment.side_effect = Exception("Database error")

        with pytest.raises(HTTPException) as exc_info:
            await create_segment(segment_data, mock_service, mock_current_user)

        assert exc_info.value.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
        assert "Failed to create segment" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_recalculate_segment(self, mock_current_user):
        """Test recalculating segment membership."""
        segment_id = uuid4()
        mock_service = AsyncMock()
        mock_service.recalculate_segment.return_value = 42

        result = await recalculate_segment(segment_id, mock_service, mock_current_user)

        assert result == {"segment_id": str(segment_id), "member_count": 42}
        mock_service.recalculate_segment.assert_called_once_with(segment_id)


class TestRouterConfiguration:
    """Test router configuration and setup."""

    def test_router_prefix_and_tags(self):
        """Test router is configured with correct prefix and tags."""
        # Router prefix is set when included in main app, not on router itself
        # Just verify tags which are set directly on router
        assert router.tags == ["Customer Management"]

    def test_router_endpoints_exist(self):
        """Test that all expected endpoints are registered."""
        routes = {route.path for route in router.routes}

        expected_routes = {
            "/",
            "/{customer_id}",
            "/by-number/{customer_number}",
            "/search",
            "/{customer_id}/activities",
            "/{customer_id}/notes",
            "/{customer_id}/metrics/purchase",
            "/segments",
            "/segments/{segment_id}/recalculate",
            "/metrics/overview",
        }

        for expected_route in expected_routes:
            assert expected_route in routes
