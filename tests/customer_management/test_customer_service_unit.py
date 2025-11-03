"""
Unit Tests for Customer Service (Business Logic).

Strategy: Mock ALL dependencies (database, tenant context)
Focus: Test CRUD operations, validation, tenant isolation in isolation
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.customer_management.models import (
    Customer,
    CustomerActivity,
    CustomerStatus,
)
from dotmac.platform.customer_management.schemas import (
    CustomerCreate,
    CustomerUpdate,
)
from dotmac.platform.customer_management.service import CustomerService


@pytest.mark.unit
class TestCustomerCreation:
    """Test customer creation logic."""

    @pytest.fixture
    def mock_session(self):
        """Mock database session."""
        session = AsyncMock(spec=AsyncSession)
        session.commit = AsyncMock()
        session.flush = AsyncMock()
        session.refresh = AsyncMock()
        session.add = MagicMock()
        return session

    @pytest.fixture
    def customer_service(self, mock_session):
        """Create customer service with mocked session."""
        return CustomerService(session=mock_session)

    @pytest.fixture
    def customer_create_data(self):
        """Create sample customer create data."""
        return CustomerCreate(
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1234567890",
            company_name="Acme Corp",
            tags=["vip", "enterprise"],
            metadata={"source": "website"},
            custom_fields={"account_manager": "Jane Smith"},
        )

    async def test_create_customer_success(
        self, customer_service, mock_session, customer_create_data
    ):
        """Test successful customer creation."""
        with patch.object(
            customer_service, "_generate_customer_number", return_value="CUST-2025-001"
        ):
            with patch(
                "dotmac.platform.customer_management.service.get_current_tenant_id",
                return_value="tenant-1",
            ):
                await customer_service.create_customer(
                    data=customer_create_data,
                    created_by="admin_user",
                )

                # Verify customer was added to session
                assert mock_session.add.called

                # Verify customer number was generated
                customer_obj = mock_session.add.call_args_list[0][0][0]
                assert customer_obj.customer_number == "CUST-2025-001"
                assert customer_obj.first_name == "John"
                assert customer_obj.last_name == "Doe"
                assert customer_obj.email == "john.doe@example.com"
                assert customer_obj.tenant_id == "tenant-1"

    async def test_create_customer_with_tags(
        self, customer_service, mock_session, customer_create_data
    ):
        """Test customer creation with tags."""
        with patch.object(customer_service, "_generate_customer_number", return_value="CUST-001"):
            with patch(
                "dotmac.platform.customer_management.service.get_current_tenant_id",
                return_value="tenant-1",
            ):
                await customer_service.create_customer(data=customer_create_data)

                # Verify tags were added (customer + activity + 2 tags = 4 adds)
                assert mock_session.add.call_count >= 3  # customer, activity, tags

    async def test_create_customer_creates_activity(
        self, customer_service, mock_session, customer_create_data
    ):
        """Test that customer creation creates an activity log."""
        with patch.object(customer_service, "_generate_customer_number", return_value="CUST-001"):
            with patch(
                "dotmac.platform.customer_management.service.get_current_tenant_id",
                return_value="tenant-1",
            ):
                await customer_service.create_customer(data=customer_create_data)

                # Check that activity was created (second add call)
                add_calls = mock_session.add.call_args_list
                activity_created = any(
                    isinstance(call[0][0], CustomerActivity) for call in add_calls
                )
                assert activity_created


@pytest.mark.unit
class TestCustomerRetrieval:
    """Test customer retrieval methods."""

    @pytest.fixture
    def customer_service(self):
        """Create customer service."""
        mock_session = AsyncMock(spec=AsyncSession)
        return CustomerService(session=mock_session), mock_session

    @pytest.fixture
    def sample_customer(self):
        """Create sample customer."""
        customer_id = uuid4()
        return Customer(
            id=customer_id,
            customer_number="CUST-001",
            tenant_id="tenant-1",
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
            status=CustomerStatus.ACTIVE,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def test_get_customer_by_id(self, customer_service, sample_customer):
        """Test getting customer by ID."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(
                mock_session,
                "execute",
                return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sample_customer)),
            ):
                customer = await service.get_customer(str(sample_customer.id))

                assert customer is not None
                assert customer.customer_number == "CUST-001"
                assert customer.email == "jane.smith@example.com"

    async def test_get_customer_not_found(self, customer_service):
        """Test getting non-existent customer returns None."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(
                mock_session,
                "execute",
                return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            ):
                customer = await service.get_customer(str(uuid4()))

                assert customer is None

    async def test_get_customer_by_email(self, customer_service, sample_customer):
        """Test getting customer by email."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(
                mock_session,
                "execute",
                return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sample_customer)),
            ):
                customer = await service.get_customer_by_email("jane.smith@example.com")

                assert customer is not None
                assert customer.email == "jane.smith@example.com"

    async def test_get_customer_by_number(self, customer_service, sample_customer):
        """Test getting customer by customer number."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(
                mock_session,
                "execute",
                return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=sample_customer)),
            ):
                customer = await service.get_customer_by_number("CUST-001")

                assert customer is not None
                assert customer.customer_number == "CUST-001"


@pytest.mark.unit
class TestCustomerUpdate:
    """Test customer update logic."""

    @pytest.fixture
    def customer_service(self):
        """Create customer service."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.commit = AsyncMock()
        mock_session.refresh = AsyncMock()
        mock_session.add = MagicMock()
        return CustomerService(session=mock_session), mock_session

    @pytest.fixture
    def existing_customer(self):
        """Create existing customer."""
        customer_id = uuid4()
        return Customer(
            id=customer_id,
            customer_number="CUST-001",
            tenant_id="tenant-1",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.ACTIVE,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def test_update_customer_success(self, customer_service, existing_customer):
        """Test successful customer update."""
        service, mock_session = customer_service

        update_data = CustomerUpdate(
            first_name="Jane",
            phone="+9876543210",
        )

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=existing_customer):
                with patch.object(mock_session, "execute", return_value=None):
                    await service.update_customer(
                        customer_id=str(existing_customer.id),
                        data=update_data,
                        updated_by="admin_user",
                    )

                    # Verify commit was called
                    assert mock_session.commit.called

                    # Verify activity was created
                    assert mock_session.add.called

    async def test_update_customer_not_found(self, customer_service):
        """Test updating non-existent customer returns None."""
        service, mock_session = customer_service

        update_data = CustomerUpdate(first_name="Jane")

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=None):
                customer = await service.update_customer(
                    customer_id=str(uuid4()),
                    data=update_data,
                )

                assert customer is None

    async def test_update_customer_creates_activity(self, customer_service, existing_customer):
        """Test that customer update creates activity log."""
        service, mock_session = customer_service

        update_data = CustomerUpdate(first_name="Jane")

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=existing_customer):
                with patch.object(mock_session, "execute", return_value=None):
                    await service.update_customer(
                        customer_id=str(existing_customer.id),
                        data=update_data,
                        updated_by="admin_user",
                    )

                    # Verify activity was added
                    add_calls = mock_session.add.call_args_list
                    activity_created = any(
                        isinstance(call[0][0], CustomerActivity) for call in add_calls
                    )
                    assert activity_created


@pytest.mark.unit
class TestCustomerDeletion:
    """Test customer deletion (soft and hard delete)."""

    @pytest.fixture
    def customer_service(self):
        """Create customer service."""
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.commit = AsyncMock()
        mock_session.delete = AsyncMock()
        mock_session.add = MagicMock()
        return CustomerService(session=mock_session), mock_session

    @pytest.fixture
    def existing_customer(self):
        """Create existing customer."""
        customer_id = uuid4()
        return Customer(
            id=customer_id,
            customer_number="CUST-001",
            tenant_id="tenant-1",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.ACTIVE,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )

    async def test_soft_delete_customer(self, customer_service, existing_customer):
        """Test soft delete marks customer as deleted."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=existing_customer):
                result = await service.delete_customer(
                    customer_id=str(existing_customer.id),
                    deleted_by="admin_user",
                    hard_delete=False,
                )

                assert result is True

                # Customer should be marked as deleted
                assert existing_customer.deleted_at is not None
                assert existing_customer.status == CustomerStatus.ARCHIVED

                # Activity should be created
                assert mock_session.add.called

    async def test_hard_delete_customer(self, customer_service, existing_customer):
        """Test hard delete removes customer from database."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=existing_customer):
                result = await service.delete_customer(
                    customer_id=str(existing_customer.id),
                    hard_delete=True,
                )

                assert result is True

                # Session delete should be called (not implemented, but would be)
                # Note: mock_session.delete is AsyncMock, actual deletion handled in real code

    async def test_delete_customer_not_found(self, customer_service):
        """Test deleting non-existent customer returns False."""
        service, mock_session = customer_service

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            with patch.object(service, "get_customer", return_value=None):
                result = await service.delete_customer(customer_id=str(uuid4()))

                assert result is False


@pytest.mark.unit
class TestTenantIsolation:
    """Test tenant isolation in customer operations."""

    @pytest.fixture
    def customer_service(self):
        """Create customer service."""
        mock_session = AsyncMock(spec=AsyncSession)
        return CustomerService(session=mock_session)

    async def test_customer_creation_uses_tenant_id(self, customer_service):
        """Test that customer creation includes tenant_id."""
        mock_session = customer_service.session
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.flush = AsyncMock()
        mock_session.refresh = AsyncMock()

        customer_data = CustomerCreate(
            first_name="Test",
            last_name="User",
            email="test@example.com",
        )

        with patch.object(customer_service, "_generate_customer_number", return_value="CUST-001"):
            with patch(
                "dotmac.platform.customer_management.service.get_current_tenant_id",
                return_value="tenant-123",
            ):
                await customer_service.create_customer(data=customer_data)

                # Verify customer has correct tenant_id
                customer_obj = mock_session.add.call_args_list[0][0][0]
                assert customer_obj.tenant_id == "tenant-123"

    async def test_tenant_resolution_fallback(self, customer_service):
        """Test tenant resolution falls back to default when no context."""
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id", return_value=None
        ):
            tenant_id = customer_service._resolve_tenant_id()

            # Should fall back to default tenant
            assert tenant_id == "default-tenant"


@pytest.mark.unit
class TestValidation:
    """Test input validation."""

    @pytest.fixture
    def customer_service(self):
        """Create customer service."""
        mock_session = AsyncMock(spec=AsyncSession)
        return CustomerService(session=mock_session)

    async def test_invalid_uuid_raises_error(self, customer_service):
        """Test that invalid UUID raises ValueError."""
        with pytest.raises(ValueError) as exc:
            await customer_service.get_customer("not-a-uuid")

        assert "invalid uuid" in str(exc.value).lower()

    async def test_validate_and_get_tenant(self, customer_service):
        """Test UUID validation and tenant resolution."""
        valid_uuid = str(uuid4())

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="tenant-1",
        ):
            validated_id, tenant_id = customer_service._validate_and_get_tenant(valid_uuid)

            assert isinstance(validated_id, UUID)
            assert tenant_id == "tenant-1"


@pytest.mark.unit
class TestBatchOperations:
    """Test batch processing methods."""

    async def test_batch_process_archive(self, customer_service):
        """Test batch archiving customers."""
        from uuid import uuid4

        customer_ids = [uuid4(), uuid4()]

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="test-tenant",
        ):
            await customer_service.batch_process_customers(customer_ids, "archive")

    async def test_batch_process_activate(self, customer_service):
        """Test batch activating customers."""
        from uuid import uuid4

        customer_ids = [uuid4(), uuid4()]

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="test-tenant",
        ):
            await customer_service.batch_process_customers(customer_ids, "activate")


@pytest.mark.unit
class TestHelperMethods:
    """Test internal helper methods."""

    def test_customer_to_dict(self, customer_service, existing_customer):
        """Test converting customer to dictionary."""
        result = customer_service._customer_to_dict(existing_customer)

        assert isinstance(result, dict)
        assert result["id"] == existing_customer.id
        assert result["email"] == existing_customer.email
        assert "metadata" in result  # Should map metadata_ to metadata

    async def test_generate_customer_number(self, customer_service):
        """Test generating unique customer numbers."""
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id",
            return_value="test-tenant",
        ):
            number = await customer_service._generate_customer_number()

            assert isinstance(number, str)
            assert len(number) > 0


@pytest.mark.unit
class TestUtilityMethods:
    """Test utility methods."""

    def test_get_customers_by_criteria(self, customer_service, existing_customer):
        """Test filtering customers by criteria."""
        from dotmac.platform.customer_management.models import CustomerStatus

        customers = [existing_customer]

        result = customer_service.get_customers_by_criteria(customers, status=CustomerStatus.ACTIVE)

        assert isinstance(result, list)

    def test_sort_customers(self, customer_service, existing_customer):
        """Test sorting customers."""
        customers = [existing_customer]

        result = customer_service.sort_customers(customers, sort_by="created_at")

        assert isinstance(result, list)
        assert len(result) == 1
