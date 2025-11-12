"""merge template and data transfer migrations

Revision ID: 3b0e56f89d86
Revises: 3ced5f4e9fef, 2025_11_08_1901, 2025_11_08_1905
Create Date: 2025-11-08 11:27:10.138852

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3b0e56f89d86"
down_revision = ("3ced5f4e9fef", "2025_11_08_1901", "2025_11_08_1905")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
