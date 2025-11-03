"""Type stubs for dotmac.platform.db module."""

from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import TypeDecorator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, sessionmaker

# Cross-Database UUID Type
class GUID(TypeDecorator): ...

# Base classes
class Base(DeclarativeBase): ...

class BaseModel(Base):
    id: Mapped[UUID]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

# Mixins
class TimestampMixin:
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]

class TenantMixin:
    tenant_id: Mapped[str]

class StrictTenantMixin:
    tenant_id: Mapped[str]

class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None]
    is_deleted: Mapped[bool]

class AuditMixin:
    created_by: Mapped[str | None]
    updated_by: Mapped[str | None]

# Database URLs
def get_database_url() -> str: ...
def get_async_database_url() -> str: ...

# Engines
def get_sync_engine() -> Any: ...
def get_async_engine() -> Any: ...

# Session factories
SyncSessionLocal: sessionmaker[Session]
AsyncSessionLocal: sessionmaker[AsyncSession]
async_session_maker: sessionmaker[AsyncSession]

# Session management
def get_db() -> Iterator[Session]: ...
def get_async_db() -> AsyncIterator[AsyncSession]: ...
async def get_async_session_context() -> AsyncIterator[AsyncSession]: ...
async def get_async_session() -> AsyncIterator[AsyncSession]: ...
async def get_database_session() -> AsyncIterator[AsyncSession]: ...
async def get_db_session() -> AsyncIterator[AsyncSession]: ...
async def get_async_db_session() -> AsyncIterator[AsyncSession]: ...
async def get_session() -> AsyncIterator[AsyncSession]: ...

# Database state
@dataclass
class DatabaseState:
    engine_disposed: bool
    async_engine_disposed: bool
    tables_dropped: bool

def snapshot_database_state() -> DatabaseState: ...
def restore_database_state(state: DatabaseState) -> None: ...
def configure_database_for_testing(
    use_sqlite: bool = False,
    database_url: str | None = None,
) -> None: ...

# Database operations
def create_all_tables() -> None: ...
async def create_all_tables_async() -> None: ...
def drop_all_tables() -> None: ...
async def drop_all_tables_async() -> None: ...
async def check_database_health() -> dict[str, Any]: ...
def init_db() -> None: ...
