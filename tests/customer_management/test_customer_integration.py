"""
Integration Tests for Customer Management Service.

Strategy: Use REAL database, test complete workflows
Focus: Service-layer integration covering untested areas (72.40% → 90%+)
Pattern: Following invoice integration test pattern

NOTE: These tests encounter database I/O errors in CI/test environment.
The customer management module already achieves 91.06% coverage through
unit tests. These integration tests are kept for documentation purposes.
"""

from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = [
    pytest.mark.integration,
]

from dotmac.platform.customer_management.models import (  # noqa: E402
    ActivityType,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.customer_management.schemas import (  # noqa: E402
    CustomerActivityCreate,
    CustomerCreate,
    CustomerNoteCreate,
    CustomerSearchParams,
    CustomerSegmentCreate,
    CustomerUpdate,
)
from dotmac.platform.customer_management.service import CustomerService  # noqa: E402


@pytest.fixture(autouse=True)
async def _require_postgres_backend(async_session: AsyncSession):
    """Ensure integration tests run only when PostgreSQL is available."""
    bind = getattr(async_session, "bind", None)
    dialect_name = getattr(getattr(bind, "dialect", None), "name", None)
    if dialect_name != "postgresql":
        pytest.skip("Requires PostgreSQL backend via DOTMAC_DATABASE_URL_ASYNC")
    yield


@pytest.mark.asyncio
class TestCustomerCRUDIntegration:
    """Integration tests for customer CRUD operations with real database."""

    async def test_create_customer_complete_workflow(self, async_session: AsyncSession):
        """Test creating customer with all fields and automatic number generation."""
        service = CustomerService(async_session)

        # Mock tenant context
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-integration-001"

            customer_data = CustomerCreate(
                first_name="John",
                last_name="Doe",
                email="john.doe@example.com",
                phone="+1234567890",
                company_name="Acme Corp",
                customer_type=CustomerType.BUSINESS,
                tier=CustomerTier.PREMIUM,
                address_line1="123 Main St",
                city="Boston",
                state_province="MA",
                postal_code="02101",
                country="US",
                tags=["vip", "enterprise"],
                metadata={"source": "sales_team", "campaign": "q4_2024"},
                custom_fields={"account_manager": "Sarah Smith"},
            )

            customer = await service.create_customer(
                data=customer_data,
                created_by=None,  # Use None instead of string
            )

            # Verify customer creation
            assert customer.id is not None
            assert customer.customer_number is not None
            assert customer.customer_number.startswith("CUST-")
            assert customer.first_name == "John"
            assert customer.last_name == "Doe"
            assert customer.email == "john.doe@example.com"
            assert customer.company_name == "Acme Corp"
            assert customer.customer_type == CustomerType.BUSINESS
            assert customer.tier == CustomerTier.PREMIUM
            assert customer.status == CustomerStatus.PROSPECT  # Default
            assert customer.tenant_id == "tenant-integration-001"
            assert "vip" in customer.tags
            assert "enterprise" in customer.tags
            assert customer.metadata_["source"] == "sales_team"
            assert customer.custom_fields["account_manager"] == "Sarah Smith"
            assert customer.created_by is None

            # Verify activity was created
            activities = await service.get_customer_activities(customer.id)
            assert len(activities) >= 1
            assert activities[0].activity_type == ActivityType.CREATED

    async def test_get_customer_with_includes(self, async_session: AsyncSession):
        """Test retrieving customer and verifying related data exists."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-get-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Jane",
                last_name="Smith",
                email="jane.smith@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Add note
            note_data = CustomerNoteCreate(
                subject="Initial Contact",
                content="Customer interested in premium features",
            )
            await service.add_note(customer.id, note_data, created_by=uuid4())

            # Retrieve customer (basic retrieval)
            retrieved = await service.get_customer(customer.id)

            assert retrieved is not None
            assert retrieved.id == customer.id

            # Verify activities and notes exist via separate queries
            activities = await service.get_customer_activities(customer.id)
            assert len(activities) >= 1

            notes = await service.get_customer_notes(customer.id)
            assert len(notes) >= 1

    async def test_update_customer_metrics_and_fields(self, async_session: AsyncSession):
        """Test updating customer information and tracking changes."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-update-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Bob",
                last_name="Johnson",
                email="bob.johnson@example.com",
                tier=CustomerTier.BASIC,
            )
            customer = await service.create_customer(customer_data)

            # Update customer
            update_data = CustomerUpdate(
                tier=CustomerTier.PREMIUM,
                status=CustomerStatus.ACTIVE,
                company_name="Johnson Enterprises",
                tags=["upgraded", "active"],
                metadata={"upgrade_date": "2024-10-03"},
            )

            updated_customer = await service.update_customer(
                customer.id,
                update_data,
                updated_by=None,  # Use None instead of string
            )

            # Verify updates
            assert updated_customer.tier == CustomerTier.PREMIUM
            assert updated_customer.status == CustomerStatus.ACTIVE
            assert updated_customer.company_name == "Johnson Enterprises"
            assert "upgraded" in updated_customer.tags
            assert updated_customer.metadata_["upgrade_date"] == "2024-10-03"
            assert updated_customer.updated_by is None

            # Verify update activity created
            activities = await service.get_customer_activities(customer.id)
            update_activities = [a for a in activities if a.activity_type == ActivityType.UPDATED]
            assert len(update_activities) >= 1

    async def test_soft_delete_customer(self, async_session: AsyncSession):
        """Test soft deleting customer (marks as deleted, preserves data)."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-delete-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Delete",
                last_name="Test",
                email="delete.test@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Soft delete
            deleted = await service.delete_customer(
                customer.id,
                deleted_by=None,  # Use None instead of string
                hard_delete=False,
            )

            assert deleted is True

            # Verify customer is soft-deleted
            retrieved = await service.get_customer(customer.id)
            # Should not find it (filtered by deleted_at IS NULL)
            assert retrieved is None


@pytest.mark.asyncio
class TestCustomerSearch:
    """Integration tests for customer search and filtering."""

    async def test_search_customers_by_query(self, async_session: AsyncSession):
        """Test full-text search across customer fields."""
        service = CustomerService(async_session)

        # Use unique tenant ID to avoid cross-test contamination
        unique_tenant = f"tenant-search-{str(uuid4())[:8]}"

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = unique_tenant

            # Create multiple customers
            customers_data = [
                CustomerCreate(
                    first_name="Alice",
                    last_name="Anderson",
                    email="alice@example.com",
                    company_name="Alpha Corp",
                ),
                CustomerCreate(
                    first_name="Bob",
                    last_name="Baker",
                    email="bob@example.com",
                    company_name="Beta Inc",
                ),
                CustomerCreate(
                    first_name="Charlie",
                    last_name="Chen",
                    email="charlie@example.com",
                    company_name="Alpha Solutions",  # Also has "Alpha"
                ),
            ]

            for data in customers_data:
                await service.create_customer(data)

            # Search for "Alpha" (should match company name)
            search_params = CustomerSearchParams(query="Alpha")
            results, total = await service.search_customers(search_params, limit=10)

            # Should find 2 customers with "Alpha" in company name
            assert total == 2
            assert len(results) == 2
            company_names = [c.company_name for c in results]
            assert "Alpha Corp" in company_names
            assert "Alpha Solutions" in company_names

            # Search by email
            search_params = CustomerSearchParams(query="bob@example.com")
            results, total = await service.search_customers(search_params, limit=10)
            assert total == 1
            assert results[0].email == "bob@example.com"

    async def test_search_customers_by_filters(self, async_session: AsyncSession):
        """Test filtering customers by status, type, tier."""
        service = CustomerService(async_session)

        # Use unique tenant ID
        unique_tenant = f"tenant-filter-{str(uuid4())[:8]}"

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = unique_tenant

            # Create customers with different attributes
            customers_data = [
                CustomerCreate(
                    first_name="Premium",
                    last_name="Customer",
                    email="premium@example.com",
                    tier=CustomerTier.PREMIUM,
                    customer_type=CustomerType.BUSINESS,
                ),
                CustomerCreate(
                    first_name="Basic",
                    last_name="Customer",
                    email="basic@example.com",
                    tier=CustomerTier.BASIC,
                    customer_type=CustomerType.INDIVIDUAL,
                ),
                CustomerCreate(
                    first_name="Inactive",
                    last_name="Customer",
                    email="inactive@example.com",
                    tier=CustomerTier.PREMIUM,
                    customer_type=CustomerType.BUSINESS,
                ),
            ]

            # Create and update status for customers
            for i, data in enumerate(customers_data):
                customer = await service.create_customer(data)

                # Update status based on index
                if i == 2:  # Last one should be inactive
                    update_data = CustomerUpdate(status=CustomerStatus.INACTIVE)
                    await service.update_customer(customer.id, update_data)
                else:
                    # Set to active
                    update_data = CustomerUpdate(status=CustomerStatus.ACTIVE)
                    await service.update_customer(customer.id, update_data)

            # Filter by tier
            search_params = CustomerSearchParams(tier=CustomerTier.PREMIUM)
            results, total = await service.search_customers(search_params, limit=10)
            assert total == 2
            assert all(c.tier == CustomerTier.PREMIUM for c in results)

            # Filter by status
            search_params = CustomerSearchParams(status=CustomerStatus.ACTIVE)
            results, total = await service.search_customers(search_params, limit=10)
            assert total == 2
            assert all(c.status == CustomerStatus.ACTIVE for c in results)

            # Filter by type
            search_params = CustomerSearchParams(customer_type=CustomerType.BUSINESS)
            results, total = await service.search_customers(search_params, limit=10)
            assert total == 2
            assert all(c.customer_type == CustomerType.BUSINESS for c in results)


@pytest.mark.asyncio
class TestCustomerActivities:
    """Integration tests for customer activity tracking."""

    async def test_add_custom_activity(self, async_session: AsyncSession):
        """Test adding custom activity to customer."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-activity-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Activity",
                last_name="Test",
                email="activity@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Add custom activity
            activity_data = CustomerActivityCreate(
                activity_type=ActivityType.CONTACT_MADE,
                title="Sales Call",
                description="Discussed premium upgrade options",
                metadata={"call_duration_minutes": 30, "outcome": "positive"},
            )

            activity = await service.add_activity(
                customer.id,
                activity_data,
                performed_by=None,  # Use None instead of string
            )

            # Verify activity
            assert activity.id is not None
            assert activity.customer_id == customer.id
            assert activity.activity_type == ActivityType.CONTACT_MADE
            assert activity.title == "Sales Call"
            assert activity.description == "Discussed premium upgrade options"
            assert activity.metadata_["call_duration_minutes"] == 30
            assert activity.performed_by is None

    async def test_get_customer_activities_filtered(self, async_session: AsyncSession):
        """Test retrieving activities filtered by type."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-activity-filter-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Filter",
                last_name="Test",
                email="filter@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Add multiple activities
            activities_to_add = [
                CustomerActivityCreate(
                    activity_type=ActivityType.PURCHASE,
                    title="Purchase 1",
                    description="Bought product A",
                ),
                CustomerActivityCreate(
                    activity_type=ActivityType.PURCHASE,
                    title="Purchase 2",
                    description="Bought product B",
                ),
                CustomerActivityCreate(
                    activity_type=ActivityType.CONTACT_MADE,
                    title="Support Call",
                    description="Requested help",
                ),
            ]

            for activity_data in activities_to_add:
                await service.add_activity(customer.id, activity_data)

            # Get all activities
            all_activities = await service.get_customer_activities(customer.id)
            # Should include: 2 PURCHASE + 1 CONTACT_MADE + 1 CREATED (auto-created)
            assert len(all_activities) >= 4

            # Get only PURCHASE activities
            purchase_activities = await service.get_customer_activities(
                customer.id,
                activity_type=ActivityType.PURCHASE,
            )
            assert len(purchase_activities) == 2
            assert all(a.activity_type == ActivityType.PURCHASE for a in purchase_activities)


@pytest.mark.asyncio
class TestCustomerNotes:
    """Integration tests for customer notes management."""

    async def test_add_and_retrieve_notes(self, async_session: AsyncSession):
        """Test adding notes to customer and retrieving them."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-notes-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Notes",
                last_name="Test",
                email="notes@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Add internal note
            internal_note = CustomerNoteCreate(
                subject="Internal Strategy",
                content="Customer is considering enterprise upgrade. Follow up in Q1 2025.",
            )
            await service.add_note(customer.id, internal_note, created_by=uuid4())

            # Add customer-visible note
            external_note = CustomerNoteCreate(
                subject="Meeting Summary",
                content="Discussed implementation timeline and training needs.",
            )
            await service.add_note(customer.id, external_note, created_by=uuid4())

            # Retrieve all notes
            all_notes = await service.get_customer_notes(customer.id, include_internal=True)
            assert len(all_notes) == 2

            # Verify note creation also created activity
            activities = await service.get_customer_activities(customer.id)
            note_activities = [a for a in activities if a.activity_type == ActivityType.NOTE_ADDED]
            assert len(note_activities) == 2


@pytest.mark.asyncio
class TestCustomerPurchaseTracking:
    """Integration tests for purchase recording and metrics updates."""

    async def test_record_purchase_updates_metrics(self, async_session: AsyncSession):
        """Test that recording purchases updates customer lifetime value and metrics."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-purchase-001"

            # Create customer
            customer_data = CustomerCreate(
                first_name="Purchase",
                last_name="Test",
                email="purchase@example.com",
            )
            customer = await service.create_customer(customer_data)

            # Record first purchase
            activity1 = await service.record_purchase(
                customer.id,
                amount=Decimal("100.00"),
                order_id="ORDER-001",
                performed_by=None,  # Use None instead of string
            )

            # Refresh customer from DB to get updated metrics
            customer = await service.get_customer(customer.id)

            # Verify metrics updated
            assert customer.total_purchases == 1
            assert customer.lifetime_value == Decimal("100.00")
            assert customer.average_order_value == Decimal("100.00")
            assert customer.first_purchase_date is not None
            assert customer.last_purchase_date is not None

            # Record second purchase
            activity2 = await service.record_purchase(
                customer.id,
                amount=Decimal("150.00"),
                order_id="ORDER-002",
            )

            # Refresh again
            customer = await service.get_customer(customer.id)

            # Verify updated metrics
            assert customer.total_purchases == 2
            assert customer.lifetime_value == Decimal("250.00")
            assert customer.average_order_value == Decimal("125.00")

            # Verify purchase activities created
            assert activity1.activity_type == ActivityType.PURCHASE
            assert activity2.activity_type == ActivityType.PURCHASE


@pytest.mark.asyncio
class TestCustomerSegmentation:
    """Integration tests for customer segmentation."""

    async def test_create_dynamic_segment(self, async_session: AsyncSession):
        """Test creating dynamic customer segment with criteria."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-segment-001"

            # Create customers with different attributes
            premium_customers = []
            for i in range(3):
                customer_data = CustomerCreate(
                    first_name=f"Premium{i}",
                    last_name="Customer",
                    email=f"premium{i}@example.com",
                    tier=CustomerTier.PREMIUM,
                    status=CustomerStatus.ACTIVE,
                )
                customer = await service.create_customer(customer_data)
                premium_customers.append(customer)

            # Create segment for premium active customers
            segment_data = CustomerSegmentCreate(
                name="Premium Active Customers",
                description="All active premium tier customers",
                criteria={
                    "tier": CustomerTier.PREMIUM.value,
                    "status": CustomerStatus.ACTIVE.value,
                },
                is_dynamic=True,
            )

            segment = await service.create_segment(segment_data)

            # Verify segment
            assert segment.id is not None
            assert segment.name == "Premium Active Customers"
            assert segment.is_dynamic is True
            assert segment.member_count == 3  # Should match 3 premium active customers
            assert segment.criteria["tier"] == CustomerTier.PREMIUM.value

    async def test_recalculate_segment_membership(self, async_session: AsyncSession):
        """Test recalculating dynamic segment membership."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-recalc-001"

            # Create segment
            segment_data = CustomerSegmentCreate(
                name="Active Business Customers",
                description="Active business customers",
                criteria={
                    "status": CustomerStatus.ACTIVE.value,
                    "customer_type": CustomerType.BUSINESS.value,
                },
                is_dynamic=True,
            )
            segment = await service.create_segment(segment_data)
            initial_count = segment.member_count

            # Add new customers matching criteria
            for i in range(2):
                customer_data = CustomerCreate(
                    first_name=f"Business{i}",
                    last_name="Customer",
                    email=f"biz{i}@example.com",
                    customer_type=CustomerType.BUSINESS,
                    status=CustomerStatus.ACTIVE,
                )
                await service.create_customer(customer_data)

            # Recalculate segment
            new_count = await service.recalculate_segment(segment.id)

            # Verify count increased
            assert new_count == initial_count + 2


@pytest.mark.asyncio
class TestCustomerStatisticsAndMetrics:
    """Integration tests for customer analytics and statistics."""

    async def test_get_customer_count_by_status(self, async_session: AsyncSession):
        """Test getting customer count filtered by status."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-stats-001"

            # Create customers and set different statuses
            statuses = [
                CustomerStatus.ACTIVE,
                CustomerStatus.ACTIVE,
                CustomerStatus.INACTIVE,
                CustomerStatus.PROSPECT,
            ]

            for i, status in enumerate(statuses):
                customer_data = CustomerCreate(
                    first_name=f"Customer{i}",
                    last_name="Test",
                    email=f"customer{i}@example.com",
                )
                customer = await service.create_customer(customer_data)

                # Update to desired status if not already PROSPECT (default)
                if status != CustomerStatus.PROSPECT:
                    update_data = CustomerUpdate(status=status)
                    await service.update_customer(customer.id, update_data)

            # Get total count
            total_count = await service.get_customer_count()
            assert total_count == 4

            # Get active count
            active_count = await service.get_customer_count(status=CustomerStatus.ACTIVE)
            assert active_count == 2

            # Get inactive count
            inactive_count = await service.get_customer_count(status=CustomerStatus.INACTIVE)
            assert inactive_count == 1

    async def test_get_customer_metrics(self, async_session: AsyncSession):
        """Test getting aggregated customer metrics."""
        service = CustomerService(async_session)

        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-metrics-001"

            # Create customers with purchases
            for i in range(5):
                customer_data = CustomerCreate(
                    first_name=f"Metrics{i}",
                    last_name="Test",
                    email=f"metrics{i}@example.com",
                    tier=CustomerTier.PREMIUM if i < 2 else CustomerTier.BASIC,
                )
                customer = await service.create_customer(customer_data)

                # Update to ACTIVE status
                update_data = CustomerUpdate(status=CustomerStatus.ACTIVE)
                customer = await service.update_customer(customer.id, update_data)

                # Record purchase
                await service.record_purchase(
                    customer.id,
                    amount=Decimal(f"{(i + 1) * 100}.00"),
                )

            # Get metrics
            metrics = await service.get_customer_metrics()

            # Verify metrics structure
            assert "total_customers" in metrics
            assert "active_customers" in metrics
            assert "total_revenue" in metrics
            assert "average_lifetime_value" in metrics
            assert "customers_by_status" in metrics
            assert "customers_by_tier" in metrics

            # Verify values
            assert metrics["total_customers"] == 5
            assert metrics["active_customers"] == 5
            assert metrics["total_revenue"] > 0
            assert metrics["customers_by_tier"]["premium"] == 2
            assert metrics["customers_by_tier"]["basic"] == 3


@pytest.mark.asyncio
class TestTenantIsolation:
    """Integration tests for multi-tenant data isolation."""

    async def test_customers_isolated_by_tenant(self, async_session: AsyncSession):
        """Test that customers are properly isolated between tenants."""
        service = CustomerService(async_session)

        # Create customers for tenant 1
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-1"

            customer1_data = CustomerCreate(
                first_name="Tenant1",
                last_name="Customer",
                email="tenant1@example.com",
            )
            customer1 = await service.create_customer(customer1_data)

        # Create customers for tenant 2
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-2"

            customer2_data = CustomerCreate(
                first_name="Tenant2",
                last_name="Customer",
                email="tenant2@example.com",
            )
            customer2 = await service.create_customer(customer2_data)

        # Try to access tenant 1's customer from tenant 2 context
        with patch(
            "dotmac.platform.customer_management.service.get_current_tenant_id"
        ) as mock_tenant:
            mock_tenant.return_value = "tenant-2"

            # Should not find tenant 1's customer
            retrieved = await service.get_customer(customer1.id)
            assert retrieved is None

            # Should find tenant 2's customer
            retrieved = await service.get_customer(customer2.id)
            assert retrieved is not None
            assert retrieved.id == customer2.id
