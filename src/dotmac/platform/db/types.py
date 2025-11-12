"""
Reusable SQLAlchemy type helpers for cross-database compatibility.

These types allow the application to use rich PostgreSQL column types while
providing sensible fallbacks for other databases that power test suites or
lightweight deployments (e.g., SQLite for E2E tests).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import JSON, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.types import TypeDecorator

__all__ = ["JSONBCompat", "ArrayCompat"]


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


class ArrayCompat(TypeDecorator[Any]):
    """
    Array column that uses PostgreSQL's ARRAY when available.

    Falls back to JSON for SQLite and other databases, storing arrays as JSON.
    This allows list/array columns to work seamlessly across different databases.

    Usage:
        # For string arrays
        Column(ArrayCompat(String(100)), nullable=True)

        # For integer arrays
        Column(ArrayCompat(Integer), nullable=True)
    """

    impl = JSON
    cache_ok = True

    def __init__(self, item_type: Any = String, *args: Any, **kwargs: Any) -> None:
        """
        Initialize ArrayCompat.

        Args:
            item_type: SQLAlchemy type for array items (String, Integer, etc.)
        """
        self.item_type = item_type
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            # Use native PostgreSQL ARRAY type
            return dialect.type_descriptor(ARRAY(self.item_type))
        # Fall back to JSON for other databases (SQLite, MySQL, etc.)
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        """
        Process value before storing in database.

        For PostgreSQL: pass through as-is (native array support)
        For others: already handled by JSON type
        """
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        # For non-PostgreSQL, JSON serialization is automatic
        return value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        """
        Process value after loading from database.

        For PostgreSQL: pass through as-is (native array)
        For others: JSON deserialization is automatic
        """
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        # For non-PostgreSQL, JSON deserialization is automatic
        return value
