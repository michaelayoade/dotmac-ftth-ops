"""
GraphQL queries for User Management.

Provides efficient user queries with conditional loading of roles,
permissions, teams, and profile history via DataLoaders.
"""

from datetime import UTC, datetime, timedelta
from typing import cast

import strawberry
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.user import (
    Permission,
    PermissionCategoryEnum,
    PermissionModel,
    PermissionsByCategory,
    ProfileChangeRecord,
    Role,
    RoleConnection,
    TeamMembership,
    User,
    UserConnection,
    UserOverviewMetrics,
)
from dotmac.platform.graphql.types.user import (
    UserModel as UserProtocol,
)
from dotmac.platform.user_management.models import User as UserTable


@strawberry.type
class UserQueries:
    """GraphQL queries for user management."""

    @strawberry.field(description="Get user by ID with conditional field loading")  # type: ignore[misc]
    async def user(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_metadata: bool = False,
        include_roles: bool = False,
        include_permissions: bool = False,
        include_teams: bool = False,
        include_profile_changes: bool = False,
    ) -> User | None:
        """
        Fetch a single user by ID.

        Args:
            id: User ID (UUID or string)
            include_metadata: Load metadata JSON (default: False)
            include_roles: Load Role objects via DataLoader (default: False)
            include_permissions: Load Permission objects via DataLoader (default: False)
            include_teams: Load TeamMembership objects via DataLoader (default: False)
            include_profile_changes: Load ProfileChangeHistory via DataLoader (default: False)

        Returns:
            User with conditionally loaded related data
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Fetch user
        stmt = select(UserTable).where(
            UserTable.id == str(id),
            UserTable.tenant_id == tenant_id,
        )
        result = await db.execute(stmt)
        user_row = result.scalar_one_or_none()

        if not user_row:
            return None

        # Convert to GraphQL type
        user_model = cast(UserProtocol, user_row)
        user = User.from_model(user_model, include_metadata=include_metadata)

        # Conditionally load roles
        if include_roles:
            roles_loader = info.context.loaders.get_user_roles_loader()
            roles_list = await roles_loader.load_many([str(user_model.id)])
            if roles_list and roles_list[0]:
                user.roles = [Role.from_model(r) for r in roles_list[0]]

        # Conditionally load permissions
        if include_permissions:
            perms_loader = info.context.loaders.get_user_permissions_loader()
            perms_list = await perms_loader.load_many([str(user_model.id)])
            if perms_list and perms_list[0]:
                user.permissions = [Permission.from_model(p) for p in perms_list[0]]

        # Conditionally load teams
        if include_teams:
            teams_loader = info.context.loaders.get_user_teams_loader()
            teams_list = await teams_loader.load_many([str(user_model.id)])
            if teams_list and teams_list[0]:
                user.teams = [
                    TeamMembership.from_model(
                        tm, tm._team.name if hasattr(tm, "_team") and tm._team else "Unknown"
                    )
                    for tm in teams_list[0]
                ]

        # Conditionally load profile changes
        if include_profile_changes:
            changes_loader = info.context.loaders.get_profile_change_history_loader()
            changes_list = await changes_loader.load_many([str(user_model.id)])
            if changes_list and changes_list[0]:
                user.profile_changes = [
                    ProfileChangeRecord.from_model(
                        c, c._changed_by_username if hasattr(c, "_changed_by_username") else None
                    )
                    for c in changes_list[0]
                ]

        return user

    @strawberry.field(description="Get list of users with optional filters and conditional loading")  # type: ignore[misc]
    async def users(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 10,
        is_active: bool | None = None,
        is_verified: bool | None = None,
        is_superuser: bool | None = None,
        is_platform_admin: bool | None = None,
        search: str | None = None,
        include_metadata: bool = False,
        include_roles: bool = False,
        include_permissions: bool = False,
        include_teams: bool = False,
    ) -> UserConnection:
        """
        Fetch a list of users with optional filtering and conditional loading.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 10, max: 100)
            is_active: Filter by active status
            is_verified: Filter by verification status
            is_superuser: Filter by superuser status
            is_platform_admin: Filter by platform admin status
            search: Search by username, email, or full_name
            include_metadata: Load metadata JSON
            include_roles: Batch load Role objects
            include_permissions: Batch load Permission objects
            include_teams: Batch load TeamMembership objects

        Returns:
            UserConnection with paginated users and metadata
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query (only active users in tenant)
        stmt = select(UserTable).where(UserTable.tenant_id == tenant_id)

        # Apply filters
        if is_active is not None:
            stmt = stmt.where(UserTable.is_active == is_active)

        if is_verified is not None:
            stmt = stmt.where(UserTable.is_verified == is_verified)

        if is_superuser is not None:
            stmt = stmt.where(UserTable.is_superuser == is_superuser)

        if is_platform_admin is not None:
            stmt = stmt.where(UserTable.is_platform_admin == is_platform_admin)

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    UserTable.username.ilike(search_pattern),
                    UserTable.email.ilike(search_pattern),
                    UserTable.full_name.ilike(search_pattern),
                )
            )

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = stmt.order_by(UserTable.created_at.desc()).limit(page_size).offset(offset)

        # Execute query
        result = await db.execute(stmt)
        user_rows = result.scalars().all()
        user_models = [cast(UserProtocol, row) for row in user_rows]

        # Convert to GraphQL types
        users = [User.from_model(u, include_metadata=include_metadata) for u in user_models]

        # Conditionally batch load roles
        if include_roles and user_models:
            user_ids = [str(u.id) for u in user_models]
            roles_loader = info.context.loaders.get_user_roles_loader()
            roles_lists = await roles_loader.load_many(user_ids)

            for i, roles_list in enumerate(roles_lists):
                if roles_list:
                    users[i].roles = [Role.from_model(r) for r in roles_list]

        # Conditionally batch load permissions
        if include_permissions and user_models:
            user_ids = [str(u.id) for u in user_models]
            perms_loader = info.context.loaders.get_user_permissions_loader()
            perms_lists = await perms_loader.load_many(user_ids)

            for i, perms_list in enumerate(perms_lists):
                if perms_list:
                    users[i].permissions = [Permission.from_model(p) for p in perms_list]

        # Conditionally batch load teams
        if include_teams and user_models:
            user_ids = [str(u.id) for u in user_models]
            teams_loader = info.context.loaders.get_user_teams_loader()
            teams_lists = await teams_loader.load_many(user_ids)

            for i, teams_list in enumerate(teams_lists):
                if teams_list:
                    users[i].teams = [
                        TeamMembership.from_model(
                            tm, tm._team.name if hasattr(tm, "_team") and tm._team else "Unknown"
                        )
                        for tm in teams_list
                    ]

        return UserConnection(
            users=users,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get user overview metrics and statistics")  # type: ignore[misc]
    async def user_metrics(self, info: strawberry.Info[Context]) -> UserOverviewMetrics:
        """
        Get aggregated user metrics.

        Returns:
            UserOverviewMetrics with counts, distribution, and activity metrics
        """
        context = info.context
        context.require_authenticated_user()
        tenant_id = context.get_active_tenant_id()
        db: AsyncSession = context.db

        # Get status counts
        status_stmt = select(
            func.count(UserTable.id).label("total"),
            func.count(func.case((UserTable.is_active == True, 1))).label("active"),  # noqa: E712
            func.count(func.case((UserTable.is_active == False, 1))).label(  # noqa: E712
                "suspended"
            ),
            func.count(func.case((UserTable.is_verified == False, 1))).label(  # noqa: E712
                "invited"
            ),
            func.count(func.case((UserTable.is_verified == True, 1))).label(  # noqa: E712
                "verified"
            ),
            func.count(func.case((UserTable.mfa_enabled == True, 1))).label(  # noqa: E712
                "mfa_enabled"
            ),
        ).where(UserTable.tenant_id == tenant_id)

        status_result = await db.execute(status_stmt)
        status_row = status_result.one()
        status_mapping = status_row._mapping

        # Get role distribution
        role_stmt = select(
            func.count(func.case((UserTable.is_platform_admin == True, 1))).label(  # noqa: E712
                "platform_admins"
            ),
            func.count(func.case((UserTable.is_superuser == True, 1))).label(  # noqa: E712
                "superusers"
            ),
            func.count(
                func.case(
                    (
                        (UserTable.is_platform_admin == False)  # noqa: E712
                        & (UserTable.is_superuser == False),  # noqa: E712
                        1,
                    )
                )
            ).label("regular_users"),
        ).where(UserTable.tenant_id == tenant_id)

        role_result = await db.execute(role_stmt)
        role_row = role_result.one()
        role_mapping = role_row._mapping

        # Get activity metrics
        now = datetime.now(UTC)
        day_ago = now - timedelta(days=1)
        week_ago = now - timedelta(days=7)
        month_ago = now - timedelta(days=30)

        activity_stmt = select(
            func.count(func.case((UserTable.last_login >= day_ago, 1))).label("day_24h"),
            func.count(func.case((UserTable.last_login >= week_ago, 1))).label("day_7d"),
            func.count(func.case((UserTable.last_login >= month_ago, 1))).label("day_30d"),
            func.count(func.case((UserTable.last_login.is_(None), 1))).label("never"),
        ).where(UserTable.tenant_id == tenant_id)

        activity_result = await db.execute(activity_stmt)
        activity_row = activity_result.one()
        activity_mapping = activity_row._mapping

        # Get growth metrics
        this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)

        growth_stmt = select(
            func.count(func.case((UserTable.created_at >= this_month_start, 1))).label(
                "this_month"
            ),
            func.count(
                func.case(
                    (
                        (UserTable.created_at >= last_month_start)
                        & (UserTable.created_at < this_month_start),
                        1,
                    )
                )
            ).label("last_month"),
        ).where(UserTable.tenant_id == tenant_id)

        growth_result = await db.execute(growth_stmt)
        growth_row = growth_result.one()
        growth_mapping = growth_row._mapping

        return UserOverviewMetrics(
            total_users=int(status_mapping.get("total") or 0),
            active_users=int(status_mapping.get("active") or 0),
            suspended_users=int(status_mapping.get("suspended") or 0),
            invited_users=int(status_mapping.get("invited") or 0),
            verified_users=int(status_mapping.get("verified") or 0),
            mfa_enabled_users=int(status_mapping.get("mfa_enabled") or 0),
            platform_admins=int(role_mapping.get("platform_admins") or 0),
            superusers=int(role_mapping.get("superusers") or 0),
            regular_users=int(role_mapping.get("regular_users") or 0),
            users_logged_in_last_24h=int(activity_mapping.get("day_24h") or 0),
            users_logged_in_last_7d=int(activity_mapping.get("day_7d") or 0),
            users_logged_in_last_30d=int(activity_mapping.get("day_30d") or 0),
            never_logged_in=int(activity_mapping.get("never") or 0),
            new_users_this_month=int(growth_mapping.get("this_month") or 0),
            new_users_last_month=int(growth_mapping.get("last_month") or 0),
        )

    @strawberry.field(description="Get list of roles with optional filters")  # type: ignore[misc]
    async def roles(
        self,
        info: strawberry.Info[Context],
        page: int = 1,
        page_size: int = 20,
        is_active: bool | None = None,
        is_system: bool | None = None,
        search: str | None = None,
    ) -> RoleConnection:
        """
        Fetch a list of roles with filtering and pagination.

        Args:
            page: Page number (1-indexed)
            page_size: Items per page (default: 20, max: 100)
            is_active: Filter by active status
            is_system: Filter by system status
            search: Search by name or display_name

        Returns:
            RoleConnection with paginated roles
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.auth.models import Role as RoleModel

        # Limit page_size
        page_size = min(page_size, 100)
        offset = (page - 1) * page_size

        # Build base query
        stmt = select(RoleModel)

        # Apply filters
        if is_active is not None:
            stmt = stmt.where(RoleModel.is_active == is_active)

        if is_system is not None:
            stmt = stmt.where(RoleModel.is_system == is_system)

        if search:
            search_pattern = f"%{search}%"
            stmt = stmt.where(
                or_(
                    RoleModel.name.ilike(search_pattern),
                    RoleModel.display_name.ilike(search_pattern),
                )
            )

        # Get total count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_count_result = await db.execute(count_stmt)
        total_count = total_count_result.scalar() or 0

        # Apply sorting and pagination
        stmt = (
            stmt.order_by(RoleModel.priority.desc(), RoleModel.name).limit(page_size).offset(offset)
        )

        # Execute query
        result = await db.execute(stmt)
        role_models = result.scalars().all()

        # Convert to GraphQL types
        roles = [Role.from_model(r) for r in role_models]

        return RoleConnection(
            roles=roles,
            total_count=int(total_count),
            has_next_page=(offset + page_size) < total_count,
            has_prev_page=page > 1,
            page=page,
            page_size=page_size,
        )

    @strawberry.field(description="Get permissions grouped by category")  # type: ignore[misc]
    async def permissions_by_category(
        self,
        info: strawberry.Info[Context],
        category: PermissionCategoryEnum | None = None,
    ) -> list[PermissionsByCategory]:
        """
        Get all permissions grouped by category.

        Args:
            category: Optional filter for specific category

        Returns:
            List of PermissionsByCategory with permissions grouped
        """
        db: AsyncSession = info.context.db

        # Import here to avoid circular imports
        from dotmac.platform.auth.models import Permission as PermissionORM

        # Build query
        stmt = select(PermissionORM).where(PermissionORM.is_active == True)  # noqa: E712

        if category:
            from dotmac.platform.auth.models import PermissionCategory

            stmt = stmt.where(PermissionORM.category == PermissionCategory(category.value))

        stmt = stmt.order_by(PermissionORM.category, PermissionORM.name)

        # Execute query
        result = await db.execute(stmt)
        perm_rows = result.scalars().all()
        perm_models = [cast(PermissionModel, row) for row in perm_rows]

        # Group by category
        grouped: dict[PermissionCategoryEnum, list[Permission]] = {}
        for perm_model in perm_models:
            cat_enum = PermissionCategoryEnum(perm_model.category.value)
            if cat_enum not in grouped:
                grouped[cat_enum] = []
            grouped[cat_enum].append(Permission.from_model(perm_model))

        # Convert to response format
        return [
            PermissionsByCategory(
                category=cat,
                permissions=perms,
                count=len(perms),
            )
            for cat, perms in grouped.items()
        ]


__all__ = ["UserQueries"]
