"""Database fixtures for tests - provides real async database sessions."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

import pytest
import pytest_asyncio

try:
    import sqlalchemy as sa
    from dotmac.platform.db import Base
    from sqlalchemy import event
    from sqlalchemy.orm import Session, sessionmaker
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool

    HAS_SQLALCHEMY = True
except ImportError:
    AsyncSession = object  # Fallback type
    HAS_SQLALCHEMY = False


logger = logging.getLogger(__name__)


if HAS_SQLALCHEMY:
    from tests.fixtures.environment import HAS_DATABASE_BASE, _import_base_and_models

    @pytest.fixture(scope="session")
    def async_db_engine_sync():
        """Create test database engine with synchronous setup.

        Session-scoped to avoid recreating schema for every test.
        PostgreSQL databases must be migrated ahead of time with Alembic.
        SQLite test databases fall back to creating schema from metadata.
        Test isolation is achieved through nested transactions in async sessions.
        """
        default_file_db = os.path.join(
            os.environ.get("PYTEST_TMPDIR", os.getcwd()),
            "test_db.sqlite",
        )
        db_url = os.environ.get(
            "DOTMAC_DATABASE_URL_ASYNC",
            f"sqlite+aiosqlite:///{default_file_db}",
        )

        metadata_base = Base
        if HAS_DATABASE_BASE:
            metadata_base = _import_base_and_models()

        engine = create_async_engine(
            db_url,
            connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
            poolclass=StaticPool if "sqlite" in db_url else None,
            echo=False,
        )

        if "postgresql" in db_url:

            async def verify_connection():
                async with engine.begin() as conn:
                    await conn.execute(sa.text("SELECT 1"))

            try:
                asyncio.run(verify_connection())
            except Exception:  # pragma: no cover - diagnostic path
                logger.exception("PostgreSQL connection failed")
                raise
        else:

            async def create_tables():
                async with engine.begin() as conn:
                    await conn.run_sync(metadata_base.metadata.create_all)

            try:
                asyncio.run(create_tables())
            except Exception:  # pragma: no cover - diagnostic path
                logger.exception("Failed to initialize SQLite schema for tests")
                raise

        yield engine

        async def drop_tables():
            is_postgres = "postgresql" in db_url
            try:
                async with engine.begin() as conn:
                    if not is_postgres:
                        await conn.run_sync(metadata_base.metadata.drop_all, checkfirst=False)
            except Exception:  # pragma: no cover - diagnostic path
                logger.warning("Errors encountered while cleaning up test database", exc_info=True)
            finally:
                await engine.dispose()

        asyncio.run(drop_tables())

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
                restart_listener = None
                try:
                    await session.begin_nested()
                    @event.listens_for(session.sync_session, "after_transaction_end")
                    def restart_savepoint(sess, transaction):
                        if transaction.nested and not transaction._parent.nested:
                            connection.sync_connection.begin_nested()

                    restart_listener = restart_savepoint
                except Exception:  # pragma: no cover - database may not support nested tx
                    logger.debug("Nested transactions unavailable; proceeding without savepoints.")

                try:
                    yield session
                finally:
                    if restart_listener is not None:
                        event.remove(session.sync_session, "after_transaction_end", restart_listener)

                    try:
                        await session.rollback()
                    except Exception:  # pragma: no cover - diagnostic path
                        logger.warning("Error rolling back async session in test fixture", exc_info=True)

                    try:
                        if trans.is_active:
                            await trans.rollback()
                    except Exception:  # pragma: no cover - diagnostic path
                        logger.warning("Error rolling back connection transaction in test fixture", exc_info=True)

    @pytest_asyncio.fixture
    async def async_session(async_db_engine_sync) -> AsyncIterator[AsyncSession]:
        """Create async database session for tests."""
        async with _session_scope(async_db_engine_sync) as session:
            yield session

    @pytest_asyncio.fixture(name="async_db_session")
    async def async_db_session_fixture(async_session: AsyncSession) -> AsyncIterator[AsyncSession]:
        """Backward compatibility alias for async_session fixture."""
        yield async_session

    @pytest.fixture
    def db_session(pytestconfig) -> Session:
        """Provide a synchronous SQLAlchemy session for legacy tests."""
        db_url = getattr(pytestconfig, "db_url_sync", os.environ.get("DOTMAC_DATABASE_URL", "sqlite:///:memory:"))

        metadata_base = Base
        if HAS_DATABASE_BASE:
            metadata_base = _import_base_and_models()

        engine = sa.create_engine(
            db_url,
            connect_args={"check_same_thread": False} if "sqlite" in db_url else {},
            poolclass=StaticPool if "sqlite" in db_url else None,
            future=True,
        )

        created_schema = False
        if "sqlite" in db_url:
            metadata_base.metadata.create_all(engine)
            created_schema = True

        SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, autoflush=False, future=True)
        session = SessionLocal()

        try:
            yield session
        finally:
            try:
                session.close()
            finally:
                if created_schema:
                    metadata_base.metadata.drop_all(engine, checkfirst=False)
                engine.dispose()

    __all__ = ["async_db_engine_sync", "async_db_engine", "async_session", "async_db_session"]
else:
    __all__ = []
