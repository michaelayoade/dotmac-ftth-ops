"""
Tests for tenant foreign key constraints in contacts module.

Verifies that:
1. Contact, ContactLabelDefinition, and ContactFieldDefinition tables have proper FK constraints
2. CASCADE delete works correctly when tenant is deleted
3. Invalid tenant_id raises appropriate errors

NOTE: These tests require actual database connections to inspect schema and test CASCADE behavior.
They use sqlalchemy.inspect() which requires synchronous connections.
Marked as integration tests and require PostgreSQL (SQLite doesn't fully support FK constraints).
"""

import os

import pytest
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

# Mark all tests in this module as integration tests requiring PostgreSQL
from dotmac.platform.contacts.models import (  # noqa: E402
    Contact,
    ContactFieldDefinition,
    ContactFieldType,
    ContactLabelDefinition,
    ContactStage,
    ContactStatus,
)
from dotmac.platform.tenant.models import Tenant  # noqa: E402

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        os.getenv("DATABASE_URL", "sqlite://").startswith("sqlite"),
        reason="Requires PostgreSQL - SQLite doesn't fully support FK constraints and CASCADE",
    ),
]


@pytest.mark.asyncio
class TestContactTenantForeignKeys:
    """Test tenant foreign key constraints on Contact model."""

    async def test_contact_has_tenant_fk_constraint(self, async_db_session):
        """Verify Contact table has foreign key constraint to tenants."""
        # Get table metadata
        inspector = inspect(async_db_session.get_bind())
        foreign_keys = inspector.get_foreign_keys("contacts")

        # Find tenant_id FK
        tenant_fk = next(
            (fk for fk in foreign_keys if "tenant_id" in fk["constrained_columns"]), None
        )

        assert tenant_fk is not None, "No foreign key found for tenant_id"
        assert tenant_fk["referred_table"] == "tenants"
        assert tenant_fk["referred_columns"] == ["id"]
        assert tenant_fk["options"]["ondelete"] == "CASCADE"

    async def test_contact_cannot_have_invalid_tenant_id(self, async_db_session):
        """Contact with non-existent tenant_id should fail."""
        invalid_tenant_id = "invalid-tenant-999"

        contact = Contact(
            tenant_id=invalid_tenant_id,
            display_name="Test Contact",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )

        async_db_session.add(contact)

        with pytest.raises(IntegrityError) as exc_info:
            await async_db_session.commit()

        assert "foreign key constraint" in str(exc_info.value).lower()

    async def test_contact_cascade_delete_on_tenant_removal(self, async_db_session):
        """Contacts should be deleted when tenant is deleted (CASCADE)."""
        # Create tenant
        tenant = Tenant(
            id="test-tenant-cascade",
            name="Test Tenant",
            slug="test-tenant-cascade",
        )
        async_db_session.add(tenant)
        await async_db_session.commit()

        # Create contacts for this tenant
        contact1 = Contact(
            tenant_id=tenant.id,
            display_name="Contact 1",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )
        contact2 = Contact(
            tenant_id=tenant.id,
            display_name="Contact 2",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )

        async_db_session.add_all([contact1, contact2])
        await async_db_session.commit()

        contact1_id = contact1.id
        contact2_id = contact2.id

        # Delete the tenant
        await async_db_session.delete(tenant)
        await async_db_session.commit()

        # Verify contacts were cascade deleted
        from sqlalchemy import select

        result = await async_db_session.execute(
            select(Contact).where(Contact.id.in_([contact1_id, contact2_id]))
        )
        remaining_contacts = result.scalars().all()

        assert len(remaining_contacts) == 0, "Contacts should be cascade deleted with tenant"

    async def test_contact_tenant_id_is_required(self, async_db_session):
        """Contact cannot be created without tenant_id."""
        contact = Contact(
            # Missing tenant_id
            display_name="Test Contact",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )

        async_db_session.add(contact)

        with pytest.raises((IntegrityError, ValueError)):
            await async_db_session.commit()


@pytest.mark.asyncio
class TestContactLabelDefinitionTenantForeignKeys:
    """Test tenant foreign key constraints on ContactLabelDefinition model."""

    async def test_label_definition_has_tenant_fk_constraint(self, async_db_session):
        """Verify ContactLabelDefinition table has FK constraint to tenants."""
        inspector = inspect(async_db_session.get_bind())
        foreign_keys = inspector.get_foreign_keys("contact_label_definitions")

        tenant_fk = next(
            (fk for fk in foreign_keys if "tenant_id" in fk["constrained_columns"]), None
        )

        assert tenant_fk is not None, "No foreign key found for tenant_id"
        assert tenant_fk["referred_table"] == "tenants"
        assert tenant_fk["options"]["ondelete"] == "CASCADE"

    async def test_label_definition_cascade_delete(self, async_db_session):
        """Label definitions should be deleted when tenant is deleted."""
        # Create tenant
        tenant = Tenant(
            id="test-tenant-labels",
            name="Test Tenant Labels",
            slug="test-tenant-labels",
        )
        async_db_session.add(tenant)
        await async_db_session.commit()

        # Create label definitions
        label = ContactLabelDefinition(
            tenant_id=tenant.id,
            name="VIP Customer",
            slug="vip-customer",
        )

        async_db_session.add(label)
        await async_db_session.commit()
        label_id = label.id

        # Delete tenant
        await async_db_session.delete(tenant)
        await async_db_session.commit()

        # Verify label was cascade deleted
        from sqlalchemy import select

        result = await async_db_session.execute(
            select(ContactLabelDefinition).where(ContactLabelDefinition.id == label_id)
        )
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
class TestContactFieldDefinitionTenantForeignKeys:
    """Test tenant foreign key constraints on ContactFieldDefinition model."""

    async def test_field_definition_has_tenant_fk_constraint(self, async_db_session):
        """Verify ContactFieldDefinition table has FK constraint to tenants."""
        inspector = inspect(async_db_session.get_bind())
        foreign_keys = inspector.get_foreign_keys("contact_field_definitions")

        tenant_fk = next(
            (fk for fk in foreign_keys if "tenant_id" in fk["constrained_columns"]), None
        )

        assert tenant_fk is not None, "No foreign key found for tenant_id"
        assert tenant_fk["referred_table"] == "tenants"
        assert tenant_fk["options"]["ondelete"] == "CASCADE"

    async def test_field_definition_cascade_delete(self, async_db_session):
        """Field definitions should be deleted when tenant is deleted."""
        # Create tenant
        tenant = Tenant(
            id="test-tenant-fields",
            name="Test Tenant Fields",
            slug="test-tenant-fields",
        )
        async_db_session.add(tenant)
        await async_db_session.commit()

        # Create field definition
        field = ContactFieldDefinition(
            tenant_id=tenant.id,
            name="Loyalty Points",
            field_key="loyalty_points",
            field_type=ContactFieldType.NUMBER,
        )

        async_db_session.add(field)
        await async_db_session.commit()
        field_id = field.id

        # Delete tenant
        await async_db_session.delete(tenant)
        await async_db_session.commit()

        # Verify field was cascade deleted
        from sqlalchemy import select

        result = await async_db_session.execute(
            select(ContactFieldDefinition).where(ContactFieldDefinition.id == field_id)
        )
        assert result.scalar_one_or_none() is None

    async def test_field_definition_invalid_tenant_fails(self, async_db_session):
        """Field definition with non-existent tenant_id should fail."""
        field = ContactFieldDefinition(
            tenant_id="invalid-tenant-999",
            name="Test Field",
            field_key="test_field",
            field_type=ContactFieldType.TEXT,
        )

        async_db_session.add(field)

        with pytest.raises(IntegrityError):
            await async_db_session.commit()


@pytest.mark.asyncio
class TestTenantIsolation:
    """Test that tenant isolation works correctly with new FK constraints."""

    async def test_contacts_isolated_by_tenant(self, async_db_session):
        """Contacts from different tenants should be isolated."""
        # Create two tenants
        tenant1 = Tenant(id="tenant-1", name="Tenant 1", slug="tenant-1")
        tenant2 = Tenant(id="tenant-2", name="Tenant 2", slug="tenant-2")

        async_db_session.add_all([tenant1, tenant2])
        await async_db_session.commit()

        # Create contacts for each tenant
        contact1 = Contact(
            tenant_id=tenant1.id,
            display_name="Tenant 1 Contact",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )
        contact2 = Contact(
            tenant_id=tenant2.id,
            display_name="Tenant 2 Contact",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.PROSPECT,
        )

        async_db_session.add_all([contact1, contact2])
        await async_db_session.commit()

        # Query for tenant1 contacts
        from sqlalchemy import select

        result = await async_db_session.execute(
            select(Contact).where(Contact.tenant_id == tenant1.id)
        )
        tenant1_contacts = result.scalars().all()

        # Should only get tenant1's contact
        assert len(tenant1_contacts) == 1
        assert tenant1_contacts[0].display_name == "Tenant 1 Contact"

        # Query for tenant2 contacts
        result = await async_db_session.execute(
            select(Contact).where(Contact.tenant_id == tenant2.id)
        )
        tenant2_contacts = result.scalars().all()

        # Should only get tenant2's contact
        assert len(tenant2_contacts) == 1
        assert tenant2_contacts[0].display_name == "Tenant 2 Contact"
