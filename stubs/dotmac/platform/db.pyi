from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session, sessionmaker


class DatabaseState:
    sync_engine: Any
    async_engine: Any
    sync_session_factory: sessionmaker[Any]
    async_session_factory: sessionmaker[Any]
    async_session_maker: sessionmaker[Any]


def get_database_url() -> str: ...


def get_async_database_url() -> str: ...


def configure_database_for_testing(
    *,
    sync_engine: Any | None = ...,
    async_engine: Any | None = ...,
    sync_session_factory: sessionmaker[Any] | None = ...,
    async_session_factory: sessionmaker[Any] | None = ...,
) -> None: ...


def snapshot_database_state() -> DatabaseState: ...


def restore_database_state(state: DatabaseState) -> None: ...
