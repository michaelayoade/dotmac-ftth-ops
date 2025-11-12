"""merge tenant enum fix with billing enum cleanup

Revision ID: df42dd51d483
Revises: a0a69d981468, 1c4f4d118c39
Create Date: 2025-11-07 08:11:49.551134

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "df42dd51d483"
down_revision = ("a0a69d981468", "1c4f4d118c39")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
