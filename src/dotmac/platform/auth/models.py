"""
RBAC (Role-Based Access Control) Database Models
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from dotmac.platform.db import Base as BaseRuntime

if TYPE_CHECKING:
    from sqlalchemy.orm import DeclarativeBase as Base

    from dotmac.platform.user_management.models import User as UserModel  # noqa: F401
else:
    Base = BaseRuntime

# Association tables
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column(
        "user_id",
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "role_id",
        PGUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("granted_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("granted_by", PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True),
    Column("expires_at", DateTime(timezone=True), nullable=True),
    Column("metadata", JSON, nullable=True),  # For storing context like "granted for project X"
    UniqueConstraint("user_id", "role_id", name="uq_user_role"),
    Index("ix_user_roles_user_id", "user_id"),
    Index("ix_user_roles_expires_at", "expires_at"),
)

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        PGUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        PGUUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("granted_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    Index("ix_role_permissions_role_id", "role_id"),
)

# Optional: Direct user permissions (overrides)
user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column(
        "user_id",
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        PGUUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("granted", Boolean, default=True, nullable=False),  # True = grant, False = revoke
    Column("granted_at", DateTime(timezone=True), server_default=func.now(), nullable=False),
    Column("granted_by", PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True),
    Column("expires_at", DateTime(timezone=True), nullable=True),
    Column("reason", Text, nullable=True),
    UniqueConstraint("user_id", "permission_id", name="uq_user_permission"),
    Index("ix_user_permissions_user_id", "user_id"),
)


class PermissionCategory(str, Enum):
    """Categories for organizing permissions"""

    USER = "user"
    CUSTOMER = "customer"
    TICKET = "ticket"
    BILLING = "billing"
    SECURITY = "security"
    ADMIN = "admin"
    ANALYTICS = "analytics"
    COMMUNICATION = "communication"
    WORKFLOW = "workflow"
    NETWORK = "network"
    IPAM = "ipam"
    AUTOMATION = "automation"
    CPE = "cpe"
    PARTNER = "partner"
    FIELD_SERVICE = "field_service"


class Permission(Base):
    """Individual permission that can be granted"""

    __tablename__ = "permissions"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[PermissionCategory] = mapped_column(String(50), nullable=False)

    # For hierarchical permissions (e.g., ticket.read.all implies ticket.read.assigned)
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("permissions.id"), nullable=True
    )

    # Metadata
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Can't be deleted
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")
    children = relationship("Permission", backref="parent", remote_side=[id])

    def __repr__(self) -> str:
        return f"<Permission(name='{self.name}', category='{self.category}')>"


def _users_table() -> Any:
    """Return the users table without creating import cycles."""
    from dotmac.platform.user_management.models import (  # local import to avoid circular dependency
        User,
    )

    return User.__table__


class Role(Base):
    """Role that groups permissions"""

    __tablename__ = "roles"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Role hierarchy
    parent_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id"), nullable=True
    )
    priority: Mapped[int] = mapped_column(Integer, default=0)  # Higher priority = more important

    # Flags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Can't be deleted
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )  # Auto-assigned to new users

    # Metadata
    max_users: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Optional limit
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship(
        "User",
        secondary=user_roles,
        primaryjoin=lambda: Role.id == user_roles.c.role_id,
        secondaryjoin=lambda: user_roles.c.user_id == _users_table().c.id,
        foreign_keys=lambda: (user_roles.c.role_id, user_roles.c.user_id),
        viewonly=False,
        overlaps="granted_users",
    )
    granted_users = relationship(
        "User",
        secondary=user_roles,
        primaryjoin=lambda: Role.id == user_roles.c.role_id,
        secondaryjoin=lambda: user_roles.c.granted_by == _users_table().c.id,
        foreign_keys=lambda: (user_roles.c.role_id, user_roles.c.granted_by),
        viewonly=True,
        overlaps="users",
    )
    children = relationship("Role", backref="parent", remote_side=[id])

    def get_all_permissions(self, db_session: Any) -> list[Permission]:
        """Get all permissions including inherited from parent roles"""
        permissions = set(self.permissions)

        # Add parent role permissions
        if self.parent_id:
            parent = db_session.query(Role).filter_by(id=self.parent_id).first()
            if parent:
                permissions.update(parent.get_all_permissions(db_session))

        return list(permissions)

    def __repr__(self) -> str:
        return f"<Role(name='{self.name}', priority={self.priority})>"


class RoleHierarchy(Base):
    """Explicit role inheritance relationships (alternative to parent_id)"""

    __tablename__ = "role_hierarchy"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    parent_role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE")
    )
    child_role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE")
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("parent_role_id", "child_role_id", name="uq_role_hierarchy"),
        Index("ix_role_hierarchy_parent", "parent_role_id"),
        Index("ix_role_hierarchy_child", "child_role_id"),
    )


class PermissionGrant(Base):
    """Audit trail for permission grants/revokes"""

    __tablename__ = "permission_grants"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    # What was granted/revoked
    user_id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    role_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("roles.id"), nullable=True
    )
    permission_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("permissions.id"), nullable=True
    )

    # Grant details
    action: Mapped[str] = mapped_column(String(20))  # 'grant', 'revoke', 'expire'
    granted_by: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Metadata (IP address, session ID, etc.)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)

    __table_args__ = (
        Index("ix_permission_grants_user_id", "user_id"),
        Index("ix_permission_grants_granted_by", "granted_by"),
        Index("ix_permission_grants_created_at", "created_at"),
    )


# Backward-compatible User export
try:  # pragma: no cover - used for legacy imports
    from dotmac.platform.user_management.models import User as User  # noqa: F401
except Exception:  # pragma: no cover
    User = None  # type: ignore


__all__ = [
    "PermissionCategory",
    "Permission",
    "Role",
    "RoleHierarchy",
    "PermissionGrant",
    "User",
]
