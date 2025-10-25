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
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 's1t2u3v4w5x6'
down_revision = 'm7n8o9p0q1r2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Convert cache statistics Integer columns to Float for decimal precision."""

    # Convert hit_rate from Integer to Float
    # This field stores cache hit percentage (0.0 to 100.0)
    # Example: 75.5% was being truncated to 75%
    op.alter_column(
        'cache_statistics',
        'hit_rate',
        existing_type=sa.Integer(),
        type_=sa.Float(),
        existing_nullable=False,
        comment='Cache hit rate percentage (0.0 to 100.0) with decimal precision',
    )

    # Convert avg_hit_latency_ms from Integer to Float
    # This field stores average latency in milliseconds
    # Example: 0.8ms was being truncated to 0ms
    op.alter_column(
        'cache_statistics',
        'avg_hit_latency_ms',
        existing_type=sa.Integer(),
        type_=sa.Float(),
        existing_nullable=False,
        comment='Average cache hit latency in milliseconds with decimal precision',
    )

    # Convert avg_miss_latency_ms from Integer to Float
    # This field stores average latency in milliseconds
    # Example: 1.2ms was being truncated to 1ms
    op.alter_column(
        'cache_statistics',
        'avg_miss_latency_ms',
        existing_type=sa.Integer(),
        type_=sa.Float(),
        existing_nullable=False,
        comment='Average cache miss latency in milliseconds with decimal precision',
    )


def downgrade() -> None:
    """Revert Float columns back to Integer (will truncate decimal values)."""

    # WARNING: This downgrade will cause data loss!
    # Decimal values will be truncated to integers.
    # Example: 75.5 → 75, 0.8 → 0

    op.alter_column(
        'cache_statistics',
        'hit_rate',
        existing_type=sa.Float(),
        type_=sa.Integer(),
        existing_nullable=False,
        comment='Cache hit rate percentage (truncated to integer)',
    )

    op.alter_column(
        'cache_statistics',
        'avg_hit_latency_ms',
        existing_type=sa.Float(),
        type_=sa.Integer(),
        existing_nullable=False,
        comment='Average cache hit latency in milliseconds (truncated to integer)',
    )

    op.alter_column(
        'cache_statistics',
        'avg_miss_latency_ms',
        existing_type=sa.Float(),
        type_=sa.Integer(),
        existing_nullable=False,
        comment='Average cache miss latency in milliseconds (truncated to integer)',
    )
