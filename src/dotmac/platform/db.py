"""
SQLAlchemy 2.0 Database Configuration

Simple, standard SQLAlchemy setup replacing the custom database module.
"""

import importlib
import inspect
import os
from collections.abc import AsyncIterator, Callable, Iterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock
from urllib.parse import quote_plus
from uuid import UUID, uuid4

import structlog
from sqlalchemy import CHAR, Boolean, DateTime, String, TypeDecorator, create_engine
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.engine import Dialect, make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.type_api import TypeEngine

from dotmac.platform.settings import settings

logger = structlog.get_logger(__name__)


# ==========================================
# Cross-Database UUID Type
# ==========================================


class GUID(TypeDecorator[UUID]):
    """Platform-independent GUID type.

    Uses PostgreSQL's UUID type when available, otherwise uses CHAR(36)
    storing as stringified hex values for SQLite compatibility.
    """

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect) -> TypeEngine[Any]:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PostgresUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value: UUID | str | None, dialect: Dialect) -> str | None:
        if value is None:
            return None
        if isinstance(value, UUID):
            return str(value)
        return str(UUID(str(value)))

    def process_result_value(self, value: Any, dialect: Dialect) -> UUID | None:
        if value is None:
            return None
        if isinstance(value, UUID):
            return value
        return UUID(str(value))


# ==========================================
# Database URLs from settings
# ==========================================


def get_database_url() -> str:
    """Get the sync database URL from settings."""
    override_url = os.getenv("DOTMAC_DATABASE_URL")
    if override_url:
        return override_url

    legacy_env_url = os.getenv("DATABASE_URL")
    if legacy_env_url:
        return legacy_env_url

    if settings.database.url:
        return str(settings.database.url)

    # In development, use SQLite if PostgreSQL is not configured
    if settings.is_development and not settings.database.password:
        return "sqlite:///./dotmac_dev.sqlite"

    # Build PostgreSQL URL from components with proper encoding
    # URL-encode password to handle special characters safely
    username = quote_plus(settings.database.username)
    password = quote_plus(settings.database.password) if settings.database.password else ""
    host = settings.database.host
    port = settings.database.port
    database = settings.database.database

    return f"postgresql://{username}:{password}@{host}:{port}/{database}"


def get_async_database_url() -> str:
    """Get the async database URL from settings."""
    override_url = os.getenv("DOTMAC_DATABASE_URL_ASYNC")
    if override_url:
        return override_url

    sync_url = get_database_url()
    # Convert to async driver
    if "postgresql://" in sync_url:
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")
    elif "sqlite://" in sync_url:
        return sync_url.replace("sqlite://", "sqlite+aiosqlite://")
    return sync_url


# ==========================================
# SQLAlchemy 2.0 Declarative Base
# ==========================================


class Base(DeclarativeBase):  # DeclarativeBase resolves to Any in isolation
    """Base class for all database models using SQLAlchemy 2.0 declarative mapping."""

    pass


# ==========================================
# Common Mixins (Optional, can be used by models)
# ==========================================
#
# IMPORTANT: Tenant Isolation Guidelines
# - Use StrictTenantMixin for user data, billing, secrets, etc.
# - Use TenantMixin only for system/shared resources
# - Always filter by tenant_id in queries for tenant-isolated models
# ==========================================


class TimestampMixin:
    """Adds created_at and updated_at timestamps to models."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )


class TenantMixin:
    """Adds tenant_id for multi-tenancy support (optional tenant)."""

    tenant_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)


class StrictTenantMixin:
    """Adds tenant_id for strict multi-tenancy (required tenant).

    Use this mixin for models that MUST have tenant isolation.
    Records without a tenant_id will be rejected.
    """

    tenant_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)


class SoftDeleteMixin:
    """Adds soft delete support."""

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def is_deleted(self) -> bool:
        """Check if the record is soft deleted."""
        return self.deleted_at is not None

    def soft_delete(self) -> None:
        """Mark this record as soft deleted."""
        self.deleted_at = datetime.now(UTC)
        # Note: is_active is typically a computed property, don't set it here

    def restore(self) -> None:
        """Restore this record from soft deletion."""
        self.deleted_at = None
        # Note: is_active is typically a computed property, don't set it here


class AuditMixin:
    """Adds audit trail fields."""

    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(255), nullable=True)


# ==========================================
# Legacy Compatibility BaseModel
# ==========================================


class BaseModel(Base):
    """Legacy compatibility model for existing code."""

    __abstract__ = True

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    tenant_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def to_dict(self) -> dict[str, Any]:
        """Convert model to dictionary."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}

    def __repr__(self) -> str:
        return f"<{self.__class__.__name__}({self.__dict__})>"


# ==========================================
# Engine and Session Management
# ==========================================

# Create engines (lazy initialization)
_sync_engine = None
_async_engine = None


def get_sync_engine() -> Any:
    """Get or create the synchronous engine."""
    global _sync_engine
    if _sync_engine is None:
        database_url = get_database_url()
        url = make_url(database_url)
        if url.get_backend_name().startswith("sqlite"):
            connect_args: dict[str, Any] = {}
            if database_url.startswith("sqlite"):
                connect_args["check_same_thread"] = False
            _sync_engine = create_engine(
                database_url,
                connect_args=connect_args,
                poolclass=StaticPool,
            )
        else:
            _sync_engine = create_engine(
                database_url,
                echo=settings.database.echo,
                pool_size=settings.database.pool_size,
                max_overflow=settings.database.max_overflow,
                pool_timeout=settings.database.pool_timeout,
                pool_recycle=settings.database.pool_recycle,
                pool_pre_ping=settings.database.pool_pre_ping,
            )
    return _sync_engine


def get_async_engine() -> Any:
    """Get or create the asynchronous engine."""
    global _async_engine
    if _async_engine is None:
        async_url = get_async_database_url()
        url = make_url(async_url)
        if url.get_backend_name().startswith("sqlite"):
            connect_args: dict[str, Any] = {}
            if async_url.startswith("sqlite"):
                connect_args["check_same_thread"] = False
            _async_engine = create_async_engine(
                async_url,
                connect_args=connect_args,
                poolclass=StaticPool,
            )
        else:
            _async_engine = create_async_engine(
                async_url,
                echo=settings.database.echo,
                pool_size=settings.database.pool_size,
                max_overflow=settings.database.max_overflow,
                pool_timeout=settings.database.pool_timeout,
                pool_recycle=settings.database.pool_recycle,
                pool_pre_ping=settings.database.pool_pre_ping,
            )
    return _async_engine


# Session factories


class _LazySessionmaker(sessionmaker[Any]):
    """Sessionmaker that lazily binds to the engine on first use."""

    def __init__(self, engine_getter: Callable[[], Any], *args: Any, **kwargs: Any) -> None:
        self._engine_getter = engine_getter
        super().__init__(*args, **kwargs)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:  # noqa: D401 - inherits docstring
        engine = self._engine_getter()
        if self.kw.get("bind") is not engine:
            self.configure(bind=engine)
        return super().__call__(*args, **kwargs)


SyncSessionLocal: sessionmaker[Any] = _LazySessionmaker(
    get_sync_engine,
    autocommit=False,
    autoflush=False,
    class_=Session,
)

AsyncSessionLocal: sessionmaker[Any] = _LazySessionmaker(
    get_async_engine,
    autocommit=False,
    autoflush=False,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Global variable to hold the session maker (can be overridden for testing)
_async_session_maker: sessionmaker[Any] = AsyncSessionLocal
async_session_maker: sessionmaker[Any] = _async_session_maker


@dataclass(frozen=True)
class DatabaseState:
    """Serializable snapshot of database wiring for temporary overrides."""

    sync_engine: Any
    async_engine: Any
    sync_session_factory: sessionmaker[Any]
    async_session_factory: sessionmaker[Any]
    async_session_maker: sessionmaker[Any]


def snapshot_database_state() -> DatabaseState:
    """Capture the current database engines and session factories."""

    return DatabaseState(
        sync_engine=_sync_engine,
        async_engine=_async_engine,
        sync_session_factory=SyncSessionLocal,
        async_session_factory=AsyncSessionLocal,
        async_session_maker=_async_session_maker,
    )


def restore_database_state(state: DatabaseState) -> None:
    """Restore database wiring to a previously captured snapshot."""

    global \
        _sync_engine, \
        _async_engine, \
        SyncSessionLocal, \
        AsyncSessionLocal, \
        _async_session_maker, \
        async_session_maker

    _sync_engine = state.sync_engine
    _async_engine = state.async_engine
    SyncSessionLocal = state.sync_session_factory
    AsyncSessionLocal = state.async_session_factory
    _async_session_maker = state.async_session_maker
    async_session_maker = _async_session_maker


def configure_database_for_testing(
    *,
    sync_engine: Any | None = None,
    async_engine: Any | None = None,
    sync_session_factory: sessionmaker[Any] | None = None,
    async_session_factory: sessionmaker[Any] | None = None,
) -> None:
    """Override engines or session factories for test scenarios."""

    global \
        _sync_engine, \
        _async_engine, \
        SyncSessionLocal, \
        AsyncSessionLocal, \
        _async_session_maker, \
        async_session_maker

    if sync_engine is not None:
        _sync_engine = sync_engine

    if async_engine is not None:
        _async_engine = async_engine

    if sync_session_factory is not None:
        SyncSessionLocal = sync_session_factory

    if async_session_factory is not None:
        AsyncSessionLocal = async_session_factory
        _async_session_maker = async_session_factory
        async_session_maker = _async_session_maker


# ==========================================
# Session Context Managers
# ==========================================


@contextmanager
def get_db() -> Iterator[Session]:
    """Get a synchronous database session."""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@asynccontextmanager
async def get_async_db() -> AsyncIterator[AsyncSession]:
    """Get an asynchronous database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_async_session_context() -> AsyncIterator[AsyncSession]:
    """Context manager alias for acquiring an async session (legacy helper)."""
    async with _async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_async_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency for getting an async database session."""
    async with _async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_rls_session(request: Any = None) -> AsyncIterator[AsyncSession]:
    """
    FastAPI dependency for getting an RLS-aware async database session.

    This dependency automatically sets PostgreSQL session variables for
    Row-Level Security based on the context stored in request.state by
    the RLS middleware.

    Args:
        request: FastAPI Request object (injected automatically)

    Yields:
        AsyncSession with RLS context applied
    """
    from sqlalchemy import text

    async with _async_session_maker() as session:
        try:
            # Set RLS context from request state if available
            if request and hasattr(request, "state"):
                tenant_id = getattr(request.state, "rls_tenant_id", None)
                is_superuser = getattr(request.state, "rls_is_superuser", False)
                bypass_rls = getattr(request.state, "rls_bypass", False)

                # Set PostgreSQL session variables
                if tenant_id:
                    await session.execute(
                        text("SET LOCAL app.current_tenant_id = :tenant_id"),
                        {"tenant_id": tenant_id},
                    )

                await session.execute(
                    text("SET LOCAL app.is_superuser = :is_superuser"),
                    {"is_superuser": str(is_superuser).lower()},
                )

                await session.execute(
                    text("SET LOCAL app.bypass_rls = :bypass_rls"),
                    {"bypass_rls": str(bypass_rls).lower()},
                )

                await session.commit()

            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_session_dependency() -> AsyncIterator[AsyncSession]:
    """Compatibility wrapper that yields a session and remains easy to patch in tests."""

    session_source: Any = get_async_session()

    if isinstance(session_source, AsyncMock):
        # When get_async_session() returns an AsyncMock directly, use it
        # Don't call it again as that creates a new mock instance
        if inspect.isawaitable(session_source):
            yield await session_source
        else:
            yield session_source
        return

    if inspect.isasyncgen(session_source):
        async for session in session_source:
            yield session
        return

    if hasattr(session_source, "__aenter__") and hasattr(session_source, "__aexit__"):
        async with session_source as session:
            yield session
        return

    if inspect.isawaitable(session_source):
        session = await session_source
    else:
        session = session_source

    yield session


# ==========================================
# Aliases for compatibility
# ==========================================

# Legacy function names that might be used in the codebase
get_database_session = get_db
get_db_session = get_async_db
get_async_db_session = get_async_db
get_session = get_async_db


# ==========================================
# Database Initialization
# ==========================================


def _safe_import(module_path: str, context: str | None = None) -> None:
    """Import a module and log (without raising) if it fails."""
    try:
        importlib.import_module(module_path)
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning(
            "database.model_import_failed",
            module=module_path,
            context=context,
            error=str(exc),
        )


def _ensure_model_registry_loaded() -> None:
    """Import model modules so Base metadata is complete."""
    _safe_import("dotmac.platform.models", context="core platform models")

    # Project management tables (independent modules so we can log failures per file)
    _safe_import(
        "dotmac.platform.project_management.models",
        context="project/task models",
    )
    _safe_import(
        "dotmac.platform.project_management.resource_models",
        context="project resource models",
    )
    _safe_import(
        "dotmac.platform.project_management.time_tracking_models",
        context="project time tracking models",
    )

    # Field service tables (technicians, availability, etc.)
    _safe_import(
        "dotmac.platform.field_service.models",
        context="technician models",
    )


def create_all_tables() -> None:
    """Create all tables in the database."""
    _ensure_model_registry_loaded()
    Base.metadata.create_all(bind=get_sync_engine(), checkfirst=True)


async def create_all_tables_async() -> None:
    """Create all tables in the database asynchronously."""
    _ensure_model_registry_loaded()
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(
            lambda sync_conn: Base.metadata.create_all(bind=sync_conn, checkfirst=True)
        )


def drop_all_tables() -> None:
    """Drop all tables from the database. Use with caution!"""
    Base.metadata.drop_all(bind=get_sync_engine())


async def drop_all_tables_async() -> None:
    """Drop all tables from the database asynchronously. Use with caution!"""
    engine = get_async_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def _ensure_billing_products_constraints() -> None:
    """Ensure legacy billing_products tables have required unique constraints."""
    engine = get_sync_engine()

    # SQLite doesn't support adding named constraints in this manner.
    if engine.dialect.name.startswith("sqlite"):
        return

    try:
        from sqlalchemy import inspect as sa_inspect
        from sqlalchemy import text as sa_text
    except ImportError:
        return

    inspector = sa_inspect(engine)
    if "billing_products" not in inspector.get_table_names():
        return

    existing_uniques = {
        constraint["name"] for constraint in inspector.get_unique_constraints("billing_products")
    }

    statements: list[str] = []
    if "uq_billing_products_product_id" not in existing_uniques:
        statements.append(
            "ALTER TABLE billing_products "
            "ADD CONSTRAINT uq_billing_products_product_id UNIQUE (product_id)"
        )
    if "uq_billing_products_tenant_product" not in existing_uniques:
        statements.append(
            "ALTER TABLE billing_products "
            "ADD CONSTRAINT uq_billing_products_tenant_product UNIQUE (tenant_id, product_id)"
        )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(sa_text(statement))


# ==========================================
# Health Check
# ==========================================


async def check_database_health() -> bool:
    """Check if the database is accessible."""
    from sqlalchemy import text

    try:
        async with get_async_db() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def init_db() -> None:
    """Initialize the database (create tables if needed)."""
    engine = get_sync_engine()

    if engine.dialect.name == "sqlite":
        create_all_tables()
        return

    try:
        from sqlalchemy import inspect as sa_inspect
    except ImportError:
        logger.warning(
            "database.migrations.required",
            message="SQLAlchemy inspector unavailable; ensure migrations have been applied.",
        )
        return

    inspector = sa_inspect(engine)
    if not inspector.get_table_names():
        logger.warning(
            "database.migrations.required",
            message="No tables found; run Alembic migrations before starting the service.",
        )
        return

    _ensure_billing_products_constraints()


# ==========================================
# Exports
# ==========================================

__all__ = [
    # Base classes
    "Base",
    "BaseModel",  # For legacy compatibility
    # Mixins
    "TimestampMixin",
    "TenantMixin",
    "StrictTenantMixin",
    "SoftDeleteMixin",
    "AuditMixin",
    # Session management
    "get_db",
    "get_async_db",
    "get_async_session_context",
    "get_async_session",  # FastAPI dependency
    "get_database_session",  # Legacy alias
    "get_db_session",  # Legacy alias
    "get_async_db_session",  # Legacy alias
    "get_session",  # Legacy alias
    # Engines
    "get_sync_engine",
    "get_async_engine",
    # Session factories
    "SyncSessionLocal",
    "AsyncSessionLocal",
    "async_session_maker",
    "DatabaseState",
    "snapshot_database_state",
    "restore_database_state",
    "configure_database_for_testing",
    # Database operations
    "get_database_url",
    "get_async_database_url",
    "create_all_tables",
    "create_all_tables_async",
    "drop_all_tables",
    "drop_all_tables_async",
    "check_database_health",
    "init_db",
]
