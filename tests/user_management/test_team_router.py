"""Tests for team management API router."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, status

from dotmac.platform.auth.core import UserInfo
from dotmac.platform.user_management.models import Team, TeamMember
from dotmac.platform.user_management.schemas import (
    TeamCreate,
    TeamListResponse,
    TeamMemberCreate,
    TeamMemberListResponse,
    TeamMemberUpdate,
    TeamUpdate,
)
from dotmac.platform.user_management.team_service import TeamService

pytestmark = pytest.mark.integration


@pytest.fixture
def mock_team_service():
    """Mock TeamService."""
    return AsyncMock(spec=TeamService)


@pytest.fixture
def sample_team():
    """Create a sample team for testing."""
    return Team(
        id=uuid.uuid4(),
        tenant_id="tenant-123",
        name="Engineering",
        slug="engineering",
        description="Engineering team",
        is_active=True,
        is_default=False,
        team_lead_id=uuid.uuid4(),
        color="#FF5733",
        icon="code",
        metadata_={"department": "tech"},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def sample_team_member(sample_team):
    """Create a sample team member for testing."""
    return TeamMember(
        id=uuid.uuid4(),
        team_id=sample_team.id,
        user_id=uuid.uuid4(),
        role="member",
        tenant_id="tenant-123",
        is_active=True,
        joined_at=datetime.now(UTC),
        left_at=None,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )


@pytest.fixture
def current_user():
    """Mock current user info."""
    return UserInfo(
        user_id=str(uuid.uuid4()),
        email="test@example.com",
        username="testuser",
        roles=["user"],
        tenant_id="tenant-123",
    )


class TestCreateTeam:
    """Test create team endpoint."""

    @pytest.mark.asyncio
    async def test_create_team_success(self, sample_team, current_user, mock_team_service):
        """Test successful team creation."""
        from dotmac.platform.user_management.team_router import create_team

        team_data = TeamCreate(
            name="Sales Team",
            slug="sales-team",
            description="Sales department",
        )

        mock_team_service.create_team.return_value = sample_team

        response = await create_team(team_data, current_user, mock_team_service)

        assert response.id == sample_team.id
        assert response.name == sample_team.name
        mock_team_service.create_team.assert_called_once_with(team_data, current_user.tenant_id)

    @pytest.mark.asyncio
    async def test_create_team_duplicate_name(self, current_user, mock_team_service):
        """Test creating team with duplicate name."""
        from dotmac.platform.user_management.team_router import create_team

        team_data = TeamCreate(name="Engineering", slug="engineering")
        mock_team_service.create_team.side_effect = ValueError("Team already exists")

        with pytest.raises(HTTPException) as exc_info:
            await create_team(team_data, current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestListTeams:
    """Test list teams endpoint."""

    @pytest.mark.asyncio
    async def test_list_teams_success(self, sample_team, current_user, mock_team_service):
        """Test listing teams successfully."""
        from dotmac.platform.user_management.team_router import list_teams

        mock_response = TeamListResponse(
            items=[sample_team], total=1, page=1, page_size=50, pages=1
        )
        mock_team_service.list_teams.return_value = mock_response

        response = await list_teams(current_user, mock_team_service, page=1, page_size=50)

        assert len(response.items) == 1
        assert response.items[0].id == sample_team.id
        assert response.total == 1

    @pytest.mark.asyncio
    async def test_list_teams_with_filters(self, current_user, mock_team_service):
        """Test listing teams with filters."""
        from dotmac.platform.user_management.team_router import list_teams

        mock_response = TeamListResponse(items=[], total=0, page=1, page_size=50, pages=0)
        mock_team_service.list_teams.return_value = mock_response

        await list_teams(
            current_user,
            mock_team_service,
            page=1,
            page_size=20,
            is_active=True,
            search="engineering",
        )

        mock_team_service.list_teams.assert_called_once_with(
            tenant_id=current_user.tenant_id,
            page=1,
            page_size=20,
            is_active=True,
            search="engineering",
        )


class TestGetTeam:
    """Test get team endpoint."""

    @pytest.mark.asyncio
    async def test_get_team_success(self, sample_team, current_user, mock_team_service):
        """Test getting team by ID successfully."""
        from dotmac.platform.user_management.team_router import get_team

        mock_team_service.get_team.return_value = sample_team

        response = await get_team(sample_team.id, current_user, mock_team_service)

        assert response.id == sample_team.id
        assert response.name == sample_team.name

    @pytest.mark.asyncio
    async def test_get_team_not_found(self, current_user, mock_team_service):
        """Test getting non-existent team."""
        from dotmac.platform.user_management.team_router import get_team

        mock_team_service.get_team.return_value = None
        team_id = uuid.uuid4()

        with pytest.raises(HTTPException) as exc_info:
            await get_team(team_id, current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


class TestGetTeamBySlug:
    """Test get team by slug endpoint."""

    @pytest.mark.asyncio
    async def test_get_team_by_slug_success(self, sample_team, current_user, mock_team_service):
        """Test getting team by slug successfully."""
        from dotmac.platform.user_management.team_router import get_team_by_slug

        mock_team_service.get_team_by_slug.return_value = sample_team

        response = await get_team_by_slug(sample_team.slug, current_user, mock_team_service)

        assert response.slug == sample_team.slug

    @pytest.mark.asyncio
    async def test_get_team_by_slug_not_found(self, current_user, mock_team_service):
        """Test getting team by non-existent slug."""
        from dotmac.platform.user_management.team_router import get_team_by_slug

        mock_team_service.get_team_by_slug.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await get_team_by_slug("nonexistent", current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


class TestUpdateTeam:
    """Test update team endpoint."""

    @pytest.mark.asyncio
    async def test_update_team_success(self, sample_team, current_user, mock_team_service):
        """Test updating team successfully."""
        from dotmac.platform.user_management.team_router import update_team

        update_data = TeamUpdate(name="Updated Engineering")
        # Create updated team by copying attributes properly
        updated_team = Team(
            id=sample_team.id,
            tenant_id=sample_team.tenant_id,
            name="Updated Engineering",
            slug=sample_team.slug,
            description=sample_team.description,
            is_active=sample_team.is_active,
            is_default=sample_team.is_default,
            team_lead_id=sample_team.team_lead_id,
            color=sample_team.color,
            icon=sample_team.icon,
            metadata_=sample_team.metadata_,
            created_at=sample_team.created_at,
            updated_at=datetime.now(UTC),
        )
        mock_team_service.update_team.return_value = updated_team

        response = await update_team(sample_team.id, update_data, current_user, mock_team_service)

        assert response.name == "Updated Engineering"

    @pytest.mark.asyncio
    async def test_update_team_not_found(self, current_user, mock_team_service):
        """Test updating non-existent team."""
        from dotmac.platform.user_management.team_router import update_team

        update_data = TeamUpdate(name="New Name")
        mock_team_service.update_team.side_effect = ValueError("Team not found")

        with pytest.raises(HTTPException) as exc_info:
            await update_team(uuid.uuid4(), update_data, current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestDeleteTeam:
    """Test delete team endpoint."""

    @pytest.mark.asyncio
    async def test_delete_team_success(self, sample_team, current_user, mock_team_service):
        """Test deleting team successfully."""
        from dotmac.platform.user_management.team_router import delete_team

        mock_team_service.delete_team.return_value = True

        response = await delete_team(sample_team.id, current_user, mock_team_service)

        assert response is None  # 204 No Content
        mock_team_service.delete_team.assert_called_once_with(
            sample_team.id, current_user.tenant_id
        )

    @pytest.mark.asyncio
    async def test_delete_team_not_found(self, current_user, mock_team_service):
        """Test deleting non-existent team."""
        from dotmac.platform.user_management.team_router import delete_team

        mock_team_service.delete_team.return_value = False

        with pytest.raises(HTTPException) as exc_info:
            await delete_team(uuid.uuid4(), current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND


class TestAddTeamMember:
    """Test add team member endpoint."""

    @pytest.mark.asyncio
    async def test_add_team_member_success(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test adding team member successfully."""
        from dotmac.platform.user_management.team_router import add_team_member

        member_data = TeamMemberCreate(
            team_id=sample_team.id,
            user_id=uuid.uuid4(),
            role="member",
        )
        mock_team_service.add_team_member.return_value = sample_team_member

        response = await add_team_member(
            sample_team.id, member_data, current_user, mock_team_service
        )

        assert response.team_id == sample_team_member.team_id

    @pytest.mark.asyncio
    async def test_add_team_member_id_mismatch(self, sample_team, current_user, mock_team_service):
        """Test adding member with mismatched team ID."""
        from dotmac.platform.user_management.team_router import add_team_member

        member_data = TeamMemberCreate(
            team_id=uuid.uuid4(),  # Different from path parameter
            user_id=uuid.uuid4(),
            role="member",
        )

        with pytest.raises(HTTPException) as exc_info:
            await add_team_member(sample_team.id, member_data, current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestListTeamMembers:
    """Test list team members endpoint."""

    @pytest.mark.asyncio
    async def test_list_team_members_success(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test listing team members successfully."""
        from dotmac.platform.user_management.team_router import list_team_members

        mock_response = TeamMemberListResponse(
            items=[sample_team_member], total=1, page=1, page_size=50, pages=1
        )
        mock_team_service.list_team_members.return_value = mock_response

        response = await list_team_members(sample_team.id, current_user, mock_team_service)

        assert len(response.items) == 1
        assert response.items[0].team_id == sample_team.id


class TestUpdateTeamMember:
    """Test update team member endpoint."""

    @pytest.mark.asyncio
    async def test_update_team_member_success(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test updating team member successfully."""
        from dotmac.platform.user_management.team_router import update_team_member

        update_data = TeamMemberUpdate(role="lead")
        # Create updated member by copying attributes properly
        updated_member = TeamMember(
            id=sample_team_member.id,
            team_id=sample_team_member.team_id,
            user_id=sample_team_member.user_id,
            role="lead",
            tenant_id=sample_team_member.tenant_id,
            is_active=sample_team_member.is_active,
            joined_at=sample_team_member.joined_at,
            left_at=sample_team_member.left_at,
            created_at=sample_team_member.created_at,
            updated_at=datetime.now(UTC),
        )
        mock_team_service.update_team_member.return_value = updated_member

        response = await update_team_member(
            sample_team.id,
            sample_team_member.id,
            update_data,
            current_user,
            mock_team_service,
        )

        assert response.role == "lead"

    @pytest.mark.asyncio
    async def test_update_team_member_wrong_team(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test updating member that doesn't belong to team."""
        from dotmac.platform.user_management.team_router import update_team_member

        update_data = TeamMemberUpdate(role="lead")
        # Create member with wrong team_id
        wrong_team_member = TeamMember(
            id=sample_team_member.id,
            team_id=uuid.uuid4(),  # Different team
            user_id=sample_team_member.user_id,
            role=sample_team_member.role,
            tenant_id=sample_team_member.tenant_id,
            is_active=sample_team_member.is_active,
            joined_at=sample_team_member.joined_at,
            left_at=sample_team_member.left_at,
            created_at=sample_team_member.created_at,
            updated_at=datetime.now(UTC),
        )
        mock_team_service.update_team_member.return_value = wrong_team_member

        with pytest.raises(HTTPException) as exc_info:
            await update_team_member(
                sample_team.id,
                sample_team_member.id,
                update_data,
                current_user,
                mock_team_service,
            )

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestRemoveTeamMember:
    """Test remove team member endpoint."""

    @pytest.mark.asyncio
    async def test_remove_team_member_success(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test removing team member successfully."""
        from dotmac.platform.user_management.team_router import remove_team_member

        mock_team_service.get_team_member.return_value = sample_team_member
        mock_team_service.remove_team_member.return_value = True

        response = await remove_team_member(
            sample_team.id, sample_team_member.id, current_user, mock_team_service
        )

        assert response is None  # 204 No Content

    @pytest.mark.asyncio
    async def test_remove_team_member_not_found(self, sample_team, current_user, mock_team_service):
        """Test removing non-existent member."""
        from dotmac.platform.user_management.team_router import remove_team_member

        mock_team_service.get_team_member.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            await remove_team_member(sample_team.id, uuid.uuid4(), current_user, mock_team_service)

        assert exc_info.value.status_code == status.HTTP_404_NOT_FOUND

    @pytest.mark.asyncio
    async def test_remove_member_from_wrong_team(
        self, sample_team, sample_team_member, current_user, mock_team_service
    ):
        """Test removing member from wrong team."""
        from dotmac.platform.user_management.team_router import remove_team_member

        # Create member with wrong team_id
        wrong_team_member = TeamMember(
            id=sample_team_member.id,
            team_id=uuid.uuid4(),  # Different team
            user_id=sample_team_member.user_id,
            role=sample_team_member.role,
            tenant_id=sample_team_member.tenant_id,
            is_active=sample_team_member.is_active,
            joined_at=sample_team_member.joined_at,
            left_at=sample_team_member.left_at,
            created_at=sample_team_member.created_at,
            updated_at=sample_team_member.updated_at,
        )
        mock_team_service.get_team_member.return_value = wrong_team_member

        with pytest.raises(HTTPException) as exc_info:
            await remove_team_member(
                sample_team.id, sample_team_member.id, current_user, mock_team_service
            )

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST


class TestGetUserTeams:
    """Test get user teams endpoint."""

    @pytest.mark.asyncio
    async def test_get_user_teams_success(self, sample_team, current_user, mock_team_service):
        """Test getting user's teams successfully."""
        from dotmac.platform.user_management.team_router import get_user_teams

        mock_team_service.get_user_teams.return_value = [sample_team]

        response = await get_user_teams(
            uuid.uuid4(), current_user, mock_team_service, is_active=True
        )

        assert len(response) == 1
        assert response[0].id == sample_team.id


class TestGetMyTeams:
    """Test get my teams endpoint."""

    @pytest.mark.asyncio
    async def test_get_my_teams_success(self, sample_team, current_user, mock_team_service):
        """Test getting current user's teams."""
        from unittest.mock import ANY

        from dotmac.platform.user_management.team_router import get_my_teams

        mock_team_service.get_user_teams.return_value = [sample_team]

        response = await get_my_teams(current_user, mock_team_service)

        assert len(response) == 1
        assert response[0].id == sample_team.id
        # The router passes user_id as string and is_active as Query object
        mock_team_service.get_user_teams.assert_called_once_with(
            user_id=current_user.user_id,  # String, not UUID
            tenant_id=current_user.tenant_id,
            is_active=ANY,  # Query(None) object, not None
        )
