"""
Comprehensive tests for tenant management system.

Tests all tenant CRUD operations, settings, usage tracking, and invitations.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
import pytest_asyncio

from src.dotmac.platform.tenant.models import (
    TenantInvitationStatus,
    TenantPlanType,
    TenantStatus,
)
from src.dotmac.platform.tenant.schemas import (
    TenantCreate,
    TenantInvitationCreate,
    TenantSettingCreate,
    TenantUpdate,
    TenantUsageCreate,
)
from src.dotmac.platform.tenant.service import (
    TenantAlreadyExistsError,
    TenantNotFoundError,
    TenantService,
)


@pytest_asyncio.fixture
async def tenant_service(async_session):
    """Get tenant service instance."""
    return TenantService(async_session)


@pytest_asyncio.fixture
async def sample_tenant(tenant_service):
    """Create a sample tenant for testing."""
    unique_suffix = uuid4().hex[:8]
    slug = f"test-org-{unique_suffix}"
    tenant_data = TenantCreate(
        name="Test Org",
        slug=slug,
        email=f"{slug}@example.com",
        plan_type=TenantPlanType.PROFESSIONAL,
    )
    return await tenant_service.create_tenant(tenant_data, created_by="test-user")


@pytest.mark.integration
class TestTenantCRUD:
    """Test tenant CRUD operations."""

    async def test_create_tenant_success(self, tenant_service):
        """Test successful tenant creation."""
        tenant_data = TenantCreate(
            name="New Organization",
            slug="new-org",
            email="admin@neworg.com",
            plan_type=TenantPlanType.STARTER,
            max_users=10,
            max_api_calls_per_month=50000,
        )

        tenant = await tenant_service.create_tenant(tenant_data, created_by="admin-123")

        assert tenant.id is not None
        assert tenant.name == "New Organization"
        assert tenant.slug == "new-org"
        assert tenant.email == "admin@neworg.com"
        assert tenant.plan_type == TenantPlanType.STARTER
        assert tenant.status == TenantStatus.TRIAL
        assert tenant.max_users == 10
        assert tenant.trial_ends_at is not None
        assert tenant.features is not None
        assert tenant.created_by == "admin-123"

    async def test_create_tenant_duplicate_slug(self, tenant_service, sample_tenant):
        """Test creating tenant with duplicate slug fails."""
        tenant_data = TenantCreate(
            name="Another Org",
            slug=sample_tenant.slug,  # Same slug as sample_tenant
            email="another@example.com",
        )

        with pytest.raises(TenantAlreadyExistsError, match="slug"):
            await tenant_service.create_tenant(tenant_data)

    async def test_create_tenant_with_domain(self, tenant_service):
        """Test creating tenant with custom domain."""
        tenant_data = TenantCreate(
            name="Domain Org",
            slug="domain-org",
            domain="custom.example.com",
            email="admin@custom.example.com",
        )

        tenant = await tenant_service.create_tenant(tenant_data)

        assert tenant.domain == "custom.example.com"

    async def test_create_tenant_duplicate_domain(self, tenant_service):
        """Test creating tenant with duplicate domain fails."""
        tenant_data1 = TenantCreate(
            name="Org 1",
            slug="org-1",
            domain="shared.example.com",
        )
        await tenant_service.create_tenant(tenant_data1)

        tenant_data2 = TenantCreate(
            name="Org 2",
            slug="org-2",
            domain="shared.example.com",  # Duplicate domain
        )

        with pytest.raises(TenantAlreadyExistsError, match="domain"):
            await tenant_service.create_tenant(tenant_data2)

    async def test_get_tenant_by_id(self, tenant_service, sample_tenant):
        """Test getting tenant by ID."""
        tenant = await tenant_service.get_tenant(sample_tenant.id)

        assert tenant.id == sample_tenant.id
        assert tenant.name == sample_tenant.name
        assert tenant.slug == sample_tenant.slug

    async def test_get_tenant_by_slug(self, tenant_service, sample_tenant):
        """Test getting tenant by slug."""
        tenant = await tenant_service.get_tenant_by_slug(sample_tenant.slug)

        assert tenant.id == sample_tenant.id
        assert tenant.slug == sample_tenant.slug

    async def test_get_nonexistent_tenant(self, tenant_service):
        """Test getting non-existent tenant raises error."""
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant("nonexistent-id")

    async def test_list_tenants(self, tenant_service):
        """Test listing tenants with pagination."""
        batch_id = uuid4().hex[:8]

        # Create multiple tenants
        for i in range(5):
            tenant_data = TenantCreate(
                name=f"Org {batch_id}-{i}",
                slug=f"org-{batch_id}-{i}",
                email=f"org{batch_id}_{i}@example.com",
            )
            await tenant_service.create_tenant(tenant_data)

        # List first page
        tenants, total = await tenant_service.list_tenants(page=1, page_size=3, search=batch_id)

        assert len(tenants) == 3
        assert total == 5

        # List second page
        tenants, total = await tenant_service.list_tenants(page=2, page_size=3, search=batch_id)

        assert len(tenants) == 2
        assert total == 5

    async def test_list_tenants_with_filters(self, tenant_service):
        """Test listing tenants with status filter."""
        # Create tenants with different statuses
        tenant_data1 = TenantCreate(name="Active Org", slug="active-org")
        tenant1 = await tenant_service.create_tenant(tenant_data1)

        tenant_data2 = TenantCreate(name="Trial Org", slug="trial-org")
        await tenant_service.create_tenant(tenant_data2)

        # Update one to active
        await tenant_service.update_tenant(tenant1.id, TenantUpdate(status=TenantStatus.ACTIVE))

        # Filter by status
        active_tenants, total = await tenant_service.list_tenants(status=TenantStatus.ACTIVE)

        assert total >= 1
        assert all(t.status == TenantStatus.ACTIVE for t in active_tenants)

    async def test_list_tenants_with_search(self, tenant_service):
        """Test listing tenants with search."""
        tenant_data = TenantCreate(
            name="Searchable Organization",
            slug="searchable-org",
            email="search@example.com",
        )
        await tenant_service.create_tenant(tenant_data)

        # Search by name
        tenants, total = await tenant_service.list_tenants(search="Searchable")

        assert total >= 1
        assert any("Searchable" in t.name for t in tenants)

    async def test_update_tenant(self, tenant_service, sample_tenant):
        """Test updating tenant information."""
        update_data = TenantUpdate(
            name="Updated Name",
            email="updated@example.com",
            max_users=20,
        )

        updated = await tenant_service.update_tenant(
            sample_tenant.id, update_data, updated_by="admin"
        )

        assert updated.name == "Updated Name"
        assert updated.email == "updated@example.com"
        assert updated.max_users == 20
        assert updated.updated_by == "admin"

    async def test_soft_delete_tenant(self, tenant_service, sample_tenant):
        """Test soft deleting a tenant."""
        await tenant_service.delete_tenant(sample_tenant.id, permanent=False, deleted_by="admin")

        # Should not be found without include_deleted
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant(sample_tenant.id)

        # Should be found with include_deleted
        tenant = await tenant_service.get_tenant(sample_tenant.id, include_deleted=True)
        assert tenant.deleted_at is not None

    async def test_restore_tenant(self, tenant_service, sample_tenant):
        """Test restoring a soft-deleted tenant."""
        # Store original status
        original_status = sample_tenant.status

        # Soft delete
        await tenant_service.delete_tenant(sample_tenant.id, permanent=False)

        # Restore
        restored = await tenant_service.restore_tenant(sample_tenant.id, restored_by="admin")

        assert restored.deleted_at is None
        assert restored.status == original_status  # Status preserved from before deletion

    async def test_permanent_delete_tenant(self, tenant_service, sample_tenant):
        """Test permanently deleting a tenant."""
        tenant_id = sample_tenant.id

        await tenant_service.delete_tenant(tenant_id, permanent=True)

        # Should not be found even with include_deleted
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant(tenant_id, include_deleted=True)


@pytest.mark.integration
class TestTenantSettings:
    """Test tenant settings management."""

    async def test_set_tenant_setting(self, tenant_service, sample_tenant):
        """Test setting a tenant configuration."""
        setting_data = TenantSettingCreate(
            key="api_endpoint",
            value="https://api.example.com",
            value_type="string",
            description="API endpoint URL",
        )

        setting = await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        assert setting.tenant_id == sample_tenant.id
        assert setting.key == "api_endpoint"
        assert setting.value == "https://api.example.com"

    async def test_update_existing_setting(self, tenant_service, sample_tenant):
        """Test updating an existing setting."""
        # Create initial setting
        setting_data = TenantSettingCreate(
            key="max_retries",
            value="3",
            value_type="int",
        )
        await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        # Update the same setting
        update_data = TenantSettingCreate(
            key="max_retries",
            value="5",
            value_type="int",
        )
        updated = await tenant_service.set_tenant_setting(sample_tenant.id, update_data)

        assert updated.value == "5"

    async def test_get_tenant_settings(self, tenant_service, sample_tenant):
        """Test getting all tenant settings."""
        # Create multiple settings
        settings_data = [
            TenantSettingCreate(key="setting1", value="value1"),
            TenantSettingCreate(key="setting2", value="value2"),
            TenantSettingCreate(key="setting3", value="value3"),
        ]

        for setting_data in settings_data:
            await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        # Get all settings
        settings = await tenant_service.get_tenant_settings(sample_tenant.id)

        assert len(settings) >= 3
        keys = [s.key for s in settings]
        assert "setting1" in keys
        assert "setting2" in keys
        assert "setting3" in keys

    async def test_get_specific_setting(self, tenant_service, sample_tenant):
        """Test getting a specific setting by key."""
        setting_data = TenantSettingCreate(
            key="api_key",
            value="secret123",
            is_encrypted=True,
        )
        await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        setting = await tenant_service.get_tenant_setting(sample_tenant.id, "api_key")

        assert setting is not None
        assert setting.key == "api_key"
        assert setting.is_encrypted is True

    async def test_delete_tenant_setting(self, tenant_service, sample_tenant):
        """Test deleting a tenant setting."""
        # Create setting
        setting_data = TenantSettingCreate(key="temp_setting", value="temp")
        await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        # Delete it
        await tenant_service.delete_tenant_setting(sample_tenant.id, "temp_setting")

        # Verify it's gone
        setting = await tenant_service.get_tenant_setting(sample_tenant.id, "temp_setting")
        assert setting is None


@pytest.mark.integration
class TestTenantUsage:
    """Test tenant usage tracking."""

    async def test_record_usage(self, tenant_service, sample_tenant):
        """Test recording usage metrics."""
        usage_data = TenantUsageCreate(
            period_start=datetime.now(UTC) - timedelta(hours=1),
            period_end=datetime.now(UTC),
            api_calls=1000,
            storage_gb=5.5,
            active_users=10,
            bandwidth_gb=2.3,
        )

        usage = await tenant_service.record_usage(sample_tenant.id, usage_data)

        assert usage.tenant_id == sample_tenant.id
        assert usage.api_calls == 1000
        assert usage.storage_gb == 5.5
        assert usage.active_users == 10
        assert float(usage.bandwidth_gb) == 2.3  # Convert Decimal to float for comparison

    async def test_get_tenant_usage(self, tenant_service, sample_tenant):
        """Test getting usage records."""
        # Record multiple usage periods
        for i in range(3):
            usage_data = TenantUsageCreate(
                period_start=datetime.now(UTC) - timedelta(days=i + 1),
                period_end=datetime.now(UTC) - timedelta(days=i),
                api_calls=1000 * (i + 1),
                storage_gb=float(i + 1),
                active_users=5 * (i + 1),
            )
            await tenant_service.record_usage(sample_tenant.id, usage_data)

        # Get all usage records
        usage_records = await tenant_service.get_tenant_usage(sample_tenant.id)

        assert len(usage_records) >= 3

    async def test_get_usage_with_date_range(self, tenant_service, sample_tenant):
        """Test getting usage with date filters."""
        now = datetime.now(UTC)

        # Record usage for different periods
        past_usage = TenantUsageCreate(
            period_start=now - timedelta(days=10),
            period_end=now - timedelta(days=9),
            api_calls=100,
        )
        await tenant_service.record_usage(sample_tenant.id, past_usage)

        recent_usage = TenantUsageCreate(
            period_start=now - timedelta(days=1),
            period_end=now,
            api_calls=500,
        )
        await tenant_service.record_usage(sample_tenant.id, recent_usage)

        # Get recent usage only
        start_date = now - timedelta(days=2)
        usage_records = await tenant_service.get_tenant_usage(
            sample_tenant.id, start_date=start_date
        )

        # Make datetimes comparable (SQLite returns naive datetimes)
        start_date_naive = start_date.replace(tzinfo=None) if start_date.tzinfo else start_date
        assert all(
            (u.period_start.replace(tzinfo=None) if u.period_start.tzinfo else u.period_start)
            >= start_date_naive
            for u in usage_records
        )

    async def test_update_usage_counters(self, tenant_service, sample_tenant):
        """Test updating tenant usage counters."""
        updated = await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=500,
            storage_gb=10.5,
            users=15,
        )

        assert updated.current_api_calls == 500
        assert float(updated.current_storage_gb) == 10.5
        assert updated.current_users == 15


@pytest.mark.integration
class TestTenantInvitations:
    """Test tenant invitation system."""

    async def test_create_invitation(self, tenant_service, sample_tenant):
        """Test creating a tenant invitation."""
        invitation_data = TenantInvitationCreate(
            email="newuser@example.com",
            role="member",
        )

        invitation = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin-123"
        )

        assert invitation.tenant_id == sample_tenant.id
        assert invitation.email == "newuser@example.com"
        assert invitation.role == "member"
        assert invitation.invited_by == "admin-123"
        assert invitation.status == TenantInvitationStatus.PENDING
        assert invitation.token is not None
        # Normalize datetime for comparison (SQLite returns naive datetimes)
        expires_at = (
            invitation.expires_at.replace(tzinfo=UTC)
            if invitation.expires_at.tzinfo is None
            else invitation.expires_at
        )
        assert expires_at > datetime.now(UTC)

    async def test_accept_invitation(self, tenant_service, sample_tenant):
        """Test accepting an invitation."""
        # Create invitation
        invitation_data = TenantInvitationCreate(email="user@example.com")
        invitation = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        # Accept it
        accepted = await tenant_service.accept_invitation(invitation.token)

        assert accepted.status == TenantInvitationStatus.ACCEPTED
        assert accepted.accepted_at is not None

    async def test_accept_expired_invitation(self, tenant_service, sample_tenant, async_session):
        """Test accepting an expired invitation fails."""
        # Create invitation
        invitation_data = TenantInvitationCreate(email="user@example.com")
        invitation = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        # Manually expire it
        invitation.expires_at = datetime.now(UTC) - timedelta(days=1)
        async_session.add(invitation)
        await async_session.commit()

        # Try to accept
        with pytest.raises(ValueError, match="expired"):
            await tenant_service.accept_invitation(invitation.token)

    async def test_revoke_invitation(self, tenant_service, sample_tenant):
        """Test revoking an invitation."""
        # Create invitation
        invitation_data = TenantInvitationCreate(email="user@example.com")
        invitation = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        # Revoke it
        revoked = await tenant_service.revoke_invitation(invitation.id)

        assert revoked.status == TenantInvitationStatus.REVOKED

    async def test_list_invitations(self, tenant_service, sample_tenant):
        """Test listing tenant invitations."""
        # Create multiple invitations
        for i in range(3):
            invitation_data = TenantInvitationCreate(email=f"user{i}@example.com")
            await tenant_service.create_invitation(
                sample_tenant.id, invitation_data, invited_by="admin"
            )

        # List all invitations
        invitations = await tenant_service.list_tenant_invitations(sample_tenant.id)

        assert len(invitations) >= 3

    async def test_list_invitations_by_status(self, tenant_service, sample_tenant):
        """Test filtering invitations by status."""
        # Create and accept one invitation
        invitation_data1 = TenantInvitationCreate(email="accepted@example.com")
        invitation = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data1, invited_by="admin"
        )
        await tenant_service.accept_invitation(invitation.token)

        # Create pending invitation
        invitation_data2 = TenantInvitationCreate(email="pending@example.com")
        await tenant_service.create_invitation(
            sample_tenant.id, invitation_data2, invited_by="admin"
        )

        # Filter by pending
        pending = await tenant_service.list_tenant_invitations(
            sample_tenant.id, status=TenantInvitationStatus.PENDING
        )

        assert all(inv.status == TenantInvitationStatus.PENDING for inv in pending)


@pytest.mark.integration
class TestTenantFeatures:
    """Test tenant feature management."""

    async def test_update_features(self, tenant_service, sample_tenant):
        """Test updating tenant features."""
        features = {
            "webhooks": True,
            "advanced_analytics": True,
            "custom_domain": False,
        }

        updated = await tenant_service.update_tenant_features(
            sample_tenant.id, features, updated_by="admin"
        )

        assert updated.features["webhooks"] is True
        assert updated.features["advanced_analytics"] is True

    async def test_update_metadata(self, tenant_service, sample_tenant):
        """Test updating tenant metadata."""
        metadata = {
            "onboarding_completed": True,
            "referral_source": "partner",
            "custom_field": "value",
        }

        updated = await tenant_service.update_tenant_metadata(
            sample_tenant.id, metadata, updated_by="admin"
        )

        assert updated.custom_metadata["onboarding_completed"] is True
        assert updated.custom_metadata["referral_source"] == "partner"


@pytest.mark.integration
class TestTenantStatistics:
    """Test tenant statistics."""

    async def test_get_tenant_stats(self, tenant_service, sample_tenant):
        """Test getting tenant statistics."""
        # Set some usage
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=5000,
            storage_gb=5.0,
            users=3,
        )

        stats = await tenant_service.get_tenant_stats(sample_tenant.id)

        assert stats.tenant_id == sample_tenant.id
        assert stats.total_api_calls == 5000
        assert stats.total_storage_gb == 5.0
        assert stats.total_users == 3
        assert 0 <= stats.api_usage_percent <= 100
        assert 0 <= stats.user_usage_percent <= 100
        assert 0 <= stats.storage_usage_percent <= 100


@pytest.mark.integration
class TestTenantBulkOperations:
    """Test bulk tenant operations."""

    async def test_bulk_update_status(self, tenant_service):
        """Test bulk status update."""
        # Create multiple tenants
        tenant_ids = []
        for i in range(3):
            tenant_data = TenantCreate(
                name=f"Bulk Org {i}",
                slug=f"bulk-org-{i}",
            )
            tenant = await tenant_service.create_tenant(tenant_data)
            tenant_ids.append(tenant.id)

        # Bulk update status
        updated_count = await tenant_service.bulk_update_status(
            tenant_ids, TenantStatus.ACTIVE, updated_by="admin"
        )

        assert updated_count == 3

        # Verify status changed
        for tenant_id in tenant_ids:
            tenant = await tenant_service.get_tenant(tenant_id)
            assert tenant.status == TenantStatus.ACTIVE

    async def test_bulk_delete(self, tenant_service):
        """Test bulk tenant deletion."""
        # Create multiple tenants
        tenant_ids = []
        for i in range(3):
            tenant_data = TenantCreate(
                name=f"Delete Org {i}",
                slug=f"delete-org-{i}",
            )
            tenant = await tenant_service.create_tenant(tenant_data)
            tenant_ids.append(tenant.id)

        # Bulk soft delete
        deleted_count = await tenant_service.bulk_delete_tenants(
            tenant_ids, permanent=False, deleted_by="admin"
        )

        assert deleted_count == 3

        # Verify deleted
        for tenant_id in tenant_ids:
            with pytest.raises(TenantNotFoundError):
                await tenant_service.get_tenant(tenant_id)


@pytest.mark.integration
class TestTenantProperties:
    """Test tenant model properties."""

    async def test_trial_properties(self, tenant_service):
        """Test trial-related properties."""
        tenant_data = TenantCreate(name="Trial Test", slug="trial-test")
        tenant = await tenant_service.create_tenant(tenant_data)

        assert tenant.is_trial is True
        assert tenant.trial_expired is False

    async def test_limit_exceeded_properties(self, tenant_service):
        """Test limit exceeded properties."""
        tenant_data = TenantCreate(
            name="Limit Test",
            slug="limit-test",
            max_users=5,
            max_api_calls_per_month=1000,
            max_storage_gb=10,
        )
        tenant = await tenant_service.create_tenant(tenant_data)

        # Initially not exceeded
        assert tenant.has_exceeded_user_limit is False
        assert tenant.has_exceeded_api_limit is False
        assert tenant.has_exceeded_storage_limit is False

        # Exceed limits
        await tenant_service.update_tenant_usage_counters(
            tenant.id,
            api_calls=1500,
            storage_gb=15.0,
            users=10,
        )

        tenant = await tenant_service.get_tenant(tenant.id)
        assert tenant.has_exceeded_user_limit is True
        assert tenant.has_exceeded_api_limit is True
        assert tenant.has_exceeded_storage_limit is True
