"""merge data transfer and field service branches

Revision ID: 2025_11_08_2100
Revises: 2025_11_08_1900, 2025_11_08_2000
Create Date: 2025-11-08 21:00:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "2025_11_08_2100"
down_revision: Union[str, tuple[str, ...]] = ("2025_11_08_1900", "2025_11_08_2000")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op merge."""
    pass


def downgrade() -> None:
    """No-op merge."""
    pass
