
"""
Regression test for CustomerContactLink ORM relationship.

This test file ensures the Customer ↔ Contact many-to-many relationship
works correctly with proper foreign keys and relationship mappings.

This would have caught the NoForeignKeysError that occurred when contact_id
was missing a ForeignKey constraint.

NOTE: Some tests require PostgreSQL for full foreign key constraint validation.
SQLite limitations:
- Foreign key constraints are not enforced by default
- CASCADE behavior differs from PostgreSQL

Tests marked with @requires_postgres will skip on SQLite.
Run all tests with: DOTMAC_DATABASE_URL_ASYNC=postgresql://... pytest
"""

import os
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from dotmac.platform.contacts.models import Contact
from dotmac.platform.customer_management.models import (
    ContactRole,
    Customer,
    CustomerContactLink,
    CustomerStatus,
    CustomerTier,
    CustomerType,
)
from dotmac.platform.tenant.models import Tenant, TenantStatus

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

# Check if using PostgreSQL
DB_URL = os.environ.get("DOTMAC_DATABASE_URL_ASYNC", "")
IS_POSTGRES = "postgresql" in DB_URL

requires_postgres = pytest.mark.skipif(
    not IS_POSTGRES,
    reason="Requires PostgreSQL - SQLite doesn't enforce FK constraints or CASCADE behavior"
)


@pytest_asyncio.fixture
async def test_tenant(async_db_session):
    """Create a test tenant for integration tests."""
    tenant = Tenant(
        id="test-tenant",
        name="Test Tenant",
        slug="test-tenant",
        status=TenantStatus.ACTIVE,
    )
    async_db_session.add(tenant)
    await async_db_session.flush()
    return tenant


@pytest.mark.serial_only
@pytest.mark.asyncio
class TestCustomerContactRelationship:
    """Test CustomerContactLink ORM relationship integrity."""

    async def test_customer_contact_link_creation(self, async_db_session, test_tenant):
        """Test basic creation of customer-contact link."""
        # Create customer
        customer = Customer(
            customer_number="TEST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email=f"john.doe.{uuid4()}@example.com",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        # Create contact (Contact model doesn't have email field - emails are in ContactMethod table)
        contact = Contact(
            tenant_id="test-tenant",
            first_name="Jane",
            last_name="Smith",
            display_name="Jane Smith",  # Required field
        )
        async_db_session.add(contact)
        await async_db_session.flush()

        # Create link
        link = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id="test-tenant",
            role=ContactRole.PRIMARY,
            is_primary_for_role=True,
        )
        async_db_session.add(link)
        await async_db_session.flush()

        # Verify link was created
        result = await async_db_session.execute(
            select(CustomerContactLink).where(CustomerContactLink.customer_id == customer.id)
        )
        loaded_link = result.scalar_one()
        assert loaded_link.contact_id == contact.id
        assert loaded_link.role == ContactRole.PRIMARY

    @requires_postgres
    async def test_foreign_key_constraint_enforced(self, async_db_session, test_tenant):
        """Test that foreign key constraints are enforced.

        Requires PostgreSQL - SQLite doesn't enforce FK constraints by default.
        """
        # Create customer
        customer = Customer(
            customer_number="TEST002",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email=f"john.{uuid4()}@example.com",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        # Try to create link with non-existent contact_id
        invalid_contact_id = uuid4()
        link = CustomerContactLink(
            customer_id=customer.id,
            contact_id=invalid_contact_id,  # Non-existent
            tenant_id="test-tenant",
            role=ContactRole.PRIMARY,
        )
        async_db_session.add(link)

        # Should raise IntegrityError
        with pytest.raises(IntegrityError):
            await async_db_session.flush()

    @requires_postgres
    async def test_cascade_delete_behavior(self, async_db_session, test_tenant):
        """Test CASCADE delete when customer is deleted.

        Requires PostgreSQL - SQLite CASCADE behavior differs from PostgreSQL.
        """
        # Create customer and contact
        customer = Customer(
            customer_number="TEST003",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email=f"john.{uuid4()}@example.com",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )
        contact = Contact(
            tenant_id="test-tenant",
            first_name="Jane",
            last_name="Smith",
            display_name="Jane Smith",
        )
        async_db_session.add(customer)
        async_db_session.add(contact)
        await async_db_session.flush()

        # Create link
        link = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id="test-tenant",
            role=ContactRole.PRIMARY,
        )
        async_db_session.add(link)
        await async_db_session.flush()
        link_id = link.id

        # Delete customer
        await async_db_session.delete(customer)
        await async_db_session.flush()

        # Link should be cascaded and deleted
        result = await async_db_session.execute(
            select(CustomerContactLink).where(CustomerContactLink.id == link_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_multiple_roles_for_single_contact(self, async_db_session, test_tenant):
        """Test that a contact can have multiple roles with same customer."""
        # Create customer and contact
        customer = Customer(
            customer_number="TEST004",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email=f"john.{uuid4()}@example.com",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )
        contact = Contact(
            tenant_id="test-tenant",
            first_name="Jane",
            last_name="Smith",
            display_name="Jane Smith",
        )
        async_db_session.add(customer)
        async_db_session.add(contact)
        await async_db_session.flush()

        # Add contact with multiple roles
        link1 = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id="test-tenant",
            role=ContactRole.PRIMARY,
            is_primary_for_role=True,
        )
        link2 = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id="test-tenant",
            role=ContactRole.TECHNICAL,
            is_primary_for_role=True,
        )
        async_db_session.add(link1)
        async_db_session.add(link2)
        await async_db_session.flush()

        # Verify both roles exist
        result = await async_db_session.execute(
            select(CustomerContactLink)
            .where(CustomerContactLink.customer_id == customer.id)
            .order_by(CustomerContactLink.role)
        )
        links = result.scalars().all()
        assert len(links) == 2
        assert links[0].role == ContactRole.PRIMARY
        assert links[1].role == ContactRole.TECHNICAL
