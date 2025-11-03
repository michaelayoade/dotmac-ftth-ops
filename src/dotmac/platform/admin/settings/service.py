"""
Settings management service for admin operations.
"""

import asyncio
import json
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

import structlog
from pydantic import BaseModel
from pydantic_core import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform import settings as platform_settings
from dotmac.platform.admin.settings.models import (
    AdminSettingsAuditEntry,
    AdminSettingsBackupEntry,
    AdminSettingsStore,
    AuditLog,
    SettingField,
    SettingsBackup,
    SettingsCategory,
    SettingsCategoryInfo,
    SettingsResponse,
    SettingsUpdateRequest,
    SettingsValidationResult,
)
from dotmac.platform.db import AsyncSessionLocal

logger = structlog.get_logger(__name__)


class SettingsManagementService:
    """Service for managing platform settings."""

    # Map categories to settings attributes
    CATEGORY_MAPPING = {
        SettingsCategory.DATABASE: "database",
        SettingsCategory.JWT: "jwt",
        SettingsCategory.REDIS: "redis",
        SettingsCategory.VAULT: "vault",
        SettingsCategory.STORAGE: "storage",
        SettingsCategory.EMAIL: "email",
        SettingsCategory.TENANT: "tenant",
        SettingsCategory.CORS: "cors",
        SettingsCategory.RATE_LIMIT: "rate_limit",
        SettingsCategory.OBSERVABILITY: "observability",
        SettingsCategory.CELERY: "celery",
        SettingsCategory.FEATURES: "features",
        SettingsCategory.BILLING: "billing",
    }

    # Fields that should be masked in responses
    SENSITIVE_FIELDS = {
        "password",
        "secret",
        "token",
        "key",
        "api_key",
        "secret_key",
        "private_key",
        "smtp_password",
        "redis_password",
        "database_password",
    }

    # Settings that require service restart
    RESTART_REQUIRED_SETTINGS = {
        SettingsCategory.DATABASE: ["host", "port", "database", "pool_size"],
        SettingsCategory.REDIS: ["host", "port", "max_connections"],
        SettingsCategory.CELERY: ["broker_url", "result_backend"],
    }

    def __init__(self, session_factory: Callable[[], AsyncSession] | None = None) -> None:
        """Initialize settings management service."""
        self.settings = platform_settings.settings
        self._backups: dict[UUID, SettingsBackup] = {}
        self._session_factory = session_factory or AsyncSessionLocal

    @asynccontextmanager
    async def _get_session(
        self, session: AsyncSession | None = None
    ) -> AsyncIterator[AsyncSession]:
        """Provide an async session, reusing provided session when available."""
        if session is not None:
            yield session
            return

        async with self._session_factory() as new_session:
            yield new_session

    async def _load_category_from_store(
        self,
        category: SettingsCategory,
        session: AsyncSession | None = None,
    ) -> None:
        """Ensure the in-memory settings reflect persisted values for a category."""
        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            return

        try:
            async with self._get_session(session) as db_session:
                result = await db_session.execute(
                    select(AdminSettingsStore).where(AdminSettingsStore.category == category.value)
                )
                entry = result.scalar_one_or_none()
        except OperationalError:
            logger.debug(
                "settings.store.unavailable",
                category=category.value,
                message="Settings store table not available; skipping load",
            )
            return

        if not entry:
            return

        settings_obj = getattr(self.settings, attr_name)
        for field_name, value in entry.settings_data.items():
            if hasattr(settings_obj, field_name):
                setattr(settings_obj, field_name, value)

    async def _persist_category_settings(
        self,
        category: SettingsCategory,
        user_email: str | None,
        session: AsyncSession | None = None,
        commit: bool = True,
    ) -> None:
        """Persist the current in-memory settings for a category to the database."""
        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            return

        settings_obj = getattr(self.settings, attr_name)
        data = settings_obj.model_dump()

        async with self._get_session(session) as db_session:
            try:
                result = await db_session.execute(
                    select(AdminSettingsStore).where(AdminSettingsStore.category == category.value)
                )
                entry = result.scalar_one_or_none()

                if entry:
                    entry.settings_data = data
                    entry.updated_by = user_email
                else:
                    entry = AdminSettingsStore(
                        category=category.value,
                        settings_data=data,
                        updated_by=user_email,
                    )
                    db_session.add(entry)

                if commit:
                    await db_session.commit()
                else:
                    await db_session.flush()
            except OperationalError:
                await db_session.rollback()
                logger.debug(
                    "settings.store.unavailable",
                    category=category.value,
                    message="Settings store table not available; skipping persist",
                )

    async def get_category_settings(
        self,
        category: SettingsCategory,
        include_sensitive: bool = False,
        user_id: str | None = None,
        session: AsyncSession | None = None,
    ) -> SettingsResponse:
        """
        Get settings for a specific category.

        Args:
            category: Settings category to retrieve
            include_sensitive: Whether to include sensitive field values
            user_id: ID of requesting user (for audit)

        Returns:
            SettingsResponse with category settings
        """
        await self._load_category_from_store(category, session=session)

        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            raise ValueError(f"Invalid settings category: {category}")

        settings_obj = getattr(self.settings, attr_name)
        fields = self._extract_fields(settings_obj, include_sensitive=include_sensitive)

        async with self._get_session(session) as db_session:
            last_update_info = await self._get_last_update_info(db_session, category)

        return SettingsResponse(
            category=category,
            display_name=SettingsCategory.get_display_name(category),
            fields=fields,
            last_updated=last_update_info.get("timestamp"),
            updated_by=last_update_info.get("user_email"),
        )

    async def update_category_settings(
        self,
        category: SettingsCategory,
        update_request: SettingsUpdateRequest,
        user_id: str,
        user_email: str,
        ip_address: str | None = None,
        user_agent: str | None = None,
        tenant_id: str | None = None,
        session: AsyncSession | None = None,
    ) -> SettingsResponse:
        """
        Update settings for a specific category.

        Args:
            category: Settings category to update
            update_request: Update request with new values
            user_id: ID of user making changes
            user_email: Email of user making changes
            ip_address: Client IP address
            user_agent: Client user agent

        Returns:
            Updated settings response
        """
        await self._load_category_from_store(category, session=session)

        # Validate category
        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            raise ValueError(f"Invalid settings category: {category}")

        validation_result = await self.validate_settings_async(
            category=category,
            updates=update_request.updates,
            session=session,
        )
        if not validation_result.valid:
            raise ValueError(f"Validation failed for {category.value}: {validation_result.errors}")

        # Get current settings
        settings_obj = getattr(self.settings, attr_name)
        changes: dict[str, dict[str, Any]] = {}

        # Validate and apply updates
        for field_name, new_value in update_request.updates.items():
            if not hasattr(settings_obj, field_name):
                raise ValueError(f"Invalid field '{field_name}' for category {category}")

            old_value = getattr(settings_obj, field_name)

            # Apply the update
            if not update_request.validate_only:
                setattr(settings_obj, field_name, new_value)
                changes[field_name] = {"old": old_value, "new": new_value}

        async with self._get_session(session) as db_session:
            if not update_request.validate_only and changes:
                try:
                    # Convert tenant_id from string to UUID for database
                    try:
                        tenant_uuid = UUID(str(tenant_id)) if tenant_id else uuid4()
                    except (TypeError, ValueError):
                        logger.debug(
                            "settings.audit.invalid_tenant_id",
                            tenant_id=tenant_id,
                            message="Using generated UUID for audit entry",
                        )
                        tenant_uuid = uuid4()
                    audit_entry = AdminSettingsAuditEntry(
                        tenant_id=tenant_uuid,
                        category=category.value,
                        action="update",
                        user_id=user_id,
                        user_email=user_email,
                        reason=update_request.reason,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        changes=changes,
                    )
                    db_session.add(audit_entry)
                    await db_session.commit()

                    logger.info(
                        "Settings updated",
                        category=category.value,
                        user=user_email,
                        changes=list(changes.keys()),
                    )

                    last_update_info = {
                        "timestamp": audit_entry.created_at,
                        "user_email": audit_entry.user_email,
                    }
                except OperationalError:
                    # Audit table doesn't exist (e.g., test environment)
                    await db_session.rollback()
                    logger.debug(
                        "settings.audit.unavailable",
                        category=category.value,
                        message="Audit table not available; skipping audit log",
                    )
                    last_update_info = {}
            else:
                last_update_info = await self._get_last_update_info(db_session, category)

            if not update_request.validate_only:
                await self._persist_category_settings(
                    category=category,
                    user_email=user_email,
                    session=db_session,
                    commit=False,
                )
                await db_session.commit()

        if update_request.validate_only:
            return await self.get_category_settings(
                category=category,
                include_sensitive=False,
                user_id=user_id,
                session=session,
            )

        fields = self._extract_fields(settings_obj, include_sensitive=False)

        return SettingsResponse(
            category=category,
            display_name=SettingsCategory.get_display_name(category),
            fields=fields,
            last_updated=last_update_info.get("timestamp"),
            updated_by=last_update_info.get("user_email"),
        )

    def _run_validation_checks(
        self,
        category: SettingsCategory,
        settings_obj: BaseModel,
        updates: dict[str, Any],
    ) -> SettingsValidationResult:
        """Internal validation helper shared by sync/async pathways."""
        result = SettingsValidationResult(
            valid=True,
            errors={},
            warnings={},
            restart_required=False,
        )

        model_class = type(settings_obj)

        # Check restart requirements and unknown fields
        restart_fields = self.RESTART_REQUIRED_SETTINGS.get(category, [])
        for field_name in updates.keys():
            if field_name in restart_fields:
                result.restart_required = True
                result.warnings[field_name] = "This change requires service restart"

            if field_name not in model_class.model_fields:
                result.valid = False
                result.errors[field_name] = (
                    f"Invalid field '{field_name}' for category {category.value}"
                )

        if not result.valid and result.errors:
            return result

        try:
            current_data = settings_obj.model_dump()
            current_data.update(updates)
            model_class(**current_data)
        except ValidationError as e:
            result.valid = False
            for error in e.errors():
                field = ".".join(str(loc) for loc in error["loc"])
                result.errors[field] = error["msg"]
        except Exception as e:
            result.valid = False
            result.errors["validation"] = str(e)

        return result

    async def validate_settings_async(
        self,
        category: SettingsCategory,
        updates: dict[str, Any],
        session: AsyncSession | None = None,
    ) -> SettingsValidationResult:
        """Async-friendly settings validation exposed for router usage."""
        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            return SettingsValidationResult(
                valid=False,
                errors={"category": f"Invalid category: {category}"},
                warnings={},
                restart_required=False,
            )

        await self._load_category_from_store(category, session=session)
        settings_obj = getattr(self.settings, attr_name)
        return self._run_validation_checks(category, settings_obj, updates)

    def validate_settings(
        self,
        category: SettingsCategory,
        updates: dict[str, Any],
        session: AsyncSession | None = None,
    ) -> SettingsValidationResult:
        """Synchronous validation helper retained for backwards compatibility."""
        attr_name = self.CATEGORY_MAPPING.get(category)
        if not attr_name or not hasattr(self.settings, attr_name):
            return SettingsValidationResult(
                valid=False,
                errors={"category": f"Invalid category: {category}"},
                warnings={},
                restart_required=False,
            )

        settings_obj = getattr(self.settings, attr_name)
        return self._run_validation_checks(category, settings_obj, updates)

    async def get_all_categories(
        self, session: AsyncSession | None = None
    ) -> list[SettingsCategoryInfo]:
        """
        Get information about all available settings categories.

        Returns:
            List of category information
        """
        categories: list[SettingsCategoryInfo] = []

        async with self._get_session(session) as db_session:
            for category in SettingsCategory:
                attr_name = self.CATEGORY_MAPPING.get(category)
                if not attr_name or not hasattr(self.settings, attr_name):
                    continue

                await self._load_category_from_store(category, session=db_session)

                settings_obj = getattr(self.settings, attr_name)
                fields = self._extract_fields(settings_obj)

                has_sensitive = any(self._is_sensitive_field(field.name) for field in fields)
                restart_required = category in self.RESTART_REQUIRED_SETTINGS
                last_update = await self._get_last_update_info(db_session, category)

                categories.append(
                    SettingsCategoryInfo(
                        category=category,
                        display_name=SettingsCategory.get_display_name(category),
                        description=self._get_category_description(category),
                        fields_count=len(fields),
                        has_sensitive_fields=has_sensitive,
                        restart_required=restart_required,
                        last_updated=last_update.get("timestamp"),
                    )
                )

        return categories

    async def create_backup_async(
        self,
        name: str,
        description: str | None,
        categories: list[SettingsCategory] | None,
        user_id: str,
        session: AsyncSession | None = None,
    ) -> SettingsBackup:
        """
        Create a backup of current settings.

        Args:
            name: Backup name
            description: Backup description
            categories: Categories to backup (all if None)
            user_id: User creating backup

        Returns:
            Created backup
        """
        if categories is None:
            categories = list(SettingsCategory)

        backup_id: UUID | None = None
        created_at: datetime | None = None

        async with self._get_session(session) as db_session:
            backup_data: dict[str, Any] = {}
            for category in categories:
                await self._load_category_from_store(category, session=db_session)
                attr_name = self.CATEGORY_MAPPING.get(category)
                if attr_name and hasattr(self.settings, attr_name):
                    settings_obj = getattr(self.settings, attr_name)
                    backup_data[category.value] = settings_obj.model_dump()

            try:
                backup_entry = AdminSettingsBackupEntry(
                    name=name,
                    description=description,
                    created_by=user_id,
                    categories=[category.value for category in categories],
                    settings_data=backup_data,
                )
                db_session.add(backup_entry)
                await db_session.commit()

                backup_id = backup_entry.id
                created_at = backup_entry.created_at

                logger.info(
                    "Settings backup created",
                    backup_id=str(backup_entry.id),
                    name=name,
                    categories=[c.value for c in categories],
                )
            except OperationalError:
                await db_session.rollback()
                # Backup table doesn't exist (e.g., test environment)
                logger.debug(
                    "settings.backup.unavailable",
                    message="Backup table not available; creating in-memory backup only",
                )

        # Create snapshot with the same ID as the DB entry (or generate new if DB unavailable)
        snapshot = self._build_backup_snapshot(
            name=name,
            description=description,
            categories=categories,
            user_id=user_id,
            backup_id=backup_id,
            created_at=created_at,
        )

        # Store in memory cache using the snapshot ID
        self._backups[snapshot.id] = snapshot

        return snapshot

    def _build_backup_snapshot(
        self,
        name: str,
        description: str | None,
        categories: list[SettingsCategory],
        user_id: str,
        backup_id: UUID | None = None,
        created_at: datetime | None = None,
    ) -> SettingsBackup:
        backup_data: dict[str, Any] = {}
        for category in categories:
            attr_name = self.CATEGORY_MAPPING.get(category)
            if attr_name and hasattr(self.settings, attr_name):
                settings_obj = getattr(self.settings, attr_name)
                backup_data[category.value] = settings_obj.model_dump()

        backup = SettingsBackup(
            id=backup_id or uuid4(),
            created_at=created_at or datetime.now(UTC),
            created_by=user_id,
            name=name,
            description=description,
            categories=categories,
            settings_data=backup_data,
        )
        # Note: Do not store in _backups here - let the caller manage storage
        # to avoid duplicate entries with different keys
        return backup

    def create_backup(
        self,
        name: str,
        description: str | None,
        categories: list[SettingsCategory] | None,
        user_id: str,
        session: AsyncSession | None = None,
    ) -> SettingsBackup:
        """Synchronous wrapper for creating backups (legacy compatibility)."""
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(
                self.create_backup_async(
                    name=name,
                    description=description,
                    categories=categories,
                    user_id=user_id,
                    session=session,
                )
            )

        categories = categories or list(SettingsCategory)
        snapshot = self._build_backup_snapshot(
            name=name,
            description=description,
            categories=categories,
            user_id=user_id,
        )
        # Store in memory cache for in-process restore
        self._backups[snapshot.id] = snapshot
        return snapshot

    async def restore_backup(
        self,
        backup_id: UUID,
        user_id: str,
        user_email: str,
        tenant_id: str | None = None,
        session: AsyncSession | None = None,
    ) -> dict[SettingsCategory, SettingsResponse]:
        """
        Restore settings from a backup.

        Args:
            backup_id: Backup ID to restore
            user_id: User performing restore
            user_email: User email

        Returns:
            Restored settings by category
        """
        legacy_backup = self._backups.get(backup_id)

        async with self._get_session(session) as db_session:
            backup_entry = None
            try:
                backup_entry = await db_session.get(AdminSettingsBackupEntry, backup_id)
            except OperationalError:
                # Backup table doesn't exist (e.g., test environment)
                logger.debug(
                    "settings.backup.db_unavailable",
                    message="Backup table not available; using in-memory backups only",
                )

            if not backup_entry and not legacy_backup:
                raise ValueError(f"Backup not found: {backup_id}")

            if backup_entry and backup_entry.id not in self._backups:
                self._backups[backup_entry.id] = SettingsBackup(
                    id=backup_entry.id,
                    created_at=backup_entry.created_at,
                    created_by=backup_entry.created_by,
                    name=backup_entry.name,
                    description=backup_entry.description,
                    categories=[SettingsCategory(cat) for cat in backup_entry.categories],
                    settings_data=backup_entry.settings_data,
                )

            active_backup = legacy_backup or self._backups.get(backup_id)
            if active_backup is not None:
                backup_name = active_backup.name
                backup_data = active_backup.settings_data
            elif backup_entry is not None:
                backup_name = backup_entry.name
                backup_data = backup_entry.settings_data
            else:  # Defensive safeguard; should be covered by earlier guard
                raise ValueError(f"Backup not found: {backup_id}")

            restored: dict[SettingsCategory, SettingsResponse] = {}
            audit_entries: list[AdminSettingsAuditEntry] = []
            restored_categories: list[SettingsCategory] = []

            # Convert tenant_id from string to UUID for database
            try:
                tenant_uuid = UUID(str(tenant_id)) if tenant_id else uuid4()
            except (TypeError, ValueError):
                logger.debug(
                    "settings.audit.invalid_tenant_id",
                    tenant_id=tenant_id,
                    message="Using generated UUID for audit restore entry",
                )
                tenant_uuid = uuid4()

            for category_str, data in backup_data.items():
                category = SettingsCategory(category_str)
                attr_name = self.CATEGORY_MAPPING.get(category)

                if attr_name and hasattr(self.settings, attr_name):
                    await self._load_category_from_store(category, session=db_session)
                    settings_obj = getattr(self.settings, attr_name)

                    changes = {}
                    for field_name, new_value in data.items():
                        if hasattr(settings_obj, field_name):
                            old_value = getattr(settings_obj, field_name)
                            setattr(settings_obj, field_name, new_value)
                            changes[field_name] = {"old": old_value, "new": new_value}

                    if changes:
                        audit_entries.append(
                            AdminSettingsAuditEntry(
                                tenant_id=tenant_uuid,
                                category=category.value,
                                action="restore",
                                user_id=user_id,
                                user_email=user_email,
                                reason=f"Restored from backup: {backup_name}",
                                ip_address=None,
                                user_agent=None,
                                changes=changes,
                            )
                        )

                    await self._persist_category_settings(
                        category=category,
                        user_email=user_email,
                        session=db_session,
                        commit=False,
                    )
                    restored_categories.append(category)

            if audit_entries:
                for entry in audit_entries:
                    db_session.add(entry)

            try:
                await db_session.commit()
            except OperationalError:
                await db_session.rollback()
                logger.debug(
                    "settings.audit.unavailable",
                    message="Audit table not available during restore; skipping audit log",
                )

            for category in restored_categories:
                restored[category] = await self.get_category_settings(
                    category,
                    session=db_session,
                )

        logger.info(
            "Settings restored from backup",
            backup_id=str(backup_id),
            categories=[cat.value for cat in restored.keys()],
            user=user_email,
        )

        return restored

    def _to_audit_log_model(self, entry: AdminSettingsAuditEntry) -> AuditLog:
        """Convert ORM audit entry to API response model."""
        return AuditLog(
            id=entry.id,
            timestamp=entry.created_at,
            user_id=entry.user_id or "",
            user_email=entry.user_email or "",
            category=SettingsCategory(entry.category),
            action=entry.action,
            changes=entry.changes,
            reason=entry.reason,
            ip_address=entry.ip_address,
            user_agent=entry.user_agent,
        )

    async def get_audit_logs(
        self,
        category: SettingsCategory | None = None,
        user_id: str | None = None,
        limit: int = 100,
        session: AsyncSession | None = None,
    ) -> list[AuditLog]:
        """
        Get audit logs for settings changes.

        Args:
            category: Filter by category
            user_id: Filter by user
            limit: Maximum number of logs to return

        Returns:
            List of audit logs
        """
        async with self._get_session(session) as db_session:
            try:
                stmt = (
                    select(AdminSettingsAuditEntry)
                    .order_by(AdminSettingsAuditEntry.created_at.desc())
                    .limit(limit)
                )

                if category:
                    stmt = stmt.where(AdminSettingsAuditEntry.category == category.value)

                if user_id:
                    stmt = stmt.where(AdminSettingsAuditEntry.user_id == user_id)

                result = await db_session.execute(stmt)
                entries = result.scalars().all()

                return [self._to_audit_log_model(entry) for entry in entries]
            except OperationalError:
                # Audit table doesn't exist (e.g., test environment)
                logger.debug(
                    "settings.audit.unavailable",
                    message="Audit table not available; returning empty list",
                )
                return []

    async def get_backups_count(self, session: AsyncSession | None = None) -> int:
        """Return the number of stored backups."""
        async with self._get_session(session) as db_session:
            try:
                result = await db_session.execute(
                    select(func.count()).select_from(AdminSettingsBackupEntry)
                )
                db_count = int(result.scalar_one())
                return max(db_count, len(self._backups))
            except OperationalError:
                # Backup table doesn't exist (e.g., test environment)
                return len(self._backups)

    def _format_export_data(self, export_data: dict[str, Any], format: str) -> str:
        """Format export data into the desired output format."""
        if format == "json":
            return json.dumps(export_data, indent=2, default=str)
        if format == "env":
            return self._to_env_format(export_data)
        if format == "yaml":
            # YAML support can be added via dependency; fallback to JSON formatting for now
            return json.dumps(export_data, indent=2, default=str)
        raise ValueError(f"Unsupported export format: {format}")

    def _collect_export_data_in_memory(
        self,
        categories: list[SettingsCategory],
        include_sensitive: bool,
    ) -> dict[str, Any]:
        """Collect export data using in-memory settings only (no DB access)."""
        export_data: dict[str, Any] = {}
        for category in categories:
            attr_name = self.CATEGORY_MAPPING.get(category)
            if attr_name and hasattr(self.settings, attr_name):
                settings_obj = getattr(self.settings, attr_name)
                data = settings_obj.model_dump()
                if not include_sensitive:
                    data = self._mask_sensitive_data(data)
                export_data[category.value] = data
        return export_data

    async def _export_settings_async(
        self,
        categories: list[SettingsCategory] | None = None,
        include_sensitive: bool = False,
        format: str = "json",
        session: AsyncSession | None = None,
    ) -> str:
        """
        Export settings to string format.

        Args:
            categories: Categories to export (all if None)
            include_sensitive: Include sensitive fields
            format: Export format (json, yaml, env)

        Returns:
            Exported settings string
        """
        if categories is None:
            categories = list(SettingsCategory)

        export_data = {}
        async with self._get_session(session) as db_session:
            for category in categories:
                attr_name = self.CATEGORY_MAPPING.get(category)
                if attr_name and hasattr(self.settings, attr_name):
                    await self._load_category_from_store(category, session=db_session)
                    settings_obj = getattr(self.settings, attr_name)
                    data = settings_obj.model_dump()

                    if not include_sensitive:
                        data = self._mask_sensitive_data(data)

                    export_data[category.value] = data

        return self._format_export_data(export_data, format)

    async def export_settings_async(
        self,
        categories: list[SettingsCategory] | None = None,
        include_sensitive: bool = False,
        format: str = "json",
        session: AsyncSession | None = None,
    ) -> str:
        """Async-friendly export method for router usage."""
        return await self._export_settings_async(
            categories=categories,
            include_sensitive=include_sensitive,
            format=format,
            session=session,
        )

    def export_settings(
        self,
        categories: list[SettingsCategory] | None = None,
        include_sensitive: bool = False,
        format: str = "json",
        session: AsyncSession | None = None,
    ) -> str:
        """Synchronous export retained for backwards compatibility."""
        categories = categories or list(SettingsCategory)

        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(
                self._export_settings_async(
                    categories=categories,
                    include_sensitive=include_sensitive,
                    format=format,
                    session=session,
                )
            )

        export_data = self._collect_export_data_in_memory(categories, include_sensitive)
        return self._format_export_data(export_data, format)

    # Helper methods

    def _extract_fields(
        self,
        settings_obj: BaseModel,
        include_sensitive: bool = False,
    ) -> list[SettingField]:
        """Extract fields from a settings object."""
        fields = []

        # Access model_fields from the class, not the instance (Pydantic v2.11+)
        model_class = type(settings_obj)
        for field_name, field_info in model_class.model_fields.items():
            value = getattr(settings_obj, field_name)
            is_sensitive = self._is_sensitive_field(field_name)

            # Mask sensitive values if needed
            if is_sensitive and not include_sensitive:
                value = "***MASKED***"

            fields.append(
                SettingField(
                    name=field_name,
                    value=value,
                    type=str(field_info.annotation),
                    description=field_info.description,
                    default=field_info.default,
                    required=field_info.is_required(),
                    sensitive=is_sensitive,
                    validation_rules=None,
                )
            )

        return fields

    def _is_sensitive_field(self, field_name: str) -> bool:
        """Check if a field is sensitive."""
        field_lower = field_name.lower()
        return any(sensitive in field_lower for sensitive in self.SENSITIVE_FIELDS)

    def _get_category_description(self, category: SettingsCategory) -> str:
        """Get description for a settings category."""
        descriptions = {
            SettingsCategory.DATABASE: "Database connection and pooling configuration",
            SettingsCategory.JWT: "JWT token generation and validation settings",
            SettingsCategory.REDIS: "Redis cache and session storage configuration",
            SettingsCategory.VAULT: "HashiCorp Vault integration settings",
            SettingsCategory.STORAGE: "Object storage (MinIO/S3) configuration",
            SettingsCategory.EMAIL: "Email and SMTP server settings",
            SettingsCategory.TENANT: "Multi-tenant configuration and isolation",
            SettingsCategory.CORS: "Cross-Origin Resource Sharing settings",
            SettingsCategory.RATE_LIMIT: "API rate limiting configuration",
            SettingsCategory.OBSERVABILITY: "Logging, tracing, and monitoring settings",
            SettingsCategory.CELERY: "Background task processing configuration",
            SettingsCategory.FEATURES: "Feature flags and toggles",
            SettingsCategory.BILLING: "Billing system configuration and subscription settings",
        }
        return descriptions.get(category, "")

    async def _get_last_update_info(
        self, session: AsyncSession, category: SettingsCategory
    ) -> dict[str, Any]:
        """Fetch last update info for category from persisted audit log."""
        try:
            stmt = (
                select(AdminSettingsAuditEntry)
                .where(AdminSettingsAuditEntry.category == category.value)
                .order_by(AdminSettingsAuditEntry.created_at.desc())
                .limit(1)
            )
            result = await session.execute(stmt)
            entry = result.scalar_one_or_none()
            if not entry:
                return {}

            return {
                "timestamp": entry.created_at,
                "user_email": entry.user_email,
                "user_id": entry.user_id,
            }
        except OperationalError:
            # Table doesn't exist (e.g., in test environment without migrations)
            return {}

    def _mask_sensitive_data(self, data: dict[str, Any]) -> dict[str, Any]:
        """Mask sensitive values in data dictionary."""
        masked: dict[str, Any] = {}
        for key, value in data.items():
            if self._is_sensitive_field(key):
                # Always mask sensitive fields, even if empty
                masked[key] = "***MASKED***" if value else "***MASKED***"
            elif isinstance(value, dict):
                masked[key] = self._mask_sensitive_data(value)
            else:
                masked[key] = value
        return masked

    def _to_env_format(self, data: dict[str, Any], prefix: str = "") -> str:
        """Convert settings data to environment variable format."""
        lines = []

        def process_dict(d: dict[str, Any], current_prefix: str) -> None:
            for key, value in d.items():
                env_key = f"{current_prefix}{key}".upper()

                if isinstance(value, dict):
                    process_dict(value, f"{env_key}__")
                elif isinstance(value, bool):
                    lines.append(f"{env_key}={str(value).lower()}")
                elif isinstance(value, (list, tuple)):
                    lines.append(f"{env_key}={','.join(str(v) for v in value)}")
                else:
                    lines.append(f"{env_key}={value}")

        for category, settings_data in data.items():
            process_dict(settings_data, f"{category.upper()}__")

        return "\n".join(lines)
