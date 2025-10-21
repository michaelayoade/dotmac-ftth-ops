"""
Team management service.

Provides CRUD operations for teams and team members with proper tenant isolation.
"""

import math
from datetime import UTC, datetime
from uuid import UUID

import structlog
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Team as TeamModel
from .models import TeamMember as TeamMemberModel
from .models import User
from .schemas import Team as TeamSchema
from .schemas import (
    TeamCreate,
    TeamListResponse,
    TeamMemberCreate,
    TeamMemberListResponse,
    TeamMemberUpdate,
    TeamUpdate,
)
from .schemas import TeamMember as TeamMemberSchema

logger = structlog.get_logger(__name__)


class TeamService:
    """Service for managing teams and team members."""

    def __init__(self, session: AsyncSession) -> None:
        """Initialize with database session."""
        self.session = session

    # ==================== Team CRUD ====================

    async def create_team(self, team_data: TeamCreate, tenant_id: str) -> TeamModel:
        """
        Create a new team.

        Args:
            team_data: Team creation data
            tenant_id: Tenant ID for isolation

        Returns:
            Created team

        Raises:
            ValueError: If team with same name or slug already exists
        """
        # Check for existing team with same name or slug
        existing = await self.session.execute(
            select(TeamModel).where(
                and_(
                    TeamModel.tenant_id == tenant_id,
                    or_(TeamModel.name == team_data.name, TeamModel.slug == team_data.slug),
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError(
                f"Team with name '{team_data.name}' or slug '{team_data.slug}' already exists"
            )

        # Create team
        team = TeamModel(
            tenant_id=tenant_id,
            name=team_data.name,
            slug=team_data.slug,
            description=team_data.description,
            is_active=team_data.is_active,
            is_default=team_data.is_default,
            team_lead_id=team_data.team_lead_id,
            color=team_data.color,
            icon=team_data.icon,
        )

        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)

        logger.info("Team created", team_id=str(team.id), name=team.name, tenant_id=tenant_id)

        return team

    async def get_team(self, team_id: UUID, tenant_id: str) -> TeamModel | None:
        """
        Get team by ID.

        Args:
            team_id: Team ID
            tenant_id: Tenant ID for isolation

        Returns:
            Team or None if not found
        """
        result = await self.session.execute(
            select(TeamModel).where(and_(TeamModel.id == team_id, TeamModel.tenant_id == tenant_id))
        )
        return result.scalar_one_or_none()

    async def get_team_by_slug(self, slug: str, tenant_id: str) -> TeamModel | None:
        """
        Get team by slug.

        Args:
            slug: Team slug
            tenant_id: Tenant ID for isolation

        Returns:
            Team or None if not found
        """
        result = await self.session.execute(
            select(TeamModel).where(and_(TeamModel.slug == slug, TeamModel.tenant_id == tenant_id))
        )
        return result.scalar_one_or_none()

    async def list_teams(
        self,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> TeamListResponse:
        """
        List teams with pagination.

        Args:
            tenant_id: Tenant ID for isolation
            page: Page number (1-indexed)
            page_size: Number of items per page
            is_active: Filter by active status
            search: Search term for name/description

        Returns:
            Paginated list of teams
        """
        # Build query
        query = select(TeamModel).where(TeamModel.tenant_id == tenant_id)

        if is_active is not None:
            query = query.where(TeamModel.is_active == is_active)

        if search:
            search_term = f"%{search}%"
            query = query.where(
                or_(
                    TeamModel.name.ilike(search_term),
                    TeamModel.description.ilike(search_term),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.session.scalar(count_query) or 0

        # Apply pagination
        query = query.order_by(TeamModel.name).limit(page_size).offset((page - 1) * page_size)

        # Execute query
        result = await self.session.execute(query)
        teams = result.scalars().all()

        # Calculate total pages
        pages = math.ceil(total / page_size) if total > 0 else 1

        return TeamListResponse(
            items=[TeamSchema.model_validate(team) for team in teams],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    async def update_team(self, team_id: UUID, team_data: TeamUpdate, tenant_id: str) -> TeamModel:
        """
        Update team.

        Args:
            team_id: Team ID
            team_data: Team update data
            tenant_id: Tenant ID for isolation

        Returns:
            Updated team

        Raises:
            ValueError: If team not found or validation fails
        """
        team = await self.get_team(team_id, tenant_id)
        if not team:
            raise ValueError(f"Team {team_id} not found")

        # Update fields if provided
        update_data = team_data.model_dump(exclude_unset=True)

        # Check for slug/name conflicts if being updated
        if "name" in update_data or "slug" in update_data:
            existing = await self.session.execute(
                select(TeamModel).where(
                    and_(
                        TeamModel.tenant_id == tenant_id,
                        TeamModel.id != team_id,
                        or_(
                            TeamModel.name == update_data.get("name", team.name),
                            TeamModel.slug == update_data.get("slug", team.slug),
                        ),
                    )
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError("Team with that name or slug already exists")

        for key, value in update_data.items():
            setattr(team, key, value)

        team.updated_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(team)

        logger.info("Team updated", team_id=str(team.id), tenant_id=tenant_id)

        return team

    async def delete_team(self, team_id: UUID, tenant_id: str) -> bool:
        """
        Delete team.

        Args:
            team_id: Team ID
            tenant_id: Tenant ID for isolation

        Returns:
            True if deleted, False if not found
        """
        team = await self.get_team(team_id, tenant_id)
        if not team:
            return False

        await self.session.delete(team)
        await self.session.commit()

        logger.info("Team deleted", team_id=str(team_id), tenant_id=tenant_id)

        return True

    # ==================== Team Member CRUD ====================

    async def add_team_member(
        self, member_data: TeamMemberCreate, tenant_id: str
    ) -> TeamMemberModel:
        """
        Add a user to a team.

        Args:
            member_data: Team member data
            tenant_id: Tenant ID for isolation

        Returns:
            Created team member

        Raises:
            ValueError: If team or user not found, or member already exists
        """
        # Verify team exists
        team = await self.get_team(member_data.team_id, tenant_id)
        if not team:
            raise ValueError(f"Team {member_data.team_id} not found")

        # Verify user exists
        user = await self.session.execute(
            select(User).where(and_(User.id == member_data.user_id, User.tenant_id == tenant_id))
        )
        if not user.scalar_one_or_none():
            raise ValueError(f"User {member_data.user_id} not found")

        # Check if membership already exists
        existing = await self.session.execute(
            select(TeamMemberModel).where(
                and_(
                    TeamMemberModel.tenant_id == tenant_id,
                    TeamMemberModel.team_id == member_data.team_id,
                    TeamMemberModel.user_id == member_data.user_id,
                )
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User is already a member of this team")

        # Create membership
        member = TeamMemberModel(
            tenant_id=tenant_id,
            team_id=member_data.team_id,
            user_id=member_data.user_id,
            role=member_data.role,
            is_active=member_data.is_active,
            notes=member_data.notes,
        )

        self.session.add(member)
        await self.session.commit()
        await self.session.refresh(member)

        logger.info(
            "Team member added",
            team_id=str(member_data.team_id),
            user_id=str(member_data.user_id),
            role=member_data.role,
            tenant_id=tenant_id,
        )

        return member

    async def get_team_member(self, member_id: UUID, tenant_id: str) -> TeamMemberModel | None:
        """
        Get team member by ID.

        Args:
            member_id: Team member ID
            tenant_id: Tenant ID for isolation

        Returns:
            Team member or None if not found
        """
        result = await self.session.execute(
            select(TeamMemberModel).where(
                and_(TeamMemberModel.id == member_id, TeamMemberModel.tenant_id == tenant_id)
            )
        )
        return result.scalar_one_or_none()

    async def list_team_members(
        self,
        team_id: UUID,
        tenant_id: str,
        page: int = 1,
        page_size: int = 50,
        role: str | None = None,
        is_active: bool | None = None,
    ) -> TeamMemberListResponse:
        """
        List team members with pagination.

        Args:
            team_id: Team ID
            tenant_id: Tenant ID for isolation
            page: Page number (1-indexed)
            page_size: Number of items per page
            role: Filter by role
            is_active: Filter by active status

        Returns:
            Paginated list of team members
        """
        # Build query
        query = select(TeamMemberModel).where(
            and_(TeamMemberModel.team_id == team_id, TeamMemberModel.tenant_id == tenant_id)
        )

        if role:
            query = query.where(TeamMemberModel.role == role)

        if is_active is not None:
            query = query.where(TeamMemberModel.is_active == is_active)

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.session.scalar(count_query) or 0

        # Apply pagination
        query = (
            query.order_by(TeamMemberModel.joined_at)
            .limit(page_size)
            .offset((page - 1) * page_size)
        )

        # Execute query
        result = await self.session.execute(query)
        members = result.scalars().all()

        # Calculate total pages
        pages = math.ceil(total / page_size) if total > 0 else 1

        return TeamMemberListResponse(
            items=[TeamMemberSchema.model_validate(member) for member in members],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    async def update_team_member(
        self, member_id: UUID, member_data: TeamMemberUpdate, tenant_id: str
    ) -> TeamMemberModel:
        """
        Update team member.

        Args:
            member_id: Team member ID
            member_data: Team member update data
            tenant_id: Tenant ID for isolation

        Returns:
            Updated team member

        Raises:
            ValueError: If team member not found
        """
        member = await self.get_team_member(member_id, tenant_id)
        if not member:
            raise ValueError(f"Team member {member_id} not found")

        # Update fields if provided
        update_data = member_data.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(member, key, value)

        member.updated_at = datetime.now(UTC)
        await self.session.commit()
        await self.session.refresh(member)

        logger.info("Team member updated", member_id=str(member.id), tenant_id=tenant_id)

        return member

    async def remove_team_member(self, member_id: UUID, tenant_id: str) -> bool:
        """
        Remove a user from a team.

        Args:
            member_id: Team member ID
            tenant_id: Tenant ID for isolation

        Returns:
            True if removed, False if not found
        """
        member = await self.get_team_member(member_id, tenant_id)
        if not member:
            return False

        await self.session.delete(member)
        await self.session.commit()

        logger.info(
            "Team member removed",
            member_id=str(member_id),
            team_id=str(member.team_id),
            user_id=str(member.user_id),
            tenant_id=tenant_id,
        )

        return True

    async def get_user_teams(
        self, user_id: UUID, tenant_id: str, is_active: bool | None = None
    ) -> list[TeamModel]:
        """
        Get all teams a user belongs to.

        Args:
            user_id: User ID
            tenant_id: Tenant ID for isolation
            is_active: Filter by active membership

        Returns:
            List of teams the user is a member of
        """
        query = (
            select(TeamModel)
            .join(TeamMemberModel, TeamModel.id == TeamMemberModel.team_id)
            .where(
                and_(
                    TeamMemberModel.user_id == user_id,
                    TeamMemberModel.tenant_id == tenant_id,
                    TeamModel.tenant_id == tenant_id,
                )
            )
        )

        if is_active is not None:
            query = query.where(TeamMemberModel.is_active == is_active)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_team_member_count(self, team_id: UUID, tenant_id: str) -> int:
        """
        Get the number of members in a team.

        Args:
            team_id: Team ID
            tenant_id: Tenant ID for isolation

        Returns:
            Number of active members
        """
        result = await self.session.execute(
            select(func.count()).where(
                and_(
                    TeamMemberModel.team_id == team_id,
                    TeamMemberModel.tenant_id == tenant_id,
                    TeamMemberModel.is_active,
                )
            )
        )
        return result.scalar() or 0
