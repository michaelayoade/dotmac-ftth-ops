"""Comprehensive tests for TeamService."""

import uuid
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from dotmac.platform.user_management.models import Team, TeamMember
from dotmac.platform.user_management.schemas import (
    TeamCreate,
    TeamMemberCreate,
    TeamMemberUpdate,
    TeamUpdate,
)
from dotmac.platform.user_management.team_service import TeamService


@pytest_asyncio.fixture
async def team_service(async_db_session: AsyncSession):
    """Create TeamService instance for testing with automatic cleanup."""
    service = TeamService(async_db_session)
    try:
        yield service
    finally:
        try:
            await async_db_session.commit()
        except Exception:
            await async_db_session.rollback()


@pytest.fixture
def tenant_id():
    """Test tenant ID."""
    return "test-tenant-123"


@pytest_asyncio.fixture
async def sample_team(async_db_session: AsyncSession, tenant_id: str):
    """Create a sample team for testing."""
    unique_suffix = uuid.uuid4().hex[:8]
    team = Team(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        name=f"Engineering-{unique_suffix}",
        slug=f"engineering-{unique_suffix}",
        description="Engineering team",
        is_active=True,
        is_default=False,
        color="#FF5733",
        icon="code",
        metadata_={"department": "tech"},
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(team)
    await async_db_session.commit()
    await async_db_session.refresh(team)
    try:
        yield team
    finally:
        try:
            await async_db_session.delete(team)
            await async_db_session.commit()
        except Exception:
            await async_db_session.rollback()


@pytest_asyncio.fixture
async def sample_user(async_db_session: AsyncSession, tenant_id: str):
    """Create a sample user for testing."""
    from dotmac.platform.user_management.models import User

    user = User(
        id=uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        password_hash="hash",
        tenant_id=tenant_id,
        created_at=datetime.now(UTC),
        updated_at=datetime.now(UTC),
    )
    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)
    try:
        yield user
    finally:
        try:
            await async_db_session.delete(user)
            await async_db_session.commit()
        except Exception:
            await async_db_session.rollback()


@pytest.mark.integration
class TestTeamCreation:
    """Test team creation functionality."""

    @pytest.mark.asyncio
    async def test_create_team_success(self, team_service: TeamService, tenant_id: str):
        """Test successful team creation."""
        team_data = TeamCreate(
            name="Sales Team",
            slug="sales-team",
            description="Sales and marketing",
            color="#00FF00",
            icon="chart",
        )

        team = await team_service.create_team(team_data, tenant_id)

        assert team.id is not None
        assert team.name == "Sales Team"
        assert team.slug == "sales-team"
        assert team.tenant_id == tenant_id
        assert team.is_active is True
        assert team.color == "#00FF00"

    @pytest.mark.asyncio
    async def test_create_team_duplicate_name(
        self, team_service: TeamService, tenant_id: str, sample_team: Team
    ):
        """Test creating team with duplicate name fails."""
        team_data = TeamCreate(
            name=sample_team.name,  # Same name
            slug="different-slug",
        )

        with pytest.raises(ValueError, match="already exists"):
            await team_service.create_team(team_data, tenant_id)

    @pytest.mark.asyncio
    async def test_create_team_duplicate_slug(
        self, team_service: TeamService, tenant_id: str, sample_team: Team
    ):
        """Test creating team with duplicate slug fails."""
        team_data = TeamCreate(
            name="Different Name",
            slug=sample_team.slug,  # Same slug
        )

        with pytest.raises(ValueError, match="already exists"):
            await team_service.create_team(team_data, tenant_id)

    @pytest.mark.asyncio
    async def test_create_team_different_tenant_allows_same_name(
        self, team_service: TeamService, sample_team: Team
    ):
        """Test that different tenants can have teams with same name."""
        different_tenant = "different-tenant-456"
        team_data = TeamCreate(
            name=sample_team.name,  # Same name but different tenant
            slug=sample_team.slug,  # Same slug but different tenant
        )

        team = await team_service.create_team(team_data, different_tenant)

        assert team.id is not None
        assert team.name == sample_team.name
        assert team.tenant_id == different_tenant
        assert team.tenant_id != sample_team.tenant_id


@pytest.mark.integration
class TestTeamRetrieval:
    """Test team retrieval functionality."""

    @pytest.mark.asyncio
    async def test_get_team_by_id(
        self, team_service: TeamService, tenant_id: str, sample_team: Team
    ):
        """Test getting team by ID."""
        team = await team_service.get_team(sample_team.id, tenant_id)

        assert team is not None
        assert team.id == sample_team.id
        assert team.name == sample_team.name

    @pytest.mark.asyncio
    async def test_get_team_wrong_tenant(self, team_service: TeamService, sample_team: Team):
        """Test getting team from wrong tenant returns None."""
        wrong_tenant = "wrong-tenant-999"
        team = await team_service.get_team(sample_team.id, wrong_tenant)

        assert team is None

    @pytest.mark.asyncio
    async def test_get_team_by_slug(
        self, team_service: TeamService, tenant_id: str, sample_team: Team
    ):
        """Test getting team by slug."""
        team = await team_service.get_team_by_slug(sample_team.slug, tenant_id)

        assert team is not None
        assert team.slug == sample_team.slug
        assert team.id == sample_team.id

    @pytest.mark.asyncio
    async def test_list_teams_pagination(
        self, team_service: TeamService, tenant_id: str, async_db_session: AsyncSession
    ):
        """Test team listing with pagination."""
        # Create multiple teams
        for i in range(5):
            team = Team(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                name=f"Team {i}",
                slug=f"team-{i}",
                is_active=True,
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            async_db_session.add(team)
        await async_db_session.commit()

        # Test pagination
        result = await team_service.list_teams(tenant_id, page=1, page_size=3)

        assert len(result.items) == 3
        assert result.total == 5
        assert result.page == 1
        assert result.page_size == 3

    @pytest.mark.asyncio
    async def test_list_teams_filter_active(
        self, team_service: TeamService, tenant_id: str, async_db_session: AsyncSession
    ):
        """Test filtering teams by active status."""
        # Create active and inactive teams
        active_team = Team(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Active Team",
            slug="active",
            is_active=True,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        inactive_team = Team(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Inactive Team",
            slug="inactive",
            is_active=False,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add_all([active_team, inactive_team])
        await async_db_session.commit()

        # Filter for active only
        result = await team_service.list_teams(tenant_id, is_active=True)

        assert all(team.is_active for team in result.items)
        assert inactive_team.id not in [t.id for t in result.items]

    @pytest.mark.asyncio
    async def test_list_teams_search(
        self, team_service: TeamService, tenant_id: str, async_db_session: AsyncSession
    ):
        """Test searching teams by name or description."""
        team1 = Team(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Engineering Team",
            slug="eng",
            description="Software engineers",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        team2 = Team(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Sales Team",
            slug="sales",
            description="Sales department",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add_all([team1, team2])
        await async_db_session.commit()

        # Search for "engineering"
        result = await team_service.list_teams(tenant_id, search="engineering")

        assert len(result.items) >= 1
        assert team1.id in [t.id for t in result.items]
        assert team2.id not in [t.id for t in result.items]


@pytest.mark.integration
class TestTeamUpdate:
    """Test team update functionality."""

    @pytest.mark.asyncio
    async def test_update_team_success(
        self, team_service: TeamService, tenant_id: str, sample_team: Team
    ):
        """Test successful team update."""
        update_data = TeamUpdate(
            name="Updated Engineering",
            description="Updated description",
            color="#0000FF",
        )

        updated_team = await team_service.update_team(sample_team.id, update_data, tenant_id)

        assert updated_team.name == "Updated Engineering"
        assert updated_team.description == "Updated description"
        assert updated_team.color == "#0000FF"
        assert updated_team.slug == sample_team.slug  # Unchanged

    @pytest.mark.asyncio
    async def test_update_team_not_found(self, team_service: TeamService, tenant_id: str):
        """Test updating non-existent team raises error."""
        fake_id = uuid.uuid4()
        update_data = TeamUpdate(name="New Name")

        with pytest.raises(ValueError, match="not found"):
            await team_service.update_team(fake_id, update_data, tenant_id)

    @pytest.mark.asyncio
    async def test_update_team_wrong_tenant(self, team_service: TeamService, sample_team: Team):
        """Test updating team from wrong tenant fails."""
        wrong_tenant = "wrong-tenant-999"
        update_data = TeamUpdate(name="New Name")

        with pytest.raises(ValueError, match="not found"):
            await team_service.update_team(sample_team.id, update_data, wrong_tenant)


@pytest.mark.integration
class TestTeamDeletion:
    """Test team deletion functionality."""

    @pytest.mark.asyncio
    async def test_delete_team_success(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        async_db_session: AsyncSession,
    ):
        """Test successful team deletion."""
        result = await team_service.delete_team(sample_team.id, tenant_id)

        assert result is True

        # Verify team is deleted
        stmt = select(Team).where(Team.id == sample_team.id)
        db_team = (await async_db_session.execute(stmt)).scalar_one_or_none()
        assert db_team is None

    @pytest.mark.asyncio
    async def test_delete_team_not_found(self, team_service: TeamService, tenant_id: str):
        """Test deleting non-existent team returns False."""
        fake_id = uuid.uuid4()
        result = await team_service.delete_team(fake_id, tenant_id)

        assert result is False


@pytest.mark.integration
class TestTeamMembers:
    """Test team member functionality."""

    @pytest.mark.asyncio
    async def test_add_team_member_success(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        sample_user,
    ):
        """Test adding member to team."""
        member_data = TeamMemberCreate(
            team_id=sample_team.id,
            user_id=sample_user.id,
            role="member",
        )

        member = await team_service.add_team_member(member_data, tenant_id)

        assert member.team_id == sample_team.id
        assert member.user_id == sample_user.id
        assert member.role == "member"
        assert member.is_active is True

    @pytest.mark.asyncio
    async def test_add_duplicate_member(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        sample_user,
    ):
        """Test adding duplicate member fails."""
        member_data = TeamMemberCreate(
            team_id=sample_team.id,
            user_id=sample_user.id,
            role="member",
        )

        # Add first time
        await team_service.add_team_member(member_data, tenant_id)

        # Try to add again
        with pytest.raises(ValueError, match="already a member"):
            await team_service.add_team_member(member_data, tenant_id)

    @pytest.mark.asyncio
    async def test_list_team_members(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        async_db_session: AsyncSession,
    ):
        """Test listing team members."""
        # Add members
        for _i in range(3):
            member = TeamMember(
                id=uuid.uuid4(),
                team_id=sample_team.id,
                user_id=uuid.uuid4(),
                role="member",
                tenant_id=tenant_id,
                is_active=True,
                joined_at=datetime.now(UTC),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            async_db_session.add(member)
        await async_db_session.commit()

        result = await team_service.list_team_members(sample_team.id, tenant_id)

        assert len(result.items) == 3
        assert result.total == 3

    @pytest.mark.asyncio
    async def test_update_team_member(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        sample_user,
    ):
        """Test updating team member."""
        # Add member
        member_data = TeamMemberCreate(
            team_id=sample_team.id,
            user_id=sample_user.id,
            role="member",
        )
        member = await team_service.add_team_member(member_data, tenant_id)

        # Update role
        update_data = TeamMemberUpdate(role="lead")
        updated_member = await team_service.update_team_member(member.id, update_data, tenant_id)

        assert updated_member.role == "lead"

    @pytest.mark.asyncio
    async def test_remove_team_member(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        sample_user,
        async_db_session: AsyncSession,
    ):
        """Test removing team member."""
        # Add member
        member_data = TeamMemberCreate(
            team_id=sample_team.id,
            user_id=sample_user.id,
            role="member",
        )
        member = await team_service.add_team_member(member_data, tenant_id)

        # Remove member
        result = await team_service.remove_team_member(member.id, tenant_id)

        assert result is True

        # Verify member is deleted
        stmt = select(TeamMember).where(TeamMember.id == member.id)
        db_member = (await async_db_session.execute(stmt)).scalar_one_or_none()
        assert db_member is None

    @pytest.mark.asyncio
    async def test_get_user_teams(
        self,
        team_service: TeamService,
        tenant_id: str,
        sample_team: Team,
        sample_user,
        async_db_session: AsyncSession,
    ):
        """Test getting all teams a user belongs to."""
        # Create another team
        team2 = Team(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            name="Team 2",
            slug="team-2",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add(team2)
        await async_db_session.commit()

        # Add user to both teams
        member1 = TeamMember(
            id=uuid.uuid4(),
            team_id=sample_team.id,
            user_id=sample_user.id,
            role="member",
            tenant_id=tenant_id,
            is_active=True,
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        member2 = TeamMember(
            id=uuid.uuid4(),
            team_id=team2.id,
            user_id=sample_user.id,
            role="lead",
            tenant_id=tenant_id,
            is_active=True,
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add_all([member1, member2])
        await async_db_session.commit()

        # Get user's teams
        teams = await team_service.get_user_teams(sample_user.id, tenant_id)

        assert len(teams) == 2
        team_ids = [t.id for t in teams]
        assert sample_team.id in team_ids
        assert team2.id in team_ids


@pytest.mark.integration
class TestTenantIsolation:
    """Test tenant isolation for teams."""

    @pytest.mark.asyncio
    async def test_list_teams_isolates_by_tenant(
        self, team_service: TeamService, async_db_session: AsyncSession
    ):
        """Test that listing teams only returns teams from current tenant."""
        tenant1 = "tenant-1"
        tenant2 = "tenant-2"

        # Create teams in different tenants
        team1 = Team(
            id=uuid.uuid4(),
            tenant_id=tenant1,
            name="Team 1",
            slug="team-1",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        team2 = Team(
            id=uuid.uuid4(),
            tenant_id=tenant2,
            name="Team 2",
            slug="team-2",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add_all([team1, team2])
        await async_db_session.commit()

        # List teams for tenant1
        result = await team_service.list_teams(tenant1)

        # Should only get team1
        assert len(result.items) == 1
        assert result.items[0].id == team1.id

    @pytest.mark.asyncio
    async def test_team_members_isolates_by_tenant(
        self, team_service: TeamService, async_db_session: AsyncSession
    ):
        """Test that team members are isolated by tenant."""
        tenant1 = "tenant-1"
        tenant2 = "tenant-2"

        # Create team in tenant1
        team = Team(
            id=uuid.uuid4(),
            tenant_id=tenant1,
            name="Team",
            slug="team",
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add(team)
        await async_db_session.commit()

        # Add member in tenant1
        member = TeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            user_id=uuid.uuid4(),
            role="member",
            tenant_id=tenant1,
            is_active=True,
            joined_at=datetime.now(UTC),
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        async_db_session.add(member)
        await async_db_session.commit()

        # Try to get member from tenant2
        result = await team_service.get_team_member(member.id, tenant2)

        assert result is None


@pytest_asyncio.fixture(autouse=True)
async def clean_team_tables(async_db_session: AsyncSession):
    """Ensure team tables start empty for each test."""
    await async_db_session.execute(delete(TeamMember))
    await async_db_session.execute(delete(Team))
    await async_db_session.commit()
    yield
