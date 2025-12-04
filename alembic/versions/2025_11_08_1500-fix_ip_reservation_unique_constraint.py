"""fix_ip_reservation_unique_constraint

Replace the strict UNIQUE constraint on (tenant_id, subscriber_id, ip_type)
with a partial unique index that only applies to active reservations.

Revision ID: b7e8d4f3g2h7
Revises: a8f9c3d2e1b6
Create Date: 2025-11-08 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b7e8d4f3g2h7'
down_revision: Union[str, None] = 'a8f9c3d2e1b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the overly restrictive UNIQUE constraint
    # This constraint prevented subscribers from having historical reservations
    op.drop_constraint('uq_ip_reservation_subscriber_type', 'ip_reservations', type_='unique')

    # Create a partial unique index that only applies to active reservations
    # This allows subscribers to have one active reservation per IP type,
    # but multiple released/expired historical reservations
    op.execute("""
        CREATE UNIQUE INDEX ix_ip_reservation_active_subscriber_type
        ON ip_reservations (tenant_id, subscriber_id, ip_type)
        WHERE status IN ('reserved', 'assigned') AND deleted_at IS NULL
    """)


def downgrade() -> None:
    # Drop the partial index
    op.drop_index('ix_ip_reservation_active_subscriber_type', 'ip_reservations')

    # Recreate the original UNIQUE constraint
    op.create_unique_constraint(
        'uq_ip_reservation_subscriber_type',
        'ip_reservations',
        ['tenant_id', 'subscriber_id', 'ip_type']
    )
