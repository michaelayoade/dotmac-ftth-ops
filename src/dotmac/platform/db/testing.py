"""
Utilities for isolating database access during tests.

The helpers in this module provide opt-in overrides that swap the global
database engines and session factories with lightweight in-memory variants.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Iterable, Iterator
from contextlib import asynccontextmanager, contextmanager
from dataclasses import dataclass, field
from types import TracebackType
from typing import Any, Protocol, cast

from sqlalchemy import create_engine
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from dotmac.platform import db as db_module


class _DatabaseModule(Protocol):
    def get_database_url(self) -> str: ...

    def get_async_database_url(self) -> str: ...

    def snapshot_database_state(self) -> Any: ...

    def configure_database_for_testing(
        self,
        *,
        sync_engine: Any,
        async_engine: Any,
        sync_session_factory: sessionmaker[Session],
        async_session_factory: async_sessionmaker[AsyncSession],
    ) -> None: ...

    def restore_database_state(self, state: Any) -> None: ...


db_module_typed = cast(_DatabaseModule, db_module)

SyncSessionFactory = sessionmaker[Session]
AsyncSessionFactory = async_sessionmaker[AsyncSession]

_get_database_url: Callable[[], str] = db_module_typed.get_database_url
_get_async_database_url: Callable[[], str] = db_module_typed.get_async_database_url
_snapshot_database_state: Callable[[], Any] = db_module_typed.snapshot_database_state
_configure_database_for_testing: Callable[..., None] = (
    db_module_typed.configure_database_for_testing
)
_restore_database_state: Callable[[Any], None] = db_module_typed.restore_database_state


def _resolve_sync_url(requested_url: str | None) -> str:
    if requested_url:
        return requested_url
    return _get_database_url()


def _resolve_async_url(sync_url: str, requested_async_url: str | None) -> str:
    if requested_async_url:
        return requested_async_url
    if sync_url.startswith("postgresql+asyncpg://") or sync_url.startswith("sqlite+aiosqlite://"):
        return sync_url
    if sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if sync_url.startswith("sqlite://"):
        return sync_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return _get_async_database_url()


def _sqlite_connect_args(url: URL | None) -> dict[str, Any]:
    if url is None or not url.get_backend_name().startswith("sqlite"):
        return {}
    return {"check_same_thread": False}


def _build_sync_engine(url: str, *, echo: bool, extra_args: dict[str, Any]) -> Any:
    url_obj = make_url(url)
    connect_args = {**_sqlite_connect_args(url_obj), **extra_args.get("connect_args", {})}
    engine_kwargs: dict[str, Any] = {"echo": echo, **extra_args}
    if connect_args:
        engine_kwargs["connect_args"] = connect_args
    if url_obj.get_backend_name().startswith("sqlite"):
        engine_kwargs.setdefault("poolclass", StaticPool)
    return create_engine(url, **engine_kwargs)


def _build_async_engine(url: str, *, echo: bool, extra_args: dict[str, Any]) -> AsyncEngine:
    url_obj = make_url(url)
    connect_args = {**_sqlite_connect_args(url_obj), **extra_args.get("connect_args", {})}
    engine_kwargs: dict[str, Any] = {"echo": echo, **extra_args}
    if connect_args:
        engine_kwargs["connect_args"] = connect_args
    if url_obj.get_backend_name().startswith("sqlite"):
        engine_kwargs.setdefault("poolclass", StaticPool)
    return create_async_engine(url, **engine_kwargs)


@dataclass
class DatabaseTestContext:
    """Context manager that rebinds global database state to test-friendly engines."""

    sync_url: str | None = None
    async_url: str | None = None
    metadata_bases: Iterable[type[DeclarativeBase]] = field(default_factory=lambda: [])
    echo: bool = False
    sync_engine_kwargs: dict[str, Any] = field(default_factory=dict)
    async_engine_kwargs: dict[str, Any] = field(default_factory=dict)

    _snapshot: Any | None = field(init=False, default=None)
    _sync_engine: Any = field(init=False, default=None)
    _async_engine: AsyncEngine | None = field(init=False, default=None)
    sync_session_factory: SyncSessionFactory | None = field(init=False, default=None)
    async_session_factory: AsyncSessionFactory | None = field(init=False, default=None)

    def __enter__(self) -> DatabaseTestContext:
        sync_url = _resolve_sync_url(self.sync_url)
        async_url = _resolve_async_url(sync_url, self.async_url)

        self._snapshot = _snapshot_database_state()
        self._sync_engine = _build_sync_engine(
            sync_url, echo=self.echo, extra_args=self.sync_engine_kwargs
        )
        self._async_engine = _build_async_engine(
            async_url, echo=self.echo, extra_args=self.async_engine_kwargs
        )

        self.sync_session_factory = sessionmaker(
            bind=self._sync_engine, class_=Session, autoflush=False
        )
        self.async_session_factory = async_sessionmaker(
            bind=self._async_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )

        _configure_database_for_testing(
            sync_engine=self._sync_engine,
            async_engine=self._async_engine,
            sync_session_factory=self.sync_session_factory,
            async_session_factory=self.async_session_factory,
        )

        for base in self.metadata_bases:
            base.metadata.create_all(bind=self._sync_engine, checkfirst=True)

        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        try:
            for base in self.metadata_bases:
                base.metadata.drop_all(bind=self._sync_engine, checkfirst=True)
        finally:
            if self._snapshot is not None:
                _restore_database_state(self._snapshot)
            if self._sync_engine is not None:
                self._sync_engine.dispose()
            if self._async_engine is not None:
                self._async_engine.sync_engine.dispose()

    @contextmanager
    def sync_session(self) -> Iterator[Session]:
        if self.sync_session_factory is None:
            raise RuntimeError("DatabaseTestContext must be entered before requesting sessions.")
        session = self.sync_session_factory()
        try:
            yield session
        finally:
            session.close()

    @asynccontextmanager
    async def async_session(self) -> AsyncIterator[AsyncSession]:
        if self.async_session_factory is None:
            raise RuntimeError("DatabaseTestContext must be entered before requesting sessions.")
        async with self.async_session_factory() as session:
            yield session

    async def aclose(self) -> None:
        """Ensure async resources are disposed when tests need explicit cleanup."""
        if self._async_engine is not None:
            await self._async_engine.dispose()
        if self._sync_engine is not None:
            self._sync_engine.dispose()


@contextmanager
def override_database_for_tests(**kwargs: Any) -> Iterator[DatabaseTestContext]:
    """Shorthand wrapper that yields a :class:`DatabaseTestContext`."""

    context = DatabaseTestContext(**kwargs)
    with context:
        yield context


async def dispose_async_context(context: DatabaseTestContext) -> None:
    """Helper to dispose async engine when context was used in sync mode."""
    await context.aclose()


__all__ = [
    "DatabaseTestContext",
    "override_database_for_tests",
    "dispose_async_context",
]
