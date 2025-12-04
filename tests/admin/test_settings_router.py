"""
Integration tests for admin settings management router.

Tests all API endpoints with authentication and authorization.
"""

import json
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from dotmac.platform.auth.core import UserInfo

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_admin_user():
    """Create a mock admin user."""
    return UserInfo(
        user_id="admin-123",
        username="admin",
        email="admin@example.com",
        roles=["admin"],
        permissions=["admin:settings:read", "admin:settings:write"],
        tenant_id="default",
    )


@pytest.fixture
def mock_regular_user():
    """Create a mock regular user."""
    return UserInfo(
        user_id="user-456",
        username="user",
        email="user@example.com",
        roles=["user"],
        permissions=["read"],
        tenant_id="default",
    )


@pytest.fixture
def mock_rbac_service():
    """Create a mock RBAC service that always grants permissions."""
    mock_service = AsyncMock()
    mock_service.user_has_all_permissions = AsyncMock(return_value=True)
    mock_service.user_has_any_permission = AsyncMock(return_value=True)
    mock_service.user_has_permission = AsyncMock(return_value=True)
    return mock_service


@pytest.fixture
def test_app(mock_admin_user, async_db_session):
    """Create a test FastAPI app with the router."""
    from dotmac.platform.admin.settings.router import router
    from dotmac.platform.auth.core import get_current_user
    from dotmac.platform.db import get_async_session, get_session_dependency

    app = FastAPI()

    # Override the underlying dependencies that PermissionChecker uses
    async def override_get_current_user():
        return mock_admin_user

    async def override_get_async_session():
        yield async_db_session

    async def override_get_session():
        yield async_db_session

    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_async_session] = override_get_async_session
    app.dependency_overrides[get_session_dependency] = override_get_session

    # Include the router with the same prefix as production
    app.include_router(router, prefix="/api/v1/admin/settings")

    return app


@pytest.fixture
def test_client(test_app, mock_rbac_service):
    """Create a test client with patched RBAC service."""
    # Patch RBACService to return our mock
    with patch(
        "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=mock_rbac_service
    ):
        client = TestClient(test_app)
        yield client


class TestSettingsRouterEndpoints:
    """Test all settings router endpoints."""

    def test_get_all_categories(self, test_client):
        """Test GET /api/v1/admin/settings/categories."""
        response = test_client.get("/api/v1/admin/settings/categories")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0

        # Check structure of category info
        category_info = data[0]
        assert "category" in category_info
        assert "display_name" in category_info
        assert "description" in category_info
        assert "fields_count" in category_info
        assert "has_sensitive_fields" in category_info

    def test_get_category_settings(self, test_client):
        """Test GET /api/v1/admin/settings/category/{category}."""
        response = test_client.get(
            "/api/v1/admin/settings/category/email", params={"include_sensitive": False}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "email"
        assert data["display_name"] == "Email & SMTP"
        assert "fields" in data
        assert isinstance(data["fields"], list)

        # Check sensitive fields are masked
        for field in data["fields"]:
            if field["sensitive"]:
                assert field["value"] in ["", "***MASKED***"]

    def test_get_category_settings_with_sensitive(self, test_client):
        """Test getting settings with sensitive fields included."""
        response = test_client.get(
            "/api/v1/admin/settings/category/email", params={"include_sensitive": True}
        )

        assert response.status_code == 200
        data = response.json()
        # Sensitive fields should show actual values (empty string by default)
        smtp_password_field = next(
            (f for f in data["fields"] if f["name"] == "smtp_password"), None
        )
        assert smtp_password_field is not None
        assert smtp_password_field["value"] == ""  # Default value

    def test_get_invalid_category(self, test_client):
        """Test getting settings for invalid category."""
        response = test_client.get("/api/v1/admin/settings/category/invalid_category")

        assert response.status_code == 422  # Validation error

    def test_validate_settings_valid(self, test_client):
        """Test POST /api/v1/admin/settings/validate."""
        response = test_client.post(
            "/api/v1/admin/settings/validate",
            params={"category": "email"},
            json={
                "smtp_host": "mail.example.com",
                "smtp_port": 587,
                "use_tls": True,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["errors"] == {}

    def test_validate_settings_invalid(self, test_client):
        """Test validation with invalid settings."""
        response = test_client.post(
            "/api/v1/admin/settings/validate",
            params={"category": "email"},
            json={
                "smtp_port": "not_a_number",  # Invalid type
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert len(data["errors"]) > 0

    def test_update_category_settings(self, test_client):
        """Test PUT /api/v1/admin/settings/category/{category}."""
        update_request = {
            "updates": {
                "smtp_host": "mail.example.com",
                "smtp_port": 465,
            },
            "validate_only": False,
            "reason": "Testing settings update",
        }

        response = test_client.put(
            "/api/v1/admin/settings/category/email",
            json=update_request,
            headers={"User-Agent": "pytest"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "email"

        # Check the values were updated
        smtp_host_field = next((f for f in data["fields"] if f["name"] == "smtp_host"), None)
        assert smtp_host_field["value"] == "mail.example.com"

    def test_update_with_validation_failure(self, test_client):
        """Test update with validation failure."""
        update_request = {
            "updates": {
                "smtp_port": "invalid",
            },
            "validate_only": False,
        }

        response = test_client.put("/api/v1/admin/settings/category/email", json=update_request)

        assert response.status_code == 400
        data = response.json()
        assert "errors" in data

    def test_bulk_update_settings(self, test_client):
        """Test POST /api/v1/admin/settings/bulk-update."""
        bulk_request = {
            "updates": {
                "email": {
                    "smtp_host": "bulk-mail.example.com",
                    "smtp_port": 587,
                },
                "tenant": {
                    "mode": "multi",
                    "strict_isolation": True,
                },
            },
            "validate_only": False,
            "reason": "Bulk configuration update",
        }

        response = test_client.post("/api/v1/admin/settings/bulk-update", json=bulk_request)

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "errors" in data
        assert "summary" in data
        assert "email" in data["results"]
        assert "tenant" in data["results"]

    def test_create_backup(self, test_client):
        """Test POST /api/v1/admin/settings/backup."""
        response = test_client.post(
            "/api/v1/admin/settings/backup",
            json={
                "name": "Test Backup",
                "description": "Testing backup functionality",
                "categories": ["email", "tenant"],  # Categories to backup
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Backup"
        assert data["description"] == "Testing backup functionality"
        assert "id" in data
        assert "created_at" in data
        assert "email" in data["categories"]
        assert "tenant" in data["categories"]

    def test_restore_backup(self, test_client):
        """Test POST /api/v1/admin/settings/restore/{backup_id}."""
        # First create a backup
        create_response = test_client.post(
            "/api/v1/admin/settings/backup",
            json={"name": "Restore Test", "categories": ["email"]},
        )
        backup_id = create_response.json()["id"]

        # Then restore it
        response = test_client.post(f"/api/v1/admin/settings/restore/{backup_id}")

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Settings restored successfully"
        assert "email" in data["categories"]

    def test_restore_invalid_backup(self, test_client):
        """Test restore with invalid backup ID."""
        invalid_id = str(uuid4())
        response = test_client.post(f"/api/v1/admin/settings/restore/{invalid_id}")

        assert response.status_code == 404

    def test_restore_backup_after_service_restart(self, test_client):
        """Test that backup can be restored after simulating service restart.

        This test catches a critical bug where the backup ID returned by POST /backup
        differs from the database ID, causing restore to fail after service restart.
        """
        from dotmac.platform.admin.settings.router import settings_service

        # Create a backup
        create_response = test_client.post(
            "/api/v1/admin/settings/backup",
            json={
                "name": "Restart Test",
                "description": "Test after restart",
                "categories": ["email"],
            },
        )
        assert create_response.status_code == 200
        backup_data = create_response.json()
        backup_id = backup_data["id"]

        # Verify backup ID matches what's stored
        assert backup_data["name"] == "Restart Test"
        assert backup_data["description"] == "Test after restart"

        # Simulate service restart by clearing in-memory cache
        settings_service._backups.clear()

        # Restore should still work by loading from database
        restore_response = test_client.post(f"/api/v1/admin/settings/restore/{backup_id}")

        # Should succeed (loads from DB when not in cache)
        assert restore_response.status_code == 200
        restore_data = restore_response.json()
        assert restore_data["message"] == "Settings restored successfully"
        assert "email" in restore_data["categories"]

    def test_get_audit_logs(self, test_client):
        """Test GET /api/v1/admin/settings/audit-logs."""
        # First make some changes to create audit logs
        test_client.put(
            "/api/v1/admin/settings/category/email",
            json={
                "updates": {"smtp_host": "audit-test.com"},
                "validate_only": False,
            },
        )

        response = test_client.get(
            "/api/v1/admin/settings/audit-logs", params={"category": "email", "limit": 10}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        # Audit logging must have created at least one entry
        assert len(data) > 0, "Expected audit log entry after making settings change"

        log = data[0]
        assert "id" in log
        assert "timestamp" in log
        assert "user_id" in log
        assert "category" in log
        assert "action" in log
        assert "changes" in log

    def test_export_settings_json(self, test_client):
        """Test POST /api/v1/admin/settings/export."""
        export_request = {
            "categories": ["email", "tenant"],
            "include_sensitive": False,
            "format": "json",
        }

        response = test_client.post("/api/v1/admin/settings/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "json"
        assert "data" in data

        # Parse exported JSON
        exported = json.loads(data["data"])
        assert "email" in exported
        assert "tenant" in exported

        # Check sensitive fields are masked
        if "smtp_password" in exported["email"]:
            assert exported["email"]["smtp_password"] == "***MASKED***"

    def test_export_settings_env(self, test_client):
        """Test export to environment variable format."""
        export_request = {"categories": ["email"], "include_sensitive": True, "format": "env"}

        response = test_client.post("/api/v1/admin/settings/export", json=export_request)

        assert response.status_code == 200
        data = response.json()
        assert data["format"] == "env"
        assert "EMAIL__SMTP_HOST=" in data["data"]
        assert "EMAIL__SMTP_PORT=" in data["data"]

    def test_import_settings(self, test_client):
        """Test POST /api/v1/admin/settings/import."""
        import_request = {
            "data": {
                "email": {
                    "smtp_host": "imported.example.com",
                    "smtp_port": 2525,
                    "use_tls": True,
                }
            },
            "categories": ["email"],
            "validate_only": False,
            "reason": "Import from backup",
        }

        response = test_client.post("/api/v1/admin/settings/import", json=import_request)

        assert response.status_code == 200
        data = response.json()
        assert "email" in data["imported"]
        assert data["validate_only"] is False

    def test_import_with_validation_only(self, test_client):
        """Test import with validate_only flag."""
        import_request = {
            "data": {
                "email": {
                    "smtp_port": "invalid",  # Invalid value
                }
            },
            "validate_only": True,
        }

        response = test_client.post("/api/v1/admin/settings/import", json=import_request)

        assert response.status_code == 400
        data = response.json()
        assert "errors" in data["detail"]

    def test_reset_to_defaults_not_implemented(self, test_client):
        """Test POST /api/v1/admin/settings/reset/{category}."""
        response = test_client.post("/api/v1/admin/settings/reset/email")

        assert response.status_code == 501  # Not Implemented
        data = response.json()
        assert "not yet implemented" in data["detail"].lower()

    def test_settings_health_check(self, test_client):
        """Test GET /api/v1/admin/settings/health."""
        response = test_client.get("/api/v1/admin/settings/health")

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "categories_available" in data
        assert "audit_logs_count" in data
        assert "backups_count" in data


class TestAuthorizationAndSecurity:
    """Test authorization and security aspects."""

    def test_non_admin_access_denied(self, test_app, mock_regular_user, mock_rbac_service):
        """Test that non-admin users are denied access."""
        # Make the RBAC service return False for permission checks
        mock_rbac_deny = AsyncMock()
        mock_rbac_deny.user_has_all_permissions = AsyncMock(return_value=False)
        mock_rbac_deny.user_has_any_permission = AsyncMock(return_value=False)
        mock_rbac_deny.user_has_permission = AsyncMock(return_value=False)

        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.get("/api/v1/admin/settings/categories")
            assert response.status_code == 403

    def test_audit_log_captures_user_info(self, test_client):
        """Test that audit logs capture user information."""
        # Make a change
        test_client.put(
            "/api/v1/admin/settings/category/email",
            json={
                "updates": {"from_name": "Test Platform"},
                "validate_only": False,
                "reason": "Testing audit",
            },
            headers={"User-Agent": "Test Browser"},
        )

        # Check audit logs
        response = test_client.get("/api/v1/admin/settings/audit-logs")
        logs = response.json()

        # Must have at least one audit log entry
        assert len(logs) > 0, "Expected audit log entry capturing user info"

        latest_log = logs[0]
        assert latest_log["user_id"] == "admin-123"
        assert latest_log["user_email"] == "admin@example.com"
        assert latest_log["reason"] == "Testing audit"

    def test_sensitive_fields_masked_by_default(self, test_client):
        """Test that sensitive fields are masked by default."""
        response = test_client.get("/api/v1/admin/settings/category/vault")
        data = response.json()

        # Find token field
        token_field = next((f for f in data["fields"] if f["name"] == "token"), None)

        if token_field:
            assert token_field["sensitive"] is True
            if token_field["value"]:
                assert token_field["value"] == "***MASKED***"


class TestErrorHandling:
    """Test error handling scenarios."""

    def test_invalid_category_enum(self, test_client):
        """Test handling of invalid category enum value."""
        response = test_client.get("/api/v1/admin/settings/category/nonexistent")
        assert response.status_code == 422

    def test_empty_update_request(self, test_client):
        """Test handling of empty update request."""
        response = test_client.put("/api/v1/admin/settings/category/email", json={"updates": {}})
        assert response.status_code == 422  # Validation error for empty updates

    def test_malformed_backup_id(self, test_client):
        """Test restore with malformed backup ID."""
        response = test_client.post("/api/v1/admin/settings/restore/not-a-uuid")
        assert response.status_code == 404

    def test_unsupported_export_format(self, test_client):
        """Test export with unsupported format."""
        export_request = {
            "format": "xml"
        }  # Unsupported format (only json, yaml, env are supported)

        response = test_client.post("/api/v1/admin/settings/export", json=export_request)

        # Should reject unsupported format with 400 error
        assert response.status_code == 400
        data = response.json()
        assert "detail" in data
        assert "Unsupported export format" in data["detail"]


class TestAdminSettingsPermissions:
    """Test that all endpoints properly enforce permission requirements."""

    def setup_method(self):
        """Create mock RBAC service that denies permissions."""
        self.mock_rbac_deny = AsyncMock()
        self.mock_rbac_deny.user_has_all_permissions = AsyncMock(return_value=False)
        self.mock_rbac_deny.user_has_any_permission = AsyncMock(return_value=False)
        self.mock_rbac_deny.user_has_permission = AsyncMock(return_value=False)

    def test_categories_requires_read_permission(self, test_app):
        """Test GET /categories requires settings.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.get("/api/v1/admin/settings/categories")
            assert response.status_code == 403

            # Verify the correct permission was checked
            self.mock_rbac_deny.user_has_all_permissions.assert_called()
            assert ["settings.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_get_category_requires_read_permission(self, test_app):
        """Test GET /category/{category} requires settings.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.get("/api/v1/admin/settings/category/email")
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_update_category_requires_update_permission(self, test_app):
        """Test PUT /category/{category} requires settings.update permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.put(
                "/api/v1/admin/settings/category/email",
                json={"updates": {"smtp_host": "smtp.example.com"}},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.update"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_validate_requires_read_permission(self, test_app):
        """Test POST /validate requires settings.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post(
                "/api/v1/admin/settings/validate",
                params={"category": "email"},
                json={"smtp_host": "test"},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_bulk_update_requires_update_permission(self, test_app):
        """Test POST /bulk-update requires settings.update permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post(
                "/api/v1/admin/settings/bulk-update",
                json={"updates": {"email": {"smtp_host": "test.example.com"}}},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.update"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_backup_requires_backup_permission(self, test_app):
        """Test POST /backup requires settings.backup permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post(
                "/api/v1/admin/settings/backup",
                json={"name": "test", "description": "test"},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.backup"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_restore_requires_restore_permission(self, test_app):
        """Test POST /restore/{backup_id} requires settings.restore permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            backup_id = str(uuid4())
            response = client.post(f"/api/v1/admin/settings/restore/{backup_id}")
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.restore"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_audit_logs_requires_audit_read_permission(self, test_app):
        """Test GET /audit-logs requires settings.audit.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.get("/api/v1/admin/settings/audit-logs")
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.audit.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_export_requires_export_permission(self, test_app):
        """Test POST /export requires settings.export permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post(
                "/api/v1/admin/settings/export",
                json={"format": "json"},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.export"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_import_requires_import_permission(self, test_app):
        """Test POST /import requires settings.import permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post(
                "/api/v1/admin/settings/import",
                json={"data": {}},
            )
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.import"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_reset_requires_reset_permission(self, test_app):
        """Test POST /reset/{category} requires settings.reset permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.post("/api/v1/admin/settings/reset/email")
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.reset"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]

    def test_health_requires_read_permission(self, test_app):
        """Test GET /health requires settings.read permission."""
        with patch(
            "dotmac.platform.auth.rbac_dependencies.RBACService", return_value=self.mock_rbac_deny
        ):
            client = TestClient(test_app)
            response = client.get("/api/v1/admin/settings/health")
            assert response.status_code == 403

            # Verify the correct permission was checked
            assert ["settings.read"] in [
                call[0][1] for call in self.mock_rbac_deny.user_has_all_permissions.call_args_list
            ]
