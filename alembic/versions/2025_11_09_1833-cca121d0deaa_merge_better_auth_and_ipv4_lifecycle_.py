"""merge better auth and ipv4 lifecycle migrations

Revision ID: cca121d0deaa
Revises: 18d78dc9acd0, 2025_11_09_1700
Create Date: 2025-11-09 18:33:17.225706

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "cca121d0deaa"
down_revision = ("18d78dc9acd0", "2025_11_09_1700")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
