"""
Fixtures for tenant management tests.
"""

from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
import pytest_asyncio
from httpx import AsyncClient

from dotmac.platform.billing.subscriptions.service import SubscriptionService
from dotmac.platform.tenant.models import TenantInvitationStatus, TenantPlanType, TenantStatus
from dotmac.platform.tenant.provisioning_service import TenantProvisioningService
from dotmac.platform.tenant.service import TenantNotFoundError, TenantService
from dotmac.platform.tenant.usage_billing_integration import (
    TenantUsageBillingIntegration,
)


@pytest.fixture
def mock_tenant_service() -> AsyncMock:
    """Create mock tenant service instance."""
    service = AsyncMock(spec=TenantService)

    # Store tenant state
    tenant_state = {
        "tenant-123": {
            "current_api_calls": 8000,
            "current_storage_gb": 7.5,
            "current_users": 5,
        }
    }

    # Mock record_usage method
    async def mock_record_usage(tenant_id, usage_data):
        # Validate tenant exists
        if tenant_id in ["nonexistent", "invalid", "nonexistent-tenant"]:
            raise TenantNotFoundError(f"Tenant {tenant_id} not found")

        return SimpleNamespace(
            id=1,
            tenant_id=tenant_id,
            period_start=usage_data.period_start,
            period_end=usage_data.period_end,
            api_calls=usage_data.api_calls,
            storage_gb=usage_data.storage_gb,
            bandwidth_gb=usage_data.bandwidth_gb,
            active_users=usage_data.active_users,
        )

    service.record_usage = AsyncMock(side_effect=mock_record_usage)

    # Mock update_tenant_usage_counters method
    async def mock_update_counters(tenant_id, api_calls=None, storage_gb=None, users=None):
        """Update tenant usage counters in mock state."""
        if tenant_id not in tenant_state:
            tenant_state[tenant_id] = {}
        if api_calls is not None:
            tenant_state[tenant_id]["current_api_calls"] = api_calls
        if storage_gb is not None:
            tenant_state[tenant_id]["current_storage_gb"] = storage_gb
        if users is not None:
            tenant_state[tenant_id]["current_users"] = users
        return True

    service.update_tenant_usage_counters = AsyncMock(side_effect=mock_update_counters)

    # Mock get_tenant method
    async def mock_get_tenant(tenant_id, include_deleted=False):
        from decimal import Decimal

        # Raise error for invalid tenant IDs
        if tenant_id in ["nonexistent", "invalid", "nonexistent-tenant", "nonexistent-id"]:
            raise TenantNotFoundError(f"Tenant {tenant_id} not found")

        # Check if tenant exists in created_tenants
        if tenant_id in created_tenants:
            tenant = created_tenants[tenant_id]
            # Check if soft deleted
            if tenant.deleted_at is not None and not include_deleted:
                raise TenantNotFoundError(f"Tenant {tenant_id} not found")

            # Merge in any updates from tenant_state (from update_tenant_usage_counters)
            if tenant_id in tenant_state:
                state = tenant_state[tenant_id]
                if "current_api_calls" in state:
                    tenant.current_api_calls = state["current_api_calls"]
                if "current_storage_gb" in state:
                    tenant.current_storage_gb = Decimal(str(state["current_storage_gb"]))
                if "current_users" in state:
                    tenant.current_users = state["current_users"]

                # Recalculate exceeded flags
                tenant.has_exceeded_api_limit = (
                    tenant.current_api_calls >= tenant.max_api_calls_per_month
                )
                tenant.has_exceeded_storage_limit = (
                    float(tenant.current_storage_gb) >= tenant.max_storage_gb
                )
                tenant.has_exceeded_user_limit = tenant.current_users >= tenant.max_users

            return tenant

        state = tenant_state.get(
            tenant_id,
            {
                "current_api_calls": 8000,
                "current_storage_gb": 7.5,
                "current_users": 5,
            },
        )

        current_api_calls = state.get("current_api_calls", 8000)
        current_storage_gb = state.get("current_storage_gb", 7.5)
        current_users = state.get("current_users", 5)

        # Default limits (professional plan)
        max_api_calls = 10000
        max_storage_gb = 50  # Professional plan has 50GB storage
        max_users = 10

        # Special handling for minimal-limit tenant
        if "minimal-limit" in str(tenant_id).lower():
            max_api_calls = 0
            max_storage_gb = 1
            max_users = 1

        # Determine plan type based on tenant_id
        plan_type = TenantPlanType.PROFESSIONAL
        if "free" in str(tenant_id).lower():
            plan_type = TenantPlanType.FREE
        elif "starter" in str(tenant_id).lower():
            plan_type = TenantPlanType.STARTER
        elif "enterprise" in str(tenant_id).lower():
            plan_type = TenantPlanType.ENTERPRISE

        status = TenantStatus.ACTIVE

        return SimpleNamespace(
            id=tenant_id,
            name="Test Organization",
            slug="test-org",
            email="test@example.com",
            phone=None,
            domain=None,
            plan_type=plan_type,
            status=status,
            billing_cycle="monthly",
            billing_email=None,
            max_users=max_users,
            max_api_calls_per_month=max_api_calls,
            max_storage_gb=max_storage_gb,
            current_users=current_users,
            current_api_calls=current_api_calls,
            current_storage_gb=Decimal(str(current_storage_gb)),
            has_exceeded_api_limit=current_api_calls > max_api_calls,
            has_exceeded_storage_limit=current_storage_gb > max_storage_gb,
            has_exceeded_user_limit=current_users > max_users,
            trial_ends_at=None,
            subscription_starts_at=None,
            subscription_ends_at=None,
            features={},
            settings={},
            custom_metadata={},
            company_size=None,
            industry=None,
            country=None,
            timezone="timezone.utc",
            logo_url=None,
            primary_color=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            deleted_at=None,
            # Properties
            is_trial=False,
            is_active=True,
            status_is_active=(status == TenantStatus.ACTIVE),
            trial_expired=False,
            is_deleted=False,
        )

    service.get_tenant = AsyncMock(side_effect=mock_get_tenant)

    # Mock list_tenants method
    async def mock_list_tenants(
        page=1, page_size=10, status=None, plan_type=None, search=None, include_deleted=False
    ):
        """Mock list tenants."""
        # Return created tenants or empty list
        tenants = list(created_tenants.values())

        # Apply filters
        if status:
            tenants = [t for t in tenants if t.status == status]
        if plan_type:
            tenants = [t for t in tenants if t.plan_type == plan_type]
        if search:
            tenants = [
                t
                for t in tenants
                if search.lower() in t.name.lower() or search.lower() in t.slug.lower()
            ]
        if not include_deleted:
            tenants = [t for t in tenants if not t.deleted_at]

        total = len(tenants)
        # Apply pagination
        start = (page - 1) * page_size
        end = start + page_size
        return tenants[start:end], total

    async def mock_get_tenant_by_slug(slug):
        """Mock get tenant by slug."""
        for tenant in created_tenants.values():
            if tenant.slug == slug:
                return tenant
        raise TenantNotFoundError(f"Tenant with slug {slug} not found")

    async def mock_delete_tenant(tenant_id, permanent=False, deleted_by=None):
        """Mock delete tenant."""
        if tenant_id in created_tenants:
            if permanent:
                del created_tenants[tenant_id]
            else:
                created_tenants[tenant_id].deleted_at = datetime.now(UTC)
                created_tenants[tenant_id].is_deleted = True
        else:
            # Try to get from mock_get_tenant
            tenant = await mock_get_tenant(tenant_id)
            if permanent:
                pass  # Can't really delete from mock_get_tenant
            else:
                tenant.deleted_at = datetime.now(UTC)
                tenant.is_deleted = True

    async def mock_restore_tenant(tenant_id, restored_by=None):
        """Mock restore tenant."""
        if tenant_id in created_tenants:
            created_tenants[tenant_id].deleted_at = None
            created_tenants[tenant_id].is_deleted = False
            return created_tenants[tenant_id]
        else:
            tenant = await mock_get_tenant(tenant_id)
            tenant.deleted_at = None
            tenant.is_deleted = False
            return tenant

    service.list_tenants = AsyncMock(side_effect=mock_list_tenants)
    service.get_tenant_by_slug = AsyncMock(side_effect=mock_get_tenant_by_slug)
    service.delete_tenant = AsyncMock(side_effect=mock_delete_tenant)
    service.restore_tenant = AsyncMock(side_effect=mock_restore_tenant)

    # Mock get_tenant_stats method
    async def mock_get_tenant_stats(tenant_id):
        state = tenant_state.get(
            tenant_id,
            {
                "current_api_calls": 8000,
                "current_storage_gb": 7.5,
                "current_users": 5,
            },
        )

        current_api_calls = state.get("current_api_calls", 8000)
        current_storage_gb = state.get("current_storage_gb", 7.5)
        current_users = state.get("current_users", 5)

        return SimpleNamespace(
            api_usage_percent=(current_api_calls / 10000) * 100,
            storage_usage_percent=(current_storage_gb / 50) * 100,  # Professional plan: 50GB
            user_usage_percent=(current_users / 10) * 100,
        )

    service.get_tenant_stats = AsyncMock(side_effect=mock_get_tenant_stats)

    # Mock list_tenants storage - needs to be defined before mock_create_tenant
    created_tenants = {}  # Store created tenants by ID

    # Mock create_tenant method
    async def mock_create_tenant(tenant_data, created_by=None):
        from decimal import Decimal

        from fastapi import HTTPException

        # Check for duplicate slug
        for existing_tenant in created_tenants.values():
            if existing_tenant.slug == tenant_data.slug:
                raise HTTPException(
                    status_code=409, detail=f"Tenant with slug '{tenant_data.slug}' already exists"
                )

        tenant_id = f"{tenant_data.slug}-id"

        # Initialize tenant state
        tenant_state[tenant_id] = {
            "current_api_calls": 0,
            "current_storage_gb": 0,
            "current_users": 0,
        }

        # Get max values from tenant_data if provided
        max_users = getattr(tenant_data, "max_users", 10)
        max_api_calls = getattr(tenant_data, "max_api_calls_per_month", 10000)
        max_storage = getattr(tenant_data, "max_storage_gb", 10)

        status = TenantStatus.TRIAL  # Default for new tenants

        tenant = SimpleNamespace(
            id=tenant_id,
            name=tenant_data.name,
            slug=tenant_data.slug,
            email=getattr(tenant_data, "email", None),
            phone=getattr(tenant_data, "phone", None),
            domain=None,
            plan_type=(
                tenant_data.plan_type.value
                if hasattr(tenant_data.plan_type, "value")
                else tenant_data.plan_type
            ),
            status=status,
            billing_cycle="monthly",
            billing_email=None,
            max_users=max_users,
            max_api_calls_per_month=max_api_calls,
            max_storage_gb=max_storage,
            current_users=0,
            current_api_calls=0,
            current_storage_gb=Decimal("0"),
            has_exceeded_api_limit=False,
            has_exceeded_storage_limit=False,
            has_exceeded_user_limit=False,
            trial_ends_at=None,
            subscription_starts_at=None,
            subscription_ends_at=None,
            features={},
            settings={},
            custom_metadata={},
            company_size=None,
            industry=None,
            country=None,
            timezone="timezone.utc",
            logo_url=None,
            primary_color=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            deleted_at=None,
            # Properties
            is_trial=True,
            is_active=False,
            status_is_active=(status == TenantStatus.ACTIVE),
            trial_expired=False,
            is_deleted=False,
        )

        # Store tenant for list_tenants
        created_tenants[tenant_id] = tenant
        return tenant

    service.create_tenant = AsyncMock(side_effect=mock_create_tenant)

    # Mock tenant settings methods
    tenant_settings = {}  # Store full settings by (tenant_id, key)

    async def mock_set_tenant_setting(tenant_id, setting_data):
        """Mock set tenant setting."""

        key = (tenant_id, setting_data.key)
        # Get existing setting or create new one
        if key in tenant_settings:
            setting = tenant_settings[key]
            # Update existing
            setting.value = setting_data.value
            setting.value_type = getattr(setting_data, "value_type", "string")
            setting.updated_at = datetime.now(UTC)
        else:
            # Create new
            setting_id = len(tenant_settings) + 1
            setting = SimpleNamespace(
                id=setting_id,
                tenant_id=tenant_id,
                key=setting_data.key,
                value=setting_data.value,
                value_type=getattr(setting_data, "value_type", "string"),
                description=getattr(setting_data, "description", None),
                is_encrypted=getattr(setting_data, "is_encrypted", False),
                created_at=datetime.now(UTC),
                updated_at=datetime.now(UTC),
            )
            tenant_settings[key] = setting

        return setting

    async def mock_get_tenant_settings(tenant_id):
        """Mock get all tenant settings."""
        return [setting for key, setting in tenant_settings.items() if key[0] == tenant_id]

    async def mock_get_tenant_setting(tenant_id, key):
        """Mock get specific tenant setting."""
        setting_key = (tenant_id, key)
        if setting_key in tenant_settings:
            return tenant_settings[setting_key]
        return None

    async def mock_delete_tenant_setting(tenant_id, key):
        """Mock delete tenant setting."""
        setting_key = (tenant_id, key)
        if setting_key in tenant_settings:
            del tenant_settings[setting_key]

    service.set_tenant_setting = AsyncMock(side_effect=mock_set_tenant_setting)
    service.get_tenant_settings = AsyncMock(side_effect=mock_get_tenant_settings)
    service.get_tenant_setting = AsyncMock(side_effect=mock_get_tenant_setting)
    service.delete_tenant_setting = AsyncMock(side_effect=mock_delete_tenant_setting)

    # Mock tenant usage methods
    usage_records = []

    async def mock_record_usage(tenant_id, usage_data):
        """Mock record usage."""

        # Validate tenant exists (call get_tenant which will raise TenantNotFoundError if not found)
        await mock_get_tenant(tenant_id)

        usage_id = len(usage_records) + 1
        usage_record = SimpleNamespace(
            id=usage_id,
            tenant_id=tenant_id,
            period_start=usage_data.period_start,
            period_end=usage_data.period_end,
            api_calls=usage_data.api_calls,
            storage_gb=usage_data.storage_gb,
            active_users=usage_data.active_users if hasattr(usage_data, "active_users") else 0,
            bandwidth_gb=usage_data.bandwidth_gb if hasattr(usage_data, "bandwidth_gb") else 0,
            metrics=usage_data.metrics if hasattr(usage_data, "metrics") else {},
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
        )
        usage_records.append(usage_record)
        return usage_record

    async def mock_get_usage_history(tenant_id, start_date=None, end_date=None):
        """Mock get usage history."""
        return [u for u in usage_records if u.tenant_id == tenant_id]

    service.record_usage = AsyncMock(side_effect=mock_record_usage)
    service.get_usage_history = AsyncMock(side_effect=mock_get_usage_history)

    # Mock tenant invitation methods
    invitations = []

    async def mock_create_invitation(tenant_id, invitation_data, invited_by):
        """Mock create invitation."""
        from uuid import uuid4

        invitation_id = str(uuid4())
        invitation = SimpleNamespace(
            id=invitation_id,
            tenant_id=tenant_id,
            email=invitation_data.email,
            role=invitation_data.role if hasattr(invitation_data, "role") else "member",
            invited_by=invited_by,
            status=TenantInvitationStatus.PENDING,
            token=f"token-{invitation_id}",
            expires_at=datetime.now(UTC) + timedelta(days=7),
            accepted_at=None,
            created_at=datetime.now(UTC),
            updated_at=datetime.now(UTC),
            is_pending=True,
            is_expired=False,
        )
        invitations.append(invitation)
        return invitation

    async def mock_get_invitations(tenant_id, status=None):
        """Mock get invitations."""
        result = [i for i in invitations if i.tenant_id == tenant_id]
        if status:
            result = [i for i in result if i.status.value == status]
        return result

    async def mock_accept_invitation(token):
        """Mock accept invitation."""
        for inv in invitations:
            if inv.token == token:
                inv.status = TenantInvitationStatus.ACCEPTED
                inv.accepted_at = datetime.now(UTC)
                return inv
        raise TenantNotFoundError("Invitation not found")

    async def mock_revoke_invitation(invitation_id):
        """Mock revoke invitation."""
        for inv in invitations:
            if inv.id == invitation_id:
                inv.status = TenantInvitationStatus.REVOKED
                return inv
        raise TenantNotFoundError("Invitation not found")

    service.create_invitation = AsyncMock(side_effect=mock_create_invitation)
    service.get_invitations = AsyncMock(side_effect=mock_get_invitations)
    service.accept_invitation = AsyncMock(side_effect=mock_accept_invitation)
    service.revoke_invitation = AsyncMock(side_effect=mock_revoke_invitation)

    # Mock tenant update methods
    async def mock_update_tenant(tenant_id, tenant_data, updated_by=None):
        """Mock update tenant."""
        tenant = await mock_get_tenant(tenant_id)
        # Update fields from tenant_data
        for field in [
            "name",
            "email",
            "phone",
            "billing_email",
            "max_users",
            "max_api_calls_per_month",
            "max_storage_gb",
        ]:
            if hasattr(tenant_data, field):
                value = getattr(tenant_data, field)
                if value is not None:
                    setattr(tenant, field, value)
        tenant.updated_at = datetime.now(UTC)
        return tenant

    async def mock_bulk_update_status(tenant_ids, status, updated_by=None):
        """Mock bulk update status."""
        return len(tenant_ids)

    async def mock_bulk_delete_tenants(tenant_ids, permanent=False, deleted_by=None):
        """Mock bulk delete tenants."""
        return len(tenant_ids)

    service.update_tenant = AsyncMock(side_effect=mock_update_tenant)
    service.bulk_update_status = AsyncMock(side_effect=mock_bulk_update_status)
    service.bulk_delete_tenants = AsyncMock(side_effect=mock_bulk_delete_tenants)

    # Mock get_tenant_stats
    async def mock_get_tenant_stats(tenant_id):
        """Mock get tenant stats."""
        tenant = await mock_get_tenant(tenant_id)
        return SimpleNamespace(
            tenant_id=tenant_id,
            total_users=tenant.current_users,
            active_users=tenant.current_users,  # Same as total_users for mock
            total_api_calls=tenant.current_api_calls,
            total_storage_gb=float(tenant.current_storage_gb),
            total_bandwidth_gb=0.0,  # Mock value
            user_limit=tenant.max_users,
            api_limit=tenant.max_api_calls_per_month,
            storage_limit=tenant.max_storage_gb,
            user_usage_percent=(
                (tenant.current_users / tenant.max_users) * 100 if tenant.max_users > 0 else 0
            ),
            api_usage_percent=(
                (tenant.current_api_calls / tenant.max_api_calls_per_month) * 100
                if tenant.max_api_calls_per_month > 0
                else 0
            ),
            storage_usage_percent=(
                (float(tenant.current_storage_gb) / tenant.max_storage_gb) * 100
                if tenant.max_storage_gb > 0
                else 0
            ),
            plan_type=tenant.plan_type,
            status=tenant.status,
            days_until_expiry=30,  # Mock value
        )

    service.get_tenant_stats = AsyncMock(side_effect=mock_get_tenant_stats)

    # Mock update_tenant_features and update_tenant_metadata methods
    async def mock_update_features(tenant_id, features, updated_by=None):
        """Mock update tenant features."""
        # Ensure tenant exists in created_tenants
        if tenant_id in created_tenants:
            tenant = created_tenants[tenant_id]
        else:
            tenant = await mock_get_tenant(tenant_id)
            created_tenants[tenant_id] = tenant

        # Update features dict (features is already a dict)
        tenant.features.update(features)
        tenant.updated_at = datetime.now(UTC)
        return tenant

    async def mock_update_metadata(tenant_id, custom_metadata, updated_by=None):
        """Mock update tenant metadata."""
        # Ensure tenant exists in created_tenants
        if tenant_id in created_tenants:
            tenant = created_tenants[tenant_id]
        else:
            tenant = await mock_get_tenant(tenant_id)
            created_tenants[tenant_id] = tenant

        # Update custom_metadata dict (custom_metadata is already a dict)
        tenant.custom_metadata.update(custom_metadata)
        tenant.updated_at = datetime.now(UTC)
        return tenant

    service.update_tenant_features = AsyncMock(side_effect=mock_update_features)
    service.update_tenant_metadata = AsyncMock(side_effect=mock_update_metadata)

    return service


@pytest.fixture
def mock_subscription_service() -> AsyncMock:
    """Create mock subscription service."""
    service = AsyncMock(spec=SubscriptionService)

    # Mock record_usage method
    async def mock_record_usage(usage_request, tenant_id):
        return SimpleNamespace(
            subscription_id=usage_request.subscription_id,
            usage_type=usage_request.usage_type,
            quantity=usage_request.quantity,
            timestamp=usage_request.timestamp,
        )

    service.record_usage = AsyncMock(side_effect=mock_record_usage)

    # Mock list_subscriptions method
    async def mock_list_subscriptions(tenant_id: str = None, status: str = None):
        if tenant_id:
            return [
                Mock(
                    subscription_id="sub-123",
                    tenant_id=tenant_id,
                    status=status or "active",
                )
            ]
        return []

    service.list_subscriptions = AsyncMock(side_effect=mock_list_subscriptions)

    return service


@pytest.fixture
def usage_billing_integration(
    mock_tenant_service: AsyncMock,
    mock_subscription_service: AsyncMock,
) -> TenantUsageBillingIntegration:
    """Create usage billing integration instance."""
    return TenantUsageBillingIntegration(
        tenant_service=mock_tenant_service,
        subscription_service=mock_subscription_service,
    )


@pytest.fixture
def sample_tenant() -> Mock:
    """Create a sample mock tenant for testing."""
    from decimal import Decimal

    return SimpleNamespace(
        id="tenant-123",
        name="Test Organization",
        slug="test-org",
        plan_type=TenantPlanType.PROFESSIONAL,  # Use actual enum
        status=TenantStatus.ACTIVE,  # Use actual enum
        billing_cycle="monthly",
        max_users=10,
        max_api_calls_per_month=10000,
        max_storage_gb=50,  # Storage limit is 50GB for these tests
        current_users=5,
        current_api_calls=8000,
        current_storage_gb=Decimal("7.5"),
        has_exceeded_api_limit=False,
        has_exceeded_storage_limit=False,
        has_exceeded_user_limit=False,
    )


# Alias for backwards compatibility with tests
@pytest.fixture
def tenant_service(mock_tenant_service: AsyncMock) -> AsyncMock:
    """Alias for mock_tenant_service."""
    return mock_tenant_service


@pytest.fixture
def mock_provisioning_service() -> AsyncMock:
    """Mock tenant provisioning service for router tests."""
    service = AsyncMock(spec=TenantProvisioningService)
    service.list_jobs.return_value = ([], 0)
    return service


@pytest_asyncio.fixture
async def client(
    mock_tenant_service: AsyncMock,
    mock_subscription_service: AsyncMock,
    usage_billing_integration: TenantUsageBillingIntegration,
):
    """Create unauthenticated async HTTP client for testing auth requirements."""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    # Create test app
    app = FastAPI()

    # Import and setup dependencies
    from dotmac.platform.database import get_async_session
    from dotmac.platform.tenant.usage_billing_router import (
        get_subscription_service,
        get_tenant_service,
        get_usage_billing_integration,
        router,
    )

    # Override service dependencies (but NOT auth - we want to test auth failures)
    async def mock_get_session():
        """Return mock session."""
        return AsyncMock()

    app.dependency_overrides[get_async_session] = mock_get_session
    app.dependency_overrides[get_tenant_service] = lambda: mock_tenant_service
    app.dependency_overrides[get_subscription_service] = lambda: mock_subscription_service
    app.dependency_overrides[get_usage_billing_integration] = lambda: usage_billing_integration

    # Include the router
    app.include_router(router)

    # Create async client WITHOUT auth headers
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def authenticated_client(
    mock_tenant_service: AsyncMock,
    mock_subscription_service: AsyncMock,
    usage_billing_integration: TenantUsageBillingIntegration,
    mock_user_service: AsyncMock,
    mock_provisioning_service: AsyncMock,
):
    """Create authenticated async HTTP client with dependency overrides."""
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient

    # Create test app
    app = FastAPI()

    # Import and setup dependencies - use auth.core since that's what the router imports
    from dotmac.platform.auth.core import UserInfo, get_current_user
    from dotmac.platform.db import get_async_session
    from dotmac.platform.tenant import router as tenant_router
    from dotmac.platform.tenant.dependencies import (
        get_tenant_service as get_tenant_service_dependency,
    )
    from dotmac.platform.tenant.onboarding_router import (
        get_user_service_dependency,
    )
    from dotmac.platform.tenant.onboarding_router import router as onboarding_router
    from dotmac.platform.tenant.router import (
        get_tenant_provisioning_service,
    )
    from dotmac.platform.tenant.router import (
        get_tenant_service as get_tenant_service_main,
    )
    from dotmac.platform.tenant.usage_billing_router import (
        get_subscription_service,
        get_usage_billing_integration,
    )
    from dotmac.platform.tenant.usage_billing_router import (
        get_tenant_service as get_tenant_service_usage,
    )
    from dotmac.platform.tenant.usage_billing_router import router as usage_billing_router

    # Override dependencies with mocks
    async def mock_get_current_user():
        """Return test user."""
        return UserInfo(
            user_id="test-user-123",
            email="test@example.com",
            username="testuser",
            roles=["admin"],
            permissions=[
                "read",
                "write",
                "admin",
                "platform:tenants:write",
                "platform:tenants:read",
                "tenants:write",
                "tenants:read",
                "isp.oss.read",
                "isp.oss.configure",
            ],
            tenant_id=None,
            is_platform_admin=True,
        )

    async def mock_get_session():
        """Return mock session."""
        return AsyncMock()

    # Override the correct get_current_user from auth.core (not auth.dependencies)
    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_async_session] = mock_get_session
    # Override get_tenant_service from both routers
    app.dependency_overrides[get_tenant_service_main] = lambda: mock_tenant_service
    app.dependency_overrides[get_tenant_service_dependency] = lambda: mock_tenant_service
    app.dependency_overrides[get_tenant_service_usage] = lambda: mock_tenant_service
    app.dependency_overrides[get_tenant_provisioning_service] = lambda: mock_provisioning_service
    app.dependency_overrides[get_subscription_service] = lambda: mock_subscription_service
    app.dependency_overrides[get_usage_billing_integration] = lambda: usage_billing_integration
    app.dependency_overrides[get_user_service_dependency] = lambda: mock_user_service

    # Include the routers
    app.include_router(tenant_router.router, prefix="/api/v1")
    app.include_router(onboarding_router, prefix="/api/v1")
    app.include_router(
        usage_billing_router, prefix="/api/v1/tenants", tags=["Tenant Usage Billing"]
    )

    # Create async client
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest_asyncio.fixture
async def async_client(authenticated_client: AsyncClient) -> AsyncClient:
    """Alias for authenticated_client for backwards compatibility."""
    return authenticated_client


@pytest.fixture
def mock_user_service() -> AsyncMock:
    """Create mock user service for tenant tests."""
    return AsyncMock()
