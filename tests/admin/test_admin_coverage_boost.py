"""Additional tests to boost admin module coverage to 95%+."""

from unittest.mock import patch

import pytest

from dotmac.platform.admin.settings.models import (
    SettingsCategory,
    SettingsUpdateRequest,
)
from dotmac.platform.admin.settings.service import SettingsManagementService

pytestmark = [
    pytest.mark.unit,
    pytest.mark.asyncio,
]


@pytest.fixture(autouse=True)
def restore_category_mapping():
    """Fixture to ensure CATEGORY_MAPPING is restored after each test."""

    # Save original mapping before test
    original_mapping = SettingsManagementService.CATEGORY_MAPPING.copy()

    yield

    # Restore original mapping after test
    SettingsManagementService.CATEGORY_MAPPING = original_mapping


class TestServiceInvalidCategory:
    """Test service with invalid category handling."""

    @pytest.mark.asyncio
    async def test_update_category_invalid_category(self):
        """Test updating with invalid category raises ValueError."""
        service = SettingsManagementService()

        # Mock CATEGORY_MAPPING to simulate invalid category
        original_mapping = service.CATEGORY_MAPPING.copy()
        service.CATEGORY_MAPPING = {}  # Empty mapping makes all categories invalid

        update_request = SettingsUpdateRequest(
            updates={"test_field": "value"},
            validate_only=False,
        )

        # Should raise ValueError for invalid category (line 136)
        with pytest.raises(ValueError, match="Invalid settings category"):
            await service.update_category_settings(
                category=SettingsCategory.DATABASE,
                update_request=update_request,
                user_id="user-123",
                user_email="user@example.com",
            )

        service.CATEGORY_MAPPING = original_mapping  # Restore


class TestValidationEdgeCases:
    """Test validation edge cases for missing coverage."""

    @pytest.mark.asyncio
    async def test_validate_settings_invalid_category(self):
        """Test validating settings with invalid category (lines 206-208)."""
        service = SettingsManagementService()

        # Mock CATEGORY_MAPPING to simulate invalid category
        original_mapping = service.CATEGORY_MAPPING.copy()
        service.CATEGORY_MAPPING = {}

        result = service.validate_settings(
            category=SettingsCategory.DATABASE, updates={"some_field": "value"}
        )

        # Should return invalid result with error (lines 206-208)
        assert result.valid is False
        assert "category" in result.errors
        assert "Invalid category" in result.errors["category"]

        service.CATEGORY_MAPPING = original_mapping

    @pytest.mark.asyncio
    async def test_validate_settings_pydantic_validation_error(self):
        """Test validation with Pydantic ValidationError (lines 228-231)."""
        service = SettingsManagementService()

        # Try to update with invalid data type that would cause ValidationError
        result = service.validate_settings(
            category=SettingsCategory.DATABASE,
            updates={"database": 12345},  # database should be string
        )

        # Should catch ValidationError and populate errors (lines 228-231)
        assert result.valid is False
        assert len(result.errors) > 0

    @pytest.mark.asyncio
    async def test_validate_settings_generic_exception(self):
        """Test validation with generic exception (lines 232-234)."""

        service = SettingsManagementService()

        # Mock the settings object's model_dump to raise exception during validation
        # Need to mock at a deeper level to trigger the exception in _run_validation_checks

        with patch.object(
            type(service.settings.database),
            "model_dump",
            side_effect=RuntimeError("Unexpected error"),
        ):
            result = service.validate_settings(
                category=SettingsCategory.DATABASE, updates={"url": "test"}
            )

            # Should catch generic exception (lines 232-234)
            assert result.valid is False
            assert "validation" in result.errors
            assert "Unexpected error" in result.errors["validation"]


class TestGetAllCategoriesEdgeCase:
    """Test get_all_categories edge case."""

    @pytest.mark.asyncio
    async def test_get_all_categories_skip_invalid(self):
        """Test that get_all_categories skips invalid categories (line 250)."""
        from unittest.mock import AsyncMock, patch

        service = SettingsManagementService()

        # Mock CATEGORY_MAPPING to have one invalid entry
        original_mapping = service.CATEGORY_MAPPING.copy()

        # Add a mapping that points to non-existent attribute
        service.CATEGORY_MAPPING[SettingsCategory.DATABASE] = "non_existent_attr"

        # Mock _get_last_update_info to avoid database dependency
        with patch.object(service, "_get_last_update_info", new=AsyncMock(return_value={})):
            categories = await service.get_all_categories()

        # Should skip the invalid category (line 250 - continue statement)
        # The result should not include DATABASE category
        category_values = [c.category for c in categories]
        assert SettingsCategory.DATABASE not in category_values

        service.CATEGORY_MAPPING = original_mapping


class TestBackupEdgeCases:
    """Test backup creation and restore edge cases."""

    @pytest.mark.asyncio
    async def test_create_backup_none_categories(self):
        """Test creating backup with None categories (line 293)."""
        service = SettingsManagementService()

        # Call with categories=None (line 293 should execute)
        backup = service.create_backup(
            name="test-backup",
            description="Test backup",
            categories=None,  # This triggers line 293
            user_id="user-123",
        )

        assert backup is not None
        assert backup.name == "test-backup"
        # Should backup all categories
        assert len(backup.categories) == len(list(SettingsCategory))

    @pytest.mark.asyncio
    async def test_create_backup_skip_invalid_mapping(self):
        """Test backup skips categories with invalid mapping (line 298)."""
        service = SettingsManagementService()

        original_mapping = service.CATEGORY_MAPPING.copy()

        # Create mapping where DATABASE points to non-existent attribute
        service.CATEGORY_MAPPING[SettingsCategory.DATABASE] = "non_existent_attr"

        backup = service.create_backup(
            name="test-backup",
            description="Test",
            categories=[SettingsCategory.DATABASE],
            user_id="user-123",
        )

        # Should skip invalid category (line 298 - if condition false)
        assert len(backup.settings_data) == 0

        service.CATEGORY_MAPPING = original_mapping

    @pytest.mark.asyncio
    async def test_restore_backup_skip_invalid_mapping(self):
        """Test restore skips categories with invalid mapping (line 350)."""
        service = SettingsManagementService()

        # Create a backup first
        backup = service.create_backup(
            name="test-backup",
            description="Test",
            categories=[SettingsCategory.DATABASE],
            user_id="user-123",
        )

        original_mapping = service.CATEGORY_MAPPING.copy()

        # Now corrupt the mapping before restore
        service.CATEGORY_MAPPING[SettingsCategory.DATABASE] = "non_existent_attr"

        # Restore should skip invalid category (line 350)
        restored = await service.restore_backup(
            backup_id=backup.id, user_id="user-123", user_email="user@example.com"
        )

        # Should not restore any categories
        assert len(restored) == 0

        service.CATEGORY_MAPPING = original_mapping

    @pytest.mark.asyncio
    async def test_restore_backup_no_changes(self):
        """Test restore when no fields match (line 362 - empty changes)."""
        from unittest.mock import AsyncMock, MagicMock, patch

        service = SettingsManagementService()

        # Create a backup with valid category
        backup = service.create_backup(
            name="test-backup",
            description="Test",
            categories=[SettingsCategory.DATABASE],
            user_id="user-123",
        )

        # Manually modify backup data to have ONLY non-existent fields
        # Save the backup ID first
        backup_id = backup.id

        # Directly modify the backup in the service's _backups storage
        service._backups[backup_id].settings_data = {
            SettingsCategory.DATABASE.value: {
                "non_existent_field": "value",
                "another_fake_field": "another_value",
            }
        }

        # Mock both database dependencies
        mock_session = AsyncMock()
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        mock_session.get = AsyncMock(return_value=None)  # No DB backup, use in-memory

        # Configure execute() to return a result with scalar_one_or_none() returning None
        mock_result = AsyncMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)
        mock_session.execute = AsyncMock(return_value=mock_result)

        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)

        with (
            patch.object(service, "_get_session", return_value=mock_session),
            patch.object(service, "_get_last_update_info", new=AsyncMock(return_value={})),
        ):
            # Restore should skip non-existent fields (line 356 - if hasattr check)
            # This means changes dict remains empty, so line 362 condition is false
            restored = await service.restore_backup(
                backup_id=backup_id, user_id="user-123", user_email="user@example.com"
            )

        # When changes dict is empty (all fields were non-existent),
        # the category is still persisted but no audit entry is created
        assert isinstance(restored, dict), "Restore should return a dict"

        # The category is still added to restored even with no valid field changes
        assert SettingsCategory.DATABASE in restored

        # Verify db_session.add was called exactly once for AdminSettingsStore
        # (not twice - no audit entry should be added when changes is empty)
        assert mock_session.add.call_count == 1, (
            "Expected 1 call to session.add (for AdminSettingsStore), "
            f"but got {mock_session.add.call_count}"
        )

        # Verify it was called with AdminSettingsStore, not AdminSettingsAuditEntry
        from dotmac.platform.admin.settings.models import AdminSettingsStore

        call_args = mock_session.add.call_args[0][0]
        assert isinstance(call_args, AdminSettingsStore), (
            "Expected session.add to be called with AdminSettingsStore when there are no changes"
        )
