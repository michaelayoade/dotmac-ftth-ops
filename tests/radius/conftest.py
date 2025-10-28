"""
Pytest configuration and fixtures for RADIUS module tests.
"""

import pytest
import pytest_asyncio

# Import RADIUS models so they register with Base.metadata before table creation
# Must import from .models directly, not from package __init__.py which doesn't export models
from dotmac.platform.radius.models import (  # noqa: F401


    NAS,
    RadAcct,
    RadCheck,
    RadiusBandwidthProfile,
    RadPostAuth,
    RadReply,
)
from dotmac.platform.tenant.models import Tenant, TenantPlanType, TenantStatus



pytestmark = pytest.mark.integration

@pytest_asyncio.fixture(autouse=True)
async def ensure_radius_tables_exist(async_db_engine):
    """
    Ensure RADIUS tables exist before each test.

    The main conftest drops all tables after each test, but with StaticPool
    for in-memory SQLite, all tests share the same database. This fixture
    recreates RADIUS tables that were dropped by the previous test's teardown.
    """
    from dotmac.platform.db import Base

    # Recreate only RADIUS tables (checkfirst=True prevents errors if they exist)
    async with async_db_engine.begin() as conn:
        radius_table_names = [
            "radcheck",
            "radreply",
            "radacct",
            "radpostauth",
            "nas",
            "radius_bandwidth_profiles",
        ]
        radius_tables = [
            Base.metadata.tables[name]
            for name in radius_table_names
            if name in Base.metadata.tables
        ]
        if radius_tables:
            await conn.run_sync(
                lambda sync_conn: Base.metadata.create_all(
                    sync_conn, tables=radius_tables, checkfirst=True
                )
            )


@pytest_asyncio.fixture
async def test_tenant(async_db_session):
    """Create a test tenant for RADIUS tests."""
    # Create a tenant
    tenant = Tenant(
        id="tenant-radius-test",
        name="Test ISP Tenant",
        slug="test-isp",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
    )

    async_db_session.add(tenant)
    await async_db_session.commit()
    await async_db_session.refresh(tenant)

    yield tenant

    # Cleanup
    await async_db_session.delete(tenant)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def test_tenant_2(async_db_session):
    """Create a second test tenant for isolation tests."""
    # Create a second tenant
    tenant = Tenant(
        id="tenant-radius-test-2",
        name="Test ISP Tenant 2",
        slug="test-isp-2",
        status=TenantStatus.ACTIVE,
        plan_type=TenantPlanType.PROFESSIONAL,
    )

    async_db_session.add(tenant)
    await async_db_session.commit()
    await async_db_session.refresh(tenant)

    yield tenant

    # Cleanup
    await async_db_session.delete(tenant)
    await async_db_session.commit()


@pytest_asyncio.fixture
async def test_user(async_db_session, test_tenant):
    """Create a test user for RADIUS tests."""
    from uuid import uuid4

    from dotmac.platform.auth.core import hash_password
    from dotmac.platform.user_management.models import User

    user = User(
        id=uuid4(),  # Generate proper UUID
        username="radiususer",
        email="radius@test.com",
        password_hash=hash_password("TestPassword123!"),  # Add password hash
        full_name="RADIUS Test User",
        tenant_id=test_tenant.id,
        is_active=True,
    )

    async_db_session.add(user)
    await async_db_session.commit()
    await async_db_session.refresh(user)

    yield user

    # Cleanup
    await async_db_session.delete(user)
    await async_db_session.commit()


@pytest.fixture
def test_app_with_radius(async_db_engine):
    """Test app with RADIUS router registered."""
    import asyncio
    import sqlalchemy
    from fastapi import FastAPI
    from sqlalchemy.ext.asyncio import async_sessionmaker

    # IMPORTANT: Create tables BEFORE creating the app
    # This ensures tables exist when the router initializes
    from dotmac.platform.db import Base

    # Debug: print available tables
    print(f"\nDEBUG: Tables in Base.metadata: {list(Base.metadata.tables.keys())[:20]}")
    print(f"DEBUG: Looking for 'radcheck': {'radcheck' in Base.metadata.tables}")

    async def create_all_tables():
        # Use begin() for transactional DDL, but it auto-commits on context exit
        async with async_db_engine.begin() as conn:
            print("DEBUG: Creating all tables...")
            # Try explicit table creation for RADIUS tables
            radius_table_names = ['radcheck', 'radreply', 'radacct', 'radpostauth', 'nas', 'radius_bandwidth_profiles']
            radius_tables = [Base.metadata.tables[name] for name in radius_table_names if name in Base.metadata.tables]
            print(f"DEBUG: RADIUS tables to create: {[t.name for t in radius_tables]}")

            def create_tables(sync_conn):
                # Create all tables first
                Base.metadata.create_all(sync_conn, checkfirst=True)
                # Then specifically try creating RADIUS tables again
                for table in radius_tables:
                    print(f"DEBUG: Creating table {table.name}")
                    try:
                        table.create(sync_conn, checkfirst=True)
                    except Exception as e:
                        print(f"DEBUG: Error creating {table.name}: {e}")

            await conn.run_sync(create_tables)
            # Transaction will commit when exiting the context manager
            print("DEBUG: Tables created successfully")

        # Verify AFTER commit by creating a new connection
        async with async_db_engine.connect() as verify_conn:
            result = await verify_conn.execute(sqlalchemy.text("SELECT name FROM sqlite_master WHERE type='table'"))
            tables = [row[0] for row in result]
            print(f"DEBUG: Tables in database (after commit): {sorted(tables)[:30]}")
            print(f"DEBUG: radcheck in database: {'radcheck' in tables}")

    # Run table creation synchronously
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    loop.run_until_complete(create_all_tables())

    app = FastAPI(title="RADIUS Test App")

    # Register RADIUS router (router already has prefix="/api/v1/radius")
    try:
        from dotmac.platform.radius.router import router as radius_router

        app.include_router(radius_router)  # Don't add prefix - router already has it
    except ImportError:
        pass

    # Override database session
    try:
        from dotmac.platform.db import get_async_session

        test_session_maker = async_sessionmaker(async_db_engine, expire_on_commit=False)

        async def override_get_async_session():
            async with test_session_maker() as session:
                try:
                    yield session
                except Exception:
                    await session.rollback()
                    raise
                finally:
                    await session.close()

        app.dependency_overrides[get_async_session] = override_get_async_session
    except ImportError:
        pass

    # Override tenant dependencies
    try:
        from uuid import uuid4

        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.tenant import get_current_tenant_id
        from dotmac.platform.tenant.dependencies import get_current_tenant, require_tenant_admin
        from dotmac.platform.tenant.models import Tenant, TenantPlanType, TenantStatus

        def override_get_current_tenant_id():
            return "tenant-radius-test"

        async def override_get_current_tenant():
            # Return a mock tenant object
            return Tenant(
                id="tenant-radius-test",
                name="Test ISP Tenant",
                slug="test-isp",
                status=TenantStatus.ACTIVE,
                plan_type=TenantPlanType.PROFESSIONAL,
            )

        async def override_require_tenant_admin():
            # Return tuple of (UserInfo, Tenant) as required by TenantAdminAccess
            user = UserInfo(
                user_id=str(uuid4()),
                email="radius@test.com",
                username="radiususer",
                roles=["admin"],
                permissions=["read", "write", "admin", "isp.radius.write"],
                tenant_id="tenant-radius-test",
            )
            tenant = Tenant(
                id="tenant-radius-test",
                name="Test ISP Tenant",
                slug="test-isp",
                status=TenantStatus.ACTIVE,
                plan_type=TenantPlanType.PROFESSIONAL,
            )
            return (user, tenant)

        app.dependency_overrides[get_current_tenant_id] = override_get_current_tenant_id
        app.dependency_overrides[get_current_tenant] = override_get_current_tenant
        app.dependency_overrides[require_tenant_admin] = override_require_tenant_admin
    except ImportError as e:
        print(f"Failed to override tenant dependencies: {e}")

    # Override auth dependency
    try:
        from uuid import uuid4

        from dotmac.platform.auth.core import UserInfo
        from dotmac.platform.auth.dependencies import get_current_user
        from dotmac.platform.auth.rbac_service import RBACService

        test_user_info = UserInfo(
            user_id=str(uuid4()),
            email="radius@test.com",
            username="radiususer",
            roles=["admin"],
            permissions=["read", "write", "admin", "isp.radius.write"],
            tenant_id="tenant-radius-test",
        )

        async def override_get_current_user():
            return test_user_info

        # Monkey patch RBACService permission check methods to always return True
        async def mock_user_has_all_permissions(self, user_id: str, permissions: list[str]) -> bool:
            """Mock that always returns True for permission checks"""
            return True

        async def mock_user_has_any_permission(self, user_id: str, permissions: list[str]) -> bool:
            """Mock that always returns True for permission checks"""
            return True

        RBACService.user_has_all_permissions = mock_user_has_all_permissions
        RBACService.user_has_any_permission = mock_user_has_any_permission

        app.dependency_overrides[get_current_user] = override_get_current_user
    except ImportError as e:
        print(f"Failed to override auth dependencies: {e}")

    return app


@pytest_asyncio.fixture
async def async_client(test_app_with_radius):
    """Async HTTP client for RADIUS router tests."""
    from httpx import ASGITransport, AsyncClient

    transport = ASGITransport(app=test_app_with_radius)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client


@pytest.fixture
def auth_headers(test_tenant, test_user):
    """Authentication headers for RADIUS tests."""
    from dotmac.platform.auth.core import JWTService

    jwt_service = JWTService(algorithm="HS256", secret="test-secret-key-for-testing-only")

    test_token = jwt_service.create_access_token(
        subject=str(test_user.id),  # Use actual user ID
        additional_claims={
            "scopes": ["read", "write", "admin"],
            "tenant_id": test_tenant.id,
            "email": "radius@test.com",
        },
    )

    return {
        "Authorization": f"Bearer {test_token}",
        "X-Tenant-ID": test_tenant.id,
    }
