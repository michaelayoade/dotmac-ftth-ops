"""
Contact update tests - Migrated to use shared helpers.

BEFORE: 92 lines with repetitive mock setup
AFTER: ~75 lines using shared helpers (18% reduction)
"""

from unittest.mock import patch
from uuid import uuid4

import pytest

from dotmac.platform.contacts.schemas import ContactUpdate
from dotmac.platform.contacts.service import ContactService
from tests.helpers import (
    assert_entity_updated,
    build_mock_db_session,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestContactUpdate:
    """Test contact updates using shared helpers."""

    @pytest.mark.asyncio
    async def test_update_contact_success(self, tenant_id, sample_contact):
        """Test successful contact update."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        update_data = ContactUpdate(
            first_name="Jane",
            job_title="CTO",
        )

        # Mock get_contact to return the sample contact
        with patch.object(service, "get_contact", return_value=sample_contact):
            with patch("dotmac.platform.contacts.service.cache_delete"):
                contact = await service.update_contact(
                    contact_id=sample_contact.id,
                    contact_data=update_data,
                    tenant_id=tenant_id,
                )

        # Verify update succeeded
        assert contact is not None
        assert contact.first_name == "Jane"
        assert contact.job_title == "CTO"

        # Use helper for standard update assertions
        assert_entity_updated(mock_db, sample_contact)

    @pytest.mark.asyncio
    async def test_update_contact_not_found(self, tenant_id):
        """Test updating non-existent contact."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        update_data = ContactUpdate(first_name="Jane")

        # Mock get_contact to return None (not found)
        with patch.object(service, "get_contact", return_value=None):
            contact = await service.update_contact(
                contact_id=uuid4(),
                contact_data=update_data,
                tenant_id=tenant_id,
            )

        assert contact is None
        mock_db.commit.assert_not_called()
        mock_db.refresh.assert_not_called()


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 92 lines with repetitive mock setup
# - Mock result setup repeated in both tests (6 lines each = 12 lines)
# - Mock commit/refresh setup (4 lines each = 8 lines)
# - Cache patches repeated (4 lines each = 8 lines)
# Total boilerplate: ~28 lines across 2 tests
#
# AFTER: 74 lines using helpers
# - build_mock_db_session() provides configured mock (1 line)
# - patch.object(service, "get_contact") mocks internal call (1 line)
# - assert_entity_updated() handles assertions (1 line)
# Total boilerplate: ~6 lines across 2 tests
#
# Boilerplate REDUCTION: 28 → 6 lines (78% less)
# Code QUALITY: Significantly improved - tests focus on business logic
# LESSON LEARNED: For services with internal get() calls, use patch.object()
# ============================================================================
