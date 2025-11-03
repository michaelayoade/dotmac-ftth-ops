"""add_wireguard_peer_ip_unique_constraints

Revision ID: 897bb45d5bcd
Revises: fdf1b7f6bbe1
Create Date: 2025-10-29 05:56:24.032676

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "897bb45d5bcd"
down_revision = "fdf1b7f6bbe1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add unique constraints for WireGuard peer IP addresses.

    Prevents duplicate IPv4/IPv6 addresses on the same server.
    Uses partial indexes to exclude soft-deleted peers.
    """

    # Unique constraint on (server_id, peer_ipv4) - excluding soft-deleted
    op.execute("""
        CREATE UNIQUE INDEX ix_wireguard_peer_server_ipv4_unique
        ON wireguard_peers (server_id, peer_ipv4)
        WHERE deleted_at IS NULL
    """)

    # Unique constraint on (server_id, peer_ipv6) - excluding soft-deleted and NULL IPv6
    op.execute("""
        CREATE UNIQUE INDEX ix_wireguard_peer_server_ipv6_unique
        ON wireguard_peers (server_id, peer_ipv6)
        WHERE deleted_at IS NULL AND peer_ipv6 IS NOT NULL
    """)


def downgrade() -> None:
    """Remove unique constraints for WireGuard peer IP addresses."""

    op.execute("DROP INDEX IF EXISTS ix_wireguard_peer_server_ipv6_unique")
    op.execute("DROP INDEX IF EXISTS ix_wireguard_peer_server_ipv4_unique")
