"""Database fixtures for tests - provides real async database sessions."""

import asyncio
import os
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from typing import AsyncIterator

try:
    import sqlalchemy as sa
    from sqlalchemy import event
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool
    from dotmac.platform.db import Base
    from alembic.config import Config
    from alembic import command
    HAS_SQLALCHEMY = True
except ImportError:
    AsyncSession = object  # Fallback type
    HAS_SQLALCHEMY = False


if HAS_SQLALCHEMY:
    from tests.fixtures.environment import HAS_DATABASE_BASE, _import_base_and_models

    @pytest.fixture(scope="session")
    def async_db_engine_sync():
        """Create test database engine with synchronous setup.

        Session-scoped to avoid recreating schema for every test.
        Uses Alembic migrations to create schema (not Base.metadata.create_all).
        This ensures enums have correct lowercase values matching Python code.
        Test isolation is achieved through nested transactions in async_db_session.
        """
        # Use configured test database URL or default to in-memory
        db_url = os.environ.get("DOTMAC_DATABASE_URL_ASYNC", "sqlite+aiosqlite:///:memory:")

        metadata_base = Base
        if HAS_DATABASE_BASE:
            metadata_base = _import_base_and_models()

        engine = create_async_engine(
            db_url,
            connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
            poolclass=StaticPool if "sqlite" in db_url else None,
            echo=False,
        )

        # For PostgreSQL: Skip schema creation - assume database is already migrated
        # For SQLite in-memory: Create schema using migrations or metadata
        if "postgresql" in db_url:
            # PostgreSQL database should already be migrated via `alembic upgrade head`
            # Just verify connection works
            async def verify_connection():
                async with engine.begin() as conn:
                    await conn.execute(sa.text("SELECT 1"))

            try:
                asyncio.run(verify_connection())
            except Exception as e:
                print(f"PostgreSQL connection failed: {e}")
                raise
        else:
            # SQLite in-memory: Create schema using Base.metadata
            async def create_tables():
                async with engine.begin() as conn:
                    await conn.run_sync(metadata_base.metadata.create_all)

            asyncio.run(create_tables())

        yield engine

        # Cleanup once at session end (synchronously)
        async def drop_tables():
            is_postgres = "postgresql" in db_url
            try:
                async with engine.begin() as conn:
                    if not is_postgres:
                        await conn.run_sync(metadata_base.metadata.drop_all, checkfirst=False)
            except Exception:
                # Ignore errors during cleanup (may not matter if session is ending)
                pass
            finally:
                await engine.dispose()

        asyncio.run(drop_tables())


    # Backward compatibility alias
    @pytest.fixture(scope="session")
    def async_db_engine(async_db_engine_sync):
        """Backward compatibility alias for async_db_engine_sync."""
        return async_db_engine_sync


    @asynccontextmanager
    async def _session_scope(engine):
        """Yield a session wrapped in an outer transaction with savepoint support."""
        async with engine.connect() as connection:
            trans = await connection.begin()
            session_factory = async_sessionmaker(
                bind=connection,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=False,
            )
            async with session_factory() as session:
                nested = None
                restart_listener = None
                try:
                    nested = await connection.begin_nested()
                except Exception:
                    nested = None

                if nested is not None:

                    def restart_savepoint(sess, transaction):
                        if transaction.nested and not transaction._parent.nested:
                            connection.sync_connection.begin_nested()

                    restart_listener = restart_savepoint
                    event.listen(session.sync_session, "after_transaction_end", restart_savepoint)

                try:
                    yield session
                finally:
                    if nested is not None and restart_listener is not None:
                        event.remove(session.sync_session, "after_transaction_end", restart_listener)
                        try:
                            if nested.is_active:
                                await nested.rollback()
                        except Exception:
                            pass
                    else:
                        # Nested transactions unsupported; ensure session rolls back any active tx
                        try:
                            if session.in_transaction():
                                await session.rollback()
                        except Exception:
                            pass

                    try:
                        if trans.is_active:
                            await trans.rollback()
                    except Exception:
                        pass

                    await asyncio.sleep(0)


    @pytest_asyncio.fixture
    async def async_session(async_db_engine_sync):
        """Create async database session for tests."""
        async with _session_scope(async_db_engine_sync) as session:
            yield session


    @pytest_asyncio.fixture
    async def async_db_session(async_db_engine_sync) -> AsyncIterator[AsyncSession]:
        """Async database session with transaction isolation."""
        async with _session_scope(async_db_engine_sync) as session:
            yield session


    __all__ = ["async_db_engine_sync", "async_db_engine", "async_session", "async_db_session"]
else:
    # Fallback when SQLAlchemy not available
    __all__ = []
