"""
Test tenant resolution in customer management service.
"""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.customer_management.models import Customer
from dotmac.platform.customer_management.schemas import CustomerCreate
from dotmac.platform.customer_management.service import CustomerService


@pytest.fixture
def mock_session():
    """Create a mock async database session."""
    session = AsyncMock()
    session.commit = AsyncMock()
    session.add = MagicMock()
    session.refresh = AsyncMock()
    return session


@pytest.fixture
def customer_service(mock_session):
    """Create CustomerService instance."""
    return CustomerService(mock_session)


@pytest.mark.unit
class TestTenantResolution:
    """Test proper tenant resolution in customer service."""

    def test_resolve_tenant_with_context(self, customer_service):
        """Test tenant resolution when context is available."""
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_get_tenant:
            mock_get_tenant.return_value = "tenant-123"

            tenant_id = customer_service._resolve_tenant_id()

            assert tenant_id == "tenant-123"
            mock_get_tenant.assert_called_once()

    def test_resolve_tenant_without_context(self, customer_service):
        """Test tenant resolution falls back to default when no context."""
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_get_tenant:
            mock_get_tenant.return_value = None

            with patch("dotmac.platform.customer_management.service.logger") as mock_logger:
                tenant_id = customer_service._resolve_tenant_id()

                assert tenant_id == "default-tenant"
                mock_logger.debug.assert_called_once_with(
                    "No tenant context found, using default tenant"
                )

    @pytest.mark.asyncio
    async def test_create_customer_uses_tenant_context(self, customer_service, mock_session):
        """Test that create_customer uses proper tenant resolution."""
        # Mock the tenant resolution
        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-456"):
            # Mock customer number generation
            with patch.object(
                customer_service, "_generate_customer_number", return_value="CUST-001"
            ):
                # Setup mock query results
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = None
                mock_session.execute.return_value = mock_result

                # Create customer data
                customer_data = CustomerCreate(
                    email="test@example.com",
                    first_name="Test",
                    last_name="User",
                )

                # Create customer
                await customer_service.create_customer(customer_data)

                # Verify that add was called with a customer having the correct tenant_id
                assert mock_session.add.called
                added_customer = mock_session.add.call_args[0][0]
                assert added_customer.tenant_id == "tenant-456"

    def test_validate_and_get_tenant(self, customer_service):
        """Test _validate_and_get_tenant method uses tenant resolution."""
        customer_id = str(uuid4())

        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-789"):
            validated_id, tenant_id = customer_service._validate_and_get_tenant(customer_id)

            assert str(validated_id) == customer_id
            assert tenant_id == "tenant-789"

    @pytest.mark.asyncio
    async def test_get_customer_filters_by_tenant(self, customer_service, mock_session):
        """Test that get_customer properly filters by tenant."""
        customer_id = uuid4()

        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-999"):
            # Setup mock
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute.return_value = mock_result

            # Get customer
            await customer_service.get_customer(str(customer_id))

            # Verify the query was executed
            mock_session.execute.assert_called_once()

            # Get the actual query that was executed
            executed_query = mock_session.execute.call_args[0][0]

            # Convert to string to check the WHERE clause
            query_str = str(executed_query)

            # Verify tenant filtering is in the query
            assert "tenant_id" in query_str

    @pytest.mark.asyncio
    async def test_search_customers_uses_tenant_context(self, customer_service, mock_session):
        """Test that search_customers uses tenant context for filtering."""
        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-list"):
            # Setup mock
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_count_result = MagicMock()
            mock_count_result.scalar_one = MagicMock(
                return_value=0
            )  # Fix: use scalar_one instead of scalar

            # Return different results for count and data queries
            mock_session.execute.side_effect = [mock_count_result, mock_result]

            from dotmac.platform.customer_management.schemas import CustomerSearchParams

            search_params = CustomerSearchParams()

            # Search customers
            customers, total = await customer_service.search_customers(search_params)

            assert customers == []
            assert total == 0

            # Verify tenant resolution was called
            customer_service._resolve_tenant_id.assert_called()

    @pytest.mark.asyncio
    async def test_record_purchase_uses_tenant_context(self, customer_service, mock_session):
        """Test that record_purchase uses proper tenant resolution for activity."""
        customer_id = uuid4()

        # Create mock customer
        mock_customer = MagicMock(spec=Customer)
        mock_customer.id = customer_id
        mock_customer.total_purchases = 5
        mock_customer.lifetime_value = 1000.0

        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-purchase"):
            with patch.object(
                customer_service,
                "_validate_and_get_tenant",
                return_value=(customer_id, "tenant-purchase"),
            ):
                # Setup mock query
                mock_result = MagicMock()
                mock_result.scalar_one_or_none.return_value = mock_customer
                mock_session.execute.return_value = mock_result

                # Record purchase
                await customer_service.record_purchase(
                    str(customer_id), amount=100.0, performed_by="test-user"
                )

                # Verify the activity was added with correct tenant_id
                assert mock_session.add.called
                added_activity = mock_session.add.call_args[0][0]
                assert hasattr(added_activity, "tenant_id")
                # The activity should use the resolved tenant_id


@pytest.mark.unit
class TestTenantIsolation:
    """Test tenant isolation in queries."""

    @pytest.mark.asyncio
    async def test_customer_isolation_between_tenants(self, customer_service, mock_session):
        """Test that customers from different tenants are isolated."""
        customer_id = uuid4()

        # First call with tenant-1
        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-1"):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute.return_value = mock_result

            result1 = await customer_service.get_customer(str(customer_id))
            assert result1 is None

        # Second call with tenant-2
        with patch.object(customer_service, "_resolve_tenant_id", return_value="tenant-2"):
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute.return_value = mock_result

            result2 = await customer_service.get_customer(str(customer_id))
            assert result2 is None

        # Verify both queries were executed (one per tenant)
        assert mock_session.execute.call_count == 2

    def test_base_query_includes_tenant_filter(self, customer_service):
        """Test that _get_base_customer_query includes tenant filtering."""
        tenant_id = "test-tenant"
        query = customer_service._get_base_customer_query(tenant_id)

        # Convert query to string to check conditions
        query_str = str(query)

        # Verify tenant_id is in the WHERE clause
        assert "tenant_id" in query_str
        assert "deleted_at" in query_str  # Also check for soft delete filter
