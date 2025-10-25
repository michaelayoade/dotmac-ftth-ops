"""
Reusable SQLAlchemy type helpers for cross-database compatibility.

These types allow the application to use rich PostgreSQL column types while
providing sensible fallbacks for other databases that power test suites or
lightweight deployments (e.g., SQLite for E2E tests).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import TypeDecorator


class JSONBCompat(TypeDecorator[Any]):
    """
    JSON column that uses PostgreSQL's JSONB when available.

    Falls back to SQLAlchemy's generic JSON type for dialects that do not
    provide JSONB (e.g., SQLite), ensuring our models work across the fleet of
    test databases without sacrificing the production schema.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(JSON())
