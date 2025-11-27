"""
Tests for admin settings management functionality.
"""

import json

import pytest

from dotmac.platform.admin.settings.models import (
    SettingsCategory,
    SettingsCategoryInfo,
    SettingsResponse,
    SettingsUpdateRequest,
    SettingsValidationResult,
)
from dotmac.platform.admin.settings.service import SettingsManagementService

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.fixture
def service() -> SettingsManagementService:
    """Create a settings management service instance."""
    return SettingsManagementService()


async def test_get_all_categories(service: SettingsManagementService, async_db_session):
    """Test getting all available settings categories."""
    categories = await service.get_all_categories(session=async_db_session)

    assert len(categories) > 0
    assert all(isinstance(cat, SettingsCategoryInfo) for cat in categories)

    category_names = [cat.category for cat in categories]
    assert SettingsCategory.DATABASE in category_names
    assert SettingsCategory.JWT in category_names
    assert SettingsCategory.EMAIL in category_names
    assert SettingsCategory.TENANT in category_names


async def test_get_category_settings(service: SettingsManagementService, async_db_session):
    """Test getting settings for a specific category."""
    response = await service.get_category_settings(
        SettingsCategory.EMAIL,
        include_sensitive=False,
        session=async_db_session,
    )

    assert isinstance(response, SettingsResponse)
    assert response.category == SettingsCategory.EMAIL
    assert response.display_name == "Email & SMTP"
    assert len(response.fields) > 0

    smtp_password_field = next((f for f in response.fields if f.name == "smtp_password"), None)
    assert smtp_password_field is not None
    assert smtp_password_field.sensitive is True
    assert smtp_password_field.value == "***MASKED***"


async def test_get_category_settings_with_sensitive(
    service: SettingsManagementService, async_db_session
):
    """Test getting settings with sensitive fields included."""
    response = await service.get_category_settings(
        SettingsCategory.EMAIL,
        include_sensitive=True,
        session=async_db_session,
    )

    smtp_password_field = next((f for f in response.fields if f.name == "smtp_password"), None)
    assert smtp_password_field is not None
    assert smtp_password_field.value == ""


def test_validate_settings_valid(service: SettingsManagementService):
    """Test validating valid settings updates."""
    result = service.validate_settings(
        SettingsCategory.EMAIL,
        {
            "smtp_host": "mail.example.com",
            "smtp_port": 587,
            "use_tls": True,
        },
    )

    assert isinstance(result, SettingsValidationResult)
    assert result.valid is True
    assert len(result.errors) == 0


def test_validate_settings_invalid(service: SettingsManagementService):
    """Test validating invalid settings updates."""
    result = service.validate_settings(
        SettingsCategory.EMAIL,
        {
            "smtp_port": "not_a_number",
        },
    )

    assert result.valid is False
    assert len(result.errors) > 0


def test_validate_settings_restart_required(service: SettingsManagementService):
    """Test detecting when settings changes require restart."""
    result = service.validate_settings(
        SettingsCategory.DATABASE,
        {
            "host": "new-db-host.com",
        },
    )

    assert result.restart_required is True
    assert "host" in result.warnings


async def test_update_category_settings(service: SettingsManagementService, async_db_session):
    """Test updating settings for a category."""
    update_request = SettingsUpdateRequest(
        updates={
            "smtp_host": "mail.example.com",
            "smtp_port": 465,
        },
        validate_only=False,
        reason="Testing settings update",
    )

    response = await service.update_category_settings(
        SettingsCategory.EMAIL,
        update_request,
        user_id="test-admin",
        user_email="admin@example.com",
        ip_address="127.0.0.1",
        user_agent="pytest",
        session=async_db_session,
    )

    assert isinstance(response, SettingsResponse)
    smtp_host_field = next((f for f in response.fields if f.name == "smtp_host"), None)
    assert smtp_host_field.value == "mail.example.com"

    logs = await service.get_audit_logs(session=async_db_session)
    assert len(logs) >= 1
    latest = logs[0]
    assert latest.user_id == "test-admin"
    assert latest.category == SettingsCategory.EMAIL
    assert "smtp_host" in latest.changes


async def test_update_category_settings_validate_only(
    service: SettingsManagementService, async_db_session
):
    """Test updating settings in validate-only mode."""
    before_logs = await service.get_audit_logs(session=async_db_session)

    update_request = SettingsUpdateRequest(
        updates={"smtp_host": "mail.example.com"},
        validate_only=True,
    )

    response = await service.update_category_settings(
        SettingsCategory.EMAIL,
        update_request,
        user_id="test-admin",
        user_email="admin@example.com",
        session=async_db_session,
    )

    assert isinstance(response, SettingsResponse)

    after_logs = await service.get_audit_logs(session=async_db_session)
    assert len(after_logs) == len(before_logs)


async def test_create_and_restore_backup(service: SettingsManagementService, async_db_session):
    """Test creating and restoring a settings backup."""
    update_request = SettingsUpdateRequest(
        updates={"smtp_host": "backup-test.example.com"},
        validate_only=False,
    )
    await service.update_category_settings(
        SettingsCategory.EMAIL,
        update_request,
        user_id="test-admin",
        user_email="admin@example.com",
        session=async_db_session,
    )

    backup = service.create_backup(
        name="Test Backup",
        description="Testing backup functionality",
        categories=[SettingsCategory.EMAIL],
        user_id="test-admin",
    )

    assert backup.name == "Test Backup"
    assert SettingsCategory.EMAIL in backup.categories
    assert SettingsCategory.EMAIL.value in backup.settings_data

    update_request2 = SettingsUpdateRequest(
        updates={"smtp_host": "different-host.example.com"},
        validate_only=False,
    )
    await service.update_category_settings(
        SettingsCategory.EMAIL,
        update_request2,
        user_id="test-admin",
        user_email="admin@example.com",
        session=async_db_session,
    )

    restored = await service.restore_backup(
        backup.id,
        user_id="test-admin",
        user_email="admin@example.com",
        session=async_db_session,
    )

    assert SettingsCategory.EMAIL in restored

    email_settings = await service.get_category_settings(
        SettingsCategory.EMAIL,
        session=async_db_session,
    )
    smtp_host_field = next((f for f in email_settings.fields if f.name == "smtp_host"), None)
    assert smtp_host_field.value == "backup-test.example.com"


async def test_get_audit_logs(service: SettingsManagementService, async_db_session):
    """Test retrieving audit logs with filters."""
    for i in range(5):
        update_request = SettingsUpdateRequest(
            updates={"smtp_host": f"host-{i}.example.com"},
            validate_only=False,
        )
        await service.update_category_settings(
            SettingsCategory.EMAIL,
            update_request,
            user_id=f"admin-{i}",
            user_email=f"admin-{i}@example.com",
            session=async_db_session,
        )

    logs = await service.get_audit_logs(session=async_db_session)
    assert len(logs) >= 5

    email_logs = await service.get_audit_logs(
        category=SettingsCategory.EMAIL,
        session=async_db_session,
    )
    assert all(log.category == SettingsCategory.EMAIL for log in email_logs)

    user_logs = await service.get_audit_logs(user_id="admin-0", session=async_db_session)
    assert all(log.user_id == "admin-0" for log in user_logs)


def test_export_settings_json(service: SettingsManagementService):
    """Test exporting settings to JSON format."""
    exported = service.export_settings(
        categories=[SettingsCategory.EMAIL, SettingsCategory.TENANT],
        include_sensitive=False,
        format="json",
    )

    assert isinstance(exported, str)
    data = json.loads(exported)
    assert "email" in data
    assert "tenant" in data
    assert "***MASKED***" in str(data["email"].get("smtp_password", ""))


def test_export_settings_env(service: SettingsManagementService):
    """Test exporting settings to environment variable format."""
    exported = service.export_settings(
        categories=[SettingsCategory.EMAIL],
        include_sensitive=True,
        format="env",
    )

    assert isinstance(exported, str)
    assert "EMAIL__SMTP_HOST=" in exported
    assert "EMAIL__SMTP_PORT=" in exported
    assert "EMAIL__USE_TLS=" in exported


def test_sensitive_field_detection(service: SettingsManagementService):
    """Test that sensitive fields are properly detected."""
    assert service._is_sensitive_field("password") is True
    assert service._is_sensitive_field("smtp_password") is True
    assert service._is_sensitive_field("secret_key") is True
    assert service._is_sensitive_field("api_key") is True
    assert service._is_sensitive_field("database_password") is True
    assert service._is_sensitive_field("token") is True

    assert service._is_sensitive_field("host") is False
    assert service._is_sensitive_field("port") is False
    assert service._is_sensitive_field("enabled") is False


async def test_tenant_settings_available(service: SettingsManagementService, async_db_session):
    """Test that tenant settings are available."""
    response = await service.get_category_settings(
        SettingsCategory.TENANT,
        session=async_db_session,
    )

    assert response.category == SettingsCategory.TENANT
    assert response.display_name == "Multi-tenancy"

    field_names = [f.name for f in response.fields]
    assert "mode" in field_names
    assert "default_tenant_id" in field_names
    assert "require_tenant_header" in field_names
    assert "tenant_header_name" in field_names
    assert "strict_isolation" in field_names
    assert "max_users_per_tenant" in field_names


async def test_invalid_category_error(service: SettingsManagementService):
    """Test error handling for invalid category."""
    with pytest.raises(ValueError):
        await service.get_category_settings("invalid_category")  # type: ignore[arg-type]


async def test_invalid_field_update_error(service: SettingsManagementService, async_db_session):
    """Test error handling for invalid field in update."""
    update_request = SettingsUpdateRequest(
        updates={"non_existent_field": "value"},
        validate_only=False,
    )

    with pytest.raises(ValueError):
        await service.update_category_settings(
            SettingsCategory.EMAIL,
            update_request,
            user_id="test-admin",
            user_email="admin@example.com",
            session=async_db_session,
        )
