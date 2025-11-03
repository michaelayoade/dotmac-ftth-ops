"""
Test audit trail integration for admin settings service.
"""

import json

import pytest

from dotmac.platform.admin.settings.models import SettingsCategory, SettingsUpdateRequest
from dotmac.platform.admin.settings.service import SettingsManagementService

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.fixture
def service() -> SettingsManagementService:
    return SettingsManagementService()


async def test_get_category_settings_without_updates(service, async_db_session):
    response = await service.get_category_settings(
        SettingsCategory.DATABASE,
        session=async_db_session,
    )

    assert response.last_updated is None
    assert response.updated_by is None


async def test_get_category_settings_with_updates(service, async_db_session):
    update_request = SettingsUpdateRequest(
        updates={"pool_size": 20},
        reason="Testing audit trail",
    )

    await service.update_category_settings(
        category=SettingsCategory.DATABASE,
        update_request=update_request,
        user_id="test_user_123",
        user_email="test@example.com",
        session=async_db_session,
    )

    response = await service.get_category_settings(
        SettingsCategory.DATABASE,
        session=async_db_session,
    )

    assert response.updated_by == "test@example.com"
    assert response.last_updated is not None


async def test_multiple_updates_returns_most_recent(service, async_db_session):
    update_request1 = SettingsUpdateRequest(
        updates={"pool_size": 100},
        reason="First update",
    )
    await service.update_category_settings(
        SettingsCategory.DATABASE,
        update_request1,
        user_id="user1",
        user_email="user1@example.com",
        session=async_db_session,
    )

    update_request2 = SettingsUpdateRequest(
        updates={"pool_size": 200},
        reason="Second update",
    )
    await service.update_category_settings(
        SettingsCategory.DATABASE,
        update_request2,
        user_id="user2",
        user_email="user2@example.com",
        session=async_db_session,
    )

    response = await service.get_category_settings(
        SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert response.updated_by == "user2@example.com"

    logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert [log.user_email for log in logs][:2] == [
        "user2@example.com",
        "user1@example.com",
    ]


async def test_validate_only_updates_do_not_affect_audit(service, async_db_session):
    real_update = SettingsUpdateRequest(
        updates={"pool_size": 100},
        validate_only=False,
        reason="Real update",
    )
    await service.update_category_settings(
        SettingsCategory.DATABASE,
        real_update,
        user_id="real_user",
        user_email="real@example.com",
        session=async_db_session,
    )

    before_logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )

    validate_update = SettingsUpdateRequest(
        updates={"pool_size": 200},
        validate_only=True,
        reason="Validation only",
    )
    await service.update_category_settings(
        SettingsCategory.DATABASE,
        validate_update,
        user_id="validate_user",
        user_email="validate@example.com",
        session=async_db_session,
    )

    response = await service.get_category_settings(
        SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert response.updated_by == "real@example.com"

    after_logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert len(after_logs) == len(before_logs)


async def test_restore_backup_creates_audit_log(service, async_db_session):
    backup = service.create_backup(
        name="Test Backup",
        description="Testing backup restore audit",
        categories=[SettingsCategory.DATABASE],
        user_id="backup_creator",
    )

    await service.restore_backup(
        backup_id=backup.id,
        user_id="restore_user",
        user_email="restore@example.com",
        session=async_db_session,
    )

    response = await service.get_category_settings(
        SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert response.updated_by == "restore@example.com"

    logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert logs[0].action == "restore"


async def test_get_audit_logs_filtering(service, async_db_session):
    for index in range(3):
        await service.update_category_settings(
            SettingsCategory.DATABASE,
            SettingsUpdateRequest(
                updates={"pool_size": 50 + index},
                validate_only=False,
                reason=f"update-{index}",
            ),
            user_id=f"user-{index}",
            user_email=f"user-{index}@example.com",
            session=async_db_session,
        )

    logs = await service.get_audit_logs(
        limit=2,
        session=async_db_session,
    )
    assert len(logs) == 2

    user_logs = await service.get_audit_logs(
        user_id="user-1",
        session=async_db_session,
    )
    assert all(log.user_id == "user-1" for log in user_logs)

    db_logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )
    assert len(db_logs) >= 3


async def test_audit_log_serialization(service, async_db_session):
    await service.update_category_settings(
        SettingsCategory.DATABASE,
        SettingsUpdateRequest(
            updates={"pool_size": 75},
            validate_only=False,
            reason="serialize",
        ),
        user_id="user-serialize",
        user_email="serialize@example.com",
        session=async_db_session,
    )

    logs = await service.get_audit_logs(
        category=SettingsCategory.DATABASE,
        session=async_db_session,
    )
    payload = json.loads(json.dumps([log.model_dump(mode="json") for log in logs]))
    assert isinstance(payload, list)
    assert payload[0]["category"] == SettingsCategory.DATABASE.value
