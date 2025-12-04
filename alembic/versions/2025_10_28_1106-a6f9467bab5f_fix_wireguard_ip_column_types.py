"""fix_wireguard_ip_column_types

Revision ID: a6f9467bab5f
Revises: c9fa6cb000e2
Create Date: 2025-10-28 11:06:13.170236

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "a6f9467bab5f"
down_revision = "c9fa6cb000e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Change WireGuard IP columns from INET to VARCHAR(45) to match model."""

    # Convert server IP columns from INET to VARCHAR
    op.execute("""
        ALTER TABLE wireguard_servers
        ALTER COLUMN server_ipv4 TYPE VARCHAR(45) USING server_ipv4::text
    """)

    op.execute("""
        ALTER TABLE wireguard_servers
        ALTER COLUMN server_ipv6 TYPE VARCHAR(45) USING server_ipv6::text
    """)

    # Convert peer IP columns from INET to VARCHAR
    op.execute("""
        ALTER TABLE wireguard_peers
        ALTER COLUMN peer_ipv4 TYPE VARCHAR(45) USING peer_ipv4::text
    """)

    op.execute("""
        ALTER TABLE wireguard_peers
        ALTER COLUMN peer_ipv6 TYPE VARCHAR(45) USING peer_ipv6::text
    """)


def downgrade() -> None:
    """Revert WireGuard IP columns back to INET type."""

    # Convert server IP columns back to INET
    op.execute("""
        ALTER TABLE wireguard_servers
        ALTER COLUMN server_ipv4 TYPE INET USING server_ipv4::inet
    """)

    op.execute("""
        ALTER TABLE wireguard_servers
        ALTER COLUMN server_ipv6 TYPE INET USING server_ipv6::inet
    """)

    # Convert peer IP columns back to INET
    op.execute("""
        ALTER TABLE wireguard_peers
        ALTER COLUMN peer_ipv4 TYPE INET USING peer_ipv4::inet
    """)

    op.execute("""
        ALTER TABLE wireguard_peers
        ALTER COLUMN peer_ipv6 TYPE INET USING peer_ipv6::inet
    """)
