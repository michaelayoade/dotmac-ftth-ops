"""
ISP Settings Service.

Service layer for managing ISP-specific configuration settings including
loading, validation, updates, and initial setup workflows.
"""

import json
from typing import Any

import structlog
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.core.exceptions import DotMacError, ErrorCategory, ErrorSeverity
from dotmac.platform.tenant.isp_settings_models import ISPSettings
from dotmac.platform.tenant.models import TenantSetting

logger = structlog.get_logger(__name__)


class ISPSettingsError(DotMacError):
    """ISP settings related errors."""

    def __init__(
        self,
        message: str,
        user_message: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            user_message=user_message or "Settings configuration error",
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.MEDIUM,
            details=details or {},
        )


class ISPSettingsService:
    """Service for managing ISP-specific settings."""

    SETTINGS_KEY = "isp_settings"

    def __init__(self, session: AsyncSession):
        """
        Initialize settings service.

        Args:
            session: Database session
        """
        self.session = session

    async def get_settings(self, tenant_id: str) -> ISPSettings:
        """
        Get ISP settings for a tenant.

        Loads settings from database and merges with defaults. If no settings
        exist, returns default settings.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Complete ISP settings configuration

        Raises:
            ISPSettingsError: If settings are invalid
        """
        logger.info("Loading ISP settings", tenant_id=tenant_id)

        # Try to load from TenantSetting table first
        stmt = (
            select(TenantSetting)
            .where(TenantSetting.tenant_id == tenant_id)
            .where(TenantSetting.key == self.SETTINGS_KEY)
            .limit(1)
        )
        result = await self.session.execute(stmt)
        setting = result.scalar_one_or_none()

        if setting and setting.value:
            try:
                # Parse JSON and validate
                data = (
                    json.loads(setting.value) if isinstance(setting.value, str) else setting.value
                )
                settings = ISPSettings.model_validate(data)
                logger.info("Loaded ISP settings from database", tenant_id=tenant_id)
                return settings
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.error(
                    "Invalid ISP settings in database",
                    tenant_id=tenant_id,
                    error=str(exc),
                )
                raise ISPSettingsError(
                    message=f"Invalid ISP settings in database: {exc}",
                    user_message="Settings configuration is invalid. Please contact support.",
                    details={"tenant_id": tenant_id, "error": str(exc)},
                ) from exc

        # No settings found, return defaults
        logger.info("No ISP settings found, returning defaults", tenant_id=tenant_id)
        return ISPSettings()

    async def update_settings(
        self,
        tenant_id: str,
        updates: dict[str, Any],
        *,
        is_initial_setup: bool = False,
        validate_only: bool = False,
    ) -> ISPSettings:
        """
        Update ISP settings for a tenant.

        Args:
            tenant_id: Tenant identifier
            updates: Partial settings updates (nested dict)
            is_initial_setup: Whether this is initial setup (allows changing locked fields)
            validate_only: If True, only validate without saving

        Returns:
            Updated settings configuration

        Raises:
            ISPSettingsError: If validation fails or update is not allowed
        """
        logger.info(
            "Updating ISP settings",
            tenant_id=tenant_id,
            is_initial_setup=is_initial_setup,
            validate_only=validate_only,
        )

        # Load current settings
        current = await self.get_settings(tenant_id)
        current_dict = current.model_dump()

        # Validate changes for non-setup mode
        if not is_initial_setup:
            self._validate_runtime_changes(updates)

        # Deep merge updates into current settings
        merged = self._deep_merge(current_dict, updates)

        # Validate merged settings
        try:
            new_settings = ISPSettings.model_validate(merged)
        except ValidationError as exc:
            logger.error(
                "Settings validation failed",
                tenant_id=tenant_id,
                errors=exc.errors(),
            )
            raise ISPSettingsError(
                message=f"Settings validation failed: {exc}",
                user_message="Invalid settings configuration. Please check your input.",
                details={"tenant_id": tenant_id, "validation_errors": exc.errors()},
            ) from exc

        # Return early if validation only
        if validate_only:
            logger.info("Settings validation successful", tenant_id=tenant_id)
            return new_settings

        # Save to database
        await self._save_settings(tenant_id, new_settings)

        logger.info("ISP settings updated successfully", tenant_id=tenant_id)
        return new_settings

    async def reset_to_defaults(self, tenant_id: str) -> ISPSettings:
        """
        Reset settings to defaults for a tenant.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Default settings configuration
        """
        logger.warning("Resetting ISP settings to defaults", tenant_id=tenant_id)

        defaults = ISPSettings()
        await self._save_settings(tenant_id, defaults)

        return defaults

    async def get_setting_section(
        self,
        tenant_id: str,
        section: str,
    ) -> dict[str, Any]:
        """
        Get a specific settings section.

        Args:
            tenant_id: Tenant identifier
            section: Section name (e.g., 'radius', 'network', 'portal')

        Returns:
            Settings section as dict

        Raises:
            ISPSettingsError: If section doesn't exist
        """
        settings = await self.get_settings(tenant_id)
        settings_dict = settings.model_dump()

        if section not in settings_dict:
            raise ISPSettingsError(
                message=f"Settings section '{section}' does not exist",
                user_message=f"Invalid settings section: {section}",
                details={"tenant_id": tenant_id, "section": section},
            )

        return settings_dict[section]

    async def update_setting_section(
        self,
        tenant_id: str,
        section: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Update a specific settings section.

        Args:
            tenant_id: Tenant identifier
            section: Section name (e.g., 'radius', 'network', 'portal')
            updates: Section updates

        Returns:
            Updated settings section

        Raises:
            ISPSettingsError: If section doesn't exist
        """
        # Validate section exists
        current_settings = await self.get_settings(tenant_id)
        if not hasattr(current_settings, section):
            raise ISPSettingsError(
                message=f"Settings section '{section}' does not exist",
                user_message=f"Invalid settings section: {section}",
                details={"tenant_id": tenant_id, "section": section},
            )

        # Update the specific section
        updated_settings = await self.update_settings(
            tenant_id=tenant_id,
            updates={section: updates},
        )

        # Return updated section
        return getattr(updated_settings, section).model_dump()

    def _validate_runtime_changes(self, updates: dict[str, Any]) -> None:
        """
        Validate that runtime changes don't modify initial-setup-only fields.

        Args:
            updates: Update dictionary

        Raises:
            ISPSettingsError: If attempting to change locked fields
        """
        initial_setup_fields = set(ISPSettings.get_initial_setup_fields())
        changed_fields = self._get_changed_field_paths(updates)

        locked_changes = changed_fields.intersection(initial_setup_fields)
        if locked_changes:
            raise ISPSettingsError(
                message=f"Cannot modify initial setup fields: {locked_changes}",
                user_message=(
                    "These settings can only be changed during initial setup. "
                    "Contact support if you need to modify them."
                ),
                details={"locked_fields": list(locked_changes)},
            )

    def _get_changed_field_paths(
        self,
        updates: dict[str, Any],
        prefix: str = "",
    ) -> set[str]:
        """
        Get set of all field paths being changed in update dict.

        Args:
            updates: Update dictionary
            prefix: Current path prefix (for recursion)

        Returns:
            Set of field paths (e.g., {'localization.currency', 'radius.session_timeout'})
        """
        paths = set()
        for key, value in updates.items():
            path = f"{prefix}.{key}" if prefix else key
            paths.add(path)

            # Recurse into nested dicts
            if isinstance(value, dict):
                paths.update(self._get_changed_field_paths(value, prefix=path))

        return paths

    def _deep_merge(
        self,
        base: dict[str, Any],
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Deep merge two dictionaries.

        Args:
            base: Base dictionary
            updates: Updates to merge

        Returns:
            Merged dictionary
        """
        result = base.copy()

        for key, value in updates.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursively merge nested dicts
                result[key] = self._deep_merge(result[key], value)
            else:
                # Override value
                result[key] = value

        return result

    async def _save_settings(self, tenant_id: str, settings: ISPSettings) -> None:
        """
        Save settings to database.

        Args:
            tenant_id: Tenant identifier
            settings: Settings to save
        """
        # Serialize to JSON
        settings_json = settings.model_dump_json()

        # Check if setting exists
        stmt = (
            select(TenantSetting)
            .where(TenantSetting.tenant_id == tenant_id)
            .where(TenantSetting.key == self.SETTINGS_KEY)
            .limit(1)
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing
            existing.value = settings_json
            logger.debug("Updating existing settings record", tenant_id=tenant_id)
        else:
            # Create new
            new_setting = TenantSetting(
                tenant_id=tenant_id,
                key=self.SETTINGS_KEY,
                value=settings_json,
                description="ISP-specific configuration settings",
            )
            self.session.add(new_setting)
            logger.debug("Creating new settings record", tenant_id=tenant_id)

        await self.session.commit()

    async def validate_settings_schema(
        self, settings_dict: dict[str, Any]
    ) -> tuple[bool, list[str]]:
        """
        Validate settings against schema without saving.

        Args:
            settings_dict: Settings dictionary to validate

        Returns:
            Tuple of (is_valid, error_messages)
        """
        try:
            ISPSettings.model_validate(settings_dict)
            return True, []
        except ValidationError as exc:
            errors = [f"{e['loc']}: {e['msg']}" for e in exc.errors()]
            return False, errors

    async def export_settings(self, tenant_id: str) -> dict[str, Any]:
        """
        Export settings as dictionary for backup/migration.

        Args:
            tenant_id: Tenant identifier

        Returns:
            Settings as dictionary
        """
        settings = await self.get_settings(tenant_id)
        return settings.model_dump()

    async def import_settings(
        self,
        tenant_id: str,
        settings_dict: dict[str, Any],
        *,
        validate_only: bool = False,
    ) -> ISPSettings:
        """
        Import settings from dictionary (restore from backup/migration).

        Args:
            tenant_id: Tenant identifier
            settings_dict: Settings dictionary to import
            validate_only: If True, only validate without saving

        Returns:
            Imported settings

        Raises:
            ISPSettingsError: If validation fails
        """
        logger.info("Importing ISP settings", tenant_id=tenant_id, validate_only=validate_only)

        # Validate settings
        try:
            settings = ISPSettings.model_validate(settings_dict)
        except ValidationError as exc:
            raise ISPSettingsError(
                message=f"Settings import validation failed: {exc}",
                user_message="Invalid settings format. Cannot import.",
                details={"validation_errors": exc.errors()},
            ) from exc

        if validate_only:
            return settings

        # Save to database
        await self._save_settings(tenant_id, settings)

        logger.info("ISP settings imported successfully", tenant_id=tenant_id)
        return settings
