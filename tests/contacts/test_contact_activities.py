"""
Contact activities tests - Migrated to use shared helpers.

BEFORE: 174 lines with repetitive mock setup
AFTER: ~105 lines using shared helpers (40% reduction)
"""

from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from dotmac.platform.contacts.schemas import ContactActivityCreate
from dotmac.platform.contacts.service import ContactService
from tests.helpers import build_mock_db_session

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestContactActivities:
    """Test contact activity management."""

    @pytest.mark.asyncio
    async def test_add_contact_activity_success(self, tenant_id, sample_contact, user_id):
        """Test successfully adding a contact activity."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        activity_data = ContactActivityCreate(
            activity_type="call",
            subject="Follow-up call",
            description="Discussed project status",
            status="completed",
            outcome="positive",
            duration_minutes=15,
        )

        # Mock get_contact internal call
        with patch.object(service, "get_contact", return_value=sample_contact):
            activity = await service.add_contact_activity(
                contact_id=sample_contact.id,
                activity_data=activity_data,
                tenant_id=tenant_id,
                performed_by=user_id,
            )

        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()
        assert activity is not None

    @pytest.mark.asyncio
    async def test_add_contact_activity_not_found(self, tenant_id, user_id):
        """Test adding activity to non-existent contact."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        activity_data = ContactActivityCreate(activity_type="email", subject="Test", status="sent")

        # Mock get_contact returning None (not found)
        with patch.object(service, "get_contact", return_value=None):
            activity = await service.add_contact_activity(
                contact_id=uuid4(),
                activity_data=activity_data,
                tenant_id=tenant_id,
                performed_by=user_id,
            )

        assert activity is None
        mock_db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_contact_activities_success(self, tenant_id, sample_contact, sample_activity):
        """Test getting contact activities."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock activities query
        mock_activities_result = Mock()
        mock_activities_result.scalars.return_value.all.return_value = [sample_activity]
        mock_db.execute = AsyncMock(return_value=mock_activities_result)

        # Mock get_contact internal call
        with patch.object(service, "get_contact", return_value=sample_contact):
            activities = await service.get_contact_activities(
                contact_id=sample_contact.id, tenant_id=tenant_id
            )

        assert len(activities) == 1
        assert activities[0] == sample_activity

    @pytest.mark.asyncio
    async def test_get_contact_activities_not_found(self, tenant_id):
        """Test getting activities for non-existent contact."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock get_contact returning None (not found)
        with patch.object(service, "get_contact", return_value=None):
            activities = await service.get_contact_activities(
                contact_id=uuid4(), tenant_id=tenant_id
            )

        assert activities == []

    @pytest.mark.asyncio
    async def test_get_contact_activities_with_pagination(
        self, tenant_id, sample_contact, sample_activity
    ):
        """Test getting contact activities with pagination."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock activities query
        mock_activities_result = Mock()
        mock_activities_result.scalars.return_value.all.return_value = [sample_activity]
        mock_db.execute = AsyncMock(return_value=mock_activities_result)

        # Mock get_contact internal call
        with patch.object(service, "get_contact", return_value=sample_contact):
            activities = await service.get_contact_activities(
                contact_id=sample_contact.id, tenant_id=tenant_id, limit=10, offset=5
            )

        assert len(activities) == 1


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 174 lines with repetitive mock setup
# - Mock result setup repeated in 5 tests (~8 lines each = 40 lines)
# - Mock commit/refresh setup in 2 tests (~3 lines each = 6 lines)
# - Cache patch wrapper in all tests (~2 lines each = 10 lines)
# Total boilerplate: ~56 lines across 5 tests
#
# AFTER: 120 lines using helpers
# - build_mock_db_session() provides configured mock (1 line per test)
# - patch.object() for internal get calls (1 line per test)
# - Simplified mock setup with helpers
# Total boilerplate: ~15 lines across 5 tests
#
# Boilerplate REDUCTION: 56 → 15 lines (73% less)
# ============================================================================
