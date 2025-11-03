"""
Team management API router.

Provides REST endpoints for managing teams and team members.
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.auth.core import UserInfo, get_current_user
from dotmac.platform.auth.rbac_dependencies import (
    require_team_create,
    require_team_delete,
    require_team_manage_members,
    require_team_read,
    require_team_update,
)
from dotmac.platform.db import get_async_session

from .schemas import (
    Team,
    TeamCreate,
    TeamListResponse,
    TeamMember,
    TeamMemberCreate,
    TeamMemberListResponse,
    TeamMemberUpdate,
    TeamUpdate,
)
from .team_service import TeamService

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/teams", tags=["Team Management"])


def _require_tenant_id(user: UserInfo) -> str:
    """Ensure team operations run within an explicit tenant context."""
    tenant_id = user.tenant_id
    if tenant_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant context is required for team operations.",
        )
    return tenant_id


def get_team_service(
    db: Annotated[AsyncSession, Depends(get_async_session)],
) -> TeamService:
    """Dependency to get TeamService instance."""
    return TeamService(db)


# ==================== Team Endpoints ====================


@router.post("", response_model=Team, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user: Annotated[UserInfo, Depends(require_team_create)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> Team:
    """
    Create a new team.

    Requires: team.create permission
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        team = await team_service.create_team(team_data, tenant_id)
        return Team.model_validate(team)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Failed to create team", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create team",
        )


@router.get("", response_model=TeamListResponse)
async def list_teams(
    current_user: Annotated[UserInfo, Depends(require_team_read)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    search: str | None = Query(None, description="Search term for name/description"),
) -> TeamListResponse:
    """
    List all teams for the current tenant.

    Requires: team.read permission
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        return await team_service.list_teams(
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            is_active=is_active,
            search=search,
        )
    except Exception as e:
        logger.error("Failed to list teams", error=str(e), tenant_id=tenant_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list teams",
        )


@router.get("/{team_id}", response_model=Team)
async def get_team(
    team_id: UUID,
    current_user: Annotated[UserInfo, Depends(require_team_read)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> Team:
    """
    Get a specific team by ID.

    Requires: team.read permission
    """
    tenant_id = _require_tenant_id(current_user)
    team = await team_service.get_team(team_id, tenant_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found",
        )

    return Team.model_validate(team)


@router.get("/slug/{slug}", response_model=Team)
async def get_team_by_slug(
    slug: str,
    current_user: Annotated[UserInfo, Depends(require_team_read)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> Team:
    """
    Get a specific team by slug.

    Requires: team.read permission
    """
    tenant_id = _require_tenant_id(current_user)
    team = await team_service.get_team_by_slug(slug, tenant_id)
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team with slug '{slug}' not found",
        )

    return Team.model_validate(team)


@router.patch("/{team_id}", response_model=Team)
async def update_team(
    team_id: UUID,
    team_data: TeamUpdate,
    current_user: Annotated[UserInfo, Depends(require_team_update)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> Team:
    """
    Update a team.

    Requires: team.update permission
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        team = await team_service.update_team(team_id, team_data, tenant_id)
        return Team.model_validate(team)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to update team",
            error=str(e),
            team_id=str(team_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update team",
        )


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: UUID,
    current_user: Annotated[UserInfo, Depends(require_team_delete)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> None:
    """
    Delete a team.

    Requires: team.delete permission
    """
    tenant_id = _require_tenant_id(current_user)
    deleted = await team_service.delete_team(team_id, tenant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team {team_id} not found",
        )


# ==================== Team Member Endpoints ====================


@router.post("/{team_id}/members", response_model=TeamMember, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: UUID,
    member_data: TeamMemberCreate,
    current_user: Annotated[UserInfo, Depends(require_team_manage_members)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> TeamMember:
    """
    Add a member to a team.

    Requires: team.manage_members permission
    """
    # Ensure team_id in path matches team_id in body
    if member_data.team_id != team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team ID in path must match team ID in request body",
        )

    try:
        tenant_id = _require_tenant_id(current_user)
        member = await team_service.add_team_member(member_data, tenant_id)
        return TeamMember.model_validate(member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "Failed to add team member",
            error=str(e),
            team_id=str(team_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add team member",
        )


@router.get("/{team_id}/members", response_model=TeamMemberListResponse)
async def list_team_members(
    team_id: UUID,
    current_user: Annotated[UserInfo, Depends(require_team_read)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    role: str | None = Query(None, description="Filter by role"),
    is_active: bool | None = Query(None, description="Filter by active status"),
) -> TeamMemberListResponse:
    """
    List all members of a team.

    Requires: team.read permission
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        return await team_service.list_team_members(
            team_id=team_id,
            tenant_id=tenant_id,
            page=page,
            page_size=page_size,
            role=role,
            is_active=is_active,
        )
    except Exception as e:
        logger.error(
            "Failed to list team members",
            error=str(e),
            team_id=str(team_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list team members",
        )


@router.patch("/{team_id}/members/{member_id}", response_model=TeamMember)
async def update_team_member(
    team_id: UUID,
    member_id: UUID,
    member_data: TeamMemberUpdate,
    current_user: Annotated[UserInfo, Depends(require_team_manage_members)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> TeamMember:
    """
    Update a team member.

    Requires: team.manage_members permission
    """
    tenant_id = _require_tenant_id(current_user)
    member = await team_service.update_team_member(member_id, member_data, tenant_id)

    if str(member.team_id) != str(team_id):
        logger.warning(
            "Team member belongs to different team",
            member_id=str(member_id),
            expected_team_id=str(team_id),
            actual_team_id=str(member.team_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member does not belong to specified team",
        )

    return TeamMember.model_validate(member)


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: UUID,
    member_id: UUID,
    current_user: Annotated[UserInfo, Depends(require_team_manage_members)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
) -> None:
    """
    Remove a member from a team.

    Requires: team.manage_members permission
    """
    # Get member to verify it belongs to the team
    tenant_id = _require_tenant_id(current_user)
    member = await team_service.get_team_member(member_id, tenant_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member {member_id} not found",
        )

    if str(member.team_id) != str(team_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member does not belong to specified team",
        )

    deleted = await team_service.remove_team_member(member_id, tenant_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Team member {member_id} not found",
        )


# ==================== User Teams Endpoints ====================


@router.get("/users/{user_id}/teams", response_model=list[Team])
async def get_user_teams(
    user_id: UUID,
    current_user: Annotated[UserInfo, Depends(require_team_read)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
    is_active: bool | None = Query(None, description="Filter by active membership"),
) -> list[Team]:
    """
    Get all teams a user belongs to.

    Requires: team.read permission
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        teams = await team_service.get_user_teams(
            user_id=user_id,
            tenant_id=tenant_id,
            is_active=is_active,
        )
        return [Team.model_validate(team) for team in teams]
    except Exception as e:
        logger.error(
            "Failed to get user teams",
            error=str(e),
            user_id=str(user_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user teams",
        )


@router.get("/me/teams", response_model=list[Team])
async def get_my_teams(
    current_user: Annotated[UserInfo, Depends(get_current_user)],
    team_service: Annotated[TeamService, Depends(get_team_service)],
    is_active: bool | None = Query(None, description="Filter by active membership"),
) -> list[Team]:
    """
    Get all teams the current user belongs to.

    Requires: authenticated user
    """
    tenant_id = _require_tenant_id(current_user)
    try:
        user_uuid = UUID(current_user.user_id)
        teams = await team_service.get_user_teams(
            user_id=user_uuid,
            tenant_id=tenant_id,
            is_active=is_active,
        )
        return [Team.model_validate(team) for team in teams]
    except Exception as e:
        logger.error(
            "Failed to get current user teams",
            error=str(e),
            user_id=str(current_user.user_id),
            tenant_id=tenant_id,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get your teams",
        )
