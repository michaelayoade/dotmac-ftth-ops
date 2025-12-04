"""
Database utility package exposing shared SQLAlchemy helpers.

This package wraps the legacy ``dotmac.platform.db`` module and augments it
with reusable compatibility types while keeping import semantics identical for
existing code (``from dotmac.platform.db import Base`` etc.).
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator
    from typing import Any

    from sqlalchemy.engine import Engine
    from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
    from sqlalchemy.orm import DeclarativeBase, Session

    # Type hints for exported symbols - these are defined in the stub file
    # but we need minimal declarations here for proper resolution
    Base: Any
    BaseModel: Any
    TimestampMixin: Any
    TenantMixin: Any
    SoftDeleteMixin: Any
    AuditMixin: Any
    get_db: Any
    get_async_db: Any
    get_async_session: Any
    get_async_session_context: Any
    get_database_session: Any
    get_db_session: Any
    get_async_db_session: Any
    get_session: Any
    get_session_dependency: Any
    get_sync_engine: Any
    get_async_engine: Any
    get_async_database_url: Any
    SyncSessionLocal: Any
    AsyncSessionLocal: Any
    async_session_maker: Any
    DatabaseState: Any
    snapshot_database_state: Any
    restore_database_state: Any
    configure_database_for_testing: Any
    create_all_tables: Any
    create_all_tables_async: Any
    drop_all_tables: Any
    drop_all_tables_async: Any
    check_database_health: Any
    init_db: Any
    GUID: Any

# ---------------------------------------------------------------------------
# Load legacy db.py implementation under a private module name
# ---------------------------------------------------------------------------

_LEGACY_MODULE_NAME = "dotmac.platform._db_legacy"
_LEGACY_PATH = Path(__file__).resolve().parent.parent / "db.py"

_LEGACY_SPEC = importlib.util.spec_from_file_location(
    _LEGACY_MODULE_NAME,
    _LEGACY_PATH,
)

if _LEGACY_SPEC is None or _LEGACY_SPEC.loader is None:
    msg = f"Unable to load legacy database module from {_LEGACY_PATH}"
    raise ImportError(msg)

_legacy_module = importlib.util.module_from_spec(_LEGACY_SPEC)
sys.modules.setdefault(_LEGACY_MODULE_NAME, _legacy_module)
_LEGACY_SPEC.loader.exec_module(_legacy_module)  # type: ignore[assignment]

# Re-export legacy symbols (keeping public API identical)
for _name in dir(_legacy_module):
    if _name.startswith("_"):
        continue
    globals()[_name] = getattr(_legacy_module, _name)

# ---------------------------------------------------------------------------
# Additional helpers available under dotmac.platform.db.types
# ---------------------------------------------------------------------------

from .types import JSONBCompat  # noqa: E402  (import depends on module above)

_exported = list(getattr(_legacy_module, "__all__", [])) or [
    name for name in dir(_legacy_module) if not name.startswith("_")
]
if "JSONBCompat" not in _exported:
    _exported.append("JSONBCompat")

__all__ = _exported

# Ensure exported types module is reachable via package attribute
types = sys.modules[__name__ + ".types"]
