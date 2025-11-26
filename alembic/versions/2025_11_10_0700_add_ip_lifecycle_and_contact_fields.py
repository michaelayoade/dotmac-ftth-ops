"""Add lifecycle fields for IP pools/reservations and subscriber contact details

Revision ID: 2025_11_10_0700
Revises: 2025_11_10_0600
Create Date: 2025-11-10 07:00:00.000000
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2025_11_10_0700"
down_revision: Union[str, None] = "2025_11_10_0600"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Get connection to check for existing columns
    conn = op.get_bind()

    # IP pools: persist available_count
    result = conn.execute(sa.text(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name='ip_pools' AND column_name='available_count'
        """
    ))
    if not result.fetchone():
        op.add_column(
            "ip_pools",
            sa.Column("available_count", sa.Integer(), nullable=False, server_default="0"),
        )
        op.execute(
            """
            UPDATE ip_pools
            SET available_count = GREATEST(total_addresses - reserved_count - assigned_count, 0)
            """
        )
        op.alter_column("ip_pools", "available_count", server_default=None)

    # IP reservations: subscriber linkage and defaults
    result = conn.execute(sa.text(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name='ip_reservations' AND column_name='subscriber_id'
        """
    ))
    if not result.fetchone():
        op.add_column(
            "ip_reservations",
            sa.Column("subscriber_id", sa.String(length=255), nullable=True),
        )

    # Check and create index
    result = conn.execute(sa.text(
        """
        SELECT indexname FROM pg_indexes
        WHERE tablename='ip_reservations' AND indexname='ix_ip_reservations_subscriber_id'
        """
    ))
    if not result.fetchone():
        op.create_index(
            "ix_ip_reservations_subscriber_id",
            "ip_reservations",
            ["subscriber_id"],
            unique=False,
        )

    # Check and create foreign key
    result = conn.execute(sa.text(
        """
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='ip_reservations' AND constraint_name='fk_ip_reservations_subscriber_id'
        """
    ))
    if not result.fetchone():
        op.create_foreign_key(
            "fk_ip_reservations_subscriber_id",
            "ip_reservations",
            "subscribers",
            ["subscriber_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # Update ip_type default if needed
    op.alter_column(
        "ip_reservations",
        "ip_type",
        existing_type=sa.String(length=20),
        server_default="ipv4",
        existing_nullable=False,
    )

    # Check and create unique constraint
    result = conn.execute(sa.text(
        """
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name='ip_reservations' AND constraint_name='uq_ip_reservation_subscriber_type'
        """
    ))
    if not result.fetchone():
        op.create_unique_constraint(
            "uq_ip_reservation_subscriber_type",
            "ip_reservations",
            ["tenant_id", "subscriber_id", "ip_type"],
        )

    # Subscribers: contact info
    result = conn.execute(sa.text(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name='subscribers' AND column_name='full_name'
        """
    ))
    if not result.fetchone():
        op.add_column(
            "subscribers",
            sa.Column("full_name", sa.String(length=255), nullable=True),
        )

    result = conn.execute(sa.text(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name='subscribers' AND column_name='email'
        """
    ))
    if not result.fetchone():
        op.add_column(
            "subscribers",
            sa.Column("email", sa.String(length=255), nullable=True),
        )

    result = conn.execute(sa.text(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_name='subscribers' AND column_name='phone_number'
        """
    ))
    if not result.fetchone():
        op.add_column(
            "subscribers",
            sa.Column("phone_number", sa.String(length=32), nullable=True),
        )

    # Check and create index
    result = conn.execute(sa.text(
        """
        SELECT indexname FROM pg_indexes
        WHERE tablename='subscribers' AND indexname='ix_subscribers_email'
        """
    ))
    if not result.fetchone():
        op.create_index("ix_subscribers_email", "subscribers", ["email"], unique=False)


def downgrade() -> None:
    # Subscribers
    op.drop_index("ix_subscribers_email", table_name="subscribers")
    op.drop_column("subscribers", "phone_number")
    op.drop_column("subscribers", "email")
    op.drop_column("subscribers", "full_name")

    # IP reservations
    op.drop_constraint("uq_ip_reservation_subscriber_type", "ip_reservations", type_="unique")
    op.alter_column(
        "ip_reservations",
        "ip_type",
        existing_type=sa.String(length=20),
        server_default=None,
        existing_nullable=False,
    )
    op.drop_constraint("fk_ip_reservations_subscriber_id", "ip_reservations", type_="foreignkey")
    op.drop_index("ix_ip_reservations_subscriber_id", table_name="ip_reservations")
    op.drop_column("ip_reservations", "subscriber_id")

    # IP pools
    op.drop_column("ip_pools", "available_count")
