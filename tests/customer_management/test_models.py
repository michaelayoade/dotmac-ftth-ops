"""
Tests for customer management models.

Covers all model classes, relationships, constraints, and validation logic.
"""

from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.contacts.models import Contact
from dotmac.platform.customer_management.models import (
    ActivityType,
    CommunicationChannel,
    ContactRole,
    Customer,
    CustomerActivity,
    CustomerContactLink,
    CustomerNote,
    CustomerSegment,
    CustomerStatus,
    CustomerTag,
    CustomerTier,
    CustomerType,
)


@pytest.mark.integration
class TestCustomerModel:
    """Test Customer model functionality."""

    def test_customer_creation_minimal_fields(self):
        """Test customer creation with minimal required fields."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.PROSPECT,  # Explicitly set defaults for Python object
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )

        assert customer.customer_number == "CUST001"
        assert customer.first_name == "John"
        assert customer.last_name == "Doe"
        assert customer.email == "john.doe@example.com"
        assert customer.status == CustomerStatus.PROSPECT
        assert customer.customer_type == CustomerType.INDIVIDUAL
        assert customer.tier == CustomerTier.FREE

    def test_customer_full_name_property(self):
        """Test the full_name property."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.PROSPECT,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )
        assert customer.full_name == "John Doe"

        # Test with middle name
        customer.middle_name = "Michael"
        assert customer.full_name == "John Michael Doe"

    def test_customer_display_label_property(self):
        """Test the display_label property."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.PROSPECT,
            customer_type=CustomerType.INDIVIDUAL,
            tier=CustomerTier.FREE,
        )

        # Default display label
        assert customer.display_label == "John Doe"

        # With display name
        customer.display_name = "Johnny"
        assert customer.display_label == "Johnny"

        # With company name (no display name)
        customer.display_name = None
        customer.company_name = "Acme Corp"
        assert customer.display_label == "John Doe (Acme Corp)"

    def test_customer_enums(self):
        """Test all enum field assignments."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            status=CustomerStatus.ACTIVE,
            customer_type=CustomerType.BUSINESS,
            tier=CustomerTier.PREMIUM,
            preferred_channel=CommunicationChannel.SMS,
        )

        assert customer.status == CustomerStatus.ACTIVE
        assert customer.customer_type == CustomerType.BUSINESS
        assert customer.tier == CustomerTier.PREMIUM
        assert customer.preferred_channel == CommunicationChannel.SMS

    @pytest.mark.asyncio
    async def test_customer_database_constraints(self, async_db_session: AsyncSession, test_tenant):
        """Test database constraints and unique fields."""
        base_customer_kwargs = {
            "tenant_id": test_tenant.id,
            "first_name": "John",
            "last_name": "Doe",
            "email": "john.doe@example.com",
        }

        customer1 = Customer(customer_number="CUST001", **base_customer_kwargs)
        async_db_session.add(customer1)
        await async_db_session.flush()

        customer2 = Customer(
            customer_number="CUST001",
            tenant_id=test_tenant.id,  # Use test_tenant.id instead of hardcoded
            first_name="Jane",
            last_name="Smith",
            email="jane.smith@example.com",
        )
        async_db_session.add(customer2)

        with pytest.raises(IntegrityError):
            await async_db_session.flush()

        await async_db_session.rollback()

        customer_primary = Customer(customer_number="CUST002", **base_customer_kwargs)
        customer_duplicate_email = Customer(
            customer_number="CUST003",
            tenant_id=test_tenant.id,  # Use test_tenant.id instead of hardcoded
            first_name="Jane",
            last_name="Smith",
            email="john.doe@example.com",
        )

        async_db_session.add_all([customer_primary, customer_duplicate_email])

        with pytest.raises(IntegrityError):
            await async_db_session.flush()

        await async_db_session.rollback()


@pytest.mark.integration
class TestCustomerActivity:
    """Test CustomerActivity model."""

    def test_activity_creation(self):
        """Test activity creation with all required fields."""
        customer_id = uuid4()
        performed_by = uuid4()

        activity = CustomerActivity(
            customer_id=customer_id,
            tenant_id="test-tenant",
            activity_type=ActivityType.CREATED,
            title="Customer created",
            description="New customer account created",
            performed_by=performed_by,
            metadata_={"source": "web"},
        )

        assert activity.customer_id == customer_id
        assert activity.activity_type == ActivityType.CREATED
        assert activity.title == "Customer created"
        assert activity.performed_by == performed_by
        assert activity.metadata_["source"] == "web"

    def test_activity_types(self):
        """Test all activity type enums."""
        activity_types = [
            ActivityType.CREATED,
            ActivityType.UPDATED,
            ActivityType.STATUS_CHANGED,
            ActivityType.NOTE_ADDED,
            ActivityType.CONTACT_MADE,
            ActivityType.PURCHASE,
            ActivityType.LOGIN,
        ]

        for activity_type in activity_types:
            activity = CustomerActivity(
                customer_id=uuid4(),
                tenant_id="test-tenant",
                activity_type=activity_type,
                title=f"Test {activity_type.value}",
            )
            assert activity.activity_type == activity_type


@pytest.mark.integration
class TestCustomerNote:
    """Test CustomerNote model."""

    def test_note_creation(self):
        """Test note creation with required fields."""
        customer_id = uuid4()
        created_by_id = uuid4()

        note = CustomerNote(
            customer_id=customer_id,
            tenant_id="test-tenant",
            subject="Test Note",
            content="This is a test note content",
            is_internal=True,
            created_by_id=created_by_id,
        )

        assert note.customer_id == customer_id
        assert note.subject == "Test Note"
        assert note.content == "This is a test note content"
        assert note.is_internal is True
        assert note.created_by_id == created_by_id

    def test_note_visibility_flags(self):
        """Test internal vs external note visibility."""
        # Internal note (default)
        internal_note = CustomerNote(
            customer_id=uuid4(),
            tenant_id="test-tenant",
            subject="Internal Note",
            content="Internal communication",
            created_by_id=uuid4(),
        )
        assert internal_note.is_internal is True

        # External note (customer visible)
        external_note = CustomerNote(
            customer_id=uuid4(),
            tenant_id="test-tenant",
            subject="Customer Note",
            content="Customer facing note",
            is_internal=False,
            created_by_id=uuid4(),
        )
        assert external_note.is_internal is False


@pytest.mark.integration
class TestCustomerSegment:
    """Test CustomerSegment model."""

    def test_segment_creation(self):
        """Test segment creation with required fields."""
        segment = CustomerSegment(
            tenant_id="test-tenant",
            name="High Value Customers",
            description="Customers with high lifetime value",
            criteria={"min_ltv": 1000.0, "tier": "premium"},
            is_dynamic=True,
            member_count=0,  # Explicitly set since we're not committing to DB
        )

        assert segment.name == "High Value Customers"
        assert segment.criteria["min_ltv"] == 1000.0
        assert segment.is_dynamic is True
        assert segment.member_count == 0

    def test_segment_static_vs_dynamic(self):
        """Test static vs dynamic segment flags."""
        # Static segment
        static_segment = CustomerSegment(
            tenant_id="test-tenant",
            name="Manual Segment",
            is_dynamic=False,
        )
        assert static_segment.is_dynamic is False

        # Dynamic segment
        dynamic_segment = CustomerSegment(
            tenant_id="test-tenant",
            name="Auto Segment",
            criteria={"status": "active"},
            is_dynamic=True,
        )
        assert dynamic_segment.is_dynamic is True


@pytest.mark.integration
class TestCustomerTag:
    """Test CustomerTag model."""

    def test_tag_creation(self):
        """Test tag creation and assignment."""
        customer_id = uuid4()

        tag = CustomerTag(
            customer_id=customer_id,
            tenant_id="test-tenant",
            tag_name="vip",
            tag_category="priority",
        )

        assert tag.customer_id == customer_id
        assert tag.tag_name == "vip"
        assert tag.tag_category == "priority"

    @pytest.mark.asyncio
    async def test_tag_uniqueness(self, async_db_session: AsyncSession):
        """Test unique constraint on customer_id + tag_name."""
        customer_id = uuid4()

        tag1 = CustomerTag(
            customer_id=customer_id,
            tenant_id="test-tenant",
            tag_name="vip",
        )

        tag2 = CustomerTag(
            customer_id=customer_id,
            tenant_id="test-tenant",
            tag_name="vip",
        )

        async_db_session.add_all([tag1, tag2])

        with pytest.raises(IntegrityError):
            await async_db_session.flush()

        await async_db_session.rollback()


@pytest.mark.integration
class TestModelRelationships:
    """Test relationships between models."""

    @pytest.mark.asyncio
    async def test_customer_activities_relationship(self, async_db_session: AsyncSession):
        """Test customer-activities relationship."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        activity = CustomerActivity(
            customer_id=customer.id,
            tenant_id="test-tenant",
            activity_type=ActivityType.CREATED,
            title="Customer created",
        )
        async_db_session.add(activity)
        await async_db_session.flush()

        # Test relationship loading
        result = await async_db_session.execute(select(Customer).where(Customer.id == customer.id))
        loaded_customer = result.scalar_one()

        # The activities should be accessible through the relationship
        activities_count = await async_db_session.scalar(
            select(func.count())
            .select_from(CustomerActivity)
            .where(CustomerActivity.customer_id == loaded_customer.id)
        )
        assert activities_count == 1

    @pytest.mark.asyncio
    async def test_customer_notes_relationship(self, async_db_session: AsyncSession):
        """Test customer-notes relationship."""
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        note = CustomerNote(
            customer_id=customer.id,
            tenant_id="test-tenant",
            subject="Test Note",
            content="Test content",
            created_by_id=None,
        )
        async_db_session.add(note)
        await async_db_session.flush()

        # Verify relationship
        notes_count = await async_db_session.scalar(
            select(func.count())
            .select_from(CustomerNote)
            .where(CustomerNote.customer_id == customer.id)
        )
        assert notes_count == 1

    @pytest.mark.asyncio
    async def test_customer_contact_link_relationship(self, async_db_session: AsyncSession):
        """
        Regression test for CustomerContactLink relationship.

        Verifies that the Customer ↔ Contact many-to-many relationship
        works correctly with proper foreign keys and cascading behavior.

        This test catches issues like:
        - Missing ForeignKey constraints
        - Incorrect relationship back_populates
        - CASCADE behavior on delete
        - ORM relationship loading
        """
        if async_db_session.bind.dialect.name.startswith("sqlite"):
            pytest.skip("Requires PostgreSQL backend with full contact relationships")

        # Create a customer
        customer = Customer(
            customer_number="CUST001",
            tenant_id="test-tenant",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        # Create a contact
        contact = Contact(
            tenant_id="test-tenant",
            display_name="Jane Smith",
            first_name="Jane",
            last_name="Smith",
        )
        async_db_session.add(contact)
        await async_db_session.flush()

        # Ensure records persisted before creating link
        customer_exists = await async_db_session.scalar(
            select(func.count()).select_from(Customer).where(Customer.id == customer.id)
        )
        contact_exists = await async_db_session.scalar(
            select(func.count()).select_from(Contact).where(Contact.id == contact.id)
        )
        assert customer_exists == 1
        assert contact_exists == 1

        # Create the link between customer and contact
        link = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id="test-tenant",
            role=ContactRole.PRIMARY,
            is_primary_for_role=True,
        )
        async_db_session.add(link)
        await async_db_session.flush()

        # Verify the link was created
        result = await async_db_session.execute(
            select(CustomerContactLink).where(CustomerContactLink.customer_id == customer.id)
        )
        loaded_link = result.scalar_one()
        assert loaded_link.customer_id == customer.id
        assert loaded_link.contact_id == contact.id
        assert loaded_link.role == ContactRole.PRIMARY

        # Verify foreign key relationships work
        assert loaded_link.customer_id == customer.id
        assert loaded_link.contact_id == contact.id

        # Test CASCADE delete - deleting customer should delete link
        await async_db_session.delete(customer)
        await async_db_session.flush()

        # Link should be deleted
        link_count = await async_db_session.scalar(
            select(func.count())
            .select_from(CustomerContactLink)
            .where(CustomerContactLink.id == link.id)
        )
        assert link_count == 0

    @pytest.mark.asyncio
    async def test_customer_contact_link_foreign_key_constraints(
        self, async_db_session: AsyncSession, test_tenant
    ):
        """
        Test that foreign key constraints are properly enforced.

        This regression test ensures:
        1. Cannot create link with non-existent customer_id
        2. Cannot create link with non-existent contact_id
        3. Foreign keys have ondelete='CASCADE' configured
        """
        if async_db_session.bind.dialect.name.startswith("sqlite"):
            pytest.skip("Requires PostgreSQL backend with full contact relationships")

        # Create a valid customer
        customer = Customer(
            customer_number="CUST001",
            tenant_id=test_tenant.id,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        async_db_session.add(customer)
        await async_db_session.flush()

        # Try to create link with non-existent contact_id
        invalid_contact_id = uuid4()
        link = CustomerContactLink(
            customer_id=customer.id,
            contact_id=invalid_contact_id,  # Non-existent
            tenant_id=test_tenant.id,
            role=ContactRole.PRIMARY,
        )
        async_db_session.add(link)

        # Should raise IntegrityError due to FK constraint
        with pytest.raises(IntegrityError):
            await async_db_session.flush()

        await async_db_session.rollback()

        # Recreate customer and contact for next assertion
        customer = Customer(
            customer_number="CUST002",
            tenant_id=test_tenant.id,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        contact = Contact(
            tenant_id=test_tenant.id,
            display_name="Jane Smith",
            first_name="Jane",
            last_name="Smith",
        )
        async_db_session.add_all([customer, contact])
        await async_db_session.flush()

        invalid_customer_id = uuid4()
        link2 = CustomerContactLink(
            customer_id=invalid_customer_id,  # Non-existent
            contact_id=contact.id,
            tenant_id=test_tenant.id,
            role=ContactRole.PRIMARY,
        )
        async_db_session.add(link2)

        with pytest.raises(IntegrityError):
            await async_db_session.flush()

    @pytest.mark.asyncio
    async def test_customer_contact_multiple_roles(
        self, async_db_session: AsyncSession, test_tenant
    ):
        """
        Test that a single contact can have multiple roles with the same customer.

        This verifies:
        - A contact can be linked to a customer with different roles
        - Role field works correctly with ContactRole enum
        - is_primary_for_role flag works correctly
        """
        if async_db_session.bind.dialect.name.startswith("sqlite"):
            pytest.skip("Requires PostgreSQL backend with full contact relationships")

        # Create customer and contact
        customer = Customer(
            customer_number="CUST001",
            tenant_id=test_tenant.id,
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
        )
        contact = Contact(
            tenant_id=test_tenant.id,
            display_name="Jane Smith",
            first_name="Jane",
            last_name="Smith",
        )
        async_db_session.add(customer)
        async_db_session.add(contact)
        await async_db_session.flush()

        # Add contact as both PRIMARY and TECHNICAL
        link1 = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id=test_tenant.id,
            role=ContactRole.PRIMARY,
            is_primary_for_role=True,
        )
        link2 = CustomerContactLink(
            customer_id=customer.id,
            contact_id=contact.id,
            tenant_id=test_tenant.id,
            role=ContactRole.TECHNICAL,
            is_primary_for_role=True,
        )
        async_db_session.add(link1)
        async_db_session.add(link2)
        await async_db_session.flush()

        # Verify both links exist
        links_count = await async_db_session.scalar(
            select(func.count())
            .select_from(CustomerContactLink)
            .where(CustomerContactLink.customer_id == customer.id)
        )
        assert links_count == 2

        # Verify roles are different
        result = await async_db_session.execute(
            select(CustomerContactLink)
            .where(CustomerContactLink.customer_id == customer.id)
            .order_by(CustomerContactLink.role)
        )
        links = result.scalars().all()
        assert links[0].role == ContactRole.PRIMARY
        assert links[1].role == ContactRole.TECHNICAL
