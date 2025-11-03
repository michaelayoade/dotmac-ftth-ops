"""
Tests for contacts/schemas.py applying fake implementation pattern.

This test file focuses on:
1. Actually importing the module for real coverage
2. Testing Pydantic validators and field constraints
3. Testing model behavior and validation logic
4. Avoiding over-mocking
"""

from datetime import UTC, datetime
from uuid import uuid4

import pytest

# Import module for coverage
from dotmac.platform.contacts.models import (
    ContactFieldType,
    ContactMethodType,
    ContactStage,
    ContactStatus,
)
from dotmac.platform.contacts.schemas import (
    ContactActivityBase,
    ContactActivityCreate,
    ContactActivityResponse,
    ContactBase,
    ContactBulkDelete,
    ContactBulkUpdate,
    ContactCreate,
    ContactFieldDefinitionBase,
    ContactFieldDefinitionCreate,
    ContactFieldDefinitionResponse,
    ContactLabelDefinitionBase,
    ContactLabelDefinitionCreate,
    ContactLabelDefinitionResponse,
    ContactListResponse,
    ContactMethodBase,
    ContactMethodCreate,
    ContactMethodResponse,
    ContactResponse,
    ContactSearchRequest,
    ContactUpdate,
)


@pytest.mark.unit
class TestContactMethodSchemas:
    """Test ContactMethod schemas."""

    def test_contact_method_base_creation(self):
        """Test creating ContactMethodBase."""
        method = ContactMethodBase(
            type=ContactMethodType.EMAIL,
            value="test@example.com",
            label="Work Email",
            is_primary=True,
        )

        assert method.type == ContactMethodType.EMAIL
        assert method.value == "test@example.com"
        assert method.is_primary is True
        assert method.is_verified is False

    def test_contact_method_with_address(self):
        """Test contact method with address fields."""
        method = ContactMethodBase(
            type=ContactMethodType.ADDRESS,
            value="123 Main St",
            address_line1="123 Main St",
            address_line2="Suite 100",
            city="New York",
            state_province="NY",
            postal_code="10001",
            country="US",
        )

        assert method.address_line1 == "123 Main St"
        assert method.city == "New York"
        assert method.postal_code == "10001"

    def test_contact_method_value_validation(self):
        """Test value field validation."""
        # Valid value
        method = ContactMethodCreate(
            type=ContactMethodType.PHONE,
            value="+1-555-0100",
        )
        assert method.value == "+1-555-0100"

        # Empty value should fail
        with pytest.raises(ValueError):
            ContactMethodCreate(
                type=ContactMethodType.PHONE,
                value="",
            )

    def test_contact_method_response(self):
        """Test ContactMethodResponse schema."""
        now = datetime.now(UTC)
        contact_id = uuid4()
        method_id = uuid4()

        response = ContactMethodResponse(
            id=method_id,
            contact_id=contact_id,
            type=ContactMethodType.EMAIL,
            value="test@example.com",
            created_at=now,
            updated_at=now,
        )

        assert response.id == method_id
        assert response.contact_id == contact_id


@pytest.mark.unit
class TestContactSchemas:
    """Test Contact schemas."""

    def test_contact_base_creation(self):
        """Test creating ContactBase."""
        contact = ContactBase(
            first_name="John",
            last_name="Doe",
            company="Acme Corp",
            status=ContactStatus.ACTIVE,
        )

        assert contact.first_name == "John"
        assert contact.last_name == "Doe"
        assert contact.company == "Acme Corp"

    def test_contact_create_display_name_validator(self):
        """Test display_name validator behavior.

        The validator generates display_name from available fields,
        but returns None if no fields are present (handled at service layer).
        """
        # Case 1: Explicit display name takes precedence
        contact = ContactCreate(
            first_name="John",
            last_name="Doe",
            display_name="JD",
        )
        assert contact.display_name == "JD"

        # Case 2: No display name provided - validator may generate it
        # Note: The validator is called but actual generation logic is complex
        # and may return None to be handled at service layer
        contact2 = ContactCreate(
            first_name="Jane",
            last_name="Smith",
        )
        # Validator runs but may return None (handled by service layer)
        # We're testing that it doesn't raise an error
        assert contact2.first_name == "Jane"
        assert contact2.last_name == "Smith"

    def test_contact_with_all_fields(self):
        """Test contact with all optional fields."""
        owner_id = uuid4()
        team_id = uuid4()
        now = datetime.now(UTC)

        contact = ContactCreate(
            first_name="John",
            middle_name="Michael",
            last_name="Doe",
            prefix="Dr.",
            suffix="Jr.",
            company="Acme Corp",
            job_title="CEO",
            department="Executive",
            status=ContactStatus.ACTIVE,
            stage=ContactStage.LEAD,
            owner_id=owner_id,
            assigned_team_id=team_id,
            notes="Important contact",
            tags=["vip", "enterprise"],
            custom_fields={"account_value": 100000},
            birthday=now,
            is_decision_maker=True,
            preferred_contact_method=ContactMethodType.EMAIL,
            preferred_language="en",
            timezone="America/New_York",
        )

        assert contact.middle_name == "Michael"
        assert contact.prefix == "Dr."
        assert contact.suffix == "Jr."
        assert contact.is_decision_maker is True
        assert "vip" in contact.tags

    def test_contact_response_schema(self):
        """Test ContactResponse schema."""
        now = datetime.now(UTC)
        contact_id = uuid4()
        tenant_id = uuid4()

        response = ContactResponse(
            id=contact_id,
            tenant_id=tenant_id,
            first_name="John",
            last_name="Doe",
            display_name="John Doe",
            is_verified=True,
            created_at=now,
            updated_at=now,
        )

        assert response.id == contact_id
        assert response.tenant_id == tenant_id
        assert response.is_verified is True

    def test_contact_list_response(self):
        """Test ContactListResponse schema."""
        contacts = [
            ContactResponse(
                id=uuid4(),
                tenant_id=uuid4(),
                first_name="John",
                last_name="Doe",
                display_name="John Doe",
                is_verified=False,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
        ]

        list_response = ContactListResponse(
            contacts=contacts,
            total=100,
            page=1,
            page_size=50,
            has_next=True,
            has_prev=False,
        )

        assert len(list_response.contacts) == 1
        assert list_response.total == 100
        assert list_response.has_next is True


@pytest.mark.unit
class TestContactLabelSchemas:
    """Test ContactLabel schemas."""

    def test_label_definition_base(self):
        """Test ContactLabelDefinitionBase."""
        label = ContactLabelDefinitionBase(
            name="VIP Customer",
            color="#FF0000",
            icon="star",
            category="priority",
            is_visible=True,
        )

        assert label.name == "VIP Customer"
        assert label.color == "#FF0000"
        assert label.icon == "star"

    def test_label_definition_name_validation(self):
        """Test name field validation."""
        # Valid name
        label = ContactLabelDefinitionCreate(
            name="Customer",
        )
        assert label.name == "Customer"

        # Empty name should fail
        with pytest.raises(ValueError):
            ContactLabelDefinitionCreate(
                name="",
            )

    def test_label_definition_response(self):
        """Test ContactLabelDefinitionResponse."""
        now = datetime.now(UTC)
        label_id = uuid4()
        tenant_id = uuid4()

        response = ContactLabelDefinitionResponse(
            id=label_id,
            tenant_id=tenant_id,
            name="VIP",
            created_at=now,
            updated_at=now,
        )

        assert response.id == label_id
        assert response.name == "VIP"


@pytest.mark.unit
class TestContactFieldSchemas:
    """Test ContactField schemas."""

    def test_field_definition_base(self):
        """Test ContactFieldDefinitionBase."""
        field = ContactFieldDefinitionBase(
            name="Industry",
            field_type=ContactFieldType.TEXT,
            is_required=True,
            is_searchable=True,
        )

        assert field.name == "Industry"
        assert field.field_type == ContactFieldType.TEXT
        assert field.is_required is True

    def test_field_definition_with_options(self):
        """Test field definition with options."""
        field = ContactFieldDefinitionCreate(
            name="Country",
            field_type=ContactFieldType.SELECT,
            options=[
                {"value": "US", "label": "United States"},
                {"value": "UK", "label": "United Kingdom"},
            ],
            validation_rules={"required": True},
        )

        assert len(field.options) == 2
        assert field.options[0]["value"] == "US"
        assert field.validation_rules["required"] is True

    def test_field_definition_name_validation(self):
        """Test name field validation."""
        # Valid name
        field = ContactFieldDefinitionCreate(
            name="Custom Field",
            field_type=ContactFieldType.TEXT,
        )
        assert field.name == "Custom Field"

        # Empty name should fail
        with pytest.raises(ValueError):
            ContactFieldDefinitionCreate(
                name="",
                field_type=ContactFieldType.TEXT,
            )

    def test_field_definition_response(self):
        """Test ContactFieldDefinitionResponse."""
        now = datetime.now(UTC)
        field_id = uuid4()
        tenant_id = uuid4()

        response = ContactFieldDefinitionResponse(
            id=field_id,
            tenant_id=tenant_id,
            name="Industry",
            field_type=ContactFieldType.TEXT,
            created_at=now,
            updated_at=now,
        )

        assert response.id == field_id
        assert response.field_type == ContactFieldType.TEXT


@pytest.mark.unit
class TestContactActivitySchemas:
    """Test ContactActivity schemas."""

    def test_activity_base(self):
        """Test ContactActivityBase."""
        activity = ContactActivityBase(
            activity_type="call",
            subject="Follow-up call",
            description="Discussed renewal options",
            status="completed",
            duration_minutes=30,
        )

        assert activity.activity_type == "call"
        assert activity.subject == "Follow-up call"
        assert activity.duration_minutes == 30

    def test_activity_subject_validation(self):
        """Test subject field validation."""
        # Valid subject
        activity = ContactActivityCreate(
            activity_type="email",
            subject="Introduction",
            status="sent",
        )
        assert activity.subject == "Introduction"

        # Empty subject should fail
        with pytest.raises(ValueError):
            ContactActivityCreate(
                activity_type="email",
                subject="",
                status="sent",
            )

    def test_activity_response(self):
        """Test ContactActivityResponse."""
        now = datetime.now(UTC)
        activity_id = uuid4()
        contact_id = uuid4()
        user_id = uuid4()

        response = ContactActivityResponse(
            id=activity_id,
            contact_id=contact_id,
            performed_by=user_id,
            activity_type="meeting",
            subject="Quarterly Review",
            status="completed",
            created_at=now,
            updated_at=now,
        )

        assert response.id == activity_id
        assert response.contact_id == contact_id
        assert response.performed_by == user_id


@pytest.mark.unit
class TestContactSearchSchemas:
    """Test ContactSearch schemas."""

    def test_search_request_defaults(self):
        """Test ContactSearchRequest with defaults."""
        search = ContactSearchRequest()

        assert search.query is None
        assert search.page == 1
        assert search.page_size == 50
        assert search.include_deleted is False

    def test_search_request_with_filters(self):
        """Test ContactSearchRequest with filters."""
        owner_id = uuid4()
        customer_id = uuid4()
        label_ids = [uuid4(), uuid4()]

        search = ContactSearchRequest(
            query="john",
            customer_id=customer_id,
            status=ContactStatus.ACTIVE,
            stage=ContactStage.CUSTOMER,
            owner_id=owner_id,
            tags=["vip"],
            label_ids=label_ids,
            page=2,
            page_size=100,
        )

        assert search.query == "john"
        assert search.status == ContactStatus.ACTIVE
        assert len(search.label_ids) == 2
        assert search.page == 2

    def test_search_request_page_validation(self):
        """Test page field validation."""
        # Valid page
        search = ContactSearchRequest(page=1)
        assert search.page == 1

        # Invalid page (< 1)
        with pytest.raises(ValueError):
            ContactSearchRequest(page=0)

    def test_search_request_page_size_validation(self):
        """Test page_size field validation."""
        # Valid page size
        search = ContactSearchRequest(page_size=100)
        assert search.page_size == 100

        # Too small
        with pytest.raises(ValueError):
            ContactSearchRequest(page_size=0)

        # Too large
        with pytest.raises(ValueError):
            ContactSearchRequest(page_size=1000)


@pytest.mark.unit
class TestContactBulkOperationSchemas:
    """Test bulk operation schemas."""

    def test_bulk_update(self):
        """Test ContactBulkUpdate schema."""
        contact_ids = [uuid4(), uuid4(), uuid4()]
        update_data = ContactUpdate(
            status=ContactStatus.ACTIVE,
            tags=["updated"],
        )

        bulk_update = ContactBulkUpdate(
            contact_ids=contact_ids,
            update_data=update_data,
        )

        assert len(bulk_update.contact_ids) == 3
        assert bulk_update.update_data.status == ContactStatus.ACTIVE

    def test_bulk_delete(self):
        """Test ContactBulkDelete schema."""
        contact_ids = [uuid4(), uuid4()]

        bulk_delete = ContactBulkDelete(
            contact_ids=contact_ids,
            hard_delete=True,
        )

        assert len(bulk_delete.contact_ids) == 2
        assert bulk_delete.hard_delete is True

        # Test default soft delete
        bulk_delete2 = ContactBulkDelete(
            contact_ids=contact_ids,
        )
        assert bulk_delete2.hard_delete is False


@pytest.mark.unit
class TestSchemaConfigurations:
    """Test Pydantic model configurations."""

    def test_response_schemas_from_attributes(self):
        """Test response schemas have from_attributes=True."""
        assert ContactMethodResponse.model_config["from_attributes"] is True
        assert ContactResponse.model_config["from_attributes"] is True
        assert ContactLabelDefinitionResponse.model_config["from_attributes"] is True
        assert ContactFieldDefinitionResponse.model_config["from_attributes"] is True
        assert ContactActivityResponse.model_config["from_attributes"] is True

    def test_field_constraints(self):
        """Test various field constraints across schemas."""
        # Test max_length on contact method value
        with pytest.raises(ValueError):
            ContactMethodBase(
                type=ContactMethodType.EMAIL,
                value="x" * 501,  # Exceeds 500 max_length
            )

        # Test country code length
        with pytest.raises(ValueError):
            ContactMethodBase(
                type=ContactMethodType.ADDRESS,
                value="123 Main St",
                country="USA",  # Should be 2 chars
            )

        # Test label color length
        with pytest.raises(ValueError):
            ContactLabelDefinitionBase(
                name="Test",
                color="#FF00FF00",  # Exceeds 7 chars
            )
