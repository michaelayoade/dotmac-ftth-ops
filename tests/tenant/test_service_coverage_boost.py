"""
Comprehensive tests for tenant/service.py to reach 90%+ coverage.

This test suite specifically targets uncovered lines identified in the coverage report.
"""

from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from dotmac.platform.tenant.models import (
    Base,
    Tenant,
    TenantInvitationStatus,
    TenantPlanType,
    TenantStatus,
)
from dotmac.platform.tenant.schemas import (
    TenantBrandingConfig,
    TenantBrandingUpdate,
    TenantCreate,
    TenantInvitationCreate,
    TenantSettingCreate,
    TenantUpdate,
    TenantUsageCreate,
)
from dotmac.platform.tenant.service import (
    TenantAlreadyExistsError,
    TenantNotFoundError,
    TenantService,
)


@pytest_asyncio.fixture
async def async_db():
    """Create async in-memory database for testing."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def tenant_service(async_db: AsyncSession):
    """Create tenant service instance."""
    return TenantService(db=async_db)


@pytest_asyncio.fixture
async def sample_tenant(tenant_service: TenantService) -> Tenant:
    """Create a sample tenant for testing."""
    tenant_data = TenantCreate(
        name="Test Company",
        slug="test-company",
        email="test@example.com",
        plan_type=TenantPlanType.STARTER,
        max_users=10,
    )
    return await tenant_service.create_tenant(tenant_data, created_by="test-user")


@pytest.mark.unit
class TestTenantCRUDCoverage:
    """Tests for CRUD operations - targeting uncovered lines."""

    async def test_create_tenant_duplicate_slug_error(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test creating tenant with duplicate slug raises error."""
        # Lines 84-87: Duplicate slug check
        duplicate_data = TenantCreate(
            name="Another Company",
            slug="test-company",  # Duplicate
            email="another@example.com",
            plan_type=TenantPlanType.STARTER,
        )

        with pytest.raises(TenantAlreadyExistsError) as exc_info:
            await tenant_service.create_tenant(duplicate_data)

        assert "slug 'test-company' already exists" in str(exc_info.value)

    async def test_create_tenant_duplicate_domain_error(self, tenant_service: TenantService):
        """Test creating tenant with duplicate domain raises error."""
        # Lines 90-98: Duplicate domain check
        first_data = TenantCreate(
            name="First Company",
            slug="first-company",
            email="first@example.com",
            domain="example.com",
            plan_type=TenantPlanType.STARTER,
        )
        await tenant_service.create_tenant(first_data)

        duplicate_domain_data = TenantCreate(
            name="Second Company",
            slug="second-company",
            email="second@example.com",
            domain="example.com",  # Duplicate
            plan_type=TenantPlanType.STARTER,
        )

        with pytest.raises(TenantAlreadyExistsError) as exc_info:
            await tenant_service.create_tenant(duplicate_domain_data)

        assert "domain 'example.com' already exists" in str(exc_info.value)

    async def test_create_tenant_general_exception_handling(
        self, tenant_service: TenantService, monkeypatch
    ):
        """Test general exception handling in create_tenant."""

        # Lines 136-139: General exception handling
        async def mock_commit():
            raise RuntimeError("Database error")

        monkeypatch.setattr(tenant_service.db, "commit", mock_commit)

        tenant_data = TenantCreate(
            name="Test",
            slug="test-exception",
            email="test@example.com",
            plan_type=TenantPlanType.STARTER,
        )

        with pytest.raises(RuntimeError) as exc_info:
            await tenant_service.create_tenant(tenant_data)

        assert "Failed to create tenant" in str(exc_info.value)

    async def test_get_tenant_include_deleted(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting tenant with include_deleted=True."""
        # Lines 157-158: include_deleted branch
        # Manually set deleted_at to avoid soft_delete() is_active issue
        from datetime import datetime

        sample_tenant.deleted_at = datetime.now(UTC)
        await tenant_service.db.commit()

        # Should find with include_deleted=True
        found = await tenant_service.get_tenant(sample_tenant.id, include_deleted=True)
        assert found.id == sample_tenant.id
        assert found.deleted_at is not None

    async def test_get_tenant_by_slug_include_deleted(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting tenant by slug with include_deleted=True."""
        # Lines 184-185: include_deleted branch in get_tenant_by_slug
        from datetime import datetime

        sample_tenant.deleted_at = datetime.now(UTC)
        await tenant_service.db.commit()

        found = await tenant_service.get_tenant_by_slug(sample_tenant.slug, include_deleted=True)
        assert found.slug == sample_tenant.slug
        assert found.deleted_at is not None

    async def test_update_tenant_general_exception(
        self, tenant_service: TenantService, sample_tenant: Tenant, monkeypatch
    ):
        """Test general exception handling in update_tenant."""

        # Lines 294-297: Exception handling in update_tenant
        async def mock_commit():
            raise RuntimeError("Update failed")

        monkeypatch.setattr(tenant_service.db, "commit", mock_commit)

        update_data = TenantUpdate(name="Updated Name")

        with pytest.raises(RuntimeError) as exc_info:
            await tenant_service.update_tenant(sample_tenant.id, update_data)

        assert "Failed to update tenant" in str(exc_info.value)

    async def test_delete_tenant_permanent(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test permanent tenant deletion."""
        # Line 316: Permanent deletion path
        await tenant_service.delete_tenant(sample_tenant.id, permanent=True, deleted_by="admin")

        # Should not find tenant
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant(sample_tenant.id)

    async def test_get_tenant_branding_defaults(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Ensure tenant branding falls back to global defaults."""
        branding = await tenant_service.get_tenant_branding(sample_tenant.id)
        assert branding.tenant_id == sample_tenant.id
        assert branding.branding.product_name

    async def test_update_tenant_branding(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Tenant branding updates should persist and merge."""
        update = TenantBrandingUpdate(
            branding=TenantBrandingConfig(
                product_name="Custom ISP",
                support_email="support@custom-isp.com",
            )
        )
        branding = await tenant_service.update_tenant_branding(sample_tenant.id, update)
        assert branding.branding.product_name == "Custom ISP"

        branding_after = await tenant_service.get_tenant_branding(sample_tenant.id)
        assert branding_after.branding.support_email == "support@custom-isp.com"

    async def test_restore_tenant(self, tenant_service: TenantService, sample_tenant: Tenant):
        """Test restoring soft-deleted tenant."""
        # Lines 342-349: restore_tenant method calling tenant.restore()
        # First soft-delete the tenant
        from datetime import datetime

        sample_tenant.deleted_at = datetime.now(UTC)
        await tenant_service.db.commit()

        # Now restore it
        restored = await tenant_service.restore_tenant(sample_tenant.id)

        assert restored.id == sample_tenant.id
        assert restored.deleted_at is None

    async def test_restore_already_active_tenant(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test restoring a tenant that's not deleted returns it unchanged."""
        # Lines 337-340: Early return if not deleted
        restored = await tenant_service.restore_tenant(sample_tenant.id)

        assert restored.id == sample_tenant.id
        assert restored.deleted_at is None


@pytest.mark.unit
class TestListTenantsCoverage:
    """Tests for list_tenants - targeting uncovered lines."""

    async def test_list_tenants_with_status_filter(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing tenants filtered by status."""
        # Lines 225-226: Status filter
        tenants, total = await tenant_service.list_tenants(status=TenantStatus.TRIAL)

        assert total == 1
        assert tenants[0].status == TenantStatus.TRIAL

    async def test_list_tenants_with_plan_filter(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing tenants filtered by plan type."""
        # Lines 228-229: Plan type filter
        tenants, total = await tenant_service.list_tenants(plan_type=TenantPlanType.STARTER)

        assert total == 1
        assert tenants[0].plan_type == TenantPlanType.STARTER

    async def test_list_tenants_with_search(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing tenants with search query."""
        # Lines 231-239: Search filter
        tenants, total = await tenant_service.list_tenants(search="Test")

        assert total == 1
        assert "Test" in tenants[0].name

    async def test_list_tenants_with_pagination(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing tenants with pagination."""
        # Lines 241-248: Pagination logic
        # Create more tenants
        for i in range(3):
            data = TenantCreate(
                name=f"Company {i}",
                slug=f"company-{i}",
                email=f"company{i}@example.com",
                plan_type=TenantPlanType.STARTER,
            )
            await tenant_service.create_tenant(data)

        # Test pagination
        tenants, total = await tenant_service.list_tenants(page=1, page_size=2)

        assert total == 4  # 1 sample + 3 new
        assert len(tenants) == 2

    async def test_list_tenants_include_deleted(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing tenants including deleted ones."""
        # Lines 222-223: include_deleted filter
        # Manually mark as deleted
        from datetime import datetime

        sample_tenant.deleted_at = datetime.now(UTC)
        await tenant_service.db.commit()

        # Without include_deleted
        tenants, total = await tenant_service.list_tenants(include_deleted=False)
        assert total == 0

        # With include_deleted
        tenants, total = await tenant_service.list_tenants(include_deleted=True)
        assert total == 1

    async def test_list_tenants_exception_handling(
        self, tenant_service: TenantService, monkeypatch
    ):
        """Test exception handling returns empty list."""

        # Lines 255-257: Exception handling
        async def mock_execute(*args, **kwargs):
            raise RuntimeError("Database error")

        monkeypatch.setattr(tenant_service.db, "execute", mock_execute)

        tenants, total = await tenant_service.list_tenants()

        assert tenants == []
        assert total == 0


@pytest.mark.unit
class TestSettingsManagement:
    """Tests for tenant settings - targeting uncovered lines."""

    async def test_get_tenant_settings(self, tenant_service: TenantService, sample_tenant: Tenant):
        """Test getting all tenant settings."""
        # Lines 354-356: get_tenant_settings
        # Create some settings first
        setting1 = TenantSettingCreate(
            key="feature_x",
            value="enabled",
            value_type="string",
        )
        await tenant_service.set_tenant_setting(sample_tenant.id, setting1)

        settings = await tenant_service.get_tenant_settings(sample_tenant.id)

        assert len(settings) == 1
        assert settings[0].key == "feature_x"

    async def test_set_tenant_setting_create_new(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test creating a new tenant setting."""
        # Lines 383-391: Create new setting path
        setting_data = TenantSettingCreate(
            key="new_feature",
            value="true",
            value_type="boolean",
            description="New feature flag",
            is_encrypted=False,
        )

        setting = await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        assert setting.key == "new_feature"
        assert setting.value == "true"
        assert setting.value_type == "boolean"

    async def test_delete_tenant_setting(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test deleting a tenant setting."""
        # Lines 399-402: delete_tenant_setting
        # Create setting first
        setting_data = TenantSettingCreate(key="to_delete", value="value", value_type="string")
        await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        # Delete it
        await tenant_service.delete_tenant_setting(sample_tenant.id, "to_delete")

        # Verify deleted
        result = await tenant_service.get_tenant_setting(sample_tenant.id, "to_delete")
        assert result is None


@pytest.mark.unit
class TestUsageTracking:
    """Tests for usage tracking - targeting uncovered lines."""

    async def test_get_tenant_usage_with_date_filters(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting usage records with date filters."""
        # Lines 428-439: get_tenant_usage with date filters
        start = datetime.now(UTC)
        end = start + timedelta(days=30)

        # Record usage
        usage_data = TenantUsageCreate(
            period_start=start,
            period_end=end,
            api_calls=1000,
            storage_gb=5.0,
            active_users=3,
        )
        await tenant_service.record_usage(sample_tenant.id, usage_data)

        # Get usage with filters
        usage = await tenant_service.get_tenant_usage(
            sample_tenant.id,
            start_date=start - timedelta(days=1),
            end_date=end + timedelta(days=1),
        )

        assert len(usage) == 1
        assert usage[0].api_calls == 1000

    async def test_update_tenant_usage_counters(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test updating tenant usage counters."""
        # Lines 449-463: update_tenant_usage_counters
        updated = await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=100,
            storage_gb=2.5,
            users=5,
        )

        assert updated.current_api_calls == 100
        assert updated.current_storage_gb == 2.5
        assert updated.current_users == 5


@pytest.mark.unit
class TestInvitationManagement:
    """Tests for tenant invitations - targeting uncovered lines."""

    async def test_get_invitation(self, tenant_service: TenantService, sample_tenant: Tenant):
        """Test getting invitation by ID."""
        # Lines 493-500: get_invitation
        invitation_data = TenantInvitationCreate(
            email="invite@example.com",
            role="member",
        )
        created = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        found = await tenant_service.get_invitation(created.id)

        assert found.id == created.id
        assert found.email == "invite@example.com"

    async def test_get_invitation_not_found(self, tenant_service: TenantService):
        """Test getting non-existent invitation raises error."""
        # Line 498-499: Error path
        with pytest.raises(ValueError) as exc_info:
            await tenant_service.get_invitation("non-existent-id")

        assert "not found" in str(exc_info.value)

    async def test_get_invitation_by_token(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting invitation by token."""
        # Lines 504-511: get_invitation_by_token
        invitation_data = TenantInvitationCreate(
            email="token@example.com",
            role="admin",
        )
        created = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        found = await tenant_service.get_invitation_by_token(created.token)

        assert found.id == created.id
        assert found.token == created.token

    async def test_get_invitation_by_invalid_token(self, tenant_service: TenantService):
        """Test getting invitation with invalid token raises error."""
        # Lines 508-509: Invalid token error
        with pytest.raises(ValueError) as exc_info:
            await tenant_service.get_invitation_by_token("invalid-token")

        assert "Invalid invitation token" in str(exc_info.value)

    async def test_accept_invitation_already_processed(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test accepting already processed invitation fails."""
        # Lines 517-518: Already processed check

        invitation_data = TenantInvitationCreate(
            email="processed@example.com",
            role="member",
        )
        created = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        # Ensure expires_at is timezone-aware
        if created.expires_at.tzinfo is None:
            created.expires_at = created.expires_at.replace(tzinfo=UTC)
            await tenant_service.db.commit()

        # Accept once
        await tenant_service.accept_invitation(created.token)

        # Try to accept again
        with pytest.raises(ValueError) as exc_info:
            await tenant_service.accept_invitation(created.token)

        assert "already been processed" in str(exc_info.value)

    async def test_revoke_invitation(self, tenant_service: TenantService, sample_tenant: Tenant):
        """Test revoking a pending invitation."""
        # Lines 535-545: revoke_invitation
        invitation_data = TenantInvitationCreate(
            email="revoke@example.com",
            role="member",
        )
        created = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        revoked = await tenant_service.revoke_invitation(created.id)

        assert revoked.status == TenantInvitationStatus.REVOKED

    async def test_revoke_accepted_invitation_fails(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test revoking an accepted invitation fails."""
        # Lines 537-538: Cannot revoke accepted

        invitation_data = TenantInvitationCreate(
            email="accepted@example.com",
            role="member",
        )
        created = await tenant_service.create_invitation(
            sample_tenant.id, invitation_data, invited_by="admin"
        )

        # Ensure expires_at is timezone-aware
        if created.expires_at.tzinfo is None:
            created.expires_at = created.expires_at.replace(tzinfo=UTC)
            await tenant_service.db.commit()

        await tenant_service.accept_invitation(created.token)

        with pytest.raises(ValueError) as exc_info:
            await tenant_service.revoke_invitation(created.id)

        assert "Cannot revoke accepted invitation" in str(exc_info.value)

    async def test_list_tenant_invitations_with_status(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test listing invitations filtered by status."""
        # Lines 551-559: list_tenant_invitations with status filter
        # Create invitations with different statuses
        inv1_data = TenantInvitationCreate(email="inv1@example.com", role="member")
        inv2_data = TenantInvitationCreate(email="inv2@example.com", role="admin")

        await tenant_service.create_invitation(sample_tenant.id, inv1_data, invited_by="admin")
        inv2 = await tenant_service.create_invitation(
            sample_tenant.id, inv2_data, invited_by="admin"
        )

        # Revoke one
        await tenant_service.revoke_invitation(inv2.id)

        # List pending only
        pending = await tenant_service.list_tenant_invitations(
            sample_tenant.id, status=TenantInvitationStatus.PENDING
        )
        assert len(pending) == 1
        assert pending[0].email == "inv1@example.com"

        # List revoked only
        revoked = await tenant_service.list_tenant_invitations(
            sample_tenant.id, status=TenantInvitationStatus.REVOKED
        )
        assert len(revoked) == 1
        assert revoked[0].email == "inv2@example.com"


@pytest.mark.unit
class TestFeatureManagement:
    """Tests for feature and metadata management - targeting uncovered lines."""

    async def test_update_tenant_features_exception_handling(
        self, tenant_service: TenantService, sample_tenant: Tenant, monkeypatch
    ):
        """Test exception handling in update_tenant_features."""

        # Lines 582-588: Exception handling
        async def mock_commit():
            raise RuntimeError("Update failed")

        monkeypatch.setattr(tenant_service.db, "commit", mock_commit)

        with pytest.raises(RuntimeError) as exc_info:
            await tenant_service.update_tenant_features(sample_tenant.id, {"new_feature": True})

        assert "Failed to update tenant features" in str(exc_info.value)

    async def test_update_tenant_features_none_handling(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test handling None features parameter."""
        # Lines 570-571: None handling
        updated = await tenant_service.update_tenant_features(sample_tenant.id, None)

        assert updated.features is not None

    async def test_update_tenant_metadata_exception_handling(
        self, tenant_service: TenantService, sample_tenant: Tenant, monkeypatch
    ):
        """Test exception handling in update_tenant_metadata."""

        # Lines 610-616: Exception handling
        async def mock_commit():
            raise RuntimeError("Update failed")

        monkeypatch.setattr(tenant_service.db, "commit", mock_commit)

        with pytest.raises(RuntimeError) as exc_info:
            await tenant_service.update_tenant_metadata(sample_tenant.id, {"key": "value"})

        assert "Failed to update tenant metadata" in str(exc_info.value)

    async def test_update_tenant_metadata_none_handling(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test handling None metadata parameter."""
        # Lines 598-599: None handling
        updated = await tenant_service.update_tenant_metadata(sample_tenant.id, None)

        assert updated.custom_metadata is not None


@pytest.mark.unit
class TestStatistics:
    """Tests for tenant statistics - targeting uncovered lines."""

    async def test_get_tenant_stats(self, tenant_service: TenantService, sample_tenant: Tenant):
        """Test getting comprehensive tenant statistics."""
        # Lines 621-644: get_tenant_stats entire method
        # Update usage counters
        await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=500,
            storage_gb=2.5,
            users=5,
        )

        stats = await tenant_service.get_tenant_stats(sample_tenant.id)

        assert stats.tenant_id == sample_tenant.id
        assert stats.total_users == 5
        assert stats.total_api_calls == 500
        assert stats.total_storage_gb == 2.5
        assert stats.user_limit == sample_tenant.max_users
        assert stats.plan_type == sample_tenant.plan_type
        assert stats.status == sample_tenant.status

        # Check percentage calculations
        assert stats.user_usage_percent == (5 / sample_tenant.max_users * 100)
        assert stats.api_usage_percent > 0


@pytest.mark.unit
class TestBulkOperations:
    """Tests for bulk operations - targeting uncovered lines."""

    async def test_bulk_update_status(self, tenant_service: TenantService):
        """Test bulk updating tenant status."""
        # Lines 667-678: bulk_update_status
        # Create multiple tenants
        tenant_ids = []
        for i in range(3):
            data = TenantCreate(
                name=f"Bulk {i}",
                slug=f"bulk-{i}",
                email=f"bulk{i}@example.com",
                plan_type=TenantPlanType.STARTER,
            )
            tenant = await tenant_service.create_tenant(data)
            tenant_ids.append(tenant.id)

        # Bulk update to ACTIVE
        count = await tenant_service.bulk_update_status(
            tenant_ids, TenantStatus.ACTIVE, updated_by="admin"
        )

        assert count == 3

        # Verify all updated
        for tenant_id in tenant_ids:
            tenant = await tenant_service.get_tenant(tenant_id)
            assert tenant.status == TenantStatus.ACTIVE
            assert tenant.updated_by == "admin"

    async def test_bulk_delete_tenants_soft(self, tenant_service: TenantService):
        """Test bulk soft deleting tenants."""
        # Lines 684-697: bulk_delete_tenants (soft delete path)
        # Create multiple tenants
        tenant_ids = []
        for i in range(2):
            data = TenantCreate(
                name=f"Soft Delete {i}",
                slug=f"soft-delete-{i}",
                email=f"soft{i}@example.com",
                plan_type=TenantPlanType.STARTER,
            )
            tenant = await tenant_service.create_tenant(data)
            tenant_ids.append(tenant.id)

        # Bulk soft delete (permanent=False is default)
        count = await tenant_service.bulk_delete_tenants(
            tenant_ids, permanent=False, deleted_by="admin"
        )

        assert count == 2

        # Verify all soft-deleted (not found without include_deleted)
        for tenant_id in tenant_ids:
            with pytest.raises(TenantNotFoundError):
                await tenant_service.get_tenant(tenant_id)

        # But should be found with include_deleted=True
        for tenant_id in tenant_ids:
            tenant = await tenant_service.get_tenant(tenant_id, include_deleted=True)
            assert tenant.deleted_at is not None

    async def test_bulk_delete_tenants_permanent(self, tenant_service: TenantService):
        """Test bulk permanently deleting tenants."""
        # Lines 689-690: Permanent deletion path
        # Create multiple tenants
        tenant_ids = []
        for i in range(2):
            data = TenantCreate(
                name=f"Perm Delete {i}",
                slug=f"perm-delete-{i}",
                email=f"perm{i}@example.com",
                plan_type=TenantPlanType.STARTER,
            )
            tenant = await tenant_service.create_tenant(data)
            tenant_ids.append(tenant.id)

        # Bulk permanent delete
        count = await tenant_service.bulk_delete_tenants(
            tenant_ids, permanent=True, deleted_by="admin"
        )

        assert count == 2

        # Verify all permanently deleted
        for tenant_id in tenant_ids:
            with pytest.raises(TenantNotFoundError):
                await tenant_service.get_tenant(tenant_id, include_deleted=True)


@pytest.mark.unit
class TestEdgeCaseCoverage:
    """Additional tests for edge cases to reach 90%."""

    async def test_get_tenant_not_found_basic(self, tenant_service: TenantService):
        """Test getting non-existent tenant raises error."""
        # Line 163-164: Tenant not found
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant("non-existent-id")

    async def test_get_tenant_by_slug_not_found(self, tenant_service: TenantService):
        """Test getting tenant by non-existent slug raises error."""
        # Lines 190-191: Tenant not found by slug
        with pytest.raises(TenantNotFoundError):
            await tenant_service.get_tenant_by_slug("non-existent-slug")

    async def test_update_tenant_not_found(self, tenant_service: TenantService):
        """Test updating non-existent tenant raises error."""
        # Lines 277, 291-293: TenantNotFoundError in update
        update_data = TenantUpdate(name="New Name")

        with pytest.raises(TenantNotFoundError):
            await tenant_service.update_tenant("non-existent-id", update_data)

    async def test_delete_tenant_not_found(self, tenant_service: TenantService):
        """Test deleting non-existent tenant raises error."""
        # Line 313: TenantNotFoundError in delete
        with pytest.raises(TenantNotFoundError):
            await tenant_service.delete_tenant("non-existent-id")

    async def test_default_features_professional_plan(self, tenant_service: TenantService):
        """Test default features for professional plan."""
        # Lines 716-717: Professional plan features
        tenant_data = TenantCreate(
            name="Professional Org",
            slug="prof-org",
            email="prof@example.com",
            plan_type=TenantPlanType.PROFESSIONAL,
        )

        tenant = await tenant_service.create_tenant(tenant_data)

        assert tenant.features["webhooks"] is True
        assert tenant.features["advanced_analytics"] is True
        assert tenant.features["api_access"] is True

    async def test_default_features_enterprise_plan(self, tenant_service: TenantService):
        """Test default features for enterprise plan."""
        # Lines 719-720: Enterprise/Custom plan features
        tenant_data = TenantCreate(
            name="Enterprise Org",
            slug="ent-org",
            email="ent@example.com",
            plan_type=TenantPlanType.ENTERPRISE,
        )

        tenant = await tenant_service.create_tenant(tenant_data)

        assert tenant.features["webhooks"] is True
        assert tenant.features["custom_domain"] is True
        assert tenant.features["sso"] is True
        assert tenant.features["priority_support"] is True
        assert tenant.features["white_label"] is True

    async def test_get_tenant_stats_with_subscription_expiry(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting stats when subscription has end date."""
        # Lines 639-642: Days until expiry calculation
        from datetime import datetime, timedelta

        # Set subscription end date
        sample_tenant.subscription_ends_at = datetime.now(UTC) + timedelta(days=30)
        await tenant_service.db.commit()

        stats = await tenant_service.get_tenant_stats(sample_tenant.id)

        assert stats.days_until_expiry is not None
        assert stats.days_until_expiry >= 0

    async def test_update_usage_counters_selective(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test updating only specific usage counters."""
        # Lines 451-460: Conditional updates
        # Update only API calls
        updated = await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            api_calls=100,
        )
        assert updated.current_api_calls == 100

        # Update only storage
        updated = await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            storage_gb=5.0,
        )
        assert updated.current_storage_gb == 5.0

        # Update only users
        updated = await tenant_service.update_tenant_usage_counters(
            sample_tenant.id,
            users=3,
        )
        assert updated.current_users == 3

    async def test_set_tenant_setting_update_existing(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test updating an existing tenant setting."""
        # Lines 373-380: Update existing setting path
        # Create initial setting
        setting_data = TenantSettingCreate(
            key="existing_key",
            value="original_value",
            value_type="string",
        )
        await tenant_service.set_tenant_setting(sample_tenant.id, setting_data)

        # Update it
        updated_data = TenantSettingCreate(
            key="existing_key",
            value="new_value",
            value_type="string",
            description="Updated description",
        )
        updated = await tenant_service.set_tenant_setting(sample_tenant.id, updated_data)

        assert updated.key == "existing_key"
        assert updated.value == "new_value"
        assert updated.description == "Updated description"

    async def test_delete_nonexistent_setting(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test deleting non-existent setting (should not raise error)."""
        # Lines 399-402: delete_tenant_setting when setting doesn't exist
        await tenant_service.delete_tenant_setting(sample_tenant.id, "nonexistent-key")
        # Should complete without error

    async def test_get_usage_with_both_date_filters(
        self, tenant_service: TenantService, sample_tenant: Tenant
    ):
        """Test getting usage with both start and end date filters."""
        # Lines 430-436: Both date filters
        from datetime import datetime, timedelta

        start = datetime.now(UTC) - timedelta(days=30)
        end = datetime.now(UTC)

        # Record some usage
        usage_data = TenantUsageCreate(
            period_start=start + timedelta(days=5),
            period_end=start + timedelta(days=10),
            api_calls=500,
            storage_gb=2.0,
            active_users=2,
        )
        await tenant_service.record_usage(sample_tenant.id, usage_data)

        # Get with both filters
        usage = await tenant_service.get_tenant_usage(
            sample_tenant.id,
            start_date=start,
            end_date=end,
        )

        assert len(usage) >= 1
