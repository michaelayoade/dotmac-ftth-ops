"""
Shared fixtures for contact service tests.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.contacts.models import (
    Contact,
    ContactActivity,
    ContactFieldDefinition,
    ContactFieldType,
    ContactLabelDefinition,
    ContactMethod,
    ContactMethodType,
    ContactStage,
    ContactStatus,
)


@pytest.fixture
def mock_db_session():
    """Create a mock AsyncSession."""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()
    session.delete = AsyncMock()
    session.execute = AsyncMock()
    session.scalar = AsyncMock()
    return session


@pytest.fixture
def tenant_id():
    """Fixture for tenant ID."""
    return uuid4()


@pytest.fixture
def user_id():
    """Fixture for user ID."""
    return uuid4()


@pytest.fixture
def customer_id():
    """Fixture for customer ID."""
    return uuid4()


@pytest.fixture
def sample_contact(tenant_id, customer_id, user_id):
    """Create a sample contact entity."""
    contact = Mock(spec=Contact)
    contact.id = uuid4()
    contact.tenant_id = tenant_id
    contact.customer_id = customer_id
    contact.first_name = "John"
    contact.middle_name = "Q"
    contact.last_name = "Doe"
    contact.display_name = "John Q Doe"
    contact.prefix = "Mr"
    contact.suffix = "Jr"
    contact.company = "ACME Corp"
    contact.job_title = "CEO"
    contact.department = "Executive"
    contact.status = ContactStatus.ACTIVE
    contact.stage = ContactStage.CUSTOMER
    contact.owner_id = user_id
    contact.assigned_team_id = None
    contact.notes = "Important client"
    contact.tags = ["vip", "enterprise"]
    contact.custom_fields = {"account_value": 100000}
    contact.metadata_ = {"source": "web"}
    contact.birthday = None
    contact.anniversary = None
    contact.is_primary = True
    contact.is_decision_maker = True
    contact.is_billing_contact = True
    contact.is_technical_contact = False
    contact.is_verified = True
    contact.preferred_contact_method = ContactMethodType.EMAIL
    contact.preferred_language = "en"
    contact.timezone = "America/New_York"
    contact.created_at = datetime.now(UTC)
    contact.updated_at = datetime.now(UTC)
    contact.last_contacted_at = None
    contact.deleted_at = None
    contact.deleted_by = None
    contact.contact_methods = []
    contact.labels = []
    return contact


@pytest.fixture
def sample_contact_method(sample_contact):
    """Create a sample contact method entity."""
    method = Mock(spec=ContactMethod)
    method.id = uuid4()
    method.contact_id = sample_contact.id
    method.type = ContactMethodType.EMAIL
    method.value = "john@acme.com"
    method.label = "Work"
    method.is_primary = True
    method.is_verified = True
    method.is_public = True
    method.display_order = 0
    method.metadata_ = {}
    method.created_at = datetime.now(UTC)
    method.updated_at = datetime.now(UTC)
    method.address_line1 = None
    method.address_line2 = None
    method.city = None
    method.state_province = None
    method.postal_code = None
    method.country = None
    return method


@pytest.fixture
def sample_label_definition(tenant_id, user_id):
    """Create a sample label definition entity."""
    label = Mock(spec=ContactLabelDefinition)
    label.id = uuid4()
    label.tenant_id = tenant_id
    label.name = "VIP Customer"
    label.slug = "vip-customer"
    label.description = "High-value customer"
    label.color = "#FF5733"
    label.icon = "star"
    label.category = "tier"
    label.display_order = 0
    label.is_visible = True
    label.is_system = False
    label.is_default = False
    label.metadata_ = {}
    label.created_at = datetime.now(UTC)
    label.updated_at = datetime.now(UTC)
    label.created_by = user_id
    return label


@pytest.fixture
def sample_field_definition(tenant_id, user_id):
    """Create a sample field definition entity."""
    field = Mock(spec=ContactFieldDefinition)
    field.id = uuid4()
    field.tenant_id = tenant_id
    field.name = "Account Value"
    field.field_key = "account_value"
    field.description = "Total account value"
    field.field_type = ContactFieldType.CURRENCY
    field.is_required = False
    field.is_unique = False
    field.is_searchable = True
    field.default_value = 0
    field.validation_rules = {"min": 0}
    field.options = None
    field.display_order = 0
    field.placeholder = "Enter amount"
    field.help_text = "Total value in USD"
    field.field_group = "financial"
    field.is_visible = True
    field.is_editable = True
    field.required_permission = None
    field.is_system = False
    field.is_encrypted = False
    field.metadata_ = {}
    field.created_at = datetime.now(UTC)
    field.updated_at = datetime.now(UTC)
    field.created_by = user_id
    return field


@pytest.fixture
def sample_activity(sample_contact, user_id):
    """Create a sample contact activity entity."""
    activity = Mock(spec=ContactActivity)
    activity.id = uuid4()
    activity.contact_id = sample_contact.id
    activity.activity_type = "call"
    activity.subject = "Follow-up call"
    activity.description = "Discussed quarterly review"
    activity.activity_date = datetime.now(UTC)
    activity.duration_minutes = 30
    activity.status = "completed"
    activity.outcome = "positive"
    activity.performed_by = user_id
    activity.metadata_ = {}
    activity.created_at = datetime.now(UTC)
    activity.updated_at = datetime.now(UTC)
    return activity
