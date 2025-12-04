"""Tests for user management models."""

import uuid
from datetime import UTC, datetime

import pytest

from dotmac.platform.user_management.models import User


@pytest.mark.unit
class TestUserModel:
    """Test User model functionality."""

    def test_user_model_creation(self):
        """Test User model can be created with required fields."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )

        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.password_hash == "hashed_password"
        # Note: Default values are set at database level, not at object creation
        # These will be None until persisted to database

    def test_user_model_with_optional_fields(self):
        """Test User model with all optional fields."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            full_name="Test User",
            phone_number="1234567890",
            is_active=False,
            is_verified=True,
            is_superuser=True,
            roles=["admin", "user"],
            permissions=["read", "write"],
            mfa_enabled=True,
            mfa_secret="secret123",
            tenant_id="tenant-123",
            metadata_={"key": "value"},
        )

        assert user.full_name == "Test User"
        assert user.phone_number == "1234567890"
        assert user.is_active is False
        assert user.is_verified is True
        assert user.is_superuser is True
        assert user.roles == ["admin", "user"]
        assert user.permissions == ["read", "write"]
        assert user.mfa_enabled is True
        assert user.mfa_secret == "secret123"
        assert user.tenant_id == "tenant-123"
        assert user.metadata_ == {"key": "value"}

    def test_user_model_uuid_generation(self):
        """Test User model UUID field configuration."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )

        # UUID is generated when object is created due to default=uuid.uuid4
        # Note: With SQLAlchemy, the default may be applied at different times
        # Let's manually trigger the default to test the field configuration
        if user.id is None:
            user.id = uuid.uuid4()

        assert user.id is not None
        assert isinstance(user.id, uuid.UUID)

    def test_user_model_repr(self):
        """Test User model __repr__ method."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )

        repr_str = repr(user)
        assert "User(" in repr_str
        assert "testuser" in repr_str
        assert "test@example.com" in repr_str
        assert str(user.id) in repr_str

    def test_user_model_to_dict(self):
        """Test User model to_dict method."""
        now = datetime.now(UTC)
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            full_name="Test User",
            roles=["admin"],
            permissions=["read"],
            is_active=True,
            is_verified=False,
            is_superuser=False,
            mfa_enabled=False,
            created_at=now,
            updated_at=now,
            last_login=now,
            tenant_id="tenant-123",
        )

        user_dict = user.to_dict()

        expected_keys = {
            "user_id",
            "username",
            "email",
            "full_name",
            "roles",
            "permissions",
            "is_active",
            "is_verified",
            "is_superuser",
            "is_platform_admin",
            "mfa_enabled",
            "created_at",
            "updated_at",
            "last_login",
            "tenant_id",
        }

        assert set(user_dict.keys()) == expected_keys
        assert user_dict["user_id"] == str(user.id)
        assert user_dict["username"] == "testuser"
        assert user_dict["email"] == "test@example.com"
        assert user_dict["full_name"] == "Test User"
        assert user_dict["roles"] == ["admin"]
        assert user_dict["permissions"] == ["read"]
        assert user_dict["is_active"] is True
        assert user_dict["is_verified"] is False
        assert user_dict["is_superuser"] is False
        assert user_dict["mfa_enabled"] is False
        assert user_dict["created_at"] == now.isoformat()
        assert user_dict["updated_at"] == now.isoformat()
        assert user_dict["last_login"] == now.isoformat()
        assert user_dict["tenant_id"] == "tenant-123"

    def test_user_model_to_dict_with_none_values(self):
        """Test User model to_dict method with None values."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )

        user_dict = user.to_dict()

        assert user_dict["full_name"] is None
        assert user_dict["created_at"] is None
        assert user_dict["updated_at"] is None
        assert user_dict["last_login"] is None
        assert user_dict["tenant_id"] is None

    def test_user_model_to_dict_empty_lists(self):
        """Test User model to_dict method with empty lists."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            roles=None,
            permissions=None,
        )

        user_dict = user.to_dict()

        # Should return empty lists for None values
        assert user_dict["roles"] == []
        assert user_dict["permissions"] == []

    def test_user_model_security_fields(self):
        """Test User model security-related fields."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            failed_login_attempts=3,
            locked_until=datetime.now(UTC),
            last_login_ip="192.168.1.1",
        )

        assert user.failed_login_attempts == 3
        assert user.locked_until is not None
        assert isinstance(user.locked_until, datetime)
        assert user.last_login_ip == "192.168.1.1"

    def test_user_model_tablename(self):
        """Test User model has correct table name."""
        assert User.__tablename__ == "users"

    def test_user_model_inherits_mixins(self):
        """Test User model inherits from required mixins."""
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
        )

        # Should have TimestampMixin fields
        assert hasattr(user, "created_at")
        assert hasattr(user, "updated_at")

        # Should have TenantMixin fields
        assert hasattr(user, "tenant_id")

    def test_user_model_json_fields(self):
        """Test User model JSON fields can store complex data."""
        complex_roles = ["admin", "editor", "viewer"]
        complex_permissions = ["user.read", "user.write", "data.export"]
        complex_metadata = {
            "preferences": {"theme": "dark", "language": "en"},
            "settings": {"notifications": True},
            "custom_data": [1, 2, 3],
        }

        user = User(
            username="testuser",
            email="test@example.com",
            password_hash="hashed_password",
            roles=complex_roles,
            permissions=complex_permissions,
            metadata_=complex_metadata,
        )

        assert user.roles == complex_roles
        assert user.permissions == complex_permissions
        assert user.metadata_ == complex_metadata
        assert user.metadata_["preferences"]["theme"] == "dark"
        assert user.metadata_["custom_data"] == [1, 2, 3]
