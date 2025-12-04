"""rename project management teams table to avoid conflicts

Revision ID: 2025_11_08_2000
Revises: 2025_11_08_1905
Create Date: 2025-11-08 20:00:00
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "2025_11_08_2000"
down_revision: Union[str, None] = "2025_11_08_1905"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TEAM_TABLE = "field_service_teams"
LEGACY_TABLE = "teams"

OLD_INDEXES = {
    "ix_teams_tenant_active": "ix_field_service_teams_tenant_active",
    "ix_teams_tenant_type": "ix_field_service_teams_tenant_type",
    "ix_teams_location": "ix_field_service_teams_location",
}


def _table_has_column(inspector: sa.Inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def _rename_index(old: str, new: str) -> None:
    op.execute(sa.text(f'ALTER INDEX "{old}" RENAME TO "{new}"'))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if TEAM_TABLE in tables:
        return  # Already migrated

    if LEGACY_TABLE not in tables:
        return  # Nothing to do

    # Only rename if this is the project-management table (it has team_code column)
    if not _table_has_column(inspector, LEGACY_TABLE, "team_code"):
        return

    existing_indexes = {idx["name"] for idx in inspector.get_indexes(LEGACY_TABLE)}

    op.rename_table(LEGACY_TABLE, TEAM_TABLE)

    # Rename indexes so metadata matches new names
    for old, new in OLD_INDEXES.items():
        if old in existing_indexes:
            _rename_index(old, new)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    if LEGACY_TABLE in tables or TEAM_TABLE not in tables:
        return

    op.rename_table(TEAM_TABLE, LEGACY_TABLE)

    # Rename indexes back to the legacy names if they exist
    existing_indexes = {idx["name"] for idx in inspector.get_indexes(LEGACY_TABLE)}
    for old, new in OLD_INDEXES.items():
        if new in existing_indexes:
            _rename_index(new, old)
