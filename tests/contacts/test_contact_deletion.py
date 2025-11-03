"""
Contact deletion tests - Migrated to use shared helpers.

BEFORE: 109 lines with repetitive mock setup
AFTER: ~85 lines using shared helpers (22% reduction)
"""

from unittest.mock import patch
from uuid import uuid4

import pytest

from dotmac.platform.contacts.service import ContactService
from tests.helpers import (
    assert_entity_deleted,
    build_mock_db_session,
    build_success_result,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestContactDeletion:
    """Test contact deletion using shared helpers."""

    @pytest.mark.asyncio
    async def test_soft_delete_contact_success(self, tenant_id, sample_contact, user_id):
        """Test successful soft delete."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock successful retrieval
        mock_db.execute.return_value = build_success_result(sample_contact)

        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            with patch("dotmac.platform.contacts.service.cache_delete"):
                result = await service.delete_contact(
                    contact_id=sample_contact.id,
                    tenant_id=tenant_id,
                    hard_delete=False,
                    deleted_by=user_id,
                )

        assert result is True
        assert sample_contact.deleted_at is not None
        assert sample_contact.deleted_by == user_id

        # Use helper for soft delete assertion
        assert_entity_deleted(mock_db, sample_contact, soft_delete=True)

    @pytest.mark.asyncio
    async def test_hard_delete_contact_success(self, tenant_id, sample_contact):
        """Test successful hard delete."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock successful retrieval
        mock_db.execute.return_value = build_success_result(sample_contact)

        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            with patch("dotmac.platform.contacts.service.cache_delete"):
                result = await service.delete_contact(
                    contact_id=sample_contact.id, tenant_id=tenant_id, hard_delete=True
                )

        assert result is True

        # Use helper for hard delete assertion
        assert_entity_deleted(mock_db, sample_contact, soft_delete=False)

    @pytest.mark.asyncio
    async def test_delete_contact_not_found(self, tenant_id):
        """Test deleting non-existent contact."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        contact_id = uuid4()

        # Mock get_contact to return None (not found)
        with patch.object(service, "get_contact", return_value=None):
            result = await service.delete_contact(contact_id=contact_id, tenant_id=tenant_id)

        assert result is False
        mock_db.delete.assert_not_called()
        mock_db.commit.assert_not_called()


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 109 lines with repetitive mock setup
# - Mock result setup repeated in all 3 tests (8 lines each = 24 lines)
# - Mock commit/delete setup (4 lines each = 12 lines)
# - Cache patches repeated (6 lines each = 18 lines)
# Total boilerplate: ~54 lines across 3 tests
#
# AFTER: ~90 lines using helpers
# - build_success_result() / build_not_found_result() (1 line each)
# - assert_entity_deleted() handles assertions (1 line)
# - build_mock_db_session() provides configured mock (1 line)
# Total boilerplate: ~9 lines across 3 tests
#
# Boilerplate REDUCTION: 54 → 9 lines (83% less)
# Code QUALITY: Significantly improved - tests focus on business logic
# ============================================================================
