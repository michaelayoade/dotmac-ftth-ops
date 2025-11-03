"""fix_tenant_id_type_wireguard_and_tickets

Revision ID: dc94afeffd28
Revises: a6f9467bab5f
Create Date: 2025-10-28 11:09:00.236244

"""


from alembic import op

# revision identifiers, used by Alembic.
revision = "dc94afeffd28"
down_revision = "a6f9467bab5f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Change tenant_id from UUID to VARCHAR(255) to match TenantMixin."""

    # Tables that need tenant_id type fix
    tables_to_fix = [
        "wireguard_servers",
        "wireguard_peers",
        "tickets",
    ]

    for table_name in tables_to_fix:
        # Convert tenant_id from UUID to VARCHAR(255)
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN tenant_id TYPE VARCHAR(255) USING tenant_id::text
        """)


def downgrade() -> None:
    """Revert tenant_id back to UUID type."""

    # Tables to revert
    tables_to_revert = [
        "wireguard_servers",
        "wireguard_peers",
        "tickets",
    ]

    for table_name in tables_to_revert:
        # Convert tenant_id back to UUID
        op.execute(f"""
            ALTER TABLE {table_name}
            ALTER COLUMN tenant_id TYPE UUID USING tenant_id::uuid
        """)
