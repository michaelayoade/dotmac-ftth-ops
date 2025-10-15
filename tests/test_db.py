"""Tests for database module."""

from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import pytest
from sqlalchemy import Column, Integer, String

# Import the entire module to ensure coverage tracking
import dotmac.platform.db
from dotmac.platform.db import (
    AuditMixin,
    Base,
    BaseModel,
    SoftDeleteMixin,
    TenantMixin,
    TimestampMixin,
    check_database_health,
    create_all_tables,
    create_all_tables_async,
    drop_all_tables,
    drop_all_tables_async,
    get_async_database_url,
    get_async_db,
    get_async_engine,
    get_async_session,
    get_database_url,
    get_db,
    get_session_dependency,
    get_sync_engine,
    init_db,
)


class TestDatabaseModels:
    """Test database models and mixins."""

    def test_base_model(self):
        """Test BaseModel abstract class."""

        # Create a test model
        class TestModel(BaseModel, Base):
            __tablename__ = "test_model"
            name = Column(String)

        model = TestModel(id=1, name="test")
        assert model.id == 1
        assert model.name == "test"

    def test_timestamp_mixin(self):
        """Test TimestampMixin."""

        class TestTimestamp(TimestampMixin, Base):
            __tablename__ = "test_timestamp"
            id = Column(Integer, primary_key=True)

        model = TestTimestamp()
        assert model.created_at is None  # Will be set by database
        assert model.updated_at is None  # Will be set by database

    def test_soft_delete_mixin(self):
        """Test SoftDeleteMixin."""

        class TestSoftDelete(SoftDeleteMixin, Base):
            __tablename__ = "test_soft_delete"
            id = Column(Integer, primary_key=True)

        model = TestSoftDelete()
        assert model.deleted_at is None
        assert model.is_deleted is False

        # Test soft delete
        now = datetime.now(UTC)
        model.deleted_at = now
        assert model.is_deleted is True

    def test_soft_delete_soft_delete_method(self):
        """Test soft_delete method."""

        class TestDeleteModel(SoftDeleteMixin, Base):
            __tablename__ = "test_delete_method"
            id = Column(Integer, primary_key=True)

        model = TestDeleteModel()
        assert model.deleted_at is None

        model.soft_delete()
        assert model.deleted_at is not None
        assert model.is_deleted is True

    def test_soft_delete_restore_method(self):
        """Test restore method."""

        class TestRestoreModel(SoftDeleteMixin, Base):
            __tablename__ = "test_restore"
            id = Column(Integer, primary_key=True)

        model = TestRestoreModel()
        model.soft_delete()
        assert model.is_deleted is True

        model.restore()
        assert model.deleted_at is None
        assert model.is_deleted is False


class TestDatabaseConnection:
    """Test database connection functions."""

    @patch("dotmac.platform.db.get_database_url")
    @patch("dotmac.platform.db.settings")
    @patch("dotmac.platform.db.create_engine")
    def test_get_sync_engine(self, mock_create_engine, mock_settings, mock_get_database_url):
        """Test get_sync_engine creates engine correctly."""
        # Reset engine state
        import dotmac.platform.db as db_module

        db_module._sync_engine = None

        # Mock the database URL to return PostgreSQL
        mock_get_database_url.return_value = "postgresql://user:pass@localhost/db"

        mock_settings.database.url = "postgresql://user:pass@localhost/db"
        mock_settings.database.pool_size = 5
        mock_settings.database.max_overflow = 10
        mock_settings.database.pool_timeout = 30
        mock_settings.database.pool_recycle = 300
        mock_settings.database.pool_pre_ping = True
        mock_settings.database.echo = False

        mock_engine = MagicMock()
        mock_create_engine.return_value = mock_engine

        # First call creates engine
        engine1 = get_sync_engine()
        assert engine1 == mock_engine
        mock_create_engine.assert_called_once_with(
            "postgresql://user:pass@localhost/db",
            echo=False,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=300,
            pool_pre_ping=True,
        )

        # Second call returns cached engine
        engine2 = get_sync_engine()
        assert engine2 == engine1
        assert mock_create_engine.call_count == 1  # Not called again

    @patch("dotmac.platform.db.get_async_database_url")
    @patch("dotmac.platform.db.settings")
    @patch("dotmac.platform.db.create_async_engine")
    def test_get_async_engine(
        self, mock_create_async_engine, mock_settings, mock_get_async_database_url
    ):
        """Test get_async_engine creates async engine correctly."""
        # Reset engine state
        import dotmac.platform.db as db_module

        db_module._async_engine = None

        # Mock the database URL to return PostgreSQL
        mock_get_async_database_url.return_value = "postgresql+asyncpg://user:pass@localhost/db"

        mock_settings.database.url = "postgresql://user:pass@localhost/db"
        mock_settings.database.async_url = "postgresql+asyncpg://user:pass@localhost/db"
        mock_settings.database.pool_size = 10
        mock_settings.database.max_overflow = 20
        mock_settings.database.pool_timeout = 30
        mock_settings.database.pool_recycle = 600
        mock_settings.database.pool_pre_ping = True
        mock_settings.database.echo = True

        mock_engine = MagicMock()
        mock_create_async_engine.return_value = mock_engine

        engine = get_async_engine()
        assert engine == mock_engine
        mock_create_async_engine.assert_called_once_with(
            "postgresql+asyncpg://user:pass@localhost/db",
            echo=True,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=600,
            pool_pre_ping=True,
        )


class TestDatabaseUrls:
    """Test database URL generation."""

    @patch("dotmac.platform.db.os.getenv")
    @patch("dotmac.platform.db.settings")
    def test_get_database_url_with_url_setting(self, mock_settings, mock_getenv):
        """Test get_database_url when URL is explicitly set."""
        mock_getenv.return_value = None  # No environment override
        mock_settings.database.url = "postgresql://explicit:url@host/db"

        result = get_database_url()
        assert result == "postgresql://explicit:url@host/db"

    @patch("dotmac.platform.db.os.getenv")
    @patch("dotmac.platform.db.settings")
    def test_get_database_url_sqlite_fallback(self, mock_settings, mock_getenv):
        """Test get_database_url falls back to SQLite in development."""
        mock_getenv.return_value = None  # No environment override
        mock_settings.database.url = None
        mock_settings.is_development = True
        mock_settings.database.password = None

        result = get_database_url()
        assert result == "sqlite:///./dotmac_dev.sqlite"

    @patch("dotmac.platform.db.os.getenv")
    @patch("dotmac.platform.db.settings")
    def test_get_database_url_postgresql_components(self, mock_settings, mock_getenv):
        """Test get_database_url builds PostgreSQL URL from components."""
        mock_getenv.return_value = None  # No environment override
        mock_settings.database.url = None
        mock_settings.is_development = False
        mock_settings.database.username = "testuser"
        mock_settings.database.password = "testpass"
        mock_settings.database.host = "testhost"
        mock_settings.database.port = 5432
        mock_settings.database.database = "testdb"

        result = get_database_url()
        assert result == "postgresql://testuser:testpass@testhost:5432/testdb"

    @patch("dotmac.platform.db.os.getenv")
    def test_get_async_database_url_postgresql(self, mock_getenv):
        """Test get_async_database_url converts PostgreSQL to asyncpg."""
        mock_getenv.return_value = None  # No environment override
        with patch(
            "dotmac.platform.db.get_database_url", return_value="postgresql://user:pass@host/db"
        ):
            result = get_async_database_url()
            assert result == "postgresql+asyncpg://user:pass@host/db"

    @patch("dotmac.platform.db.os.getenv")
    def test_get_async_database_url_sqlite(self, mock_getenv):
        """Test get_async_database_url converts SQLite to aiosqlite."""
        mock_getenv.return_value = None  # No environment override
        with patch("dotmac.platform.db.get_database_url", return_value="sqlite:///test.db"):
            result = get_async_database_url()
            assert result == "sqlite+aiosqlite:///test.db"

    @patch("dotmac.platform.db.os.getenv")
    def test_get_async_database_url_other(self, mock_getenv):
        """Test get_async_database_url with other database types."""
        mock_getenv.return_value = None  # No environment override
        with patch("dotmac.platform.db.get_database_url", return_value="mysql://user:pass@host/db"):
            result = get_async_database_url()
            assert result == "mysql://user:pass@host/db"


class TestDatabaseMixins:
    """Test all database mixins."""

    def test_tenant_mixin(self):
        """Test TenantMixin."""

        class TestTenant(TenantMixin, Base):
            __tablename__ = "test_tenant_mixin"
            id = Column(Integer, primary_key=True)

        model = TestTenant()
        model.tenant_id = "tenant123"
        assert model.tenant_id == "tenant123"

    def test_audit_mixin(self):
        """Test AuditMixin."""

        class TestAudit(AuditMixin, Base):
            __tablename__ = "test_audit_mixin"
            id = Column(Integer, primary_key=True)

        model = TestAudit()
        model.created_by = "user123"
        model.updated_by = "user456"
        assert model.created_by == "user123"
        assert model.updated_by == "user456"

    def test_base_model_to_dict(self):
        """Test BaseModel to_dict method."""

        class TestToDictModel(BaseModel, Base):
            __tablename__ = "test_to_dict"
            id = Column(Integer, primary_key=True)
            name = Column(String)

        # Create a mock table with proper columns
        mock_column_id = MagicMock()
        mock_column_id.name = "id"
        mock_column_name = MagicMock()
        mock_column_name.name = "name"

        with patch.object(TestToDictModel, "__table__") as mock_table:
            mock_table.columns = [mock_column_id, mock_column_name]

            model = TestToDictModel()
            # Manually set attributes
            model.id = 1
            model.name = "test"

            result = model.to_dict()
            assert result == {"id": 1, "name": "test"}

    def test_base_model_repr(self):
        """Test BaseModel __repr__ method."""

        class TestReprModel(BaseModel, Base):
            __tablename__ = "test_repr"
            name = Column(String)

        model = TestReprModel(name="test")
        repr_str = repr(model)
        assert "TestReprModel" in repr_str


class TestSessionManagement:
    """Test session management functions."""

    @patch("dotmac.platform.db.SyncSessionLocal")
    def test_get_db_success(self, mock_session_local):
        """Test get_db context manager success case."""
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session

        with get_db() as session:
            assert session == mock_session

        mock_session.commit.assert_called_once()
        mock_session.close.assert_called_once()

    @patch("dotmac.platform.db.SyncSessionLocal")
    def test_get_db_exception(self, mock_session_local):
        """Test get_db context manager exception handling."""
        mock_session = MagicMock()
        mock_session_local.return_value = mock_session

        with pytest.raises(ValueError):
            with get_db():
                raise ValueError("Test exception")

        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()

    @patch("dotmac.platform.db.AsyncSessionLocal")
    @pytest.mark.asyncio
    async def test_get_async_db_success(self, mock_session_local):
        """Test get_async_db async context manager success case."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        mock_session_local.return_value = mock_context()

        async with get_async_db() as session:
            assert session == mock_session

        mock_session.commit.assert_called_once()
        mock_session.close.assert_called_once()

    @patch("dotmac.platform.db.AsyncSessionLocal")
    @pytest.mark.asyncio
    async def test_get_async_db_exception(self, mock_session_local):
        """Test get_async_db async context manager exception handling."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        mock_session_local.return_value = mock_context()

        with pytest.raises(ValueError):
            async with get_async_db():
                raise ValueError("Test exception")

        mock_session.rollback.assert_called_once()

    @patch("dotmac.platform.db._async_session_maker")
    @pytest.mark.asyncio
    async def test_get_async_session(self, mock_session_maker):
        """Test get_async_session dependency function."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        mock_session_maker.return_value = mock_context()

        async_gen = get_async_session()
        session = await async_gen.__anext__()
        assert session == mock_session

    @patch("dotmac.platform.db._async_session_maker")
    @pytest.mark.asyncio
    async def test_get_async_session_exception(self, mock_session_maker):
        """Test get_async_session exception handling."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        mock_session_maker.return_value = mock_context()

        # Use the async generator properly
        try:
            async_gen = get_async_session()
            await async_gen.__anext__()
            # Raise an exception inside the generator context
            await async_gen.athrow(ValueError("Test exception"))
        except ValueError:
            pass

        # The exception should trigger rollback
        mock_session.rollback.assert_called_once()


class TestSessionDependency:
    """Test get_session_dependency function."""

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_asyncmock(self):
        """Test get_session_dependency with AsyncMock."""
        mock_session = AsyncMock()

        with patch("dotmac.platform.db.get_async_session", return_value=mock_session):
            async for session in get_session_dependency():
                assert session == mock_session
                break

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_async_generator(self):
        """Test get_session_dependency with async generator."""

        async def mock_generator():
            yield AsyncMock()

        with patch("dotmac.platform.db.get_async_session", return_value=mock_generator()):
            session_count = 0
            async for session in get_session_dependency():
                session_count += 1
                assert session is not None
                break
            assert session_count == 1

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_context_manager(self):
        """Test get_session_dependency with context manager."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        with patch("dotmac.platform.db.get_async_session", return_value=mock_context()):
            async for session in get_session_dependency():
                assert session == mock_session
                break

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_awaitable_asyncmock(self):
        """Test get_session_dependency with awaitable AsyncMock."""
        import asyncio

        mock_session = AsyncMock()

        # Create an awaitable that returns the mock session
        async def awaitable_mock():
            await asyncio.sleep(0)  # Make it truly awaitable
            return mock_session

        with patch("dotmac.platform.db.get_async_session", return_value=awaitable_mock()):
            async for session in get_session_dependency():
                assert session == mock_session
                break

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_awaitable_session(self):
        """Test get_session_dependency with plain awaitable session."""
        import asyncio

        mock_session = AsyncMock()

        # Create a plain awaitable that returns a session
        async def get_awaitable_session():
            await asyncio.sleep(0)
            return mock_session

        with patch("dotmac.platform.db.get_async_session", return_value=get_awaitable_session()):
            async for session in get_session_dependency():
                assert session == mock_session
                break

    @pytest.mark.asyncio
    async def test_get_session_dependency_with_plain_session(self):
        """Test get_session_dependency with plain session object."""
        mock_session = Mock()  # Use non-async Mock

        with patch("dotmac.platform.db.get_async_session", return_value=mock_session):
            async for session in get_session_dependency():
                assert session == mock_session
                break


class TestDatabaseOperations:
    """Test database operations."""

    @patch("dotmac.platform.db.Base.metadata")
    @patch("dotmac.platform.db.get_sync_engine")
    def test_create_all_tables(self, mock_get_engine, mock_metadata):
        """Test create_all_tables."""
        mock_engine = MagicMock()
        mock_get_engine.return_value = mock_engine

        create_all_tables()

        mock_metadata.create_all.assert_called_once_with(bind=mock_engine)

    @patch("dotmac.platform.db.Base.metadata")
    @patch("dotmac.platform.db.get_async_engine")
    @pytest.mark.asyncio
    async def test_create_all_tables_async(self, mock_get_engine, mock_metadata):
        """Test create_all_tables_async."""
        mock_engine = Mock()
        mock_conn = AsyncMock()

        # Mock the async context manager properly
        async_context_manager = MagicMock()
        async_context_manager.__aenter__ = AsyncMock(return_value=mock_conn)
        async_context_manager.__aexit__ = AsyncMock(return_value=False)

        mock_engine.begin.return_value = async_context_manager
        mock_get_engine.return_value = mock_engine

        await create_all_tables_async()

        mock_conn.run_sync.assert_called_once_with(mock_metadata.create_all)

    @patch("dotmac.platform.db.Base.metadata")
    @patch("dotmac.platform.db.get_sync_engine")
    def test_drop_all_tables(self, mock_get_engine, mock_metadata):
        """Test drop_all_tables."""
        mock_engine = MagicMock()
        mock_get_engine.return_value = mock_engine

        drop_all_tables()

        mock_metadata.drop_all.assert_called_once_with(bind=mock_engine)

    @patch("dotmac.platform.db.Base.metadata")
    @patch("dotmac.platform.db.get_async_engine")
    @pytest.mark.asyncio
    async def test_drop_all_tables_async(self, mock_get_engine, mock_metadata):
        """Test drop_all_tables_async."""
        mock_engine = Mock()
        mock_conn = AsyncMock()

        # Mock the async context manager properly
        async_context_manager = MagicMock()
        async_context_manager.__aenter__ = AsyncMock(return_value=mock_conn)
        async_context_manager.__aexit__ = AsyncMock(return_value=False)

        mock_engine.begin.return_value = async_context_manager
        mock_get_engine.return_value = mock_engine

        await drop_all_tables_async()

        mock_conn.run_sync.assert_called_once_with(mock_metadata.drop_all)

    def test_init_db(self):
        """Test init_db function."""
        with patch("dotmac.platform.db.create_all_tables") as mock_create:
            init_db()
            mock_create.assert_called_once()


class TestHealthCheck:
    """Test database health check."""

    @patch("dotmac.platform.db.get_async_db")
    @pytest.mark.asyncio
    async def test_check_database_health_success(self, mock_get_async_db):
        """Test successful database health check."""
        mock_session = AsyncMock()

        @asynccontextmanager
        async def mock_context():
            yield mock_session

        mock_get_async_db.return_value = mock_context()

        result = await check_database_health()
        assert result is True
        mock_session.execute.assert_called_once()

    @patch("dotmac.platform.db.get_async_db")
    @pytest.mark.asyncio
    async def test_check_database_health_failure(self, mock_get_async_db):
        """Test failed database health check."""
        mock_get_async_db.side_effect = Exception("Database error")

        result = await check_database_health()
        assert result is False


class TestModuleExports:
    """Test module exports."""

    def test_all_exports_available(self):
        """Test that all __all__ exports are available."""
        expected_exports = [
            "Base",
            "BaseModel",
            "TimestampMixin",
            "TenantMixin",
            "SoftDeleteMixin",
            "AuditMixin",
            "get_db",
            "get_async_db",
            "get_async_session",
            "get_database_session",
            "get_db_session",
            "get_async_db_session",
            "get_session",
            "get_sync_engine",
            "get_async_engine",
            "SyncSessionLocal",
            "AsyncSessionLocal",
            "create_all_tables",
            "create_all_tables_async",
            "drop_all_tables",
            "drop_all_tables_async",
            "check_database_health",
            "init_db",
        ]

        for export_name in expected_exports:
            assert hasattr(dotmac.platform.db, export_name), f"Missing export: {export_name}"

    def test_legacy_aliases(self):
        """Test legacy function aliases."""
        from dotmac.platform.db import (
            get_async_db_session,
            get_database_session,
            get_db_session,
            get_session,
        )

        # Test that aliases are callable
        assert callable(get_database_session)
        assert callable(get_db_session)
        assert callable(get_async_db_session)
        assert callable(get_session)
