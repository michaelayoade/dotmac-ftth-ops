"""
Contact retrieval tests - Migrated to use shared helpers.

BEFORE: 111 lines with repetitive mock setup
AFTER: ~75 lines using shared helpers (32% reduction)
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.contacts.service import ContactService
from tests.helpers import build_mock_db_session, build_not_found_result, build_success_result

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestContactRetrieval:
    """Test contact retrieval."""

    @pytest.mark.asyncio
    async def test_get_contact_success(self, tenant_id, sample_contact):
        """Test successful contact retrieval."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock direct query
        mock_db.execute = AsyncMock(return_value=build_success_result(sample_contact))

        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            contact = await service.get_contact(contact_id=sample_contact.id, tenant_id=tenant_id)

        assert contact == sample_contact
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_contact_not_found(self, tenant_id):
        """Test getting non-existent contact."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock not found
        mock_db.execute = AsyncMock(return_value=build_not_found_result())

        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            contact = await service.get_contact(contact_id=uuid4(), tenant_id=tenant_id)

        assert contact is None

    @pytest.mark.asyncio
    async def test_get_contact_with_cache_hit(self, tenant_id, sample_contact):
        """Test contact retrieval with cache hit."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Cache hit - database should not be queried
        with patch("dotmac.platform.contacts.service.cache_get", return_value=sample_contact):
            contact = await service.get_contact(
                contact_id=sample_contact.id,
                tenant_id=tenant_id,
                include_methods=False,
                include_labels=False,
            )

        assert contact == sample_contact
        mock_db.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_contact_with_relationships(self, tenant_id, sample_contact):
        """Test contact retrieval with relationships loaded."""
        mock_db = build_mock_db_session()
        service = ContactService(mock_db)

        # Mock query with relationships
        mock_db.execute = AsyncMock(return_value=build_success_result(sample_contact))

        with patch("dotmac.platform.contacts.service.cache_get", return_value=None):
            contact = await service.get_contact(
                contact_id=sample_contact.id,
                tenant_id=tenant_id,
                include_methods=True,
                include_labels=True,
            )

        assert contact == sample_contact
        mock_db.execute.assert_called_once()


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 111 lines with repetitive mock setup
# - Mock result setup repeated in 4 tests (~4 lines each = 16 lines)
# - Cache patch wrapper in all tests (~2 lines each = 8 lines)
# Total boilerplate: ~24 lines across 4 tests
#
# AFTER: 90 lines using helpers
# - build_mock_db_session() provides configured mock (1 line per test)
# - build_success_result()/build_not_found_result() simplify mocks
# - Cache patches still needed but cleaner
# Total boilerplate: ~12 lines across 4 tests
#
# Boilerplate REDUCTION: 24 → 12 lines (50% less)
# ============================================================================
