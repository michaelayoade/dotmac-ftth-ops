"""Comprehensive tests for RBAC audit logging."""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from dotmac.platform.audit.models import ActivitySeverity, ActivityType
from dotmac.platform.auth.rbac_audit import RBACAuditLogger, rbac_audit_logger

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.mark.asyncio
class TestRBACAuditLogger:
    """Test RBAC audit logger functionality."""

    @pytest.fixture
    def mock_audit_service(self):
        """Create mock audit service."""
        service = MagicMock()
        service.log_activity = AsyncMock()
        return service

    @pytest.fixture
    def audit_logger(self, mock_audit_service):
        """Create audit logger with mock service."""
        return RBACAuditLogger(audit_service=mock_audit_service)

    async def test_initialization_with_service(self, mock_audit_service):
        """Test initialization with provided audit service."""
        logger = RBACAuditLogger(audit_service=mock_audit_service)
        assert logger._audit_service == mock_audit_service

    async def test_initialization_without_service(self):
        """Test initialization creates default audit service."""
        with patch("dotmac.platform.auth.rbac_audit.AuditService") as MockAuditService:
            mock_service = MagicMock()
            MockAuditService.return_value = mock_service

            logger = RBACAuditLogger()

            assert logger._audit_service == mock_service
            MockAuditService.assert_called_once()

    async def test_log_role_created(self, audit_logger, mock_audit_service):
        """Test logging role creation."""
        role_name = "test_role"
        role_id = str(uuid4())
        created_by = str(uuid4())
        tenant_id = "tenant-123"
        permissions = ["read:users", "write:users"]

        await audit_logger.log_role_created(
            role_name=role_name,
            role_id=role_id,
            created_by=created_by,
            tenant_id=tenant_id,
            permissions=permissions,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.ROLE_CREATED
        assert call_kwargs["action"] == "create_role"
        assert role_name in call_kwargs["description"]
        assert call_kwargs["user_id"] == created_by
        assert call_kwargs["tenant_id"] == tenant_id
        assert call_kwargs["resource_type"] == "role"
        assert call_kwargs["resource_id"] == role_id
        assert call_kwargs["severity"] == ActivitySeverity.MEDIUM
        assert call_kwargs["details"]["role_name"] == role_name
        assert call_kwargs["details"]["permissions"] == permissions

    async def test_log_role_updated(self, audit_logger, mock_audit_service):
        """Test logging role update."""
        role_name = "test_role"
        role_id = str(uuid4())
        updated_by = str(uuid4())
        tenant_id = "tenant-123"
        changes = {"display_name": "New Display Name"}

        await audit_logger.log_role_updated(
            role_name=role_name,
            role_id=role_id,
            updated_by=updated_by,
            tenant_id=tenant_id,
            changes=changes,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.ROLE_UPDATED
        assert call_kwargs["action"] == "update_role"
        assert call_kwargs["severity"] == ActivitySeverity.MEDIUM
        assert call_kwargs["details"]["changes"] == changes

    async def test_log_role_deleted(self, audit_logger, mock_audit_service):
        """Test logging role deletion."""
        role_name = "test_role"
        role_id = str(uuid4())
        deleted_by = str(uuid4())
        tenant_id = "tenant-123"

        await audit_logger.log_role_deleted(
            role_name=role_name,
            role_id=role_id,
            deleted_by=deleted_by,
            tenant_id=tenant_id,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.ROLE_DELETED
        assert call_kwargs["action"] == "delete_role"
        assert call_kwargs["severity"] == ActivitySeverity.HIGH

    async def test_log_role_assigned(self, audit_logger, mock_audit_service):
        """Test logging role assignment."""
        user_id = str(uuid4())
        role_name = "admin"
        role_id = str(uuid4())
        assigned_by = str(uuid4())
        tenant_id = "tenant-123"
        expires_at = datetime.now(UTC).isoformat()

        await audit_logger.log_role_assigned(
            user_id=user_id,
            role_name=role_name,
            role_id=role_id,
            assigned_by=assigned_by,
            tenant_id=tenant_id,
            expires_at=expires_at,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.ROLE_ASSIGNED
        assert call_kwargs["action"] == "assign_role"
        assert call_kwargs["resource_type"] == "user"
        assert call_kwargs["resource_id"] == user_id
        assert call_kwargs["details"]["target_user_id"] == user_id
        assert call_kwargs["details"]["role_name"] == role_name
        assert call_kwargs["details"]["expires_at"] == expires_at

    async def test_log_role_revoked(self, audit_logger, mock_audit_service):
        """Test logging role revocation."""
        user_id = str(uuid4())
        role_name = "admin"
        role_id = str(uuid4())
        revoked_by = str(uuid4())
        tenant_id = "tenant-123"
        reason = "User left team"

        await audit_logger.log_role_revoked(
            user_id=user_id,
            role_name=role_name,
            role_id=role_id,
            revoked_by=revoked_by,
            tenant_id=tenant_id,
            reason=reason,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.ROLE_REVOKED
        assert call_kwargs["action"] == "revoke_role"
        assert call_kwargs["details"]["reason"] == reason

    async def test_log_permission_granted(self, audit_logger, mock_audit_service):
        """Test logging permission grant."""
        user_id = str(uuid4())
        permission_name = "admin.users.delete"
        permission_id = str(uuid4())
        granted_by = str(uuid4())
        tenant_id = "tenant-123"
        expires_at = datetime.now(UTC).isoformat()

        await audit_logger.log_permission_granted(
            user_id=user_id,
            permission_name=permission_name,
            permission_id=permission_id,
            granted_by=granted_by,
            tenant_id=tenant_id,
            expires_at=expires_at,
            reason="Temporary escalation",
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.PERMISSION_GRANTED
        assert call_kwargs["action"] == "grant_permission"
        assert call_kwargs["details"]["permission_name"] == permission_name
        assert call_kwargs["details"]["expires_at"] == expires_at
        assert call_kwargs["details"]["reason"] == "Temporary escalation"

    async def test_log_permission_revoked(self, audit_logger, mock_audit_service):
        """Test logging permission revocation."""
        user_id = str(uuid4())
        permission_name = "admin.users.delete"
        permission_id = str(uuid4())
        revoked_by = str(uuid4())
        tenant_id = "tenant-123"

        await audit_logger.log_permission_revoked(
            user_id=user_id,
            permission_name=permission_name,
            permission_id=permission_id,
            revoked_by=revoked_by,
            tenant_id=tenant_id,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.PERMISSION_REVOKED
        assert call_kwargs["action"] == "revoke_permission"

    async def test_log_permission_created(self, audit_logger, mock_audit_service):
        """Test logging permission creation."""
        permission_name = "new.permission"
        permission_id = str(uuid4())
        created_by = str(uuid4())
        tenant_id = "tenant-123"
        category = "ADMIN"

        await audit_logger.log_permission_created(
            permission_name=permission_name,
            permission_id=permission_id,
            created_by=created_by,
            tenant_id=tenant_id,
            category=category,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.PERMISSION_CREATED
        assert call_kwargs["action"] == "create_permission"
        assert call_kwargs["severity"] == ActivitySeverity.LOW
        assert call_kwargs["details"]["category"] == category

    async def test_log_permission_updated(self, audit_logger, mock_audit_service):
        """Test logging permission update."""
        permission_name = "existing.permission"
        permission_id = str(uuid4())
        updated_by = str(uuid4())
        tenant_id = "tenant-123"
        changes = {"display_name": "Updated Name", "is_active": False}

        await audit_logger.log_permission_updated(
            permission_name=permission_name,
            permission_id=permission_id,
            updated_by=updated_by,
            tenant_id=tenant_id,
            changes=changes,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.PERMISSION_UPDATED
        assert call_kwargs["action"] == "update_permission"
        assert call_kwargs["severity"] == ActivitySeverity.LOW
        assert call_kwargs["details"]["changes"] == changes

    async def test_log_permission_deleted(self, audit_logger, mock_audit_service):
        """Test logging permission deletion."""
        permission_name = "old.permission"
        permission_id = str(uuid4())
        deleted_by = str(uuid4())
        tenant_id = "tenant-123"

        await audit_logger.log_permission_deleted(
            permission_name=permission_name,
            permission_id=permission_id,
            deleted_by=deleted_by,
            tenant_id=tenant_id,
        )

        mock_audit_service.log_activity.assert_called_once()
        call_kwargs = mock_audit_service.log_activity.call_args.kwargs

        assert call_kwargs["activity_type"] == ActivityType.PERMISSION_DELETED
        assert call_kwargs["action"] == "delete_permission"
        assert call_kwargs["severity"] == ActivitySeverity.HIGH

    async def test_global_instance_exists(self):
        """Test global rbac_audit_logger instance exists."""
        assert rbac_audit_logger is not None
        assert isinstance(rbac_audit_logger, RBACAuditLogger)

    async def test_extra_kwargs_passed_through(self, audit_logger, mock_audit_service):
        """Test that extra kwargs are passed to audit details."""
        await audit_logger.log_role_created(
            role_name="test",
            role_id=str(uuid4()),
            created_by=str(uuid4()),
            tenant_id="tenant-123",
            permissions=[],
            custom_field="custom_value",
            another_field=123,
        )

        call_kwargs = mock_audit_service.log_activity.call_args.kwargs
        assert call_kwargs["details"]["custom_field"] == "custom_value"
        assert call_kwargs["details"]["another_field"] == 123
