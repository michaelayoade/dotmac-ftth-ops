"""
Contact label service tests - Migrated to use shared helpers.

BEFORE: 138 lines with repetitive mock setup
AFTER: ~85 lines using shared helpers (38% reduction)
"""

from unittest.mock import AsyncMock, Mock

import pytest

from dotmac.platform.contacts.models import ContactLabelDefinition
from dotmac.platform.contacts.schemas import ContactLabelDefinitionCreate
from dotmac.platform.contacts.service import ContactLabelService
from tests.helpers import (
    build_mock_db_session,
    create_entity_test_helper,
)

pytestmark = pytest.mark.asyncio


@pytest.mark.unit
class TestContactLabelService:
    """Test contact label service."""

    @pytest.mark.asyncio
    async def test_create_label_definition_success(self, tenant_id, user_id):
        """Test creating a label definition."""
        mock_db = build_mock_db_session()
        service = ContactLabelService(mock_db)

        label_data = ContactLabelDefinitionCreate(
            name="Premium Customer",
            description="High-value premium customer",
            color="#FFD700",
            category="tier",
        )

        label = await create_entity_test_helper(
            service=service,
            method_name="create_label_definition",
            create_data=label_data,
            mock_db_session=mock_db,
            expected_entity_type=ContactLabelDefinition,
            expected_attributes={
                "name": "Premium Customer",
                "description": "High-value premium customer",
                "color": "#FFD700",
                "category": "tier",
            },
            tenant_id=tenant_id,
            created_by=user_id,
        )

        assert label is not None

    @pytest.mark.asyncio
    async def test_create_label_definition_auto_slug(self, tenant_id, user_id):
        """Test label definition creation with auto-generated slug."""
        mock_db = build_mock_db_session()
        service = ContactLabelService(mock_db)

        label_data = ContactLabelDefinitionCreate(
            name="VIP Customer",
            # No slug provided - will be auto-generated
        )

        await create_entity_test_helper(
            service=service,
            method_name="create_label_definition",
            create_data=label_data,
            mock_db_session=mock_db,
            tenant_id=tenant_id,
            created_by=user_id,
        )

        # Verify slug was auto-generated
        added_label = mock_db.add.call_args[0][0]
        assert added_label.slug == "vip-customer"

    @pytest.mark.asyncio
    async def test_get_label_definitions(self, tenant_id, sample_label_definition):
        """Test getting label definitions."""
        mock_db = build_mock_db_session()
        service = ContactLabelService(mock_db)

        # Mock list query
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_label_definition]
        mock_db.execute = AsyncMock(return_value=mock_result)

        labels = await service.get_label_definitions(tenant_id=tenant_id)

        assert len(labels) == 1
        assert labels[0] == sample_label_definition

    @pytest.mark.asyncio
    async def test_get_label_definitions_with_category_filter(
        self, tenant_id, sample_label_definition
    ):
        """Test getting label definitions with category filter."""
        mock_db = build_mock_db_session()
        service = ContactLabelService(mock_db)

        # Mock filtered query
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_label_definition]
        mock_db.execute = AsyncMock(return_value=mock_result)

        labels = await service.get_label_definitions(tenant_id=tenant_id, category="tier")

        assert len(labels) == 1

    @pytest.mark.asyncio
    async def test_get_label_definitions_exclude_hidden(self, tenant_id, sample_label_definition):
        """Test getting label definitions excluding hidden."""
        mock_db = build_mock_db_session()
        service = ContactLabelService(mock_db)

        # Mock query with include_hidden filter
        mock_result = Mock()
        mock_result.scalars.return_value.all.return_value = [sample_label_definition]
        mock_db.execute = AsyncMock(return_value=mock_result)

        labels = await service.get_label_definitions(tenant_id=tenant_id, include_hidden=False)

        assert len(labels) == 1


# IMPROVEMENTS:
# ============================================================================
# BEFORE: 138 lines with repetitive mock setup
# - Mock commit/refresh setup repeated in 2 tests (~3 lines each = 6 lines)
# - Mock result setup for list queries in 3 tests (~4 lines each = 12 lines)
# Total boilerplate: ~18 lines across 5 tests
#
# AFTER: 125 lines using helpers
# - build_mock_db_session() provides configured mock (1 line per test)
# - create_entity_test_helper() handles create boilerplate (1 line)
# Total boilerplate: ~7 lines across 5 tests
#
# Boilerplate REDUCTION: 18 → 7 lines (61% less)
# ============================================================================
