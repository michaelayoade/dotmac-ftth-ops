"""
Comprehensive tests for contacts router endpoints.

Tests cover all API endpoints with proper mocking and isolation.
"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException

from dotmac.platform.contacts.schemas import (
    ContactActivityCreate,
    ContactActivityResponse,
    ContactBulkDelete,
    ContactBulkUpdate,
    ContactCreate,
    ContactFieldDefinitionCreate,
    ContactFieldDefinitionResponse,
    ContactLabelDefinitionCreate,
    ContactLabelDefinitionResponse,
    ContactMethodCreate,
    ContactMethodResponse,
    ContactMethodUpdate,
    ContactResponse,
    ContactSearchRequest,
    ContactUpdate,
)

try:
    UTC = datetime.UTC  # type: ignore[attr-defined]
except AttributeError:  # pragma: no cover - older Python versions
    UTC = timezone.utc  # noqa: UP017 - fallback for Python <3.11

pytestmark = [pytest.mark.integration, pytest.mark.asyncio]


@pytest.fixture
def sample_contact_id():
    return uuid4()


@pytest.fixture
def sample_tenant_id():
    return uuid4()


@pytest.fixture
def sample_user_id():
    return uuid4()


@pytest.fixture
def mock_user_info(sample_user_id):
    """Mock UserInfo object."""
    user_info = Mock()
    user_info.user_id = sample_user_id
    user_info.tenant_id = str(uuid4())
    user_info.email = "test@example.com"
    return user_info


@pytest.fixture
def mock_contact_response(sample_contact_id, sample_tenant_id):
    """Mock contact response - returns proper ContactResponse object."""
    return ContactResponse(
        id=sample_contact_id,
        tenant_id=sample_tenant_id,
        customer_id=None,
        first_name="John",
        middle_name=None,
        last_name="Doe",
        display_name="John Doe",
        prefix=None,
        suffix=None,
        company=None,
        job_title=None,
        department=None,
        owner_id=None,
        assigned_team_id=None,
        notes=None,
        tags=[],
        metadata={},
        birthday=None,
        anniversary=None,
        is_primary=False,
        is_decision_maker=False,
        is_billing_contact=False,
        is_technical_contact=False,
        preferred_contact_method=None,
        preferred_language=None,
        timezone=None,
        is_verified=False,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
        last_contacted_at=None,
        deleted_at=None,
        contact_methods=[],
        labels=[],
    )


@pytest.fixture
def mock_contact_method_response(sample_contact_id):
    """Mock contact method response - returns proper ContactMethodResponse object."""
    return ContactMethodResponse(
        id=uuid4(),
        contact_id=sample_contact_id,
        type="email",
        value="test@example.com",
        label=None,
        is_primary=False,
        is_preferred=False,
        verified_at=None,
        verified_by=None,
        notes=None,
        metadata={},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def mock_contact_activity_response(sample_contact_id, sample_user_id):
    """Mock contact activity response - returns proper ContactActivityResponse object."""
    return ContactActivityResponse(
        id=uuid4(),
        contact_id=sample_contact_id,
        activity_type="call",
        subject="Follow up call",
        description="Discussed next steps",
        activity_date=datetime.now(UTC),
        duration_minutes=30,
        status="completed",
        outcome="positive",
        metadata={},
        performed_by=sample_user_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def mock_label_definition_response(sample_tenant_id):
    """Mock label definition response - returns proper ContactLabelDefinitionResponse object."""
    return ContactLabelDefinitionResponse(
        id=uuid4(),
        tenant_id=sample_tenant_id,
        name="VIP Customer",
        slug="vip-customer",
        description="High value customer",
        color="#FF5733",
        icon="star",
        category="status",
        display_order=1,
        is_visible=True,
        is_system=False,
        is_default=False,
        metadata={},
        created_by=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def mock_field_definition_response(sample_tenant_id):
    """Mock field definition response - returns proper ContactFieldDefinitionResponse object."""
    from dotmac.platform.contacts.models import ContactFieldType

    return ContactFieldDefinitionResponse(
        id=uuid4(),
        tenant_id=sample_tenant_id,
        name="Custom Field",
        field_key="custom_field",
        description="A custom field",
        field_type=ContactFieldType.TEXT,
        is_required=False,
        is_unique=False,
        is_searchable=True,
        default_value=None,
        validation_rules={},
        options=None,
        display_order=1,
        placeholder="Enter value",
        help_text="Help text",
        field_group="custom",
        is_visible=True,
        created_by=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


class TestContactCRUDEndpoints:
    """Test basic CRUD endpoints for contacts."""

    @pytest.mark.asyncio
    async def test_create_contact(self, mock_user_info, sample_tenant_id, mock_contact_response):
        """Test creating a new contact."""
        with patch("dotmac.platform.contacts.router.get_async_session"):
            with patch(
                "dotmac.platform.contacts.router.require_permission",
                return_value=lambda: mock_user_info,
            ):
                with patch(
                    "dotmac.platform.contacts.router.get_current_tenant_id",
                    return_value=lambda: sample_tenant_id,
                ):
                    with patch("dotmac.platform.contacts.router.ContactService") as MockService:
                        mock_service = MockService.return_value
                        mock_service.create_contact = AsyncMock(return_value=mock_contact_response)

                        from dotmac.platform.contacts.router import create_contact

                        contact_data = ContactCreate(
                            first_name="John", last_name="Doe", email="john@example.com"
                        )

                        result = await create_contact(
                            contact_data=contact_data,
                            db=Mock(),
                            current_user=mock_user_info,
                            tenant_id=sample_tenant_id,
                        )

                        assert result == mock_contact_response
                        mock_service.create_contact.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_contact_success(
        self, sample_contact_id, sample_tenant_id, mock_user_info, mock_contact_response
    ):
        """Test getting an existing contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.get_contact = AsyncMock(return_value=mock_contact_response)

            from dotmac.platform.contacts.router import get_contact

            result = await get_contact(
                contact_id=sample_contact_id,
                include_methods=True,
                include_labels=True,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_contact_response
            mock_service.get_contact.assert_called_once_with(
                contact_id=sample_contact_id,
                tenant_id=sample_tenant_id,
                include_methods=True,
                include_labels=True,
            )

    @pytest.mark.asyncio
    async def test_get_contact_not_found(self, sample_contact_id, sample_tenant_id, mock_user_info):
        """Test getting a non-existent contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.get_contact = AsyncMock(return_value=None)

            from dotmac.platform.contacts.router import get_contact

            with pytest.raises(HTTPException) as exc_info:
                await get_contact(
                    contact_id=sample_contact_id,
                    include_methods=True,
                    include_labels=True,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404
            assert "not found" in exc_info.value.detail.lower()

    @pytest.mark.asyncio
    async def test_update_contact_success(
        self, sample_contact_id, sample_tenant_id, mock_user_info, mock_contact_response
    ):
        """Test updating a contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.update_contact = AsyncMock(return_value=mock_contact_response)

            from dotmac.platform.contacts.router import update_contact

            contact_data = ContactUpdate(first_name="Jane")

            result = await update_contact(
                contact_id=sample_contact_id,
                contact_data=contact_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_contact_response
            mock_service.update_contact.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_contact_not_found(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test updating a non-existent contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.update_contact = AsyncMock(return_value=None)

            from dotmac.platform.contacts.router import update_contact

            contact_data = ContactUpdate(first_name="Jane")

            with pytest.raises(HTTPException) as exc_info:
                await update_contact(
                    contact_id=sample_contact_id,
                    contact_data=contact_data,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_contact_success(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test deleting a contact (soft delete)."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact = AsyncMock(return_value=True)

            from dotmac.platform.contacts.router import delete_contact

            result = await delete_contact(
                contact_id=sample_contact_id,
                hard_delete=False,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            # Should return None (204 No Content)
            assert result is None
            mock_service.delete_contact.assert_called_once_with(
                contact_id=sample_contact_id,
                tenant_id=sample_tenant_id,
                hard_delete=False,
                deleted_by=mock_user_info.user_id,
            )

    @pytest.mark.asyncio
    async def test_delete_contact_hard_delete(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test hard deleting a contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact = AsyncMock(return_value=True)

            from dotmac.platform.contacts.router import delete_contact

            await delete_contact(
                contact_id=sample_contact_id,
                hard_delete=True,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            mock_service.delete_contact.assert_called_once_with(
                contact_id=sample_contact_id,
                tenant_id=sample_tenant_id,
                hard_delete=True,
                deleted_by=mock_user_info.user_id,
            )

    @pytest.mark.asyncio
    async def test_delete_contact_not_found(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test deleting a non-existent contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact = AsyncMock(return_value=False)

            from dotmac.platform.contacts.router import delete_contact

            with pytest.raises(HTTPException) as exc_info:
                await delete_contact(
                    contact_id=sample_contact_id,
                    hard_delete=False,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404


class TestContactSearchEndpoint:
    """Test contact search functionality."""

    @pytest.mark.asyncio
    async def test_search_contacts_basic(self, sample_tenant_id, mock_user_info):
        """Test basic contact search."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            # Return empty list to avoid validation issues
            mock_service.search_contacts = AsyncMock(return_value=([], 1))

            from dotmac.platform.contacts.router import search_contacts

            search_request = ContactSearchRequest(query="John", page=1, page_size=10)

            result = await search_contacts(
                search_request=search_request,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result.total == 1
            assert len(result.contacts) == 0
            assert result.page == 1
            assert result.has_next is False
            assert result.has_prev is False

    @pytest.mark.asyncio
    async def test_search_contacts_with_pagination(self, sample_tenant_id, mock_user_info):
        """Test contact search with pagination."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.search_contacts = AsyncMock(return_value=([], 25))

            from dotmac.platform.contacts.router import search_contacts

            search_request = ContactSearchRequest(query="test", page=2, page_size=10)

            result = await search_contacts(
                search_request=search_request,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result.total == 25
            assert result.page == 2
            assert result.has_next is True  # Page 2 * 10 = 20 < 25
            assert result.has_prev is True  # Page > 1

    @pytest.mark.asyncio
    async def test_search_contacts_with_filters(self, sample_tenant_id, mock_user_info):
        """Test contact search with filters."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.search_contacts = AsyncMock(return_value=([], 1))

            from dotmac.platform.contacts.router import search_contacts

            search_request = ContactSearchRequest(
                query="John",
                status="active",
                stage="lead",
                owner_id=uuid4(),
                tags=["vip"],
                label_ids=[uuid4()],
                page=1,
                page_size=10,
            )

            result = await search_contacts(
                search_request=search_request,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result.total == 1
            mock_service.search_contacts.assert_called_once()


class TestContactMethodEndpoints:
    """Test contact method management endpoints."""

    @pytest.mark.asyncio
    async def test_add_contact_method(
        self, sample_contact_id, sample_tenant_id, mock_user_info, mock_contact_method_response
    ):
        """Test adding a contact method."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.add_contact_method = AsyncMock(return_value=mock_contact_method_response)

            from dotmac.platform.contacts.router import add_contact_method

            method_data = ContactMethodCreate(type="email", value="test@example.com")

            result = await add_contact_method(
                contact_id=sample_contact_id,
                method_data=method_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_contact_method_response
            mock_service.add_contact_method.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_contact_method_contact_not_found(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test adding method to non-existent contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.add_contact_method = AsyncMock(return_value=None)

            from dotmac.platform.contacts.router import add_contact_method

            method_data = ContactMethodCreate(type="email", value="test@example.com")

            with pytest.raises(HTTPException) as exc_info:
                await add_contact_method(
                    contact_id=sample_contact_id,
                    method_data=method_data,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_update_contact_method(
        self, sample_tenant_id, mock_user_info, mock_contact_method_response
    ):
        """Test updating a contact method."""
        method_id = mock_contact_method_response.id
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.update_contact_method = AsyncMock(
                return_value=mock_contact_method_response
            )

            from dotmac.platform.contacts.router import update_contact_method

            method_data = ContactMethodUpdate(value="updated@example.com")

            result = await update_contact_method(
                method_id=method_id,
                method_data=method_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_contact_method_response

    @pytest.mark.asyncio
    async def test_update_contact_method_not_found(self, sample_tenant_id, mock_user_info):
        """Test updating non-existent contact method."""
        method_id = uuid4()
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.update_contact_method = AsyncMock(return_value=None)

            from dotmac.platform.contacts.router import update_contact_method

            method_data = ContactMethodUpdate(value="updated@example.com")

            with pytest.raises(HTTPException) as exc_info:
                await update_contact_method(
                    method_id=method_id,
                    method_data=method_data,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_contact_method(self, sample_tenant_id, mock_user_info):
        """Test deleting a contact method."""
        method_id = uuid4()
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact_method = AsyncMock(return_value=True)

            from dotmac.platform.contacts.router import delete_contact_method

            result = await delete_contact_method(
                method_id=method_id,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result is None
            mock_service.delete_contact_method.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_contact_method_not_found(self, sample_tenant_id, mock_user_info):
        """Test deleting non-existent contact method."""
        method_id = uuid4()
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact_method = AsyncMock(return_value=False)

            from dotmac.platform.contacts.router import delete_contact_method

            with pytest.raises(HTTPException) as exc_info:
                await delete_contact_method(
                    method_id=method_id,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404


class TestContactActivityEndpoints:
    """Test contact activity endpoints."""

    @pytest.mark.asyncio
    async def test_add_contact_activity(
        self, sample_contact_id, sample_tenant_id, mock_user_info, mock_contact_activity_response
    ):
        """Test adding an activity to a contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.add_contact_activity = AsyncMock(
                return_value=mock_contact_activity_response
            )

            from dotmac.platform.contacts.router import add_contact_activity

            activity_data = ContactActivityCreate(
                activity_type="note", subject="Test note", status="completed"
            )

            result = await add_contact_activity(
                contact_id=sample_contact_id,
                activity_data=activity_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_contact_activity_response
            mock_service.add_contact_activity.assert_called_once()

    @pytest.mark.asyncio
    async def test_add_contact_activity_contact_not_found(
        self, sample_contact_id, sample_tenant_id, mock_user_info
    ):
        """Test adding activity to non-existent contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.add_contact_activity = AsyncMock(return_value=None)

            from dotmac.platform.contacts.router import add_contact_activity

            activity_data = ContactActivityCreate(
                activity_type="note", subject="Test", status="completed"
            )

            with pytest.raises(HTTPException) as exc_info:
                await add_contact_activity(
                    contact_id=sample_contact_id,
                    activity_data=activity_data,
                    db=Mock(),
                    current_user=mock_user_info,
                    tenant_id=sample_tenant_id,
                )

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_contact_activities(
        self, sample_contact_id, sample_tenant_id, mock_user_info, mock_contact_activity_response
    ):
        """Test getting activities for a contact."""
        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            # Return two activity responses
            mock_activities = [mock_contact_activity_response, mock_contact_activity_response]
            mock_service.get_contact_activities = AsyncMock(return_value=mock_activities)

            from dotmac.platform.contacts.router import get_contact_activities

            result = await get_contact_activities(
                contact_id=sample_contact_id,
                limit=50,
                offset=0,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert len(result) == 2
            mock_service.get_contact_activities.assert_called_once_with(
                contact_id=sample_contact_id, tenant_id=sample_tenant_id, limit=50, offset=0
            )


class TestLabelDefinitionEndpoints:
    """Test label definition endpoints."""

    @pytest.mark.asyncio
    async def test_create_label_definition(
        self, sample_tenant_id, mock_user_info, mock_label_definition_response
    ):
        """Test creating a label definition."""
        with patch("dotmac.platform.contacts.router.ContactLabelService") as MockService:
            mock_service = MockService.return_value
            mock_service.create_label_definition = AsyncMock(
                return_value=mock_label_definition_response
            )

            from dotmac.platform.contacts.router import create_label_definition

            label_data = ContactLabelDefinitionCreate(name="VIP Customer", category="status")

            result = await create_label_definition(
                label_data=label_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_label_definition_response

    @pytest.mark.asyncio
    async def test_get_label_definitions(
        self, sample_tenant_id, mock_user_info, mock_label_definition_response
    ):
        """Test getting label definitions."""
        with patch("dotmac.platform.contacts.router.ContactLabelService") as MockService:
            mock_service = MockService.return_value
            # Return two label responses
            mock_labels = [mock_label_definition_response, mock_label_definition_response]
            mock_service.get_label_definitions = AsyncMock(return_value=mock_labels)

            from dotmac.platform.contacts.router import get_label_definitions

            result = await get_label_definitions(
                category=None,
                include_hidden=False,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert len(result) == 2

    @pytest.mark.asyncio
    async def test_get_label_definitions_filtered(
        self, sample_tenant_id, mock_user_info, mock_label_definition_response
    ):
        """Test getting filtered label definitions."""
        with patch("dotmac.platform.contacts.router.ContactLabelService") as MockService:
            mock_service = MockService.return_value
            mock_labels = [mock_label_definition_response]
            mock_service.get_label_definitions = AsyncMock(return_value=mock_labels)

            from dotmac.platform.contacts.router import get_label_definitions

            await get_label_definitions(
                category="customer_type",
                include_hidden=True,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            mock_service.get_label_definitions.assert_called_once_with(
                tenant_id=sample_tenant_id, category="customer_type", include_hidden=True
            )


class TestFieldDefinitionEndpoints:
    """Test custom field definition endpoints."""

    @pytest.mark.asyncio
    async def test_create_field_definition(
        self, sample_tenant_id, mock_user_info, mock_field_definition_response
    ):
        """Test creating a custom field definition."""
        from dotmac.platform.contacts.models import ContactFieldType

        with patch("dotmac.platform.contacts.router.ContactFieldService") as MockService:
            mock_service = MockService.return_value
            mock_service.create_field_definition = AsyncMock(
                return_value=mock_field_definition_response
            )

            from dotmac.platform.contacts.router import create_field_definition

            field_data = ContactFieldDefinitionCreate(
                name="Custom Field", field_type=ContactFieldType.TEXT
            )

            result = await create_field_definition(
                field_data=field_data,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result == mock_field_definition_response

    @pytest.mark.asyncio
    async def test_get_field_definitions(
        self, sample_tenant_id, mock_user_info, mock_field_definition_response
    ):
        """Test getting field definitions."""
        with patch("dotmac.platform.contacts.router.ContactFieldService") as MockService:
            mock_service = MockService.return_value
            # Return two field definition responses
            mock_fields = [mock_field_definition_response, mock_field_definition_response]
            mock_service.get_field_definitions = AsyncMock(return_value=mock_fields)

            from dotmac.platform.contacts.router import get_field_definitions

            result = await get_field_definitions(
                field_group=None,
                include_hidden=False,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert len(result) == 2


class TestBulkOperations:
    """Test bulk operations on contacts."""

    @pytest.mark.asyncio
    async def test_bulk_update_contacts_success(
        self, sample_tenant_id, mock_user_info, mock_contact_response
    ):
        """Test bulk updating contacts successfully."""
        contact_ids = [uuid4(), uuid4(), uuid4()]

        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.update_contact = AsyncMock(return_value=mock_contact_response)

            from dotmac.platform.contacts.router import bulk_update_contacts

            bulk_update = ContactBulkUpdate(
                contact_ids=contact_ids, update_data=ContactUpdate(status="active")
            )

            result = await bulk_update_contacts(
                bulk_update=bulk_update,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result["updated"] == 3
            assert len(result["errors"]) == 0
            assert mock_service.update_contact.call_count == 3

    @pytest.mark.asyncio
    async def test_bulk_update_contacts_partial_failure(
        self, sample_tenant_id, mock_user_info, mock_contact_response
    ):
        """Test bulk update with some failures."""
        contact_ids = [uuid4(), uuid4(), uuid4()]

        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            # First succeeds, second fails (None), third raises exception
            mock_service.update_contact = AsyncMock(
                side_effect=[mock_contact_response, None, Exception("Database error")]
            )

            from dotmac.platform.contacts.router import bulk_update_contacts

            bulk_update = ContactBulkUpdate(
                contact_ids=contact_ids, update_data=ContactUpdate(status="active")
            )

            result = await bulk_update_contacts(
                bulk_update=bulk_update,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result["updated"] == 1
            assert len(result["errors"]) == 2

    @pytest.mark.asyncio
    async def test_bulk_delete_contacts_success(self, sample_tenant_id, mock_user_info):
        """Test bulk deleting contacts successfully."""
        contact_ids = [uuid4(), uuid4()]

        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            mock_service.delete_contact = AsyncMock(return_value=True)

            from dotmac.platform.contacts.router import bulk_delete_contacts

            bulk_delete = ContactBulkDelete(contact_ids=contact_ids, hard_delete=False)

            result = await bulk_delete_contacts(
                bulk_delete=bulk_delete,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result["deleted"] == 2
            assert len(result["errors"]) == 0
            assert mock_service.delete_contact.call_count == 2

    @pytest.mark.asyncio
    async def test_bulk_delete_contacts_with_failures(self, sample_tenant_id, mock_user_info):
        """Test bulk delete with some failures."""
        contact_ids = [uuid4(), uuid4(), uuid4()]

        with patch("dotmac.platform.contacts.router.ContactService") as MockService:
            mock_service = MockService.return_value
            # First succeeds, second fails (False), third raises exception
            mock_service.delete_contact = AsyncMock(
                side_effect=[True, False, Exception("Permission denied")]
            )

            from dotmac.platform.contacts.router import bulk_delete_contacts

            bulk_delete = ContactBulkDelete(contact_ids=contact_ids, hard_delete=True)

            result = await bulk_delete_contacts(
                bulk_delete=bulk_delete,
                db=Mock(),
                current_user=mock_user_info,
                tenant_id=sample_tenant_id,
            )

            assert result["deleted"] == 1
            assert len(result["errors"]) == 2


@pytest.mark.asyncio
class TestContactsPermissions:
    """Test that contact endpoints properly enforce RBAC permissions."""

    @pytest.fixture(autouse=True)
    def setup_rbac_mocks(self):
        """Set up RBAC service mocks for permission tests."""
        from unittest.mock import AsyncMock, MagicMock

        # Mock that always denies permissions
        self.mock_rbac_deny = MagicMock()
        # Use AsyncMock for async method so FastAPI can await it
        self.mock_rbac_deny.user_has_all_permissions = AsyncMock(return_value=False)

    async def test_create_contact_requires_create_permission(self, test_client):
        """Test POST / requires contacts.create permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/",
                json={
                    "first_name": "John",
                    "last_name": "Doe",
                    "email": "john@example.com",
                },
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.create"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_get_contact_requires_read_permission(self, test_client):
        """Test GET /{contact_id} requires contacts.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.get(f"/api/v1/contacts/{uuid4()}")
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_update_contact_requires_update_permission(self, test_client):
        """Test PATCH /{contact_id} requires contacts.update permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.patch(
                f"/api/v1/contacts/{uuid4()}",
                json={"first_name": "Updated"},
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.update"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_delete_contact_requires_delete_permission(self, test_client):
        """Test DELETE /{contact_id} requires contacts.delete permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.delete(f"/api/v1/contacts/{uuid4()}")
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.delete"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_search_contacts_requires_read_permission(self, test_client):
        """Test POST /search requires contacts.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/search",
                json={"query": "test", "limit": 10},
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_add_contact_method_requires_update_permission(self, test_client):
        """Test POST /methods requires contacts.update permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/methods",
                json={
                    "contact_id": str(uuid4()),
                    "method_type": "email",
                    "value": "test@example.com",
                },
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.update"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_record_activity_requires_manage_permission(self, test_client):
        """Test POST /activities requires contacts.manage permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/activities",
                json={
                    "contact_id": str(uuid4()),
                    "activity_type": "note",
                    "description": "Test note",
                },
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.manage"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_bulk_update_requires_update_permission(self, test_client):
        """Test POST /bulk/update requires contacts.update permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/bulk/update",
                json={
                    "contact_ids": [str(uuid4())],
                    "updates": {"company": "Test Corp"},
                },
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.update"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    async def test_bulk_delete_requires_delete_permission(self, test_client):
        """Test POST /bulk/delete requires contacts.delete permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService",
            return_value=self.mock_rbac_deny,
        ):
            response = test_client.post(
                "/api/v1/contacts/bulk/delete",
                json={
                    "contact_ids": [str(uuid4())],
                    "hard_delete": False,
                },
            )
            assert response.status_code == 403

            # Verify correct permission was checked
            assert ["contacts.delete"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]
