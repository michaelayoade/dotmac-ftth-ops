"""Cache statistics Float type conversion

This migration fixes data truncation in cache_statistics table by converting
Integer columns to Float for fields that store decimal values:
- hit_rate: Cache hit percentage (e.g., 75.5% was being truncated to 75%)
- avg_hit_latency_ms: Average cache hit latency in milliseconds
- avg_miss_latency_ms: Average cache miss latency in milliseconds

Issue: SQLAlchemy Mapped[float] annotation was using Integer column type,
causing silent data truncation when storing fractional values.

Fix: Convert Integer columns to Float to preserve decimal precision.

Revision ID: s1t2u3v4w5x6
Revises: m7n8o9p0q1r2
Create Date: 2025-10-25 20:00:00.000000

"""
import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

# revision identifiers, used by Alembic.
revision = 's1t2u3v4w5x6'
down_revision = 'm7n8o9p0q1r2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert cache statistics Integer columns to Float for decimal precision."""
    bind = op.get_bind()
    inspector = inspect(bind)

    if "cache_statistics" not in inspector.get_table_names():
        # Table not yet present in some deployments; skip migration safely.
        return

    def _needs_conversion(column: dict[str, object] | None) -> bool:
        if not column:
            return False
        try:
            python_type = column["type"].python_type  # type: ignore[attr-defined]
        except (NotImplementedError, AttributeError):
            return True  # Cannot determine type, attempt conversion
        return python_type is not float

    columns = {col["name"]: col for col in inspector.get_columns("cache_statistics")}

    hit_rate_column = columns.get("hit_rate")
    if _needs_conversion(hit_rate_column):
        op.alter_column(
            "cache_statistics",
            "hit_rate",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            existing_nullable=bool(hit_rate_column.get("nullable", False)),
            comment="Cache hit rate percentage (0.0 to 100.0) with decimal precision",
        )

    avg_hit_column = columns.get("avg_hit_latency_ms")
    if _needs_conversion(avg_hit_column):
        op.alter_column(
            "cache_statistics",
            "avg_hit_latency_ms",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            existing_nullable=bool(avg_hit_column.get("nullable", False)),
            comment="Average cache hit latency in milliseconds with decimal precision",
        )

    avg_miss_column = columns.get("avg_miss_latency_ms")
    if _needs_conversion(avg_miss_column):
        op.alter_column(
            "cache_statistics",
            "avg_miss_latency_ms",
            existing_type=sa.Integer(),
            type_=sa.Float(),
            existing_nullable=bool(avg_miss_column.get("nullable", False)),
            comment="Average cache miss latency in milliseconds with decimal precision",
        )


def downgrade() -> None:
    """Revert Float columns back to Integer (will truncate decimal values)."""

    # WARNING: This downgrade will cause data loss!
    # Decimal values will be truncated to integers.
    # Example: 75.5 → 75, 0.8 → 0

    bind = op.get_bind()
    inspector = inspect(bind)

    if "cache_statistics" not in inspector.get_table_names():
        return

    def _is_float(column: dict[str, object] | None) -> bool:
        if not column:
            return False
        try:
            python_type = column["type"].python_type  # type: ignore[attr-defined]
        except (NotImplementedError, AttributeError):
            return True
        return python_type is float

    columns = {col["name"]: col for col in inspector.get_columns("cache_statistics")}

    hit_rate_column = columns.get("hit_rate")
    if _is_float(hit_rate_column):
        op.alter_column(
            "cache_statistics",
            "hit_rate",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            existing_nullable=bool(hit_rate_column.get("nullable", False)),
            comment="Cache hit rate percentage (truncated to integer)",
        )

    avg_hit_column = columns.get("avg_hit_latency_ms")
    if _is_float(avg_hit_column):
        op.alter_column(
            "cache_statistics",
            "avg_hit_latency_ms",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            existing_nullable=bool(avg_hit_column.get("nullable", False)),
            comment="Average cache hit latency in milliseconds (truncated to integer)",
        )

    avg_miss_column = columns.get("avg_miss_latency_ms")
    if _is_float(avg_miss_column):
        op.alter_column(
            "cache_statistics",
            "avg_miss_latency_ms",
            existing_type=sa.Float(),
            type_=sa.Integer(),
            existing_nullable=bool(avg_miss_column.get("nullable", False)),
            comment="Average cache miss latency in milliseconds (truncated to integer)",
        )
