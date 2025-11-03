"""
GraphQL types for User Management.

Provides types for users with role/permission batching, team membership,
and profile change history via DataLoaders.
"""

# NOTE: Strict typing in progress – ensure protocols mirror ORM models.

# DEBUG sentinel

from collections.abc import Sequence
from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, Any, Protocol
from uuid import UUID

import strawberry

if TYPE_CHECKING:
    type JSONScalar = Any
else:
    from strawberry.scalars import JSON as JSONScalar


class RoleModel(Protocol):
    id: UUID
    name: str
    display_name: str
    description: str | None
    priority: int
    is_active: bool
    is_system: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime


class PermissionModel(Protocol):
    id: UUID
    name: str
    display_name: str
    description: str | None
    category: Enum
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime


class TeamMembershipModel(Protocol):
    id: UUID
    team_id: UUID
    role: str
    is_active: bool
    joined_at: datetime | None
    left_at: datetime | None


class ProfileChangeRecordModel(Protocol):
    id: UUID
    field_name: str
    old_value: str | None
    new_value: str | None
    change_reason: str | None
    changed_by_user_id: UUID
    created_at: datetime
    ip_address: str | None


class UserModel(Protocol):
    id: UUID
    username: str
    email: str
    tenant_id: str | None
    full_name: str | None
    first_name: str | None
    last_name: str | None
    phone_number: str | None
    phone: str | None
    phone_verified: bool
    bio: str | None
    website: str | None
    location: str | None
    timezone: str | None
    language: str | None
    avatar_url: str | None
    mfa_enabled: bool
    last_login: datetime | None
    last_login_ip: str | None
    failed_login_attempts: int
    locked_until: datetime | None
    metadata_: dict[str, Any] | None
    title: str | None
    position: str | None
    department: str | None
    manager_name: str | None
    employee_id: str | None
    external_id: str | None
    created_at: datetime
    updated_at: datetime
    status: str
    is_active: bool
    is_verified: bool
    is_platform_admin: bool
    is_superuser: bool
    roles: Sequence[str] | None
    permissions: Sequence[str] | None
    metadata: dict[str, Any] | None
    teams: Sequence[Any] | None
    preferences: dict[str, Any] | None


@strawberry.enum
class UserStatusEnum(str, Enum):
    """User account status."""

    ACTIVE = "active"
    SUSPENDED = "suspended"
    INVITED = "invited"


@strawberry.type
class Role:
    """User role with permissions."""

    id: strawberry.ID
    name: str
    display_name: str
    description: str | None
    priority: int
    is_active: bool
    is_system: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    # Permissions loaded conditionally via DataLoader
    permissions: list["Permission"] = strawberry.field(default_factory=list)

    @classmethod
    def from_model(cls, role: RoleModel) -> "Role":
        """Convert SQLAlchemy Role model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(role.id)),
            name=role.name,
            display_name=role.display_name,
            description=role.description,
            priority=role.priority,
            is_active=role.is_active,
            is_system=role.is_system,
            is_default=role.is_default,
            created_at=role.created_at,
            updated_at=role.updated_at,
            permissions=[],
        )


@strawberry.enum
class PermissionCategoryEnum(str, Enum):
    """Permission categories."""

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


@strawberry.type
class Permission:
    """Individual permission."""

    id: strawberry.ID
    name: str
    display_name: str
    description: str | None
    category: PermissionCategoryEnum
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, permission: PermissionModel) -> "Permission":
        """Convert SQLAlchemy Permission model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(permission.id)),
            name=permission.name,
            display_name=permission.display_name,
            description=permission.description,
            category=PermissionCategoryEnum(permission.category.value),
            is_active=permission.is_active,
            is_system=permission.is_system,
            created_at=permission.created_at,
            updated_at=permission.updated_at,
        )


@strawberry.type
class TeamMembership:
    """User's team membership."""

    id: strawberry.ID
    team_id: strawberry.ID
    team_name: str
    role: str  # member, lead, admin
    is_active: bool
    joined_at: datetime | None
    left_at: datetime | None

    @classmethod
    def from_model(cls, membership: TeamMembershipModel, team_name: str) -> "TeamMembership":
        """Convert SQLAlchemy TeamMember model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(membership.id)),
            team_id=strawberry.ID(str(membership.team_id)),
            team_name=team_name,
            role=membership.role,
            is_active=membership.is_active,
            joined_at=membership.joined_at if hasattr(membership, "joined_at") else None,
            left_at=membership.left_at if hasattr(membership, "left_at") else None,
        )


@strawberry.type
class ProfileChangeRecord:
    """Profile change history record."""

    id: strawberry.ID
    field_name: str
    old_value: str | None
    new_value: str | None
    change_reason: str | None
    changed_by_user_id: strawberry.ID
    changed_by_username: str | None
    created_at: datetime
    ip_address: str | None

    @classmethod
    def from_model(
        cls, record: ProfileChangeRecordModel, changed_by_username: str | None = None
    ) -> "ProfileChangeRecord":
        """Convert SQLAlchemy ProfileChangeHistory model to GraphQL type."""
        return cls(
            id=strawberry.ID(str(record.id)),
            field_name=record.field_name,
            old_value=record.old_value,
            new_value=record.new_value,
            change_reason=record.change_reason,
            changed_by_user_id=strawberry.ID(str(record.changed_by_user_id)),
            changed_by_username=changed_by_username,
            created_at=record.created_at,
            ip_address=record.ip_address,
        )


@strawberry.type
class User:
    """
    User with conditional loading of roles, permissions, and team memberships.

    Core user fields are always loaded. Relationships are loaded conditionally
    via DataLoaders to prevent N+1 queries.
    """

    # Core identifiers
    id: strawberry.ID
    username: str
    email: str
    tenant_id: str | None

    # Profile fields
    full_name: str | None
    first_name: str | None
    last_name: str | None
    phone_number: str | None
    phone: str | None
    phone_verified: bool
    bio: str | None
    website: str | None
    location: str | None
    timezone: str | None
    language: str | None
    avatar_url: str | None

    # Status fields
    is_active: bool
    is_verified: bool
    is_superuser: bool
    is_platform_admin: bool
    mfa_enabled: bool

    # Tracking fields
    last_login: datetime | None
    last_login_ip: str | None
    failed_login_attempts: int
    locked_until: datetime | None

    # Timestamps
    created_at: datetime
    updated_at: datetime

    # Computed properties
    status: UserStatusEnum
    display_name: str
    primary_role: str

    # Metadata (optional - can be large)
    metadata: JSONScalar | None

    # Relationships (conditionally loaded via DataLoaders)
    roles: list[Role] = strawberry.field(default_factory=list)
    permissions: list[Permission] = strawberry.field(default_factory=list)
    teams: list[TeamMembership] = strawberry.field(default_factory=list)
    profile_changes: list[ProfileChangeRecord] = strawberry.field(default_factory=list)

    # Legacy role/permission arrays from User model (for backwards compatibility)
    roles_legacy: list[str] = strawberry.field(default_factory=list)
    permissions_legacy: list[str] = strawberry.field(default_factory=list)

    @classmethod
    def from_model(cls, user: UserModel, include_metadata: bool = False) -> "User":
        """Convert SQLAlchemy User model to GraphQL type."""
        # Determine status
        if not user.is_active:
            status = UserStatusEnum.SUSPENDED
        elif not user.is_verified:
            status = UserStatusEnum.INVITED
        else:
            status = UserStatusEnum.ACTIVE

        # Determine display name
        display_name = user.full_name or user.username or user.email

        # Determine primary role
        if user.is_platform_admin:
            primary_role = "Platform Admin"
        elif user.is_superuser:
            primary_role = "Superuser"
        elif user.roles and len(user.roles) > 0:
            primary_role = user.roles[0].capitalize()
        else:
            primary_role = "User"

        return cls(
            id=strawberry.ID(str(user.id)),
            username=user.username,
            email=user.email,
            tenant_id=str(user.tenant_id) if user.tenant_id else None,
            full_name=user.full_name,
            first_name=user.first_name,
            last_name=user.last_name,
            phone_number=user.phone_number,
            phone=user.phone,
            phone_verified=user.phone_verified,
            bio=user.bio,
            website=user.website,
            location=user.location,
            timezone=user.timezone,
            language=user.language,
            avatar_url=user.avatar_url,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            is_platform_admin=user.is_platform_admin,
            mfa_enabled=user.mfa_enabled,
            last_login=user.last_login,
            last_login_ip=user.last_login_ip,
            failed_login_attempts=user.failed_login_attempts,
            locked_until=user.locked_until,
            created_at=user.created_at,
            updated_at=user.updated_at,
            status=status,
            display_name=display_name,
            primary_role=primary_role,
            metadata=user.metadata_ if include_metadata else None,
            # Relationships populated by DataLoaders
            roles=[],
            permissions=[],
            teams=[],
            profile_changes=[],
            # Legacy arrays from User model
            roles_legacy=list(user.roles or []),
            permissions_legacy=list(user.permissions or []),
        )


@strawberry.type
class UserConnection:
    """Paginated user results."""

    users: list[User]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class UserOverviewMetrics:
    """Aggregated user metrics."""

    total_users: int
    active_users: int
    suspended_users: int
    invited_users: int
    verified_users: int
    mfa_enabled_users: int

    # Role distribution
    platform_admins: int
    superusers: int
    regular_users: int

    # Activity metrics
    users_logged_in_last_24h: int
    users_logged_in_last_7d: int
    users_logged_in_last_30d: int
    never_logged_in: int

    # Growth metrics
    new_users_this_month: int
    new_users_last_month: int


@strawberry.type
class RoleConnection:
    """Paginated role results."""

    roles: list[Role]
    total_count: int
    has_next_page: bool
    has_prev_page: bool
    page: int
    page_size: int


@strawberry.type
class PermissionsByCategory:
    """Permissions grouped by category."""

    category: PermissionCategoryEnum
    permissions: list[Permission]
    count: int
