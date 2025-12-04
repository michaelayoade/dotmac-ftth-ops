"""Test fixtures for dunning module."""

from typing import Any
from uuid import uuid4

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from dotmac.platform.billing.dunning.models import (
    DunningActionType,
)
from dotmac.platform.billing.dunning.schemas import (
    DunningActionConfig,
    DunningCampaignCreate,
    DunningExclusionRules,
)
from dotmac.platform.db import Base

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def dunning_test_environment(monkeypatch):
    monkeypatch.setenv("TESTING", "1")


@pytest_asyncio.fixture
async def async_client(test_app, async_session, test_tenant_id):
    """Async HTTP client for dunning API tests.

    Creates an httpx AsyncClient for testing async endpoints.
    Includes authentication headers and tenant ID.
    """
    from httpx import ASGITransport, AsyncClient

    try:
        from dotmac.platform.db import get_async_session, get_session_dependency
    except ImportError:  # pragma: no cover
        get_async_session = None  # type: ignore[assignment]
        get_session_dependency = None  # type: ignore[assignment]

    overrides: dict[Any, Any] = {}

    async def override_session():
        yield async_session

    if get_async_session is not None:
        overrides[get_async_session] = override_session
    if get_session_dependency is not None:
        overrides[get_session_dependency] = override_session

    try:
        from dotmac.platform.database import get_async_session as database_get_async_session

        overrides[database_get_async_session] = override_session
    except ImportError:  # pragma: no cover
        pass

    try:
        from dotmac.platform.tenant import get_current_tenant_id

        def override_get_current_tenant_id() -> str:
            return test_tenant_id

        overrides[get_current_tenant_id] = override_get_current_tenant_id
    except ImportError:  # pragma: no cover
        pass

    try:
        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.auth.dependencies import get_current_user

        def override_get_current_user() -> UserInfo:
            return UserInfo(
                user_id=str(uuid4()),
                tenant_id=test_tenant_id,
                email="test@example.com",
                username="test-user",
                roles=["admin"],
                permissions=["billing:dunning:write"],
            )

        overrides[get_current_user] = override_get_current_user
    except ImportError:  # pragma: no cover
        pass

    for dependency, override in overrides.items():
        test_app.dependency_overrides[dependency] = override

    transport = ASGITransport(app=test_app)
    async with AsyncClient(
        transport=transport,
        base_url="http://testserver",
        headers={
            "Authorization": "Bearer test-token",
            "X-Tenant-ID": test_tenant_id,
        },
    ) as client:
        yield client

    for dependency in overrides:
        test_app.dependency_overrides.pop(dependency, None)


@pytest_asyncio.fixture(scope="function")
async def async_session():
    """Create an async database session for testing."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_maker() as session:
        yield session
        await session.rollback()

    await engine.dispose()


@pytest.fixture
def test_tenant_id():
    """Test tenant ID."""
    return str(uuid4())


@pytest.fixture
def tenant_id(test_tenant_id):
    """Override shared tenant_id fixture to align with dunning fixtures."""
    return test_tenant_id


@pytest.fixture
def test_user_id():
    """Test user ID."""
    return uuid4()


@pytest.fixture
def test_customer_id():
    """Test customer ID."""
    return uuid4()


@pytest.fixture
def sample_campaign_data():
    """Sample campaign creation data."""
    return DunningCampaignCreate(
        name="Test Campaign",
        description="Test dunning campaign",
        trigger_after_days=7,
        max_retries=3,
        retry_interval_days=3,
        actions=[
            DunningActionConfig(
                type=DunningActionType.EMAIL,
                delay_days=0,
                template="payment_reminder_1",
            ),
            DunningActionConfig(
                type=DunningActionType.EMAIL,
                delay_days=3,
                template="payment_reminder_2",
            ),
            DunningActionConfig(
                type=DunningActionType.SUSPEND_SERVICE,
                delay_days=7,
            ),
        ],
        exclusion_rules=DunningExclusionRules(
            min_lifetime_value=1000.0,
            customer_tiers=["premium", "enterprise"],
        ),
        priority=5,
        is_active=True,
    )


@pytest_asyncio.fixture
async def sample_campaign(async_session, test_tenant_id, test_user_id, sample_campaign_data):
    """Create a sample dunning campaign."""
    from dotmac.platform.billing.dunning.service import DunningService

    service = DunningService(async_session)
    campaign = await service.create_campaign(
        tenant_id=test_tenant_id,
        data=sample_campaign_data,
        created_by_user_id=test_user_id,
    )
    await async_session.commit()
    await async_session.refresh(campaign)
    return campaign


@pytest_asyncio.fixture
async def sample_execution(async_session, sample_campaign, test_tenant_id, test_customer_id):
    """Create a sample dunning execution."""
    from dotmac.platform.billing.dunning.service import DunningService

    service = DunningService(async_session)
    execution = await service.start_execution(
        campaign_id=sample_campaign.id,
        tenant_id=test_tenant_id,
        subscription_id="sub_test_123",
        customer_id=test_customer_id,
        invoice_id="inv_test_123",
        outstanding_amount=10000,  # $100.00
        metadata={"test": "data"},
    )
    await async_session.commit()
    await async_session.refresh(execution)
    return execution
