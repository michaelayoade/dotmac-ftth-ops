"""
Tests for tenant/dependencies.py applying fake implementation pattern.

This test file focuses on:
1. Actually importing and testing the module for real coverage
2. Testing all FastAPI dependency functions
3. Testing all validation and authorization logic
4. Avoiding over-mocking
"""

from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException

# Import module for coverage
from dotmac.platform.auth.core import UserInfo
from dotmac.platform.tenant.dependencies import (
    check_api_limit,
    check_storage_limit,
    check_tenant_feature,
    check_user_limit,
    get_current_tenant,
    get_current_tenant_id,
    get_tenant_service,
    require_active_tenant,
    require_feature,
    require_plan,
    require_tenant_admin,
    require_tenant_owner,
    require_trial_or_active_tenant,
)
from dotmac.platform.tenant.models import Tenant, TenantPlanType, TenantStatus
from dotmac.platform.tenant.service import TenantNotFoundError, TenantService


class FakeTenantService:
    """Fake tenant service for testing."""

    def __init__(self):
        self.tenants: dict[str, Tenant] = {}

    async def get_tenant(self, tenant_id: str) -> Tenant:
        """Get tenant by ID."""
        if tenant_id not in self.tenants:
            raise TenantNotFoundError(f"Tenant {tenant_id} not found")
        return self.tenants[tenant_id]

    def add_tenant(self, tenant: Tenant) -> None:
        """Add tenant to fake storage."""
        self.tenants[tenant.id] = tenant


def create_fake_tenant(
    tenant_id: str = "tenant-123",
    name: str = "Test Tenant",
    status: TenantStatus = TenantStatus.ACTIVE,
    plan_type: TenantPlanType = TenantPlanType.PROFESSIONAL,
    **kwargs,
) -> Tenant:
    """Create a fake tenant for testing."""
    # Create minimal tenant object
    tenant = Tenant(
        id=tenant_id,
        name=name,
        slug=kwargs.get("slug", f"test-tenant-{tenant_id}"),
        status=status,
        plan_type=plan_type,
        max_users=kwargs.get("max_users", 10),
        max_api_calls_per_month=kwargs.get("max_api_calls_per_month", 100000),
        max_storage_gb=kwargs.get("max_storage_gb", 50),
        current_users=kwargs.get("current_users", 0),
        current_api_calls=kwargs.get("current_api_calls", 0),
        current_storage_gb=kwargs.get("current_storage_gb", 0),
        features=kwargs.get("features", {}),
        created_by=kwargs.get("created_by"),
        trial_ends_at=kwargs.get("trial_ends_at"),
    )
    return tenant


def create_fake_user(
    user_id: str = "user-123",
    tenant_id: str = "tenant-123",
    roles: list[str] | None = None,
) -> UserInfo:
    """Create a fake UserInfo for testing."""
    user = Mock(spec=UserInfo)
    user.user_id = user_id
    user.tenant_id = tenant_id
    user.roles = roles or []
    return user


@pytest.mark.integration
class TestGetCurrentTenantId:
    """Test get_current_tenant_id function."""

    def test_get_tenant_id_from_context(self):
        """Test retrieving tenant ID from context."""
        with patch("dotmac.platform.tenant._tenant_context") as mock_context:
            mock_context.get.return_value = "tenant-456"

            result = get_current_tenant_id()

            assert result == "tenant-456"
            mock_context.get.assert_called_once()

    def test_get_tenant_id_fallback_single_tenant(self):
        """Test fallback to default tenant in single-tenant mode."""
        with patch("dotmac.platform.tenant._tenant_context") as mock_context:
            mock_context.get.return_value = None

            with patch("dotmac.platform.tenant.get_tenant_config") as mock_config:
                config = Mock()
                config.is_single_tenant = True
                config.default_tenant_id = "default-tenant"
                mock_config.return_value = config

                result = get_current_tenant_id()

                assert result == "default-tenant"

    def test_get_tenant_id_returns_none_multi_tenant(self):
        """Test returns None when no context in multi-tenant mode."""
        with patch("dotmac.platform.tenant._tenant_context") as mock_context:
            mock_context.get.return_value = None

            with patch("dotmac.platform.tenant.get_tenant_config") as mock_config:
                config = Mock()
                config.is_single_tenant = False
                mock_config.return_value = config

                result = get_current_tenant_id()

                assert result is None


@pytest.mark.integration
class TestGetTenantService:
    """Test get_tenant_service dependency."""

    @pytest.mark.asyncio
    async def test_get_tenant_service_returns_service(self):
        """Test that service is created with db session."""
        mock_db = AsyncMock()

        service = await get_tenant_service(db=mock_db)

        assert isinstance(service, TenantService)


@pytest.mark.integration
class TestGetCurrentTenant:
    """Test get_current_tenant dependency."""

    @pytest.mark.asyncio
    async def test_get_current_tenant_success(self):
        """Test successfully retrieving current tenant."""
        tenant = create_fake_tenant("tenant-123")
        service = FakeTenantService()
        service.add_tenant(tenant)

        result = await get_current_tenant(tenant_id="tenant-123", service=service)

        assert result.id == "tenant-123"
        assert result.name == "Test Tenant"

    @pytest.mark.asyncio
    async def test_get_current_tenant_no_tenant_id(self):
        """Test error when tenant ID not provided."""
        service = FakeTenantService()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(tenant_id=None, service=service)

        assert exc_info.value.status_code == 400
        assert "Tenant context not available" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_current_tenant_not_found(self):
        """Test error when tenant not found."""
        service = FakeTenantService()

        with pytest.raises(HTTPException) as exc_info:
            await get_current_tenant(tenant_id="nonexistent", service=service)

        assert exc_info.value.status_code == 404
        assert "not found" in exc_info.value.detail


@pytest.mark.integration
class TestRequireActiveTenant:
    """Test require_active_tenant dependency."""

    @pytest.mark.asyncio
    async def test_require_active_tenant_success(self):
        """Test active tenant passes validation."""
        tenant = create_fake_tenant(status=TenantStatus.ACTIVE)

        result = await require_active_tenant(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_active_tenant_suspended(self):
        """Test suspended tenant fails validation."""
        tenant = create_fake_tenant(status=TenantStatus.SUSPENDED)

        with pytest.raises(HTTPException) as exc_info:
            await require_active_tenant(tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "not active" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_active_tenant_trial(self):
        """Test trial tenant fails validation."""
        tenant = create_fake_tenant(status=TenantStatus.TRIAL)

        with pytest.raises(HTTPException) as exc_info:
            await require_active_tenant(tenant=tenant)

        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestRequireTrialOrActiveTenant:
    """Test require_trial_or_active_tenant dependency."""

    @pytest.mark.asyncio
    async def test_require_trial_or_active_active_success(self):
        """Test active tenant passes."""
        tenant = create_fake_tenant(status=TenantStatus.ACTIVE)

        result = await require_trial_or_active_tenant(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_trial_or_active_trial_success(self):
        """Test trial tenant with valid trial passes."""
        future = datetime.now(UTC) + timedelta(days=30)
        tenant = create_fake_tenant(status=TenantStatus.TRIAL, trial_ends_at=future)

        result = await require_trial_or_active_tenant(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_trial_or_active_trial_expired(self):
        """Test trial tenant with expired trial fails."""
        past = datetime.now(UTC) - timedelta(days=1)
        tenant = create_fake_tenant(status=TenantStatus.TRIAL, trial_ends_at=past)

        with pytest.raises(HTTPException) as exc_info:
            await require_trial_or_active_tenant(tenant=tenant)

        assert exc_info.value.status_code == 402
        assert "Trial period has expired" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_trial_or_active_suspended(self):
        """Test suspended tenant fails."""
        tenant = create_fake_tenant(status=TenantStatus.SUSPENDED)

        with pytest.raises(HTTPException) as exc_info:
            await require_trial_or_active_tenant(tenant=tenant)

        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestCheckTenantFeature:
    """Test check_tenant_feature dependency."""

    @pytest.mark.asyncio
    async def test_check_tenant_feature_enabled(self):
        """Test feature check passes when enabled."""
        tenant = create_fake_tenant(features={"analytics": True, "api": True})

        result = await check_tenant_feature(feature="analytics", tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_check_tenant_feature_disabled(self):
        """Test feature check fails when disabled."""
        tenant = create_fake_tenant(features={"analytics": False})

        with pytest.raises(HTTPException) as exc_info:
            await check_tenant_feature(feature="analytics", tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "not enabled" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_check_tenant_feature_not_in_dict(self):
        """Test feature check fails when feature not in dict."""
        tenant = create_fake_tenant(features={})

        with pytest.raises(HTTPException) as exc_info:
            await check_tenant_feature(feature="premium", tenant=tenant)

        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestCheckUserLimit:
    """Test check_user_limit dependency."""

    @pytest.mark.asyncio
    async def test_check_user_limit_within_limit(self):
        """Test passes when under user limit."""
        tenant = create_fake_tenant(max_users=10, current_users=5)

        result = await check_user_limit(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_check_user_limit_at_limit(self):
        """Test fails when at user limit."""
        tenant = create_fake_tenant(max_users=10, current_users=10)

        with pytest.raises(HTTPException) as exc_info:
            await check_user_limit(tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "maximum user limit" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_check_user_limit_exceeded(self):
        """Test fails when over user limit."""
        tenant = create_fake_tenant(max_users=10, current_users=15)

        with pytest.raises(HTTPException) as exc_info:
            await check_user_limit(tenant=tenant)

        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestCheckAPILimit:
    """Test check_api_limit dependency."""

    @pytest.mark.asyncio
    async def test_check_api_limit_within_limit(self):
        """Test passes when under API limit."""
        tenant = create_fake_tenant(max_api_calls_per_month=100000, current_api_calls=50000)

        result = await check_api_limit(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_check_api_limit_exceeded(self):
        """Test fails when API limit exceeded."""
        tenant = create_fake_tenant(max_api_calls_per_month=100000, current_api_calls=100000)

        with pytest.raises(HTTPException) as exc_info:
            await check_api_limit(tenant=tenant)

        assert exc_info.value.status_code == 429
        assert "exceeded monthly API limit" in exc_info.value.detail


@pytest.mark.integration
class TestCheckStorageLimit:
    """Test check_storage_limit dependency."""

    @pytest.mark.asyncio
    async def test_check_storage_limit_within_limit(self):
        """Test passes when under storage limit."""
        tenant = create_fake_tenant(max_storage_gb=50, current_storage_gb=25.5)

        result = await check_storage_limit(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_check_storage_limit_exceeded(self):
        """Test fails when storage limit exceeded."""
        tenant = create_fake_tenant(max_storage_gb=50, current_storage_gb=50.0)

        with pytest.raises(HTTPException) as exc_info:
            await check_storage_limit(tenant=tenant)

        assert exc_info.value.status_code == 507
        assert "exceeded storage limit" in exc_info.value.detail


@pytest.mark.integration
class TestRequireTenantAdmin:
    """Test require_tenant_admin dependency."""

    @pytest.mark.asyncio
    async def test_require_tenant_admin_success(self):
        """Test tenant admin passes validation."""
        tenant = create_fake_tenant("tenant-123")
        user = create_fake_user(user_id="user-123", tenant_id="tenant-123", roles=["tenant_admin"])

        result_user, result_tenant = await require_tenant_admin(current_user=user, tenant=tenant)

        assert result_user == user
        assert result_tenant == tenant

    @pytest.mark.asyncio
    async def test_require_tenant_admin_global_admin(self):
        """Test global admin passes validation."""
        tenant = create_fake_tenant("tenant-123")
        user = create_fake_user(user_id="user-123", tenant_id="tenant-123", roles=["admin"])

        result_user, result_tenant = await require_tenant_admin(current_user=user, tenant=tenant)

        assert result_user == user

    @pytest.mark.asyncio
    async def test_require_tenant_admin_no_roles(self):
        """Test regular user fails validation."""
        tenant = create_fake_tenant("tenant-123")
        user = create_fake_user(user_id="user-123", tenant_id="tenant-123", roles=["user"])

        with pytest.raises(HTTPException) as exc_info:
            await require_tenant_admin(current_user=user, tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "Insufficient permissions" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_tenant_admin_wrong_tenant(self):
        """Test user from different tenant fails."""
        tenant = create_fake_tenant("tenant-123")
        user = create_fake_user(
            user_id="user-123",
            tenant_id="tenant-456",
            roles=["tenant_admin"],  # Different tenant
        )

        with pytest.raises(HTTPException) as exc_info:
            await require_tenant_admin(current_user=user, tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "does not have access" in exc_info.value.detail


@pytest.mark.integration
class TestRequireTenantOwner:
    """Test require_tenant_owner dependency."""

    @pytest.mark.asyncio
    async def test_require_tenant_owner_success(self):
        """Test tenant owner passes validation."""
        tenant = create_fake_tenant("tenant-123", created_by="user-123")
        user = create_fake_user(user_id="user-123")

        result_user, result_tenant = await require_tenant_owner(current_user=user, tenant=tenant)

        assert result_user == user
        assert result_tenant == tenant

    @pytest.mark.asyncio
    async def test_require_tenant_owner_not_owner(self):
        """Test non-owner fails validation."""
        tenant = create_fake_tenant("tenant-123", created_by="user-456")
        user = create_fake_user(user_id="user-123")

        with pytest.raises(HTTPException) as exc_info:
            await require_tenant_owner(current_user=user, tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "Only the tenant owner" in exc_info.value.detail


@pytest.mark.integration
class TestRequireFeature:
    """Test require_feature dependency factory."""

    @pytest.mark.asyncio
    async def test_require_feature_factory_enabled(self):
        """Test feature requirement passes when enabled."""
        tenant = create_fake_tenant(features={"advanced_analytics": True})

        dependency = require_feature("advanced_analytics")
        result = await dependency(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_feature_factory_disabled(self):
        """Test feature requirement fails when disabled."""
        tenant = create_fake_tenant(features={"advanced_analytics": False})

        dependency = require_feature("advanced_analytics")

        with pytest.raises(HTTPException) as exc_info:
            await dependency(tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "advanced_analytics" in exc_info.value.detail


@pytest.mark.integration
class TestRequirePlan:
    """Test require_plan dependency factory."""

    @pytest.mark.asyncio
    async def test_require_plan_exact_match(self):
        """Test plan requirement with exact match."""
        tenant = create_fake_tenant(plan_type=TenantPlanType.ENTERPRISE)

        dependency = require_plan("enterprise")
        result = await dependency(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_plan_higher_plan(self):
        """Test plan requirement passes with higher plan."""
        tenant = create_fake_tenant(plan_type=TenantPlanType.ENTERPRISE)

        dependency = require_plan("professional")
        result = await dependency(tenant=tenant)

        assert result == tenant

    @pytest.mark.asyncio
    async def test_require_plan_lower_plan_fails(self):
        """Test plan requirement fails with lower plan."""
        tenant = create_fake_tenant(plan_type=TenantPlanType.STARTER)

        dependency = require_plan("enterprise")

        with pytest.raises(HTTPException) as exc_info:
            await dependency(tenant=tenant)

        assert exc_info.value.status_code == 403
        assert "requires at least" in exc_info.value.detail
        assert "enterprise" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_require_plan_free_to_starter(self):
        """Test free plan fails starter requirement."""
        tenant = create_fake_tenant(plan_type=TenantPlanType.FREE)

        dependency = require_plan("starter")

        with pytest.raises(HTTPException) as exc_info:
            await dependency(tenant=tenant)

        assert exc_info.value.status_code == 403


@pytest.mark.integration
class TestAnnotatedDependencies:
    """Test that typed annotations are defined correctly."""

    def test_typed_annotations_exist(self):
        """Test all typed annotations are available."""
        from dotmac.platform.tenant.dependencies import (
            ActiveTenant,
            CurrentTenant,
            TenantAdminAccess,
            TenantOwnerAccess,
            TenantWithinAPILimit,
            TenantWithinStorageLimit,
            TenantWithinUserLimit,
            TrialOrActiveTenant,
        )

        # All annotations should be defined
        assert CurrentTenant is not None
        assert ActiveTenant is not None
        assert TrialOrActiveTenant is not None
        assert TenantWithinUserLimit is not None
        assert TenantWithinAPILimit is not None
        assert TenantWithinStorageLimit is not None
        assert TenantAdminAccess is not None
        assert TenantOwnerAccess is not None
