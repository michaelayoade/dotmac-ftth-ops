"""
Auth test configuration and fixtures.

This conftest ensures proper test isolation by clearing global caches
and database state that could cause cross-test pollution.
"""

import pytest
import pytest_asyncio


# Module-level cleanup to run after all auth tests
def pytest_sessionfinish(session, exitstatus):
    """Clean up after entire test session."""
    pass  # Placeholder for any session-level cleanup


@pytest.fixture(autouse=True)
def clear_global_cache():
    """
    Clear global cache before each test to prevent cross-test pollution.

    The caching module (dotmac.platform.core.caching) uses module-level
    global caches (memory_cache, lru_cache) that persist across tests.
    Without clearing these, RBAC tests can fail due to stale cached permissions.

    This fixture runs automatically before every test in the auth directory.
    """
    from dotmac.platform.core.caching import cache_clear

    # Clear all cached data before test
    cache_clear(flush_all=True)  # Use flush_all to ensure complete cleanup

    yield  # Run the test

    # Clear again after test to prevent pollution of subsequent tests
    cache_clear(flush_all=True)


@pytest_asyncio.fixture(autouse=True, scope="function")
async def clean_rbac_tables(async_db_engine):
    """
    Clean RBAC-related database tables after each test.

    PROBLEM: Tests call session.commit() which permanently saves data to the database.
    The session.rollback() in conftest only rolls back uncommitted transactions.
    Committed data persists across tests, causing pollution.

    SOLUTION: Explicitly delete data from RBAC tables after each test using a
    separate database session to avoid fixture ordering issues.

    This fixture runs automatically after every async test in the auth directory.
    """
    yield  # Run the test first

    # Clean up after test using a separate session to avoid ordering issues
    from sqlalchemy import delete
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from dotmac.platform.auth.models import (
        Permission,
        PermissionGrant,
        Role,
        role_permissions,
        user_permissions,
        user_roles,
    )
    from dotmac.platform.user_management.models import (
        BackupCode,
        EmailVerificationToken,
        ProfileChangeHistory,
        Team,
        TeamMember,
        User,
        UserDevice,
    )

    SessionMaker = async_sessionmaker(async_db_engine, expire_on_commit=False)
    async with SessionMaker() as cleanup_session:
        try:
            # Delete associations first (foreign key constraints)
            await cleanup_session.execute(delete(user_permissions))
            await cleanup_session.execute(delete(user_roles))
            await cleanup_session.execute(delete(role_permissions))
            await cleanup_session.execute(delete(PermissionGrant))

            # Delete Permission and Role objects to prevent accumulation
            # Fixtures will recreate what they need for each test
            await cleanup_session.execute(delete(Permission))
            await cleanup_session.execute(delete(Role))

            # Clean user-related tables to prevent UNIQUE constraint conflicts
            await cleanup_session.execute(delete(UserDevice))
            await cleanup_session.execute(delete(TeamMember))
            await cleanup_session.execute(delete(Team))
            await cleanup_session.execute(delete(ProfileChangeHistory))
            await cleanup_session.execute(delete(EmailVerificationToken))
            await cleanup_session.execute(delete(BackupCode))
            await cleanup_session.execute(delete(User))

            await cleanup_session.commit()

            # Flush to ensure changes are written
            await cleanup_session.flush()
        except Exception as e:
            # If cleanup fails, rollback and continue
            # Log the exception for debugging (tests will see this in output)
            print(f"Cleanup failed: {e}")
            await cleanup_session.rollback()
